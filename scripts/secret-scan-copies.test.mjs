// UMB-282 (a): the secret scan has four carriers in this repository (the org repo itself and the two public templates)
// and the scanner contract is "a sibling copies it byte for byte". Nothing here may drift from itself, and each template
// must wire the scan into its hook pair and list it in its skeleton row. The copy in the source room (the umbrella's
// scripts/scanner-parity.mjs) is checked there, never read from this repository's tests: a clean clone has no sibling.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKELETON_FILES } from './lib/skeleton-check-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = ['scripts/lib/secret-scan.mjs', 'scripts/secret-scan.test.mjs', 'scripts/secret-gate.mjs', 'scripts/secret-gate.test.mjs'];
const CARRIERS = ['', 'templates/published-code/', 'templates/article/'];
// LF-normalized, as git commits it under autocrlf
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');

test('the scanner, its test, the caller and the caller\'s test are byte-equal in the org repo and in both public templates', () => {
  for (const f of FILES) {
    const want = read(f);
    assert.ok(want.length > 1000, f + ' is not an empty stub');
    for (const c of CARRIERS.slice(1)) assert.equal(read(c + f), want, `${c}${f} differs from ${f}`);
  }
});

test('each carrier\'s hook pair is identical bytes and runs the scan: tree on pre-commit, --pre-push with the remote on pre-push', () => {
  for (const c of ['', 'templates/published-code/', 'templates/article/']) {
    const hooks = ['pre-commit', 'pre-push'].map((h) => read(c + '.githooks/' + h));
    assert.equal(hooks[0], hooks[1], c + '.githooks: one file wired twice');
    assert.ok(hooks[0].includes('node scripts/secret-gate.mjs --pre-push "--remote=$1" || exit 1'), c + ': the pre-push branch');
    assert.ok(/else\n {2}node scripts\/secret-gate\.mjs \|\| exit 1\nfi/.test(hooks[0]), c + ': the pre-commit branch fails the commit');
    const scan = hooks[0].indexOf('secret-gate.mjs');
    for (const later of ['node scripts/verify.mjs', 'node --test']) {
      const i = hooks[0].indexOf(later);
      assert.ok(i < 0 || scan < i, `${c}: the secret scan runs before "${later}"`);
    }
  }
});

test('the two public skeleton rows list the four files, and the article row lists its hook pair', () => {
  for (const kind of ['published-code', 'article']) for (const f of FILES) assert.ok(SKELETON_FILES[kind].includes(f), `${kind} row lacks ${f}`);
  for (const h of ['.githooks/pre-commit', '.githooks/pre-push']) assert.ok(SKELETON_FILES.article.includes(h), 'article row lacks ' + h);
  for (const kind of ['private-working', 'article (private)', 'article (change-request)']) {
    for (const f of FILES) assert.ok(!SKELETON_FILES[kind].includes(f), `${kind} is not a public git-pushed repository, so ${f} is not its skeleton`);
  }
});

test('the org repo\'s own CI scans the tracked tree, and its acknowledged fingerprints are 16 hex characters', () => {
  assert.ok(read('.github/workflows/verify-landing.yml').includes('run: node scripts/secret-gate.mjs'));
  for (const l of read('secret-scan.acks').split('\n').map((x) => x.replace(/#.*$/, '').trim()).filter(Boolean)) assert.match(l, /^[0-9a-f]{16}$/);
});

// The gate, its test and the template hooks are copied byte for byte into public repositories, so they carry no house pointer (a queue-row or
// order id means nothing outside this house), and the hook says what the gate scans in commit mode: the staged tree, the index.
const HOUSE_ID = /\b(?:UMB\d*|CWK|LWK\d*|ARK|BB|AR|AT|AV|AW|TG|CW|K)-\d+|\border \d{4}-\d\d-\d\d[a-z]?\b|\b\d{1,2}[a-z] \(item \d+|\bCoal[A-Z][a-z]+ (?:e\d+|N\d+|LOW|MEDIUM|HIGH)\b|\bruling \d+ \(/;
const SHIPPED = ['scripts/secret-gate.mjs', 'scripts/secret-gate.test.mjs',
  ...['published-code', 'article'].flatMap((k) => ['pre-commit', 'pre-push'].map((h) => `templates/${k}/.githooks/${h}`))];
test('the shipped gate, its test and the template hooks carry no house ticket or order id', () => {
  for (const f of SHIPPED) read(f).split('\n').forEach((l, i) => assert.doesNotMatch(l, HOUSE_ID, `${f}:${i + 1}`));
});
test('each template hook says commit mode scans the staged tree, not the tracked tree', () => {
  for (const k of ['published-code', 'article']) {
    const hook = read(`templates/${k}/.githooks/pre-commit`);
    assert.ok(!/scans the tracked tree/.test(hook), `${k}: the hook says "tracked tree"`);
    assert.match(hook, /pre-commit scans the staged tree/, k);
  }
});
