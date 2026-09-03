// {{TOOL}} configurator — edit .{{TOOL}}.json from the command line.
// Flags, parsing, validation, and help all come from one table
// (scripts/lib/config-schema.mjs, shared with verify.mjs): a key added there
// is automatically settable, validated, and documented here.
//
// Simplified from CoalMine's exemplar (scripts/configure.mjs, live
// 2026-09-03) — CoalMine additionally walks THREE agent-config-dir shapes
// (.claude/.agents/.gemini) plus a legacy root dotfile, per its own
// namespace-campaign migration (TheColliery MEMORY.md's 2026-08-08 entry).
// That extra cascade is CoalMine-specific migration history, not a shape
// every new tool needs on day one — this skeleton keeps the TWO-TIER
// cascade (global ~/.claude/.{{TOOL}}.json, project <gitroot>/.{{TOOL}}.json,
// project wins per key) that every Coal*-shaped tool ships per the umbrella's
// 5 Standard Systems #1 (config). Port CoalMine's own config-paths.mjs
// walk later if this tool ever needs multi-agent-dir config discovery.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { CONFIG_SCHEMA, validateValue } from './lib/config-schema.mjs';

function findGitRoot(startDir) {
  let dir = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}

function printHelp() {
  const lines = [
    '{{TOOL}} Configurator Utility',
    'Usage: node scripts/configure.mjs [options]',
    '',
    'Options:',
  ];
  for (const spec of CONFIG_SCHEMA) {
    const flags = [`--${spec.key}`, ...(spec.flags || [])].join(', ');
    lines.push(`  ${flags.padEnd(48)} ${spec.help}`);
  }
  lines.push(`  ${'--global'.padEnd(48)} Write ~/.claude/.{{TOOL}}.json (the global layer) instead of the project config`);
  lines.push(`  ${'--help, -h'.padEnd(48)} Show this help message`);
  console.log(lines.join('\n'));
}

// Parse one raw CLI value against a spec. Returns { value } or { error }.
function parseValue(spec, raw) {
  switch (spec.type) {
    case 'bool': {
      if (raw !== 'true' && raw !== 'false') return { error: `${spec.key} needs true or false` };
      return { value: raw === 'true' };
    }
    case 'int': {
      const n = Number(raw);
      const err = validateValue(spec, n);
      if (err) return { error: `${spec.key} ${err}` };
      return { value: n };
    }
    case 'enum': {
      const v = (raw || '').toLowerCase();
      if (!spec.values.includes(v)) return { error: `${spec.key} must be one of: ${spec.values.join(', ')}` };
      if (spec.titleCase && v !== 'auto') return { value: v.charAt(0).toUpperCase() + v.slice(1) };
      return { value: v };
    }
    case 'strArr': {
      if (raw === undefined) return { error: `${spec.key} needs a comma-separated value (pass "" to clear the list)` };
      if (raw === '' || raw === '""') return { value: [] };
      let items = raw.split(',').map((s) => s.trim()).filter(Boolean);
      if (spec.lower) items = items.map((s) => s.toLowerCase());
      return { value: items };
    }
    default:
      return { error: `internal: unknown spec type '${spec.type}'` };
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  const globalIdx = args.indexOf('--global');
  const isGlobal = globalIdx !== -1;
  if (isGlobal) args.splice(globalIdx, 1);
  const projectRoot = findGitRoot(process.cwd());
  const readPath = isGlobal
    ? path.join(os.homedir(), '.claude', '.{{TOOL}}.json')
    : path.join(projectRoot, '.{{TOOL}}.json');

  let cfg = {};
  let rawConfig = null;
  try { rawConfig = fs.readFileSync(readPath, 'utf8').replace(/^﻿/, ''); } catch {}
  if (rawConfig !== null) {
    try {
      cfg = JSON.parse(rawConfig) || {};
    } catch (e) {
      process.exitCode = 1;
      try {
        fs.copyFileSync(readPath, readPath + '.bak');
        console.warn(`Warning: existing config is malformed — backed it up to ${readPath}.bak and rebuilding.`);
      } catch {
        console.warn('Warning: existing config is malformed. Overwriting.');
      }
    }
  }

  const flagMap = new Map();
  for (const spec of CONFIG_SCHEMA) {
    flagMap.set(`--${spec.key}`, spec);
    for (const f of spec.flags || []) flagMap.set(f, spec);
  }

  for (let i = 0; i < args.length; i++) {
    const spec = flagMap.get(args[i]);
    if (!spec) {
      console.error(`Error: Unrecognized option '${args[i]}'`);
      printHelp();
      process.exit(1);
    }
    const parsed = parseValue(spec, args[++i]);
    if (parsed.error) {
      console.error(`Error: ${parsed.error}`);
      process.exit(1);
    }
    cfg[spec.key] = parsed.value;
  }

  try {
    fs.mkdirSync(path.dirname(readPath), { recursive: true });
    fs.writeFileSync(readPath, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
    console.log(`Successfully updated configuration in: ${readPath}`);
    console.log(JSON.stringify(cfg, null, 2));
  } catch (e) {
    console.error(`Error: Failed to write to config file: ${e.message}`);
    process.exit(1);
  }
}

main();
