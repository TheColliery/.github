import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { isLicenseStub, STUB_MAX_LINES, identifyLicense, normalizeLicenseId, licenseIdentityMismatches } from './lib/license-check-lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const MIT_TEXT = `MIT License

Copyright (c) 2026 Example Holder

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

test('MIT_TEXT fixture is genuinely short -- the fixture must sit inside the collision band it exists to test', () => {
  const lines = MIT_TEXT.split(/\r?\n/).filter((l) => l.trim() !== '').length;
  assert.ok(lines <= STUB_MAX_LINES, `fixture is ${lines} non-blank lines, expected <= ${STUB_MAX_LINES}`);
});

test('isLicenseStub: a real MIT LICENSE (short but substantive) is NOT a stub -- the collision case this check exists to survive', () => {
  assert.equal(isLicenseStub(MIT_TEXT), false);
});

test('isLicenseStub: the actual measured templates/article/LICENSE stub IS a stub', () => {
  const content = fs.readFileSync(path.join(HERE, '..', 'templates', 'article', 'LICENSE'), 'utf8');
  assert.equal(isLicenseStub(content), true);
});

test('isLicenseStub: the actual templates/published-code/LICENSE (full Apache-2.0) is NOT a stub', () => {
  const content = fs.readFileSync(path.join(HERE, '..', 'templates', 'published-code', 'LICENSE'), 'utf8');
  assert.equal(isLicenseStub(content), false);
});

test('isLicenseStub: the actual templates/private-working/LICENSE (full Apache-2.0) is NOT a stub', () => {
  const content = fs.readFileSync(path.join(HERE, '..', 'templates', 'private-working', 'LICENSE'), 'utf8');
  assert.equal(isLicenseStub(content), false);
});

test('isLicenseStub: empty content is a stub', () => {
  assert.equal(isLicenseStub(''), true);
  assert.equal(isLicenseStub('   \n  \n'), true);
});

test('isLicenseStub: a bare name+URL pointer with no legal language is a stub', () => {
  assert.equal(isLicenseStub('Licensed under Foo License.\nSee https://example.com/foo for the full text.\n'), true);
});

test('isLicenseStub: a long file with no substantive marker is still NOT flagged (length escape) -- a defensible false-negative bound, never a false-positive on a real long text', () => {
  const longButMarkerless = Array.from({ length: STUB_MAX_LINES + 5 }, (_, i) => `line ${i}`).join('\n');
  assert.equal(isLicenseStub(longButMarkerless), false);
});

// ---------------------------------------------------------------------------------
// identifyLicense (UMB-058) -- the flock's own real LICENSE files as fixtures, per
// the dispatch. `templates/published-code/LICENSE` is read live (same repo, safe in
// CI, where a sibling room's file is not checked out at all). The other four
// signatures are verbatim EXCERPTS of the real distinctive header each room's own
// LICENSE actually carries -- read live 2026-09-04 and kept inline, never read
// cross-repo, so this test stays hermetic (`.github`'s own CI checkout has no
// CoalWorks/LLMWorks/Articles siblings on disk at all).

const REAL_APACHE_TEXT = fs.readFileSync(path.join(HERE, '..', 'templates', 'published-code', 'LICENSE'), 'utf8');

// sourced: Articles/ChotUnitDatum/LICENSE lines 1, 57, 59 (real file, read 2026-09-04)
const CC_BY_4_EXCERPT = [
  'Attribution 4.0 International',
  '',
  '=======================================================================',
  '',
  'Using Creative Commons Public Licenses',
  '',
  'Creative Commons Attribution 4.0 International Public License',
  '',
  'By exercising the Licensed Rights (defined below), You accept and agree',
].join('\n');

// sourced: Articles/GachaRateDesignDatum/LICENSE lines 1, 57-58 (real file, read 2026-09-04)
const CC_BY_NC_ND_4_EXCERPT = [
  'Attribution-NonCommercial-NoDerivatives 4.0 International',
  '',
  '=======================================================================',
  '',
  'Creative Commons Attribution-NonCommercial-NoDerivatives 4.0',
  'International Public License',
].join('\n');

// sourced: LLMWorks/Chotmeter/LICENSE lines 1-2 (real file, read 2026-09-04)
const FSL_EXCERPT = [
  '# Functional Source License, Version 1.1, ALv2 Future License',
  '',
  '## Abbreviation',
  'FSL-1.1-ALv2',
].join('\n');

// The real defect class this ordering exists to prevent: Chotmeter's own live LICENSE
// embeds the FULL Apache-2.0 legalcode verbatim inside its own "Change License" clause
// (effective on the FSL's own two-year anniversary) -- so a genuine FSL file ALSO
// contains "Apache License" + "Version 2.0" and must still identify as FSL, not
// Apache. Built from two real local files, not reproduced by hand.
const FSL_WITH_EMBEDDED_APACHE = `${FSL_EXCERPT}\n\n${REAL_APACHE_TEXT}`;

test('identifyLicense: the actual templates/published-code/LICENSE (real Apache-2.0 text) -> Apache-2.0', () => {
  assert.equal(identifyLicense(REAL_APACHE_TEXT), 'Apache-2.0');
});

test('identifyLicense: a real MIT LICENSE -> MIT', () => {
  assert.equal(identifyLicense(MIT_TEXT), 'MIT');
});

test('identifyLicense: Creative Commons Attribution 4.0 International (excerpt of the real ChotUnitDatum LICENSE) -> CC-BY-4.0', () => {
  assert.equal(identifyLicense(CC_BY_4_EXCERPT), 'CC-BY-4.0');
});

test('identifyLicense: Attribution-NonCommercial-NoDerivatives 4.0 (excerpt of the real GachaRateDesignDatum LICENSE) -> CC-BY-NC-ND-4.0', () => {
  assert.equal(identifyLicense(CC_BY_NC_ND_4_EXCERPT), 'CC-BY-NC-ND-4.0');
});

test('identifyLicense: Functional Source License 1.1 header (excerpt of the real Chotmeter LICENSE) -> FSL-1.1-Apache-2.0', () => {
  assert.equal(identifyLicense(FSL_EXCERPT), 'FSL-1.1-Apache-2.0');
});

test('identifyLicense: ORDER IS LOAD-BEARING -- an FSL body with the full Apache-2.0 text embedded (the real Chotmeter shape) still identifies as FSL, never Apache', () => {
  assert.equal(identifyLicense(FSL_WITH_EMBEDDED_APACHE), 'FSL-1.1-Apache-2.0');
});

test('identifyLicense: an unrecognized bespoke proprietary notice (the real Kolwen/CoalKiln shape) -> null, never a false match', () => {
  assert.equal(identifyLicense('Kolwen — Repository License\n\nCopyright (c) 2026 HetCreep / TheColliery. All rights reserved.\n'), null);
});

test('identifyLicense: empty/missing content -> null', () => {
  assert.equal(identifyLicense(''), null);
  assert.equal(identifyLicense(null), null);
});

test('normalizeLicenseId: the shields.io-escaped live form and the SPDX-shaped form of the same licence normalize equal', () => {
  // Real live values, both seen in this session: `Apache_2.0` (shields.io's own
  // literal-space escape, shipped in every existing room's README) vs `Apache-2.0`
  // (the SPDX id new-repo.mjs's own --license flag takes).
  assert.equal(normalizeLicenseId('Apache_2.0'), normalizeLicenseId('Apache-2.0'));
  assert.equal(normalizeLicenseId('CC-BY-NC-ND-4.0'), normalizeLicenseId('CC_BY_NC_ND_4.0'));
});

test('normalizeLicenseId: two genuinely different licences do NOT normalize equal', () => {
  assert.notEqual(normalizeLicenseId('Apache-2.0'), normalizeLicenseId('MIT'));
});

// ---------------------------------------------------------------------------------
// licenseIdentityMismatches (UMB-058) -- README badge and NOTICE lines in the exact
// shape the real templates/live rooms actually ship (verified live this sitting:
// every real Coal* room's README badge reads `badge/license-Apache_2.0-blue`,
// shields.io's own underscore escaping; templates/published-code/NOTICE reads
// "...is licensed under {{LICENSE_BADGE}}.").

const REAL_README_BADGE_MATCHING = '![license](https://img.shields.io/badge/license-Apache_2.0-blue)\n';
const REAL_README_BADGE_MIT = '![license](https://img.shields.io/badge/license-MIT-blue)\n';
const REAL_NOTICE_MATCHING = 'x\nCopyright 2026 HetCreep\n\nThis product is part of the TheColliery series and is licensed under Apache-2.0.\n';
const REAL_NOTICE_MIT = 'x\nCopyright 2026 HetCreep\n\nThis product is part of the TheColliery series and is licensed under MIT.\n';

test('licenseIdentityMismatches: a real Apache-2.0 body with a matching badge (shields.io underscore form) and matching NOTICE -> no mismatches', () => {
  assert.deepEqual(licenseIdentityMismatches(REAL_APACHE_TEXT, REAL_README_BADGE_MATCHING, REAL_NOTICE_MATCHING), []);
});

test('licenseIdentityMismatches: a real Apache-2.0 body with an MIT badge -> one mismatch naming the README badge', () => {
  const result = licenseIdentityMismatches(REAL_APACHE_TEXT, REAL_README_BADGE_MIT, REAL_NOTICE_MATCHING);
  assert.equal(result.length, 1);
  assert.match(result[0], /README badge says "MIT", body identifies as Apache-2\.0/);
});

test('licenseIdentityMismatches: a real Apache-2.0 body with an MIT NOTICE -> one mismatch naming NOTICE', () => {
  const result = licenseIdentityMismatches(REAL_APACHE_TEXT, REAL_README_BADGE_MATCHING, REAL_NOTICE_MIT);
  assert.equal(result.length, 1);
  assert.match(result[0], /NOTICE says "MIT", body identifies as Apache-2\.0/);
});

test('licenseIdentityMismatches: both surfaces wrong -> two mismatches, one per surface', () => {
  const result = licenseIdentityMismatches(REAL_APACHE_TEXT, REAL_README_BADGE_MIT, REAL_NOTICE_MIT);
  assert.equal(result.length, 2);
});

test('licenseIdentityMismatches: an unidentifiable body (the real Kolwen/CoalKiln shape) -> no mismatches, even with a badge present -- nothing to compare a claim against', () => {
  const bespoke = 'Kolwen — Repository License\n\nCopyright (c) 2026 HetCreep / TheColliery. All rights reserved.\n';
  assert.deepEqual(licenseIdentityMismatches(bespoke, REAL_README_BADGE_MIT, REAL_NOTICE_MIT), []);
});

test('licenseIdentityMismatches: absent README/NOTICE (empty strings, the real private-working shape -- no NOTICE shipped) -> no mismatches, an absent surface has nothing to contradict', () => {
  assert.deepEqual(licenseIdentityMismatches(REAL_APACHE_TEXT, '', ''), []);
});
