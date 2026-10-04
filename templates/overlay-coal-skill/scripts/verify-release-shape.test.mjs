import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'verify-release-shape.mjs');

// F-R19-2 (UMB-427): a spawned child gets an EXPLICIT environment, never the parent's. RELEASE_TAG, PREVIOUS_STABLE_TAG, LATEST_TAG,
// LAUNCH_FORM, GITHUB_REF_NAME and the rest of an Actions run's variables change what these scripts do, so a developer's exported
// RELEASE_TAG (or a CI run's own) must not reach the child. Only what a node child needs to start is passed through, plus the test's own.
const BASE_ENV_KEYS = ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'TEMP', 'TMP', 'TMPDIR', 'HOME', 'USERPROFILE'];
const cleanEnv = (extra = {}) => ({ ...Object.fromEntries(BASE_ENV_KEYS.filter((k) => process.env[k] !== undefined).map((k) => [k, process.env[k]])), ...extra });
const made = [];
test.after(() => { for (const d of made) fs.rmSync(d, { recursive: true, force: true }); });

function scratch() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-release-shape-test-'));
  made.push(dir);
  return dir;
}

function run(cwd, stdin) {
  return spawnSync(process.execPath, [SCRIPT], { cwd, encoding: 'utf8', timeout: 30000, input: stdin, env: cleanEnv() });
}

test('verify-release-shape.mjs: matching title + body -> exit 0', () => {
  const dir = scratch();
  fs.writeFileSync(path.join(dir, 'release-title.txt'), 'v1.0.0 - a fix\n');
  fs.writeFileSync(path.join(dir, 'release-body.md'), 'A fix.\n');
  const res = run(dir, JSON.stringify({ name: 'v1.0.0 - a fix', body: 'A fix.' }));
  assert.equal(res.status, 0, res.stderr);
});

test('verify-release-shape.mjs: a published body that PRESERVES its trailing newline still matches -- rot-canary catch: the old code only trimmed the INTENDED side, so this exact shape would have false-failed every real release under this mechanism', () => {
  const dir = scratch();
  fs.writeFileSync(path.join(dir, 'release-title.txt'), 'v1.0.0 - a fix\n');
  fs.writeFileSync(path.join(dir, 'release-body.md'), 'A fix.\n');
  const res = run(dir, JSON.stringify({ name: 'v1.0.0 - a fix', body: 'A fix.\n' }));
  assert.equal(res.status, 0, res.stderr);
});

test('verify-release-shape.mjs: a title mismatch fails loud and names both strings, exit 1', () => {
  const dir = scratch();
  fs.writeFileSync(path.join(dir, 'release-title.txt'), 'v1.0.0 - a fix\n');
  fs.writeFileSync(path.join(dir, 'release-body.md'), 'A fix.\n');
  const res = run(dir, JSON.stringify({ name: 'v1.0.0', body: 'A fix.' }));
  assert.equal(res.status, 1);
  assert.match(res.stderr, /TITLE MISMATCH/);
});

test('verify-release-shape.mjs: a SAME-LENGTH body substitution is caught -- the exact CoalHearth em-dash-to-hyphen incident this rail exists for', () => {
  const dir = scratch();
  fs.writeFileSync(path.join(dir, 'release-title.txt'), 'v1.0.0 - a fix\n');
  fs.writeFileSync(path.join(dir, 'release-body.md'), 'The API—which is public—returns JSON.\n');
  const res = run(dir, JSON.stringify({ name: 'v1.0.0 - a fix', body: 'The API-which is public-returns JSON.' }));
  assert.equal(res.status, 1, 'same character COUNT, different bytes -- a length compare would have missed this');
  assert.match(res.stderr, /BODY MISMATCH/);
});

test('verify-release-shape.mjs: no stdin at all fails loud rather than comparing against an empty string silently', () => {
  const dir = scratch();
  fs.writeFileSync(path.join(dir, 'release-title.txt'), 'v1.0.0 - a fix\n');
  fs.writeFileSync(path.join(dir, 'release-body.md'), 'A fix.\n');
  const res = run(dir, '');
  assert.equal(res.status, 1);
  assert.match(res.stderr, /no published Release JSON on stdin/);
});

test('verify-release-shape.mjs: malformed JSON on stdin fails loud, names it, never crashes with a raw stack', () => {
  const dir = scratch();
  fs.writeFileSync(path.join(dir, 'release-title.txt'), 'v1.0.0 - a fix\n');
  fs.writeFileSync(path.join(dir, 'release-body.md'), 'A fix.\n');
  const res = run(dir, '{not json');
  assert.equal(res.status, 1);
  assert.match(res.stderr, /not valid JSON/);
});

test('verify-release-shape.mjs: the derived files are missing (release-notes.mjs never ran) fails loud, names the problem', () => {
  const dir = scratch();
  const res = run(dir, JSON.stringify({ name: 'x', body: 'y' }));
  assert.equal(res.status, 1);
  assert.match(res.stderr, /could not read the derived title\/body/);
});

// UMB-392 / BA-14: outside the band the rail prints a NAMED warning and PASSES (a signal, never a refusal); a mismatch still fails.
function bandRun(summaryLen) {
  const dir = scratch();
  const title = `v1.0.0 - ${'a'.repeat(summaryLen)}`;
  fs.writeFileSync(path.join(dir, 'release-title.txt'), title + '\n');
  fs.writeFileSync(path.join(dir, 'release-body.md'), 'A fix.\n');
  const res = run(dir, JSON.stringify({ name: title, body: 'A fix.' }));
  return res;
}

test('verify-release-shape.mjs: a summary of 60 or 75 characters (and 45) prints no warning', () => {
  for (const n of [60, 75, 45]) {
    const res = bandRun(n);
    assert.equal(res.status, 0, res.stderr);
    assert.doesNotMatch(res.stdout + res.stderr, /release-title-band/, String(n));
  }
});

test('verify-release-shape.mjs: a summary of 76 or 44 characters warns by name and still passes, exit 0 -- nothing refuses', () => {
  for (const n of [76, 44, 211]) {
    const res = bandRun(n);
    assert.equal(res.status, 0, `${n}: ${res.stderr}`);
    assert.match(res.stdout, new RegExp(`WARNING release-title-band: the summary in the title is ${n} characters`), String(n));
    assert.match(res.stdout, /verify-release-shape: published title \+ body match/, 'the byte check still reports');
  }
});

test('verify-release-shape.mjs: a mismatch still fails with exit 1 even when the title is inside the band', () => {
  const dir = scratch();
  fs.writeFileSync(path.join(dir, 'release-title.txt'), 'v1.0.0 - ' + 'a'.repeat(60) + '\n');
  fs.writeFileSync(path.join(dir, 'release-body.md'), 'A fix.\n');
  const res = run(dir, JSON.stringify({ name: 'v1.0.0 - ' + 'b'.repeat(60), body: 'A fix.' }));
  assert.equal(res.status, 1);
});

// F-R19-2: the rail's own output must not depend on the parent being an Actions run (GITHUB_ACTIONS adds a ::warning annotation prefix).
test('verify-release-shape.mjs: the parent\'s GITHUB_ACTIONS never reaches the child, so the warning line is the same plain text everywhere -- RED before F-R19-2', () => {
  const dir = scratch();
  fs.writeFileSync(path.join(dir, 'release-title.txt'), 'v1.0.0 - ' + 'a'.repeat(120) + '\n');
  fs.writeFileSync(path.join(dir, 'release-body.md'), 'A fix.\n');
  const saved = process.env.GITHUB_ACTIONS; process.env.GITHUB_ACTIONS = 'true';
  try {
    const res = run(dir, JSON.stringify({ name: 'v1.0.0 - ' + 'a'.repeat(120), body: 'A fix.' }));
    assert.equal(res.status, 0, res.stderr);
    assert.doesNotMatch(res.stdout, /^::warning/m);
    assert.match(res.stdout, /^verify-release-shape: WARNING release-title-band/m);
  } finally { if (saved === undefined) delete process.env.GITHUB_ACTIONS; else process.env.GITHUB_ACTIONS = saved; }
});
