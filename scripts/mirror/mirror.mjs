// The Release mirror (UMB-445, BB-30 "ลิงก์เดียว"): copies the org repositories' newest Releases from GitHub into an R2 bucket served on a forge hostname,
// under <repo>/<tag>/<file>, and keeps the latest `keep` releases per repository. Zero dependency beyond the Workers runtime and the R2 binding; no R2 token
// (the binding is the grant) and no GitHub credential (public reads only).
//
// Per run (worker.mjs calls runOnce once per Cron tick): read each repository's releases.atom for its newest tags; for a tag with no marker
// (.mirror/<repo>/<tag>.json) read the release page's asset list once (HTML, not the REST API: GitHub's API answers a Workers address 403 from its shared unauthenticated limit, measured 2026-10-04), copy each asset through the binding with the checksum GitHub published enforced by R2,
// and write the marker LAST, so a half-copied release is finished next run and never looks done. Then delete, by name, every key of that repository whose tag
// is no longer among the newest `keep`. Free-plan budget (Cloudflare docs read 2026-10-05): 50 external subrequests per invocation, so BUDGET stops the run
// early and the remainder waits for the next tick; R2 binding calls are not external subrequests.

export const USER_AGENT = 'TheColliery-release-mirror/1 (+https://thecolliery.org)';
export const BUDGET = 45; // external fetches per run, 5 under the Free plan's 50
const DOWNLOAD_COST = 2; // an asset URL redirects to the CDN: count both hops
const FETCH_TIMEOUT_MS = 15000;
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$/;
const REPO = /^[A-Za-z0-9._-]{1,100}$/;
const ORG = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/;
const SHA256 = /^sha256:([0-9a-f]{64})$/;
const MARKER_DIR = '.mirror';
const LAST_RUN = `${MARKER_DIR}/last-run.json`;

const safeSegment = (s) => typeof s === 'string' && SEGMENT.test(s) && s !== '.' && s !== '..' && !s.includes('..');

// a name for one object key: every segment must be a plain name, never a path
export function assetKey(repo, tag, file) {
  for (const s of [repo, tag, file]) if (!safeSegment(s)) throw new Error('unsafe key segment ' + JSON.stringify(String(s).slice(0, 40)));
  return `${repo}/${tag}/${file}`;
}

// newest-first tags of a releases.atom, once each; a tag that could not be one safe key segment is left out
export function parseTags(text) {
  const tags = [];
  for (const m of String(text).matchAll(/<entry[\s>][\s\S]*?<\/entry>/gi)) {
    const href = /<link\b[^>]*\bhref="[^"]*\/releases\/tag\/([^"]+)"/i.exec(m[0]);
    if (!href) continue;
    let tag;
    try { tag = decodeURIComponent(href[1]); } catch { continue; }
    if (safeSegment(tag) && !tags.includes(tag)) tags.push(tag);
  }
  return tags;
}

// the downloads listed on a release page (releases/expanded_assets/<tag>): one <li> per file, a download link of THIS release and, when GitHub shows it, the
// file's sha256. A source-archive link, another release's file, a nested path and a repeat are not assets.
export function parseAssets(html, { org, repo, tag }) {
  const base = `/${org}/${repo}/releases/download/${tag}/`;
  const out = []; const seen = new Set();
  for (const block of String(html).split(/<li[\s>]/i).slice(1)) {
    const href = /href="([^"]+)"/i.exec(block);
    if (!href) continue;
    let path;
    try { path = decodeURIComponent(href[1]); } catch { continue; }
    if (!path.startsWith(base)) continue;
    const name = path.slice(base.length);
    if (!name || name.includes('/') || seen.has(name)) continue;
    seen.add(name);
    const digest = /sha256:([0-9a-f]{64})/.exec(block);
    out.push({ name, url: `https://github.com/${org}/${repo}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(name)}`, digest: digest ? digest[1] : null });
  }
  return out;
}

const TYPES = { zip: 'application/zip', txt: 'text/plain; charset=utf-8', md: 'text/markdown; charset=utf-8', json: 'application/json', gz: 'application/gzip', tgz: 'application/gzip' };
const typeOf = (name) => TYPES[name.split('.').pop().toLowerCase()] ?? 'application/octet-stream';

// null when sound, else the first fault in words.
export function validateConfig(config) {
  if (!config || typeof config.org !== 'string' || !ORG.test(config.org)) return 'org must be a GitHub organization name';
  if (!Number.isInteger(config.keep) || config.keep < 1 || config.keep > 5) return 'keep must be an integer 1-5';
  if (!Array.isArray(config.repos) || !config.repos.length) return 'repos must be a non-empty list';
  const seen = new Set();
  for (const r of config.repos) {
    if (typeof r !== 'string' || !REPO.test(r) || !safeSegment(r)) return `repo ${JSON.stringify(r)} must be a plain repository name`;
    if (seen.has(r)) return `duplicate repo ${r}`;
    seen.add(r);
  }
  return null;
}

const get = (fetchFn, url, accept) => fetchFn(url, { headers: { 'user-agent': USER_AGENT, ...(accept ? { accept } : {}) }, redirect: 'follow', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });

async function pruneRepo(bucket, repo, keep) {
  const doomed = [];
  for (const prefix of [`${repo}/`, `${MARKER_DIR}/${repo}/`]) {
    let cursor;
    do {
      const page = await bucket.list({ prefix, cursor, limit: 1000 });
      for (const o of page.objects) {
        const seg = o.key.split('/');
        const tag = prefix === `${repo}/` ? seg[1] : (seg[2] ?? '').replace(/\.json$/, '');
        if (!keep.includes(tag)) doomed.push(o.key);
      }
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
  }
  for (let i = 0; i < doomed.length; i += 1000) await bucket.delete(doomed.slice(i, i + 1000));
  return doomed.length;
}

// one asset: skip when the bucket already holds it with the same published checksum recorded, else stream it in with that checksum enforced by R2 (without a
// published checksum the stored length must equal the length the server announced); the checksum is recorded on the object for the next run's skip.
async function copyAsset({ bucket, fetchFn, key, asset }) {
  if (asset.digest) {
    const have = await bucket.head(key);
    if (have?.customMetadata?.sha256 === asset.digest) return { ok: true, copied: false, size: have.size };
  }
  const res = await get(fetchFn, asset.url);
  if (!res.ok) return { ok: false, error: `download HTTP ${res.status}`, cost: DOWNLOAD_COST };
  const opts = { httpMetadata: { contentType: typeOf(asset.name) } };
  if (asset.digest) { opts.sha256 = asset.digest; opts.customMetadata = { sha256: asset.digest }; }
  const announced = Number(res.headers.get('content-length'));
  const body = Number.isInteger(announced) && announced > 0 ? res.body : await res.arrayBuffer();
  let stored;
  try { stored = await bucket.put(key, body, opts); } catch { return { ok: false, error: 'put refused (checksum or length)', cost: DOWNLOAD_COST }; }
  if (Number.isInteger(announced) && announced > 0 && stored.size !== announced) { await bucket.delete(key); return { ok: false, error: 'stored length differs from the announced length', cost: DOWNLOAD_COST }; }
  return { ok: true, copied: true, size: stored.size, cost: DOWNLOAD_COST };
}

export async function runOnce({ config, bucket, fetchFn, now }) {
  const out = { at: new Date(now).toISOString(), repos: config.repos.length, copied: 0, releasesDone: 0, deferred: 0, pruned: 0, errors: 0, problems: [] };
  let left = BUDGET;
  const note = (repo, tag, what) => { out.errors++; if (out.problems.length < 10) out.problems.push(`${repo}${tag ? '@' + tag : ''}: ${what}`); };
  const wanted = [];
  for (const repo of config.repos) {
    if (left < 1) { out.deferred++; continue; }
    left--;
    try {
      const res = await get(fetchFn, `https://github.com/${config.org}/${repo}/releases.atom`);
      if (!res.ok) { note(repo, '', `feed HTTP ${res.status}`); continue; }
      const tags = parseTags(await res.text()).slice(0, config.keep);
      if (tags.length) wanted.push({ repo, tags });
    } catch (e) { note(repo, '', 'feed ' + String(e?.message ?? e).slice(0, 80)); }
  }
  for (const { repo, tags } of wanted) {
    for (const tag of tags) {
      if (await bucket.head(`${MARKER_DIR}/${repo}/${tag}.json`)) continue;
      if (left < 1 + DOWNLOAD_COST) { out.deferred++; continue; }
      left--;
      let assets;
      try {
        const res = await get(fetchFn, `https://github.com/${config.org}/${repo}/releases/expanded_assets/${encodeURIComponent(tag)}`, 'text/html');
        if (!res.ok) { note(repo, tag, `release page HTTP ${res.status}`); continue; }
        assets = parseAssets(await res.text(), { org: config.org, repo, tag });
      } catch (e) { note(repo, tag, 'release page ' + String(e?.message ?? e).slice(0, 80)); continue; }
      let complete = true; const files = [];
      for (const asset of assets) {
        let key;
        try { key = assetKey(repo, tag, asset.name); } catch { note(repo, tag, 'unsafe asset name'); complete = false; continue; }
        if (left < DOWNLOAD_COST) { complete = false; out.deferred++; break; }
        let r;
        try { r = await copyAsset({ bucket, fetchFn, key, asset }); } catch (e) { r = { ok: false, error: String(e?.message ?? e).slice(0, 80), cost: DOWNLOAD_COST }; }
        left -= r.cost ?? 0;
        if (!r.ok) { complete = false; note(repo, tag, `${asset.name}: ${r.error}`); continue; }
        if (r.copied) out.copied++;
        files.push({ name: asset.name, size: r.size });
      }
      if (complete) { await bucket.put(`${MARKER_DIR}/${repo}/${tag}.json`, JSON.stringify({ repo, tag, files, at: out.at })); out.releasesDone++; }
    }
    out.pruned += await pruneRepo(bucket, repo, tags);
  }
  await bucket.put(LAST_RUN, JSON.stringify(out));
  return out;
}
