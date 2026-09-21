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
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

// UMB-112 row 26: a fetch with no timeout inside the wait loop lets ONE hung request outlive
// the whole --wait budget (the loop only re-checks the clock BETWEEN requests). Source-text guard,
// same reason as above: the script cannot run unfilled. The behaviour was also proved once by a
// hung-socket spawn at authoring time (recorded in the UMB-112 return, not shipped).
test('post-deploy-check.mjs: every fetch is bounded by the REMAINING wait budget (AbortSignal.timeout), never unbounded', () => {
  const src = readFileSync(SCRIPT, 'utf8');
  assert.match(src, /fetch\([^;]*signal:\s*AbortSignal\.timeout\(/, 'the probe fetch must carry signal: AbortSignal.timeout(<remaining budget>)');
  assert.match(src, /remainingMs/, 'the timeout must derive from the remaining budget, not a constant that can exceed it');
});

test('post-deploy-check.mjs: the loop still exits on match via its own internal break, not via the while-condition', () => {
  // The property that makes the removed clause provably dead code: `if (matched) break;`
  // must still be the mechanism that ends the loop on a match, immediately after the
  // inner for-loop, inside the while body.
  const src = readFileSync(SCRIPT, 'utf8');
  assert.match(src, /if\s*\(\s*matched\s*\)\s*break\s*;/, 'the internal break-on-match must still exist -- it is what makes the while-condition\'s own matched-check redundant');
});

// UMB-112 residue (7): the pause BETWEEN retry rounds was a constant 15 s, so a wait budget shorter
// than that (or a round that ends near the deadline) overshot --wait by up to 15 s -- the exact
// unbounded-wait class row 26 closed for the fetch. This one is a spawn test on a FILLED copy of the
// script (placeholders replaced in a temp dir) with a stub preloaded that (a) answers every fetch
// with a page that never matches and (b) records each setTimeout delay the script asks for and
// fires it at once, so the assertion is on the requested delays, not on wall-clock. Red before the
// fix: every recorded delay is 15000, against a 1000 ms budget.
test('post-deploy-check.mjs: the pause between retry rounds never exceeds the remaining wait budget (spawn, filled copy)', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pdc-'));
  try {
    const assets = path.join(dir, 'public');
    mkdirSync(assets);
    writeFileSync(path.join(assets, 'index.html'), 'the committed page');
    let src = readFileSync(SCRIPT, 'utf8');
    src = src.replaceAll('{{ASSETS_DIR}}', assets.replaceAll('\\', '/'))
      .replaceAll('{{PLACEHOLDER-primary-domain}}', 'primary.invalid')
      .replaceAll('{{PLACEHOLDER-fallback-workers-dev-domain}}', 'fallback.invalid');
    const filled = path.join(dir, 'post-deploy-check.mjs');
    writeFileSync(filled, src);
    const log = path.join(dir, 'delays.log');
    const stub = path.join(dir, 'stub.mjs');
    writeFileSync(stub, [
      "import fs from 'node:fs';",
      'const realSetTimeout = globalThis.setTimeout;',
      'globalThis.setTimeout = (fn, ms, ...a) => { fs.appendFileSync(process.env.STUB_LOG, String(ms) + "\\n"); return realSetTimeout(fn, 0, ...a); };',
      "globalThis.fetch = async () => ({ ok: true, text: async () => 'a stale page', arrayBuffer: async () => new ArrayBuffer(0) });",
      '',
    ].join('\n'));
    const res = spawnSync(process.execPath, [filled, '--wait', '1'], {
      encoding: 'utf8',
      env: { ...process.env, NODE_OPTIONS: '--import=' + pathToFileURL(stub).href, STUB_LOG: log },
    });
    assert.equal(res.status, 1, 'a page that never matches must fail loud, exit 1: ' + res.stderr + res.stdout);
    assert.match(res.stderr, /still not published after/);
    assert.ok(existsSync(log), 'the retry loop must have paused at least once');
    const delays = readFileSync(log, 'utf8').split('\n').filter(Boolean).map(Number);
    assert.ok(delays.length >= 1);
    assert.ok(Math.max(...delays) <= 1000, 'a pause longer than the 1000 ms budget was requested: ' + Math.max(...delays));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
