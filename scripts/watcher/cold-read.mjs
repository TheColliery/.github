#!/usr/bin/env node
// cold-read: read the COLD sources of one watcher instance by hand and print what changed, in the shape the digests use (the owner 2026-11-10: a source that rarely moves
// leaves the cron and is read by hand, "hot data and cold data"; the weekly round runs this).
//
// A source with `tier: 'cold'` stays in the instance's registry (sources/<instance>.mjs) and the cron skips it (pickRun). This command fetches each cold source one at a time with the
// watcher's own fetchSource (the same conditional GET, the same key per kind, the same ignoreTitle), compares it with its OWN last-seen state file, prints the change list, and records
// what it saw. A source that comes back to warm up again is one edit in the registry. It never sends mail and never touches the Worker's KV.
//
// Usage:   node scripts/watcher/cold-read.mjs <instance> [--state=<file>] [--dry-run]
// Example: node scripts/watcher/cold-read.mjs thecolliery
// Exit:    0 read (changes or none) · 1 a source failed to answer, or a state file that cannot be read · 64 usage error
// State:   scripts/watcher/cold-state-<instance>.json by default (git-ignored): { v: 1, sources: { <id>: { key, title, link, etag, lastModified } } }, written by a temp file and a rename.
//          The first run baselines every cold source and reports none as a change. --dry-run reads and prints and writes nothing.
// Output:  the digest text (Changed, Baselined, then Failing), then the machine-readable change list the digests end with. Report a problem: the repository's issues.
// Node builtins and watcher.mjs only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fetchSource, buildDigest } from './watcher.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INSTANCES = fs.readdirSync(path.join(HERE, 'sources')).filter((f) => f.endsWith('.mjs')).map((f) => f.slice(0, -4)).sort();
const USAGE = `usage: node scripts/watcher/cold-read.mjs <instance> [--state=<file>] [--dry-run] | -h\n  instances: ${INSTANCES.join(', ')}\n  example: node scripts/watcher/cold-read.mjs thecolliery`;

/** Read every cold source of `config` once, in order. Returns { results, next, text } and changes nothing: `next` is the state to write. Never throws for a source (a failure is a result). */
export async function coldRead({ config, state, fetchFn, now }) {
  const at = new Date(now).toISOString();
  const next = { v: 1, sources: { ...(state?.sources ?? {}) } };
  const results = [];
  const failing = [];
  for (const s of config.sources.filter((x) => x.tier === 'cold')) {
    const prev = next.sources[s.id];
    const r = await fetchSource(s, prev, fetchFn);
    if (r.status === 'changed' || r.status === 'new') {
      next.sources[s.id] = { key: r.key, title: r.to, link: r.link, etag: r.etag, lastModified: r.lastModified };
      results.push(r);
    } else if (r.status === 'same' && r.key) {
      next.sources[s.id] = { ...prev, etag: r.etag || prev?.etag || '', lastModified: r.lastModified || prev?.lastModified || '' };
    } else if (r.status === 'error') failing.push(r);
  }
  const digest = buildDigest({ at, instance: config.instance, results });
  const lines = [digest.text.trimEnd()];
  if (failing.length) {
    lines.push('', `Failing (${failing.length}):`, ...failing.map((r) => `  ${r.source.name} - ${r.error} (${r.source.url})`));
  }
  const cold = config.sources.filter((x) => x.tier === 'cold').length;
  lines.push('', `${cold} cold source(s) read, ${results.filter((r) => r.status === 'changed').length} changed, ${results.filter((r) => r.status === 'new').length} baselined, ${failing.length} failing`);
  return { results, failing, next, text: lines.join('\n') + '\n' };
}

function readState(file) {
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch (e) { if (e.code === 'ENOENT') return { v: 1, sources: {} }; throw e; }
  const j = JSON.parse(raw);
  if (!j || j.v !== 1 || typeof j.sources !== 'object') throw new Error('not a cold-read state file (v 1)');
  return j;
}
function writeState(file, state) {
  const tmp = `${file}.${process.pid}.tmp`;
  try { fs.writeFileSync(tmp, JSON.stringify(state, null, 1) + '\n'); fs.renameSync(tmp, file); } finally { fs.rmSync(tmp, { force: true }); }
}

async function main(argv) {
  if (argv.includes('-h') || argv.includes('--help')) { console.log(USAGE); return 0; }
  let instance = ''; let stateFile = ''; let dry = false;
  for (const a of argv) {
    if (a === '--dry-run') dry = true;
    else if (a.startsWith('--state=') && a.length > 8) stateFile = a.slice(8);
    else if (a.startsWith('-')) { console.error(`cold-read: unknown flag ${JSON.stringify(a)}\n${USAGE}`); return 64; }
    else if (!instance) instance = a;
    else { console.error(`cold-read: one instance only\n${USAGE}`); return 64; }
  }
  if (!INSTANCES.includes(instance)) { console.error(`cold-read: name an instance\n${USAGE}`); return 64; }
  const file = stateFile || path.join(HERE, `cold-state-${instance}.json`);
  let state;
  try { state = readState(file); } catch (e) { console.error(`cold-read: the state file ${file} cannot be read (${e.message})`); return 1; }
  const config = (await import(pathToFileURL(path.join(HERE, 'sources', `${instance}.mjs`)).href)).default;
  const r = await coldRead({ config, state, fetchFn: fetch, now: Date.now() });
  process.stdout.write(r.text);
  if (!dry) { try { writeState(file, r.next); } catch (e) { console.error(`cold-read: the state could not be written (${e.message})`); return 1; } }
  return r.failing.length ? 1 : 0;
}

const isEntry = () => {
  try { return fs.realpathSync.native(process.argv[1]) === fs.realpathSync.native(fileURLToPath(import.meta.url)); } catch { return true; }
};
if (process.argv[1] && isEntry()) process.exitCode = await main(process.argv.slice(2));
