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
//      commit status (context `GitBook (<dir>)`) on the commits it imports. A repo that carries
//      `.gitbook.yaml` or `gitbook-docs.yaml` whose default-branch head is older than a day and
//      carries no GitBook status, or a failing one, is reported. GitBook's own failure detail lives
//      only on its side (`getSpaceGitInfo` → `operation.state`), which this watcher cannot read.
// It REPORTS; it never re-enables, re-runs or fixes anything. The workflow around it opens ONE issue.
// Exit 0 always (report-only; a red would hide the next week's run behind the fix obligation);
// findings go to stdout as ::warning annotations, to org-health-report.md, and to GITHUB_OUTPUT as
// has_findings=true|false. Zero-dependency (Phoenix #2); anonymous reads suffice for public repos,
// GH_TOKEN raises the rate limit when set.
import fs from 'node:fs';

export const DAY_MS = 24 * 60 * 60 * 1000;
const ORG = process.env.ORG_HEALTH_ORG || 'TheColliery';
const API = 'https://api.github.com';

/** Workflows in `disabled_inactivity`. `disabled_manually` is a decision someone made, not a finding. */
export function disabledWorkflows(workflowsByRepo) {
  const out = [];
  for (const [repo, list] of Object.entries(workflowsByRepo)) {
    for (const w of list || []) {
      if (w.state !== 'disabled_inactivity') continue;
      const workflow = String(w.path || '').replace('.github/workflows/', '');
      out.push({ repo, kind: 'disabled', workflow, text: `${workflow} is disabled_inactivity (GitHub disabled its schedule after 60 days without repository activity; it looks like a quiet week until someone re-enables it)`, url: w.html_url || '' });
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
      out.push({ repo, kind: 'queued', text: `${r.name} run queued for ${Math.floor(age / DAY_MS)} day(s) (since ${r.created_at}); a run that never starts blocks nothing and reports nothing`, url: r.html_url || '' });
    }
  }
  return out;
}

/** GitBook sync signal per synced repo: { headAge (ms), statuses: [{context, state}] }. */
export function gitbookSignal(signalByRepo, now = Date.now(), maxAgeMs = DAY_MS) {
  const out = [];
  for (const [repo, s] of Object.entries(signalByRepo)) {
    const gb = (s.statuses || []).filter((x) => /^GitBook\b/.test(String(x.context || '')));
    const bad = gb.filter((x) => x.state !== 'success');
    if (bad.length) {
      out.push({ repo, kind: 'gitbook', text: `GitBook status ${bad.map((x) => `"${x.context}" = ${x.state}`).join(', ')} on the default-branch head`, url: '' });
      continue;
    }
    if (gb.length === 0 && s.headAge > maxAgeMs) {
      out.push({ repo, kind: 'gitbook', text: `no GitBook status on the default-branch head, ${Math.floor(s.headAge / DAY_MS)} day(s) old, on a repo that carries a GitBook sync file (a stall, or a sync that was never wired)`, url: '' });
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
  return { repo, kind: 'unreadable', text: `could not read ${what} (HTTP ${status}); this run did NOT check it`, url: '' };
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
    if (![200, 404].includes(gb1.status) || ![200, 404].includes(gb2.status)) findings.push(unreadable(r.name, 'the GitBook sync file', gb1.status === 200 ? gb2.status : gb1.status));
    if (gb1.status !== 200 && gb2.status !== 200) continue;
    const branch = r.default_branch || 'main';
    const head = await get(`${base}/commits/${branch}`);
    const status = await get(`${base}/commits/${branch}/status`);
    if (head.status !== 200 || status.status !== 200) { findings.push(unreadable(r.name, 'the default-branch head and its statuses', head.status !== 200 ? head.status : status.status)); continue; }
    const headDate = head.json?.commit?.committer?.date ? Date.parse(head.json.commit.committer.date) : Date.now();
    signalByRepo[r.name] = { headAge: Date.now() - headDate, statuses: status.json?.statuses ?? [] };
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
