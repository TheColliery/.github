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
  assert.deepEqual(CR_CODE(CR_PRIVATE), ['inheritance: true', 'knowledge_base:', '  opt_out: true']);
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
// GIT_ names the rule allows, so its two git spawns are findings the census is right to give. It is the ONE pinned carrier, at this blob; any edit spends the pin.
// The Bankfire source test (blob cc3939db) builds every git environment from named keys, but its gitEnv() returns `(envSeen = { ... })`: it records the last environment it built in a
// witness variable the file's own tests read and pass to assertGitEnv(). The census reads a helper's returned object literal, and an assignment wrapped around it is outside the grammar, so
// all five of its git spawns are findings the census cannot clear. It is pinned at this blob until Bankfire drops the witness (the census proves a call takes gitEnv(), so the test can
// assert on gitEnv() itself); the courier is in the 09e return.
const SCAN_TEST_PIN = { blob: 'cc3939dbcbd3d8c642bd45d994a2844063f22335', why: 'Bankfire source test: gitEnv() is (envSeen = { named keys }), a witness the census does not read; the literal itself is named keys with GIT_CONFIG_NOSYSTEM; REMOVE when the source returns the literal alone' };
const GATE_PIN = { rel: 'scripts/secret-gate.mjs', blob: '856956a1cca6f716e5507f6c23ac90ed34cbbe5f', why: 'canon secret gate: keeps GIT_INDEX_FILE and GIT_CEILING_DIRECTORIES by design (its gitEnv() copies process.env minus the other GIT_ names); the two spawns are the findings' };

test('the canon secret-gate test passes the canon census with no pin: it builds every git environment from named keys, in all three places it lives -- RED before 08d D3', () => {
  for (const dir of CARRIER_DIRS) {
    const rel = `${dir}/secret-gate.test.mjs`;
    const r = scanGitSpawns([{ rel, text: readText(rel) }], []);
    assert.deepEqual(r.findings, [], `${rel} is refused by the census`);
    assert.ok(r.calls >= 3, `${rel}: the census counted ${r.calls} git spawns`);
    assert.equal(r.safe, r.calls, rel);
  }
});

test('the Bankfire source test is the SECOND pinned carrier: unpinned its five git spawns are findings (the witness form), pinned at its blob it is exempt and says so, and an edit spends the pin', () => {
  for (const dir of CARRIER_DIRS) {
    const rel = `${dir}/secret-scan.test.mjs`;
    const text = readText(rel);
    const bare = scanGitSpawns([{ rel, text }], []);
    assert.equal(bare.findings.length, 5, `${rel}: its five fixture git calls`);
    assert.ok(bare.findings.every((f) => /gitEnv\(\) returns an env the census refuses/.test(f)), 'refused for the witness form of gitEnv(), not for a copy of process.env');
    assert.ok(!/\.\.\.process\.env|Object\.entries\(process\.env\)/.test(text), `${rel} copies no process environment`);
    assert.equal(gitBlobId(text), SCAN_TEST_PIN.blob, `${rel} changed: re-read the pin's reason (and the parity contract), then update SCAN_TEST_PIN`);
    const pinned = scanGitSpawns([{ rel, text }], [{ ...SCAN_TEST_PIN, rel }]);
    assert.deepEqual([pinned.findings, pinned.exempted], [[], 1], rel);
    assert.ok(scanGitSpawns([{ rel, text: text + '\n' }], [{ ...SCAN_TEST_PIN, rel }]).findings.length === 5, 'one added byte spends the pin');
  }
});

test('the canon secret gate is the FIRST pinned carrier: unpinned its two git spawns are findings, pinned at its blob it is exempt and says so, and an edit spends the pin', () => {
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

test('the three places a secret-scan or secret-gate file lives hold the same bytes, and the secret-scan test is the Bankfire source\'s (blob cc3939db): the scanner parity contract -- RED before 08d D3', () => {
  for (const name of ['secret-scan.test.mjs', 'secret-gate.test.mjs', 'secret-gate.mjs']) {
    const blobs = CARRIER_DIRS.map((d) => gitBlobId(readText(`${d}/${name}`)));
    assert.equal(new Set(blobs).size, 1, `${name} differs between the three places: ${blobs.join(' ')}`);
  }
  assert.ok(gitBlobId(readText('scripts/secret-scan.test.mjs')).startsWith('cc3939db'), 'the Bankfire source test moved: re-copy it byte for byte into the three places (scripts/scanner-parity.mjs reads it)');
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
