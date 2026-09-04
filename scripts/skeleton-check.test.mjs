import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  classify, hasAnyKindMarker, findRepos, SKELETON_FILES,
  ARTICLE_PRIVATE_MARKER, ARTICLE_CHANGEREQUEST_MARKER, PRIVATE_WORKING_MARKER,
  TEMPLATE_DIR_FOR_KIND,
} from './lib/skeleton-check-lib.mjs';

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

test('classify: the .private-working marker alone (no .github/workflows at all) classifies "private-working" -- the real Chotmeter shape, RED against the pre-fix classify() (UMB-062)', () => {
  const root = makeScratch();
  const dir = path.join(root, 'r');
  write(path.join(dir, PRIVATE_WORKING_MARKER), '');
  write(path.join(dir, 'LICENSE'), 'x');
  assert.equal(classify(dir), 'private-working');
  fs.rmSync(root, { recursive: true, force: true });
});

test('classify: the private-working marker takes precedence even if gate.yml is also present', () => {
  const root = makeScratch();
  const dir = path.join(root, 'r');
  write(path.join(dir, PRIVATE_WORKING_MARKER), '');
  write(path.join(dir, '.github/workflows/gate.yml'), 'x');
  assert.equal(classify(dir), 'private-working');
  fs.rmSync(root, { recursive: true, force: true });
});

test('classify: a repo WITHOUT the marker classifies exactly as before -- gate.yml alone is still enough, the marker is additive not a replacement', () => {
  const root = makeScratch();
  const dir = path.join(root, 'r');
  write(path.join(dir, '.github/workflows/gate.yml'), 'x');
  assert.equal(classify(dir), 'private-working');
  fs.rmSync(root, { recursive: true, force: true });
});

test('hasAnyKindMarker: the private-working marker alone (no skeleton file) is a marker', () => {
  const root = makeScratch();
  const dir = path.join(root, 'r');
  write(path.join(dir, PRIVATE_WORKING_MARKER), '');
  assert.equal(hasAnyKindMarker(dir), true);
  fs.rmSync(root, { recursive: true, force: true });
});

test('findRepos: the real Chotmeter shape (marker + .git + LICENSE, no .github/workflows) is enumerated and classified "private-working" (UMB-062)', () => {
  const root = makeScratch();
  const zone = 'LLMWorks';
  const dir = path.join(root, zone, 'ChotmeterLike');
  write(path.join(dir, '.git', 'config'), '');
  write(path.join(dir, PRIVATE_WORKING_MARKER), '');
  write(path.join(dir, 'LICENSE'), 'x');
  const repos = findRepos(root, [zone]);
  assert.equal(repos.length, 1);
  assert.equal(repos[0].kind, 'private-working');
  assert.equal(repos[0].hasSignal, true);
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

// --- classify: article (private) (UMB-055 item 1, main's Option-A-amended ruling) ---

test('classify: the .article-private marker alone (no .gitbook.yaml) classifies "article (private)" -- the Chot-shaped fixture, RED against the pre-fix classify()', () => {
  const root = makeScratch();
  const dir = path.join(root, 'r');
  write(path.join(dir, ARTICLE_PRIVATE_MARKER), '');
  write(path.join(dir, 'LICENSE'), 'x');
  assert.equal(classify(dir), 'article (private)');
  fs.rmSync(root, { recursive: true, force: true });
});

test('classify: the marker takes precedence even if .gitbook.yaml is also present', () => {
  const root = makeScratch();
  const dir = path.join(root, 'r');
  write(path.join(dir, ARTICLE_PRIVATE_MARKER), '');
  write(path.join(dir, '.gitbook.yaml'), 'x');
  assert.equal(classify(dir), 'article (private)');
  fs.rmSync(root, { recursive: true, force: true });
});

test('classify: a folder WITHOUT the marker classifies exactly as before -- .gitbook.yaml alone is still plain "article"', () => {
  const root = makeScratch();
  const dir = path.join(root, 'r');
  write(path.join(dir, '.gitbook.yaml'), 'x');
  assert.equal(classify(dir), 'article');
  fs.rmSync(root, { recursive: true, force: true });
});

test('classify: a folder without the marker and without any signature stays UNCLASSIFIED (null), exactly as before', () => {
  const root = makeScratch();
  const dir = path.join(root, 'r');
  write(path.join(dir, 'CHANGELOG.md'), 'x');
  assert.equal(classify(dir), null);
  fs.rmSync(root, { recursive: true, force: true });
});

// --- UMB-060 item 1: article (change-request) ---

test('classify: the .article-changerequest marker alone (no .git, no .gitbook.yaml) classifies "article (change-request)" -- the real GachaRateDesignDatum shape, RED against the pre-fix classify()', () => {
  const root = makeScratch();
  const dir = path.join(root, 'r');
  write(path.join(dir, ARTICLE_CHANGEREQUEST_MARKER), '');
  write(path.join(dir, 'LICENSE'), 'x');
  write(path.join(dir, 'CHANGELOG.md'), 'x');
  assert.equal(classify(dir), 'article (change-request)');
  fs.rmSync(root, { recursive: true, force: true });
});

test('classify: the change-request marker takes precedence even if .gitbook.yaml is also present', () => {
  const root = makeScratch();
  const dir = path.join(root, 'r');
  write(path.join(dir, ARTICLE_CHANGEREQUEST_MARKER), '');
  write(path.join(dir, '.gitbook.yaml'), 'x');
  assert.equal(classify(dir), 'article (change-request)');
  fs.rmSync(root, { recursive: true, force: true });
});

test('classify: the private marker and the change-request marker are checked independently -- private wins if (implausibly) both are present, since it is checked first', () => {
  const root = makeScratch();
  const dir = path.join(root, 'r');
  write(path.join(dir, ARTICLE_PRIVATE_MARKER), '');
  write(path.join(dir, ARTICLE_CHANGEREQUEST_MARKER), '');
  assert.equal(classify(dir), 'article (private)');
  fs.rmSync(root, { recursive: true, force: true });
});

test('SKELETON_FILES["article (change-request)"] keeps CONTRIBUTING.md + workflows (unlike article (private), which drops CONTRIBUTING) -- only .gitbook.yaml is dropped', () => {
  const files = SKELETON_FILES['article (change-request)'];
  assert.ok(files.includes('LICENSE'));
  assert.ok(files.includes('CONTRIBUTING.md'));
  assert.ok(files.includes('CHANGELOG.md'));
  assert.ok(files.includes('.github/workflows/check.yml'));
  assert.ok(files.includes('.github/workflows/watch-sources.yml'));
  assert.ok(!files.includes('.gitbook.yaml'));
});

test('TEMPLATE_DIR_FOR_KIND: "article (change-request)" reads the same template directory as public "article"', () => {
  assert.equal(TEMPLATE_DIR_FOR_KIND['article (change-request)'], 'article');
});

test('findRepos: the real GachaRateDesignDatum shape (marker + LICENSE + CHANGELOG.md, no .git) is enumerated and classified "article (change-request)"', () => {
  const root = makeScratch();
  const zone = 'Articles';
  const dir = path.join(root, zone, 'GachaLike');
  write(path.join(dir, ARTICLE_CHANGEREQUEST_MARKER), '');
  write(path.join(dir, 'LICENSE'), 'x');
  write(path.join(dir, 'CHANGELOG.md'), 'x');
  const repos = findRepos(root, [zone]);
  assert.equal(repos.length, 1);
  assert.equal(repos[0].kind, 'article (change-request)');
  assert.equal(repos[0].hasSignal, true);
  fs.rmSync(root, { recursive: true, force: true });
});

test('hasAnyKindMarker: the change-request marker alone (no skeleton file) is a marker', () => {
  const root = makeScratch();
  const dir = path.join(root, 'r');
  write(path.join(dir, ARTICLE_CHANGEREQUEST_MARKER), '');
  assert.equal(hasAnyKindMarker(dir), true);
  fs.rmSync(root, { recursive: true, force: true });
});

test('SKELETON_FILES["article (private)"] drops CONTRIBUTING.md and .gitbook.yaml, keeps LICENSE/CHANGELOG/workflows', () => {
  const files = SKELETON_FILES['article (private)'];
  assert.equal(files.includes('CONTRIBUTING.md'), false);
  assert.equal(files.includes('.gitbook.yaml'), false);
  assert.equal(files.includes('LICENSE'), true);
  assert.equal(files.includes('CHANGELOG.md'), true);
  assert.equal(files.includes('.github/workflows/check.yml'), true);
  assert.equal(files.includes('.github/workflows/watch-sources.yml'), true);
});

test('TEMPLATE_DIR_FOR_KIND: "article (private)" reads the same template directory as public "article"', () => {
  assert.equal(TEMPLATE_DIR_FOR_KIND['article (private)'], 'article');
  assert.equal(TEMPLATE_DIR_FOR_KIND.article, 'article');
});

test('findRepos: a private-article-shaped repo (marker + .git) is enumerated and classified "article (private)"', () => {
  const root = makeScratch();
  const zone = 'Articles';
  const dir = path.join(root, zone, 'ChotLike');
  write(path.join(dir, '.git', 'config'), '');
  write(path.join(dir, ARTICLE_PRIVATE_MARKER), '');
  write(path.join(dir, 'LICENSE'), 'x');
  const repos = findRepos(root, [zone]);
  assert.equal(repos.length, 1);
  assert.equal(repos[0].kind, 'article (private)');
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

test('findRepos: a folder with neither .git nor any kind marker is STILL RETURNED, with hasSignal=false -- UMB-060 item 2, the silent-skip fix (RED against the pre-fix findRepos, which dropped it entirely)', () => {
  const root = makeScratch();
  const zone = 'Zone';
  write(path.join(root, zone, 'NotARepo', 'README.md'), 'x');
  const repos = findRepos(root, [zone]);
  assert.equal(repos.length, 1);
  assert.equal(repos[0].name, 'NotARepo');
  assert.equal(repos[0].hasSignal, false);
  assert.equal(repos[0].kind, null);
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

test('SKELETON_FILES: CHANGELOG.md is absent from published-code/private-working (the property the Gacha fixture relies on -- a .git-less folder with only a CHANGELOG.md must not be confusable with either of those two kinds)', () => {
  assert.equal(SKELETON_FILES['published-code'].includes('CHANGELOG.md'), false);
  assert.equal(SKELETON_FILES['private-working'].includes('CHANGELOG.md'), false);
  // Both article variants legitimately carry it -- that is fine and expected; the
  // Gacha exhibit only needs CHANGELOG.md to be OUTSIDE the two non-article kinds.
  assert.equal(SKELETON_FILES.article.includes('CHANGELOG.md'), true);
  assert.equal(SKELETON_FILES['article (private)'].includes('CHANGELOG.md'), true);
});
