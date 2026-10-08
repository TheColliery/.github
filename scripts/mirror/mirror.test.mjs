import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { parseTags, parseAssets, assetKey, validateConfig, runOnce, settle, buildFailureMail, FAIL_RUNS, BUDGET, USER_AGENT } from './mirror.mjs';
import worker from './worker.mjs';

const OWNER = 'DemoOrg';
const cfg = (over = {}) => ({ org: OWNER, keep: 2, repos: ['alpha', 'beta'], ...over });
const atom = (...tags) => `<?xml version="1.0"?><feed>${tags.map((t) => `<entry><id>tag:github.com,2008:Repository/1/${t}</id><link rel="alternate" type="text/html" href="https://github.com/${OWNER}/x/releases/tag/${encodeURIComponent(t)}"/><title>${t}</title></entry>`).join('')}</feed>`;
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

// R2 bucket fake: put consumes a stream or buffer, checks {sha256} the way R2 does, list pages by cursor.
function fakeBucket(initial = {}) {
  const objects = new Map(Object.entries(initial).map(([k, v]) => [k, { body: Buffer.from(v), meta: {} }]));
  const calls = { put: [], delete: [] };
  return {
    objects, calls,
    async head(key) { const o = objects.get(key); return o ? { key, size: o.body.length, customMetadata: o.meta.customMetadata } : null; },
    async get(key) { const o = objects.get(key); return o ? { text: async () => o.body.toString('utf8') } : null; },
    async put(key, value, opts = {}) {
      const body = Buffer.from(typeof value === 'string' ? value : await new Response(value).arrayBuffer());
      if (opts.sha256 && sha(body) !== opts.sha256) throw new Error('checksum mismatch');
      objects.set(key, { body, meta: opts }); calls.put.push(key);
      return { key, size: body.length };
    },
    async delete(keys) { for (const k of [].concat(keys)) { objects.delete(k); calls.delete.push(k); } },
    async list({ prefix = '', cursor, limit = 3 } = {}) {
      limit = Math.min(limit, 3); // a small page, so a listing that is not followed to its end shows
      const all = [...objects.keys()].filter((k) => k.startsWith(prefix)).sort();
      const from = cursor ? Number(cursor) : 0;
      const page = all.slice(from, from + limit);
      return { objects: page.map((key) => ({ key, size: objects.get(key).body.length })), truncated: from + limit < all.length, cursor: String(from + limit) };
    },
  };
}

// GitHub fake: atom feeds, the release page's asset list as HTML, asset bytes. `seen` records every URL fetched with its headers.
// The page also carries a source-archive link and a link to another release, which must never be copied.
function fakeGitHub({ releases = {}, atoms = {}, failAssets = false, failAtom = [], seen = [] } = {}) {
  const fetchFn = async (url, init = {}) => {
    seen.push({ url, headers: init.headers });
    const a = /^https:\/\/github\.com\/DemoOrg\/([^/]+)\/releases\.atom$/.exec(url);
    if (a) return failAtom.includes(a[1]) ? new Response('no', { status: 500 }) : new Response(atoms[a[1]] ?? atom(), { status: 200 });
    const r = /^https:\/\/github\.com\/DemoOrg\/([^/]+)\/releases\/expanded_assets\/(.+)$/.exec(url);
    if (r) {
      if (failAssets) return new Response('blocked', { status: 403 });
      const rel = releases[`${r[1]}/${decodeURIComponent(r[2])}`];
      if (!rel) return new Response('', { status: 404 });
      const li = (f) => `<li class="Box-row"><a href="/DemoOrg/${r[1]}/releases/download/${r[2]}/${encodeURIComponent(f.name)}" rel="nofollow"><span>${f.name}</span></a>${f.noDigest ? '' : `<span class="Truncate-text">sha256:${f.digest ?? sha(f.body)}</span>`}</li>`;
      return new Response(`<ul>${rel.map(li).join('')}<li><a href="/DemoOrg/${r[1]}/archive/refs/tags/${r[2]}.zip">Source code (zip)</a></li><li><a href="/DemoOrg/${r[1]}/releases/download/other/x.zip">x</a></li></ul>`, { status: 200 });
    }
    const d = /^https:\/\/github\.com\/DemoOrg\/([^/]+)\/releases\/download\/([^/]+)\/(.+)$/.exec(url);
    if (d) {
      const f = (releases[`${d[1]}/${decodeURIComponent(d[2])}`] ?? []).find((x) => x.name === decodeURIComponent(d[3]));
      const body = f?.served ?? f?.body;
      return f ? new Response(body, { status: f.missing ? 404 : 200, headers: { 'content-length': String(f.claimed ?? Buffer.byteLength(body)) } }) : new Response('x', { status: 404 });
    }
    return new Response('?', { status: 404 });
  };
  return { fetchFn, seen };
}
const run = (over) => runOnce({ config: cfg(), now: 1_700_000_000_000, ...over });

test('parseTags returns the tags of a releases feed in feed order, once each', () => {
  assert.deepEqual(parseTags(atom('v2.0.0', 'v1.9.0', 'v1.8.0')), ['v2.0.0', 'v1.9.0', 'v1.8.0']);
  assert.deepEqual(parseTags(atom('v1', 'v1')), ['v1']);
  assert.deepEqual(parseTags('<feed></feed>'), []);
  assert.deepEqual(parseTags('not xml at all'), []);
});

test('parseTags drops a tag that could not be one safe object-key segment', () => {
  assert.deepEqual(parseTags(atom('v1', 'a/b', '..', 'x y', 'v1..2', 'v2')), ['v1', 'v2']);
});

test('parseAssets reads the file names and published checksums of a release page, and nothing that is not a download of this very release', () => {
  const li = (path, text, digest) => `<li><a href="${path}"><span>${text}</span></a>${digest ? `<span>sha256:${digest}</span>` : ''}</li>`;
  const d1 = 'a'.repeat(64); const d2 = 'b'.repeat(64);
  const html = '<ul>' + li('/O/r/releases/download/v1/one.zip', 'one.zip', d1) + li('/O/r/releases/download/v1/two%20x.zip', 'two', d2) + li('/O/r/releases/download/v1/no-digest.txt', 'n') + li('/O/r/archive/refs/tags/v1.zip', 'Source code') + li('/O/r/releases/download/v0/old.zip', 'old', d1) + li('/O/other/releases/download/v1/o.zip', 'o', d1) + li('/O/r/releases/download/v1/sub/dir.zip', 'd', d1) + li('/O/r/releases/download/v1/one.zip', 'dup', d1) + '</ul>';
  assert.deepEqual(parseAssets(html, { org: 'O', repo: 'r', tag: 'v1' }), [
    { name: 'one.zip', url: 'https://github.com/O/r/releases/download/v1/one.zip', digest: d1 },
    { name: 'two x.zip', url: 'https://github.com/O/r/releases/download/v1/two%20x.zip', digest: d2 },
    { name: 'no-digest.txt', url: 'https://github.com/O/r/releases/download/v1/no-digest.txt', digest: null },
  ]);
  assert.deepEqual(parseAssets('not html', { org: 'O', repo: 'r', tag: 'v1' }), []);
});

test('assetKey is <repo>/<tag>/<file> and refuses any segment that could climb or split the path', () => {
  assert.equal(assetKey('CoalMine', 'v3.22.1', 'rot-canary.zip'), 'CoalMine/v3.22.1/rot-canary.zip');
  for (const bad of [['a/b', 'v1', 'f'], ['r', '..', 'f'], ['r', 'v1', '../f'], ['r', 'v1', 'a/b'], ['r', 'v1', ''], ['r', 'v1', 'f\nx']]) assert.throws(() => assetKey(...bad));
});

test('validateConfig accepts a sound config and names the first fault otherwise', () => {
  assert.equal(validateConfig(cfg()), null);
  for (const bad of [null, cfg({ org: 'bad org' }), cfg({ keep: 0 }), cfg({ keep: 6 }), cfg({ repos: [] }), cfg({ repos: ['a', 'a'] }), cfg({ repos: ['a/b'] }), cfg({ repos: 'alpha' })]) assert.equal(typeof validateConfig(bad), 'string');
});

test('a new release is copied under <repo>/<tag>/<file>, its checksum enforced, and a marker written last', async () => {
  const gh = fakeGitHub({ atoms: { alpha: atom('v1.0.0') }, releases: { 'alpha/v1.0.0': [{ name: 'a.zip', body: 'AAA' }, { name: 'SHA256SUMS.txt', body: 'sums' }] } });
  const bucket = fakeBucket();
  const out = await run({ bucket, fetchFn: gh.fetchFn });
  assert.equal(bucket.objects.get('alpha/v1.0.0/a.zip').body.toString(), 'AAA');
  assert.equal(bucket.objects.get('alpha/v1.0.0/a.zip').meta.sha256, sha('AAA'));
  assert.equal(bucket.objects.get('alpha/v1.0.0/a.zip').meta.httpMetadata.contentType, 'application/zip');
  assert.equal(bucket.objects.get('alpha/v1.0.0/SHA256SUMS.txt').meta.httpMetadata.contentType, 'text/plain; charset=utf-8');
  assert.equal(bucket.objects.get('alpha/v1.0.0/a.zip').meta.customMetadata.sha256, sha('AAA'));
  assert.deepEqual(bucket.calls.put.filter((k) => k.startsWith('.mirror/alpha')), ['.mirror/alpha/v1.0.0.json']);
  assert.ok(bucket.calls.put.indexOf('.mirror/alpha/v1.0.0.json') > bucket.calls.put.indexOf('alpha/v1.0.0/SHA256SUMS.txt'));
  assert.deepEqual(JSON.parse(bucket.objects.get('.mirror/alpha/v1.0.0.json').body.toString()).files.map((f) => f.name), ['a.zip', 'SHA256SUMS.txt']);
  assert.equal(out.copied, 2); assert.equal(out.errors, 0);
});

test('every request names TheColliery and the forge, and carries no credential', async () => {
  const gh = fakeGitHub({ atoms: { alpha: atom('v1') }, releases: { 'alpha/v1': [{ name: 'a.zip', body: 'A' }] } });
  await run({ bucket: fakeBucket(), fetchFn: gh.fetchFn });
  assert.ok(gh.seen.length > 0);
  for (const s of gh.seen) { assert.equal(s.headers['user-agent'], USER_AGENT); assert.ok(!('authorization' in s.headers)); }
  assert.equal(USER_AGENT, 'TheColliery-release-mirror/1 (+https://thecolliery.org)');
});

test('a release that already has its marker costs one feed read and nothing else', async () => {
  const gh = fakeGitHub({ atoms: { alpha: atom('v1') }, releases: { 'alpha/v1': [{ name: 'a.zip', body: 'A' }] } });
  const bucket = fakeBucket();
  await run({ bucket, fetchFn: gh.fetchFn });
  const before = gh.seen.length; bucket.calls.put.length = 0;
  const out = await run({ bucket, fetchFn: gh.fetchFn });
  const urls = gh.seen.slice(before).map((s) => s.url);
  // parsed, not substring-matched (CodeQL js/incomplete-url-substring-sanitization): only feed reads on github.com are allowed
  assert.deepEqual(urls.map((u) => { const p = new URL(u); return `${p.hostname}${p.pathname.endsWith('.atom') ? ' feed' : ' other'}`; }), ['github.com feed', 'github.com feed']);
  assert.equal(out.copied, 0);
  assert.deepEqual(bucket.calls.put, ['.mirror/last-run.json']);
});

test('only the latest keep releases are held: older tags and their markers are deleted by name, nothing else is touched', async () => {
  const gh = fakeGitHub({ atoms: { alpha: atom('v3', 'v2') }, releases: { 'alpha/v3': [{ name: 'a.zip', body: '3' }], 'alpha/v2': [{ name: 'a.zip', body: '2' }] } });
  const bucket = fakeBucket({ 'alpha/v1/a.zip': '1', '.mirror/alpha/v1.json': '{}', 'other/keep.txt': 'x', 'alphabet/v9/a.zip': 'y', 'top.txt': 't' });
  await run({ bucket, fetchFn: gh.fetchFn });
  assert.ok(!bucket.objects.has('alpha/v1/a.zip')); assert.ok(!bucket.objects.has('.mirror/alpha/v1.json'));
  assert.ok(bucket.objects.has('alpha/v3/a.zip') && bucket.objects.has('alpha/v2/a.zip'));
  for (const k of ['other/keep.txt', 'alphabet/v9/a.zip', 'top.txt']) assert.ok(bucket.objects.has(k), k);
  assert.deepEqual(bucket.calls.delete.sort(), ['.mirror/alpha/v1.json', 'alpha/v1/a.zip']);
});

test('a third tag in the feed is neither copied nor kept when keep is 2', async () => {
  const gh = fakeGitHub({ atoms: { alpha: atom('v3', 'v2', 'v1') }, releases: { 'alpha/v3': [{ name: 'a.zip', body: '3' }], 'alpha/v2': [{ name: 'a.zip', body: '2' }] } });
  const bucket = fakeBucket({ 'alpha/v1/a.zip': '1' });
  const out = await run({ bucket, fetchFn: gh.fetchFn });
  assert.ok(!bucket.objects.has('alpha/v1/a.zip')); assert.equal(out.errors, 0);
  assert.ok(!gh.seen.some((s) => s.url.includes('tags/v1')));
});

test('an object with no recorded checksum, or another one, already at the key is replaced, not trusted', async () => {
  const gh = fakeGitHub({ atoms: { alpha: atom('v1') }, releases: { 'alpha/v1': [{ name: 'a.zip', body: 'AAA' }] } });
  const bucket = fakeBucket({ 'alpha/v1/a.zip': 'torn' });
  await run({ bucket, fetchFn: gh.fetchFn });
  assert.equal(bucket.objects.get('alpha/v1/a.zip').body.toString(), 'AAA');
});

test('a download that answers an error status is refused even when its body happens to be the listed size', async () => {
  const gh = fakeGitHub({ atoms: { alpha: atom('v1') }, releases: { 'alpha/v1': [{ name: 'a.zip', body: 'AAA', noDigest: true, missing: true }] } });
  const bucket = fakeBucket();
  const out = await run({ bucket, fetchFn: gh.fetchFn });
  assert.ok(!bucket.objects.has('alpha/v1/a.zip')); assert.equal(out.errors, 1);
});

test('pruning pages through a long listing', async () => {
  const gh = fakeGitHub({ atoms: { alpha: atom('v9') }, releases: { 'alpha/v9': [] } });
  const initial = {}; for (let i = 0; i < 7; i++) initial[`alpha/old${i}/f`] = 'x';
  const bucket = fakeBucket(initial);
  await run({ bucket, fetchFn: gh.fetchFn });
  assert.equal([...bucket.objects.keys()].filter((k) => k.startsWith('alpha/old')).length, 0);
});

test('a failed feed read prunes nothing for that repo and is reported', async () => {
  const gh = fakeGitHub({ failAtom: ['alpha'], atoms: { beta: atom() } });
  const bucket = fakeBucket({ 'alpha/v1/a.zip': '1', '.mirror/alpha/v1.json': '{}' });
  const out = await run({ bucket, fetchFn: gh.fetchFn });
  assert.ok(bucket.objects.has('alpha/v1/a.zip')); assert.equal(bucket.calls.delete.length, 0);
  assert.ok(out.errors >= 1);
});

test('an empty feed prunes nothing either', async () => {
  const gh = fakeGitHub({ atoms: { alpha: atom() } });
  const bucket = fakeBucket({ 'alpha/v1/a.zip': '1' });
  await run({ bucket, fetchFn: gh.fetchFn });
  assert.ok(bucket.objects.has('alpha/v1/a.zip'));
});

test('a refused release page writes no marker and is retried next run', async () => {
  const releases = { 'alpha/v1': [{ name: 'a.zip', body: 'A' }] };
  const bucket = fakeBucket();
  const out = await run({ bucket, fetchFn: fakeGitHub({ atoms: { alpha: atom('v1') }, releases, failAssets: true }).fetchFn });
  assert.ok(!bucket.objects.has('.mirror/alpha/v1.json')); assert.equal(out.errors, 1);
  const again = await run({ bucket, fetchFn: fakeGitHub({ atoms: { alpha: atom('v1') }, releases }).fetchFn });
  assert.ok(bucket.objects.has('.mirror/alpha/v1.json')); assert.equal(again.errors, 0);
});

test('bytes that do not match the checksum GitHub published are refused and no marker is written', async () => {
  const gh = fakeGitHub({ atoms: { alpha: atom('v1') }, releases: { 'alpha/v1': [{ name: 'a.zip', body: 'AAA', served: 'EVIL' }] } });
  const bucket = fakeBucket();
  const out = await run({ bucket, fetchFn: gh.fetchFn });
  assert.ok(!bucket.objects.has('alpha/v1/a.zip')); assert.ok(!bucket.objects.has('.mirror/alpha/v1.json'));
  assert.equal(out.errors, 1);
});

test('a download whose body is not the length the server announced is removed and not marked, even with no digest to check', async () => {
  const gh = fakeGitHub({ atoms: { alpha: atom('v1') }, releases: { 'alpha/v1': [{ name: 'a.zip', body: 'AAA', noDigest: true, claimed: 4 }] } });
  const bucket = fakeBucket();
  const out = await run({ bucket, fetchFn: gh.fetchFn });
  assert.ok(!bucket.objects.has('alpha/v1/a.zip')); assert.ok(!bucket.objects.has('.mirror/alpha/v1.json'));
  assert.equal(out.errors, 1);
});

test('a failed asset download is reported and the other assets of the release still land, without a marker', async () => {
  const gh = fakeGitHub({ atoms: { alpha: atom('v1') }, releases: { 'alpha/v1': [{ name: 'a.zip', body: 'A', served: 'EVIL' }, { name: 'b.zip', body: 'B' }] } });
  const bucket = fakeBucket();
  await run({ bucket, fetchFn: gh.fetchFn });
  assert.ok(bucket.objects.has('alpha/v1/b.zip')); assert.ok(!bucket.objects.has('alpha/v1/a.zip')); assert.ok(!bucket.objects.has('.mirror/alpha/v1.json'));
});

test('an asset already in the bucket with the published checksum recorded is not downloaded again', async () => {
  const gh = fakeGitHub({ atoms: { alpha: atom('v1') }, releases: { 'alpha/v1': [{ name: 'a.zip', body: 'AAA' }, { name: 'b.zip', body: 'B' }] } });
  const bucket = fakeBucket();
  await bucket.put('alpha/v1/a.zip', 'AAA', { customMetadata: { sha256: sha('AAA') } });
  await run({ bucket, fetchFn: gh.fetchFn });
  assert.ok(!gh.seen.some((s) => s.url.endsWith('/v1/a.zip')));
  assert.ok(gh.seen.some((s) => s.url.endsWith('/v1/b.zip')));
  assert.ok(bucket.objects.has('.mirror/alpha/v1.json'));
});

test('the run stays inside the external-request budget and finishes the rest next run', async () => {
  const files = Array.from({ length: 30 }, (_, i) => ({ name: `f${i}.zip`, body: 'x' + i }));
  const gh = fakeGitHub({ atoms: { alpha: atom('v1') }, releases: { 'alpha/v1': files } });
  const bucket = fakeBucket();
  const first = await run({ bucket, fetchFn: gh.fetchFn });
  assert.ok(gh.seen.length <= BUDGET, `${gh.seen.length} requests`);
  assert.ok(!bucket.objects.has('.mirror/alpha/v1.json')); assert.ok(first.deferred >= 1);
  await run({ bucket, fetchFn: gh.fetchFn });
  assert.ok(bucket.objects.has('.mirror/alpha/v1.json'));
});

test('the last run is stored where the API can read it, with counts and no address', async () => {
  const gh = fakeGitHub({ atoms: { alpha: atom('v1') }, releases: { 'alpha/v1': [{ name: 'a.zip', body: 'A' }] } });
  const bucket = fakeBucket();
  await run({ bucket, fetchFn: gh.fetchFn });
  const last = JSON.parse(bucket.objects.get('.mirror/last-run.json').body.toString());
  assert.equal(last.at, '2023-11-14T22:13:20.000Z'); assert.equal(last.copied, 1); assert.equal(last.repos, 2);
  assert.ok(!/@/.test(JSON.stringify(last)));
});

test('the Worker entry runs on the cron tick with the bucket binding, writes the last-run record, and has no fetch handler', async () => {
  const bucket = fakeBucket();
  const waits = [];
  const realFetch = globalThis.fetch; globalThis.fetch = async () => new Response('down', { status: 503 });
  try { await worker.scheduled({ scheduledTime: 1_700_000_000_000 }, { BUCKET: bucket }, { waitUntil: (p) => waits.push(p) }); await Promise.all(waits); } finally { globalThis.fetch = realFetch; }
  assert.equal(waits.length, 1);
  const last = JSON.parse(bucket.objects.get('.mirror/last-run.json').body.toString());
  assert.equal(last.repos, 8); assert.equal(last.errors, 8);
  assert.equal(worker.fetch, undefined);
});

// ---- UMB-454 / BB-46 (1): ONE mail after three failed runs in a row, reported once per trouble spell (the watcher's own pattern) ----
const bad = (problems = ['CoalMine@v3.22.1: release page HTTP 503']) => ({ at: '2026-10-08T03:23:21.000Z', repos: 8, copied: 0, releasesDone: 0, deferred: 0, pruned: 0, errors: problems.length, problems });
const good = () => ({ at: '2026-10-08T04:23:21.000Z', repos: 8, copied: 0, releasesDone: 0, deferred: 0, pruned: 0, errors: 0, problems: [] });
const mailer = () => { const sent = []; return { sent, send: async (m) => { sent.push(m); }, to: 'dest-fixture', from: 'from-fixture' }; };

test('buildFailureMail names the run, the number of failed runs, and every failing repo and error in one line each, with no address and nothing a line break could split', () => {
  const m = buildFailureMail({ org: 'TheColliery', fails: 3, run: bad(['CoalMine@v3.22.1: release page HTTP 503', 'CoalFace: feed bad\nBcc: x']) });
  assert.strictEqual(m.subject, '[TheColliery mirror] release mirror failing for 3 runs');
  const lines = m.text.split('\n');
  assert.ok(lines[0].includes('2026-10-08T03:23:21.000Z'), 'the run');
  assert.ok(lines.includes('  CoalMine@v3.22.1: release page HTTP 503'));
  assert.ok(lines.includes('  CoalFace: feed bad Bcc: x'), 'one line, the break gone');
  assert.doesNotMatch(m.subject + m.text, /[A-Za-z0-9._-]+@[A-Za-z0-9-]+\.[a-z]{2,}/, 'no address (a repo@tag is not one)');
  const big = buildFailureMail({ org: 'O', fails: 3, run: bad(Array.from({ length: 30 }, (_, i) => 'r' + i + ': ' + 'e'.repeat(500))) });
  assert.ok(big.text.split('\n').every((l) => l.length <= 210));
  assert.strictEqual(big.text.split('\n').filter((l) => /^ {2}r\d+: /.test(l)).length, 10, 'ten problems named');
  assert.ok(big.text.includes('  and 20 more'), 'and the rest counted');
});

test('settle: a clean run with no streak sends nothing and writes nothing', async () => {
  const bucket = fakeBucket(); const mail = mailer();
  const out = await settle({ bucket, run: good(), ...mail });
  assert.deepStrictEqual([mail.sent.length, bucket.calls.put.length, out.mailed], [0, 0, false]);
});

test('settle: two failed runs send nothing; the third sends ONE mail; the fourth and fifth send none; a clean run ends the spell; the next three send one again', async () => {
  const bucket = fakeBucket(); const mail = mailer();
  const step = (run) => settle({ bucket, run, ...mail });
  await step(bad()); await step(bad());
  assert.strictEqual(mail.sent.length, 0, 'fewer than ' + FAIL_RUNS);
  const third = await step(bad());
  assert.strictEqual(mail.sent.length, 1); assert.strictEqual(third.mailed, true);
  assert.deepStrictEqual([mail.sent[0].to, mail.sent[0].from], ['dest-fixture', 'from-fixture']);
  await step(bad());
  const putsAtFour = bucket.calls.put.length;
  await step(bad());
  assert.strictEqual(mail.sent.length, 1, 'once per trouble spell');
  assert.strictEqual(bucket.calls.put.length, putsAtFour, 'a reported, capped spell writes nothing more');
  assert.strictEqual(JSON.parse(bucket.objects.get('.mirror/streak.json').body.toString()).fails, FAIL_RUNS, 'the streak is capped at the threshold');
  await step(good());
  assert.strictEqual(JSON.parse(bucket.objects.get('.mirror/streak.json').body.toString()).fails, 0);
  await step(bad()); await step(bad());
  assert.strictEqual(mail.sent.length, 1);
  await step(bad());
  assert.strictEqual(mail.sent.length, 2, 'a new spell is a new mail');
});

test('settle: a failed send keeps the spell unreported, so the next failed run tries again; the error is named and not thrown', async () => {
  const bucket = fakeBucket(); const sent = [];
  let boom = true;
  const send = async (m) => { if (boom) { const e = new Error('nope'); e.code = 'E_SEND'; throw e; } sent.push(m); };
  for (let i = 0; i < 3; i++) await settle({ bucket, run: bad(), send, to: 't', from: 'f' });
  const failed = JSON.parse(bucket.objects.get('.mirror/streak.json').body.toString());
  assert.deepStrictEqual([failed.fails, failed.reported, failed.mailError], [3, false, 'E_SEND']);
  boom = false;
  const again = await settle({ bucket, run: bad(), send, to: 't', from: 'f' });
  assert.deepStrictEqual([sent.length, again.mailed], [1, true]);
});

test('settle: a run with deferred work and no error is not a failure; a missing mail binding counts the streak and sends nothing', async () => {
  const bucket = fakeBucket(); const mail = mailer();
  for (let i = 0; i < 4; i++) await settle({ bucket, run: { ...good(), deferred: 3 }, ...mail });
  assert.strictEqual(mail.sent.length, 0);
  assert.ok(!bucket.objects.has('.mirror/streak.json'));
  for (let i = 0; i < 3; i++) await settle({ bucket, run: bad(), send: undefined, to: undefined, from: undefined });
  const kept = JSON.parse(bucket.objects.get('.mirror/streak.json').body.toString());
  assert.deepStrictEqual(kept, { fails: 3, reported: false }, 'counted, not reported, no error invented');
});

test('settle writes the streak only when it changed: a quiet run after a clean streak writes nothing', async () => {
  const bucket = fakeBucket(); const mail = mailer();
  await settle({ bucket, run: bad(), ...mail });
  bucket.calls.put.length = 0;
  await settle({ bucket, run: bad(), ...mail });
  assert.strictEqual(bucket.calls.put.length, 1, 'a growing streak is a change');
  await settle({ bucket, run: good(), ...mail });
  bucket.calls.put.length = 0;
  await settle({ bucket, run: good(), ...mail }); await settle({ bucket, run: good(), ...mail });
  assert.strictEqual(bucket.calls.put.length, 0);
});

test('the Worker sends the failure mail on the third failed tick through its EMAIL binding, from DIGEST_FROM to DIGEST_TO', async () => {
  const bucket = fakeBucket(); const mails = [];
  const env = { BUCKET: bucket, EMAIL: { send: async (m) => { mails.push(m); } }, DIGEST_TO: 'dest-fixture', DIGEST_FROM: 'from-fixture' };
  const realFetch = globalThis.fetch; globalThis.fetch = async () => new Response('down', { status: 503 });
  try {
    for (let i = 0; i < 3; i++) { const waits = []; await worker.scheduled({ scheduledTime: 1_700_000_000_000 + i * 3600_000 }, env, { waitUntil: (p) => waits.push(p) }); await Promise.all(waits); }
  } finally { globalThis.fetch = realFetch; }
  assert.strictEqual(mails.length, 1);
  assert.deepStrictEqual([mails[0].to, mails[0].from], ['dest-fixture', 'from-fixture']);
  assert.match(mails[0].subject, /failing for 3 runs/);
  assert.match(mails[0].text, /CoalMine: feed HTTP 503/);
});
