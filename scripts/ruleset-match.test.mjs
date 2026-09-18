import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rulesetCoversRules, anyRulesetCovers } from './lib/ruleset-match.mjs';

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
