// The faba167 class (UMB-313): a duplicated key inside one mapping makes GitHub refuse the workflow file.
// RED before the fix: templates/private-working/.github/workflows/gate.yml carried two `with:` keys under its
// actions/checkout step, and TheColliery/tool-yard, born from it, read 41 failed runs of 41.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findDuplicateKeys } from './lib/yaml-dup-keys.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// The shape of the defect, cut down from the file as faba167 left it.
const FAULTY = `jobs:
  gate:
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
        # Shallow by design.
        with:
          persist-credentials: false
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: 22
`;

test('a second with: under one step is reported at its own line, naming the first (the faba167 defect)', () => {
  assert.deepEqual(findDuplicateKeys(FAULTY), [{ line: 8, key: 'with', firstLine: 5 }]);
});

test('the same keys in two sequence items, or at two depths, are not duplicates (control: no false alarm on the fixed shape)', () => {
  const fine = FAULTY.replace(/        # Shallow by design\.\n        with:\n          persist-credentials: false\n/, '');
  assert.deepEqual(findDuplicateKeys(fine), []);
  assert.deepEqual(findDuplicateKeys('a:\n  with: 1\nb:\n  with: 2\n'), []);
  assert.deepEqual(findDuplicateKeys('steps:\n  - name: x\n    run: a\n  - name: y\n    run: b\n'), []);
});

test('a repeated top-level key, a repeated key in a later sequence item and a repeated quoted key are all found', () => {
  assert.deepEqual(findDuplicateKeys('on: push\nname: a\non: pull_request\n').map((d) => d.key), ['on']);
  assert.deepEqual(findDuplicateKeys('s:\n  - a: 1\n  - b: 1\n    b: 2\n').map((d) => [d.key, d.line]), [['b', 4]]);
  assert.deepEqual(findDuplicateKeys('m:\n  "k": 1\n  \'k\': 2\n  k: 3\n').map((d) => d.line), [3, 4]);
});

test('a block scalar body, a comment and a document marker never read as keys', () => {
  const body = 's:\n  - run: |\n      echo a: 1\n      echo a: 2\n      a: 3\n      a: 4\n    name: x\n  # name: y\n';
  assert.deepEqual(findDuplicateKeys(body), []);
  assert.deepEqual(findDuplicateKeys('a: 1\n---\na: 2\n'), []);
  assert.deepEqual(findDuplicateKeys('k: >-\n  a: 1\n  a: 2\nk2: 1\n'), []);
});

test('CRLF text is read the same as LF text', () => {
  assert.deepEqual(findDuplicateKeys(FAULTY.replace(/\n/g, '\r\n')), [{ line: 8, key: 'with', firstLine: 5 }]);
});

// Scope: every YAML file under templates/ and .github/workflows/ (wider than the workflows alone: the overlays
// and the repo-settings neighbours are read by people copying them).
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? walk(p) : /\.ya?ml$/.test(e.name) ? [p] : [];
});
const FILES = [...walk(path.join(ROOT, 'templates')), ...walk(path.join(ROOT, '.github', 'workflows'))]
  .map((p) => path.relative(ROOT, p).split(path.sep).join('/'))
  .sort();

test('the scan sees the files it claims to (derived: every .yml/.yaml under templates/ and .github/workflows/)', () => {
  assert.ok(FILES.length >= 20, `found ${FILES.length}: ${FILES.join(', ')}`);
  for (const must of ['templates/private-working/.github/workflows/gate.yml', '.github/workflows/verify-landing.yml']) {
    assert.ok(FILES.includes(must), must + ' is in the scan');
  }
});

test('no YAML file under templates/ or .github/workflows/ repeats a key inside one mapping', () => {
  const bad = FILES.flatMap((f) => findDuplicateKeys(fs.readFileSync(path.join(ROOT, f), 'utf8')).map((d) => `${f}:${d.line} repeats "${d.key}" (first at line ${d.firstLine})`));
  assert.deepEqual(bad, []);
});
