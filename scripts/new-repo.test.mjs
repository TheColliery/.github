// Hermetic spawn tests for new-repo.mjs's LICENSE-stub refusal (UMB-054 item 3).
// Per testing.md's required test type for a CLI entry: spawn the REAL file, assert
// exit code + the actual on-disk state effect — never re-derive its logic by import.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'new-repo.mjs');

function run(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
}

function scratchDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'new-repo-test-'));
}

test('new-repo.mjs article, no --license file: REFUSES (non-zero exit, stub named)', () => {
  const target = path.join(scratchDir(), 'r');
  const res = run(['article', '--name', 'x', target]);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /licence STUB/);
  // The state effect this refusal produces: LICENSE stays on disk as the stub, not
  // silently absent -- a human re-reading the target sees exactly what tripped it.
  assert.ok(fs.existsSync(path.join(target, 'LICENSE')));
  fs.rmSync(path.dirname(target), { recursive: true, force: true });
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

test('new-repo.mjs article, --license as a bare SPDX string (not a file): still refuses, badge falls back cleanly', () => {
  // A bare "MIT" string is not an existing file path, so it is read as the OLD
  // LICENSE_BADGE-only meaning -- the LICENSE body is never touched and stays the stub.
  const target = path.join(scratchDir(), 'r');
  const res = run(['article', '--name', 'x', '--license', 'MIT', target]);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /licence STUB/);
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
