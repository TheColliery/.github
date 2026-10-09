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
  USER_AGENT, BODY_CAP, CHANGE_LIST_MARK, parseFeed, headingsKey, rawKey, incidentsKey, keyFor, isDue, pickRun, fetchSource, buildDigest, runOnce, validateConfig,
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
  assert.strictEqual(seen[0].headers['user-agent'], 'TheColliery-change-watcher/1 (+https://thecolliery.org)');
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

test('runOnce: a source baselined LATER (it came due in a later hour, or the list grew) is recorded silently: state written, no email, no digest', async () => {
  const kv = fakeKv(); const sent = [];
  const routes = { 'https://example.invalid/s0': { body: atom('a1') }, 'https://example.invalid/s1': { body: atom('b1') }, 'https://example.invalid/s2': { body: atom('c1') } };
  await runWith({ kv, routes, send: async () => ({}), config: cfg(2) }); // the first run: the hello digest
  kv.writes.length = 0;
  const r = await runWith({ kv, routes, send: async (m) => { sent.push(m); }, config: cfg(3) });
  assert.deepStrictEqual([r.baselined, r.changed, r.emailed], [1, 0, false]);
  assert.strictEqual(sent.length, 0);
  assert.deepStrictEqual(kv.writes, ['state']);
  assert.strictEqual(JSON.parse(kv.store.state).sources.s2.title, 'c1');
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
  // CHANGED in its own step (B-1): the failure window (the last 8 runs) now grows with each failure, so a dead source writes until the window is full and then stops
  for (let i = 0; i < 5; i++) await runWith({ kv, routes: bad, send });
  assert.strictEqual(sent.length, 1);
  const writesWhenFull = kv.writes.length;
  await runWith({ kv, routes: bad, send });
  assert.strictEqual(sent.length, 1);
  assert.strictEqual(kv.writes.length, writesWhenFull, 'once the window is full nothing is written');
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

// ---- the auditor's five LOWs (pass 17, B-1 to B-5), each in the probe shape the auditor named ----
const U0 = 'https://example.invalid/s0'; const U1 = 'https://example.invalid/s1';
const entryFeed = (id, title, link, hrefRaw) => `<feed><entry><id>${id}</id><title>${title}</title><link rel="alternate" href="${hrefRaw ?? link}"/></entry></feed>`;
const runAt = (kv, routes, send, n, config = cfg(2)) => runOnce({ config, kv, fetchFn: fakeFetch(routes), send, now: Date.UTC(2026, 9, 4, 12) + n * 3600000, to: 't', from: 'f' });

test('B-1: a source that fails every other run is reported once, as flapping, not left silently half-dead', async () => {
  const kv = fakeKv(); const sent = [];
  const send = async (m) => { sent.push(m); };
  const good = { [U0]: { body: atom('a1') }, [U1]: { body: atom('b1') } };
  const bad = { ...good, [U1]: { status: 503 } };
  await runAt(kv, good, send, 0);
  sent.length = 0;
  for (let i = 1; i <= 8; i++) await runAt(kv, i % 2 ? bad : good, send, i); // 503, 200, 503, 200, 503, 200, 503, 200
  assert.strictEqual(sent.length, 1, 'reported exactly once over 8 alternating runs');
  assert.match(sent[0].text, /S1 .*HTTP 503.*4 of the last 7 runs/);
  assert.doesNotMatch(sent[0].text, /in a row/);
});

test('B-1: a long healthy streak after a report re-arms it, so a later outage is reported again', async () => {
  const kv = fakeKv(); const sent = [];
  const send = async (m) => { sent.push(m); };
  const good = { [U0]: { body: atom('a1') }, [U1]: { body: atom('b1') } };
  const bad = { ...good, [U1]: { status: 500 } };
  await runAt(kv, good, send, 0);
  for (let i = 1; i <= 3; i++) await runAt(kv, bad, send, i);
  assert.strictEqual(sent.length, 2); // hello + the third failure
  for (let i = 4; i <= 6; i++) await runAt(kv, good, send, i);
  for (let i = 7; i <= 9; i++) await runAt(kv, bad, send, i);
  assert.strictEqual(sent.length, 3);
  assert.strictEqual(JSON.parse(kv.store.state).sources.s1.fails, 3);
});

test('B-1: a failure spell is reported once: one answered run in the middle does not start a second report', async () => {
  const kv = fakeKv(); const sent = [];
  const send = async (m) => { sent.push(m); };
  const good = { [U0]: { body: atom('a1') }, [U1]: { body: atom('b1') } };
  const bad = { ...good, [U1]: { status: 500 } };
  await runAt(kv, good, send, 0);
  for (const [i, routes] of [bad, bad, bad, good, bad, bad, bad].entries()) await runAt(kv, routes, send, i + 1);
  assert.strictEqual(sent.length, 2); // hello + one report
});

test('B-4: control characters other than whitespace are stripped from a link and from an error text', async () => {
  const bell = String.fromCharCode(7); const del = String.fromCharCode(127);
  const kv = fakeKv();
  const r = await fetchSource({ id: 'a', url: U0, kind: 'atom' }, undefined, fakeFetch({ [U0]: new Error('x' + bell + 'y' + del + 'z') }));
  assert.strictEqual(r.error, 'x y z');
  const f = await fetchSource({ id: 'a', url: U0, kind: 'atom' }, undefined, fakeFetch({ [U0]: { body: entryFeed('i', 't', 'x', 'https://example.invalid/a' + bell + 'b' + del) } }));
  assert.strictEqual(f.link, 'https://example.invalid/ab');
  assert.ok(kv);
});

test('B-1: an outage that goes on past the report keeps the window full and then writes nothing more', async () => {
  const kv = fakeKv(); const send = async () => {};
  const good = { [U0]: { body: atom('a1') }, [U1]: { body: atom('b1') } };
  const bad = { ...good, [U1]: { status: 500 } };
  await runAt(kv, good, send, 0);
  for (let i = 1; i <= 8; i++) await runAt(kv, bad, send, i);
  kv.writes.length = 0;
  await runAt(kv, bad, send, 9); await runAt(kv, bad, send, 10);
  assert.deepStrictEqual(kv.writes, [], 'once the window is full of failures a dead source costs no write');
});

test('B-2: a feed whose entry ids change on every render but whose title and link stay is quiet', async () => {
  const kv = fakeKv(); const sent = [];
  const send = async (m) => { sent.push(m); };
  const feed = (n) => ({ [U0]: { body: entryFeed('urn:render:' + n, 'Release 5', 'https://example.invalid/r/5') }, [U1]: { body: atom('b1') } });
  await runAt(kv, feed(1), send, 0);
  sent.length = 0;
  const r2 = await runAt(kv, feed(2), send, 1); const r3 = await runAt(kv, feed(3), send, 2);
  assert.deepStrictEqual([r2.changed, r3.changed, sent.length], [0, 0, 0]);
});

test('B-2: a new id WITH a new title, or with a new link, is still a change', async () => {
  const kv = fakeKv(); const sent = [];
  const send = async (m) => { sent.push(m); };
  const at = (id, title, link) => ({ [U0]: { body: entryFeed(id, title, link) }, [U1]: { body: atom('b1') } });
  await runAt(kv, at('i1', 'Release 5', 'https://example.invalid/r/5'), send, 0);
  assert.strictEqual((await runAt(kv, at('i2', 'Release 6', 'https://example.invalid/r/5'), send, 1)).changed, 1);
  assert.strictEqual((await runAt(kv, at('i3', 'Release 6', 'https://example.invalid/r/6'), send, 2)).changed, 1);
});

test('B-2: a raw file whose title stays but whose content changes is still a change (the id rule is for feeds only)', async () => {
  const kv = fakeKv(); const send = async () => {};
  const config = { ...cfg(1), sources: [{ id: 's0', name: 'S0', url: U0, kind: 'raw', everyHours: 1 }] };
  await runAt(kv, { [U0]: { body: '# Changelog\n- one\n' } }, send, 0, config);
  assert.strictEqual((await runAt(kv, { [U0]: { body: '# Changelog\n- one\n- two\n' } }, send, 1, config)).changed, 1);
});

test('B-3: a first run that fails everywhere does not forfeit the hello digest; the next answering run sends it', async () => {
  const kv = fakeKv(); const sent = [];
  const send = async (m) => { sent.push(m); };
  const r1 = await runAt(kv, { [U0]: { status: 500 }, [U1]: { status: 500 } }, send, 0);
  assert.deepStrictEqual([r1.errors, r1.emailed], [2, false]);
  const r2 = await runAt(kv, { [U0]: { body: atom('a1') }, [U1]: { body: atom('b1') } }, send, 1);
  assert.deepStrictEqual([r2.baselined, r2.emailed], [2, true]);
  assert.match(sent[0].text, /Baselined 2 source/);
  const r3 = await runAt(kv, { [U0]: { body: atom('a1') }, [U1]: { body: atom('b1') } }, send, 2);
  assert.strictEqual(r3.emailed, false);
});

test('B-4: a newline inside a link href never becomes a line break in the mail; an error text and a huge title are cleaned and capped', async () => {
  const kv = fakeKv(); const sent = [];
  const send = async (m) => { sent.push(m); };
  const big = 'T'.repeat(30000);
  await runAt(kv, { [U0]: { body: entryFeed('i1', 'one', 'x') }, [U1]: { body: atom('b1') } }, send, 0);
  sent.length = 0;
  await runAt(kv, { [U0]: { body: entryFeed('i2', big, 'x', 'https://example.invalid/a?q=1&#10;2\nFORGED: line') }, [U1]: { body: atom('b1') } }, send, 1);
  assert.strictEqual(sent.length, 1);
  assert.doesNotMatch(sent[0].text, /\nFORGED/);
  assert.ok(sent[0].text.length < 1500, 'a 30 KB title is capped, got ' + sent[0].text.length);
  assert.ok(JSON.parse(kv.store.state).sources.s0.title.length <= 200);
  const r = await fetchSource({ id: 'a', url: U0, kind: 'atom' }, undefined, fakeFetch({ [U0]: new Error('reset\nSubject: forged') }));
  assert.ok(!/[\r\n]/.test(r.error));
});

test('B-5: a validator the server rotates while the newest entry stays is persisted, so the next run asks with the new one', async () => {
  const kv = fakeKv(); const seen = [];
  const send = async () => {};
  const body = { [U0]: { body: atom('a1'), headers: { etag: '"e1"' } }, [U1]: { body: atom('b1') } };
  await runAt(kv, body, send, 0);
  kv.writes.length = 0;
  await runAt(kv, { ...body, [U0]: { body: atom('a1'), headers: { etag: '"e2"', 'last-modified': 'LM2' } } }, send, 1);
  assert.deepStrictEqual(kv.writes, ['state']);
  assert.strictEqual(JSON.parse(kv.store.state).sources.s0.etag, '"e2"');
  await runOnce({ config: cfg(2), kv, fetchFn: fakeFetch({ ...body, [U0]: { status: 304 } }, seen), send, now: Date.UTC(2026, 9, 4, 14), to: 't', from: 'f' });
  assert.strictEqual(seen.find((s) => s.url === U0).headers['if-none-match'], '"e2"');
});

test('B-5: an unchanged validator costs no write', async () => {
  const kv = fakeKv(); const send = async () => {};
  const body = { [U0]: { body: atom('a1'), headers: { etag: '"e1"' } }, [U1]: { body: atom('b1') } };
  await runAt(kv, body, send, 0);
  kv.writes.length = 0;
  await runAt(kv, body, send, 1);
  assert.deepStrictEqual(kv.writes, []);
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

// ---- the registry as data (UMB2-014, UMB-460 (1), BB-56): the rows are a list the test reads, not code ----
const load = async (file) => (await import(pathToFileURL(path.join(HERE, 'sources', file)).href)).default;
const idsOf = (c) => c.sources.map((s) => s.id);

test('no instance list names one URL twice (a second row for a feed is a second mail for one change)', async () => {
  for (const file of INSTANCES) {
    const urls = (await load(file)).sources.map((s) => s.url);
    assert.deepStrictEqual(urls.filter((u, i) => urls.indexOf(u) !== i), [], file);
  }
});

test('thecolliery.mjs: GitHub\'s own changelog label feeds sit after the 25 platform rows (the stagger rule), copilot once, as RSS, every 2 or 6 hours; the Cloudflare rows close the list -- RED before UMB2-014', async () => {
  const c = await load('thecolliery.mjs');
  const labels = ['actions', 'application-security', 'supply-chain-security', 'platform-governance', 'account-management'];
  const tail = c.sources.slice(25, 25 + labels.length);
  assert.deepStrictEqual(tail.map((s) => s.url), labels.map((l) => `https://github.blog/changelog/label/${l}/feed/`));
  for (const s of tail) { assert.strictEqual(s.kind, 'rss'); assert.ok([2, 6].includes(s.everyHours), s.id); assert.match(s.id, /^github-changelog-/); }
  assert.strictEqual(c.sources.filter((s) => s.url === 'https://github.blog/changelog/label/copilot/feed/').length, 1, 'the sixth label, copilot, was already a row (copilot-changelog)');
  assert.strictEqual(c.sources.indexOf(c.sources.find((s) => s.id === 'claude-code')), 0, 'no earlier slot moved');
  assert.deepStrictEqual(idsOf(c).slice(0, 25), ['claude-code', 'codex', 'gemini-cli', 'antigravity', 'copilot-cli', 'copilot-changelog', 'cursor', 'cline', 'windsurf', 'devin', 'kiro', 'augment', 'goose', 'amp', 'opencode', 'roo-code', 'kilo-code', 'continue', 'aider', 'qwen-code', 'openhands', 'mistral-vibe', 'crush', 'zed', 'jules'], 'the first 25 keep their slots');
});

test('kolwen.mjs: the five kept rows keep their slots, the beat\'s 44 rows follow, the two status watches follow them -- RED before UMB-460 (1) and BB-56', async () => {
  const c = await load('kolwen.mjs');
  assert.deepStrictEqual(idsOf(c).slice(0, 5), ['claude-code', 'cloudflare-changelog', 'github-changelog', 'cloudflare-blog', 'coderabbit-changelog']);
  assert.strictEqual(c.sources.length, 5 + 44 + 2 + 12);
  const byId = Object.fromEntries(c.sources.map((s) => [s.id, s]));
  for (const id of ['anthropic-api-notes', 'anthropic-pricing', 'openai-status', 'gemini-api-changelog', 'groq-changelog', 'cloudflare-workers-ai', 'github-copilot', 'paddle-changelog', 'deepseek-updates', 'xai-news']) assert.ok(byId[id], id);
  assert.strictEqual(byId['paddle-changelog'].url, 'https://developer.paddle.com/changelog.xml');
  assert.strictEqual(byId['anthropic-news'].kind, 'headings');
  assert.strictEqual(byId['anthropic-status'].kind, 'atom');
  const hf = c.sources.filter((s) => s.id.startsWith('hfapi-'));
  assert.strictEqual(hf.length, 13, 'the 13 Hugging Face organisation rows');
  for (const s of hf) {
    assert.match(s.url, /^https:\/\/huggingface\.co\/api\/models\?author=[A-Za-z0-9._-]+&sort=createdAt&direction=-1&limit=2&expand\[\]=createdAt$/, s.id);
    assert.strictEqual(s.kind, 'raw'); assert.strictEqual(s.everyHours, 12);
  }
  assert.strictEqual(new Set(hf.map((s) => s.url)).size, 13);
  const tail = c.sources.slice(5 + 44, 5 + 44 + 2);
  assert.deepStrictEqual(tail.map((s) => [s.id, s.kind, s.url]), [
    ['cloudflare-status', 'incidents', 'https://www.cloudflarestatus.com/api/v2/incidents.json'],
    ['groq-status', 'raw', 'https://groqstatus.com/api/v2/incidents.json'],
  ]);
  assert.strictEqual(tail[0].everyHours, 1, 'the platform the zone runs on is read every hour');
  assert.ok(!c.sources.some((s) => /history\.atom$/.test(s.url) && /cloudflarestatus/.test(s.url)), 'not history.atom: its newest entries are scheduled maintenance dated in the future');
  assert.ok(!c.sources.some((s) => /unresolved\.json$/.test(s.url)), 'not the unresolved list: an incident that opens and closes between two reads never shows in it (Issue 39)');
});

test('the stagger keeps every instance\'s busiest hour close to its mean, so a quiet hour is not paid for with a spike', async () => {
  for (const file of INSTANCES) {
    const c = await load(file);
    const per = Array.from({ length: 168 }, (_, h) => pickRun(c.sources, h, 1e9).run.length);
    const mean = per.reduce((a, b) => a + b, 0) / per.length;
    assert.ok(Math.max(...per) <= Math.ceil(mean * 1.5), `${file}: worst ${Math.max(...per)}, mean ${mean.toFixed(1)}`);
  }
});

// ---- UMB-453: the machine-readable change list for the zone editors ----
// Where it lands: at the foot of every digest mail, under CHANGE_LIST_MARK, one JSON object per line (the editors already read the mail through their Gmail
// label), and in digest:last.changes (readable through the Cloudflare API). One shape, schema v1: { v, instance, at, kind, id, site, host, url, link?, from?, to?, error? }.
const SRC = (over = {}) => ({ id: 'cf-blog', name: 'Cloudflare blog', url: 'https://blog.cloudflare.com/rss/', ...over });
const digestOf = (results) => buildDigest({ at: '2026-10-08T03:17:00.000Z', instance: 'kolwen', results });
const listOf = (d) => d.text.split('\n').slice(d.text.split('\n').indexOf(CHANGE_LIST_MARK) + 1).filter(Boolean).map((l) => JSON.parse(l));

test('the digest ends with the change list: one JSON line per changed, baselined and failing source, in that order, each with its id, site, host, url, what changed and when', () => {
  const d = digestOf([
    { source: SRC(), status: 'changed', from: 'old', to: 'new', link: 'https://blog.cloudflare.com/new/' },
    { source: SRC({ id: 'hf', name: 'Qwen on the Hub', url: 'https://huggingface.co/api/models?author=Qwen' }), status: 'new', from: 'a stray earlier title', to: 'Qwen/Qwen-Image' },
    { source: SRC({ id: 'dead', name: 'Dead feed', url: 'https://example.invalid/dead' }), status: 'error', error: 'HTTP 500', fails: 3 },
    { source: SRC({ id: 'quiet' }), status: 'same' },
  ]);
  const lines = d.text.split('\n');
  assert.ok(lines.includes(CHANGE_LIST_MARK), 'the marker line');
  assert.strictEqual(lines[lines.length - 2].startsWith('{'), true, 'the list is the last thing in the mail');
  const list = listOf(d);
  assert.deepStrictEqual(list.map((r) => [r.kind, r.id]), [['changed', 'cf-blog'], ['baselined', 'hf'], ['failing', 'dead']]);
  assert.deepStrictEqual(list[0], { v: 1, instance: 'kolwen', at: '2026-10-08T03:17:00.000Z', kind: 'changed', id: 'cf-blog', site: 'Cloudflare blog', host: 'blog.cloudflare.com', url: 'https://blog.cloudflare.com/rss/', link: 'https://blog.cloudflare.com/new/', from: 'old', to: 'new' });
  assert.deepStrictEqual([list[1].host, list[1].to, 'from' in list[1], 'link' in list[1]], ['huggingface.co', 'Qwen/Qwen-Image', false, false]);
  assert.deepStrictEqual([list[2].error, 'to' in list[2]], ['HTTP 500', false]);
  assert.deepStrictEqual(d.json.changes, list, 'digest:last carries the same list');
});

test('the change list is one line per record whatever the text holds: a newline, a quote or a very long link cannot split or break a line', () => {
  const d = digestOf([{ source: SRC(), status: 'changed', from: 'a\nb"c', to: 'x'.repeat(5000), link: 'https://example.invalid/' + 'y'.repeat(5000) }]);
  const body = d.text.split('\n').slice(d.text.split('\n').indexOf(CHANGE_LIST_MARK) + 1).filter(Boolean);
  assert.strictEqual(body.length, 1);
  const r = JSON.parse(body[0]);
  assert.strictEqual(r.from, 'a\nb"c');
  assert.ok(r.to.length <= 200 && r.link.length <= 500, [r.to.length, r.link.length].join(','));
  assert.doesNotMatch(body[0], /@/);
  const long = digestOf([{ source: SRC(), status: 'changed', from: 'f'.repeat(5000), to: 't' }]);
  assert.ok(listOf(long)[0].from.length <= 200, 'from is capped as well');
});

test('a run that reports nothing sends no list; a run that reports stores it in digest:last', async () => {
  const kv = fakeKv(); const sent = [];
  const routes = { 'https://example.invalid/s0': { body: atom('a1') }, 'https://example.invalid/s1': { body: atom('b1') } };
  await runWith({ kv, routes, send: async (m) => { sent.push(m); } });
  const first = JSON.parse(kv.store['digest:last']);
  assert.deepStrictEqual(first.changes.map((r) => r.kind), ['baselined', 'baselined']);
  assert.ok(sent[0].text.includes(CHANGE_LIST_MARK));
  sent.length = 0;
  await runWith({ kv, routes, send: async (m) => { sent.push(m); } });
  assert.strictEqual(sent.length, 0);
  const again = await runWith({ kv, routes: { ...routes, 'https://example.invalid/s1': { body: atom('b2', 'b1') } }, send: async (m) => { sent.push(m); } });
  assert.strictEqual(again.changed, 1);
  assert.deepStrictEqual(listOf({ text: sent[0].text }).map((r) => [r.kind, r.id, r.from, r.to]), [['changed', 's1', 'b1', 'b2']]);
});

// A JSON source (a status page, the Hugging Face API) used to digest as "? -> ?": its title is the newest incident name or the newest model id.
test('rawKey titles a status-page JSON with its newest incident and a Hugging Face list with its newest model id; an empty incident list has no title', async () => {
  const status = JSON.stringify({ page: { id: 'p', name: 'Cloudflare Status' }, incidents: [{ id: 'i1', name: 'Cloudflare One Clients are incorrectly challenged', status: 'identified' }, { id: 'i0', name: 'older' }] });
  assert.strictEqual((await rawKey(status)).title, 'Cloudflare One Clients are incorrectly challenged');
  assert.strictEqual((await rawKey(JSON.stringify({ page: { id: 'p', name: 'Groq Status' }, incidents: [] }))).title, '');
  const hf = JSON.stringify([{ _id: 'x', id: 'Qwen/Qwen-Image-2.1-PE-I2I', createdAt: '2026-09-20T08:46:47.000Z' }, { _id: 'y', id: 'Qwen/Other', createdAt: '2026-09-20T08:45:29.000Z' }]);
  assert.strictEqual((await rawKey(hf)).title, 'Qwen/Qwen-Image-2.1-PE-I2I');
  assert.strictEqual((await rawKey('{"name":"@openai/codex","version":"0.160.0"}')).title, '0.160.0', 'an npm manifest still titles by its version');
  assert.strictEqual((await rawKey('# Changelog\n\n## 1.2.0\n- x\n')).title, '1.2.0', 'a markdown file still titles by its heading');
  assert.notStrictEqual((await rawKey(status)).key, (await rawKey(status.replace('identified', 'resolved'))).key, 'the key is still the hash of the whole body');
});

// ---- BB-112 / Issues 39, 41, 42 (2026-10-08): the status source reads the incident HISTORY by id; the Cloudflare beat's gaps; the log volume ----
// A Statuspage v2 body in the shape of the two pages we read (cloudflarestatus.com, groqstatus.com): incident objects carry id, name, status, created_at first;
// the components inside one open the same way but carry a component status, and an incident update opens {"id","status","body"}.
const incident = (id, name, status, createdAt, extra = '') => `{"id":"${id}","name":"${name}","status":"${status}","created_at":"${createdAt}","updated_at":"${createdAt}","monitoring_at":null,"resolved_at":null,"impact":"minor","shortlink":"https://status.example.invalid/incidents/${id}","started_at":"${createdAt}","page_id":"p","incident_updates":[{"id":"u-${id}","status":"${status}","body":"We are looking into it","incident_id":"${id}"}],"components":[{"id":"c-${id}-1","name":"Network","status":"degraded_performance","created_at":"2026-01-01T00:00:00.000Z","updated_at":"2026-01-01T00:00:00.000Z","position":1}]${extra}}`;
const statusBody = (...incidents) => `{"page":{"id":"p","name":"Status","url":"https://status.example.invalid"},"incidents":[${incidents.join(',')}]}`;
const I3 = incident('aaa111aaa111', 'Network Performance Issues in Sofia', 'resolved', '2026-10-08T22:31:54.271Z');
const I2 = incident('bbb222bbb222', 'Elevated errors \\"R2\\" \\u00e9', 'identified', '2026-10-07T10:00:00.000Z');
const I1 = incident('ccc333ccc333', 'Dashboard login delays', 'resolved', '2026-10-06T09:00:00.000Z');

test('incidentsKey: the key is the ids of the newest incidents by created_at, components and updates are not incidents, and the order of the page does not matter', () => {
  const k = incidentsKey(statusBody(I3, I2, I1));
  assert.strictEqual(k.key, 'aaa111aaa111,bbb222bbb222,ccc333ccc333');
  assert.strictEqual(incidentsKey(statusBody(I1, I3, I2)).key, k.key, 'oldest-first or shuffled gives the same key');
  assert.strictEqual(k.link, 'https://status.example.invalid/incidents/aaa111aaa111');
  assert.strictEqual(k.title, 'Network Performance Issues in Sofia (resolved)');
  const ids = Array.from({ length: 8 }, (_, i) => incident('id' + i + 'xxxxxxxx', 'n' + i, 'resolved', `2026-09-0${i + 1}T00:00:00.000Z`));
  assert.strictEqual(incidentsKey(statusBody(...ids)).key.split(',').length, 5, 'the five newest');
});

test('incidentsKey: a name is JSON-decoded and tag-stripped; an update to an incident already seen moves nothing; a new incident moves the key', () => {
  assert.strictEqual(incidentsKey(statusBody(I2)).title, 'Elevated errors "R2" é (identified)');
  const before = incidentsKey(statusBody(I2, I1)).key;
  const flipped = incidentsKey(statusBody(incident('bbb222bbb222', 'Elevated errors \\"R2\\" \\u00e9', 'resolved', '2026-10-07T10:00:00.000Z'), I1)).key;
  assert.strictEqual(flipped, before, 'identified -> resolved is not a new incident');
  assert.notStrictEqual(incidentsKey(statusBody(I3, I2, I1)).key, before);
});

test('incidentsKey: how many are new since the last read is counted from the stored ids only; a first read, an empty list and a non-status body are handled', () => {
  const now = statusBody(I3, I2, I1);
  assert.strictEqual(incidentsKey(now, 'ccc333ccc333').title, 'Network Performance Issues in Sofia (resolved) +1 more new');
  assert.strictEqual(incidentsKey(now, 'bbb222bbb222,ccc333ccc333').title, 'Network Performance Issues in Sofia (resolved)', 'one new incident adds no suffix');
  assert.strictEqual(incidentsKey(now, 'a'.repeat(64)).title, 'Network Performance Issues in Sofia (resolved)', 'a hash from the raw kind is no id list');
  assert.strictEqual(incidentsKey(now).title, 'Network Performance Issues in Sofia (resolved)', 'a first read is a baseline, not "N new"');
  assert.deepStrictEqual(incidentsKey('{"page":{},"incidents":[]}'), { key: 'none', title: '', link: '', updated: '' });
  assert.strictEqual(incidentsKey('<html>maintenance</html>'), null);
  assert.strictEqual(incidentsKey('{"components":[{"id":"cccccc1","name":"x","status":"operational","created_at":"2026-01-01T00:00:00Z"}]}'), null, 'a component alone is no incident');
});

test('fetchSource, kind incidents: an incident that opened and closed between two reads is a change; a status update of a known one is quiet (Issue 39: the unresolved list forgot the first)', async () => {
  const src = { id: 'cloudflare-status', name: 'Cloudflare status', url: 'https://status.example.invalid/api/v2/incidents.json', kind: 'incidents', everyHours: 1 };
  const reply = (body) => async () => new Response(body, { status: 200 });
  const first = await fetchSource(src, undefined, reply(statusBody(I2, I1)));
  assert.strictEqual(first.status, 'new');
  const prev = { key: first.key, title: first.to, link: first.link };
  const quiet = await fetchSource(src, prev, reply(statusBody(incident('bbb222bbb222', 'Elevated errors \\"R2\\" \\u00e9', 'resolved', '2026-10-07T10:00:00.000Z'), I1)));
  assert.strictEqual(quiet.status, 'same');
  const missed = await fetchSource(src, prev, reply(statusBody(I3, I2, I1)));
  assert.strictEqual(missed.status, 'changed');
  assert.strictEqual(missed.to, 'Network Performance Issues in Sofia (resolved)');
  assert.strictEqual(missed.link, 'https://status.example.invalid/incidents/aaa111aaa111');
  const olderRead = await fetchSource(src, undefined, reply(statusBody(I1)));
  const two = await fetchSource(src, { key: olderRead.key, title: olderRead.to, link: olderRead.link }, reply(statusBody(I3, I2, I1)));
  assert.strictEqual(two.to, 'Network Performance Issues in Sofia (resolved) +1 more new', 'two incidents opened and closed between two reads: the digest says so');
  const none = await fetchSource(src, prev, reply('<html>503</html>'));
  assert.deepStrictEqual([none.status, none.error], ['error', 'no entry found']);
});

test('validateConfig accepts the incidents kind', () => {
  assert.strictEqual(validateConfig({ instance: 'x', maxPerRun: 5, sources: [{ id: 's', name: 'S', url: 'https://example.invalid/i.json', kind: 'incidents', everyHours: 1 }] }), null);
});

test('kolwen.mjs, BB-112 / Issues 41-42: the status row reads the incident history; the One Client feed, the four GitHub release feeds and the seven pages of Free-plan facts close the list, in that order', async () => {
  const c = await load('kolwen.mjs');
  const i = idsOf(c).indexOf('cloudflare-status');
  assert.strictEqual(i, 5 + 44, 'the slots before it did not move');
  assert.deepStrictEqual([c.sources[i].kind, c.sources[i].url, c.sources[i].everyHours], ['incidents', 'https://www.cloudflarestatus.com/api/v2/incidents.json', 1]);
  assert.strictEqual(c.sources[i + 1].id, 'groq-status');
  assert.strictEqual(c.sources[i + 1].kind, 'raw', 'Groq lists its history newest first and was never blind to a closed incident: left as it was');
  assert.deepStrictEqual(idsOf(c).slice(i + 2), [
    'cloudflare-one-client', 'cloudflare-wrangler', 'cloudflare-mcp-servers', 'cloudflare-agents-sdk', 'cloudflare-sandbox-sdk',
    'cloudflare-doc-workers-limits', 'cloudflare-doc-workers-pricing', 'cloudflare-doc-kv-limits', 'cloudflare-doc-kv-pricing',
    'cloudflare-doc-observability-pricing', 'cloudflare-doc-r2-pricing', 'cloudflare-doc-email-service-limits',
  ]);
  const byId = Object.fromEntries(c.sources.map((s) => [s.id, s]));
  assert.strictEqual(byId['cloudflare-one-client'].url, 'https://developers.cloudflare.com/changelog/rss/cloudflare-one-client.xml');
  for (const id of ['cloudflare-wrangler', 'cloudflare-mcp-servers', 'cloudflare-agents-sdk', 'cloudflare-sandbox-sdk']) assert.match(byId[id].url, /^https:\/\/github\.com\/cloudflare\/[a-z-]+\/releases\.atom$/, id);
  const docs = c.sources.filter((s) => s.id.startsWith('cloudflare-doc-'));
  assert.strictEqual(docs.length, 7);
  for (const s of docs) { assert.match(s.url, /^https:\/\/developers\.cloudflare\.com\/[a-z0-9\/-]+\/index\.md$/, s.id); assert.strictEqual(s.kind, 'raw'); assert.strictEqual(s.everyHours, 24); }
  assert.strictEqual(c.sources.length, 5 + 44 + 2 + 12);
});

test('kolwen.mjs: the monorepo release feeds are filtered to the package the hub runs, and pre-releases are quiet', async () => {
  const c = await load('kolwen.mjs');
  const byId = Object.fromEntries(c.sources.map((s) => [s.id, s]));
  const pick = (id, ...titles) => parseFeed(atom(...titles), { ignoreTitle: byId[id].ignoreTitle })?.title;
  assert.strictEqual(pick('cloudflare-wrangler', 'miniflare@5.20261006.1-alpha', 'create-cloudflare@2.73.4', 'wrangler@4.149.0', 'wrangler@4.148.0'), 'wrangler@4.149.0');
  assert.strictEqual(pick('cloudflare-wrangler', 'wrangler@4.150.0-beta.1', 'wrangler@4.149.0'), 'wrangler@4.149.0');
  assert.strictEqual(pick('cloudflare-agents-sdk', '@cloudflare/worker-bundler@0.2.6', '@cloudflare/think@0.20.1', 'agents@0.27.0'), 'agents@0.27.0');
  assert.strictEqual(pick('cloudflare-sandbox-sdk', '@cloudflare/sandbox@1.0.1-rc.1', '@cloudflare/sandbox@1.0.0'), '@cloudflare/sandbox@1.0.0');
  assert.strictEqual(pick('cloudflare-mcp-servers', 'workers-observability@0.5.5'), 'workers-observability@0.5.5');
});

// Issue 39 (c) / Issue 41 (a): Workers Logs move to Observability pricing on 2026-12-01; the docs page (developers.cloudflare.com/observability/pricing, read
// 2026-10-09) lists Free as "0.5 GB per day" with seven-day retention and says that "On Free, Cloudflare stops ingesting new data when the account reaches its
// daily limit". The watcher Worker writes ONE console line per Cron run (worker.mjs). This measures that line in its largest shape, in bytes, with the real
// worker.mjs and the real Kolwen list, and holds the day's total to 1% of the allowance. The platform's own per-invocation record is NOT measured here: 4 KB per
// run is an allowance written down as an ASSUMPTION, and the margin (2,000x or more) is what carries the claim.
test('worker.mjs writes one small console line per run: a day of runs, with a 4 KB allowance for the platform record each, stays under 1% of the Free 0.5 GB a day', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'watcher-logs-'));
  try {
    for (const f of ['worker.mjs', 'watcher.mjs']) fs.copyFileSync(path.join(HERE, f), path.join(dir, f));
    fs.copyFileSync(path.join(HERE, 'sources', 'kolwen.mjs'), path.join(dir, 'sources.mjs'));
    const probe = `
      import w from './worker.mjs';
      const lines = [];
      console.log = (s) => lines.push(String(s)); console.error = (s) => lines.push(String(s));
      // the largest summary: every due source changed AND baselined-looking, and a mail binding that fails with a long code
      const env = { STATE: { get: async () => null, put: async () => {} }, EMAIL: { send: async () => { const e = new Error('x'); e.code = 'E'.repeat(400); throw e; } }, DIGEST_TO: 't', DIGEST_FROM: 'f' };
      globalThis.fetch = async () => new Response('<feed><entry><id>1</id><title>v1</title></entry></feed>', { status: 200 });
      for (let h = 0; h < 24; h++) { const waits = []; await w.scheduled({ scheduledTime: Date.UTC(2026, 9, 4, h, 17) }, env, { waitUntil: (p) => waits.push(p) }); await Promise.all(waits); }
      console.info(JSON.stringify({ runs: 24, lines: lines.length, bytes: lines.reduce((n, l) => n + Buffer.byteLength(l), 0), widest: Math.max(...lines.map((l) => Buffer.byteLength(l))) }));
    `;
    fs.writeFileSync(path.join(dir, 'probe.mjs'), probe);
    const r = spawnSync(process.execPath, ['--max-old-space-size=256', path.join(dir, 'probe.mjs')], { cwd: dir, encoding: 'utf8', timeout: 60000, env: { PATH: process.env.PATH || '', SystemRoot: process.env.SystemRoot || '' } });
    assert.strictEqual(r.status, 0, r.stderr);
    const m = JSON.parse(r.stdout.trim().split('\n').pop());
    assert.strictEqual(m.lines, m.runs, 'exactly one console line per run');
    assert.ok(m.widest <= 512, `the widest line is ${m.widest} bytes`);
    // 09g: deploy-payload.mjs turns the platform's invocation record OFF, so this allowance now only covers the platform's wrapper around the one console line; it stays at 4 KB as a margin, not as a cost
    const FREE_PER_DAY = 0.5e9; const PLATFORM_RECORD_ALLOWANCE = 4096;
    const day = m.bytes + m.runs * PLATFORM_RECORD_ALLOWANCE;
    assert.ok(day <= FREE_PER_DAY * 0.01, `a day is ${day} bytes against ${FREE_PER_DAY * 0.01}`);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// Main's ruling 2026-10-09 (the .github deputy's 5 (b) proposal): the TheColliery instance carries the Cloudflare surfaces its own Workers run, appended at the END.
test('thecolliery.mjs: eleven Cloudflare rows close the list (status history hourly, six per-product changelog feeds every 6 hours, four docs pages every 24 hours) and nothing earlier moved', async () => {
  const c = await load('thecolliery.mjs');
  assert.strictEqual(c.sources.length, 30 + 11);
  const added = c.sources.slice(30);
  assert.deepStrictEqual(added.map((s) => s.id), [
    'cloudflare-status',
    'cloudflare-changelog-workers', 'cloudflare-changelog-kv', 'cloudflare-changelog-r2', 'cloudflare-changelog-dns', 'cloudflare-changelog-registrar', 'cloudflare-changelog-email-service',
    'cloudflare-doc-workers-limits', 'cloudflare-doc-kv-pricing', 'cloudflare-doc-r2-pricing', 'cloudflare-doc-email-service-limits',
  ]);
  assert.deepStrictEqual([added[0].kind, added[0].url, added[0].everyHours], ['incidents', 'https://www.cloudflarestatus.com/api/v2/incidents.json', 1]);
  const feeds = added.slice(1, 7);
  for (const s of feeds) { assert.match(s.url, /^https:\/\/developers\.cloudflare\.com\/changelog\/rss\/[a-z0-9-]+\.xml$/, s.id); assert.strictEqual(s.kind, 'rss'); assert.strictEqual(s.everyHours, 6); }
  assert.deepStrictEqual(feeds.map((s) => s.url.split('/').pop()), ['workers.xml', 'kv.xml', 'r2.xml', 'dns.xml', 'registrar.xml', 'email-service.xml'], 'email-routing.xml answers 404: Email Routing\'s notes sit under email-service');
  for (const s of added.slice(7)) { assert.match(s.url, /^https:\/\/developers\.cloudflare\.com\/[a-z0-9\/-]+\/index\.md$/, s.id); assert.strictEqual(s.kind, 'raw'); assert.strictEqual(s.everyHours, 24); }
  const kolwen = await load('kolwen.mjs');
  const mine = new Set(c.sources.map((s) => s.url));
  for (const id of ['cloudflare-wrangler', 'cloudflare-mcp-servers', 'cloudflare-agents-sdk', 'cloudflare-sandbox-sdk', 'cloudflare-one-client', 'cloudflare-workers-ai']) {
    assert.ok(!mine.has(kolwen.sources.find((s) => s.id === id).url), id + ' stays in the commercial hub\'s list only');
  }
  // the day's fetches this adds, from the stagger itself: counted over the 168 hours of a week, per day
  const week = (list) => Array.from({ length: 168 }, (_, h) => pickRun(list, h, 1e9).run.length).reduce((a, b) => a + b, 0);
  const perDay = (week(c.sources) - week(c.sources.slice(0, 30))) / 7;
  assert.ok(perDay > 40 && perDay < 60, 'the eleven rows add about 52 fetches a day, measured ' + perDay);
});

// ---- order 09g, COURIER 2 (the Kolwen head's 09e item 26): ONE ITEM IS REPORTED ONCE -------------------------------------------------------------------
// The owner's rule 2026-10-09: if Cron Triggers repeat a notice, keep one. A plain missed hour already held; these are the three cases that did not (watcher.mjs at 5625734).
const DT0 = Date.UTC(2026, 9, 4, 12);
const HOUR = 3600000;
const S0 = 'https://example.invalid/s0';
const oneAtom = (...titles) => ({ [S0]: { body: atom(...titles) } });
const counted = () => { const sent = []; return { sent, send: async (m) => { sent.push(m); return {}; } }; };
const baselined = async (kv, send) => runWith({ kv, routes: oneAtom('a1'), send, config: cfg(1) }); // the hello digest: one mail
const failOnce = (kv, key) => { const real = kv.put; let spent = false; kv.put = async (k, v) => { if (k === key && !spent) { spent = true; throw new Error('KV put failed: ' + k); } return real(k, v); }; };

test('dedupe case 1a, overlapping runs: two events that read the same old key at the same moment mail the change ONCE -- RED before 09g', async () => {
  const kv = fakeKv(); const { sent, send } = counted();
  await baselined(kv, send); sent.length = 0;
  const routes = oneAtom('a2', 'a1');
  const results = await Promise.all([
    runWith({ kv, routes, send, now: DT0 + HOUR, config: cfg(1) }),
    runWith({ kv, routes, send, now: DT0 + 2 * HOUR, config: cfg(1) }),
  ]);
  assert.strictEqual(sent.length, 1, 'one mail for one change');
  assert.deepStrictEqual(results.map((r) => r.emailed).sort(), [false, true]);
  assert.ok(results.some((r) => r.deduped === true), 'the run that gave way says so');
  assert.match(sent[0].text, /S0: a1 -> a2/);
  assert.strictEqual(JSON.parse(kv.store.state).sources.s0.title, 'a2');
});

test('dedupe case 1b, a slow run: a run that read the old key before another run mailed and committed it finds the commit and mails nothing -- RED before 09g', async () => {
  const kv = fakeKv(); const { sent, send } = counted();
  await baselined(kv, send); sent.length = 0;
  const routes = oneAtom('a2', 'a1');
  let release; const gate = new Promise((r) => { release = r; });
  const slow = runOnce({ config: cfg(1), kv, fetchFn: async (u, i) => { await gate; return fakeFetch(routes)(u, i); }, send, now: DT0 + 2 * HOUR, to: 't', from: 'f' });
  const fast = await runWith({ kv, routes, send, now: DT0 + HOUR, config: cfg(1) }); // reads the old key, mails, commits while the slow run waits on its fetch
  release();
  const late = await slow;
  assert.strictEqual(fast.emailed, true);
  assert.strictEqual(late.emailed, false);
  assert.strictEqual(sent.length, 1);
  assert.strictEqual(JSON.parse(kv.store.state).sources.s0.title, 'a2');
});

test('dedupe case 1c: the slow run keeps what only it found -- another source that it alone saw change is still reported and committed', async () => {
  const kv = fakeKv(); const { sent, send } = counted();
  const both = (a, b) => ({ [S0]: { body: atom(...a) }, 'https://example.invalid/s1': { body: atom(...b) } });
  await runWith({ kv, routes: both(['a1'], ['b1']), send, config: cfg(2) }); sent.length = 0;
  const fastRoutes = { ...both(['a2', 'a1'], ['b1']) };
  let release; const gate = new Promise((r) => { release = r; });
  const slow = runOnce({ config: cfg(2), kv, fetchFn: async (u, i) => { await gate; return fakeFetch(both(['a2', 'a1'], ['b2', 'b1']))(u, i); }, send, now: DT0 + 2 * HOUR, to: 't', from: 'f' });
  await runWith({ kv, routes: fastRoutes, send, now: DT0 + HOUR, config: cfg(2) });
  release(); await slow;
  const mails = sent.map((m) => m.text).join('\n');
  assert.strictEqual((mails.match(/S0: a1 -> a2/g) || []).length, 1, 'a2 mailed once');
  assert.strictEqual((mails.match(/S1: b1 -> b2/g) || []).length, 1, 'b2 mailed once, by the slow run');
  const st = JSON.parse(kv.store.state).sources;
  assert.deepStrictEqual([st.s0.title, st.s1.title], ['a2', 'b2']);
});

test('dedupe case 2a: a KV failure AFTER the send (the record of the digest) does not mail the same change again next hour -- RED before 09g', async () => {
  const kv = fakeKv(); const { sent, send } = counted();
  await baselined(kv, send); sent.length = 0;
  failOnce(kv, 'digest:last');
  await runWith({ kv, routes: oneAtom('a2', 'a1'), send, now: DT0 + HOUR, config: cfg(1) }).catch(() => {});
  assert.strictEqual(sent.length, 1);
  await runWith({ kv, routes: oneAtom('a2', 'a1'), send, now: DT0 + 2 * HOUR, config: cfg(1) });
  assert.strictEqual(sent.length, 1, 'the next hour finds the change already recorded');
});

test('dedupe case 2b: a KV failure on the state write stops the mail BEFORE it is sent, and the next hour mails the change once -- RED before 09g', async () => {
  const kv = fakeKv(); const { sent, send } = counted();
  await baselined(kv, send); sent.length = 0;
  failOnce(kv, 'state');
  await assert.rejects(runWith({ kv, routes: oneAtom('a2', 'a1'), send, now: DT0 + HOUR, config: cfg(1) }), /KV put failed: state/);
  assert.strictEqual(sent.length, 0, 'no state, no mail');
  await runWith({ kv, routes: oneAtom('a2', 'a1'), send, now: DT0 + 2 * HOUR, config: cfg(1) });
  assert.strictEqual(sent.length, 1);
  assert.match(sent[0].text, /S0: a1 -> a2/);
});

test('dedupe case 2c: a mail binding that fails after the state is written is NOT retried (at most once), and digest:last keeps the text with emailed false', async () => {
  const kv = fakeKv(); let tries = 0;
  const send = async () => { tries++; throw new Error('E_SENDER_NOT_VERIFIED'); };
  await runWith({ kv, routes: oneAtom('a1'), send, config: cfg(1) });
  assert.strictEqual(tries, 1);
  const last = JSON.parse(kv.store['digest:last']);
  assert.strictEqual(last.emailed, false);
  assert.match(last.text, /Baselined 1 source/);
  await runWith({ kv, routes: oneAtom('a1'), send, now: DT0 + HOUR, config: cfg(1) });
  assert.strictEqual(tries, 1);
});

test('dedupe case 3, a key that returns: A, B, A reports B once and never reports A again; a key never seen is still reported -- RED before 09g', async () => {
  const kv = fakeKv(); const { sent, send } = counted();
  await baselined(kv, send);
  const run = (n, ...titles) => runWith({ kv, routes: oneAtom(...titles), send, now: DT0 + n * HOUR, config: cfg(1) });
  await run(1, 'b1', 'a1');
  assert.strictEqual(sent.length, 2, 'hello, then B');
  const back = await run(2, 'a1');
  assert.deepStrictEqual([back.changed, back.emailed], [0, false]);
  assert.strictEqual(sent.length, 2, 'A returning is not news');
  assert.strictEqual(JSON.parse(kv.store.state).sources.s0.title, 'a1', 'the stored newest entry follows the feed');
  await run(3, 'c1', 'a1');
  assert.strictEqual(sent.length, 3, 'C was never seen');
  assert.match(sent[2].text, /S0: a1 -> c1/);
  await run(4, 'a1');
  assert.strictEqual(sent.length, 3);
});

test('dedupe case 3, the incident list: an incident that drops out of the history and comes back moves the key A, B, A and is reported once', async () => {
  const kv = fakeKv(); const { sent, send } = counted();
  const U = 'https://example.invalid/status';
  const config = { instance: 'kolwen', maxPerRun: 5, sources: [{ id: 'st', name: 'Status', url: U, kind: 'incidents', everyHours: 1 }] };
  const I4 = incident('ddd444ddd444', 'New outage', 'investigating', '2026-10-09T01:00:00.000Z');
  const run = (n, body) => runWith({ kv, routes: { [U]: { body } }, send, now: DT0 + n * HOUR, config });
  await run(0, statusBody(I3, I2, I1)); sent.length = 0;
  await run(1, statusBody(I4, I3, I2, I1));
  assert.strictEqual(sent.length, 1);
  await run(2, statusBody(I3, I2, I1));
  assert.strictEqual(sent.length, 1, 'the history lost I4: the key returned to a value already reported');
  await run(3, statusBody(I4, I3, I2, I1));
  assert.strictEqual(sent.length, 1, 'and I4 returning is the same item');
});

test('dedupe case 3 is for feeds and incidents only: a raw page that returns to an earlier content IS a change (its key is its content)', async () => {
  const kv = fakeKv(); const { sent, send } = counted();
  const U = 'https://example.invalid/page';
  const config = { instance: 'kolwen', maxPerRun: 5, sources: [{ id: 'pg', name: 'Page', url: U, kind: 'raw', everyHours: 1 }] };
  const run = (n, body) => runWith({ kv, routes: { [U]: { body } }, send, now: DT0 + n * HOUR, config });
  await run(0, '# Limits\n10 ms\n');
  await run(1, '# Limits\n50 ms\n');
  await run(2, '# Limits\n10 ms\n');
  assert.strictEqual(sent.length, 3, 'hello, then both flips');
});

test('the recent-key memory is short: a feed that changes every hour keeps at most eight keys per source, and an unchanged run still writes nothing', async () => {
  const kv = fakeKv(); const { send } = counted();
  await baselined(kv, send);
  for (let n = 1; n <= 12; n++) await runWith({ kv, routes: oneAtom('v' + n, 'v' + (n - 1)), send, now: DT0 + n * HOUR, config: cfg(1) });
  const e = JSON.parse(kv.store.state).sources.s0;
  assert.ok(Array.isArray(e.seen) && e.seen.length <= 8 && e.seen.length >= 2, 'seen holds ' + JSON.stringify(e.seen && e.seen.length));
  kv.writes.length = 0;
  await runWith({ kv, routes: oneAtom('v12', 'v11'), send, now: DT0 + 13 * HOUR, config: cfg(1) });
  assert.deepStrictEqual(kv.writes, []);
});

test('dedupe, the claim only silences on SEEING another run: a finished run\'s old claim, and a read that shows nothing, never stop a report', async () => {
  const stale = fakeKv({ state: JSON.stringify({ v: 1, sources: {}, claim: { id: 'finished-run', t: Date.now() - 2 * HOUR } }) });
  const a = counted();
  await runWith({ kv: stale, routes: oneAtom('a1'), send: a.send, config: cfg(1) });
  assert.strictEqual(a.sent.length, 1, 'an hours-old claim is a finished run, not a contender');
  const blind = fakeKv(); const real = blind.get;
  blind.get = async (k, type) => (k === 'state' && blind.writes.includes('state') ? null : real(k, type)); // after the write, the read shows nothing at all
  const b = counted();
  const r = await runWith({ kv: blind, routes: oneAtom('a1'), send: b.send, config: cfg(1) });
  assert.strictEqual(b.sent.length, 1, 'no claim seen, so the run mails');
  assert.notStrictEqual(r.deduped, true);
});

test('a source whose stored key is another kind\'s (the old hash) is reported once as a change, and a source with no key is baselined silently: the README states exactly this', async () => {
  const kv = fakeKv(); const { sent, send } = counted();
  const U = 'https://example.invalid/status';
  const config = { instance: 'kolwen', maxPerRun: 5, sources: [{ id: 'st', name: 'Status', url: U, kind: 'incidents', everyHours: 1 }, { id: 'later', name: 'Later', url: S0, kind: 'atom', everyHours: 1 }] };
  const state = { v: 1, sources: { st: { key: 'f'.repeat(16), title: 'old title' } } }; // a hash from the raw kind; `later` has no entry at all
  kv.store.state = JSON.stringify(state);
  const routes = { [U]: { body: statusBody(I3, I2, I1) }, [S0]: { body: atom('a1') } };
  const r = await runWith({ kv, routes, send, config });
  assert.deepStrictEqual([r.changed, r.baselined, r.emailed], [1, 1, true]);
  assert.match(sent[0].text, /Status: old title -> /);
  assert.doesNotMatch(sent[0].text, /Baselined/, 'the baseline report is for the first run of a fresh state only');
  assert.ok(JSON.parse(kv.store.state).sources.later.key, 'the keyless source was recorded');
});

// ---- the survivors of the first mutation table, each given the test that kills it ----------------------------------------------------------------------
test('dedupe case 3 on a state written before the memory existed (no seen list): the first change records the key it left, so A, B, A is still quiet', async () => {
  const kv = fakeKv({ state: JSON.stringify({ v: 1, sources: { s0: { key: parseFeed(atom('a1')).key, title: 'a1', link: 'https://example.invalid/r/a1' } } }) });
  const { sent, send } = counted();
  const run = (n, ...titles) => runWith({ kv, routes: oneAtom(...titles), send, now: DT0 + n * HOUR, config: cfg(1) });
  await run(1, 'b1', 'a1');
  assert.strictEqual(sent.length, 1);
  await run(2, 'a1');
  assert.strictEqual(sent.length, 1, 'A returned and was not mailed again');
});

test('the memory is kept in order of use: a key that returns is the newest of the memory, so the oldest one is what the ninth key pushes out', async () => {
  const kv = fakeKv(); const { sent, send } = counted();
  await baselined(kv, send); // a1
  const run = (n, t) => runWith({ kv, routes: oneAtom(t), send, now: DT0 + n * HOUR, config: cfg(1) });
  for (let n = 2; n <= 8; n++) await run(n, 'a' + n); // a1..a8: the memory is full
  await run(9, 'a1'); // a1 returns: quiet, and it becomes the newest of the memory
  await run(10, 'a9'); // a ninth distinct key pushes out the OLDEST (a2), not a1
  const before = sent.length;
  await run(11, 'a1');
  assert.strictEqual(sent.length, before, 'a1 is still remembered');
  await run(12, 'a2');
  assert.strictEqual(sent.length, before + 1, 'a2 was pushed out, so it is news again');
});

test('dedupe case 2a: a digest record that cannot be written is named in the summary and never unwinds the run', async () => {
  const kv = fakeKv(); const { sent, send } = counted();
  await baselined(kv, send); sent.length = 0;
  failOnce(kv, 'digest:last');
  const r = await runWith({ kv, routes: oneAtom('a2', 'a1'), send, now: DT0 + HOUR, config: cfg(1) });
  assert.strictEqual(r.emailed, true);
  assert.match(r.recordError, /KV put failed: digest:last/);
  assert.strictEqual(sent.length, 1);
});

test('dedupe case 1b names the run that gave way (deduped), and 1d: the slow run does not write back an older view of a source another run already moved', async () => {
  const kv = fakeKv(); const { sent, send } = counted();
  const two = (a, b) => ({ [S0]: { body: atom(...a) }, 'https://example.invalid/s1': { body: atom(...b) } });
  await runWith({ kv, routes: two(['a1'], ['b1']), send, config: cfg(2) }); sent.length = 0;
  let release; const gate = new Promise((r) => { release = r; });
  // the slow run's upstream still shows a1 for s0 (a stale answer) and b2 for s1
  const slow = runOnce({ config: cfg(2), kv, fetchFn: async (u, i) => { await gate; return fakeFetch(two(['a1'], ['b2', 'b1']))(u, i); }, send, now: DT0 + 2 * HOUR, to: 't', from: 'f' });
  await runWith({ kv, routes: two(['a2', 'a1'], ['b1']), send, now: DT0 + HOUR, config: cfg(2) }); // the fast run moves s0 to a2
  release(); const late = await slow;
  const st = JSON.parse(kv.store.state).sources;
  assert.strictEqual(st.s0.title, 'a2', 'the slow run did not write s0 back to a1');
  assert.strictEqual(st.s1.title, 'b2');
  assert.strictEqual(sent.length, 2, 'a2 once, b2 once');
  assert.notStrictEqual(late.deduped, true, 'the slow run reported something of its own');
  // and a run with nothing of its own gives way and says so
  const kv2 = fakeKv(); const c2 = counted();
  await baselined(kv2, c2.send);
  let rel2; const gate2 = new Promise((r) => { rel2 = r; });
  const slow2 = runOnce({ config: cfg(1), kv: kv2, fetchFn: async (u, i) => { await gate2; return fakeFetch(oneAtom('a2', 'a1'))(u, i); }, send: c2.send, now: DT0 + 2 * HOUR, to: 't', from: 'f' });
  await runWith({ kv: kv2, routes: oneAtom('a2', 'a1'), send: c2.send, now: DT0 + HOUR, config: cfg(1) });
  rel2();
  assert.strictEqual((await slow2).deduped, true);
});

test('dedupe case 1e: a failure spell that another run already reported is not reported a second time by the slow run', async () => {
  const bad = { status: 500, body: '' };
  const seeded = () => fakeKv({ state: JSON.stringify({ v: 1, sources: { s0: { key: 'k', title: 't', fails: 2, hist: 'ff' } } }) }); // two failed runs in a row: the next one is the third, the report
  const kv = seeded(); const { sent, send } = counted();
  let release; const gate = new Promise((r) => { release = r; });
  const slow = runOnce({ config: cfg(1), kv, fetchFn: async () => { await gate; return new Response('', { status: 500 }); }, send, now: DT0 + 2 * HOUR, to: 't', from: 'f' });
  await runWith({ kv, routes: { [S0]: bad }, send, now: DT0 + HOUR, config: cfg(1) });
  release(); await slow;
  assert.strictEqual(sent.length, 1);
  assert.match(sent[0].text, /Failing \(1\)/);
});

test('dedupe, the claim ignores an OLD claim that a stale read shows: only a recent one from another run gives way', async () => {
  const kv = fakeKv(); const { sent, send } = counted();
  const old = JSON.stringify({ v: 1, sources: {}, claim: { id: 'finished-run', t: Date.now() - 2 * HOUR } });
  kv.store.state = old;
  const real = kv.get; let after = false; const realPut = kv.put;
  kv.put = async (k, v) => { await realPut(k, v); if (k === 'state') after = true; };
  kv.get = async (k, type) => (k === 'state' && after ? JSON.parse(old) : real(k, type)); // a stale location: the read after the write still shows the old claim
  await runWith({ kv, routes: oneAtom('a1'), send, config: cfg(1) });
  assert.strictEqual(sent.length, 1);
});
