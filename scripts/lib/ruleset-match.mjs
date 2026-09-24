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

// One ruleset ref pattern against a full ref (refs/heads/main), in GitHub's fnmatch-style rule
// syntax: `*` stays inside one path segment, `**` crosses `/`, `?` is one non-slash character.
function refPatternMatches(pattern, ref) {
  if (pattern === ref) return true;
  const body = pattern.split('**').map((seg) => seg.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]')).join('.*');
  return new RegExp('^' + body + '$').test(ref);
}

/**
 * True when `ruleset` (a full ruleset detail object, from the single-ruleset GET) is
 * ACTIVE, targets the BRANCH type, applies to the repo's default branch, and its own
 * `rules` array covers every type named in `wantedTypes`. `defaultBranch` (a branch NAME,
 * optional) lets an `exclude` pattern that names or globs the default branch be honoured; a
 * `~DEFAULT_BRANCH`/`~ALL` exclude defeats coverage without it (UMB-112 row 21, CodeRabbit).
 */
export function rulesetCoversRules(ruleset, wantedTypes, defaultBranch) {
  if (!ruleset || ruleset.enforcement !== 'active') return false;
  if (ruleset.target !== 'branch') return false;
  const refInclude = ruleset.conditions?.ref_name?.include || [];
  const defaultRef = defaultBranch ? `refs/heads/${defaultBranch}` : null;
  // `~DEFAULT_BRANCH` is GitHub's own condition syntax for "the repo's default branch,
  // whatever it is named" -- `~ALL` also covers it (a broader condition still applies). A ruleset may
  // also NAME the branch (`refs/heads/main`) or glob it (`refs/heads/**`); that needs the default
  // branch name to judge, so without it only the two symbolic forms count (UMB-112 residue 9).
  const targetsDefaultBranch = refInclude.includes('~DEFAULT_BRANCH') || refInclude.includes('~ALL')
    || (defaultRef !== null && refInclude.some((p) => refPatternMatches(p, defaultRef)));
  if (!targetsDefaultBranch) return false;
  const exclude = ruleset.conditions?.ref_name?.exclude || [];
  if (exclude.some((p) => p === '~DEFAULT_BRANCH' || p === '~ALL' || (defaultRef !== null && refPatternMatches(p, defaultRef)))) return false;
  const haveTypes = new Set((ruleset.rules || []).map((r) => r.type));
  return wantedTypes.every((t) => haveTypes.has(t));
}

/** True when ANY ruleset in `rulesetDetails` (an array of full detail objects) covers
 * every type in `wantedTypes` on the default branch, per rulesetCoversRules above. */
export function anyRulesetCovers(rulesetDetails, wantedTypes, defaultBranch) {
  return (rulesetDetails || []).some((rs) => rulesetCoversRules(rs, wantedTypes, defaultBranch));
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
export function gateBypassVerdicts(details, expected = GATE_RULESET_BYPASS, defaultBranch) {
  const gates = (details || []).filter((rs) => rulesetCoversRules(rs, ['required_status_checks'], defaultBranch));
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

// ---------------------------------------------------------------------------------------------
// The repository-rulesets CANON (owner 2026-09-24, "setup Repository policies"): the ruleset
// specs in templates/repo-settings.<kind>.json (`ruleset` = main-guard, `tagRuleset` =
// tag-immutable) carry an EMPTY bypass list, so a ruleset that covers the same rules but lets an
// admin bypass it (the Coal* rooms' original main-guard) is NOT the canon. Matching stays by
// RULES, never by NAME (CWK-069): a differently named ruleset with the same rules AND the same
// bypass list still covers.

/** A tag ruleset covers a spec's ref patterns when it names each one verbatim (or `~ALL`) and
 * excludes nothing -- an exclude would let a tag slip past the immutability it exists to give. */
function tagRefsCovered(ruleset, specInclude) {
  const include = ruleset.conditions?.ref_name?.include || [];
  const exclude = ruleset.conditions?.ref_name?.exclude || [];
  if (exclude.length > 0) return false;
  return include.includes('~ALL') || specInclude.every((p) => include.includes(p));
}

/**
 * True when `ruleset` (a full detail object) IS the spec: active, the spec's target, covering the
 * spec's refs, carrying every rule type the spec names, and its bypass list EXACTLY the spec's
 * (empty when the spec names none). `defaultBranch` is the branch NAME, as in rulesetCoversRules.
 */
export function rulesetMatchesSpec(ruleset, spec, defaultBranch) {
  if (!ruleset || !spec || ruleset.enforcement !== 'active' || ruleset.target !== spec.target) return false;
  const wantedTypes = (spec.rules || []).map((r) => r.type);
  if (bypassActorsDiffer(ruleset.bypass_actors, spec.bypass_actors ?? []) !== null) return false;
  if (spec.target === 'branch') return rulesetCoversRules(ruleset, wantedTypes, defaultBranch);
  if (spec.target === 'tag') {
    if (!tagRefsCovered(ruleset, spec.conditions?.ref_name?.include || [])) return false;
    const have = new Set((ruleset.rules || []).map((r) => r.type));
    return wantedTypes.every((t) => have.has(t));
  }
  return false;
}

/**
 * What an applier does about one spec, given every ruleset on the repo of the spec's target as a
 * full detail object (any enforcement -- a DISABLED same-named ruleset must be found, or a POST
 * would 422 on the duplicate name):
 *   { action: 'in-sync' }                  a ruleset already IS the spec
 *   { action: 'update', id, existing }     a ruleset with the spec's NAME exists but differs: PUT the
 *                                          spec over it (bypass removed, enforcement set) -- only when
 *                                          every rule it carries is one the spec names, so a PUT never
 *                                          drops a rule the spec does not know about
 *   { action: 'conflict', id, reason }     same name, but it carries a rule outside the spec: the
 *                                          owner's decision, never overwritten
 *   { action: 'create' }                   nothing by that name
 */
export function planRulesetSpec(details, spec, defaultBranch) {
  const list = (details || []).filter((rs) => rs && rs.target === spec.target);
  if (list.some((rs) => rulesetMatchesSpec(rs, spec, defaultBranch))) return { action: 'in-sync' };
  const named = list.find((rs) => rs.name === spec.name);
  if (!named) return { action: 'create' };
  const specTypes = new Set((spec.rules || []).map((r) => r.type));
  const extra = (named.rules || []).map((r) => r.type).filter((t) => !specTypes.has(t));
  if (extra.length > 0) return { action: 'conflict', id: named.id, reason: `"${named.name}" carries rule(s) the canon does not name (${extra.join(', ')}); overwriting would drop them` };
  return { action: 'update', id: named.id, existing: named };
}

/** The write body for a spec (POST, or the PUT over an existing ruleset): exactly the canon's fields. */
export function rulesetWriteBody(spec) {
  return {
    name: spec.name,
    target: spec.target,
    enforcement: spec.enforcement,
    conditions: spec.conditions,
    rules: spec.rules,
    bypass_actors: spec.bypass_actors ?? [],
  };
}

/** Rulesets a spec lists as GitHub-created leftovers to delete: same name, same enforcement, and
 * ONLY the listed rule types -- a ruleset that merely shares the name but does real work stays. */
export function leftoverRulesets(details, leftovers) {
  return (details || []).filter((rs) => (leftovers || []).some((l) =>
    rs.name === l.name && rs.enforcement === l.enforcement
    && (rs.rules || []).length === (l.rules || []).length
    && (rs.rules || []).every((r) => (l.rules || []).includes(r.type))));
}
