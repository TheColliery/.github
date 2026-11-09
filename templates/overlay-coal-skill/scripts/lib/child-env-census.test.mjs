// child-env-census.test.mjs -- the canon child-env census against its WITNESS LIST (UMB3-193 round 5, 2026-11-09): one leg per vector, each fixture run through scanChildEnv with NO pins.
// Hermetic: the fixtures are strings, written nowhere. Portable: a room that adopts the census by blob id adopts this file with it (and git-env-census.mjs, whose lexer it reads),
// and adds its own pins and its own tree in a test of its own (this file names no path outside scripts/lib/).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanChildEnv, censusChildEnv, SANDBOX_KEYS } from './child-env-census.mjs';
import { gitBlobId } from './git-env-census.mjs';

// The fixtures spell the spawners in capitals: the repo's text-level spawn policing (a timeout, an env word) reads raw source and cannot tell a fixture string from a call.
const PAIRS = [['SPAWNSYNC', 'spawnSync'], ['EXECFILESYNC', 'execFileSync'], ['FORK', 'fork']];
const RESTORE = (t) => PAIRS.reduce((s, [a, b]) => s.split(a + '(').join(b + '('), t);
const scan = (text, pins = [], opts = {}) => scanChildEnv([{ rel: 'fixture.test.mjs', text: RESTORE(text) }], pins, opts);
const IMPORT = "import { spawnSync, execFileSync, fork } from 'node:child_process';\n";
const FIVE = 'HOME: d, USERPROFILE: d, TEMP: d, TMP: d, TMPDIR: d';

// [name, fixture, expected finding count, a regex the one finding matches]
const REFUSED = [
  ['spawnSync with env: process.env', `${IMPORT}SPAWNSYNC('node', ['x'], { env: process.env });`, /passes process\.env whole/],
  ['execFileSync with env: process.env', `${IMPORT}EXECFILESYNC('node', ['x'], { cwd: d, env: process.env, encoding: 'utf8' });`, /passes process\.env whole/],
  ['fork with env: process.env', `${IMPORT}FORK('x.mjs', [], { env: process.env });`, /passes process\.env whole/],
  ['a member call on the module namespace', "import cp from 'node:child_process';\ncp.SPAWNSYNC('node', [], { env: process.env });", /passes process\.env whole/],
  ['a namespace import', "import * as cp from 'node:child_process';\ncp.EXECFILESYNC('node', [], { env: process.env });", /passes process\.env whole/],
  ['a require of the module', "const cp = require('child_process');\ncp.SPAWNSYNC('node', [], { env: process.env });", /passes process\.env whole/],
  ['a destructured require', "const { spawnSync } = require('node:child_process');\nSPAWNSYNC('node', [], { env: process.env });", /passes process\.env whole/],
  ['a destructured dynamic import', "const { spawnSync } = await import('node:child_process');\nSPAWNSYNC('node', [], { env: process.env });", /passes process\.env whole/],
  ['an imported name under an alias', "import { spawnSync as run } from 'node:child_process';\nrun('node', [], { env: process.env });", /passes process\.env whole/],
  ['the canon helper runWaves, called as a member', "const wave = await import('./wave-run.mjs');\nawait wave.runWaves({ files: ['a'], cwd: d, env: process.env, heapMb: 512 });", /passes process\.env whole/],
  ['the canon helper runSuite', "runSuite({ repo, tests, env: process.env });", /passes process\.env whole/],
  ['env held in a const', `${IMPORT}const env = process.env;\nSPAWNSYNC('node', [], { env });`, /passes process\.env whole/],
  ['options held in a const', `${IMPORT}const opts = { cwd: d, env: process.env };\nSPAWNSYNC('node', [], opts);`, /passes process\.env whole/],
  ['a helper of the file that returns process.env', `${IMPORT}const childEnv = () => process.env;\nSPAWNSYNC('node', [], { env: childEnv() });`, /passes process\.env whole/],
  ['a function of the file that returns process.env', `${IMPORT}function childEnv() { return process.env; }\nSPAWNSYNC('node', [], { env: childEnv() });`, /passes process\.env whole/],
  ['a bare copy of the environment', `${IMPORT}SPAWNSYNC('node', [], { env: { ...process.env } });`, /passes a copy of process\.env whole/],
  ['HOME and USERPROFILE without TEMP, TMP and TMPDIR', `${IMPORT}SPAWNSYNC('node', [], { env: { PATH: p, HOME: d, USERPROFILE: d } });`, /sets HOME and USERPROFILE but not TEMP, TMP, TMPDIR/],
  ['HOME alone', `${IMPORT}SPAWNSYNC('node', [], { env: { HOME: d } });`, /sets HOME but not TEMP, TMP, TMPDIR/],
  ['HOME, USERPROFILE and TEMP without TMP and TMPDIR', `${IMPORT}SPAWNSYNC('node', [], { env: { HOME: d, USERPROFILE: d, TEMP: d } });`, /but not TMP, TMPDIR/],
  ['a half sandbox in a helper of the file', `${IMPORT}const sandboxEnv = (d) => ({ HOME: d, USERPROFILE: d, TEMP: d });\nSPAWNSYNC('node', [], { env: sandboxEnv(dir) });`, /but not TMP, TMPDIR/],
  ['two spawns, one clean and one not', `${IMPORT}SPAWNSYNC('node', [], { env: { ${FIVE} } });\nSPAWNSYNC('node', [], { env: process.env });`, /passes process\.env whole/],
];
for (const [name, text, re] of REFUSED) {
  test(`child-env census refuses: ${name}`, () => {
    const r = scan(text);
    assert.equal(r.findings.length, 1, `${name}: ${JSON.stringify(r.findings)}`);
    assert.match(r.findings[0], re);
    assert.match(r.findings[0], /^fixture\.test\.mjs:\d+ /, 'a finding names the file and the line');
    assert.ok(r.calls >= 1 && r.withEnv >= 1, 'the spawn was counted');
  });
}

const CLEAN = [
  ['a literal that sets all five', `${IMPORT}SPAWNSYNC('node', [], { env: { PATH: p, ${FIVE} } });`],
  ['a copy of the environment that sets all five', `${IMPORT}SPAWNSYNC('node', [], { env: { ...process.env, ${FIVE} } });`],
  ['a named pick of one variable', `${IMPORT}SPAWNSYNC('node', [], { env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot } });`],
  ['a literal that sets none of the five and copies nothing', `${IMPORT}SPAWNSYNC('node', [], { env: { PATH: '/bin', FOO: '1' } });`],
  ['a helper of the file that returns all five', `${IMPORT}const sandboxEnv = (d) => ({ PATH: p, ${FIVE} });\nSPAWNSYNC('node', [], { env: sandboxEnv(dir) });`],
  ['a function of the file that builds on a copy and sets all five', `${IMPORT}function childEnv(d) { return { ...process.env, ${FIVE} }; }\nSPAWNSYNC('node', [], { env: childEnv(dir) });`],
  ['no env option at all (the ceiling: not counted)', `${IMPORT}SPAWNSYNC('node', ['x'], { cwd: d });`],
  ['a string and a comment that name the bad form', `${IMPORT}// SPAWNSYNC('node', [], { env: process.env })\nconst s = "SPAWNSYNC('node', [], { env: process.env })";\nSPAWNSYNC('node', [], { env: { ${FIVE} } });`],
  ['a regex exec, not a spawner', "const m = /a/.exec('a');\nfoo.exec('x', { env: process.env });"],
  ['a local function named spawnSync that is not child_process', "function SPAWNSYNC(a, b, c) { return c; }\nSPAWNSYNC('x', [], { env: process.env });"],
  ['an arrow function body that merely mentions the env', `${IMPORT}SPAWNSYNC('node', [], { env: { ${FIVE}, KEEP: process.env.KEEP } });`],
];
for (const [name, text] of CLEAN) {
  test(`child-env census passes: ${name}`, () => {
    const r = scan(text);
    assert.deepEqual(r.findings, [], name);
    // a clean read must be a READ: the spawn was seen and its env judged ok, so a census that sees nothing cannot pass this leg
    if (/^no env option/.test(name)) assert.ok(r.calls === 1 && r.withEnv === 0, `${name}: counted, no env option`);
    else if (/^(a regex exec|a local function)/.test(name)) assert.equal(r.calls, 0, `${name}: not a spawner`);
    else assert.ok(r.calls >= 1 && r.withEnv >= 1 && r.ok >= 1, `${name}: the spawn was counted and its env judged ok (${JSON.stringify({ c: r.calls, w: r.withEnv, ok: r.ok })})`);
  });
}

test('child-env census: an env it cannot read (an import, a parameter, a name declared twice) is UNREAD: counted and listed, never a finding', () => {
  const imported = scan(`${IMPORT}import { gitEnv } from './git-env.mjs';\nSPAWNSYNC('git', [], { env: gitEnv() });`);
  assert.deepEqual(imported.findings, []); assert.equal(imported.unread, 1); assert.match(imported.unreadList[0], /gitEnv\(\) is not defined in this file/);
  const param = scan(`${IMPORT}export function run(env) { return SPAWNSYNC('node', [], { env }); }`);
  assert.deepEqual(param.findings, []); assert.equal(param.unread, 1);
  const twice = scan(`${IMPORT}let env = process.env;\nfunction f() { const env = { ${FIVE} }; }\nSPAWNSYNC('node', [], { env });`);
  assert.deepEqual(twice.findings, []); assert.equal(twice.unread, 1);
});

test('child-env census: a spread of process.env that sets fewer than all five is COUNTED and listed (spreadList), a finding only when asked -- the rule as ruled names whole and partial', () => {
  const text = `${IMPORT}SPAWNSYNC('node', [], { env: { ...process.env, X: '1' } });`;
  const counted = scan(text);
  assert.deepEqual(counted.findings, []); assert.equal(counted.spread, 1); assert.match(counted.spreadList[0], /copies process\.env and does not set HOME, USERPROFILE, TEMP, TMP, TMPDIR/);
  const strict = scan(text, [], { spread: 'finding' });
  assert.equal(strict.findings.length, 1); assert.match(strict.findings[0], /copies process\.env and does not set/);
  assert.equal(censusChildEnv([{ rel: 'a.test.mjs', text: RESTORE(text) }], [], { spread: 'finding' }).length, 1);
});

test('child-env census: a pin { rel, blob, why } exempts a file only while its git blob id is the pinned one; one added byte spends it', () => {
  const text = `${IMPORT}SPAWNSYNC('node', [], { env: process.env });\n`;
  const pin = { rel: 'fixture.test.mjs', blob: gitBlobId(RESTORE(text)), why: 'a witness' }; // the census reads (and hashes) the restored text
  const pinned = scan(text, [pin]);
  assert.deepEqual(pinned.findings, []); assert.equal(pinned.exempted, 1);
  assert.equal(scan(text + '\n', [pin]).findings.length, 1, 'the edited file is read again');
  assert.equal(scan(text, [{ ...pin, rel: 'other.test.mjs' }]).findings.length, 1, 'a pin names its file');
});

test('child-env census: the sandbox keys are the five the rule names', () => {
  assert.deepEqual(SANDBOX_KEYS, ['HOME', 'USERPROFILE', 'TEMP', 'TMP', 'TMPDIR']);
});
