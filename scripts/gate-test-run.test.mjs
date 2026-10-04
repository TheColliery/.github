// UMB-412 ruling (5)(b): a git-hook run of the suite that fails must explain itself the NEXT time. A file-level failure of
// secret-gate.test.mjs was seen twice and never explained, because the hook's output scrolled away and the retry overwrote it. The hook
// now runs the suite through scripts/gate-test-run.mjs, which streams the runner's output as before and keeps the whole of a FAILING
// run (the runner prints every child's stderr into it) in a log under the git directory, which no git add can reach. A green run leaves
// nothing behind and prints nothing extra.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SCRIPTS = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPTS, '..');
const RUNNER = path.join(SCRIPTS, 'gate-test-run.mjs');
const made = [];
test.after(() => { for (const d of made) fs.rmSync(d, { recursive: true, force: true }); });

// No inherited GIT_* (a hook sets them) and no NODE_TEST_CONTEXT (set by the outer runner: a child `node --test` would refuse to run, "called recursively").
const gitEnv = () => Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_/i.test(k) && k !== 'NODE_TEST_CONTEXT'));
function scratchRepo({ git = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-test-run-'));
  made.push(dir);
  if (git) spawnSync('git', ['init', '-q', dir], { env: gitEnv(), timeout: 30000 });
  fs.writeFileSync(path.join(dir, 'bad.test.mjs'), "import test from 'node:test';\ntest('boom', () => { process.stderr.write('CHILD-STDERR-MARKER\\n'); throw new Error('planted failure'); });\n");
  fs.writeFileSync(path.join(dir, 'crash.test.mjs'), "process.stderr.write('CRASH-STDERR-MARKER\\n');\nprocess.exit(3);\n");
  fs.writeFileSync(path.join(dir, 'good.test.mjs'), "import test from 'node:test';\ntest('ok', () => { process.stderr.write('GREEN-STDERR-MARKER\\n'); });\n");
  return dir;
}
const run = (dir, files, extraEnv = {}) => spawnSync(process.execPath, ['--max-old-space-size=512', RUNNER, ...files], { cwd: dir, encoding: 'utf8', timeout: 120000, env: { ...gitEnv(), ...extraEnv } });
const LOG = (dir) => path.join(dir, '.git', 'hook-test-last.log');

test('a failing run keeps its whole output in the git directory: the child\'s stderr, the failure, and a note naming the path; the exit code is the runner\'s', () => {
  const dir = scratchRepo();
  const r = run(dir, ['bad.test.mjs', 'good.test.mjs']);
  assert.equal(r.status, 1, r.stderr);
  assert.ok(fs.existsSync(LOG(dir)), 'the log is kept');
  const log = fs.readFileSync(LOG(dir), 'utf8');
  assert.match(log, /CHILD-STDERR-MARKER/); assert.match(log, /planted failure/);
  assert.match(r.stdout, /CHILD-STDERR-MARKER/, 'the output still streams to the hook as before');
  assert.match(r.stderr, /gate-test-run: this failing run's whole output is kept at .*hook-test-last\.log/);
});

test('a child that dies at once (the shape of the unexplained failure: a file-level failure after a fraction of a second) keeps its stderr too', () => {
  const dir = scratchRepo();
  const r = run(dir, ['crash.test.mjs']);
  assert.equal(r.status, 1);
  assert.match(fs.readFileSync(LOG(dir), 'utf8'), /CRASH-STDERR-MARKER/);
});

test('a green run leaves nothing behind, prints no note, and exits 0; an older kept log is removed by a green run', () => {
  const dir = scratchRepo();
  fs.writeFileSync(LOG(dir), 'an older failing run\n');
  const r = run(dir, ['good.test.mjs']);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!fs.existsSync(LOG(dir)), 'no log left after a green run');
  assert.doesNotMatch(r.stdout + r.stderr, /gate-test-run/, 'no note on a green run');
  assert.deepEqual(fs.readdirSync(path.join(dir, '.git')).filter((n) => /hook-test/.test(n)), []);
});

test('the latest failing run replaces the previous log (one log, never a growing pile)', () => {
  const dir = scratchRepo();
  run(dir, ['bad.test.mjs']);
  const first = fs.readFileSync(LOG(dir), 'utf8');
  run(dir, ['crash.test.mjs']);
  const second = fs.readFileSync(LOG(dir), 'utf8');
  assert.notEqual(first, second); assert.match(second, /CRASH-STDERR-MARKER/); assert.doesNotMatch(second, /CHILD-STDERR-MARKER/);
});

test('outside a git repository the suite still runs and its exit code is kept; only the log is skipped, and the note says so', () => {
  const dir = scratchRepo({ git: false });
  const bad = run(dir, ['bad.test.mjs']);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /no git directory here, so the output was not kept/);
  assert.equal(run(dir, ['good.test.mjs']).status, 0);
});

test('usage: no test file, or a missing one, is an error that names it (the roster rule: node --test ignores a missing file)', () => {
  const dir = scratchRepo();
  assert.equal(run(dir, []).status, 64);
  const miss = run(dir, ['good.test.mjs', 'nope.test.mjs']);
  assert.equal(miss.status, 1); assert.match(miss.stderr, /missing test file: nope\.test\.mjs/);
  assert.equal(run(dir, ['--help']).status, 0);
});

test('both git hooks run the suite through the runner, and still name every test file twice (the roster)', () => {
  for (const h of ['pre-commit', 'pre-push']) {
    const t = fs.readFileSync(path.join(ROOT, '.githooks', h), 'utf8');
    assert.match(t, /^node scripts\/gate-test-run\.mjs scripts\/verify-landing\.test\.mjs/m, h);
    assert.doesNotMatch(t, /^node --test /m, h + ': no bare node --test left');
  }
});

// A-5 (pass 14): the runner is a harness child, so it carries a heap cap and a kill-timeout (testing.md's harness-child line; AGENTS.md,
// the runaway test child). A hung test file must not hold a hook forever, and its whole process tree dies with it.
test('the test children run under a heap cap (about 2 GB), not the default of this machine -- RED before the cap', () => {
  const dir = scratchRepo();
  fs.writeFileSync(path.join(dir, 'heap.test.mjs'), "import v8 from 'node:v8';\nconsole.log('HEAP-LIMIT-MB=' + Math.round(v8.getHeapStatistics().heap_size_limit / 1048576));\n");
  const r = run(dir, ['heap.test.mjs']);
  assert.equal(r.status, 0, r.stderr);
  const mb = Number(r.stdout.match(/HEAP-LIMIT-MB=(\d+)/)[1]);
  assert.ok(mb >= 1900 && mb <= 2300, 'heap limit ' + mb + ' MB');
});

test('a run past its time limit is killed with its whole tree, says so, keeps its output, and exits 1 -- RED before the timeout', () => {
  const dir = scratchRepo();
  fs.writeFileSync(path.join(dir, 'hang.test.mjs'), "process.stderr.write('HANG-STARTED\\n');\nsetInterval(() => {}, 1000);\n");
  const t0 = Date.now();
  const r = run(dir, ['hang.test.mjs'], { GATE_TEST_RUN_TIMEOUT_MS: '4000' });
  assert.ok(Date.now() - t0 < 60000, 'it did not hang');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /gate-test-run: killed after 4 seconds \(the time limit\)/);
  assert.match(fs.readFileSync(LOG(dir), 'utf8'), /HANG-STARTED/);
});
