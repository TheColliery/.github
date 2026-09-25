// UMB-216 (a): the org-health watcher. Pure classification over fixtures shaped like the real API
// responses, plus one spawn of the CLI against a fetch stub (no network, no token).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { disabledWorkflows, staleQueuedRuns, gitbookSignal, buildReport, DAY_MS } from './org-health-watch.mjs';

const NOW = Date.parse('2026-09-25T12:00:00Z');

test('disabledWorkflows: disabled_inactivity is a finding; active and disabled_manually are not (a manual disable is a decision)', () => {
  const found = disabledWorkflows({
    CoalMine: [{ path: '.github/workflows/scorecard.yml', state: 'disabled_inactivity', html_url: 'u1' }, { path: '.github/workflows/ci.yml', state: 'active' }],
    Kolwen: [{ path: '.github/workflows/old.yml', state: 'disabled_manually' }],
  });
  assert.deepEqual(found.map((f) => `${f.repo}:${f.workflow}`), ['CoalMine:scorecard.yml']);
  assert.match(found[0].text, /disabled_inactivity/);
});

test('staleQueuedRuns: a run queued for more than a day is a finding; a fresh one is not (RED against a check that read status alone)', () => {
  const found = staleQueuedRuns({
    CoalLedger: [
      { name: 'CodeQL', status: 'queued', created_at: '2026-08-06T16:51:17Z', html_url: 'r1' },
      { name: 'CI', status: 'queued', created_at: '2026-09-25T11:30:00Z', html_url: 'r2' },
    ],
  }, NOW);
  assert.equal(found.length, 1);
  assert.match(found[0].text, /CodeQL/);
  assert.match(found[0].text, /49 day/);
});

test('gitbookSignal: a synced repo whose default-branch head carries a success GitBook status is clean; a failure, or no status on a head older than a day, is a finding', () => {
  const clean = gitbookSignal({ '.github': { headAge: 3 * DAY_MS, statuses: [{ context: 'GitBook (./profile)', state: 'success' }] } }, NOW);
  assert.deepEqual(clean, []);
  const failed = gitbookSignal({ CoalMine: { headAge: 3 * DAY_MS, statuses: [{ context: 'GitBook (./docs)', state: 'failure' }] } }, NOW);
  assert.equal(failed.length, 1);
  assert.match(failed[0].text, /failure/);
  const missing = gitbookSignal({ CoalMine: { headAge: 3 * DAY_MS, statuses: [] } }, NOW);
  assert.equal(missing.length, 1);
  assert.match(missing[0].text, /no GitBook status/);
  const fresh = gitbookSignal({ CoalMine: { headAge: 2 * 60 * 60 * 1000, statuses: [] } }, NOW);
  assert.deepEqual(fresh, [], 'a head younger than a day may simply not have synced yet');
});

test('buildReport: no findings is a stated clean line naming what was checked, never an empty string; findings list each with its link', () => {
  const clean = buildReport([], { repos: 3, workflows: 20, synced: 1 });
  assert.match(clean, /3 public repos/);
  assert.match(clean, /20 workflows/);
  assert.match(clean, /no finding/i);
  const one = buildReport([{ repo: 'X', kind: 'queued', text: 'stuck', url: 'https://x' }], { repos: 1, workflows: 1, synced: 0 });
  assert.match(one, /\[X\] stuck/);
  assert.match(one, /https:\/\/x/);
});

// ---- the CLI, spawned with a fetch stub preloaded (NODE_OPTIONS=--import) --------------------------
const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'org-health-watch.mjs');
const STUB = `
import fs from 'node:fs';
const S = JSON.parse(process.env.STUB_STATE);
globalThis.fetch = async (url) => {
  const p = String(url).replace('https://api.github.com', '');
  fs.appendFileSync(process.env.STUB_LOG, p + '\\n');
  // Longest key wins: '/commits/main/status' must not match the '/commits/main' entry.
  const hit = Object.entries(S).filter(([k]) => p.startsWith(k)).sort((a, b) => b[0].length - a[0].length)[0];
  if (hit && hit[1] && hit[1].__status) return new Response('{}', { status: hit[1].__status });
  return new Response(JSON.stringify(hit ? hit[1] : {}), { status: hit ? 200 : 404 });
};
`;

function runCli(state) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ohw-'));
  const stub = path.join(dir, 'stub.mjs');
  const log = path.join(dir, 'calls.txt');
  const out = path.join(dir, 'gh-output.txt');
  fs.writeFileSync(stub, STUB);
  fs.writeFileSync(log, '');
  fs.writeFileSync(out, '');
  const res = spawnSync(process.execPath, [SCRIPT], {
    cwd: dir, encoding: 'utf8', timeout: 60000,
    env: { ...process.env, NODE_OPTIONS: `--import=${pathToFileURL(stub).href}`, STUB_STATE: JSON.stringify(state), STUB_LOG: log, GITHUB_OUTPUT: out, GH_TOKEN: '' },
  });
  const calls = fs.readFileSync(log, 'utf8').split('\n').filter(Boolean);
  const report = fs.existsSync(path.join(dir, 'org-health-report.md')) ? fs.readFileSync(path.join(dir, 'org-health-report.md'), 'utf8') : '';
  const output = fs.readFileSync(out, 'utf8');
  fs.rmSync(dir, { recursive: true, force: true });
  return { res, calls, report, output };
}

const LIVE_SHAPE = {
  '/orgs/TheColliery/repos': [{ name: 'CoalLedger', default_branch: 'main' }],
  '/repos/TheColliery/CoalLedger/actions/workflows': { workflows: [{ path: '.github/workflows/ci.yml', state: 'active' }] },
  '/repos/TheColliery/CoalLedger/actions/runs': { workflow_runs: [{ name: 'CodeQL', status: 'queued', created_at: '2026-08-06T16:51:17Z', html_url: 'https://github.com/TheColliery/CoalLedger/actions/runs/31121262180' }] },
  '/repos/TheColliery/CoalLedger/contents/.gitbook.yaml': { name: '.gitbook.yaml' },
  '/repos/TheColliery/CoalLedger/commits/main': { commit: { committer: { date: '2026-09-01T00:00:00Z' } } },
  '/repos/TheColliery/CoalLedger/commits/main/status': { statuses: [{ context: 'GitBook (./docs)', state: 'success' }] },
};

test('org-health-watch.mjs: the live CoalLedger shape (a run queued since 2026-08-06) -> one finding, a report file, has_findings=true, exit 0, reads only', () => {
  const { res, calls, report, output } = runCli(LIVE_SHAPE);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.match(report, /\[CoalLedger\] .*CodeQL.*queued/);
  assert.match(report, /^1 finding /m, 'exactly one finding: the GitBook status on this shape is success');
  assert.match(res.stdout, /::warning/);
  assert.match(output, /has_findings=true/);
  assert.ok(calls.every((c) => c.startsWith('/')), 'stub paths only');
});

test('org-health-watch.mjs: a read that is not 200 (an anonymous rate limit on the runs endpoint) is a finding, never an empty "nothing queued" (RED against the first live run, 2026-09-25)', () => {
  const state = { ...LIVE_SHAPE, '/repos/TheColliery/CoalLedger/actions/runs': { __status: 403 } };
  const { res, report, output } = runCli(state);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.match(report, /\[CoalLedger\] could not read the queued runs \(HTTP 403\)/);
  assert.match(output, /has_findings=true/);
});

test('org-health-watch.mjs: everything healthy -> has_findings=false and a clean line that names what was checked', () => {
  const state = { ...LIVE_SHAPE, '/repos/TheColliery/CoalLedger/actions/runs': { workflow_runs: [] } };
  const { res, report, output } = runCli(state);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.match(output, /has_findings=false/);
  assert.match(report, /1 public repo/);
  assert.match(report, /no finding/i);
});
