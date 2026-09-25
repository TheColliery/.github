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

// ---- UMB-216 (b)(c)(d) + the timeout-minutes canon: every workflow this repo ships or runs ----------
// The templates are the machine-checkable embodiment of SKILL-REPO-PATTERN.md's Layer 5; this repo's own
// .github/workflows/ is held to the same shape (it is the org's face and ships nothing a room lacks).
const OWN_WF = path.join(ROOT, '.github', 'workflows');
const ALL_WORKFLOWS = () => [...workflowFiles(TEMPLATES), ...fs.readdirSync(OWN_WF).filter((f) => /\.ya?ml$/.test(f)).map((f) => path.join(OWN_WF, f))];
const rel = (f) => path.relative(ROOT, f).replace(/\\/g, '/');
const lines = (f) => fs.readFileSync(f, 'utf8').split(/\r?\n/);
// The one workflow that pushes: it checks out with a PAT on purpose and keeps it for its push step.
const PUSHING = new Set(['.github/workflows/update-readme.yml']);

test('every job in every template workflow, and in this repo\'s own, declares timeout-minutes (testing.md: a finite clock; RED before UMB-216)', () => {
  const missing = [];
  for (const f of ALL_WORKFLOWS()) {
    const ls = lines(f);
    const jobsAt = ls.indexOf('jobs:');
    assert.ok(jobsAt >= 0, `${rel(f)} has a jobs: block`);
    for (let i = jobsAt + 1; i < ls.length; i++) {
      if (!/^  [a-z][a-z0-9_-]*:$/.test(ls[i])) continue;
      let j = i + 1;
      let found = false;
      while (j < ls.length && !/^  [a-z][a-z0-9_-]*:$/.test(ls[j])) { if (/^    timeout-minutes: \d+( #.*)?$/.test(ls[j])) found = true; j++; }
      if (!found) missing.push(`${rel(f)}:${i + 1} ${ls[i].trim()}`);
    }
  }
  assert.deepEqual(missing, [], 'a job with no timeout-minutes can hold a runner for 360 minutes');
});

test('every checkout in a workflow that pushes nothing sets persist-credentials: false; the pushing one keeps its token (RED before UMB-216 (d))', () => {
  const bad = [];
  for (const f of ALL_WORKFLOWS()) {
    const ls = lines(f);
    ls.forEach((l, i) => {
      if (!/^\s*- (name: [^\n]*\n\s*)?uses: actions\/checkout@/.test(l) && !/^\s*uses: actions\/checkout@/.test(l)) return;
      // The step's own keys sit two columns right of its "- "; a `uses:` under a `- name:` line shares that column.
      const stepIndent = l.match(/^\s*/)[0].length - (l.trim().startsWith('- ') ? 0 : 2);
      let j = i + 1;
      let persist = null;
      while (j < ls.length && (ls[j].trim() === '' || (ls[j].match(/^\s*/)[0].length > stepIndent && !/^\s*- /.test(ls[j])))) { const m = ls[j].match(/^\s*persist-credentials: (true|false)/); if (m) persist = m[1]; j++; }
      const shouldPersist = PUSHING.has(rel(f));
      if (!shouldPersist && persist !== 'false') bad.push(`${rel(f)}:${i + 1} pushes nothing but persists the token`);
      if (shouldPersist && persist === 'false') bad.push(`${rel(f)}:${i + 1} pushes but dropped its credential`);
    });
  }
  assert.deepEqual(bad, []);
});

test('dependabot-auto-merge (template and this repo\'s copy): the PR URL reaches gh through env PR_URL, never interpolated into run: (RED before UMB-216 (c))', () => {
  for (const f of [path.join(TEMPLATES, 'published-code', '.github', 'workflows', 'dependabot-auto-merge.yml'), path.join(OWN_WF, 'dependabot-auto-merge.yml')]) {
    const y = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(y, /run:[^\n]*\$\{\{ github\.event\.pull_request\.html_url \}\}/, `${rel(f)}: a context inside run: is the script-injection shape`);
    assert.match(y, /PR_URL: \$\{\{ github\.event\.pull_request\.html_url \}\}/, `${rel(f)}: PR_URL env`);
    assert.match(y, /gh pr merge --squash --auto "\$PR_URL"/, `${rel(f)}: the merge reads the env var`);
  }
});

test('this repo carries the template scorecard.yml byte for byte (RED before UMB-216 (b))', () => {
  const own = path.join(OWN_WF, 'scorecard.yml');
  assert.ok(fs.existsSync(own), '.github/workflows/scorecard.yml is missing');
  assert.equal(fs.readFileSync(own, 'utf8').replace(/\r\n/g, '\n'), fs.readFileSync(path.join(TEMPLATES, 'published-code', '.github', 'workflows', 'scorecard.yml'), 'utf8').replace(/\r\n/g, '\n'));
});

test('update-readme.yml: an empty top-level permissions block, the write declared at the job only (RED before UMB-216 (b))', () => {
  const ls = lines(path.join(OWN_WF, 'update-readme.yml'));
  assert.ok(ls.includes('permissions: {}'), 'top-level permissions: {}');
  assert.ok(ls.includes('      contents: write   # least-privilege: granted at the JOB, not the whole workflow'), 'the job-level write stays');
  assert.doesNotMatch(ls.join('\n'), /no app installed on the org/, 'the false "no app installed" comment is gone');
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

// UMB-182: the five Coal* rooms that ship no claude.ai ZIPs get a bare tag-push create-release.yml beside the
// overlay's claude-ai-zips.yml. Both are the SOLE Release creator in their room, so the derive / create / re-read
// steps must stay the same lines in both files (one flock, one color), and neither may drop the UMB-182 parts.
const OVERLAY_WF = path.join(TEMPLATES, 'overlay-coal-skill', '.github', 'workflows');
const wfLines = (name) => fs.readFileSync(path.join(OVERLAY_WF, name), 'utf8').split(/\r?\n/);
// One step, from its `- name:` line up to the next `- name:`/`- uses:` line or a comment at step indent.
function stepBlock(lines, name) {
  const start = lines.indexOf(`      - name: ${name}`);
  if (start === -1) return null;
  let end = start + 1;
  while (end < lines.length && !/^ {6}(- |# )/.test(lines[end])) end++;
  return lines.slice(start, end).join('\n').trimEnd();
}
const SHARED_STEPS = [
  'Read the previous stable tag and the current Latest release',
  'Derive the canon Release title + body from CHANGELOG.md',
  'Ensure the GitHub Release exists, with the derived canon title + body',
  'Verify the published Release matches the derived title + body (byte-exact re-read)',
];

test('create-release.yml exists in the overlay and carries every UMB-182 part -- RED before UMB-182', () => {
  assert.ok(fs.existsSync(path.join(OVERLAY_WF, 'create-release.yml')), 'templates/overlay-coal-skill/.github/workflows/create-release.yml is missing');
  const text = wfLines('create-release.yml').join('\n');
  assert.match(text, /^ {6}- 'v\*'$/m, 'tag-push trigger');
  assert.match(text, /^ {2}cancel-in-progress: false$/m, 'a job that writes a Release is never cancelled');
  assert.match(text, /^ {10}fetch-depth: 0 /m, 'git describe needs the full history for the heading-continuity check (C-2)');
  assert.match(text, /--exclude='\*-\*'/, 'the previous tag is the previous STABLE tag');
  assert.match(text, /releases\/latest/, 'the current Latest is read before create (default-Latest)');
  const code = wfLines('create-release.yml').filter((l) => !l.trim().startsWith('#')).join('\n');
  assert.doesNotMatch(code, /\bzip\b|gh release upload|SHA256SUMS/, 'no packaging, no assets in the bare workflow');
});

test('both overlay workflows pass --latest on create AND edit, and share the derive / create / re-read steps line for line', () => {
  for (const name of ['create-release.yml', 'claude-ai-zips.yml']) {
    const lines = wfLines(name);
    assert.equal(lines.filter((l) => l.includes('--latest="$(cat release-latest.txt)"')).length, 2, `${name}: --latest on both gh release create and gh release edit`);
    assert.ok(lines.some((l) => /^ {10}fetch-depth: 0 /.test(l)), `${name}: fetch-depth 0`);
  }
  const a = wfLines('create-release.yml');
  const b = wfLines('claude-ai-zips.yml');
  for (const step of SHARED_STEPS) {
    const sa = stepBlock(a, step);
    assert.ok(sa, `create-release.yml has no step "${step}"`);
    assert.equal(stepBlock(b, step), sa, `step "${step}" differs between create-release.yml and claude-ai-zips.yml`);
  }
});
