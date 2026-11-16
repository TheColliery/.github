// cold-read: the COLD sources of an instance are read by hand, compared with their own last-seen state, and printed in the digests' shape. Hermetic: a stub fetch, no network, no Worker.
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { coldRead } from './cold-read.mjs';
import { pickRun } from './watcher.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const atom = (...titles) => `<feed>${titles.map((t, i) => `<entry><id>${t}-${i}</id><title>${t}</title><link href="https://example.invalid/${t}"/></entry>`).join('')}</feed>`;
const config = {
  instance: 'demo', maxPerRun: 5,
  sources: [
    { id: 'hot-one', name: 'Hot', url: 'https://example.invalid/hot', kind: 'atom', everyHours: 1 },
    { id: 'cold-feed', name: 'Cold feed', url: 'https://example.invalid/cold-feed', kind: 'atom', everyHours: 24, tier: 'cold' },
    { id: 'cold-page', name: 'Cold page', url: 'https://example.invalid/cold-page', kind: 'raw', everyHours: 24, tier: 'cold' },
  ],
};
const stub = (bodies, calls = []) => async (url) => {
  calls.push(String(url));
  const b = bodies[String(url)];
  if (b === undefined) return { ok: false, status: 503, headers: { get: () => null } };
  return { ok: true, status: 200, headers: { get: () => null }, body: new Response(b).body };
};
const NOW = Date.parse('2026-11-16T12:00:00Z');

test('the first read baselines every cold source and reports none as a change; the hot source is never fetched -- 16l', async () => {
  const calls = [];
  const r = await coldRead({ config, state: { v: 1, sources: {} }, fetchFn: stub({ 'https://example.invalid/cold-feed': atom('v1.0.0'), 'https://example.invalid/cold-page': 'page one' }, calls), now: NOW });
  assert.deepStrictEqual(calls, ['https://example.invalid/cold-feed', 'https://example.invalid/cold-page'], 'cold sources only, in order, one at a time');
  assert.match(r.text, /Baselined 2 source\(s\)/);
  assert.doesNotMatch(r.text, /Changed \(/);
  assert.deepStrictEqual(Object.keys(r.next.sources).sort(), ['cold-feed', 'cold-page']);
  assert.match(r.text, /2 cold source\(s\) read, 0 changed, 2 baselined, 0 failing/);
});

test('a second read prints exactly what changed since the last-seen state, in the digest shape with its change list, and an unchanged source prints nothing', async () => {
  const a = await coldRead({ config, state: { v: 1, sources: {} }, fetchFn: stub({ 'https://example.invalid/cold-feed': atom('v1.0.0'), 'https://example.invalid/cold-page': 'page one' }), now: NOW });
  const b = await coldRead({ config, state: a.next, fetchFn: stub({ 'https://example.invalid/cold-feed': atom('v1.1.0', 'v1.0.0'), 'https://example.invalid/cold-page': 'page one' }), now: NOW + 7 * 86400000 });
  assert.match(b.text, /Changed \(1\):\n {2}Cold feed: v1\.0\.0 -> v1\.1\.0/);
  assert.doesNotMatch(b.text, /Cold page/, 'an unchanged page is not mentioned');
  assert.match(b.text, /--- change list \(JSON lines, schema v1\) ---\n\{"v":1,"instance":"demo","at":"2026-11-23T12:00:00\.000Z","kind":"changed","id":"cold-feed"/);
  assert.strictEqual(b.next.sources['cold-feed'].key.includes('v1.1.0'), true);
});

test('a source that does not answer is named under Failing and the run is not clean; its earlier state is kept', async () => {
  const a = await coldRead({ config, state: { v: 1, sources: {} }, fetchFn: stub({ 'https://example.invalid/cold-feed': atom('v1.0.0'), 'https://example.invalid/cold-page': 'page one' }), now: NOW });
  const b = await coldRead({ config, state: a.next, fetchFn: stub({ 'https://example.invalid/cold-page': 'page one' }), now: NOW });
  assert.strictEqual(b.failing.length, 1);
  assert.match(b.text, /Failing \(1\):\n {2}Cold feed - HTTP 503 \(https:\/\/example\.invalid\/cold-feed\)/);
  assert.deepStrictEqual(b.next.sources['cold-feed'], a.next.sources['cold-feed'], 'a failed read forgets nothing');
});

test('the registries\' cold sources never ride the cron and each is read here: no cold source is picked by pickRun at any hour of the week', async () => {
  for (const name of ['kolwen', 'thecolliery']) {
    const c = (await import(`./sources/${name}.mjs`)).default;
    const cold = c.sources.filter((s) => s.tier === 'cold').map((s) => s.id);
    for (let h = 0; h < 168; h++) for (const s of pickRun(c.sources, h, 1e9).run) assert.ok(!cold.includes(s.id), `${name}: ${s.id} at hour ${h}`);
  }
});

test('CLI: -h prints the usage and exits 0; an unknown flag, no instance or an unknown instance is exit 64; a state file that is not ours is exit 1 and nothing is fetched', () => {
  const run = (args) => spawnSync(process.execPath, ['--max-old-space-size=512', path.join(HERE, 'cold-read.mjs'), ...args], { encoding: 'utf8', timeout: 60000, env: { PATH: process.env.PATH } });
  const h = run(['-h']);
  assert.strictEqual(h.status, 0); assert.match(h.stdout, /usage: node scripts\/watcher\/cold-read\.mjs <instance>/);
  assert.strictEqual(run(['--nope', 'thecolliery']).status, 64);
  assert.strictEqual(run([]).status, 64);
  assert.strictEqual(run(['nobody']).status, 64);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cold-read-'));
  try {
    const bad = path.join(dir, 'state.json');
    fs.writeFileSync(bad, '{"v":2}\n');
    const r = run(['thecolliery', `--state=${bad}`, '--dry-run']);
    assert.strictEqual(r.status, 1); assert.match(r.stderr, /cannot be read/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
