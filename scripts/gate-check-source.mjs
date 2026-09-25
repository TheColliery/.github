#!/usr/bin/env node
// gate-check-source.mjs — UMB-216 (c), AR-75 (3) (the owner's "ทำ", 2026-09-25): every required status
// check on a `dependabot-auto-merge-gate` ruleset names its SOURCE, the GitHub Actions app
// (`integration_id` 15368), never "any source". As read on 2026-09-25 all nine gates carried
// `integration_id: null`, so any of the five apps installed on the org could post a passing
// `all-green` and satisfy the gate.
//
// DRY RUN by default: reads every public repo's rulesets, judges each gate, builds the exact PUT
// body (the ruleset as read, with only the integration_id added on each required check -- never a
// partial PUT), prints one line per repo and writes every body to --out (default
// gate-check-source-bodies.json). Nothing is written to GitHub.
//
// --apply --repo <name>: ONE repo per run, on the owner's word for that repo. Needs GITHUB_TOKEN
// (the write token, read by name, never printed). PUTs the prepared body, reads the ruleset back and
// judges it again; a read-back that still differs is a FAIL, never "sent".
//
// Usage: node scripts/gate-check-source.mjs [--org TheColliery] [--out <file>] [--apply --repo <name>]
// Zero-dependency (Phoenix #2); fail-loud CLI (scripts-quality.md §1).
import fs from 'node:fs';
import { GATE_CHECK_SOURCE, gateCheckSourceVerdicts, gateCheckSourceBody, rulesetCoversRules } from './lib/ruleset-match.mjs';

const API = 'https://api.github.com';

function parseArgs(argv) {
  const a = { org: 'TheColliery', out: 'gate-check-source-bodies.json', apply: false, repo: '' };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--apply') a.apply = true;
    else if (k === '--org') a.org = argv[++i];
    else if (k === '--out') a.out = argv[++i];
    else if (k === '--repo') a.repo = argv[++i];
    else if (k === '-h' || k === '--help') { a.help = true; }
    else throw new Error(`unknown flag ${k}`);
  }
  return a;
}

function usage() {
  return 'usage: node scripts/gate-check-source.mjs [--org TheColliery] [--out gate-check-source-bodies.json] [--apply --repo <name>]\n' +
    'Dry run by default: judges every gate ruleset and writes the PUT bodies. --apply writes ONE repo, needs GITHUB_TOKEN.\n' +
    'Report a problem: https://github.com/TheColliery/.github/issues';
}

async function req(token, method, p, body) {
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const r = await fetch(API + p, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
  let json = null;
  try { json = await r.json(); } catch {}
  return { status: r.status, ok: r.ok, json };
}

async function gatesOf(token, org, repo) {
  const info = await req(token, 'GET', `/repos/${org}/${repo}`);
  if (!info.ok) throw new Error(`GET /repos/${org}/${repo} -> HTTP ${info.status}`);
  const defaultBranch = info.json.default_branch;
  const list = await req(token, 'GET', `/repos/${org}/${repo}/rulesets`);
  if (!list.ok || !Array.isArray(list.json)) throw new Error(`GET /repos/${org}/${repo}/rulesets -> HTTP ${list.status}`);
  const details = [];
  for (const c of list.json) {
    const d = await req(token, 'GET', `/repos/${org}/${repo}/rulesets/${c.id}`);
    if (d.ok) details.push(d.json);
  }
  return { defaultBranch, details, gates: details.filter((rs) => rulesetCoversRules(rs, ['required_status_checks'], defaultBranch)) };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(usage()); return; }
  const readToken = process.env.GITHUB_READ_TOKEN || process.env.GITHUB_TOKEN || '';
  if (args.apply) {
    if (!args.repo) throw new Error('--apply needs --repo <name>: one repo per run, on the owner\'s word for that repo');
    if (!process.env.GITHUB_TOKEN) throw new Error('--apply needs GITHUB_TOKEN (the write token) in the environment; nothing was written');
  }
  const repos = args.repo ? [args.repo] : ((await req(readToken, 'GET', `/orgs/${args.org}/repos?per_page=100&type=public`)).json ?? []).map((r) => r.name).sort();
  if (repos.length === 0) throw new Error(`could not list ${args.org}'s public repos`);
  const bodies = {};
  let fails = 0;
  for (const repo of repos) {
    let g;
    try { g = await gatesOf(readToken, args.org, repo); } catch (e) { console.log(`${repo}: FAIL ${e.message}`); fails++; continue; }
    if (g.gates.length === 0) { console.log(`${repo}: no gate ruleset on ${g.defaultBranch} (nothing to source)`); continue; }
    for (const gate of g.gates) {
      const [verdict] = gateCheckSourceVerdicts([gate], g.defaultBranch);
      if (verdict.ok) { console.log(`${repo}: "${gate.name}" (id ${gate.id}) IN-SYNC -- every required check names ${GATE_CHECK_SOURCE.app}`); continue; }
      const body = gateCheckSourceBody(gate);
      bodies[`${repo}/${gate.id}`] = { repo, rulesetId: gate.id, url: `PUT /repos/${args.org}/${repo}/rulesets/${gate.id}`, body };
      if (!args.apply) { console.log(`${repo}: "${gate.name}" (id ${gate.id}) DRY-RUN -- would PUT /repos/${args.org}/${repo}/rulesets/${gate.id}: ${verdict.text}`); continue; }
      const w = await req(process.env.GITHUB_TOKEN, 'PUT', `/repos/${args.org}/${repo}/rulesets/${gate.id}`, body);
      if (!w.ok) { console.log(`${repo}: FAIL PUT /repos/${args.org}/${repo}/rulesets/${gate.id} -> HTTP ${w.status} ${w.json?.message || ''}`); fails++; continue; }
      const rb = await req(process.env.GITHUB_TOKEN, 'GET', `/repos/${args.org}/${repo}/rulesets/${gate.id}`);
      const [after] = rb.ok ? gateCheckSourceVerdicts([rb.json], g.defaultBranch) : [{ ok: false, text: `read-back HTTP ${rb.status}` }];
      if (!after.ok) { console.log(`${repo}: FAIL "${gate.name}" PUT answered ${w.status} but the read-back still differs: ${after.text}`); fails++; continue; }
      console.log(`${repo}: "${gate.name}" (id ${gate.id}) APPLIED, read back: ${after.text}`);
    }
  }
  fs.writeFileSync(args.out, JSON.stringify({ canon: GATE_CHECK_SOURCE, preparedAt: new Date().toISOString(), bodies }, null, 2));
  console.log(`${Object.keys(bodies).length} PUT bod${Object.keys(bodies).length === 1 ? 'y' : 'ies'} written to ${args.out}${args.apply ? '' : ' (dry run: nothing was sent)'}`);
  if (fails) { console.error(`FAIL: ${fails} repo(s) above`); process.exitCode = 1; }
}

main().catch((e) => { console.error(`gate-check-source: ${e.message}`); console.error(usage()); process.exitCode = 1; });
