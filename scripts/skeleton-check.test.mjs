import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  classify, hasAnyKindMarker, findRepos, SKELETON_FILES,
  detailsKind, detailsVerdict, formatDetailsTable,
  ARTICLE_PRIVATE_MARKER, ARTICLE_CHANGEREQUEST_MARKER, PRIVATE_WORKING_MARKER,
  TEMPLATE_DIR_FOR_KIND, parseGithubOrigin, matchesWithPlaceholders,
  ORG_DEFAULT_FILES, liveFileVerdict,
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

// --- UMB-177: the org-default community files ---

test('SKELETON_FILES: the PR template is skeleton-owned by published-code and the public article kinds, never by the private kinds', () => {
  const pr = '.github/PULL_REQUEST_TEMPLATE.md';
  for (const kind of ['published-code', 'article', 'article (change-request)']) assert.ok(SKELETON_FILES[kind].includes(pr), kind);
  for (const kind of ['private-working', 'article (private)']) assert.ok(!SKELETON_FILES[kind].includes(pr), kind);
});

test('liveFileVerdict: a live room WITHOUT an org-default file inherits it (not a gap); one WITH a different file is a NAMED divergence; every other file keeps its plain verdict', () => {
  assert.deepEqual([...ORG_DEFAULT_FILES].sort(), ['.github/PULL_REQUEST_TEMPLATE.md', 'CODE_OF_CONDUCT.md']);
  assert.match(liveFileVerdict('CODE_OF_CONDUCT.md', 'ABSENT'), /inherits the org default/);
  assert.match(liveFileVerdict('.github/PULL_REQUEST_TEMPLATE.md', 'ABSENT'), /inherits the org default/);
  assert.match(liveFileVerdict('CODE_OF_CONDUCT.md', 'DIFFERS (template 5L vs live 9L)'), /NAMED DIVERGENCE/);
  assert.equal(liveFileVerdict('CODE_OF_CONDUCT.md', 'identical'), 'identical');
  assert.equal(liveFileVerdict('SECURITY.md', 'ABSENT'), 'ABSENT'); // a room ships its own SECURITY.md: absent stays a finding
  assert.equal(liveFileVerdict('CONTRIBUTING.md', 'ABSENT'), 'ABSENT');
  assert.match(liveFileVerdict('SECURITY.md', 'DIFFERS (template 3L vs live 4L)'), /^DIFFERS/);
});

// --- parseGithubOrigin (code-scanning #6: .git/config data must not steer the API path) ---

test('parseGithubOrigin: the https, .git-suffixed, ssh and credentialed forms all parse', () => {
  assert.deepEqual(parseGithubOrigin('https://github.com/TheColliery/CoalMine'), { owner: 'TheColliery', repo: 'CoalMine' });
  assert.deepEqual(parseGithubOrigin('https://github.com/TheColliery/CoalMine.git'), { owner: 'TheColliery', repo: 'CoalMine' });
  assert.deepEqual(parseGithubOrigin('git@github.com:HetCreep/CoalMine.git'), { owner: 'HetCreep', repo: 'CoalMine' });
  assert.deepEqual(parseGithubOrigin('https://user:tok@github.com/Some-Org/a_b-c.git'), { owner: 'Some-Org', repo: 'a_b-c' });
});

test('parseGithubOrigin: an owner or repo that is a dot-segment (literal or percent-encoded) is REFUSED -- RED against the permissive [^/]+ regex', () => {
  for (const evil of [
    'https://github.com/%2e%2e/user',
    'https://github.com/%2E%2E/user',
    'https://github.com/../user',
    'https://github.com/TheColliery/%2e%2e',
    'https://github.com/TheColliery/..',
  ]) {
    assert.equal(parseGithubOrigin(evil), null, evil);
  }
});

test('parseGithubOrigin: query/fragment/space/percent smuggling in owner or repo is REFUSED', () => {
  for (const evil of [
    'https://github.com/own?x=1/repo',
    'https://github.com/owner/repo?x=1',
    'https://github.com/owner/repo#frag',
    'https://github.com/own%2Fer/repo',
    'https://github.com/owner/re po',
  ]) {
    assert.equal(parseGithubOrigin(evil), null, evil);
  }
});

test('parseGithubOrigin: a dotted repo name stays a SKIP (null), unchanged from the old [^/.] rule', () => {
  assert.equal(parseGithubOrigin('https://github.com/TheColliery/.github'), null);
  assert.equal(parseGithubOrigin('https://github.com/owner/foo.bar.git'), null);
});

// --- matchesWithPlaceholders (UMB-123): a TEMPLATE repo's file is the source with its
// {{TOKENS}} filled or left; only a placeholder slot may differ, never the text around it ---

const NOTICE_SOURCE = '{{REPO_NAME}}\nCopyright {{YEAR}} {{COPYRIGHT_HOLDER}}\n\nThis product is part of the TheColliery series (https://github.com/TheColliery)\nand is licensed under {{LICENSE_BADGE}}.\n';

test('matchesWithPlaceholders: the real NOTICE shape -- one token slot filled with prose, the rest untouched -- matches', () => {
  const live = '{{REPO_NAME}}\nCopyright {{YEAR}} {{COPYRIGHT_HOLDER}}\n\nThis product is part of the TheColliery series (https://github.com/TheColliery)\nand is licensed under the Apache License, Version 2.0.\n';
  assert.equal(matchesWithPlaceholders(NOTICE_SOURCE, live), true);
});

test('matchesWithPlaceholders: every slot filled (a scaffolded file) matches too', () => {
  const live = 'CoalX\nCopyright 2026 HetCreep\n\nThis product is part of the TheColliery series (https://github.com/TheColliery)\nand is licensed under Apache-2.0.\n';
  assert.equal(matchesWithPlaceholders(NOTICE_SOURCE, live), true);
});

test('matchesWithPlaceholders: a change in the text AROUND a slot is real drift -- RED against a compare that ignored the whole line', () => {
  const live = 'CoalX\nCopyright 2026 HetCreep\n\nThis product belongs to somebody else (https://example.com)\nand is licensed under Apache-2.0.\n';
  assert.equal(matchesWithPlaceholders(NOTICE_SOURCE, live), false);
});

test('matchesWithPlaceholders: a slot cannot swallow extra lines, and cannot be empty', () => {
  const extra = 'CoalX\nCopyright 2026 HetCreep\nINJECTED LINE\n\nThis product is part of the TheColliery series (https://github.com/TheColliery)\nand is licensed under Apache-2.0.\n';
  assert.equal(matchesWithPlaceholders(NOTICE_SOURCE, extra), false);
  const empty = '\nCopyright 2026 HetCreep\n\nThis product is part of the TheColliery series (https://github.com/TheColliery)\nand is licensed under Apache-2.0.\n';
  assert.equal(matchesWithPlaceholders(NOTICE_SOURCE, empty), false);
});

test('matchesWithPlaceholders: a template with no tokens is an exact compare (CRLF-normalized), never a wildcard', () => {
  assert.equal(matchesWithPlaceholders('a\nb\n', 'a\r\nb\r\n'), true);
  assert.equal(matchesWithPlaceholders('a\nb\n', 'a\nc\n'), false);
});

test('matchesWithPlaceholders: regex metacharacters in the template text are literal, not patterns', () => {
  assert.equal(matchesWithPlaceholders('cost (a+b)* {{X}}.\n', 'cost (a+b)* 5.\n'), true);
  assert.equal(matchesWithPlaceholders('cost (a+b)* {{X}}.\n', 'cost aab 5.\n'), false);
});

// ---------------------------------------------------------------------------------
// UMB-128: `--details` -- the REPO DETAILS surface (About description · website · topics)
// measured for every org repo against DOC-PATTERN.md §"Repo details". Pure logic in the lib;
// the CLI is spawned below with a fetch stub and must never send a write.

const BASE = ['claude-code', 'claude', 'ai-agents', 'agent-skills', 'ai-coding', 'developer-tools'];
const LANDING = 'https://github.com/TheColliery';

// A repo object as `GET /orgs/{org}/repos` returns it -- only the fields the instrument reads.
function repoObj(name, over = {}) {
  return { name, private: false, archived: false, is_template: false, description: 'A real description.', homepage: LANDING, topics: [...BASE, 'extra'], ...over };
}

test('detailsKind: a public Coal* repo is a room; any other public repo is public-other', () => {
  assert.equal(detailsKind(repoObj('CoalMine')), 'room');
  assert.equal(detailsKind(repoObj('.github')), 'public-other');
  assert.equal(detailsKind(repoObj('Kolwen')), 'public-other');
});

test('detailsKind: archived, template (either visibility) and private come out BEFORE room/public-other', () => {
  assert.equal(detailsKind(repoObj('CoalOld', { archived: true })), 'archived');
  assert.equal(detailsKind(repoObj('template-published-code', { is_template: true })), 'template');
  assert.equal(detailsKind(repoObj('template-private-working', { is_template: true, private: true })), 'template');
  assert.equal(detailsKind(repoObj('CoalGob', { private: true })), 'private', 'a private Coal* repo is not a public room');
  assert.equal(detailsKind(repoObj('Bankfire', { private: true })), 'private');
});

test('detailsVerdict (room): the full floor -- description, website, all six base topics -- is OK', () => {
  const v = detailsVerdict(repoObj('CoalMine'));
  assert.equal(v.status, 'OK');
  assert.deepEqual(v.reasons, []);
});

test('detailsVerdict (room): each missing base topic is named -- and only the missing ones', () => {
  const v = detailsVerdict(repoObj('CoalWash', { topics: ['claude-code', 'ai-agents', 'agent-skills', 'developer-tools', 'memory-management'] }));
  assert.equal(v.status, 'FAIL');
  assert.equal(v.reasons.length, 1);
  assert.match(v.reasons[0], /topics missing the base floor: claude, ai-coding$/);
});

test('detailsVerdict (room): the OLD base token `skills` does not satisfy `agent-skills` (DOC-PATTERN amended 2026-07-25)', () => {
  const v = detailsVerdict(repoObj('CoalMine', { topics: ['claude-code', 'claude', 'ai-agents', 'skills', 'ai-coding', 'developer-tools'] }));
  assert.equal(v.status, 'FAIL');
  assert.match(v.reasons[0], /missing the base floor: agent-skills$/);
});

test('detailsVerdict: an empty or whitespace-only description FAILS, for a room and for public-other', () => {
  for (const name of ['CoalMine', 'Kolwen']) {
    for (const description of [null, '', '   ']) {
      const v = detailsVerdict(repoObj(name, { description }));
      assert.equal(v.status, 'FAIL', `${name} ${JSON.stringify(description)}`);
      assert.ok(v.reasons.some((r) => /description is empty/.test(r)), name);
    }
  }
});

test('detailsVerdict: an empty website FAILS; a website that is NOT the org landing is fine (a better front door is allowed)', () => {
  const none = detailsVerdict(repoObj('CoalMine', { homepage: '' }));
  assert.equal(none.status, 'FAIL');
  assert.ok(none.reasons.some((r) => /website is empty/.test(r)));
  assert.equal(detailsVerdict(repoObj('.github', { homepage: 'https://thecolliery.org/docs' })).status, 'OK');
  assert.equal(detailsVerdict(repoObj('CoalMine', { homepage: null })).status, 'FAIL');
});

test('detailsVerdict: a website that names a GitBook docs host FAILS (the stable link is https://thecolliery.org/docs); the stable link and the org landing are fine (UMB-178 step 4, RED before the rule)', () => {
  for (const homepage of ['https://thecolliery.gitbook.io/thecolliery-docs/', 'https://docs.thecolliery.org/', 'http://DOCS.thecolliery.org/anything']) {
    const v = detailsVerdict(repoObj('.github', { homepage }));
    assert.equal(v.status, 'FAIL', homepage);
    assert.ok(v.reasons.some((r) => /GitBook host/.test(r) && /thecolliery\.org\/docs/.test(r)), homepage + ': ' + v.reasons.join(' | '));
  }
  for (const homepage of ['https://thecolliery.org/docs', 'https://github.com/TheColliery', 'https://kolwen.com/', 'https://docs.thecolliery.org.example.com/']) {
    assert.equal(detailsVerdict(repoObj('.github', { homepage })).status, 'OK', homepage);
  }
});

test('detailsVerdict (public-other, the Kolwen shape 2026-09-20: no topics, no website): FAILS on both, and NEVER demands the Coal* skill-suite base set', () => {
  const v = detailsVerdict(repoObj('Kolwen', { topics: [], homepage: '' }));
  assert.equal(v.status, 'FAIL');
  assert.equal(v.reasons.length, 2);
  assert.ok(v.reasons.some((r) => /no topics/.test(r)));
  assert.ok(v.reasons.some((r) => /website is empty/.test(r)));
  assert.ok(!v.reasons.some((r) => /base floor/.test(r)), 'the base set is the skill-suite floor -- demanding agent-skills of a model repo would be an off-target topic');
  assert.equal(detailsVerdict(repoObj('Kolwen', { topics: ['llm'], homepage: 'https://kolwen.com' })).status, 'OK');
});

test('detailsVerdict: template, private and archived repos are N/A even when EMPTY -- no floor is invented for a kind DOC-PATTERN does not define', () => {
  const empty = { description: null, homepage: null, topics: [] };
  for (const [kind, over] of [['template', { is_template: true }], ['private', { private: true }], ['archived', { archived: true }]]) {
    const v = detailsVerdict(repoObj('X', { ...over, ...empty }));
    assert.equal(v.status, 'N/A', kind);
    assert.equal(v.kind, kind);
    assert.equal(v.reasons.length, 1, kind);
  }
});

// The org as read at the API 2026-09-20 (`GET /orgs/TheColliery/repos`, 16 repos), reduced to
// the fields the instrument reads. Rooms carry the base set; Kolwen has no topics / website.
function liveOrg() {
  const room = (name) => repoObj(name, { topics: [...BASE, 'code-quality'] });
  return [
    repoObj('.github', { homepage: 'https://thecolliery.org/docs' }),
    repoObj('Bankfire', { private: true, homepage: '', topics: [] }),
    repoObj('Bankfire-gate', { private: true, homepage: '', topics: [] }),
    repoObj('Chotmeter', { private: true, homepage: '', topics: [] }),
    repoObj('ChotUnitDatum', { private: true, homepage: '', topics: [] }),
    room('CoalBoard'), room('CoalFace'), room('CoalHearth'), room('CoalLedger'), room('CoalMine'), room('CoalTipple'), room('CoalWash'),
    repoObj('Kolwen', { homepage: '', topics: [] }),
    repoObj('template-article', { is_template: true, homepage: '', topics: [] }),
    repoObj('template-private-working', { is_template: true, private: true, homepage: '', topics: [] }),
    repoObj('template-published-code', { is_template: true, homepage: '', topics: [] }),
  ];
}

test('formatDetailsTable: the live 16-repo org -> one row per repo, exactly the two Kolwen FAIL lines, and reconciled counts', () => {
  const org = liveOrg();
  const { table, fails, counts } = formatDetailsTable(org);
  assert.equal(org.length, 16);
  for (const r of org) assert.ok(table.some((l) => l.startsWith(r.name.padEnd(24))), `a row for ${r.name}`);
  assert.deepEqual(fails, [
    'FAIL Kolwen (public-other): no topics -- DOC-PATTERN §Repo details: every specific a searcher would type',
    'FAIL Kolwen (public-other): website is empty -- DOC-PATTERN §Repo details: the org landing unless the tool has a better front door',
  ]);
  assert.deepEqual(counts, { ok: 8, fail: 1, na: 7 }, 'OK = 7 rooms + .github; FAIL = Kolwen; N/A = 4 private + 3 templates');
  assert.equal(counts.ok + counts.fail + counts.na, org.length);
});

test('formatDetailsTable: a long description is truncated in the table (never the verdict) and the input is not mutated', () => {
  const long = 'x'.repeat(300);
  const org = [repoObj('CoalMine', { description: long })];
  const before = JSON.stringify(org);
  const { table } = formatDetailsTable(org);
  const row = table.find((l) => l.startsWith('CoalMine'));
  assert.ok(row.length < 200, row.length);
  assert.ok(row.includes('...'));
  assert.equal(JSON.stringify(org), before);
});

// ---- the CLI, spawned with a fetch stub preloaded (NODE_OPTIONS=--import) ---------------

const SKELETON_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'skeleton-check.mjs');
const DETAILS_STUB = `
import fs from 'node:fs';
const S = JSON.parse(process.env.STUB_STATE);
globalThis.fetch = async (url, init = {}) => {
  const p = String(url).replace('https://api.github.com', '');
  fs.appendFileSync(process.env.STUB_LOG, JSON.stringify({ method: init.method || 'GET', path: p }) + '\\n');
  if (p.startsWith('/orgs/TheColliery/repos')) {
    const page = Number(new URL(String(url)).searchParams.get('page') || '1');
    const headers = page < S.pages.length ? { link: '<https://api.github.com/orgs/TheColliery/repos?per_page=100&type=all&page=' + (page + 1) + '>; rel="next"' } : {};
    return new Response(JSON.stringify(S.pages[page - 1]), { status: S.status || 200, headers });
  }
  return new Response('{}', { status: 404 });
};
`;

function runDetails(pages, { token = 'stub-token', status } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'details-test-'));
  const stubFile = path.join(dir, 'stub.mjs');
  const logFile = path.join(dir, 'calls.jsonl');
  fs.writeFileSync(stubFile, DETAILS_STUB);
  fs.writeFileSync(logFile, '');
  const env = { ...process.env, NODE_OPTIONS: `--import=${pathToFileURL(stubFile).href}`, STUB_LOG: logFile, STUB_STATE: JSON.stringify({ pages, status }) };
  if (token === null) delete env.GITHUB_TOKEN; else env.GITHUB_TOKEN = token;
  const res = spawnSync(process.execPath, [SKELETON_SCRIPT, '--details'], { encoding: 'utf8', env });
  const calls = fs.readFileSync(logFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  fs.rmSync(dir, { recursive: true, force: true });
  return { res, calls };
}

test('skeleton-check.mjs --details (the live org shape): prints a row per repo, the Kolwen FAIL lines, exits 1 -- and sends ONLY reads (READ-ONLY rail)', () => {
  const { res, calls } = runDetails([liveOrg()]);
  assert.equal(res.status, 1, res.stdout + res.stderr);
  assert.match(res.stdout, /FAIL Kolwen \(public-other\): no topics/);
  assert.match(res.stdout, /FAIL Kolwen \(public-other\): website is empty/);
  assert.match(res.stdout, /16 repos: 8 OK · 1 FAIL · 7 N\/A/);
  assert.ok(calls.length >= 1);
  assert.deepEqual(calls.filter((c) => c.method !== 'GET'), [], '--details must never write: no description, website, topic or visibility');
});

test('skeleton-check.mjs --details follows the Link: rel="next" header -- a repo on page 2 is judged, not silently dropped', () => {
  const org = liveOrg();
  const { res, calls } = runDetails([org.slice(0, 8), org.slice(8)]);
  assert.match(res.stdout, /16 repos:/, res.stdout + res.stderr);
  assert.match(res.stdout, /Kolwen/);
  assert.equal(calls.filter((c) => c.path.startsWith('/orgs/TheColliery/repos')).length, 2);
});

test('skeleton-check.mjs --details with every repo at the floor: exit 0', () => {
  const { res } = runDetails([[repoObj('CoalMine'), repoObj('template-x', { is_template: true, topics: [] })]]);
  assert.equal(res.status, 0, res.stdout + res.stderr);
  assert.match(res.stdout, /2 repos: 1 OK · 0 FAIL · 1 N\/A/);
});

test('skeleton-check.mjs --details without GITHUB_TOKEN: FAILS loudly (the private repos would silently vanish from the table) and makes no call', () => {
  const { res, calls } = runDetails([liveOrg()], { token: null });
  assert.equal(res.status, 1);
  assert.match(res.stderr + res.stdout, /GITHUB_TOKEN/);
  assert.deepEqual(calls, []);
});

test('skeleton-check.mjs --details when the list call fails: exit 1 naming the HTTP status, never an empty "clean" table', () => {
  const { res } = runDetails([[]], { status: 500 });
  assert.equal(res.status, 1);
  assert.match(res.stderr + res.stdout, /HTTP 500/);
  assert.doesNotMatch(res.stdout, /0 repos: 0 OK/);
});

// UMB-112 row 22: diffSettings never looked at the repository GET's status, so a 403/404/5xx made every
// repoPatch/secretScanning line read as ordinary DRIFT (exit 0) instead of a failed read.
function scratchUmbrellaWithRoom() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skel-settings-'));
  const SRC = path.dirname(SKELETON_SCRIPT);
  const gh = path.join(root, '.github');
  fs.mkdirSync(path.join(gh, 'scripts', 'lib'), { recursive: true });
  fs.copyFileSync(SKELETON_SCRIPT, path.join(gh, 'scripts', 'skeleton-check.mjs'));
  for (const f of fs.readdirSync(path.join(SRC, 'lib'))) fs.copyFileSync(path.join(SRC, 'lib', f), path.join(gh, 'scripts', 'lib', f));
  fs.mkdirSync(path.join(gh, 'templates'), { recursive: true });
  fs.copyFileSync(path.join(SRC, '..', 'templates', 'repo-settings.published-code.json'), path.join(gh, 'templates', 'repo-settings.published-code.json'));
  const room = path.join(root, 'CoalWorks', 'Demo');
  write(path.join(room, '.git', 'config'), '[remote "origin"]\n\turl = https://github.com/TheColliery/Demo.git\n');
  write(path.join(room, '.github', 'workflows', 'ci.yml'), 'x');
  write(path.join(room, '.github', 'workflows', 'codeql.yml'), 'x');
  return root;
}
function runSettingsWithStubStatus(status) {
  const root = scratchUmbrellaWithRoom();
  const stub = path.join(root, 'stub.mjs');
  fs.writeFileSync(stub, "globalThis.fetch = async () => new Response('{}', { status: " + status + " });\n");
  const res = spawnSync(process.execPath, [path.join(root, '.github', 'scripts', 'skeleton-check.mjs'), '--settings'], {
    encoding: 'utf8',
    env: { ...process.env, GITHUB_TOKEN: 'stub-token', NODE_OPTIONS: '--import=' + pathToFileURL(stub).href },
  });
  fs.rmSync(root, { recursive: true, force: true });
  return res;
}

test('skeleton-check.mjs --settings: a non-2xx repository GET is a FAIL naming the path and status, exit 1 -- never ordinary drift (UMB-112 row 22)', () => {
  const res = runSettingsWithStubStatus(403);
  assert.equal(res.status, 1, res.stdout + res.stderr);
  assert.match(res.stdout, /\[settings\]: FAIL \(GET \/repos\/TheColliery\/Demo -> HTTP 403/);
  assert.doesNotMatch(res.stdout, /repoPatch\.[A-Za-z_]+: DIFFERS/, 'no per-field verdict may be printed off a failed read');
});

test('skeleton-check.mjs --settings: a 200 repository GET still prints the per-field verdicts and no settings FAIL (UMB-112 row 22 control)', () => {
  const res = runSettingsWithStubStatus(200);
  assert.doesNotMatch(res.stdout, /\[settings\]: FAIL/, res.stdout);
  assert.match(res.stdout, /repoPatch\.[A-Za-z_]+: DIFFERS/);
});
