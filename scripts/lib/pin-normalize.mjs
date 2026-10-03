// pin-normalize: compare two copies of a workflow file without counting each copy's own action pins as a difference.
//
// WHY (UMB-256): every `uses: <owner>/<repo>[/<path>]@<40-hex sha> # <tag>` line is a pin that each repository's own Dependabot bumps
// on its own schedule. A check that holds a template file to a live copy byte for byte (or by blob id) therefore turns red after every
// bump, though the structure is identical and the pins are exactly what Dependabot maintains. The rule here: the STRUCTURE must stay
// identical; the pins stay each copy's own. One source for every such check (the scorecard parity test, skeleton-check's file compare,
// the overlay-set compare), so they cannot disagree about what a pin is.
//
// A pin is a `uses:` value whose ref is a full 40-hex commit id. A local action (`./...`), a docker reference, or a ref that is a tag or
// a branch is not a pin and is compared as it stands. Zero dependencies: node builtins only.
const PIN = /^([ \t]*(?:-[ \t]+)?uses:[ \t]+)([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_./-]+)?)@([0-9a-f]{40})(?:[ \t]+#[ \t]*([^\r\n]*))?/gm;

const lf = (text) => String(text).replace(/\r\n/g, '\n');

/** The text with every pin's sha and trailing tag comment replaced by a fixed token. EOL-normalised. */
export function normalizePins(text) {
  return lf(text).replace(PIN, (_m, lead, action) => `${lead}${action}@<pin>`);
}

/** Every pin of a text, in order: { action, sha, tag } (tag is the comment after the sha, or ''). */
export function pinsOf(text) {
  return [...lf(text).matchAll(PIN)].map((m) => ({ action: m[2], sha: m[3], tag: (m[4] || '').trim() }));
}

// Compare two tags such as v4.38.2 and v4: -1 / 0 / 1 over the components BOTH carry, or null when they cannot be ordered
// (a non-version tag, or equal over the shared components with different precision).
function cmpTag(a, b) {
  const parse = (t) => { const m = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(t); return m ? m.slice(1).filter((x) => x !== undefined).map(Number) : null; };
  const pa = parse(a); const pb = parse(b);
  if (!pa || !pb) return null;
  for (let i = 0; i < Math.min(pa.length, pb.length); i++) if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  return pa.length === pb.length ? 0 : null;
}

/**
 * Judge a live copy against its canon. Returns null when the two differ in more than pins (the caller reports its own DIFFERS), or
 * { same: true } when the pins match too, or { same: false, diffs: [{ action, canon, room, direction }] } when ONLY pins differ.
 * direction: 'room behind' | 'room ahead' | 'differs' (the tags cannot be ordered, or the same tag names a different commit).
 */
export function pinOnlyDifference(canonText, roomText) {
  if (normalizePins(canonText) !== normalizePins(roomText)) return null;
  const a = pinsOf(canonText); const b = pinsOf(roomText);
  const diffs = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i].sha === b[i].sha) continue;
    const c = cmpTag(a[i].tag, b[i].tag);
    diffs.push({ action: a[i].action, canon: a[i].tag || a[i].sha.slice(0, 8), room: b[i].tag || b[i].sha.slice(0, 8), direction: c === null ? 'differs' : c < 0 ? 'room ahead' : c > 0 ? 'room behind' : 'differs' });
  }
  return diffs.length ? { same: false, diffs } : { same: true };
}

/** One printed line for a pin-only difference, e.g. "PINS ONLY: 1 action pin differs from the canon (ossf/scorecard-action v2.4.3 vs canon v2.4.4: room behind)". */
export function pinLine(diffs) {
  const body = diffs.map((d) => `${d.action} ${d.room} vs canon ${d.canon}: ${d.direction}`).join('; ');
  return `PINS ONLY: ${diffs.length} action pin${diffs.length === 1 ? '' : 's'} differ${diffs.length === 1 ? 's' : ''} from the canon, structure identical (${body})`;
}
