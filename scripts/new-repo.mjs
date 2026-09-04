#!/usr/bin/env node
// Copies a `templates/<kind>/` skeleton (+ an optional overlay) into a fresh directory,
// filling {{PLACEHOLDER}} tokens from CLI flags, and refuses a non-empty target.
//
// A SECOND mode, --apply-settings (UMB-048), reads templates/repo-settings.<kind>.json
// and applies it to a LIVE GitHub repo via REST — the settings half of UMB-045 item 7
// (repo settings live in GitHub, not in files a skeleton can carry). Idempotent: safe to
// re-run against a repo whose settings are already applied (main's own 2026-09-03 REST
// pass against the three template repos, recorded in
// scratchpad/dispatch/template-repos/repo-settings-applied-2026-09-03.json, is NOT
// re-applied by running this — the PATCH/PUT calls below are naturally idempotent, they
// set a value rather than toggling one).
//
// Zero-dependency (Phoenix #2) — uses Node's built-in global `fetch`, never a library;
// fail-loud CLI (scripts-quality.md §1). GITHUB_TOKEN is read from the environment; per
// house rule the `gh` CLI is never invoked (it belongs to a separate session on this
// machine) — every GitHub op here is a plain REST call.
//
// Usage:
//   node scripts/new-repo.mjs <kind> [--overlay coal-skill|llm-deploy] \
//     --name <repo> --license <spdx-or-a-file-path> [--license-id <spdx-or-name>] \
//     [--org TheColliery] [--holder "Name"] [--year 2026] <target-dir>
//
//   node scripts/new-repo.mjs --apply-settings <kind> --repo <owner>/<name>
//
// <kind> is one of: published-code | private-working | article
//
// --license does DOUBLE DUTY (UMB-054 item 3): a bare SPDX-shaped string (e.g.
// "Apache-2.0") fills the README's {{LICENSE_BADGE}} token only, same as before. A path
// to an EXISTING FILE instead REPLACES the copied LICENSE with that file's content
// before the placeholder fill runs (so a supplied body's own {{YEAR}}/
// {{COPYRIGHT_HOLDER}} tokens still get filled). Refusal: the owner's standing law is
// LICENSE = full text per part, never SPDX-only, never a stub — after copying (and any
// --license file substitution), this refuses to finish scaffolding (fail loud, non-zero
// exit) if the target's own LICENSE is still stub-shaped (lib/license-check-lib.mjs's
// isLicenseStub), leaving the partial copy on disk for the human to fix by hand or
// re-run with a real --license file into a fresh target.
//
// THE LICENCE-IDENTITY TRIANGLE (UMB-058 + UMB-059): the badge/NOTICE and the LICENSE
// body must agree, in BOTH directions. A bare --license STRING that contradicts the
// shipped body's identified licence REFUSES (UMB-058). A --license FILE has its badge
// DERIVED from identifyLicense() over the substituted body, never the hardcoded
// Apache-2.0 default (UMB-059) — an unidentifiable substituted body (a bespoke
// licence outside the flock's 5-licence portfolio) REFUSES unless --license-id names
// it explicitly. --license-id is meaningful ONLY alongside a --license FILE whose body
// identifyLicense() cannot recognize; it is ignored otherwise.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { isLicenseStub, identifyLicense, normalizeLicenseId } from './lib/license-check-lib.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const templatesRoot = path.join(scriptDir, '..', 'templates');
const KINDS = ['published-code', 'private-working', 'article'];
const OVERLAYS = ['coal-skill', 'llm-deploy'];
const GITHUB_API = 'https://api.github.com';

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      // A flag-shaped following token is never swallowed as this flag's value
      // (the M7a class named in CoalTipple's own MEMORY.md).
      if (next === undefined || next.startsWith('--')) {
        out[key] = true;
      } else {
        out[key] = next;
        i++;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

// A bare flag with no following value parses to boolean `true` (parseArgs above) --
// never let that leak into a template placeholder as the literal string "true". Every
// flag feeding the `values` object below is read through this guard.
function asString(v) {
  return typeof v === 'string' ? v : undefined;
}

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirRecursive(s, d);
    else fs.copyFileSync(s, d);
  }
}

function isEmptyDir(dir) {
  if (!fs.existsSync(dir)) return true;
  return fs.readdirSync(dir).length === 0;
}

function fillPlaceholders(dir, values) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      fillPlaceholders(p, values);
      continue;
    }
    let text;
    try {
      text = fs.readFileSync(p, 'utf8');
    } catch {
      continue; // binary or unreadable; skip silently, this is a text-fill pass only
    }
    let changed = false;
    for (const [key, value] of Object.entries(values)) {
      const token = `{{${key}}}`;
      if (text.includes(token)) {
        text = text.split(token).join(value);
        changed = true;
      }
    }
    if (changed) fs.writeFileSync(p, text, 'utf8');
  }
}

// --apply-settings ------------------------------------------------------------------

async function ghRequest(token, method, urlPath, body) {
  const res = await fetch(GITHUB_API + urlPath, {
    method,
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  // 422 on the ruleset endpoint most commonly means "a ruleset with this name already
  // exists" — treated as success (idempotent create), never retried as a new object.
  let json = null;
  try { json = await res.json(); } catch {} // a 2xx with no body (some PUT endpoints) is not an error
  return { ok: res.ok, status: res.status, json };
}

// Reports one settings surface's outcome without throwing — a 403/422 on a plan-gated
// endpoint (private_vulnerability_reporting on a private repo, a ruleset without a paid
// org plan) is an EXPECTED outcome for some kinds, per repo-settings.<kind>.json's own
// "n/a" entries, and must read as a named skip, never as a script crash.
async function applySettings(kind, ownerRepo) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('FAIL: GITHUB_TOKEN is not set in the environment.');
    process.exitCode = 1;
    return;
  }
  const [owner, repo] = ownerRepo.split('/');
  if (!owner || !repo) {
    console.error(`FAIL: --repo must be "<owner>/<name>" (got ${JSON.stringify(ownerRepo)})`);
    process.exitCode = 1;
    return;
  }
  const settingsPath = path.join(templatesRoot, `repo-settings.${kind}.json`);
  let settings;
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch (e) {
    console.error(`FAIL: could not read/parse ${settingsPath}: ${e.message}`);
    process.exitCode = 1;
    return;
  }

  const results = [];
  const base = `/repos/${owner}/${repo}`;

  if (settings.repoPatch) {
    const r = await ghRequest(token, 'PATCH', base, settings.repoPatch);
    results.push({ surface: 'repoPatch', ok: r.ok, status: r.status });
  }

  if (settings.vulnerabilityAlerts?.enable) {
    const r = await ghRequest(token, 'PUT', `${base}/vulnerability-alerts`);
    results.push({ surface: 'vulnerabilityAlerts', ok: r.ok, status: r.status });
  }

  if (settings.automatedSecurityFixes?.enable) {
    const r = await ghRequest(token, 'PUT', `${base}/automated-security-fixes`);
    results.push({ surface: 'automatedSecurityFixes', ok: r.ok, status: r.status });
  }

  if (settings.secretScanning?.status === 'enabled') {
    // Secret scanning + push protection are toggled through the repo PATCH endpoint's
    // own security_and_analysis object — not a separate PUT/POST endpoint.
    const r = await ghRequest(token, 'PATCH', base, {
      security_and_analysis: {
        secret_scanning: { status: 'enabled' },
        secret_scanning_push_protection: { status: settings.secretScanning.pushProtection === 'enabled' ? 'enabled' : 'disabled' },
      },
    });
    results.push({ surface: 'secretScanning', ok: r.ok, status: r.status });
  } else {
    results.push({ surface: 'secretScanning', ok: true, status: 'N/A', reason: settings.secretScanning?.reason });
  }

  if (settings.privateVulnerabilityReporting?.enable) {
    const r = await ghRequest(token, 'PUT', `${base}/private-vulnerability-reporting`);
    results.push({ surface: 'privateVulnerabilityReporting', ok: r.ok, status: r.status });
  } else {
    results.push({ surface: 'privateVulnerabilityReporting', ok: true, status: 'N/A', reason: settings.privateVulnerabilityReporting?.reason });
  }

  if (settings.actionsWorkflowToken) {
    const r = await ghRequest(token, 'PUT', `${base}/actions/permissions/workflow`, settings.actionsWorkflowToken);
    results.push({ surface: 'actionsWorkflowToken', ok: r.ok, status: r.status });
  }

  if (settings.ruleset && settings.ruleset.name) {
    const { $noRequiredStatusChecksNote, $ifItEverBecomesAvailableNote, ...rulesetBody } = settings.ruleset;
    const r = await ghRequest(token, 'POST', `${base}/rulesets`, rulesetBody);
    // A 422 here is the expected shape of "a ruleset with this name already exists" —
    // idempotent-create, not a failure (GitHub's rulesets API has no PUT-by-name).
    const ok = r.ok || r.status === 422;
    results.push({ surface: 'ruleset', ok, status: r.status, note: r.status === 422 ? 'already exists (treated as applied)' : undefined });
  } else if (settings.ruleset) {
    results.push({ surface: 'ruleset', ok: true, status: 'N/A', reason: settings.ruleset.reason });
  }

  console.log(`applySettings: ${kind} -> ${owner}/${repo}`);
  for (const r of results) {
    const line = r.status === 'N/A' ? `  ${r.surface}: N/A (${r.reason || 'no reason recorded'})` : `  ${r.surface}: ${r.ok ? 'ok' : 'FAIL'} (HTTP ${r.status}${r.note ? ', ' + r.note : ''})`;
    console.log(line);
    if (!r.ok && r.status !== 'N/A') process.exitCode = 1;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args['apply-settings']) {
    // parseArgs swallows the token right after a flag as that flag's VALUE (never pushed
    // to `_`) unless it starts with "--" — so "--apply-settings published-code" lands the
    // kind in args['apply-settings'] itself, not in args._[0].
    const kind = args['apply-settings'];
    if (kind === true || !KINDS.includes(kind)) {
      console.error(`FAIL: --apply-settings needs <kind> as one of ${KINDS.join(', ')} (got ${JSON.stringify(kind)})`);
      process.exitCode = 1;
      return;
    }
    if (!args.repo) {
      console.error('FAIL: --apply-settings needs --repo <owner>/<name>');
      process.exitCode = 1;
      return;
    }
    await applySettings(kind, args.repo);
    return;
  }

  const kind = args._[0];
  const targetDir = args._[1];

  if (!kind || !KINDS.includes(kind)) {
    console.error(`FAIL: <kind> must be one of ${KINDS.join(', ')} (got ${JSON.stringify(kind)})`);
    process.exitCode = 1;
    return;
  }
  if (!targetDir) {
    console.error('FAIL: a target directory is required.');
    process.exitCode = 1;
    return;
  }
  if (args.overlay && !OVERLAYS.includes(args.overlay)) {
    console.error(`FAIL: --overlay must be one of ${OVERLAYS.join(', ')} (got ${JSON.stringify(args.overlay)})`);
    process.exitCode = 1;
    return;
  }

  const absTarget = path.resolve(targetDir);
  if (!isEmptyDir(absTarget)) {
    console.error(`FAIL: ${absTarget} exists and is not empty — new-repo.mjs never overwrites.`);
    process.exitCode = 1;
    return;
  }

  const skeletonDir = path.join(templatesRoot, kind);
  if (!fs.existsSync(skeletonDir)) {
    console.error(`FAIL: no skeleton found at ${skeletonDir}`);
    process.exitCode = 1;
    return;
  }

  const filesWritten = [];
  copyDirRecursive(skeletonDir, absTarget);
  console.log(`copied skeleton: ${kind} -> ${absTarget}`);

  if (args.overlay) {
    const overlayDir = path.join(templatesRoot, `overlay-${args.overlay}`);
    if (!fs.existsSync(overlayDir)) {
      console.error(`FAIL: no overlay found at ${overlayDir}`);
      process.exitCode = 1;
      return;
    }
    copyDirRecursive(overlayDir, absTarget);
    console.log(`applied overlay: ${args.overlay}`);
  }

  // UMB-054 item 3, part 1: --license as a FILE PATH replaces the copied LICENSE body.
  const licensePath = path.join(absTarget, 'LICENSE');
  const licenseIsFile = typeof args.license === 'string' && fs.existsSync(args.license) && fs.statSync(args.license).isFile();
  if (licenseIsFile) {
    fs.copyFileSync(args.license, licensePath);
    console.log(`LICENSE body supplied from ${args.license}`);
  }

  // UMB-054 item 3, part 2: REFUSE to finish scaffolding a repo whose LICENSE is still
  // a stub (the owner's standing law: full text per part, never SPDX-only, never a
  // stub). The partial copy stays on disk — never overwritten (isEmptyDir above), so a
  // re-run needs a fresh target-dir or a hand-fixed LICENSE in this one.
  let licenseContent = '';
  if (fs.existsSync(licensePath)) {
    licenseContent = fs.readFileSync(licensePath, 'utf8');
    if (isLicenseStub(licenseContent)) {
      console.error(`FAIL: ${licensePath} is still a licence STUB (a name/URL pointer, not the licence's own text).`);
      console.error('Supply a real body with --license <path-to-a-file-with-the-full-licence-text>, or edit LICENSE by hand before shipping.');
      process.exitCode = 1;
      return;
    }
  }

  // UMB-058/059: the licence-identity triangle, both legs. A --license SPDX STRING
  // only fills the README badge/NOTICE text -- it never touches the LICENSE BODY (a
  // FILE path does that, handled separately above). Two shapes, two rules:
  //
  //   - SPDX-STRING leg (UMB-058): a bare `--license MIT` against a kind whose
  //     skeleton ships a full Apache-2.0 body would otherwise ship a repo where the
  //     badge/NOTICE say MIT and the legalcode says Apache-2.0 -- REFUSE on a
  //     contradiction between the claimed string and the identified body.
  //   - FILE leg (UMB-059, UMB-058's own named pending gap): the OPPOSITE failure --
  //     a --license FILE replaces the body outright, but the badge previously fell
  //     back to the hardcoded 'Apache-2.0' default REGARDLESS of what the
  //     substituted body actually was, so a real non-Apache LICENSE (e.g. Chotmeter's
  //     FSL-1.1-Apache-2.0, ChotUnitDatum's CC-BY-4.0) shipped with a badge/NOTICE
  //     that silently lied about it. The badge now DERIVES from identifyLicense()
  //     over the substituted body; an unidentifiable body (a bespoke licence) has no
  //     identity to derive, so the run REFUSES unless the human states one explicitly
  //     via --license-id (never silently defaults again -- a silent default is
  //     exactly the defect this leg exists to close).
  let licenseBadge;
  if (licenseIsFile) {
    const identifiedFromFile = identifyLicense(licenseContent);
    const explicitId = asString(args['license-id']);
    if (identifiedFromFile) {
      licenseBadge = identifiedFromFile;
    } else if (explicitId) {
      licenseBadge = explicitId;
    } else {
      console.error(`FAIL: ${licensePath}'s substituted body (from ${args.license}) does not match any of the flock's recognized licences, and no --license-id was given.`);
      console.error('Supply --license-id <spdx-or-name> to state this licence explicitly for the README badge and NOTICE -- the badge no longer silently defaults to Apache-2.0 for a substituted body.');
      process.exitCode = 1;
      return;
    }
  } else {
    licenseBadge = asString(args.license) || 'Apache-2.0';
    const identifiedFromBody = identifyLicense(licenseContent);
    if (identifiedFromBody && normalizeLicenseId(identifiedFromBody) !== normalizeLicenseId(licenseBadge)) {
      console.error(`FAIL: --license ${JSON.stringify(licenseBadge)} contradicts ${licensePath}'s own body, identified as ${identifiedFromBody}.`);
      console.error('The README badge and NOTICE would claim one licence while the legalcode says another. Pass --license matching the body, or supply the body as a FILE (--license <path>) so all three agree.');
      process.exitCode = 1;
      return;
    }
  }

  const now = new Date();
  const values = {
    REPO_NAME: asString(args.name) || path.basename(absTarget),
    ORG: asString(args.org) || 'TheColliery',
    YEAR: asString(args.year) || String(now.getFullYear()),
    COPYRIGHT_HOLDER: asString(args.holder) || 'HetCreep',
    LICENSE_BADGE: licenseBadge,
  };
  fillPlaceholders(absTarget, values);
  console.log(`filled placeholders: ${Object.keys(values).join(', ')}`);
  console.log('NOTE: remaining {{PLACEHOLDER}} tokens (content only a human can supply — tagline,');
  console.log('what-it-is, scope) are left in place; grep for "{{" before first push.');

  function listFiles(dir, prefix = '') {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = path.join(prefix, entry.name);
      if (entry.isDirectory()) listFiles(path.join(dir, entry.name), rel);
      else filesWritten.push(rel);
    }
  }
  listFiles(absTarget);
  console.log(`\n${filesWritten.length} file(s) written:`);
  for (const f of filesWritten.sort()) console.log(`  ${f}`);
}

main().catch((e) => {
  console.error(`FAIL: ${e.message}`);
  process.exitCode = 1;
});
