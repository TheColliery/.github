#!/usr/bin/env node
// doc-refs.mjs — UMB-057: a doc→file MARKDOWN LINK that points nowhere (the pointer-not-key
// shape named in CoalWorks' CWK-075: "the gate that would catch it resolves POINTERS, paths
// in comments/docs, not KEYS" — a bare filename mentioned as an illustrative convention name,
// e.g. "every published-code repo ships `ci.yml`", is a KEY and is deliberately NOT checked;
// only an actual `[text](path)` link — the one shape a reader can click, and the one shape
// GitHub itself resolves against this repo — is a real claim this gate can verify).
//
// Scope: every `*.md` at this repo's root, plus `profile/*.md` (glob-derived, never a
// hardcoded file list — a new doc file is swept automatically, closing the class of
// enumeration drift this org has hit before). Fenced code blocks and inline code spans that
// wrap an ENTIRE `[text](target)`-looking sequence are excluded — those are illustrative
// markdown-syntax examples (e.g. `` `[Name](url) — role` `` in a how-to-write-this bullet),
// never real links; a real link's own backticks (if any) sit INSIDE the brackets
// (`` [`templates/`](templates) ``), not wrapping the whole construct.
//
// Fail-loud CLI discipline (scripts-quality.md §1): every dangling reference is an
// enumerated `FAIL` line, a summary line always prints, non-zero exit on any finding.
// Node builtins only at the top level (node/runtime.md §1) — this gate has no local lib.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Root override (process.argv[2]) exists ONLY so the hermetic spawn test can point this
// gate at a sandboxed scratch tree instead of the real repo — CI never passes it, and the
// default is always this file's own repo root.
const ROOT = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const LINK = /\[([^\]]*)\]\(([^)]+)\)/g;
const CODE_SPAN = /`[^`]+`/g;

function stripFences(text) {
  // Preserve line count so reported line numbers stay accurate.
  return text.replace(/```[\s\S]*?```/g, (m) => '\n'.repeat((m.match(/\n/g) || []).length));
}

function codeSpanRanges(line) {
  const ranges = [];
  let m;
  CODE_SPAN.lastIndex = 0;
  while ((m = CODE_SPAN.exec(line))) ranges.push([m.index, m.index + m[0].length]);
  return ranges;
}

function fullyInsideACodeSpan(start, end, ranges) {
  return ranges.some(([s, e]) => start >= s && end <= e);
}

function docFiles() {
  const root = fs.readdirSync(ROOT).filter((f) => f.toLowerCase().endsWith('.md'));
  const files = root.map((f) => f);
  const profileDir = path.join(ROOT, 'profile');
  if (fs.existsSync(profileDir) && fs.statSync(profileDir).isDirectory()) {
    for (const f of fs.readdirSync(profileDir)) {
      if (f.toLowerCase().endsWith('.md')) files.push(path.join('profile', f));
    }
  }
  return files.sort();
}

function findDanglingRefs(relFile) {
  const abs = path.join(ROOT, relFile);
  const raw = fs.readFileSync(abs, 'utf8');
  const text = stripFences(raw);
  const dir = path.dirname(abs);
  const lines = text.split('\n');
  const dangling = [];
  lines.forEach((line, idx) => {
    const ranges = codeSpanRanges(line);
    let m;
    LINK.lastIndex = 0;
    while ((m = LINK.exec(line))) {
      const start = m.index;
      const end = start + m[0].length;
      if (fullyInsideACodeSpan(start, end, ranges)) continue;
      let target = m[2].trim().split(/\s+"/)[0];
      if (/^(https?:|mailto:|#)/i.test(target)) continue;
      const [pathPart] = target.split('#');
      if (!pathPart) continue;
      const targetAbs = path.resolve(dir, pathPart);
      if (!fs.existsSync(targetAbs)) {
        dangling.push({ line: idx + 1, target, targetAbs });
      }
    }
  });
  return dangling;
}

function main() {
  const files = docFiles();
  console.log(`[doc-refs] scanning ${files.length} doc file(s) for dangling links...\n`);

  let totalFindings = 0;
  for (const relFile of files) {
    const dangling = findDanglingRefs(relFile);
    for (const d of dangling) {
      totalFindings++;
      console.error(`FAIL ${relFile}:${d.line}: dangling link '${d.target}' -> ${d.targetAbs}`);
    }
  }

  console.log(
    `\n[doc-refs] Done: ${files.length} file(s) scanned, ${totalFindings} dangling link(s).`,
  );

  if (totalFindings > 0) process.exitCode = 1;
}

main();
