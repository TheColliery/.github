// controlled-fidelity-score.mjs — reproduces the v1 controlled equal-size
// fidelity benchmark (results/controlled-fidelity-claude-code-2026-07-12.md).
//
// Design: hold output SIZE constant across cutting arms, measure what each LOST.
// Recall is recomputed HERE from each arm's output via the SHIPPED CoalWash
// inventory engine — the tool's own gate is never cited as its own proof.
//
// Usage:  node controlled-fidelity-score.mjs <dir> [--lib <fidelity-gate.mjs>]
//   <dir> holds the (private, uncommitted) real dogfood files:
//     corpus-prerewash.md   the pre-re-wash MEMORY.md (corpus / unchecked)
//     cw-memory.md          current live MEMORY.md   (coalwash live output)
//     cw-archive.md         current LAB-ARCHIVE.md   (coalwash externalized)
//     naive-run-1.md ...    the naive-compress outputs (any count >= 1)
//   --lib defaults to the NEWEST coalwash plugin-cache install (version-agnostic).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith('--')) || '.';
const libFlag = args.indexOf('--lib');
// Default LIB = the newest coalwash plugin-cache fidelity-gate.mjs (portable, version-agnostic);
// a hardcoded version would rot on the next CoalWash bump (cache-GC drops old versions). --lib overrides.
function newestCacheLib() {
  const base = path.join(os.homedir(), '.claude/plugins/cache/coalwash/coalwash');
  const hits = (fs.existsSync(base) ? fs.readdirSync(base) : [])
    .map((v) => path.join(base, v, 'scripts/lib/fidelity-gate.mjs'))
    .filter((p) => fs.existsSync(p))
    .map((p) => ({ p, m: fs.statSync(p).mtimeMs }))
    .sort((a, b) => b.m - a.m);
  if (!hits.length) throw new Error('coalwash plugin not found in cache — pass --lib <path to fidelity-gate.mjs>');
  return hits[0].p;
}
const LIB = libFlag !== -1 ? args[libFlag + 1] : newestCacheLib();
const { inventory } = await import(pathToFileURL(LIB).href);

const CLASSES = ['wikilinks', 'dates', 'versions', 'links', 'frontmatter', 'codespans', 'quotes', 'numbers'];
const read = (p) => fs.readFileSync(path.join(dir, p), 'utf8');
const B = (s) => Buffer.byteLength(s, 'utf8');
const pct = (x) => (x * 100).toFixed(2) + '%';
const total = (inv) => CLASSES.reduce((n, c) => n + inv[c].size, 0);

// recall(originalText, survivorText): fraction of original's structured tokens
// present in survivor, per class (matches the engine's diffDrops semantics).
function recall(oText, sText) {
  const oi = inventory(oText), si = inventory(sText);
  let tot = 0, kept = 0; const byC = {};
  for (const c of CLASSES) {
    let k = 0;
    for (const v of oi[c]) { tot++; if (si[c].has(v)) { kept++; k++; } }
    byC[c] = { orig: oi[c].size, dropped: oi[c].size - k };
  }
  return { total: tot, kept, recall: tot ? kept / tot : 1, byC };
}
// of corpus tokens NOT in `live`, how many are recoverable in `archive` (or none).
function removedRecoverable(ci, liveInv, arcInv) {
  let removed = 0, rec = 0;
  for (const c of CLASSES) for (const v of ci[c]) if (!liveInv[c].has(v)) { removed++; if (arcInv && arcInv[c].has(v)) rec++; }
  return { removed, rec };
}
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

const corpus = read('corpus-prerewash.md');
const cwMem = read('cw-memory.md');
const cwArc = read('cw-archive.md');
const naiveFiles = fs.readdirSync(dir).filter((f) => /^naive-run-\d+\.md$/.test(f)).sort();
const CB = B(corpus), TB = B(cwMem);
const ci = inventory(corpus), TOK = total(ci);
const saving = (b) => (CB - b) / CB;

console.log(`corpus=${CB}B ${TOK} tokens | target(live)=${TB}B band ${Math.round(TB*0.95)}..${Math.round(TB*1.05)}`);
console.log('corpus classes: ' + CLASSES.map((c) => `${c}=${ci[c].size}`).join(' '));

console.log(`\nunchecked      : bytes=${CB} saving=${pct(0)} recall=${pct(1)} lost=0 latent-recov=100%`);

const cwR = recall(corpus, cwMem + '\n' + cwArc);
const cwLR = removedRecoverable(ci, inventory(cwMem), inventory(cwArc));
console.log(`coalwash       : live=${TB} saving=${pct(saving(TB))} recall(union)=${cwR.kept}/${cwR.total}=${pct(cwR.recall)} lost=${cwR.total - cwR.kept} removed-from-live=${cwLR.removed} recoverable=${cwLR.rec}/${cwLR.removed}=${pct(cwLR.removed ? cwLR.rec / cwLR.removed : 1)}`);

const lost = [], rec = [], sav = [], byt = [];
const clsDrop = Object.fromEntries(CLASSES.map((c) => [c, []]));
for (const f of naiveFiles) {
  const t = read(f), b = B(t), r = recall(corpus, t);
  const rr = removedRecoverable(ci, inventory(t), null);
  lost.push(r.total - r.kept); rec.push(r.recall); sav.push(saving(b)); byt.push(b);
  for (const c of CLASSES) clsDrop[c].push(r.byC[c].dropped);
  const inBand = b >= TB * 0.95 && b <= TB * 1.05;
  console.log(`naive ${f.padEnd(14)}: bytes=${b}${inBand ? '' : '(OUT-OF-BAND)'} saving=${pct(saving(b))} recall=${r.kept}/${r.total}=${pct(r.recall)} lost=${r.total - r.kept} removed=${rr.removed} recoverable=0`);
}
if (naiveFiles.length) {
  console.log(`\nnaive mean (K=${naiveFiles.length}): bytes=${Math.round(mean(byt))} [${Math.min(...byt)}..${Math.max(...byt)}] saving=${pct(mean(sav))} recall=${pct(mean(rec))} tokens-lost=${mean(lost).toFixed(1)} [${Math.min(...lost)}..${Math.max(...lost)}] latent-recoverable=0%`);
  console.log('naive mean drops/class: ' + CLASSES.map((c) => `${c}=${mean(clsDrop[c]).toFixed(1)}/${ci[c].size}`).join(' '));
}
