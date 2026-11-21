// configure.mjs, the write path (21d, against the rooms' exemplar: CoalFace's scripts/configure.mjs and scripts/lib/repo-fs.mjs). The template's schema is a
// placeholder with no keys, so each test runs a COPY of configure.mjs in a temp project with a one-key stub schema; the template's own lib/repo-fs.mjs is copied
// beside it. Every child has a heap cap and a kill-timeout; every temp folder is removed. Hard links stand in for links where the OS refuses a file symlink
// (Windows without developer mode): a write that follows a link writes through a hard link the same way, and the symlink leg skips visibly where it cannot run.
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const made = [];
const tmp = (tag) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), `configure-${tag}-`)); made.push(d); return d; };
process.on('exit', () => { for (const d of made) { try { fs.rmSync(d, { recursive: true, force: true }); } catch {} } });

const STUB = "export const CONFIG_SCHEMA = [{ key: 'mode', type: 'enum', values: ['auto', 'off'], help: 'the mode' }];\nexport function validateValue() { return null; }\n";
function project() {
  const dir = tmp('proj');
  fs.mkdirSync(path.join(dir, '.git'));
  fs.mkdirSync(path.join(dir, 'scripts', 'lib'), { recursive: true });
  fs.copyFileSync(path.join(HERE, 'configure.mjs'), path.join(dir, 'scripts', 'configure.mjs'));
  const lib = path.join(HERE, 'lib', 'repo-fs.mjs');
  if (fs.existsSync(lib)) fs.copyFileSync(lib, path.join(dir, 'scripts', 'lib', 'repo-fs.mjs'));
  fs.writeFileSync(path.join(dir, 'scripts', 'lib', 'config-schema.mjs'), STUB);
  return { dir, cfg: path.join(dir, '.{{TOOL}}.json') };
}
function run(dir, args = ['--mode', 'auto'], preload = null) {
  const pre = preload ? ['--import', 'file:///' + preload.replace(/\\/g, '/')] : [];
  const r = spawnSync(process.execPath, ['--max-old-space-size=256', ...pre, path.join('scripts', 'configure.mjs'), ...args], {
    cwd: dir, encoding: 'utf8', timeout: 30000, env: { ...process.env, HOME: dir, USERPROFILE: dir },
  });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}
// a stand-in for a kill between opening the config and writing it: the in-place form opens (truncating) and dies; a write through a descriptor dies before a byte
function killPreload() {
  const p = path.join(tmp('kill'), 'kill.mjs');
  fs.writeFileSync(p, "import fs from 'node:fs';\nconst orig = fs.writeFileSync;\nfs.writeFileSync = function (f, ...rest) {\n  if (typeof f === 'string' && f.endsWith('.json')) { fs.closeSync(fs.openSync(f, 'w')); throw new Error('killed'); }\n  if (typeof f === 'number') throw new Error('killed');\n  return orig.call(this, f, ...rest);\n};\n");
  return p;
}

test('the config is written through a temp file and a rename: a hard link at the config is replaced, never written through, and a kill mid-write leaves the old config whole -- RED before 21d', () => {
  const { dir, cfg } = project();
  const outside = path.join(tmp('outside'), 'outside.json');
  fs.writeFileSync(outside, '{"keep":true}\n');
  fs.linkSync(outside, cfg);
  const r = run(dir);
  assert.strictEqual(r.code, 0, r.out);
  assert.strictEqual(fs.readFileSync(outside, 'utf8'), '{"keep":true}\n', 'the file the link shares is untouched');
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(cfg, 'utf8')), { keep: true, mode: 'auto' }, 'the config holds the update');

  const k = project();
  fs.writeFileSync(k.cfg, '{"mode":"off"}\n');
  const killed = run(k.dir, ['--mode', 'auto'], killPreload());
  assert.notStrictEqual(killed.code, 0, killed.out);
  assert.strictEqual(fs.readFileSync(k.cfg, 'utf8'), '{"mode":"off"}\n', 'a write that dies leaves the old config byte for byte');
  assert.deepStrictEqual(fs.readdirSync(k.dir).filter((n) => n.includes('tmp')), [], 'and no temp file behind');
});

test('a symlink at the config is replaced, never written through (skips where the OS refuses a file symlink)', (t) => {
  const { dir, cfg } = project();
  const outside = path.join(tmp('outside'), 'outside.json');
  fs.writeFileSync(outside, '{"keep":true}\n');
  try { fs.symlinkSync(outside, cfg, 'file'); } catch (e) { t.skip(`no file symlink here (${e.code})`); return; }
  const r = run(dir);
  assert.strictEqual(r.code, 0, r.out);
  assert.strictEqual(fs.readFileSync(outside, 'utf8'), '{"keep":true}\n');
});

test('a malformed config is backed up through the same temp-and-rename route: a hard link at the .bak is replaced, and a config that cannot be backed up is never overwritten -- RED before 21d', () => {
  const { dir, cfg } = project();
  const outside = path.join(tmp('outside'), 'outside.txt');
  fs.writeFileSync(outside, 'outside\n');
  fs.writeFileSync(cfg, '{oops');
  fs.linkSync(outside, cfg + '.bak');
  const r = run(dir);
  assert.strictEqual(fs.readFileSync(outside, 'utf8'), 'outside\n', 'the file a link at the .bak shares is untouched: ' + r.out);
  assert.strictEqual(fs.readFileSync(cfg + '.bak', 'utf8'), '{oops', 'the .bak holds the malformed config');
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(cfg, 'utf8')), { mode: 'auto' }, 'and the config is rebuilt');

  const b = project();
  fs.writeFileSync(b.cfg, '{oops');
  fs.mkdirSync(b.cfg + '.bak'); // the backup cannot be written
  const blocked = run(b.dir);
  assert.strictEqual(blocked.code, 1, blocked.out);
  assert.strictEqual(fs.readFileSync(b.cfg, 'utf8'), '{oops', 'a config that cannot be backed up is left byte for byte');
  assert.ok(/FAIL .*\.bak: .*the malformed config .* was left untouched and nothing was written/.test(blocked.out), blocked.out);
});
