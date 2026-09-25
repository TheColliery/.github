#!/usr/bin/env node
// Walks every live clone under the umbrella (CoalWorks/*, LLMWorks/*, Articles/* — never
// talongate, a partner workspace outside the series), classifies each by KIND from its
// own files, and reports each skeleton-owned file as identical / DIFFERS (line count) /
// absent (an ORG-DEFAULT file -- CODE_OF_CONDUCT, the PR template -- reads "inherits the org
// default" when absent and NAMED DIVERGENCE when it differs, UMB-177; a change-request article with no git
// remote reads its two workflows N/A, since they could never run, UMB-226). A DERIVING instrument only — it reports drift, it never fixes it (a DIFFERS row
// is a finding for that room's own belt, not this script's to resolve).
//
// ENUMERATION (UMB-054 item 1): a directory is walked when it carries a real `.git` OR at
// least one file from any kind's own skeleton (SKELETON_FILES, lib/skeleton-check-lib.mjs)
// — `.git` is one signal among these, never the sole gate. A folder published by a
// non-git mechanism (a GitBook change request, e.g.) still belongs in the report; see
// lib/skeleton-check-lib.mjs's own `hasAnyKindMarker` for the mechanism + exhibit.
//
// Usage: node scripts/skeleton-check.mjs [--settings] [--clone <kind>=<path> ...]
//        node scripts/skeleton-check.mjs --details
//   --settings: also diff each live repo's GitHub settings against templates/repo-settings.*.json
//               via REST GET calls (needs GITHUB_TOKEN in the environment; SKIPs, does not
//               fail, when it is absent — an unset token is an expected local condition). For a
//               published-code repo it also judges the gate ruleset's bypass_actors against the
//               canon value (lib/ruleset-match.mjs GATE_RULESET_BYPASS, from SWEEP-MARKS.md -- UMB-131).
//               It also judges main-guard and tag-immutable against the spec's rules AND its EMPTY
//               bypass list, and lists a disabled GitHub-created Copilot-review leftover (rulesets
//               canon, 2026-09-24).
//   --details:  its OWN mode (no local walk): one table of every repo in the org -- About description,
//               website, topics, visibility -- diffed against DOC-PATTERN.md §Repo details, a FAIL line
//               per gap, exit 1 on any FAIL (UMB-128). READ-ONLY at the API: it never writes a value --
//               a room's reviewer holds its own About. Needs GITHUB_TOKEN (without it the private repos
//               would silently vanish from the table, so its absence FAILS instead of skipping).
//   --clone <kind>=<path>: an explicit local clone path for one of the three GitHub template
//               repos (published-code/private-working/article), diffed against templates/<kind>/
//               like a live room, EXCEPT that a template repo keeps the source's {{TOKEN}} slots
//               (a file differing only in those slots reads "expected", and the licence-identity
//               check skips a {{TOKEN}} badge/NOTICE value -- UMB-123). Repeatable, one per kind. Replaces the old
//               hardcoded "<umbrellaRoot>/template-<kind>" guess (UMB-045's own named gap,
//               closed here per UMB-048 item 3) — omit a kind to skip its template-repo section.
//
// Zero-dependency (Phoenix #2); fail-loud CLI (scripts-quality.md §1).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { findRepos as findReposLib, SKELETON_FILES, TEMPLATE_DIR_FOR_KIND, parseGithubOrigin, matchesWithPlaceholders, formatDetailsTable, liveFileVerdict, gitRemoteState, noRemoteVerdict } from './lib/skeleton-check-lib.mjs';
import { isLicenseStub, licenseIdentityMismatches } from './lib/license-check-lib.mjs';
import { rulesetMatchesSpec, gateBypassVerdicts, leftoverRulesets } from './lib/ruleset-match.mjs';

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

// Reads a repo's README.md/NOTICE (either may be absent) and delegates the actual
// comparison to license-check-lib.mjs's pure licenseIdentityMismatches (UMB-058) --
// the fs access lives here, at the gate; the comparison logic lives in the lib,
// where it is directly unit-testable with inline fixtures.
function checkLicenseIdentity(repoDir, licenseContent, opts) {
  const readmePath = path.join(repoDir, 'README.md');
  const readme = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, 'utf8') : '';
  const noticePath = path.join(repoDir, 'NOTICE');
  const notice = fs.existsSync(noticePath) ? fs.readFileSync(noticePath, 'utf8') : '';
  return licenseIdentityMismatches(licenseContent, readme, notice, opts);
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

// A GitHub TEMPLATE repo keeps the source's `{{TOKEN}}` slots (or fills them: NOTICE reads
// "licensed under the Apache License, Version 2.0."), so a byte compare would call that
// drift forever. Only for a template-repo clone -- a real room is compared exactly.
function compareTemplateRepoFile(templatePath, livePath) {
  const base = compareFile(templatePath, livePath);
  if (!base.startsWith('DIFFERS')) return base;
  const template = fs.readFileSync(templatePath, 'utf8');
  if (!/\{\{[A-Z0-9_]+\}\}/.test(template)) return base;
  return matchesWithPlaceholders(template, fs.readFileSync(livePath, 'utf8'))
    ? 'expected (only {{TOKEN}} slots differ, by design in a template repo)'
    : base;
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
  // https://github.com/OWNER/REPO(.git) or git@github.com:OWNER/REPO(.git). The pair goes
  // into an API request path with the token attached, so it is allowlist-parsed in the lib.
  return parseGithubOrigin(urlMatch[1]);
}

async function ghGet(token, urlPath) {
  const res = await fetch(GITHUB_API + urlPath, {
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json' },
  });
  let json = null;
  try { json = await res.json(); } catch {} // a body-less/non-JSON reply is not an error: status + ok still come from the HTTP response
  return { status: res.status, ok: res.ok, json, link: res.headers.get('link') };
}

// --details support (UMB-128) ---------------------------------------------------------

const DETAILS_ORG = 'TheColliery';
const DETAILS_MAX_PAGES = 10; // 1,000 repos; more than that is a loud FAIL, never a silently partial table

// Every repo of the org, private ones included (the token decides), following the Link header.
async function fetchOrgRepos(token) {
  const first = `/orgs/${DETAILS_ORG}/repos?per_page=100&type=all`;
  const repos = [];
  let next = first;
  for (let page = 0; next && page < DETAILS_MAX_PAGES; page++) {
    const r = await ghGet(token, next);
    if (!r.ok || !Array.isArray(r.json)) throw new Error(`GET ${next} -> HTTP ${r.status}`);
    repos.push(...r.json);
    // The next URL is response data that gets the token attached: pin it to this org's list endpoint.
    const m = (r.link || '').match(/<https:\/\/api\.github\.com(\/orgs\/TheColliery\/repos\?[^>]+)>;\s*rel="next"/);
    next = m ? m[1] : null;
  }
  if (next) throw new Error(`the org has more than ${DETAILS_MAX_PAGES} pages of repos -- the details table would be partial`);
  return repos;
}

async function runDetails() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('FAIL: --details needs GITHUB_TOKEN in the environment (without it the private repos are absent from the table).');
    process.exitCode = 1;
    return;
  }
  const { table, fails, summary } = formatDetailsTable(await fetchOrgRepos(token));
  console.log(`Repo details (DOC-PATTERN.md §Repo details) -- every repo of ${DETAILS_ORG}:\n`);
  for (const line of table) console.log(line);
  console.log('');
  for (const line of fails) console.log(line);
  if (fails.length) console.log('');
  console.log(summary);
  if (fails.length) process.exitCode = 1;
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
  // A failed read is a FAIL, never ordinary drift: with a 403/404/5xx every per-field line below
  // would be judged against an empty body (UMB-112 row 22, CodeRabbit).
  if (!repoRes.ok) throw new Error(`GET ${base} -> HTTP ${repoRes.status}`);
  if (settings.repoPatch) diffFields('repoPatch', settings.repoPatch, repoRes.json);

  // UMB-062: allow_auto_merge lived inside repoPatch until this unit -- a free-org
  // PRIVATE repo silently ignores the field (PATCH returns 200, GET reads back
  // false), so comparing it there reported a permanent, unclosable DIFFERS. Printed
  // as its own explicit N/A line, the same shape as secretScanning/
  // privateVulnerabilityReporting below -- never silently dropped from the report.
  if (settings.allowAutoMerge?.status === 'n/a') {
    console.log(`    allowAutoMerge: N/A (${settings.allowAutoMerge.reason})`);
  }

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
    if (settings.tagRuleset?.status === 'n/a') console.log(`    tagRuleset: N/A (${settings.tagRuleset.reason})`);
  } else if (settings.ruleset?.name) {
    // CWK-069 (the CoalWorks chief's own instrument ruling): matched by RULES, never by
    // NAME. A room commonly already carries an active branch ruleset enforcing the same
    // rules under a name of its own choosing (its own CI-required ruleset, say) -- a
    // name-only compare reported that room as "missing main-guard" when it was already
    // fully covered. The list endpoint returns no `rules` array; each active
    // ruleset is re-fetched for its own detail before comparing.
    //
    // Rulesets canon (owner 2026-09-24): the spec's bypass list is EMPTY and is judged too -- an
    // active ruleset that covers the same rules but lets an admin bypass it (the Coal* rooms'
    // original main-guard) reads as DIFFERS, never as covered.
    const wantedTypes = (settings.ruleset.rules || []).map((rule) => rule.type);
    const list = await ghGet(token, `${base}/rulesets`);
    const details = [];
    for (const c of Array.isArray(list.json) ? list.json : []) {
      const d = await ghGet(token, `${base}/rulesets/${c.id}`);
      if (d.json) details.push(d.json);
    }
    const defaultBranch = repoRes.json?.default_branch;
    const covered = details.some((rs) => rulesetMatchesSpec(rs, settings.ruleset, defaultBranch));
    const coveredButBypassed = !covered && details.some((rs) => rulesetMatchesSpec({ ...rs, bypass_actors: [] }, settings.ruleset, defaultBranch));
    console.log(`    ruleset (rules: ${wantedTypes.join('+')}, empty bypass): ${covered ? 'identical (covered by an existing active ruleset, matched by rules and an empty bypass list -- not necessarily named "' + settings.ruleset.name + '")' : coveredButBypassed ? 'DIFFERS (an active ruleset covers ' + wantedTypes.join('+') + ' but its bypass list is not empty -- the canon removes every bypass)' : `DIFFERS (no active branch ruleset on the default branch covers ${wantedTypes.join('+')})`}`);
    if (settings.tagRuleset?.status === 'n/a') console.log(`    tagRuleset: N/A (${settings.tagRuleset.reason})`);
    else if (settings.tagRuleset?.name) {
      const tagWanted = settings.tagRuleset.rules.map((rule) => rule.type).join('+');
      const tagOk = details.some((rs) => rulesetMatchesSpec(rs, settings.tagRuleset));
      console.log(`    tagRuleset (rules: ${tagWanted}, refs: ${settings.tagRuleset.conditions.ref_name.include.join(',')}, empty bypass): ${tagOk ? 'identical' : 'DIFFERS (no active tag ruleset covers it)'}`);
    }
    for (const rs of leftoverRulesets(details, settings.leftoverRulesets)) console.log(`    leftoverRuleset "${rs.name}" (id ${rs.id}): DIFFERS (a disabled GitHub-created leftover; new-repo.mjs --apply-settings --only rulesets deletes it)`);
    // UMB-131: the gate ruleset's bypass list -- a room can pass the coverage row above and still have
    // lost its admin bypass (CoalMine, 2026-09-17 org transfer); judged against the canon value.
    // Only published-code: the gate exists for dependabot-auto-merge.yml, which article repos do not ship
    // (a "no gate" line there would be a false positive -- measured on SpriteDesignDatum).
    if (kind === 'published-code') for (const v of gateBypassVerdicts(details, undefined, repoRes.json?.default_branch)) console.log(`    ${v.text}`);
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
  if (args.includes('--details')) {
    await runDetails();
    return;
  }
  const withSettings = args.includes('--settings');
  const clones = parseCloneArgs(args);

  // UMB-060: findReposLib now enumerates every directory per zone, signal or not
  // (the silent-skip fix) -- "repo(s)" in the summary line keeps meaning what it
  // always meant (a signal-bearing member), stated beside the true total scanned.
  const repos = findReposLib(umbrellaRoot, ZONES);
  const signalCount = repos.filter((r) => r.hasSignal).length;
  console.log(`Found ${signalCount} repo(s) under ${ZONES.join(', ')} (${repos.length} director${repos.length === 1 ? 'y' : 'ies'} scanned).\n`);

  let failed = 0;
  for (const repo of repos) {
    const kind = repo.kind;
    if (!repo.hasSignal) {
      // UMB-060 item 2: previously dropped here in total silence (no `.git`, no
      // skeleton-file marker) -- printed now so a reader can tell "correctly ruled
      // out" apart from "the instrument never looked."
      console.log(`## ${repo.zone}/${repo.name} — kind: UNCLASSIFIED (no signal)`);
      console.log('  (no .git and no skeleton-file marker — not a project member)\n');
      continue;
    }
    console.log(`## ${repo.zone}/${repo.name} — kind: ${kind ?? 'UNCLASSIFIED'}`);
    if (!kind) {
      console.log('  (no skeleton-file table to compare — unclassified)\n');
      continue;
    }
    const files = SKELETON_FILES[kind];
    const templateDir = TEMPLATE_DIR_FOR_KIND[kind];
    const remote = gitRemoteState(repo.dir);
    for (const rel of files) {
      const templatePath = path.join(templatesRoot, templateDir, rel);
      const livePath = path.join(repo.dir, rel);
      if (!fs.existsSync(templatePath)) {
        console.log(`  ${rel}: (not in this pass's skeleton — skip)`);
        continue;
      }
      // UMB-226: a workflow that can never run is N/A, even if a copy is present.
      const na = noRemoteVerdict(kind, rel, remote);
      if (na) {
        console.log(`  ${rel}: ${na}`);
        continue;
      }
      try {
        const verdict = compareFile(templatePath, livePath);
        console.log(`  ${rel}: ${liveFileVerdict(rel, verdict)}`);
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
          } else {
            // UMB-058: a real, identifiable body -- check it against the surfaces
            // that CLAIM a licence (the README badge, NOTICE) rather than reproduce it.
            const mismatches = checkLicenseIdentity(repo.dir, liveContent);
            for (const m of mismatches) {
              console.log(`  LICENSE: badge/notice mismatch (${m})`);
              failed++;
            }
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
        console.log(`  ${rel}: ${compareTemplateRepoFile(templatePath, clonePath)}`);
        if (rel === 'LICENSE' && fs.existsSync(clonePath)) {
          const cloneContent = fs.readFileSync(clonePath, 'utf8');
          if (isLicenseStub(cloneContent)) {
            console.log('  LICENSE: STUB (a name/URL pointer, not the licence\'s own text -- replace with a full licence body)');
            failed++;
          } else {
            const mismatches = checkLicenseIdentity(templateRepoDir, cloneContent, { templateRepo: true });
            for (const m of mismatches) {
              console.log(`  LICENSE: badge/notice mismatch (${m})`);
              failed++;
            }
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
