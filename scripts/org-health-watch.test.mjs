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
  if (hit && hit[1] && hit[1].__throw) throw new TypeError('fetch failed');
  if (hit && hit[1] && hit[1].__pages) {
    const page = Number(new URL('https://x' + p).searchParams.get('page') || 1);
    return new Response(JSON.stringify(hit[1].__pages[page - 1] ?? (Array.isArray(hit[1].__pages[0]) ? [] : {})), { status: 200 });
  }
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

// ---- 14h, UMB3-006 (CodeRabbit on org-health-watch.mjs: the root mapping, the default readme and summary, a rejected fetch, pagination) ----

test('gitbookSyncedFiles: a directory mapping of the repository root (. or ./) syncs every file, a deeper mapping still only its own prefix (UMB3-006)', () => {
  for (const root of ['.', './', './.']) {
    const s = gitbookSyncedFiles(`site:\n  structure:\n    - type: space\n      content:\n        directory: ${root}\n`, '');
    assert.ok(s, root);
    assert.equal(touchesSynced(['src/a.js'], s), true, root + ' matches any file');
    assert.equal(touchesSynced(['README.md'], s), true, root);
  }
  const deeper = gitbookSyncedFiles('site:\n  structure:\n    - type: space\n      content:\n        directory: ./docs\n', '');
  assert.equal(touchesSynced(['src/a.js'], deeper), false);
  assert.equal(touchesSynced(['docs/a.md'], deeper), true);
  assert.equal(touchesSynced(['README.md', 'SUMMARY.md'], deeper), false, 'a directory-mapped config syncs its mapped directories only, never a default README.md or SUMMARY.md');
});

test('gitbookSyncedFiles: a .gitbook.yaml that omits structure.readme and structure.summary syncs README.md and SUMMARY.md under its root, and the pages that summary lists (UMB3-006)', () => {
  const s = gitbookSyncedFiles('root: ./docs/\n', '* [A](guide/a.md)\n');
  assert.deepEqual([...s.exact].sort(), ['docs/README.md', 'docs/SUMMARY.md', 'docs/guide/a.md']);
  assert.equal(touchesSynced(['docs/README.md'], s), true);
  assert.equal(touchesSynced(['README.md', 'scripts/x.mjs'], s), false, 'the repository README is not the space README once a root is set');
  const half = gitbookSyncedFiles('structure:\n  readme: intro.md\n', '');
  assert.deepEqual([...half.exact].sort(), ['SUMMARY.md', 'intro.md']);
  const other = gitbookSyncedFiles('structure:\n  summary: toc/SUMMARY.md\n', '');
  assert.deepEqual([...other.exact].sort(), ['README.md', 'toc/SUMMARY.md']);
  assert.equal(gitbookSyncedFiles('', ''), null, 'an unreadable (empty) config stays unknown');
  assert.deepEqual([...gitbookSyncedFiles('redirects:\n  old: new.md\n', '').exact].sort(), ['README.md', 'SUMMARY.md'], 'a config with only redirects is read as the defaults');
  assert.equal(gitbookSyncedFiles('# only a comment\n', ''), null, 'a config with no key GitBook reads stays unknown');
});

test('org-health-watch.mjs: a .gitbook.yaml with no structure reads the default SUMMARY.md and flags a README head with no status (UMB3-006)', () => {
  const state = synced(['README.md'], []);
  state['/repos/TheColliery/CoalLedger/contents/.gitbook.yaml'] = { content: b64('root: ./\n'), encoding: 'base64' };
  const r = runCli(state);
  assert.equal(r.res.status, 0, r.res.stdout + r.res.stderr);
  assert.match(r.output, /has_findings=true/);
  assert.match(r.report, /touched a file the GitBook space syncs/);
  assert.ok(r.calls.some((c) => c.endsWith('/contents/SUMMARY.md')), 'the default summary is read before the head is judged');
});

test('org-health-watch.mjs: a fetch that rejects (a timeout or a network error) is an unreadable finding and the report and has_findings are still written, exit 0 (UMB3-006)', () => {
  let r = runCli({ ...LIVE_SHAPE, '/repos/TheColliery/CoalLedger/actions/runs': { __throw: true } });
  assert.equal(r.res.status, 0, r.res.stdout + r.res.stderr);
  assert.match(r.report, /\[CoalLedger\] could not read the queued runs \(no answer: a timeout or a network error\)/);
  assert.match(r.output, /has_findings=true/);
  r = runCli({ '/orgs/TheColliery/repos': { __throw: true } });
  assert.equal(r.res.status, 0, r.res.stdout + r.res.stderr);
  assert.match(r.report, /could not read the organization's public repository list/);
  assert.match(r.output, /has_findings=true/);
  r = runCli({ '/orgs/TheColliery/repos': { __status: 502 } });
  assert.equal(r.res.status, 0, 'an HTTP failure on the list is a finding too, never a crash');
  assert.match(r.report, /public repository list \(HTTP 502\)/);
});

// the pager itself is tested in scripts/paginate.test.mjs; here the CLI is held to it (the queued-runs test below) and to the re-export
test('org-health-watch.mjs still exports getAllPages (the shared pager of scripts/lib/paginate.mjs)', async () => {
  const m = await import('./org-health-watch.mjs');
  const p = await import('./lib/paginate.mjs');
  assert.equal(m.getAllPages, p.getAllPages);
});

test('org-health-watch.mjs: a queued run on the SECOND page of the runs list is found (the first hundred were all fresh) -- RED while only page one was read (UMB3-006)', () => {
  const fresh = Array.from({ length: 100 }, (_, i) => ({ name: 'CI ' + i, status: 'queued', created_at: new Date().toISOString() }));
  const stale = [{ name: 'CodeQL', status: 'queued', created_at: '2026-08-06T16:51:17Z' }];
  const state = { ...LIVE_SHAPE, '/repos/TheColliery/CoalLedger/actions/runs': { __pages: [{ workflow_runs: fresh }, { workflow_runs: stale }] } };
  const r = runCli(state);
  assert.equal(r.res.status, 0, r.res.stdout + r.res.stderr);
  assert.match(r.report, /\[CoalLedger\] .*CodeQL.*queued/);
  assert.ok(r.calls.some((c) => /actions\/runs\?.*page=2/.test(c)), 'page 2 was requested: ' + r.calls.join(' | '));
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

// UMB3-032 (CodeRabbit Lcf22c1f6210c, Lee7a928ff611): what the summary links to
test('gitbookSyncedFiles: a summary link with a quoted Markdown title (double, single or parenthesised), with or without a fragment, is a synced page -- RED before UMB3-032', () => {
  const cfg = 'root: ./\nstructure:\n  summary: SUMMARY.md\n';
  const summary = '* [Install](guides/install.md "Installation")\n* [B](b.md \'Single quoted\')\n* [C](c.md (Paren title))\n* [D](d.md#frag "T")\n* [E](e.md)\n';
  const exact = gitbookSyncedFiles(cfg, summary).exact;
  for (const p of ['guides/install.md', 'b.md', 'c.md', 'd.md', 'e.md']) assert.ok(exact.includes(p), p + ' in ' + exact.join(','));
});

test('gitbookSyncedFiles: a parent-relative summary link resolves against the summary\'s own directory, stays when it lands inside the root, and is dropped when it climbs out of it -- RED before UMB3-032', () => {
  const inRoot = gitbookSyncedFiles('root: docs\nstructure:\n  summary: guide/SUMMARY.md\n', '* [i](../intro.md)\n* [x](../../README.md)\n* [y](sub/../a.md)\n* [z](./b.md)\n* [s](../../docs2/x.md)\n').exact;
  for (const p of ['docs/intro.md', 'docs/guide/a.md', 'docs/guide/b.md']) assert.ok(inRoot.includes(p), p + ' in ' + inRoot.join(','));
  assert.equal(inRoot.some((p) => p === 'README.md' || p === 'docs2/x.md' || p.split('/').includes('..')), false, 'a link out of the root is not a synced page');
  const atRoot = gitbookSyncedFiles('root: ./\nstructure:\n  summary: SUMMARY.md\n', '* [up](../x.md)\n* [ok](a/../b.md)\n').exact;
  assert.deepEqual(atRoot.filter((p) => !['SUMMARY.md', 'README.md'].includes(p)), ['b.md'], 'README.md and SUMMARY.md are the defaults a config with a summary names');
});
// ---- 28b: the front doors' scheduled warnings (main's ruling (1) on 27g; the 27i/28a design with the umbrella auditor's points A to E, unit 4 of its
// 27i return). Each test name says which point it pins, so a mutant maps to a point. Public rooms only: the org list is read with type=public, and an
// annotation read of a public room needs no token (the auditor's reads, 27i).
import { newestRun, quoteUrl, quoteWarning, frontDoorRoom, frontDoorSection, COUNT_SHAPE, STALE_AFTER_DAYS, QUOTE_MAX, URL_MAX, LINE_MAX, SECTION_MAX, BODY_MAX, FRONT_DOOR_WORKFLOW, buildBody, SECTION_NOT_SHOWN } from './org-health-watch.mjs';

// a quoted warning is a line that opens with two spaces, a dash and a code span: counted structurally, never by matching a host (CodeQL's
// js/regex/missing-regexp-anchor read three host regexes here as URL checks, alerts 38 to 40 on #256)
const quotedLines = (text) => text.split('\n').filter((l) => l.startsWith('  - ' + String.fromCharCode(96))).length;
const FD_NOW = Date.parse('2026-11-30T02:30:00Z'); // a Monday read; the check ran on the Monday before at 06:17
const fdRun = (over = {}) => ({ id: 501, status: 'completed', conclusion: 'success', created_at: '2026-11-23T06:17:00Z', html_url: 'https://github.com/TheColliery/CoalFace/actions/runs/501', ...over });
const NOTE = (message = '0 finding(s), 2 warning(s)') => ({ annotation_level: 'notice', title: 'front-door-links-count', message, path: '.github', start_line: 1 });
const WARN = (url = 'https://img.shields.io/badge/x-y-blue', reason = 'no answer (timeout)', p = 'README.md', line = 3) => ({
  annotation_level: 'warning', title: 'front-door-links', path: p, start_line: line,
  message: `${url}: ${reason} (an image: its host's answer says nothing about this repository, so it does not fail the run)`,
});

test('newest run: the largest created_at of a shuffled page wins, whatever order the API gives (the list order is undocumented) -- RED before 28b', () => {
  const page = ['2026-11-09T06:17:00Z', '2026-11-23T06:17:00Z', '2026-11-02T06:17:00Z', '2026-11-16T06:17:00Z'].map((created_at, i) => fdRun({ id: 600 + i, created_at }));
  assert.equal(newestRun(page).id, 601);
  assert.equal(newestRun([...page].reverse()).id, 601);
  assert.equal(newestRun([]), null);
  assert.equal(newestRun([fdRun({ created_at: 'not a date' })]), null, 'a run with no readable date is never "newest"');
});

test('A: exactly ONE count notice of the whole shape reads the counts; none beside warnings, two, or another shape reads as unreadable -- RED before 28b', () => {
  const read = frontDoorRoom({ repo: 'CoalFace', run: fdRun(), annotations: [NOTE(), WARN(), WARN()], now: FD_NOW });
  assert.deepEqual([read.state, read.findings, read.warnings, read.quotes.length], ['read', 0, 2, 2]);
  assert.match('0 finding(s), 0 warning(s)', COUNT_SHAPE, 'the CLI\'s own notice, as GitHub recorded it on #255\'s run, matches the one shape');
  for (const [anns, why] of [[[WARN()], 'warnings and no count notice'], [[NOTE(), NOTE()], 'two count notices'], [[NOTE('2 findings, 1 warning')], 'a notice of another shape'], [[NOTE('0 finding(s)')], 'a notice that leaves out a number']]) {
    // 28f, TURNED ON PURPOSE (main's ruling on the auditor's 28c finding 3): "warnings and no count notice" is unreadable only when the copy the run ran
    // holds the count title; the case is now stated with that copy (an older copy is neighbour (c), pinned in the 28f tests)
    assert.equal(frontDoorRoom({ repo: 'CoalFace', run: fdRun(), annotations: anns, copyHoldsCount: true, now: FD_NOW }).state, 'unreadable', why);
  }
});

test('A: only a notice and warnings carrying the checker\'s own titles AND levels count; a failure or an error annotation with the same title is ignored -- RED before 28b', () => {
  const r = frontDoorRoom({ repo: 'CoalFace', run: fdRun(), now: FD_NOW, annotations: [NOTE('0 finding(s), 1 warning(s)'), WARN(), { ...WARN(), annotation_level: 'failure' }, { ...NOTE(), annotation_level: 'warning' }, { ...WARN(), title: 'other' }] });
  assert.equal(r.state, 'read');
  assert.equal(r.quotes.length, 1);
});

test('B: a newest run older than the watcher\'s own staleness limit (8 days, a number of ours) is stale and its warnings are not quoted; 7 days is current -- RED before 28b', () => {
  assert.equal(STALE_AFTER_DAYS, 8);
  const day = 24 * 60 * 60 * 1000;
  assert.equal(frontDoorRoom({ repo: 'CoalFace', run: fdRun({ created_at: new Date(FD_NOW - 7 * day).toISOString() }), annotations: [NOTE(), WARN(), WARN()], now: FD_NOW }).state, 'read');
  const stale = frontDoorRoom({ repo: 'CoalFace', run: fdRun({ created_at: new Date(FD_NOW - 9 * day).toISOString() }), annotations: [NOTE(), WARN(), WARN()], now: FD_NOW });
  assert.equal(stale.state, 'stale');
  const s = frontDoorSection([stale], []);
  assert.equal(s.findings.length, 1, 'a stale run is a finding: the weekly check did not run');
  assert.match(s.findings[0].text, /staleness limit of 8 days/);
  assert.match(s.text, /staleness limit \(8 days, a number of ours\)/);
  assert.equal(quotedLines(s.text), 0, 'a stale run\'s warnings are not quoted as current');
});

test('C: only success and failure carry a count; a run cancelled by its own concurrency group, timed out or skipped "did not finish"; a failure is quoted AND is a finding -- RED before 28b', () => {
  for (const conclusion of ['cancelled', 'timed_out', 'skipped']) {
    const r = frontDoorRoom({ repo: 'CoalFace', run: fdRun({ conclusion }), annotations: [], now: FD_NOW });
    assert.deepEqual([r.state, r.conclusion], ['unfinished', conclusion], conclusion);
  }
  const s = frontDoorSection([frontDoorRoom({ repo: 'CoalFace', run: fdRun({ conclusion: 'cancelled' }), annotations: [], now: FD_NOW })], []);
  // 28d, TURNED ON PURPOSE (main's ruling on the auditor's 28a unit 3): "did not finish" was a header line in 28b and is now a FINDING for a room that
  // carries the workflow, its words saying that a scheduled run cancelled by a push was followed by that push's own run
  assert.equal(s.findings.length, 1, 'a cancelled run is a finding');
  assert.match(s.findings[0].text, /the newest scheduled run did not finish \(cancelled\); a scheduled run cancelled by a push was followed by that push's own run/);
  const failed = frontDoorSection([frontDoorRoom({ repo: 'CoalFace', run: fdRun({ conclusion: 'failure' }), annotations: [NOTE('1 finding(s), 1 warning(s)'), WARN()], now: FD_NOW })], []);
  assert.ok(failed.findings.some((f) => /failed/.test(f.text)), 'the failure is a finding of its own');
  assert.equal(quotedLines(failed.text), 1, 'a failed run\'s warnings are still quoted');
});

test('D: a URL is cut BEFORE its code span is closed, the cut is marked in words outside it, and an @name stays inside the span -- RED before 28b', () => {
  const tick = String.fromCharCode(96);
  const long = 'https://img.shields.io/' + 'a'.repeat(URL_MAX + 40);
  const q = quoteUrl(long);
  assert.ok(q.startsWith(tick) && q.indexOf(tick, 1) === URL_MAX + 1, 'the span opens, holds the cut URL and closes');
  assert.ok(q.endsWith(' (cut)'));
  const pct = quoteUrl('https://x.example/' + 'b'.repeat(URL_MAX - 20) + '%2Fend');
  assert.equal(pct.split(tick).length, 3, 'a cut inside a percent escape still leaves a closed span');
  assert.equal(quoteUrl('https://x.example/@someone/badge.svg'), `${tick}https://x.example/@someone/badge.svg${tick}`, 'an @name is inside the span, where it notifies nobody');
  for (const bad of [`https://x.example/a${tick}b`, 'https://x.example/a b', 'https://x.example/a|b', 'https://x.example/<b>']) {
    assert.doesNotMatch(quoteUrl(bad), /x\.example/, `outside the alphabet: ${bad}`);
  }
});

test('D: every quoted line stays within its bound, and the section is cut at line ends only, the cut said in words -- RED before 28b', () => {
  const huge = WARN('https://img.shields.io/' + 'c'.repeat(400), 'no answer (UND_ERR_CONNECT_TIMEOUT)', 'docs/' + 'p'.repeat(200) + '.md', 99999);
  assert.ok(quoteWarning(huge).length <= LINE_MAX, quoteWarning(huge));
  const rooms = Array.from({ length: 400 }, (_, i) => frontDoorRoom({ repo: 'Room' + i, run: fdRun(), now: FD_NOW, annotations: [NOTE('0 finding(s), 10 warning(s)'), ...Array.from({ length: 10 }, () => WARN('https://img.shields.io/' + 'd'.repeat(110)))] }));
  const s = frontDoorSection(rooms, []);
  assert.ok(s.text.length <= SECTION_MAX, String(s.text.length));
  assert.match(s.text, /section cut at a line end: \d+ line\(s\) not shown/);
  const tick = String.fromCharCode(96);
  for (const line of s.text.split('\n')) assert.equal(line.split(tick).length % 2, 1, `an unclosed span: ${line}`);
});

test('E: a warning is split at the first ": ", the fixed suffix is dropped, only the reason\'s leading class is kept, and a redirect target is left out -- RED before 28b', () => {
  const tick = String.fromCharCode(96);
  const red = quoteWarning(WARN('https://img.shields.io/a', 'HTTP 503 after a redirect to https://evil.example/@someone'));
  // 28d, TURNED ON PURPOSE (item 8): the file name is now shown in its own code span, so the line ends `(<span>README.md</span>:3)`
  assert.ok(red.endsWith(`: HTTP 503 (${tick}README.md${tick}:3)`), red);
  assert.doesNotMatch(red, /evil|@someone|an image: its host/);
  assert.match(quoteWarning(WARN('https://img.shields.io/a', 'no answer (UND_ERR_CONNECT_TIMEOUT)')), /: no answer \(UND_ERR_CONNECT_TIMEOUT\) /);
  assert.match(quoteWarning(WARN('https://img.shields.io/a', 'HTTP 429, rate limited: not retried, read it by hand')), /: HTTP 429 /);
  assert.match(quoteWarning(WARN('https://img.shields.io/a', 'something else')), /\(reason not shown\)/);
  assert.match(quoteWarning({ ...WARN(), message: 'nocolonhere' }), /warning not readable/);
  assert.ok(red.startsWith(`- ${tick}https://img.shields.io/a${tick}`));
});

test('the cap: at ten recorded warnings the room says "10 shown" and cites the runner, with the notice\'s count as the true number; an eleventh is not quoted -- RED before 28b', () => {
  assert.equal(QUOTE_MAX, 10);
  const anns = [NOTE('0 finding(s), 14 warning(s)'), ...Array.from({ length: 11 }, (_, i) => WARN(`https://img.shields.io/n${i}`))];
  const r = frontDoorRoom({ repo: 'CoalFace', run: fdRun(), annotations: anns, now: FD_NOW });
  assert.deepEqual([r.warnings, r.quotes.length], [14, 10]);
  const s = frontDoorSection([r], []);
  assert.match(s.text, /14 warning\(s\)/);
  assert.match(s.text, /10 shown: the runner records at most 10 warnings per step \(actions\/runner ExecutionContext\.cs\)/);
  assert.doesNotMatch(s.text, /n10/);
});

test('neighbours (a), (c), (d): no run in the retention period, a checker that does not report yet, a room without the check: header lines only, never a finding -- RED before 28b', () => {
  const rooms = [
    frontDoorRoom({ repo: 'CoalNew', run: null, annotations: [], now: FD_NOW }),
    frontDoorRoom({ repo: 'CoalMine', run: fdRun(), annotations: [], now: FD_NOW }),
    frontDoorRoom({ repo: 'CoalWash', run: fdRun(), annotations: [], now: FD_NOW }),
  ];
  assert.deepEqual(rooms.map((r) => r.state), ['no-run', 'no-count', 'no-count']);
  const s = frontDoorSection(rooms, ['template-article']);
  assert.deepEqual(s.findings, [], 'none of these opens the issue');
  assert.match(s.text, /no completed scheduled run in the retention period: CoalNew/);
  const c = s.text.split('\n').filter((l) => /does not report warnings yet/.test(l));
  assert.equal(c.length, 1, 'ONE header line for (c)');
  assert.match(c[0], /2 room\(s\) whose checker does not report warnings yet \(re-copy owed\): CoalMine, CoalWash/);
  assert.match(s.text, /rooms without the check: template-article/);
});

test('a room with warnings is ONE finding naming the count and the run\'s date; its quotes go in the section with the run\'s link and the lag in words -- RED before 28b', () => {
  const s = frontDoorSection([frontDoorRoom({ repo: 'CoalFace', run: fdRun(), annotations: [NOTE(), WARN(), WARN()], now: FD_NOW })], []);
  assert.equal(s.findings.length, 1);
  assert.match(s.findings[0].text, /front-door-links: 2 warning\(s\) on the newest scheduled run \(2026-11-23T06:17:00Z\)/);
  assert.equal(s.findings[0].url, 'https://github.com/TheColliery/CoalFace/actions/runs/501');
  assert.match(s.text, /about six days and twenty hours old/);
  assert.match(s.text, /run of 2026-11-23T06:17:00Z: 2 warning\(s\), 0 finding\(s\)/);
});

const FD_STATE = (annotationsStatus = 200, headSha = 'a'.repeat(40)) => ({
  '/orgs/TheColliery/repos': [{ name: 'CoalFace', default_branch: 'main' }],
  '/repos/TheColliery/CoalFace/actions/workflows': { workflows: [{ id: 77, path: FRONT_DOOR_WORKFLOW, state: 'active' }] },
  '/repos/TheColliery/CoalFace/actions/workflows/77/runs': { workflow_runs: [fdRun({ created_at: new Date(Date.now() - 2 * 86400000).toISOString(), head_sha: headSha })] },
  '/repos/TheColliery/CoalFace/actions/runs': { workflow_runs: [] },
  '/repos/TheColliery/CoalFace/actions/runs/501/jobs': { jobs: [{ id: 9001, name: 'front-door-links' }] },
  '/repos/TheColliery/CoalFace/check-runs/9001/annotations': annotationsStatus === 200 ? [NOTE('0 finding(s), 1 warning(s)'), WARN()] : { __status: annotationsStatus },
  // 28d item 2, 28f: the room's checker at the run's commit, read once: its text holds the count title
  '/repos/TheColliery/CoalFace/contents/scripts/front-door-links.mjs': { sha: '0'.repeat(40), encoding: 'base64', content: Buffer.from("console.log('::notice title=front-door-links-count::')").toString('base64') },
});

test('org-health-watch.mjs: the front-door read asks for the newest completed SCHEDULED runs and the annotations at per_page=100 (A), quotes the warning, and a failed annotations read is unreadable -- RED before 28b', () => {
  let r = runCli(FD_STATE());
  assert.equal(r.res.status, 0, r.res.stdout + r.res.stderr);
  assert.ok(r.calls.some((c) => c.startsWith('/repos/TheColliery/CoalFace/actions/workflows/77/runs?') && c.includes('event=schedule') && c.includes('status=completed')), r.calls.join('\n'));
  assert.ok(r.calls.some((c) => c === '/repos/TheColliery/CoalFace/check-runs/9001/annotations?per_page=100'), r.calls.join('\n'));
  assert.match(r.output, /has_findings=true/);
  assert.match(r.report, /\[CoalFace\] front-door-links: 1 warning\(s\)/);
  assert.equal(quotedLines(r.report), 1, 'the one warning is quoted in the report');
  assert.ok(r.calls.includes(`/repos/TheColliery/CoalFace/contents/scripts/front-door-links.mjs?ref=${'a'.repeat(40)}`), 'item 2 (28f): one read of the room\'s checker, at the commit the run ran');
  assert.doesNotMatch(r.report, /could not read the room/);
  r = runCli(FD_STATE(403));
  assert.match(r.report, /\[CoalFace\] could not read the front-door-links annotations \(HTTP 403\)/);
});
// ---- 28d: the auditor's 28a unit 3 on #256, with main's rulings (each test names its item) -------------------------------------------------------
import { pickFrontDoorJob, gitBlobOf, quotePath } from './org-health-watch.mjs';

// 28f, TURNED ON PURPOSE (main's ruling (a) on the auditor's 28c findings 2 and 3): the input was "the copy equals the template" (cliCurrent) and is now
// "the copy the run ran holds the count title" (copyHoldsCount); the verdicts it pins are kept
test('item 1 + 2 (A\'s collision, when (c) ends): zero count notices is (c) while the copy the run ran holds no count title; a copy that holds it and printed none is unreadable -- RED before 28d, re-keyed 28f', () => {
  const base = { repo: 'CoalFace', workflowState: 'active', run: fdRun(), annotations: [], now: FD_NOW };
  assert.equal(frontDoorRoom({ ...base, copyHoldsCount: false }).state, 'no-count', 'a copy without the count title: the header line');
  assert.equal(frontDoorRoom({ ...base, copyHoldsCount: null }).state, 'no-count', 'a copy that could not be read stays the header line');
  const cur = frontDoorRoom({ ...base, copyHoldsCount: true });
  assert.equal(cur.state, 'unreadable');
  assert.match(cur.why, /the checker the run ran prints the count, and the run printed none/);
  const s = frontDoorSection([cur], []);
  assert.equal(s.findings.length, 1, 'a counting copy with no count is a finding');
});

test('item 2: gitBlobOf is git\'s own blob id (sha1 over "blob <size>\\0" and the bytes), so a room\'s copy compares with the template by the id the contents API reports -- RED before 28d', () => {
  assert.equal(gitBlobOf(Buffer.from('hello\n')), 'ce013625030ba8dba906f756967f9e9ca394464a');
  assert.equal(gitBlobOf(Buffer.alloc(0)), 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
});

test('item 3: a stale run and a run that did not finish are findings for a room that carries the workflow -- RED before 28d', () => {
  const day = 24 * 60 * 60 * 1000;
  const stale = frontDoorRoom({ repo: 'CoalFace', workflowState: 'active', run: fdRun({ created_at: new Date(FD_NOW - 9 * day).toISOString() }), annotations: [], now: FD_NOW });
  const unfinished = frontDoorRoom({ repo: 'CoalMine', workflowState: 'active', run: fdRun({ conclusion: 'timed_out' }), annotations: [], now: FD_NOW });
  const s = frontDoorSection([stale, unfinished], []);
  assert.deepEqual(s.findings.map((f) => f.repo).sort(), ['CoalFace', 'CoalMine']);
  assert.doesNotMatch(s.text, /did not finish/, 'no longer a header line');
});

// The values are GitHub's REST reference for workflows, docs.github.com/en/rest/actions/workflows (read 2026-11-28 through the docs' article body):
// "state: required, string, enum: active, deleted, disabled_fork, disabled_inactivity, disabled_manually".
test('item 5: a workflow whose state is anything but active is a finding by name; only an active workflow with no scheduled run stays a header line -- RED before 28d', () => {
  for (const state of ['deleted', 'disabled_fork', 'disabled_inactivity', 'disabled_manually']) {
    const r = frontDoorRoom({ repo: 'CoalNew', workflowState: state, run: null, annotations: [], now: FD_NOW });
    assert.equal(r.state, 'workflow-off', state);
    const s = frontDoorSection([r], []);
    // 28f, TURNED ON PURPOSE (LOW 5, one row for one fact): disabled_inactivity is reported by the watcher's first class (disabledWorkflows), not twice
    if (state === 'disabled_inactivity') { assert.deepEqual(s.findings, [], state); continue; }
    assert.equal(s.findings.length, 1, state);
    assert.match(s.findings[0].text, new RegExp(`front-door-links\\.yml is ${state}`), state);
  }
  const quiet = frontDoorRoom({ repo: 'CoalNew', workflowState: 'active', run: null, annotations: [], now: FD_NOW });
  assert.equal(quiet.state, 'no-run');
  assert.deepEqual(frontDoorSection([quiet], []).findings, []);
});

test('item 6 (new points 3 and 4): a foreign notice beside the count notice still reads as one; more warning annotations than M, or N above zero on a success run, is unreadable -- RED before 28d', () => {
  const foreign = { annotation_level: 'notice', title: 'Due to capacity constraints', message: 'macOS arm64 runners ...', path: '.github', start_line: 1 };
  const r = frontDoorRoom({ repo: 'CoalFace', workflowState: 'active', run: fdRun(), annotations: [foreign, NOTE('0 finding(s), 1 warning(s)'), WARN()], now: FD_NOW });
  assert.deepEqual([r.state, r.warnings], ['read', 1]);
  const more = frontDoorRoom({ repo: 'CoalFace', workflowState: 'active', run: fdRun(), annotations: [NOTE('0 finding(s), 1 warning(s)'), WARN(), WARN()], now: FD_NOW });
  assert.deepEqual([more.state, more.why], ['unreadable', 'more warning annotations than the count']);
  const ok = frontDoorRoom({ repo: 'CoalFace', workflowState: 'active', run: fdRun({ conclusion: 'success' }), annotations: [NOTE('2 finding(s), 0 warning(s)')], now: FD_NOW });
  assert.deepEqual([ok.state, ok.why], ['unreadable', 'findings on a successful run']);
  const failed = frontDoorRoom({ repo: 'CoalFace', workflowState: 'active', run: fdRun({ conclusion: 'failure' }), annotations: [NOTE('2 finding(s), 0 warning(s)')], now: FD_NOW });
  assert.equal(failed.state, 'read', 'findings on a failed run are what a failed run carries');
});

test('item 6 (new point 5): the job is picked by its name front-door-links; none or more than one is unreadable -- RED before 28d', () => {
  assert.deepEqual(pickFrontDoorJob([{ id: 1, name: 'other' }, { id: 2, name: 'front-door-links' }]), { job: { id: 2, name: 'front-door-links' } });
  assert.deepEqual(pickFrontDoorJob([{ id: 1, name: 'other' }]), { why: 'no job named front-door-links' });
  assert.deepEqual(pickFrontDoorJob([{ id: 1, name: 'front-door-links' }, { id: 2, name: 'front-door-links' }]), { why: '2 jobs named front-door-links' });
  assert.deepEqual(pickFrontDoorJob(undefined), { why: 'no job named front-door-links' });
});

test('item 7 (B at the limit): just under the watcher\'s own 8 days reads current, just over reads stale, on an injected clock -- RED before 28d', () => {
  const limit = STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
  const at = (ms) => frontDoorRoom({ repo: 'CoalFace', workflowState: 'active', run: fdRun({ created_at: new Date(FD_NOW - ms).toISOString() }), annotations: [NOTE(), WARN(), WARN()], now: FD_NOW }).state;
  assert.equal(at(limit - 1000), 'read');
  assert.equal(at(limit), 'read', 'exactly the limit is not past it');
  assert.equal(at(limit + 1000), 'stale');
});

test('item 8 (D): a quoted line meets its bound by the sizes of its parts, never by cutting the assembled line; a file name is shown in a code span under its own alphabet, or a fallback -- RED before 28d', () => {
  const tick = String.fromCharCode(96);
  const worst = quoteWarning(WARN('https://img.shields.io/' + 'c'.repeat(4000), 'no answer (' + 'U'.repeat(40) + ')', 'd/' + 'p'.repeat(75) + '.md', 999999));
  assert.ok(worst.length <= LINE_MAX, worst.length);
  assert.ok(worst.endsWith(`${tick}d/${'p'.repeat(75)}.md${tick}:999999)`), 'the whole line is there, uncut: ' + worst);
  assert.equal(quotePath('docs/a_b-c.md'), `${tick}docs/a_b-c.md${tick}`);
  for (const bad of [`a${tick}b.md`, 'a b.md', 'a|b.md', '<b>.md', 'x'.repeat(81)]) assert.equal(quotePath(bad), '(file not shown)', bad);
  assert.match(quoteWarning({ ...WARN(), path: 'a b.md' }), /\(\(file not shown\):3\)$/);
});

test('item 9 (E exact): the code in "no answer (<code>)" is letters, digits and underscore, at most 40; the kept number is exactly 5xx or 429 -- RED before 28d', () => {
  const r = (reason) => quoteWarning(WARN('https://img.shields.io/a', reason));
  assert.match(r('HTTP 503, then more'), /: HTTP 503 \(/);
  assert.match(r('HTTP 5034'), /\(reason not shown\)/);
  assert.match(r('HTTP 4291'), /\(reason not shown\)/);
  assert.match(r('HTTP 429x'), /\(reason not shown\)/);
  assert.match(r('no answer (' + 'A'.repeat(41) + ')'), /\(reason not shown\)/);
  assert.match(r('no answer (a-b)'), /\(reason not shown\)/);
  assert.match(r('no answer (ETIMEDOUT)'), /: no answer \(ETIMEDOUT\) \(/);
});
// ---- 28f: the auditor's 28c INSPECT of #256 (head 729421c), with main's rulings -------------------------------------------------------------------
test('28f item 1 (finding 1, HIGH): a failure run is a finding whatever the room\'s copy printed; a failed run, nothing printed, a copy without the count is (c) AND a failure -- RED before 28f', () => {
  const r = frontDoorRoom({ repo: 'CoalMine', workflowState: 'active', run: fdRun({ conclusion: 'failure' }), annotations: [], copyHoldsCount: false, now: FD_NOW });
  assert.equal(r.state, 'no-count');
  const s = frontDoorSection([r], []);
  assert.equal(s.findings.length, 1, 'the failure is a finding');
  assert.match(s.findings[0].text, /the newest scheduled run failed/);
  assert.match(s.text, /does not report warnings yet \(re-copy owed\): CoalMine/, 'the room is on the (c) line as well');
  // a failed run whose counting copy printed none: unreadable AND a failure
  const u = frontDoorSection([frontDoorRoom({ repo: 'CoalTipple', workflowState: 'active', run: fdRun({ conclusion: 'failure' }), annotations: [], copyHoldsCount: true, now: FD_NOW })], []);
  assert.deepEqual(u.findings.map((f) => f.kind).sort(), ['front-door', 'unreadable']);
});

test('28f items 2 and 3: the copy at the run\'s commit decides: a room re-copied this week whose run ran the old copy is (c), no false finding; a named divergence that prints the count reads normally; zero notices beside warnings is (c) or unreadable by the copy -- RED before 28f', () => {
  const base = { repo: 'CoalFace', workflowState: 'active', run: fdRun(), now: FD_NOW };
  const recopied = frontDoorRoom({ ...base, annotations: [], copyHoldsCount: false });
  assert.equal(recopied.state, 'no-count');
  assert.deepEqual(frontDoorSection([recopied], []).findings, [], 'the old copy the run ran is (c), not a false finding');
  const divergent = frontDoorRoom({ ...base, annotations: [NOTE('0 finding(s), 1 warning(s)'), WARN()], copyHoldsCount: true });
  assert.deepEqual([divergent.state, divergent.warnings], ['read', 1], 'a room whose copy differs from the template but prints the count reads normally');
  assert.equal(frontDoorRoom({ ...base, annotations: [WARN()], copyHoldsCount: false }).state, 'no-count', 'warnings without a count from a copy that cannot print one: (c)');
  assert.equal(frontDoorRoom({ ...base, annotations: [WARN()], copyHoldsCount: true }).state, 'unreadable', 'warnings without a count from a copy that prints one: unreadable');
});

test('28f item 2: the header counts the rooms that carry the template\'s current checker, a count and never a verdict -- RED before 28f', () => {
  const s = frontDoorSection([frontDoorRoom({ repo: 'CoalFace', workflowState: 'active', run: fdRun(), annotations: [NOTE(), WARN(), WARN()], copyHoldsCount: true, now: FD_NOW })], [], ['CoalFace']);
  assert.match(s.text, /- 1 room\(s\) carry the template's current checker: CoalFace/);
});

test('28f item 5 (LOW 5): a workflow disabled for inactivity is reported once, by the watcher\'s first class; the other states stay this section\'s findings -- RED before 28f', () => {
  const inactive = frontDoorSection([frontDoorRoom({ repo: 'CoalNew', workflowState: 'disabled_inactivity', run: null, annotations: [], now: FD_NOW })], []);
  assert.deepEqual(inactive.findings, [], 'disabledWorkflows already names it, with its link and its reason');
  const manual = frontDoorSection([frontDoorRoom({ repo: 'CoalNew', workflowState: 'disabled_manually', run: null, annotations: [], now: FD_NOW })], []);
  assert.equal(manual.findings.length, 1);
});

test('org-health-watch.mjs (28f items 2 and 3): a run whose head_sha is not 40 hex is unreadable and the room\'s checker is not read -- RED before 28f', () => {
  const r = runCli(FD_STATE(200, 'not-a-sha'));
  assert.equal(r.res.status, 0, r.res.stdout + r.res.stderr);
  assert.ok(!r.calls.some((c) => c.includes('/contents/scripts/front-door-links.mjs')), r.calls.join('\n'));
  assert.match(r.report, /\[CoalFace\] could not read the run's commit \(head_sha is not 40 hex\)/);
});
test('org-health-watch.mjs (28f items 2 and 3): main asks the copy\'s TEXT for the count title: a run that printed nothing beside a copy that holds it is unreadable, beside one that does not it is the (c) line -- pins the read (f7)', () => {
  const quiet = { ...FD_STATE(), '/repos/TheColliery/CoalFace/check-runs/9001/annotations': [] };
  let r = runCli(quiet);
  assert.equal(r.res.status, 0, r.res.stdout + r.res.stderr);
  assert.match(r.report, /\[CoalFace\] could not read the front-door-links count \(the checker the run ran prints the count, and the run printed none\)/);
  const old = { ...quiet, '/repos/TheColliery/CoalFace/contents/scripts/front-door-links.mjs': { sha: '1'.repeat(40), encoding: 'base64', content: Buffer.from("console.log('FAIL ...')").toString('base64') } };
  r = runCli(old);
  assert.doesNotMatch(r.report, /could not read the front-door-links count/);
  assert.match(r.report, /does not report warnings yet \(re-copy owed\): CoalFace/);
});
// ---- 28g: the bounds change (the auditor's 28c finding 4 and LOW 6 and 7 on #256; items 4 and 6 of 28f's list) ---------------------------------

test('item 4: a URL that holds the runner\'s legacy mark ##[ gets the fixed fallback, so the mark never reaches the watcher\'s own stdout -- RED before 28g', () => {
  for (const url of ['https://img.shields.io/badge/a##[error]b-x-blue', 'https://x.example/c?d=##[stop-commands]e']) {
    assert.equal(quoteUrl(url), '(address not shown: outside the safe alphabet)', url);
    const line = quoteWarning(WARN(url));
    assert.ok(!line.includes('##['), line);
  }
  const s = frontDoorSection([frontDoorRoom({ repo: 'CoalFace', run: fdRun(), annotations: [NOTE('0 finding(s), 1 warning(s)'), WARN('https://x.example/##[error]')], now: FD_NOW })], []);
  assert.ok(!s.text.includes('##['), s.text);
  const tick = String.fromCharCode(96);
  assert.equal(quoteUrl('https://x.example/a#b'), `${tick}https://x.example/a#b${tick}`, 'a fragment # alone is still quoted');
});

test('item 6: a room\'s own line is bounded too: its name shown whole up to its bound or a fixed fallback, its link shown whole up to URL_MAX or left out in words -- RED before 28g', () => {
  const roomLine = (s) => s.text.split('\n').find((l) => l.startsWith('- ['));
  const worst = frontDoorRoom({ repo: 'R'.repeat(120), run: fdRun({ conclusion: 'failure', html_url: 'https://github.com/' + 'a'.repeat(200) }), annotations: [NOTE('999999 finding(s), 999999 warning(s)')], now: FD_NOW });
  const line = roomLine(frontDoorSection([worst], []));
  assert.ok(line.length <= LINE_MAX, `${line.length}: ${line}`);
  assert.ok(line.startsWith('- [(name not shown)]'), line);
  assert.ok(line.endsWith(' (link not shown)'), line);
  const fits = frontDoorRoom({ repo: 'N'.repeat(80), run: fdRun({ conclusion: 'failure', created_at: '2026-11-23T06:17:00.123Z', html_url: 'https://github.com/' + 'b'.repeat(URL_MAX - 19) }), annotations: [NOTE('999999 finding(s), 999999 warning(s)')], now: FD_NOW });
  const whole = roomLine(frontDoorSection([fits], []));
  assert.ok(whole.length <= LINE_MAX, `${whole.length}: ${whole}`);
  assert.ok(whole.startsWith(`- [${'N'.repeat(80)}]`), whole);
  assert.ok(whole.endsWith('https://github.com/' + 'b'.repeat(URL_MAX - 19)), whole);
});

test('item 6: the BODY is the bound: the section is cut so the measured first part plus the section stays under GitHub\'s limit -- RED before 28g', () => {
  assert.equal(BODY_MAX, 65536, 'the platform\'s number, never ours');
  const rooms = Array.from({ length: 20 }, (_, i) => frontDoorRoom({ repo: 'Room' + i, run: fdRun(), now: FD_NOW, annotations: [NOTE('0 finding(s), 10 warning(s)'), ...Array.from({ length: 10 }, () => WARN('https://img.shields.io/' + 'd'.repeat(110)))] }));
  const alone = frontDoorSection(rooms, []);
  assert.ok(!alone.text.includes('section cut'), 'with no first part the 20 rooms fit');
  const first = 'x'.repeat(64000);
  const cut = frontDoorSection(rooms, [], [], first);
  assert.ok(first.length + 1 + cut.text.length <= BODY_MAX, String(first.length + 1 + cut.text.length));
  assert.match(cut.text, /section cut at a line end: \d+ line\(s\) not shown/);
  assert.deepEqual(cut.findings, alone.findings, 'the cut never drops a finding');
  const full = frontDoorSection(rooms, [], [], 'y'.repeat(BODY_MAX));
  assert.equal(full.text, '- (section not shown: the findings above fill the issue body)\n');
  assert.deepEqual(full.findings, alone.findings);
  assert.equal(frontDoorSection(rooms, [], [], 'short first part').text, alone.text, 'a small first part changes nothing');
});
test('item 6: for every first-part length across a line\'s span, the first part plus the section, cut line included, stays under BODY_MAX (a sweep, not one point) -- 28g', () => {
  const rooms = Array.from({ length: 20 }, (_, i) => frontDoorRoom({ repo: 'Room' + i, run: fdRun(), now: FD_NOW, annotations: [NOTE('0 finding(s), 10 warning(s)'), ...Array.from({ length: 10 }, () => WARN('https://img.shields.io/' + 'd'.repeat(110)))] }));
  let cuts = 0;
  for (let n = 64000; n < 64400; n++) {
    const s = frontDoorSection(rooms, [], [], 'x'.repeat(n));
    assert.ok(n + 1 + s.text.length <= BODY_MAX, `first part ${n}: ${n + 1 + s.text.length}`);
    if (s.text.includes('section cut')) cuts++;
  }
  assert.equal(cuts, 400, 'every length in the sweep forced a cut');
});

// TURNED ON PURPOSE in 28h (main's ruling on the 28g ask, option 1): this fixture's first part once passed BODY_MAX whole, and the test held that
// the section then gave way to one line. The first part is now cut at row ends too, so the same 500 queued runs give a body at or under BODY_MAX that
// says how many rows are not shown, and the count printed equals the rows dropped.
test('org-health-watch.mjs: main bounds the WHOLE body: 500 queued runs give a body at or under BODY_MAX, rows cut at line ends, the count of rows not shown equal to the rows dropped -- 28g, turned in 28h', () => {
  const old = new Date(Date.now() - 5 * 86400000).toISOString();
  const page = (p) => ({ workflow_runs: Array.from({ length: 100 }, (_, i) => ({ id: p * 100 + i, name: 'ci', status: 'queued', created_at: old, html_url: `https://github.com/TheColliery/CoalFace/actions/runs/${p * 100 + i}` })) });
  const state = { ...FD_STATE(), '/repos/TheColliery/CoalFace/actions/runs': { __pages: [page(1), page(2), page(3), page(4), page(5)] } };
  const r = runCli(state);
  assert.equal(r.res.status, 0, r.res.stdout + r.res.stderr);
  assert.ok(bytesOf(r.report) <= BODY_MAX, String(bytesOf(r.report))); // 28i: in UTF-8 bytes
  const total = Number(/^(\d+) findings? \(report only/m.exec(r.report)[1]);
  assert.ok(total > 500, String(total));
  const notShown = /^- \((\d+) finding row\(s\) not shown/m.exec(r.report);
  assert.ok(notShown, r.report.slice(-400));
  const firstEnd = notShown.index;
  const shown = r.report.slice(0, firstEnd).split('\n').filter((l) => l.startsWith('- [')).length;
  assert.equal(shown + Number(notShown[1]), total, 'the count printed equals the rows dropped');
  // 28i: the section's minimum may also be its cut line, the case the 28h sweep already allows
  assert.ok(r.report.includes('\n## front-door-links') || r.report.endsWith(SECTION_NOT_SHOWN) || /\n- \(section cut at a line end: \d+ line\(s\) not shown\)\n$/.test(r.report), 'the section keeps at least its one line');
});
// ---- 28g: the pins (the auditor's 28c LOW 8 on #256; item 7 of 28f's list). Each test names the survivor it holds -------------------------------

test('pin x4: the count shape is anchored at its end; trailing text or a trailing newline is another shape and reads as unreadable -- 28g', () => {
  for (const msg of ['0 finding(s), 1 warning(s) and more', '0 finding(s), 1 warning(s)\n', '0 finding(s), 1 warning(s)7']) {
    const r = frontDoorRoom({ repo: 'CoalFace', run: fdRun(), annotations: [NOTE(msg), WARN()], now: FD_NOW });
    assert.deepEqual([r.state, r.why], ['unreadable', 'a count notice of another shape'], JSON.stringify(msg));
  }
});

test('pins x15 and x38: the reason printed outside a span keeps only a code of letters, digits and underscore, and only HTTP 5xx or 429 -- 28g', () => {
  const reason = (text) => quoteWarning(WARN('https://img.shields.io/x', text));
  for (const text of ['no answer (a@b)', 'no answer (x/y)', 'HTTP 404', 'HTTP 403 Forbidden', 'HTTP 499']) {
    assert.ok(reason(text).includes(': (reason not shown) ('), `${text}: ${reason(text)}`);
  }
  assert.ok(reason('HTTP 503').includes(': HTTP 503 ('), reason('HTTP 503'));
  assert.ok(reason('no answer (UND_ERR_SOCKET)').includes(': no answer (UND_ERR_SOCKET) ('));
});

test('pins x36 and x12: the line number is a whole number from 0 to 999999 or "?", and a file name with @ is not shown -- 28g', () => {
  for (const line of [-1, 1e6, 2.5, '7', null]) {
    assert.ok(quoteWarning(WARN(undefined, undefined, 'README.md', line)).endsWith('`README.md`:?)'), String(line));
  }
  assert.ok(quoteWarning(WARN(undefined, undefined, 'README.md', 999999)).endsWith('`README.md`:999999)'));
  assert.equal(quotePath('docs/@someone.md'), '(file not shown)');
});

test('pins x31, x32 and x37: the run\'s link, conclusion and date are parsed at the boundary into the safe forms, never echoed -- 28g', () => {
  const link = frontDoorRoom({ repo: 'CoalFace', run: fdRun({ html_url: 'https://evil.example/TheColliery/runs/1' }), annotations: [NOTE(), WARN(), WARN()], now: FD_NOW });
  assert.deepEqual([link.state, link.url], ['read', '']);
  const cancelled = frontDoorRoom({ repo: 'CoalFace', run: fdRun({ conclusion: 'cancelled\n## forged' }), annotations: [], now: FD_NOW });
  assert.deepEqual([cancelled.state, cancelled.conclusion], ['unfinished', '(name outside the safe alphabet)']);
  const offset = frontDoorRoom({ repo: 'CoalFace', run: fdRun({ created_at: '2026-11-23T06:17:00+00:00' }), annotations: [NOTE(), WARN(), WARN()], now: FD_NOW });
  assert.deepEqual([offset.state, offset.date], ['read', '(unreadable date)']);
});

test('pin x27: main counts a room as carrying the template\'s checker only when the copy\'s blob id equals the template\'s -- 28g', () => {
  const template = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'templates', 'published-code', 'scripts', 'front-door-links.mjs');
  const same = { ...FD_STATE(), '/repos/TheColliery/CoalFace/contents/scripts/front-door-links.mjs': { sha: gitBlobOf(fs.readFileSync(template)), encoding: 'base64', content: Buffer.from("console.log('::notice title=front-door-links-count::')").toString('base64') } };
  let r = runCli(same);
  assert.equal(r.res.status, 0, r.res.stdout + r.res.stderr);
  assert.match(r.report, /1 room\(s\) carry the template's current checker: CoalFace/);
  r = runCli(FD_STATE());
  assert.doesNotMatch(r.report, /carry the template's current checker/);
});

test('pin x29: main reads the annotations of the job NAMED front-door-links, never the first job of the run -- 28g', () => {
  const state = { ...FD_STATE(), '/repos/TheColliery/CoalFace/actions/runs/501/jobs': { jobs: [{ id: 9002, name: 'lint' }, { id: 9001, name: 'front-door-links' }] } };
  const r = runCli(state);
  assert.equal(r.res.status, 0, r.res.stdout + r.res.stderr);
  assert.ok(r.calls.includes('/repos/TheColliery/CoalFace/check-runs/9001/annotations?per_page=100'), r.calls.join('\n'));
  assert.ok(!r.calls.some((c) => c.startsWith('/repos/TheColliery/CoalFace/check-runs/9002')), r.calls.join('\n'));
  assert.match(r.report, /- 1 room\(s\) read; 1 with warnings\./);
});

test('pins x33 and x34: a failed jobs read or annotations read is unreadable and never read as an empty list of annotations -- 28g', () => {
  for (const [key, what] of [['/repos/TheColliery/CoalFace/actions/runs/501/jobs', 'the front-door-links jobs'], ['/repos/TheColliery/CoalFace/check-runs/9001/annotations', 'the front-door-links annotations']]) {
    const r = runCli({ ...FD_STATE(), [key]: { __status: 502 } });
    assert.equal(r.res.status, 0, r.res.stdout + r.res.stderr);
    assert.ok(r.report.includes(`could not read ${what} (HTTP 502)`), r.report);
    assert.ok(!r.report.includes('the run printed none'), `${what}: a failed read became an empty list\n${r.report}`);
    assert.ok(!r.calls.some((c) => c.includes('/contents/scripts/front-door-links.mjs')), `${what}: the checker was read after a failed read`);
  }
});
// ---- 28h: the whole issue body is bounded (main's ruling on the 28g ask, option 1). The split rule: the front-door section gives way first, down
// to its one SECTION_NOT_SHOWN line; only then are the first part's rows cut, at row ends, down to its header, its count line and its one line
// naming how many rows are not shown ------------------------------------------------------------------------------------------------------------------

const H_COUNTS = { repos: 11, workflows: 99, synced: 2 };
const hFindings = (n, len) => Array.from({ length: n }, (_, i) => ({ repo: 'Room' + i, kind: 'queued', text: 'q'.repeat(len + (i % 7)), url: `https://github.com/TheColliery/Room${i}/actions/runs/${i}` }));
const hRooms = (k) => Array.from({ length: k }, (_, i) => frontDoorRoom({ repo: 'Door' + i, run: fdRun(), now: FD_NOW, annotations: [NOTE('0 finding(s), 10 warning(s)'), ...Array.from({ length: 10 }, () => WARN('https://img.shields.io/' + 'd'.repeat(110)))] }));
const NOT_SHOWN_ROWS = /^- \((\d+) finding row\(s\) not shown/m;

test('28h: a sweep over first-part and section lengths: the body stays at or under BODY_MAX, no row or section line is cut mid-line, the count printed equals the rows dropped, and the section gives way first', () => {
  const roomSets = [0, 3, 20, 60].map((k) => hRooms(k)).map((rooms) => ({ rooms, lines: new Set(frontDoorSection(rooms, [], [], '').text.split('\n')) }));
  let cutFirst = 0;
  let cutSection = 0;
  for (const len of [40, 150, 400]) {
    for (let n = 0; n <= 700; n += 9) {
      const f = hFindings(n, len);
      const rows = new Set(f.map((x) => `- [${x.repo}] ${x.text} — ${x.url}`));
      const whole = buildReport(f, H_COUNTS);
      for (const { rooms, lines: sectionLines } of roomSets) {
        const body = buildBody(f, H_COUNTS, rooms);
        const at = `len ${len}, n ${n}, rooms ${rooms.length}`;
        assert.ok(bytesOf(body) <= BODY_MAX, `${at}: ${bytesOf(body)}`);
        const ns = NOT_SHOWN_ROWS.exec(body);
        const sectionAt = ns ? body.indexOf('\n', ns.index) + 2 : whole.length + 1;
        const firstLines = body.slice(0, sectionAt).split('\n').filter((l) => l.startsWith('- ['));
        for (const l of firstLines) assert.ok(rows.has(l), `${at}: a row cut mid-line: ${l.slice(0, 80)}`);
        assert.equal(firstLines.length + (ns ? Number(ns[1]) : 0), n, `${at}: shown plus not shown`);
        if (bytesOf(whole) + 1 + bytesOf(SECTION_NOT_SHOWN) <= BODY_MAX) assert.ok(!ns, `${at}: a first part that fits beside the section's one line is never cut`);
        else cutFirst++;
        const sectionText = body.slice(sectionAt);
        for (const l of sectionText.split('\n')) {
          assert.ok(sectionLines.has(l) || /^- \(section cut at a line end: \d+ line\(s\) not shown\)$/.test(l) || l + '\n' === SECTION_NOT_SHOWN, `${at}: a section line cut mid-line: ${l.slice(0, 80)}`);
        }
        const lead = sectionText.split('\n')[0];
        assert.ok(lead.startsWith('## front-door-links') || lead.startsWith('- (section cut at a line end:') || lead + '\n' === SECTION_NOT_SHOWN, `${at}: the section keeps at least its one line: ${JSON.stringify(sectionText.slice(0, 80))}`);
        if (sectionText.includes('section cut') || sectionText === SECTION_NOT_SHOWN) cutSection++;
      }
    }
  }
  assert.ok(cutFirst > 0 && cutSection > cutFirst, `the sweep reached both cuts: first ${cutFirst}, section ${cutSection}`);
});

test('28h: the first part is cut at its budget exactly: a budget equal to its whole length cuts nothing, one less cuts one row or more and stays within the budget', () => {
  const f = hFindings(30, 100);
  const whole = buildReport(f, H_COUNTS);
  // 28i: the budget is in UTF-8 bytes (every row carries a three-byte dash)
  assert.equal(buildReport(f, H_COUNTS, bytesOf(whole)), whole);
  // every budget, one step at a time, down to where ten or more rows are dropped (a two-digit count needs the room a one-digit one does not)
  for (let budget = bytesOf(whole) - 1; budget > 400; budget -= 1) {
    const cut = buildReport(f, H_COUNTS, budget);
    assert.ok(bytesOf(cut) <= budget, `${budget}: ${bytesOf(cut)}`);
    const ns = NOT_SHOWN_ROWS.exec(cut);
    assert.ok(ns, String(budget));
    assert.equal(cut.split('\n').filter((l) => l.startsWith('- [')).length + Number(ns[1]), 30);
  }
});

test('28h: the first part\'s minimum is its header, its count line and its one not-shown line, under 400 characters even for the largest counts, so it always fits the body\'s budget for it', () => {
  const big = { repos: Number.MAX_SAFE_INTEGER, workflows: Number.MAX_SAFE_INTEGER, synced: Number.MAX_SAFE_INTEGER };
  const least = buildReport(hFindings(2000, 1), big, 0);
  assert.ok(least.length < 400, `${least.length}: ${least}`);
  assert.match(least, /^- \(2000 finding row\(s\) not shown/m);
  assert.ok(BODY_MAX - 1 - SECTION_NOT_SHOWN.length > 400);
});
// ---- 28i: the auditor's three LOW notes on the bound (28e on #256). LOW 1: the body is measured in UTF-8 bytes, the safe reading of a platform unit
// no primary source states; LOW 2: the split rule reads as the code runs; LOW 3: a row that cannot fit ends the list (kept, pinned) ------------------

const bytesOf = (s) => Buffer.byteLength(s, 'utf8');
const mbFindings = (n, len) => Array.from({ length: n }, (_, i) => ({ repo: 'Room' + i, kind: 'queued', text: 'é'.repeat(len + (i % 5)), url: `https://github.com/TheColliery/Room${i}/actions/runs/${i}` }));

test('LOW 1: rows of two-byte characters that fit in JavaScript characters and not in UTF-8 bytes still give a body at or under BODY_MAX in bytes, the count printed equal to the rows dropped -- RED before 28i', () => {
  const f = mbFindings(285, 150);
  const whole = buildReport(f, H_COUNTS);
  assert.ok(whole.length + 1 + SECTION_NOT_SHOWN.length <= BODY_MAX, `the fixture fits in characters: ${whole.length}`);
  assert.ok(bytesOf(whole) > BODY_MAX, `the fixture is over in bytes: ${bytesOf(whole)}`);
  const body = buildBody(f, H_COUNTS, []);
  assert.ok(bytesOf(body) <= BODY_MAX, String(bytesOf(body)));
  const ns = NOT_SHOWN_ROWS.exec(body);
  assert.ok(ns, body.slice(-300));
  const rows = new Set(f.map((x) => `- [${x.repo}] ${x.text} — ${x.url}`));
  const shown = body.slice(0, ns.index).split('\n').filter((l) => l.startsWith('- ['));
  for (const l of shown) assert.ok(rows.has(l), `a row cut mid-line: ${l.slice(0, 60)}`);
  assert.equal(shown.length + Number(ns[1]), 285);
});

test('LOW 1: a sweep in bytes: multi-byte first parts beside sections of many rooms stay at or under BODY_MAX in UTF-8 bytes, the section too when the first part is long in bytes -- RED before 28i', () => {
  const rooms = Array.from({ length: 150 }, (_, i) => frontDoorRoom({ repo: 'Door' + i, run: fdRun(), now: FD_NOW, annotations: [NOTE('0 finding(s), 1 warning(s)'), WARN('https://img.shields.io/' + 'd'.repeat(60))] }));
  for (const len of [40, 150]) {
    for (let n = 0; n <= 400; n += 11) {
      for (const set of [[], rooms]) {
        const body = buildBody(mbFindings(n, len), H_COUNTS, set);
        assert.ok(bytesOf(body) <= BODY_MAX, `len ${len}, n ${n}, rooms ${set.length}: ${bytesOf(body)}`);
      }
    }
  }
  const first = 'é'.repeat(30000);
  const s = frontDoorSection(rooms, [], [], first);
  assert.ok(bytesOf(first) + 1 + bytesOf(s.text) <= BODY_MAX, String(bytesOf(first) + 1 + bytesOf(s.text)));
  // the section's own lines carry a multi-byte dash, so its size is counted in bytes too: every first-part length across a span where the body's
  // bound, not SECTION_MAX, binds the section
  for (let n = 5500; n < 6500; n++) {
    const part = 'x'.repeat(n);
    const t = frontDoorSection(rooms, [], [], part).text;
    assert.ok(n + 1 + bytesOf(t) <= BODY_MAX, `first part ${n}: ${n + 1 + bytesOf(t)}`);
  }
});

test('LOW 3: a row that cannot fit ends the list, so the rows shown are always the first ones in order and the count names the rest, a smaller row after it included -- 28i', () => {
  const small = (i) => ({ repo: 'S' + i, kind: 'queued', text: 's'.repeat(50), url: '' });
  const f = [small(0), { repo: 'Big', kind: 'queued', text: 'b'.repeat(2000), url: '' }, small(1), small(2)];
  const lead = buildReport(f, H_COUNTS, 0).split('\n- (')[0];
  const budget = bytesOf(lead) + 3 * 80 + 200;
  const cut = buildReport(f, H_COUNTS, budget);
  assert.ok(bytesOf(cut) <= budget, String(bytesOf(cut)));
  const shown = cut.split('\n').filter((l) => l.startsWith('- ['));
  assert.deepEqual(shown.map((l) => l.slice(3, l.indexOf(']'))), ['S0'], 'the rows after the one that cannot fit are not shown, even the small ones');
  assert.equal(Number(NOT_SHOWN_ROWS.exec(cut)[1]), 3);
});
// ---- 28j: the auditor's i6 (28f on #261): a section line is checked in UTF-8 bytes, not characters. At this boundary the character check would keep
// one more line, Door136's room line with its three-byte dash; the byte check keeps Door135's quoted warning as the last line --------------------

test('i6 pin: at a first part of 30,208 bytes the section\'s last kept line is Door135\'s quoted warning, never Door136\'s room line, which only a check in characters would keep -- 28j', () => {
  const rooms = Array.from({ length: 150 }, (_, i) => frontDoorRoom({ repo: 'Door' + i, run: fdRun(), now: FD_NOW, annotations: [NOTE('0 finding(s), 1 warning(s)'), WARN('https://img.shields.io/' + 'd'.repeat(60))] }));
  const lines = frontDoorSection(rooms, [], [], 'x'.repeat(30208)).text.split('\n').filter(Boolean);
  assert.match(lines[lines.length - 1], /^- \(section cut at a line end: \d+ line\(s\) not shown\)$/);
  assert.equal(lines[lines.length - 2], '  - `https://img.shields.io/' + 'd'.repeat(60) + '`: no answer (timeout) (`README.md`:3)');
  assert.ok(lines[lines.length - 3].startsWith('- [Door135] '), lines[lines.length - 3]);
  assert.ok(!lines.some((l) => l.startsWith('- [Door136] ')), 'the room line a check in characters would keep');
});
// ---- 28m (UMB4-115 part (a), item 4): org-health-watch.mjs asked a pattern on the NAME in argv[1] (/org-health-watch\.mjs$/), a third shape: a path that ends in that name and names no file
// (or a differently-located file of that name) was "the entry", so an import ran the whole watcher against the API. It takes the ruled text. Imported with such an argv path, it runs nothing.
// A fetch stub is preloaded, so a guard that wrongly runs the watcher meets no network: it logs the call, and the test reads the log.
const IMPORT_STUB = `
import fs from 'node:fs';
globalThis.fetch = async (url) => { fs.appendFileSync(process.env.STUB_LOG, String(url) + '\\n'); throw new TypeError('fetch failed'); };
`;
test('org-health-watch.mjs imported with an argv path that ends in its name and names no file does not run: the entry guard fails closed -- RED before 28m', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ohw-import-'));
  try {
    const stub = path.join(dir, 'stub.mjs');
    const log = path.join(dir, 'calls.txt');
    fs.writeFileSync(stub, IMPORT_STUB);
    fs.writeFileSync(log, '');
    const r = spawnSync(process.execPath, ['--max-old-space-size=512', '--input-type=module', '-e', `await import(${JSON.stringify(pathToFileURL(SCRIPT).href)})`, path.join(dir, 'nosuchfolder', 'org-health-watch.mjs')], {
      encoding: 'utf8', timeout: 60000, cwd: dir, env: { PATH: process.env.PATH, Path: process.env.Path, SystemRoot: process.env.SystemRoot, SYSTEMROOT: process.env.SYSTEMROOT, NODE_OPTIONS: `--import=${pathToFileURL(stub).href}`, STUB_LOG: log, GH_TOKEN: '' },
    });
    assert.strictEqual(fs.readFileSync(log, 'utf8'), '', 'the import ran the watcher: it asked the API');
    assert.ok(!fs.existsSync(path.join(dir, 'org-health-report.md')), 'the import wrote a report');
    assert.strictEqual(r.stdout + r.stderr, '', 'the import printed: ' + (r.stdout + r.stderr).slice(0, 120));
    assert.strictEqual(r.status, 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
