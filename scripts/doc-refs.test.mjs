// Hermetic spawn tests for doc-refs.mjs (UMB-057). Per testing.md's required test type for
// a CLI gate: spawn the REAL file against a sandboxed scratch tree, never re-derive its
// regex/exclusion logic by import.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'doc-refs.mjs');

function run(rootDir) {
  return spawnSync(process.execPath, [SCRIPT, rootDir], { encoding: 'utf8' });
}

function scratchRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'doc-refs-test-'));
}

function write(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

test('doc-refs.mjs: a real dangling markdown link FAILS loud, non-zero exit (UMB-057)', () => {
  // Regression exhibit: this is exactly NEW-REPO-WIZARD.md's own shape before its fix --
  // a link to a file the rename/retirement left behind.
  const root = scratchRoot();
  write(path.join(root, 'README.md'), '[gone](./templates/zip-skills.yml) is not here.\n');
  const res = run(root);
  assert.notEqual(res.status, 0, res.stderr + res.stdout);
  assert.match(res.stderr, /FAIL README\.md:1: dangling link '\.\/templates\/zip-skills\.yml'/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('doc-refs.mjs: a link that resolves passes, exit 0 (UMB-057)', () => {
  const root = scratchRoot();
  write(path.join(root, 'templates', 'real.yml'), 'x: 1\n');
  write(path.join(root, 'README.md'), '[real](./templates/real.yml) is here.\n');
  const res = run(root);
  assert.equal(res.status, 0, res.stdout);
  assert.match(res.stdout, /0 dangling link\(s\)/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('doc-refs.mjs: an illustrative link-shaped example wrapped in one inline code span is NOT flagged (UMB-057)', () => {
  // The exact shape that produced two false positives while this gate was written:
  // `[Name](url) -- role in 2-4 words` (a how-to-write-this bullet) and a PowerShell cast
  // `[string](Get-Content -Raw ./x.md)` inside a fenced code block -- neither is a real
  // link, and this gate must not flag either.
  const root = scratchRoot();
  write(
    path.join(root, 'README.md'),
    [
      'A bullet list, one per line, `[Name](url) -- role in 2-4 words`.',
      '',
      '```powershell',
      '$body = [string](Get-Content -Raw ./nonexistent.md)',
      '```',
      '',
    ].join('\n'),
  );
  const res = run(root);
  assert.equal(res.status, 0, res.stdout);
  assert.match(res.stdout, /0 dangling link\(s\)/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('doc-refs.mjs: a bare backtick filename with no markdown link (a KEY, not a pointer) is NOT flagged (UMB-057)', () => {
  // The pointer-not-key distinction from CWK-075: a filename cited as a naming convention
  // (no `[text](path)` link) is never claimed to resolve in THIS repo's own tree.
  const root = scratchRoot();
  write(path.join(root, 'README.md'), 'Every published-code repo ships `ci.yml` and `codeql.yml`.\n');
  const res = run(root);
  assert.equal(res.status, 0, res.stdout);
  assert.match(res.stdout, /0 dangling link\(s\)/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('doc-refs.mjs: an external http(s) link is never resolved on disk (UMB-057)', () => {
  const root = scratchRoot();
  write(path.join(root, 'README.md'), '[Anthropic](https://www.anthropic.com/nonexistent-page)\n');
  const res = run(root);
  assert.equal(res.status, 0, res.stdout);
  fs.rmSync(root, { recursive: true, force: true });
});

test('doc-refs.mjs: profile/*.md is swept too, not only the root (UMB-057)', () => {
  const root = scratchRoot();
  write(path.join(root, 'profile', 'README.md'), '[gone](./missing.yml)\n');
  const res = run(root);
  assert.notEqual(res.status, 0, res.stderr + res.stdout);
  assert.match(res.stderr, /FAIL profile[\\/]README\.md:1:/);
  fs.rmSync(root, { recursive: true, force: true });
});

// UMB-112 row 19: the link pattern stopped at the FIRST ")" and only knew a double-quoted title.
test('doc-refs.mjs: a destination containing balanced parentheses resolves (UMB-112 row 19)', () => {
  const root = scratchRoot();
  write(path.join(root, 'foo(bar).md'), 'x\n');
  write(path.join(root, 'README.md'), '[paren](foo(bar).md) is here.\n');
  const res = run(root);
  assert.equal(res.status, 0, res.stderr + res.stdout);
  fs.rmSync(root, { recursive: true, force: true });
});

test('doc-refs.mjs: a dangling parenthesised destination is reported WHOLE, not cut at the first ")" (UMB-112 row 19)', () => {
  const root = scratchRoot();
  write(path.join(root, 'README.md'), '[gone](gone(bar).md) is not here.\n');
  const res = run(root);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /dangling link 'gone\(bar\)\.md'/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('doc-refs.mjs: a single-quoted or parenthesised title, and an angle-bracket destination with a space, resolve (UMB-112 row 19)', () => {
  const root = scratchRoot();
  write(path.join(root, 'real.md'), 'x\n');
  write(path.join(root, 'real file.md'), 'x\n');
  write(path.join(root, 'README.md'), [
    "[a](real.md 'single title') and [b](real.md (paren title)) and [c](real.md \"title with (parens)\") and [d](<real file.md>) resolve.",
    '',
  ].join('\n'));
  const res = run(root);
  assert.equal(res.status, 0, res.stderr + res.stdout);
  fs.rmSync(root, { recursive: true, force: true });
});

test('doc-refs.mjs: scope covers the org-default community files under .github/ and the patterns/ space, not only the root and profile/ (UMB-177)', () => {
  for (const dir of ['.github', 'patterns']) {
    const root = scratchRoot();
    write(path.join(root, dir, 'CONTRIBUTING.md'), '[gone](./nowhere.md) is not here.\n');
    const res = run(root);
    assert.equal(res.status, 1, dir + ': ' + res.stderr + res.stdout);
    assert.match(res.stdout + res.stderr, /nowhere\.md/);
    fs.rmSync(root, { recursive: true, force: true });
  }
});
