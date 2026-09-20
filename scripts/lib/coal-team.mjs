// coal-team.mjs -- UMB-127: the GitHub `Coal*` team is a NEW-SIBLING ENUMERATION SURFACE.
// It holds the public Coal* rooms at Read, and its description names them. The description
// is DERIVED from the team's own repo list (the list is the source, the sentence is the
// output -- never hand-typed), so a new room cannot be added to one and forgotten in the
// other. `new-repo.mjs --apply-settings` calls syncCoalTeam for a published-code Coal* room.
//
// No network here: a caller injects `call(method, path, body) -> { ok, status, json }`, which
// is what makes the request sequence testable. Zero-dep (Phoenix #2).

export const COAL_ORG = 'TheColliery';
export const COAL_TEAM_SLUG = 'coal';
const TEAM_PERMISSION = 'pull'; // the write-side name of Read; the least role (owner 2026-09-19)

// A room is `Coal` + a name: no path characters, so a name can never steer a request path.
const ROOM_NAME = /^Coal[A-Za-z0-9]+$/;
export const isCoalRoomName = (name) => typeof name === 'string' && ROOM_NAME.test(name);

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
/** 0..12 spelled out (prose reads "the seven public rooms"); beyond that, digits. */
export const numberWord = (n) => WORDS[n] ?? String(n);

/** Rooms in CREATION order = repo id ascending. The live sentence names them in the order they
 * were founded (CoalMine first, CoalLedger last), the API lists them alphabetically, so the
 * order must be stated: a new room lands last, deterministically. Does not mutate `repos`. */
export const orderRooms = (repos) => [...repos].sort((a, b) => a.id - b.id);

/** The team description for `names` (already ordered). Template = the live 304-char text of
 * 2026-09-20; only the room list and the count word are slots. */
export function teamDescription(names) {
  return `The Coal* skill series: ${names.join(', ')}. Members hold Read on the ${numberWord(names.length)} public rooms (the least role: review requests and mentions); every change still lands through a pull request. This team is the one place a member's Coal* access comes from.`;
}

// The team holds PUBLIC Coal* rooms only -- the sentence says "public rooms".
const isTeamRoom = (r) => isCoalRoomName(r.name) && r.private === false;
const readRole = (r) => r.role_name ?? (r.permissions?.push ? 'write' : 'read');

/**
 * Decide the calls one room needs. `repo` = { name, id, private } (from GET /repos),
 * `teamRepos` = the team's repo list, `teamDescription` = the team's live description.
 * Returns { status: 'N/A'|'IN-SYNC'|'PLAN', actions: [{ method, path, body }], reason?, rooms }.
 */
export function planCoalTeam({ org, repo, teamRepos, teamDescription: liveDescription }) {
  if (org !== COAL_ORG) return { status: 'N/A', actions: [], reason: `the ${COAL_TEAM_SLUG} team belongs to ${COAL_ORG}, not ${org}` };
  if (!isCoalRoomName(repo.name)) return { status: 'N/A', actions: [], reason: `${repo.name} is not a Coal* room` };
  if (repo.private !== false) return { status: 'N/A', actions: [], reason: `${repo.name} is not public -- the team holds the public rooms only` };

  const teamBase = `/orgs/${org}/teams/${COAL_TEAM_SLUG}`;
  const member = teamRepos.find((r) => r.name === repo.name);
  const actions = [];
  if (!member || readRole(member) !== 'read') {
    actions.push({ method: 'PUT', path: `${teamBase}/repos/${org}/${repo.name}`, body: { permission: TEAM_PERMISSION } });
  }
  // The list the sentence derives from: today's public Coal* members plus this room.
  const rooms = orderRooms([...teamRepos.filter((r) => isTeamRoom(r) && r.name !== repo.name), { name: repo.name, id: repo.id, private: false }]);
  const description = teamDescription(rooms.map((r) => r.name));
  if (description !== liveDescription) actions.push({ method: 'PATCH', path: teamBase, body: { description } });
  return { status: actions.length ? 'PLAN' : 'IN-SYNC', actions, rooms, description };
}

const fail = (reason) => ({ ok: false, status: 'FAIL', reason });

/**
 * Read the team, plan, and (unless `dry`) execute + read back. Returns one result row for the
 * apply-settings report: { ok, status, reason }. Every read that fails is a FAIL naming the path.
 */
export async function syncCoalTeam({ call, owner, repoName, dry }) {
  const teamBase = `/orgs/${owner}/teams/${COAL_TEAM_SLUG}`;
  // A GET that fails is remembered by path + status, so a FAIL names what it could not read.
  let readError = null;
  const read = async (path) => {
    const r = await call('GET', path);
    if (r.ok && r.json) return r.json;
    readError ??= `could not read ${path} (HTTP ${r.status})`;
    return null;
  };
  const repo = await read(`/repos/${owner}/${repoName}`);
  if (!repo) return fail(readError);
  // A repo that can never be a team room needs no team read (and a 404 there would be noise).
  const early = planCoalTeam({ org: owner, repo, teamRepos: [], teamDescription: '' });
  if (early.status === 'N/A') return { ok: true, status: 'N/A', reason: early.reason };

  // ponytail: one page of 100 -- the team holds public Coal* rooms (single digits); paginate if it ever nears 100.
  const listPath = `${teamBase}/repos?per_page=100`;
  const [team, teamRepos] = await Promise.all([read(teamBase), read(listPath)]);
  if (!team || !Array.isArray(teamRepos)) return fail(readError ?? `${listPath} did not return a list`);

  const plan = planCoalTeam({ org: owner, repo, teamRepos, teamDescription: team.description ?? '' });
  if (plan.status === 'IN-SYNC') {
    return { ok: true, status: 'IN-SYNC', reason: `${plan.rooms.length} rooms at Read; regenerated description equals the live one (${plan.description.length} chars)` };
  }
  const steps = plan.actions.map((a) => `${a.method} ${a.path}`).join(' ; then ');
  if (dry) return { ok: true, status: 'DRY-RUN', reason: `would ${steps} -- no write made` };

  for (const a of plan.actions) {
    const r = await call(a.method, a.path, a.body);
    if (!r.ok) return fail(`${a.method} ${a.path} -> HTTP ${r.status}`);
  }
  // Read back: the write's own 2xx is not the artifact.
  const [after, afterRepos] = await Promise.all([read(teamBase), read(listPath)]);
  const inTeam = Array.isArray(afterRepos) && afterRepos.find((r) => r.name === repoName);
  if (!after || !inTeam || readRole(inTeam) !== 'read' || after.description !== plan.description) {
    return fail('read-back after the write does not match (membership at Read + regenerated description expected)');
  }
  return { ok: true, status: 200, reason: `${steps}; read back: ${afterRepos.filter(isTeamRoom).length} rooms at Read, description matches` };
}
