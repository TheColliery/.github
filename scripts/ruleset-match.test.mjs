import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rulesetCoversRules, anyRulesetCovers, GATE_RULESET_BYPASS, bypassActorsDiffer, gateBypassVerdicts } from './lib/ruleset-match.mjs';

const WANTED = ['deletion', 'non_fast_forward'];

// Shape lifted from the real GitHub single-ruleset GET response
// (GET /repos/{owner}/{repo}/rulesets/{id}) -- the fields rulesetCoversRules reads.
function ruleset(overrides = {}) {
  return {
    name: 'verify-required',
    enforcement: 'active',
    target: 'branch',
    conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
    rules: [{ type: 'deletion' }, { type: 'non_fast_forward' }],
    ...overrides,
  };
}

test('rulesetCoversRules: a differently-NAMED ruleset with the same rules still covers -- the whole point of CWK-069 (RED against the pre-fix name-only comparison)', () => {
  assert.equal(rulesetCoversRules(ruleset({ name: 'ci-required' }), WANTED), true);
});

test('rulesetCoversRules: a ruleset carrying EXTRA rule types beyond the wanted set still covers (superset, not exact match)', () => {
  assert.equal(
    rulesetCoversRules(ruleset({ rules: [{ type: 'deletion' }, { type: 'non_fast_forward' }, { type: 'required_status_checks', parameters: {} }] }), WANTED),
    true,
  );
});

test('rulesetCoversRules: missing one wanted type does not cover', () => {
  assert.equal(rulesetCoversRules(ruleset({ rules: [{ type: 'deletion' }] }), WANTED), false);
});

test('rulesetCoversRules: enforcement "disabled" (or "evaluate") does not cover -- an inactive ruleset enforces nothing', () => {
  assert.equal(rulesetCoversRules(ruleset({ enforcement: 'disabled' }), WANTED), false);
  assert.equal(rulesetCoversRules(ruleset({ enforcement: 'evaluate' }), WANTED), false);
});

test('rulesetCoversRules: target "tag" (not "branch") does not cover', () => {
  assert.equal(rulesetCoversRules(ruleset({ target: 'tag' }), WANTED), false);
});

test('rulesetCoversRules: a ruleset scoped to a feature branch pattern, not the default branch, does not cover', () => {
  assert.equal(
    rulesetCoversRules(ruleset({ conditions: { ref_name: { include: ['refs/heads/release/*'], exclude: [] } } }), WANTED),
    false,
  );
});

test('rulesetCoversRules: "~ALL" also counts as covering the default branch', () => {
  assert.equal(
    rulesetCoversRules(ruleset({ conditions: { ref_name: { include: ['~ALL'], exclude: [] } } }), WANTED),
    true,
  );
});

test('rulesetCoversRules: null/undefined ruleset -> false, never throws', () => {
  assert.equal(rulesetCoversRules(null, WANTED), false);
  assert.equal(rulesetCoversRules(undefined, WANTED), false);
});

test('anyRulesetCovers: one covering ruleset among several non-covering ones is enough', () => {
  const list = [
    ruleset({ name: 'unrelated', target: 'tag' }),
    ruleset({ name: 'ci-required', rules: [{ type: 'deletion' }] }),
    ruleset({ name: 'the-real-one' }),
  ];
  assert.equal(anyRulesetCovers(list, WANTED), true);
});

test('anyRulesetCovers: an empty list never covers', () => {
  assert.equal(anyRulesetCovers([], WANTED), false);
});

// --- UMB-131: the gate ruleset's bypass list ---------------------------------------------
// CoalMine's `dependabot-auto-merge-gate` lost its bypass actor in the 2026-09-17 org
// transfer (`bypass_actors: []`) and `--settings` never noticed: it compared only whether
// SOME ruleset covers deletion+non_fast_forward. The canon (SWEEP-MARKS.md, the gate row)
// states the value: RepositoryRole Admin (actor_id 5), bypass_mode always.

const ADMIN_ALWAYS = { actor_id: 5, actor_type: 'RepositoryRole', bypass_mode: 'always' };

function gate(overrides = {}) {
  return {
    name: 'dependabot-auto-merge-gate',
    enforcement: 'active',
    target: 'branch',
    conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
    rules: [{ type: 'required_status_checks', parameters: { required_status_checks: [{ context: 'all-green' }] } }],
    bypass_actors: [ADMIN_ALWAYS],
    ...overrides,
  };
}

test('GATE_RULESET_BYPASS is exactly the canon value: RepositoryRole 5, always', () => {
  assert.deepEqual(GATE_RULESET_BYPASS, [ADMIN_ALWAYS]);
});

test('bypassActorsDiffer: the canon list matches -> null (order and key order do not matter)', () => {
  assert.equal(bypassActorsDiffer([ADMIN_ALWAYS]), null);
  assert.equal(bypassActorsDiffer([{ bypass_mode: 'always', actor_type: 'RepositoryRole', actor_id: 5 }]), null);
});

test('bypassActorsDiffer: an EMPTY list -- the real CoalMine shape after the transfer -- differs, RED against a check that never looked', () => {
  const d = bypassActorsDiffer([]);
  assert.ok(d);
  assert.deepEqual(d.live, []);
  assert.deepEqual(d.want, [ADMIN_ALWAYS]);
});

test('bypassActorsDiffer: a missing/null list reads as empty, never throws', () => {
  assert.ok(bypassActorsDiffer(undefined));
  assert.ok(bypassActorsDiffer(null));
});

test('bypassActorsDiffer: a different mode, a different actor id, or an EXTRA actor all differ (exact set, not "contains")', () => {
  assert.ok(bypassActorsDiffer([{ ...ADMIN_ALWAYS, bypass_mode: 'pull_request' }]));
  assert.ok(bypassActorsDiffer([{ ...ADMIN_ALWAYS, actor_id: 4 }]));
  assert.ok(bypassActorsDiffer([ADMIN_ALWAYS, { actor_id: 1, actor_type: 'OrganizationAdmin', bypass_mode: 'always' }]));
});

test('gateBypassVerdicts: a gate ruleset with the canon bypass -> one ok verdict', () => {
  const v = gateBypassVerdicts([gate()]);
  assert.equal(v.length, 1);
  assert.equal(v[0].ok, true);
  assert.match(v[0].text, /"dependabot-auto-merge-gate" bypass_actors: identical/);
});

test('gateBypassVerdicts: the real CoalMine shape (gate with bypass_actors []) -> DIFFERS naming the ruleset, want and live', () => {
  const v = gateBypassVerdicts([gate({ bypass_actors: [] })]);
  assert.equal(v.length, 1);
  assert.equal(v[0].ok, false);
  assert.match(v[0].text, /"dependabot-auto-merge-gate" bypass_actors: DIFFERS/);
  assert.match(v[0].text, /want \[.*"actor_id":5.*\], live \[\]/);
});

test('gateBypassVerdicts: no active required-status-checks ruleset on the default branch -> one DIFFERS verdict (a disabled, tag-targeted or feature-branch gate does not count)', () => {
  for (const list of [[], [gate({ enforcement: 'disabled' })], [gate({ target: 'tag' })], [gate({ conditions: { ref_name: { include: ['refs/heads/release/*'], exclude: [] } } })]]) {
    const v = gateBypassVerdicts(list);
    assert.equal(v.length, 1);
    assert.equal(v[0].ok, false);
    assert.match(v[0].text, /no active required_status_checks ruleset/);
  }
});

test('gateBypassVerdicts: a ruleset without a required_status_checks rule (e.g. main-guard) is not a gate and is not judged on bypass', () => {
  const mainGuard = gate({ name: 'main-guard', rules: [{ type: 'deletion' }, { type: 'non_fast_forward' }], bypass_actors: [] });
  const v = gateBypassVerdicts([mainGuard, gate()]);
  assert.equal(v.length, 1);
  assert.equal(v[0].ok, true);
});

test('gateBypassVerdicts: two gates are each judged', () => {
  const v = gateBypassVerdicts([gate(), gate({ name: 'second-gate', bypass_actors: [] })]);
  assert.deepEqual(v.map((x) => x.ok), [true, false]);
});

// UMB-112 row 21: `ref_name.exclude` was never read, so a `~ALL` ruleset that EXCLUDES the default branch
// counted as covering it.
const exclusion = (exclude) => ruleset({ conditions: { ref_name: { include: ['~ALL'], exclude } } });

test('rulesetCoversRules: ~ALL that EXCLUDES the default branch does NOT cover it -- by name, by ~DEFAULT_BRANCH, by glob (UMB-112 row 21)', () => {
  assert.equal(rulesetCoversRules(exclusion(['refs/heads/main']), WANTED, 'main'), false);
  assert.equal(rulesetCoversRules(exclusion(['~DEFAULT_BRANCH']), WANTED), false, 'needs no branch name');
  assert.equal(rulesetCoversRules(exclusion(['refs/heads/ma*']), WANTED, 'main'), false);
});

test('rulesetCoversRules: ~ALL excluding some OTHER branch still covers the default branch (UMB-112 row 21 control)', () => {
  assert.equal(rulesetCoversRules(exclusion(['refs/heads/release/*']), WANTED, 'main'), true);
  assert.equal(rulesetCoversRules(exclusion(['refs/heads/dev']), WANTED, 'main'), true);
  assert.equal(rulesetCoversRules(exclusion([]), WANTED, 'main'), true);
});

test('rulesetCoversRules: the default-branch name is optional -- omitted, a ~DEFAULT_BRANCH include with an empty exclude still covers (existing callers unchanged)', () => {
  assert.equal(rulesetCoversRules(ruleset(), WANTED), true);
});

test('anyRulesetCovers / gateBypassVerdicts pass the default branch through: a gate that excludes it is not the gate (UMB-112 row 21)', () => {
  const gate = { ...exclusion(['refs/heads/main']), rules: [{ type: 'required_status_checks' }], bypass_actors: [] };
  assert.equal(anyRulesetCovers([exclusion(['refs/heads/main'])], WANTED, 'main'), false);
  const v = gateBypassVerdicts([gate], undefined, 'main');
  assert.equal(v.length, 1);
  assert.match(v[0].text, /no active required_status_checks ruleset/);
});
