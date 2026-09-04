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

test('new-repo.mjs article, --license <a real MIT body file> (licenseIsFile=true): SUCCEEDS -- the identity check is scoped to the SPDX-string case only, never the file-substitution case (UMB-058)', () => {
  // A --license FILE already replaces the body outright; there is no separate badge
  // claim to contradict it (the badge falls back to the hardcoded default when a
  // file is used -- a separate, pre-existing, undocumented-badge limitation this
  // item does not extend the check to cover, named here rather than silently
  // widening scope).
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
  fs.rmSync(root, { recursive: true, force: true });
});
