#!/usr/bin/env node
// verify-landing.mjs — the mechanical gate for the .github landing repo.
//
// It enforces the .github-LOCAL marks a human kept catching by eye (the recurring
// "you shipped X without sweeping Y" class), so a machine catches them first:
//   1. No Thai (U+0E00–U+0E7F) in the VISITOR front doors (profile/, benchmarks/, root README.md)
//      unless the file declares "<!-- lang-exempt: reason -->" — the landing is language-universal.
//   2. Every benchmarks/<Tool>/ has a row in the profile/README.md Benchmarks table (the CH miss).
//   3. Every benchmarks/<Tool>/ carries a dated record (a benchmark without its date rots).
//
// Fail-loud: any issue → non-zero exit + a listed reason (scripts-quality.md discipline).
//
// Thai SCOPE — only the visitor front doors above. The design/reference docs (hooks-safety.md,
// scripts-quality.md, DOC-PATTERN.md, …) are bilingual BY DESIGN (Phoenix-13 canonical names,
// quoted rules) and are out of scope. Inside scope, a file that legitimately needs Thai — a
// translation-benchmark record quoting scored Thai model-output as DATA — names it with a
// "<!-- lang-exempt: reason -->" marker (the "name the intentional divergence" rule); anything
// unmarked is a leak.
//
// HONEST SCOPE — this gate sees only THIS repo, so it covers the .github-local mechanical marks.
// Cross-repo README front doors (each tool's own repo) and prose judgment ("reads right to a
// visitor") are NOT gated — a green run is NOT "all SWEEP-MARKS swept". Those stay with
// SWEEP-MARKS.md + the human.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.argv[2] ?? join(fileURLToPath(new URL('.', import.meta.url)), '..');

const THAI = /[฀-๿]/;
const DATE = /20\d\d-\d\d-\d\d/;
// 'fixtures' = benchmark test PAYLOADS (e.g. CoalWash's Thai-mixed memory store,
// CoalLedger's planted-defect docs) — deliberately messy/multilingual DATA a
// scorer runs against, not front-door prose a visitor reads. English-only
// gating applies to what we SAY, never to what we TEST.
const SKIP_DIRS = new Set(['.git', '.claude', '.agents', 'node_modules', 'fixtures']);

/** Recursively collect *.md paths under `dir`, skipping VCS/dep/private dirs. */
function mdFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) mdFiles(p, acc);
    else if (name.endsWith('.md')) acc.push(p);
  }
  return acc;
}

/** Run the three checks against a repo root; returns an array of failure strings. */
export function verifyLanding(root) {
  const failures = [];
  const fail = (m) => failures.push(m);
  const rel = (f) => relative(root, f).replaceAll('\\', '/');

  // --- 1. No Thai in the visitor front doors (profile/ + benchmarks/ + root README.md) ---
  const thaiTargets = [...mdFiles(join(root, 'profile')), ...mdFiles(join(root, 'benchmarks'))];
  const rootReadme = join(root, 'README.md');
  if (existsSync(rootReadme)) thaiTargets.push(rootReadme);
  for (const f of thaiTargets) {
    const text = readFileSync(f, 'utf8');
    if (text.includes('<!-- lang-exempt')) continue; // intentional Thai, named
    text.split(/\r?\n/).forEach((line, i) => {
      if (THAI.test(line)) {
        fail(`THAI in front-door ${rel(f)}:${i + 1} — landing/benchmarks are English-only (mark intentional Thai with "<!-- lang-exempt: reason -->")`);
      }
    });
  }

  // --- 2 & 3. Every benchmark dir is listed in EVERY surface that ENUMERATES benchmarks,
  //     and carries a dated record. Enumerating surfaces = the profile table (## Benchmarks) AND
  //     the repo README's list (## Series Benchmarks). A benchmark missing from ANY of them is a
  //     SWEEP-MARKS Event-1 miss — the earlier profile-only check silently skipped README.md's
  //     "Series Benchmarks" list, which is exactly how CoalHearth/CoalFace stayed unlisted there.
  const benchDir = join(root, 'benchmarks');
  if (existsSync(benchDir)) {
    const tools = readdirSync(benchDir).filter((t) => {
      try { return statSync(join(benchDir, t)).isDirectory(); } catch { return false; }
    });
    const SURFACES = ['profile/README.md', 'README.md'];
    let enumerated = false;
    for (const relPath of SURFACES) {
      const p = join(root, relPath);
      if (!existsSync(p)) continue;
      // the "… Benchmarks" section (the "## Benchmarks" table OR "## Series Benchmarks" list) →
      // to the next "## " or EOF. Precise: require the exact heading word "Benchmarks" (plural,
      // no /i) so a future lowercase/singular "## Benchmarking notes" heading can't hijack the match.
      const sec = readFileSync(p, 'utf8').match(/##[^\n]*Benchmarks\b[\s\S]*?(?=\n##\s|$)/);
      if (!sec) continue; // this file does not enumerate benchmarks
      enumerated = true;
      for (const tool of tools) {
        if (!sec[0].includes(`**${tool}**`)) {
          fail(`benchmark '${tool}' is NOT listed in the Benchmarks section of ${relPath} (SWEEP-MARKS Event-1 enumeration miss — every enumerating surface must list every benchmark)`);
        }
      }
    }
    if (!enumerated) {
      fail('no "## … Benchmarks" section in profile/README.md or README.md (the org-landing enumeration is gone)');
    }
    for (const tool of tools) {
      const files = mdFiles(join(benchDir, tool));
      const dated = files.some((f) => DATE.test(readFileSync(f, 'utf8')));
      // A benchmark may launch RECORDLESS when its digest SAYS so — an honest,
      // named "first run pending" beats an invented date (CoalWash launched with
      // protocol + fixtures + scorer, run pending). The date rule bites the
      // moment a real record lands.
      const namedPending = files.some((f) => /first run pending/i.test(readFileSync(f, 'utf8')));
      if (!dated && !namedPending) {
        fail(`benchmark '${tool}' has NO dated record (a benchmark must carry its test date, or its digest must say "first run pending")`);
      }
    }
  }
  return failures;
}

// --- CLI entry (only when run directly, not when imported by the test) ---
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const failures = verifyLanding(ROOT);
  if (failures.length) {
    console.error(`[verify-landing] FAIL — ${failures.length} issue(s):`);
    for (const f of failures) console.error('  ✗ ' + f);
    console.error('\nScope: .github-LOCAL mechanical marks only (no-Thai · org-row · dated).');
    console.error('Cross-repo README front doors + prose judgment are NOT gated — see SWEEP-MARKS.md + the human.');
    process.exit(1);
  }
  console.log('[verify-landing] OK — no unmarked Thai in the front doors; every benchmark has an org-row + a dated record.');
  console.log('Scope note: .github-local mechanical marks only; a green run is NOT "all SWEEP-MARKS swept".');
}
