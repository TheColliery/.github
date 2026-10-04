#!/usr/bin/env node
// Hermetic tests for scripts/inbox/deploy-payload.mjs: the generated `execute` body runs against a fake Cloudflare client (no network, no account) and the
// CLI is spawned for real. node builtins only.
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildPayload, loadFiles, SECRET_KEY, SECRET_TTL } from './deploy-payload.mjs';
import { gitBlobId } from '../watcher/deploy-payload.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, 'deploy-payload.mjs');
const ADDRESS = 'owner-address-fixture@example.invalid';
const ARGS = { name: 'demo-github-inbox', from: 'inbox@example.invalid', org: 'DemoOrg', cron: '41 * * * *' };
const FILES = { 'worker.mjs': 'export default {};\n', 'inbox.mjs': 'export const x = `a${1}b\\n`;\n// back\\slash "quotes"\n' };

// `existing` = the Worker's current bindings (null = no such Worker yet).
function fakeCloudflare({ existing = null, addresses = [{ email: ADDRESS, verified: true }], uploadOk = true } = {}) {
  const calls = [];
  const cloudflare = {
    async request(o) {
      calls.push(o);
      const key = `${o.method} ${o.path.replace(/^\/accounts\/[^/]+/, '')}`;
      if (key === 'GET /storage/kv/namespaces') return { success: true, status: 200, result: [] };
      if (key === 'POST /storage/kv/namespaces') return { success: true, status: 200, result: { id: 'b'.repeat(32), title: o.body.title } };
      if (key === 'GET /email/routing/addresses') return { success: true, status: 200, result: addresses };
      if (o.method === 'GET' && o.path.endsWith('/settings')) {
        if (existing === null && !calls.some((c) => c.method === 'PUT' && /\/workers\/scripts\/[^/]+$/.test(c.path))) throw new Error('Cloudflare API error: 10007: not found');
        return { success: true, status: 200, result: { bindings: (existing ?? ['STATE', 'EMAIL', 'DIGEST_TO', 'DIGEST_FROM', 'ORG', 'WEBHOOK_SECRET']).map((n) => ({ name: n, type: 'x' })) } };
      }
      if (o.method === 'PUT' && /\/workers\/scripts\/[^/]+$/.test(o.path)) return { success: uploadOk, status: uploadOk ? 200 : 400, errors: uploadOk ? [] : [{ code: 1, message: 'bad' }], result: {} };
      if (o.method === 'PUT' && o.path.includes('/storage/kv/namespaces/')) return { success: true, status: 200, result: null };
      if (o.method === 'PUT' && o.path.endsWith('/schedules')) return { success: true, status: 200, result: { schedules: o.body } };
      if (o.method === 'POST' && o.path.endsWith('/subdomain')) return { success: true, status: 200, result: o.body };
      if (key === 'GET /workers/subdomain') return { success: true, status: 200, result: { subdomain: 'acme' } };
      if (o.method === 'GET' && o.path.endsWith('/schedules')) return { success: true, status: 200, result: { schedules: [{ cron: ARGS.cron }] } };
      return { success: false, status: 404, errors: [{ message: 'unexpected ' + key }], result: null };
    },
  };
  return { cloudflare, calls };
}
const fakeFetch = async (url, init) => ({ status: init.method === 'POST' ? 401 : 405 });
const runPayload = async (code, fake, f = fakeFetch) => new Function('cloudflare', 'accountId', 'crypto', 'TextEncoder', 'fetch', 'AbortSignal', `return (${code})();`)(fake.cloudflare, 'acct', crypto.webcrypto, TextEncoder, f, AbortSignal);
const metadataOf = (calls) => {
  const body = calls.find((c) => c.method === 'PUT' && /\/workers\/scripts\/[^/]+$/.test(c.path)).body.split('\r\n');
  return JSON.parse(body[body.indexOf('Content-Type: application/json') + 2]);
};

test('a first deploy draws the secret in the sandbox, binds it, leaves the same value in a short-lived KV key, and returns neither it nor the address', async () => {
  const fake = fakeCloudflare();
  const out = await runPayload(buildPayload({ files: FILES, ...ARGS }), fake);
  const bound = metadataOf(fake.calls).bindings.find((b) => b.name === 'WEBHOOK_SECRET');
  assert.strictEqual(bound.type, 'secret_text');
  assert.match(bound.text, /^[0-9a-f]{64}$/);
  const put = fake.calls.find((c) => c.method === 'PUT' && c.path.includes('/storage/kv/namespaces/'));
  assert.ok(put.path.endsWith('/values/' + encodeURIComponent(SECRET_KEY)));
  assert.deepStrictEqual(put.query, { expiration_ttl: SECRET_TTL });
  assert.strictEqual(put.body, bound.text);
  assert.strictEqual(put.rawBody, true);
  const returned = JSON.stringify(out);
  assert.ok(!returned.includes(bound.text)); assert.ok(!returned.includes(ADDRESS));
  assert.deepStrictEqual(out.secret, { mode: 'generated', kvKey: SECRET_KEY, ttlSeconds: SECRET_TTL, kvWritten: true });
});

test('a redeploy keeps the existing secret with an inherit binding and writes no new key', async () => {
  const fake = fakeCloudflare({ existing: ['STATE', 'WEBHOOK_SECRET'] });
  const out = await runPayload(buildPayload({ files: FILES, ...ARGS }), fake);
  assert.deepStrictEqual(metadataOf(fake.calls).bindings.find((b) => b.name === 'WEBHOOK_SECRET'), { type: 'inherit', name: 'WEBHOOK_SECRET' });
  assert.ok(!fake.calls.some((c) => c.method === 'PUT' && c.path.includes('/storage/kv/namespaces/')));
  assert.strictEqual(out.secret.mode, 'kept');
});

test('a settings read that fails for any reason but "no such Worker" writes nothing, so a blip never rotates the secret', async () => {
  const fake = fakeCloudflare({ existing: ['STATE', 'WEBHOOK_SECRET'] });
  const real = fake.cloudflare.request;
  fake.cloudflare.request = async (o) => { if (o.method === 'GET' && o.path.endsWith('/settings')) throw new Error('Cloudflare API error: 10000: temporarily unavailable'); return real(o); };
  const out = await runPayload(buildPayload({ files: FILES, ...ARGS }), fake);
  assert.match(out.stage, /settings read failed, nothing written/);
  assert.ok(!fake.calls.some((c) => c.method === 'PUT' || c.method === 'POST'));
});

test('--rotate draws a new secret even when one exists', async () => {
  const fake = fakeCloudflare({ existing: ['STATE', 'WEBHOOK_SECRET'] });
  const out = await runPayload(buildPayload({ files: FILES, ...ARGS, rotate: true }), fake);
  assert.strictEqual(metadataOf(fake.calls).bindings.find((b) => b.name === 'WEBHOOK_SECRET').type, 'secret_text');
  assert.strictEqual(out.secret.mode, 'generated');
});

test('the Worker gets the five named bindings, a public workers.dev route, the schedule, and both probes are read back', async () => {
  const fake = fakeCloudflare();
  const out = await runPayload(buildPayload({ files: FILES, ...ARGS }), fake);
  const b = metadataOf(fake.calls).bindings;
  assert.deepStrictEqual(b.map((x) => x.name + ':' + x.type), ['STATE:kv_namespace', 'EMAIL:send_email', 'DIGEST_TO:secret_text', 'DIGEST_FROM:plain_text', 'ORG:plain_text', 'WEBHOOK_SECRET:secret_text']);
  assert.strictEqual(b[1].destination_address, ADDRESS);
  assert.strictEqual(b[4].text, 'DemoOrg');
  assert.deepStrictEqual(fake.calls.find((c) => c.path.endsWith('/subdomain')).body, { enabled: true, previews_enabled: false });
  assert.deepStrictEqual(fake.calls.find((c) => c.method === 'PUT' && c.path.endsWith('/schedules')).body, [{ cron: '41 * * * *' }]);
  assert.strictEqual(out.url, 'https://demo-github-inbox.acme.workers.dev/');
  assert.deepStrictEqual(out.probe, { getStatus: 405, unsignedPostStatus: 401 });
  assert.deepStrictEqual(out.crons, ['41 * * * *']);
});

test('an unreachable probe is recorded, not thrown', async () => {
  const out = await runPayload(buildPayload({ files: FILES, ...ARGS }), fakeCloudflare(), async () => { throw new Error('blocked'); });
  assert.match(out.probe.getStatus, /^unreachable: blocked/);
});

test('a module that differs from the embedded blob id writes nothing', async () => {
  const code = buildPayload({ files: FILES, ...ARGS }).replace(gitBlobId(FILES['inbox.mjs']), '0'.repeat(40));
  const fake = fakeCloudflare();
  const out = await runPayload(code, fake);
  assert.match(out.stage, /blob mismatch/);
  assert.deepStrictEqual(out.mismatch, ['inbox.mjs']);
  assert.strictEqual(fake.calls.length, 0);
});

test('no verified destination address writes nothing', async () => {
  const fake = fakeCloudflare({ addresses: [{ email: ADDRESS, verified: false }] });
  const out = await runPayload(buildPayload({ files: FILES, ...ARGS }), fake);
  assert.match(out.stage, /no verified destination/);
  assert.ok(!fake.calls.some((c) => c.method === 'PUT' || c.method === 'POST'));
});

test('a refused upload stops before the secret is written or the schedule set', async () => {
  const fake = fakeCloudflare({ uploadOk: false });
  const out = await runPayload(buildPayload({ files: FILES, ...ARGS }), fake);
  assert.strictEqual(out.upload.ok, false);
  assert.ok(!fake.calls.some((c) => c.path.includes('/values/') || c.path.endsWith('/schedules')));
});

test('buildPayload refuses a bad name, cron, sender or org', () => {
  for (const bad of [{ name: 'Bad Name' }, { cron: '* *' }, { cron: '1 2 3 4 5;rm' }, { from: 'not-an-address' }, { org: 'bad org' }, { org: '' }]) {
    assert.throws(() => buildPayload({ files: FILES, ...ARGS, ...bad }));
  }
});

test('the shipped modules embed whole and verbatim, and the payload carries no credential-looking text', () => {
  const files = loadFiles();
  const code = buildPayload({ files, ...ARGS });
  for (const [k, t] of Object.entries(files)) assert.ok(code.includes(JSON.stringify(t)), k);
  assert.ok(!/Bearer |ghp_|github_pat_|-----BEGIN/.test(code));
});

test('the CLI prints help, refuses missing flags, and writes a payload file with one summary line', () => {
  const run = (a) => spawnSync(process.execPath, ['--max-old-space-size=512', SCRIPT, ...a], { encoding: 'utf8', timeout: 30000 });
  assert.strictEqual(run(['--help']).status, 0);
  assert.strictEqual(run([]).status, 1);
  assert.strictEqual(run(['--bogus']).status, 1);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'inbox-payload-'));
  try {
    const out = path.join(tmp, 'p.js');
    const r = run(['--from', 'inbox@example.invalid', '--org', 'DemoOrg', '--out', out]);
    assert.strictEqual(r.status, 0, r.stderr);
    assert.ok(fs.statSync(out).size > 1000);
    assert.match(r.stdout, /blob ids worker\.mjs=[0-9a-f]{40} inbox\.mjs=[0-9a-f]{40}/);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
