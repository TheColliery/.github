// THE CANON CHILD-ENV CENSUS (UMB3-193 round 5, 2026-11-09; main's ruling on CodeRabbit's three cries in one review, CoalWash t326: a cry a deterministic check catches the same
// way becomes a CI gate, common/code-review.md "Outside patrols"). The rule: a TEST that starts a child process must not hand the child the REAL environment. A child that inherits
// the operator's HOME, USERPROFILE, TEMP, TMP and TMPDIR can read and write the operator's profile and temp folder, and a fixture that does so is one typo from a real write. So in
// a test file (scripts/**/*.test.mjs) a spawner called with an options object whose `env` is
//   - `process.env` whole                                                    -> finding "whole"
//   - a copy of it (`{ ...process.env, X }`, Object.assign({}, process.env, ...)) that does not
//     set ALL of HOME, USERPROFILE, TEMP, TMP and TMPDIR                      -> finding "spread"
//   - a literal that sets HOME or USERPROFILE but not all of TEMP, TMP, TMPDIR -> finding "partial"
// is a finding. It is a TOKEN census on the canon's own lexer (git-env-census.mjs, which it imports; a room that adopts this file adopts that one too), in the same shape: the
// files are passed in, the pins are the ROOM's (scanChildEnv(files, pins)), a pin is { rel, blob, why } and holds only while the file's git blob id is the pinned one, so an edit
// to a pinned file spends the pin and the file is read again. A ratchet, not a no-exception gate: a room that already holds instances pins them and fixes them room by room; a
// tree that holds none (the canon) pins nothing. SPAWNERS are spawn, spawnSync, execFile, execFileSync, fork, exec, execSync called bare (imported from child_process by name)
// or as a member of a child_process namespace; HELPERS are the canon's `env`-taking helpers (runWaves, runSuite), called bare or as a member.
//
// THE NAMED CEILING (it errs toward "unread", which is counted and listed, never toward a silent pass):
//   1. an `env` that is a name defined elsewhere (a parameter, an import, a getter) or a call to a helper defined elsewhere is `unread`: counted, not a finding;
//   2. a spawn with NO `env` option (or options held in a variable the census cannot resolve to one literal) inherits the real environment too, and is not counted here: the rule
//      names the explicit `env: process.env` and the half-sandbox, which a reviewer can see in the line;
//   3. an identifier or a helper is resolved WITHIN the file, one declaration, a few hops; a name declared twice is `unread`;
//   4. the lexer is git-env-census.mjs's, with its own ceiling (regex against division, templates); this census reads the same tokens and inherits it.
import { lex, gitBlobId } from './git-env-census.mjs';

export const SPAWNERS = new Set(['spawn', 'spawnSync', 'execFile', 'execFileSync', 'fork', 'exec', 'execSync']);
export const HELPERS = new Set(['runWaves', 'runSuite']);
export const SANDBOX_KEYS = ['HOME', 'USERPROFILE', 'TEMP', 'TMP', 'TMPDIR'];
const CP = new Set(['child_process', 'node:child_process']);
const OPEN = new Set(['(', '[', '{']);
const CLOSE = new Set([')', ']', '}']);
const MAX_HOPS = 3;

const isP = (t, v) => t && t.k === 'p' && t.v === v;
const isId = (t, v) => t && t.k === 'id' && (v === undefined || t.v === v);
const opens = (t) => t && (t.k === 'tplopen' || (t.k === 'p' && OPEN.has(t.v)));
const closes = (t) => t && (t.k === 'tplclose' || (t.k === 'p' && CLOSE.has(t.v)));

// The index of the token that closes the opener at toks[i], or -1.
function matching(toks, i) {
  let d = 0;
  for (let j = i; j < toks.length; j++) {
    if (opens(toks[j])) d++;
    else if (closes(toks[j])) { d--; if (d === 0) return j; }
  }
  return -1;
}

// Names bound to child_process in this file: { named: Set of local names that ARE a spawner, ns: Set of local names of the module itself }.
function cpBindings(toks) {
  const named = new Set();
  const ns = new Set();
  toks.forEach((t, i) => {
    if (t.k !== 'str' || !CP.has(t.v)) return;
    // import ... from 'child_process'
    if (isId(toks[i - 1], 'from')) {
      let s = i - 2;
      while (s >= 0 && !isId(toks[s], 'import')) s--;
      if (s < 0) return;
      let k = s + 1;
      while (k < i - 1) {
        if (isP(toks[k], '{')) {
          const e = matching(toks, k);
          for (let m = k + 1; m < e; m++) {
            if (!isId(toks[m])) continue;
            const imported = toks[m].v;
            const local = isId(toks[m + 1], 'as') && isId(toks[m + 2]) ? toks[m + 2].v : imported;
            if (SPAWNERS.has(imported)) named.add(local);
            if (isId(toks[m + 1], 'as')) m += 2;
          }
          k = e + 1;
        } else if (isP(toks[k], '*') && isId(toks[k + 1], 'as') && isId(toks[k + 2])) { ns.add(toks[k + 2].v); k += 3; }
        else if (isId(toks[k]) && !isP(toks[k + 1], ',') ) { ns.add(toks[k].v); k++; }
        else k++;
      }
      return;
    }
    // const x = require('child_process'), const { a } = require(...), const { a } = await import(...)
    const call = isP(toks[i - 1], '(') ? toks[i - 2] : null;
    if (call && isId(call) && (call.v === 'require' || call.v === 'import')) {
      let s = i - 3;
      while (s >= 0 && i - s < 12 && !(isId(toks[s]) && ['const', 'let', 'var'].includes(toks[s].v))) s--;
      if (s < 0 || i - s >= 12) return;
      if (isP(toks[s + 1], '{')) {
        const e = matching(toks, s + 1);
        for (let m = s + 2; m < e; m++) {
          if (!isId(toks[m])) continue;
          const imported = toks[m].v;
          const local = isP(toks[m + 1], ':') && isId(toks[m + 2]) ? toks[m + 2].v : imported;
          if (SPAWNERS.has(imported)) named.add(local);
          if (isP(toks[m + 1], ':')) m += 2;
        }
      } else if (isId(toks[s + 1])) ns.add(toks[s + 1].v);
    }
  });
  return { named, ns };
}

// Every declaration `const|let|var NAME = <init>` of the file: name -> [{ init: [tokens], at }]; and every function definition: name -> [{ body: [tokens] }].
function declarations(toks) {
  const vars = new Map();
  const fns = new Map();
  const add = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
  const initEnd = (from) => {
    let d = 0;
    const ln0 = toks[from] ? toks[from].ln : 0;
    for (let j = from; j < toks.length; j++) {
      const t = toks[j];
      if (opens(t)) d++;
      else if (closes(t)) { if (d === 0) return j; d--; }
      else if (d === 0 && isP(t, ';')) return j;
      else if (d === 0 && isP(t, ',') ) return j;
      if (d === 0 && j > from && t.ln > ln0 && toks[j - 1] && (closes(toks[j - 1]) || ['id', 'str', 'num'].includes(toks[j - 1].k)) && (t.k === 'id') && ['const', 'let', 'var', 'function', 'export', 'test', 'import', 'return', 'if', 'for', 'while'].includes(t.v)) return j;
    }
    return toks.length;
  };
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (isId(t) && ['const', 'let', 'var'].includes(t.v) && isId(toks[i + 1]) && isP(toks[i + 2], '=')) {
      const name = toks[i + 1].v;
      const s = i + 3;
      const e = initEnd(s);
      const init = toks.slice(s, e);
      add(vars, name, { init });
      // an arrow helper: `const f = (a) => <expr or block>`
      const arrow = init.findIndex((x) => isP(x, '=>'));
      if (arrow >= 0) add(fns, name, { body: init.slice(arrow + 1), arrow: true });
    } else if (isId(t, 'function') && isId(toks[i + 1]) && isP(toks[i + 2], '(')) {
      const close = matching(toks, i + 2);
      if (close > 0 && isP(toks[close + 1], '{')) {
        const e = matching(toks, close + 1);
        add(fns, toks[i + 1].v, { body: toks.slice(close + 1, e + 1) });
      }
    }
  }
  return { vars, fns };
}

// The depth-1 members of an object literal given as tokens [ '{', ..., '}' ]: { keys: Set, spreads: [[tokens]], values: Map key -> [tokens] }.
function members(lit) {
  const keys = new Set();
  const spreads = [];
  const values = new Map();
  let i = 1;
  const end = lit.length - 1;
  const stop = (from) => {
    let d = 0;
    for (let j = from; j < end; j++) {
      if (opens(lit[j])) d++;
      else if (closes(lit[j])) d--;
      else if (d === 0 && isP(lit[j], ',')) return j;
    }
    return end;
  };
  while (i < end) {
    if (isP(lit[i], ',')) { i++; continue; }
    const e = stop(i);
    if (isP(lit[i], '...')) spreads.push(lit.slice(i + 1, e));
    else if ((isId(lit[i]) || lit[i].k === 'str') && isP(lit[i + 1], ':')) { keys.add(lit[i].v); values.set(lit[i].v, lit.slice(i + 2, e)); }
    else if (isId(lit[i]) && e === i + 1) { keys.add(lit[i].v); values.set(lit[i].v, [lit[i]]); }
    else if (isId(lit[i]) && isP(lit[i + 1], '(')) { keys.add(lit[i].v); }
    i = e + 1;
  }
  return { keys, spreads, values };
}

const isProcessEnv = (toks) => toks.length === 3 && isId(toks[0], 'process') && isP(toks[1], '.') && isId(toks[2], 'env');
// true when `process.env` appears as a WHOLE value in the tokens (not followed by a member access or an index)
function usesEnvWhole(toks) {
  for (let i = 0; i + 2 < toks.length; i++) {
    if (isId(toks[i], 'process') && isP(toks[i + 1], '.') && isId(toks[i + 2], 'env') && !(isP(toks[i + 3], '.') || isP(toks[i + 3], '[') || isP(toks[i + 3], '?.'))) return true;
  }
  return false;
}
const missingKeys = (keys) => SANDBOX_KEYS.filter((k) => !keys.has(k));
const allKeysOfLiterals = (toks) => {
  const keys = new Set();
  for (let i = 0; i < toks.length; i++) if (isP(toks[i], '{')) { const e = matching(toks, i); if (e > 0) for (const k of members(toks.slice(i, e + 1)).keys) keys.add(k); }
  return keys;
};

// Judge an env expression: { v: 'ok' | 'whole' | 'spread' | 'partial' | 'unread', why }.
function judge(toks, ctx, hops = 0) {
  if (toks.length === 0) return { v: 'unread', why: 'empty' };
  if (isProcessEnv(toks)) return { v: 'whole', why: 'passes process.env whole' };
  // an object literal
  if (isP(toks[0], '{') && matching(toks, 0) === toks.length - 1) {
    const m = members(toks);
    let whole = false;
    for (const sp of m.spreads) {
      const j = judge(sp, ctx, hops + 1);
      if (isProcessEnv(sp) || j.v === 'whole' || j.v === 'spread') whole = true;
    }
    if (whole) {
      // a bare copy, `{ ...process.env }`, is the whole environment
      if (m.keys.size === 0 && m.spreads.length === 1 && isProcessEnv(m.spreads[0])) return { v: 'whole', why: 'passes a copy of process.env whole' };
      const miss = missingKeys(m.keys);
      return miss.length === 0 ? { v: 'ok' } : { v: 'spread', why: `copies process.env and does not set ${miss.join(', ')}` };
    }
    if (m.keys.has('HOME') || m.keys.has('USERPROFILE')) {
      const miss = ['TEMP', 'TMP', 'TMPDIR'].filter((k) => !m.keys.has(k));
      if (miss.length) return { v: 'partial', why: `sets ${['HOME', 'USERPROFILE'].filter((k) => m.keys.has(k)).join(' and ')} but not ${miss.join(', ')}` };
    }
    return { v: 'ok' };
  }
  // a name declared once in the file
  if (toks.length === 1 && isId(toks[0])) {
    const d = ctx.vars.get(toks[0].v);
    if (!d || d.length !== 1 || hops >= MAX_HOPS) return { v: 'unread', why: `${toks[0].v} is not one declaration of this file` };
    return judge(d[0].init, ctx, hops + 1);
  }
  // a call to a helper defined in this file: judged by what it returns
  if (isId(toks[0]) && isP(toks[1], '(') && matching(toks, 1) === toks.length - 1) {
    const f = ctx.fns.get(toks[0].v);
    if (!f || f.length !== 1 || hops >= MAX_HOPS) return { v: 'unread', why: `${toks[0].v}() is not defined in this file` };
    const body = f[0].body;
    const exprs = [];
    if (f[0].arrow && !isP(body[0], '{')) exprs.push(isP(body[0], '(') && matching(body, 0) === body.length - 1 ? body.slice(1, -1) : body);
    else {
      for (let i = 0; i < body.length; i++) {
        if (!isId(body[i], 'return')) continue;
        let d = 0; let e = i + 1;
        for (; e < body.length; e++) { if (opens(body[e])) d++; else if (closes(body[e])) { if (d === 0) break; d--; } else if (d === 0 && isP(body[e], ';')) break; }
        exprs.push(body.slice(i + 1, e));
      }
    }
    if (exprs.length === 0) return { v: 'unread', why: `${toks[0].v}() returns nothing the census reads` };
    const rank = { ok: 0, unread: 1, partial: 2, spread: 3, whole: 4 };
    let worst = { v: 'ok' };
    for (const x of exprs) { const r = judge(x, ctx, hops + 1); if (rank[r.v] > rank[worst.v]) worst = r; }
    return worst;
  }
  // any other expression: judged by whether it carries the whole process.env
  if (usesEnvWhole(toks)) {
    const miss = missingKeys(allKeysOfLiterals(toks));
    return miss.length === 0 ? { v: 'ok' } : { v: 'spread', why: `copies process.env and does not set ${miss.join(', ')}` };
  }
  return { v: 'unread', why: 'an expression the census does not read' };
}

// The options object of a call: the args are toks[open+1 .. close-1]; an object literal at the top level of the args, or an identifier resolved to one literal.
function optionLiterals(toks, open, close, ctx) {
  const out = [];
  let d = 0;
  let argStart = open + 1;
  const flush = (end) => {
    const a = toks.slice(argStart, end);
    if (a.length && isP(a[0], '{') && matching(a, 0) === a.length - 1) out.push(a);
    else if (a.length === 1 && isId(a[0])) {
      const dd = ctx.vars.get(a[0].v);
      if (dd && dd.length === 1 && isP(dd[0].init[0], '{') && matching(dd[0].init, 0) === dd[0].init.length - 1) out.push(dd[0].init);
    }
  };
  for (let j = open + 1; j < close; j++) {
    if (opens(toks[j])) d++;
    else if (closes(toks[j])) d--;
    else if (d === 0 && isP(toks[j], ',')) { flush(j); argStart = j + 1; }
  }
  flush(close);
  return out;
}

// `spread` is `{ ...process.env, X: 1 }`: the whole real environment plus extras. The rule as ruled names `whole` and `partial`; a spread is the same exposure under another
// syntax and is COUNTED and LISTED (spreadList) but is a finding only when the caller asks (`{ spread: 'finding' }`), because it multiplies a room's sweep several times over and
// the decision to promote it is main's, not the census's.
export function scanChildEnv(files, pins = [], { spread = 'count' } = {}) {
  const findings = [];
  const counts = { files: files.length, calls: 0, withEnv: 0, ok: 0, unread: 0, whole: 0, spread: 0, partial: 0, exempted: 0 };
  const unreadList = [];
  const spreadList = [];
  for (const { rel, text } of files) {
    if (pins.some((e) => e.rel === rel && e.blob === gitBlobId(text))) { counts.exempted++; continue; }
    const toks = lex(text);
    const { named, ns } = cpBindings(toks);
    const ctx = declarations(toks);
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (!isId(t) || !isP(toks[i + 1], '(')) continue;
      const prev = toks[i - 1];
      const member = isP(prev, '.') || isP(prev, '?.');
      let isCall = false;
      if (HELPERS.has(t.v)) isCall = !(isId(prev, 'function'));
      else if (!member && named.has(t.v)) isCall = !(isId(prev, 'function'));
      else if (member && SPAWNERS.has(t.v) && isId(toks[i - 2]) && ns.has(toks[i - 2].v)) isCall = true;
      if (!isCall) continue;
      const close = matching(toks, i + 1);
      if (close < 0) continue;
      counts.calls++;
      for (const lit of optionLiterals(toks, i + 1, close, ctx)) {
        const m = members(lit);
        if (!m.values.has('env')) continue;
        counts.withEnv++;
        const r = judge(m.values.get('env'), ctx);
        counts[r.v]++;
        const line = `${rel}:${t.ln} ${t.v}() env ${r.why}`;
        if (r.v === 'unread') unreadList.push(`${rel}:${t.ln} ${t.v}: ${r.why}`);
        else if (r.v === 'spread' && spread === 'count') spreadList.push(line);
        else if (r.v !== 'ok') findings.push(`${rel}:${t.ln} ${t.v}() env ${r.why} -- ${r.v === 'whole' ? 'give the child a sandboxed environment' : 'set HOME, USERPROFILE, TEMP, TMP and TMPDIR to the test\'s own folder'}`);
      }
    }
  }
  return { findings, unreadList, spreadList, ...counts };
}

export function censusChildEnv(files, pins = [], opts = {}) {
  return scanChildEnv(files, pins, opts).findings;
}
