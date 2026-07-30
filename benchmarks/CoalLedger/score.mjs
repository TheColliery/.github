#!/usr/bin/env node
// CoalLedger eval scorer — detection-rate measurement for the semantic
// doc-health canaries (doc-rot, doc-leak).
//
// Compares an agent run's findings against the planted ground truth in
// fixtures/<suite>/<fixture>/expected.json. A finding matches when
// fixture + file + category agree and line is within ±LINE_TOLERANCE.
// Any finding on a decoy (expected.findings = []) counts as a false positive.
//
// Usage:
//   node score.mjs results/<run>.json        (score a run)
//   node score.mjs results/<run>.json --write (score + regenerate RESULTS.md)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.dirname(fileURLToPath(import.meta.url));
const LINE_TOLERANCE = 3;

function die(msg) { console.error(`FAIL: ${msg}`); process.exit(1); }

const argv = process.argv.slice(2);
const writeResults = argv.includes('--write');
const runPath = argv.find((a) => !a.startsWith('--'));
if (!runPath) die('usage: node score.mjs results/<run>.json [--write]');

let run;
try { run = JSON.parse(fs.readFileSync(runPath, 'utf8')); }
catch (e) { die(`run file unreadable: ${e.message}`); }
if (!Array.isArray(run.findings)) die('run file has no findings[]');

const suite = run.suite;
if (!suite || !/^[a-z0-9-]+$/.test(suite)) die(`invalid or missing suite in run file`);
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

for (const f of run.findings) {
  if (!expected[f.fixture]) die(`finding references unknown fixture "${f.fixture}"`);
}

// ── score ────────────────────────────────────────────────────────────────────
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
const recall = total > 0 ? (totalTP / total * 100).toFixed(1) : 'N/A';

// ── report ───────────────────────────────────────────────────────────────────
const lines = [
  `# CoalLedger Eval — ${suite}`,
  '',
  `**Run:** ${path.basename(runPath)}`,
  `**Model:** ${run.model ?? '—'} · **Date:** ${run.date ?? '—'} · **Skill version:** ${run.skillVersion ?? '—'}`,
  '',
  `**Recall:** ${recall}% (${totalTP}/${total} planted defects found)`,
  `**False positives:** ${totalFP}`,
  '',
  '| Fixture | Expected | Found | Missed | FP |',
  '|---------|----------|-------|--------|----|',
  ...rows.map((r) => `| ${r.fixture} | ${r.expected} | ${r.tp} | ${r.fn} | ${r.fp} |`),
  '',
];

const report = lines.join('\n');
console.log(report);

if (writeResults) {
  fs.writeFileSync(path.join(repo, 'RESULTS.md'), report, 'utf8');
  console.log('Wrote RESULTS.md');
}
