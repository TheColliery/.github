import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { isLicenseStub, STUB_MAX_LINES } from './lib/license-check-lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const MIT_TEXT = `MIT License

Copyright (c) 2026 Example Holder

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

test('MIT_TEXT fixture is genuinely short -- the fixture must sit inside the collision band it exists to test', () => {
  const lines = MIT_TEXT.split(/\r?\n/).filter((l) => l.trim() !== '').length;
  assert.ok(lines <= STUB_MAX_LINES, `fixture is ${lines} non-blank lines, expected <= ${STUB_MAX_LINES}`);
});

test('isLicenseStub: a real MIT LICENSE (short but substantive) is NOT a stub -- the collision case this check exists to survive', () => {
  assert.equal(isLicenseStub(MIT_TEXT), false);
});

test('isLicenseStub: the actual measured templates/article/LICENSE stub IS a stub', () => {
  const content = fs.readFileSync(path.join(HERE, '..', 'templates', 'article', 'LICENSE'), 'utf8');
  assert.equal(isLicenseStub(content), true);
});

test('isLicenseStub: the actual templates/published-code/LICENSE (full Apache-2.0) is NOT a stub', () => {
  const content = fs.readFileSync(path.join(HERE, '..', 'templates', 'published-code', 'LICENSE'), 'utf8');
  assert.equal(isLicenseStub(content), false);
});

test('isLicenseStub: the actual templates/private-working/LICENSE (full Apache-2.0) is NOT a stub', () => {
  const content = fs.readFileSync(path.join(HERE, '..', 'templates', 'private-working', 'LICENSE'), 'utf8');
  assert.equal(isLicenseStub(content), false);
});

test('isLicenseStub: empty content is a stub', () => {
  assert.equal(isLicenseStub(''), true);
  assert.equal(isLicenseStub('   \n  \n'), true);
});

test('isLicenseStub: a bare name+URL pointer with no legal language is a stub', () => {
  assert.equal(isLicenseStub('Licensed under Foo License.\nSee https://example.com/foo for the full text.\n'), true);
});

test('isLicenseStub: a long file with no substantive marker is still NOT flagged (length escape) -- a defensible false-negative bound, never a false-positive on a real long text', () => {
  const longButMarkerless = Array.from({ length: STUB_MAX_LINES + 5 }, (_, i) => `line ${i}`).join('\n');
  assert.equal(isLicenseStub(longButMarkerless), false);
});
