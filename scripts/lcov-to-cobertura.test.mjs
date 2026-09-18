import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

// The converter ships INSIDE the published-code template (a born repo runs it from its own
// .github/scripts/); this repo's gate tests it in place, from templates/.
const here = path.dirname(fileURLToPath(import.meta.url));
const CONVERTER = path.join(here, '..', 'templates', 'published-code', '.github', 'scripts', 'lcov-to-cobertura.mjs');
const { parseLcov, toCobertura } = await import(pathToFileURL(CONVERTER).href);

// Shape lifted from what `node --test --experimental-test-coverage --test-reporter=lcov`
// really wrote on Node 24.19.0 (probe 2026-09-19): a Windows-style relative path, FN/FNDA/
// BRDA/DA/LH/LF/end_of_record. Extended with an absolute path, a repeated DA, a partly-taken
// branch and an XML-hostile filename, each pinned by a test below.
const LCOV = [
  'TN:',
  'SF:scripts\\mod.mjs',
  'FN:1,add',
  'FN:2,unused',
  'FNDA:1,add',
  'FNDA:0,unused',
  'BRDA:2,0,0,1',
  'BRDA:2,1,0,0',
  'BRDA:2,2,0,-',
  'DA:1,1',
  'DA:2,0',
  'DA:3,4',
  'DA:3,1',
  'LH:2',
  'LF:3',
  'end_of_record',
  'SF:/repo/root/lib/a&b.mjs',
  'DA:7,2',
  'end_of_record',
  'SF:top.mjs',
  'DA:1,0',
  'end_of_record',
  '',
].join('\n');
const ROOT = '/repo/root';

test('parseLcov: paths are made relative to root and slash-normalized (backslash, absolute, bare)', () => {
  const recs = parseLcov(LCOV, ROOT);
  assert.deepEqual(recs.map((r) => r.file), ['scripts/mod.mjs', 'lib/a&b.mjs', 'top.mjs']);
});

test('parseLcov: a repeated DA line sums its hits; a BRDA "-" counts as not taken', () => {
  const [mod] = parseLcov(LCOV, ROOT);
  assert.equal(mod.lines.get(3), 5);
  assert.deepEqual(mod.branches.get(2), { covered: 1, total: 3 });
});

test('toCobertura: aggregate line/branch totals and rates recompute from the fixture', () => {
  const xml = toCobertura(parseLcov(LCOV, ROOT), { timestamp: 42 });
  // lines: mod.mjs 3 valid / 2 covered (1 and 3), a&b 1/1, top 1/0 -> 5 valid, 3 covered
  assert.match(xml, /<coverage line-rate="0\.6" branch-rate="0\.3333" lines-covered="3" lines-valid="5" branches-covered="1" branches-valid="3" complexity="0" version="1" timestamp="42">/);
});

test('toCobertura: one package per directory, one class per file, filename relative to the root', () => {
  const xml = toCobertura(parseLcov(LCOV, ROOT), { timestamp: 42 });
  assert.equal((xml.match(/<package /g) ?? []).length, 3);
  assert.equal((xml.match(/<class /g) ?? []).length, 3);
  assert.match(xml, /<package name="scripts" line-rate="0\.6667"/);
  assert.match(xml, /<class name="scripts\/mod\.mjs" filename="scripts\/mod\.mjs" line-rate="0\.6667" branch-rate="0\.3333"/);
  assert.match(xml, /<package name="\." line-rate="0" /);
});

test('toCobertura: a line with branches carries branch="true" and condition-coverage; one without does not', () => {
  const xml = toCobertura(parseLcov(LCOV, ROOT), { timestamp: 42 });
  assert.match(xml, /<line number="2" hits="0" branch="true" condition-coverage="33% \(1\/3\)"\/>/);
  assert.match(xml, /<line number="1" hits="1" branch="false"\/>/);
  assert.match(xml, /<line number="3" hits="5" branch="false"\/>/);
});

test('toCobertura: an XML-hostile filename is attribute-escaped (RED if escapeAttr is dropped)', () => {
  const xml = toCobertura(parseLcov(LCOV, ROOT), { timestamp: 42 });
  assert.match(xml, /filename="lib\/a&amp;b\.mjs"/);
  assert.doesNotMatch(xml, /a&b/);
});

test('toCobertura: sources point at the repo root and the document is well-formed at the edges', () => {
  const xml = toCobertura(parseLcov(LCOV, ROOT), { timestamp: 42 });
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<coverage /);
  assert.match(xml, /<sources><source>\.<\/source><\/sources>/);
  assert.match(xml, /<\/coverage>\n$/);
});

function runCli(args) {
  return spawnSync(process.execPath, [CONVERTER, ...args], { encoding: 'utf8' });
}

test('CLI: a real lcov file in -> Cobertura file out, exit 0, one summary line', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lcov2cob-'));
  try {
    const inFile = path.join(dir, 'lcov.info');
    const outFile = path.join(dir, 'nested', 'cobertura.xml');
    fs.writeFileSync(inFile, LCOV);
    const r = runCli([inFile, outFile, '--root', ROOT]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /3 file\(s\), 3\/5 lines covered/);
    assert.match(fs.readFileSync(outFile, 'utf8'), /<class name="scripts\/mod\.mjs"/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI: a missing input fails loud -- exit 1, a one-line message, no stack frame', () => {
  const r = runCli([path.join(os.tmpdir(), 'lcov2cob-definitely-absent.info'), path.join(os.tmpdir(), 'x.xml')]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /cannot read .* did the coverage run write it\?/);
  assert.doesNotMatch(r.stderr, /\n\s+at /);
});

test('CLI: an lcov with no source-file records fails loud -- never an empty green report', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lcov2cob-'));
  try {
    const inFile = path.join(dir, 'empty.info');
    fs.writeFileSync(inFile, 'TN:\n');
    const outFile = path.join(dir, 'out.xml');
    const r = runCli([inFile, outFile]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /holds no source-file records/);
    assert.equal(fs.existsSync(outFile), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('CLI: missing arguments prints usage and exits 1', () => {
  const r = runCli([]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /usage: lcov-to-cobertura\.mjs/);
});
