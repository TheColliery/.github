#!/usr/bin/env node
// front-door-links: every outward http(s) link of the named markdown files answers, at the page it names (UMB3-035 row C9, order 16i).
// The engine and its reasons: scripts/lib/front-door-links.mjs. Run by .github/workflows/front-door-links.yml on every change to a front door and
// on a weekly clock, and by hand before a README ships a new link.
//
// Usage:   node scripts/front-door-links.mjs [--skip-host=<host>]... <file.md> [<file.md> ...]
// Example: node scripts/front-door-links.mjs README.md SECURITY.md
// Exit:    0 every link answers, or only images warn · 1 a finding, or a file that cannot be read · 64 usage error
// Env:     FRONT_DOOR_LINKS_TIMEOUT_MS (per request, default 10000) · FRONT_DOOR_LINKS_RETRY_MS (the pause before the one retry, default 2000)
//          GITHUB_TOKEN (read by name, optional): a github.com repository, account or file (blob) link that still answers 5xx after the retry is asked once of the REST API with it
// Output:  one `FAIL <file>:<line>: <url>: <why>` line per finding, one `WARN ...` line per image whose host timed out, answered a 5xx or a 429 (a warning
//          never fails the run: an image says nothing about the repository, orders 27d and 27e), then the summary line. Under GitHub Actions
//          (GITHUB_ACTIONS=true) each WARN line is also printed as a `::warning file=<file>,line=<line>::` workflow command, so a warning shows on the
//          run page and the pull request of a green run. Report a problem: the repository's issues.
// Node builtins only at the top level (node/runtime.md section 1): the engine is imported inside the try, so a missing engine is a FAIL line, never a stack.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const USAGE = 'usage: node scripts/front-door-links.mjs [--skip-host=<host>]... <file.md> [<file.md> ...] | -h\n'
  + '  fetches every http(s) link of the files (fenced and inline code excluded) and fails on one that does not answer at the page it names\n'
  + '  example: node scripts/front-door-links.mjs README.md SECURITY.md\n'
  + '  exit 0 every link answers, or only images warn · 1 a finding or an unreadable file · 64 usage error';

const env = (k, d) => (Number(process.env[k]) > 0 ? Number(process.env[k]) : d);

// A front door is a page a visitor reads, so a named file is read only as a regular file under a byte bound (ours: 4 MiB, far past any README),
// checked on the open descriptor before the read: a device or a pipe in its place has no end to read to. The open comes first (a stat of the name
// before it is a race), refuses a link where the platform can (O_NOFOLLOW) and never waits on a pipe (O_NONBLOCK); where it cannot (Windows), the
// name is checked for a link after the open. The descriptor must also be the file the name names now (dev and ino): a name that holds another file is
// refused before any read. The read itself stops at the bound plus one byte, so a file that grows after the size check is refused too. The same shape
// as release-notes.mjs's readChangelog.
const MAX_FILE_BYTES = 4194304;
const OPEN_FLAGS = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0);
const LINK_OPEN_ERRORS = new Set(['ELOOP', 'EMLINK', 'EFTYPE']); // what an O_NOFOLLOW open of a link fails with (Linux and macOS, FreeBSD, NetBSD)
function readBounded(f) {
  const notRegular = () => Object.assign(new Error('not a regular file'), { code: 'not a regular file' });
  let fd;
  try { fd = fs.openSync(f, OPEN_FLAGS); } catch (e) { throw e && LINK_OPEN_ERRORS.has(e.code) ? notRegular() : e; }
  try {
    const st = fs.fstatSync(fd, { bigint: true });
    const named = fs.lstatSync(f, { bigint: true });
    if (!st.isFile() || named.isSymbolicLink()) throw notRegular();
    if (named.dev !== st.dev || named.ino !== st.ino) throw Object.assign(new Error('changed'), { code: 'changed between the check and the read: refused, never read' });
    if (st.size > MAX_FILE_BYTES) throw Object.assign(new Error('too large'), { code: `${st.size} bytes, past the byte bound of ${MAX_FILE_BYTES}` });
    const chunks = [];
    let total = 0;
    const chunk = Buffer.alloc(65536);
    for (let n; (n = fs.readSync(fd, chunk, 0, Math.min(chunk.length, MAX_FILE_BYTES + 1 - total), null)) > 0;) {
      chunks.push(Buffer.from(chunk.subarray(0, n)));
      total += n;
      if (total > MAX_FILE_BYTES) throw Object.assign(new Error('too large'), { code: `more than ${MAX_FILE_BYTES} bytes by the read (it grew after the size check), past the byte bound of ${MAX_FILE_BYTES}` });
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally { fs.closeSync(fd); }
}

// A file name, a link or a server's redirect target can carry a control character (C0, DEL, C1, a line or paragraph separator). Each is written as
// its code point, so no FAIL line can be forged, split or erased on the terminal or in a log that parses these lines (CWE-117).
const BACKSLASH = String.fromCharCode(92);
// 27g (the auditor's LOW 2): the runner's older command parser reads `##[` ANYWHERE in a line (actions/runner, ActionCommand.cs TryParse), so a URL
// holding it would turn a WARN or FAIL line into a legacy runner command; the second `#` is written as its code point, which leaves no `##[` behind.
const LEGACY_MARK = '##[';
const printable = (s) => Array.from(String(s), (ch) => {
  const c = ch.codePointAt(0);
  return c < 0x20 || (c >= 0x7f && c <= 0x9f) || c === 0x2028 || c === 0x2029 ? `${BACKSLASH}u{${c.toString(16)}}` : ch;
}).join('').split(LEGACY_MARK).join(`#${BACKSLASH}u{23}[`);
// A GitHub Actions workflow command carries its values escaped the way the runner's own toolkit escapes them (@actions/core command.ts): data
// `%` CR LF, a property also `:` and `,`. So a file name or a URL can neither end the annotation early nor change its file or line.
const escData = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
const escProp = (s) => escData(s).replace(/:/g, '%3A').replace(/,/g, '%2C');
// 27g (the auditor's LOW 3) and 28a (its 27i LOW 2, the order pinned): an annotation's file and data pass printable FIRST, so a control character is a
// visible code point before the toolkit's escaping guards `%` (and, in a property, `:` and `,`). Exported so a unit test can hold the order.
export const annotationFile = (f) => escProp(printable(f));
export const annotationData = (s) => escData(printable(s));

async function main(argv) {
  if (argv.includes('-h') || argv.includes('--help')) { console.log(USAGE); return 0; }
  const skipHosts = [];
  const files = [];
  for (const a of argv) {
    if (a.startsWith('--skip-host=') && a.length > '--skip-host='.length) skipHosts.push(a.slice('--skip-host='.length).toLowerCase());
    else if (a.startsWith('-')) { console.error(`front-door-links: unknown flag ${JSON.stringify(a)}\n${USAGE}`); return 64; }
    else files.push(a);
  }
  if (!files.length) { console.error(`front-door-links: no file given\n${USAGE}`); return 64; }
  let fails = 0;
  const texts = [];
  for (const f of files) {
    try { texts.push({ name: f, text: readBounded(f) }); } catch (e) { console.log(`FAIL ${printable(f)}: cannot be read (${printable(e.code || e.message)})`); fails++; }
  }
  let summary = '';
  let warned = 0;
  try {
    const lib = await import(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), 'lib', 'front-door-links.mjs')).href);
    const r = await lib.checkFiles(texts, { timeoutMs: env('FRONT_DOOR_LINKS_TIMEOUT_MS', lib.DEFAULT_TIMEOUT_MS), retryMs: env('FRONT_DOOR_LINKS_RETRY_MS', lib.DEFAULT_RETRY_MS), skipHosts, token: process.env.GITHUB_TOKEN || '' });
    for (const x of r.findings) console.log(`FAIL ${printable(x.file)}:${x.line}: ${printable(x.url)}: ${printable(x.message)}`);
    fails += r.findings.length;
    const why = ' (an image: its host\'s answer says nothing about this repository, so it does not fail the run)';
    for (const x of r.warnings) {
      console.log(`WARN ${printable(x.file)}:${x.line}: ${printable(x.url)}: ${printable(x.message)}${why}`);
      // 27g (the auditor's LOW 3): the annotation passes the same printable rule as the plain lines first, then the toolkit's escaping
      if (process.env.GITHUB_ACTIONS === 'true') console.log(`::warning file=${annotationFile(x.file)},line=${x.line},title=front-door-links::${annotationData(`${x.url}: ${x.message}${why}`)}`);
    }
    warned = r.warnings.length;
    summary = `${r.links} link(s) in ${texts.length} file(s), ${r.fetched} fetched${r.skipped.length ? `, ${r.skipped.length} skipped by host` : ''}`;
  } catch (e) {
    console.log(`FAIL front-door-links: the engine could not run (${printable(e && e.message ? e.message : e)})`);
    fails++;
  }
  console.log(`${fails} finding(s)${warned ? `, ${warned} warning(s)` : ''}${summary ? `; ${summary}` : ''}`);
  return fails ? 1 : 0;
}

// 28a: run only as the entry point, so a test can import the helpers above without running the check. 28e: the shape six scripts here already carry
// (e0eba02; copied from templates/overlay-coal-skill/scripts/lib/machine-reading.mjs, isMainModule): Node realpaths the module, argv[1] keeps the caller's
// spelling (a link's), so both sides go through one resolver; where a real path cannot be resolved, file identity (stat follows a link, so a symlinked
// folder still matches; a zero inode is no identity); last, the plain resolved paths. A path that names no file matches nothing, so an import never runs
// the check (28c's `catch { return true; }` ran it on import, the shape e0eba02 retired). Node's import.meta.main was weighed and not taken: it exists
// only from 22.18.0 and 24.2.0 (Stability 1.0).
// dev:ino of what a path names, or null where the volume gives none (stat fails, or answers ino 0: a zero id would make any two files one)
function fileIdentity(p) {
  try {
    const s = fs.statSync(p, { bigint: true });
    return s.ino === 0n ? null : `${s.dev}:${s.ino}`;
  } catch {
    return null;
  }
}
function isMainModule(url) {
  if (!process.argv[1]) return false;
  const self = fileURLToPath(url);
  try {
    return fs.realpathSync.native(self) === fs.realpathSync.native(process.argv[1]);
  } catch {
    const a = fileIdentity(self);
    const b = fileIdentity(process.argv[1]);
    return a !== null && b !== null ? a === b : path.resolve(self) === path.resolve(process.argv[1]);
  }
}
if (isMainModule(import.meta.url)) process.exitCode = await main(process.argv.slice(2));
