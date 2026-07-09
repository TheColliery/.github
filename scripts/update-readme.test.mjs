// Zero-dep node:test for update-readme.mjs — verifies the fail-loud assertion
// that catches a drifted badge regex (a silent no-op .replace) instead of
// shipping stale badges. The two READMEs carry different badge sets, so the
// check is AGGREGATE across files, not per-file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const mod = await import('./update-readme.mjs');
const { badgeSpecs, updateFileStats, assertEveryBadgeMatched } = mod;

const STATS = {
  combinedClones: '3.0k+', combinedUniques: '682+',
  mineClones: '1.8k+', mineUniques: '398+',
  tippleClones: '959+', tippleUniques: '200+',
  boardClones: '286+', boardUniques: '84+',
  hearthClones: '40+', hearthUniques: '12+',
  faceClones: '31+', faceUniques: '9+',
  washClones: '0+', washUniques: '0+',
  ledgerClones: '0+', ledgerUniques: '0+',
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

test('badgeSpecs covers all 16 badges (2 global + 14 per-tool)', () => {
  assert.equal(badgeSpecs(STATS).length, 16);
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
  assertEveryBadgeMatched([profileHits, rootHits], STATS);
  assert.equal(process.exitCode, 1, 'an unmatched badge must set exitCode 1');
  process.exitCode = prev;
});
