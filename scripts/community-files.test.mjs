import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// UMB-177. GitHub serves a public `.github` repository's default community files (CODE_OF_CONDUCT, CONTRIBUTING,
// SECURITY, SUPPORT, PULL_REQUEST_TEMPLATE) to every org repo that ships none of its own; a file may sit in the
// root, `.github/` or `docs/`, `.github/` first (docs.github.com, "Creating a default community health file"). They
// live in `.github/` here so the root stays lean. This pins what the four small files may not become (long, a mail
// address, a second contact), the Covenant's text against its upstream hash, and the one PR template against its
// template copies.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

const DEFAULTS = ['CODE_OF_CONDUCT.md', 'CONTRIBUTING.md', 'SECURITY.md', 'SUPPORT.md', 'PULL_REQUEST_TEMPLATE.md'];
const LEAN = DEFAULTS.filter((f) => f !== 'CODE_OF_CONDUCT.md'); // the Covenant is a standard's text, never trimmed
const LEAN_MAX_CHARS = 2500;

test('the five org-default community files exist under .github/', () => {
  const missing = DEFAULTS.filter((f) => !exists('.github/' + f));
  assert.deepEqual(missing, []);
});

test('the four small defaults stay lean, and none carries an e-mail address (the org domain takes no mail)', () => {
  for (const f of LEAN) {
    const text = read('.github/' + f);
    assert.ok(text.length <= LEAN_MAX_CHARS, `${f} is ${text.length} chars; a long explanation is a link (cap ${LEAN_MAX_CHARS})`);
  }
  for (const f of DEFAULTS) assert.doesNotMatch(read('.github/' + f), /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, `${f} names an e-mail address`);
});

// Contributor Covenant 3.0, fetched 2026-09-21 from
// https://www.contributor-covenant.org/version/3/0/code_of_conduct/code_of_conduct.md (leading blank line and trailing
// blank lines trimmed). The file adopts it with exactly TWO edits, both named here; reversing them must reproduce the
// upstream text byte for byte.
const UPSTREAM_SHA256 = 'a4461d5955a931a0656726f91e3fe50de1f3758c510a3cadf5f6c9ac866b6994';
const CONTACT = 'use the same private channel [SECURITY.md](SECURITY.md) names for a sensitive report—this project uses no second channel.';
const UPSTREAM_CONTACT = '**[NOTE: describe your means of reporting here.]**';
const UPSTREAM_ADOPTER_NOTE = "**[NOTE: The remedies and repairs outlined below are suggestions based on best practices in code of conduct enforcement. If your community has its own established enforcement process, be sure to edit this section to describe your own policies.]**\n\n";

test('CODE_OF_CONDUCT.md is the Contributor Covenant 3.0 verbatim: reversing the two named edits reproduces the upstream hash', () => {
  const coc = read('.github/CODE_OF_CONDUCT.md');
  assert.ok(coc.startsWith('# Contributor Covenant 3.0 Code of Conduct'), 'starts at the upstream title');
  assert.equal(coc.split(CONTACT).length, 2, 'the org contact sentence appears exactly once');
  const heading = '## Addressing and Repairing Harm\n\n';
  assert.equal(coc.split(heading).length, 2);
  const upstream = coc.replace(CONTACT, UPSTREAM_CONTACT).replace(heading, heading + UPSTREAM_ADOPTER_NOTE).trimEnd();
  assert.equal(crypto.createHash('sha256').update(upstream).digest('hex'), UPSTREAM_SHA256, 'the text differs from the upstream Covenant beyond the two named edits');
});

const dashless = (s) => s.replace(/\s*—\s*/g, '—');

test('one contact across the org: the org default and the room template name the same channel, and that channel exists', () => {
  const room = dashless(read('templates/published-code/CODE_OF_CONDUCT.md'));
  assert.ok(room.includes('same private channel [SECURITY.md](SECURITY.md) names for a sensitive report—this project uses no second channel'), 'the room template contact moved');
  assert.match(read('.github/SECURITY.md'), /Report a vulnerability/, 'SECURITY.md names the private channel the contact points at');
});

test('SECURITY.md defers to a room own SECURITY.md, and SUPPORT.md and CONTRIBUTING.md point at the canon instead of restating it', () => {
  assert.match(read('.github/SECURITY.md'), /own `?SECURITY\.md`?/i);
  assert.match(read('.github/CONTRIBUTING.md'), /own `?CONTRIBUTING\.md`?/i);
  assert.match(read('.github/CONTRIBUTING.md'), /Contributor Covenant/);
  assert.match(read('.github/CONTRIBUTING.md'), /opensource\.guide/);
});

test('the PR template is the belt gate as a short checklist, and one file: identical in the org default and both public templates', () => {
  const pr = read('.github/PULL_REQUEST_TEMPLATE.md');
  const boxes = pr.match(/^- \[ \] /gm) || [];
  assert.ok(boxes.length >= 4 && boxes.length <= 6, 'checklist items: ' + boxes.length);
  for (const re of [/red|failing/i, /CHANGELOG/, /inspect|review/i, /verbatim|source/i, /Code of Conduct|Contributor Covenant/]) assert.match(pr, re);
  for (const t of ['templates/published-code/.github/PULL_REQUEST_TEMPLATE.md', 'templates/article/.github/PULL_REQUEST_TEMPLATE.md']) {
    assert.ok(exists(t), t + ' is missing');
    assert.equal(read(t), pr, t + ' differs from the org default: one canon, three copies');
  }
});

test('every github.com/TheColliery/.github/blob/main/<path> link in the defaults points at a file that exists', () => {
  const bad = [];
  for (const f of DEFAULTS) {
    for (const m of read('.github/' + f).matchAll(/github\.com\/TheColliery\/\.github\/blob\/main\/([^\s)>#"]+)/g)) if (!exists(m[1])) bad.push(`${f}: ${m[1]}`);
  }
  assert.deepEqual(bad, []);
});
