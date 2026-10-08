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

const DEFAULTS = ['CODE_OF_CONDUCT.md', 'CONTRIBUTING.md', 'SECURITY.md', 'SUPPORT.md', 'PULL_REQUEST_TEMPLATE.md', 'GOVERNANCE.md'];
const LEAN = DEFAULTS.filter((f) => f !== 'CODE_OF_CONDUCT.md'); // the Covenant is a standard's text, never trimmed
const LEAN_MAX_CHARS = 2500;

test('the six org-default community files exist under .github/ (GOVERNANCE.md since UMB-216, RED before it)', () => {
  const missing = DEFAULTS.filter((f) => !exists('.github/' + f));
  assert.deepEqual(missing, []);
});

test('GOVERNANCE.md: the org default and the published-code template copy are byte-identical, and it names the four things the canon asks for', () => {
  const own = read('.github/GOVERNANCE.md');
  assert.equal(own, read('templates/published-code/GOVERNANCE.md'));
  for (const must of [/One maintainer decides/, /How a change is accepted/, /Who writes the changes/, /Co-Authored-By/, /Where to report/]) assert.match(own, must);
});

// UMB-376 LOW: the template's Where-to-report line linked SUPPORT.md, which the template does not ship (SUPPORT is an org default a room
// inherits), so every new repository started with a dead link. A relative link in the shipped template must resolve inside the template.
test('GOVERNANCE.md in the published-code template: every relative link resolves to a file the template ships (RED before UMB-376)', () => {
  const text = read('templates/published-code/GOVERNANCE.md');
  const rels = [...text.matchAll(/\]\(([^)#\s]+)\)/g)].map((m) => m[1]).filter((l) => !/^[a-z][a-z0-9+.-]*:/i.test(l));
  assert.ok(rels.length >= 2, 'the file links at least SECURITY.md and CODE_OF_CONDUCT.md (not vacuous)');
  assert.deepEqual(rels.filter((l) => !exists('templates/published-code/' + l)), []);
});

test('the five small defaults stay lean, and none carries an e-mail address (the org domain takes no mail)', () => {
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

// BB-98 (g), owner 2026-10-09: GitHub applies `.github/VULNERABILITY_REPORT.yml` of the org `.github` repository to every repository the org owns that has private
// vulnerability reporting on. An invalid form silently falls back to the default form ("If GitHub cannot parse or validate a custom form, reporters see the default form
// instead", docs.github.com), so this reads the file line by line (no YAML parser without an npm install, Phoenix #2) and holds what the owner asked for: GitHub's four default
// required fields, the optional AI checkbox, GitHub's own 150-character floor on the proof of concept (the default form's, per the changelog of 2026-10-01: "proof of concept (at least 150 characters)"; the docs example's 100 is only an example) and no floor of ours anywhere else, no tab, no mail address.
test('VULNERABILITY_REPORT.yml: the four default fields are required, the AI checkbox is optional, the only minimum length is GitHub\'s 150 on the proof of concept -- RED before BB-98 (g)', () => {
  assert.ok(exists('.github/VULNERABILITY_REPORT.yml'), 'the form exists at .github/VULNERABILITY_REPORT.yml');
  const text = read('.github/VULNERABILITY_REPORT.yml');
  assert.ok(!text.includes('\t'), 'no tab: YAML forbids it for indentation');
  assert.doesNotMatch(text, /@[a-z0-9-]+\.[a-z]{2,}/i, 'no mail address: the org takes no mail');
  const lines = text.split('\n');
  assert.deepEqual(lines.filter((l) => /^[a-z_]+:/.test(l)).map((l) => l.split(':')[0]), ['name', 'description', 'body'], 'top-level keys');
  // each body element starts at "  - type:"; its id, required flag and min_length are read inside its own block
  const starts = lines.map((l, i) => (/^ {2}- type: /.test(l) ? i : -1)).filter((i) => i >= 0);
  const blocks = starts.map((s, k) => lines.slice(s, k + 1 < starts.length ? starts[k + 1] : lines.length));
  // required and min_length count only inside the block's own `validations:` section (CodeRabbit, PR 38: under `attributes:` they would read the same at the same indent and do nothing)
  const info = blocks.map((b) => {
    const at = b.indexOf('    validations:');
    const validations = at < 0 ? [] : b.slice(at + 1);
    return {
      type: /^ {2}- type: (\w+)$/.exec(b[0])[1],
      id: (/^ {4}id: ([A-Za-z0-9_-]+)$/m.exec(b.join('\n')) || [])[1],
      required: validations.includes('      required: true'),
      min: (/^ {6}min_length: (\d+)$/m.exec(validations.join('\n')) || [])[1],
    };
  });
  assert.deepEqual(info.map((x) => x.id), ['summary', 'details', 'proof_of_concept', 'impact', 'ai_assistance']);
  assert.deepEqual(info.filter((x) => x.required).map((x) => x.id), ['summary', 'details', 'proof_of_concept', 'impact'], 'GitHub default required fields; the AI checkbox stays optional');
  assert.deepEqual(info.filter((x) => x.min).map((x) => [x.id, x.min]), [['proof_of_concept', '150']], 'GitHub floor only: a stricter form turns a good reporter away');
  assert.equal(info.at(-1).type, 'checkboxes');
  assert.ok(!blocks.at(-1).some((l) => /required/.test(l)), 'the AI checkbox carries no required flag, on the element or on its option');
  assert.match(text, /- label: I used AI assistance to find or write up this report\./);
  assert.match(lines[1], /SECURITY\.md/, 'one line pointing at the org security policy, nothing restated');
});
