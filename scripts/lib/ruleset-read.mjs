// ruleset-read.mjs -- one repository's rulesets as full detail objects, read WHOLE or not at all (UMB3-006, CodeRabbit on gate-check-source and skeleton-check).
//
// The list endpoint carries no rules, so each ruleset is read again by id. Two silent shortcuts lived in the three callers: a list read that came back unsuccessful or not a list was taken as
// "no rulesets", and a detail read that failed was dropped, so a gate could vanish from the picture and the report would say "no gate" or a writer would plan from a partial view.
// Here both throw a named error (the endpoint and the HTTP status; the ruleset id only when it is a safe integer), and the list follows its pages.
//
// `getFn(path) -> { status, json }` is the caller's own read, so no network call is made here. `includeParents: false` asks for the repository's OWN rulesets: a ruleset inherited from the
// organization or the enterprise cannot be written through a repository's ruleset endpoint (GET /repos/{owner}/{repo}/rulesets takes `includes_parents`, default true, docs.github.com
// REST "Rules", read 2026-10-14).
import { getAllPages, pageNote } from './paginate.mjs';

/** @returns {Promise<object[]>} the full detail objects; throws an Error naming the endpoint and the HTTP status when the list or any detail cannot be read whole. */
export async function readRulesetDetails(getFn, base, { includeParents = true } = {}) {
  const listPath = `${base}/rulesets${includeParents ? '' : '?includes_parents=false'}`;
  const list = await getAllPages(getFn, listPath, (j) => j);
  if (list.partial) throw new Error(`GET ${base}/rulesets -> ${pageNote(list)}`);
  const details = [];
  for (const c of list.items) {
    const id = c && c.id;
    if (!Number.isSafeInteger(id)) throw new Error(`GET ${base}/rulesets -> a list entry without a numeric id`);
    const d = await getFn(`${base}/rulesets/${id}`);
    if (d.status !== 200 || !d.json || typeof d.json !== 'object') throw new Error(`GET ${base}/rulesets/${id} -> ${d.status === 200 ? 'an answer that is not a ruleset' : pageNote({ status: d.status })}`);
    details.push(d.json);
  }
  return details;
}
