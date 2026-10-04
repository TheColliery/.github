import test from 'node:test';
import assert from 'node:assert/strict';
import { EVENTS, MAX_BODY, BATCH, verifySignature, classify, buildDigest, handleRequest, runDigest } from './inbox.mjs';
import worker from './worker.mjs';

const SECRET = 'test-secret-not-real';
const enc = new TextEncoder();
async function sign(secret, body) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(body)));
  return 'sha256=' + [...mac].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const ID = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function fakeKv() {
  const store = new Map();
  return {
    store,
    async get(k) { return store.has(k) ? store.get(k).value : null; },
    async put(k, value, opts = {}) { store.set(k, { value, metadata: opts.metadata }); },
    async delete(k) { store.delete(k); },
    async list({ prefix = '', limit = 1000 } = {}) {
      const keys = [...store.keys()].filter((k) => k.startsWith(prefix)).sort().slice(0, limit).map((name) => ({ name, metadata: store.get(name).metadata }));
      return { keys, list_complete: keys.length < limit };
    },
  };
}

async function post({ kv, event = 'repository', body, id = ID(1), secret = SECRET, sig, headers = {}, method = 'POST', env = {} }) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  const h = { 'x-github-event': event, 'x-github-delivery': id, ...headers };
  if (sig !== null) h['x-hub-signature-256'] = sig ?? (await sign(secret, text));
  const req = new Request('https://inbox.example/', { method, headers: h, body: method === 'POST' ? text : undefined });
  return handleRequest(req, { kv, secret: SECRET, ...env }, 1_700_000_000_000);
}

const repoCreated = { action: 'created', repository: { full_name: 'TheColliery/NewRepo' }, sender: { login: 'HetCreep' } };

test('verifySignature accepts the right MAC and refuses a wrong secret', async () => {
  const body = '{"a":1}';
  assert.equal(await verifySignature(SECRET, body, await sign(SECRET, body)), true);
  assert.equal(await verifySignature(SECRET, body, await sign('other', body)), false);
});

test('verifySignature refuses a tampered body, a missing header and a malformed header', async () => {
  const sig = await sign(SECRET, '{"a":1}');
  assert.equal(await verifySignature(SECRET, '{"a":2}', sig), false);
  assert.equal(await verifySignature(SECRET, '{"a":1}', null), false);
  assert.equal(await verifySignature(SECRET, '{"a":1}', ''), false);
  assert.equal(await verifySignature(SECRET, '{"a":1}', 'sha1=' + sig.slice(7)), false);
  assert.equal(await verifySignature(SECRET, '{"a":1}', 'sha256=zz' + sig.slice(9)), false);
  assert.equal(await verifySignature(SECRET, '{"a":1}', sig.slice(0, -2)), false);
  assert.equal(await verifySignature('', '{"a":1}', sig), false);
});

test('verifySignature refuses a valid MAC with anything around it', async () => {
  const sig = await sign(SECRET, '{}');
  assert.equal(await verifySignature(SECRET, '{}', sig), true);
  assert.equal(await verifySignature(SECRET, '{}', 'x ' + sig), false);
  assert.equal(await verifySignature(SECRET, '{}', sig + 'ab'), false);
});

test('classify strips C0 and C1 control characters, not only line breaks', () => {
  const r = classify('team', { action: 'created', organization: { login: 'O' }, team: { slug: 'a' + String.fromCharCode(0, 7, 0x85) + 'b' } });
  assert.equal(r.detail, 'a b');
});

test('runDigest ignores a stray key that has no record and does not delete it', async () => {
  const kv = fakeKv(); let mails = 0;
  await kv.put('ev:stray', '1');
  const out = await runDigest({ kv, send: async () => { mails++; }, now: 1, to: 't', from: 'f', org: 'O' });
  assert.equal(mails, 0); assert.equal(out.pending, 0);
  assert.ok(kv.store.has('ev:stray'));
});

test('the subscribed event list is the ten org-level events and nothing GitHub already notifies about', () => {
  assert.deepEqual([...EVENTS].sort(), ['branch_protection_configuration', 'branch_protection_rule', 'deploy_key', 'member', 'membership', 'organization', 'repository', 'repository_ruleset', 'security_and_analysis', 'team']);
});

test('classify keeps repository created, deleted, renamed, transferred, publicized, privatized, archived and unarchived', () => {
  for (const action of ['created', 'deleted', 'renamed', 'transferred', 'publicized', 'privatized', 'archived', 'unarchived']) {
    const r = classify('repository', { action, repository: { full_name: 'TheColliery/X' }, sender: { login: 'u' } });
    assert.equal(r.event, 'repository'); assert.equal(r.action, action); assert.equal(r.scope, 'TheColliery/X'); assert.equal(r.sender, 'u');
  }
});

test('classify drops a repository edit, an unknown event and a payload that is not an object', () => {
  assert.equal(classify('repository', { action: 'edited', repository: { full_name: 'a/b' } }), null);
  assert.equal(classify('issues', { action: 'opened' }), null);
  assert.equal(classify('repository', null), null);
  assert.equal(classify('repository', []), null);
  assert.equal(classify('repository', 'x'), null);
});

test('classify keeps every action of rulesets, branch protection, deploy keys, teams and security settings', () => {
  assert.equal(classify('repository_ruleset', { action: 'edited', repository: { full_name: 'a/b' }, repository_ruleset: { name: 'main-guard' } }).detail, 'main-guard');
  assert.equal(classify('branch_protection_rule', { action: 'deleted', repository: { full_name: 'a/b' }, rule: { name: 'main' } }).detail, 'main');
  assert.equal(classify('branch_protection_configuration', { action: 'disabled', repository: { full_name: 'a/b' } }).action, 'disabled');
  assert.equal(classify('deploy_key', { action: 'created', repository: { full_name: 'a/b' }, key: { title: 'ci', read_only: false } }).detail, 'ci, read-write');
  assert.equal(classify('deploy_key', { action: 'created', repository: { full_name: 'a/b' }, key: { title: 'ci', read_only: true } }).detail, 'ci, read-only');
  assert.equal(classify('team', { action: 'created', organization: { login: 'TheColliery' }, team: { slug: 'coal' } }).detail, 'coal');
  assert.equal(classify('security_and_analysis', { repository: { full_name: 'a/b' }, changes: {} }).event, 'security_and_analysis');
});

test('classify names the member of a membership, member and organization event; the scope falls back to the org', () => {
  assert.equal(classify('member', { action: 'added', repository: { full_name: 'a/b' }, member: { login: 'zed' } }).detail, 'zed');
  assert.equal(classify('membership', { action: 'added', organization: { login: 'TheColliery' }, member: { login: 'zed' }, team: { slug: 'coal' } }).detail, 'zed, coal');
  const o = classify('organization', { action: 'member_invited', organization: { login: 'TheColliery' }, invitation: { login: 'zed' } });
  assert.equal(o.scope, 'TheColliery'); assert.equal(o.detail, 'zed');
  assert.equal(classify('organization', { action: 'renamed', organization: { login: 'New' }, changes: { login: { from: 'Old' } } }).detail, 'from Old');
});

test('classify records the old name of a renamed repository and the old owner of a transferred one', () => {
  assert.equal(classify('repository', { action: 'renamed', repository: { full_name: 'a/new' }, changes: { repository: { name: { from: 'old' } } } }).detail, 'from old');
  assert.equal(classify('repository', { action: 'transferred', repository: { full_name: 'b/x' }, changes: { owner: { from: { user: { login: 'a' } } } } }).detail, 'from a');
});

test('classify cleans hostile text: control characters and newlines go, length is capped, no email-shaped field is read', () => {
  const LS = String.fromCharCode(0x2028);
  const r = classify('repository_ruleset', { action: 'created', repository: { full_name: 'a/b' }, sender: { login: 'u\nFAKE: PASS', email: 'x@y.z' }, repository_ruleset: { name: 'n\r\nSubject: forged' + LS + 'x'.repeat(500) } });
  assert.ok(!/[\r\n]/.test(r.detail) && !r.detail.includes(LS)); assert.ok(!/[\r\n]/.test(r.sender));
  assert.ok(r.detail.length <= 100);
  assert.ok(!JSON.stringify(r).includes('x@y.z'));
});

test('buildDigest lists every record in time order under one subject', () => {
  const recs = [
    { event: 'repository', action: 'deleted', scope: 'a/old', sender: 'u', detail: '', at: '2026-10-04T10:05:00.000Z' },
    { event: 'deploy_key', action: 'created', scope: 'a/b', sender: 'v', detail: 'ci, read-only', at: '2026-10-04T10:01:00.000Z' },
  ];
  const d = buildDigest({ at: '2026-10-04T11:00:00.000Z', org: 'TheColliery', records: recs, more: 0 });
  assert.equal(d.subject, '[TheColliery inbox] 2 org events');
  assert.ok(d.text.indexOf('deploy_key') < d.text.indexOf('repository'));
  assert.ok(d.text.includes('a/old') && d.text.includes('ci, read-only') && d.text.includes('by v'));
  assert.equal(d.json.records.length, 2);
  assert.equal(buildDigest({ at: 'x', org: 'O', records: [recs[0]], more: 0 }).subject, '[O inbox] 1 org event');
});

test('buildDigest says how many more are waiting when the batch was capped', () => {
  const d = buildDigest({ at: 'x', org: 'O', records: [{ event: 'team', action: 'created', scope: 'O', sender: 'u', detail: 't', at: '2026-10-04T10:00:00.000Z' }], more: 7 });
  assert.ok(d.text.includes('7 more'));
});

test('handleRequest stores a kept event under its delivery id and answers 202', async () => {
  const kv = fakeKv();
  const res = await post({ kv, body: repoCreated, id: ID(5) });
  assert.equal(res.status, 202);
  assert.deepEqual([...kv.store.keys()], ['ev:' + ID(5)]);
  const m = kv.store.get('ev:' + ID(5)).metadata;
  assert.equal(m.event, 'repository'); assert.equal(m.action, 'created'); assert.equal(m.scope, 'TheColliery/NewRepo'); assert.equal(m.at, '2023-11-14T22:13:20.000Z');
});

test('handleRequest refuses a bad signature with 401 and stores nothing', async () => {
  const kv = fakeKv();
  assert.equal((await post({ kv, body: repoCreated, sig: await sign('wrong', JSON.stringify(repoCreated)) })).status, 401);
  assert.equal((await post({ kv, body: repoCreated, sig: null })).status, 401);
  assert.equal(kv.store.size, 0);
});

test('handleRequest fails closed with 500 when no secret is configured', async () => {
  const kv = fakeKv();
  const text = JSON.stringify(repoCreated);
  const req = new Request('https://inbox.example/', { method: 'POST', headers: { 'x-github-event': 'repository', 'x-github-delivery': ID(1), 'x-hub-signature-256': await sign(SECRET, text) }, body: text });
  assert.equal((await handleRequest(req, { kv, secret: '' }, 0)).status, 500);
  assert.equal(kv.store.size, 0);
});

test('handleRequest takes POST only', async () => {
  const kv = fakeKv();
  assert.equal((await post({ kv, body: '', method: 'GET', sig: null })).status, 405);
});

test('handleRequest refuses an oversized body with 413 before any work', async () => {
  const kv = fakeKv();
  const res = await post({ kv, body: 'x'.repeat(MAX_BODY + 1), sig: 'sha256=' + '0'.repeat(64) });
  assert.equal(res.status, 413);
  const lied = await post({ kv, body: '{}', sig: 'sha256=' + '0'.repeat(64), headers: { 'content-length': String(MAX_BODY + 1) } });
  assert.equal(lied.status, 413);
});

test('handleRequest answers a ping 200 and stores nothing', async () => {
  const kv = fakeKv();
  assert.equal((await post({ kv, event: 'ping', body: { zen: 'x' } })).status, 200);
  assert.equal(kv.store.size, 0);
});

test('handleRequest accepts but does not store an event the inbox does not keep', async () => {
  const kv = fakeKv();
  assert.equal((await post({ kv, event: 'issues', body: { action: 'opened' } })).status, 202);
  assert.equal((await post({ kv, event: 'repository', body: { action: 'edited', repository: { full_name: 'a/b' } } })).status, 202);
  assert.equal(kv.store.size, 0);
});

test('handleRequest refuses a signed body that is not JSON, and a malformed delivery id, with 400', async () => {
  const kv = fakeKv();
  assert.equal((await post({ kv, body: 'not json' })).status, 400);
  assert.equal((await post({ kv, body: repoCreated, id: 'x/../y' })).status, 400);
  assert.equal(kv.store.size, 0);
});

test('a redelivery of the same delivery id is one record', async () => {
  const kv = fakeKv();
  await post({ kv, body: repoCreated, id: ID(9) });
  await post({ kv, body: repoCreated, id: ID(9) });
  assert.equal(kv.store.size, 1);
});

async function seed(kv, n) {
  for (let i = 1; i <= n; i++) await kv.put('ev:' + ID(i), '1', { metadata: { event: 'repository', action: 'created', scope: 'a/r' + i, sender: 'u', detail: '', at: new Date(1_700_000_000_000 + i * 1000).toISOString() } });
}

test('runDigest with nothing pending sends nothing', async () => {
  const kv = fakeKv(); let sent = 0;
  const out = await runDigest({ kv, send: async () => { sent++; }, now: 1, to: 't', from: 'f', org: 'O' });
  assert.equal(sent, 0); assert.equal(out.pending, 0); assert.equal(out.emailed, false);
});

test('runDigest sends ONE email for the whole batch, then deletes exactly those keys and keeps the digest readable', async () => {
  const kv = fakeKv(); const mails = [];
  await seed(kv, 3);
  const out = await runDigest({ kv, send: async (m) => { mails.push(m); }, now: 1_700_000_100_000, to: 'dest', from: 'src', org: 'O' });
  assert.equal(mails.length, 1);
  assert.equal(mails[0].to, 'dest'); assert.equal(mails[0].from, 'src');
  assert.ok(mails[0].subject.includes('3 org events'));
  assert.equal(out.emailed, true); assert.equal(out.sent, 3);
  assert.deepEqual([...kv.store.keys()], ['digest:last']);
  const last = JSON.parse(kv.store.get('digest:last').value);
  assert.equal(last.emailed, true); assert.equal(last.records.length, 3);
  assert.ok(!JSON.stringify(last).includes('dest'));
});

test('runDigest keeps every record when the email fails, and says so in the stored digest', async () => {
  const kv = fakeKv();
  await seed(kv, 2);
  const err = Object.assign(new Error('nope'), { code: 'E_SEND' });
  const out = await runDigest({ kv, send: async () => { throw err; }, now: 1, to: 't', from: 'f', org: 'O' });
  assert.equal(out.emailed, false); assert.equal(out.emailError, 'E_SEND');
  assert.equal([...kv.store.keys()].filter((k) => k.startsWith('ev:')).length, 2);
  assert.equal(JSON.parse(kv.store.get('digest:last').value).emailed, false);
});

test('runDigest caps a batch and leaves the rest for the next run', async () => {
  const kv = fakeKv(); const mails = [];
  await seed(kv, BATCH + 4);
  const out = await runDigest({ kv, send: async (m) => { mails.push(m); }, now: 1, to: 't', from: 'f', org: 'O' });
  assert.equal(out.sent, BATCH); assert.equal(out.more, 4);
  assert.ok(mails[0].text.includes('4 more'));
  assert.equal([...kv.store.keys()].filter((k) => k.startsWith('ev:')).length, 4);
});

test('the Worker entry wires fetch and scheduled to the same logic', async () => {
  const kv = fakeKv(); const mails = [];
  const env = { STATE: kv, WEBHOOK_SECRET: SECRET, DIGEST_TO: 'dest', DIGEST_FROM: 'src', ORG: 'O', EMAIL: { send: async (m) => { mails.push(m); } } };
  const text = JSON.stringify(repoCreated);
  const res = await worker.fetch(new Request('https://i.example/', { method: 'POST', headers: { 'x-github-event': 'repository', 'x-github-delivery': ID(2), 'x-hub-signature-256': await sign(SECRET, text) }, body: text }), env, { waitUntil() {} });
  assert.equal(res.status, 202);
  const waits = [];
  await worker.scheduled({ scheduledTime: 1_700_000_100_000 }, env, { waitUntil: (p) => waits.push(p) });
  assert.equal(waits.length, 1);
  await Promise.all(waits);
  assert.equal(mails.length, 1);
});
