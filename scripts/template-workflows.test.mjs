import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// GitHub's own context-availability table (docs: contexts.md, "jobs.<job_id>.if") allows only
// always/cancelled/success/failure at JOB level -- hashFiles is available at STEP level only.
// A job-level `if: hashFiles(...)` makes the whole workflow file invalid: a run with ZERO jobs,
// named by its own file path, concluding "failure" (measured on template-published-code, every
// CodeQL run from the 2026-09-03 seed through 2026-09-19). Skeleton workflows carry that gate
// so a bare "Use this template" click skips cleanly -- it must sit on the STEPS.
const here = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES = path.join(here, '..', 'templates');

function workflowFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...workflowFiles(p));
    else if (/\.ya?ml$/.test(e.name) && p.includes(`${path.sep}workflows${path.sep}`)) out.push(p);
  }
  return out;
}

// Every skeleton workflow indents 2 spaces per level, so a job-level key sits at 4 spaces
// (jobs: / <job>: / <key>:) and a step-level key at 8 (list dash at 6).
const JOB_LEVEL_IF_HASHFILES = /^ {4}if:.*hashFiles\(/;

test('the scan finds the skeleton workflows it is meant to police (not vacuous)', () => {
  const files = workflowFiles(TEMPLATES).map((f) => path.basename(f));
  for (const expected of ['ci.yml', 'codeql.yml', 'coverage.yml', 'gate.yml', 'check.yml']) {
    assert.ok(files.includes(expected), `${expected} not scanned -- got ${files.join(', ')}`);
  }
});

test('no skeleton workflow gates a JOB with hashFiles() -- it is step-level only (RED against the 2026-09-03 codeql.yml)', () => {
  const offenders = [];
  for (const f of workflowFiles(TEMPLATES)) {
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((line, i) => {
      if (JOB_LEVEL_IF_HASHFILES.test(line)) offenders.push(`${path.relative(TEMPLATES, f)}:${i + 1}`);
    });
  }
  assert.deepEqual(offenders, [], `job-level if: hashFiles() makes the workflow invalid (0 jobs, run fails): ${offenders.join(', ')}`);
});

test('the pattern itself: matches a job-level gate, ignores a step-level one', () => {
  assert.equal(JOB_LEVEL_IF_HASHFILES.test("    if: hashFiles('**/*.js') != ''"), true);
  assert.equal(JOB_LEVEL_IF_HASHFILES.test("        if: hashFiles('scripts/test.mjs') != ''"), false);
});
