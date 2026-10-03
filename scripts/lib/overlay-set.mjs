// overlay-set: the set of files one canon workflow of templates/overlay-coal-skill/ needs, and a room's copy of that set compared by blob id.
//
// WHY (UMB-348): a room adopted claude-ai-zips.yml without the release-notes.mjs it runs (its own copy was an older blob), and the run died
// at the Release step with a gh usage dump. An overlay is adopted as ONE set, never a pair. The set is DERIVED here from the workflow itself
// (every script it runs, every file those import, each file's test beside it), so no hand-kept list can rot, and a room's copy is judged
// file by file against the canon's blob ids.
//
// A blob id is git's (sha1 over "blob <size>" + NUL + the bytes) over LF-normalized bytes, so a CRLF working tree and an LF checkout of the
// same content agree. Zero dependencies: node builtins only.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const WORKFLOWS = ['claude-ai-zips.yml', 'create-release.yml'];
// Files the overlay does not carry because they are the room's own (OVERLAY-README.md names each).
export const ROOM_OWNED = ['scripts/verify.mjs', 'scripts/lib/desc-cap.mjs', 'scripts/lib/claude-ai-trim.mjs'];

export function blobId(buf) {
  const lf = Buffer.from(buf.toString('latin1').replace(/\r\n/g, '\n'), 'latin1');
  return createHash('sha1').update(`blob ${lf.length}\0`).update(lf).digest('hex');
}

const IMPORT = /from\s+['"](\.{1,2}\/[^'"]+\.mjs)['"]|import\(\s*['"](\.{1,2}\/[^'"]+\.mjs)['"]/g;

// The closure for one canon workflow: { workflow, files (overlay-relative, sorted), roomOwned (sorted), missing (sorted) }.
// `missing` is a defect in the overlay itself (a script the workflow runs that the overlay neither carries nor names as room-owned).
export function overlaySet(overlayDir, workflow) {
  if (!WORKFLOWS.includes(workflow)) throw new Error(`unknown overlay workflow ${JSON.stringify(workflow)} (one of ${WORKFLOWS.join(', ')})`);
  const wfRel = `.github/workflows/${workflow}`;
  const files = new Set([wfRel]);
  const roomOwned = new Set();
  const missing = new Set();
  const seen = new Set();
  const visit = (rel) => {
    if (seen.has(rel)) return;
    seen.add(rel);
    const abs = path.join(overlayDir, rel);
    if (!fs.existsSync(abs)) { (ROOM_OWNED.includes(rel) ? roomOwned : missing).add(rel); return; }
    files.add(rel);
    const test = rel.replace(/\.mjs$/, '.test.mjs');
    if (test !== rel && fs.existsSync(path.join(overlayDir, test))) files.add(test);
    for (const m of fs.readFileSync(abs, 'utf8').matchAll(IMPORT)) visit(path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[1] || m[2])));
  };
  const code = fs.readFileSync(path.join(overlayDir, wfRel), 'utf8').split(/\r?\n/).filter((l) => !/^\s*#/.test(l)).join('\n');
  for (const m of code.matchAll(/scripts\/([A-Za-z0-9._\/-]+\.mjs)/g)) visit('scripts/' + m[1]);
  const sorted = (s) => [...s].sort();
  return { workflow, files: sorted(files), roomOwned: sorted(roomOwned), missing: sorted(missing) };
}

// A room's copy of the set: which canon workflow it carries, and each file's verdict against the canon's blob id.
// rows: { file, status } with status 'identical' | 'DIFFERS (room <8> vs canon <8>)' | 'ABSENT' | 'present (room-owned)' | 'ABSENT (room-owned)'.
export function compareOverlaySet(roomDir, overlayDir) {
  const carried = WORKFLOWS.filter((w) => fs.existsSync(path.join(roomDir, '.github', 'workflows', w)));
  if (carried.length !== 1) return { carried, rows: [], problem: carried.length ? 'carries both overlay workflows (a room carries exactly one)' : null };
  const set = overlaySet(overlayDir, carried[0]);
  const rows = [];
  for (const file of set.files) {
    const live = path.join(roomDir, file);
    if (!fs.existsSync(live)) { rows.push({ file, status: 'ABSENT' }); continue; }
    const want = blobId(fs.readFileSync(path.join(overlayDir, file)));
    const got = blobId(fs.readFileSync(live));
    rows.push({ file, status: got === want ? 'identical' : `DIFFERS (room ${got.slice(0, 8)} vs canon ${want.slice(0, 8)})` });
  }
  for (const file of set.roomOwned) rows.push({ file, status: fs.existsSync(path.join(roomDir, file)) ? 'present (room-owned)' : 'ABSENT (room-owned)' });
  return { carried, rows, problem: null };
}
