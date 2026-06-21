#!/usr/bin/env node
// score.mjs — objective scorer for the output-quality benchmark (see README.md / TASKS.md).
// Auto-scores what is mechanically checkable (T1 crypto, T5 fact-checklist); prints the rubric for the
// judgment tasks (T2 proof, T3 research, T4 legal) so a strong judge can score them — the cheap main can't.
// Zero-dep: Node built-ins only. Usage:
//   node score.mjs T1 <path/to/hmacVerify.(m)js>   crypto: functional vectors + constant-time static check
//   node score.mjs T5 <path/to/rewrite.txt>        voice: the 4-fact checklist (+ sentence-count)
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

const RUBRICS = {
  T2: 'T2 proof (judge): (1) states the bound C + r*T; (2) argues admitted <= consumed <= (available at start, <= C) + (refilled in T, = r*T), each <= justified; (3) handles starts-full + continuous refill. PASS iff the bound is correct AND the accumulation step AND the boundary are justified, not asserted.',
  T3: 'T3 research (judge, with web): (1) the stated default + mechanism + Node version match the official Node.js docs (verify NOW); (2) an authoritative citation (nodejs.org), not a blog or memory. PASS iff current-correct AND authoritatively sourced — an unsourced answer is FAIL even if it happens to be right.',
  T4: 'T4 legal (judge): each term of art correct (indemnify; hold harmless; arising out of; to the extent; gross negligence — NOT plain negligence; willful misconduct) AND the exception scoped ONLY to the Licensor\'s gross negligence / willful misconduct and only "to the extent". PASS iff every term AND the exception scope are preserved.',
};

if (task === 'T1') await scoreT1(file);
else if (task === 'T5') scoreT5(file);
else if (RUBRICS[task]) console.log(RUBRICS[task]);
else { console.error('usage: node score.mjs <T1 file | T2 | T3 | T4 | T5 file>'); process.exit(1); }
