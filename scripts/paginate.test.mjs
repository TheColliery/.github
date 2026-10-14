// UMB3-006: the shared pager (scripts/lib/paginate.mjs) and the whole-or-nothing ruleset reader (scripts/lib/ruleset-read.mjs). No network: each caller hands in its own read.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAllPages, pageNote, PER_PAGE, MAX_PAGES } from './lib/paginate.mjs';
import { readRulesetDetails } from './lib/ruleset-read.mjs';

const pageOf = (u) => Number(new URL('https://x' + u).searchParams.get('page'));
const fakeList = (total, { failAt = null, seen = [], wrap = null } = {}) => async (u) => {
  const page = pageOf(u);
  seen.push(u);
  if (failAt === page) return { status: 502, json: null };
  const from = (page - 1) * PER_PAGE;
  const n = Math.max(0, Math.min(PER_PAGE, total - from));
  const list = Array.from({ length: n }, (_, i) => ({ id: from + i }));
  return { status: 200, json: wrap ? { [wrap]: list } : list };
};

test('getAllPages reads every page until a short one: 0, 99, 100, 101 and 250 items are listed whole, each page once, and the short or empty page ends the read', async () => {
  for (const total of [0, 99, 100, 101, 250]) {
    const seen = [];
    const r = await getAllPages(fakeList(total, { seen }), '/x?a=1', (j) => j);
    assert.equal(r.items.length, total, String(total));
    assert.equal(r.partial, false, String(total));
    assert.equal(new Set(r.items.map((x) => x.id)).size, total, `${total}: no item twice`);
    assert.equal(seen.length, Math.floor(total / PER_PAGE) + 1, `${total}: one request per page, the last one short or empty`);
  }
});

test('getAllPages puts per_page and page on the path, after a query string or not, and reads a wrapped list through pick', async () => {
  const seen = [];
  await getAllPages(fakeList(0, { seen }), '/a?type=public', (j) => j);
  await getAllPages(fakeList(0, { seen }), '/b', (j) => j);
  assert.deepEqual(seen, ['/a?type=public&per_page=100&page=1', '/b?per_page=100&page=1']);
  const wrapped = await getAllPages(fakeList(150, { wrap: 'workflows' }), '/w', (j) => j.workflows);
  assert.equal(wrapped.items.length, 150);
  assert.equal(wrapped.partial, false);
});

test('getAllPages says what it could not read whole: a failed page keeps what came before, a body that is not a list and a full page at the cap are partial, never a shorter list', async () => {
  const bad = await getAllPages(fakeList(250, { failAt: 2 }), '/x', (j) => j);
  assert.equal(bad.partial, true); assert.equal(bad.status, 502); assert.equal(bad.items.length, PER_PAGE, 'what was read stays');
  const capped = await getAllPages(fakeList(100000), '/x', (j) => j, 3);
  assert.equal(capped.partial, true); assert.equal(capped.capped, true); assert.equal(capped.pages, 3); assert.equal(capped.items.length, 300);
  const exactlyAtCap = await getAllPages(fakeList(299), '/x', (j) => j, 3);
  assert.equal(exactlyAtCap.partial, false, 'two full pages and a short third are complete, within the cap');
  const notList = await getAllPages(async () => ({ status: 200, json: { message: 'x' } }), '/w', (j) => j.workflows);
  assert.equal(notList.partial, true); assert.equal(notList.notList, true);
  assert.equal(MAX_PAGES, 20, 'the default cap');
});

test('pageNote names the reason in a few words: the HTTP status, no answer at all, the cap, a body that is not a list', () => {
  assert.equal(pageNote({ status: 403 }), 'HTTP 403');
  assert.equal(pageNote({ status: 0 }), 'no answer: a timeout or a network error');
  assert.equal(pageNote({ status: 200, capped: true, pages: 20 }), 'still full after 20 pages');
  assert.equal(pageNote({ status: 200, notList: true }), 'an answer that is not a list');
});

// ---- readRulesetDetails: the list and every detail, whole or a named error ----
const rulesetGet = (state, seen = []) => async (u) => {
  seen.push(u);
  const path = u.split('?')[0];
  if (path === '/r/rulesets') {
    const page = pageOf(u);
    const list = state.list;
    return Array.isArray(list) ? { status: 200, json: page === 1 ? list : [] } : list;
  }
  const hit = state.details[path.slice('/r/rulesets/'.length)];
  return hit === undefined ? { status: 404, json: null } : hit;
};

test('readRulesetDetails: the list and every detail come back whole, in list order, the list read through its pages', async () => {
  const seen = [];
  const out = await readRulesetDetails(rulesetGet({ list: [{ id: 1 }, { id: 2 }], details: { 1: { status: 200, json: { id: 1, name: 'a' } }, 2: { status: 200, json: { id: 2, name: 'b' } } } }, seen), '/r');
  assert.deepEqual(out.map((x) => x.name), ['a', 'b']);
  assert.ok(seen[0].startsWith('/r/rulesets?per_page=100&page=1'), seen[0]);
  const none = await readRulesetDetails(rulesetGet({ list: [], details: {} }), '/r');
  assert.deepEqual(none, []);
});

test('readRulesetDetails: includeParents false asks for the repository\'s own rulesets, and the default does not', async () => {
  const seen = [];
  await readRulesetDetails(rulesetGet({ list: [], details: {} }, seen), '/r', { includeParents: false });
  await readRulesetDetails(rulesetGet({ list: [], details: {} }, seen), '/r');
  assert.equal(seen[0], '/r/rulesets?includes_parents=false&per_page=100&page=1');
  assert.equal(seen[1], '/r/rulesets?per_page=100&page=1');
});

test('readRulesetDetails: a list that is unsuccessful or not a list, a detail that fails, and an entry with no numeric id each throw a named error, never a shorter picture', async () => {
  await assert.rejects(readRulesetDetails(rulesetGet({ list: { status: 500, json: null }, details: {} }), '/r'), /GET \/r\/rulesets -> HTTP 500/);
  await assert.rejects(readRulesetDetails(rulesetGet({ list: { status: 200, json: { message: 'nope' } }, details: {} }), '/r'), /GET \/r\/rulesets -> an answer that is not a list/);
  await assert.rejects(readRulesetDetails(rulesetGet({ list: [{ id: 1 }, { id: 2 }], details: { 1: { status: 200, json: { id: 1 } }, 2: { status: 502, json: null } } }), '/r'), /GET \/r\/rulesets\/2 -> HTTP 502/);
  await assert.rejects(readRulesetDetails(rulesetGet({ list: [{ id: 1 }], details: { 1: { status: 200, json: null } } }), '/r'), /GET \/r\/rulesets\/1 -> an answer that is not a ruleset/);
  await assert.rejects(readRulesetDetails(rulesetGet({ list: [{ id: '../x' }], details: {} }), '/r'), /a list entry without a numeric id/);
  await assert.rejects(readRulesetDetails(rulesetGet({ list: [{}], details: {} }), '/r'), /a list entry without a numeric id/);
});
