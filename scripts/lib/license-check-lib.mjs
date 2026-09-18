// license-check-lib.mjs — detects a LICENSE file that merely POINTS at a license (a
// name + an external URL) rather than reproducing the license's own text, per the
// owner's standing law: LICENSE = full text per part, never SPDX-only, never a stub
// (UMB-054 item 3; the measured defect is templates/article/LICENSE, a 19-line pointer
// to CC BY-NC-ND 4.0's legalcode rather than the legalcode itself).
//
// TWO conditions, ANDed -- line count alone cannot safely tell a short STUB from a
// short REAL license. MIT's own canonical full text commonly renders at ~19-21 lines,
// almost exactly as short as the measured 19-line stub this check exists to catch. A
// bare length cutoff would misclassify a genuine MIT LICENSE as a stub. So a file is a
// STUB only when it is BOTH short (<= STUB_MAX_LINES) AND carries none of the
// substantive grant/disclaimer language every real license text uses even in its
// shortest forms (MIT: "Permission is hereby granted" + "WITHOUT WARRANTY"; BSD:
// "Redistribution and use"; ISC: "Permission to use, copy" + "WARRANTY"; Apache/CC:
// both, at length). A name-and-URL pointer uses none of these words.

// The measured stub is 19L; MIT's own canonical text commonly renders at ~19-21L --
// this clears that band with margin while staying far below every real full legalcode
// already shipped in this flock (Apache-2.0 201L, CC BY 4.0 396L).
export const STUB_MAX_LINES = 25;

// Exact GRANT-shaped phrases, not bare keywords -- a bare "permission"/"redistribution"
// false-matched the article stub itself (2026-09-04, self-caught by this file's own
// red-first test): its restriction clause reads "...commercial use, adaptation, or
// redistribution of this document" and "...without permission", which contain the
// bare words with the OPPOSITE meaning a real grant uses them for. Every phrase below
// is the actual multi-word idiom a real license's grant/disclaimer clause uses,
// specific enough that a restriction sentence mentioning the same bare words does not
// collide with it.
const SUBSTANTIVE_MARKER = /permission is hereby granted|permission to use|redistribution and use|hereby grants?|warrant(?:y|ies)|indemnif/i;

/** True when `content` looks like a LICENSE stub: a short pointer with no reproduced terms. */
export function isLicenseStub(content) {
  if (!content || !content.trim()) return true; // an empty/missing body is the extreme stub case
  const lines = content.split(/\r?\n/).filter((l) => l.trim() !== '').length;
  if (lines > STUB_MAX_LINES) return false; // long enough to very likely be a real reproduced text
  return !SUBSTANTIVE_MARKER.test(content);
}

// UMB-058: the licence-identity triangle -- the README badge, NOTICE, and the LICENSE
// BODY can each name a different licence with nothing to catch the disagreement. This
// identifies the licence from the BODY the same way a human would: a distinctive
// phrase/first-line per licence, exactly the five the flock's own portfolio carries
// today (AGENTS.md "LICENSE = A PORTFOLIO"). Returns null for anything else (a bespoke
// proprietary notice, e.g. Kolwen's or CoalKiln's own repository license) -- an
// unrecognized body is never treated as a contradiction, only a recognized one is.
//
// ORDER IS LOAD-BEARING, not stylistic: FSL-1.1-Apache-2.0's own body embeds the FULL
// Apache-2.0 legalcode verbatim (its "Change License," effective after the FSL's own
// two-year window) -- so checking Apache-2.0 before FSL would misidentify every real
// Chotmeter-shaped LICENSE as plain Apache-2.0. FSL's own header phrase is checked
// first and returns immediately, before the Apache check ever runs. CC-BY-NC-ND-4.0
// is checked before the plain CC-BY-4.0 phrase for the same reason (the more specific
// signature first), though the two source texts do not actually collide (verified
// against both real fixtures: neither's signature phrase appears in the other's file).
const LICENSE_SIGNATURES = [
  ['FSL-1.1-Apache-2.0', (c) => /Functional Source License,\s*Version 1\.1/i.test(c)],
  ['CC-BY-NC-ND-4.0', (c) => /Attribution-NonCommercial-NoDerivatives 4\.0 International/i.test(c)],
  ['CC-BY-4.0', (c) => /Creative Commons Attribution 4\.0 International/i.test(c)],
  ['Apache-2.0', (c) => /Apache License/i.test(c) && /Version 2\.0/i.test(c)],
  ['MIT', (c) => /^MIT License\b/im.test(c)],
];

/**
 * Identifies a licence from its BODY text via a distinctive phrase per licence.
 * Returns the canonical id ('Apache-2.0', 'MIT', 'CC-BY-4.0', 'CC-BY-NC-ND-4.0',
 * 'FSL-1.1-Apache-2.0') or `null` when the body matches none of the five (a bespoke
 * proprietary notice, an empty file, or a stub with no reproduced legal text).
 */
export function identifyLicense(content) {
  if (!content) return null;
  for (const [id, test] of LICENSE_SIGNATURES) {
    if (test(content)) return id;
  }
  return null;
}

// A badge/NOTICE value and an identifyLicense() id name the SAME licence in different
// spellings across this repo's own live estate -- shields.io escaping uses `Apache_2.0`
// (underscore, a literal-space escape) where the SPDX-shaped id is `Apache-2.0` (hyphen).
// Comparing either form to the other needs both stripped of separators and case before
// the comparison means anything.
export function normalizeLicenseId(id) {
  return String(id || '').toLowerCase().replace(/[-_\s]+/g, '');
}

const BADGE_RE = /badge\/license-(.+?)-blue\b/;
// GREEDY, not lazy: a licence id itself commonly contains a literal "." (Apache-2.0's
// version number) -- a lazy `.+?\.` stops at the FIRST period it meets, truncating
// "Apache-2.0" to "Apache-2". Greedy backtracks from the end of the line to the LAST
// period (the sentence's own terminator), correctly capturing the whole id.
const NOTICE_RE = /is licensed under (.+)\.\s*$/m;

/**
 * The licence-identity triangle (UMB-058): a LICENSE body that IS identifiable, but a
 * README badge and/or NOTICE that name a DIFFERENT licence than the body actually
 * carries. Pure -- takes the three surfaces' own text content (never touches fs),
 * so a caller (skeleton-check.mjs's gate, or a future one) owns reading the files.
 * `readmeContent`/`noticeContent` may be `''` (the surface is absent) -- an absent
 * surface has nothing to contradict and is silently skipped, never flagged.
 *
 * Returns a list of mismatch description strings -- empty when the body is
 * unidentifiable (nothing to compare a claim against) or every surface found agrees.
 */
export function licenseIdentityMismatches(licenseContent, readmeContent, noticeContent) {
  const identified = identifyLicense(licenseContent);
  if (!identified) return [];
  const mismatches = [];

  const badgeMatch = readmeContent && readmeContent.match(BADGE_RE);
  if (badgeMatch && normalizeLicenseId(badgeMatch[1]) !== normalizeLicenseId(identified)) {
    mismatches.push(`README badge says "${badgeMatch[1]}", body identifies as ${identified}`);
  }

  const noticeMatch = noticeContent && noticeContent.match(NOTICE_RE);
  if (noticeMatch && normalizeLicenseId(noticeMatch[1]) !== normalizeLicenseId(identified)) {
    mismatches.push(`NOTICE says "${noticeMatch[1]}", body identifies as ${identified}`);
  }

  return mismatches;
}
