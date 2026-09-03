#!/usr/bin/env node
// Copies a `templates/<kind>/` skeleton (+ an optional overlay) into a fresh directory,
// filling {{PLACEHOLDER}} tokens from CLI flags, and refuses a non-empty target.
// Zero-dependency (Phoenix #2); fail-loud CLI (scripts-quality.md §1).
//
// Usage:
//   node scripts/new-repo.mjs <kind> [--overlay coal-skill|llm-deploy] \
//     --name <repo> --license <spdx> [--org TheColliery] [--holder "Name"] [--year 2026] \
//     <target-dir>
//
// <kind> is one of: published-code | private-working | article

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const templatesRoot = path.join(scriptDir, '..', 'templates');
const KINDS = ['published-code', 'private-working', 'article'];
const OVERLAYS = ['coal-skill', 'llm-deploy'];

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      // A flag-shaped following token is never swallowed as this flag's value
      // (the M7a class named in CoalTipple's own MEMORY.md).
      if (next === undefined || next.startsWith('--')) {
        out[key] = true;
      } else {
        out[key] = next;
        i++;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirRecursive(s, d);
    else fs.copyFileSync(s, d);
  }
}

function isEmptyDir(dir) {
  if (!fs.existsSync(dir)) return true;
  return fs.readdirSync(dir).length === 0;
}

function fillPlaceholders(dir, values) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      fillPlaceholders(p, values);
      continue;
    }
    let text;
    try {
      text = fs.readFileSync(p, 'utf8');
    } catch {
      continue; // binary or unreadable; skip silently, this is a text-fill pass only
    }
    let changed = false;
    for (const [key, value] of Object.entries(values)) {
      const token = `{{${key}}}`;
      if (text.includes(token)) {
        text = text.split(token).join(value);
        changed = true;
      }
    }
    if (changed) fs.writeFileSync(p, text, 'utf8');
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const kind = args._[0];
  const targetDir = args._[1];

  if (!kind || !KINDS.includes(kind)) {
    console.error(`FAIL: <kind> must be one of ${KINDS.join(', ')} (got ${JSON.stringify(kind)})`);
    process.exitCode = 1;
    return;
  }
  if (!targetDir) {
    console.error('FAIL: a target directory is required.');
    process.exitCode = 1;
    return;
  }
  if (args.overlay && !OVERLAYS.includes(args.overlay)) {
    console.error(`FAIL: --overlay must be one of ${OVERLAYS.join(', ')} (got ${JSON.stringify(args.overlay)})`);
    process.exitCode = 1;
    return;
  }

  const absTarget = path.resolve(targetDir);
  if (!isEmptyDir(absTarget)) {
    console.error(`FAIL: ${absTarget} exists and is not empty — new-repo.mjs never overwrites.`);
    process.exitCode = 1;
    return;
  }

  const skeletonDir = path.join(templatesRoot, kind);
  if (!fs.existsSync(skeletonDir)) {
    console.error(`FAIL: no skeleton found at ${skeletonDir}`);
    process.exitCode = 1;
    return;
  }

  const filesWritten = [];
  copyDirRecursive(skeletonDir, absTarget);
  console.log(`copied skeleton: ${kind} -> ${absTarget}`);

  if (args.overlay) {
    const overlayDir = path.join(templatesRoot, `overlay-${args.overlay}`);
    if (!fs.existsSync(overlayDir)) {
      console.error(`FAIL: no overlay found at ${overlayDir}`);
      process.exitCode = 1;
      return;
    }
    copyDirRecursive(overlayDir, absTarget);
    console.log(`applied overlay: ${args.overlay}`);
  }

  const now = new Date();
  const values = {
    REPO_NAME: args.name || path.basename(absTarget),
    ORG: args.org || 'TheColliery',
    YEAR: args.year || String(now.getFullYear()),
    COPYRIGHT_HOLDER: args.holder || 'HetCreep',
    LICENSE_BADGE: args.license || 'Apache-2.0',
  };
  fillPlaceholders(absTarget, values);
  console.log(`filled placeholders: ${Object.keys(values).join(', ')}`);
  console.log('NOTE: remaining {{PLACEHOLDER}} tokens (content only a human can supply — tagline,');
  console.log('what-it-is, scope) are left in place; grep for "{{" before first push.');

  function listFiles(dir, prefix = '') {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = path.join(prefix, entry.name);
      if (entry.isDirectory()) listFiles(path.join(dir, entry.name), rel);
      else filesWritten.push(rel);
    }
  }
  listFiles(absTarget);
  console.log(`\n${filesWritten.length} file(s) written:`);
  for (const f of filesWritten.sort()) console.log(`  ${f}`);
}

main();
