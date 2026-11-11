// UMB3-035 row C9 (order 16i): the front-door link check has two carriers in this repository, the org repo itself and the published-code template, and a
// room copies the template's three files by blob. Nothing here may drift from itself. The two workflows differ only in the front doors they name (the
// org repo's are README.md, the landing and the org-default community files under .github/), so they are compared by shape, not by byte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = ['scripts/front-door-links.mjs', 'scripts/lib/front-door-links.mjs', 'scripts/front-door-links.test.mjs'];
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const WORKFLOW = '.github/workflows/front-door-links.yml';

test('the engine, the CLI and the test are byte-equal in the org repo and in the published-code template', () => {
  for (const f of FILES) {
    const want = read(f);
    assert.ok(want.length > 500, f + ' is not an empty stub');
    assert.equal(read('templates/published-code/' + f), want, `templates/published-code/${f} differs from ${f}`);
  }
});

const shape = (text) => {
  const paths = [...text.matchAll(/^\s+- '([^']+)'$/gm)].map((m) => m[1]);
  const loop = /for f in ([^;]+); do/.exec(text);
  return { paths: new Set(paths), listed: loop ? loop[1].trim().split(/\s+/) : [], cron: (/cron: '([^']+)'/.exec(text) || [])[1], dispatch: /^\s+workflow_dispatch:\s*$/m.test(text), call: text.includes('node scripts/front-door-links.mjs "${files[@]}" || exit 1'), guard: text.includes('if [ "${#files[@]}" -eq 0 ]') }; // a bash array, never a space-joined string expanded unquoted (CoalHearth t154, 17c)
};

test('both workflows run the same engine over the front doors they name, on change and on the same weekly clock, and refuse an empty list', () => {
  const canon = shape(read('templates/published-code/' + WORKFLOW));
  const org = shape(read(WORKFLOW));
  for (const [name, w] of [['canon', canon], ['org', org]]) {
    assert.ok(w.listed.length >= 7, name + ': the step lists the front doors');
    for (const f of w.listed) assert.ok(w.paths.has(f), `${name}: ${f} is run but a change to it would not trigger the workflow`);
    assert.ok(w.call && w.guard && w.dispatch, name + ': the call, the empty-list guard and the dispatch trigger');
  }
  assert.equal(org.cron, canon.cron, 'one clock');
  assert.ok(canon.listed.includes('README.md') && canon.listed.includes('SECURITY.md'), 'the canon names the room front doors');
  assert.ok(org.listed.includes('profile/README.md') && org.listed.includes('.github/SECURITY.md'), 'the org copy names the landing and the org-default community files');
});

// 2026-11-12a (CoalLedger t330 #2, its CW-054 row): the pipe leg skipped by platform NAME. A skip is decided by PROBING the capability (a FIFO that mkfifo really made), never by process.platform:
// the name is a bad proxy (a Windows box with an emulation layer's mkfifo, a Linux volume that cannot hold a FIFO). One skippable leg per test, and the skip is a visible t.skip with its reason.
test('the pipe leg of the front-door link test decides its skip by probing for a real FIFO, never by process.platform, and skips visibly -- RED before 2026-11-12a', () => {
  const text = read('scripts/front-door-links.test.mjs');
  const at = text.indexOf("test('CLI: a named file that is a pipe is refused at once");
  assert.ok(at > 0, 'the pipe leg exists');
  const leg = text.slice(at, text.indexOf('\n});\n', at));
  assert.doesNotMatch(leg, /process\.platform/, 'no skip by platform name');
  assert.match(leg, /isFIFO\(\)/, 'the probe asks Node whether what mkfifo made is a FIFO');
  assert.equal((leg.match(/t\.skip\(/g) || []).length, 1, 'one skippable leg, one visible t.skip');
  assert.equal(read('templates/published-code/scripts/front-door-links.test.mjs'), text, 'the template copy is the same');
});
