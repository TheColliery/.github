#!/usr/bin/env node
// score.mjs — objective scorer for the output-quality benchmark (see README.md / TASKS.md).
// Auto-scores what is mechanically checkable (T1 crypto, T5 fact-checklist); prints the rubric for the
// judgment tasks (T2 proof, T3 research, T4 legal) so a strong judge can score them — the cheap main can't.
// Zero-dep: Node built-ins only. Usage:
//   node score.mjs T1 <path/to/hmacVerify.(m)js>   crypto: functional vectors + constant-time static check
//   node score.mjs T5 <path/to/rewrite.txt>        voice: the 4-fact checklist (+ sentence-count)
//   node score.mjs M1 <path/to/store.(c)js>        scaffold: 15 CRUD exports + throw/JSDoc static check
//   node score.mjs T2 | T3 | T4                    print the rubric (a strong judge scores it)
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const [task, file] = process.argv.slice(2);
const need = (f) => { if (!f) { console.error(`usage: node score.mjs ${task} <file>`); process.exit(1); } return f; };
const readOrDie = (f) => { try { return fs.readFileSync(need(f), 'utf8'); } catch (e) { console.error(`cannot read ${f}: ${e.message}`); process.exit(1); } };

// Import the candidate + run the three HMAC vectors in a SEPARATE node process,
// returning only booleans. Keeps any module-level code in the submission OUT of
// the scorer's own process. The child code touches no fs/net — it only imports
// the submission (by file URL) and prints the three results as JSON.
function runVectorsIsolated(absFile, v) {
  const child = [
    'const u = process.argv[1], v = JSON.parse(process.argv[2]);',
    'const out = (o) => { process.stdout.write(JSON.stringify(o)); };',
    'try {',
    '  const m = await import(u);',
    '  const fn = m.hmacVerify || (m.default && (m.default.hmacVerify || m.default)) || (typeof m === "function" ? m : null);',
    '  if (typeof fn !== "function") { out({ error: "no hmacVerify export found" }); }',
    '  else {',
    '    const r = (k, msg, t) => { try { return fn(k, msg, t) === true; } catch { return null; } };',
    '    out({ valid: r(v.key, v.msg, v.tag), tampered: r(v.key, v.msg, v.flip), short: r(v.key, v.msg, v.short) });',
    '  }',
    '} catch (e) { out({ error: "cannot import (" + e.message + ")" }); }',
  ].join('\n');
  const res = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', child, pathToFileURL(absFile).href, JSON.stringify(v)],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10_000 },
  );
  if (res.error) return { error: `cannot run probe (${res.error.message})` };
  if (res.status !== 0 && !res.stdout) return { error: `probe exited ${res.status}: ${(res.stderr || '').trim() || 'no output'}` };
  try { return JSON.parse(res.stdout); } catch { return { error: `probe gave no parseable result: ${(res.stdout || res.stderr || '').trim()}` }; }
}

// Strip comments + string/template literals so a `timingSafeEqual` (or a forbidden compare) that lives only
// in a COMMENT or a STRING can never satisfy / trip a code check. Returns code-only text (literals blanked,
// length preserved roughly) for the static analysis below.
function stripCommentsAndStrings(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  let state = 'code'; // code | line | block | sq | dq | tpl
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (state === 'code') {
      if (c === '/' && d === '/') { state = 'line'; i += 2; continue; }
      if (c === '/' && d === '*') { state = 'block'; i += 2; continue; }
      if (c === "'") { state = 'sq'; i++; continue; }
      if (c === '"') { state = 'dq'; i++; continue; }
      if (c === '`') { state = 'tpl'; i++; continue; }
      out += c; i++; continue;
    }
    if (state === 'line') { if (c === '\n') { state = 'code'; out += c; } i++; continue; }
    if (state === 'block') { if (c === '*' && d === '/') { state = 'code'; i += 2; } else { if (c === '\n') out += c; i++; } continue; }
    // inside a string/template: blank the content, honour escapes, keep newlines
    if (c === '\\') { i += 2; continue; }
    if (state === 'sq' && c === "'") { state = 'code'; i++; continue; }
    if (state === 'dq' && c === '"') { state = 'code'; i++; continue; }
    if (state === 'tpl' && c === '`') { state = 'code'; i++; continue; }
    if (c === '\n') out += c;
    i++;
  }
  return out;
}

// Real data-flow / structural check (not string-presence): the tag comparison on the return path must be
// crypto.timingSafeEqual on the digest+tag, and must NOT use ===/==/!==/!=, indexOf, localeCompare, or
// Buffer.compare on the digest/tag (TASKS.md gold). Operates on COMMENT/STRING-STRIPPED code so a
// `timingSafeEqual` mention in a comment is worthless and a `got === tag` in code is caught.
function staticCryptoCheck(src) {
  const code = stripCommentsAndStrings(src);
  const fail = [];

  // timingSafeEqual must be actually CALLED in code (presence-in-comment no longer counts).
  const calledTimingSafe = /timingSafeEqual\s*\(/.test(code);
  if (!calledTimingSafe) fail.push('no crypto.timingSafeEqual(...) call on the comparison path');

  // Track identifiers assigned from a `.digest(` expression (the computed HMAC) — the "tainted" digest vars.
  const digestVars = new Set();
  const declRe = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*[^;\n]*\.digest\s*\(/g;
  let m;
  while ((m = declRe.exec(code))) digestVars.add(m[1]);

  // Forbidden tag comparisons anywhere in code:
  // (a) ===/==/!==/!= where one side is a `.digest(` expression directly,
  if (/\.digest\s*\([^)]*\)\s*[!=]==?/.test(code) || /[!=]==?\s*[\w.$]*\.digest\s*\(/.test(code)) {
    fail.push('raw equality on a .digest(...) expression = timing leak');
  }
  // (b) ===/==/!==/!= between a digest-derived var (as a VALUE) and any operand — the var-stored naive
  // compare H3 misses. A `.length`/`.byteLength` accessor is a legitimate length GUARD, not a value
  // compare, so the negative-lookahead excludes `got.length !== tag.length` (the old false-positive).
  const notLen = '(?!\\s*\\.\\s*(?:length|byteLength)\\b)';
  for (const v of digestVars) {
    const vEsc = v.replace(/[$]/g, '\\$&');
    if (new RegExp(`\\b${vEsc}\\b${notLen}\\s*[!=]==?`).test(code) ||
        new RegExp(`[!=]==?\\s*\\b${vEsc}\\b${notLen}`).test(code)) {
      fail.push(`raw equality on digest-derived '${v}' = timing leak`);
    }
    // (c) indexOf / localeCompare / Buffer.compare touching the digest var.
    if (new RegExp(`\\b${vEsc}\\b\\s*\\.\\s*(indexOf|localeCompare)\\s*\\(`).test(code) ||
        new RegExp(`\\.(indexOf|localeCompare)\\s*\\(\\s*${vEsc}\\b`).test(code) ||
        new RegExp(`Buffer\\s*\\.\\s*compare\\s*\\([^)]*\\b${vEsc}\\b`).test(code)) {
      fail.push(`indexOf/localeCompare/Buffer.compare on digest-derived '${v}' = non-constant-time compare`);
    }
  }
  // (d) indexOf/localeCompare directly on a .digest(...) result.
  if (/\.digest\s*\([^)]*\)\s*\.\s*(indexOf|localeCompare)\s*\(/.test(code)) {
    fail.push('indexOf/localeCompare on a .digest(...) result = non-constant-time compare');
  }

  return { pass: fail.length === 0 && calledTimingSafe, calledTimingSafe, fail };
}

async function scoreT1(file) {
  const src = readOrDie(file);
  // static signals — a REAL data-flow check (see staticCryptoCheck): timingSafeEqual must be CALLED on the
  // comparison path and no ===/==/!==/!= · indexOf · localeCompare · Buffer.compare may touch the digest/tag.
  // A `timingSafeEqual` that appears only in a comment/string does NOT satisfy the gate.
  const crypGate = staticCryptoCheck(src);
  // functional vectors
  const key = 'benchmark-secret-key', msg = 'the quick brown fox';
  const tag = crypto.createHmac('sha256', key).update(msg).digest('hex');
  const flip = tag.slice(0, -1) + (tag.slice(-1) === 'a' ? 'b' : 'a');
  const short = tag.slice(0, 32);
  // Run the candidate's hmacVerify in an ISOLATED CHILD PROCESS, never via a
  // top-level `await import()` in THIS process — a dynamic import executes the
  // submission's module-level code in the scorer (arbitrary-code-execution).
  // The child imports the submission, runs the three vectors, and prints ONLY
  // the boolean results as JSON; the scorer reads that output as DATA. The child
  // gets no stdin and a minimal env so the submission has nothing to lean on.
  const probe = runVectorsIsolated(path.resolve(file), { key, msg, tag, flip, short });
  let functional = true; const notes = [];
  if (probe.error) { console.log(`T1 crypto: FAIL — ${probe.error}`); process.exit(1); }
  if (probe.valid !== true)    { functional = false; notes.push('valid tag not accepted'); }
  if (probe.tampered !== false) { functional = false; notes.push('tampered tag not rejected'); }
  if (probe.short !== false)    { functional = false; notes.push('wrong-length tag not rejected (or threw)'); }
  // Constant-time gate: a CALLED timingSafeEqual on the digest/tag AND no forbidden compare on the return
  // path (a timingSafeEqual sitting only in a comment/decoration fails — staticCryptoCheck strips those).
  const pass = functional && crypGate.pass;
  console.log(`T1 crypto: ${pass ? 'PASS' : 'FAIL'}`);
  console.log(`  functional vectors : ${functional ? 'ok' : 'FAIL — ' + notes.join('; ')}`);
  console.log(`  constant-time      : ${crypGate.calledTimingSafe ? 'crypto.timingSafeEqual called' : 'MISSING a crypto.timingSafeEqual call = the timing-leak failure'}`);
  for (const reason of crypGate.fail) console.log(`  FAIL               : ${reason}`);
  if (!pass) process.exit(1);
}

function scoreT5(file) {
  const t = readOrDie(file);
  const facts = [
    { name: '10,000 events/sec', re: /10[,.]?000/ },
    { name: '99.9% uptime',      re: /99\.9\s*%/ },
    { name: '30-day money-back', re: /30[-\s]?day/i },
    { name: '50+ tools',         re: /\b50\+?\s*tools?\b/i },
  ];
  let all = true;
  console.log('T5 voice — fact checklist:');
  for (const f of facts) { const ok = f.re.test(t); if (!ok) all = false; console.log(`  ${ok ? 'ok     ' : 'MISSING'} ${f.name}`); }
  // Strip decimal numbers (e.g. "99.9%", "1.5k") before splitting on "." so
  // they don't inflate the sentence count.
  const sentences = t.replace(/\d+\.\d+/g, (m) => m.replace('.', '\x00')).split(/[.!?]+/).filter((s) => s.trim()).length;
  console.log(`  sentences: ${sentences} ${sentences <= 2 ? '(ok, <=2)' : '(OVER 2 — voice constraint broken)'}`);
  console.log(`  => facts ${all ? 'all present + exact' : 'INCOMPLETE'}; voice (terse / no marketing adjective) = judge manually`);
  if (!all) process.exit(1);
}

// The 15 expected CRUD exports: {create,get,list,update,delete} x {User,Product,Order}.
const M1_EXPORTS = [
  'createUser', 'getUser', 'listUsers', 'updateUser', 'deleteUser',
  'createProduct', 'getProduct', 'listProducts', 'updateProduct', 'deleteProduct',
  'createOrder', 'getOrder', 'listOrders', 'updateOrder', 'deleteOrder',
];

// Import the candidate in a SEPARATE node process (same isolation as runVectorsIsolated — never a top-level
// await import() in the scorer, arbitrary-code-execution risk) and report which of the 15 names resolve to a
// function. Handles CJS (.cjs/.js) — import() of a CommonJS module surfaces its exports on the namespace and
// on .default. The child touches no fs/net; it prints ONLY {present:[...], missing:[...]} as JSON.
function runExportsIsolated(absFile, names) {
  const child = [
    'const u = process.argv[1], names = JSON.parse(process.argv[2]);',
    'const out = (o) => { process.stdout.write(JSON.stringify(o)); };',
    'try {',
    '  const m = await import(u);',
    '  const src = (m && typeof m === "object" && m.default && typeof m.default === "object") ? m.default : m;',
    '  const has = (n) => typeof (src && src[n]) === "function" || typeof (m && m[n]) === "function";',
    '  const present = names.filter(has), missing = names.filter((n) => !has(n));',
    '  const fn = (n) => (src && typeof src[n] === "function") ? src[n] : m[n];',
    '  const throwsOn = (n, ...args) => { try { fn(n)(...args); return false; } catch (e) { return e instanceof TypeError; } };',
    '  const validates = present.includes("createUser") && present.includes("getUser")',
    '    ? (throwsOn("createUser", null) || throwsOn("getUser", null)) : false;',
    '  out({ present, missing, validates });',
    '} catch (e) { out({ error: "cannot import (" + e.message + ")" }); }',
  ].join('\n');
  const res = spawnSync(
    process.execPath,
    ['--input-type=module', '-e', child, pathToFileURL(absFile).href, JSON.stringify(names)],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10_000 },
  );
  if (res.error) return { error: `cannot run probe (${res.error.message})` };
  if (res.status !== 0 && !res.stdout) return { error: `probe exited ${res.status}: ${(res.stderr || '').trim() || 'no output'}` };
  try { return JSON.parse(res.stdout); } catch { return { error: `probe gave no parseable result: ${(res.stdout || res.stderr || '').trim()}` }; }
}

async function scoreM1(file) {
  const src = readOrDie(file);
  // Runtime: which of the 15 named exports resolve to a function (isolated child — the submission's
  // module-level code never runs in the scorer's process).
  const probe = runExportsIsolated(path.resolve(file), M1_EXPORTS);
  if (probe.error) { console.log(`M1 scaffold: FAIL — ${probe.error}`); process.exit(1); }
  const present = new Set(probe.present || []);

  // Static: count throws (validation proxy) and JSDoc-preceded function definitions, on COMMENT/STRING-
  // STRIPPED code so a `throw` inside a comment/string never counts. The JSDoc check runs on the RAW source
  // (we need the /** */ blocks) but pairs each block to a nearby function keyword.
  const code = stripCommentsAndStrings(src);
  const throwCount = (code.match(/\bthrow\b/g) || []).length;

  // JSDoc coverage: count named functions whose definition is preceded (within ~3 lines) by a /** ... */
  // block. Match each expected export's definition site (function decl OR an assigned function/arrow) and
  // check the text just above it for a JSDoc close `*/`. Simple line-window scan — no AST, zero-dep.
  const rawLines = src.split(/\r?\n/);
  const isDefLine = (line, name) => {
    const n = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\bfunction\\s+${n}\\b`).test(line) ||          // function createUser(
           new RegExp(`\\b${n}\\s*[:=]\\s*(async\\s+)?function\\b`).test(line) || // createUser = function / createUser: function
           new RegExp(`\\b${n}\\s*[:=]\\s*(async\\s+)?\\([^)]*\\)\\s*=>`).test(line) || // createUser = (a) =>
           new RegExp(`\\b${n}\\s*\\([^)]*\\)\\s*\\{`).test(line);      // createUser(a) {   (method shorthand)
  };
  let jsdocCount = 0;
  const seen = new Set();
  for (let i = 0; i < rawLines.length; i++) {
    for (const name of M1_EXPORTS) {
      if (seen.has(name)) continue;
      if (!isDefLine(rawLines[i], name)) continue;
      // look back up to 3 non-blank lines for a JSDoc close `*/`
      let has = false;
      for (let j = i - 1, budget = 3; j >= 0 && budget > 0; j--) {
        const t = rawLines[j].trim();
        if (t === '') continue;
        budget--;
        if (t.endsWith('*/')) { has = true; break; }
        if (!t.startsWith('*') && !t.startsWith('/*')) break; // hit real code before a JSDoc → none
      }
      if (has) jsdocCount++;
      seen.add(name);
    }
  }

  const presentCount = present.size;
  const okPresent = presentCount >= 14;
  // Validation proxy: the module must actually throw on bad input somewhere. A CORRECT DRY answer factors
  // validation into shared helpers (reqId/reqObj) — so a "one throw per function" rule would punish the good
  // scaffold. Require throws present AND scaled to the scaffold (>= present/3 covers both a per-function and a
  // helper-based style) rather than a literal 14-per-function count.
  // Behavioral first (the child called createUser(null)/getUser(null) and saw a TypeError) — a maximally
  // DRY answer routes every check through ONE assert helper (1 literal throw), which a static count punishes.
  // The static scaled count stays as the fallback for shapes the behavioral probe cannot reach.
  const okThrows = probe.validates === true || throwCount >= Math.max(3, Math.ceil(presentCount / 3));
  const okJsdoc = jsdocCount >= 12;
  const pass = okPresent && okThrows && okJsdoc;
  console.log(`M1 scaffold: ${pass ? 'PASS' : 'FAIL'}`);
  console.log(`  exports (function-typed) : ${presentCount}/15 ${okPresent ? 'ok (>=14)' : 'FAIL (<14)'}${(probe.missing && probe.missing.length) ? ' — missing: ' + probe.missing.join(', ') : ''}`);
  console.log(`  validation               : behavioral=${probe.validates === true ? 'TypeError on bad input' : 'none'} · static throws=${throwCount} ${okThrows ? '— ok' : '— FAIL (no arg validation)'}`);
  console.log(`  JSDoc-preceded functions : ${jsdocCount}/15 ${okJsdoc ? 'ok (>=12)' : 'FAIL (<12)'}`);
  if (!pass) process.exit(1);
}

const RUBRICS = {
  T2: 'T2 proof (judge): (1) states the bound C + r*T; (2) argues admitted <= consumed <= (available at start, <= C) + (refilled in T, = r*T), each <= justified; (3) handles starts-full + continuous refill. PASS iff the bound is correct AND the accumulation step AND the boundary are justified, not asserted.',
  T3: 'T3 research (judge, with web): (1) the stated default + mechanism + Node version match the official Node.js docs (verify NOW); (2) an authoritative citation (nodejs.org), not a blog or memory. PASS iff current-correct AND authoritatively sourced — an unsourced answer is FAIL even if it happens to be right.',
  T4: 'T4 legal (judge): each term of art correct (indemnify; hold harmless; arising out of; to the extent; gross negligence — NOT plain negligence; willful misconduct) AND the exception scoped ONLY to the Licensor\'s gross negligence / willful misconduct and only "to the extent". PASS iff every term AND the exception scope are preserved.',
};

if (task === 'T1') await scoreT1(file);
else if (task === 'T5') scoreT5(file);
else if (task === 'M1') await scoreM1(file);
else if (RUBRICS[task]) console.log(RUBRICS[task]);
else { console.error('usage: node score.mjs <T1 file | T2 | T3 | T4 | T5 file | M1 file>'); process.exit(1); }
