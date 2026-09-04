#!/usr/bin/env node
// Walks every live clone under the umbrella (CoalWorks/*, LLMWorks/*, Articles/* — never
// talongate, a partner workspace outside the series), classifies each by KIND from its
// own files, and reports each skeleton-owned file as identical / DIFFERS (line count) /
// absent. A DERIVING instrument only — it reports drift, it never fixes it (a DIFFERS row
// is a finding for that room's own belt, not this script's to resolve).
//
// ENUMERATION (UMB-054 item 1): a directory is walked when it carries a real `.git` OR at
// least one file from any kind's own skeleton (SKELETON_FILES, lib/skeleton-check-lib.mjs)
// — `.git` is one signal among these, never the sole gate. A folder published by a
// non-git mechanism (a GitBook change request, e.g.) still belongs in the report; see
// lib/skeleton-check-lib.mjs's own `hasAnyKindMarker` for the mechanism + exhibit.
//
// Usage: node scripts/skeleton-check.mjs [--settings] [--clone <kind>=<path> ...]
//   --settings: also diff each live repo's GitHub settings against templates/repo-settings.*.json
//               via REST GET calls (needs GITHUB_TOKEN in the environment; SKIPs, does not
//               fail, when it is absent — an unset token is an expected local condition).
//   --clone <kind>=<path>: an explicit local clone path for one of the three GitHub template
//               repos (published-code/private-working/article), diffed against templates/<kind>/
//               the same way a live room is. Repeatable, one per kind. Replaces the old
//               hardcoded "<umbrellaRoot>/template-<kind>" guess (UMB-045's own named gap,
//               closed here per UMB-048 item 3) — omit a kind to skip its template-repo section.
//
// Zero-dependency (Phoenix #2); fail-loud CLI (scripts-quality.md §1).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { findRepos as findReposLib, SKELETON_FILES, TEMPLATE_DIR_FOR_KIND } from './lib/skeleton-check-lib.mjs';
import { isLicenseStub } from './lib/license-check-lib.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const githubRepo = path.resolve(scriptDir, '..');
const umbrellaRoot = path.resolve(githubRepo, '..');
const templatesRoot = path.join(githubRepo, 'templates');

const ZONES = ['CoalWorks', 'LLMWorks', 'Articles']; // talongate deliberately excluded — not in the series

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

// --settings support ------------------------------------------------------------------

const GITHUB_API = 'https://api.github.com';

// Reads .git/config directly (no shell-out to git, no npm dep) and pulls owner/repo out
// of origin's URL in either https or ssh form. Returns null if origin is missing/unparseable
// — a settings check has nothing to GET without it, reported as SKIP, never guessed.
function getOwnerRepo(repoDir) {
  const cfgPath = path.join(repoDir, '.git', 'config');
  if (!fs.existsSync(cfgPath)) return null;
  const cfg = fs.readFileSync(cfgPath, 'utf8');
  const originBlock = cfg.match(/\[remote "origin"\][^[]*/);
  if (!originBlock) return null;
  const urlMatch = originBlock[0].match(/url\s*=\s*(\S+)/);
  if (!urlMatch) return null;
  const url = urlMatch[1];
  // https://github.com/OWNER/REPO(.git) or git@github.com:OWNER/REPO(.git)
  const m = url.match(/github\.com[:/]([^/]+)\/([^/.]+?)(?:\.git)?$/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

async function ghGet(token, urlPath) {
  const res = await fetch(GITHUB_API + urlPath, {
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json' },
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, ok: res.ok, json };
}

// Compares one non-N/A settings entry's fields against the live GET response and prints
// identical/DIFFERS lines. `expected` is a plain object of key->value to check against
// `actual` (also a plain object) — used for repoPatch and actionsWorkflowToken, whose
// shape is "several keys on one response object."
function diffFields(label, expected, actual) {
  for (const [key, want] of Object.entries(expected)) {
    const got = actual ? actual[key] : undefined;
    const verdict = got === want ? 'identical' : `DIFFERS (want ${JSON.stringify(want)}, live ${JSON.stringify(got)})`;
    console.log(`    ${label}.${key}: ${verdict}`);
  }
}

async function diffSettings(kind, ownerRepo, settingsPath) {
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.log('  [settings]: SKIP (GITHUB_TOKEN not set in the environment)');
    return;
  }
  const { owner, repo } = ownerRepo;
  const base = `/repos/${owner}/${repo}`;
  console.log(`  [settings] vs templates/repo-settings.${kind}.json:`);

  const repoRes = await ghGet(token, base);
  if (settings.repoPatch) diffFields('repoPatch', settings.repoPatch, repoRes.json);

  if (settings.secretScanning?.status === 'n/a') {
    console.log(`    secretScanning: N/A (${settings.secretScanning.reason})`);
  } else if (settings.secretScanning) {
    const live = repoRes.json?.security_and_analysis?.secret_scanning?.status;
    console.log(`    secretScanning: ${live === settings.secretScanning.status ? 'identical' : `DIFFERS (want ${settings.secretScanning.status}, live ${live})`}`);
  }

  if (settings.vulnerabilityAlerts?.enable) {
    const r = await ghGet(token, `${base}/vulnerability-alerts`);
    console.log(`    vulnerabilityAlerts: ${r.status === 204 ? 'identical (enabled)' : `DIFFERS (HTTP ${r.status}, expected 204 enabled)`}`);
  }

  if (settings.privateVulnerabilityReporting?.status === 'n/a') {
    console.log(`    privateVulnerabilityReporting: N/A (${settings.privateVulnerabilityReporting.reason})`);
  } else if (settings.privateVulnerabilityReporting?.enable) {
    // Unlike vulnerability-alerts (204/404), this endpoint returns 200 with a JSON body
    // {"enabled": bool} — confirmed live 2026-09-03 (a 200/enabled:false reply on a repo
    // where the feature was never turned on, not a 404).
    const r = await ghGet(token, `${base}/private-vulnerability-reporting`);
    const enabled = r.json?.enabled === true;
    console.log(`    privateVulnerabilityReporting: ${enabled ? 'identical (enabled)' : `DIFFERS (HTTP ${r.status}, body ${JSON.stringify(r.json)})`}`);
  }

  if (settings.actionsWorkflowToken) {
    const r = await ghGet(token, `${base}/actions/permissions/workflow`);
    diffFields('actionsWorkflowToken', settings.actionsWorkflowToken, r.json);
  }

  if (settings.ruleset?.status === 'n/a') {
    console.log(`    ruleset: N/A (${settings.ruleset.reason})`);
  } else if (settings.ruleset?.name) {
    const r = await ghGet(token, `${base}/rulesets`);
    const found = Array.isArray(r.json) && r.json.some((rs) => rs.name === settings.ruleset.name && rs.enforcement === 'active');
    console.log(`    ruleset "${settings.ruleset.name}": ${found ? 'identical (present, active)' : 'DIFFERS (not found active)'}`);
  }
}

// Parses repeated "--clone kind=path" pairs into a Map<kind, path>.
function parseCloneArgs(argv) {
  const clones = new Map();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== '--clone') continue;
    const pair = argv[i + 1] || '';
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    clones.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
  return clones;
}

async function main() {
  const args = process.argv.slice(2);
  const withSettings = args.includes('--settings');
  const clones = parseCloneArgs(args);

  const repos = findReposLib(umbrellaRoot, ZONES);
  console.log(`Found ${repos.length} repo(s) under ${ZONES.join(', ')}.\n`);

  let failed = 0;
  for (const repo of repos) {
    const kind = repo.kind;
    console.log(`## ${repo.zone}/${repo.name} — kind: ${kind ?? 'UNCLASSIFIED'}`);
    if (!kind) {
      console.log('  (no skeleton-file table to compare — unclassified)\n');
      continue;
    }
    const files = SKELETON_FILES[kind];
    const templateDir = TEMPLATE_DIR_FOR_KIND[kind];
    for (const rel of files) {
      const templatePath = path.join(templatesRoot, templateDir, rel);
      const livePath = path.join(repo.dir, rel);
      if (!fs.existsSync(templatePath)) {
        console.log(`  ${rel}: (not in this pass's skeleton — skip)`);
        continue;
      }
      try {
        const verdict = compareFile(templatePath, livePath);
        console.log(`  ${rel}: ${verdict}`);
        // UMB-054 item 3: the owner's standing law is LICENSE = full text per part,
        // never SPDX-only, never a stub -- checked independently of the template diff
        // above (a live LICENSE identical to a STUB template is exactly the failure
        // this refuses, which `compareFile`'s identical/DIFFERS verdict alone cannot
        // say). REFUSES: counted into `failed` so the run exits non-zero.
        if (rel === 'LICENSE' && fs.existsSync(livePath)) {
          const liveContent = fs.readFileSync(livePath, 'utf8');
          if (isLicenseStub(liveContent)) {
            console.log('  LICENSE: STUB (a name/URL pointer, not the licence\'s own text -- replace with a full licence body)');
            failed++;
          }
        }
      } catch (e) {
        console.log(`  ${rel}: FAIL comparing (${e.message})`);
        failed++;
      }
    }
    if (withSettings) {
      const settingsPath = path.join(templatesRoot, `repo-settings.${kind}.json`);
      if (!fs.existsSync(settingsPath)) {
        console.log(`  [settings]: N/A — no repo-settings.${kind}.json in templates/`);
      } else {
        const ownerRepo = getOwnerRepo(repo.dir);
        if (!ownerRepo) {
          console.log('  [settings]: SKIP (no parseable "origin" remote in .git/config)');
        } else {
          try {
            await diffSettings(kind, ownerRepo, settingsPath);
          } catch (e) {
            console.log(`  [settings]: FAIL (${e.message})`);
            failed++;
          }
        }
      }
    }
    console.log('');
  }

  // Also diff the three GitHub template repos against their source dirs, per UMB-045 step 6
  // — only for a kind an explicit `--clone kind=path` named (UMB-048 item 3: no more guessing
  // "<umbrellaRoot>/template-<kind>" — the caller states where each template repo is cloned).
  // Iterates the three REAL template directories only (never `article (private)` -- there
  // is no separate GitHub template repo for it; TEMPLATE_DIR_FOR_KIND's own values are
  // exactly the three real dirs, deduped).
  for (const kind of new Set(Object.values(TEMPLATE_DIR_FOR_KIND))) {
    const templateRepoDir = clones.get(kind);
    if (!templateRepoDir) continue;
    if (!fs.existsSync(path.join(templateRepoDir, '.git'))) {
      console.log(`## template-${kind}: --clone path ${templateRepoDir} has no .git — skipped\n`);
      continue;
    }
    console.log(`## template-${kind} (GitHub template repo, local clone at ${templateRepoDir}) vs templates/${kind}/`);
    for (const rel of SKELETON_FILES[kind]) {
      const templatePath = path.join(templatesRoot, kind, rel);
      const clonePath = path.join(templateRepoDir, rel);
      if (!fs.existsSync(templatePath)) continue;
      try {
        console.log(`  ${rel}: ${compareFile(templatePath, clonePath)}`);
        if (rel === 'LICENSE' && fs.existsSync(clonePath)) {
          const cloneContent = fs.readFileSync(clonePath, 'utf8');
          if (isLicenseStub(cloneContent)) {
            console.log('  LICENSE: STUB (a name/URL pointer, not the licence\'s own text -- replace with a full licence body)');
            failed++;
          }
        }
      } catch (e) {
        console.log(`  ${rel}: FAIL comparing (${e.message})`);
        failed++;
      }
    }
    console.log('');
  }

  if (failed > 0) {
    // `failed` aggregates three distinct classes (a read/compare error, a LICENSE
    // stub, a --settings mismatch) -- see the per-item lines above for which one(s)
    // fired; the old wording named only the first class and misdescribed a run whose
    // sole issue was a LICENSE stub or a settings FAIL as "an actual read/compare
    // failure" (self-caught, UMB-054 item 3's own rot-canary pass).
    console.error(`FAIL: ${failed} issue(s) found — a read/compare error, a LICENSE stub, or a --settings mismatch (see the lines above for which).`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(`FAIL: ${e.message}`);
  process.exitCode = 1;
});
