// ruleset-match.mjs — CWK-069 (the CoalWorks chief's own instrument ruling, r30, ported
// here per UMB-072): a GitHub ruleset is matched by its RULES, never by its NAME. A room
// commonly already carries an active branch ruleset enforcing deletion + force-push
// protection under a name of its own choosing (e.g. its own CWK-058 `verify`-required
// ruleset) — comparing by name reports that room as "missing main-guard" when it is
// already fully covered, and a name-blind write path would then try to CREATE a second,
// redundant ruleset alongside a functionally-identical one.
//
// Pure decision logic only — no network here. A caller fetches the LIST endpoint
// (`GET /repos/{owner}/{repo}/rulesets`, summary objects with no `rules` array) and then
// the DETAIL endpoint per active branch-targeting candidate
// (`GET /repos/{owner}/{repo}/rulesets/{id}`, which does carry `rules`), and hands the
// resolved detail objects here.

/**
 * True when `ruleset` (a full ruleset detail object, from the single-ruleset GET) is
 * ACTIVE, targets the BRANCH type, applies to the repo's default branch, and its own
 * `rules` array covers every type named in `wantedTypes`.
 */
export function rulesetCoversRules(ruleset, wantedTypes) {
  if (!ruleset || ruleset.enforcement !== 'active') return false;
  if (ruleset.target !== 'branch') return false;
  const refInclude = ruleset.conditions?.ref_name?.include || [];
  // `~DEFAULT_BRANCH` is GitHub's own condition syntax for "the repo's default branch,
  // whatever it is named" -- `~ALL` also covers it (a broader condition still applies).
  const targetsDefaultBranch = refInclude.includes('~DEFAULT_BRANCH') || refInclude.includes('~ALL');
  if (!targetsDefaultBranch) return false;
  const haveTypes = new Set((ruleset.rules || []).map((r) => r.type));
  return wantedTypes.every((t) => haveTypes.has(t));
}

/** True when ANY ruleset in `rulesetDetails` (an array of full detail objects) covers
 * every type in `wantedTypes` on the default branch, per rulesetCoversRules above. */
export function anyRulesetCovers(rulesetDetails, wantedTypes) {
  return (rulesetDetails || []).some((rs) => rulesetCoversRules(rs, wantedTypes));
}
