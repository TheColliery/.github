#!/usr/bin/env node
// CoalLedger eval scorer — detection-rate measurement for the semantic
// doc-health canaries (doc-rot, doc-leak).
//
// Compares an agent run's findings against the planted ground truth in
// fixtures/<suite>/<fixture>/expected.json. A finding matches when
// fixture + file + category agree and line is within ±LINE_TOLERANCE.
// Any finding on a decoy (expected.findings = []) counts as a false positive.
//
// Multi-run aggregation: when multiple run files share the same suite + model,
// the report shows per-run recall/FP plus mean and min–max across runs.
//
// Usage:
//   node score.mjs results/<run>.json [more.json ...]   (score one or more runs)
//   node score.mjs --suite doc-rot --model "Claude Opus 4.8"  (auto-find matching runs)
//   node score.mjs results/<run>.json --write           (score + regenerate RESULTS.md)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = path.join(repo, 'results');
const LINE_TOLERANCE = 3;

function die(msg) { console.error(`FAIL: ${msg}`); process.exit(1); }

const argv = process.argv.slice(2);
const writeResults = argv.includes('--write');
const suiteFilter = argv.includes('--suite') ? argv[argv.indexOf('--suite') + 1] : null;
const modelFilter = argv.includes('--model') ? argv[argv.indexOf('--model') + 1] : null;
const positional = argv.filter((a) => !a.startsWith('--') &&
  a !== suiteFilter && a !== modelFilter);

// ── load runs ────────────────────────────────────────────────────────────────
let runPaths = positional;

if (!runPaths.length && (suiteFilter || modelFilter)) {
  if (!fs.existsSync(RESULTS_DIR)) die('no results dir');
  runPaths = fs.readdirSync(RESULTS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => path.join(RESULTS_DIR, f));
}

if (!runPaths.length) {
  if (!fs.existsSync(RESULTS_DIR)) die('usage: node score.mjs results/<run>.json [--write]');
  runPaths = fs.readdirSync(RESULTS_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => path.join(RESULTS_DIR, f));
  if (!runPaths.length) die('no run files in results/');
}

const runs = [];
for (const rp of runPaths) {
  let run;
  try { run = JSON.parse(fs.readFileSync(rp, 'utf8')); }
  catch (e) { die(`${rp}: unreadable: ${e.message}`); }
  if (!Array.isArray(run.findings)) die(`${rp}: no findings[]`);
  run._path = rp;
  if (suiteFilter && run.suite !== suiteFilter) continue;
  if (modelFilter && run.model !== modelFilter) continue;
  runs.push(run);
}

if (!runs.length) die('no matching runs found');

const suite = runs[0].suite;
if (!suite || !/^[a-z0-9-]+$/.test(suite)) die(`invalid or missing suite`);
if (runs.some((r) => r.suite !== suite)) die('all runs must be the same suite');

// ── load ground truth ────────────────────────────────────────────────────────
const FIXTURES = path.join(repo, 'fixtures', suite);
if (!fs.existsSync(FIXTURES)) die(`no fixtures at ${FIXTURES}`);
const fixtures = fs.readdirSync(FIXTURES, { withFileTypes: true })
  .filter((e) => e.isDirectory()).map((e) => e.name).sort();
if (!fixtures.length) die('fixture suite is empty');

const expected = {};
for (const f of fixtures) {
  const p = path.join(FIXTURES, f, 'expected.json');
  if (!fs.existsSync(p)) die(`${f}: expected.json missing`);
  try { expected[f] = JSON.parse(fs.readFileSync(p, 'utf8')).findings ?? []; }
  catch (e) { die(`${f}: expected.json unreadable: ${e.message}`); }
}

// ── score each run ───────────────────────────────────────────────────────────
function scoreRun(run) {
  for (const f of run.findings) {
    if (!expected[f.fixture]) die(`finding references unknown fixture "${f.fixture}"`);
  }

  let totalTP = 0, totalFN = 0, totalFP = 0;
  const rows = [];

  for (const [fixture, exps] of Object.entries(expected)) {
    const found = run.findings.filter((f) => f.fixture === fixture);
    const matched = new Set();
    let tp = 0;

    for (const exp of exps) {
      const idx = found.findIndex((rf, i) =>
        !matched.has(i) &&
        rf.category === exp.category &&
        rf.file === exp.file &&
        Math.abs((rf.line ?? 0) - (exp.line ?? 0)) <= LINE_TOLERANCE
      );
      if (idx >= 0) { matched.add(idx); tp++; }
    }

    const fn = exps.length - tp;
    const fp = found.length - matched.size;
    rows.push({ fixture, expected: exps.length, tp, fn, fp });
    totalTP += tp; totalFN += fn; totalFP += fp;
  }

  const total = totalTP + totalFN;
  const recall = total > 0 ? totalTP / total * 100 : null;
  return { totalTP, totalFN, totalFP, total, recall, rows, run };
}

const scored = runs.map(scoreRun);

// ── report ───────────────────────────────────────────────────────────────────
const lines = [];
const model = runs[0].model ?? '—';
const N = scored.length;

lines.push(`# CoalLedger Eval — ${suite}`);
lines.push('');
lines.push(`**Model:** ${model} · **Runs:** ${N} · **Skill version:** ${runs[0].skillVersion ?? '—'}`);
lines.push('');

if (N === 1) {
  const s = scored[0];
  lines.push(`**Run:** ${path.basename(s.run._path)} · **Date:** ${s.run.date ?? '—'}`);
  lines.push(`**Recall:** ${s.recall !== null ? s.recall.toFixed(1) : 'N/A'}% (${s.totalTP}/${s.total})`);
  lines.push(`**False positives:** ${s.totalFP}`);
  lines.push('');
  lines.push('| Fixture | Expected | Found | Missed | FP |');
  lines.push('|---------|----------|-------|--------|----|');
  for (const r of s.rows) {
    lines.push(`| ${r.fixture} | ${r.expected} | ${r.tp} | ${r.fn} | ${r.fp} |`);
  }
} else {
  const recalls = scored.map((s) => s.recall).filter((r) => r !== null);
  const fps = scored.map((s) => s.totalFP);
  const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const min = (arr) => Math.min(...arr);
  const max = (arr) => Math.max(...arr);

  lines.push(`**Recall (mean):** ${mean(recalls).toFixed(1)}% (range: ${min(recalls).toFixed(1)}–${max(recalls).toFixed(1)}%)`);
  lines.push(`**FP (mean):** ${mean(fps).toFixed(1)} (range: ${min(fps)}–${max(fps)})`);
  lines.push('');
  lines.push('### Per-run breakdown');
  lines.push('');
  lines.push('| Run | Date | Recall | TP | FN | FP |');
  lines.push('|-----|------|--------|----|----|----|');
  for (const s of scored) {
    const name = path.basename(s.run._path);
    const r = s.recall !== null ? s.recall.toFixed(1) + '%' : 'N/A';
    lines.push(`| ${name} | ${s.run.date ?? '—'} | ${r} | ${s.totalTP} | ${s.totalFN} | ${s.totalFP} |`);
  }
}

lines.push('');
const report = lines.join('\n');
console.log(report);

if (writeResults) {
  fs.writeFileSync(path.join(repo, 'RESULTS.md'), report, 'utf8');
  console.log('\nWrote RESULTS.md');
}
