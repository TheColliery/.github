// Zero-dep node:test for update-readme.mjs — verifies the fail-loud assertion
// that catches a drifted badge regex (a silent no-op .replace) instead of
// shipping stale badges. The two READMEs carry different badge sets, so the
// check is AGGREGATE across files, not per-file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const mod = await import('./update-readme.mjs');
const { badgeSpecs, updateFileStats, assertEveryBadgeMatched, fetchRepoClones } = mod;

const STATS = {
  combinedClones: '3.0k+', combinedUniques: '682+',
  mineClones: '1.8k+', mineUniques: '398+',
  tippleClones: '959+', tippleUniques: '200+',
  boardClones: '286+', boardUniques: '84+',
  hearthClones: '40+', hearthUniques: '12+',
  faceClones: '31+', faceUniques: '9+',
  washClones: '0+', washUniques: '0+',
  ledgerClones: '0+', ledgerUniques: '0+',
  gobClones: '5+', gobUniques: '2+',
};

function withTmp(name, content, fn) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'cm-readme-'));
  try {
    const fp = path.join(dir, name);
    writeFileSync(fp, content, 'utf8');
    return fn(fp, dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('badgeSpecs covers all 18 badges (2 global + 16 per-tool)', () => {
  assert.equal(badgeSpecs(STATS).length, 18);
});

test('updateFileStats replaces a present badge and counts the hit', () => {
  const before = 'x ![d](https://img.shields.io/badge/CoalMine_Downloads-0%2B%20%2F%2014d-orange) y';
  withTmp('README.md', before, (fp) => {
    const hits = updateFileStats(fp, STATS);
    assert.equal(hits['CoalMine_Downloads'], 1);
    const after = readFileSync(fp, 'utf8');
    assert.match(after, /CoalMine_Downloads-1\.8k%2B%20%2F%2014d-orange/);
  });
});

test('updateFileStats counts 0 for a badge absent in this file', () => {
  withTmp('README.md', 'Downloads-0%2B-orange only', (fp) => {
    const hits = updateFileStats(fp, STATS);
    assert.equal(hits['Downloads (global)'], 1);
    assert.equal(hits['CoalMine_Downloads'], 0);
  });
});

test('assertEveryBadgeMatched: all 8 matched across the two-file split → no failure', () => {
  // profile carries the 2 global badges; root carries the 6 per-tool — same as the repo.
  const profileHits = {}; const rootHits = {};
  for (const s of badgeSpecs(STATS)) { profileHits[s.name] = 0; rootHits[s.name] = 0; }
  profileHits['Downloads (global)'] = 1;
  profileHits['Developers (global)'] = 1;
  for (const s of badgeSpecs(STATS)) {
    if (s.name.includes('_')) rootHits[s.name] = 1;
  }
  const prev = process.exitCode;
  process.exitCode = 0;
  assertEveryBadgeMatched([profileHits, rootHits], STATS);
  assert.equal(process.exitCode, 0, 'all badges matched somewhere — must not fail');
  process.exitCode = prev;
});

test('assertEveryBadgeMatched: a badge matched NOWHERE (drift) → fail loud (exitCode 1)', () => {
  const profileHits = {}; const rootHits = {};
  for (const s of badgeSpecs(STATS)) { profileHits[s.name] = 1; rootHits[s.name] = 1; }
  rootHits['CoalBoard_Downloads'] = 0;
  profileHits['CoalBoard_Downloads'] = 0; // matched nowhere = drifted markup
  const prev = process.exitCode;
  process.exitCode = 0;
  // This path's console.error is real production behavior (the live drift alarm) —
  // but printing it here, from a SYNTHETIC negative case, makes every green CI run
  // carry a "FAIL: badge regex matched nothing" line indistinguishable from a real
  // one (verify-landing.yml runs this file on every push). Capture instead of leak.
  const realError = console.error;
  const errors = [];
  console.error = (...args) => errors.push(args.join(' '));
  try {
    assertEveryBadgeMatched([profileHits, rootHits], STATS);
  } finally {
    console.error = realError;
  }
  assert.equal(process.exitCode, 1, 'an unmatched badge must set exitCode 1');
  assert.match(errors.join('\n'), /CoalBoard_Downloads/, 'must name the drifted badge');
  process.exitCode = prev;
});

// --- fetchRepoClones: the traffic API response is parsed at the boundary (code-scanning #2) ---
// count/uniques end up as text in a README badge URL, and encodeURIComponent leaves ( ) ! * ~ '
// unescaped -- so only a number, or a missing field, may pass. Anything else is a per-repo FAIL
// (fetchRepoClonesSafe turns the throw into the {0,0} sentinel + exitCode 1, the existing path).
async function withFakeApi(body, fn) {
  const realFetch = globalThis.fetch;
  const hadToken = 'PAT_TOKEN' in process.env;
  const prevToken = process.env.PAT_TOKEN;
  process.env.PAT_TOKEN = 'test-token';
  globalThis.fetch = async () => ({ ok: true, status: 200, statusText: 'OK', json: async () => body });
  try {
    return await fn();
  } finally {
    globalThis.fetch = realFetch;
    if (hadToken) process.env.PAT_TOKEN = prevToken; else delete process.env.PAT_TOKEN;
  }
}

test('fetchRepoClones: a real traffic body yields exactly {count, uniques} -- the daily clones array is dropped', async () => {
  const got = await withFakeApi({ count: 1834, uniques: 398, clones: [{ timestamp: 'x', count: 1, uniques: 1 }] }, () => fetchRepoClones('o/r'));
  assert.deepEqual(got, { count: 1834, uniques: 398 });
});

test('fetchRepoClones: a missing count/uniques reads 0 (the old `|| 0` tolerance, kept)', async () => {
  assert.deepEqual(await withFakeApi({}, () => fetchRepoClones('o/r')), { count: 0, uniques: 0 });
  assert.deepEqual(await withFakeApi({ count: null, uniques: 7 }, () => fetchRepoClones('o/r')), { count: 0, uniques: 7 });
});

test('fetchRepoClones: a non-numeric count is REFUSED -- a string carrying badge/markdown metacharacters must not reach the README (RED before the boundary parse)', async () => {
  await assert.rejects(withFakeApi({ count: '1)![x](y', uniques: 1 }, () => fetchRepoClones('o/r')), /count is not a non-negative integer/);
  await assert.rejects(withFakeApi({ count: 1, uniques: '5' }, () => fetchRepoClones('o/r')), /uniques is not a non-negative integer/);
});

test('fetchRepoClones: negative, fractional, NaN-like and unsafe numbers are REFUSED', async () => {
  for (const bad of [-1, 1.5, 2 ** 60, Infinity]) {
    await assert.rejects(withFakeApi({ count: bad, uniques: 0 }, () => fetchRepoClones('o/r')), /count is not a non-negative integer/, String(bad));
  }
});

// --- CoalGob joins the traffic list (new-sibling launch, SWEEP-MARKS Event 4 mark 3) --------------------
// The repo list lived in FOUR hard-coded places in main() (the fetch, the two sums, the stats object)
// plus badgeSpecs, and nothing tied them together, so a launch that touched some and not the others
// would have printed a green run. These tests pin the wiring end to end, not just the spec list.
test('badgeSpecs carries a per-tool Downloads + Developers pair for CoalGob', () => {
  const names = badgeSpecs(STATS).map((s) => s.name);
  assert.ok(names.includes('CoalGob_Downloads'), names.join(','));
  assert.ok(names.includes('CoalGob_Developers'), names.join(','));
  const dl = badgeSpecs(STATS).find((s) => s.name === 'CoalGob_Downloads');
  assert.match('CoalGob_Downloads-0%2B%20%2F%2014d-orange', dl.re);
  assert.equal(dl.val, 'CoalGob_Downloads-' + encodeURIComponent('5+ / 14d') + '-orange');
});

// Every per-tool badge in the badge spec list has a matching entry in the README's Active Repositories list
// and the other way round: a spec with no badge fails the aggregate check loudly at run time, but a badge
// with no spec would silently freeze at its seed value.
test('the root README carries exactly the per-tool badges the specs update (no frozen badge, no orphan spec)', () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  const inReadme = [...readme.matchAll(/(Coal[A-Za-z]+_(?:Downloads|Developers))-/g)].map((m) => m[1]);
  const specs = badgeSpecs(STATS).map((s) => s.name).filter((n) => n.includes('_'));
  assert.deepEqual([...new Set(inReadme)].sort(), [...specs].sort());
  assert.equal(inReadme.length, specs.length, 'each per-tool badge appears exactly once');
});

// The CLI, spawned with a fetch stub preloaded (NODE_OPTIONS=--import): the assertion is on what it requests
// and what it writes. Counts stay under 1000 so the expected badge text is exact (no k-rounding ambiguity).
const TOOLS = ['CoalMine', 'CoalTipple', 'CoalBoard', 'CoalHearth', 'CoalFace', 'CoalWash', 'CoalLedger', 'CoalGob'];
const TRAFFIC = { CoalMine: [300, 20], CoalTipple: [60, 10], CoalBoard: [20, 5], CoalHearth: [30, 5], CoalFace: [40, 4], CoalWash: [25, 3], CoalLedger: [25, 3], CoalGob: [44, 6] };
const STUB_SRC = String.raw`import fs from 'node:fs';
const T = JSON.parse(process.env.STUB_TRAFFIC);
globalThis.fetch = async (url) => {
  const m = String(url).match(/repos\/([^/]+)\/([^/]+)\/traffic\/clones/);
  fs.appendFileSync(process.env.STUB_LOG, (m ? m[1] + '/' + m[2] : 'OTHER ' + url) + '\n');
  const t = m && T[m[2]];
  return { ok: !!t, status: t ? 200 : 404, statusText: t ? 'OK' : 'Not Found', json: async () => ({ count: t ? t[0] : 0, uniques: t ? t[1] : 0 }) };
};
`;

test('update-readme CLI: fetches CoalGob, adds it to the combined sums, and rewrites its per-tool badges (RED before CoalGob was wired)', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'update-readme-cli-'));
  try {
    mkdirSync(path.join(dir, 'profile'));
    writeFileSync(path.join(dir, 'profile', 'README.md'), 'Downloads-0%2B%20%2F%2014d-orange Developers-0%2B%20%2F%2014d-brightgreen\n');
    writeFileSync(path.join(dir, 'README.md'), TOOLS.map((n) => `${n}_Downloads-0%2B%20%2F%2014d-orange ${n}_Developers-0%2B%20%2F%2014d-brightgreen`).join('\n') + '\n');
    const log = path.join(dir, 'calls.log');
    const stub = path.join(dir, 'stub.mjs');
    writeFileSync(stub, STUB_SRC);
    const res = spawnSync(process.execPath, [fileURLToPath(new URL('./update-readme.mjs', import.meta.url))], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, PAT_TOKEN: 'test-token', NODE_OPTIONS: '--import=' + pathToFileURL(stub).href, STUB_LOG: log, STUB_TRAFFIC: JSON.stringify(TRAFFIC) },
    });
    const calls = readFileSync(log, 'utf8').split('\n').filter(Boolean);
    assert.ok(calls.some((c) => c.endsWith('/CoalGob')), 'CoalGob traffic must be requested: ' + calls.join(','));
    assert.equal(res.status, 0, res.stderr + res.stdout);
    const root = readFileSync(path.join(dir, 'README.md'), 'utf8');
    const profile = readFileSync(path.join(dir, 'profile', 'README.md'), 'utf8');
    assert.match(root, /CoalGob_Downloads-44%2B%20%2F%2014d-orange/);
    assert.match(root, /CoalGob_Developers-6%2B%20%2F%2014d-brightgreen/);
    // combined = 300+60+20+30+40+25+25+44 = 544 clones, 20+10+5+5+4+3+3+6 = 56 uniques (the sum INCLUDES CoalGob)
    assert.match(profile, /Downloads-544%2B%20%2F%2014d-orange/);
    assert.match(profile, /Developers-56%2B%20%2F%2014d-brightgreen/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
