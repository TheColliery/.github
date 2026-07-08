#!/usr/bin/env node
// CoalWash benchmark scorer — mechanical, zero-dep (node built-ins only).
//
//   node score.mjs <fixtureDir> <storeDir> [--round N] [--model NAME]
//                  [--phase has-fat|fat-exhausted] [--json]
//   node score.mjs --size <dir>
//
// Compares a post-run memory store against the fixture's expected.json ground
// truth: every muscle needle must still be present SOMEWHERE in the store
// (absent = a lost fact); every fat needle must be absent EVERYWHERE (present
// = not cleaned). Matching is whitespace-normalized exact substring — an
// encoding corruption (e.g. Thai U+0E33 decomposed to U+0E4D+U+0E32) breaks
// the match and correctly counts as loss. Also reports the no-op check
// (file-set + byte diff vs the pristine fixture) — load-bearing for LEAN
// fixtures (expectNoOp: true), informational elsewhere.
//
// Exit codes: 0 = scored (a measured loss is a RESULT, not a script failure);
// 1 = usage/IO error only.
import fs from 'node:fs';
import path from 'node:path';

function die(msg) { console.error(`score: ${msg}`); process.exit(1); }

function mdFiles(dir) {
  let names;
  try { names = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { die(`cannot read ${dir}: ${e.message}`); }
  return names.filter((d) => d.isFile() && d.name.endsWith('.md')).map((d) => d.name).sort();
}
function readStore(dir) {
  const files = {};
  for (const name of mdFiles(dir)) files[name] = fs.readFileSync(path.join(dir, name), 'utf8');
  return files;
}
const norm = (s) => String(s).replace(/\s+/g, ' ');

// ~est tokens: ASCII ~4 chars/token, non-ASCII ~1.5 (the CoalWash caliper heuristic).
function tokensEst(text) {
  let ascii = 0, non = 0;
  for (let i = 0; i < text.length; i++) (text.charCodeAt(i) < 128 ? ascii++ : non++);
  return Math.round(ascii / 4 + non / 1.5);
}

// ---- --size mode: bytes + ~est tokens of a store dir (for the saving arms) ----
const args = process.argv.slice(2);
if (args[0] === '--size') {
  const dir = args[1] || die('--size needs a dir');
  const store = readStore(dir);
  let bytes = 0, tok = 0;
  for (const text of Object.values(store)) { bytes += Buffer.byteLength(text, 'utf8'); tok += tokensEst(text); }
  console.log(`${dir} · ${Object.keys(store).length} file(s) · ${bytes} bytes · ~${tok} tok (~est)`);
  process.exit(0);
}

// ---- score mode ----
const positional = args.filter((a) => !a.startsWith('--'));
const flag = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const [fixtureDir, storeDir] = positional;
if (!fixtureDir || !storeDir) die('usage: node score.mjs <fixtureDir> <storeDir> [--round N] [--model NAME] [--phase p] [--json]');

let expected;
try { expected = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'expected.json'), 'utf8')); }
catch (e) { die(`cannot read expected.json in ${fixtureDir}: ${e.message}`); }

const store = readStore(storeDir);
const haystack = norm(Object.values(store).join('\n'));

const muscle = (expected.muscle || []).map((m) => ({ ...m, kept: haystack.includes(norm(m.needle)) }));
const fat = (expected.fat || []).map((f) => ({ ...f, removed: !haystack.includes(norm(f.needle)) }));

// no-op check vs the pristine fixture (*.md only; expected.json is not store content)
const fix = readStore(fixtureDir);
const changed = [];
for (const [name, text] of Object.entries(fix)) {
  if (!(name in store)) changed.push(`${name} (deleted)`);
  else if (store[name] !== text) changed.push(`${name} (modified)`);
}
for (const name of Object.keys(store)) if (!(name in fix)) changed.push(`${name} (added)`);

const lost = muscle.filter((m) => !m.kept);
const remaining = fat.filter((f) => !f.removed);
const pct = (n, d) => (d ? ((n / d) * 100).toFixed(1) : 'n/a');
const result = {
  fixture: expected.fixture || path.basename(fixtureDir),
  round: flag('round') ? Number(flag('round')) : undefined,
  model: flag('model'),
  phase: flag('phase'),
  date: new Date().toISOString().slice(0, 10),
  muscle: { total: muscle.length, kept: muscle.length - lost.length, lost: lost.map((m) => m.id), lossPct: pct(lost.length, muscle.length) },
  fat: { total: fat.length, removed: fat.length - remaining.length, remaining: remaining.map((f) => f.id), removalPct: pct(fat.length - remaining.length, fat.length) },
  noOp: { expected: expected.expectNoOp === true, actual: changed.length === 0, changed },
};

if (args.includes('--json')) {
  console.log(JSON.stringify(result, null, 2));
} else {
  const tag = [result.model, result.round != null ? `round ${result.round}` : '', result.phase].filter(Boolean).join(' · ');
  console.log(`CoalWash score · ${result.fixture}${tag ? ` · ${tag}` : ''} · ${result.date}`);
  console.log(`muscle: ${result.muscle.kept}/${result.muscle.total} kept · fact-loss ${result.muscle.lossPct}%${lost.length ? ` · LOST: ${result.muscle.lost.join(', ')}` : ''}`);
  const remPct = result.fat.removalPct === 'n/a' ? 'n/a' : `${result.fat.removalPct}%`;
  console.log(`fat: ${result.fat.removed}/${result.fat.total} removed (${remPct})${remaining.length ? ` · remaining: ${result.fat.remaining.join(', ')}` : ''}`);
  console.log(result.noOp.expected
    ? (result.noOp.actual ? 'no-op: PASS (store untouched, as a lean store must be)' : `no-op: FAIL — expected untouched, changed: ${changed.join(', ')}`)
    : (changed.length ? `changed files: ${changed.join(', ')}` : 'changed files: none'));
  console.log(lost.length === 0 ? 'fidelity: 0 facts lost' : `fidelity: ${lost.length} FACT(S) LOST`);
}
