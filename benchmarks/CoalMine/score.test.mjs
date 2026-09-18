// Zero-dep node:test for score.mjs — verifies the planted-defect count is the
// real ground-truth total (13 across 12 fixtures), not the fixture-dir count (12).
// f01-dead-code plants 2 defects, so (fixtures - decoys) undercounts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync, cpSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SCORE = path.join(here, 'score.mjs');
const FIXTURES = path.join(here, 'fixtures', 'rot-canary');
const BASELINE = path.join(here, 'results', '2026-06-12-claude-fable-5.json');

// Ground truth read straight from the fixtures — independent of the scorer.
function groundTruth() {
  const dirs = readdirSync(FIXTURES, { withFileTypes: true })
    .filter((e) => e.isDirectory()).map((e) => e.name).sort();
  let planted = 0, plantedFixtures = 0, decoys = 0;
  for (const d of dirs) {
    const p = path.join(FIXTURES, d, 'expected.json');
    const findings = JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, '')).findings ?? [];
    if (findings.length === 0) decoys++;
    else { plantedFixtures++; planted += findings.length; }
  }
  return { total: dirs.length, planted, plantedFixtures, decoys };
}

test('ground truth has 13 planted defects across 12 fixtures (f01 plants 2)', () => {
  const gt = groundTruth();
  assert.equal(gt.total, 16);
  assert.equal(gt.plantedFixtures, 12);
  assert.equal(gt.planted, 13);
  assert.equal(gt.decoys, 4);
});

test('printed report uses the real planted total (13/13), not the dir count (12/12)', () => {
  assert.ok(existsSync(BASELINE), 'committed baseline run is missing');
  const out = execFileSync(process.execPath, [SCORE, BASELINE], { encoding: 'utf8' });
  assert.match(out, /\(13\/13\)/, 'recall denominator should be 13 (all planted defects)');
  assert.doesNotMatch(out, /\(12\/12\)/, 'must not undercount planted defects as 12');
});

test('--write methodology string names "13 planted", not "12 with planted"', () => {
  // Hermetic: copy the whole benchmark dir to a sandbox so the real committed
  // RESULTS.md is never touched, then run --write there and read the result.
  const sandbox = mkdtempSync(path.join(os.tmpdir(), 'cm-score-'));
  try {
    cpSync(here, sandbox, { recursive: true });
    const sScore = path.join(sandbox, 'score.mjs');
    const sBaseline = path.join(sandbox, 'results', '2026-06-12-claude-fable-5.json');
    execFileSync(process.execPath, [sScore, sBaseline, '--write'], { encoding: 'utf8' });
    const results = readFileSync(path.join(sandbox, 'RESULTS.md'), 'utf8');
    assert.match(results, /12 with 13 planted/, 'methodology must state 13 planted defects');
    assert.doesNotMatch(results, /12 with planted, line-labeled/, 'must not keep the old undercounting phrasing');
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});
