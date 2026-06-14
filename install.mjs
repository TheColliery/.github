#!/usr/bin/env node
// TheColliery — series installer. Pick your "DLC": install the whole suite, or
// just the tools you want. Each tool installs through its OWN native mechanism;
// this script only orchestrates the selection. Node built-ins only, cross-platform.
//
//   node install.mjs              show the menu
//   node install.mjs all          install every live tool
//   node install.mjs 1 2          by number (CoalMine + CoalTipple)
//   node install.mjs coaltipple   by name
//
// The authoritative, always-current install steps for each tool live in that
// tool's own README; this runs the same commands. Needs node + git on PATH, and
// (for CoalMine, a Claude Code plugin) the `claude` CLI.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const sh = process.platform === 'win32';
function run(cmd, args) {
  process.stdout.write(`\n$ ${cmd} ${args.join(' ')}\n`);
  return spawnSync(cmd, args, { stdio: 'inherit', shell: sh }).status === 0;
}

function installCoalMine() {
  // CoalMine ships as a Claude Code plugin (marketplace git URL) — see its README.
  const added = run('claude', ['plugin', 'marketplace', 'add', 'HetCreep/CoalMine']);
  return run('claude', ['plugin', 'install', 'coalmine@coalmine']) && added;
}
function installCoalTipple() {
  // CoalTipple ships as source: clone it, then run its own global installer.
  const dir = path.join(os.tmpdir(), 'thecolliery-coaltipple-src');
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
  if (!run('git', ['clone', '--depth', '1', 'https://github.com/TheColliery/CoalTipple.git', dir])) return false;
  return run('node', [path.join(dir, 'scripts', 'install.mjs'), 'claude']);
}

const DLC = [
  { n: 1, key: 'coalmine',   name: 'CoalMine',   blurb: '9 quality-canary skills (code-health, grounding, supply-chain, resilience, more)', live: true,  install: installCoalMine },
  { n: 2, key: 'coaltipple', name: 'CoalTipple', blurb: 'model/effort router (delegate-down to save tokens, escalate-up for quality)',      live: true,  install: installCoalTipple },
  { n: 3, key: 'coalface',   name: 'CoalFace',   blurb: 'agent swarming + concurrent orchestration',                                         live: false, install: null },
];

function menu() {
  console.log('\nTheColliery — pick your DLC:\n');
  for (const d of DLC) console.log(`  [${d.n}] ${d.name.padEnd(11)} ${d.blurb}${d.live ? '' : '   (not yet public)'}`);
  console.log('\nInstall:  node install.mjs all   |   node install.mjs 1 2   |   node install.mjs coaltipple\n');
}

const args = process.argv.slice(2).map((a) => a.toLowerCase());
if (!args.length) { menu(); process.exit(0); }
const pick = args.includes('all')
  ? DLC.filter((d) => d.live)
  : DLC.filter((d) => args.includes(String(d.n)) || args.includes(d.key));
if (!pick.length) { console.error('Nothing matched.\n'); menu(); process.exit(2); }

let failed = 0, done = 0;
for (const d of pick) {
  if (!d.live) { console.log(`\n${d.name}: not yet public — skipped.`); continue; }
  console.log(`\n=== Installing ${d.name} ===`);
  if (d.install()) { console.log(`\n${d.name}: installed.`); done++; }
  else { console.error(`\n${d.name}: install FAILED (see output; its README has the manual steps).`); failed++; }
}
console.log(`\nDone. ${done} tool(s) installed${failed ? `, ${failed} failed` : ''}.`);
process.exit(failed ? 1 : 0);
