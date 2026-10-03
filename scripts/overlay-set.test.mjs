// UMB-348 (a): an overlay is adopted as ONE set. The set is derived from the workflow (overlay-set.mjs), printed with blob ids, and
// skeleton-check judges every live room's copy of it file by file, so a room that adopted the workflow without the script it runs
// (CoalFace, release-notes.mjs, 2026-10-02) shows up as a named DIFFERS or ABSENT row instead of a failed tag-push run.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { WORKFLOWS, ROOM_OWNED, blobId, overlaySet, compareOverlaySet } from './lib/overlay-set.mjs';

const SCRIPTS = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPTS, '..');
const OVERLAY = path.join(ROOT, 'templates', 'overlay-coal-skill');
const made = [];
test.after(() => { for (const d of made) fs.rmSync(d, { recursive: true, force: true }); });
const scratch = (p) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), p)); made.push(d); return d; };
const node = (args, opts = {}) => spawnSync(process.execPath, ['--max-old-space-size=512', ...args], { encoding: 'utf8', timeout: 60000, ...opts });

function put(dir, rel, content) { const p = path.join(dir, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, content); }
function adopt(roomDir, workflow) {
  const set = overlaySet(OVERLAY, workflow);
  for (const f of set.files) { fs.mkdirSync(path.dirname(path.join(roomDir, f)), { recursive: true }); fs.copyFileSync(path.join(OVERLAY, f), path.join(roomDir, f)); }
  for (const f of set.roomOwned) put(roomDir, f, '// the room\'s own\n');
  return set;
}

test('blobId is git\'s blob id over LF-normalized bytes (a CRLF copy agrees with its LF checkout)', () => {
  assert.equal(blobId(Buffer.from('hello\n')), 'ce013625030ba8dba906f756967f9e9ca394464a'); // git hash-object of "hello\n"
  assert.equal(blobId(Buffer.from('hello\r\n')), blobId(Buffer.from('hello\n')));
  assert.notEqual(blobId(Buffer.from('hello')), blobId(Buffer.from('hello\n')));
});

test('overlaySet: the claude.ai workflow needs the release scripts, their libs, the zip builder and every test beside them; the bare one needs only the release trio', () => {
  const zips = overlaySet(OVERLAY, 'claude-ai-zips.yml');
  const bare = overlaySet(OVERLAY, 'create-release.yml');
  assert.deepEqual(zips.missing, []); assert.deepEqual(bare.missing, []);
  for (const f of ['.github/workflows/claude-ai-zips.yml', 'scripts/release-notes.mjs', 'scripts/release-notes.test.mjs', 'scripts/lib/release-shape.mjs', 'scripts/lib/release-shape.test.mjs', 'scripts/build-claude-ai-zips.mjs', 'scripts/verify-release-shape.mjs']) assert.ok(zips.files.includes(f), 'claude-ai-zips needs ' + f);
  assert.deepEqual(zips.roomOwned, [...ROOM_OWNED].sort(), 'the three room-owned files the README names');
  assert.deepEqual(bare.files, ['.github/workflows/create-release.yml', 'scripts/lib/release-shape.mjs', 'scripts/lib/release-shape.test.mjs', 'scripts/release-notes.mjs', 'scripts/release-notes.test.mjs', 'scripts/verify-release-shape.mjs', 'scripts/verify-release-shape.test.mjs']);
  assert.deepEqual(bare.roomOwned, []);
  assert.throws(() => overlaySet(OVERLAY, 'nope.yml'), /unknown overlay workflow/);
});

test('overlaySet: a script the workflow runs that the overlay neither carries nor names as room-owned is reported missing', () => {
  const ov = scratch('ovset-');
  put(ov, '.github/workflows/create-release.yml', 'jobs:\n  a:\n    steps:\n      - run: node scripts/ghost.mjs\n');
  assert.deepEqual(overlaySet(ov, 'create-release.yml').missing, ['scripts/ghost.mjs']);
});

test('compareOverlaySet: a faithful copy is all identical; a stale script reads DIFFERS with both blob ids; a missing file reads ABSENT; room-owned files are presence only', () => {
  const room = scratch('ovroom-');
  adopt(room, 'claude-ai-zips.yml');
  let r = compareOverlaySet(room, OVERLAY);
  assert.deepEqual(r.carried, ['claude-ai-zips.yml']);
  assert.ok(r.rows.length >= 18 && r.rows.every((x) => x.status === 'identical' || x.status === 'present (room-owned)'), JSON.stringify(r.rows.filter((x) => x.status !== 'identical')));
  put(room, 'scripts/release-notes.mjs', '// an older copy\n');
  fs.rmSync(path.join(room, 'scripts/lib/release-shape.mjs'));
  fs.rmSync(path.join(room, 'scripts/verify.mjs'));
  r = compareOverlaySet(room, OVERLAY);
  const by = Object.fromEntries(r.rows.map((x) => [x.file, x.status]));
  assert.match(by['scripts/release-notes.mjs'], /^DIFFERS \(room [0-9a-f]{8} vs canon [0-9a-f]{8}\)$/);
  assert.equal(by['scripts/lib/release-shape.mjs'], 'ABSENT');
  assert.equal(by['scripts/verify.mjs'], 'ABSENT (room-owned)');
  assert.equal(by['scripts/lib/desc-cap.mjs'], 'present (room-owned)');
});

test('compareOverlaySet: a room carrying neither workflow has nothing to compare; one carrying both is a named problem', () => {
  const none = scratch('ovnone-');
  assert.deepEqual(compareOverlaySet(none, OVERLAY), { carried: [], rows: [], problem: null });
  const both = scratch('ovboth-');
  for (const w of WORKFLOWS) put(both, '.github/workflows/' + w, 'x');
  assert.match(compareOverlaySet(both, OVERLAY).problem, /exactly one/);
});

test('CLI: prints "<blob id>  <path>" for every file of the set, the blob ids equal the files\' own; -h exits 0; an unknown flag or workflow exits 64 with the usage', () => {
  const r = node([path.join(SCRIPTS, 'overlay-set.mjs'), 'create-release.yml']);
  assert.equal(r.status, 0, r.stderr);
  const lines = r.stdout.trim().split('\n');
  assert.match(lines[0], /^# create-release\.yml \(7 files \+ 0 room-owned\)$/);
  for (const l of lines.slice(1)) {
    const [id, ...rest] = l.split('  ');
    assert.equal(id, blobId(fs.readFileSync(path.join(OVERLAY, rest.join('  ')))), l);
  }
  const all = node([path.join(SCRIPTS, 'overlay-set.mjs')]);
  assert.equal(all.status, 0); assert.match(all.stdout, /room-owned {2}scripts\/verify\.mjs/);
  assert.equal(node([path.join(SCRIPTS, 'overlay-set.mjs'), '-h']).status, 0);
  for (const bad of [['--bogus'], ['nope.yml'], ['create-release.yml', 'claude-ai-zips.yml']]) {
    const u = node([path.join(SCRIPTS, 'overlay-set.mjs'), ...bad]);
    assert.equal(u.status, 64, bad.join(' ')); assert.match(u.stderr, /usage:/);
  }
});

test('skeleton-check: a live room\'s overlay set is judged file by file; a stale or missing script is a named row, and a faithful room reads all identical', () => {
  const umb = scratch('ovskel-');
  const gh = path.join(umb, '.github');
  for (const f of ['skeleton-check.mjs']) put(gh, 'scripts/' + f, fs.readFileSync(path.join(SCRIPTS, f), 'utf8'));
  for (const f of fs.readdirSync(path.join(SCRIPTS, 'lib'))) fs.copyFileSync(path.join(SCRIPTS, 'lib', f), (fs.mkdirSync(path.join(gh, 'scripts', 'lib'), { recursive: true }), path.join(gh, 'scripts', 'lib', f)));
  fs.cpSync(path.join(ROOT, 'templates', 'overlay-coal-skill'), path.join(gh, 'templates', 'overlay-coal-skill'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'templates', 'published-code'), path.join(gh, 'templates', 'published-code'), { recursive: true });
  const room = path.join(umb, 'CoalWorks', 'Demo');
  put(room, '.git/config', '[core]\n');
  put(room, '.github/workflows/ci.yml', 'x'); put(room, '.github/workflows/codeql.yml', 'x');
  adopt(room, 'claude-ai-zips.yml');
  const run = () => node([path.join(gh, 'scripts', 'skeleton-check.mjs')], { cwd: umb });
  let out = run().stdout;
  const sec = (o) => o.split('## ').find((s) => s.startsWith('CoalWorks/Demo')) || '';
  assert.match(sec(out), /\[overlay claude-ai-zips\.yml\] \d+ files? \+ 3 room-owned: all identical/, sec(out));
  put(room, 'scripts/release-notes.mjs', '// an older copy\n');
  fs.rmSync(path.join(room, 'scripts/verify-release-shape.mjs'));
  out = run().stdout;
  assert.match(sec(out), /\[overlay claude-ai-zips\.yml\] .*1 DIFFERS, 1 ABSENT/, sec(out));
  assert.match(sec(out), /scripts\/release-notes\.mjs: DIFFERS \(room [0-9a-f]{8} vs canon [0-9a-f]{8}\)/);
  assert.match(sec(out), /scripts\/verify-release-shape\.mjs: ABSENT/);
});

test('the adoption text names the set tooling: SKILL-REPO-PATTERN and OVERLAY-README point at overlay-set.mjs and skeleton-check', () => {
  for (const f of [path.join(ROOT, 'SKILL-REPO-PATTERN.md'), path.join(OVERLAY, 'OVERLAY-README.md')]) {
    const t = fs.readFileSync(f, 'utf8');
    assert.match(t, /scripts\/overlay-set\.mjs/, path.basename(f) + ' names overlay-set.mjs');
    assert.match(t, /skeleton-check/, path.basename(f) + ' names skeleton-check');
  }
});

// UMB-256 (the same class): a room whose own Dependabot bumped an action pin in an adopted workflow is not drift. The overlay compare and
// skeleton-check's file compare read a pin-only difference as its own line, never DIFFERS; any other difference still is.
test('compareOverlaySet: a bumped action pin in the adopted workflow reads as a pin-only row, not DIFFERS; a pin bump plus a real edit is DIFFERS', () => {
  const room = scratch('ovpin-');
  adopt(room, 'create-release.yml');
  const wfp = path.join(room, '.github/workflows/create-release.yml');
  const canon = fs.readFileSync(wfp, 'utf8');
  fs.writeFileSync(wfp, canon.replace(/(uses: actions\/checkout@)[0-9a-f]{40}( # )\S+/, '$1' + 'c'.repeat(40) + '$2v99.0.0'));
  let r = compareOverlaySet(room, OVERLAY);
  let by = Object.fromEntries(r.rows.map((x) => [x.file, x.status]));
  assert.match(by['.github/workflows/create-release.yml'], /^PINS ONLY: 1 action pin differs from the canon, structure identical \(actions\/checkout v99\.0\.0 vs canon v[\d.]+: room ahead\)$/);
  fs.writeFileSync(wfp, fs.readFileSync(wfp, 'utf8') + '# a real edit\n');
  r = compareOverlaySet(room, OVERLAY);
  by = Object.fromEntries(r.rows.map((x) => [x.file, x.status]));
  assert.match(by['.github/workflows/create-release.yml'], /^DIFFERS \(/);
});

test('skeleton-check: a room\'s workflow with only a bumped pin reads PINS ONLY (its own line), one with a real edit reads DIFFERS, and the overlay summary counts the pin-only row apart', () => {
  const umb = scratch('ovskelpin-');
  const gh = path.join(umb, '.github');
  put(gh, 'scripts/skeleton-check.mjs', fs.readFileSync(path.join(SCRIPTS, 'skeleton-check.mjs'), 'utf8'));
  for (const f of fs.readdirSync(path.join(SCRIPTS, 'lib'))) fs.copyFileSync(path.join(SCRIPTS, 'lib', f), (fs.mkdirSync(path.join(gh, 'scripts', 'lib'), { recursive: true }), path.join(gh, 'scripts', 'lib', f)));
  fs.cpSync(path.join(ROOT, 'templates', 'overlay-coal-skill'), path.join(gh, 'templates', 'overlay-coal-skill'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'templates', 'published-code'), path.join(gh, 'templates', 'published-code'), { recursive: true });
  const room = path.join(umb, 'CoalWorks', 'Demo');
  put(room, '.git/config', '[core]\n');
  const tpl = (rel) => fs.readFileSync(path.join(ROOT, 'templates', 'published-code', rel), 'utf8');
  const bump = (t) => t.replace(/(uses: [\w./-]+@)[0-9a-f]{40}( # )\S+/, '$1' + 'd'.repeat(40) + '$2v99.0.0');
  put(room, '.github/workflows/ci.yml', tpl('.github/workflows/ci.yml'));
  put(room, '.github/workflows/codeql.yml', bump(tpl('.github/workflows/codeql.yml')));
  put(room, '.github/workflows/scorecard.yml', tpl('.github/workflows/scorecard.yml') + '# a real edit\n');
  adopt(room, 'create-release.yml');
  const wfp = path.join(room, '.github/workflows/create-release.yml');
  fs.writeFileSync(wfp, bump(fs.readFileSync(wfp, 'utf8')));
  const out = node([path.join(gh, 'scripts', 'skeleton-check.mjs')], { cwd: umb }).stdout;
  const sec = out.split('## ').find((s) => s.startsWith('CoalWorks/Demo')) || '';
  assert.match(sec, /\.github\/workflows\/codeql\.yml: PINS ONLY: 1 action pin differs from the canon, structure identical \(/, sec);
  assert.match(sec, /\.github\/workflows\/scorecard\.yml: DIFFERS \(/, sec);
  assert.match(sec, /\.github\/workflows\/ci\.yml: identical/, sec);
  assert.match(sec, /\[overlay create-release\.yml\] .*1 PINS ONLY/, sec);
  assert.ok(!/codeql\.yml: DIFFERS/.test(sec) && !/create-release\.yml: DIFFERS/.test(sec), 'a pin-only difference is never DIFFERS');
});
