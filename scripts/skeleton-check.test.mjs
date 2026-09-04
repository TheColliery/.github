import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { classify, hasAnyKindMarker, findRepos, SKELETON_FILES } from './lib/skeleton-check-lib.mjs';

// A scratch zones-root, one fixture per test to keep each hermetic. Every fixture is
// removed after its own test — nothing here touches the real umbrella tree.
function makeScratch() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skeleton-check-test-'));
  return root;
}

function write(p, content = '') {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

// --- classify ---

test('classify: .gitbook.yaml alone means article', () => {
  const root = makeScratch();
  const dir = path.join(root, 'r');
  write(path.join(dir, '.gitbook.yaml'), 'x');
  assert.equal(classify(dir), 'article');
  fs.rmSync(root, { recursive: true, force: true });
});

test('classify: gate.yml without ci.yml means private-working', () => {
  const root = makeScratch();
  const dir = path.join(root, 'r');
  write(path.join(dir, '.github/workflows/gate.yml'), 'x');
  assert.equal(classify(dir), 'private-working');
  fs.rmSync(root, { recursive: true, force: true });
});

test('classify: ci.yml + codeql.yml means published-code', () => {
  const root = makeScratch();
  const dir = path.join(root, 'r');
  write(path.join(dir, '.github/workflows/ci.yml'), 'x');
  write(path.join(dir, '.github/workflows/codeql.yml'), 'x');
  assert.equal(classify(dir), 'published-code');
  fs.rmSync(root, { recursive: true, force: true });
});

test('classify: a folder with none of the three signatures is UNCLASSIFIED (null)', () => {
  const root = makeScratch();
  const dir = path.join(root, 'r');
  write(path.join(dir, 'CHANGELOG.md'), 'x');
  assert.equal(classify(dir), null);
  fs.rmSync(root, { recursive: true, force: true });
});

// --- hasAnyKindMarker ---

test('hasAnyKindMarker: a lone CHANGELOG.md (article\'s own file) is a marker', () => {
  const root = makeScratch();
  const dir = path.join(root, 'r');
  write(path.join(dir, 'CHANGELOG.md'), 'x');
  assert.equal(hasAnyKindMarker(dir), true);
  fs.rmSync(root, { recursive: true, force: true });
});

test('hasAnyKindMarker: a folder with none of any kind\'s skeleton files is false', () => {
  const root = makeScratch();
  const dir = path.join(root, 'r');
  write(path.join(dir, 'README.md'), 'x'); // not in any SKELETON_FILES list
  write(path.join(dir, 'PUBLISHING.md'), 'x');
  assert.equal(hasAnyKindMarker(dir), false);
  fs.rmSync(root, { recursive: true, force: true });
});

// --- findRepos (UMB-054 item 1's red-first proof) ---

test('findRepos: a real git repo with no kind marker is still enumerated (UNCLASSIFIED)', () => {
  const root = makeScratch();
  const zone = 'Zone';
  write(path.join(root, zone, 'GitOnly', '.git', 'config'), '');
  const repos = findRepos(root, [zone]);
  assert.equal(repos.length, 1);
  assert.equal(repos[0].name, 'GitOnly');
  assert.equal(repos[0].kind, null);
  fs.rmSync(root, { recursive: true, force: true });
});

test('findRepos: a .git-less folder carrying a kind marker file IS enumerated -- the UMB-054 item 1 fix', () => {
  // Mirrors GachaRateDesignDatum exactly: no .git, no article classify() signature
  // (.gitbook.yaml absent), but a root CHANGELOG.md -- one of article's own skeleton
  // files. Under the OLD `.git`-only gate this folder was silently skipped; this test
  // is RED against that old logic and GREEN against findRepos() above.
  const root = makeScratch();
  const zone = 'Articles';
  const dir = path.join(root, zone, 'GachaLike');
  write(path.join(dir, 'CHANGELOG.md'), 'x');
  write(path.join(dir, 'PUBLISHING.md'), 'x'); // present on the real repo, not a marker itself
  const repos = findRepos(root, [zone]);
  assert.equal(repos.length, 1, 'the .git-less folder must appear in the enumeration');
  assert.equal(repos[0].name, 'GachaLike');
  assert.equal(repos[0].kind, null, 'no classify() signature fires -- UNCLASSIFIED is honest, not a silent drop');
  fs.rmSync(root, { recursive: true, force: true });
});

test('findRepos: a folder with neither .git nor any kind marker is correctly excluded', () => {
  const root = makeScratch();
  const zone = 'Zone';
  write(path.join(root, zone, 'NotARepo', 'README.md'), 'x');
  const repos = findRepos(root, [zone]);
  assert.equal(repos.length, 0);
  fs.rmSync(root, { recursive: true, force: true });
});

test('findRepos: a proper article repo (.git + .gitbook.yaml) is enumerated and classified', () => {
  const root = makeScratch();
  const zone = 'Articles';
  const dir = path.join(root, zone, 'RealArticle');
  write(path.join(dir, '.git', 'config'), '');
  write(path.join(dir, '.gitbook.yaml'), 'x');
  const repos = findRepos(root, [zone]);
  assert.equal(repos.length, 1);
  assert.equal(repos[0].kind, 'article');
  fs.rmSync(root, { recursive: true, force: true });
});

test('findRepos: a missing zone directory is skipped without error', () => {
  const root = makeScratch();
  const repos = findRepos(root, ['DoesNotExist']);
  assert.equal(repos.length, 0);
  fs.rmSync(root, { recursive: true, force: true });
});

test('SKELETON_FILES: CHANGELOG.md is article-only among the three kinds (the property the Gacha fixture relies on)', () => {
  const withChangelog = Object.entries(SKELETON_FILES).filter(([, files]) => files.includes('CHANGELOG.md'));
  assert.deepEqual(withChangelog.map(([k]) => k), ['article']);
});
