#!/usr/bin/env node
// Hermetic tests for scripts/watcher/deploy-payload.mjs: the generated `execute` body is run against a fake Cloudflare client (no network, no account),
// and the CLI is spawned for real. node builtins only.
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildPayload, gitBlobId, loadInstance, INSTANCES } from './deploy-payload.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, 'deploy-payload.mjs');
const ADDRESS = 'owner-address-fixture@example.invalid';
const ARGS = { name: 'demo-change-watcher', from: 'watcher@example.invalid', cron: '17 * * * *' };
const FILES = { 'worker.mjs': 'export default { async scheduled() {} };\n', 'watcher.mjs': 'export const x = `a${1}b\\n`;\n// back\\slash "quotes" \'single\'\n', 'sources.mjs': 'export default { instance: "demo", maxPerRun: 1, sources: [] };\n' };

// A fake Cloudflare client: records every request, answers the few the payload makes. `existing` = KV namespaces already on the account.
function fakeCloudflare({ existing = [], addresses = [{ email: ADDRESS, verified: true }], uploadOk = true } = {}) {
  const calls = [];
  const cloudflare = {
    async request(o) {
      calls.push(o);
      const key = `${o.method} ${o.path.replace(/^\/accounts\/[^/]+/, '')}`;
      if (key === 'GET /storage/kv/namespaces') return { success: true, status: 200, result: existing };
      if (key === 'POST /storage/kv/namespaces') return { success: true, status: 200, result: { id: 'a'.repeat(32), title: o.body.title } };
      if (key === 'GET /email/routing/addresses') return { success: true, status: 200, result: addresses };
      if (o.method === 'PUT' && /\/workers\/scripts\/[^/]+$/.test(o.path)) return { success: uploadOk, status: uploadOk ? 200 : 400, errors: uploadOk ? [] : [{ code: 1, message: 'bad' }], result: {} };
      if (o.method === 'PUT' && o.path.endsWith('/schedules')) return { success: true, status: 200, result: { schedules: o.body.map((s) => ({ cron: s.cron })) } };
      if (o.method === 'POST' && o.path.endsWith('/subdomain')) return { success: true, status: 200, result: o.body };
      if (o.method === 'GET' && o.path.endsWith('/settings')) return { success: true, status: 200, result: { bindings: [{ name: 'STATE', type: 'kv_namespace' }, { name: 'DIGEST_TO', type: 'secret_text' }] } };
      if (o.method === 'GET' && o.path.endsWith('/schedules')) return { success: true, status: 200, result: { schedules: [{ cron: ARGS.cron }] } };
      return { success: false, status: 404, errors: [{ message: 'unexpected ' + key }], result: null };
    },
  };
  return { cloudflare, calls };
}
const runPayload = async (code, fake) => new Function('cloudflare', 'accountId', 'crypto', 'TextEncoder', `return (${code})();`)(fake.cloudflare, 'acct', crypto.webcrypto, TextEncoder);

test('gitBlobId equals git hash-object for the same bytes (probed: skipped visibly where git is absent)', (t) => {
  const git = spawnSync('git', ['--version'], { encoding: 'utf8', timeout: 30000 });
  if (git.status !== 0) return t.skip('git not available');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'blobid-'));
  try {
    const f = path.join(tmp, 'x.txt'); const text = 'line one\nline two กข\n';
    fs.writeFileSync(f, text, 'utf8');
    const r = spawnSync('git', ['hash-object', '--no-filters', f], { encoding: 'utf8', timeout: 30000 });
    assert.strictEqual(gitBlobId(text), r.stdout.trim());
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('the payload is one async arrow function that finds-or-creates the KV namespace, uploads the three modules, sets the schedule, switches workers.dev off and reads back', async () => {
  const code = buildPayload({ files: FILES, ...ARGS });
  const fake = fakeCloudflare();
  const out = await runPayload(code, fake);
  const seq = fake.calls.map((c) => `${c.method} ${c.path.replace(/^\/accounts\/acct/, '')}`);
  assert.deepStrictEqual(seq, [
    'GET /email/routing/addresses', 'GET /storage/kv/namespaces', 'POST /storage/kv/namespaces',
    'PUT /workers/scripts/demo-change-watcher', 'PUT /workers/scripts/demo-change-watcher/schedules',
    'POST /workers/scripts/demo-change-watcher/subdomain', 'GET /workers/scripts/demo-change-watcher/settings', 'GET /workers/scripts/demo-change-watcher/schedules',
  ]);
  assert.strictEqual(fake.calls[2].body.title, 'demo-change-watcher-state');
  assert.deepStrictEqual(fake.calls[4].body, [{ cron: ARGS.cron }]);
  assert.deepStrictEqual(fake.calls[5].body, { enabled: false, previews_enabled: false });
  assert.deepStrictEqual([out.upload.ok, out.crons], [true, [ARGS.cron]]);
  assert.deepStrictEqual(out.blobs, { 'worker.mjs': gitBlobId(FILES['worker.mjs']), 'watcher.mjs': gitBlobId(FILES['watcher.mjs']), 'sources.mjs': gitBlobId(FILES['sources.mjs']) });
});

test('the uploaded multipart carries each module byte for byte, and the metadata binds STATE, EMAIL, DIGEST_TO and DIGEST_FROM by name and type', async () => {
  const fake = fakeCloudflare();
  await runPayload(buildPayload({ files: FILES, ...ARGS }), fake);
  const put = fake.calls.find((c) => c.method === 'PUT' && /scripts\/demo-change-watcher$/.test(c.path));
  assert.strictEqual(put.rawBody, true);
  const boundary = /boundary=(.+)$/.exec(put.contentType)[1];
  const parts = put.body.split('--' + boundary).filter((p) => /name="/.test(p));
  const body = (name) => { const p = parts.find((x) => x.includes(`name="${name}"`)); return p.slice(p.indexOf('\r\n\r\n') + 4).replace(/\r\n$/, ''); };
  for (const [name, text] of Object.entries(FILES)) assert.strictEqual(body(name), text, name);
  const meta = JSON.parse(body('metadata'));
  assert.strictEqual(meta.main_module, 'worker.mjs');
  assert.deepStrictEqual(meta.bindings.map((b) => `${b.name}:${b.type}`), ['STATE:kv_namespace', 'EMAIL:send_email', 'DIGEST_TO:secret_text', 'DIGEST_FROM:plain_text']);
  assert.strictEqual(meta.bindings.find((b) => b.name === 'DIGEST_FROM').text, ARGS.from);
  assert.strictEqual(meta.bindings.find((b) => b.name === 'DIGEST_TO').text, ADDRESS);
  assert.strictEqual(meta.bindings.find((b) => b.name === 'EMAIL').destination_address, ADDRESS);
});

test('the destination address never appears in what the payload returns', async () => {
  const out = await runPayload(buildPayload({ files: FILES, ...ARGS }), fakeCloudflare());
  assert.ok(!JSON.stringify(out).includes(ADDRESS));
  assert.ok(!JSON.stringify(out).includes('example.invalid'));
});

test('an existing KV namespace of the same title is reused, never created twice', async () => {
  const fake = fakeCloudflare({ existing: [{ id: 'b'.repeat(32), title: 'demo-change-watcher-state' }] });
  const out = await runPayload(buildPayload({ files: FILES, ...ARGS }), fake);
  assert.ok(!fake.calls.some((c) => c.method === 'POST' && c.path.endsWith('/kv/namespaces')));
  const meta = JSON.parse(fake.calls.find((c) => c.method === 'PUT' && /scripts\/demo-change-watcher$/.test(c.path)).body.split('Content-Type: application/json\r\n\r\n')[1].split('\r\n')[0]);
  assert.strictEqual(meta.bindings[0].namespace_id, 'b'.repeat(32));
  assert.strictEqual(out.kv.reused, true);
});

test('the blob guard: a module changed after the payload was built is refused BEFORE any write', async () => {
  const code = buildPayload({ files: FILES, ...ARGS }).replace('export default { async scheduled() {} };', 'export default { async scheduled() { /* tampered */ } };');
  const fake = fakeCloudflare();
  const out = await runPayload(code, fake);
  assert.match(out.stage, /blob mismatch/);
  assert.deepStrictEqual(out.mismatch, ['worker.mjs']);
  assert.deepStrictEqual(fake.calls, [], 'no request of any kind was sent');
});

test('no verified destination address stops before the upload, and a failed upload stops before the schedule', async () => {
  const none = fakeCloudflare({ addresses: [{ email: ADDRESS, verified: false }] });
  const a = await runPayload(buildPayload({ files: FILES, ...ARGS }), none);
  assert.match(a.stage, /no verified destination/);
  assert.ok(!none.calls.some((c) => c.method === 'PUT' || c.method === 'POST'), 'a missing precondition writes nothing, not even the KV namespace');
  const bad = fakeCloudflare({ uploadOk: false });
  const b = await runPayload(buildPayload({ files: FILES, ...ARGS }), bad);
  assert.strictEqual(b.upload.ok, false);
  assert.ok(!bad.calls.some((c) => c.path.endsWith('/schedules') || c.path.endsWith('/subdomain')));
});

test('buildPayload refuses a bad name, cron, sender or namespace id', () => {
  assert.throws(() => buildPayload({ files: FILES, ...ARGS, name: 'Bad Name' }), /name/);
  assert.throws(() => buildPayload({ files: FILES, ...ARGS, cron: '* * *' }), /cron/);
  assert.throws(() => buildPayload({ files: FILES, ...ARGS, from: 'not-an-address' }), /from/);
  assert.throws(() => buildPayload({ files: FILES, ...ARGS, kvId: 'xyz' }), /kvId/);
});

test('loadInstance reads the shipped modules and the named list, normalised to LF; an unknown instance names the real ones', () => {
  assert.ok(INSTANCES.includes('thecolliery') && INSTANCES.includes('kolwen'), INSTANCES.join(','));
  const f = loadInstance('thecolliery');
  assert.deepStrictEqual(Object.keys(f), ['worker.mjs', 'watcher.mjs', 'sources.mjs']);
  assert.ok(Object.values(f).every((t) => !t.includes('\r')));
  assert.match(f['sources.mjs'], /instance: 'thecolliery'/);
  assert.throws(() => loadInstance('nope'), /thecolliery/);
});

test('loadInstance normalises CRLF to LF, so the blob ids match what git stores whatever the checkout\'s line endings (a Windows working copy may be CRLF)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'crlf-'));
  try {
    fs.mkdirSync(path.join(tmp, 'sources'));
    for (const f of ['worker.mjs', 'watcher.mjs']) fs.writeFileSync(path.join(tmp, f), `// ${f}\r\nexport const x = 1;\r\n`);
    fs.writeFileSync(path.join(tmp, 'sources', 'demo.mjs'), 'export default {\r\n  instance: \'demo\',\r\n};\r\n');
    const f = loadInstance('demo', tmp);
    assert.ok(Object.values(f).every((t) => !t.includes('\r') && t.endsWith('\n')));
    assert.strictEqual(gitBlobId(f['worker.mjs']), gitBlobId('// worker.mjs\nexport const x = 1;\n'));
    assert.throws(() => loadInstance('other', tmp), /demo/);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

const cli = (args) => spawnSync(process.execPath, ['--max-old-space-size=256', SCRIPT, ...args], { encoding: 'utf8', timeout: 60000, env: { PATH: process.env.PATH || '', SystemRoot: process.env.SystemRoot || '' } });

test('CLI: -h exits 0 with usage and an example; an unknown flag and a missing required flag are exit 1 naming the flag, never a stack trace', () => {
  const h = cli(['-h']);
  assert.strictEqual(h.status, 0);
  assert.match(h.stdout, /example:/);
  const unknown = cli(['thecolliery', '--from', 'a@b.co', '--wat']);
  assert.strictEqual(unknown.status, 1);
  assert.match(unknown.stderr, /--wat/);
  const missing = cli(['thecolliery']);
  assert.strictEqual(missing.status, 1);
  assert.match(missing.stderr, /--from/);
  assert.doesNotMatch(missing.stderr, /\bat .*\.mjs:\d+/);
});

test('CLI: the payload goes to stdout by default and to --out when given; the real thecolliery payload carries the shipped blob ids', () => {
  const r = cli(['thecolliery', '--from', 'watcher@example.invalid']);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stdout, /^async \(\) => \{/);
  const f = loadInstance('thecolliery');
  for (const text of Object.values(f)) assert.ok(r.stdout.includes(gitBlobId(text)));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'payload-out-'));
  try {
    const out = path.join(tmp, 'p.js');
    const w = cli(['kolwen', '--from', 'watcher@example.invalid', '--out', out]);
    assert.strictEqual(w.status, 0, w.stderr);
    assert.strictEqual(w.stdout.trim().split('\n').length, 1, 'stdout carries only the summary line');
    assert.match(fs.readFileSync(out, 'utf8'), /kolwen-change-watcher/);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
