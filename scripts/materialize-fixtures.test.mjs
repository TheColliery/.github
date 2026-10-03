// AW-30 (owner-signed 2026-10-02): the supply-chain-audit fixtures hold planted, vulnerable dependency pins. GitHub's dependency
// graph reads every file named package.json as THIS repository's dependencies, so the ten fixture manifests are stored as
// package.fixture.json and materialized under their real name into a scratch directory before a canary scans them. These tests hold
// both halves: no tracked file here is named package.json, and the materialize step restores the exact bytes under the exact path
// every expected.json and result record names (ground truth unchanged).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BENCH = path.join(ROOT, 'benchmarks', 'CoalMine');
const SUITE = path.join(BENCH, 'fixtures', 'supply-chain-audit');
const TOOL = path.join(ROOT, 'scripts', 'materialize-fixtures.mjs');
const made = [];
test.after(() => { for (const d of made) fs.rmSync(d, { recursive: true, force: true }); });

const files = (dir) => fs.readdirSync(dir, { withFileTypes: true, recursive: true }).filter((e) => e.isFile()).map((e) => path.relative(dir, path.join(e.parentPath ?? e.path, e.name)).split(path.sep).join('/'));
const run = (args) => spawnSync(process.execPath, ['--max-old-space-size=512', TOOL, ...args], { encoding: 'utf8', timeout: 60000 });
const scratch = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'materialize-')); made.push(d); return d; };

test('no file under benchmarks/ is named package.json (the dependency graph would read a planted pin as a dependency of this repository)', () => {
  const bad = files(path.join(ROOT, 'benchmarks')).filter((f) => path.posix.basename(f) === 'package.json' || path.posix.basename(f) === 'package-lock.json');
  assert.deepEqual(bad, []);
  assert.ok(files(SUITE).filter((f) => f.endsWith('/src/package.fixture.json')).length >= 1, 'the suite keeps its manifests as package.fixture.json (not vacuous)');
});

test('materialize: every package.fixture.json comes back as package.json with the same bytes; expected.json is never copied; every expected.json location resolves', () => {
  const dest = scratch(); fs.rmSync(dest, { recursive: true });
  const r = run(['supply-chain-audit', dest]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const out = files(dest);
  assert.ok(!out.some((f) => f.endsWith('expected.json')), 'the blind protocol: ground truth is not copied');
  assert.ok(!out.some((f) => f.endsWith('package.fixture.json')), 'the fixture name is gone from the copy');
  const manifests = files(SUITE).filter((f) => f.endsWith('/src/package.fixture.json'));
  for (const m of manifests) {
    const fixture = m.split('/')[0];
    assert.deepEqual(fs.readFileSync(path.join(dest, fixture, 'src', 'package.json')), fs.readFileSync(path.join(SUITE, m)), fixture + ': bytes unchanged');
  }
  let located = 0;
  for (const fx of fs.readdirSync(SUITE, { withFileTypes: true }).filter((e) => e.isDirectory())) {
    const exp = path.join(SUITE, fx.name, 'expected.json');
    if (!fs.existsSync(exp)) continue;
    const parsed = JSON.parse(fs.readFileSync(exp, 'utf8'));
    for (const item of Array.isArray(parsed) ? parsed : parsed.findings) { assert.ok(fs.existsSync(path.join(dest, fx.name, item.file)), `${fx.name}: ${item.file} must exist in the materialized copy`); located++; }
  }
  assert.ok(located >= 6, 'the six planted manifest locations were checked: ' + located);
  assert.match(r.stdout, /materialized \d+ fixture\(s\)/);
});

test('materialize: a suite with no renamed manifest is copied as it is (src only), and the tool refuses a non-empty destination, an unknown suite and an unknown flag', () => {
  const dest = scratch(); fs.rmSync(dest, { recursive: true });
  const r = run(['rot-canary', dest]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(files(dest).every((f) => /^[^/]+\/src\//.test(f)), 'only src/ trees are copied');
  assert.equal(run(['rot-canary', dest]).status, 1, 'a non-empty destination is refused, never merged into');
  assert.equal(run(['no-such-suite', path.join(dest, 'x')]).status, 1);
  const u = run(['--bogus']);
  assert.equal(u.status, 64); assert.match(u.stderr, /usage:/);
  assert.equal(run(['--help']).status, 0);
});
