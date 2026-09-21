import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
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

// UMB-112 residue (6): the overlay's publish-pypi.yml claimed to be "sourced verbatim" from Kolwen's
// live workflow and was not -- it lacked the LWK-135 gate (only a SIGNED ANNOTATED tag may publish), the
// workflow_dispatch tag input, the constant never-cancel concurrency group and the gated checkout ref,
// i.e. every line that stops an irreversible publish from an unattributable tree. Each load-bearing
// piece is pinned here by its own marker, and the one declared divergence (job-level contents: read,
// which a private repo needs and Kolwen, being public, does not) is pinned too.
test('overlay-llm-deploy publish-pypi.yml carries the signed-annotated-tag gate and its companions (UMB-112 residue 6)', () => {
  const p = path.join(TEMPLATES, 'overlay-llm-deploy', '.github', 'workflows', 'publish-pypi.yml');
  const y = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  assert.match(y, /- name: Require a signed annotated tag/, 'the gate step');
  assert.match(y, /git\/ref\/tags\/\$TAG/, 'the gate resolves the tag ref at the API');
  assert.match(y, /\.verification\.verified/, 'the gate reads the signature verdict');
  assert.match(y, /LIGHTWEIGHT tag/, 'a lightweight tag fails the gate');
  assert.match(y, /inputs:\n {6}tag:\n[\s\S]*?required: true/, 'workflow_dispatch takes the tag to publish');
  assert.match(y, /concurrency:\n {2}group: publish-pypi\n {2}cancel-in-progress: false/, 'constant never-cancel group');
  assert.match(y, /ref: \$\{\{ steps\.gate\.outputs\.commit \}\}/, 'checkout builds the commit the gate verified');
  assert.match(y, /TAG: \$\{\{ github\.event_name == 'workflow_dispatch' && inputs\.tag \|\| github\.ref_name \}\}/, 'the tag reaches the script through env, never inlined');
  const jobPerms = y.match(/\n {4}permissions:\n((?: {6}.*\n)+)/);
  assert.ok(jobPerms, 'the publish job has a job-level permissions block');
  assert.match(jobPerms[1], /contents: read/, 'job-level contents: read (the declared divergence from Kolwen: a private repo needs it)');
  assert.match(jobPerms[1], /id-token: write/);
  assert.doesNotMatch(y, /Sourced verbatim/, 'the false "verbatim" claim must be gone');
  assert.doesNotMatch(y, /(^|[^A-Za-z0-9{}])py-v/m, "Kolwen's own tag prefix must not leak into the template (use {{TAG_PREFIX}})");
  assert.doesNotMatch(y, /working-directory: py\n|packages-dir: py\//, "Kolwen's own package directory must not leak (use {{PY_DIR}})");
});

// ---- UMB-112 residue 10 + 11: the private-working scaffold's fence and gate ------------------------
// (10) git skips a hook that is not executable on POSIX -- with a hint on stderr, and the push goes
// through -- so a template hook committed as mode 100644 is a fence that is silently absent on every
// Linux/macOS clone (Bankfire and Kolwen carry theirs that way). And a hook whose working-tree copy is
// CRLF is "bad interpreter" there. Both are properties of the TEMPLATE bytes, so both are pinned here.
// The behavioural half: published-code's gate fails CLOSED when it cannot run; private-working's
// pre-push exited 0 ("gate SKIPPED") when node was missing -- a fence that skips when it cannot run
// is no fence (hooks-safety.md 1.0: a git pre-* hook MUST be able to abort).

const ROOT = path.join(here, '..');
const hasTool = (cmd, args) => { const r = spawnSync(cmd, args, { encoding: 'utf8' }); return !r.error && r.status === 0; };
const PW_PREPUSH = path.join(TEMPLATES, 'private-working', '.githooks', 'pre-push');

test('every template git hook is committed executable (100755) and pinned eol=lf', () => {
  const ls = spawnSync('git', ['ls-files', '-s', '--', 'templates/*/.githooks/*'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(ls.status, 0, ls.stderr);
  const rows = ls.stdout.split('\n').filter(Boolean).map((l) => ({ mode: l.split(/\s+/)[0], file: l.split('\t')[1] }));
  assert.ok(rows.length >= 3, 'template hooks found: ' + rows.map((r) => r.file).join(', '));
  const notExec = rows.filter((r) => r.mode !== '100755').map((r) => r.file + ' (' + r.mode + ')');
  assert.deepEqual(notExec, [], 'git skips a non-executable hook on POSIX: the fence would be silently absent');
  const notLf = rows.filter((r) => {
    const a = spawnSync('git', ['check-attr', 'eol', '--', r.file], { cwd: ROOT, encoding: 'utf8' });
    return !/: eol: lf\s*$/.test(a.stdout.trim());
  }).map((r) => r.file);
  assert.deepEqual(notLf, [], 'a CRLF working copy of a /bin/sh hook is "bad interpreter" on POSIX');
});

test('private-working pre-push fails CLOSED when node is missing (exit 1, says so), never "gate SKIPPED" with exit 0', (t) => {
  if (!hasTool('sh', ['-c', 'exit 0'])) { t.skip('no sh on PATH'); return; }
  // A PATH that holds no node, set INSIDE the shell (so the shell itself is found the normal way and no
  // shell-specific trick is needed: dash on a Linux runner and bash on Windows both honour it).
  const r = spawnSync('sh', ['-c', 'PATH=/nonexistent-dir; . "$1"', 'sh', PW_PREPUSH], { encoding: 'utf8' });
  assert.equal(r.status, 1, 'exit ' + r.status + ' stderr=' + r.stderr);
  assert.match(r.stderr, /node not found/);
  assert.doesNotMatch(r.stderr, /SKIPPED/);
});

test('private-working pre-push refuses (exit 1) and names scripts/gate.mjs when the scaffold has no gate script yet', (t) => {
  if (!hasTool('sh', ['-c', 'exit 0']) || !hasTool('git', ['--version'])) { t.skip('no sh or git on PATH'); return; }
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-prepush-'));
  try {
    assert.equal(spawnSync('git', ['init', '-q'], { cwd: repo }).status, 0);
    const r = spawnSync('sh', [PW_PREPUSH], { cwd: repo, encoding: 'utf8' });
    assert.equal(r.status, 1, 'exit ' + r.status + ' stderr=' + r.stderr);
    assert.match(r.stderr, /scripts\/gate\.mjs/);
    assert.doesNotMatch(r.stderr, /MODULE_NOT_FOUND|Cannot find module/, 'a human message, not a node stack trace');
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

// (11) gate.yml's checkout persists the workflow token into .git/config by default, where every later
// step -- including the third-party markdownlint action -- can read it. This workflow pushes nothing.
test('private-working gate.yml checks out with persist-credentials: false (a non-pushing checkout)', () => {
  const y = fs.readFileSync(path.join(TEMPLATES, 'private-working', '.github', 'workflows', 'gate.yml'), 'utf8').replace(/\r\n/g, '\n');
  const step = y.match(/- uses: actions\/checkout@[^\n]*\n((?: {8,}[^\n]*\n)*)/);
  assert.ok(step, 'a checkout step exists');
  assert.match(step[1], /persist-credentials: false/);
});

// ---- AR-46: the canon .coderabbit.yaml (measured trial) --------------------------------------------
// No YAML parser is available without an npm install (Phoenix #2), so the file is read with a dumb line
// check, and the check says what it is: it proves the SHAPE the owner signed, not that the vendor's
// schema accepts it (that is read back with "@coderabbitai configuration" on the first review).
// The shape: profile assertive; path_instructions that each name the rule they restate; nothing that
// is a preference (no tone_instructions -- keep-the-inspector-fresh); the .github repo's own copy is
// the template's, byte for byte.
const CR_TEMPLATE = path.join(TEMPLATES, 'published-code', '.coderabbit.yaml');
const CR_OWN = path.join(ROOT, '.coderabbit.yaml');
const crLines = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n').split('\n');

test('.coderabbit.yaml: the template and the .github repo own copy are byte-identical', () => {
  const a = fs.readFileSync(CR_TEMPLATE, 'utf8').replace(/\r\n/g, '\n');
  const b = fs.readFileSync(CR_OWN, 'utf8').replace(/\r\n/g, '\n');
  assert.equal(a, b);
});

test('.coderabbit.yaml: the signed shape -- assertive, inheritance, four traced path_instructions, no tone_instructions', () => {
  const lines = crLines(CR_TEMPLATE);
  const code = lines.filter((l) => l.trim() !== '' && !l.trim().startsWith('#'));
  assert.ok(!lines.some((l) => l.includes('\t')), 'no tab characters (YAML forbids them for indentation)');
  assert.equal(code.filter((l) => /^\S/.test(l)).map((l) => l.split(':')[0]).join(','), 'inheritance,reviews', 'top-level keys');
  assert.ok(lines.includes('inheritance: true'), 'without it the file REPLACES the org settings (vendor: disabled by default)');
  assert.ok(lines.includes('  profile: assertive'));
  assert.ok(!lines.some((l) => /tone_instructions/.test(l) && !l.trim().startsWith('#')), 'a preference, never a contract');
  const paths = lines.map((l, i) => ({ l, i })).filter((x) => /^ {4}- path: /.test(x.l));
  assert.deepEqual(paths.map((x) => x.l.trim()), [
    '- path: "hooks/**"', '- path: "scripts/**"', '- path: "{README,SECURITY,CONTRIBUTING}.md"', '- path: ".github/workflows/**"',
  ]);
  for (const x of paths) {
    assert.match(lines[x.i - 1], /^ {4}# Restates /, 'the line above ' + x.l.trim() + ' must name the rule it restates');
    assert.equal(lines[x.i + 1], '      instructions: |', 'literal block for ' + x.l.trim());
    assert.match(lines[x.i + 2], /^ {8}\S/, 'a non-empty instruction body for ' + x.l.trim());
  }
  const bodyLines = code.filter((l) => /^ {8}\S/.test(l));
  assert.ok(!bodyLines.some((l) => /\b(style|structure|tone|nits?)\b/i.test(l)), 'no taste in any block: ' + bodyLines.filter((l) => /\b(style|structure|tone|nits?)\b/i.test(l)).join(' | '));
  assert.ok(code.every((l) => (l.match(/^ */)[0].length % 2) === 0), 'indentation is a multiple of two');
});
