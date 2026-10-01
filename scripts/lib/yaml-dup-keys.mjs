// UMB-313 / the faba167 class: GitHub refuses a workflow file that repeats a key inside one mapping, and a
// repository born from such a template gets a run that fails before any job starts (TheColliery/tool-yard:
// 41 runs, 41 failures). No YAML parser ships with Node and Phoenix #2 bars installing one, so this reads the
// indentation of block YAML, which is all a workflow file uses. Library only: the entry point is
// scripts/workflow-duplicate-keys.test.mjs.
//
// What it understands: block mappings, block sequences of mappings ("- key: v"), quoted keys, comments, document
// markers, and block scalars ("run: |" bodies are skipped, shell lines are not keys).
// What it does NOT understand: flow mappings ("{a: 1, a: 2}") and a plain or quoted scalar that wraps onto a
// second line and happens to look like "key: value". Neither occurs in this repository's workflows; a hit there
// would be a false alarm, never a miss of a block-mapping duplicate.

const KEY = /^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^\s"'#\-[\]{}&*!|>%@`:][^:]*?)\s*:(?:\s+(.*))?$/;
const BLOCK_SCALAR = /^[|>][+-]?\d*\s*(?:#.*)?$/;

const unquote = (k) => (k[0] === '"' ? k.slice(1, -1).replace(/\\(.)/g, '$1') : k[0] === "'" ? k.slice(1, -1).replace(/''/g, "'") : k.trim());

/** @returns {{line:number,key:string,firstLine:number}[]} one entry per repeated key, 1-based line numbers */
export function findDuplicateKeys(text) {
  const out = [];
  const stack = []; // open mappings, innermost last: { col, keys: Map<key, firstLine> }
  let blockCol = -1; // inside a block scalar whose owning key sits at this column
  const lines = String(text).split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim() || /^\s*#/.test(raw)) continue;
    const indent = raw.length - raw.trimStart().length;
    if (blockCol >= 0) {
      if (indent > blockCol) continue;
      blockCol = -1;
    }
    if (/^(---|\.\.\.)(\s|$)/.test(raw)) { stack.length = 0; continue; }
    let col = indent;
    let rest = raw.slice(indent);
    let newItem = false;
    for (let m = rest.match(/^-(?:\s+|$)/); m; m = rest.match(/^-(?:\s+|$)/)) {
      col += m[0].length;
      rest = rest.slice(m[0].length);
      newItem = true;
    }
    const m = rest.match(KEY);
    if (!m) continue;
    while (stack.length && (newItem ? stack[stack.length - 1].col >= col : stack[stack.length - 1].col > col)) stack.pop();
    if (!stack.length || stack[stack.length - 1].col < col) stack.push({ col, keys: new Map() });
    const key = unquote(m[1]);
    const top = stack[stack.length - 1];
    if (top.keys.has(key)) out.push({ line: i + 1, key, firstLine: top.keys.get(key) });
    else top.keys.set(key, i + 1);
    if (BLOCK_SCALAR.test((m[2] || '').trim())) blockCol = col;
  }
  return out;
}
