// skeleton-check-lib.mjs — pure repo-discovery + classification logic for
// skeleton-check.mjs, split out for unit testing (UMB-054 item 1's red-first test).
// No network, no file-comparison — just "what repos exist under these zone dirs, and
// what kind (if any) is each one." skeleton-check.mjs is a plain CLI tool, not a GATE
// under node/runtime.md §1's scope (no enumerate-and-report contract needing dynamic
// lib imports) — this file is imported statically, top-level, by design.

import fs from 'fs';
import path from 'path';

// Skeleton-owned files per kind, relative to templates/<kind>/. A room may carry more
// files than this (its own README body, its own SOURCES.md, ...) — those are not
// skeleton-owned and are out of this instrument's scope by design.
export const SKELETON_FILES = {
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

const ALL_SKELETON_FILE_NAMES = [...new Set(Object.values(SKELETON_FILES).flat())];

// Classification signature per kind — the file whose presence is decisive. Checked in
// this order because article/private-working signatures are more specific than the
// published-code 5-workflow set. A folder with no matching signature returns null
// (UNCLASSIFIED) — never a guess.
export function classify(repoDir) {
  const has = (rel) => fs.existsSync(path.join(repoDir, rel));
  if (has('.gitbook.yaml')) return 'article';
  if (has('.github/workflows/gate.yml') && !has('.github/workflows/ci.yml')) return 'private-working';
  if (has('.github/workflows/ci.yml') && has('.github/workflows/codeql.yml')) return 'published-code';
  return null;
}

// UMB-054 item 1: a repo is ENUMERATED when it carries a real `.git` OR at least one
// file from ANY kind's own skeleton — a kind's own spine files are the marker, `.git`
// is one signal among these, never the sole gate. Deliberately broader than classify()'s
// strict per-kind SIGNATURE test: a folder can carry a generic marker (a CHANGELOG.md)
// without carrying the specific combination classify() needs to name WHICH kind it is —
// that folder still belongs in the report, as UNCLASSIFIED, rather than silently
// dropped. Exhibit: GachaRateDesignDatum, a GitBook-change-request-published article
// with no `.git` of its own and none of `article`'s classify() signature files either
// (it does not Git-Sync, so it never gained `.gitbook.yaml`/`SUMMARY.md`) — but it does
// carry a root `CHANGELOG.md`, one of `article`'s own skeleton files, which is enough
// to say "this folder is a kind-object the instrument should look at," even though
// classify() honestly cannot yet say which kind.
export function hasAnyKindMarker(repoDir) {
  return ALL_SKELETON_FILE_NAMES.some((rel) => fs.existsSync(path.join(repoDir, rel)));
}

// Enumerates every directory under `zonesRoot/<zone>/` (for each zone in `zones`) that
// passes the enumeration test above. Returns { zone, name, dir, kind } rows — `kind` may
// be null (UNCLASSIFIED), which is a legitimate, reported state, never a silent drop.
export function findRepos(zonesRoot, zones) {
  const repos = [];
  for (const zone of zones) {
    const zoneDir = path.join(zonesRoot, zone);
    if (!fs.existsSync(zoneDir)) continue;
    for (const entry of fs.readdirSync(zoneDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const repoDir = path.join(zoneDir, entry.name);
      const hasGit = fs.existsSync(path.join(repoDir, '.git'));
      if (!hasGit && !hasAnyKindMarker(repoDir)) continue; // neither signal fired
      repos.push({ zone, name: entry.name, dir: repoDir, kind: classify(repoDir) });
    }
  }
  return repos;
}
