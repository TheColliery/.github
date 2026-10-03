// UMB-256: a Dependabot bump of one action pin must not read as drift. The pin normaliser is the one source for the scorecard parity
// test, skeleton-check's file compare and the overlay-set compare. These tests hold its two halves: a pair that differs only in a pin
// passes, and a pair that differs anywhere else does not.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePins, pinsOf, pinOnlyDifference, pinLine } from './lib/pin-normalize.mjs';

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const wf = (sha, tag, extra = '') => [
  'name: x', 'jobs:', '  j:', '    steps:',
  `      - uses: ossf/scorecard-action@${sha} # ${tag}`,
  `      - uses: github/codeql-action/upload-sarif@${A} # v4`,
  `        with:${extra}`, '          a: 1', '',
].join('\n');

test('normalizePins: a pin\'s sha and trailing tag are replaced, the action name and every other byte stay; CRLF reads as LF', () => {
  const n = normalizePins(wf(A, 'v2.4.3'));
  assert.match(n, /- uses: ossf\/scorecard-action@<pin>\n/);
  assert.match(n, /- uses: github\/codeql-action\/upload-sarif@<pin>\n/);
  assert.equal(normalizePins(wf(A, 'v2.4.3').replace(/\n/g, '\r\n')), n);
});

test('a pair that differs ONLY in one pin (sha and tag) is the same structure', () => {
  assert.equal(normalizePins(wf(A, 'v2.4.3')), normalizePins(wf(B, 'v2.4.4')));
  const d = pinOnlyDifference(wf(A, 'v2.4.4'), wf(B, 'v2.4.3'));
  assert.equal(d.same, false);
  assert.deepEqual(d.diffs, [{ action: 'ossf/scorecard-action', canon: 'v2.4.4', room: 'v2.4.3', direction: 'room behind' }]);
  assert.equal(pinOnlyDifference(wf(A, 'v2.4.3'), wf(B, 'v2.4.4')).diffs[0].direction, 'room ahead');
  assert.deepEqual(pinOnlyDifference(wf(A, 'v2.4.3'), wf(A, 'v2.4.3')), { same: true });
});

test('a pair that differs anywhere ELSE is not pin-only: an extra line, a changed value, a renamed action, a removed pin', () => {
  assert.equal(pinOnlyDifference(wf(A, 'v1'), wf(B, 'v1', '\n          b: 2')), null, 'an extra line');
  assert.equal(pinOnlyDifference(wf(A, 'v1'), wf(A, 'v1').replace('a: 1', 'a: 2')), null, 'a changed value');
  assert.equal(pinOnlyDifference(wf(A, 'v1'), wf(A, 'v1').replace('ossf/scorecard-action', 'ossf/other-action')), null, 'a renamed action');
  assert.equal(pinOnlyDifference(wf(A, 'v1'), wf(A, 'v1').replace(`@${A} # v1`, '@v2')), null, 'a pin replaced by a tag ref');
  assert.equal(pinOnlyDifference(wf(A, 'v1'), wf(A, 'v1').replace('      - uses: ossf/scorecard-action@' + A + ' # v1\n', '')), null, 'a removed pin');
});

test('only a full 40-hex commit ref is a pin: a tag ref, a branch ref, a short sha, a local action and a docker reference compare as they stand', () => {
  for (const ref of ['actions/checkout@v4', 'actions/checkout@main', 'actions/checkout@' + 'a'.repeat(39), './.github/actions/x', 'docker://alpine:3.20']) {
    const t = `jobs:\n  j:\n    steps:\n      - uses: ${ref}\n`;
    assert.deepEqual(pinsOf(t), [], ref);
    assert.equal(normalizePins(t), t, ref);
  }
});

test('pinOnlyDifference: a same-tag/different-commit pin and an unorderable tag read "differs"; pinLine names each action and the direction', () => {
  assert.equal(pinOnlyDifference(wf(A, 'v1'), wf(B, 'v1')).diffs[0].direction, 'differs');
  assert.equal(pinOnlyDifference(wf(A, 'main-2026'), wf(B, 'v1')).diffs[0].direction, 'differs');
  assert.equal(pinOnlyDifference(wf(A, 'v4'), wf(B, 'v4.38.2')).diffs[0].direction, 'differs', 'equal over the shared components, different precision');
  const line = pinLine(pinOnlyDifference(wf(A, 'v2.4.4'), wf(B, 'v2.4.3')).diffs);
  assert.match(line, /^PINS ONLY: 1 action pin differs from the canon, structure identical \(ossf\/scorecard-action v2\.4\.3 vs canon v2\.4\.4: room behind\)$/);
});
