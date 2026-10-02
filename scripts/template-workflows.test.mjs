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

// UMB-232 (P-4, the Bankfire head via the LLM chief): the hook passes the gate what git hands it -- the remote name
// as $1 and the pushed refs on stdin -- so a gate can scan the added lines of the push and judge a new branch
// against the right remote. Bankfire carried it as a named divergence; the template now carries it.
test('private-working pre-push runs the gate with --pre-push and --remote=$1 (RED before UMB-232)', () => {
  const hook = fs.readFileSync(PW_PREPUSH, 'utf8');
  assert.match(hook, /^node "\$gate" --pre-push "--remote=\$1" \|\| \{$/m);
});

test('private-working template ships the canonical .gitattributes, byte-identical to published-code\'s (UMB-232)', () => {
  const pw = path.join(TEMPLATES, 'private-working', '.gitattributes');
  assert.ok(fs.existsSync(pw), 'templates/private-working/.gitattributes is missing');
  assert.equal(fs.readFileSync(pw, 'utf8').replace(/\r\n/g, '\n'), fs.readFileSync(path.join(TEMPLATES, 'published-code', '.gitattributes'), 'utf8').replace(/\r\n/g, '\n'));
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
  'Ensure the GitHub Release exists, with the derived canon title + body',
  'Publish the Release last (after its re-read and any assets), and re-read that it is no longer a draft',
  'Read the previous stable tag and the current Latest release',
  'Derive the canon Release title + body from CHANGELOG.md',
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

test('both overlay workflows pass --latest and --prerelease where the Release is finalized, and share the read / derive / re-read steps line for line', () => {
  const a = wfLines('create-release.yml');
  const b = wfLines('claude-ai-zips.yml');
  // both files: a draft create has no --latest; the edit fallback and the publish step do (UMB-182 D2: create-release.yml drafts too).
  assert.equal(a.filter((l) => l.includes('--latest="$(cat release-latest.txt)"')).length, 2, 'create-release.yml: --latest on the edit fallback and the publish step');
  assert.equal(b.filter((l) => l.includes('--latest="$(cat release-latest.txt)"')).length, 2, 'claude-ai-zips.yml: --latest on the edit fallback and the publish step');
  for (const [name, lines] of [['create-release.yml', a], ['claude-ai-zips.yml', b]]) {
    assert.ok(lines.some((l) => /^ {10}fetch-depth: 0 /.test(l)), `${name}: fetch-depth 0`);
    assert.ok(lines.filter((l) => /gh release (create|edit) /.test(l)).every((l) => l.includes('--prerelease="$(cat release-prerelease.txt)"')), `${name}: --prerelease on every create/edit`);
  }
  for (const step of SHARED_STEPS) {
    const sa = stepBlock(a, step);
    assert.ok(sa, `create-release.yml has no step "${step}"`);
    assert.equal(stepBlock(b, step), sa, `step "${step}" differs between create-release.yml and claude-ai-zips.yml`);
  }
  // the create step differs by exactly the draft flag and the --latest it cannot carry
  const createLine = (lines) => lines.find((l) => l.includes('gh release create'));
  const norm = (l) => l.replace(' --draft', '').replace(' --latest="$(cat release-latest.txt)"', '').trim();
  assert.equal(norm(createLine(b)), norm(createLine(a)), 'the create command is the same apart from --draft and --latest');
});

// UMB-182 posting path for a tag that already exists (a workflow_dispatch run from the DEFAULT BRANCH with a `tag`
// input and a `launch_form` flag), in BOTH canon workflows. The input is untrusted text; these tests hold the shape.
const stepBySubstr = (lines, sub) => {
  const start = lines.findIndex((l) => /^ {6}- name: /.test(l) && l.includes(sub));
  if (start === -1) return null;
  let end = start + 1;
  while (end < lines.length && !/^ {6}(- |# )/.test(lines[end])) end++;
  return lines.slice(start, end);
};
const runBody = (stepLines) => {
  const i = stepLines.findIndex((l) => /^ {8}run: \|$/.test(l));
  assert.ok(i >= 0, 'the step has a run: | block');
  return stepLines.slice(i + 1).map((l) => l.replace(/^ {10}/, '')).join('\n');
};
const GATE_NAME = 'Resolve the tag this run posts';
const BOTH = ['create-release.yml', 'claude-ai-zips.yml'];

test('both canon workflows take a dispatch `tag` input (required string) and a `launch_form` boolean (default false) -- RED before the posting path', () => {
  for (const name of BOTH) {
    const t = wfLines(name).join('\n');
    assert.match(t, /^ {2}workflow_dispatch:\n {4}inputs:\n {6}tag:\n(?: {8}.*\n)*? {8}required: true\n {8}type: string\n {6}launch_form:\n(?: {8}.*\n)*? {8}required: false\n {8}type: boolean\n {8}default: false\n/m, `${name}: dispatch inputs`);
    assert.match(t, /^ {2}group: [a-z-]+-\$\{\{ inputs\.tag \|\| github\.ref_name \}\}$/m, `${name}: the concurrency group is keyed on the tag the run posts`);
  }
});

test('the dispatch inputs reach the shell through env ONLY, never interpolated into a run: line (the input is untrusted text)', () => {
  for (const name of BOTH) {
    const lines = wfLines(name).filter((l) => !l.trim().startsWith('#'));
    const using = lines.filter((l) => /\$\{\{\s*(github\.event\.)?inputs\./.test(l));
    assert.ok(using.length >= 3, `${name}: found ${using.length} expression lines`);
    for (const l of using) {
      assert.ok(/^ {10}INPUT_(TAG|LAUNCH): \$\{\{ inputs\.(tag|launch_form) \}\}$/.test(l) || /^ {2}group: .*\$\{\{ inputs\.tag \|\| github\.ref_name \}\}$/.test(l), `${name}: an input is used outside env and the concurrency key: ${l.trim()}`);
    }
    assert.ok(!lines.some((l) => /github\.event\.inputs|github\.head_ref/.test(l)), `${name}: no other untrusted context`);
  }
});

test('the posting-path gate step is the same lines in both workflows, runs only from the default branch, and refuses anything but a real tag', () => {
  const a = stepBySubstr(wfLines('create-release.yml'), GATE_NAME);
  const b = stepBySubstr(wfLines('claude-ai-zips.yml'), GATE_NAME);
  assert.ok(a && b, 'the gate step exists in both');
  assert.equal(a.join('\n'), b.join('\n'));
  const body = runBody(a);
  assert.match(body, /\[\[ "\$\{REF_TYPE\}" != "branch" \|\| "\$\{REF_NAME\}" != "\$\{DEFAULT_BRANCH\}" \]\]/, 'a dispatch off the default branch is refused');
  assert.ok(body.includes('^v[0-9]+\\.[0-9]+\\.[0-9]+(-[0-9A-Za-z][0-9A-Za-z.-]*)?$'), 'the strict tag pattern');
  assert.ok(body.includes('git/matching-refs/tags/${tag}') && body.includes('grep -Fxq -- "refs/tags/${tag}"'), 'the tag must exist in the repository, compared by exact ref name (a prefix match is not a tag)');
  assert.ok(!body.includes('git/ref/tags/'), 'git/ref/tags answers 200 for a mere prefix, so it is never the existence check');
  assert.ok(body.includes('launch_form'), 'a pre-release tag needs the launch form flag');
  assert.ok(body.includes('select(.tag_name != \\"${tag}\\")'), 'the launch form is refused when another tag already has a Release');
});

test('both workflows check out the canon scripts and the tag separately, and derive from the TAG tree with the canon scripts (a back-filled tag may predate the scripts)', () => {
  for (const name of BOTH) {
    const t = wfLines(name).join('\n');
    assert.match(t, /^ {10}path: canon$/m, `${name}: canon checkout`);
    assert.match(t, /^ {10}ref: refs\/tags\/\$\{\{ steps\.gate\.outputs\.tag \}\}$/m, `${name}: the tag checkout`);
    assert.match(t, /^ {10}path: tag-src$/m, `${name}: tag-src path`);
    assert.ok(t.includes('run: node ../canon/scripts/release-notes.mjs'), `${name}: derive with the canon script`);
    assert.ok(t.includes('node ../canon/scripts/verify-release-shape.mjs'), `${name}: re-read with the canon script`);
  }
});

test('claude-ai-zips.yml publishes in the right order: draft create, re-read, assets attached, THEN published (CWK-119); zip/cd/sha256sum carry -- guards', () => {
  const lines = wfLines('claude-ai-zips.yml');
  const t = lines.join('\n');
  const idx = (re) => lines.findIndex((l) => re.test(l));
  const create = idx(/gh release create .* --draft /);
  const reread = idx(/gh release view .*--json name,body/);
  const upload = idx(/gh release upload /);
  const publish = idx(/gh release edit .* --draft=false /);
  assert.ok(create > 0 && reread > create && upload > reread && publish > upload, `order: create ${create}, re-read ${reread}, upload ${upload}, publish ${publish}`);
  assert.ok(lines.filter((l) => l.includes('gh release create')).every((l) => !l.includes('--latest')), 'a draft create never passes --latest (a draft cannot be Latest)');
  assert.ok(publish > 0 && lines[publish].includes('--latest="$(cat release-latest.txt)"') && lines[publish].includes('--prerelease="$(cat release-prerelease.txt)"'), 'the publish step applies Latest and prerelease');
  assert.ok(t.includes('"cd -- dist-claude-ai"'.slice(1, -1)) && t.includes('zip -r "${name}.zip" "${name}"') && t.includes('sha256sum -- *.zip'), '-- guards on cd and sha256sum; the skill FOLDER is zipped from its parent (UMB-333)');
  assert.ok(!/zip -r --/.test(t), 'zip refuses "--" before the archive name (zip error: can\'t use -- before archive name, measured on the runner 2026-10-02): a leading-dash name is refused by a name check instead');
  assert.ok(t.includes('^[A-Za-z0-9][A-Za-z0-9._-]*$'), 'the staged directory name is checked before it reaches zip as an argument');
  assert.ok(t.includes('isDraft') && t.includes('is still a draft after the publish step'), 'the run re-reads that the Release is no longer a draft');
});

// UMB-182 D2 (auditor F-2): common/git-workflow.md's MUST -- a release workflow creates the Release as a DRAFT and publishes last --
// holds on the no-asset file too, so a body the API mangled is never public between the create and the failed re-read.
test('create-release.yml publishes in the right order: draft create, byte re-read, THEN published and re-read as no longer a draft', () => {
  const lines = wfLines('create-release.yml');
  const idx = (re) => lines.findIndex((l) => re.test(l));
  const create = idx(/gh release create .* --draft /);
  const reread = idx(/gh release view .*--json name,body/);
  const publish = idx(/gh release edit .* --draft=false /);
  assert.ok(create > 0 && reread > create && publish > reread, `order: create ${create}, re-read ${reread}, publish ${publish}`);
  assert.ok(lines.filter((l) => l.includes('gh release create')).every((l) => !l.includes('--latest')), 'a draft create never passes --latest (a draft cannot be Latest)');
  assert.ok(lines[publish].includes('--latest="$(cat release-latest.txt)"') && lines[publish].includes('--prerelease="$(cat release-prerelease.txt)"'), 'the publish step applies Latest and prerelease');
  const t = lines.join('\n');
  assert.ok(t.includes('isDraft') && t.includes('is still a draft after the publish step'), 'the run re-reads that the Release is no longer a draft');
});

test('claude-ai-zips.yml: a back-filled tag older than the packaging scripts gets a Release WITHOUT ZIPs, said out loud; a pushed tag without them fails', () => {
  const lines = wfLines('claude-ai-zips.yml');
  const step = stepBySubstr(lines, 'Check the tag carries its own packaging scripts');
  assert.ok(step, 'the packaging-scripts check exists');
  const s = step.join('\n');
  assert.ok(s.includes('predates the packaging scripts') && s.includes('WITHOUT ZIP assets'), 'the notice');
  assert.ok(s.includes('EVENT') && s.includes('"push"') && s.includes('exit 1'), 'a push without the scripts is an error');
  for (const n of ['Verify plugin/ dist is current', 'Stage trimmed-description', 'Zip each staged skill', 'Check each ZIP holds its skill folder', 'Generate SHA256SUMS', 'Attach ZIPs']) {
    const st = stepBySubstr(lines, n);
    assert.ok(st && st.some((l) => l.includes("steps.pkg.outputs.package == 'true'")), `${n}: gated on the packaging check`);
  }
});

// Behaviour, not text: the gate step's own bash, run against a stub `gh`, for every case the path must get right.
const bashProbe = spawnSync('bash', ['-c', 'echo ok'], { encoding: 'utf8', timeout: 20000 });
const HAS_BASH = bashProbe.status === 0 && bashProbe.stdout.trim() === 'ok';
const GH_STUB = [
  'gh() {',
  '  case "$*" in',
  '    *git/ref/tags/*) a="$*"; name="${a##*git/ref/tags/}"; name="${name%% *}"; for t in ${FAKE_TAGS-v2.6.0 v1.0.0 v0.1.0-beta.1}; do [[ "$t" == "$name"* ]] && return 0; done; return 1 ;;', // GitHub: 200 on a prefix match
  '    *git/matching-refs/tags/*) a="$*"; name="${a##*git/matching-refs/tags/}"; name="${name%% *}"; for t in ${FAKE_TAGS-v2.6.0 v1.0.0 v0.1.0-beta.1}; do [[ "$t" == "$name"* ]] && echo "refs/tags/$t"; done; return 0 ;;',
  '    *"releases?per_page=100"*) echo "${FAKE_OTHER_RELEASES:-0}"; return 0 ;;',
  '    *) echo "unexpected gh call: $*" >&2; return 99 ;;',
  '  esac',
  '}',
].join('\n');
function runGate(env) {
  const body = runBody(stepBySubstr(wfLines('create-release.yml'), GATE_NAME));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-run-'));
  const outFile = path.join(dir, 'output.txt');
  fs.writeFileSync(outFile, '');
  const r = spawnSync('bash', ['-c', `${GH_STUB}\n${body}`], {
    encoding: 'utf8', timeout: 30000, cwd: dir,
    env: { ...process.env, GITHUB_OUTPUT: outFile, GITHUB_REPOSITORY: 'TheColliery/Example', DEFAULT_BRANCH: 'main', EVENT: 'workflow_dispatch', REF_TYPE: 'branch', REF_NAME: 'main', INPUT_TAG: '', INPUT_LAUNCH: 'false', ...env },
  });
  const out = fs.readFileSync(outFile, 'utf8');
  fs.rmSync(dir, { recursive: true, force: true });
  return { code: r.status, out, err: r.stderr + r.stdout };
}

test('gate behaviour: a stable tag push posts; a pre-release tag push and a branch push do not; nothing is written to the repository', { skip: !HAS_BASH && 'no bash on this machine' }, () => {
  let r = runGate({ EVENT: 'push', REF_TYPE: 'tag', REF_NAME: 'v1.2.3' });
  assert.equal(r.code, 0); assert.match(r.out, /post=true\ntag=v1\.2\.3\nlaunch=false/);
  r = runGate({ EVENT: 'push', REF_TYPE: 'tag', REF_NAME: 'v1.2.3-beta.1' });
  assert.equal(r.code, 0); assert.match(r.out, /post=false/); assert.ok(!r.out.includes('post=true'));
  r = runGate({ EVENT: 'push', REF_TYPE: 'branch', REF_NAME: 'main' });
  assert.equal(r.code, 0); assert.match(r.out, /post=false/);
});

test('gate behaviour: a dispatch for an existing stable tag from the default branch posts that tag', { skip: !HAS_BASH && 'no bash on this machine' }, () => {
  const r = runGate({ INPUT_TAG: 'v2.6.0' });
  assert.equal(r.code, 0, r.err); assert.match(r.out, /post=true\ntag=v2\.6\.0\nlaunch=false/);
});

test('gate behaviour: a dispatch is refused off the default branch, for a malformed or shell-shaped tag, and for a tag that does not exist', { skip: !HAS_BASH && 'no bash on this machine' }, () => {
  let r = runGate({ INPUT_TAG: 'v2.6.0', REF_TYPE: 'tag', REF_NAME: 'v2.6.0' });
  assert.equal(r.code, 1); assert.match(r.err, /default branch/); assert.ok(!r.out.includes('post=true'));
  r = runGate({ INPUT_TAG: 'dev-branch', REF_NAME: 'dev', REF_TYPE: 'branch' });
  assert.equal(r.code, 1); assert.match(r.err, /default branch/);
  for (const bad of ['v2.6.0; echo pwned', '$(id)', 'v2.6', 'main', 'v2.6.0-', 'v2.6.0 -beta', '']) {
    r = runGate({ INPUT_TAG: bad });
    assert.equal(r.code, 1, JSON.stringify(bad)); assert.match(r.err, /not a vX\.Y\.Z/, JSON.stringify(bad)); assert.ok(!r.out.includes('post=true'));
  }
  r = runGate({ INPUT_TAG: 'v9.9.9' });
  assert.equal(r.code, 1); assert.match(r.err, /not a tag of this repository/);
});

// UMB-182 D2 (auditor F-1): GitHub's "get a reference" answers 200 for a PREFIX of an existing ref, so v1.2.3 used to pass
// the gate when only v1.2.30 and v1.2.3-beta.1 existed and the run died later, in checkout, with checkout's words.
test('gate behaviour: a tag that only PREFIX-matches an existing ref is refused by the gate itself, and an exact tag beside a longer one still posts', { skip: !HAS_BASH && 'no bash on this machine' }, () => {
  let r = runGate({ INPUT_TAG: 'v1.2.3', FAKE_TAGS: 'v1.2.30 v1.2.3-beta.1' });
  assert.equal(r.code, 1, r.err); assert.match(r.err, /not a tag of this repository/); assert.ok(!r.out.includes('post=true'));
  r = runGate({ INPUT_TAG: 'v1.2.3', FAKE_TAGS: 'v1.2.30 v1.2.3 v1.2.3-beta.1' });
  assert.equal(r.code, 0, r.err); assert.match(r.out, /post=true\ntag=v1\.2\.3\nlaunch=false/);
  r = runGate({ INPUT_TAG: 'v1.2.3', FAKE_TAGS: '' });
  assert.equal(r.code, 1, r.err); assert.match(r.err, /not a tag of this repository/);
});

test('gate behaviour: the launch form posts ONE pre-release tag only with the flag, only while no other tag has a Release, never for a stable tag', { skip: !HAS_BASH && 'no bash on this machine' }, () => {
  let r = runGate({ INPUT_TAG: 'v0.1.0-beta.1' });
  assert.equal(r.code, 1); assert.match(r.err, /launch_form/);
  r = runGate({ INPUT_TAG: 'v0.1.0-beta.1', INPUT_LAUNCH: 'true', FAKE_OTHER_RELEASES: '3' });
  assert.equal(r.code, 1); assert.match(r.err, /ONE pre-release Release/);
  r = runGate({ INPUT_TAG: 'v0.1.0-beta.1', INPUT_LAUNCH: 'true', FAKE_OTHER_RELEASES: '0' });
  assert.equal(r.code, 0, r.err); assert.match(r.out, /post=true\ntag=v0\.1\.0-beta\.1\nlaunch=true/);
  r = runGate({ INPUT_TAG: 'v1.0.0', INPUT_LAUNCH: 'true' });
  assert.equal(r.code, 1); assert.match(r.err, /stable/);
});

// UMB-333: claude.ai's page says the ZIP must hold the skill FOLDER as its top level (<name>/SKILL.md); a SKILL.md at the
// archive root "isn't recognized as a skill". The overlay used to zip the folder's CONTENTS ("cd name && zip -r ../name.zip .").
// Archives here are built by a tiny stored-ZIP writer so the check step's own bash is exercised without the zip binary.
function crc32(buf) {
  let crc = 0xffffffff;
  for (const b of buf) {
    let c = (crc ^ b) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function makeZip(entries) {
  const local = []; const central = []; let offset = 0;
  for (const [name, text] of entries) {
    const n = Buffer.from(name, 'utf8'); const data = Buffer.from(text, 'utf8'); const crc = crc32(data);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x21, 12); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(n.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x21, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(n.length, 28); ch.writeUInt32LE(offset, 42);
    local.push(lh, n, data); central.push(ch, n); offset += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(central);
  const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10); eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, cd, eocd]);
}
const haveTool = (cmd) => HAS_BASH && spawnSync('bash', ['-c', `command -v ${cmd}`], { encoding: 'utf8', timeout: 20000 }).status === 0;
const HAS_UNZIP = haveTool('unzip');
const HAS_ZIP = haveTool('zip');
const stepRun = (name) => runBody(stepBySubstr(wfLines('claude-ai-zips.yml'), name));
function inTemp(prefix, setup, body) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  try {
    fs.mkdirSync(path.join(dir, 'dist-claude-ai'));
    setup(path.join(dir, 'dist-claude-ai'));
    return spawnSync('bash', ['-c', body], { encoding: 'utf8', timeout: 30000, cwd: dir });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('claude-ai-zips.yml zips the skill FOLDER from its parent, never its contents (RED before UMB-333)', () => {
  const body = stepRun('Zip each staged skill');
  assert.ok(body.includes('zip -r "${name}.zip" "${name}"'), 'the folder name is the zip argument');
  assert.ok(!/cd -- "\$name" &&/.test(body), 'no subshell that enters the skill folder before zipping');
  assert.ok(!body.includes('"../${name}.zip" .'), 'never zip "." inside the folder');
});

test('the Zip step builds <name>/SKILL.md at the top level of a real archive', { skip: !(HAS_ZIP && HAS_UNZIP) && 'no zip and unzip on this machine (CI has both)' }, () => {
  const r = inTemp('zip-build-', (dist) => {
    fs.mkdirSync(path.join(dist, 'demo-skill', 'references'), { recursive: true });
    fs.writeFileSync(path.join(dist, 'demo-skill', 'SKILL.md'), '---\nname: demo-skill\n---\n');
    fs.writeFileSync(path.join(dist, 'demo-skill', 'references', 'a.md'), 'a');
    fs.writeFileSync(path.join(dist, 'demo-skill', '.hidden'), 'x');
  }, `${stepRun('Zip each staged skill')}\nunzip -Z1 dist-claude-ai/demo-skill.zip`);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const listed = r.stdout.split(/\r?\n/).filter((l) => l.startsWith('demo-skill/'));
  assert.ok(listed.includes('demo-skill/SKILL.md') && listed.includes('demo-skill/references/a.md'), r.stdout);
  assert.ok(!r.stdout.split(/\r?\n/).includes('SKILL.md'), 'no SKILL.md at the archive root');
  assert.ok(!r.stdout.includes('.hidden'), 'a top-level dotfile stays out, as before');
});

test('the layout check passes a folder-rooted archive and fails one whose SKILL.md sits at the root or whose top level is another folder', { skip: !HAS_UNZIP && 'no unzip on this machine (CI has it)' }, () => {
  const body = stepRun('Check each ZIP holds its skill folder');
  const run = (entries, zipName = 'demo-skill.zip') => inTemp('zip-check-', (dist) => fs.writeFileSync(path.join(dist, zipName), makeZip(entries)), body);
  let r = run([['demo-skill/', ''], ['demo-skill/SKILL.md', 'x'], ['demo-skill/references/', ''], ['demo-skill/references/a.md', 'a']]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  r = run([['SKILL.md', 'x'], ['references/', ''], ['references/a.md', 'a']]);
  assert.equal(r.status, 1); assert.match(r.stdout + r.stderr, /demo-skill\.zip has an entry outside demo-skill\//);
  r = run([['other-skill/SKILL.md', 'x']]);
  assert.equal(r.status, 1); assert.match(r.stdout + r.stderr, /outside demo-skill\//);
  r = run([['demo-skill/README.md', 'x']]);
  assert.equal(r.status, 1); assert.match(r.stdout + r.stderr, /no demo-skill\/SKILL\.md/);
  r = run([['demo-skill/SKILL.md', 'x'], ['SKILL.md', 'y']]);
  assert.equal(r.status, 1, 'one stray root entry fails the whole archive');
});

test('the layout check runs after the zip step and before the Release is created or any asset is attached', () => {
  const lines = wfLines('claude-ai-zips.yml');
  const at = (sub) => lines.findIndex((l) => /^ {6}- name: /.test(l) && l.includes(sub));
  const zip = at('Zip each staged skill'); const check = at('Check each ZIP holds its skill folder'); const sums = at('Generate SHA256SUMS'); const create = at('Ensure the GitHub Release exists'); const attach = at('Attach ZIPs');
  assert.ok(zip > 0 && check > zip && sums > check && create > check && attach > create, `order: zip ${zip}, check ${check}, sums ${sums}, create ${create}, attach ${attach}`);
});
