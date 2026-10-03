#!/usr/bin/env node
// org-health-watch.mjs — UMB-216 (a): a READ-ONLY watcher over the org's public repos for three
// silent failure classes nothing else reports:
//   1. a workflow in state `disabled_inactivity` — GitHub disables a public repo's scheduled
//      workflows after 60 days without repository activity (docs.github.com, "Disabling and enabling
//      a workflow"); the E1 SkillSpector watcher, every room's scorecard.yml / codeql.yml cron and the
//      article template's watch-sources.yml are the exposed engines, and a disabled schedule looks
//      exactly like a quiet one;
//   2. a run left `queued` for more than a day — measured live 2026-09-25: CoalLedger carried a CodeQL
//      and a Scorecard run queued since 2026-08-06;
//   3. a GitBook Git Sync stall, read from the ONE GitHub-side signal that exists: GitBook posts a
//      commit status (context `GitBook (<dir>)`) on the commits it imports, and it imports only when a
//      push touches the space's content (measured at GitBook's own record, 2026-10-03). So a head with
//      no status is the NORMAL state after a code-only push and is never reported. Reported are: a
//      failing or erroring status; a status still `pending` past GitBook's operation timeout; and a head
//      whose push touched a file the space syncs (per `.gitbook.yaml`: the readme, the summary and the
//      pages the summary lists; per `gitbook-docs.yaml`: everything under a mapped directory) with no
//      status past that timeout. GitBook's own failure detail lives only on its side
//      (`getSpaceGitInfo` → `operation.state`), which this watcher cannot read and needs no credential for.
// It REPORTS; it never re-enables, re-runs or fixes anything. The workflow around it opens ONE issue.
// Exit 0 always (report-only; a red would hide the next week's run behind the fix obligation);
// findings go to stdout as ::warning annotations, to org-health-report.md, and to GITHUB_OUTPUT as
// has_findings=true|false. Zero-dependency (Phoenix #2); anonymous reads suffice for public repos,
// GH_TOKEN raises the rate limit when set.
import fs from 'node:fs';

export const DAY_MS = 24 * 60 * 60 * 1000;
// GitBook's `operationTimeout` on every space of this org (getSpaceGitInfo, read 2026-10-03): the longest a sync operation may run.
export const GITBOOK_OPERATION_TIMEOUT_MS = 1200000;

// UMB-257 F (CodeQL js/http-to-file-access, alert #21; the shape that closed alert #2, commit 4d9e434): text from the API
// is parsed ONCE at the boundary into a name from a closed alphabet, a github.com address, or an ISO date, and anything
// else becomes a fixed fallback, never an echo of the offending text. The report file, and the issue body built from it,
// therefore carry no markup, newline, link or control character an API field could have supplied.
const SAFE_NAME = /^[A-Za-z0-9._:/() #+-]{1,120}$/;
const SAFE_URL = /^https:\/\/github\.com\/[A-Za-z0-9._/-]{1,200}$/;
const SAFE_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
export function safeName(v) { return typeof v === 'string' && SAFE_NAME.test(v) ? v : '(name outside the safe alphabet)'; }
export function safeUrl(v) { return typeof v === 'string' && SAFE_URL.test(v) ? v : ''; }
export function safeDate(v) { return typeof v === 'string' && SAFE_DATE.test(v) ? v : '(unreadable date)'; }
const ORG = process.env.ORG_HEALTH_ORG || 'TheColliery';
const API = 'https://api.github.com';

/** Workflows in `disabled_inactivity`. `disabled_manually` is a decision someone made, not a finding. */
export function disabledWorkflows(workflowsByRepo) {
  const out = [];
  for (const [repo, list] of Object.entries(workflowsByRepo)) {
    for (const w of list || []) {
      if (w.state !== 'disabled_inactivity') continue;
      const workflow = safeName(String(w.path || '').replace('.github/workflows/', ''));
      out.push({ repo: safeName(repo), kind: 'disabled', workflow, text: `${workflow} is disabled_inactivity (GitHub disabled its schedule after 60 days without repository activity; it looks like a quiet week until someone re-enables it)`, url: safeUrl(w.html_url) });
    }
  }
  return out;
}

/** Runs still `queued` after more than a day. */
export function staleQueuedRuns(runsByRepo, now = Date.now(), maxAgeMs = DAY_MS) {
  const out = [];
  for (const [repo, list] of Object.entries(runsByRepo)) {
    for (const r of list || []) {
      if (r.status !== 'queued') continue;
      const age = now - Date.parse(r.created_at);
      if (!(age > maxAgeMs)) continue;
      out.push({ repo: safeName(repo), kind: 'queued', text: `${safeName(r.name)} run queued for ${Math.floor(age / DAY_MS)} day(s) (since ${safeDate(r.created_at)}); a run that never starts blocks nothing and reports nothing`, url: safeUrl(r.html_url) });
    }
  }
  return out;
}

const SAFE_PATH = /^[A-Za-z0-9._ -]+(\/[A-Za-z0-9._ -]+)*$/;
const cleanPath = (p) => {
  const q = String(p).replace(/\\/g, '/').replace(/^['"]|['"]$/g, '').replace(/^(\.\/)+/, '').replace(/^\/+/, '').replace(/\/+$/, '');
  return q && !q.split('/').includes('..') && SAFE_PATH.test(q) ? q : null;
};
const joinPath = (...parts) => parts.map((x) => String(x).replace(/^\.\/?$/, '')).filter(Boolean).join('/').replace(/\/+/g, '/');
const yamlScalar = (text, key) => (new RegExp('^[ \\t-]*' + key + ':[ \\t]*(\\S[^\\r\\n#]*?)[ \\t]*(?:#.*)?$', 'm').exec(text) || [])[1];

/** The files a GitBook space syncs, from a repo's `.gitbook.yaml` (root + readme + summary + the pages the summary lists) or its
 *  `gitbook-docs.yaml` (every `directory:` mapping, as a prefix). Returns { exact: string[], prefixes: string[] }, or null when
 *  the config cannot be read, so an unreadable config stays UNKNOWN and is never read as "syncs nothing". */
export function gitbookSyncedFiles(configText, summaryText = '') {
  const text = String(configText || '');
  const exact = new Set(); const prefixes = [];
  const dirs = [...text.matchAll(/^[ \t-]*directory:[ \t]*(\S[^\r\n#]*?)[ \t]*(?:#.*)?$/gm)].map((m) => cleanPath(m[1])).filter(Boolean);
  for (const d of dirs) prefixes.push(d + '/');
  const readme = yamlScalar(text, 'readme'); const summary = yamlScalar(text, 'summary');
  if (readme || summary) {
    const root = cleanPath(yamlScalar(text, 'root') || '.') ?? '';
    const r = readme && cleanPath(readme); const s = summary && cleanPath(summary);
    if (r) exact.add(joinPath(root, r));
    if (s) {
      const summaryPath = joinPath(root, s);
      exact.add(summaryPath);
      const base = summaryPath.includes('/') ? summaryPath.slice(0, summaryPath.lastIndexOf('/')) : '';
      for (const m of String(summaryText || '').matchAll(/\]\(([^)\s#]+)(?:#[^)]*)?\)/g)) {
        if (/^[a-z][a-z0-9+.-]*:/i.test(m[1])) continue; // a URL, not a page
        const p = cleanPath(joinPath(base, m[1]));
        if (p) exact.add(p);
      }
    }
  }
  if (!exact.size && !prefixes.length) return null;
  return { exact: [...exact], prefixes };
}

/** Did a commit's changed files include one the space syncs? true / false, or null when it cannot be known (no config, no file
 *  list). GitHub lists at most 300 files per commit, so a list that long may be truncated and is read as "touched". */
export function touchesSynced(files, synced) {
  if (!synced || !Array.isArray(files)) return null;
  if (files.length >= 300) return true;
  const exact = new Set(synced.exact);
  return files.some((f) => { const p = cleanPath(f); return p !== null && (exact.has(p) || synced.prefixes.some((x) => p.startsWith(x))); });
}

/** GitBook sync signal per synced repo: { headAge (ms), touches (true | false | null), statuses: [{context, state, updated_at}] }.
 *  Never reported: a head whose push touched nothing the space syncs (GitBook imports nothing, so no status is the normal state). */
export function gitbookSignal(signalByRepo, now = Date.now(), timeoutMs = GITBOOK_OPERATION_TIMEOUT_MS) {
  const out = [];
  for (const [repo, s] of Object.entries(signalByRepo)) {
    const gb = (s.statuses || []).filter((x) => /^GitBook\b/.test(String(x.context || '')));
    const bad = gb.filter((x) => x.state === 'failure' || x.state === 'error');
    if (bad.length) {
      out.push({ repo: safeName(repo), kind: 'gitbook', text: `GitBook status ${bad.map((x) => `"${safeName(x.context)}" = ${safeName(x.state)}`).join(', ')} on the default-branch head`, url: '' });
      continue;
    }
    const stuck = gb.filter((x) => x.state === 'pending').map((x) => ({ x, at: Date.parse(x.updated_at || x.created_at) })).filter(({ at }) => !(now - at <= timeoutMs));
    if (stuck.length) {
      const since = stuck.map(({ x }) => safeDate(x.updated_at || x.created_at)).sort()[0];
      out.push({ repo: safeName(repo), kind: 'gitbook', text: `GitBook status still pending since ${since}, past GitBook's ${Math.round(timeoutMs / 60000)}-minute operation timeout (the final status never arrived; the import itself may have succeeded)`, url: '' });
      continue;
    }
    if (gb.length === 0 && s.touches === true && s.headAge > timeoutMs) {
      out.push({ repo: safeName(repo), kind: 'gitbook', text: `the default-branch head, ${Math.floor(s.headAge / 60000)} minute(s) old, touched a file the GitBook space syncs and carries no GitBook status (a stalled import, or a sync that was never wired)`, url: '' });
    }
  }
  return out;
}

export function buildReport(findings, counts) {
  const head = `org-health-watch checked ${counts.repos} public repo${counts.repos === 1 ? '' : 's'}: ${counts.workflows} workflows, queued runs, ${counts.synced} GitBook-synced repo${counts.synced === 1 ? '' : 's'}.`;
  if (findings.length === 0) return `${head}\n\nNo finding. (A clean line is stated, never left blank: silence would read the same as a run that never looked.)\n`;
  const rows = findings.map((f) => `- [${f.repo}] ${f.text}${f.url ? ` — ${f.url}` : ''}`);
  return `${head}\n\n${findings.length} finding${findings.length === 1 ? '' : 's'} (report only; nothing was re-enabled, re-run or changed):\n\n${rows.join('\n')}\n`;
}

async function get(p) {
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;
  const r = await fetch(API + p, { headers, signal: AbortSignal.timeout(30000) });
  let json = null;
  try { json = await r.json(); } catch {}
  return { status: r.status, json };
}

/** A read that did not answer 200 is a FINDING, never an empty list: an anonymous rate limit (403) on
 *  the runs endpoint would otherwise read as "nothing queued" (measured 2026-09-25, first live run). */
export function unreadable(repo, what, status) {
  return { repo: safeName(repo), kind: 'unreadable', text: `could not read ${what} (HTTP ${status}); this run did NOT check it`, url: '' };
}

async function main() {
  const repos = (await get(`/orgs/${ORG}/repos?per_page=100&type=public`)).json;
  if (!Array.isArray(repos)) throw new Error(`could not list ${ORG}'s public repos`);
  const workflowsByRepo = {};
  const runsByRepo = {};
  const signalByRepo = {};
  const findings = [];
  let workflowCount = 0;
  for (const r of repos) {
    const base = `/repos/${ORG}/${r.name}`;
    const wf = await get(`${base}/actions/workflows?per_page=100`);
    if (wf.status !== 200) findings.push(unreadable(r.name, 'the workflow list', wf.status));
    workflowsByRepo[r.name] = wf.json?.workflows ?? [];
    workflowCount += workflowsByRepo[r.name].length;
    const runs = await get(`${base}/actions/runs?status=queued&per_page=100`);
    if (runs.status !== 200) findings.push(unreadable(r.name, 'the queued runs', runs.status));
    runsByRepo[r.name] = runs.json?.workflow_runs ?? [];
    const gb1 = await get(`${base}/contents/.gitbook.yaml`);
    const gb2 = gb1.status === 200 ? { status: 404 } : await get(`${base}/contents/gitbook-docs.yaml`);
    const decode = (j) => (j && j.encoding === 'base64' && typeof j.content === 'string' ? Buffer.from(j.content, 'base64').toString('utf8') : '');
    if (![200, 404].includes(gb1.status) || ![200, 404].includes(gb2.status)) findings.push(unreadable(r.name, 'the GitBook sync file', gb1.status === 200 ? gb2.status : gb1.status));
    if (gb1.status !== 200 && gb2.status !== 200) continue;
    const branch = r.default_branch || 'main';
    const head = await get(`${base}/commits/${branch}`);
    const status = await get(`${base}/commits/${branch}/status`);
    if (head.status !== 200 || status.status !== 200) { findings.push(unreadable(r.name, 'the default-branch head and its statuses', head.status !== 200 ? head.status : status.status)); continue; }
    const headDate = head.json?.commit?.committer?.date ? Date.parse(head.json.commit.committer.date) : Date.now();
    // which files the space syncs: the config, plus the pages the summary lists (one more read, only for a .gitbook.yaml repo)
    const cfgText = decode(gb1.status === 200 ? gb1.json : gb2.json);
    let summaryText = '';
    const summaryPath = gb1.status === 200 ? yamlScalar(cfgText, 'summary') : '';
    const sp = summaryPath && cleanPath(summaryPath) ? joinPath(cleanPath(yamlScalar(cfgText, 'root') || '.') ?? '', cleanPath(summaryPath)) : '';
    if (sp) { const sm = await get(`${base}/contents/${sp}`); if (sm.status === 200) summaryText = decode(sm.json); else findings.push(unreadable(r.name, 'the GitBook summary file', sm.status)); }
    const touches = touchesSynced(Array.isArray(head.json?.files) ? head.json.files.map((x) => x && x.filename) : undefined, gitbookSyncedFiles(cfgText, summaryText));
    signalByRepo[r.name] = { headAge: Date.now() - headDate, touches, statuses: status.json?.statuses ?? [] };
  }
  findings.push(...disabledWorkflows(workflowsByRepo), ...staleQueuedRuns(runsByRepo), ...gitbookSignal(signalByRepo));
  const report = buildReport(findings, { repos: repos.length, workflows: workflowCount, synced: Object.keys(signalByRepo).length });
  fs.writeFileSync('org-health-report.md', report);
  process.stdout.write(report);
  for (const f of findings) console.log(`::warning title=org-health-watch ${f.repo}::${f.text}`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `has_findings=${findings.length > 0 ? 'true' : 'false'}\n`);
}

if (process.argv[1] && /org-health-watch\.mjs$/.test(process.argv[1].replace(/\\/g, '/'))) {
  main().catch((e) => { console.error(`org-health-watch: ${e.message}`); process.exitCode = 1; });
}
