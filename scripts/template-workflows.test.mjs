import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { normalizePins, pinsOf } from './lib/pin-normalize.mjs';
import { scanGitSpawns, gitBlobId } from '../templates/overlay-coal-skill/scripts/lib/git-env-census.mjs';

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
const hasTool = (cmd, args) => { const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: 30000 }); return !r.error && r.status === 0; };
const PW_PREPUSH = path.join(TEMPLATES, 'private-working', '.githooks', 'pre-push');

test('every template git hook is committed executable (100755) and pinned eol=lf', () => {
  const ls = spawnSync('git', ['ls-files', '-s', '--', 'templates/*/.githooks/*'], { cwd: ROOT, encoding: 'utf8', timeout: 30000 });
  assert.equal(ls.status, 0, ls.stderr);
  const rows = ls.stdout.split('\n').filter(Boolean).map((l) => ({ mode: l.split(/\s+/)[0], file: l.split('\t')[1] }));
  assert.ok(rows.length >= 3, 'template hooks found: ' + rows.map((r) => r.file).join(', '));
  const notExec = rows.filter((r) => r.mode !== '100755').map((r) => r.file + ' (' + r.mode + ')');
  assert.deepEqual(notExec, [], 'git skips a non-executable hook on POSIX: the fence would be silently absent');
  const notLf = rows.filter((r) => {
    const a = spawnSync('git', ['check-attr', 'eol', '--', r.file], { cwd: ROOT, encoding: 'utf8', timeout: 30000 });
    return !/: eol: lf\s*$/.test(a.stdout.trim());
  }).map((r) => r.file);
  assert.deepEqual(notLf, [], 'a CRLF working copy of a /bin/sh hook is "bad interpreter" on POSIX');
});

test('private-working pre-push fails CLOSED when node is missing (exit 1, says so), never "gate SKIPPED" with exit 0', (t) => {
  if (!hasTool('sh', ['-c', 'exit 0'])) { t.skip('no sh on PATH'); return; }
  // A PATH that holds no node, set INSIDE the shell (so the shell itself is found the normal way and no
  // shell-specific trick is needed: dash on a Linux runner and bash on Windows both honour it).
  const r = spawnSync('sh', ['-c', 'PATH=/nonexistent-dir; . "$1"', 'sh', PW_PREPUSH], { encoding: 'utf8', timeout: 30000 });
  assert.equal(r.status, 1, 'exit ' + r.status + ' stderr=' + r.stderr);
  assert.match(r.stderr, /node not found/);
  assert.doesNotMatch(r.stderr, /SKIPPED/);
});

test('private-working pre-push refuses (exit 1) and names scripts/gate.mjs when the scaffold has no gate script yet', (t) => {
  if (!hasTool('sh', ['-c', 'exit 0']) || !hasTool('git', ['--version'])) { t.skip('no sh or git on PATH'); return; }
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-prepush-'));
  try {
    assert.equal(spawnSync('git', ['init', '-q'], { cwd: repo, timeout: 30000 }).status, 0);
    const r = spawnSync('sh', [PW_PREPUSH], { cwd: repo, encoding: 'utf8', timeout: 30000 });
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

// 21a item 1 (the Chotmeter head's canon proposal (a)): the test above reads a checkout only in the two block forms it matches, so a step written in a form it cannot read
// (flow style, a quoted uses:) was skipped, never judged, and a persisting checkout in that form passed. A non-comment line that names actions/checkout@ and is not one of
// the two readable forms is now a FAIL, the same rule the Chotmeter room's gate.mjs holds. The limit stays stated: a line scan.
const checkoutScan = (text) => {
  const code = text.split(/\r?\n/).filter((l) => !/^\s*#/.test(l));
  const mentions = code.filter((l) => /actions\/checkout@/i.test(l)).length;
  const read = code.filter((l) => /^\s*(?:- )?uses: actions\/checkout@/.test(l)).length;
  return { mentions, read, unreadable: mentions - read };
};
test('a checkout written in a form the line scan cannot read is a FAIL, never a skip: flow style and a quoted uses: are caught, a comment is not (the Chotmeter proposal (a), 21a)', () => {
  const unread = ALL_WORKFLOWS().map((f) => [rel(f), checkoutScan(fs.readFileSync(f, 'utf8')).unreadable]).filter(([, n]) => n !== 0);
  assert.deepEqual(unread, [], 'every workflow\'s checkout is a block step the persist-credentials test reads');
  assert.equal(checkoutScan('steps:\n  - {uses: actions/checkout@abc, with: {persist-credentials: true}}\n').unreadable, 1, 'flow style');
  assert.equal(checkoutScan('steps:\n  - uses: "actions/checkout@abc"\n').unreadable, 1, 'quoted');
  assert.equal(checkoutScan('steps:\n  # - uses: actions/checkout@abc\n  - uses: actions/checkout@abc\n').unreadable, 0, 'a comment is not a step, a block step is read');
  assert.equal(checkoutScan('steps:\n  - name: x\n    uses: actions/checkout@abc\n').unreadable, 0, 'the key under a named step is read');
});

// 21a item 1 (proposal (b)): the private-working gate workflow must still RUN the gate and its test file. The template's two steps are guarded by hashFiles (a bare "Use this template" click
// stays green until the room's own gate lands), so the guard is allowed; a deleted or commented-out run: line is not. Limit, stated: a line scan, a step that is present but disabled
// (if: false, continue-on-error: true, || true) is not seen.
const runLineMissing = (text, cmds) => cmds.filter((c) => !text.split(/\r?\n/).some((l) => !/^\s*#/.test(l) && /^\s*(?:- )?run:/.test(l) && l.includes(c)));
test('the private-working gate.yml keeps a non-comment run: line for the gate and for its test file; a deleted or commented-out line is caught (the Chotmeter proposal (b), 21a)', () => {
  const y = fs.readFileSync(path.join(TEMPLATES, 'private-working', '.github', 'workflows', 'gate.yml'), 'utf8');
  const CMDS = ['node --test scripts/gate.test.mjs', 'node scripts/gate.mjs'];
  assert.deepEqual(runLineMissing(y, CMDS), []);
  assert.deepEqual(runLineMissing(y.replace(/^(\s*)run: node scripts\/gate\.mjs/m, '$1# run: node scripts/gate.mjs'), CMDS), ['node scripts/gate.mjs'], 'commented out');
  assert.deepEqual(runLineMissing(y.replace(/^\s*run: node --test scripts\/gate\.test\.mjs\r?\n/m, ''), CMDS), ['node --test scripts/gate.test.mjs'], 'deleted');
  assert.deepEqual(runLineMissing(y.replace(/run: node scripts\/gate\.mjs --verbose/, 'run: echo ok'), CMDS), ['node scripts/gate.mjs'], 'a run that no longer names it');
});

test('dependabot-auto-merge (template and this repo\'s copy): the PR URL reaches gh through env PR_URL, never interpolated into run: (RED before UMB-216 (c))', () => {
  for (const f of [path.join(TEMPLATES, 'published-code', '.github', 'workflows', 'dependabot-auto-merge.yml'), path.join(OWN_WF, 'dependabot-auto-merge.yml')]) {
    const y = fs.readFileSync(f, 'utf8');
    assert.doesNotMatch(y, /run:[^\n]*\$\{\{ github\.event\.pull_request\.html_url \}\}/, `${rel(f)}: a context inside run: is the script-injection shape`);
    assert.match(y, /PR_URL: \$\{\{ github\.event\.pull_request\.html_url \}\}/, `${rel(f)}: PR_URL env`);
    assert.match(y, /gh pr merge --squash --auto "\$PR_URL"/, `${rel(f)}: the merge reads the env var`);
  }
});

// UMB-256: the structure is byte-identical; each copy's action pins stay its own Dependabot's (dependabot.yml scans / only, so a bump
// reaches the live file and never the template, and the byte-for-byte form turned `verify` red on every bump). The pin normaliser is
// shared with skeleton-check and the overlay compare (scripts/lib/pin-normalize.mjs, held by pin-normalize.test.mjs).
test('this repo carries the template scorecard.yml with every action pin normalised: same structure, each copy keeps its own pins (RED before UMB-216 (b), pin-normalised since UMB-256)', () => {
  const own = path.join(OWN_WF, 'scorecard.yml');
  assert.ok(fs.existsSync(own), '.github/workflows/scorecard.yml is missing');
  const template = fs.readFileSync(path.join(TEMPLATES, 'published-code', '.github', 'workflows', 'scorecard.yml'), 'utf8');
  assert.equal(normalizePins(fs.readFileSync(own, 'utf8')), normalizePins(template));
  assert.ok(pinsOf(template).length >= 2, 'the normaliser sees the template pins (not vacuous)');
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

test('.coderabbit.yaml: the signed shape -- assertive, inheritance, the knowledge_base posture, five traced path_instructions, no tone_instructions', () => {
  const lines = crLines(CR_TEMPLATE);
  const code = lines.filter((l) => l.trim() !== '' && !l.trim().startsWith('#'));
  assert.ok(!lines.some((l) => l.includes('\t')), 'no tab characters (YAML forbids them for indentation)');
  assert.equal(code.filter((l) => /^\S/.test(l)).map((l) => l.split(':')[0]).join(','), 'inheritance,knowledge_base,reviews', 'top-level keys');
  assert.ok(lines.includes('inheritance: true'), 'without it the file REPLACES the org settings (vendor: disabled by default)');
  assert.ok(lines.includes('  profile: assertive'));
  assert.ok(!lines.some((l) => /tone_instructions/.test(l) && !l.trim().startsWith('#')), 'a preference, never a contract');
  const paths = lines.map((l, i) => ({ l, i })).filter((x) => /^ {4}- path: /.test(x.l));
  assert.deepEqual(paths.map((x) => x.l.trim()), [
    '- path: "hooks/**"', '- path: "scripts/**"', '- path: "{README,SECURITY,CONTRIBUTING}.md"', '- path: ".github/workflows/**"',
    '- path: "scripts/{lib/secret-scan.mjs,secret-scan.test.mjs,secret-gate.mjs,secret-gate.test.mjs}"',
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

// BB-82 (owner 2026-10-08): the teaching posture in every repo kind's .coderabbit.yaml. The published-code canon is the source; the article kind is derived from it
// (the hooks and scripts blocks dropped; the doc, workflow and parity-held scanner blocks and the knowledge_base block kept, because the article scaffold carries the
// scanner and gate copies); the private-working kind keeps the knowledge base off. Each of the four files states the owner's law in its header.
const CR_PRIVATE = path.join(TEMPLATES, 'private-working', '.coderabbit.yaml');
const CR_ARTICLE = path.join(TEMPLATES, 'article', '.coderabbit.yaml');
const CR_CODE = (p) => crLines(p).filter((l) => l.trim() !== '' && !l.trim().startsWith('#'));
const OWNER_LAW = 'ถ้าจะสอน CodeRabbit อย่าสอนให้เข้าพวก เพราะตัวตรวจจับ จะไม่เป็นตัวตรวจจับอีกต่อไป';
// One path_instructions block: its "# Restates" comment line through the line before the next block's comment (or the end).
function crBlock(lines, pathLine) {
  const at = lines.indexOf(pathLine);
  assert.ok(at > 0, 'the block exists: ' + pathLine);
  let end = at + 1;
  while (end < lines.length && !/^ {4}# Restates /.test(lines[end])) end++;
  return lines.slice(at - 1, end).join('\n').trimEnd();
}

test('.coderabbit.yaml, every kind: the owner\'s law on teaching is stated in the header comment, verbatim -- RED before BB-82', () => {
  for (const p of [CR_TEMPLATE, CR_OWN, CR_PRIVATE, CR_ARTICLE]) {
    assert.ok(fs.existsSync(p), 'missing ' + p);
    const header = crLines(p).filter((l) => l.startsWith('#')).join('\n');
    assert.ok(header.includes(OWNER_LAW), p + ' carries the law');
  }
});

test('.coderabbit.yaml knowledge_base: the public kinds keep Learnings repository-local behind the maximum approval delay and never flip the data switch; the private kind opts out -- RED before BB-82', () => {
  for (const p of [CR_TEMPLATE, CR_ARTICLE]) {
    const c = CR_CODE(p);
    const at = c.indexOf('knowledge_base:');
    assert.ok(at >= 0, p + ' has the block');
    assert.deepEqual(c.slice(at, at + 4), ['knowledge_base:', '  learnings:', '    scope: local', '    approval_delay: 30']);
    assert.ok(!c.some((l) => /opt_out/.test(l)), p + ': the switch is the owner\'s dashboard click, a repository file never flips it');
  }
  assert.deepEqual(CR_CODE(CR_PRIVATE), ['inheritance: true', 'knowledge_base:', '  opt_out: true', '  code_guidelines:', '    enabled: false']);
});

// UMB3-066 (2), the owner's "ทำ 2 ข้อ" of 2026-10-21: the code guidelines are off in every kind (the product under review must not become the reviewer's own rule, the owner's law of
// 2026-10-08) and the key sits INSIDE the one knowledge_base block, never a second top-level key. The block is byte-equal across the canon, the article kind and this repo's own file.
test('.coderabbit.yaml, every kind: knowledge_base.code_guidelines.enabled is false inside the one knowledge_base block, and the block is byte-equal across the kinds -- RED before UMB3-066 (2)', () => {
  const block = (ls) => { const at = ls.indexOf('  code_guidelines:'); assert.ok(at > 0); return ls.slice(at, ls.indexOf('    enabled: false', at) + 1).join('\n'); };
  const canon = block(crLines(CR_TEMPLATE));
  for (const p of [CR_TEMPLATE, CR_OWN, CR_ARTICLE, CR_PRIVATE]) {
    const ls = crLines(p);
    const c = CR_CODE(p);
    assert.equal(c.filter((l) => /^knowledge_base:/.test(l)).length, 1, p + ': one knowledge_base key');
    const at = c.indexOf('  code_guidelines:');
    assert.ok(at > c.indexOf('knowledge_base:'), p + ': nested under knowledge_base');
    assert.equal(c[at + 1], '    enabled: false', p);
    assert.equal(c.filter((l) => /^\S/.test(l) && l.split(':')[0] !== 'inheritance' && l.split(':')[0] !== 'knowledge_base' && l.split(':')[0] !== 'reviews').length, 0, p + ': no stray top-level key');
    assert.equal(block(ls), canon, p + ': the block is the canon\'s');
  }
});

test('.coderabbit.yaml article kind: derived from the canon -- no hooks or scripts block, the doc, workflow and scanner blocks byte-equal to the canon\'s, the same knowledge_base block -- RED before BB-82', () => {
  const canon = crLines(CR_TEMPLATE);
  const art = crLines(CR_ARTICLE);
  assert.equal(CR_CODE(CR_ARTICLE).filter((l) => /^\S/.test(l)).map((l) => l.split(':')[0]).join(','), 'inheritance,knowledge_base,reviews');
  assert.ok(art.includes('inheritance: true') && art.includes('  profile: assertive'));
  const paths = art.filter((l) => /^ {4}- path: /.test(l)).map((l) => l.trim());
  assert.deepEqual(paths, [
    '- path: "{README,SECURITY,CONTRIBUTING}.md"', '- path: ".github/workflows/**"',
    '- path: "scripts/{lib/secret-scan.mjs,secret-scan.test.mjs,secret-gate.mjs,secret-gate.test.mjs}"',
  ]);
  for (const p of paths) {
    const line = '    ' + p;
    assert.equal(crBlock(art, line), crBlock(canon, line), 'the block is the canon\'s, never retyped: ' + p);
  }
  const kb = (ls) => ls.slice(ls.indexOf('knowledge_base:'), ls.indexOf('knowledge_base:') + 4).join('\n');
  assert.equal(kb(art), kb(canon));
});

test('.coderabbit.yaml scanner block: it restates the parity contract (the fix lands at the canon\'s source) and never lowers a finding -- a contract, not a suppression -- RED before BB-82', () => {
  for (const p of [CR_TEMPLATE, CR_OWN, CR_ARTICLE]) {
    const text = crBlock(crLines(p), '    - path: "scripts/{lib/secret-scan.mjs,secret-scan.test.mjs,secret-gate.mjs,secret-gate.test.mjs}"');
    assert.match(text, /^ {4}# Restates the scanner canon's parity contract/m);
    assert.match(text, /report every finding at its severity/);
    assert.match(text, /the fix is made at the canon's source and arrives here by blob id at the next sync/);
    assert.match(text, /Never lower a severity, drop a finding or accept a local patch because the file is a copy/);
    assert.ok(!/\b(ignore|suppress|stay quiet|do not report|no finding)\b/i.test(text.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n')), 'no instruction to stay quiet');
  }
});

test('.coderabbit.yaml, every kind: no string value holds a double quote or a backslash (the settings editor mangles both) -- RED before BB-82', () => {
  for (const p of [CR_TEMPLATE, CR_OWN, CR_PRIVATE, CR_ARTICLE]) {
    for (const l of CR_CODE(p)) {
      // A path value is a quoted scalar: only its inside counts, the delimiters are YAML's own.
      const value = l.replace(/^( *- path: )"(.*)"$/, '$1$2');
      assert.ok(!/["\\]/.test(value), p + ': ' + l.trim());
    }
  }
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
    // the re-point step edits the OLD tag's Release (draft, move its tag) and publishes nothing, so it carries no --prerelease
    assert.ok(lines.filter((l) => /gh release (create|edit) /.test(l) && !l.includes('"${OLD_TAG}"')).every((l) => l.includes('--prerelease="$(cat release-prerelease.txt)"')), `${name}: --prerelease on every create/edit`);
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
  assert.ok(body.includes("releases?per_page=100") && body.includes("--jq '.[].tag_name'"), 'the launch form reads every Release tag (drafts included, paginated), not a count');
  assert.ok(body.includes('compare/${old}...${tag}') && body.includes('!= "ahead"'), 'a re-point needs the compare API to call the new tag ahead of the old');
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
  assert.ok(t.includes('"cd -- dist-claude-ai"'.slice(1, -1)) && t.includes('find "${name}" -type f | LC_ALL=C sort | zip -X -D -@ "${name}.zip"') && t.includes('sha256sum -- *.zip'), '-- guards on cd and sha256sum; the skill FOLDER is zipped from its parent (UMB-333; 09g: as a sorted list of the folder\'s files)');
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
  '    *git/matching-refs/tags/*) [[ "${FAKE_API_FAIL:-no}" == "yes" ]] && return 1; a="$*"; name="${a##*git/matching-refs/tags/}"; name="${name%% *}"; for t in ${FAKE_TAGS-v2.6.0 v1.0.0 v0.1.0-beta.1}; do [[ "$t" == "$name"* ]] && echo "refs/tags/$t"; done; return 0 ;;',
  '    *"releases?per_page=100"*) [[ "${FAKE_LIST_FAIL:-no}" == "yes" ]] && return 1; for t in ${FAKE_RELEASES-}; do echo "$t"; done; return 0 ;;', // the tag names of the repository\'s Releases, drafts included
  '    *compare/*) echo "${FAKE_COMPARE-ahead}"; return 0 ;;', // the compare API\'s status of NEW against OLD
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

test('gate behaviour: the launch form posts a pre-release tag only with the flag, never for a stable tag, and a first launch (no Release of another tag) posts without a re-point', { skip: !HAS_BASH && 'no bash on this machine' }, () => {
  let r = runGate({ INPUT_TAG: 'v0.1.0-beta.1' });
  assert.equal(r.code, 1); assert.match(r.err, /launch_form/);
  r = runGate({ INPUT_TAG: 'v0.1.0-beta.1', INPUT_LAUNCH: 'true', FAKE_RELEASES: '' });
  assert.equal(r.code, 0, r.err); assert.match(r.out, /post=true\ntag=v0\.1\.0-beta\.1\nlaunch=true\nrepoint=\n/);
  r = runGate({ INPUT_TAG: 'v1.0.0', INPUT_LAUNCH: 'true' });
  assert.equal(r.code, 1); assert.match(r.err, /stable/);
});

// BB-112 (a), CoalLedger issue 25: a later pre-release tag used to be tag-only, so a repository whose only Release is the
// launch-form pre-release could never carry newer ZIPs. The ONE launch-form Release is now RE-POINTED to the newer
// pre-release tag, and only while no stable Release exists.
test('gate behaviour: a re-run for the tag the launch-form Release already carries posts without a re-point', { skip: !HAS_BASH && 'no bash on this machine' }, () => {
  const r = runGate({ INPUT_TAG: 'v0.1.0-beta.2', INPUT_LAUNCH: 'true', FAKE_TAGS: 'v0.1.0-beta.1 v0.1.0-beta.2', FAKE_RELEASES: 'v0.1.0-beta.2' });
  assert.equal(r.code, 0, r.err); assert.match(r.out, /post=true\ntag=v0\.1\.0-beta\.2\nlaunch=true\nrepoint=\n/);
});

test('gate behaviour: the ONE launch-form Release of an older pre-release tag is re-pointed to a NEWER pre-release tag, and the old tag is handed to the re-point step', { skip: !HAS_BASH && 'no bash on this machine' }, () => {
  const r = runGate({ INPUT_TAG: 'v0.1.0-beta.2', INPUT_LAUNCH: 'true', FAKE_TAGS: 'v0.1.0-beta.1 v0.1.0-beta.2', FAKE_RELEASES: 'v0.1.0-beta.1', FAKE_COMPARE: 'ahead' });
  assert.equal(r.code, 0, r.err); assert.match(r.out, /post=true\ntag=v0\.1\.0-beta\.2\nlaunch=true\nrepoint=v0\.1\.0-beta\.1\n/);
  const again = runGate({ INPUT_TAG: 'v0.1.0-beta.3', INPUT_LAUNCH: 'true', FAKE_TAGS: 'v0.1.0-beta.1 v0.1.0-beta.2 v0.1.0-beta.3', FAKE_RELEASES: 'v0.1.0-beta.2 v0.1.0-beta.1' });
  assert.equal(again.code, 1, 'two pre-release Releases is not the launch form'); assert.match(again.err, /ONE pre-release Release/);
});

test('gate behaviour: a re-point is refused when the tag is not NEWER than the Release it would replace, when a stable Release exists, and when the lists cannot be read', { skip: !HAS_BASH && 'no bash on this machine' }, () => {
  const base = { INPUT_TAG: 'v0.1.0-beta.2', INPUT_LAUNCH: 'true', FAKE_TAGS: 'v0.1.0-beta.1 v0.1.0-beta.2' };
  for (const status of ['behind', 'identical', 'diverged', '']) {
    const r = runGate({ ...base, FAKE_RELEASES: 'v0.1.0-beta.1', FAKE_COMPARE: status });
    assert.equal(r.code, 1, JSON.stringify(status)); assert.match(r.err, /not newer/); assert.ok(!r.out.includes('post=true'));
  }
  let r = runGate({ ...base, FAKE_RELEASES: 'v0.1.0' });
  assert.equal(r.code, 1, r.err); assert.match(r.err, /stable Release/); assert.ok(!r.out.includes('post=true'));
  r = runGate({ ...base, FAKE_RELEASES: 'v0.1.0-beta.1 v0.1.0' });
  assert.equal(r.code, 1, r.err); assert.match(r.err, /stable Release/);
  r = runGate({ ...base, FAKE_LIST_FAIL: 'yes' });
  assert.equal(r.code, 1, r.err); assert.match(r.err, /could not list/); assert.ok(!r.out.includes('post=true'));
  r = runGate({ ...base, FAKE_RELEASES: 'launch-draft' }); // a hyphenated name that is no vX.Y.Z-label tag: refused before it is compared or handed on
  assert.equal(r.code, 1, r.err); assert.match(r.err, /not a vX\.Y\.Z-label pre-release tag/); assert.ok(!r.out.includes('post=true'));
  r = runGate({ ...base, FAKE_RELEASES: 'v0.1.0-beta.1; echo pwned' });
  assert.equal(r.code, 1, r.err); assert.ok(!r.out.includes('post=true'));
});

const REPOINT_NAME = 'Re-point the launch-form Release';
const REPOINT_GH = [
  'gh() {',
  '  echo "gh $*" >> "$CALLS"',
  '  case "$*" in',
  '    "release view "*"--json assets"*) [[ "${FAKE_VIEW_FAIL:-no}" == "yes" ]] && return 1; for a in ${FAKE_ASSETS-}; do echo "$a"; done; return 0 ;;',
  '    "release delete-asset "*) [[ "${FAKE_DELETE_FAIL:-no}" == "yes" ]] && return 1; return 0 ;;',
  '    "release edit "*"--draft=true"*) [[ "${FAKE_DRAFT_FAIL:-no}" == "yes" ]] && return 1; return 0 ;;',
  '    "release edit "*"--tag "*) [[ "${FAKE_RETAG_FAIL:-no}" == "yes" ]] && return 1; return 0 ;;',
  '    *) echo "unexpected gh call: $*" >&2; return 99 ;;',
  '  esac',
  '}',
].join('\n');
function runRepoint(wfName, env) {
  const body = runBody(stepBySubstr(wfLines(wfName), REPOINT_NAME));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repoint-run-'));
  const calls = path.join(dir, 'calls.txt');
  fs.writeFileSync(calls, '');
  const r = spawnSync('bash', ['-c', `${REPOINT_GH}\n${body}`], { encoding: 'utf8', timeout: 30000, cwd: dir, env: { ...process.env, CALLS: calls, OLD_TAG: 'v0.1.0-beta.1', RELEASE_TAG: 'v0.1.0-beta.2', ...env } });
  const log = fs.readFileSync(calls, 'utf8').split('\n').filter(Boolean);
  fs.rmSync(dir, { recursive: true, force: true });
  return { code: r.status, log, err: r.stderr + r.stdout };
}

test('re-point step (both canon workflows): the old Release goes back to a draft, its assets are emptied, THEN it takes the new tag -- and nothing past a failure runs', { skip: !HAS_BASH && 'no bash on this machine' }, () => {
  for (const name of BOTH) {
    let r = runRepoint(name, { FAKE_ASSETS: 'a.zip b.zip SHA256SUMS.txt' });
    assert.equal(r.code, 0, `${name}: ${r.err}`);
    const verbs = r.log.map((l) => l.replace(/^gh release /, '').split(' ').slice(0, 1).join('')).join(',');
    assert.equal(verbs, 'edit,view,delete-asset,delete-asset,delete-asset,edit', `${name}: the order of the calls`);
    assert.match(r.log[0], /^gh release edit v0\.1\.0-beta\.1 --draft=true$/);
    assert.deepEqual(r.log.filter((l) => l.includes('delete-asset')).map((l) => l.split(' ').pop()), ['a.zip', 'b.zip', 'SHA256SUMS.txt']);
    assert.match(r.log.at(-1), /^gh release edit v0\.1\.0-beta\.1 --tag v0\.1\.0-beta\.2 --verify-tag$/);
    r = runRepoint(name, {});
    assert.equal(r.code, 0, `${name} (a Release with no assets): ${r.err}`); assert.match(r.log.at(-1), /--tag v0\.1\.0-beta\.2 --verify-tag$/);
    for (const [flag, calls] of [['FAKE_DRAFT_FAIL', 1], ['FAKE_VIEW_FAIL', 2], ['FAKE_DELETE_FAIL', 3], ['FAKE_RETAG_FAIL', 4]]) {
      r = runRepoint(name, { FAKE_ASSETS: 'a.zip', [flag]: 'yes' });
      assert.equal(r.code, 1, `${name} ${flag}`); assert.match(r.err, /::error::/); assert.equal(r.log.length, calls, `${name} ${flag}: stops at the failing call`);
      assert.ok(!r.log.some((l) => /--draft=false/.test(l)), 'a re-point never publishes');
    }
  }
});

function runEnsure(wfName, env) {
  const body = runBody(stepBySubstr(wfLines(wfName), 'Ensure the GitHub Release exists'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ensure-run-'));
  const calls = path.join(dir, 'calls.txt');
  fs.writeFileSync(calls, '');
  for (const [f, text] of [['release-title.txt', 'v0.1.0-beta.2 - summary'], ['release-body.md', 'body'], ['release-prerelease.txt', 'true'], ['release-latest.txt', 'false']]) fs.writeFileSync(path.join(dir, f), text);
  const gh = ['gh() {', '  echo "gh $*" >> "$CALLS"', '  [[ "$1 $2" == "release create" && "${FAKE_CREATE_FAIL:-no}" == "yes" ]] && return 1', '  return 0', '}'].join('\n');
  const r = spawnSync('bash', ['-c', `${gh}\n${body}`], { encoding: 'utf8', timeout: 30000, cwd: dir, env: { ...process.env, CALLS: calls, RELEASE_TAG: 'v0.1.0-beta.2', REPOINTED: '', ...env } });
  const log = fs.readFileSync(calls, 'utf8').split('\n').filter(Boolean);
  fs.rmSync(dir, { recursive: true, force: true });
  return { code: r.status, log, err: r.stderr + r.stdout };
}

test('ensure step: a first run creates the draft (and falls back to an edit); a RE-POINTED Release is only edited, never created a second time, and never given --latest', { skip: !HAS_BASH && 'no bash on this machine' }, () => {
  for (const name of BOTH) {
    let r = runEnsure(name, {});
    assert.equal(r.code, 0, r.err); assert.equal(r.log.length, 1, name); assert.match(r.log[0], /^gh release create v0\.1\.0-beta\.2 --verify-tag --draft /);
    r = runEnsure(name, { FAKE_CREATE_FAIL: 'yes' });
    assert.equal(r.code, 0, r.err); assert.equal(r.log.length, 2, name); assert.match(r.log[1], /^gh release edit v0\.1\.0-beta\.2 .*--latest=false --prerelease=true$/);
    r = runEnsure(name, { REPOINTED: 'v0.1.0-beta.1' });
    assert.equal(r.code, 0, r.err); assert.equal(r.log.length, 1, `${name}: exactly one call`); assert.match(r.log[0], /^gh release edit v0\.1\.0-beta\.2 /);
    assert.ok(!r.log[0].includes('--latest') && !r.log[0].includes('--draft') && r.log[0].includes('--prerelease=true'), `${name}: a draft carries neither Latest nor a second draft flag`);
  }
});

test('RELEASE-PATTERN.md and the overlay README state that a newer pre-release tag re-points the ONE launch-form Release, and that the first stable closes it -- RED before BB-112 (a)', () => {
  const rp = fs.readFileSync(path.join(ROOT, 'RELEASE-PATTERN.md'), 'utf8');
  assert.match(rp, /A NEWER pre-release tag RE-POINTS that one Release while no stable Release exists/);
  assert.match(rp, /the compare API calls the new tag ahead/);
  assert.match(rp, /a path that Immutable Releases closes once the owner switches it on \(AR-71 \(a1\), unsigned today\), so the launch form is re-decided before that switch, never after it/);
  assert.match(fs.readFileSync(path.join(TEMPLATES, 'overlay-coal-skill', 'OVERLAY-README.md'), 'utf8'), /Immutable Releases closes, so the launch form is re-decided before AR-71 \(a1\) is switched on/);
  assert.match(rp, /after which no re-point is possible/);
  assert.doesNotMatch(rp, /while any other tag already has a Release/, 'the old refusal sentence is gone');
  assert.match(fs.readFileSync(path.join(TEMPLATES, 'overlay-coal-skill', 'OVERLAY-README.md'), 'utf8'), /newer pre-release tag re-points/);
});

test('re-point step: same lines in both canon workflows, gated on the gate\'s repoint output, runs AFTER everything that builds or checks and BEFORE the Release is created, and the old tag reaches it through env only', () => {
  const a = stepBySubstr(wfLines('create-release.yml'), REPOINT_NAME);
  const b = stepBySubstr(wfLines('claude-ai-zips.yml'), REPOINT_NAME);
  assert.ok(a && b, 'the re-point step exists in both');
  assert.equal(a.join('\n'), b.join('\n'));
  const s = a.join('\n');
  assert.ok(s.includes("if: steps.gate.outputs.post == 'true' && steps.gate.outputs.repoint != ''"), 'only when the gate found a Release to re-point');
  assert.ok(s.includes('OLD_TAG: ${{ steps.gate.outputs.repoint }}'), 'the old tag arrives through env');
  assert.ok(!runBody(a).includes('${{'), 'no expression inside the run block');
  for (const name of BOTH) {
    const names = wfLines(name).filter((l) => /^ {6}- (name|uses): /.test(l));
    const at = names.findIndex((l) => l.includes(REPOINT_NAME));
    const ensure = names.findIndex((l) => l.includes('Ensure the GitHub Release exists'));
    assert.ok(at > 0 && ensure === at + 1, `${name}: the re-point step sits directly before the Release is ensured`);
  }
  const zips = wfLines('claude-ai-zips.yml').filter((l) => /^ {6}- name: /.test(l));
  assert.ok(zips.findIndex((l) => l.includes('Generate SHA256SUMS.txt')) < zips.findIndex((l) => l.includes(REPOINT_NAME)), 'the ZIPs are built and checked before the old Release is touched');
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
  assert.ok(body.includes('find "${name}" -type f | LC_ALL=C sort | zip -X -D -@ "${name}.zip"'), 'the folder name is the argument of the file list, so every entry keeps the <name>/ prefix');
  assert.ok(!/cd -- "\$name" &&/.test(body), 'no subshell that enters the skill folder before zipping');
  assert.ok(!body.includes('"../${name}.zip" .'), 'never zip "." inside the folder');
});

test('the Zip step builds <name>/SKILL.md at the top level of a real archive', { skip: !(HAS_ZIP && HAS_UNZIP) && 'no zip and unzip on this machine (CI has both)' }, () => {
  const r = inTemp('zip-build-', (dist) => {
    fs.mkdirSync(path.join(dist, 'demo-skill', 'references'), { recursive: true });
    fs.writeFileSync(path.join(dist, 'demo-skill', 'SKILL.md'), '---\nname: demo-skill\n---\n');
    fs.writeFileSync(path.join(dist, 'demo-skill', 'references', 'a.md'), 'a');
    fs.writeFileSync(path.join(dist, 'demo-skill', '.hidden'), 'x');
  }, `${stepRun('Zip each staged skill')}\nunzip -Z1 demo-skill.zip`);
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

// UMB-334 (2): testing.md, every test run has a finite clock. A spawn with no timeout can hold a runner for the job's
// whole 360 minutes and report nothing. This reads every spawn call in a template's test files (a skeleton or overlay a
// room copies), through to the closing parenthesis of its arguments, and fails on one that names no timeout.
test('every spawn in a test file passes a timeout, and a node child in this repository itself also runs under a heap cap (testing.md: every test run has a finite clock; RED before UMB-334 and UMB-365 J)', () => {
  const missingTimeout = []; const missingHeap = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === '.claude') continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!e.name.endsWith('.test.mjs')) continue;
      const t = fs.readFileSync(p, 'utf8');
      const rel = path.relative(ROOT, p).replace(/\\/g, '/');
      for (const m of t.matchAll(/\b(spawnSync|execFileSync|execSync|spawn)\(/g)) {
        let depth = 1; let i = m.index + m[0].length;
        for (; i < t.length && depth > 0; i++) { if (t[i] === '(') depth++; else if (t[i] === ')') depth--; }
        const call = t.slice(m.index, i); const at = rel + ':' + t.slice(0, m.index).split('\n').length;
        if (!/timeout/.test(call)) missingTimeout.push(at);
        // templates are copied into rooms and blob-pinned by them, and scripts/secret-gate.test.mjs and scripts/secret-scan.test.mjs are byte-equal to the templates copies (the latter to Bankfire's source): a heap cap there is a named decision, not part of this walk
        if (!rel.startsWith('templates/') && rel !== 'scripts/secret-gate.test.mjs' && rel !== 'scripts/secret-scan.test.mjs' &&/process\.execPath/.test(call) && !/max-old-space-size/.test(call)) missingHeap.push(at);
      }
    }
  };
  for (const top of ['templates', 'scripts', 'benchmarks']) walk(path.join(ROOT, top));
  assert.deepEqual(missingTimeout, [], 'spawn calls with no timeout: ' + missingTimeout.join(', '));
  assert.deepEqual(missingHeap, [], 'node children with no heap cap: ' + missingHeap.join(', '));
});

// AX-3 (owner-signed 2026-10-03): the article template's CI fails a push to the default branch that carries a commit made by
// GitBook (a subject starting GITBOOK-), so the rule GOVERNANCE.md states in prose is a check. Behaviour, not text: the guard
// step's own bash runs against a throwaway repository for every case.
const ART_CHECK = path.join(TEMPLATES, 'article', '.github', 'workflows', 'check.yml');
const artLines = () => fs.readFileSync(ART_CHECK, 'utf8').replace(/\r\n/g, '\n').split('\n');
const GUARD_NAME = 'Refuse a commit made by GitBook on the default branch';

test('article check.yml carries the GitBook-commit guard: a default-branch push job, env-only inputs, full history, no token left behind, a clock, and no cancelling of a default-branch run (RED before AX-3)', () => {
  const t = artLines().join('\n');
  assert.match(t, /^ {2}gitbook-commit-guard:$/m, 'the job exists');
  assert.match(t, /if: github\.event_name == 'push' && github\.ref == format\('refs\/heads\/\{0\}', github\.event\.repository\.default_branch\)/, 'only a push to the default branch');
  const step = stepBySubstr(artLines(), GUARD_NAME);
  assert.ok(step, 'the guard step exists');
  const body = runBody(step);
  assert.ok(!/\$\{\{/.test(body), 'no expression inside the run: block (env only)');
  const job = t.slice(t.indexOf('  gitbook-commit-guard:'));
  assert.match(job, /timeout-minutes: \d+/, 'a finite clock');
  assert.match(job, /persist-credentials: false/, 'no token left in .git/config');
  assert.match(job, /fetch-depth: 0/, 'the whole pushed range is present');
  assert.match(t, /cancel-in-progress: \$\{\{ github\.ref != format\('refs\/heads\/\{0\}', github\.event\.repository\.default_branch\) \}\}/, 'a superseded run on the default branch must not be cancelled, or its commits escape the guard');
});

const gitIn = (dir, ...a) => spawnSync('git', ['-C', dir, ...a], { encoding: 'utf8', timeout: 30000, env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.invalid', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.invalid' } });
function guardRun(subjects, mode) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitbook-guard-'));
  try {
    gitIn(dir, 'init', '-q', '-b', 'main'); gitIn(dir, 'config', 'commit.gpgsign', 'false');
    const shas = subjects.map((s, i) => { fs.writeFileSync(path.join(dir, 'f.txt'), String(i)); gitIn(dir, 'add', '-A'); gitIn(dir, 'commit', '-q', '-m', s); return gitIn(dir, 'rev-parse', 'HEAD').stdout.trim(); });
    const before = mode === 'first' ? '0'.repeat(40) : shas[0];
    const body = runBody(stepBySubstr(artLines(), GUARD_NAME));
    return spawnSync('bash', ['-c', body], { cwd: dir, encoding: 'utf8', timeout: 30000, env: { ...process.env, BEFORE: before, AFTER: shas[shas.length - 1] } });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('the GitBook-commit guard: a pushed range holding a GITBOOK- subject fails (hash only in the message); a clean range passes; a first push reads the tip only', { skip: !HAS_BASH && 'no bash on this machine' }, () => {
  let r = guardRun(['base', 'GITBOOK-12: edit a page', 'fix: a normal commit']);
  assert.equal(r.status, 1, r.stdout + r.stderr); assert.match(r.stdout + r.stderr, /commit made by GitBook is on the default branch/); assert.ok(!/edit a page/.test(r.stdout + r.stderr), 'the subject is never echoed');
  r = guardRun(['base', 'docs: one', 'fix: two']);
  assert.equal(r.status, 0, r.stdout + r.stderr); assert.match(r.stdout, /no commit in this push was made by GitBook/);
  r = guardRun(['base', 'a subject that merely mentions GITBOOK-1 in the middle']);
  assert.equal(r.status, 0, 'only a subject that STARTS with GITBOOK- counts');
  r = guardRun(['GITBOOK-1: old history', 'fix: tip'], 'first');
  assert.equal(r.status, 0, 'a first push reads the tip only, never the whole history');
  r = guardRun(['fix: old', 'GITBOOK-2: tip'], 'first');
  assert.equal(r.status, 1, 'a first push whose tip is a GitBook commit fails');
});

// UMB-364: the maintainer's publishing runbook (PUBLISHING.md) is kept out of a published article repository. An untracked file
// that is not ignored is one `git add -A` from public, and a clone-local exclude is lost with the clone, so the template's own
// .gitignore names it.
test("the article template's .gitignore names PUBLISHING.md (the maintainer's runbook, never published) -- RED before UMB-364", () => {
  const g = fs.readFileSync(path.join(TEMPLATES, 'article', '.gitignore'), 'utf8').split(/\r?\n/);
  assert.ok(g.includes('PUBLISHING.md'), 'PUBLISHING.md must be an ignore line of its own');
  assert.ok(!g.some((l) => /Push-ToGitBook/.test(l)), 'a retired one-repository script is not a canon line');
});

// UMB-365 (5): an overlay is adopted as the WHOLE set, never a pair (two blobs alone broke a room's tag-push run at its derive
// step). The set is closed: every script a workflow of the overlay runs, and every file those scripts import, is a file of the
// overlay itself or a room-owned file OVERLAY-README.md names (desc-cap, claude-ai-trim, the room's own verify.mjs), so a room that
// copies the files the overlay lists, and writes the ones the README names, has everything the workflow needs. The adoption line
// says so.
test('the overlay is a closed set: every script its workflows run, and every file those import, is in the overlay or a room-owned file OVERLAY-README names; SKILL-REPO-PATTERN says it is adopted whole by blob id (RED before UMB-365)', () => {
  const OV = path.join(TEMPLATES, 'overlay-coal-skill');
  const readme = fs.readFileSync(path.join(OV, 'OVERLAY-README.md'), 'utf8');
  const roomOwned = (rel) => ['scripts/verify.mjs', 'scripts/lib/desc-cap.mjs', 'scripts/lib/claude-ai-trim.mjs'].includes(rel) && readme.includes(path.posix.basename(rel));
  const have = (rel) => fs.existsSync(path.join(OV, rel)) || roomOwned(rel);
  const seen = new Set(); const missing = [];
  const visit = (rel) => {
    if (seen.has(rel)) return; seen.add(rel);
    if (!have(rel)) { missing.push(rel); return; }
    if (!fs.existsSync(path.join(OV, rel))) return; // a room-owned file: named by the README, written by the room
    const t = fs.readFileSync(path.join(OV, rel), 'utf8');
    for (const m of t.matchAll(/from\s+['"](\.{1,2}\/[^'"]+\.mjs)['"]|import\(\s*['"](\.{1,2}\/[^'"]+\.mjs)['"]/g)) visit(path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[1] || m[2])));
  };
  for (const wf of ['claude-ai-zips.yml', 'create-release.yml']) {
    const y = fs.readFileSync(path.join(OV, '.github', 'workflows', wf), 'utf8').split(/\r?\n/).filter((l) => !/^\s*#/.test(l)).join('\n');
    for (const m of y.matchAll(/scripts\/([A-Za-z0-9._\/-]+\.mjs)/g)) visit('scripts/' + m[1]);
  }
  assert.deepEqual(missing, [], 'the workflows need files the overlay does not carry: ' + missing.join(', '));
  assert.ok(seen.size >= 6, 'the walk found the closure (not vacuous): ' + [...seen].join(', '));
  const t = fs.readFileSync(path.join(ROOT, 'SKILL-REPO-PATTERN.md'), 'utf8');
  assert.match(t, /adopted as the WHOLE set, by blob id, never a pair/, 'the adoption line');
});

// UMB-365 (4) / CoalHearth: RELEASE-PATTERN.md said "Condensing is allowed" for Part 2 while the derivation posts the entry's
// sections UNCHANGED, and it listed Parts 3-5 after Part 2 without saying where the CHANGELOG entry carries them. The derivation
// drops everything between the summary line and the first "### " heading, so a Part 3-5 block placed there never reaches the body.
test('RELEASE-PATTERN.md: condensing happens in the CHANGELOG entry, never at release time; Parts 3-5 go AFTER the last "### " section (a block before the first one is dropped) (RED before UMB-365)', async () => {
  const t = fs.readFileSync(path.join(ROOT, 'RELEASE-PATTERN.md'), 'utf8');
  assert.doesNotMatch(t, /Condensing is allowed;/, 'the unqualified permission contradicts the unchanged derivation');
  assert.match(t, /condensed when the CHANGELOG entry is written, never when the Release is posted/, 'where condensing happens');
  assert.match(t, /after the last `### ` section of the entry/, 'where Parts 3-5 go');
  const lib = await import(pathToFileURL(path.join(TEMPLATES, 'overlay-coal-skill', 'scripts', 'lib', 'release-shape.mjs')).href);
  const entry = (block) => `## [1.2.3] - 2026-10-03\n\nA lead sentence.\n\n${block.before}### Fixed\n- a fix\n\n${block.after}\n## [1.2.2] - 2026-09-01\n\nOld.\n\n### Fixed\n- old\n`;
  const before = lib.extractChangelogEntry(entry({ before: '**What you need to do:** run the update.\n\n', after: '' }), '1.2.3');
  assert.ok(!before.sectionsBody.includes('run the update'), 'a Part 3 block before the first ### heading is dropped by the derivation');
  const after = lib.extractChangelogEntry(entry({ before: '', after: '**What you need to do:** run the update.\n' }), '1.2.3');
  assert.ok(after.sectionsBody.includes('run the update'), 'a Part 3 block after the last section rides into the body');
});

// CWK-186 (UMB-365 H): "the tool ships no tagged releases" is false (NVIDIA/skillspector tags and releases; a scan pins a COMMIT and
// names its relation to the tags). UMB-365 I (CoalFace M1): the SkillSpector comment called the re-scan "automatic" while the
// E2 machinery is wired in no room, so the template says what is true today.
test('published-code SECURITY.md: the SkillSpector pin names a commit and its relation to the tags, and the re-scan is not called automatic (RED before UMB-365 H/I)', () => {
  const t = fs.readFileSync(path.join(TEMPLATES, 'published-code', 'SECURITY.md'), 'utf8');
  assert.ok(!t.includes('ships no tagged releases'), 'upstream does tag and release');
  assert.ok(t.includes('{{SCANNER_COMMIT}}') && t.includes('{{SCANNER_TAG_RELATION}}'), 'the pin names a commit and its relation to the tags');
  assert.doesNotMatch(t, /re-scan is automatic|automatic on one event/i, 'no room has the automatic re-scan wired');
  assert.match(t, /wired in no room yet|not yet wired/i, 'the comment says what is true today');
});

// UMB-367 ruling 4: a doc claims only shipped behaviour. The SkillSpector re-scan on a room's version bump (E2) is wired in no room
// yet, so SWEEP-MARKS.md Event 3 says planned, not automatic, until the machinery lands.
test('SWEEP-MARKS.md Event 3 says the E2 re-scan is planned and wired in no room yet, never "automatic since" (RED before UMB-367)', () => {
  const t = fs.readFileSync(path.join(ROOT, 'SWEEP-MARKS.md'), 'utf8');
  const ev3 = t.slice(t.indexOf('## Event 3'), t.indexOf('## Event 4'));
  assert.ok(ev3.length > 200, 'the Event 3 section was found');
  assert.doesNotMatch(ev3, /automatic since/i);
  assert.match(ev3, /wired in no room yet/);
});

// UMB-334 / CoalGob H2: a hook or gate comment never claims the scan catches a form it misses. The scanner has no rule for a
// credential inside a URL (scheme://user:pass@host) and none for an HTTP authentication header as such, so no template hook or
// gate may name a connection string or an authentication header as something it catches; each says what the scan catches and
// that those forms are not covered.
test('no template hook or secret gate claims the scan catches a connection string or an HTTP authentication header (RED before the H2 batch)', () => {
  const files = [
    'templates/published-code/.githooks/pre-commit', 'templates/published-code/.githooks/pre-push',
    'templates/article/.githooks/pre-commit', 'templates/article/.githooks/pre-push',
    'templates/published-code/scripts/secret-gate.mjs', 'templates/article/scripts/secret-gate.mjs', 'scripts/secret-gate.mjs',
  ];
  for (const f of files) {
    const t = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r?\n# ?|\r?\n\/\/ ?/g, ' ');
    assert.ok(/does NOT catch a credential inside a URL/.test(t), f + ': it must say what the scan does not catch');
    assert.ok(!/but not the generic kinds|a connection string or an HTTP\s+authentication header is a "generic" pattern/.test(t), f + ': the old coverage claim is still there');
    // CoalWash F-08b-2 and CoalMine LOW-1 (08b/08c, measured against the scanner): a provider-shaped token is found ANYWHERE on a line, a URL or an HTTP header included, so the
    // limit is stated for a credential that is NOT provider-shaped, and an authentication header whose value is a scheme and a token (a Bearer value) is missed even under a secret-named header.
    assert.match(t, /a provider-shaped token anywhere on a line/, f + ': the catch side names the provider-shaped token anywhere on a line');
    assert.match(t, /\(scheme:\/\/user:pass@host\) unless the credential is provider-shaped/, f + ': the URL limit carries the provider-shaped exception');
    assert.match(t, /whose value is a scheme and a token \(Authorization: Bearer <key>, X-Api-Token: Bearer <key>\) unless that token is provider-shaped/, f + ': the header limit names the Bearer shape and the exception');
  }
  const canon = fs.readFileSync(path.join(ROOT, 'SERIES-CANON.md'), 'utf8').replace(/\r?\n/g, ' ');
  assert.match(canon, /a provider-shaped token anywhere on a line/, 'SERIES-CANON.md: the Secret scan row states the same limit');
  assert.match(canon, /unless that token is provider-shaped/, 'SERIES-CANON.md: the header limit carries the exception');
});

test('the layout check runs after the zip step and before the Release is created or any asset is attached', () => {
  const lines = wfLines('claude-ai-zips.yml');
  const at = (sub) => lines.findIndex((l) => /^ {6}- name: /.test(l) && l.includes(sub));
  const zip = at('Zip each staged skill'); const check = at('Check each ZIP holds its skill folder'); const sums = at('Generate SHA256SUMS'); const create = at('Ensure the GitHub Release exists'); const attach = at('Attach ZIPs');
  assert.ok(zip > 0 && check > zip && sums > check && create > check && attach > create, `order: zip ${zip}, check ${check}, sums ${sums}, create ${create}, attach ${attach}`);
});

// UMB-324: when the API read itself fails (a 5xx, a rate limit) the gate says so; it must not claim the tag does not exist.
test('gate behaviour: a failed tag-list read is reported as a failed read, not as "not a tag of this repository"; both still refuse', { skip: !HAS_BASH && 'no bash on this machine' }, () => {
  let r = runGate({ INPUT_TAG: 'v2.6.0', FAKE_API_FAIL: 'yes' });
  assert.equal(r.code, 1, r.err); assert.match(r.err, /could not read this repository's tags/); assert.ok(!/not a tag of this repository/.test(r.err)); assert.ok(!r.out.includes('post=true'));
  r = runGate({ INPUT_TAG: 'v9.9.9' });
  assert.equal(r.code, 1); assert.match(r.err, /not a tag of this repository/); assert.ok(!/could not read/.test(r.err));
});

// UMB-379 (12): the monthly source sweep writes REVALIDATION.md and the upload step keeps it. A sweep step that fails (a source
// moved, the very thing the sweep exists to report) skipped the upload under the default success() condition, so the report of the
// failure was lost with it. The upload takes !cancelled(): it runs after a failed sweep, not after a cancelled run, and still
// waits for the room's own sweeper to exist.
test("the article template's watch-sources upload step runs after a failed sweep (!cancelled()) and still waits for the sweeper -- RED before UMB-379", () => {
  const wf = fs.readFileSync(path.join(TEMPLATES, 'article', '.github', 'workflows', 'watch-sources.yml'), 'utf8').split(/\r?\n/);
  const at = wf.findIndex((l) => /uses:\s*actions\/upload-artifact@/.test(l));
  assert.ok(at > 0, 'the upload step exists');
  const cond = wf.slice(at, at + 3).find((l) => /^\s+if:/.test(l));
  assert.ok(cond, 'the upload step has an if: line');
  assert.match(cond, /!cancelled\(\)/);
  assert.match(cond, /hashFiles\('tools\/watch-sources\.mjs'\) != ''/);
});

// UMB-347: the canon makes a concurrency: group a MUST for every workflow (SKILL-REPO-PATTERN.md, the concurrency bullet; the test is
// ATOMICITY). Four of this repo's own workflows carried none. The sizing, by what a killed run leaves behind: a read-only run
// (markdownlint, verify-landing) cancels; enabling auto-merge is idempotent inside one PR's own group, so it cancels per PR number;
// update-readme pushes a commit to main and is a schedule-driven publish whose overlap costs nothing to queue, so it never cancels.
test("this repo's own workflows each carry a top-level concurrency group, sized by atomicity (RED before UMB-347)", () => {
  const want = {
    'dependabot-auto-merge.yml': { group: /^dependabot-auto-merge-\$\{\{ github\.event\.pull_request\.number \}\}$/, cancel: 'true' },
    'markdownlint.yml': { group: /^markdownlint-\$\{\{ github\.ref \}\}$/, cancel: 'true' },
    'zizmor.yml': { group: /^zizmor-\$\{\{ github\.ref \}\}$/, cancel: 'true' },
    'verify-landing.yml': { group: /^verify-landing-\$\{\{ github\.ref \}\}$/, cancel: 'true' },
    'update-readme.yml': { group: /^update-readme$/, cancel: 'false' },
  };
  for (const [name, w] of Object.entries(want)) {
    const ls = lines(path.join(OWN_WF, name));
    const at = ls.indexOf('concurrency:');
    assert.ok(at >= 0, `${name}: a top-level concurrency: block`);
    const group = ls[at + 1].match(/^ {2}group: (.+)$/);
    const cancel = ls[at + 2].match(/^ {2}cancel-in-progress: (.+)$/);
    assert.ok(group && w.group.test(group[1]), `${name}: group ${group && group[1]}`);
    assert.equal(cancel && cancel[1], w.cancel, `${name}: cancel-in-progress`);
    assert.ok(at < ls.indexOf('jobs:'), `${name}: the block sits before jobs:`);
  }
  // every workflow this repo runs has a block (a fifth added later cannot skip the canon)
  const bare = fs.readdirSync(OWN_WF).filter((f) => /\.ya?ml$/.test(f)).filter((f) => !lines(path.join(OWN_WF, f)).includes('concurrency:'));
  assert.deepEqual(bare, []);
});

// UMB-348 (b): CoalFace adopted claude-ai-zips.yml without the release-notes.mjs it runs (its own copy was an older blob), the derive step
// wrote no release files, and the run died at the Release step with a gh usage dump. A check right after the derive step stops the run
// with a message that names the stale script, before any gh release call. Both canon workflows carry it, line for line.
const DERIVE_NAME = 'Derive the canon Release title + body from CHANGELOG.md';
const DERIVE_CHECK = 'Check the derive step wrote its four release files';
const FOUR = ['release-title.txt', 'release-body.md', 'release-prerelease.txt', 'release-latest.txt'];
test('both canon workflows check the four derived release files in the step right after the derive step, before any gh release call -- RED before UMB-348', () => {
  for (const name of BOTH) {
    const ls = wfLines(name);
    const derive = ls.findIndex((l) => /^ {6}- name: /.test(l) && l.includes(DERIVE_NAME));
    const chk = ls.findIndex((l) => /^ {6}- name: /.test(l) && l.includes(DERIVE_CHECK));
    assert.ok(derive >= 0 && chk > derive, `${name}: the check step follows the derive step`);
    assert.equal(ls.slice(derive + 1, chk).filter((l) => /^ {6}- name: /.test(l)).length, 0, `${name}: no other step between them`);
    const firstGh = ls.findIndex((l) => !l.trim().startsWith('#') && /\bgh release\b/.test(l));
    assert.ok(chk < firstGh, `${name}: the check comes before the first gh release call`);
    assert.equal(stepBlock(ls, stepBySubstr(ls, DERIVE_CHECK)[0].replace(/^ {6}- name: /, '')), stepBlock(wfLines('create-release.yml'), stepBySubstr(wfLines('create-release.yml'), DERIVE_CHECK)[0].replace(/^ {6}- name: /, '')), `${name}: same lines in both workflows`);
  }
});

test('derive check behaviour: all four files present passes; any one missing or empty stops with a message naming the file and release-notes.mjs', { skip: !HAS_BASH && 'no bash on this machine' }, () => {
  const body = runBody(stepBySubstr(wfLines('claude-ai-zips.yml'), DERIVE_CHECK));
  const probe = (omit, emptyOne) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'derive-check-'));
    for (const f of FOUR) if (f !== omit) fs.writeFileSync(path.join(dir, f), f === emptyOne ? '' : 'x\n');
    const r = spawnSync('bash', ['-c', body], { encoding: 'utf8', timeout: 30000, cwd: dir });
    fs.rmSync(dir, { recursive: true, force: true });
    return { code: r.status, err: r.stderr + r.stdout };
  };
  assert.equal(probe(null, null).code, 0);
  for (const f of FOUR) {
    for (const r of [probe(f, null), probe(null, f)]) {
      assert.equal(r.code, 1, f);
      assert.ok(r.err.includes(f), `${f}: the message names the file`);
      assert.match(r.err, /release-notes\.mjs/, `${f}: the message names the stale script`);
    }
  }
});

// UMB-392 E-1 and UMB-395 3(a): the GITBOOK- subject prefix is a format measured once (2026-10-03, n = 1), so the guard says so beside
// itself and a format change reads as a fact to re-measure; and a public template file carries no internal ticket id (AX-3 was a sheet
// id, no reader's key), so the comment states in plain words what the guard protects.
test("the article template's check.yml dates the GITBOOK- prefix as measured (2026-10-03, n = 1) and names no internal ticket id -- RED before UMB-392/395", () => {
  const text = fs.readFileSync(path.join(TEMPLATES, 'article', '.github', 'workflows', 'check.yml'), 'utf8');
  const comments = text.split(/\r?\n/).filter((l) => l.trim().startsWith('#')).join('\n');
  assert.match(comments, /GITBOOK- subject prefix is the format measured on 2026-10-03 \(n = 1[:)]/);
  assert.match(comments, /re-measure/);
  assert.doesNotMatch(text, /\b(AX|AW|AR|UMB|CWK|LWK|BA|BB)-\d+\b/, 'an internal ticket or sheet id is no reader\'s key on a public file');
});

// UMB-393: the deploy-check overlay is a post-deploy prober (it reads the served page and compares), publishes nothing, and a newer push
// supersedes the page it was probing, so a superseded run is cancelled (SKILL-REPO-PATTERN.md's concurrency bullet, the ci.yml class).
test("the overlay-llm-deploy deploy-check.yml carries a concurrency group, cancel-in-progress true (a prober reads and compares) -- RED before UMB-393", () => {
  const ls = fs.readFileSync(path.join(TEMPLATES, 'overlay-llm-deploy', '.github', 'workflows', 'deploy-check.yml'), 'utf8').split(/\r?\n/);
  const at = ls.indexOf('concurrency:');
  assert.ok(at >= 0 && at < ls.indexOf('jobs:'), 'a top-level concurrency: block before jobs:');
  assert.match(ls[at + 1], /^ {2}group: deploy-check-\$\{\{ github\.ref \}\}$/);
  assert.equal(ls[at + 2], '  cancel-in-progress: true');
});

// UMB-392 / BA-14: the canon says where the title bound lives (the CHANGELOG summary line), what the band is, and where a longer
// explanation goes; the numbers in the text are the ones the script uses.
test('RELEASE-PATTERN.md states the summary band from release-shape.mjs (aim 60, 45 to 75), the named warning and the lead paragraph -- RED before UMB-392', async () => {
  const { SUMMARY_AIM, SUMMARY_BAND } = await import(pathToFileURL(path.join(TEMPLATES, 'overlay-coal-skill', 'scripts', 'lib', 'release-shape.mjs')).href);
  const t = fs.readFileSync(path.join(ROOT, 'RELEASE-PATTERN.md'), 'utf8').replace(/\r\n/g, '\n');
  assert.ok(t.includes(`aim for ${SUMMARY_AIM} characters, ${SUMMARY_BAND[0]} to ${SUMMARY_BAND[1]} passes clean`), 'the CHANGELOG-summary bullet states the band');
  assert.ok(t.includes(`The summary aims at ${SUMMARY_AIM} characters; ${SUMMARY_BAND[0]} to ${SUMMARY_BAND[1]} passes clean.`), 'the title table states the band');
  assert.match(t, /release-title-band/);
  assert.match(t, /lead paragraph directly under the summary line/);
  assert.doesNotMatch(t, /drops what sits between the summary line/, 'the old statement that the lead text is dropped is gone');
  assert.match(fs.readFileSync(path.join(ROOT, 'RELEASE-NOTES-TEMPLATE.md'), 'utf8'), /OPTIONAL lead paragraph/);
});

// UMB-433 / pass 15 A-2, A-3: the canon names the opener ceiling and the announcement title ceiling, and the builder's comment is not stale.
test('RELEASE-PATTERN.md names the opener ceiling (a one-capital proper noun lowers) and the 200-character announcement ceiling with the pre-tag --check; the builder carries no stale paragraph -- RED before pass 15', () => {
  const t = fs.readFileSync(path.join(ROOT, 'RELEASE-PATTERN.md'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(t, /a summary that opens with a proper noun of ONE leading capital \("Windows", "Linux", "Cloudflare"\) is lowered/, 'A-2: the ceiling');
  assert.match(t, /verb first/);
  assert.match(t, /release-title-cap/);
  assert.match(t, /node scripts\/release-notes\.mjs --check/);
  assert.match(t, /200-character/);
  const src = fs.readFileSync(path.join(TEMPLATES, 'overlay-coal-skill', 'scripts', 'lib', 'release-shape.mjs'), 'utf8');
  assert.doesNotMatch(src, /an ordinary word has at most one leading capital/, 'A-3: the df60cba paragraph is gone');
  assert.doesNotMatch(src, /whose first\s+\/\/ TWO characters are both capitals/);
  assert.match(src, /THE CEILING, named/);
});

// BB-19 (signed (1) by the owner): the article repositories' Releases are made by the machine too. The article template carries the SAME bare
// create-release.yml and the three scripts it runs, byte-identical to the overlay's (never a second parser), and its CHANGELOG heading is the
// canon form the one parser reads ("## [X.Y.Z] - YYYY-MM-DD"). The template's own heading used to be "## {{VERSION}}—{{DATE}}": a repository
// born from it could never be parsed (Sprite, born that way, writes "## 2.0.5—2026-10-03").
const lfRead = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const ARTICLE_RELEASE_FILES = ['.github/workflows/create-release.yml', 'scripts/release-notes.mjs', 'scripts/verify-release-shape.mjs', 'scripts/lib/release-shape.mjs'];

test('the article template carries create-release.yml and the three scripts it runs, byte-identical to the overlay (one parser, no second copy of the logic) -- RED before BB-19', () => {
  for (const rel of ARTICLE_RELEASE_FILES) {
    const art = path.join(TEMPLATES, 'article', rel);
    assert.ok(fs.existsSync(art), 'the article template is missing ' + rel);
    assert.equal(lfRead(art), lfRead(path.join(TEMPLATES, 'overlay-coal-skill', rel)), rel + ' differs from the overlay copy');
  }
});

test('the article template\'s CHANGELOG heading is the canon "## [X.Y.Z] - YYYY-MM-DD" with a summary line, and the one parser reads a filled-in copy -- RED before BB-19', async () => {
  const { extractChangelogEntry } = await import(pathToFileURL(path.join(TEMPLATES, 'overlay-coal-skill', 'scripts', 'lib', 'release-shape.mjs')).href);
  const raw = lfRead(path.join(TEMPLATES, 'article', 'CHANGELOG.md'));
  assert.match(raw, /^## \[\{\{VERSION\}\}\] - \{\{DATE\}\}$/m, 'the canon heading, a hyphen and brackets');
  assert.doesNotMatch(raw, /^## .*—/m, 'no em-dash version heading');
  const filled = raw.replace('{{VERSION}}', '1.0.0').replace('{{DATE}}', '2026-10-04').replace('{{SUMMARY}}', 'The first published draft of the standard.');
  const e = extractChangelogEntry(filled, '1.0.0');
  assert.equal(e.summary, 'The first published draft of the standard.');
  assert.match(e.sectionsBody, /^### Added/);
});

test('the article skeleton rows own the release workflow and its three scripts, and a no-remote change-request room reads the workflow N/A -- RED before BB-19', async () => {
  const { SKELETON_FILES, NO_REMOTE_NA_FILES } = await import(pathToFileURL(path.join(here, 'lib', 'skeleton-check-lib.mjs')).href);
  for (const kind of ['article', 'article (change-request)']) for (const rel of ARTICLE_RELEASE_FILES) assert.ok(SKELETON_FILES[kind].includes(rel), kind + ' lacks ' + rel);
  for (const kind of ['article (private)', 'private-working']) assert.ok(!SKELETON_FILES[kind].includes('scripts/release-notes.mjs'), kind + ' cuts no public Release and lists no release script');
  assert.ok(NO_REMOTE_NA_FILES['article (change-request)'].includes('.github/workflows/create-release.yml'));
});

test('RELEASE-PATTERN.md says an article repository that cuts version tags carries the same create-release.yml from the article template, one parser, one heading form -- RED before BB-19', () => {
  const t = lfRead(path.join(ROOT, 'RELEASE-PATTERN.md'));
  assert.match(t, /An article repository that cuts version tags carries the same bare `create-release\.yml`/);
  assert.match(t, /templates\/article\//);
});

// UMB-427 ruling 1, second half: Phoenix #10 (hooks-safety.md, amended 2026-10-04, umbrella 75660c42) lets a tool write its OWN project-scoped state
// folder through a realpath-containment helper. The canon .coderabbit.yaml restates the rule for the hooks block, so a patrol stops crying on the
// sanctioned write while it still cries on every other project write. The line carries the conditions, not only the permission.
test('.coderabbit.yaml hooks block: the Sandboxed line names the own project-scoped state folder, the realpath-containment conditions and the shipped-text naming; any other project write stays a finding -- RED before UMB-427', () => {
  const lines = crLines(CR_TEMPLATE);
  const at = lines.findIndex((l) => /^ {8}- Sandboxed:/.test(l));
  assert.ok(at > 0, 'the Sandboxed line exists');
  const line = lines[at];
  assert.match(line, /<project root>\/\.<agent-dir>\/<tool>\//, 'the folder, anchored at the project root');
  assert.match(line, /fs\.realpathSync\.native/, 'resolves both sides the platform way');
  assert.match(line, /both the project root and the candidate/);
  assert.match(line, /not inside that folder itself/, 'containment in the folder, never merely the project root');
  assert.match(line, /fails closed/);
  assert.match(line, /SECURITY\.md or the README/, 'named in the room\'s shipped text');
  assert.match(line, /a delete under it pins each owned directory to its literal realpath and sweeps nothing in a directory it refuses/, 'the delete clause of the amended Phoenix #10 (UMB-456 (1) ix)');
  assert.match(line, /Any other write to the project is a finding/);
  assert.match(line, /except reading the project's own config file from the project root/, 'the older exception is kept');
  assert.ok(!/[\\"]/.test(line), 'no double quote or backslash: the settings editor mangles both');
  assert.equal(lines[at - 1].trim().startsWith('- Deterministic'), true, 'the neighbouring lines did not move');
});

// UMB-456 (4) and UMB2-013: two canon rows in SKILL-REPO-PATTERN.md's Layer 5. The template's gate job already fetches full history; the row says why it must
// and a test holds the template. The `parallel:` row is a PREFER with its measurement beside it (never a MUST: Windows was inside the noise).
const PATTERN = fs.readFileSync(path.join(here, '..', 'SKILL-REPO-PATTERN.md'), 'utf8');
test('published-code ci.yml: the gate job checkout fetches full history and tags (fetch-depth: 0), the shallow default would skip a tag-form check', () => {
  const ci = fs.readFileSync(path.join(TEMPLATES, 'published-code', '.github', 'workflows', 'ci.yml'), 'utf8');
  const gate = ci.slice(ci.indexOf('\n  gate:'));
  const checkout = gate.slice(gate.indexOf('actions/checkout'), gate.indexOf('actions/setup-node'));
  assert.match(checkout, /^ {10}fetch-depth: 0$/m);
});

test('SKILL-REPO-PATTERN.md Layer 5 carries the fetch-depth row (MUST where a gate reads a tag) and the parallel row (a PREFER with its measurement, no sweep) -- RED before UMB-456 (4) and UMB2-013', () => {
  const rows = PATTERN.split('\n').filter((l) => l.startsWith('- **'));
  const depth = rows.find((l) => /fetch-depth: 0/.test(l) && /^- \*\*`fetch-depth: 0`/.test(l));
  assert.ok(depth, 'the fetch-depth row exists');
  assert.match(depth, /tag-form check/);
  assert.match(depth, /MUST/);
  const par = rows.find((l) => /^- \*\*`parallel:`/.test(l));
  assert.ok(par, 'the parallel row exists');
  assert.match(par, /prefer/i);
  assert.match(par.split(';')[0], /\(prefer, never MUST$/, 'the headline is a PREFER, stated as one');
  assert.match(par, /Ubuntu 5 to 7 s a job/);
  assert.match(par, /macOS 0 to 3 s/);
  assert.match(par, /Windows inside the noise/);
  assert.match(par, /80 to 168 s/);
  assert.match(par, /five attempts|5 attempts/);
  assert.match(par, /a32338f7/, 'the exemplar');
  assert.match(par, /next `ci\.yml` touch/);
  assert.match(par, /no (dedicated )?sweep/i);
  assert.match(par, /a step that writes the tree another step reads stays sequential/);
});

// CoalBoard's canon half (the CoalWorks chief's 08b, routed 2026-10-08): the auto-merge carve-out is PATCH and MINOR (AGENTS.md, Autonomous GitHub management), so the
// enable step names those two and nothing else. `!= semver-major` let an EMPTY update-type through (a grouped or unclassified PR has none) and any value added later.
test('dependabot-auto-merge (template and this repo\'s copy): the enable step is an allowlist of PATCH and MINOR, never a "not major" test -- RED before the CoalBoard canon ticket', () => {
  for (const f of [path.join(TEMPLATES, 'published-code', '.github', 'workflows', 'dependabot-auto-merge.yml'), path.join(OWN_WF, 'dependabot-auto-merge.yml')]) {
    const ifLine = fs.readFileSync(f, 'utf8').split(/\r?\n/).find((l) => /^ {8}if: .*steps\.meta\.outputs\.update-type/.test(l));
    assert.ok(ifLine, f + ': the enable step has an update-type condition');
    assert.match(ifLine, /steps\.meta\.outputs\.update-type == 'version-update:semver-patch'/);
    assert.match(ifLine, /steps\.meta\.outputs\.update-type == 'version-update:semver-minor'/);
    assert.doesNotMatch(ifLine, /!=|semver-major/, f + ': a "not major" test lets an empty update-type through');
  }
});

// CoalBoard PR 19 #12: the header said every step is gated on scripts/test.mjs, and the checkout step is not (the skip decision needs the tree). The sentence follows the file.
test('coverage.yml: the header says the steps AFTER the checkout are gated, and every step after the checkout is -- RED before the CoalBoard canon ticket', () => {
  const text = fs.readFileSync(path.join(TEMPLATES, 'published-code', '.github', 'workflows', 'coverage.yml'), 'utf8').replace(/\r\n/g, '\n');
  const comment = text.slice(0, text.indexOf('\non:\n'));
  assert.doesNotMatch(comment, /Every step is gated/);
  assert.match(comment, /Every step after the checkout is gated on scripts\/test\.mjs existing/);
  const steps = text.slice(text.indexOf('\n    steps:\n')).split(/\n {6}- (?=name:|uses:)/).slice(1);
  assert.ok(steps.length >= 5, 'the steps were found');
  assert.doesNotMatch(steps[0], /^uses: actions\/checkout[^\n]*\n(?:.*\n)*?\s+if:/, 'the checkout carries no gate');
  for (const s of steps.slice(1)) assert.match(s, /\n {8}if: hashFiles\('scripts\/test\.mjs'\) != ''/, 'a gated step: ' + s.split('\n')[0]);
});

// BB-87 (owner 2026-10-08): the wave runner is a canon file pair, and the pattern says what it is and what it refuses. The pair lives in the overlay's lib folder and is outside the
// overlay SET (no workflow runs it), so this row is where a room learns it exists.
test('SKILL-REPO-PATTERN.md Layer 4 carries the wave-run row: waves by the live reading, the room\'s own numbers, VACUOUS as a status, the core never edited in a room -- RED before BB-87', () => {
  const row = PATTERN.split('\n').find((l) => l.startsWith('| `scripts/lib/wave-run.mjs`'));
  assert.ok(row, 'the row exists');
  assert.match(row, /scripts\/lib\/machine-reading\.mjs/);
  assert.match(row, /templates\/overlay-coal-skill\/scripts\/lib\//, 'adopted by blob id from the overlay lib folder');
  assert.match(row, /fresh reading of the machine says BREATHE/);
  assert.match(row, /the first always runs/);
  assert.match(row, /a run with no finite clock is refused/);
  assert.match(row, /VACUOUS, its own status beside PASS, FAIL, SKIP and NOT-RUN/);
  assert.match(row, /never edited in a room/);
  assert.match(row, /scripts\/lib\/stdout-sync\.mjs/, 'the preload is named');
  assert.match(row, /a POSIX pipe/, 'the tail loss is named');
  assert.match(row, /--file-clock-ms N/, 'the file clock is named');
  assert.match(row, /prefer, after the umbrella auditor's pass/);
  for (const f of ['wave-run.mjs', 'wave-run.test.mjs', 'machine-reading.mjs', 'stdout-sync.mjs']) {
    assert.ok(fs.existsSync(path.join(TEMPLATES, 'overlay-coal-skill', 'scripts', 'lib', f)), f + ' is in the overlay lib folder');
  }
});

// 08d K1-K3 (order 09f, 2026-10-09): the first POSIX runs of the runner found three defects in it, and the canon's own CI ran no macOS leg to see them first. The row carries what a room
// learned and two opens that are named and not built; node/runtime.md section 6 makes the three-OS matrix a MUST, and this repo's gate job now has the macOS leg.
test('the wave-run row names the TODO rule, the process.exitCode wiring and the two named opens; verify-landing.yml runs its tests on macOS too -- RED before 09f', () => {
  const row = PATTERN.split('\n').find((l) => l.startsWith('| `scripts/lib/wave-run.mjs`'));
  assert.ok(row, 'the row exists');
  assert.match(row, /# TODO/, 'a failing test marked TODO is not a failure');
  assert.match(row, /process\.exitCode/, 'a room entry that ends with process.exit() carries the POSIX pipe hazard itself');
  assert.match(row, /NAMED OPEN, a canon TODO, not built: [^|]*zero tests/, 'VACUOUS covers only a file with zero tests');
  assert.match(row, /NAMED OPEN, a canon TODO, not built: [^|]*TAP of a PASS file/, 'the TAP of a PASS file is kept nowhere');
  const wf = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'verify-landing.yml'), 'utf8').replace(/\r\n/g, '\n');
  // 09g item 12 (d): the Windows leg joins (node/runtime.md section 6 asks for all three), so the matrix names the three and the bash step says it runs under bash
  assert.match(wf, /^ {6}matrix:\n {8}os: \[ubuntu-latest, macos-latest, windows-latest\]$/m, 'the gate job runs on a matrix of the three runners');
  assert.match(wf, /- name: Unit-test every scripts\/\*\.test\.mjs[^\n]*\n {8}shell: bash\n/, 'the unit-test step is a bash loop, so it names its shell for the Windows leg');
  assert.match(wf, /^ {4}runs-on: \$\{\{ matrix\.os \}\}$/m);
  assert.match(wf, /^ {4}name: \$\{\{ matrix\.os == 'ubuntu-latest' && 'verify' \|\| format\('verify \(\{0\}\)', matrix\.os\) \}\}$/m, 'the ubuntu leg keeps the check name verify');
  for (const step of ['Secret scan', 'Doc references', 'Verify the landing']) {
    assert.match(wf, new RegExp('- name: ' + step + '[^\\n]*\\n(?: {8}[^\\n]*\\n)*? {8}if: matrix\\.os == \'ubuntu-latest\''), step + ' runs on the ubuntu leg only');
  }
});

// 09f item 11, CoalTipple t34: create-release.yml is the workflow of a room that ships NO claude.ai ZIPs, so apart from the sentence that says so it never names a ZIP (the re-point comment was copied
// from claude-ai-zips.yml). The census file's own comments are held to the pointer gate every room runs: no path-shaped token that resolves nowhere, and no count without the command that re-derives it.
test('create-release.yml names no ZIP except where it says it ships none; the census comments carry no path-shaped placeholder and no unsourced count -- RED before 09f', () => {
  for (const dir of ['overlay-coal-skill', 'article']) {
    const lines = fs.readFileSync(path.join(TEMPLATES, dir, '.github', 'workflows', 'create-release.yml'), 'utf8').split(/\r?\n/);
    const named = lines.map((l, i) => [i + 1, l]).filter(([, l]) => /\bZIPs?\b/.test(l) && !/ships NO claude\.ai ZIPs/.test(l));
    assert.deepEqual(named, [], dir + '/create-release.yml names a ZIP in a workflow that ships none');
  }
  const census = fs.readFileSync(path.join(TEMPLATES, 'overlay-coal-skill', 'scripts', 'lib', 'git-env-census.mjs'), 'utf8');
  assert.ok(!census.includes('`scripts/lib/...`'), 'the census comment cites scripts/lib/..., a token a room pointer gate refuses');
  assert.ok(!/the same twelve in the same four pinned files/.test(census), 'the header count names no tree and no deriving command');
  assert.ok(!/is pinned in git-env-census\.test\.mjs/.test(census), 'CENSUS_EXEMPT names a pin the canon test does not carry');
});

// 09f item 9 (the umbrella auditor's pass 25, routed through main): the NEVER of "A published version is immutable" names its exceptions inline or has none (AGENTS.md FORCE VOCABULARY), and the posting
// path edits the title, body and tag of a published launch-form Release. The section names that re-point as the second carve-out, only while no stable Release exists, and says the form is re-decided before Immutable Releases.
test('RELEASE-PATTERN.md: the NEVER of the immutability section names the launch-form re-point as its second carve-out, only while no stable Release exists -- RED before 09f', () => {
  const t = fs.readFileSync(path.join(ROOT, 'RELEASE-PATTERN.md'), 'utf8').replace(/\r\n/g, '\n');
  const start = t.indexOf('## A published version is immutable—NEVER');
  const end = t.indexOf('\n## ', start + 5);
  assert.ok(start >= 0 && end > start, 'the section exists');
  const sec = t.slice(start, end);
  assert.doesNotMatch(sec, /The one sanctioned exception/, 'two carve-outs are named, so "the one" is false');
  assert.match(sec, /two sanctioned exceptions/);
  assert.match(sec, /Back-filling a missed Release/);
  assert.match(sec, /launch-form re-point/);
  assert.match(sec, /the only edit of a published Release's tag the house allows/);
  assert.match(sec, /only while no stable Release exists/);
  assert.match(sec, /Immutable Releases/);
  assert.match(sec, /AR-71 \(a1\)/);
});

// 09g item 12 (b), CoalFace T4 (main's ruling 2026-10-09): the census trusts the room's `gitEnv()` by name and import path and never opens the helper, so a helper that returned process.env
// would pass. The cheaper cure is a row sentence, no interface change: the room keeps a behaviour test of its own helper. R6 (a variable second argument) names the same guard.
test('the census row of SKILL-REPO-PATTERN.md says a room keeps a behaviour test of its git-env.mjs helper, whose gitEnv() never returns process.env -- RED before 09g', () => {
  const row = PATTERN.split('\n').find((l) => l.startsWith('| `scripts/lib/git-env-census.mjs`'));
  assert.ok(row, 'the row exists');
  assert.match(row, /a room adopting the census keeps a behaviour test of its `git-env\.mjs` helper \(its `gitEnv\(\)` never returns `process\.env`\)/);
  assert.match(row, /trusts the helper by its name and import path and never opens it/, 'the reason is stated beside the sentence');
});

// 14h item 14 (6), CoalFace #1 = CoalLedger #4 (Major): "gh release download ... 2>/dev/null || true" turned an API or network failure into "no prior sums", and decide-upload then answered
// upload-clobber over published assets. The step now lists the Release's assets first: an API failure fails the step, an absent SHA256SUMS.txt is the first-run answer, and a listed one that
// cannot be downloaded fails too. A fake gh stands in for the API, each answer chosen by the test.
const FAKE_GH = [
  '#!/usr/bin/env bash',
  'case "$1 $2" in',
  '  "release view") if [ -n "${FAKE_VIEW_FAIL:-}" ]; then echo "HTTP 502: Bad Gateway" >&2; exit 1; fi; printf "%s\\n" "${FAKE_ASSETS:-}"; exit 0;;',
  '  "release download") if [ -n "${FAKE_DL_FAIL:-}" ]; then echo "download failed" >&2; exit 1; fi; out=""; while [ $# -gt 0 ]; do if [ "$1" = "-O" ]; then out="$2"; fi; shift; done; printf "abc  x.zip\\n" > "$out"; exit 0;;',
  'esac',
  'exit 99',
  '',
].join(String.fromCharCode(10));
function existingSums(env, stale = false) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zips-sums-'));
  try {
    fs.mkdirSync(path.join(dir, 'bin'));
    if (stale) fs.writeFileSync(path.join(dir, 'existing-SHA256SUMS.txt'), 'leftover  old.zip\n');
    fs.writeFileSync(path.join(dir, 'bin', 'gh'), FAKE_GH, { mode: 0o755 });
    const r = spawnSync('bash', ['-c', 'PATH="$PWD/bin:$PATH"\n' + stepRun('Check for an already-published SHA256SUMS.txt')], { encoding: 'utf8', timeout: 30000, cwd: dir, env: { ...process.env, RELEASE_TAG: 'v1.0.0', ...env } });
    return { r, downloaded: fs.existsSync(path.join(dir, 'existing-SHA256SUMS.txt')) };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
test('the already-published SHA256SUMS.txt check tells "asset absent" from "the API failed": a failed listing fails the step (it must never read as a first run) -- RED before 14h (6)', { skip: !HAS_BASH && 'no bash' }, () => {
  const { r, downloaded } = existingSums({ FAKE_VIEW_FAIL: '1' });
  assert.notEqual(r.status, 0, 'a listing that failed is not "no prior sums": ' + r.stdout);
  assert.equal(downloaded, false);
  assert.match(r.stdout + r.stderr, /could not list the assets/);
});
test('the check: a Release with no SHA256SUMS.txt (a first run, or only a similarly named file) succeeds with no file; a listed one is downloaded', { skip: !HAS_BASH && 'no bash' }, () => {
  const none = existingSums({ FAKE_ASSETS: 'a.zip\nSHA256SUMS.txt.bak' });
  assert.equal(none.r.status, 0, none.r.stderr);
  assert.equal(none.downloaded, false, 'SHA256SUMS.txt.bak is not SHA256SUMS.txt');
  const empty = existingSums({ FAKE_ASSETS: '' });
  assert.equal(empty.r.status, 0, empty.r.stderr);
  assert.equal(empty.downloaded, false);
  const there = existingSums({ FAKE_ASSETS: 'a.zip\nSHA256SUMS.txt' });
  assert.equal(there.r.status, 0, there.r.stderr);
  assert.equal(there.downloaded, true);
});
test('the check removes a leftover existing-SHA256SUMS.txt before it looks: a re-run on a workspace that still holds one must not read it as the Release\'s', { skip: !HAS_BASH && 'no bash' }, () => {
  const { r, downloaded } = existingSums({ FAKE_ASSETS: 'a.zip' }, true);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(downloaded, false);
});
test('the check: a SHA256SUMS.txt that is listed but cannot be downloaded fails the step, never "no prior sums" -- RED before 14h (6)', { skip: !HAS_BASH && 'no bash' }, () => {
  const { r, downloaded } = existingSums({ FAKE_ASSETS: 'SHA256SUMS.txt', FAKE_DL_FAIL: '1' });
  assert.notEqual(r.status, 0);
  assert.equal(downloaded, false);
  assert.match(r.stdout + r.stderr, /could not be downloaded/);
});

// 14h item 14 (9), CoalLedger #5 (Major) and CoalBoard's canon-deferred thread: the canon fixed the `!= semver-major` hole in c015c4b, but seven of the eight rooms still carry it (CoalMine's allowlist is written with
// contains(fromJSON(...))). The class is now a standing row of the pattern, so a room reading it has the rule and not only the template, and the canon's two copies are held to the env-var URL as well.
test('SKILL-REPO-PATTERN.md states the auto-merge enable step as an allowlist the rooms take, and both canon copies pass the PR URL through env -- RED before 14h (9)', () => {
  const bullet = PATTERN.split('\n').find((l) => l.startsWith('- **`dependabot-auto-merge.yml`'));
  assert.ok(bullet, 'the bullet exists');
  assert.match(bullet, /ALLOWLIST of patch and minor/);
  assert.match(bullet, /`version-update:semver-patch` and `version-update:semver-minor`/);
  assert.match(bullet, /`!= version-update:semver-major` .*empty update-type/);
  assert.match(bullet, /`PR_URL`/);
  assert.match(bullet, /`timeout-minutes`/);
  for (const f of ['.github/workflows/dependabot-auto-merge.yml', 'templates/published-code/.github/workflows/dependabot-auto-merge.yml']) {
    const text = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.match(text, /run: gh pr merge --squash --auto "\$PR_URL"/, f + ': the URL goes through the environment');
    assert.doesNotMatch(text, /run: gh pr merge[^\n]*\$\{\{/, f + ': no expression is interpolated into the script');
  }
});

// 14h item 14 (11) G-1, CoalTipple t24 row 3 (zizmor, cache-poisoning): actions/setup-node enables a package-manager cache by default when it can, and a cache restored into a job that holds
// `contents: write` and publishes a Release is a poisoning path from a less-privileged run. Every setup-node step of a workflow whose job writes contents opts out (input `package-manager-cache`,
// verified in the action.yml of the pinned commit 820762786026740c76f36085b0efc47a31fe5020, read 2026-10-14).
test('every actions/setup-node step in a workflow whose job holds contents: write sets package-manager-cache: false -- RED before 14h (11)', () => {
  const files = ['templates/overlay-coal-skill/.github/workflows/create-release.yml', 'templates/overlay-coal-skill/.github/workflows/claude-ai-zips.yml', 'templates/article/.github/workflows/create-release.yml', '.github/workflows/update-readme.yml'];
  for (const rel of files) {
    const lines = fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n').split('\n');
    assert.ok(lines.some((l) => /^\s+contents: write/.test(l)), rel + ' holds a write job');
    const at = lines.map((l, i) => [l, i]).filter(([l]) => /uses: actions\/setup-node@/.test(l)).map(([, i]) => i);
    assert.ok(at.length >= 1, rel + ' sets up node');
    for (const i of at) {
      let end = i + 1;
      while (end < lines.length && !/^\s{6}- /.test(lines[end]) && !/^\s{4}\S/.test(lines[end])) end++;
      assert.ok(lines.slice(i, end).some((l) => /^\s+package-manager-cache: false\s*(#.*)?$/.test(l)), `${rel}:${i + 1}: setup-node without package-manager-cache: false in a job that can write contents`);
    }
  }
});

test('zizmor.yml runs the workflow analyser over this repository\'s workflows and the canon templates, read-only, from the one SHA-256-pinned wheel, report-only by one flag (G-1; 14h3: no third-party action)', () => {
  const t = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'zizmor.yml'), 'utf8').replace(/\r\n/g, '\n');
  const code = t.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');
  assert.doesNotMatch(code, /zizmorcore\//, 'the org allowlist refuses that action: the run never started (14h3)');
  assert.match(code, /zizmor==\d+\.\d+\.\d+ --hash=sha256:[0-9a-f]{64}\b/, 'zizmor itself is pinned by version and by the wheel hash');
  assert.match(code, /pip" install [^\n]*--require-hashes[^\n]*--only-binary=:all:/, 'pip refuses an unhashed or source install');
  assert.match(code, /-path '\*\.github\/workflows\/\*'/, 'the find reaches this repository\'s own .github/workflows and the templates\' (a `*/.github` pattern misses the root one)');
  assert.match(code, /find \.github\/workflows templates /, 'the canon templates are scanned beside this repository\'s own workflows');
  assert.match(code, /--offline --no-exit-codes --format=plain/);
  assert.match(code, /--offline --no-exit-codes --format=github/);
  assert.doesNotMatch(code, /security-events: write|contents: write/, 'a read-only job');
  assert.doesNotMatch(code, /continue-on-error/, 'report-only is the one flag --no-exit-codes: a real error of the tool is still red');
  assert.match(code, /workflow_dispatch:/);
  assert.match(code, /persist-credentials: false/);
  assert.match(code, /timeout-minutes: \d+/);
  assert.match(code, /group: zizmor-\$\{\{ github\.ref \}\}\n\s+cancel-in-progress: true/);
  assert.match(t, /delete `--no-exit-codes` from the step/, 'the header names the one-flag switch');
});

test('SKILL-REPO-PATTERN.md states the workflow analyser (G-1): where it runs, that it is report-only with a one-line switch, and the setup-node opt-out -- RED before 14h (11)', () => {
  const bullet = PATTERN.split('\n').find((l) => l.startsWith('- **A workflow static analyser runs in CI'));
  assert.ok(bullet, 'the bullet exists');
  assert.match(bullet, /`\.github\/workflows\/zizmor\.yml`/);
  assert.match(bullet, /REPORT-ONLY for its first runs, as `markdownlint\.yml` is/);
  assert.match(bullet, /`--no-exit-codes`/);
  assert.match(bullet, /SHA-256/);
  assert.match(bullet, /org's allowlist/);
  assert.match(bullet, /`package-manager-cache: false`/);
});

// 14h item 14 (1), CoalBoard t34 (a): create-release.yml is the workflow of a room with NO build step, so its re-point comment must not say the step sits "after every build" (CodeRabbit's wording was accurate;
// the sentence was copied from claude-ai-zips.yml, which does build). Both copies of create-release.yml say what is true; claude-ai-zips.yml keeps its sentence.
test('create-release.yml does not claim a build step the file does not have -- RED before 14h (1)', () => {
  for (const rel of ['templates/overlay-coal-skill/.github/workflows/create-release.yml', 'templates/article/.github/workflows/create-release.yml']) {
    const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.doesNotMatch(text, /after every build/, rel);
    assert.match(text, /after every check above \(the derive step and its file check\), so a failed derive leaves the old Release as it/, rel);
  }
  assert.match(fs.readFileSync(path.join(ROOT, 'templates/overlay-coal-skill/.github/workflows/claude-ai-zips.yml'), 'utf8'), /after every build and check above/);
});

// 14h item 14 (8): a file the rooms copy by blob names no path that only the umbrella holds. The census vectors cited a chief's scratchpad list, which no clone can open; the list is the file now.
test('the census files the rooms copy cite no scratchpad path (a path no clone can open) -- RED before 14h (8)', () => {
  for (const name of ['git-env-census.mjs', 'git-env-census.vectors.mjs', 'git-env-census.test.mjs']) {
    const rel = `templates/overlay-coal-skill/scripts/lib/${name}`;
    assert.doesNotMatch(fs.readFileSync(path.join(ROOT, rel), 'utf8'), /scratchpad[\\/]/, rel);
  }
});

// 14h item 14 (10 #3), CoalLedger PR #20: the workflow header called 200 characters claude.ai's cap, while the build script beside it says claude.ai's page states 1,024 and 200 is a conservative trim kept until a real
// upload at the longer length is on record (UMB-333). A comment that contradicts the script beside it misleads whoever reads the workflow alone, so the two say one thing.
test('claude-ai-zips.yml names 200 as the conservative trim and 1,024 as the stated platform limit, as build-claude-ai-zips.mjs does -- RED before 14h (10 #3)', () => {
  const wf = fs.readFileSync(path.join(ROOT, 'templates/overlay-coal-skill/.github/workflows/claude-ai-zips.yml'), 'utf8').split(/\r?\n/).slice(0, 12).join('\n');
  const build = fs.readFileSync(path.join(ROOT, 'templates/overlay-coal-skill/scripts/build-claude-ai-zips.mjs'), 'utf8').split(/\r?\n/).slice(0, 14).join('\n');
  assert.match(build, /1,024-char limit, so the 200 trim is conservative/, 'the script says it');
  assert.doesNotMatch(wf, /skill-listing description cap is 200/, 'the header no longer calls 200 the cap');
  assert.match(wf, /1,024/, 'the header names the stated limit');
  assert.match(wf, /conservative/, 'the header names 200 as a conservative trim');
  assert.match(wf, /UMB-333/, 'the header names what keeps the trim');
});

// BB-98 (b), 2026-10-09: GitHub's default policy blocks the `pull_request_target` event in public repositories from 2026-11-02 (workflow execution protections). The
// canon says no new workflow adopts it, and the templates and this repo's own workflows carry none (a grep over 85 workflows of the org, its templates and the rooms found none).
test('no template or own workflow uses the pull_request_target event, and SKILL-REPO-PATTERN.md bans adopting it -- RED before BB-98 (b)', () => {
  const offenders = ALL_WORKFLOWS().filter((f) => fs.readFileSync(f, 'utf8').split(/\r?\n/).some((l) => !l.trim().startsWith('#') && /\bpull_request_target\b/.test(l)));
  assert.deepEqual(offenders.map((f) => path.relative(ROOT, f)), []);
  const row = PATTERN.split('\n').find((l) => /^- \*\*`pull_request_target` is never adopted/.test(l));
  assert.ok(row, 'the row exists');
  assert.match(row, /2026-11-02/);
  assert.match(row, /a new workflow never adopts it/);
  assert.match(row, /a job that must read a secret on an outside pull request waits for the belt's own event policy/);
});

// BB-98 (c), 2026-10-09: the two org defaults a new repository is born under are written where the canon lists what a repo inherits, so nobody re-derives them from the dashboard.
test('SERIES-CANON.md records the org defaults a new repo inherits: Dependabot malware alerts (public only) and commit comments disabled -- RED before BB-98 (c)', () => {
  const rows = fs.readFileSync(path.join(ROOT, 'SERIES-CANON.md'), 'utf8').split(/\r?\n/);
  const mal = rows.find((l) => l.startsWith('| Org default: Dependabot malware alerts |'));
  assert.ok(mal, 'the malware row exists');
  assert.match(mal, /TheColliery baseline/);
  assert.match(mal, /not available for the private configuration on the Free plan/i);
  const cc = rows.find((l) => l.startsWith('| Org default: commit comments |'));
  assert.ok(cc, 'the commit-comments row exists');
  assert.match(cc, /Disabled by default/);
  assert.match(cc, /a repository may override/);
  assert.match(cc, /existing comments stay/);
  for (const r of [mal, cc]) assert.equal(r.split('|').length, 6, 'four cells, one per column (the kind column and three kinds)');
});

// ---- 08d D1/D3 (2026-10-09): the git-spawn census is a canon file set, and the canon's own carriers pass it ----
// The portable part (the witness list as a corpus) is templates/overlay-coal-skill/scripts/lib/git-env-census.test.mjs; what needs the .github repository's own files is here.
const CARRIER_DIRS = ['scripts', 'templates/published-code/scripts', 'templates/article/scripts'];
const readText = (rel) => fs.readFileSync(path.join(ROOT, ...rel.split('/')), 'utf8');
// The canon secret gate keeps GIT_INDEX_FILE BY DESIGN (commit mode reads the commit's own index, which a hook names through that variable), and GIT_INDEX_FILE is outside the three
// GIT_ names the rule allows, so its two git spawns are findings the census is right to give. It is the ONE pinned carrier, at this blob; any edit spends the pin. The Bankfire source test was
// the second until Bankfire returned gitEnv()'s literal alone (bd328f2e, 2026-10-09): it now passes the census with no pin, like the gate test.
const GATE_PIN = { rel: 'scripts/secret-gate.mjs', blob: 'a96c2c57344469f5dd3bd74927cf3bf63c198725', why: 'canon secret gate: keeps GIT_INDEX_FILE and GIT_CEILING_DIRECTORIES by design (its gitEnv() copies process.env minus the other GIT_ names); the two spawns are the findings' };

test('the canon secret-gate test passes the canon census with no pin: it builds every git environment from named keys, in all three places it lives -- RED before 08d D3', () => {
  for (const dir of CARRIER_DIRS) {
    const rel = `${dir}/secret-gate.test.mjs`;
    const r = scanGitSpawns([{ rel, text: readText(rel) }], []);
    assert.deepEqual(r.findings, [], `${rel} is refused by the census`);
    assert.ok(r.calls >= 3, `${rel}: the census counted ${r.calls} git spawns`);
    assert.equal(r.safe, r.calls, rel);
  }
});

test('the Bankfire source test passes the canon census with no pin, in all three places it lives: gitEnv() returns its literal of named keys alone -- RED while the pinned copy (cc3939db) stood', () => {
  for (const dir of CARRIER_DIRS) {
    const rel = `${dir}/secret-scan.test.mjs`;
    const text = readText(rel);
    const r = scanGitSpawns([{ rel, text }], []);
    assert.deepEqual(r.findings, [], `${rel} is refused by the census`);
    assert.ok(r.calls >= 5, `${rel}: the census counted ${r.calls} git spawns`);
    assert.equal(r.safe, r.calls, rel);
    assert.ok(!/\.\.\.process\.env|Object\.entries\(process\.env\)/.test(text), `${rel} copies no process environment`);
  }
});

test('the canon secret gate is the ONE pinned carrier: unpinned its two git spawns are findings, pinned at its blob it is exempt and says so, and an edit spends the pin', () => {
  for (const dir of CARRIER_DIRS) {
    const rel = `${dir}/secret-gate.mjs`;
    const text = readText(rel);
    const bare = scanGitSpawns([{ rel, text }], []);
    assert.equal(bare.findings.length, 2, `${rel}: the two spawns of the gate, no more`);
    assert.ok(bare.findings.every((f) => /execFileSync\('git'/.test(f)), rel);
    assert.equal(gitBlobId(text), GATE_PIN.blob, `${rel} changed: re-read the pin's reason, then update GATE_PIN`);
    const pinned = scanGitSpawns([{ rel, text }], [{ ...GATE_PIN, rel }]);
    assert.deepEqual([pinned.findings, pinned.exempted], [[], 1], rel);
    assert.ok(scanGitSpawns([{ rel, text: text + '\n' }], [{ ...GATE_PIN, rel }]).findings.length === 2, 'one added byte spends the pin');
  }
});

test('the canon release-notes.mjs and its test (the list\'s P1 and P2) read clean with no pin, and are counted', () => {
  for (const rel of ['templates/overlay-coal-skill/scripts/release-notes.mjs', 'templates/overlay-coal-skill/scripts/release-notes.test.mjs']) {
    const r = scanGitSpawns([{ rel, text: readText(rel) }], []);
    assert.deepEqual(r.findings, [], rel);
    assert.ok(r.calls >= 1 && r.safe === r.calls, rel);
  }
});

test('the three places a secret-scan or secret-gate file lives hold the same bytes, and the secret-scan test is the Bankfire source\'s (blob 7899e587, Bankfire a9610d8): the scanner parity contract -- RED before 08d D3', () => {
  for (const name of ['secret-scan.test.mjs', 'secret-gate.test.mjs', 'secret-gate.mjs']) {
    const blobs = CARRIER_DIRS.map((d) => gitBlobId(readText(`${d}/${name}`)));
    assert.equal(new Set(blobs).size, 1, `${name} differs between the three places: ${blobs.join(' ')}`);
  }
  assert.ok(gitBlobId(readText('scripts/secret-scan.test.mjs')).startsWith('7899e587'), 'the Bankfire source test moved: re-copy it byte for byte into the three places (scripts/scanner-parity.mjs reads it)');
});

test('the public hooks say what the secret scan does NOT catch, including a token header with a scheme word: the answer to CoalMine LOW-1 -- the scan-limit sentence', () => {
  for (const rel of ['templates/published-code/.githooks/pre-commit', 'templates/published-code/.githooks/pre-push', 'templates/article/.githooks/pre-commit', 'templates/article/.githooks/pre-push']) {
    const text = readText(rel).replace(/\r?\n#\s*/g, ' ');
    assert.match(text, /an HTTP authentication header whose value is a scheme and a token \(Authorization: Bearer <key>, X-Api-Token: Bearer <key>\) unless that token is provider-shaped/, rel);
    assert.match(text, /does NOT catch a credential inside a URL or connection string/, rel);
  }
});

test('SKILL-REPO-PATTERN.md Layer 4 carries the git-env-census row: one rule, the token census, the witness corpus, no pin shipped, the two ceilings, adopted by blob -- RED before 08d D3', () => {
  const row = PATTERN.split('\n').find((l) => l.startsWith('| `scripts/lib/git-env-census.mjs`'));
  assert.ok(row, 'the row exists');
  for (const re of [/git-env-census\.vectors\.mjs/, /git-env-census\.test\.mjs/, /GIT_CONFIG_NOSYSTEM: '1'/, /never a copy, a spread or a filter of `process\.env`/, /TOKEN census/, /F1-F60/, /R1-R5/, /P1-P7/, /ships NO pin/, /R4 a spawner written with a unicode escape/, /R5 a command built by concatenation/, /adopted by blob id from `templates\/overlay-coal-skill\/scripts\/lib\/`/, /MUST for the rule \(UMB-456 \(2\)\)/]) {
    assert.match(row, re);
  }
  for (const f of ['git-env-census.mjs', 'git-env-census.vectors.mjs', 'git-env-census.test.mjs']) {
    assert.ok(fs.existsSync(path.join(TEMPLATES, 'overlay-coal-skill', 'scripts', 'lib', f)), f + ' is in the overlay lib folder');
  }
});

// 14h3 (zizmor startup_failure, run 38565145841, 2026-10-14): the org allows an action only if it is owned by TheColliery, created by GitHub, or matches the org's patterns, and every action must be
// pinned to a full SHA. A workflow that names any other action never starts: GitHub refuses it before a job exists, so no step of a run can show it. The patterns below are read from the org's own
// refusal text on that run (the org policy is the owner's, GET /orgs/TheColliery/actions/permissions); a new pattern the owner adds is added here in the same unit.
const ORG_ALLOWED_ACTIONS = [/^TheColliery\//, /^actions\//, /^github\//, /^DavidAnson\/markdownlint-cli2-action$/, /^dependabot\/fetch-metadata$/, /^ossf\/scorecard-action$/, /^pypa\/gh-action-pypi-publish$/];
test('every action this repository\'s workflows and the canon templates use is one the org allows, pinned to a full SHA -- RED while zizmor.yml named zizmorcore/zizmor-action (a startup failure no step can show) -- 14h3', () => {
  const files = [];
  const walk = (dir) => { for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) { const p = `${dir}/${e.name}`; if (e.isDirectory()) walk(p); else if (/\.github\/workflows\/[^/]+\.ya?ml$/.test(p)) files.push(p); } };
  walk('.github/workflows'); walk('templates');
  assert.ok(files.length >= 20, 'the walk finds the workflows it polices: ' + files.length);
  const bad = [];
  for (const f of files) {
    const text = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const m of text.matchAll(/^\s*-?\s*uses:\s*([^\s#]+)/gm)) {
      const ref = m[1];
      if (ref.startsWith('./') || ref.startsWith('docker://')) continue;
      const [name, pin] = ref.split('@');
      const repo = name.split('/').slice(0, 2).join('/');
      if (!ORG_ALLOWED_ACTIONS.some((re) => re.test(repo))) bad.push(`${f}: ${repo} is not on the org's allowlist`);
      if (!/^[0-9a-f]{40}$/.test(pin || '')) bad.push(`${f}: ${ref} is not pinned to a full commit SHA`);
    }
  }
  assert.deepEqual(bad, []);
});

// 14h3, UMB3-020 (card BB-162 (ก), the owner 2026-10-14: "ต่อจากนี้ให้โพสต์ช่อง GHSA"): where a fixed vulnerability is announced. One rule, stated where a room reads it (the SECURITY.md row of DOC-PATTERN.md),
// carried into the template a new repo is stamped from and the org default file, so the pattern and what ships say the same thing.
test('a fixed vulnerability is announced as a GitHub security advisory: DOC-PATTERN.md row 2 states it (the room drafts, the owner publishes and requests the CVE, SECURITY.md keeps one line per advisory), and the published-code template and the org SECURITY.md say it too -- RED before 14h3 (UMB3-020)', () => {
  const doc = fs.readFileSync(path.join(ROOT, 'DOC-PATTERN.md'), 'utf8').replace(/\r\n/g, '\n');
  const row = doc.split('\n').find((l) => l.startsWith('| 2 | Reporting a Vulnerability |'));
  assert.ok(row, 'row 2 of the SECURITY.md table exists');
  assert.match(row, /announced as a GitHub repository security advisory \(GHSA\)/);
  assert.match(row, /room DRAFTS it/);
  assert.match(row, /OWNER publishes it and requests its CVE/);
  assert.match(row, /ONE LINE per published advisory, linking to it/);
  assert.match(row, /never the advisory's full text/);
  const tpl = fs.readFileSync(path.join(ROOT, 'templates', 'published-code', 'SECURITY.md'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(tpl, /disclosed once a fix ships as a GitHub security advisory/, 'the stamped template');
  assert.match(tpl, /one line per published advisory/, 'the template says the file keeps one line each');
  const org = fs.readFileSync(path.join(ROOT, '.github', 'SECURITY.md'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(org, /disclosed once a fix ships as a GitHub security advisory/, 'the org default file');
});

// 15h item 2(b), CWK2-020 (1) across the flock (the CoalWorks chief's 14a return D2, D3 item 2; CoalWash v1.12.2 measured the cure, CoalMine v3.23.2 measured the Antigravity twin): a hook entry in a Coal* repo's
// `hooks/hooks.json` is the EXEC form (the program in `command`, the script in `args`, no shell), because a command STRING runs under the host's shell, and on Windows without Git for Windows that shell is PowerShell, where
// `${CLAUDE_PLUGIN_ROOT}` comes out empty and the hook fails (closed, from Claude Code 2.1.299, for a guard). The Antigravity `plugin/hooks.json` KEEPS the shell string: the exec form did not fire on agy 1.3.2 (0 of 3,
// measured by CoalMine's head) and AG's `args` schema is unmeasured. The canon names both forms, so a new sibling inherits them.
test('SKILL-REPO-PATTERN.md Layer 2 states the hook wiring in both forms: the exec form for hooks/hooks.json, the shell string kept for the Antigravity plugin/hooks.json, each with its reason -- RED before 15h (2b)', () => {
  const bullet = PATTERN.split('\n').find((l) => l.startsWith('- `hooks/hooks.json` wires'));
  assert.ok(bullet, 'the Layer 2 hooks.json bullet exists');
  assert.match(bullet, /EXEC FORM/);
  assert.match(bullet, /"command": "node", "args": \["\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/<file>\.js"\]/, 'the shape of one entry');
  assert.match(bullet, /no `shell`/);
  assert.match(bullet, /PowerShell/);
  assert.match(bullet, /Git for Windows/);
  assert.match(bullet, /2\.1\.299/, 'the host version that made the string form fail closed');
  assert.match(bullet, /2\.1\.139/, 'the floor CoalWash names for the exec form');
  assert.match(bullet, /Antigravity `plugin\/hooks\.json`/);
  assert.match(bullet, /KEEPS the shell string/);
  assert.match(bullet, /agy 1\.3\.2/);
  assert.match(bullet, /0 of 3/);
  assert.match(bullet, /`verify\.mjs`, or a test the gate runs, checks `type === 'command'`/, 'the wiring gate reads the type as well as the command and args (16j: a room may hold the check in a test)');
  assert.doesNotMatch(bullet, /CoalFace and CoalMine lack that check/, 'the stale sentence (both rooms shipped the check before 16j)');
});

// 15h item 2(b), CoalHearth's t90 #3 (the CoalWorks chief's 14a return D3 item 1): the census header's ceiling item 5 listed `const run = spawnSync` among the shapes that "are not counted", but the census reports a spawner
// named other than as a call as a FINDING, an alias included (vector B8's family; witness: calls 0, findings 1, with a clean env too). A header that calls a refused shape a ceiling tells a room it may write it.
test('the census header says that `const run = spawnSync` is a finding (X3, B8), not a shape that goes uncounted and unreported -- RED before 15h (2b)', () => {
  const census = fs.readFileSync(path.join(TEMPLATES, 'overlay-coal-skill', 'scripts', 'lib', 'git-env-census.mjs'), 'utf8').replace(/\r\n/g, '\n');
  const flat = census.split('\n').slice(0, 90).map((l) => l.replace(/^\/\/\s*/, '')).join(' ').replace(/\s+/g, ' ');
  assert.doesNotMatch(flat, /a spawn reached by `const run = spawnSync` or by member access/, 'the alias is not listed among the uncounted shapes');
  assert.match(flat, /\(an import or a destructure under another name, or `const run = spawnSync`, IS a finding, X3, B8\)/);
  for (const env of ['{ env: { ...process.env } }', "{ env: { PATH: process.env.PATH, GIT_CONFIG_NOSYSTEM: '1' } }"]) {
    const r = scanGitSpawns([{ rel: 'scripts/x.mjs', text: `import { spawnSync } from 'node:child_process';\nconst run = spawnSync;\nrun('git', ['status'], ${env});\n` }], []);
    assert.equal(r.calls, 0, 'the aliased spawn is not counted');
    assert.equal(r.findings.length, 1, 'but the alias IS a finding, whatever the env');
  }
});

// 15h item 2(c), mark 6 of SWEEP-MARKS Event 2 for the CoalFace tags v0.14.3 and v0.14.4: the org's three copies of the CoalFace wallet claim said the swarm is "bounded by the estimated solo $-cost" with no condition. The room's
// own README (the wallet paragraph, the source of this claim) says it fits inside the solo DOLLAR cost only when worker tiers are cheaper than main; with the default main-equivalent workers it can exceed it and no budget stop
// exists; the room's reviewer re-checked the same correction for the About text (CoalFace 14a/about.txt). The landing says what the room's README says.
test('the org landing, the org README and the installer blurb state CoalFace\'s dollar bound as conditional on cheaper worker tiers, as the room\'s README does -- RED before 15h (2c)', () => {
  const profile = fs.readFileSync(path.join(ROOT, 'profile', 'README.md'), 'utf8').split('\n').find((l) => l.startsWith('| **[CoalFace]'));
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8').split('\n').find((l) => l.startsWith('* **[CoalFace]'));
  const installer = fs.readFileSync(path.join(ROOT, 'install.mjs'), 'utf8').split('\n').find((l) => l.includes("name: 'CoalFace'"));
  for (const [name, line] of [['profile/README.md', profile], ['README.md', readme], ['install.mjs', installer]]) {
    assert.ok(line, name + ' carries the CoalFace line');
    assert.doesNotMatch(line, /bounded by the estimated solo \$-cost/, name + ': no unconditional bound');
    assert.doesNotMatch(line, /solo-cost bound\b/, name + ': no unconditional bound');
    assert.match(line, /cheaper (worker )?tiers|worker tiers are cheaper than main/, name + ': the condition is stated');
  }
  assert.match(profile, /can exceed it/, 'the landing names the other side');
  assert.match(profile, /no budget stop/, 'and that nothing stops it');
});
