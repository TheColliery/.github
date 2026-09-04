// Regression guard for the CodeQL js/trivial-conditional defect (alert #13 in Kolwen,
// fixed there in commit 9c834a1, ported verbatim here). Ships WITH the template so a
// future edit to this file's own loop cannot silently reintroduce the same class of
// defect in a scaffolded room -- this file is copied by new-repo.mjs alongside the
// script it guards.
//
// This is a SOURCE-TEXT test, not a spawn test: the script's own module-level consts
// (ASSETS_DIR, ORIGINS) are still {{PLACEHOLDER}} tokens at template-authoring time
// (before new-repo.mjs fills them for a real room), so a hermetic spawn test cannot run
// here without first templating a filled copy -- exactly what a one-off author-time
// verification does (not shipped, since it needs a mock origin server and a real
// assets dir that only exist at test-authoring time). The property Kolwen's own fix
// commit re-proved with that heavier verification (a stale page waits out the full
// budget then fails loud; a matching page exits in under a second) is UNCHANGED by
// this edit -- CodeQL's own diagnosis is that `!matched` never influenced control flow
// at all, since `if (matched) break;` already exits the loop the instant `matched`
// becomes true, before the while-condition is ever re-evaluated with it true. So this
// guard checks the one thing that DID change and must never silently regress: the
// exact flagged pattern is gone from the shipped source.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, 'post-deploy-check.mjs');

test('post-deploy-check.mjs: the CodeQL #13 trivial-conditional pattern (`while (!matched && ...)`) does not reappear', () => {
  const src = readFileSync(SCRIPT, 'utf8');
  assert.doesNotMatch(
    src,
    /while\s*\(\s*!matched\s*&&/,
    'the exact pattern CodeQL flagged as alert #13 (js/trivial-conditional, "this negation always evaluates to true") must not reappear -- see Kolwen commit 9c834a1',
  );
});

test('post-deploy-check.mjs: the loop still exits on match via its own internal break, not via the while-condition', () => {
  // The property that makes the removed clause provably dead code: `if (matched) break;`
  // must still be the mechanism that ends the loop on a match, immediately after the
  // inner for-loop, inside the while body.
  const src = readFileSync(SCRIPT, 'utf8');
  assert.match(src, /if\s*\(\s*matched\s*\)\s*break\s*;/, 'the internal break-on-match must still exist -- it is what makes the while-condition\'s own matched-check redundant');
});
