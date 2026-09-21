import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// node/runtime.md §2: `node --test` silently ignores a missing file argument, so a test file that is
// not named in the enumerated roster simply stops running with no signal at all. This repo keeps that
// roster in THREE places that must move together (.github/workflows/verify-landing.yml, and the two
// byte-identical git hooks), each listing every file TWICE -- once in the existence-check loop, once in
// the `node --test` call. Nothing checked that a *.test.mjs on disk was on the roster: the template's own
// test (templates/overlay-llm-deploy/scripts/post-deploy-check.test.mjs) sat outside CI for that reason
// until UMB-112 residue 7. This test is the "a test file on disk with no roster line is an error" half.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROSTERS = ['.github/workflows/verify-landing.yml', '.githooks/pre-commit', '.githooks/pre-push'];

function testFilesUnder(rel) {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const p = dir + '/' + e.name;
      if (e.isDirectory()) walk(p);
      else if (/\.test\.mjs$/.test(e.name)) out.push(p);
    }
  };
  walk(rel);
  return out;
}

const onDisk = [...testFilesUnder('scripts'), ...testFilesUnder('templates')].sort();

test('the roster search finds the test files it is meant to police (not vacuous)', () => {
  assert.ok(onDisk.includes('scripts/release-conform.test.mjs'), onDisk.join(', '));
  assert.ok(onDisk.includes('templates/overlay-llm-deploy/scripts/post-deploy-check.test.mjs'), onDisk.join(', '));
  assert.ok(onDisk.length >= 12, 'test files on disk: ' + onDisk.length);
});

test('every *.test.mjs under scripts/ and templates/ is on all three rosters, twice each (loop + node --test)', () => {
  const problems = [];
  for (const r of ROSTERS) {
    const text = fs.readFileSync(path.join(ROOT, r), 'utf8');
    for (const t of onDisk) {
      const n = text.split(t).length - 1;
      if (n !== 2) problems.push(`${r}: ${t} appears ${n} time(s), expected 2`);
    }
  }
  assert.deepEqual(problems, []);
});

test('the pre-commit and pre-push hooks are byte-identical (one gate, wired twice)', () => {
  assert.equal(
    fs.readFileSync(path.join(ROOT, '.githooks/pre-commit'), 'utf8'),
    fs.readFileSync(path.join(ROOT, '.githooks/pre-push'), 'utf8'),
  );
});
