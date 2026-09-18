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
  // UMB-055 item 1 (main's Option-A-amended ruling): a private, unpublished article --
  // never GitBook-synced, cuts no public Release -- declares this with a repo-root
  // marker (ARTICLE_PRIVATE_MARKER below). CONTRIBUTING is dropped (a single-maintainer
  // private spec invites no contribution) and .gitbook.yaml is dropped (a private
  // article never carries GitBook sync files by definition, so listing it would report
  // a permanent, meaningless ABSENT). Workflows + LICENSE are UNCHANGED from the public
  // `article` row on purpose: a private spec with external references still needs
  // watch-sources.yml-shaped staleness checking (SERIES-CANON.md states why), and the
  // LICENSE law binds regardless of visibility.
  'article (private)': [
    'LICENSE', 'CHANGELOG.md',
    '.github/workflows/check.yml', '.github/workflows/watch-sources.yml',
  ],
  // UMB-060 (Articles head's ARK-042 D-6 residue, main's ruling): a PUBLIC article that
  // publishes to GitBook via a one-off CHANGE REQUEST rather than continuous git-sync --
  // it has no `.git` of its own and, BY DEFINITION, never gains `.gitbook.yaml` (that
  // file is git-sync configuration; a change-request-published room has nothing to
  // configure it with). Exhibit: Articles/GachaRateDesignDatum, which carries a real
  // LICENSE + CHANGELOG.md and its own PUBLISHING.md describing the change-request
  // flow, but neither `.git` nor `.gitbook.yaml` -- classify() returned null for it
  // (UNCLASSIFIED) with no way to say WHICH kind, exactly the gap article (private)
  // closed for the private case. `.gitbook.yaml` is dropped here for the SAME reason
  // as article (private) drops it (structurally impossible, not merely absent) --
  // but CONTRIBUTING.md and the two workflows are KEPT (unlike article (private),
  // which drops CONTRIBUTING for a different reason -- no contributors to invite): a
  // change-request room IS publicly published and DOES want contributors and
  // staleness-watching, so their absence is a real, actionable gap for that room to
  // close, never an instrument artifact to silence.
  'article (change-request)': [
    'LICENSE', 'CONTRIBUTING.md', 'CHANGELOG.md',
    '.github/workflows/check.yml', '.github/workflows/watch-sources.yml',
  ],
};

// The repo-root marker declaring a private, unpublished `article` (UMB-055 item 1).
// An empty sentinel file -- presence is the whole signal, since classify() reads only
// the filesystem, never external metadata. Named for the ONE kind it currently applies
// to (never a generic ".private" -- private-working is already private BY KIND and has
// no use for this marker, so a kind-scoped name avoids a reader wondering if it reaches
// further than it does).
export const ARTICLE_PRIVATE_MARKER = '.article-private';

// UMB-060: the repo-root marker declaring a PUBLIC article that publishes via a
// GitBook change request rather than git-sync. Same shape as ARTICLE_PRIVATE_MARKER
// above (an empty sentinel; presence is the whole signal) -- deliberately a SEPARATE
// marker, not a reuse of the private one, because the two properties are orthogonal:
// this room IS published, just not through git-sync.
export const ARTICLE_CHANGEREQUEST_MARKER = '.article-changerequest';

// UMB-062 (LLM chief r19 finding, Chotmeter): a private-working repo has no
// classify()-visible signature until it actually adopts `gate.yml` -- Chotmeter
// (real, private, has `.git`, zero `.github/workflows/`) read UNCLASSIFIED, so
// `--settings` never printed a block for it and a live drift (`allow_auto_merge`)
// was invisible until a raw REST read caught it. Decision: a repo-root marker,
// same mechanism as the two article markers above, not visibility-based
// auto-classification. Verified against the code and the live org before
// choosing, not merely trusted from the hypothesis handed down: (a) `classify()`
// is a pure, offline, filesystem-only function today (zero network, Phoenix #2) --
// basing it on GitHub's `private` field would need a REST call inside what is
// currently a synchronous local walk, or a local hint that does not exist (GitHub
// visibility is not filesystem-observable without one); (b) visibility and KIND
// are genuinely orthogonal -- CoalGob (`CoalWorks/CoalGob/`, LOCAL ONLY, no remote
// yet) is a real, present-tense counter-example: it is published-code-shaped by
// intent and will very plausibly be pushed PRIVATE at first, the way any repo
// commonly starts before going public. A visibility-based rule would misclassify
// it as private-working the moment it gains a remote, before its own `ci.yml`/
// `codeql.yml` even land. The marker never has this failure mode -- it names
// intent directly instead of inferring it from an orthogonal access-control flag.
export const PRIVATE_WORKING_MARKER = '.private-working';

// Both article variants share the PUBLIC article's own template directory -- the
// files are identical in shape; only which ones are REQUIRED differs, per the
// declared variant. There is no separate `templates/article (private)/` or
// `templates/article (change-request)/` directory.
export const TEMPLATE_DIR_FOR_KIND = {
  'published-code': 'published-code',
  'private-working': 'private-working',
  article: 'article',
  'article (private)': 'article',
  'article (change-request)': 'article',
};

const ALL_SKELETON_FILE_NAMES = [...new Set(Object.values(SKELETON_FILES).flat())];

// Classification signature per kind — the file whose presence is decisive. Checked in
// this order because article/private-working signatures are more specific than the
// published-code 5-workflow set. A folder with no matching signature returns null
// (UNCLASSIFIED) — never a guess.
export function classify(repoDir) {
  const has = (rel) => fs.existsSync(path.join(repoDir, rel));
  // Checked FIRST and unconditionally: a private, unpublished article never carries
  // GitBook sync files (no .gitbook.yaml, no SUMMARY.md) -- its own marker is the sole
  // signal, and it is the more specific claim.
  if (has(ARTICLE_PRIVATE_MARKER)) return 'article (private)';
  // UMB-060: a change-request-published article ALSO never carries .gitbook.yaml (by
  // definition, same reasoning as the private case) -- checked next, still more
  // specific than the bare .gitbook.yaml signature below.
  if (has(ARTICLE_CHANGEREQUEST_MARKER)) return 'article (change-request)';
  // UMB-062: checked before the structural gate.yml signature below -- the marker is
  // the declared signal and wins if a repo somehow carries both; a repo that has
  // ALREADY adopted gate.yml does not need the marker at all (the structural check
  // still classifies it correctly on its own, unchanged).
  if (has(PRIVATE_WORKING_MARKER)) return 'private-working';
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
// dropped. Exhibit (fixture-shaped, not a live one — see UMB-060 below for the real
// case this was first measured against): a folder carrying only a root `CHANGELOG.md`
// — one of `article`'s own skeleton files, but not a specific enough combination for
// classify() to say WHICH kind — still belongs in the report as UNCLASSIFIED, never
// silently dropped. GachaRateDesignDatum WAS this exhibit until UMB-060 gave
// change-request-published articles their own marker (`ARTICLE_CHANGEREQUEST_MARKER`
// below) — once that marker is placed on its own folder, classify() names it directly
// and it stops needing this fallback path at all.
export function hasAnyKindMarker(repoDir) {
  if (fs.existsSync(path.join(repoDir, ARTICLE_PRIVATE_MARKER))) return true;
  if (fs.existsSync(path.join(repoDir, ARTICLE_CHANGEREQUEST_MARKER))) return true;
  if (fs.existsSync(path.join(repoDir, PRIVATE_WORKING_MARKER))) return true;
  return ALL_SKELETON_FILE_NAMES.some((rel) => fs.existsSync(path.join(repoDir, rel)));
}

// Enumerates every DIRECTORY under `zonesRoot/<zone>/` (for each zone in `zones`) --
// UMB-060: every one, not only those carrying a signal. Returns { zone, name, dir,
// kind, hasSignal } rows. `hasSignal` distinguishes the two UNCLASSIFIED shapes,
// both `kind: null`, that were previously conflated:
//   - hasSignal=true, kind=null  -- a real project member (`.git` or a skeleton-file
//     marker present) that classify() honestly cannot yet name a KIND for.
//   - hasSignal=false, kind=null -- neither `.git` nor any marker at all. Formerly
//     `continue`d past in total silence (skeleton-check-lib.mjs:113-114 at the time
//     this was reported, ARK-042 D-6) -- a folder the instrument never mentioned
//     could not be distinguished from one it had correctly ruled out, from the
//     report alone. Still reported, per "silence is not none": the walk is bounded
//     to one level per zone, so this never floods the report the way a recursive
//     walk would.
export function findRepos(zonesRoot, zones) {
  const repos = [];
  for (const zone of zones) {
    const zoneDir = path.join(zonesRoot, zone);
    if (!fs.existsSync(zoneDir)) continue;
    for (const entry of fs.readdirSync(zoneDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const repoDir = path.join(zoneDir, entry.name);
      const hasGit = fs.existsSync(path.join(repoDir, '.git'));
      const hasSignal = hasGit || hasAnyKindMarker(repoDir);
      repos.push({
        zone, name: entry.name, dir: repoDir, hasSignal,
        kind: hasSignal ? classify(repoDir) : null,
      });
    }
  }
  return repos;
}
