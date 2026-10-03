#!/usr/bin/env node
// materialize-fixtures: copy a CoalMine benchmark suite's fixtures into a scratch directory the way a canary must see them.
//
// WHY: the supply-chain-audit fixtures carry planted, vulnerable dependency pins in a file that a scanner reads by its name,
// package.json. GitHub's dependency graph reads every package.json in a repository as that repository's own dependencies, so the
// manifests are stored here as package.fixture.json (bytes unchanged) and this tool gives each one back its real name in the copy.
// Ground truth is unchanged: expected.json and the dated result records name src/package.json, and that is the path in the copy.
//
// WHAT IT COPIES: each fixture's src/ tree only. expected.json is never copied (the blind protocol: a scan worker must not read
// the ground truth). A destination that already holds files is refused, never merged into.
//
// Usage:   node scripts/materialize-fixtures.mjs <suite> <dest>
// Example: node scripts/materialize-fixtures.mjs supply-chain-audit /tmp/scan-run
// Exit:    0 done · 1 refused or failed · 64 usage error
// Report a problem: TheColliery/.github issues. Zero dependencies: node builtins only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const USAGE = 'usage: node scripts/materialize-fixtures.mjs <suite> <dest> | -h\n'
  + '  copies each fixture\'s src/ of benchmarks/CoalMine/fixtures/<suite>/ into <dest>/<fixture>/src/,\n'
  + '  naming package.fixture.json back to package.json (expected.json is never copied)\n'
  + '  example: node scripts/materialize-fixtures.mjs supply-chain-audit /tmp/scan-run\n'
  + '  exit 0 done · 1 refused or failed · 64 usage error';
const FIXTURE_NAME = 'package.fixture.json';
const REAL_NAME = 'package.json';

function copyTree(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    const from = path.join(src, e.name);
    if (e.isDirectory()) copyTree(from, path.join(dest, e.name));
    else if (e.isFile()) fs.copyFileSync(from, path.join(dest, e.name === FIXTURE_NAME ? REAL_NAME : e.name));
    else throw new Error(`${path.relative(ROOT, from)} is neither a file nor a directory`);
  }
}

function main(args) {
  if (args.includes('-h') || args.includes('--help')) { console.log(USAGE); return 0; }
  if (args.length !== 2 || args.some((a) => a.startsWith('-'))) { console.error(`materialize-fixtures: expected <suite> <dest>${args.find((a) => a.startsWith('-')) ? `, got flag ${JSON.stringify(args.find((a) => a.startsWith('-')))}` : ''}\n${USAGE}`); return 64; }
  const [suite, destArg] = args;
  if (!/^[a-z][a-z0-9-]*$/.test(suite)) { console.error(`materialize-fixtures: ${JSON.stringify(suite)} is not a suite name (lower-case letters, digits and dashes)`); return 1; }
  const from = path.join(ROOT, 'benchmarks', 'CoalMine', 'fixtures', suite);
  if (!fs.existsSync(from)) { console.error(`materialize-fixtures: no suite ${JSON.stringify(suite)} under benchmarks/CoalMine/fixtures/; nothing was copied`); return 1; }
  const dest = path.resolve(destArg);
  if (fs.existsSync(dest) && fs.readdirSync(dest).length) { console.error(`materialize-fixtures: ${dest} already holds files; pass an empty or new directory (a materialized copy is never merged into another)`); return 1; }
  let count = 0;
  for (const fx of fs.readdirSync(from, { withFileTypes: true }).filter((e) => e.isDirectory()).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const src = path.join(from, fx.name, 'src');
    if (!fs.existsSync(src)) continue;
    copyTree(src, path.join(dest, fx.name, 'src'));
    count++;
  }
  console.log(`materialized ${count} fixture(s) of ${suite} into ${dest}`);
  return 0;
}

try { process.exitCode = main(process.argv.slice(2)); } catch (e) { console.error(`materialize-fixtures: ${e && e.message ? e.message : e}`); process.exitCode = 1; }
