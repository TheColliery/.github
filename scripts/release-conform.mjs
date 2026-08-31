#!/usr/bin/env node
// release-conform.mjs — the R8 machine (task-37 audit, board #9): RELEASE-PATTERN.md had
// zero enforcement anywhere in the tree until this file. Reads every repo's PUBLISHED
// GitHub Releases (unauthenticated, public, GET only) and checks the MECHANICAL half of
// the pattern only: title shape (bare-version, repo-prefix, separator), prerelease===false
// on a published Release, body non-empty, emoji-in-heading. Lead quality, CHANGELOG 1:1
// fidelity, and honest framing stay a human call — never scored here.
//
// Zero-dep (Phoenix #2): fetch is a Node builtin global, no import needed. AUTH IS OPTIONAL
// (amended 2026-08-31, CWK-036 blocker): a GITHUB_TOKEN in the environment is USED when
// present (Bearer header) and the script degrades to unauthenticated reads when absent —
// never required, never embedded, never written anywhere (no-external-assumption). Why the
// amendment: the anonymous cap is 60 req/hr per IP, and a whole-flock release-body sweep
// (~192 releases + per-head re-runs) is precisely the workload that exhausts it — every
// belt head hit 403 and the gate became unrunnable for the one job it exists to gate.
//
// Fail-loud CLI discipline (scripts-quality.md §1): non-zero exit on any finding, one repo's
// failure never kills the run, enumerated FAIL lines, never a raw stack trace.
//
// Report-only: this script never opens or edits a Release. Findings are printed; nothing
// is fixed by this run (task-37 R8 scope).

import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// The 8 org repos as of 2026-08 (MEMORY.md "GitHub / org facts"). CoalMine still sits at
// HetCreep/CoalMine pending the marketplace-review transfer; the rest are under TheColliery.
const REPOS = [
  { owner: 'HetCreep', repo: 'CoalMine' },
  { owner: 'TheColliery', repo: 'CoalTipple' },
  { owner: 'TheColliery', repo: 'CoalBoard' },
  { owner: 'TheColliery', repo: 'CoalHearth' },
  { owner: 'TheColliery', repo: 'CoalFace' },
  { owner: 'TheColliery', repo: 'CoalWash' },
  { owner: 'TheColliery', repo: 'CoalLedger' },
  { owner: 'TheColliery', repo: '.github' },
];

async function fetchReleases(owner, repo) {
  const headers = {
    'User-Agent': 'TheColliery-release-conform',
    Accept: 'application/vnd.github+json',
  };
  // Optional auth (2026-08-31): lifts the 60/hr anonymous cap to the authenticated one.
  // Env-only, never logged, never persisted; absent = the original unauthenticated read.
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=100`, {
    headers,
  });
  if (!res.ok) throw new Error(`GET /releases → HTTP ${res.status}${res.status === 403 && !process.env.GITHUB_TOKEN ? ' (anonymous rate cap? set GITHUB_TOKEN — optional, lifts it)' : ''}`);
  return res.json();
}

async function main() {
  // node/runtime.md §1: a gate entry imports node builtins only at top level; the local
  // lib import is dynamic, inside the try, so a missing/corrupt lib produces a FAIL line
  // instead of an uncaught ERR_MODULE_NOT_FOUND stack trace with zero output.
  let checkRelease;
  try {
    const lib = await import(pathToFileURL(path.join(HERE, 'lib', 'release-conform-lib.mjs')).href);
    checkRelease = lib.checkRelease;
  } catch (e) {
    console.error(`[release-conform] FAIL: cannot load lib/release-conform-lib.mjs: ${e.message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`[release-conform] checking ${REPOS.length} repos (unauthenticated, public reads only)...\n`);

  let totalFindings = 0;
  let publishedCount = 0;
  let failedRepos = 0;

  for (const { owner, repo } of REPOS) {
    try {
      const releases = await fetchReleases(owner, repo);
      const published = releases.filter((r) => !r.draft);
      console.log(`${owner}/${repo} — ${releases.length} release(s), ${published.length} published`);
      for (const release of published) {
        publishedCount++;
        const findings = checkRelease(release, repo);
        if (findings.length === 0) {
          console.log(`  ✓ ${release.tag_name}`);
        } else {
          for (const f of findings) {
            console.error(`  ✗ ${release.tag_name}: ${f}`);
            totalFindings++;
          }
        }
      }
    } catch (e) {
      console.error(`FAIL ${owner}/${repo}: ${e.message}`);
      failedRepos++;
      process.exitCode = 1;
    }
  }

  console.log(
    `\n[release-conform] Done: ${REPOS.length - failedRepos}/${REPOS.length} repo(s) checked, ` +
    `${publishedCount} published release(s), ${totalFindings} finding(s).`,
  );
  console.log('Report-only — nothing was fixed. Mechanical checks only; lead quality, CHANGELOG');
  console.log('1:1 fidelity, and honest framing stay a human review call.');

  if (totalFindings > 0 || failedRepos > 0) process.exitCode = 1;
}

main();
