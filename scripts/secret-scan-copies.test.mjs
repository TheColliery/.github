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

// 2026-11-17 (c179): the two sites CodeQL js/incomplete-sanitization reported in the canon scanner were the trailing-TAB replace of a `+++` path. The behaviour is unchanged (a name with a space ends in one TAB
// that is not part of the name, and a name that ends in a real TAB is written \\t by git), so the red is the static class: no regular-expression replace of a trailing TAB is left, and the helper that replaced it
// still drops exactly one. The positive control shows the check reads the shape it forbids.
test('the scanner drops the trailing TAB of a +++ path without a regular-expression replace, and drops exactly one -- RED before 2026-11-17', async () => {
  const text = read('scripts/lib/secret-scan.mjs');
  const SHAPE = /\.replace\(\/\\t\$\/,/;
  assert.ok(SHAPE.test("l.slice(4).replace(/\\t$/, '')"), 'positive control');
  assert.ok(!SHAPE.test(text), 'a regular-expression replace of a trailing TAB is back in the scanner');
  const { scanPatch } = await import(new URL('./lib/secret-scan.mjs', import.meta.url).href);
  const key = 'gh' + 'p_' + 'aB3dE5gH7jK9mN1pQ3sT5vX7zA9cD1fG3hJ5';
  const patch = ['diff --git a/my file.txt b/my file.txt', '--- a/my file.txt\t', '+++ b/my file.txt\t', '@@ -0,0 +1 @@', `+token ${key}`, ''].join('\n');
  const hits = scanPatch(patch);
  assert.deepStrictEqual(hits.map((h) => h.file), ['my file.txt'], 'the one TAB git writes after a name with a space is not part of the name');
});

// 19c (the CI gate proposed at 19a): the gate restates the scanner's wide-text count rule (WIDE_MIN_NULS, WIDE_SKEW) to judge a dropped binary-named blob by its NUL totals. If the two
// declarations ever differ, the gate re-reads (or drops) by a rule the scanner does not apply, and the oracle test in secret-gate.test.mjs sees it only on the inputs it happens to build.
// This compares the declarations themselves, in every carrier; it runs in verify-landing, which already lists this file.
test('the secret gate\'s wide-text constants equal the scanner\'s, in the org repo and in both public templates', () => {
  const constOf = (rel, name) => {
    const m = new RegExp('^const ' + name + ' = (\\d+);', 'm').exec(read(rel));
    assert.ok(m, rel + ' declares ' + name + ' as a plain integer');
    return Number(m[1]);
  };
  for (const c of CARRIERS) {
    for (const name of ['WIDE_MIN_NULS', 'WIDE_SKEW']) assert.equal(constOf(c + 'scripts/secret-gate.mjs', name), constOf(c + 'scripts/lib/secret-scan.mjs', name), `${c || '(org repo) '}${name}: the gate and the scanner disagree`);
  }
});
