// Hermetic spawn tests for new-repo.mjs's LICENSE-stub refusal (UMB-054 item 3).
// Per testing.md's required test type for a CLI entry: spawn the REAL file, assert
// exit code + the actual on-disk state effect — never re-derive its logic by import.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'new-repo.mjs');

function run(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
}

function scratchDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'new-repo-test-'));
}

// UMB-112 row 13: the article template used to ship a 19-line pointer STUB, so a scaffold
// with no --license file always refused. The template now carries the full CC BY-NC-ND 4.0
// legalcode (sha256-pinned tail), so the same command completes.
test('new-repo.mjs article, no --license file: SUCCEEDS -- the scaffolded LICENSE carries the full legalcode (UMB-112 row 13)', () => {
  const target = path.join(scratchDir(), 'r');
  const res = run(['article', '--name', 'x', target]);
  assert.equal(res.status, 0, res.stderr);
  const body = fs.readFileSync(path.join(target, 'LICENSE'));
  assert.ok(body.length > 19127);
  assert.equal(createHash('sha256').update(body.subarray(body.length - 19127)).digest('hex'), '38762e3777f4ec00a6f769062a7c3f704fb78ce08303ecff88558da4c49cf9ea');
  fs.rmSync(path.dirname(target), { recursive: true, force: true });
});

// UMB-112 rows 23 + 24: the article scaffold's own CONTRIBUTING and SUMMARY pointed at pages the
// scaffold never shipped (ERRATA.md, licence.md), so every new article repo started with dangling
// links. The scaffold now ships both, and licence.md reproduces LICENSE byte for byte (one document
// on two faces -- a GitBook reader cannot browse LICENSE, so the page carries it).
test('new-repo.mjs article: the scaffold ships the pages its own CONTRIBUTING + SUMMARY point at, and licence.md carries LICENSE verbatim (UMB-112 rows 23 + 24)', () => {
  const target = path.join(scratchDir(), 'r');
  const res = run(['article', '--name', 'x', target]);
  assert.equal(res.status, 0, res.stderr);
  for (const f of ['ERRATA.md', 'licence.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'LICENSE']) {
    assert.ok(fs.existsSync(path.join(target, f)), f + ' must ship');
  }
  assert.match(fs.readFileSync(path.join(target, 'CONTRIBUTING.md'), 'utf8'), /\]\(ERRATA\.md\)/, 'the link this row is about is still there');
  const summary = fs.readFileSync(path.join(target, 'SUMMARY.md'), 'utf8');
  assert.match(summary, /\]\(licence\.md\)/);
  assert.match(summary, /\]\(ERRATA\.md\)/);
  const license = fs.readFileSync(path.join(target, 'LICENSE'), 'utf8');
  assert.ok(fs.readFileSync(path.join(target, 'licence.md'), 'utf8').includes(license), 'licence.md must reproduce LICENSE verbatim');
  fs.rmSync(path.dirname(target), { recursive: true, force: true });
});

// UMB-112 residue (4): SUMMARY.md listed README / SOURCES / GOVERNANCE / the standard file and the
// scaffold shipped none of them, so a fresh article repo's table of contents was four dead links. The
// property is general -- EVERY relative link in the scaffold's SUMMARY.md must land on a file the
// scaffold shipped -- so it is asserted as the property, not as a list of four names.
test('new-repo.mjs article: every relative link in the scaffold SUMMARY.md resolves to a shipped file (UMB-112 residue 4)', () => {
  const target = path.join(scratchDir(), 'r');
  const res = run(['article', '--name', 'x', target]);
  assert.equal(res.status, 0, res.stderr);
  const summary = fs.readFileSync(path.join(target, 'SUMMARY.md'), 'utf8');
  const links = [...summary.matchAll(/\]\(([^)#\s]+)\)/g)].map((m) => m[1]).filter((l) => !/^[a-z]+:/i.test(l));
  assert.ok(links.length >= 8, 'SUMMARY.md links found: ' + links.join(','));
  const dangling = links.filter((l) => !fs.existsSync(path.join(target, l)));
  assert.deepEqual(dangling, [], 'SUMMARY.md links to files the scaffold did not ship');
  for (const f of ['README.md', 'SOURCES.md', 'GOVERNANCE.md', '{{STANDARD_FILE}}.md']) {
    const body = fs.readFileSync(path.join(target, f), 'utf8');
    assert.match(body, /PLACEHOLDER/, f + ' must say it is a placeholder the author replaces');
  }
  fs.rmSync(path.dirname(target), { recursive: true, force: true });
});

// UMB-112 row 27 + residue 8: the generic published-code scaffold told EVERY new repo to "rebuild plugin/",
// keep a SSOT file, and run hooks Phoenix-pure -- three Coal-skill-only instructions in a section that also
// serves repos with no plugin. Row 27 moved the gate commands to the overlay; the sibling bullets in the
// same "Development Rules" section were left. They now live in overlay-coal-skill/OVERLAY-README.md and the
// section carries one token, so a non-plugin repo is never told to rebuild a directory it does not have.
test('new-repo.mjs published-code: the CONTRIBUTING Development Rules section carries no Coal-plugin-only bullet (UMB-112 residue 8)', () => {
  const target = path.join(scratchDir(), 'r');
  const res = run(['published-code', '--name', 'x', target]);
  assert.equal(res.status, 0, res.stderr);
  const c = fs.readFileSync(path.join(target, 'CONTRIBUTING.md'), 'utf8').replace(/\r\n/g, '\n');
  const start = c.indexOf('### Development Rules');
  assert.ok(start >= 0, 'the section exists');
  const section = c.slice(start, c.indexOf('\n---', start));
  assert.doesNotMatch(section, /plugin\//, 'no plugin/ instruction in the generic scaffold');
  assert.doesNotMatch(section, /Single Source of Truth|SSOT/, 'no SSOT-file instruction in the generic scaffold');
  assert.doesNotMatch(section, /Phoenix/, 'no Phoenix-doctrine bullet in the generic scaffold');
  assert.match(section, /\{\{DEVELOPMENT_RULES\}\}/, 'the repo-specific rules are a token the repo fills');
  assert.match(section, /Add unit tests/, 'the generic bullets stay');
  assert.match(section, /Language & tone/, 'the generic bullets stay');
  fs.rmSync(path.dirname(target), { recursive: true, force: true });
});

test('overlay-coal-skill README carries the three bullets the generic CONTRIBUTING no longer does (UMB-112 residue 8)', () => {
  const overlay = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'templates', 'overlay-coal-skill', 'OVERLAY-README.md'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(overlay, /\{\{DEVELOPMENT_RULES\}\}/);
  assert.ok(overlay.includes('is the Single Source of Truth** for {{SSOT_CONTENT}}'), 'the SSOT bullet, tokens intact');
  assert.ok(overlay.includes('**Synchronize `plugin/`:**'), 'the plugin/ sync bullet');
  assert.ok(overlay.includes('**Keep hooks Phoenix-pure:**'), 'the hooks bullet');
});

test('new-repo.mjs article, --license <a pointer STUB file>: still REFUSES (non-zero exit, stub named) -- the refusal contract outlives the template fix', () => {
  const root = scratchDir();
  const stubFile = path.join(root, 'stub.txt');
  fs.writeFileSync(stubFile, ['Some Article', '', 'Licensed under CC BY-NC-ND 4.0.', 'See https://creativecommons.org/licenses/by-nc-nd/4.0/', ''].join('\n'));
  const target = path.join(root, 'r');
  const res = run(['article', '--name', 'x', '--license', stubFile, target]);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /licence STUB/);
  assert.ok(fs.existsSync(path.join(target, 'LICENSE')), 'LICENSE stays on disk as the stub so a human sees what tripped it');
  fs.rmSync(root, { recursive: true, force: true });
});

test('new-repo.mjs article, --license <a real body file>: SUCCEEDS and the body lands verbatim', () => {
  const root = scratchDir();
  const licenseFile = path.join(root, 'MIT.txt');
  const mit = [
    'MIT License', '',
    'Copyright (c) 2026 Example', '',
    'Permission is hereby granted, free of charge, to any person obtaining a copy',
    'of this software, subject to the following conditions:', '',
    'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.', '',
  ].join('\n');
  fs.writeFileSync(licenseFile, mit);
  const target = path.join(root, 'r');
  const res = run(['article', '--name', 'x', '--license', licenseFile, target]);
  assert.equal(res.status, 0, res.stderr);
  assert.equal(fs.readFileSync(path.join(target, 'LICENSE'), 'utf8'), mit);
  fs.rmSync(root, { recursive: true, force: true });
});

test('new-repo.mjs published-code (already ships a full-text LICENSE): unaffected, exit 0', () => {
  const target = path.join(scratchDir(), 'r');
  const res = run(['published-code', '--name', 'x', '--license', 'Apache-2.0', target]);
  assert.equal(res.status, 0, res.stderr);
  fs.rmSync(path.dirname(target), { recursive: true, force: true });
});

test('new-repo.mjs published-code, bare --license (no value, parses to boolean true): the badge falls back to Apache-2.0, never leaks the literal "true"', () => {
  // rot-canary QUICK self-catch: a bare flag with no following value parses to
  // boolean `true` (parseArgs), and `args.license || 'Apache-2.0'` let that boolean
  // through untouched because `true` is truthy -- fillPlaceholders then coerced it to
  // the literal string "true" via Array.join(), landing in the shipped README badge.
  const target = path.join(scratchDir(), 'r');
  const res = run(['published-code', '--name', 'x', target, '--license']);
  assert.equal(res.status, 0, res.stderr);
  const readme = fs.readFileSync(path.join(target, 'README.md'), 'utf8');
  assert.match(readme, /badge\/license-Apache-2\.0-blue/);
  assert.doesNotMatch(readme, /badge\/license-true-blue/);
  fs.rmSync(path.dirname(target), { recursive: true, force: true });
});

test('new-repo.mjs published-code --overlay coal-skill: the overlay does not clobber the product README.md (UMB-056/4)', () => {
  // copyDirRecursive applies the overlay AFTER the base skeleton with no collision
  // awareness -- an overlay shipping its own README.md at its own root silently
  // overwrote the scaffolded repo's real product README with the overlay's own
  // meta-documentation. Fixed by renaming the overlay meta-docs to OVERLAY-README.md
  // (a name nothing in the base skeleton ships), never by teaching copyDirRecursive
  // to skip a path -- the skeleton's own README.md must still be free to exist.
  const target = path.join(scratchDir(), 'r');
  const res = run(['published-code', '--overlay', 'coal-skill', '--name', 'x', '--license', 'Apache-2.0', target]);
  assert.equal(res.status, 0, res.stderr);
  const readme = fs.readFileSync(path.join(target, 'README.md'), 'utf8');
  assert.doesNotMatch(readme, /^# overlay-coal-skill/m, 'the product README must not be the overlay meta-doc');
  assert.ok(fs.existsSync(path.join(target, 'OVERLAY-README.md')), 'the overlay meta-doc still ships, under its own non-colliding name');
  fs.rmSync(path.dirname(target), { recursive: true, force: true });
});

test('new-repo.mjs published-code --overlay llm-deploy: the overlay does not clobber the product README.md (UMB-056/4)', () => {
  const target = path.join(scratchDir(), 'r');
  const res = run(['published-code', '--overlay', 'llm-deploy', '--name', 'x', '--license', 'Apache-2.0', target]);
  assert.equal(res.status, 0, res.stderr);
  const readme = fs.readFileSync(path.join(target, 'README.md'), 'utf8');
  assert.doesNotMatch(readme, /^# overlay-llm-deploy/m, 'the product README must not be the overlay meta-doc');
  assert.ok(fs.existsSync(path.join(target, 'OVERLAY-README.md')), 'the overlay meta-doc still ships, under its own non-colliding name');
  fs.rmSync(path.dirname(target), { recursive: true, force: true });
});

test('new-repo.mjs published-code, --license apache-2.0 (lowercase, matching the real shipped body): NOTICE derives its licence line from the same value as the README badge (UMB-056/5)', () => {
  // NOTICE used to hard-code "the Apache License, Version 2.0" regardless of --license
  // -- wrong for every non-Apache zone in the licence PORTFOLIO (AGENTS.md's
  // "LICENSE = A PORTFOLIO" ruling). Fixed by having NOTICE's own {{LICENSE_BADGE}}
  // token read from the SAME values object the README badge already fills from.
  //
  // UPDATED (UMB-058): published-code's real skeleton body is Apache-2.0, so a bare
  // `--license MIT` (this test's original value) now correctly REFUSES as a genuine
  // badge/body contradiction -- see the UMB-058 refusal tests below. Using a
  // lowercase `apache-2.0` here keeps the scenario self-consistent (it still
  // identifies as the same licence as the real body, normalizeLicenseId is
  // case-insensitive) while staying textually DIFFERENT from the hardcoded
  // capitalized default ('Apache-2.0') -- proving the flag genuinely flowed through
  // to NOTICE/README rather than the assertion passing on the default-fallback path
  // the OTHER bare-flag test already covers.
  const target = path.join(scratchDir(), 'r');
  const res = run(['published-code', '--name', 'x', '--license', 'apache-2.0', target]);
  assert.equal(res.status, 0, res.stderr);
  const notice = fs.readFileSync(path.join(target, 'NOTICE'), 'utf8');
  const readme = fs.readFileSync(path.join(target, 'README.md'), 'utf8');
  assert.match(notice, /licensed under apache-2\.0/);
  assert.match(readme, /badge\/license-apache-2\.0-blue/);
  fs.rmSync(path.dirname(target), { recursive: true, force: true });
});

test('new-repo.mjs article, --license as a bare SPDX string (not a file): a badge that contradicts the shipped legalcode REFUSES (UMB-058 triangle; UMB-112 row 13 made the body a real one)', () => {
  // A bare "MIT" string is not an existing file path, so it is read as the LICENSE_BADGE-only
  // meaning -- the LICENSE body is never touched; it now identifies as CC-BY-NC-ND-4.0, so MIT
  // contradicts it (this used to refuse as a STUB, back when the template was a pointer).
  const target = path.join(scratchDir(), 'r');
  const res = run(['article', '--name', 'x', '--license', 'MIT', target]);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /contradicts .*LICENSE's own body, identified as CC-BY-NC-ND-4\.0/);
  fs.rmSync(path.dirname(target), { recursive: true, force: true });
});

// ---------------------------------------------------------------------------------
// UMB-058: the licence-identity triangle -- a --license SPDX STRING that contradicts
// the actual shipped LICENSE body is refused, the same shape as the stub refusal.

test('new-repo.mjs published-code, --license MIT (the real shipped body is Apache-2.0): REFUSES the badge/body contradiction (UMB-058)', () => {
  const target = path.join(scratchDir(), 'r');
  const res = run(['published-code', '--name', 'x', '--license', 'MIT', target]);
  assert.notEqual(res.status, 0, res.stdout);
  assert.match(res.stderr, /contradicts .*LICENSE's own body, identified as Apache-2\.0/);
  // The partial copy stays on disk, same disposition as the stub refusal above --
  // never silently discarded, never silently overwritten (isEmptyDir on a re-run).
  assert.ok(fs.existsSync(path.join(target, 'LICENSE')));
  fs.rmSync(path.dirname(target), { recursive: true, force: true });
});

test('new-repo.mjs private-working, --license CC-BY-4.0 (the real shipped body is Apache-2.0): REFUSES (UMB-058)', () => {
  const target = path.join(scratchDir(), 'r');
  const res = run(['private-working', '--name', 'x', '--license', 'CC-BY-4.0', target]);
  assert.notEqual(res.status, 0, res.stdout);
  assert.match(res.stderr, /contradicts .*LICENSE's own body, identified as Apache-2\.0/);
  fs.rmSync(path.dirname(target), { recursive: true, force: true });
});

test('new-repo.mjs published-code, --license Apache_2.0 (shields.io-escaped spelling, the real live badge form): SUCCEEDS -- normalizeLicenseId absorbs the escaping difference (UMB-058)', () => {
  const target = path.join(scratchDir(), 'r');
  const res = run(['published-code', '--name', 'x', '--license', 'Apache_2.0', target]);
  assert.equal(res.status, 0, res.stderr);
  fs.rmSync(path.dirname(target), { recursive: true, force: true });
});

test('new-repo.mjs published-code, --license <an arbitrary unrecognized string> against the real Apache-2.0 body: REFUSES -- the check compares against the IDENTIFIED body, not against a fixed list of recognized badge spellings (UMB-058)', () => {
  // The body IS identified (Apache-2.0, per the real shipped LICENSE); a claim that
  // does not match it is a contradiction whether or not the claim itself happens to
  // spell a name identifyLicense() would also recognize. What is NEVER refused is
  // an unrecognized BODY (see license-check.test.mjs's own identifyLicense() suite,
  // and the licenseIsFile-scoped test below) -- a different case from this one.
  const target = path.join(scratchDir(), 'r');
  const res = run(['published-code', '--name', 'x', '--license', 'Some-Bespoke-License-1.0', target]);
  assert.notEqual(res.status, 0, res.stdout);
  assert.match(res.stderr, /contradicts .*LICENSE's own body, identified as Apache-2\.0/);
  fs.rmSync(path.dirname(target), { recursive: true, force: true });
});

test('new-repo.mjs published-code, --license <a real MIT body file> (licenseIsFile=true): SUCCEEDS, badge/NOTICE DERIVE MIT from the substituted body (UMB-058 + UMB-059)', () => {
  // UPDATED (UMB-059): the file-substitution case now ALSO derives its badge from
  // identifyLicense() over the substituted body -- it is no longer scoped out. The
  // pre-fix behaviour this test used to only prove exit 0 for is now asserted
  // directly: the badge is MIT, not the old hardcoded Apache-2.0 default.
  // published-code, not article: article's own skeleton ships no NOTICE file at all.
  const root = scratchDir();
  const licenseFile = path.join(root, 'MIT.txt');
  const mit = [
    'MIT License', '',
    'Copyright (c) 2026 Example', '',
    'Permission is hereby granted, free of charge, to any person obtaining a copy',
    'of this software, subject to the following conditions:', '',
    'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.', '',
  ].join('\n');
  fs.writeFileSync(licenseFile, mit);
  const target = path.join(root, 'r');
  const res = run(['published-code', '--name', 'x', '--license', licenseFile, target]);
  assert.equal(res.status, 0, res.stderr);
  const notice = fs.readFileSync(path.join(target, 'NOTICE'), 'utf8');
  const readme = fs.readFileSync(path.join(target, 'README.md'), 'utf8');
  assert.match(notice, /licensed under MIT/);
  assert.match(readme, /badge\/license-MIT-blue/);
  fs.rmSync(root, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------------
// UMB-059: the --license FILE leg. Real non-Apache LICENSE fixtures, per the dispatch
// ("Chotmeter's FSL-1.1-Apache-2.0 or ChotUnitDatum's CC-BY-4.0") -- verbatim excerpts
// of the real distinctive headers, same sourcing as license-check.test.mjs's own
// fixtures, kept inline so this stays hermetic (no cross-repo read in CI).

// sourced: Articles/ChotUnitDatum/LICENSE lines 1, 57, 59, and the real Section 2.a.1
// grant clause every CC-BY-4.0 legalcode carries (real file, read 2026-09-04) -- long
// enough (and carries the real "hereby grants" grant-clause language, isLicenseStub's
// own SUBSTANTIVE_MARKER) to clear the stub-refusal and actually reach the
// identity-derivation this test targets, same as the BESPOKE_PROPRIETARY_TEXT fixture
// above needed to.
const REAL_CC_BY_4_FILE = [
  'Attribution 4.0 International',
  '',
  '=======================================================================',
  '',
  'Using Creative Commons Public Licenses',
  '',
  'Creative Commons Attribution 4.0 International Public License',
  '',
  'By exercising the Licensed Rights (defined below), You accept and agree',
  'to be bound by the terms and conditions of this Creative Commons',
  'Attribution 4.0 International Public License ("Public License").', '',
  'Section 2 -- Scope.', '',
  'a. License grant.', '',
  '   1. Subject to the terms and conditions of this Public License, the',
  '      Licensor hereby grants You a worldwide, royalty-free,',
  '      non-sublicensable, non-exclusive, irrevocable license to exercise',
  '      the Licensed Rights in the Licensed Material.',
].join('\n');

test('new-repo.mjs published-code, --license <a REAL CC-BY-4.0 file, the ChotUnitDatum shape>: badge/NOTICE derive CC-BY-4.0 -- NEVER the old hardcoded Apache-2.0 default (UMB-059, the standing regression exhibit)', () => {
  // This is the exact defect UMB-059 exists to close, kept as a standing test per
  // the dispatch: before this fix, EVERY --license FILE shipped a badge/NOTICE
  // claiming Apache-2.0 regardless of the substituted body's real identity -- a
  // genuinely non-Apache body (this one) would have silently shipped mislabeled.
  // published-code, not article: article's own skeleton ships no NOTICE file at all.
  const root = scratchDir();
  const licenseFile = path.join(root, 'CC-BY-4.0.txt');
  fs.writeFileSync(licenseFile, REAL_CC_BY_4_FILE);
  const target = path.join(root, 'r');
  const res = run(['published-code', '--name', 'x', '--license', licenseFile, target]);
  assert.equal(res.status, 0, res.stderr);
  const notice = fs.readFileSync(path.join(target, 'NOTICE'), 'utf8');
  const readme = fs.readFileSync(path.join(target, 'README.md'), 'utf8');
  assert.match(notice, /licensed under CC-BY-4\.0/);
  assert.doesNotMatch(notice, /Apache/);
  assert.match(readme, /badge\/license-CC-BY-4\.0-blue/);
  assert.doesNotMatch(readme, /badge\/license-Apache/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('new-repo.mjs published-code, --license <a REAL FSL-1.1-Apache-2.0-shaped file, the Chotmeter shape, embeds the full Apache-2.0 text>: badge/NOTICE derive FSL-1.1-Apache-2.0, never Apache-2.0 (UMB-059, the ORDER-IS-LOAD-BEARING collision case at the CLI level)', () => {
  // The same collision identifyLicense()'s own ordering exists to prevent (proven
  // red-first at the lib level in license-check.test.mjs): a real FSL body embeds
  // the FULL Apache-2.0 legalcode verbatim. Proves the CLI's derivation inherits
  // that correctness rather than re-implementing (and potentially re-breaking) it.
  const root = scratchDir();
  const licenseFile = path.join(root, 'FSL.txt');
  const realApache = fs.readFileSync(path.join(path.dirname(SCRIPT), '..', 'templates', 'published-code', 'LICENSE'), 'utf8');
  const fsl = '# Functional Source License, Version 1.1, ALv2 Future License\n\n## Abbreviation\nFSL-1.1-ALv2\n\n' + realApache;
  fs.writeFileSync(licenseFile, fsl);
  const target = path.join(root, 'r');
  const res = run(['published-code', '--name', 'x', '--license', licenseFile, target]);
  assert.equal(res.status, 0, res.stderr);
  const notice = fs.readFileSync(path.join(target, 'NOTICE'), 'utf8');
  assert.match(notice, /licensed under FSL-1\.1-Apache-2\.0/);
  fs.rmSync(root, { recursive: true, force: true });
});

// Realistic bespoke proprietary text (the real Kolwen/CoalKiln shape) -- long/
// substantive enough (carries a WARRANTY disclaimer, isLicenseStub's own
// SUBSTANTIVE_MARKER) to clear the EARLIER stub-refusal and actually reach the
// identity-derivation logic this test targets, while matching none of the 5
// identifyLicense() signatures.
const BESPOKE_PROPRIETARY_TEXT = [
  'Kolwen — Repository License', '',
  'Copyright (c) 2026 HetCreep / TheColliery. All rights reserved.', '',
  'The contents of this repository — documentation, text, images, and any other',
  'material — are proprietary and confidential. No part of this repository may be',
  'reproduced, distributed, or transmitted in any form without prior written',
  'permission from the copyright holder.', '',
  'THIS SOFTWARE IS PROVIDED WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.', '',
].join('\n');

test('new-repo.mjs published-code, --license <a bespoke unidentifiable body file>, no --license-id: REFUSES -- never silently defaults to Apache-2.0 again (UMB-059)', () => {
  const root = scratchDir();
  const licenseFile = path.join(root, 'Bespoke.txt');
  fs.writeFileSync(licenseFile, BESPOKE_PROPRIETARY_TEXT);
  const target = path.join(root, 'r');
  const res = run(['published-code', '--name', 'x', '--license', licenseFile, target]);
  assert.notEqual(res.status, 0, res.stdout);
  assert.match(res.stderr, /does not match any of the flock's recognized licences, and no --license-id was given/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('new-repo.mjs published-code, --license <a bespoke unidentifiable body file> --license-id "Kolwen Proprietary": SUCCEEDS, the explicit id becomes the badge/NOTICE (UMB-059)', () => {
  const root = scratchDir();
  const licenseFile = path.join(root, 'Bespoke.txt');
  fs.writeFileSync(licenseFile, BESPOKE_PROPRIETARY_TEXT);
  const target = path.join(root, 'r');
  const res = run(['published-code', '--name', 'x', '--license', licenseFile, '--license-id', 'Kolwen-Proprietary', target]);
  assert.equal(res.status, 0, res.stderr);
  const notice = fs.readFileSync(path.join(target, 'NOTICE'), 'utf8');
  const readme = fs.readFileSync(path.join(target, 'README.md'), 'utf8');
  assert.match(notice, /licensed under Kolwen-Proprietary/);
  assert.match(readme, /badge\/license-Kolwen-Proprietary-blue/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('new-repo.mjs published-code, --license-id given but --license is a bare SPDX string (not a file): --license-id is ignored, the ordinary UMB-058 contradiction check still runs (UMB-059 scope boundary)', () => {
  // --license-id is meaningful only alongside a --license FILE whose body
  // identifyLicense() cannot recognize (per the usage comment this unit updated).
  // Passing it beside a bare string must not accidentally suppress UMB-058's own
  // contradiction refusal.
  const target = path.join(scratchDir(), 'r');
  const res = run(['published-code', '--name', 'x', '--license', 'MIT', '--license-id', 'Whatever', target]);
  assert.notEqual(res.status, 0, res.stdout);
  assert.match(res.stderr, /contradicts .*LICENSE's own body, identified as Apache-2\.0/);
  fs.rmSync(path.dirname(target), { recursive: true, force: true });
});

// ---------------------------------------------------------------------------------
// UMB-062 item 2: templates/repo-settings.private-working.json no longer claims
// allow_auto_merge is settable on this org's plan. A pure data-shape test -- no
// network, no mock -- proving the JSON itself, not the REST call, since applySettings/
// diffSettings have no existing test infrastructure to mock a GitHub API response
// against (pre-existing gap, not one this item introduces) and this item's own
// change is a two-line print branch reading straight off this JSON's own shape.

const SETTINGS_PATH = path.join(path.dirname(SCRIPT), '..', 'templates', 'repo-settings.private-working.json');

test('repo-settings.private-working.json: allow_auto_merge is NOT inside repoPatch -- a regression guard against silently re-adding the field GitHub ignores on this plan (UMB-062)', () => {
  const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
  assert.ok(!('allow_auto_merge' in settings.repoPatch), 'allow_auto_merge must not live inside repoPatch -- a free-org PRIVATE repo silently ignores it there (measured on Chotmeter and Bankfire, 2026-09-04)');
});

test('repo-settings.private-working.json: allowAutoMerge is encoded as an N/A-with-reason cell, the same shape as the ruleset row (UMB-062)', () => {
  const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
  assert.equal(settings.allowAutoMerge?.status, 'n/a');
  assert.ok(typeof settings.allowAutoMerge.reason === 'string' && settings.allowAutoMerge.reason.length > 20, 'the N/A cell must carry a real reason, not a placeholder');
});

// ---------------------------------------------------------------------------------
// UMB-127: --apply-settings on a published-code Coal* room also keeps the GitHub `Coal*`
// team (membership at Read + the description derived from the team's repo list), and
// `--dry-run` makes the WHOLE apply write-free. Spawns the REAL script with a fetch stub
// preloaded (NODE_OPTIONS=--import), so the assertion is on the HTTP calls it actually
// made -- never a re-derivation of its logic. The stub is stateful just enough for the
// read-back: a PUT adds the repo to the team list, a PATCH sets the description.

const TEAM_STUB = `
import fs from 'node:fs';
const S = JSON.parse(process.env.STUB_STATE);
globalThis.fetch = async (url, init = {}) => {
  const p = String(url).replace('https://api.github.com', '');
  const method = init.method || 'GET';
  fs.appendFileSync(process.env.STUB_LOG, JSON.stringify({ method, path: p }) + '\\n');
  const reply = (status, obj) => new Response(status === 204 ? null : JSON.stringify(obj), { status });
  if (method === 'GET' && p === '/repos/TheColliery/' + S.repo.name) return reply(200, S.repo);
  if (method === 'GET' && p === '/orgs/TheColliery/teams/coal') return reply(200, { description: S.description });
  if (method === 'GET' && p.startsWith('/orgs/TheColliery/teams/coal/repos')) return reply(200, S.teamRepos);
  // A stateful ruleset store (rulesets canon 2026-09-24): POST creates, PUT replaces, DELETE removes,
  // and a GET of one id returns the stored detail -- so the apply's read-back is a real comparison.
  S.rulesets = S.rulesets || [];
  S.nextId = S.nextId || 900;
  const rsBase = '/repos/TheColliery/' + S.repo.name + '/rulesets';
  if (method === 'GET' && p === rsBase) return reply(200, S.rulesets.map(({ id, name, target, enforcement }) => ({ id, name, target, enforcement })));
  if (method === 'GET' && p.startsWith(rsBase + '/')) { const rs = S.rulesets.find((r) => String(r.id) === p.slice(rsBase.length + 1)); return rs ? reply(200, rs) : reply(404, {}); }
  if (method === 'POST' && p === rsBase) { const rs = { id: S.nextId++, ...JSON.parse(init.body) }; S.rulesets.push(rs); return reply(201, rs); }
  if (method === 'PUT' && p.startsWith(rsBase + '/')) { const id = Number(p.slice(rsBase.length + 1)); S.rulesets = S.rulesets.map((r) => (r.id === id ? { id, ...JSON.parse(init.body) } : r)); return reply(200, S.rulesets.find((r) => r.id === id)); }
  if (method === 'DELETE' && p.startsWith(rsBase + '/')) { const id = Number(p.slice(rsBase.length + 1)); S.rulesets = S.rulesets.filter((r) => r.id !== id); return reply(204); }
  if (method === 'PUT' && p === '/orgs/TheColliery/teams/coal/repos/TheColliery/' + S.repo.name) {
    S.teamRepos = [...S.teamRepos.filter((r) => r.name !== S.repo.name), { ...S.repo, role_name: 'read' }];
    return reply(204);
  }
  if (method === 'PATCH' && p === '/orgs/TheColliery/teams/coal') {
    S.description = JSON.parse(init.body).description;
    return reply(200, { description: S.description });
  }
  return reply(200, {});
};
`;

const STUB_DESC = "The Coal* skill series: CoalMine, CoalTipple, CoalBoard, CoalHearth, CoalFace, CoalWash, CoalLedger. Members hold Read on the seven public rooms (the least role: review requests and mentions); every change still lands through a pull request. This team is the one place a member's Coal* access comes from.";
const STUB_TEAM = [
  ['CoalMine', 1259836955], ['CoalTipple', 1269347378], ['CoalBoard', 1273752906], ['CoalHearth', 1285876949],
  ['CoalFace', 1286819933], ['CoalWash', 1294577372], ['CoalLedger', 1294577413],
].map(([name, id]) => ({ name, id, private: false, role_name: 'read' }));

function runWithTeamStub(args, repo, extra = {}) {
  const dir = scratchDir();
  const stubFile = path.join(dir, 'stub.mjs');
  const logFile = path.join(dir, 'calls.jsonl');
  fs.writeFileSync(stubFile, TEAM_STUB);
  fs.writeFileSync(logFile, '');
  const res = spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      GITHUB_TOKEN: 'stub-token',
      NODE_OPTIONS: `--import=${pathToFileURL(stubFile).href}`,
      STUB_LOG: logFile,
      STUB_STATE: JSON.stringify({ repo, teamRepos: STUB_TEAM, description: STUB_DESC, ...extra }),
    },
  });
  const calls = fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  fs.rmSync(dir, { recursive: true, force: true });
  return { res, calls };
}

const NEW_ROOM = { name: 'CoalNext', id: 1300000000, private: false };

test('new-repo.mjs --apply-settings published-code --dry-run (a NEW Coal* room): sends ZERO writes anywhere -- not the team calls, not the repo PATCH/PUTs -- and names what it would do (UMB-127)', () => {
  const { res, calls } = runWithTeamStub(['--apply-settings', 'published-code', '--repo', 'TheColliery/CoalNext', '--dry-run'], NEW_ROOM);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.deepEqual(calls.filter((c) => c.method !== 'GET'), [], 'dry-run must make no write call');
  assert.match(res.stdout, /coalTeam: DRY-RUN .*PUT \/orgs\/TheColliery\/teams\/coal\/repos\/TheColliery\/CoalNext/);
  assert.match(res.stdout, /repoPatch: DRY-RUN/);
});

test('new-repo.mjs --apply-settings published-code --dry-run (a room already on the team, the LIVE canon): coalTeam IN-SYNC, zero writes (UMB-127)', () => {
  const { res, calls } = runWithTeamStub(['--apply-settings', 'published-code', '--repo', 'TheColliery/CoalMine', '--dry-run'], { name: 'CoalMine', id: 1259836955, private: false });
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.deepEqual(calls.filter((c) => c.method !== 'GET'), []);
  assert.match(res.stdout, /coalTeam: IN-SYNC .*equals the live one \(304 chars\)/);
});

test('new-repo.mjs --apply-settings published-code (LIVE, a NEW Coal* room): PUT the team membership, then PATCH the description, then the read-back passes (UMB-127)', () => {
  const { res, calls } = runWithTeamStub(['--apply-settings', 'published-code', '--repo', 'TheColliery/CoalNext'], NEW_ROOM);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  const teamWrites = calls.filter((c) => c.method !== 'GET' && c.path.startsWith('/orgs/'));
  assert.deepEqual(teamWrites.map((c) => `${c.method} ${c.path}`), [
    'PUT /orgs/TheColliery/teams/coal/repos/TheColliery/CoalNext',
    'PATCH /orgs/TheColliery/teams/coal',
  ]);
  assert.match(res.stdout, /coalTeam: ok/);
});

test('new-repo.mjs --apply-settings published-code on a NON-Coal repo, and any other kind on a Coal name: no team call at all (UMB-127)', () => {
  const a = runWithTeamStub(['--apply-settings', 'published-code', '--repo', 'TheColliery/Kolwen', '--dry-run'], { name: 'Kolwen', id: 5, private: false });
  assert.equal(a.res.status, 0, a.res.stdout + a.res.stderr);
  assert.deepEqual(a.calls.filter((c) => c.path.includes('/teams/')), []);
  assert.match(a.res.stdout, /coalTeam: N\/A/);
  const b = runWithTeamStub(['--apply-settings', 'article', '--repo', 'TheColliery/CoalNext', '--dry-run'], NEW_ROOM);
  assert.equal(b.res.status, 0, b.res.stdout + b.res.stderr);
  assert.deepEqual(b.calls.filter((c) => c.path.includes('/teams/')), []);
  assert.doesNotMatch(b.res.stdout, /coalTeam/);
});

// ---------------------------------------------------------------------------------
// Rulesets canon (owner 2026-09-24): --apply-settings --only rulesets CREATES main-guard and
// tag-immutable (empty bypass), CONVERGES an admin-bypass main-guard, deletes the GitHub-created
// disabled Copilot leftover, and never touches the required-status-check gate. Same fetch-stub
// method as the coalTeam tests above: the assertion is on the HTTP calls the real script made.

const CANON_BRANCH = { name: 'main-guard', target: 'branch', enforcement: 'active', conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } }, rules: [{ type: 'deletion' }, { type: 'non_fast_forward' }], bypass_actors: [] };
const CANON_TAG = { name: 'tag-immutable', target: 'tag', enforcement: 'active', conditions: { ref_name: { include: ['refs/tags/**'], exclude: [] } }, rules: [{ type: 'update' }, { type: 'deletion' }, { type: 'non_fast_forward' }], bypass_actors: [] };
const ADMIN_BYPASS = [{ actor_id: 5, actor_type: 'RepositoryRole', bypass_mode: 'always' }];
const GATE = { id: 111, name: 'dependabot-auto-merge-gate', target: 'branch', enforcement: 'active', conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } }, rules: [{ type: 'required_status_checks' }], bypass_actors: ADMIN_BYPASS };
const LEFTOVER = { id: 222, name: 'Code Quality Copilot review for default branch', target: 'branch', enforcement: 'disabled', conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } }, rules: [{ type: 'copilot_code_review' }], bypass_actors: [] };
const ROOM = { name: 'CoalNext', id: 1300000000, private: false, default_branch: 'main' };
const writes = (calls) => calls.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.path}`);

test('--apply-settings --only rulesets (LIVE, a repo with no rulesets): POSTs main-guard and tag-immutable with an EMPTY bypass list, reads both back, touches nothing else (rulesets canon)', () => {
  const { res, calls } = runWithTeamStub(['--apply-settings', 'published-code', '--repo', 'TheColliery/CoalNext', '--only', 'rulesets'], ROOM);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.deepEqual(writes(calls), ['POST /repos/TheColliery/CoalNext/rulesets', 'POST /repos/TheColliery/CoalNext/rulesets'], 'no repo PATCH, no team call, no PUT: --only rulesets narrows the whole apply');
  assert.match(res.stdout, /ruleset: ok \(HTTP 201, created "main-guard", read back identical\)/);
  assert.match(res.stdout, /tagRuleset: ok \(HTTP 201, created "tag-immutable", read back identical\)/);
  assert.match(res.stdout, /leftoverRulesets: IN-SYNC/);
  assert.doesNotMatch(res.stdout, /repoPatch|coalTeam|secretScanning/);
});

test('--apply-settings --only rulesets (an admin-bypass main-guard + the gate + a disabled Copilot leftover): PUTs main-guard to an empty bypass, DELETEs the leftover, NEVER writes the gate (rulesets canon)', () => {
  const adminGuard = { id: 333, ...CANON_BRANCH, bypass_actors: ADMIN_BYPASS };
  const { res, calls } = runWithTeamStub(['--apply-settings', 'published-code', '--repo', 'TheColliery/CoalNext', '--only', 'rulesets'], ROOM, { rulesets: [GATE, adminGuard, LEFTOVER] });
  assert.equal(res.status, 0, res.stdout + res.stderr);
  const w = writes(calls);
  assert.ok(w.includes('PUT /repos/TheColliery/CoalNext/rulesets/333'), 'the admin-bypass main-guard is converged in place: ' + w);
  assert.ok(w.includes('DELETE /repos/TheColliery/CoalNext/rulesets/222'), 'the disabled Copilot leftover is deleted: ' + w);
  assert.ok(!w.some((x) => x.endsWith('/rulesets/111')), 'the required-status-check gate is never written: ' + w);
  assert.match(res.stdout, /ruleset: ok \(HTTP 200, converged "main-guard", read back identical\)/);
  assert.match(res.stdout, /tagRuleset: ok \(HTTP 201, created "tag-immutable"/);
});

test('--apply-settings --only rulesets (the canon already held, gate present): IN-SYNC on both, ZERO writes -- idempotent (rulesets canon)', () => {
  const { res, calls } = runWithTeamStub(['--apply-settings', 'published-code', '--repo', 'TheColliery/CoalNext', '--only', 'rulesets'], ROOM, { rulesets: [GATE, { id: 1, ...CANON_BRANCH }, { id: 2, ...CANON_TAG }] });
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.deepEqual(writes(calls), []);
  assert.match(res.stdout, /ruleset: IN-SYNC/);
  assert.match(res.stdout, /tagRuleset: IN-SYNC/);
});

test('--apply-settings --only rulesets --dry-run: zero writes, every planned write named as DRY-RUN (rulesets canon)', () => {
  const { res, calls } = runWithTeamStub(['--apply-settings', 'published-code', '--repo', 'TheColliery/CoalNext', '--only', 'rulesets', '--dry-run'], ROOM, { rulesets: [{ id: 333, ...CANON_BRANCH, bypass_actors: ADMIN_BYPASS }, LEFTOVER] });
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.deepEqual(writes(calls), []);
  assert.match(res.stdout, /ruleset: DRY-RUN \(would PUT .*rulesets\/333/);
  assert.match(res.stdout, /tagRuleset: DRY-RUN \(would POST/);
  assert.match(res.stdout, /leftoverRulesets: DRY-RUN \(would DELETE .*rulesets\/222/);
});

test('--apply-settings --only rulesets (a same-named ruleset that carries a rule the canon does not name): PENDING, never overwritten (rulesets canon)', () => {
  const heavy = { id: 444, ...CANON_BRANCH, rules: [{ type: 'deletion' }, { type: 'non_fast_forward' }, { type: 'required_status_checks' }], bypass_actors: ADMIN_BYPASS };
  const { res, calls } = runWithTeamStub(['--apply-settings', 'published-code', '--repo', 'TheColliery/CoalNext', '--only', 'rulesets'], ROOM, { rulesets: [heavy] });
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.ok(!writes(calls).some((x) => x.endsWith('/rulesets/444')), 'the heavier ruleset is not PUT over');
  assert.match(res.stdout, /ruleset: PENDING \(.*required_status_checks/);
});

test('--apply-settings --only <anything but rulesets> fails loud; a private-working repo reports both ruleset surfaces N/A with the reason and writes nothing (rulesets canon)', () => {
  const bad = runWithTeamStub(['--apply-settings', 'published-code', '--repo', 'TheColliery/CoalNext', '--only', 'team'], ROOM);
  assert.notEqual(bad.res.status, 0);
  assert.match(bad.res.stderr, /--only takes "rulesets"/);
  const priv = runWithTeamStub(['--apply-settings', 'private-working', '--repo', 'TheColliery/Chotmeter', '--only', 'rulesets'], { name: 'Chotmeter', id: 7, private: true, default_branch: 'main' });
  assert.equal(priv.res.status, 0, priv.res.stdout + priv.res.stderr);
  assert.deepEqual(writes(priv.calls), []);
  assert.match(priv.res.stdout, /ruleset: N\/A \(.*403/);
  assert.match(priv.res.stdout, /tagRuleset: N\/A/);
});

test('the three settings specs encode the rulesets canon: an EMPTY bypass on main-guard, a tag-immutable spec on the public kinds, N/A on private-working (rulesets canon)', () => {
  const dir = path.join(path.dirname(SCRIPT), '..', 'templates');
  for (const kind of ['published-code', 'article']) {
    const s = JSON.parse(fs.readFileSync(path.join(dir, `repo-settings.${kind}.json`), 'utf8'));
    assert.deepEqual(s.ruleset.bypass_actors, [], kind + ': main-guard bypass');
    assert.deepEqual(s.tagRuleset.conditions.ref_name.include, ['refs/tags/**']);
    assert.deepEqual(s.tagRuleset.rules.map((r) => r.type).sort(), ['deletion', 'non_fast_forward', 'update']);
    assert.deepEqual(s.tagRuleset.bypass_actors, []);
    assert.equal(s.leftoverRulesets[0].name, 'Code Quality Copilot review for default branch');
  }
  const p = JSON.parse(fs.readFileSync(path.join(dir, 'repo-settings.private-working.json'), 'utf8'));
  assert.equal(p.ruleset.status, 'n/a');
  assert.equal(p.tagRuleset.status, 'n/a');
});
