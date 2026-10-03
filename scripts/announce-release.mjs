#!/usr/bin/env node
// announce-release: open an Announcements discussion on the organisation page for a published Release of a TheColliery repository.
// A machine mirror of a Release that is already published; nothing is hand-written. Read scripts/lib/announce-release.mjs for the why.
//
// Inputs come from the environment (the workflow sets them), never from flags:
//   INPUT_REPO          a TheColliery repository name; empty means "sweep" (every Release published in the last window)
//   INPUT_TAG           the vX.Y.Z tag to announce (needed with INPUT_REPO)
//   INPUT_POST          "true" posts; anything else is a dry run that prints what it would post and stops
//   INPUT_WINDOW_HOURS  sweep only: how far back a Release counts as new (default 48)
//   GH_TOKEN            the workflow token (discussions: write); read here, never printed
//
// Example: INPUT_REPO=CoalMine INPUT_TAG=v3.17.3 INPUT_POST=false GH_TOKEN=... node scripts/announce-release.mjs
// Exit:    0 done (or a dry run) · 1 a refusal or a failed post · 64 usage error
// Report a problem: TheColliery/.github issues. Zero dependencies.
import { run } from './lib/announce-release.mjs';

const USAGE = 'usage: INPUT_REPO=<repo> INPUT_TAG=<vX.Y.Z> [INPUT_POST=true] GH_TOKEN=<token> node scripts/announce-release.mjs | -h\n'
  + '  opens an Announcements discussion on the TheColliery organisation page for a published Release; INPUT_REPO empty = sweep the last INPUT_WINDOW_HOURS (48)\n'
  + '  without INPUT_POST=true it only prints what it would post\n'
  + '  example: INPUT_REPO=CoalMine INPUT_TAG=v3.17.3 GH_TOKEN=... node scripts/announce-release.mjs\n'
  + '  exit 0 done or dry run · 1 refused or failed · 64 usage error';

async function main(args, env) {
  if (args.includes('-h') || args.includes('--help')) { console.log(USAGE); return 0; }
  if (args.length) { console.error(`announce-release: takes no arguments, got ${JSON.stringify(args[0])}\n${USAGE}`); return 64; }
  const windowHours = env.INPUT_WINDOW_HOURS ? Number(env.INPUT_WINDOW_HOURS) : 48;
  if (!Number.isInteger(windowHours) || windowHours < 1 || windowHours > 24 * 31) { console.error('announce-release: INPUT_WINDOW_HOURS must be a whole number of hours from 1 to 744'); return 1; }
  const post = env.INPUT_POST === 'true';
  const counts = await run({ repo: env.INPUT_REPO || '', tag: env.INPUT_TAG || '', post, windowHours, token: env.GH_TOKEN });
  console.log(`done (${post ? 'posting' : 'dry run'}): ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')}`);
  return counts.failed ? 1 : 0;
}

try { process.exitCode = await main(process.argv.slice(2), process.env); } catch (e) { console.error(`announce-release: ${e && e.message ? e.message : e}`); process.exitCode = 1; }
