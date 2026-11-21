// The config's file routes for scripts/configure.mjs (21d), ported from the rooms' exemplar: CoalFace's scripts/lib/repo-fs.mjs (CWK2-042, 17c), itself from CoalLedger's.
// Only what the template's configure.mjs needs. A room that walks agent folders or migrates an old config keeps its own, larger copy.
import fs from 'node:fs';

// A refusal written for a person: the path, what is wrong, what to do. configure.mjs prints it as one FAIL line, never a raw errno.
export class RepoWriteRefused extends Error {
  constructor(target, why, fix) {
    super(`${target}: ${why} -- ${fix} and re-run`);
    this.name = 'RepoWriteRefused';
    this.target = target;
  }
}

const TEMP_FIX = 'remove the leftover temp file or fix the folder';

// The largest config the tool reads. A config over this size is refused before anything parses it (the exemplar's number, CoalFace's MAX_CONFIG_BYTES).
export const MAX_CONFIG_BYTES = 1024 * 1024;

// Reads a config through ONE descriptor: the file type and the size are judged on that descriptor (fstat), then the same descriptor is read, so nothing is read that was not
// judged. A directory keeps EISDIR, a non-file gets ENOTFILE, an oversize file is refused with ECONFIGTOOLARGE and a message that names it.
export function readConfigBounded(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const st = fs.fstatSync(fd);
    if (!st.isFile()) {
      const e = new Error(`${file}: not a regular file`);
      e.code = st.isDirectory() ? 'EISDIR' : 'ENOTFILE';
      throw e;
    }
    if (st.size > MAX_CONFIG_BYTES) {
      const e = new Error(`${file}: config is larger than 1 MiB (${MAX_CONFIG_BYTES} bytes), so it is not read`);
      e.code = 'ECONFIGTOOLARGE';
      throw e;
    }
    const buf = Buffer.alloc(st.size);
    let got = 0;
    while (got < st.size) {
      const n = fs.readSync(fd, buf, got, st.size - got, got);
      if (n === 0) break;
      got += n;
    }
    return buf.subarray(0, got); // the BYTES (21e): the caller decodes them, and a backup is written from these same bytes, never from a second read by name
  } finally {
    fs.closeSync(fd);
  }
}

// node/runtime.md section 5: a state file the tool reads back later is NEVER rewritten in place. A plain writeFileSync follows a link (or a hard link) at the target and is torn
// by a kill mid-write. This writes a per-pid temp in the SAME directory, opened O_EXCL (a brand-new name, so a link planted at the temp name is never followed), then renames it
// over the target: a rename REPLACES the directory entry, it does not write through whatever the entry names, and a reader sees the old file or the new one. The failure branch
// keeps the old file, deletes the temp in finally, and never falls back to an in-place write. A REPLACED regular file keeps its own permission bits, and `modeFrom` names another
// regular file whose bits the result takes (a .bak takes its config's, what copyFileSync gave it); a new file keeps the default creation mode. The whole buffer goes through the
// descriptor (writeFileSync on an fd loops until every byte is out). Leaves open, named: the folder above the target swapped for a junction between the check and the temp's creation.
function modeOf(p) {
  try { const st = fs.lstatSync(p); return st.isFile() ? st.mode & 0o7777 : undefined; } catch { return undefined; }
}
export function writeFileAtomic(target, content, modeFrom = target) {
  const temp = `${target}.tmp-${process.pid}`;
  const mode = modeOf(modeFrom);
  let fd;
  try {
    fd = fs.openSync(temp, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL);
  } catch (e) {
    if (e.code === 'EEXIST') throw new RepoWriteRefused(target, `a leftover temp file blocks the write (${temp})`, TEMP_FIX);
    throw new RepoWriteRefused(target, `its temp file could not be made (${e.code})`, TEMP_FIX);
  }
  let renamed = false;
  try {
    try {
      if (mode !== undefined) { try { fs.fchmodSync(fd, mode); } catch { /* a volume with no POSIX bits keeps its own */ } }
      fs.writeFileSync(fd, content);
    } finally { fs.closeSync(fd); }
    try { fs.renameSync(temp, target); renamed = true; } catch (e) {
      throw new RepoWriteRefused(target, `it could not be replaced (${e.code}); an older copy is kept`, 'close whatever holds that file open, or make it a regular file');
    }
  } catch (e) {
    if (e instanceof RepoWriteRefused) throw e;
    throw new RepoWriteRefused(target, `it could not be written (${e.code || e.message})`, TEMP_FIX);
  } finally {
    if (!renamed) { try { fs.unlinkSync(temp); } catch {} }
  }
}
