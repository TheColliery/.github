// UMB3-035 row C9 (order 16i): the outward links of a front door answer at the page they name. Hermetic: a node:http server on the loopback
// stands in for every host, real fetch runs against it, and the CLI is spawned against a fixture that names it. No real network.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { extractLinks, probe, judge, checkFiles } from './lib/front-door-links.mjs';

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), 'front-door-links.mjs');
let server; let base; let flakyHits = 0;
const routes = (req, res) => {
  const u = new URL(req.url, 'http://x');
  const redirect = (to) => { res.writeHead(302, { location: to }); res.end(); };
  const ok = () => { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<html>page</html>'); };
  switch (u.pathname) {
    case '/': case '/ok': case '/tools': case '/other/page': case '/docs/tools/x/index': return ok();
    case '/missing': res.writeHead(404); return res.end();
    case '/moved': return redirect('/ok');
    case '/tools/x': return redirect('/tools');               // the deep link lost (C9, CoalMine's docs page)
    case '/deep/page': return redirect('/other/page');        // kept: the page survives a move
    case '/docs/tools/x': return redirect('/docs/tools/x/index'); // kept: the final path still holds the segment
    case '/root1': return redirect('/');                      // a one-segment link may land on a root (a stable entry link)
    case '/loop': return redirect('/loop');
    case '/flaky': flakyHits++; if (flakyHits % 2 === 1) { res.writeHead(503); return res.end(); } return ok();
    case '/limited': res.writeHead(429); return res.end();
    case '/always-503': res.writeHead(503); return res.end(); // 27d: a host that never recovers within the retry

    case '/bad-location': res.writeHead(302, { location: 'http://' }); return res.end();
    default: res.writeHead(404); return res.end();
  }
};
before(async () => {
  server = http.createServer(routes);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.closeAllConnections?.(); server.close(); });
// No assertion in this file depends on how fast the loopback server answers (17c): a loaded windows runner answered a probe late and the 300 ms clock of 16i
// read it as no answer (CoalMine run 64c3ffb and twice more, CoalWash 3 of 4 pushes). Every real-server probe gets a clock far beyond any load (the file's own
// clock still catches a true hang), and the timeout itself is proved against a fetch that NEVER answers and only honours the abort signal, so it fires on time
// whatever the box is doing.
const LONG = { timeoutMs: 60000, retryMs: 10 };
// A fetch that answers only when probe's own signal aborts it. If no abort reaches it, it fails the case at its own assertion (a named error in
// slow.error) after a bound it owns, never at the runner's deadline (CoalHearth t190, order 18c). The bound is a ceiling for a regression, never a measured time.
// The ceiling timer is NOT unref'd (CoalBoard t202, CoalMine t197, CoalFace t204, order 20a): AbortSignal.timeout's own timer is unref'd, so with this one
// unref'd too nothing holds the event loop and the process ends with the case unsettled (exit 13) instead of failing at its line. The abort, which
// is due at 300 ms and cancels this timer, always runs before the 3 s ceiling even when a loaded runner stalls the loop past both (timers run in expiry order).
const neverAnswers = (u, o) => new Promise((_, reject) => {
  const own = setTimeout(() => reject(Object.assign(new Error('no abort reached the fetch'), { name: 'NoAbortReachedFetch' })), 3000);
  o.signal.addEventListener('abort', () => { clearTimeout(own); reject(o.signal.reason); });
});

test('extractLinks: markdown links, autolinks and HTML hrefs are read with their line; fenced blocks, inline code, relative paths, mailto and titled links behave', () => {
  const text = [
    '# T', '**Docs:** [a](https://a.example/tools/x "Title") *(publishing soon)*', 'see <https://b.example/p> and <a href="https://c.example/">c</a>',
    '```', '[no](https://fenced.example/)', '```', 'inline `[no](https://code.example/)` here, [rel](docs/x.md), [m](mailto:x@y), ![img](https://d.example/i.png)',
  ].join('\n');
  const links = extractLinks(text);
  assert.deepEqual(links.map((l) => [l.url, l.line]), [['https://a.example/tools/x', 2], ['https://b.example/p', 3], ['https://c.example/', 3], ['https://d.example/i.png', 7]]);
  assert.match(links[0].lineText, /publishing soon/);
  assert.deepEqual(extractLinks('```\n[x](https://x.example)\n'), [], 'an unclosed fence hides the rest');
});

test('probe: follows a chain by hand and reports the final status and URL; a loop, a timeout and an unreadable location are errors, never throws', async () => {
  assert.deepEqual(await probe(fetch, `${base}/moved`, LONG), { status: 200, finalUrl: `${base}/ok`, hops: 1 });
  assert.deepEqual(await probe(fetch, `${base}/missing`, LONG), { status: 404, finalUrl: `${base}/missing`, hops: 0 });
  const loop = await probe(fetch, `${base}/loop`, LONG);
  assert.match(loop.error, /more than 5 redirects/);
  const slow = await probe(neverAnswers, 'http://never.example/', { timeoutMs: 300, retryMs: 10 });
  assert.equal(slow.status, 0); assert.equal(slow.error, 'timeout');
  const dead = await probe(fetch, 'http://127.0.0.1:1/x', LONG);
  assert.equal(dead.status, 0); assert.ok(dead.error, 'a refused connection names its error');
  assert.match((await probe(fetch, `${base}/bad-location`, LONG)).error, /unreadable location/);
});

test('judge: the C9 shapes are findings (a 404, a dropped deep link, a stale publishing-soon note, no answer, a 429); a kept redirect, a root landing and a live page are not', () => {
  const link = (url, lineText = '') => ({ url, line: 1, lineText });
  assert.match(judge(link('https://h/tools/x'), { status: 404, finalUrl: 'https://h/tools/x', hops: 0 }), /^HTTP 404$/);
  assert.match(judge(link('https://h/tools/x'), { status: 404, finalUrl: 'https://h/gone', hops: 1 }), /HTTP 404 after a redirect to https:\/\/h\/gone/);
  assert.match(judge(link('https://h/tools/x'), { status: 200, finalUrl: 'https://h/tools', hops: 1 }), /dropped "x"/);
  assert.match(judge(link('https://h/docs/tools/x'), { status: 200, finalUrl: 'https://d/', hops: 1 }), /dropped "x"/, 'the stable-link shape that loses its deep path');
  assert.equal(judge(link('https://h/docs'), { status: 200, finalUrl: 'https://d/', hops: 1 }), null, 'a one-segment link may land on a root');
  assert.equal(judge(link('https://g/space/tools/x'), { status: 200, finalUrl: 'https://d/tools/x', hops: 1 }), null, 'a custom-domain redirect keeps the page');
  assert.equal(judge(link('https://h/Tools/X'), { status: 200, finalUrl: 'https://h/tools/x/', hops: 1 }), null, 'case and a trailing slash do not matter');
  assert.equal(judge(link('https://h/docs/tools/x'), { status: 200, finalUrl: 'https://h/docs/tools/x/index', hops: 1 }), null, 'a page that moved under its own name keeps the segment');
  const walled = 'https://github.com/o/r/security/advisories/new';
  assert.equal(judge(link(walled), { status: 200, finalUrl: `https://github.com/login?return_to=${encodeURIComponent(walled)}`, hops: 1 }), null, 'a sign-in wall that names the page is not a dropped page');
  assert.match(judge(link(walled), { status: 200, finalUrl: 'https://github.com/login', hops: 1 }), /dropped "new"/, 'a sign-in page that names nothing is');
  assert.match(judge(link('https://h/tools/x', '**Docs:** [x](https://h/tools/x) *(publishing soon)*'), { status: 200, finalUrl: 'https://h/tools/x', hops: 0 }), /publishing soon.*stale/);
  assert.match(judge(link('https://h/tools/x', '*(Coming Soon)*'), { status: 200, finalUrl: 'https://h/tools/x', hops: 0 }), /stale/);
  assert.equal(judge(link('https://h/tools/x', '*(publishing soon)*'), { status: 200, finalUrl: 'https://h/tools', hops: 1 }).includes('dropped'), true, 'the dropped page outranks the note');
  assert.match(judge(link('https://h/'), { status: 0, error: 'timeout', finalUrl: 'https://h/' }), /no answer \(timeout\)/);
  assert.match(judge(link('https://h/'), { status: 429, finalUrl: 'https://h/', hops: 0 }), /rate limited/);
  assert.equal(judge(link('https://h/ok#frag'), { status: 200, finalUrl: 'https://h/ok', hops: 0 }), null, 'a fragment is not part of the page');
});

test('checkFiles: one fetch per distinct URL, a transient answer gets ONE retry, a skipped host is counted and not fetched, findings carry file and line', async () => {
  flakyHits = 0;
  const text = [`[a](${base}/ok)`, `[b](${base}/ok#x) and [c](${base}/missing)`, `[d](${base}/flaky)`, `[e](${base}/tools/x) *(publishing soon)*`, '[s](https://skip.example/p)', '[z](http://127.0.0.1:1/dead)'].join('\n');
  let calls = 0;
  const counting = (u, o) => { calls++; return fetch(u, o); };
  const r = await checkFiles([{ name: 'README.md', text }], { ...LONG, fetchFn: counting, skipHosts: ['skip.example'] });
  assert.equal(r.links, 7); assert.equal(r.fetched, 5, 'ok and ok#x are one fetch; the skipped host and nothing else is left out'); assert.deepEqual(r.skipped, ['https://skip.example/p']);
  assert.equal(flakyHits, 2, 'the 503 was retried once and answered');
  assert.equal(calls, 5 + 1 + 1 + 1, 'five distinct pages, one hop for the redirect, one retry for the 503 and one for the dead host: a line that repeats a URL costs no fetch');
  assert.deepEqual(r.findings.map((f) => [f.file, f.line, f.message.replace(/\(.*\)/, '(...)')]), [
    ['README.md', 2, 'HTTP 404'],
    ['README.md', 4, `redirected to ${base}/tools, which dropped "x": the page the link names is not there`],
    ['README.md', 6, 'no answer (...)'],
  ]);
  assert.deepEqual((await checkFiles([{ name: 'x', text: '[u](https://%zz/)' }], LONG)).findings.map((f) => f.message), ['not a readable URL']);
});

// The child is awaited, never spawnSync: the server it fetches from lives in THIS process, and a synchronous wait would starve it (measured: every
// request timed out). The spawn carries its own timeout, as every spawn in a test must.
// The child's environment is named keys and a sandbox for HOME and the temp folders, never a copy of the operator's own (CoalGob t147, 17b).
const CHILD_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'fdl-home-'));
after(() => fs.rmSync(CHILD_HOME, { recursive: true, force: true }));
const childEnv = (extra = {}) => ({
  ...Object.fromEntries(['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'PATHEXT', 'ComSpec'].filter((k) => process.env[k] !== undefined).map((k) => [k, process.env[k]])),
  HOME: CHILD_HOME, USERPROFILE: CHILD_HOME, TEMP: CHILD_HOME, TMP: CHILD_HOME, TMPDIR: CHILD_HOME,
  FRONT_DOOR_LINKS_TIMEOUT_MS: '60000', FRONT_DOOR_LINKS_RETRY_MS: '10', ...extra,
});
const run = (args, env = {}) => new Promise((resolve) => {
  const child = spawn(process.execPath, ['--max-old-space-size=512', CLI, ...args], { timeout: 60000, env: childEnv(env) });
  let stdout = ''; let stderr = '';
  child.stdout.on('data', (d) => { stdout += d; }); child.stderr.on('data', (d) => { stderr += d; });
  child.on('close', (status) => resolve({ status, stdout, stderr }));
});

test('CLI: FAIL lines name file, line, url and why, the summary line always prints, exit 1 on a finding, 0 on a clean file, 1 on an unreadable file, 64 on a usage error, 0 on -h', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fdl-'));
  try {
    const bad = path.join(dir, 'README.md'); const good = path.join(dir, 'SECURITY.md');
    fs.writeFileSync(bad, `# x\n[a](${base}/missing)\n[b](${base}/tools/x) *(publishing soon)*\n`);
    fs.writeFileSync(good, `[a](${base}/ok)\n[r](${base}/root1)\n[d](${base}/deep/page)\n`);
    const r = await run([bad, good]);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, new RegExp(`^FAIL ${bad.replace(/[\\]/g, '\\\\')}:2: ${base}/missing: HTTP 404$`, 'm'));
    assert.match(r.stdout, /:3: .*dropped "x"/);
    assert.match(r.stdout, /^2 finding\(s\); 5 link\(s\) in 2 file\(s\), 5 fetched$/m);
    const ok = await run([good]);
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.match(ok.stdout, /^0 finding\(s\); 3 link\(s\) in 1 file\(s\), 3 fetched$/m);
    const skip = await run(['--skip-host=127.0.0.1', good]);
    assert.equal(skip.status, 0); assert.match(skip.stdout, /0 fetched, 3 skipped by host/);
    const missing = await run([path.join(dir, 'nope.md')]);
    assert.equal(missing.status, 1); assert.match(missing.stdout, /^FAIL .*nope\.md: cannot be read \(ENOENT\)$/m); assert.match(missing.stdout, /^1 finding\(s\)/m);
    assert.equal((await run(['--bogus', good])).status, 64); assert.equal((await run([])).status, 64);
    const h = await run(['-h']); assert.equal(h.status, 0); assert.match(h.stdout, /^usage:/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ---- 29e (b), CoalTipple 29d: the autolink alternative of the link regex was quadratic on a repeated <https:// run with no closing >. The
// witness counts the work the reader does (one count per position it visits and per character a run scan reads): no clock.
const OLD_extractLinks = (text) => {
  const out = [];
  let fenced = false;
  const lines = String(text).split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (/^\s*(```|~~~)/.test(raw)) { fenced = !fenced; continue; }
    if (fenced) continue;
    const line = raw.replace(/`[^`]*`/g, '`');
    for (const m of line.matchAll(/\]\((https?:\/\/[^\s)>]+)|<(https?:\/\/[^\s>]+)>|href=["'](https?:\/\/[^"']+)["']/g)) out.push({ url: m[1] || m[2] || m[3], line: i + 1, lineText: raw });
  }
  return out;
};
const simplify = (links) => links.map((l) => [l.url, l.line]);

test('the link reader does linear work on the repeated <https:// shapes: steps per character stay bounded, and doubling the text at most doubles the steps -- RED before 29e (b)', () => {
  const shapes = { repeatedAutolink: (n) => '<https://x'.repeat(n), openAutolink: (n) => '<https://' + 'a'.repeat(n) };
  for (const [name, make] of Object.entries(shapes)) {
    const at = (n) => { const c = { steps: 0 }; const text = make(n); extractLinks(text, c); return { chars: text.length, steps: c.steps }; };
    const small = at(1000), big = at(2000);
    assert.ok(big.steps > 0, `${name}: the reader counts its work`);
    assert.ok(big.steps / big.chars <= 6, `${name}: steps per character ${big.steps / big.chars}`);
    assert.ok(big.steps / small.steps <= 2.2, `${name}: doubling the text took ${big.steps / small.steps} times the steps`);
  }
});

test('positive control: a counted stand-in that rescans from every < is quadratic on the same shape, so the count tells the two apart', () => {
  const naive = (text) => {
    let steps = 0;
    for (let p = 0; p < text.length; p++) {
      if (text[p] !== '<') continue;
      let e = p + 1;
      while (e < text.length && !/[\s>]/.test(text[e])) { e++; steps++; }
    }
    return steps;
  };
  const a = naive('<https://x'.repeat(1000)), b = naive('<https://x'.repeat(2000));
  assert.ok(b / a >= 3, `doubling took ${b / a} times the steps`);
});

test('the one-pass reader returns the same links as the old alternation on every markdown file in this tree and on 3000 seeded texts -- the differential for 29e (b)', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const md = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.name.startsWith('.') || e.name === 'node_modules' ? [] : e.isDirectory() ? md(path.join(dir, e.name)) : e.name.endsWith('.md') ? [path.join(dir, e.name)] : []));
  const files = md(root);
  assert.ok(files.length > 0, 'the walk found the markdown');
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    assert.deepEqual(simplify(extractLinks(text)), simplify(OLD_extractLinks(text)), f);
  }
  let seed = 7;
  const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296; };
  const pieces = ['<', '>', 'https://', 'http://', 'x', ' ', '](', ')', 'href="', "href='", '"', "'", '`', '\n', '\t', '<https://a.b/c>', '](https://d.e)'];
  for (let i = 0; i < 3000; i++) {
    let s = '';
    const n = Math.floor(rnd() * 40);
    for (let j = 0; j < n; j++) s += pieces[Math.floor(rnd() * pieces.length)];
    assert.deepEqual(simplify(extractLinks(s)), simplify(OLD_extractLinks(s)), JSON.stringify(s));
  }
});

// ---- 2026-11-03a: the redirect chain honours the skip list, a control character never reaches a FAIL line raw, and a named file is read only as a
// regular file under a byte bound. Each was RED on the code before it.
test('checkFiles: a redirect into a skipped host is not followed -- that host is never fetched and the link counts as skipped -- RED before 2026-11-03a', async () => {
  const asked = [];
  const fake = async (u) => {
    const host = new URL(u).hostname;
    asked.push(host);
    return host === 'start.example' ? new Response(null, { status: 302, headers: { location: 'https://SKIP.example/landing' } }) : new Response('page', { status: 200 });
  };
  const r = await checkFiles([{ name: 'README.md', text: '[a](https://start.example/x)' }], { ...LONG, fetchFn: fake, skipHosts: ['skip.example'] });
  assert.deepEqual(asked, ['start.example'], 'the skipped host was never asked');
  assert.deepEqual(r.findings, []);
  assert.deepEqual(r.skipped, ['https://start.example/x']);
});

const CONTROL = (s) => Array.from(s).filter((ch) => { const c = ch.codePointAt(0); return (c < 0x20 && c !== 0x0a && c !== 0x0d) || (c >= 0x7f && c <= 0x9f) || c === 0x2028 || c === 0x2029; });

test('CLI: a control character in a link is written as its code point on the FAIL line, so no line can be forged or erased -- RED before 2026-11-03a', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fdl-'));
  try {
    const f = path.join(dir, 'README.md');
    // ESC [2K erases the terminal line, CSI (C1) does the same in one byte: both are built from code points, so no escape travels through a tool.
    fs.writeFileSync(f, `[a](${base}/missing${String.fromCharCode(0x1b)}[2K${String.fromCharCode(0x9b)}forged)\n`);
    const r = await run([f]);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.deepEqual(CONTROL(r.stdout), [], 'no raw control character on stdout');
    const bs = String.fromCharCode(92);
    assert.ok(r.stdout.includes(`${bs}u{1b}[2K${bs}u{9b}forged`), r.stdout);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('CLI: a named file past the byte bound, or one that is not a regular file, is a FAIL line, never read -- RED before 2026-11-03a', async () => {
  const bound = Number(/^const MAX_FILE_BYTES = ([0-9]+);/m.exec(fs.readFileSync(CLI, 'utf8'))?.[1]);
  assert.ok(bound > 0, 'the CLI states its byte bound');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fdl-'));
  try {
    const big = path.join(dir, 'README.md');
    fs.writeFileSync(big, 'x'.repeat(bound + 1));
    const r = await run([big, dir]);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    const lines = r.stdout.split(/\r?\n/);
    assert.ok(lines.some((l) => l.startsWith('FAIL ') && l.endsWith(`README.md: cannot be read (${bound + 1} bytes, past the byte bound of ${bound})`)), r.stdout);
    assert.match(r.stdout, /^FAIL .*: cannot be read \((not a regular file|EISDIR)\)$/m);
    assert.match(r.stdout, /^2 finding\(s\)/m);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// order 2026-11-03b: a named file is opened before any check of its name, a link is refused rather than followed, and a pipe never holds the open.
// The link and pipe legs need a file symlink and a real FIFO; each skips visibly where the account or the volume cannot make one, decided by PROBING the capability (AGENTS.md Hard-won lessons: never by process.platform).
test('CLI: a named file that is a symlink is refused, never followed -- RED before 2026-11-03b where a file symlink can be made', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fdl-'));
  try {
    fs.writeFileSync(path.join(dir, 'real.md'), `[a](${base}/ok)\n`);
    const link = path.join(dir, 'README.md');
    try { fs.symlinkSync(path.join(dir, 'real.md'), link, 'file'); } catch { t.skip('this account cannot make a file symlink here'); return; }
    const r = await run([link]);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.ok(r.stdout.split(/\r?\n/).some((l) => l.startsWith('FAIL ') && l.endsWith('README.md: cannot be read (not a regular file)')), r.stdout);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('CLI: a named file that is a pipe is refused at once, never waited on -- RED before 2026-11-03b where mkfifo exists', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fdl-'));
  try {
    const fifo = path.join(dir, 'README.md');
    const mk = spawnSync('mkfifo', [fifo], { timeout: 10000, env: childEnv() });
    // the probe: a mkfifo that runs AND leaves a real FIFO (Node's own lstat says so). A mkfifo of an emulation layer (Git Bash on Windows) answers 0 and leaves a plain file.
    if (mk.status !== 0 || !fs.lstatSync(fifo, { throwIfNoEntry: false })?.isFIFO()) { t.skip('this machine cannot make a real FIFO here (no mkfifo, or one that leaves no pipe)'); return; }
    const r = await run([fifo]);
    assert.equal(r.status, 1, 'the child ended on its own, refusing the pipe: ' + r.stdout + r.stderr);
    assert.ok(r.stdout.split(/\r?\n/).some((l) => l.startsWith('FAIL ') && l.endsWith('README.md: cannot be read (not a regular file)')), r.stdout);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// A file that grows after its size check: a preload makes fstat report 0 bytes for every regular file, standing in for a writer that appends after the
// check. The read itself must stop at the bound plus one byte; a read to the end of the file would take it all.
test('CLI: a named file that grows past the byte bound after its size check is a FAIL line: the read stops at the bound', async () => {
  const bound = Number(/^const MAX_FILE_BYTES = ([0-9]+);/m.exec(fs.readFileSync(CLI, 'utf8'))?.[1]);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fdl-'));
  try {
    const big = path.join(dir, 'README.md');
    fs.writeFileSync(big, 'x'.repeat(bound + 1));
    const preload = path.join(dir, 'size-zero.preload.mjs');
    fs.writeFileSync(preload, [
      "import fs from 'node:fs';",
      'const orig = fs.fstatSync;',
      "fs.fstatSync = function (...a) { const s = orig.apply(this, a); if (s.isFile()) Object.defineProperty(s, 'size', { value: 0 }); return s; };",
    ].join('\n'));
    const r = await run([big], { NODE_OPTIONS: '--import ' + pathToFileURL(preload).href });
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /^FAIL .*README\.md: cannot be read \(more than \d+ bytes by the read/m);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// The open lands on another regular file than the one the name holds (a swap between the open and the check, or a redirected open): the reader compares
// the descriptor with the name (dev and ino) and refuses before any read, the readChangelog shape. A preload opens an empty file for this one name.
test('CLI: a named file whose open lands on another file than its name holds is a FAIL line, never read', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fdl-'));
  try {
    fs.writeFileSync(path.join(dir, 'README.md'), '# x\n');
    fs.writeFileSync(path.join(dir, 'other.md'), '');
    const preload = path.join(dir, 'redirect.preload.mjs');
    fs.writeFileSync(preload, [
      "import fs from 'node:fs';",
      'const orig = fs.openSync;',
      "fs.openSync = function (p, ...rest) { return orig.call(this, String(p).endsWith('README.md') ? String(p).slice(0, -'README.md'.length) + 'other.md' : p, ...rest); };",
    ].join('\n'));
    const r = await run([path.join(dir, 'README.md')], { NODE_OPTIONS: '--import ' + pathToFileURL(preload).href });
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /^FAIL .*README\.md: cannot be read \(changed between the check and the read/m);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// 2026-11-16l: GitHub's incident of 2026-11-09 answered anonymous requests 504 for 4.7 minutes while "authenticated requests are unaffected"; the one retry after 2 s did not span it and 17 front-door links went red.
const apiStub = (web, api) => { const calls = []; return { calls, fetchFn: async (url, init) => { const u = String(url); calls.push({ u, auth: init.headers.authorization }); const s = u.startsWith('https://api.github.com/') ? api(u) : web(u); return { status: s, headers: { get: () => null }, body: null }; } }; };
const oneLink = (u) => [{ name: 'README.md', text: `[x](${u})\n` }];
test('checkFiles: a github.com repository or account link that stays 5xx is read through the REST API with the token, sent to the API host only; a 504 that persists stays a finding -- RED before 16l', async () => {
  let m = apiStub(() => 504, () => 200);
  let r = await checkFiles(oneLink('https://github.com/TheColliery/CoalMine'), { fetchFn: m.fetchFn, retryMs: 0, token: 'T-123' });
  assert.deepEqual(r.findings, [], 'the REST answer is the page answer');
  assert.deepEqual(m.calls.map((c) => c.u), ['https://github.com/TheColliery/CoalMine', 'https://github.com/TheColliery/CoalMine', 'https://api.github.com/repos/TheColliery/CoalMine']);
  assert.deepEqual(m.calls.map((c) => c.auth), [undefined, undefined, 'Bearer T-123'], 'the token reaches the API host only');
  m = apiStub(() => 504, () => 200);
  r = await checkFiles(oneLink('https://github.com/TheColliery'), { fetchFn: m.fetchFn, retryMs: 0, token: 'T-123' });
  assert.deepEqual(r.findings, []);
  assert.equal(m.calls[2].u, 'https://api.github.com/users/TheColliery', 'an account link asks /users/<name>, which answers for an organisation too');
  m = apiStub(() => 504, () => 404);
  r = await checkFiles(oneLink('https://github.com/TheColliery/Gone'), { fetchFn: m.fetchFn, retryMs: 0, token: 'T-123' });
  assert.match(r.findings[0].message, /HTTP 404/, 'a repository the API says is not there is a finding');
  for (const api of [() => 504, () => 403, () => 401]) {
    m = apiStub(() => 504, api);
    r = await checkFiles(oneLink('https://github.com/TheColliery/CoalMine'), { fetchFn: m.fetchFn, retryMs: 0, token: 'T-123' });
    assert.match(r.findings[0].message, /HTTP 504/, 'an API that does not answer 2xx or 404 leaves the 504 standing');
  }
  m = apiStub(() => 504, () => 200);
  // 23e: a blob link now has a REST twin (the contents API, tested below), so the deep page without one is an issue
  r = await checkFiles(oneLink('https://github.com/TheColliery/CoalMine/issues/1'), { fetchFn: m.fetchFn, retryMs: 0, token: 'T-123' });
  assert.match(r.findings[0].message, /HTTP 504/, 'a deep page has no REST twin here: its 504 stands');
  assert.ok(!m.calls.some((c) => c.u.startsWith('https://api.github.com/')), 'and the API is not asked');
  m = apiStub(() => 504, () => 200);
  r = await checkFiles(oneLink('https://github.com/TheColliery/CoalMine'), { fetchFn: m.fetchFn, retryMs: 0 });
  assert.match(r.findings[0].message, /HTTP 504/, 'with no token the behaviour is what it was');
  assert.ok(!m.calls.some((c) => c.u.startsWith('https://api.github.com/')));
  m = apiStub(() => 200, () => 500);
  r = await checkFiles(oneLink('https://github.com/TheColliery/CoalMine'), { fetchFn: m.fetchFn, retryMs: 0, token: 'T-123' });
  assert.deepEqual(r.findings, []);
  assert.equal(m.calls.length, 1, 'a page that answers is never asked of the API');
});

// 2026-11-16m: the two guards the review found untested (the host check, redirect:'manual') and the reserved routes -- each is killed by removing it
test('apiRouteOf and viaApi: only github.com itself is asked, the call never follows a redirect with the token, and a github.com product page is not an account or a repository -- RED before 16m (three survivors)', async () => {
  const { apiRouteOf } = await import('./lib/front-door-links.mjs');
  for (const u of ['https://gist.github.com/a/b', 'https://github.com.evil.example/a/b', 'https://example.com/a/b', 'https://api.github.com/repos/a/b', 'https://raw.githubusercontent.com/a/b']) assert.strictEqual(apiRouteOf(u), null, u);
  for (const u of ['https://github.com/pricing', 'https://github.com/sponsors/someone', 'https://github.com/orgs/TheColliery', 'https://github.com/topics/ai', 'https://github.com/Settings', 'https://github.com/features/actions']) assert.strictEqual(apiRouteOf(u), null, u);
  assert.strictEqual(apiRouteOf('https://github.com/TheColliery/CoalMine/'), '/repos/TheColliery/CoalMine', 'a repository link keeps its route, a trailing slash included');
  assert.strictEqual(apiRouteOf('https://github.com/TheColliery'), '/users/TheColliery');
  // through checkFiles: a link on a look-alike host or a product page never reaches the API, and the call that does carries redirect:'manual'
  const seen = [];
  const fetchFn = async (url, init) => { seen.push({ u: String(url), redirect: init.redirect, auth: init.headers.authorization }); return { status: String(url).startsWith('https://api.github.com/') ? 200 : 504, headers: { get: () => null }, body: null }; };
  for (const u of ['https://github.com.evil.example/a/b', 'https://github.com/pricing', 'https://github.com/sponsors/someone']) {
    seen.length = 0;
    const r = await checkFiles([{ name: 'R.md', text: `[x](${u})\n` }], { fetchFn, retryMs: 0, token: 'T-123' });
    assert.match(r.findings[0].message, /HTTP 504/, u);
    assert.ok(!seen.some((c) => c.u.startsWith('https://api.github.com/')), u + ' is not asked of the API');
  }
  seen.length = 0;
  await checkFiles([{ name: 'R.md', text: '[x](https://github.com/TheColliery/CoalMine)\n' }], { fetchFn, retryMs: 0, token: 'T-123' });
  const api = seen.find((c) => c.u.startsWith('https://api.github.com/'));
  assert.strictEqual(api.redirect, 'manual', 'the token is never sent along a redirect');
  assert.strictEqual(api.auth, 'Bearer T-123');
  assert.ok(seen.filter((c) => c !== api).every((c) => c.auth === undefined), 'the token goes to the API host only');
});

// 2026-11-17 (the m5 review): the list is ours and incomplete, a real organisation called community must keep its REST fallback, and the four routes the review named are reserved. Red-first: against the
// 16m list community is reserved and home, mcp, sitemap and status are not.
test('apiRouteOf: github.com/community is an organisation (asked of the API), and /home, /mcp, /sitemap and /status are product pages (not asked); the list says it is ours -- RED before 2026-11-17', async () => {
  const { apiRouteOf, RESERVED_ROUTES } = await import('./lib/front-door-links.mjs');
  assert.strictEqual(apiRouteOf('https://github.com/community'), '/users/community');
  assert.strictEqual(apiRouteOf('https://github.com/community/community'), '/repos/community/community');
  for (const u of ['https://github.com/home', 'https://github.com/mcp', 'https://github.com/sitemap', 'https://github.com/status', 'https://github.com/status/incidents']) assert.strictEqual(apiRouteOf(u), null, u);
  assert.ok(!RESERVED_ROUTES.has('community'));
  assert.match(fs.readFileSync(new URL('./lib/front-door-links.mjs', import.meta.url), 'utf8'), /THE LIST IS OURS AND INCOMPLETE/, 'the code says whose list it is');
});

// 2026-11-23e: run 45182146410 went red on 24 github.com/<owner>/<repo>/blob/<ref>/<path> links that answered 503 to the runner while every file was there
// (the re-run went green). A blob link that stays 5xx after the retry is now asked of the contents API, the same rails as the repository fallback.
test('checkFiles: a github.com blob link that stays 5xx is read through the contents API at its ref, with the token on the API host only -- RED before 23e', async () => {
  const { apiRouteOf } = await import('./lib/front-door-links.mjs');
  let m = apiStub(() => 503, () => 200);
  let r = await checkFiles(oneLink('https://github.com/TheColliery/.github/blob/main/benchmarks/CoalMine/RESULTS.md'), { fetchFn: m.fetchFn, retryMs: 0, token: 'T-123' });
  assert.deepEqual(r.findings, [], 'the contents answer is the page answer');
  assert.deepEqual(m.calls.map((c) => c.u), ['https://github.com/TheColliery/.github/blob/main/benchmarks/CoalMine/RESULTS.md', 'https://github.com/TheColliery/.github/blob/main/benchmarks/CoalMine/RESULTS.md',
    'https://api.github.com/repos/TheColliery/.github/contents/benchmarks/CoalMine/RESULTS.md?ref=main'], 'the ordinary check runs first, twice, then the API');
  assert.deepEqual(m.calls.map((c) => c.auth), [undefined, undefined, 'Bearer T-123'], 'the token reaches the API host only');
  m = apiStub(() => 503, () => 200);
  r = await checkFiles(oneLink('https://github.com/TheColliery/.github/blob/main/DOC-PATTERN.md#platform-tiers'), { fetchFn: m.fetchFn, retryMs: 0, token: 'T-123' });
  assert.deepEqual(r.findings, []);
  assert.equal(m.calls[2].u, 'https://api.github.com/repos/TheColliery/.github/contents/DOC-PATTERN.md?ref=main', 'the fragment is the page, not the file');
  assert.strictEqual(apiRouteOf('https://github.com/a/b/blob/main/docs/My%20File.md?plain=1'), '/repos/a/b/contents/docs/My%20File.md?ref=main', 'the path stays encoded, the page query is dropped');
  for (const u of ['https://github.com/a/b/blob/main', 'https://github.com/a/b/blob', 'https://github.com/pricing/b/blob/main/x.md']) assert.strictEqual(apiRouteOf(u), null, u + ' names no file');
});

test('checkFiles: a blob link to a missing file stays a finding: the contents API 404 is the answer, and a page that answers 404 is never asked of the API -- RED before 23e', async () => {
  let m = apiStub(() => 503, () => 404);
  let r = await checkFiles(oneLink('https://github.com/TheColliery/.github/blob/main/NO-SUCH-FILE.md'), { fetchFn: m.fetchFn, retryMs: 0, token: 'T-123' });
  assert.equal(r.findings.length, 1);
  assert.match(r.findings[0].message, /HTTP 404/, 'the file is not there');
  m = apiStub(() => 404, () => 200);
  r = await checkFiles(oneLink('https://github.com/TheColliery/.github/blob/main/NO-SUCH-FILE.md'), { fetchFn: m.fetchFn, retryMs: 0, token: 'T-123' });
  assert.match(r.findings[0].message, /HTTP 404/);
  assert.ok(!m.calls.some((c) => c.u.startsWith('https://api.github.com/')), 'a 404 is not transient, so the API is not asked');
});

// 27d (main's ruling on the 27b unit 3 study, the class "a link checker's verdict on an IMAGE a rendering service draws"): a badge image says nothing about
// the repository. shields.io answers 200 even for a repository that does not exist (measured 2026-11-27), so a badge can only fail this check on transport,
// and a slow badge host turned rooms red with nothing broken in them (CoalFace run 45917054673, CoalLedger 45924433003, this repo 44878552404). So an IMAGE
// destination whose host gives no answer, a 5xx or a 429 is a WARNING that does not fail the run; an image that answers 4xx, and every link, still fail it.
const timeoutsFor = (prefixes, table = {}) => async (url) => {
  const u = String(url);
  if (prefixes.some((h) => u.startsWith(h))) throw Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
  const status = Object.entries(table).find(([h]) => u.startsWith(h))?.[1] ?? 200;
  return { status, headers: { get: () => null }, body: null };
};
const BADGE = 'https://img.shields.io/github/v/tag/TheColliery/CoalLedger?label=version&color=blue';
test('extractLinks: an image destination is marked as one, a link is not, a badge wrapped in a link gives both -- RED before 27d', () => {
  const ls = extractLinks(`[![version](${BADGE})](https://github.com/TheColliery/CoalLedger/releases)\n![plain](https://img.example.test/a.png)\n[page](https://docs.example.test/p)\n`);
  assert.deepEqual(ls.map((l) => [l.url, l.image === true]), [
    [BADGE, true], ['https://github.com/TheColliery/CoalLedger/releases', false], ['https://img.example.test/a.png', true], ['https://docs.example.test/p', false],
  ]);
});
test('checkFiles: a badge IMAGE whose host times out is a warning, never a finding (the 27b witness) -- RED before 27d', async () => {
  const r = await checkFiles([{ name: 'README.md', text: `[![version](${BADGE})](https://github.com/TheColliery/CoalLedger/releases)\n` }], { fetchFn: timeoutsFor(['https://img.shields.io/']), retryMs: 0 });
  assert.deepEqual(r.findings, [], 'a slow badge host turned the run red');
  assert.equal(r.warnings.length, 1);
  assert.deepEqual([r.warnings[0].file, r.warnings[0].line, r.warnings[0].url], ['README.md', 1, BADGE]);
  assert.match(r.warnings[0].message, /no answer \(timeout\)/);
});
test('checkFiles: an image whose host answers 5xx or 429 after the retry is a warning; an image that answers 404 is still a finding -- RED before 27d', async () => {
  for (const status of [503, 504, 429]) {
    const r = await checkFiles([{ name: 'R.md', text: `![b](${BADGE})\n` }], { fetchFn: timeoutsFor([], { 'https://img.shields.io/': status }), retryMs: 0 });
    assert.deepEqual(r.findings, [], `an image answering ${status} is not a finding`);
    assert.equal(r.warnings.length, 1, `an image answering ${status} is a warning`);
  }
  const r404 = await checkFiles([{ name: 'R.md', text: `![b](${BADGE})\n` }], { fetchFn: timeoutsFor([], { 'https://img.shields.io/': 404 }), retryMs: 0 });
  assert.equal(r404.findings.length, 1);
  assert.match(r404.findings[0].message, /HTTP 404/);
  assert.deepEqual(r404.warnings, []);
});
test('checkFiles: a page LINK whose host times out or answers 503 is still a finding, the same URL as an image beside it notwithstanding -- kept by 27d', async () => {
  let r = await checkFiles([{ name: 'R.md', text: '[docs](https://docs.example.test/page)\n' }], { fetchFn: timeoutsFor(['https://docs.example.test/']), retryMs: 0 });
  assert.equal(r.findings.length, 1);
  assert.match(r.findings[0].message, /no answer \(timeout\)/);
  assert.deepEqual(r.warnings, []);
  r = await checkFiles([{ name: 'R.md', text: '![i](https://docs.example.test/x)\n[p](https://docs.example.test/x)\n' }], { fetchFn: timeoutsFor([], { 'https://docs.example.test/': 503 }), retryMs: 0 });
  assert.deepEqual(r.findings.map((f) => f.line), [2], 'the link fails; the image beside it at the same URL only warns');
  assert.deepEqual(r.warnings.map((w) => w.line), [1]);
});
test('CLI: an image warning is a WARN line, counted in the summary, and leaves the exit 0; a link at the same failing host still exits 1 -- RED before 27d', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fdl-'));
  try {
    const img = path.join(dir, 'README.md');
    fs.writeFileSync(img, `![badge](${base}/always-503)\n[a](${base}/ok)\n`);
    const r = await run([img]);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, new RegExp(`^WARN ${img.replace(/[\\]/g, '\\\\')}:1: ${base}/always-503: HTTP 503 \\(an image: its host's answer says nothing about this repository, so it does not fail the run\\)$`, 'm'));
    assert.match(r.stdout, /^0 finding\(s\), 1 warning\(s\); 2 link\(s\) in 1 file\(s\), 2 fetched$/m);
    const link = path.join(dir, 'SECURITY.md');
    fs.writeFileSync(link, `[page](${base}/always-503)\n`);
    const l = await run([link]);
    assert.equal(l.status, 1, l.stdout + l.stderr);
    assert.match(l.stdout, /^FAIL .*SECURITY\.md:1: .*\/always-503: HTTP 503$/m);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
// 27e (the umbrella auditor's 27f INSPECT of #249, findings 1, 2 and 5): only a host that times out, answers a 5xx or answers 429 makes an image a
// warning. A name that does not resolve, a refused connection or a bad certificate says the host is gone or broken, and the run fails on it.
const failsWith = (code) => async () => { throw Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error(code), { code }) }); };
test('checkFiles: an image whose host name does not resolve, refuses the connection or shows an expired certificate is a finding, never a warning -- RED before 27e', async () => {
  for (const code of ['ENOTFOUND', 'ECONNREFUSED', 'CERT_HAS_EXPIRED']) {
    const r = await checkFiles([{ name: 'R.md', text: `![b](${BADGE})\n` }], { fetchFn: failsWith(code), retryMs: 0 });
    assert.equal(r.findings.length, 1, `an image whose fetch fails with ${code} is a finding`);
    assert.match(r.findings[0].message, new RegExp(`no answer \\(${code}\\)`));
    assert.deepEqual(r.warnings, [], `an image whose fetch fails with ${code} is not a warning`);
  }
});
test('extractLinks: an escaped bang is text, so the link after it is a link, not an image; an escaped backslash before a bang leaves the image -- RED before 27e', () => {
  const ls = extractLinks('Read this\\![the guide](https://docs.example.test/guide)\nA path \\\\![b](https://img.example.test/b.png)\n');
  assert.deepEqual(ls.map((l) => [l.url, l.image === true]), [['https://docs.example.test/guide', false], ['https://img.example.test/b.png', true]]);
});
test('checkFiles: a link after an escaped bang whose host answers 503 is a finding (the auditor\'s P5) -- RED before 27e', async () => {
  const r = await checkFiles([{ name: 'R.md', text: 'Read this\\![the guide](https://docs.example.test/guide)\n' }], { fetchFn: timeoutsFor([], { 'https://docs.example.test/': 503 }), retryMs: 0 });
  assert.equal(r.findings.length, 1);
  assert.deepEqual(r.warnings, []);
});
test('CLI under GitHub Actions: each WARN line also goes out as a ::warning annotation naming the file and the line, its values escaped; outside Actions no annotation is printed -- RED before 27e', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fdl-'));
  try {
    const img = path.join(dir, 'a,b.md');
    fs.writeFileSync(img, `x\n![badge](${base}/always-503?q=%41)\n`);
    const esc = (s, prop) => { let o = s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A'); if (prop) o = o.replace(/:/g, '%3A').replace(/,/g, '%2C'); return o; };
    const r = await run([img], { GITHUB_ACTIONS: 'true' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const lines = r.stdout.split(/\r?\n/);
    const want = `::warning file=${esc(img, true)},line=2,title=front-door-links::${esc(`${base}/always-503?q=%41: HTTP 503 (an image: its host's answer says nothing about this repository, so it does not fail the run)`)}`;
    assert.ok(lines.includes(want), `missing the annotation line\n${want}\nin\n${r.stdout}`);
    assert.ok(lines.some((l) => l.startsWith('WARN ')), 'the WARN line stays');
    const plain = await run([img]);
    assert.equal(plain.status, 0, plain.stdout + plain.stderr);
    assert.ok(!plain.stdout.includes('::warning'), 'outside GitHub Actions no workflow command is printed');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
// 27g (the umbrella auditor's 27g attack on #249, LOW 1 to 3). LOW 1: a timeout reaches the engine under several names (the abort signal's own, undici's
// connect, headers and body timeouts, the system's ETIMEDOUT); each is the one cause the ruling names, so each makes an image a warning. A name that
// does not resolve right now (EAI_AGAIN) is not a timeout and still fails.
test('checkFiles: an image whose host times out under any of the timeout family\'s names is a warning; EAI_AGAIN is still a finding -- RED before 27g', async () => {
  for (const code of ['UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT', 'ETIMEDOUT']) {
    const r = await checkFiles([{ name: 'R.md', text: `![b](${BADGE})\n` }], { fetchFn: failsWith(code), retryMs: 0 });
    assert.deepEqual(r.findings, [], `an image whose fetch fails with ${code} is not a finding`);
    assert.equal(r.warnings.length, 1, `an image whose fetch fails with ${code} is a warning`);
    assert.match(r.warnings[0].message, new RegExp(`no answer \\(${code}\\)`));
  }
  const again = await checkFiles([{ name: 'R.md', text: `![b](${BADGE})\n` }], { fetchFn: failsWith('EAI_AGAIN'), retryMs: 0 });
  assert.equal(again.findings.length, 1, 'EAI_AGAIN is not a timeout');
  assert.deepEqual(again.warnings, []);
});
// LOW 2: the runner's older command parser reads `##[` ANYWHERE in a line (actions/runner ActionCommand.cs, TryParse), so a URL that holds it would turn a
// WARN or FAIL line into a legacy runner command. LOW 3: the annotation's data passes the same printable rule as the plain lines, so no control
// character reaches the log raw.
const BS = String.fromCharCode(92);
test('CLI: a URL holding ##[ never prints ##[ in a WARN, FAIL or ::warning line, and a control character in a URL never reaches the annotation raw -- RED before 27g', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fdl-'));
  try {
    const ESC = String.fromCharCode(27);
    const img = path.join(dir, 'README.md');
    fs.writeFileSync(img, `![b](${base}/always-503?x=##[error]legacy)\n![c](${base}/always-503?e=${ESC}x)\n[m](${base}/missing?y=##[error]gone)\n`);
    const r = await run([img], { GITHUB_ACTIONS: 'true' });
    assert.equal(r.status, 1, r.stdout + r.stderr);
    const lines = r.stdout.split(/\r?\n/);
    for (const l of lines) assert.ok(!l.includes('##['), `a line carries ##[: ${l}`);
    assert.ok(lines.some((l) => l.startsWith('WARN ') && l.includes(`#${BS}u{23}[error]legacy`)), 'the WARN line shows the broken mark');
    assert.ok(lines.some((l) => l.startsWith('FAIL ') && l.includes(`#${BS}u{23}[error]gone`)), 'the FAIL line shows the broken mark');
    const notes = lines.filter((l) => l.startsWith('::warning '));
    assert.equal(notes.length, 2, r.stdout);
    for (const l of notes) assert.ok(![...l].some((ch) => ch.charCodeAt(0) < 0x20 || ch.charCodeAt(0) === 0x7f), `a control character reached the annotation: ${JSON.stringify(l)}`);
    assert.ok(notes.some((l) => l.includes(`${BS}u{1b}x`)), 'the escape character is written as its code point');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
// 27i (the umbrella auditor's 27h LOW notes on #251). (a) Node's own connect timeout: when address-family selection has tried every address and holds no
// error, net.js destroys the socket with ERR_SOCKET_CONNECTION_TIMEOUT (lib/net.js on v22.x and v24.x, the auditor's reading), a timeout like the others. And
// the family is matched WHOLE: a code that only contains a family name is no timeout.
test('checkFiles: an image whose connect times out in Node\'s own address selection (ERR_SOCKET_CONNECTION_TIMEOUT) is a warning; a code that only CONTAINS a family name is a finding -- RED before 27i', async () => {
  const r = await checkFiles([{ name: 'R.md', text: `![b](${BADGE})\n` }], { fetchFn: failsWith('ERR_SOCKET_CONNECTION_TIMEOUT'), retryMs: 0 });
  assert.deepEqual(r.findings, [], 'ERR_SOCKET_CONNECTION_TIMEOUT is a timeout');
  assert.equal(r.warnings.length, 1);
  for (const near of ['XETIMEDOUT', 'ETIMEDOUT_X', 'UND_ERR_CONNECT_TIMEOUT_RETRY', 'timeouts']) {
    const n = await checkFiles([{ name: 'R.md', text: `![b](${BADGE})\n` }], { fetchFn: failsWith(near), retryMs: 0 });
    assert.equal(n.findings.length, 1, `${near} only contains a family name, so it is a finding`);
    assert.deepEqual(n.warnings, []);
  }
});
// (b) the annotation's file property passes printable too: a file whose name holds ##[ (Windows allows it) never prints the legacy mark on any line.
test('CLI under GitHub Actions: a front door whose file name holds ##[ never prints ##[, the annotation\'s file= included -- RED before 27i (pins printable on file=)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fdl-'));
  try {
    const odd = path.join(dir, 'x##[error]y.md');
    fs.writeFileSync(odd, `![b](${base}/always-503)\n`);
    const r = await run([odd], { GITHUB_ACTIONS: 'true' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const lines = r.stdout.split(/\r?\n/);
    for (const l of lines) assert.ok(!l.includes('##['), `a line carries ##[: ${l}`);
    const note = lines.find((l) => l.startsWith('::warning '));
    assert.ok(note, r.stdout);
    assert.ok(note.slice(0, note.indexOf('::', 2)).includes(`x#${BS}u{23}[error]y.md`), `the file property shows the broken mark: ${note}`);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
// 28a (the umbrella auditor's 27i LOW notes on #253). (1) The family is matched case-sensitively: the codes are the runtimes' own spellings, and a
// lower-case near miss is no timeout (its case-blind mutant, n4, survived the suite).
test('checkFiles: the timeout family is matched case-sensitively: etimedout is a finding, never a warning -- pins the case (the auditor\'s n4)', async () => {
  const r = await checkFiles([{ name: 'R.md', text: `![b](${BADGE})\n` }], { fetchFn: failsWith('etimedout'), retryMs: 0 });
  assert.equal(r.findings.length, 1, 'etimedout is not ETIMEDOUT');
  assert.deepEqual(r.warnings, []);
});
// (2) The order of printable and the property escape on the annotation's file= (its swapped mutant, f2, survived): printable first makes a control
// character a visible code point, and only then are `%`, `:` and `,` escaped. A unit test of the CLI's own helper, so no such file is needed on disk.
test('annotationFile: printable runs before the property escape: a newline in a file name is shown as its code point, then : , % are escaped -- RED before 28a', async () => {
  const { annotationFile, annotationData } = await import(pathToFileURL(CLI).href);
  const NL = String.fromCharCode(10);
  assert.equal(annotationFile(`a${NL}::error::x,y%.md`), `a${BS}u{a}%3A%3Aerror%3A%3Ax%2Cy%25.md`);
  assert.equal(annotationData(`u${NL}##[error]v%`), `u${BS}u{a}#${BS}u{23}[error]v%25`, 'the data: printable first, then %, CR and LF');
});
// 28a unit 3 (main's ruling on the auditor's 27h hole 5 and its 27i point A): under GitHub Actions the CLI prints its count as ONE notice of its own,
// `::notice title=front-door-links-count::N finding(s), M warning(s)`, before any warning, with BOTH numbers always (the summary line leaves the warnings
// part out at zero). Notices have their own budget of ten per step (actions/runner ExecutionContext.cs), so the count survives ten warnings, and the weekly
// watcher reads it from the run's annotations, never from the log.
test('CLI under GitHub Actions: exactly one count notice, both numbers always, printed before the first warning; outside Actions none -- RED before 28a', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fdl-'));
  try {
    const NOTICE = /^::notice title=front-door-links-count::(\d+) finding\(s\), (\d+) warning\(s\)$/;
    const mixed = path.join(dir, 'README.md');
    fs.writeFileSync(mixed, `![b](${base}/always-503)\n[m](${base}/missing)\n[o](${base}/ok)\n`);
    const r = await run([mixed], { GITHUB_ACTIONS: 'true' });
    assert.equal(r.status, 1, r.stdout + r.stderr);
    const lines = r.stdout.split(/\r?\n/);
    const notes = lines.filter((l) => l.startsWith('::notice '));
    assert.equal(notes.length, 1, r.stdout);
    assert.deepEqual(notes[0].match(NOTICE)?.slice(1), ['1', '1'], notes[0]);
    assert.ok(lines.indexOf(notes[0]) < lines.findIndex((l) => l.startsWith('::warning ')), 'the count comes before the warnings');
    // zero warnings: both numbers still printed; an unreadable file counts as a finding, as it does in the summary line
    const clean = path.join(dir, 'SECURITY.md');
    fs.writeFileSync(clean, `[o](${base}/ok)\n`);
    const z = await run([clean, path.join(dir, 'absent.md')], { GITHUB_ACTIONS: 'true' });
    assert.equal(z.status, 1, z.stdout + z.stderr);
    const zn = z.stdout.split(/\r?\n/).filter((l) => l.startsWith('::notice '));
    assert.deepEqual(zn.map((l) => l.match(NOTICE)?.slice(1)), [['1', '0']], z.stdout);
    const plain = await run([mixed]);
    assert.ok(!plain.stdout.includes('::notice'), 'outside GitHub Actions no workflow command is printed');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// 28c (the umbrella auditor's 28a findings 1 and 2 on #254): the entry-point guard never answers "not the entry" by failing. When the platform's realpath
// throws (a volume whose final path it cannot name), the check still runs and still fails loud; a run that read nothing and passed is the worst outcome
// this file has. And the realpath half is pinned: a CLI run through a folder link (a junction on Windows), without the preserve flags, still runs.
const runAt = (script, args, env = {}) => new Promise((resolve) => {
  const child = spawn(process.execPath, ['--max-old-space-size=512', script, ...args], { timeout: 60000, env: childEnv(env) });
  let stdout = ''; let stderr = '';
  child.stdout.on('data', (d) => { stdout += d; }); child.stderr.on('data', (d) => { stderr += d; });
  child.on('close', (status) => resolve({ status, stdout, stderr }));
});
test('CLI: when fs.realpathSync.native throws, the check still runs: it prints its summary line and exits by its findings -- RED before 28c (finding 1)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fdl-'));
  try {
    const preload = path.join(dir, 'realpath-throws.mjs');
    fs.writeFileSync(preload, "import fs from 'node:fs';" + String.fromCharCode(10) + "fs.realpathSync.native = () => { throw Object.assign(new Error('injected: no final path'), { code: 'EIO' }); };" + String.fromCharCode(10));
    const doc = path.join(dir, 'README.md');
    fs.writeFileSync(doc, `[m](${base}/missing)\n`);
    const r = await run([doc], { NODE_OPTIONS: '--import ' + pathToFileURL(preload).href });
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /^1 finding\(s\); 1 link\(s\) in 1 file\(s\), 1 fetched$/m, r.stdout + r.stderr);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('CLI: run through a folder link (a junction on Windows, a directory symlink elsewhere) without the preserve flags, the check still runs and prints its summary -- pins the realpath half (finding 2, the auditor\'s g2)', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fdl-'));
  const link = path.join(dir, 'scripts-link');
  try {
    try { fs.symlinkSync(path.dirname(CLI), link, 'junction'); } catch (e) { t.skip('this volume or account cannot make a folder link: ' + e.code); return; }
    const doc = path.join(dir, 'README.md');
    fs.writeFileSync(doc, `[m](${base}/missing)\n`);
    const r = await runAt(path.join(link, 'front-door-links.mjs'), [doc]);
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /^1 finding\(s\); 1 link\(s\) in 1 file\(s\), 1 fetched$/m, r.stdout + r.stderr);
  } finally { unlinkFolderLink(link); fs.rmSync(dir, { recursive: true, force: true }); }
});
// 28e (the umbrella auditor's 28b return, its finding 1 and LOW 1 to 3; main's ruling (a)): the guard takes the shape six scripts here already carry
// (e0eba02, 2026-11-16): realpath on both sides; if that throws, file identity; last, the plain paths. An import never runs the check.
// LOW 3: a folder link is removed by itself before its sandbox, so no recursive remove is ever asked to walk through it.
function unlinkFolderLink(link) {
  try { fs.rmdirSync(link); } catch { try { fs.unlinkSync(link); } catch { /* not there: the test skipped before making it */ } }
}
// An import of the CLI through `node -e`, as e0eba02's test imports the five scripts; awaited, since the server it might fetch from is this process's.
const importRun = (args) => new Promise((resolve) => {
  const child = spawn(process.execPath, ['--max-old-space-size=512', '--input-type=module', '-e', `await import(${JSON.stringify(pathToFileURL(CLI).href)})`, ...args], { timeout: 60000, cwd: os.tmpdir(), env: childEnv() });
  let out = '';
  child.stdout.on('data', (d) => { out += d; }); child.stderr.on('data', (d) => { out += d; });
  child.on('close', (status) => resolve({ status, out }));
});
test('CLI imported with an argv path that names no file does not run, even when a later argument is a markdown file: the guard asks file identity before it answers -- RED before 28e (finding 1, e0eba02\'s pin)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fdl-'));
  try {
    const doc = path.join(dir, 'README.md');
    fs.writeFileSync(doc, `[m](${base}/missing)\n`);
    const one = await importRun(['nosuchfile']);
    assert.deepEqual([one.status, one.out], [0, ''], 'the import ran the check: ' + one.out.slice(0, 160));
    const two = await importRun(['nosuchfile', doc]);
    assert.deepEqual([two.status, two.out], [0, ''], 'the import checked the importer\'s own file: ' + two.out.slice(0, 160));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('CLI imported from node -e with no argument does not run (LOW 1: the argv[1] line pinned, the auditor\'s m3)', async () => {
  const r = await importRun([]);
  assert.deepEqual([r.status, r.out], [0, '']);
});
test('CLI run through a folder link WITH --preserve-symlinks-main still runs: both sides go through realpath (LOW 2, the auditor\'s m7)', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fdl-'));
  const link = path.join(dir, 'scripts-link');
  try {
    try { fs.symlinkSync(path.dirname(CLI), link, 'junction'); } catch (e) { t.skip('this volume or account cannot make a folder link: ' + e.code); return; }
    const doc = path.join(dir, 'README.md');
    fs.writeFileSync(doc, `[m](${base}/missing)\n`);
    const r = await new Promise((resolve) => {
      const child = spawn(process.execPath, ['--max-old-space-size=512', '--preserve-symlinks-main', path.join(link, 'front-door-links.mjs'), doc], { timeout: 60000, env: childEnv() });
      let stdout = ''; let stderr = '';
      child.stdout.on('data', (d) => { stdout += d; }); child.stderr.on('data', (d) => { stderr += d; });
      child.on('close', (status) => resolve({ status, stdout, stderr }));
    });
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /^1 finding\(s\); 1 link\(s\) in 1 file\(s\), 1 fetched$/m, r.stdout + r.stderr);
  } finally { unlinkFolderLink(link); fs.rmSync(dir, { recursive: true, force: true }); }
});
// T-29sw-1 (CoalTipple's E1 at v1.8.16, a canon courier, 28l): apiRouteOf looked only at the hostname, so github.com:1/<owner>/<repo> got the same REST route as the
// default port, and the API's 200 cleared a link whose page can never be fetched (a fetch of that URL throws "bad port", so the page probe reads status 0). A link with an
// explicit non-default port has no REST twin: the page's own answer stands. WHATWG URL drops a default port (:443 on https), so port is empty for it.
test('apiRouteOf: a github.com URL with an explicit non-default port has no REST route; the default port, written out, still has one -- RED before 28l', async () => {
  const { apiRouteOf } = await import('./lib/front-door-links.mjs');
  for (const u of ['https://github.com:1/TheColliery/CoalMine', 'https://github.com:8080/TheColliery', 'https://github.com:1/a/b/blob/main/x.md', 'https://github.com:65535/TheColliery/CoalMine/']) {
    assert.strictEqual(apiRouteOf(u), null, u);
  }
  assert.strictEqual(apiRouteOf('https://github.com:443/TheColliery/CoalMine'), '/repos/TheColliery/CoalMine', 'the default port, written out, is the same page');
  assert.strictEqual(apiRouteOf('https://github.com/TheColliery/CoalMine'), '/repos/TheColliery/CoalMine');
  assert.strictEqual(apiRouteOf('https://github.com:443/a/b/blob/main/x.md'), '/repos/a/b/contents/x.md?ref=main');
});

test('checkFiles: a github.com link on a non-default port that stays 5xx is never asked of the API, and stays a finding -- RED before 28l', async () => {
  const m = apiStub(() => 503, () => 200);
  const r = await checkFiles(oneLink('https://github.com:1/TheColliery/CoalMine'), { fetchFn: m.fetchFn, retryMs: 0, token: 'T-123' });
  assert.equal(r.findings.length, 1, JSON.stringify(r.findings));
  assert.ok(!m.calls.some((c) => c.u.startsWith('https://api.github.com/')), 'no API call for a page that cannot be fetched');
  assert.ok(!m.calls.some((c) => c.auth), 'the token was not used');
});
