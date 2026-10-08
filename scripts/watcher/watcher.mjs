// The change watcher: ONE code for every Cloudflare account's Cron Worker (BB-28, UMB-445). The source list is configuration (sources/<instance>.mjs, a
// data-only module), never code. Zero dependency beyond the Workers runtime: fetch, Response, crypto.subtle, TextDecoder, AbortSignal, nothing imported.
//
// Per run (worker.mjs calls runOnce once per Cron tick): pick the sources due this hour, fetch each with a User-Agent that names TheColliery and the forge
// and with the stored validators (ETag / Last-Modified), compare the entry key with the stored state, write state ONLY when something changed, and when
// anything changed send ONE digest email for the whole run. State is a single KV key, so a quiet run costs one read and no write.
// Free-plan budget (Cloudflare docs read 2026-10-04): 10 ms CPU per Cron run (network wait not counted), 50 external subrequests, KV 1,000 writes a day.
// So a body is read to BODY_CAP bytes only, a feed is scanned for ENTRY_LOOKAHEAD entries, and validateConfig() holds maxPerRun under the subrequest budget.

export const USER_AGENT = 'TheColliery-change-watcher/1 (+https://thecolliery.org)';
export const BODY_CAP = 65536; // GitHub atom feeds run 6-780 KB with the newest entry first; 64 KB reaches the first stable entry of every list we ship
const ENTRY_LOOKAHEAD = 10;
const FETCH_TIMEOUT_MS = 8000;
const POOL = 6; // simultaneous outgoing connections per request on every plan (Cloudflare limits page)
const FAIL_REPORT_AT = 3; // consecutive failed runs before a source is reported, once
const HIST_LEN = 8; // a source's last runs kept as 'f' (failed) and '.' (answered), so a flapping source shows
const FLAP_AT = 4; // failures within that window that report a source even when no three came in a row
export const CHANGE_LIST_MARK = '--- change list (JSON lines, schema v1) ---'; // the machine-readable foot of every digest (UMB-453)
const LINK_CAP = 500;
const TITLE_CAP = 200; // a title in the mail and in state; a feed entry can carry far more
// whitespace, C0/C1 controls and the Unicode line separators: none may reach a link or an error text that goes into a mail body
const UNSAFE = new RegExp('[\\x00-\\x20\\x7f-\\x9f' + String.fromCharCode(0x2028, 0x2029) + ']', 'g');
const oneLine = (s) => String(s).replace(UNSAFE, ' ').replace(/ +/g, ' ').trim();
const KINDS = ['atom', 'rss', 'headings', 'raw'];
const SOURCE_FIELDS = ['id', 'name', 'url', 'kind', 'everyHours', 'ignoreTitle'];

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unwrap = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
const entities = (s) => s.replace(/&(?:#x([0-9a-f]+)|#(\d+)|([a-z]+));/gi, (m, hex, dec, name) => (hex ? String.fromCodePoint(parseInt(hex, 16)) : dec ? String.fromCodePoint(Number(dec)) : ENTITIES[name.toLowerCase()] ?? m));
// Tags are stripped by character, not by a regex: every "<" opens a tag that runs to the next ">" (or to the end), so no nesting or unterminated tag can leave a
// "<" behind (CodeQL js/incomplete-multi-character-sanitization). Entities decode AFTER, so an escaped bracket in a title stays text.
const stripTags = (s) => { let out = ''; let inTag = false; for (const ch of s) { if (ch === '<') inTag = true; else if (ch === '>' && inTag) inTag = false; else if (!inTag) out += ch; } return out; };
const decode = (s) => entities(unwrap(s));
const clean = (s) => entities(stripTags(unwrap(s))).replace(/\s+/g, ' ').trim();
const tag = (block, name) => { const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(block); return m ? clean(m[1]) : ''; };

// atom or RSS: the first entry whose title is not ignored.
export function parseFeed(text, { ignoreTitle } = {}) {
  const skip = ignoreTitle ? new RegExp(ignoreTitle, 'i') : null;
  let seen = 0;
  for (const m of text.matchAll(/<(entry|item)[\s>][\s\S]*?<\/\1>/gi)) {
    if (seen++ >= ENTRY_LOOKAHEAD) break;
    const block = m[0];
    const title = tag(block, 'title');
    if (skip && skip.test(title)) continue;
    const href = /<link\b[^>]*\bhref="([^"]+)"/i.exec(block);
    const link = (href ? decode(href[1]) : tag(block, 'link')).replace(UNSAFE, '');
    const key = tag(block, 'id') || tag(block, 'guid') || link || title;
    if (!key) continue;
    return { key, title, link, updated: tag(block, 'updated') || tag(block, 'pubDate') || tag(block, 'published') };
  }
  return null;
}

// an HTML changelog page: its first three headings stand for "what the page says is newest".
export function headingsKey(html) {
  const heads = [];
  for (const m of html.matchAll(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi)) {
    const t = clean(m[1]);
    if (t) heads.push(t);
    if (heads.length === 3) break;
  }
  return heads.length ? { key: heads.join(' | '), title: heads[1] ?? heads[0], link: '', updated: '' } : null;
}

// a raw markdown or text file: the hash of what was read.
export async function rawKey(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  const key = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  // a title for the digest: the first level 2-4 heading, else the first level 1 heading, else the "version" of an npm manifest (a package's latest dist-tag)
  // A status page's JSON titles with its newest incident (Statuspage lists them newest first), a Hugging Face model list with its newest model id.
  const title = (/^#{2,4}\s+(.+?)\s*$/m.exec(text) ?? /^#\s+(.+?)\s*$/m.exec(text)
    ?? /"incidents"\s*:\s*\[\s*\{[^{}]*?"name"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(text)
    ?? /^\s*\[\s*\{\s*"_id"\s*:\s*"[^"]*"\s*,\s*"id"\s*:\s*"([^"]+)"/.exec(text)
    ?? /"version"\s*:\s*"([^"]+)"/.exec(text) ?? [])[1] ?? '';
  return { key, title: clean(title), link: '', updated: '' };
}

export async function keyFor(source, text) {
  switch (source.kind) {
    case 'atom': case 'rss': return parseFeed(text, { ignoreTitle: source.ignoreTitle });
    case 'headings': return headingsKey(text);
    case 'raw': return rawKey(text);
    default: throw new Error('unknown kind ' + source.kind);
  }
}

// stateless cadence: a source with everyHours=n is due when (hour + its list index) % n === 0, so a list spreads over the hours by construction.
export const isDue = (source, index, hourNumber) => (hourNumber + index) % (source.everyHours || 1) === 0;
export function pickRun(sources, hourNumber, max) {
  const due = sources.filter((s, i) => isDue(s, i, hourNumber));
  return { run: due.slice(0, max), deferred: due.slice(max) };
}

async function readCapped(response) {
  const reader = response.body.getReader();
  const chunks = []; let got = 0;
  while (got < BODY_CAP) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); got += value.length;
  }
  reader.cancel().catch(() => {});
  const all = new Uint8Array(got);
  let at = 0;
  for (const c of chunks) { all.set(c, at); at += c.length; }
  return new TextDecoder().decode(all.subarray(0, BODY_CAP));
}

// one source, one conditional GET. Never throws: a failure is a result.
export async function fetchSource(source, prev, fetchFn) {
  const headers = { 'user-agent': USER_AGENT };
  if (prev?.etag) headers['if-none-match'] = prev.etag;
  if (prev?.lastModified) headers['if-modified-since'] = prev.lastModified;
  try {
    const r = await fetchFn(source.url, { headers, redirect: 'follow', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (r.status === 304) return { source, status: 'same' };
    if (!r.ok) return { source, status: 'error', error: 'HTTP ' + r.status };
    const body = await readCapped(r);
    const found = await keyFor(source, body);
    // a feed of nothing but ignored entries (an alpha-only run of tags) has no news: quiet, not broken
    if (!found) return (source.kind === 'atom' || source.kind === 'rss') && /<(entry|item)[\s>]/i.test(body) ? { source, status: 'same' } : { source, status: 'error', error: 'no entry found' };
    const base = { source, key: found.key, to: found.title.slice(0, TITLE_CAP), link: found.link, etag: r.headers.get('etag') || '', lastModified: r.headers.get('last-modified') || '' };
    if (!prev?.key) return { ...base, status: 'new' };
    if (prev.key === found.key) return { ...base, status: 'same' };
    // a feed that mints a new id on every render but shows the same title at the same link has no news (a raw file or a heading list has no such pair: its key IS its content)
    if ((source.kind === 'atom' || source.kind === 'rss') && prev.title === base.to && (prev.link === undefined || prev.link === base.link)) return { ...base, status: 'same' };
    return { ...base, status: 'changed', from: prev.title || '' };
  } catch (e) {
    return { source, status: 'error', error: oneLine(e?.message ?? e).slice(0, 120) };
  }
}

// ONE digest for the whole run.
export function buildDigest({ at, instance, results }) {
  const changed = results.filter((r) => r.status === 'changed');
  const baselined = results.filter((r) => r.status === 'new');
  const failing = results.filter((r) => r.status === 'error' && (r.fails === FAIL_REPORT_AT || r.flapping));
  const lines = [`${instance} change watcher, ${at}`, ''];
  if (changed.length) {
    lines.push(`Changed (${changed.length}):`);
    for (const r of changed) { lines.push(`  ${r.source.name}: ${r.from || '?'} -> ${r.to || '?'}`); if (r.link) lines.push(`    ${r.link}`); else lines.push(`    ${r.source.url}`); }
    lines.push('');
  }
  if (baselined.length) lines.push(`Baselined ${baselined.length} source(s), no earlier state to compare: ${baselined.map((r) => `${r.source.name} (${r.to || 'seen'})`).join(', ')}`, '');
  if (failing.length) {
    lines.push(`Failing (${failing.length}):`);
    for (const r of failing) lines.push(`  ${r.source.name} - ${r.error} ${r.flapping ? `in ${r.failedOf} of the last ${r.window} runs` : `for ${r.fails} runs in a row`} (${r.source.url})`);
    lines.push('');
  }
  const parts = [changed.length && `${changed.length} changed`, baselined.length && `${baselined.length} baselined`, failing.length && `${failing.length} failing`].filter(Boolean);
  const pick = (r) => ({ id: r.source.id, name: r.source.name, url: r.source.url, from: r.from, to: r.to, link: r.link, error: r.error });
  // One record per reported source, in the digest's own order. Absent fields are absent, not empty; every string is JSON-escaped, so one record is one line.
  const record = (kind, r) => {
    let host = '';
    try { host = new URL(r.source.url).hostname; } catch { /* validateConfig has already refused a bad URL */ }
    const o = { v: 1, instance, at, kind, id: r.source.id, site: r.source.name, host, url: r.source.url };
    if (r.link) o.link = String(r.link).slice(0, LINK_CAP);
    if (kind === 'changed' && r.from) o.from = String(r.from).slice(0, TITLE_CAP);
    if (kind !== 'failing' && r.to) o.to = String(r.to).slice(0, TITLE_CAP);
    if (kind === 'failing') o.error = r.error;
    return o;
  };
  const changes = [...changed.map((r) => record('changed', r)), ...baselined.map((r) => record('baselined', r)), ...failing.map((r) => record('failing', r))];
  lines.push(CHANGE_LIST_MARK, ...changes.map((c) => JSON.stringify(c)));
  return {
    subject: `[${instance} watcher] ${parts.join(', ')}`,
    text: lines.join('\n').trimEnd() + '\n',
    json: { at, instance, changed: changed.map(pick), baselined: baselined.map(pick), failing: failing.map(pick), changes },
  };
}

async function pooled(items, worker) {
  const out = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(POOL, items.length) }, async () => { while (next < items.length) { const i = next++; out[i] = await worker(items[i]); } }));
  return out;
}

// a source's stored entry after a run: an answered run ends the failure streak and moves the window on; hist and rep are kept only while they say something
const tidy = (e) => { const o = { ...e }; if (!o.hist) delete o.hist; if (!o.rep) delete o.rep; return o; };
const answered = (e) => {
  if (!e) return e;
  const hist = ((e.hist ?? '') + '.').slice(-HIST_LEN);
  return tidy({ ...e, fails: 0, hist: hist.includes('f') ? hist : '', rep: hist.endsWith('...') ? false : !!e.rep });
};

export async function runOnce({ config, kv, fetchFn, send, now, to, from }) {
  const at = new Date(now).toISOString();
  const { run, deferred } = pickRun(config.sources, Math.floor(now / 3600000), config.maxPerRun);
  const state = (await kv.get('state', 'json')) ?? { v: 1, sources: {} };
  const next = { v: 1, sources: { ...state.sources } };
  const results = await pooled(run, (s) => fetchSource(s, state.sources[s.id], fetchFn));
  // the hello digest belongs to the first run that actually BASELINES something: a failed source leaves a {fails} stub in state, which is no baseline
  const firstEver = !Object.values(state.sources).some((s) => s.key);
  let dirty = false;
  const report = [];
  for (const r of results) {
    const id = r.source.id;
    const prev = state.sources[id];
    let entry;
    if (r.status === 'changed' || r.status === 'new') {
      entry = answered({ ...prev, key: r.key, title: r.to, link: r.link, etag: r.etag, lastModified: r.lastModified });
      // a baseline is not a change: only the first run that baselines reports them (one hello digest); a source that comes due later is recorded silently
      if (r.status === 'changed' || firstEver) report.push(r);
    } else if (r.status === 'same') {
      // a refreshed validator is state too: persisting it spares the next run a full body
      entry = answered(r.key ? { ...prev, etag: r.etag || prev?.etag || '', lastModified: r.lastModified || prev?.lastModified || '' } : prev);
    } else {
      const hist = ((prev?.hist ?? '') + 'f').slice(-HIST_LEN);
      const failedOf = [...hist].filter((c) => c === 'f').length;
      const fails = Math.min(FAIL_REPORT_AT, (prev?.fails ?? 0) + 1);
      // reported once per trouble spell: three in a row, or FLAP_AT failures in the window; a spell ends after three answered runs
      const due = !prev?.rep && (fails === FAIL_REPORT_AT || failedOf >= FLAP_AT);
      Object.assign(r, { fails, flapping: fails < FAIL_REPORT_AT, failedOf, window: hist.length });
      if (due) report.push(r);
      entry = tidy({ ...prev, fails, hist, rep: !!prev?.rep || due });
    }
    if (JSON.stringify(entry) !== JSON.stringify(prev)) { next.sources[id] = entry; dirty = true; }
  }
  const summary = {
    checked: results.length, deferred: deferred.length,
    changed: results.filter((r) => r.status === 'changed').length, baselined: results.filter((r) => r.status === 'new').length,
    errors: results.filter((r) => r.status === 'error').length, emailed: false,
  };
  if (report.length) {
    const digest = buildDigest({ at, instance: config.instance, results: report });
    try { await send({ to, from, subject: digest.subject, text: digest.text }); summary.emailed = true; } catch (e) { summary.emailError = String(e?.code ?? e?.message ?? e).slice(0, 120); }
    await kv.put('digest:last', JSON.stringify({ ...digest.json, subject: digest.subject, text: digest.text, emailed: summary.emailed, emailError: summary.emailError ?? '' }));
  }
  if (dirty) await kv.put('state', JSON.stringify(next));
  return summary;
}

// null when sound, else the first fault in words.
export function validateConfig(config) {
  if (!config || typeof config.instance !== 'string' || !/^[a-z0-9-]+$/.test(config.instance)) return 'instance must be a lowercase name';
  if (!Number.isInteger(config.maxPerRun) || config.maxPerRun < 1 || config.maxPerRun > 45) return 'maxPerRun must be an integer 1-45 (the Free plan allows 50 external subrequests per run)';
  if (!Array.isArray(config.sources) || !config.sources.length) return 'sources must be a non-empty list';
  const ids = new Set();
  for (const s of config.sources) {
    const bad = Object.keys(s).find((k) => !SOURCE_FIELDS.includes(k));
    if (bad) return `${s.id}: unknown field ${bad}`;
    if (typeof s.id !== 'string' || !/^[a-z0-9-]+$/.test(s.id)) return `source id ${JSON.stringify(s.id)} must be lowercase`;
    if (ids.has(s.id)) return `duplicate id ${s.id}`;
    ids.add(s.id);
    if (typeof s.name !== 'string' || !s.name) return `${s.id}: name missing`;
    let u;
    try { u = new URL(s.url); } catch { return `${s.id}: url is not a URL`; }
    if (u.protocol !== 'https:') return `${s.id}: url must be https`;
    if (u.username || u.password) return `${s.id}: url carries a credential`;
    if (!KINDS.includes(s.kind)) return `${s.id}: kind must be one of ${KINDS.join(', ')}`;
    if (s.everyHours !== undefined && (!Number.isInteger(s.everyHours) || s.everyHours < 1 || s.everyHours > 24)) return `${s.id}: everyHours must be an integer 1-24`;
    if (s.ignoreTitle !== undefined) { try { new RegExp(s.ignoreTitle, 'i'); } catch { return `${s.id}: ignoreTitle is not a valid pattern`; } }
  }
  return null;
}
