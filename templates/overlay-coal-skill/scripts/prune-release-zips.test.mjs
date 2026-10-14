// Guard-rail tests only. The actual list-releases/delete-asset calls are a real externality
// (the GitHub API) that testing.md's own Test Doubles rule says to mock only when you can't
// run in-process at all -- here we simply never reach them: both cases below return/exit
// before any network call happens, so the test proves that WITHOUT touching the network
// (never a fake, since there is nothing safe to fake a delete call into).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listReleases } from './prune-release-zips.mjs';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'prune-release-zips.mjs');

function run(env) {
  // Strip any ambient GITHUB_TOKEN/GITHUB_REPOSITORY from the real environment (this test may
  // run inside a workflow that has them) so each case controls its own inputs exactly.
  const clean = { ...process.env };
  delete clean.PRUNE_OLD_RELEASE_ZIPS;
  delete clean.GITHUB_TOKEN;
  delete clean.GITHUB_REPOSITORY;
  return spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8', timeout: 30000, env: { ...clean, ...env } });
}

test('prune-release-zips.mjs: flag unset -- exit 0, "flag off" message, no attempt to reach the network', () => {
  const res = run({});
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /flag off, nothing pruned/);
});

test('prune-release-zips.mjs: flag set to anything other than the literal "true" is still off (e.g. "1", "TRUE")', () => {
  for (const v of ['1', 'TRUE', 'yes']) {
    const res = run({ PRUNE_OLD_RELEASE_ZIPS: v });
    assert.equal(res.status, 0, `value "${v}": ${res.stderr}`);
    assert.match(res.stdout, /flag off/);
  }
});

test('prune-release-zips.mjs: flag on but GITHUB_TOKEN/GITHUB_REPOSITORY missing -- fails loud, exit 1, never reaches the network', () => {
  const res = run({ PRUNE_OLD_RELEASE_ZIPS: 'true' });
  assert.equal(res.status, 1);
  assert.match(res.stderr, /GITHUB_TOKEN and GITHUB_REPOSITORY must both be set/);
});

// 14h item 14 (7), CoalFace #9 = CoalLedger #7 (Major): `for (let page = 1; page < 10; page++)` read nine pages and stopped SILENTLY, so a repository with more than 900 Releases handed the
// selection a list that was missing its newest-or-oldest Releases and could prune the wrong one. The pager now reads until a short page, and fails loud when the cap is reached on a full page.

const fakePages = (total, seen = []) => async (url) => {
  const page = Number(new URL(url).searchParams.get('page'));
  seen.push(page);
  const from = (page - 1) * 100;
  const n = Math.max(0, Math.min(100, total - from));
  const body = Array.from({ length: n }, (_, i) => ({ tag_name: 'v' + (from + i) }));
  return { ok: true, status: 200, json: async () => body };
};

test('listReleases reads every page until a short one: 950 and 1,000 Releases are listed whole (a full last page is followed by an empty one) -- RED before 14h (7)', async () => {
  for (const total of [0, 99, 100, 250, 900, 950, 1000]) {
    const seen = [];
    const got = await listReleases('o/r', 't', fakePages(total, seen));
    assert.equal(got.length, total, `${total} Releases`);
    assert.equal(new Set(got.map((r) => r.tag_name)).size, total, 'no page was read twice');
    assert.equal(seen.length, Math.floor(total / 100) + 1, `${total}: one request per page and one for the short or empty page that ends it`);
  }
});

test('listReleases fails loud when it hits its page cap on a full page, never returns a list that may be missing Releases', async () => {
  await assert.rejects(listReleases('o/r', 't', fakePages(100000), 5), /still full at page 5.*refusing to prune/);
  const seen = [];
  const exactly = await listReleases('o/r', 't', fakePages(499, seen), 5); // 4 full pages and a short fifth: complete, within the cap
  assert.equal(exactly.length, 499);
});

test('listReleases: an HTTP error or a body that is not a list is a failure naming the page', async () => {
  await assert.rejects(listReleases('o/r', 't', async () => ({ ok: false, status: 502, json: async () => ({}) })), /page 1 -> HTTP 502/);
  await assert.rejects(listReleases('o/r', 't', async () => ({ ok: true, status: 200, json: async () => ({ message: 'x' }) })), /page 1 .*not a list/);
});
