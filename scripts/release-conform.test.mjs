import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasRepoPrefix,
  isBareVersionTitle,
  separatorClass,
  hasEmoji,
  hasPsObjectLeak,
  checkRelease,
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
