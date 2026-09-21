import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  hasRepoPrefix,
  isBareVersionTitle,
  separatorClass,
  hasEmoji,
  hasPsObjectLeak,
  checkRelease,
  launchFormTag,
} from './lib/release-conform-lib.mjs';

// --- hasRepoPrefix ---

test('hasRepoPrefix: flags a leading repo name', () => {
  assert.equal(hasRepoPrefix('CoalWash v1.1.0 - fidelity gate', 'CoalWash'), true);
  assert.equal(hasRepoPrefix('CoalWash: v1.1.0 - fidelity gate', 'CoalWash'), true);
  assert.equal(hasRepoPrefix('CoalWash-v1.1.0 - fidelity gate', 'CoalWash'), true);
});

test('hasRepoPrefix: a bare version title has no prefix', () => {
  assert.equal(hasRepoPrefix('v1.1.0 - fidelity gate', 'CoalWash'), false);
});

test('hasRepoPrefix: is case-insensitive', () => {
  assert.equal(hasRepoPrefix('coalwash v1.1.0 - x', 'CoalWash'), true);
});

test('hasRepoPrefix: a repo name appearing mid-summary is not a leading prefix', () => {
  assert.equal(hasRepoPrefix('v1.1.0 - fixes a CoalWash edge case', 'CoalWash'), false);
});

// --- isBareVersionTitle ---

test('isBareVersionTitle: a version alone is bare', () => {
  assert.equal(isBareVersionTitle('v1.1.0'), true);
  assert.equal(isBareVersionTitle('1.1.0'), true);
  assert.equal(isBareVersionTitle('v1.1.0  '), true);
});

test('isBareVersionTitle: a version with a summary is not bare', () => {
  assert.equal(isBareVersionTitle('v1.1.0 - fidelity gate'), false);
});

test('isBareVersionTitle: an empty/missing title counts as bare', () => {
  assert.equal(isBareVersionTitle(''), true);
  assert.equal(isBareVersionTitle(undefined), true);
});

// --- separatorClass ---

test('separatorClass: spaced hyphen', () => {
  assert.equal(separatorClass('v1.1.0 - fidelity gate'), 'hyphen');
});

test('separatorClass: em-dash', () => {
  assert.equal(separatorClass('v1.1.0 — fidelity gate'), 'em-dash');
});

test('separatorClass: some other separator', () => {
  assert.equal(separatorClass('v1.1.0: fidelity gate'), 'other');
});

test('separatorClass: no version match at all', () => {
  assert.equal(separatorClass('CoalWash release notes'), 'none');
});

// --- hasEmoji ---

test('hasEmoji: detects a pictograph', () => {
  assert.equal(hasEmoji('v1.1.0 - 🎉 shipped'), true);
});

test('hasEmoji: plain text has none', () => {
  assert.equal(hasEmoji('v1.1.0 - fidelity gate'), false);
});

test('hasEmoji: empty/missing text has none', () => {
  assert.equal(hasEmoji(''), false);
  assert.equal(hasEmoji(undefined), false);
});

// --- hasPsObjectLeak (UMB-053/UMB-050: the PS 5.1 ETS NoteProperties defect signature) ---

test('hasPsObjectLeak: flags a body carrying serialized PowerShell provider metadata', () => {
  // The real 2026-09-03 incident shape (`AGENTS.md` "PS 5.1"): Get-Content -Raw's
  // decorated string, passed through ConvertTo-Json, publishes the whole ETS object --
  // this is a trimmed stand-in for the 26,668-char real one, same telltale keys.
  const leaked = '{"value":"Real intended body text.","PSPath":"Microsoft.PowerShell.Core\\\\FileSystem::C:\\\\repo\\\\body.md","PSParentPath":"Microsoft.PowerShell.Core\\\\FileSystem::C:\\\\repo","PSChildName":"body.md","PSDrive":"C","PSProvider":"Microsoft.PowerShell.Core\\\\FileSystem","ReadCount":1}';
  assert.equal(hasPsObjectLeak(leaked), true);
});

test('hasPsObjectLeak: a real release body (even one mentioning PowerShell in prose) is clean', () => {
  assert.equal(hasPsObjectLeak('Lead sentence.\n\n### Fixed\n- a PowerShell quoting bug\n'), false);
});

test('hasPsObjectLeak: empty/missing body has no leak', () => {
  assert.equal(hasPsObjectLeak(''), false);
  assert.equal(hasPsObjectLeak(undefined), false);
});

test('checkRelease: a leaked PS object body is flagged (RED before hasPsObjectLeak existed)', () => {
  const release = {
    tag_name: 'v1.1.0',
    name: 'v1.1.0 - fidelity gate',
    body: '{"value":"real text","PSPath":"Microsoft.PowerShell.Core\\\\FileSystem::C:\\\\x","PSProvider":"Microsoft.PowerShell.Core\\\\FileSystem"}',
    prerelease: false,
    draft: false,
  };
  const findings = checkRelease(release, 'CoalWash').join('\n');
  assert.match(findings, /serialized PowerShell object/);
});

test('checkRelease: a real release body with no leak markers stays clean on this check', () => {
  const release = {
    tag_name: 'v1.1.0',
    name: 'v1.1.0 - fidelity gate',
    body: 'Lead sentence.\n\n### Fixed\n- a real fix\n',
    prerelease: false,
    draft: false,
  };
  const findings = checkRelease(release, 'CoalWash');
  assert.equal(findings.some((f) => /serialized PowerShell object/.test(f)), false);
});

// --- checkRelease (composed, fixture GitHub Release objects) ---

test('checkRelease: a clean release has no findings', () => {
  const release = {
    tag_name: 'v1.1.0',
    name: 'v1.1.0 - fidelity gate hardening',
    body: 'Lead sentence.\n\n### Fixed\n- a real fix\n',
    prerelease: false,
    draft: false,
  };
  assert.deepEqual(checkRelease(release, 'CoalWash'), []);
});

test('checkRelease: prerelease=true on a published Release is flagged', () => {
  const release = { tag_name: 'v1.1.0-beta.1', name: 'v1.1.0-beta.1 - x', body: 'y', prerelease: true, draft: false };
  const findings = checkRelease(release, 'CoalWash').join('\n');
  assert.match(findings, /prerelease=true/);
});

test('checkRelease: a bare-version title is flagged and skips prefix/separator checks', () => {
  const release = { tag_name: 'v1.1.0', name: 'v1.1.0', body: 'y', prerelease: false, draft: false };
  const findings = checkRelease(release, 'CoalWash');
  assert.equal(findings.length, 1);
  assert.match(findings[0], /bare version/);
});

test('checkRelease: repo-prefix + empty body flag independently (a prefixed title has no leading version, so separatorClass is not evaluated against it)', () => {
  const release = { tag_name: 'v1.1.0', name: 'CoalWash v1.1.0 - fidelity gate', body: '   ', prerelease: false, draft: false };
  const findings = checkRelease(release, 'CoalWash');
  assert.equal(findings.some((f) => /repo-name prefix/.test(f)), true);
  assert.equal(findings.some((f) => /body is empty/.test(f)), true);
});

test('checkRelease: em-dash + prerelease flag independently on a properly bare-leading title', () => {
  const release = { tag_name: 'v1.1.0', name: 'v1.1.0 — fidelity gate', body: 'y', prerelease: true, draft: false };
  const findings = checkRelease(release, 'CoalWash');
  assert.equal(findings.some((f) => /em-dash/.test(f)), true);
  assert.equal(findings.some((f) => /prerelease=true/.test(f)), true);
});

test('checkRelease: an emoji title is flagged', () => {
  const release = { tag_name: 'v1.1.0', name: 'v1.1.0 - 🎉 fidelity gate', body: 'y', prerelease: false, draft: false };
  const findings = checkRelease(release, 'CoalWash').join('\n');
  assert.match(findings, /contains an emoji/);
});

test('checkRelease: an emoji in a body heading is flagged', () => {
  const release = {
    tag_name: 'v1.1.0',
    name: 'v1.1.0 - fidelity gate',
    body: 'Lead sentence.\n\n### 🎉 Added\n- a feature\n',
    prerelease: false,
    draft: false,
  };
  const findings = checkRelease(release, 'CoalWash').join('\n');
  assert.match(findings, /body heading.*contains an emoji/);
});

test('checkRelease: emoji elsewhere in body prose (not a heading) is not flagged', () => {
  const release = {
    tag_name: 'v1.1.0',
    name: 'v1.1.0 - fidelity gate',
    body: 'Lead sentence.\n\n### Fixed\n- quotes a scored 🎉 as test DATA, not a heading\n',
    prerelease: false,
    draft: false,
  };
  const findings = checkRelease(release, 'CoalWash');
  assert.equal(findings.some((f) => /body heading/.test(f)), false);
});

// UMB-112 row 20: "v1.2.3 -" classified as a hyphen-separated title with an EMPTY summary and raised
// no finding -- the titleless-release class RELEASE-NOTES-TEMPLATE's own issue 1 records (v2.1.2).
test('isBareVersionTitle: a version followed only by a separator (no summary) is bare (UMB-112 row 20)', () => {
  for (const t of ['v1.2.3 -', 'v1.2.3 - ', 'v1.2.3 \u2014', 'v1.2.3:', '1.2.3 -']) assert.equal(isBareVersionTitle(t), true, JSON.stringify(t));
  assert.equal(isBareVersionTitle('v1.2.3 - x'), false);
});

test('checkRelease: a title of "v2.1.2 -" is REPORTED as a bare version (UMB-112 row 20)', () => {
  const f = checkRelease({ name: 'v2.1.2 -', body: 'notes', prerelease: false }, 'CoalX');
  assert.ok(f.some((x) => /bare version with no summary/.test(x)), f.join(' | '));
});

// --- THE LAUNCH FORM (owner 2026-09-21, RELEASE-PATTERN.md "Which tags get a Release"): a repo whose FIRST
// public version is a pre-release form gets ONE Release marked prerelease:true as its launch
// announcement; later pre-release tags stay tag-only; the first stable closes the form. So a
// prerelease Release is conformant exactly once per repo -- the OLDEST published Release. ---

const rel = (tag, over = {}) => ({ tag_name: tag, name: tag + ' - summary', body: 'notes', prerelease: false, draft: false, created_at: '2026-09-21T00:00:00Z', ...over });

test('launchFormTag: the oldest published Release, when it is a pre-release, is the launch Release', () => {
  const rs = [rel('v0.1.0-beta.2', { prerelease: true, created_at: '2026-09-25T00:00:00Z' }), rel('v0.1.0-beta.1', { prerelease: true, created_at: '2026-09-21T00:00:00Z' })];
  assert.equal(launchFormTag(rs), 'v0.1.0-beta.1');
});

test('launchFormTag: input order does not matter (the API lists newest first, a caller may not)', () => {
  const a = rel('v1.0.0', { created_at: '2026-10-01T00:00:00Z' });
  const b = rel('v0.1.0-beta.1', { prerelease: true, created_at: '2026-09-21T00:00:00Z' });
  assert.equal(launchFormTag([a, b]), 'v0.1.0-beta.1');
  assert.equal(launchFormTag([b, a]), 'v0.1.0-beta.1');
});

test('launchFormTag: null when the oldest published Release is stable, when a draft is the oldest, and when there is none', () => {
  assert.equal(launchFormTag([rel('v1.0.0')]), null);
  assert.equal(launchFormTag([rel('v0.0.1-beta.1', { prerelease: true, draft: true, created_at: '2026-01-01T00:00:00Z' }), rel('v1.0.0', { created_at: '2026-09-21T00:00:00Z' })]), null);
  assert.equal(launchFormTag([]), null);
});

test('checkRelease: the launch Release (prerelease:true, tag = ctx.launchTag) raises NO prerelease finding', () => {
  const r = rel('v0.1.0-beta.1', { prerelease: true });
  const f = checkRelease(r, 'CoalGob', { launchTag: 'v0.1.0-beta.1' });
  assert.equal(f.some((x) => /prerelease/.test(x)), false, f.join(' | '));
  assert.deepEqual(f, []);
});

test('checkRelease: a SECOND prerelease:true Release is still flagged -- the form allows exactly one', () => {
  const r = rel('v0.1.0-beta.2', { prerelease: true });
  const f = checkRelease(r, 'CoalGob', { launchTag: 'v0.1.0-beta.1' }).join('\n');
  assert.match(f, /prerelease=true on a published Release/);
  assert.match(f, /not the repo's launch-form Release/);
});

test('checkRelease: with no launch context a prerelease:true Release is flagged exactly as before (two-argument callers unchanged)', () => {
  const f = checkRelease(rel('v0.1.0-beta.1', { prerelease: true }), 'CoalGob').join('\n');
  assert.match(f, /prerelease=true/);
});

test('checkRelease: the launch Release must carry a SemVer pre-release identifier (a v1.0.0 marked prerelease is not the launch form)', () => {
  const f = checkRelease(rel('v1.0.0', { prerelease: true }), 'CoalGob', { launchTag: 'v1.0.0' }).join('\n');
  assert.match(f, /no SemVer pre-release identifier/);
});

// The CLI wiring: spawn the real entry with a fetch stub preloaded (NODE_OPTIONS=--import) so the
// assertion is on what it actually requests and concludes -- exit 0 alone proves nothing.
const STUB_SRC = String.raw`import fs from 'node:fs';
const M = JSON.parse(process.env.STUB_RELEASES);
globalThis.fetch = async (url) => {
  const m = String(url).match(/repos\/([^/]+)\/([^/]+)\/releases/);
  fs.appendFileSync(process.env.STUB_LOG, (m ? m[1] + '/' + m[2] : 'OTHER ' + url) + '\n');
  const body = m && M[m[2]] ? M[m[2]] : [];
  return { ok: true, status: 200, json: async () => body };
};
`;

function runCli(releasesByRepo) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-conform-cli-'));
  try {
    const log = path.join(dir, 'calls.log');
    const stub = path.join(dir, 'stub.mjs');
    fs.writeFileSync(stub, STUB_SRC);
    const res = spawnSync(process.execPath, [fileURLToPath(new URL('./release-conform.mjs', import.meta.url))], {
      encoding: 'utf8',
      env: { ...process.env, GITHUB_TOKEN: '', NODE_OPTIONS: '--import=' + pathToFileURL(stub).href, STUB_LOG: log, STUB_RELEASES: JSON.stringify(releasesByRepo) },
    });
    return { ...res, calls: fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\n').filter(Boolean) : [] };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('release-conform CLI: reads CoalGob and the org-owned CoalMine, and a lone launch prerelease Release is clean (exit 0)', () => {
  const res = runCli({ CoalGob: [rel('v0.1.0-beta.1', { prerelease: true })] });
  assert.equal(res.status, 0, res.stderr + res.stdout);
  assert.ok(res.calls.includes('TheColliery/CoalGob'), 'CoalGob must be checked: ' + res.calls.join(','));
  assert.ok(res.calls.includes('TheColliery/CoalMine'), 'CoalMine is an org repo since 2026-09-17: ' + res.calls.join(','));
  assert.ok(!res.calls.some((c) => c.startsWith('HetCreep/')), 'the retired HetCreep/CoalMine address must not be read: ' + res.calls.join(','));
  assert.match(res.stdout, /v0\.1\.0-beta\.1/);
});

test('release-conform CLI: a second prerelease Release beside the launch one is a finding and exits non-zero', () => {
  const res = runCli({ CoalGob: [rel('v0.1.0-beta.2', { prerelease: true, created_at: '2026-09-25T00:00:00Z' }), rel('v0.1.0-beta.1', { prerelease: true })] });
  assert.equal(res.status, 1, res.stderr + res.stdout);
  assert.match(res.stderr, /v0\.1\.0-beta\.2.*not the repo's launch-form Release/);
  assert.doesNotMatch(res.stderr, /v0\.1\.0-beta\.1:/);
});
