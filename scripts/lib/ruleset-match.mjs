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

// UMB-131 -- the gate ruleset's BYPASS LIST. `dependabot-auto-merge-gate` makes the
// maintainer's own direct pushes wait for the required checks unless an admin bypass exists;
// SWEEP-MARKS.md (the gate row) states the canon value: RepositoryRole Admin (actor_id 5),
// bypass_mode always. CoalMine's ruleset lost it in the 2026-09-17 org transfer
// (`bypass_actors: []`) and nothing noticed for two days -- `--settings` only asked whether SOME
// ruleset covers deletion+non_fast_forward. This is the value the six healthy rooms carry.
export const GATE_RULESET_BYPASS = Object.freeze([
  Object.freeze({ actor_id: 5, actor_type: 'RepositoryRole', bypass_mode: 'always' }),
]);

// Order- and key-order-insensitive canonical form of one actor, so two spellings of the
// same list compare equal and any real difference (id, type, mode, an extra actor) does not.
const actorKey = (a) => JSON.stringify([a?.actor_id ?? null, a?.actor_type ?? null, a?.bypass_mode ?? null]);
const canonList = (list) => (Array.isArray(list) ? list : []).map(actorKey).sort();

/** null when `actual` is exactly the `expected` set; otherwise `{ want, live }` for the report. */
export function bypassActorsDiffer(actual, expected = GATE_RULESET_BYPASS) {
  const a = canonList(actual);
  const e = canonList(expected);
  if (a.length === e.length && a.every((k, i) => k === e[i])) return null;
  return { want: expected, live: Array.isArray(actual) ? actual : [] };
}

/**
 * One verdict per ACTIVE default-branch ruleset carrying a required_status_checks rule (the
 * gate), judged on its bypass list; a single not-ok verdict when none exists. `details` = full
 * ruleset detail objects (the single-ruleset GET -- the list endpoint carries no rules or
 * bypass_actors). A ruleset without that rule (main-guard) is not a gate and is not judged here.
 */
export function gateBypassVerdicts(details, expected = GATE_RULESET_BYPASS) {
  const gates = (details || []).filter((rs) => rulesetCoversRules(rs, ['required_status_checks']));
  if (gates.length === 0) {
    return [{ ok: false, text: 'ruleset bypass: DIFFERS (no active required_status_checks ruleset on the default branch -- SWEEP-MARKS expects the dependabot-auto-merge-gate)' }];
  }
  return gates.map((rs) => {
    const d = bypassActorsDiffer(rs.bypass_actors, expected);
    return d
      ? { ok: false, text: `ruleset "${rs.name}" bypass_actors: DIFFERS (want ${JSON.stringify(d.want)}, live ${JSON.stringify(d.live)})` }
      : { ok: true, text: `ruleset "${rs.name}" bypass_actors: identical (RepositoryRole Admin, always)` };
  });
}
