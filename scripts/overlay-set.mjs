#!/usr/bin/env node
// overlay-set: print the adoption set of a canon overlay workflow with each file's blob id, the way a room compares its copy.
//
// A room adopts templates/overlay-coal-skill/ as ONE set: the workflow, every script it runs, every file those import, and each
// file's test. Two blobs alone broke a room's tag-push run (the workflow ran a script the room had not updated). This prints the
// set, derived from the workflow itself, so the list cannot rot. A room checks a copy with `git hash-object <file>` against the
// blob column; `node scripts/skeleton-check.mjs` does it for every live room.
//
// Usage:   node scripts/overlay-set.mjs [claude-ai-zips.yml | create-release.yml]   (no argument: both)
// Example: node scripts/overlay-set.mjs create-release.yml
// Output:  one line per file, "<blob id>  <path>", then "room-owned  <path>" for the files the room writes itself.
// Exit:    0 done · 1 the overlay is not closed (a script the workflow runs is neither in it nor room-owned) · 64 usage error
// Report a problem: TheColliery/.github issues. Zero dependencies: node builtins only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORKFLOWS, overlaySet, blobId } from './lib/overlay-set.mjs';

const OVERLAY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'templates', 'overlay-coal-skill');
const USAGE = `usage: node scripts/overlay-set.mjs [${WORKFLOWS.join(' | ')}] | -h\n`
  + '  prints each file of the overlay set for that workflow with its blob id (no argument: both workflows)\n'
  + '  example: node scripts/overlay-set.mjs create-release.yml\n'
  + '  exit 0 done · 1 the overlay is not closed · 64 usage error';

function main(args) {
  if (args.includes('-h') || args.includes('--help')) { console.log(USAGE); return 0; }
  const flag = args.find((a) => a.startsWith('-'));
  if (flag || args.length > 1) { console.error(`overlay-set: ${flag ? `unknown flag ${JSON.stringify(flag)}` : 'expected at most one workflow name'}\n${USAGE}`); return 64; }
  if (args[0] && !WORKFLOWS.includes(args[0])) { console.error(`overlay-set: ${JSON.stringify(args[0])} is not an overlay workflow\n${USAGE}`); return 64; }
  let code = 0;
  for (const wf of args[0] ? [args[0]] : WORKFLOWS) {
    const set = overlaySet(OVERLAY, wf);
    console.log(`# ${wf} (${set.files.length} files + ${set.roomOwned.length} room-owned)`);
    for (const f of set.files) console.log(`${blobId(fs.readFileSync(path.join(OVERLAY, f)))}  ${f}`);
    for (const f of set.roomOwned) console.log(`room-owned  ${f}`);
    for (const f of set.missing) { console.error(`overlay-set: ${wf} runs ${f}, which the overlay neither carries nor names as room-owned`); code = 1; }
  }
  return code;
}

try { process.exitCode = main(process.argv.slice(2)); } catch (e) { console.error(`overlay-set: ${e && e.message ? e.message : e}`); process.exitCode = 1; }
