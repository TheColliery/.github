// UMB-216 (a): the org-health watcher. Pure classification over fixtures shaped like the real API
// responses, plus one spawn of the CLI against a fetch stub (no network, no token).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { disabledWorkflows, staleQueuedRuns, gitbookSignal, gitbookSyncedFiles, touchesSynced, buildReport, DAY_MS, GITBOOK_OPERATION_TIMEOUT_MS } from './org-health-watch.mjs';

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

test('gitbookSignal: a success status is clean; a failure or error is a finding; a head that touched a synced file and has no status past GitBook\'s operation timeout is a finding', () => {
  const clean = gitbookSignal({ '.github': { headAge: 3 * DAY_MS, touches: true, statuses: [{ context: 'GitBook (./profile)', state: 'success' }] } }, NOW);
  assert.deepEqual(clean, []);
  const failed = gitbookSignal({ CoalMine: { headAge: 3 * DAY_MS, touches: false, statuses: [{ context: 'GitBook (./docs)', state: 'failure' }] } }, NOW);
  assert.equal(failed.length, 1);
  assert.match(failed[0].text, /failure/);
  const errored = gitbookSignal({ CoalMine: { headAge: DAY_MS, touches: false, statuses: [{ context: 'GitBook (./docs)', state: 'error' }] } }, NOW);
  assert.equal(errored.length, 1, 'an error status is reported like a failure');
  const missing = gitbookSignal({ CoalMine: { headAge: 3 * DAY_MS, touches: true, statuses: [] } }, NOW);
  assert.equal(missing.length, 1);
  assert.match(missing[0].text, /touched a file the GitBook space syncs/);
  const fresh = gitbookSignal({ CoalMine: { headAge: 5 * 60 * 1000, touches: true, statuses: [] } }, NOW);
  assert.deepEqual(fresh, [], 'a head younger than the operation timeout may simply not have synced yet');
});

// UMB-367 / issue #20: GitBook imports, and posts a status, only when a push touches the space's content (measured at GitBook's
// own record for the eight tool spaces, 2026-10-03: six heads whose last push touched only scripts, tests or workflows had no import
// and no status; the two whose push touched README.md were imported within minutes). So "no status" is the NORMAL state after a
// code-only push, and the issue's nine such findings were a false alarm. The one real stall is a status left `pending` past
// GitBook's operation timeout (CoalLedger aa0796d: pending since 2026-10-02T09:51Z while GitBook's record says the import succeeded).
test('gitbookSignal: a code-only head with no GitBook status is NEVER a finding, however old (RED against the age-only check that produced issue #20)', () => {
  assert.equal(GITBOOK_OPERATION_TIMEOUT_MS, 1200000, 'GitBook operationTimeout on every space');
  const f = gitbookSignal({ CoalFace: { headAge: 9 * DAY_MS, touches: false, statuses: [] }, CoalTipple: { headAge: 30 * DAY_MS, touches: false, statuses: [] } }, NOW);
  assert.deepEqual(f, []);
});

test('gitbookSignal: a status still pending past the operation timeout is a finding (CoalLedger aa0796d); a pending one inside it is not', () => {
  const old = '2026-09-24T09:51:00Z'; // NOW is 2026-09-25T12:00Z: more than a day pending
  const stuck = gitbookSignal({ CoalLedger: { headAge: DAY_MS, touches: true, statuses: [{ context: 'GitBook (./)', state: 'pending', updated_at: old }, { context: 'GitBook - Docs', state: 'pending', updated_at: old }] } }, NOW);
  assert.equal(stuck.length, 1, 'one finding per repository');
  assert.match(stuck[0].text, /still pending/);
  assert.match(stuck[0].text, /2026-09-24T09:51:00Z/);
  const inside = gitbookSignal({ CoalLedger: { headAge: 60000, touches: true, statuses: [{ context: 'GitBook (./)', state: 'pending', updated_at: '2026-09-25T11:55:00Z' }] } }, NOW);
  assert.deepEqual(inside, []);
  const nodate = gitbookSignal({ X: { headAge: 0, touches: false, statuses: [{ context: 'GitBook (./)', state: 'pending' }] } }, NOW);
  assert.equal(nodate.length, 1, 'a pending status with no readable date cannot be shown fresh, so it is reported');
});

test('gitbookSyncedFiles + touchesSynced: the readme, the summary and the pages the summary lists (per .gitbook.yaml) are synced; a script, test or workflow is not; a directory mapping syncs everything under it', () => {
  const cfg = 'root: ./\nstructure:\n  readme: README.md\n  summary: SUMMARY.md\n';
  const summary = '# Table of contents\n\n* [CoalLedger](README.md)\n* [Changelog](CHANGELOG.md)\n\n## Canaries\n\n* [doc-rot](skills/doc-rot/SKILL.md)\n* [site](https://example.invalid/x.md)\n';
  const synced = gitbookSyncedFiles(cfg, summary);
  for (const f of ['README.md', 'SUMMARY.md', 'CHANGELOG.md', 'skills/doc-rot/SKILL.md']) assert.equal(touchesSynced([f], synced), true, f);
  for (const f of ['scripts/verify.mjs', '.github/workflows/ci.yml', 'plugin/hooks/hooks.json', 'scripts/lib/x.test.mjs']) assert.equal(touchesSynced([f], synced), false, f);
  assert.equal(touchesSynced(['scripts/a.mjs', 'README.md'], synced), true, 'one synced file among others is enough');
  const docs = gitbookSyncedFiles('site:\n  structure:\n    - type: space\n      content:\n        directory: ./profile\n    - type: space\n      content:\n        directory: ./benchmarks/CoalMine\n', '');
  assert.equal(touchesSynced(['profile/README.md'], docs), true);
  assert.equal(touchesSynced(['benchmarks/CoalMine/RESULTS.md'], docs), true);
  assert.equal(touchesSynced(['scripts/x.mjs', 'templates/a/b.md'], docs), false);
  assert.equal(gitbookSyncedFiles('nothing: here\n', ''), null, 'a config it cannot read yields unknown, not an empty set');
  assert.equal(touchesSynced(['README.md'], null), null, 'unknown stays unknown');
  assert.equal(touchesSynced(Array.from({ length: 300 }, (_, i) => 'src/f' + i + '.js'), synced), true, 'a commit listing 300 files may be truncated: assume it touched');
  assert.equal(touchesSynced(undefined, synced), null);
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
  const res = spawnSync(process.execPath, ['--max-old-space-size=512', SCRIPT], {
    cwd: dir, encoding: 'utf8', timeout: 60000,
    env: { ...process.env, NODE_OPTIONS: `--import=${pathToFileURL(stub).href}`, STUB_STATE: JSON.stringify(state), STUB_LOG: log, GITHUB_OUTPUT: out, GH_TOKEN: '' },
  });
  const calls = fs.readFileSync(log, 'utf8').split('\n').filter(Boolean);
  const report = fs.existsSync(path.join(dir, 'org-health-report.md')) ? fs.readFileSync(path.join(dir, 'org-health-report.md'), 'utf8') : '';
  const output = fs.readFileSync(out, 'utf8');
  fs.rmSync(dir, { recursive: true, force: true });
  return { res, calls, report, output };
}

// realistic GitBook shapes for the CLI: a repo whose head is a README push, and one whose head is a code-only push (issue #20)
const b64 = (t) => Buffer.from(t, 'utf8').toString('base64');
const CFG = { content: b64('root: ./\nstructure:\n  readme: README.md\n  summary: SUMMARY.md\n'), encoding: 'base64' };
const SUM = { content: b64('# Table of contents\n\n* [CoalLedger](README.md)\n* [Changelog](CHANGELOG.md)\n'), encoding: 'base64' };
const synced = (files, statuses, date = '2026-09-01T00:00:00Z') => ({
  '/orgs/TheColliery/repos': [{ name: 'CoalLedger', default_branch: 'main' }],
  '/repos/TheColliery/CoalLedger/actions/workflows': { workflows: [] },
  '/repos/TheColliery/CoalLedger/actions/runs': { workflow_runs: [] },
  '/repos/TheColliery/CoalLedger/contents/.gitbook.yaml': CFG,
  '/repos/TheColliery/CoalLedger/contents/SUMMARY.md': SUM,
  '/repos/TheColliery/CoalLedger/commits/main': { commit: { committer: { date } }, files: files.map((filename) => ({ filename })) },
  '/repos/TheColliery/CoalLedger/commits/main/status': { statuses },
});

test('org-health-watch.mjs: a code-only head with no GitBook status is clean; a README head with none is a finding; a pending status is a finding (the three shapes of issue #20)', () => {
  let r = runCli(synced(['scripts/verify.mjs', 'scripts/verify.test.mjs'], []));
  assert.equal(r.res.status, 0, r.res.stdout + r.res.stderr);
  assert.match(r.output, /has_findings=false/); assert.match(r.report, /no finding/i);
  r = runCli(synced(['README.md', 'scripts/verify.mjs'], []));
  assert.match(r.output, /has_findings=true/); assert.match(r.report, /\[CoalLedger\] .*touched a file the GitBook space syncs/);
  r = runCli(synced(['scripts/verify.mjs'], [{ context: 'GitBook (./)', state: 'pending', updated_at: '2026-10-02T09:51:00Z' }]));
  assert.match(r.output, /has_findings=true/); assert.match(r.report, /still pending/);
  r = runCli(synced(['README.md'], [{ context: 'GitBook (./)', state: 'success', updated_at: '2026-09-01T00:00:00Z' }]));
  assert.match(r.output, /has_findings=false/);
  assert.ok(r.calls.some((c) => c.endsWith('/contents/SUMMARY.md')), 'the summary is read to learn which pages the space syncs');
});

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

// UMB-257 F (CodeQL js/http-to-file-access, alert #21; the shape that closed alert #2): text from the API reaches the
// report file, and from there an issue body, only after it is parsed at the boundary into a name from a closed alphabet,
// a github.com address, or an ISO date. Anything else becomes a fixed fallback, never an echo of the offending text.
test('safeName / safeUrl / safeDate: the closed alphabet passes; markdown, newlines, backticks, control characters and over-long text become the fallback', async () => {
  const m = await import('./org-health-watch.mjs');
  assert.equal(m.safeName('scorecard.yml'), 'scorecard.yml');
  assert.equal(m.safeName('CI (Node 22) #1'), 'CI (Node 22) #1');
  for (const bad of ['x\ny', 'a`b', '[a](http://evil)', '<b>x</b>', 'a|b', '', 'x'.repeat(121), 'a\u202eb', '\u0000', 7, null, undefined, {}]) {
    assert.equal(m.safeName(bad), '(name outside the safe alphabet)', JSON.stringify(bad));
  }
  assert.equal(m.safeUrl('https://github.com/TheColliery/CoalMine/actions/runs/1'), 'https://github.com/TheColliery/CoalMine/actions/runs/1');
  for (const bad of ['http://github.com/x', 'https://evil.example/x', 'https://github.com/x y', 'javascript:alert(1)', 'u1', '', null]) assert.equal(m.safeUrl(bad), '', JSON.stringify(bad));
  assert.equal(m.safeDate('2026-08-06T00:00:00Z'), '2026-08-06T00:00:00Z');
  assert.equal(m.safeDate('2026-08-06T00:00:00.123Z'), '2026-08-06T00:00:00.123Z');
  for (const bad of ['yesterday', '2026-08-06', '2026-08-06T00:00:00Z\nINJECT', null]) assert.equal(m.safeDate(bad), '(unreadable date)', JSON.stringify(bad));
});

test('a finding built from hostile API text carries only safe text: no newline, backtick, link or tag survives into the report', async () => {
  const m = await import('./org-health-watch.mjs');
  const hostile = 'evil\n## injected`[x](http://evil)<img src=x>';
  const f1 = m.disabledWorkflows({ [hostile]: [{ path: '.github/workflows/' + hostile, state: 'disabled_inactivity', html_url: 'http://evil' }] });
  const f2 = m.staleQueuedRuns({ [hostile]: [{ name: hostile, status: 'queued', created_at: '2026-08-06T00:00:00Z', html_url: 'https://evil.example' }] }, NOW);
  const f3 = m.gitbookSignal({ [hostile]: { headAge: 0, statuses: [{ context: 'GitBook ' + hostile, state: 'failure' }] } }, NOW);
  const report = m.buildReport([...f1, ...f2, ...f3], { repos: 1, workflows: 1, synced: 1 });
  for (const bad of ['## injected', '`', '](', '<img', 'http://evil', 'evil.example', 'INJECT']) assert.ok(!report.includes(bad), 'the report must not carry ' + JSON.stringify(bad));
  assert.equal(f1.length + f2.length + f3.length, 3, 'each hostile record is still a finding, named by the fallback');
  assert.ok(report.split('\n').every((l) => !l.startsWith('#') || l.startsWith('# ') === false), 'no heading can be injected');
});
