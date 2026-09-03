// Documentation-vs-schema drift gate. Every config key NAMED on a
// user-facing surface (a SKILL.md, README, or a hook's own user-facing
// notice strings) must RESOLVE in config-schema.mjs, or be declared.
//
// Ported from CoalMine's exemplar (scripts/lib/config-keys.mjs, live
// 2026-09-03, CWK-059/CWK-061) — the MECHANISM is copied verbatim; the
// CoalMine-specific history (its own ticket numbers, its own measured
// false-positive counts, its own NOT_CONFIG/BLIND_KEYS entries) is NOT —
// those are that room's own measurements, re-derive this room's own before
// trusting a number. Re-measure the false-positive rate on THIS tool's own
// surfaces before shipping; do not carry CoalMine's percentages forward.
//
// DETECTION RULE: a candidate is a token that is backticked in Markdown, or
// inside the CONTENTS of a string literal in a hook's user-facing notice
// block, and matches camelCase-with-an-internal-capital. This UNDER-FIRES
// by design — a miss is a bug, a flood is a dead gate (a gate that cries
// wolf gets ignored, the same lesson `rot-canary`'s own tripwireMaxLines
// history already paid for). A single-word lowercase key or a snake_case
// key does not match and is invisible to this gate — declare any such key
// in BLIND_KEYS below, or the gate FAILs on its own precondition check.
const KEY_SHAPE = /^[a-z][a-z0-9]*[A-Z][A-Za-z0-9]*$/;

// A key that is NAMED but not yet IMPLEMENTED. An entry MUST carry a
// ticket/issue reference or a stated reason — a bare string is a bypass
// with no author. Self-cleaning: a PENDING key that now resolves in the
// schema is a FAIL (delete the entry, it's done).
export const PENDING_KEYS = {
  // {{PLACEHOLDER}} — e.g. "someFutureKey: 'planned, see ISSUE-123'"
};

// NOT a config key and never will be — a code identifier that happens to
// be camelCase in prose (a translation-table key, a hook output field
// name, a platform capability name). Self-cleaning: an entry that now
// resolves in the schema is a lie — delete it.
export const NOT_CONFIG = {
  // {{PLACEHOLDER}} — e.g. "capNotice: 'translation key, not a config input'"
};

// A schema key this gate's detection rule CANNOT SEE (fails KEY_SHAPE —
// usually a single lowercase word), declared with the reason it is
// accepted. MANDATORY, not optional: any schema key that fails KEY_SHAPE
// and is NOT declared here is a hard FAIL — the gate refuses to run while
// silently checking less than it claims. Every adopting room hits this at
// least once: the umbrella's 5 Standard Systems #2 mandates a `language`
// key flock-wide, and `language` fails KEY_SHAPE by construction.
export const BLIND_KEYS = {
  // {{PLACEHOLDER}} — e.g. "language: 'single lowercase word, indistinguishable from prose'"
};

const NL = String.fromCharCode(10);
const BS = String.fromCharCode(92);
const TICK = new RegExp('`([^`' + BS + 'n]+)`', 'g');
const JS_STRING = new RegExp("'((?:" + BS + BS + ".|[^'" + BS + BS + "])*)'", 'g');
const JS_ESCAPE = new RegExp(BS + BS + '[a-zA-Z]', 'g');
const IDENT = new RegExp(BS + 'b([a-z][a-z0-9]*[A-Z][A-Za-z0-9]*)' + BS + 'b', 'g');
const ROW_KEY = new RegExp('^' + BS + 's*[|]' + BS + 's*`([^`|]+)`' + BS + 's*[|]');

function candidatesInMarkdown(text) {
  const out = new Set();
  for (const m of text.matchAll(TICK)) if (KEY_SHAPE.test(m[1])) out.add(m[1]);
  return out;
}

// SCOPE INSIDE A HOOK: the user-facing notice block only (default block
// name `TRANSLATIONS`), never the whole file — bounding to the block a
// user actually reads keeps local variable/API names out of the scan.
function noticeRegion(text, blockName) {
  const start = text.indexOf('const ' + blockName);
  if (start === -1) return '';
  const end = text.indexOf(NL + '};', start);
  return end === -1 ? text.slice(start) : text.slice(start, end);
}

// STRUCTURED SURFACE: inside a declared key TABLE the first cell is a key
// by the table's own contract, so position supplies the signal shape
// cannot — a lowercase key that free prose can never expose is caught
// here. Region-bounded to one heading so an unrelated table (e.g. a
// commands list) never contributes false positives.
function tableRegion(text, heading) {
  const lines = text.split(NL);
  const start = lines.findIndex((l) => /^#{1,6}\s/.test(l) && l.includes(heading));
  if (start === -1) return [];
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^#{1,6}\s/.test(l));
  return end === -1 ? rest : rest.slice(0, end);
}

function keysInTable(text, heading) {
  const out = new Set();
  for (const ln of tableRegion(text, heading)) {
    const m = ROW_KEY.exec(ln);
    if (m) out.add(m[1]);
  }
  return out;
}

function candidatesInHookStrings(text, blockName) {
  const out = new Set();
  const region = noticeRegion(text, blockName);
  if (!region) return out;
  for (const lit of region.matchAll(JS_STRING)) {
    const clean = lit[1].replace(JS_ESCAPE, ' ');
    for (const id of clean.matchAll(IDENT)) if (KEY_SHAPE.test(id[1])) out.add(id[1]);
  }
  return out;
}

// findings: [{ level, msg }] — same shape every other verify.mjs check returns.
// `read` is injected so the caller owns file IO (and a test can drive it in-memory).
export function checkConfigKeys({
  schemaKeys, mdFiles = [], hookFiles = [], read,
  noticeBlock = 'TRANSLATIONS',
  keyTables = [], // [{ file, heading }]
  pending = PENDING_KEYS,
  notConfig = NOT_CONFIG,
  blind = BLIND_KEYS,
}) {
  const findings = [];
  const known = new Set(schemaKeys);

  // PRECONDITION — a hard FAIL, not a printed note: any schema key
  // KEY_SHAPE cannot see must be declared in BLIND_KEYS, or the gate
  // refuses to run while silently checking less than it claims.
  const invisible = [...known].filter((k) => !KEY_SHAPE.test(k)).sort();
  const accepted = invisible.filter((k) => Object.hasOwn(blind, k));
  if (accepted.length) {
    findings.push({
      level: 'SKIP',
      msg: 'blind to ' + accepted.length + ' DECLARED schema key(s) this gate cannot detect: '
        + accepted.join(', ') + ' — named on any surface they are read and discarded, so the '
        + 'pass line above does not cover them (accepted in BLIND_KEYS)',
    });
  }
  for (const k of invisible) {
    if (Object.hasOwn(blind, k)) continue;
    findings.push({
      level: 'FAIL',
      msg: 'schema key ' + k + ' cannot be detected by this gate (it does not match the '
        + 'camelCase-with-an-internal-capital shape), so any mention of it in docs is read and '
        + 'discarded. Declare it in BLIND_KEYS with the reason it is accepted, or rename the key.',
    });
  }
  const seen = new Map();
  const unreadable = [];
  const tableReported = new Set();

  const note = (tok, file) => {
    if (!seen.has(tok)) seen.set(tok, new Set());
    seen.get(tok).add(file);
  };

  for (const f of mdFiles) {
    let text;
    try { text = read(f); } catch { unreadable.push(f); continue; }
    for (const tok of candidatesInMarkdown(text)) note(tok, f);
  }
  for (const f of hookFiles) {
    let text;
    try { text = read(f); } catch { unreadable.push(f); continue; }
    for (const tok of candidatesInHookStrings(text, noticeBlock)) note(tok, f);
  }

  for (const { file, heading } of keyTables) {
    let text;
    try { text = read(file); } catch { unreadable.push(file); continue; }
    for (const tok of keysInTable(text, heading)) {
      note(tok, file);
      if (known.has(tok) || Object.hasOwn(notConfig, tok) || Object.hasOwn(pending, tok)) continue;
      tableReported.add(tok);
      findings.push({
        level: 'FAIL',
        msg: 'key table ' + file + ' (under "' + heading + '") documents ' + tok
          + ', which does not resolve in the schema — a table row IS a key claim whatever its shape, '
          + 'so this is caught even where the prose rule is blind. Implement it, or declare it in '
          + 'PENDING_KEYS / NOT_CONFIG',
      });
    }
  }

  for (const [tok, files] of [...seen].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (known.has(tok)) continue;
    if (tableReported.has(tok)) continue;
    if (Object.hasOwn(notConfig, tok)) continue;
    if (Object.hasOwn(pending, tok)) continue;
    findings.push({
      level: 'FAIL',
      msg: 'config key ' + tok + ' is named in ' + [...files].sort().join(', ') + ' but does not resolve in the schema '
        + '— implement it, or declare it in PENDING_KEYS (planned, with its ticket) or NOT_CONFIG (never a key, with its reason)',
    });
  }

  for (const tok of Object.keys(pending)) {
    if (known.has(tok)) findings.push({ level: 'FAIL', msg: 'PENDING_KEYS lists ' + tok + ', but it now resolves in the schema — implemented, so delete the entry' });
  }
  for (const tok of Object.keys(notConfig)) {
    if (known.has(tok)) findings.push({ level: 'FAIL', msg: 'NOT_CONFIG lists ' + tok + ' as never-a-config-key, but it now resolves in the schema — the entry is a lie, delete it' });
  }
  for (const tok of Object.keys(blind)) {
    if (!known.has(tok)) {
      findings.push({ level: 'FAIL', msg: 'BLIND_KEYS declares ' + tok + ', but it is not in the schema at all — the key is gone, delete the entry' });
    } else if (KEY_SHAPE.test(tok)) {
      findings.push({ level: 'FAIL', msg: 'BLIND_KEYS declares ' + tok + ' as undetectable, but it now matches the shape rule — the gate can see it, delete the entry' });
    }
  }

  // A declaration protecting nothing is dead weight. Gated on a COMPLETE
  // scan: a partial read (some surface unreadable) may not convict a
  // declaration — it degrades to a visible SKIP, never a false accusation.
  if (unreadable.length) {
    findings.push({ level: 'SKIP', msg: 'declaration-pruning not checked: ' + unreadable.length + ' named surface(s) unreadable (' + unreadable.slice(0, 3).sort().join(', ') + (unreadable.length > 3 ? ', ...' : '') + ') — a partial scan cannot prove a declaration is dead' });
  } else {
    for (const [tok, why] of [...Object.entries(pending), ...Object.entries(notConfig)]) {
      if (!seen.has(tok)) findings.push({ level: 'FAIL', msg: 'no scanned surface names ' + tok + ' (' + why + ') — the declaration protects nothing, delete it' });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// ONE CONFIG-READ PATH — no key is read from a bare project file, by hook or
// by agent instruction. A surface that names the config file must also name
// the global tier, or an agent following it silently falls back to defaults
// on a machine configured only globally.
//
// A UNIVERSAL rail — one line naming the global path AND scoping itself to
// every key (the UNIVERSAL_MARKER phrase) — covers the whole surface.
// Anything else is LOCAL: a line naming the global tier while discussing
// one key governs that line and nothing else.
const UNIVERSAL_MARKER = 'every config key';

export function checkConfigReadPath({ surfaces = [], configName = '.{{TOOL}}.json', globalHome = '~/.claude/' }) {
  const findings = [];
  const globalToken = globalHome + configName;
  for (const { label, text } of surfaces) {
    if (typeof text !== 'string' || !text.includes(configName)) continue;
    const lines = text.split(NL);
    if (lines.some((l) => l.includes(globalToken) && l.includes(UNIVERSAL_MARKER))) continue;
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].includes(configName)) continue;
      if (lines[i].includes(globalToken)) continue;
      findings.push({
        level: 'FAIL',
        label,
        line: i + 1,
        msg: label + ':' + (i + 1) + ' names ' + configName + ' with no rail governing it -- an agent '
          + 'following it reads the bare project file, which is ABSENT on a machine configured only '
          + 'globally, and silently falls back to defaults. Either name ' + globalToken + ' on this line, '
          + 'or give the surface a UNIVERSAL rail (one line naming ' + globalToken + ' and the words "'
          + UNIVERSAL_MARKER + '")',
      });
    }
  }
  return findings;
}
