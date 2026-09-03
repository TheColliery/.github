#!/usr/bin/env node
// Walks every live clone under the umbrella (CoalWorks/*, LLMWorks/*, Articles/* — never
// talongate, a partner workspace outside the series), classifies each by KIND from its
// own files, and reports each skeleton-owned file as identical / DIFFERS (line count) /
// absent. A DERIVING instrument only — it reports drift, it never fixes it (a DIFFERS row
// is a finding for that room's own belt, not this script's to resolve).
//
// Usage: node scripts/skeleton-check.mjs [--settings]
//   --settings: also diff each live repo's GitHub settings against templates/repo-settings.*.json
//               (not yet implemented this pass — reports N/A per repo, named not silently skipped).
//
// Zero-dependency (Phoenix #2); fail-loud CLI (scripts-quality.md §1).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const githubRepo = path.resolve(scriptDir, '..');
const umbrellaRoot = path.resolve(githubRepo, '..');
const templatesRoot = path.join(githubRepo, 'templates');

const ZONES = ['CoalWorks', 'LLMWorks', 'Articles']; // talongate deliberately excluded — not in the series

// Skeleton-owned files per kind, relative to templates/<kind>/. A room may carry more
// files than this (its own README body, its own SOURCES.md, ...) — those are not
// skeleton-owned and are out of this instrument's scope by design.
const SKELETON_FILES = {
  'published-code': [
    'LICENSE', 'NOTICE', 'SECURITY.md', 'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md', 'PRIVACY.md',
    '.gitattributes', '.gitignore', '.markdownlint.json',
    '.githooks/pre-commit', '.githooks/pre-push',
    '.github/dependabot.yml',
    '.github/workflows/ci.yml', '.github/workflows/codeql.yml',
    '.github/workflows/dependabot-auto-merge.yml', '.github/workflows/markdownlint.yml',
    '.github/workflows/scorecard.yml',
    '.github/ISSUE_TEMPLATE/bug-report.yml', '.github/ISSUE_TEMPLATE/config.yml',
  ],
  'private-working': [
    'LICENSE', '.gitignore',
    '.githooks/pre-push',
    '.github/workflows/gate.yml',
  ],
  article: [
    'LICENSE', 'CONTRIBUTING.md', 'CHANGELOG.md', '.gitbook.yaml',
    '.github/workflows/check.yml', '.github/workflows/watch-sources.yml',
  ],
};

// Classification signature per kind — the file whose presence is decisive. Checked in
// this order because article/private-working signatures are more specific than the
// published-code 5-workflow set.
function classify(repoDir) {
  const has = (rel) => fs.existsSync(path.join(repoDir, rel));
  if (has('.gitbook.yaml')) return 'article';
  if (has('.github/workflows/gate.yml') && !has('.github/workflows/ci.yml')) return 'private-working';
  if (has('.github/workflows/ci.yml') && has('.github/workflows/codeql.yml')) return 'published-code';
  return null; // unclassified — reported as such, never guessed
}

function normalizeLineEndings(buf) {
  // latin1, not utf8: a lossless byte<->char mapping, so a genuinely different byte
  // sequence never false-matches after CRLF normalization (node/runtime.md's own
  // build-dist.mjs precedent — never utf8, which maps invalid bytes to U+FFFD).
  return buf.toString('latin1').replace(/\r\n/g, '\n');
}

function compareFile(templatePath, livePath) {
  if (!fs.existsSync(livePath)) return 'ABSENT';
  const t = fs.readFileSync(templatePath);
  const l = fs.readFileSync(livePath);
  if (Buffer.compare(t, l) === 0) return 'identical';
  const tn = normalizeLineEndings(t);
  const ln = normalizeLineEndings(l);
  if (tn === ln) return 'identical (EOL-only)';
  const tLines = tn.split('\n').length;
  const lLines = ln.split('\n').length;
  return `DIFFERS (template ${tLines}L vs live ${lLines}L)`;
}

function findRepos() {
  const repos = [];
  for (const zone of ZONES) {
    const zoneDir = path.join(umbrellaRoot, zone);
    if (!fs.existsSync(zoneDir)) continue;
    for (const entry of fs.readdirSync(zoneDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const repoDir = path.join(zoneDir, entry.name);
      if (!fs.existsSync(path.join(repoDir, '.git'))) continue; // a real repo only
      repos.push({ zone, name: entry.name, dir: repoDir });
    }
  }
  return repos;
}

function main() {
  const args = process.argv.slice(2);
  const withSettings = args.includes('--settings');

  const repos = findRepos();
  console.log(`Found ${repos.length} repo(s) under ${ZONES.join(', ')}.\n`);

  let failed = 0;
  for (const repo of repos) {
    const kind = classify(repo.dir);
    console.log(`## ${repo.zone}/${repo.name} — kind: ${kind ?? 'UNCLASSIFIED'}`);
    if (!kind) {
      console.log('  (no skeleton-file table to compare — unclassified)\n');
      continue;
    }
    const files = SKELETON_FILES[kind];
    for (const rel of files) {
      const templatePath = path.join(templatesRoot, kind, rel);
      const livePath = path.join(repo.dir, rel);
      if (!fs.existsSync(templatePath)) {
        console.log(`  ${rel}: (not in this pass's skeleton — skip)`);
        continue;
      }
      try {
        const verdict = compareFile(templatePath, livePath);
        console.log(`  ${rel}: ${verdict}`);
      } catch (e) {
        console.log(`  ${rel}: FAIL comparing (${e.message})`);
        failed++;
      }
    }
    if (withSettings) {
      console.log('  [settings]: N/A — --settings mode not yet implemented this pass');
    }
    console.log('');
  }

  // Also diff the three GitHub template repos (fresh clone) against their source dirs,
  // per UMB-045 step 6 — only if they exist as local clones alongside this repo.
  for (const kind of Object.keys(SKELETON_FILES)) {
    const templateRepoDir = path.join(umbrellaRoot, `template-${kind}`);
    if (!fs.existsSync(path.join(templateRepoDir, '.git'))) continue;
    console.log(`## template-${kind} (GitHub template repo, local clone) vs templates/${kind}/`);
    for (const rel of SKELETON_FILES[kind]) {
      const templatePath = path.join(templatesRoot, kind, rel);
      const clonePath = path.join(templateRepoDir, rel);
      if (!fs.existsSync(templatePath)) continue;
      try {
        console.log(`  ${rel}: ${compareFile(templatePath, clonePath)}`);
      } catch (e) {
        console.log(`  ${rel}: FAIL comparing (${e.message})`);
        failed++;
      }
    }
    console.log('');
  }

  if (failed > 0) {
    console.error(`FAIL: ${failed} comparison(s) errored (not the same as DIFFERS — an actual read/compare failure).`);
    process.exitCode = 1;
  }
}

main();
