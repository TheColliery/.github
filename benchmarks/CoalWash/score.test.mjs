// Hermetic checks for score.mjs — spawn the real CLI, real fixtures, tmp stores.
// Run: node --test score.test.mjs
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const F01 = path.join(here, 'fixtures', 'f01-dup-heavy');
const F03 = path.join(here, 'fixtures', 'f03-lean');

function run(...args) {
  const r = spawnSync(process.execPath, [path.join(here, 'score.mjs'), ...args, '--json'], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}
function copyStore(fixture) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-score-'));
  for (const f of fs.readdirSync(fixture)) {
    if (f.endsWith('.md')) fs.copyFileSync(path.join(fixture, f), path.join(dir, f));
  }
  return dir;
}

test('pristine copy: all muscle kept, all fat still present, no-op actual=true', () => {
  const store = copyStore(F01);
  try {
    const r = run(F01, store);
    assert.strictEqual(r.muscle.lost.length, 0);
    assert.strictEqual(r.muscle.kept, r.muscle.total);
    assert.strictEqual(r.fat.removed, 0);
    assert.strictEqual(r.noOp.actual, true);
  } finally { fs.rmSync(store, { recursive: true, force: true }); }
});

test('perfect clean: fat removed, muscle intact, change reported', () => {
  const store = copyStore(F01);
  try {
    for (const f of ['release-notes.md', 'tooling.md']) {
      const p = path.join(store, f);
      const kept = fs.readFileSync(p, 'utf8').split('\n\n')
        .filter((block) => !/To restate the point|worth pausing here to reflect/.test(block));
      fs.writeFileSync(p, kept.join('\n\n'), 'utf8');
    }
    const r = run(F01, store);
    assert.strictEqual(r.muscle.lost.length, 0, `lost: ${r.muscle.lost}`);
    assert.strictEqual(r.fat.remaining.length, 0, `remaining: ${r.fat.remaining}`);
    assert.strictEqual(r.noOp.actual, false);
  } finally { fs.rmSync(store, { recursive: true, force: true }); }
});

test('botched clean: a lost fact is counted and named', () => {
  const store = copyStore(F01);
  try {
    const p = path.join(store, 'build-notes.md');
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/^- Node pinned at 22\.4\.1.*\n/m, ''), 'utf8');
    const r = run(F01, store, '--round', '3', '--phase', 'fat-exhausted');
    assert.ok(r.muscle.lost.includes('m01'));
    assert.strictEqual(r.round, 3);
    assert.strictEqual(r.phase, 'fat-exhausted');
  } finally { fs.rmSync(store, { recursive: true, force: true }); }
});

test('lean fixture: untouched passes no-op; any edit fails it', () => {
  const store = copyStore(F03);
  try {
    let r = run(F03, store);
    assert.strictEqual(r.noOp.expected, true);
    assert.strictEqual(r.noOp.actual, true);
    fs.appendFileSync(path.join(store, 'conventions.md'), '\ncompacted.\n');
    r = run(F03, store);
    assert.strictEqual(r.noOp.actual, false);
    assert.ok(r.noOp.changed.some((c) => c.includes('conventions.md')));
  } finally { fs.rmSync(store, { recursive: true, force: true }); }
});
