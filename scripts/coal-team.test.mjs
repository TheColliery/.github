// Tests for lib/coal-team.mjs (UMB-127) -- the GitHub `Coal*` team as a new-sibling
// enumeration surface: the description is DERIVED from the team's own repo list, and a new
// room's membership is a plan of REST calls, never a hand-typed sentence. Pure logic + an
// injected `call` (no network, no clock).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COAL_ORG,
  COAL_TEAM_SLUG,
  isCoalRoomName,
  numberWord,
  orderRooms,
  teamDescription,
  planCoalTeam,
  syncCoalTeam,
} from './lib/coal-team.mjs';

// Dated verbatim excerpt, read at the API 2026-09-20 (`GET /orgs/TheColliery/teams/coal`,
// description, 304 chars, ASCII only). The equality below IS the regenerator's test.
const LIVE_DESCRIPTION =
  "The Coal* skill series: CoalMine, CoalTipple, CoalBoard, CoalHearth, CoalFace, CoalWash, CoalLedger. Members hold Read on the seven public rooms (the least role: review requests and mentions); every change still lands through a pull request. This team is the one place a member's Coal* access comes from.";

// Repo ids as read 2026-09-20 (`GET /repos/TheColliery/<room>`), in the API's ALPHABETICAL
// team-list order -- NOT the description's order -- so the ordering rule is exercised.
const LIVE_TEAM_REPOS = [
  { name: 'CoalBoard', id: 1273752906, private: false, role_name: 'read' },
  { name: 'CoalFace', id: 1286819933, private: false, role_name: 'read' },
  { name: 'CoalHearth', id: 1285876949, private: false, role_name: 'read' },
  { name: 'CoalLedger', id: 1294577413, private: false, role_name: 'read' },
  { name: 'CoalMine', id: 1259836955, private: false, role_name: 'read' },
  { name: 'CoalTipple', id: 1269347378, private: false, role_name: 'read' },
  { name: 'CoalWash', id: 1294577372, private: false, role_name: 'read' },
];

test('isCoalRoomName: Coal + a name is a room; .github, Kolwen, "Coal" alone and path-shaped input are not', () => {
  assert.equal(isCoalRoomName('CoalMine'), true);
  assert.equal(isCoalRoomName('CoalLedger'), true);
  assert.equal(isCoalRoomName('Coal'), false);
  assert.equal(isCoalRoomName('.github'), false);
  assert.equal(isCoalRoomName('Kolwen'), false);
  assert.equal(isCoalRoomName('CoalMine/../x'), false);
  assert.equal(isCoalRoomName(undefined), false);
});

test('numberWord: 1..12 spelled out, larger falls back to digits', () => {
  assert.equal(numberWord(7), 'seven');
  assert.equal(numberWord(8), 'eight');
  assert.equal(numberWord(1), 'one');
  assert.equal(numberWord(12), 'twelve');
  assert.equal(numberWord(13), '13');
});

test('orderRooms: repo id ascending (creation order), never the API alphabetical order; input untouched', () => {
  const before = JSON.stringify(LIVE_TEAM_REPOS);
  const names = orderRooms(LIVE_TEAM_REPOS).map((r) => r.name);
  assert.deepEqual(names, ['CoalMine', 'CoalTipple', 'CoalBoard', 'CoalHearth', 'CoalFace', 'CoalWash', 'CoalLedger']);
  assert.equal(JSON.stringify(LIVE_TEAM_REPOS), before, 'orderRooms must not mutate its input');
});

test('teamDescription: TODAY\'S seven-room list regenerates the LIVE 304-char description byte for byte', () => {
  const got = teamDescription(orderRooms(LIVE_TEAM_REPOS).map((r) => r.name));
  assert.equal(got, LIVE_DESCRIPTION);
  assert.equal(got.length, 304);
});

test('teamDescription: an eighth room is named LAST and the count word follows the list', () => {
  const names = [...orderRooms(LIVE_TEAM_REPOS).map((r) => r.name), 'CoalNext'];
  const got = teamDescription(names);
  assert.ok(got.startsWith('The Coal* skill series: CoalMine, CoalTipple, CoalBoard, CoalHearth, CoalFace, CoalWash, CoalLedger, CoalNext. '), got);
  assert.ok(got.includes('Members hold Read on the eight public rooms '), got);
  assert.ok(!got.includes('seven'), got);
});

test('planCoalTeam: a room already a member at Read, description already right -> NO actions (a no-op write is still a write)', () => {
  const plan = planCoalTeam({
    org: COAL_ORG,
    repo: { name: 'CoalMine', id: 1259836955, private: false },
    teamRepos: LIVE_TEAM_REPOS,
    teamDescription: LIVE_DESCRIPTION,
  });
  assert.deepEqual(plan.actions, []);
  assert.equal(plan.status, 'IN-SYNC');
});

test('planCoalTeam: a NEW public Coal* room -> PUT the membership at pull, then PATCH the regenerated description naming it last', () => {
  const plan = planCoalTeam({
    org: COAL_ORG,
    repo: { name: 'CoalNext', id: 1300000000, private: false },
    teamRepos: LIVE_TEAM_REPOS,
    teamDescription: LIVE_DESCRIPTION,
  });
  assert.equal(plan.actions.length, 2);
  assert.deepEqual(plan.actions[0], {
    method: 'PUT',
    path: `/orgs/${COAL_ORG}/teams/${COAL_TEAM_SLUG}/repos/${COAL_ORG}/CoalNext`,
    body: { permission: 'pull' },
  });
  assert.equal(plan.actions[1].method, 'PATCH');
  assert.equal(plan.actions[1].path, `/orgs/${COAL_ORG}/teams/${COAL_TEAM_SLUG}`);
  assert.ok(plan.actions[1].body.description.includes('CoalLedger, CoalNext. Members hold Read on the eight public rooms'));
  assert.deepEqual(Object.keys(plan.actions[1].body), ['description'], 'the PATCH carries the description and nothing else');
});

test('planCoalTeam: a member held above Read is DRIFT -> the PUT sets it back to pull; the description is untouched when already right', () => {
  const drifted = LIVE_TEAM_REPOS.map((r) => (r.name === 'CoalFace' ? { ...r, role_name: 'push' } : r));
  const plan = planCoalTeam({
    org: COAL_ORG,
    repo: { name: 'CoalFace', id: 1286819933, private: false },
    teamRepos: drifted,
    teamDescription: LIVE_DESCRIPTION,
  });
  assert.equal(plan.actions.length, 1);
  assert.equal(plan.actions[0].method, 'PUT');
  assert.deepEqual(plan.actions[0].body, { permission: 'pull' });
});

test('planCoalTeam: a description that drifted from the list is re-issued even when membership is fine', () => {
  const plan = planCoalTeam({
    org: COAL_ORG,
    repo: { name: 'CoalMine', id: 1259836955, private: false },
    teamRepos: LIVE_TEAM_REPOS,
    teamDescription: LIVE_DESCRIPTION.replace('CoalLedger', 'CoalLedger, CoalGhost'),
  });
  assert.equal(plan.actions.length, 1);
  assert.equal(plan.actions[0].method, 'PATCH');
  assert.equal(plan.actions[0].body.description, LIVE_DESCRIPTION);
});

test('planCoalTeam: a PRIVATE Coal* repo, a non-Coal name, or a foreign owner is N/A -- the team holds the PUBLIC rooms only', () => {
  for (const repo of [
    { name: 'CoalGob', id: 1400000000, private: true },
    { name: 'Kolwen', id: 1400000001, private: false },
  ]) {
    const plan = planCoalTeam({ org: COAL_ORG, repo, teamRepos: LIVE_TEAM_REPOS, teamDescription: LIVE_DESCRIPTION });
    assert.equal(plan.status, 'N/A', repo.name);
    assert.deepEqual(plan.actions, [], repo.name);
  }
  const foreign = planCoalTeam({ org: 'SomeoneElse', repo: { name: 'CoalMine', id: 1, private: false }, teamRepos: LIVE_TEAM_REPOS, teamDescription: LIVE_DESCRIPTION });
  assert.equal(foreign.status, 'N/A');
  assert.deepEqual(foreign.actions, []);
});

test('planCoalTeam: a non-Coal or private repo already on the team does not enter the description', () => {
  const noisy = [...LIVE_TEAM_REPOS, { name: 'Kolwen', id: 1, private: false, role_name: 'read' }, { name: 'CoalGob', id: 2, private: true, role_name: 'read' }];
  const plan = planCoalTeam({
    org: COAL_ORG,
    repo: { name: 'CoalMine', id: 1259836955, private: false },
    teamRepos: noisy,
    teamDescription: LIVE_DESCRIPTION,
  });
  assert.deepEqual(plan.actions, [], 'the list the sentence derives from is the public Coal* rooms only');
});

// ---- syncCoalTeam: the executor, with an injected `call` -------------------------------

// A fake team API: `call(method, path, body)` answers the reads from `state` and applies
// the writes to it, so a read-back after a write sees the write.
function fakeApi(state) {
  const log = [];
  const call = async (method, path, body) => {
    log.push({ method, path, body });
    if (method === 'GET' && path === `/repos/${COAL_ORG}/${state.repo.name}`) return { ok: true, status: 200, json: state.repo };
    if (method === 'GET' && path.startsWith(`/orgs/${COAL_ORG}/teams/${COAL_TEAM_SLUG}/repos`)) return { ok: true, status: 200, json: state.teamRepos };
    if (method === 'GET' && path === `/orgs/${COAL_ORG}/teams/${COAL_TEAM_SLUG}`) return { ok: true, status: 200, json: { description: state.description } };
    if (method === 'PUT' && path === `/orgs/${COAL_ORG}/teams/${COAL_TEAM_SLUG}/repos/${COAL_ORG}/${state.repo.name}`) {
      state.teamRepos = [...state.teamRepos.filter((r) => r.name !== state.repo.name), { ...state.repo, role_name: body.permission === 'pull' ? 'read' : body.permission }];
      return { ok: true, status: 204, json: null };
    }
    if (method === 'PATCH' && path === `/orgs/${COAL_ORG}/teams/${COAL_TEAM_SLUG}`) {
      state.description = body.description;
      return { ok: true, status: 200, json: { description: state.description } };
    }
    return { ok: false, status: 404, json: null };
  };
  return { call, log, state };
}

const writesOf = (log) => log.filter((c) => c.method !== 'GET');

test('syncCoalTeam --dry-run against the LIVE canon: reads only, ZERO writes, reports IN-SYNC and the equality', async () => {
  const api = fakeApi({ repo: { name: 'CoalMine', id: 1259836955, private: false }, teamRepos: LIVE_TEAM_REPOS, description: LIVE_DESCRIPTION });
  const res = await syncCoalTeam({ call: api.call, owner: COAL_ORG, repoName: 'CoalMine', dry: true });
  assert.equal(res.status, 'IN-SYNC');
  assert.equal(res.ok, true);
  assert.deepEqual(writesOf(api.log), []);
  assert.match(res.reason, /regenerated description equals the live one \(304 chars\)/);
});

test('syncCoalTeam --dry-run for a NEW room: names both calls, sends NEITHER', async () => {
  const api = fakeApi({ repo: { name: 'CoalNext', id: 1300000000, private: false }, teamRepos: LIVE_TEAM_REPOS, description: LIVE_DESCRIPTION });
  const res = await syncCoalTeam({ call: api.call, owner: COAL_ORG, repoName: 'CoalNext', dry: true });
  assert.equal(res.status, 'DRY-RUN');
  assert.deepEqual(writesOf(api.log), []);
  assert.match(res.reason, /PUT \/orgs\/TheColliery\/teams\/coal\/repos\/TheColliery\/CoalNext/);
  assert.match(res.reason, /PATCH \/orgs\/TheColliery\/teams\/coal/);
});

test('syncCoalTeam LIVE for a NEW room: PUT then PATCH in that order, then a READ-BACK that confirms both', async () => {
  const api = fakeApi({ repo: { name: 'CoalNext', id: 1300000000, private: false }, teamRepos: LIVE_TEAM_REPOS, description: LIVE_DESCRIPTION });
  const res = await syncCoalTeam({ call: api.call, owner: COAL_ORG, repoName: 'CoalNext', dry: false });
  assert.equal(res.ok, true, res.reason);
  assert.deepEqual(writesOf(api.log).map((c) => `${c.method} ${c.path}`), [
    `PUT /orgs/${COAL_ORG}/teams/${COAL_TEAM_SLUG}/repos/${COAL_ORG}/CoalNext`,
    `PATCH /orgs/${COAL_ORG}/teams/${COAL_TEAM_SLUG}`,
  ]);
  const lastWrite = api.log.map((c) => c.method).lastIndexOf('PATCH');
  assert.ok(api.log.slice(lastWrite + 1).some((c) => c.method === 'GET'), 'a GET must follow the last write -- the read-back');
  assert.equal(api.state.description.includes('CoalLedger, CoalNext. Members hold Read on the eight public rooms'), true);
});

test('syncCoalTeam LIVE: a room already in sync sends NO write at all', async () => {
  const api = fakeApi({ repo: { name: 'CoalWash', id: 1294577372, private: false }, teamRepos: LIVE_TEAM_REPOS, description: LIVE_DESCRIPTION });
  const res = await syncCoalTeam({ call: api.call, owner: COAL_ORG, repoName: 'CoalWash', dry: false });
  assert.equal(res.status, 'IN-SYNC');
  assert.deepEqual(writesOf(api.log), []);
});

test('syncCoalTeam LIVE: a write that "succeeds" but does not read back is a FAIL, not ok', async () => {
  const api = fakeApi({ repo: { name: 'CoalNext', id: 1300000000, private: false }, teamRepos: LIVE_TEAM_REPOS, description: LIVE_DESCRIPTION });
  const inner = api.call;
  const lying = async (method, path, body) => (method === 'PATCH' ? { ok: true, status: 200, json: {} } : inner(method, path, body));
  const res = await syncCoalTeam({ call: lying, owner: COAL_ORG, repoName: 'CoalNext', dry: false });
  assert.equal(res.ok, false);
  assert.match(res.reason, /read-back/);
});

test('syncCoalTeam: an API read that fails is a FAIL naming the path, never a silent no-op', async () => {
  const call = async () => ({ ok: false, status: 403, json: null });
  const res = await syncCoalTeam({ call, owner: COAL_ORG, repoName: 'CoalMine', dry: true });
  assert.equal(res.ok, false);
  assert.match(res.reason, /HTTP 403/);
});
