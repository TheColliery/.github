// UMB-216 (c): the dry-run/apply CLI, spawned against a fetch stub that records every call.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'gate-check-source.mjs');
const STUB = `
import fs from 'node:fs';
const S = JSON.parse(process.env.STUB_STATE);
globalThis.fetch = async (url, init = {}) => {
  const p = String(url).replace('https://api.github.com', '');
  const method = init.method || 'GET';
  fs.appendFileSync(process.env.STUB_LOG, JSON.stringify({ method, path: p, body: init.body ? JSON.parse(init.body) : null }) + '\\n');
  if (method === 'PUT') { S.put = JSON.parse(init.body); return new Response(JSON.stringify({ id: 18703484 }), { status: 200 }); }
  if (p === '/repos/TheColliery/CoalMine/rulesets/18703484' && S.put) return new Response(JSON.stringify({ ...S.gate, rules: S.put.rules }), { status: 200 });
  const hit = Object.entries(S.routes).filter(([k]) => p.startsWith(k)).sort((a, b) => b[0].length - a[0].length)[0];
  if (hit && hit[1] && hit[1].__status) return new Response('{}', { status: hit[1].__status });
  if (hit && hit[1] && hit[1].__pages) {
    const page = Number(new URL('https://x' + p).searchParams.get('page') || 1);
    return new Response(JSON.stringify(hit[1].__pages[page - 1] ?? []), { status: 200 });
  }
  return new Response(JSON.stringify(hit ? hit[1] : {}), { status: hit ? 200 : 404 });
};
`;
const GATE = {
  id: 18703484, name: 'dependabot-auto-merge-gate', enforcement: 'active', target: 'branch',
  conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
  bypass_actors: [{ actor_id: 5, actor_type: 'RepositoryRole', bypass_mode: 'always' }],
  rules: [{ type: 'required_status_checks', parameters: { strict_required_status_checks_policy: false, required_status_checks: [{ context: 'all-green', integration_id: null }] } }],
};
const ROUTES = {
  '/orgs/TheColliery/repos': [{ name: 'CoalMine' }],
  '/repos/TheColliery/CoalMine/rulesets/18703484': GATE,
  '/repos/TheColliery/CoalMine/rulesets': [{ id: 18703484 }, { id: 2 }],
  '/repos/TheColliery/CoalMine/rulesets/2': { id: 2, name: 'main-guard', enforcement: 'active', target: 'branch', conditions: GATE.conditions, bypass_actors: [], rules: [{ type: 'deletion' }] },
  '/repos/TheColliery/CoalMine': { default_branch: 'main' },
};

function run(args, env = {}, state = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gcs-'));
  const stub = path.join(dir, 'stub.mjs');
  const log = path.join(dir, 'calls.jsonl');
  fs.writeFileSync(stub, STUB);
  fs.writeFileSync(log, '');
  const e = { ...process.env, NODE_OPTIONS: `--import=${pathToFileURL(stub).href}`, STUB_LOG: log, STUB_STATE: JSON.stringify({ routes: state.routes ?? ROUTES, gate: state.gate ?? GATE }), GITHUB_READ_TOKEN: 'stub-read' };
  delete e.GITHUB_TOKEN;
  Object.assign(e, env);
  const res = spawnSync(process.execPath, ['--max-old-space-size=512', SCRIPT, ...args], { cwd: dir, encoding: 'utf8', env: e, timeout: 60000 });
  const calls = fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const bodies = fs.existsSync(path.join(dir, 'gate-check-source-bodies.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'gate-check-source-bodies.json'), 'utf8')) : null;
  fs.rmSync(dir, { recursive: true, force: true });
  return { res, calls, bodies };
}

test('dry run (the default): judges the gate, writes the exact PUT body, sends only GETs, exit 0', () => {
  const { res, calls, bodies } = run([]);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.match(res.stdout, /CoalMine: "dependabot-auto-merge-gate" \(id 18703484\) DRY-RUN -- would PUT \/repos\/TheColliery\/CoalMine\/rulesets\/18703484/);
  assert.match(res.stdout, /1 PUT body written .* \(dry run: nothing was sent\)/);
  assert.deepEqual(calls.filter((c) => c.method !== 'GET'), [], 'a dry run never writes');
  const b = bodies.bodies['CoalMine/18703484'];
  assert.equal(b.url, 'PUT /repos/TheColliery/CoalMine/rulesets/18703484');
  assert.deepEqual(b.body.rules[0].parameters.required_status_checks, [{ context: 'all-green', integration_id: 15368 }]);
  assert.deepEqual(b.body.bypass_actors, GATE.bypass_actors, 'the bypass list rides through untouched');
  assert.equal(bodies.canon.integration_id, 15368);
});

test('--apply without GITHUB_TOKEN, or without --repo, fails loud before any call and writes nothing', () => {
  const a = run(['--apply', '--repo', 'CoalMine']);
  assert.equal(a.res.status, 1);
  assert.match(a.res.stderr, /needs GITHUB_TOKEN/);
  assert.deepEqual(a.calls, []);
  const b = run(['--apply'], { GITHUB_TOKEN: 'stub-write' });
  assert.equal(b.res.status, 1);
  assert.match(b.res.stderr, /needs --repo/);
  assert.deepEqual(b.calls, []);
});

test('--apply --repo: PUTs the prepared body, reads the ruleset back and reports APPLIED only when the read-back names the source', () => {
  const { res, calls } = run(['--apply', '--repo', 'CoalMine'], { GITHUB_TOKEN: 'stub-write' });
  assert.equal(res.status, 0, res.stdout + res.stderr);
  const puts = calls.filter((c) => c.method === 'PUT');
  assert.equal(puts.length, 1);
  assert.equal(puts[0].path, '/repos/TheColliery/CoalMine/rulesets/18703484');
  assert.equal(puts[0].body.rules[0].parameters.required_status_checks[0].integration_id, 15368);
  assert.match(res.stdout, /CoalMine: "dependabot-auto-merge-gate" \(id 18703484\) APPLIED, read back/);
});

test('an unknown flag is an error with the usage line, exit 1', () => {
  const { res } = run(['--bogus']);
  assert.equal(res.status, 1);
  assert.match(res.stderr, /unknown flag --bogus/);
  assert.match(res.stderr, /usage:/);
});

// UMB-257 F (CodeQL js/http-to-file-access, alert #20): the PUT body is ruleset JSON read from the API and written to a
// file the owner reads. Every leaf is checked at the boundary: a string from a closed alphabet, a safe integer, a boolean
// or null. A body with anything else is REFUSED for that repository (fail closed: nothing is written for it, and the
// offending text is never echoed), never trimmed, because a PUT replaces the whole ruleset and a dropped field is a lost rule.
test('a ruleset whose body carries text outside the safe alphabet is refused for that repo: exit 1, named by its path, never echoed, no body written', () => {
  const hostile = { ...GATE, rules: [{ type: 'required_status_checks', parameters: { strict_required_status_checks_policy: false, required_status_checks: [{ context: 'all-green\n## injected`x`', integration_id: null }] } }] };
  const routes = { ...ROUTES, '/repos/TheColliery/CoalMine/rulesets/18703484': hostile };
  const { res, bodies } = run([], {}, { routes, gate: hostile });
  assert.equal(res.status, 1, res.stdout + res.stderr);
  assert.match(res.stdout, /CoalMine: FAIL ruleset 18703484 .* outside the safe alphabet at body\.rules\[0\]\.parameters\.required_status_checks\[0\]\.context/);
  assert.ok(!(res.stdout + res.stderr).includes('injected'), 'the offending text is never echoed');
  assert.deepEqual(Object.keys(bodies.bodies), [], 'nothing is written for the refused repo');
});

test('the live-shaped bodies pass the boundary check untouched (the safe alphabet covers refs, tildes, contexts with spaces and parentheses)', () => {
  const live = { ...GATE, conditions: { ref_name: { include: ['~DEFAULT_BRANCH', 'refs/heads/release/*'], exclude: [] } }, rules: [{ type: 'required_status_checks', parameters: { strict_required_status_checks_policy: false, required_status_checks: [{ context: 'Analyze (javascript-typescript)', integration_id: null }, { context: 'all-green', integration_id: null }] } }] };
  const routes = { ...ROUTES, '/repos/TheColliery/CoalMine/rulesets/18703484': live };
  const { res, bodies } = run([], {}, { routes, gate: live });
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.deepEqual(bodies.bodies['CoalMine/18703484'].body.conditions.ref_name.include, ['~DEFAULT_BRANCH', 'refs/heads/release/*']);
});

// ---- 14h, UMB3-006 (CodeRabbit on gate-check-source.mjs: pagination, a failed detail read, inherited rulesets) ----

test('the repository list and the ruleset list follow their pages: a gate on the SECOND page of rulesets, and a repo on the SECOND page of the org list, are judged (UMB3-006)', () => {
  const filler = Array.from({ length: 100 }, (_, i) => ({ id: 1000 + i }));
  const routes = { ...ROUTES, '/repos/TheColliery/CoalMine/rulesets/10': { id: 1000, name: 'filler', enforcement: 'disabled', target: 'branch', conditions: GATE.conditions, bypass_actors: [], rules: [] }, '/repos/TheColliery/CoalMine/rulesets': { __pages: [filler, [{ id: 18703484 }]] } };
  const a = run([], {}, { routes });
  assert.equal(a.res.status, 0, a.res.stdout + a.res.stderr);
  assert.match(a.res.stdout, /CoalMine: "dependabot-auto-merge-gate" \(id 18703484\) DRY-RUN/, 'the gate on page 2 of the rulesets was found');
  const orgs = { ...ROUTES, '/orgs/TheColliery/repos': { __pages: [Array.from({ length: 100 }, () => ({ name: 'CoalMine' })), [{ name: 'CoalMine' }]] } };
  const b = run([], {}, { routes: orgs });
  assert.equal(b.res.status, 0, b.res.stdout + b.res.stderr);
  assert.equal(b.res.stdout.split('\n').filter((l) => /DRY-RUN -- would PUT/.test(l)).length, 101, 'a hundred repos on page 1 and the one on page 2');
  assert.ok(b.calls.some((c) => /\/orgs\/TheColliery\/repos\?.*page=2/.test(c.path)), 'page 2 of the org list was requested');
});

test('a ruleset detail read that fails is a named FAIL for the repository (the ruleset id and the HTTP status), never a silent omission that reads as "no gate" (UMB3-006)', () => {
  const routes = { ...ROUTES, '/repos/TheColliery/CoalMine/rulesets/2': { __status: 500 } };
  const r = run([], {}, { routes });
  assert.equal(r.res.status, 1, r.res.stdout + r.res.stderr);
  assert.match(r.res.stdout, /CoalMine: FAIL GET \/repos\/TheColliery\/CoalMine\/rulesets\/2 -> HTTP 500/);
  assert.doesNotMatch(r.res.stdout, /DRY-RUN -- would PUT/, 'no body is prepared from a partial picture');
  assert.deepEqual(r.calls.filter((c) => c.method !== 'GET'), []);
  const list = run([], {}, { routes: { ...ROUTES, '/repos/TheColliery/CoalMine/rulesets': { __status: 503 } } });
  assert.equal(list.res.status, 1);
  assert.match(list.res.stdout, /CoalMine: FAIL GET \/repos\/TheColliery\/CoalMine\/rulesets -> HTTP 503/);
  const org = run([], {}, { routes: { ...ROUTES, '/orgs/TheColliery/repos': { __status: 502 } } });
  assert.equal(org.res.status, 1);
  assert.match(org.res.stderr, /could not list TheColliery's public repos \(HTTP 502\)/, 'the org list failure names its status, it is not read as an empty org');
});

test('the ruleset list asks for the repository\'s OWN rulesets (includes_parents=false), so an inherited organization ruleset never reaches the repository update endpoint (UMB3-006)', () => {
  const r = run([]);
  const lists = r.calls.filter((c) => /\/repos\/TheColliery\/CoalMine\/rulesets\?/.test(c.path));
  assert.ok(lists.length >= 1, 'the list was read');
  for (const c of lists) assert.match(c.path, /includes_parents=false/, c.path);
  const a = run(['--apply', '--repo', 'CoalMine'], { GITHUB_TOKEN: 'stub-write' });
  for (const c of a.calls.filter((x) => /\/rulesets\?/.test(x.path))) assert.match(c.path, /includes_parents=false/, c.path);
});
