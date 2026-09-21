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
    const kv = cur && line.match(/^\s+(key|title|path|default|directory|draft): (.+?)\s*$/);
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
  // directory: null = the space does not inherit the site's repository (schema); it is wired to its OWN repo in the UI
  for (const s of spaces.filter((x) => x.directory !== 'null')) assert.ok(exists(path.posix.join(s.directory, 'README.md')), s.key + ': ' + s.directory + '/README.md exists');
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

test('every space that reads a directory of THIS repo is self-contained: no relative target in its README leaves the directory', () => {
  const dirs = spaces.map((s) => s.directory).filter((d) => d !== 'null').map((d) => d.replace(/^\.\//, ''));
  assert.ok(dirs.includes('profile') && dirs.includes('patterns'), 'the Home and Patterns spaces are among them: ' + dirs.join(','));
  for (const dir of dirs.filter((d) => !d.startsWith('benchmarks/'))) {
    const text = read(dir + '/README.md');
    const bad = mdLinks(text).concat([...text.matchAll(/src="([^"]+)"/g)].map((m) => m[1]).filter((l) => !/^(https?:|#)/.test(l)))
      .filter((l) => !exists(path.posix.join(dir, l.replace(/^\.\//, ''))));
    assert.deepEqual(bad, [], dir + ': a synced space cannot see files outside its mapped directory (vendor: keep every referenced asset inside it)');
  }
});

// UMB-169. The Patterns are ONE space whose pages are outbound links to the seven doctrine documents, which live at
// the repo root and are cited by name from 78 files outside this repo (five shipped public URLs among them; derive
// with the grep in the UMB-169 return), so they are not moved. The fallback book lists the same seven as in-book
// pages. Nothing is copied.
const summaryGroup = (name) => {
  const lines = read('SUMMARY.md').split('\n');
  const i = lines.indexOf('## ' + name);
  if (i < 0) return [];
  const out = [];
  for (const l of lines.slice(i + 1)) { if (l.startsWith('## ')) break; out.push(l); }
  return [...out.join('\n').matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]);
};
const BLOB = 'https://github.com/TheColliery/.github/blob/main/';
const ROOMS = ['CoalMine', 'CoalTipple', 'CoalBoard', 'CoalHearth', 'CoalFace', 'CoalWash', 'CoalLedger', 'CoalGob'];

test('the Patterns space: patterns/SUMMARY.md links exactly the seven documents the fallback book lists, and each one exists', () => {
  assert.ok(spaces.some((s) => s.directory === './patterns' && s.parent?.title === 'Patterns'), 'a Patterns section holds one space reading ./patterns');
  const own = mdLinks(read('patterns/SUMMARY.md'));
  const outbound = [...read('patterns/SUMMARY.md').matchAll(/\]\((https:\/\/[^)\s]+)\)/g)].map((m) => m[1]);
  assert.deepEqual(own, ['README.md'], 'the only in-book page is the space README');
  assert.equal(outbound.length, 7);
  const files = outbound.map((u) => { assert.ok(u.startsWith(BLOB), u); return u.slice(BLOB.length); });
  for (const f of files) assert.ok(exists(f), f + ' exists at the repo root (a rename or move must move this link too)');
  assert.deepEqual([...files].sort(), summaryGroup('Patterns').sort(), 'the fallback ## Patterns group lists the same seven');
  assert.equal(new Set(files).size, 7);
});

test('the Tools section: eight spaces that do not read this repository, and the fallback book links the same eight repos', () => {
  const tools = spaces.filter((s) => s.parent?.title === 'Tools');
  assert.deepEqual(tools.map((s) => s.title).sort(), [...ROOMS].sort());
  assert.ok(tools.every((s) => s.directory === 'null'), 'directory: null on every Tools space (each is wired to its own repo in the UI)');
  assert.equal(spaces.filter((s) => s.directory === 'null' && s.parent?.title !== 'Tools').length, 0, 'null-directory spaces exist only in Tools');
  assert.deepEqual(summaryGroup('Tools').sort(), ROOMS.map((r) => 'https://github.com/TheColliery/' + r).sort());
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
  assert.deepEqual(hits, [], 'these files still name the deleted site');
  // UMB-178 step 4: the link we PUBLISH is the stable https://thecolliery.org/docs (a Cloudflare redirect we own).
  // docs.thecolliery.org is a GitBook custom domain on a TRIAL and thecolliery.gitbook.io redirects to it, so no
  // front door may depend on either host. The only files that may name them are this test and the gate that bans
  // them from a repo's website field.
  const gitbookHosts = /thecolliery\.gitbook\.io|docs\.thecolliery\.org/;
  const MAY_NAME = ['scripts/gitbook-config.test.mjs', 'scripts/lib/skeleton-check-lib.mjs', 'scripts/skeleton-check.test.mjs'];
  const named = files.filter((f) => !MAY_NAME.includes(f) && gitbookHosts.test(read(f)));
  assert.deepEqual(named, [], 'these files publish a GitBook host; the stable link is https://thecolliery.org/docs');
  assert.match(read('README.md'), /https:\/\/thecolliery\.org\/docs\b/);
  assert.match(read('profile/README.md'), /https:\/\/thecolliery\.org\/docs\b/);
});
