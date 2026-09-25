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

function run(args, env = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gcs-'));
  const stub = path.join(dir, 'stub.mjs');
  const log = path.join(dir, 'calls.jsonl');
  fs.writeFileSync(stub, STUB);
  fs.writeFileSync(log, '');
  const e = { ...process.env, NODE_OPTIONS: `--import=${pathToFileURL(stub).href}`, STUB_LOG: log, STUB_STATE: JSON.stringify({ routes: ROUTES, gate: GATE }), GITHUB_READ_TOKEN: 'stub-read' };
  delete e.GITHUB_TOKEN;
  Object.assign(e, env);
  const res = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: dir, encoding: 'utf8', env: e, timeout: 60000 });
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
