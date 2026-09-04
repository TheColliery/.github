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
