#!/usr/bin/env node
// Hermetic tests for scripts/mirror/deploy-payload.mjs: the generated `execute` body runs against a fake Cloudflare client (no network, no account) and the
// CLI is spawned for real. node builtins only.
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildPayload, loadFiles } from './deploy-payload.mjs';
import { gitBlobId } from '../watcher/deploy-payload.mjs';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'deploy-payload.mjs');
const ARGS = { name: 'demo-release-mirror', bucket: 'demo-releases', domain: 'dl.example.org', zone: 'example.org', cron: '23 * * * *' };
const FILES = { 'worker.mjs': 'export default {};\n', 'mirror.mjs': 'export const x = `a${1}b\\n`;\n', 'config.mjs': 'export default { org: "O" };\n' };

function fakeCloudflare({ buckets = [], zones = [{ id: 'z'.repeat(32), name: 'example.org' }], domains = [], uploadOk = true } = {}) {
  const calls = [];
  const cloudflare = {
    async request(o) {
      calls.push(o);
      const key = `${o.method} ${o.path.replace(/^\/accounts\/[^/]+/, '')}`;
      if (key === 'GET /zones') return { success: true, status: 200, result: zones };
      if (key === 'GET /r2/buckets') return { success: true, status: 200, result: { buckets: buckets.map((name) => ({ name })) } };
      if (key === 'POST /r2/buckets') return { success: true, status: 200, result: { name: o.body.name } };
      if (o.method === 'PUT' && /\/workers\/scripts\/[^/]+$/.test(o.path)) return { success: uploadOk, status: uploadOk ? 200 : 400, errors: uploadOk ? [] : [{ code: 1, message: 'bad' }], result: {} };
      if (o.method === 'PUT' && o.path.endsWith('/schedules')) return { success: true, status: 200, result: {} };
      if (o.method === 'POST' && o.path.endsWith('/subdomain')) return { success: true, status: 200, result: o.body };
      if (o.method === 'GET' && o.path.endsWith('/domains/custom')) return { success: true, status: 200, result: { domains: domains.map((domain) => ({ domain })) } };
      if (o.method === 'POST' && o.path.endsWith('/domains/custom')) return { success: true, status: 200, result: {} };
      if (o.method === 'GET' && o.path.endsWith('/settings')) return { success: true, status: 200, result: { bindings: [{ name: 'BUCKET', type: 'r2_bucket' }] } };
      if (o.method === 'GET' && o.path.endsWith('/schedules')) return { success: true, status: 200, result: { schedules: [{ cron: ARGS.cron }] } };
      return { success: false, status: 404, errors: [{ message: 'unexpected ' + key }], result: null };
    },
  };
  return { cloudflare, calls };
}
const runPayload = async (code, fake) => new Function('cloudflare', 'accountId', 'crypto', 'TextEncoder', `return (${code})();`)(fake.cloudflare, 'acct', crypto.webcrypto, TextEncoder);
const metadataOf = (calls) => { const body = calls.find((c) => c.method === 'PUT' && /\/workers\/scripts\/[^/]+$/.test(c.path)).body.split('\r\n'); return JSON.parse(body[body.indexOf('Content-Type: application/json') + 2]); };

test('a first deploy creates the bucket, uploads the Worker with the BUCKET binding, sets the schedule, switches workers.dev off, attaches the domain and reads back', async () => {
  const fake = fakeCloudflare();
  const out = await runPayload(buildPayload({ files: FILES, ...ARGS }), fake);
  const seq = fake.calls.map((c) => `${c.method} ${c.path.replace(/^\/accounts\/acct/, '')}`);
  assert.deepStrictEqual(seq, ['GET /zones', 'GET /r2/buckets', 'POST /r2/buckets', 'PUT /workers/scripts/demo-release-mirror', 'PUT /workers/scripts/demo-release-mirror/schedules', 'POST /workers/scripts/demo-release-mirror/subdomain', 'GET /r2/buckets/demo-releases/domains/custom', 'POST /r2/buckets/demo-releases/domains/custom', 'GET /workers/scripts/demo-release-mirror/settings', 'GET /workers/scripts/demo-release-mirror/schedules']);
  assert.deepStrictEqual(fake.calls[0].query, { name: 'example.org', status: 'active' });
  assert.deepStrictEqual(metadataOf(fake.calls).bindings, [{ type: 'r2_bucket', name: 'BUCKET', bucket_name: 'demo-releases' }]);
  assert.deepStrictEqual(fake.calls[4].body, [{ cron: '23 * * * *' }]);
  assert.deepStrictEqual(fake.calls[5].body, { enabled: false, previews_enabled: false });
  assert.deepStrictEqual(fake.calls[7].body, { domain: 'dl.example.org', zoneId: 'z'.repeat(32), enabled: true, minTLS: '1.2' });
  assert.deepStrictEqual([out.bucket.reused, out.domain.attached, out.crons, out.bindings], [false, true, ['23 * * * *'], ['BUCKET:r2_bucket']]);
});

test('the compatibility date is yesterday UTC, never a future date the API refuses (it refused a date one day ahead of its own clock)', async () => {
  const fake = fakeCloudflare();
  await runPayload(buildPayload({ files: FILES, ...ARGS }), fake);
  const d = metadataOf(fake.calls).compatibility_date;
  assert.match(d, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(d < new Date().toISOString().slice(0, 10), d);
});

test('a redeploy reuses the bucket and the attached domain', async () => {
  const fake = fakeCloudflare({ buckets: ['demo-releases'], domains: ['dl.example.org'] });
  const out = await runPayload(buildPayload({ files: FILES, ...ARGS }), fake);
  assert.ok(!fake.calls.some((c) => c.method === 'POST' && (c.path.endsWith('/r2/buckets') || c.path.endsWith('/domains/custom'))));
  assert.deepStrictEqual([out.bucket.reused, out.domain.alreadyAttached], [true, true]);
});

test('no active zone by that name writes nothing', async () => {
  const fake = fakeCloudflare({ zones: [] });
  const out = await runPayload(buildPayload({ files: FILES, ...ARGS }), fake);
  assert.match(out.stage, /no active zone/);
  assert.ok(!fake.calls.some((c) => c.method !== 'GET'));
});

test('a module that differs from the embedded blob id writes nothing, not even a read', async () => {
  const code = buildPayload({ files: FILES, ...ARGS }).replace(gitBlobId(FILES['mirror.mjs']), '0'.repeat(40));
  const fake = fakeCloudflare();
  const out = await runPayload(code, fake);
  assert.deepStrictEqual(out.mismatch, ['mirror.mjs']);
  assert.strictEqual(fake.calls.length, 0);
});

test('a refused upload stops before the schedule or the domain', async () => {
  const fake = fakeCloudflare({ uploadOk: false });
  const out = await runPayload(buildPayload({ files: FILES, ...ARGS }), fake);
  assert.strictEqual(out.upload.ok, false);
  assert.ok(!fake.calls.some((c) => c.path.endsWith('/schedules') || c.path.endsWith('/domains/custom')));
});

test('buildPayload refuses a bad name, bucket, domain outside its zone, or cron', () => {
  for (const bad of [{ name: 'Bad Name' }, { bucket: 'X' }, { bucket: 'a' }, { domain: 'dl.other.org' }, { domain: 'evilexample.org' }, { domain: 'not a host' }, { cron: '1 2' }, { cron: '1 2 3 4 5;x' }]) assert.throws(() => buildPayload({ files: FILES, ...ARGS, ...bad }), JSON.stringify(bad));
});

test('the shipped modules embed whole and verbatim, and the payload carries no credential-looking text', () => {
  const files = loadFiles(); const code = buildPayload({ files, ...ARGS });
  for (const [k, t] of Object.entries(files)) assert.ok(code.includes(JSON.stringify(t)), k);
  assert.ok(!/Bearer |ghp_|github_pat_|-----BEGIN/.test(code));
});

test('the CLI prints help, refuses missing flags, and writes a payload file with one summary line', () => {
  const run = (a) => spawnSync(process.execPath, ['--max-old-space-size=512', SCRIPT, ...a], { encoding: 'utf8', timeout: 30000 });
  assert.strictEqual(run(['--help']).status, 0);
  assert.strictEqual(run([]).status, 1);
  assert.strictEqual(run(['--bogus']).status, 1);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-payload-'));
  try {
    const out = path.join(tmp, 'p.js');
    const r = run(['--bucket', 'demo-releases', '--domain', 'dl.example.org', '--zone', 'example.org', '--out', out]);
    assert.strictEqual(r.status, 0, r.stderr);
    assert.match(r.stdout, /blob ids worker\.mjs=[0-9a-f]{40} mirror\.mjs=[0-9a-f]{40} config\.mjs=[0-9a-f]{40}/);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
