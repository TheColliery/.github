import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// UMB-165 (the new GitBook home). This repo carries TWO GitBook configurations on purpose:
//   - gitbook-docs.yaml, the SITE-level structure (sections + one space per benchmark). It is what the site
//     reads while its plan supports sections (an Ultimate-site feature; the org is on a 14-day trial);
//   - the root .gitbook.yaml + SUMMARY.md, the SPACE-level single-space shape written for the plan that
//     survives the trial. It is the fallback and must keep working underneath, never rot.
// They describe the same public content, so a benchmark added to one and not the other is exactly the drift
// the move left behind (CoalLedger and CoalWash were in SUMMARY.md and missing from gitbook-docs.yaml), and
// a mapped directory with no SUMMARY.md publishes EVERY markdown file in it (measured on the live site: 18
// pages for CoalBoard, including run prompts and task files). No YAML parser without an npm install
// (Phoenix #2), so the site file is read with a dumb line parser that says what it is: the file has one
// regular shape, and GitBook itself validates the rest on import.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const mdLinks = (text) => [...text.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]).filter((l) => !/^(https?:|mailto:|#)/.test(l));

function parseSiteFile(text) {
  const nodes = [];
  let cur = null;
  for (const line of text.split('\n')) {
    const head = line.match(/^(\s*)- type: ([\w-]+)/);
    if (head) { cur = { type: head[2], indent: head[1].length }; nodes.push(cur); continue; }
    const kv = cur && line.match(/^\s+(key|title|path|default|directory): (.+?)\s*$/);
    if (kv) cur[kv[1]] = kv[2];
  }
  // a space belongs to the nearest section above it that is indented less
  for (const n of nodes) {
    n.parent = n.type === 'space' ? [...nodes].slice(0, nodes.indexOf(n)).reverse().find((p) => p.type === 'section' && p.indent < n.indent) || null : null;
  }
  return nodes;
}

const nodes = parseSiteFile(read('gitbook-docs.yaml'));
const spaces = nodes.filter((n) => n.type === 'space');
const sections = nodes.filter((n) => n.type === 'section');
const benchmarkDirs = fs.readdirSync(path.join(ROOT, 'benchmarks'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && exists(`benchmarks/${d.name}/README.md`)).map((d) => d.name).sort();

test('the site file parses into the shape it is read as (not vacuous)', () => {
  assert.ok(sections.length >= 2, 'sections: ' + sections.length);
  assert.ok(spaces.length >= 8, 'spaces: ' + spaces.length);
  assert.ok(spaces.every((s) => s.key && s.path && s.directory), 'every space carries key, path and content.directory');
});

test("gitbook-docs.yaml obeys the vendor's import rules (a violation fails the sync)", () => {
  const keys = nodes.map((n) => n.key);
  assert.equal(new Set(keys).size, keys.length, 'every key is unique across the file: ' + keys.join(','));
  assert.equal(sections.filter((s) => s.default === 'true').length, 1, 'exactly one default section');
  assert.equal(spaces.filter((s) => !s.parent).length, 0, 'once a section exists no space sits at the top level');
  for (const s of sections) {
    const kids = spaces.filter((x) => x.parent === s);
    assert.equal(kids.filter((x) => x.default === 'true').length, 1, `section ${s.key}: exactly one default space`);
    assert.equal(new Set(kids.map((k) => k.path)).size, kids.length, `section ${s.key}: space paths are unique`);
  }
  for (const s of spaces) assert.ok(exists(path.posix.join(s.directory, 'README.md')), `${s.key}: ${s.directory}/README.md exists`);
});

test('every benchmark directory has a space in gitbook-docs.yaml, and every benchmark space has a directory (RED before CoalLedger and CoalWash were added)', () => {
  const mapped = spaces.map((s) => s.directory).filter((d) => d.startsWith('./benchmarks/')).map((d) => d.slice('./benchmarks/'.length)).sort();
  assert.deepEqual(mapped, benchmarkDirs);
});

test('the space-level fallback (root SUMMARY.md) lists the same benchmark set as the site file', () => {
  const inSummary = [...new Set(mdLinks(read('SUMMARY.md')).map((l) => l.match(/^benchmarks\/([^/]+)\//)?.[1]).filter(Boolean))].sort();
  assert.deepEqual(inSummary, benchmarkDirs);
});

test('every mapped benchmark directory carries a SUMMARY.md that publishes exactly what the fallback publishes (RED before the per-space SUMMARY files existed)', () => {
  const rootLinks = mdLinks(read('SUMMARY.md'));
  for (const d of benchmarkDirs) {
    const rel = `benchmarks/${d}/SUMMARY.md`;
    assert.ok(exists(rel), `${rel} is missing: without it every markdown file in the directory becomes a public page`);
    const own = mdLinks(read(rel)).map((l) => l.replace(/^\.\//, ''));
    const want = rootLinks.filter((l) => l.startsWith(`benchmarks/${d}/`)).map((l) => l.slice(`benchmarks/${d}/`.length));
    assert.deepEqual(own, want, `${rel} must list the same pages as the root SUMMARY.md lists for ${d}`);
    for (const l of own) assert.ok(exists(`benchmarks/${d}/${l}`), `${rel}: ${l} exists`);
    assert.equal(own[0], 'README.md', `${rel}: README.md comes first`);
  }
});

test('the fallback stays WORKING: .gitbook.yaml names files that exist, and every SUMMARY.md link resolves', () => {
  const cfg = read('.gitbook.yaml');
  const readme = cfg.match(/^\s*readme:\s*(\S+)/m)?.[1];
  const summary = cfg.match(/^\s*summary:\s*(\S+)/m)?.[1];
  assert.equal(readme, 'profile/README.md');
  assert.equal(summary, 'SUMMARY.md');
  assert.ok(exists(readme) && exists(summary));
  const dangling = mdLinks(read('SUMMARY.md')).filter((l) => !exists(l));
  assert.deepEqual(dangling, []);
});

test('the Home space (./profile) is self-contained: every relative target in its README lives inside profile/', () => {
  const dir = 'profile';
  const bad = mdLinks(read(`${dir}/README.md`)).concat([...read(`${dir}/README.md`).matchAll(/src="([^"]+)"/g)].map((m) => m[1]).filter((l) => !/^(https?:|#)/.test(l)))
    .filter((l) => !exists(path.posix.join(dir, l.replace(/^\.\//, ''))));
  assert.deepEqual(bad, [], 'a synced space cannot see files outside its mapped directory (vendor: keep every referenced asset inside it)');
});

// The old TheColliery site (site_3DpAx) was deleted when the home moved to a new GitBook organization; its
// public URL still answers 200 only from a CDN cache (s-maxage 22.7 h, stale-while-revalidate 30 days) and
// nothing redirects it. The org's own front doors must point at the live door, never at the ghost. The OLD
// org's still-live site is a different address (hetcreep.gitbook.io/hetcreep-docs) and stays legal.
test('no front door points at the deleted old TheColliery GitBook site (hetcreep.gitbook.io/thecolliery)', () => {
  const dead = /hetcreep\.gitbook\.io\/thecolliery\b/;
  const files = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      if (['.git', 'node_modules', '.claude', 'benchmarks'].includes(e.name)) continue;
      const rel = dir ? dir + '/' + e.name : e.name;
      if (e.isDirectory()) walk(rel);
      else if (/\.(md|mjs|yml|yaml|json)$/.test(e.name)) files.push(rel);
    }
  };
  walk('');
  const hits = files.filter((f) => f !== 'scripts/gitbook-config.test.mjs' && dead.test(read(f)));
  assert.deepEqual(hits, [], 'these files still name the deleted site; the live door is https://thecolliery.gitbook.io/thecolliery-docs/');
  assert.match(read('README.md'), /thecolliery\.gitbook\.io\/thecolliery-docs/);
  assert.match(read('profile/README.md'), /thecolliery\.gitbook\.io\/thecolliery-docs/);
});
