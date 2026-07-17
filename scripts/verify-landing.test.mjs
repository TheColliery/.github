import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { verifyLanding } from './verify-landing.mjs';

// hermetic fixture builder — sandboxed under os.tmpdir(), cleaned by the caller
function fixture(build) {
  const root = mkdtempSync(join(tmpdir(), 'verify-landing-'));
  try { build(root); return root; } catch (e) { rmSync(root, { recursive: true, force: true }); throw e; }
}
const write = (root, rel, content) => {
  const p = join(root, rel);
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, content);
};

test('clean landing → no failures', () => {
  const root = fixture((r) => {
    write(r, 'profile/README.md',
      '# Org\n\n## 📊 Benchmarks\n\n| Tool | Result |\n|---|---|\n| **FakeTool** | measured 2026-07-03 |\n\nSee records.\n');
    write(r, 'benchmarks/FakeTool/RESULTS.md', '# FakeTool result\n\nMeasured 2026-07-03. All English.\n');
  });
  try {
    assert.deepEqual(verifyLanding(root), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('catches Thai leak, missing org-row, and undated record', () => {
  const thai = 'นี่คือ';
  const root = fixture((r) => {
    write(r, 'profile/README.md',
      '# Org\n\n## 📊 Benchmarks\n\n| Tool | Result |\n|---|---|\n| **HasRow** | measured 2026-07-03 |\n');
    write(r, 'benchmarks/HasRow/RESULTS.md', '# ok\nMeasured 2026-07-03.\n');            // compliant
    write(r, 'benchmarks/NoRow/RESULTS.md', '# no row\nMeasured 2026-07-03.\n');          // missing org-row
    write(r, 'benchmarks/Undated/RESULTS.md', `# undated\nNo date. ${thai} leaked.\n`);   // no date + Thai leak
  });
  try {
    const f = verifyLanding(root).join('\n');
    assert.match(f, /THAI in front-door/, 'catches the Thai leak');
    assert.match(f, /'NoRow' is NOT listed in the Benchmarks section/, 'catches the missing org-row');
    assert.match(f, /'Undated' has NO dated record/, 'catches the undated record');
    assert.doesNotMatch(f, /'HasRow' has NO/, 'a compliant benchmark is not flagged');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('catches a benchmark missing from a SECOND enumerating surface (README.md, not just profile)', () => {
  const root = fixture((r) => {
    // profile lists BOTH tools...
    write(r, 'profile/README.md',
      '# Org\n\n## 📊 Benchmarks\n\n| Tool | Result |\n|---|---|\n| **Listed** | 2026-07-03 |\n| **DroppedFromReadme** | 2026-07-03 |\n');
    // ...but the repo README "Series Benchmarks" lists only ONE (the drift the profile-only check missed)
    write(r, 'README.md',
      '# Repo\n\n## 📊 Series Benchmarks\n\n* **Listed** -- ok. Results: [x](x).\n\n## Next\n');
    write(r, 'benchmarks/Listed/RESULTS.md', '# ok\nmeasured 2026-07-03\n');
    write(r, 'benchmarks/DroppedFromReadme/RESULTS.md', '# ok\nmeasured 2026-07-03\n');
  });
  try {
    const f = verifyLanding(root).join('\n');
    assert.match(f, /'DroppedFromReadme' is NOT listed in the Benchmarks section of README\.md/, 'catches the README.md enumeration miss');
    assert.doesNotMatch(f, /'Listed' is NOT listed/, 'the tool present in both surfaces is not flagged');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('catches an ORPHAN benchmark row — a landing row with no backing dir (bidirectional)', () => {
  const root = fixture((r) => {
    // the Benchmarks table lists Real AND Orphan, but only Real has a benchmarks/ dir
    write(r, 'profile/README.md',
      '# Org\n\n## 📊 Benchmarks\n\n| Tool | Result |\n|---|---|\n| **Real** | 2026-07-03 |\n| **Orphan** | 2026-07-03 |\n');
    write(r, 'benchmarks/Real/RESULTS.md', '# ok\nmeasured 2026-07-03\n');
    // no benchmarks/Orphan/ dir on purpose — the reverse of the enumeration miss
  });
  try {
    const f = verifyLanding(root).join('\n');
    assert.match(f, /lists 'Orphan' but there is NO benchmarks\/Orphan\/ dir/, 'catches the orphan row (reverse direction)');
    assert.doesNotMatch(f, /lists 'Real' but there is NO/, 'a row with a backing dir is not flagged');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('catches an ORPHAN row in a `*`-bullet README list (the reverse check sees `*` bullets, not only `|`/`-`)', () => {
  const root = fixture((r) => {
    write(r, 'profile/README.md',
      '# Org\n\n## 📊 Benchmarks\n\n| Tool | Result |\n|---|---|\n| **Backed** | 2026-07-03 |\n');
    // repo README "Series Benchmarks" uses `*` bullets (the real shape) and carries an ORPHAN
    write(r, 'README.md',
      '# Repo\n\n## 📊 Series Benchmarks\n\n* **Backed** -- ok. Results: [x](x).\n* **GhostBullet** -- no dir backs this. Results: [x](x).\n\n## Next\n');
    write(r, 'benchmarks/Backed/RESULTS.md', '# ok\nmeasured 2026-07-03\n');
    // no benchmarks/GhostBullet/ — a `-`/`|`-only regex would miss this orphan on a `*` list
  });
  try {
    const f = verifyLanding(root).join('\n');
    assert.match(f, /lists 'GhostBullet' but there is NO benchmarks\/GhostBullet\/ dir/, 'catches the orphan in a `*`-bullet list');
    assert.doesNotMatch(f, /lists 'Backed' but there is NO/, 'a `*`-bullet row with a backing dir is not flagged');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('lang-exempt marker suppresses the Thai flag (intentional translation data)', () => {
  const thai = 'เว้นแต่ในกรณีที่';
  const root = fixture((r) => {
    write(r, 'profile/README.md',
      '# Org\n\n## 📊 Benchmarks\n\n| Tool | Result |\n|---|---|\n| **Trans** | measured 2026-07-03 |\n');
    write(r, 'benchmarks/Trans/RESULTS.md',
      `<!-- lang-exempt: translation-benchmark data (scored Thai output) -->\n# Trans\nMeasured 2026-07-03. Model said ${thai}.\n`);
  });
  try {
    assert.deepEqual(verifyLanding(root), [], 'marked Thai is allowed');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// --- M12 remainder (CoalBoard nasa audit 2026-07-09): impossible dates + a permanent
// "pending" bypass — the row->dir bidirectional check shipped earlier that day covered
// a fabricated ORPHAN row, not a fabricated DATE or a stale pending claim.

test('an impossible date (month/day out of range) does not count as "dated"', () => {
  const root = fixture((r) => {
    write(r, 'profile/README.md',
      '# Org\n\n## 📊 Benchmarks\n\n| Tool | Result |\n|---|---|\n| **BadDate** | 2026-99-99 |\n');
    write(r, 'benchmarks/BadDate/RESULTS.md', '# BadDate\nMeasured 2026-99-99 (bogus month+day).\n');
  });
  try {
    const f = verifyLanding(root).join('\n');
    assert.match(f, /'BadDate' has NO dated record/, 'an out-of-range month/day never satisfies the date check');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a "first run pending" digest alongside a real dated record is a contradiction → fail', () => {
  const root = fixture((r) => {
    write(r, 'profile/README.md',
      '# Org\n\n## 📊 Benchmarks\n\n| Tool | Result |\n|---|---|\n| **StalePending** | — |\n');
    write(r, 'benchmarks/StalePending/RESULTS.md', '**Measured:** — *(first run pending)*\n');
    write(r, 'benchmarks/StalePending/results/run-2026-07-09.md', '# Run\nMeasured 2026-07-09. Real numbers here.\n');
  });
  try {
    const f = verifyLanding(root).join('\n');
    assert.match(f, /'StalePending': digest says "first run pending" but a dated record exists/, 'flags the pending+dated contradiction');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a "first run pending" digest with NO record anywhere is legal (honest launch state)', () => {
  const root = fixture((r) => {
    write(r, 'profile/README.md',
      '# Org\n\n## 📊 Benchmarks\n\n| Tool | Result |\n|---|---|\n| **FreshLaunch** | — |\n');
    write(r, 'benchmarks/FreshLaunch/RESULTS.md', '**Measured:** — *(first run pending)*\n');
  });
  try {
    assert.deepEqual(verifyLanding(root), [], 'pending with no backing record anywhere is not flagged');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
