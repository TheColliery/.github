#!/usr/bin/env node
// gate-test-run: run `node --test <files>` for a git hook and keep the whole output of a FAILING run.
//
// WHY (UMB-412 ruling (5)(b)): a file-level failure of secret-gate.test.mjs was seen twice and never explained. The hook's output
// scrolled away, a retry overwrote what little was saved, and the failing child's own stderr (which the test runner prints into its
// output) was gone before anyone read it. This runs the same `node --test`, streams its output to the hook exactly as before, and
// writes it to a log under the git directory as it goes: a green run deletes the log and prints nothing extra; a failing run keeps it
// and names its path on stderr. The git directory is never tracked, so no `git add` can publish the log.
//
// Usage:   node scripts/gate-test-run.mjs <test file> [<test file> ...]
// Example: node scripts/gate-test-run.mjs scripts/verify-landing.test.mjs scripts/update-readme.test.mjs
// Exit:    the runner's own (0 green, 1 any failure) · 1 a missing test file · 64 usage error
// Log:     <git dir>/hook-test-last.log (one file; the latest failing run replaces the last)
// Report a problem: TheColliery/.github issues. Zero dependencies: node builtins only.
import fs from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';

// A harness child carries a heap cap and a kill-timeout (testing.md; AGENTS.md, the runaway test child): the heap cap goes to the runner and
// to every test file it starts (the runner passes its own flags on), and a run past the time limit is killed with its whole process tree.
// The limit is generous (the suite takes 1 to 3 minutes on a loaded box); GATE_TEST_RUN_TIMEOUT_MS overrides it, for the tests of this file.
const HEAP_CAP_MB = 2048;
const PER_TEST_TIMEOUT_MS = 300000;
const RUN_TIMEOUT_MS = Number(process.env.GATE_TEST_RUN_TIMEOUT_MS) > 0 ? Number(process.env.GATE_TEST_RUN_TIMEOUT_MS) : 1200000;

function killTree(child) {
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { timeout: 30000 });
  else { try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); } }
}

const USAGE = 'usage: node scripts/gate-test-run.mjs <test file> [<test file> ...] | -h\n'
  + '  runs `node --test` on the files, streams its output, and keeps a failing run\'s whole output at <git dir>/hook-test-last.log\n'
  + '  example: node scripts/gate-test-run.mjs scripts/verify-landing.test.mjs\n'
  + '  exit 0 green · 1 a failure or a missing file · 64 usage error';

function logPath() {
  const r = spawnSync('git', ['rev-parse', '--git-path', 'hook-test-last.log'], { encoding: 'utf8', timeout: 30000 });
  const p = r.status === 0 ? r.stdout.trim() : '';
  return p || null;
}

async function main(args) {
  if (args.includes('-h') || args.includes('--help')) { console.log(USAGE); return 0; }
  const flag = args.find((a) => a.startsWith('-'));
  if (flag || !args.length) { console.error(`gate-test-run: ${flag ? `unknown flag ${JSON.stringify(flag)}` : 'no test file given'}\n${USAGE}`); return 64; }
  // `node --test` silently ignores a missing file argument (node/runtime.md section 2): a renamed test would drop out of the gate green.
  for (const f of args) if (!fs.existsSync(f)) { console.error(`gate-test-run: missing test file: ${f}`); return 1; }

  const log = logPath();
  let out = null;
  if (log) { try { out = fs.createWriteStream(log); out.on('error', () => { out = null; }); } catch { out = null; } }

  const child = spawn(process.execPath, [`--max-old-space-size=${HEAP_CAP_MB}`, '--test', `--test-timeout=${PER_TEST_TIMEOUT_MS}`, ...args], { stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; killTree(child); }, RUN_TIMEOUT_MS);
  const pass = (stream, sink) => stream.on('data', (d) => { sink.write(d); if (out) out.write(d); });
  pass(child.stdout, process.stdout); pass(child.stderr, process.stderr);
  const code = await new Promise((resolve) => { child.on('error', () => resolve(1)); child.on('close', (c) => resolve(c === null ? 1 : c)); });
  clearTimeout(timer);
  if (timedOut) {
    const note = `gate-test-run: killed after ${Math.round(RUN_TIMEOUT_MS / 1000)} seconds (the time limit)\n`;
    process.stderr.write(note); if (out) out.write(note);
  }
  if (out) await new Promise((resolve) => out.end(resolve));

  if (code === 0 && !timedOut) { if (log) fs.rmSync(log, { force: true }); return 0; }
  console.error(log && out !== null
    ? `gate-test-run: this failing run's whole output is kept at ${log}`
    : 'gate-test-run: there is no git directory here, so the output was not kept');
  return code === 0 ? 1 : code; // a killed run exits non-zero too
}

try { process.exitCode = await main(process.argv.slice(2)); } catch (e) { console.error(`gate-test-run: ${e && e.message ? e.message : e}`); process.exitCode = 1; }
