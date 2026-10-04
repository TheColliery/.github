#!/usr/bin/env node
// Hermetic tests for the change watcher (scripts/watcher/watcher.mjs): pure parsing, change detection, the digest and one whole run with a fake
// KV, fake fetch and fake email binding. No network, no clock, no Cloudflare. node builtins only.
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  USER_AGENT, BODY_CAP, parseFeed, headingsKey, rawKey, keyFor, isDue, pickRun, fetchSource, buildDigest, runOnce, validateConfig,
} from './watcher.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const atom = (...titles) => `<?xml version="1.0"?><feed><title>Release notes</title>${titles.map((t, i) => `<entry><id>tag:github.com,2008:Repository/1/${t}</id><updated>2026-10-0${i + 1}T00:00:00Z</updated><link rel="alternate" href="https://example.invalid/r/${t}"/><title>${t}</title></entry>`).join('')}</feed>`;
const rss = `<rss><channel><title>x</title><item><title><![CDATA[Plaid &amp; Speed]]></title><link>https://example.invalid/a</link><guid>g-1</guid><pubDate>Mon, 01 Oct 2026 00:00:00 GMT</pubDate></item><item><title>Older</title><guid>g-0</guid></item></channel></rss>`;

test('parseFeed reads the first atom entry: id, title, link, updated', () => {
  const r = parseFeed(atom('v2.0.1', 'v2.0.0'));
  assert.deepStrictEqual([r.key, r.title, r.link, r.updated], ['tag:github.com,2008:Repository/1/v2.0.1', 'v2.0.1', 'https://example.invalid/r/v2.0.1', '2026-10-01T00:00:00Z']);
});

test('parseFeed reads an RSS item: guid as key, CDATA and entities decoded in the title', () => {
  const r = parseFeed(rss);
  assert.deepStrictEqual([r.key, r.title, r.link], ['g-1', 'Plaid & Speed', 'https://example.invalid/a']);
});

test('parseFeed skips entries whose title matches ignoreTitle and takes the first one that does not', () => {
  const r = parseFeed(atom('v3.0.0-nightly.1', 'v3.0.0-alpha.2', 'v2.9.0'), { ignoreTitle: 'nightly|alpha' });
  assert.strictEqual(r.title, 'v2.9.0');
});

test('parseFeed returns null for no entry, for all entries ignored, and for text that is not a feed', () => {
  assert.strictEqual(parseFeed('<feed></feed>'), null);
  assert.strictEqual(parseFeed(atom('nightly'), { ignoreTitle: 'nightly' }), null);
  assert.strictEqual(parseFeed('<html><body>hi</body></html>'), null);
});

test('headingsKey joins the first three headings, tags stripped and entities decoded; none gives null', () => {
  const html = '<h1>Changelog</h1><p>x</p><h2><a href="/a">What&#x27;s &amp; new</a></h2><h3>  Third  one </h3><h2>fourth</h2>';
  const r = headingsKey(html);
  assert.strictEqual(r.key, "Changelog | What's & new | Third one");
  assert.strictEqual(r.title, "What's & new");
  assert.strictEqual(headingsKey('<p>no headings</p>'), null);
});

test('text taken from a page or feed never carries a "<": tags are stripped by character, so no nesting or unterminated tag leaves one (CodeQL js/incomplete-multi-character-sanitization)', () => {
  for (const hostile of ['a<b', 'x<scr<script>ipt>y', '<<b>script>z', 'q<!-- c --', '1 < 2']) {
    const r = headingsKey(`<h1>${hostile}</h1>`);
    assert.ok(r === null || !r.key.includes('<'), JSON.stringify(hostile) + ' -> ' + JSON.stringify(r));
  }
  // entities decode AFTER stripping, so an escaped angle bracket in a title is text and stays text
  assert.strictEqual(headingsKey('<h1>a &lt;b&gt; c</h1>').key, 'a <b> c');
});

test('rawKey changes when the text changes, keeps when it does not, and titles itself with the first heading line', async () => {
  const a = await rawKey('# Changelog\n\n## 1.2.0\n- x\n');
  assert.strictEqual(a.key, (await rawKey('# Changelog\n\n## 1.2.0\n- x\n')).key);
  assert.notStrictEqual(a.key, (await rawKey('# Changelog\n\n## 1.2.1\n- x\n')).key);
  assert.match(a.key, /^[0-9a-f]{64}$/);
  assert.strictEqual(a.title, '1.2.0');
  assert.strictEqual((await rawKey('{"name":"@x/y","version":"0.24.7","dist":{}}')).title, '0.24.7');
});

test('keyFor dispatches on kind and refuses an unknown one', async () => {
  assert.strictEqual((await keyFor({ kind: 'atom' }, atom('v1'))).title, 'v1');
  assert.strictEqual((await keyFor({ kind: 'rss' }, rss)).title, 'Plaid & Speed');
  assert.strictEqual((await keyFor({ kind: 'headings' }, '<h1>A</h1>')).key, 'A');
  assert.match((await keyFor({ kind: 'raw' }, 'x')).key, /^[0-9a-f]{64}$/);
  await assert.rejects(() => keyFor({ kind: 'telepathy' }, 'x'), /unknown kind/);
});

test('isDue staggers by index: an everyHours=3 source is due once in any three consecutive hours, an everyHours=1 source every hour', () => {
  for (const index of [0, 1, 2, 7]) {
    const due = [0, 1, 2].map((h) => isDue({ everyHours: 3 }, index, 1000 + h)).filter(Boolean).length;
    assert.strictEqual(due, 1, 'index ' + index);
  }
  assert.ok([5, 6, 7, 8].every((h) => isDue({}, 4, h)));
});

test('pickRun returns the due sources in list order and defers what passes maxPerRun, naming it', () => {
  const sources = Array.from({ length: 6 }, (_, i) => ({ id: 's' + i, everyHours: 1 }));
  const r = pickRun(sources, 10, 4);
  assert.deepStrictEqual(r.run.map((s) => s.id), ['s0', 's1', 's2', 's3']);
  assert.deepStrictEqual(r.deferred.map((s) => s.id), ['s4', 's5']);
});

// A fake fetch: routes by URL; records the request headers; the body is a stream so the cap can be observed.
const fakeFetch = (routes, seen = []) => async (url, init = {}) => {
  seen.push({ url, headers: init.headers || {} });
  const r = routes[url];
  if (r instanceof Error) throw r;
  const { status = 200, body = '', headers = {} } = r;
  return new Response(status === 304 ? null : body, { status, headers });
};

test('fetchSource names TheColliery and the forge in the User-Agent and sends the stored validators', async () => {
  const seen = [];
  const s = { id: 'a', url: 'https://example.invalid/a.atom', kind: 'atom' };
  await fetchSource(s, { etag: '"abc"', lastModified: 'Mon, 01 Oct 2026 00:00:00 GMT', key: 'k' }, fakeFetch({ [s.url]: { status: 304 } }, seen));
  assert.match(seen[0].headers['user-agent'], /TheColliery/);
  assert.ok(seen[0].headers['user-agent'].includes('https://thecolliery.org'));
  assert.strictEqual(USER_AGENT, seen[0].headers['user-agent']);
  assert.strictEqual(seen[0].headers['if-none-match'], '"abc"');
  assert.strictEqual(seen[0].headers['if-modified-since'], 'Mon, 01 Oct 2026 00:00:00 GMT');
  const noPrev = [];
  await fetchSource(s, undefined, fakeFetch({ [s.url]: { status: 304 } }, noPrev));
  assert.ok(!('if-none-match' in noPrev[0].headers) && !('if-modified-since' in noPrev[0].headers));
});

test('fetchSource: 304 is same; an equal key is same; a new key is changed with from and to; no previous state is new', async () => {
  const s = { id: 'a', url: 'https://example.invalid/a.atom', kind: 'atom' };
  const f = (body, headers) => fakeFetch({ [s.url]: { body, headers } });
  assert.strictEqual((await fetchSource(s, { key: 'k' }, fakeFetch({ [s.url]: { status: 304 } }))).status, 'same');
  const prevKey = parseFeed(atom('v1')).key;
  assert.strictEqual((await fetchSource(s, { key: prevKey }, f(atom('v1')))).status, 'same');
  const ch = await fetchSource(s, { key: prevKey, title: 'v1' }, f(atom('v2', 'v1'), { etag: '"e2"' }));
  assert.deepStrictEqual([ch.status, ch.from, ch.to, ch.link, ch.etag], ['changed', 'v1', 'v2', 'https://example.invalid/r/v2', '"e2"']);
  const fresh = await fetchSource(s, undefined, f(atom('v7'), { 'last-modified': 'L' }));
  assert.deepStrictEqual([fresh.status, fresh.to, fresh.lastModified], ['new', 'v7', 'L']);
});

test('fetchSource: a non-2xx status, a thrown fetch and an unreadable body are errors that name the cause, never a throw', async () => {
  const s = { id: 'a', url: 'https://example.invalid/a.atom', kind: 'atom' };
  const r404 = await fetchSource(s, undefined, fakeFetch({ [s.url]: { status: 404 } }));
  assert.deepStrictEqual([r404.status, r404.error], ['error', 'HTTP 404']);
  const boom = await fetchSource(s, undefined, fakeFetch({ [s.url]: new Error('connection reset') }));
  assert.deepStrictEqual([boom.status, boom.error], ['error', 'connection reset']);
  const empty = await fetchSource(s, undefined, fakeFetch({ [s.url]: { body: '<html></html>' } }));
  assert.deepStrictEqual([empty.status, empty.error], ['error', 'no entry found']);
});

test('fetchSource: a feed whose first entries are ALL ignored (an alpha-only run of tags) is quiet, same, never an error', async () => {
  const s = { id: 'a', url: 'https://example.invalid/a.atom', kind: 'atom', ignoreTitle: 'alpha' };
  const r = await fetchSource(s, { key: 'old', title: 'v1' }, fakeFetch({ [s.url]: { body: atom('v2-alpha.1', 'v2-alpha.2') } }));
  assert.strictEqual(r.status, 'same');
  const none = await fetchSource(s, undefined, fakeFetch({ [s.url]: { body: atom('v2-alpha.1') } }));
  assert.strictEqual(none.status, 'same');
  // real feeds put attributes on the entry element (GitHub: <entry xml:lang="en-US">): the guard must not depend on a bare <entry>
  const attr = await fetchSource(s, undefined, fakeFetch({ [s.url]: { body: atom('v2-alpha.1').replace(/<entry>/g, '<entry xml:lang="en-US">') } }));
  assert.strictEqual(attr.status, 'same');
});

test('fetchSource reads at most BODY_CAP bytes of a body and cancels the rest', async () => {
  let pulled = 0;
  const chunk = new TextEncoder().encode('x'.repeat(16384));
  const stream = new ReadableStream({ pull(c) { pulled += chunk.length; c.enqueue(chunk); } });
  const fetchFn = async () => new Response(stream, { status: 200 });
  const r = await fetchSource({ id: 'a', url: 'https://example.invalid/big', kind: 'raw' }, undefined, fetchFn);
  assert.strictEqual(r.status, 'new');
  assert.ok(pulled <= BODY_CAP + 2 * chunk.length, 'pulled ' + pulled);
});

test('buildDigest: ONE digest for many changes, each by platform with from, to and link; baselines counted; errors named; no address anywhere', () => {
  const d = buildDigest({
    at: '2026-10-04T12:00:00Z', instance: 'thecolliery',
    results: [
      { source: { id: 'a', name: 'Alpha', url: 'https://example.invalid/a' }, status: 'changed', from: 'v1', to: 'v2', link: 'https://example.invalid/r/v2' },
      { source: { id: 'b', name: 'Beta', url: 'https://example.invalid/b' }, status: 'changed', from: 'x', to: 'y', link: '' },
      { source: { id: 'c', name: 'Gamma', url: 'https://example.invalid/c' }, status: 'new', to: 'g1' },
      { source: { id: 'd', name: 'Delta', url: 'https://example.invalid/d' }, status: 'error', error: 'HTTP 500', fails: 3 },
      { source: { id: 'e', name: 'Eps', url: 'https://example.invalid/e' }, status: 'same' },
    ],
  });
  assert.match(d.subject, /thecolliery/);
  assert.match(d.subject, /2 changed/);
  assert.match(d.text, /Alpha: v1 -> v2\n\s+https:\/\/example\.invalid\/r\/v2/);
  assert.match(d.text, /Beta: x -> y/);
  assert.match(d.text, /Baselined 1 source/);
  assert.match(d.text, /Gamma/);
  assert.match(d.text, /Delta .*HTTP 500.*3 runs/);
  assert.doesNotMatch(d.text, /Eps/);
  assert.doesNotMatch(d.text + d.subject, /@/);
  assert.deepStrictEqual([d.json.changed.length, d.json.baselined.length, d.json.failing.length], [2, 1, 1]);
});

// A fake KV that counts its writes, and an email binding that records what it was handed.
const fakeKv = (initial = {}) => {
  const store = { ...initial };
  const writes = [];
  return { store, writes, get: async (k, type) => (k in store ? (type === 'json' ? JSON.parse(store[k]) : store[k]) : null), put: async (k, v) => { writes.push(k); store[k] = v; } };
};
const cfg = (n = 2) => ({ instance: 'thecolliery', maxPerRun: 24, sources: Array.from({ length: n }, (_, i) => ({ id: 's' + i, name: 'S' + i, url: 'https://example.invalid/s' + i, kind: 'atom', everyHours: 1 })) });
const runWith = ({ kv, routes, send, now = Date.UTC(2026, 9, 4, 12), config = cfg() }) => runOnce({ config, kv, fetchFn: fakeFetch(routes), send, now, to: 'owner-address', from: 'from-address' });

test('runOnce, first sight of the list: baselines every source, writes state and digest once, sends ONE email, and says so', async () => {
  const kv = fakeKv(); const sent = [];
  const routes = { 'https://example.invalid/s0': { body: atom('a1') }, 'https://example.invalid/s1': { body: atom('b1') } };
  const r = await runWith({ kv, routes, send: async (m) => { sent.push(m); return { messageId: 'm' }; } });
  assert.deepStrictEqual([r.checked, r.baselined, r.changed, r.emailed], [2, 2, 0, true]);
  assert.strictEqual(sent.length, 1);
  assert.deepStrictEqual(kv.writes.sort(), ['digest:last', 'state']);
  assert.strictEqual(sent[0].to, 'owner-address');
  assert.strictEqual(sent[0].from, 'from-address');
  assert.strictEqual(JSON.parse(kv.store['digest:last']).emailed, true);
});

test('runOnce, nothing changed: no KV write, no email, no matter how many sources were checked', async () => {
  const kv = fakeKv(); const sent = [];
  const routes = { 'https://example.invalid/s0': { body: atom('a1') }, 'https://example.invalid/s1': { body: atom('b1') } };
  await runWith({ kv, routes, send: async () => ({}) });
  kv.writes.length = 0;
  const r = await runWith({ kv, routes, send: async (m) => { sent.push(m); } });
  assert.deepStrictEqual([r.checked, r.changed, r.baselined, r.emailed], [2, 0, 0, false]);
  assert.deepStrictEqual(kv.writes, []);
  assert.strictEqual(sent.length, 0);
});

test('runOnce, two sources changed in one run: ONE email, one state write, one digest write', async () => {
  const kv = fakeKv(); const sent = [];
  await runWith({ kv, routes: { 'https://example.invalid/s0': { body: atom('a1') }, 'https://example.invalid/s1': { body: atom('b1') } }, send: async () => ({}) });
  kv.writes.length = 0;
  const r = await runWith({ kv, routes: { 'https://example.invalid/s0': { body: atom('a2', 'a1') }, 'https://example.invalid/s1': { body: atom('b2', 'b1') } }, send: async (m) => { sent.push(m); } });
  assert.strictEqual(r.changed, 2);
  assert.strictEqual(sent.length, 1);
  assert.deepStrictEqual(kv.writes.sort(), ['digest:last', 'state']);
  assert.match(sent[0].text, /S0: a1 -> a2/);
  assert.match(sent[0].text, /S1: b1 -> b2/);
});

test('runOnce: a failing email binding never loses the digest or the state; emailed is false and the error is named', async () => {
  const kv = fakeKv();
  const routes = { 'https://example.invalid/s0': { body: atom('a1') }, 'https://example.invalid/s1': { body: atom('b1') } };
  const r = await runWith({ kv, routes, send: async () => { throw new Error('E_SENDER_NOT_VERIFIED'); } });
  assert.strictEqual(r.emailed, false);
  assert.strictEqual(r.emailError, 'E_SENDER_NOT_VERIFIED');
  assert.strictEqual(JSON.parse(kv.store['digest:last']).emailed, false);
  assert.ok(JSON.parse(kv.store.state).sources.s0.key);
});

test('runOnce: a source failing three runs in a row is reported ONCE, at the third; fewer or more is silent; recovery clears the count with one write', async () => {
  const kv = fakeKv(); const sent = [];
  const good = { 'https://example.invalid/s0': { body: atom('a1') }, 'https://example.invalid/s1': { body: atom('b1') } };
  await runWith({ kv, routes: good, send: async () => ({}) });
  const bad = { ...good, 'https://example.invalid/s1': { status: 500 } };
  const send = async (m) => { sent.push(m); };
  kv.writes.length = 0;
  await runWith({ kv, routes: bad, send }); await runWith({ kv, routes: bad, send });
  assert.strictEqual(sent.length, 0);
  await runWith({ kv, routes: bad, send });
  assert.strictEqual(sent.length, 1);
  assert.match(sent[0].text, /S1 .*HTTP 500.*3 runs/);
  const writesAtThree = kv.writes.length;
  await runWith({ kv, routes: bad, send });
  assert.strictEqual(sent.length, 1);
  assert.strictEqual(kv.writes.length, writesAtThree, 'past the threshold nothing is written');
  await runWith({ kv, routes: good, send });
  assert.strictEqual(JSON.parse(kv.store.state).sources.s1.fails, 0);
});

test('runOnce: a source with a stored validator is asked conditionally and a 304 changes nothing', async () => {
  const kv = fakeKv(); const seen = [];
  const r0 = { 'https://example.invalid/s0': { body: atom('a1'), headers: { etag: '"e"' } } };
  const config = cfg(1);
  await runOnce({ config, kv, fetchFn: fakeFetch(r0), send: async () => ({}), now: 1, to: 't', from: 'f' });
  kv.writes.length = 0;
  const r = await runOnce({ config, kv, fetchFn: fakeFetch({ 'https://example.invalid/s0': { status: 304 } }, seen), send: async () => { throw new Error('must not send'); }, now: 2, to: 't', from: 'f' });
  assert.strictEqual(seen[0].headers['if-none-match'], '"e"');
  assert.deepStrictEqual([r.changed, kv.writes.length], [0, 0]);
});

test('runOnce reports what it deferred when more sources are due than maxPerRun', async () => {
  const kv = fakeKv(); const config = { ...cfg(5), maxPerRun: 3 };
  const routes = Object.fromEntries(config.sources.map((s) => [s.url, { body: atom('v1') }]));
  const r = await runOnce({ config, kv, fetchFn: fakeFetch(routes), send: async () => ({}), now: Date.UTC(2026, 9, 4, 12), to: 't', from: 'f' });
  assert.deepStrictEqual([r.checked, r.deferred], [3, 2]);
});

test('validateConfig accepts a sound list and names the first fault of a bad one', () => {
  assert.strictEqual(validateConfig(cfg(3)), null);
  const bad = (mut) => { const c = cfg(3); mut(c); return validateConfig(c); };
  assert.match(bad((c) => { c.sources[1].id = c.sources[0].id; }), /duplicate id/);
  assert.match(bad((c) => { c.sources[0].url = 'http://example.invalid/x'; }), /https/);
  assert.match(bad((c) => { c.sources[0].kind = 'telepathy'; }), /kind/);
  assert.match(bad((c) => { c.sources[0].everyHours = 0; }), /everyHours/);
  assert.match(bad((c) => { c.sources[0].ignoreTitle = '(['; }), /ignoreTitle/);
  assert.match(bad((c) => { c.maxPerRun = 60; }), /maxPerRun/);
  assert.match(bad((c) => { c.sources[0].apiKey = 'x'; }), /unknown field/);
  assert.match(bad((c) => { c.sources[0].url = 'https://user:pw@example.invalid/x'; }), /credential/);
});

// The shipped lists: every instance file under sources/ is DATA, fits the Free plan's budgets in every hour, and carries no credential.
const INSTANCES = fs.readdirSync(path.join(HERE, 'sources')).filter((f) => f.endsWith('.mjs'));
test('the shipped source lists exist (not vacuous)', () => {
  assert.ok(INSTANCES.includes('thecolliery.mjs'), INSTANCES.join(','));
});
for (const file of INSTANCES) {
  test(`sources/${file}: valid, data only, and no hour of the week asks for more than maxPerRun fetches or the 50-subrequest budget`, async () => {
    const config = (await import(pathToFileURL(path.join(HERE, 'sources', file)).href)).default;
    assert.strictEqual(validateConfig(config), null);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(config)), config, 'a data-only module: nothing a JSON round trip drops');
    assert.ok(config.maxPerRun <= 45, 'maxPerRun leaves headroom under 50 external subrequests');
    let worst = 0;
    for (let h = 0; h < 24 * 7; h++) worst = Math.max(worst, pickRun(config.sources, h, 1e9).run.length);
    assert.ok(worst <= config.maxPerRun, `worst hour asks for ${worst} > ${config.maxPerRun}`);
    for (const s of config.sources) {
      const hours = Array.from({ length: s.everyHours || 1 }, (_, h) => h).filter((h) => isDue(s, config.sources.indexOf(s), h)).length;
      assert.strictEqual(hours, 1, s.id + ' is due exactly once per its cycle');
    }
  });
}

test('worker.mjs: the scheduled handler runs the watcher with the env bindings, and as deployed (sources.mjs beside it) imports cleanly', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'watcher-deploy-'));
  try {
    for (const f of ['worker.mjs', 'watcher.mjs']) fs.copyFileSync(path.join(HERE, f), path.join(dir, f));
    fs.copyFileSync(path.join(HERE, 'sources', 'thecolliery.mjs'), path.join(dir, 'sources.mjs'));
    const probe = `
      import w from './worker.mjs';
      const puts = []; const sent = [];
      const env = { STATE: { get: async () => null, put: async (k) => { puts.push(k); } }, EMAIL: { send: async (m) => { sent.push(Object.keys(m).sort().join()); } }, DIGEST_TO: 't', DIGEST_FROM: 'f' };
      const real = globalThis.fetch;
      globalThis.fetch = async () => new Response('<feed><entry><id>1</id><title>v1</title></entry></feed>', { status: 200 });
      const waits = [];
      await w.scheduled({ scheduledTime: Date.UTC(2026, 9, 4, 12) }, env, { waitUntil: (p) => waits.push(p) });
      await Promise.all(waits);
      globalThis.fetch = real;
      console.log(JSON.stringify({ puts: puts.sort(), sent, waited: waits.length }));
    `;
    fs.writeFileSync(path.join(dir, 'probe.mjs'), probe);
    const r = spawnSync(process.execPath, ['--max-old-space-size=256', path.join(dir, 'probe.mjs')], { cwd: dir, encoding: 'utf8', timeout: 60000, env: { PATH: process.env.PATH || '', SystemRoot: process.env.SystemRoot || '' } });
    assert.strictEqual(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout.trim().split('\n').pop());
    assert.deepStrictEqual(out.puts, ['digest:last', 'state']);
    assert.deepStrictEqual(out.sent, ['from,subject,text,to']);
    assert.strictEqual(out.waited, 1);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
