import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// 2026-11-12h (row CW-059): the three overlay CLIs that compared `import.meta.url` with the path AS TYPED (wave-run.mjs, machine-reading.mjs, prune-release-zips.mjs) take the
// canon entry guard of 571ae22 and 615698b: real paths on both sides, then file identity (stat dev:ino, a non-zero ino), then the plain paths as the last resort. A guard that
// answers "not the entry" only because a path could not be resolved ends a direct run exit 0 with nothing done, and a typed-path compare never matches through a link.
// Three legs for each file: a direct run, a run through a link (split out, skipped visibly where this account cannot make one), and an import, which must run nothing.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OVERLAY = path.join(HERE, '..', 'templates', 'overlay-coal-skill', 'scripts');
const SANDBOX = fs.mkdtempSync(path.join(os.tmpdir(), 'overlay-entry-'));
process.on('exit', () => { try { fs.rmSync(SANDBOX, { recursive: true, force: true }); } catch { /* the OS clears its temp folder */ } });
let n = 0;

// The sandbox environment as one literal built from named keys (the allowlist shape the flock's child-env census accepts without a pin): a spawned script gets the scratch
// folder as HOME and TEMP, and none of the parent's workflow variables (PRUNE_OLD_RELEASE_ZIPS, GITHUB_TOKEN and the rest change what these scripts do).
const BASE_ENV_KEYS = ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT'];
const sandboxEnv = (dir) => ({
  ...Object.fromEntries(BASE_ENV_KEYS.filter((k) => process.env[k] !== undefined).map((k) => [k, process.env[k]])),
  HOME: dir, USERPROFILE: dir, TEMP: dir, TMP: dir, TMPDIR: dir, GIT_CEILING_DIRECTORIES: path.dirname(dir), GIT_CONFIG_NOSYSTEM: '1',
  HOMEDRIVE: process.platform === 'win32' ? path.parse(dir).root.replace(/[\\/]+$/, '') : undefined,
  HOMEPATH: process.platform === 'win32' ? dir.slice(path.parse(dir).root.length - 1) : undefined,
});
const NO_REALPATH = "import fs from 'node:fs';\nfs.realpathSync.native = () => { throw new Error('unresolvable'); };\n";
const NO_ID = NO_REALPATH + "fs.statSync = () => ({ dev: 0n, ino: 0n });\n";

// what a direct run of each prints without touching the network or the machine: the usage, or the flag-off line
const CASES = [
  { name: 'wave-run.mjs', rel: 'lib/wave-run.mjs', args: ['-h'], printed: /usage: wave-run\.mjs/ },
  // BB-87: machine-reading.mjs is CoalFace's file, adopted by blob id and NEVER edited here; the guard goes to CoalFace's belt as a courier patch
  // (scratchpad/dispatch/courier-coalface-machine-reading-entry-guard-12h.patch) and this folder re-adopts by blob id. Its legs run, visibly skipped, until then.
  { name: 'machine-reading.mjs', rel: 'lib/machine-reading.mjs', args: ['-h'], printed: /usage: machine-reading\.mjs/, pending: 'BB-87: CoalFace builds the guard, then this folder re-adopts it by blob id' },
  { name: 'prune-release-zips.mjs', rel: 'prune-release-zips.mjs', args: [], printed: /flag off, nothing pruned/ },
];

function spawnWith(preload, args) {
  const dir = path.join(SANDBOX, 'run' + n++);
  fs.mkdirSync(dir);
  const flags = [];
  if (preload) { const pre = path.join(dir, 'pre.mjs'); fs.writeFileSync(pre, preload); flags.push('--import', pathToFileURL(pre).href); }
  return spawnSync(process.execPath, ['--max-old-space-size=256', ...flags, ...args], { cwd: dir, encoding: 'utf8', timeout: 60000, env: sandboxEnv(dir) });
}
const importProbe = (script) => { const p = path.join(SANDBOX, 'probe' + n++ + '.mjs'); fs.writeFileSync(p, `await import(${JSON.stringify(pathToFileURL(script).href)});\nconsole.log('imported');\n`); return p; };
const linkTo = (target) => { const via = path.join(SANDBOX, 'via' + n++); fs.symlinkSync(target, via, 'junction'); return via; };

for (const c of CASES) {
  const script = path.join(OVERLAY, ...c.rel.split('/'));

  test(`${c.name}: a DIRECT run runs, plain, with the real path refused (the old guard ended it exit 0 with nothing done), and with no file id either`, { skip: c.pending ?? false }, () => {
    for (const [label, pre] of [['plain', null], ['real path refused', NO_REALPATH], ['no file id', NO_ID]]) {
      const r = spawnWith(pre, [script, ...c.args]);
      assert.equal(r.status, 0, `${label}: ${r.stderr}`);
      assert.match(r.stdout, c.printed, `${label}: what a direct run prints`);
    }
  });

  test(`${c.name}: a run through a symlinked or junctioned folder still runs, on the real path and with the real path refused (the compare is on identity, never spelling)`, { skip: c.pending ?? false }, (t) => {
    let via;
    try { via = linkTo(OVERLAY); } catch { t.skip('this account cannot make a junction or symlink here'); return; }
    const linked = path.join(via, ...c.rel.split('/'));
    for (const [label, pre] of [['real path', null], ['real path refused', NO_REALPATH]]) {
      const r = spawnWith(pre, [linked, ...c.args]);
      assert.equal(r.status, 0, `${label}: ${r.stderr}`);
      assert.match(r.stdout, c.printed, `${label}: through the link`);
    }
  });

  test(`${c.name}: an IMPORT runs nothing: plain, with the real path refused, with no file id, and with no argv[1] at all (node -e)`, { skip: c.pending ?? false }, () => {
    const probe = importProbe(script);
    for (const [label, pre] of [['plain', null], ['real path refused', NO_REALPATH], ['no file id', NO_ID]]) {
      const r = spawnWith(pre, [probe]);
      assert.equal(r.status, 0, `${label}: ${r.stderr}`);
      assert.equal(r.stdout, 'imported\n', `${label}: nothing but the probe's own line`);
    }
    const code = `await import(${JSON.stringify(pathToFileURL(script).href)}); console.log('imported');`;
    const e = spawnWith(null, ['--input-type=module', '-e', code]);
    assert.equal(e.status, 0, e.stderr); assert.equal(e.stdout, 'imported\n', 'no argv[1]');
  });
}

// ---- one text, and none of the old form left
// machine-reading.mjs joins this list when CoalFace has built the guard and this folder has re-adopted the file (BB-87)
const GUARDED = ['build-claude-ai-zips.mjs', 'lib/wave-run.mjs', 'prune-release-zips.mjs'];
const guardBlock = (rel) => {
  const text = fs.readFileSync(path.join(OVERLAY, ...rel.split('/')), 'utf8').replace(/\r\n/g, '\n');
  const a = text.indexOf('// dev:ino of what a path names');
  const e = text.indexOf('if (isMainModule(import.meta.url)) {');
  assert.ok(a >= 0 && e > a, `${rel}: carries the canon entry guard`);
  return text.slice(a, e);
};
test('the canon CLIs that carry the entry guard carry ONE text: the zips builder is the source and the other three are byte copies of its block', () => {
  const source = guardBlock('build-claude-ai-zips.mjs');
  for (const rel of GUARDED.slice(1)) assert.equal(guardBlock(rel), source, `${rel} drifted from the canon guard`);
});

test('no canon file but the one awaiting CoalFace compares import.meta.url with the path as typed (the command is in the 12h return)', () => {
  const left = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(mjs|js|cjs)$/.test(e.name) && !e.name.endsWith('.test.mjs')) {
        fs.readFileSync(p, 'utf8').split(/\r?\n/).forEach((line, i) => { if (/import\.meta\.url\s*===?\s*pathToFileURL\(\s*process\.argv\[1\]\s*\)/.test(line)) left.push(`${path.relative(path.join(HERE, '..'), p)}:${i + 1}`); });
      }
    }
  };
  walk(path.join(HERE, '..', 'templates'));
  walk(HERE);
  // the one left is machine-reading.mjs (BB-87); when CoalFace's guard is re-adopted this list becomes empty and the line is removed
  assert.deepEqual(left.map((l) => l.replace(/:\d+$/, '').split('\\').join('/')), ['templates/overlay-coal-skill/scripts/lib/machine-reading.mjs']);
});
