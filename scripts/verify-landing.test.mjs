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
    assert.match(f, /'NoRow' has NO org-landing row/, 'catches the missing org-row');
    assert.match(f, /'Undated' has NO dated record/, 'catches the undated record');
    assert.doesNotMatch(f, /'HasRow' has NO/, 'a compliant benchmark is not flagged');
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
