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

test('new-repo.mjs article, --license as a bare SPDX string (not a file): still refuses, badge falls back cleanly', () => {
  // A bare "MIT" string is not an existing file path, so it is read as the OLD
  // LICENSE_BADGE-only meaning -- the LICENSE body is never touched and stays the stub.
  const target = path.join(scratchDir(), 'r');
  const res = run(['article', '--name', 'x', '--license', 'MIT', target]);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /licence STUB/);
  fs.rmSync(path.dirname(target), { recursive: true, force: true });
});
