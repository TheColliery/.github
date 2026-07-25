#!/usr/bin/env node
// CANONICAL TEMPLATE — copy to <skill-repo>/scripts/build-claudeai-zips.mjs
// Driven by .github/workflows/zip-skills.yml. Shape owner: SKILL-REPO-PATTERN.md Layer 5.
//
// Packages each shipped skill folder into a claude.ai-uploadable ZIP.
//   node scripts/build-claudeai-zips.mjs <repo-name> <out-dir> [--check-only] [--stamp <iso>]
//
// The logic lives HERE, not inline in the workflow, so every gate below can be exercised
// locally against a fixture — a gate nobody has watched fail is a guess.
//
// --check-only runs every gate and builds nothing: the preflight a maintainer runs before
// tagging, and the mode the negative tests drive.
//
// Source of truth = plugin/skills/ (the RENDERED dist). Never skills/ — that tree still
// carries unexpanded <!-- SHARED:* --> markers, so a zip built from it ships broken text.
// NO claude.ai adaptation happens here: a shipped SKILL body is platform-neutral by
// contract. Platform wording belongs in the SKILL body, reviewable, never in packaging.

import { existsSync, readdirSync, statSync, readFileSync, mkdirSync, utimesSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const SRC = join('plugin', 'skills');
// A claude.ai upload is JUST the skill folder, so a body pointing outside it ships a
// dangling instruction. ponytail: string heuristic, not a proof — widen if a new escape
// form appears; the cost of a miss is a broken package, so it fails closed.
const ESCAPES = [/<plugin root>/, /\$\{CLAUDE_PLUGIN_ROOT\}/, /\.\.\//];

function die(msg) {
  console.error(`::error::${msg}`);
  process.exit(1);
}

function touchAll(dir, when) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) touchAll(p, when);
    else utimesSync(p, when, when);
  }
  utimesSync(dir, when, when);
}

// Parse in one pass: --stamp consumes its value, so it can appear in any position and can
// never be mistaken for a positional. (An indexOf-based read returns argv[0] when the flag
// is absent — caught by the local gate run before this ever reached a runner.)
const argv = process.argv.slice(2);
const flags = new Set();
const positional = [];
let stampArg;
for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i];
  if (a === '--stamp') { stampArg = argv[i + 1]; i += 1; continue; }
  if (a.startsWith('--')) { flags.add(a); continue; }
  positional.push(a);
}
const [repo, outDir] = positional;
if (!repo) die('usage: build-claudeai-zips.mjs <repo-name> <out-dir> [--check-only] [--stamp <iso>]');

// GATE 1 — the dist must exist. A tag cut without a build would otherwise publish nothing.
if (!existsSync(SRC)) die(`${SRC} missing — the dist was not built before the tag`);

const skills = readdirSync(SRC, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith('_')) // _shared/ is not a skill
  .map((e) => e.name)
  .sort();

for (const skill of skills) {
  const dir = join(SRC, skill);
  // GATE 2 — a skill folder without its contract is not a package.
  if (!existsSync(join(dir, 'SKILL.md'))) die(`${skill} has no SKILL.md`);
  // GATE 3 — self-containment.
  const body = readFileSync(join(dir, 'SKILL.md'), 'utf8');
  const hit = ESCAPES.find((re) => re.test(body));
  if (hit) {
    die(
      `${skill} references a path outside its own folder (${hit.source}) — make the skill ` +
        `folder self-contained before packaging it (see CLAUDE-AI-INSTALL.md)`,
    );
  }
}

// GATE 4 — an empty build is a silent no-op; fail instead of publishing nothing.
if (skills.length === 0) die(`no skill folders found under ${SRC}`);

if (flags.has('--check-only')) {
  console.log(`check-only: ${skills.length} skill(s) packageable — ${skills.join(', ')}`);
  process.exit(0);
}

if (!outDir) die('an out-dir is required unless --check-only');
mkdirSync(outDir, { recursive: true });

// Deterministic bytes: one fixed mtime for every entry, sorted input, and -X to drop
// platform extra-attributes. Two builds of the same tag must be byte-identical.
const when = new Date(stampArg ?? '2020-01-01T00:00:00Z');
if (Number.isNaN(when.getTime())) die(`--stamp is not a valid date: ${stampArg}`);

let built = 0;
for (const skill of skills) {
  touchAll(join(SRC, skill), when);
  const zipPath = join(resolve(outDir), `${repo.toLowerCase()}-${skill}-claudeai.zip`);
  // Run from inside plugin/skills so the archive extracts to <skill>/SKILL.md, never a
  // bare SKILL.md. skill-meta.json is build metadata — not shipped to users.
  const r = spawnSync('zip', ['-rqX', zipPath, skill, '-x', `${skill}/skill-meta.json`], {
    cwd: SRC,
    stdio: 'inherit',
  });
  if (r.error || r.status !== 0) die(`zip failed for ${skill} (${r.error?.message ?? `exit ${r.status}`})`);
  if (!existsSync(zipPath) || statSync(zipPath).size === 0) die(`zip produced nothing for ${skill}`);

  // GATE 5 — the archive verifies ITSELF before anyone uploads it. claude.ai rejects a
  // bare SKILL.md, so "extracts to <skill>/SKILL.md" is the property that must hold on
  // every run, not once in a manual spot-check.
  const list = spawnSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' });
  if (list.error || list.status !== 0) die(`cannot read back the archive for ${skill}`);
  const entries = list.stdout.split('\n').map((s) => s.trim()).filter(Boolean);
  if (entries.length === 0) die(`${skill}: archive is empty`);
  const stray = entries.find((e) => !e.startsWith(`${skill}/`));
  if (stray) die(`${skill}: entry "${stray}" is not under ${skill}/ — it would extract as a bare file`);
  if (!entries.includes(`${skill}/SKILL.md`)) die(`${skill}: archive has no ${skill}/SKILL.md`);
  const meta = entries.find((e) => e.endsWith('skill-meta.json'));
  if (meta) die(`${skill}: build metadata leaked into the package (${meta})`);

  built += 1;
}

console.log(`built ${built} zip(s) into ${outDir}`);
