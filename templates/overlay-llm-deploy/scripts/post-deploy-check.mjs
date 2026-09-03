// {{TOOL}} post-deploy smoke check — is what is SERVED what we committed?
//
// Closes the same class Kolwen's LWK-077 O1-O3 closed: Workers Builds deploys on push,
// outside Actions, and has silently produced no build at all before (a real incident:
// a stale page served until a human curled it).
//
// Sourced verbatim (mechanism) from Kolwen's live scripts/post-deploy-check.mjs
// (LLMWorks/Kolwen, read 2026-09-03, UMB-045 letter (D)). The ORIGINS list and the
// assets directory are {{PLACEHOLDER}}s — fill with this tool's own domain(s) and dir.
//
// Usage: node scripts/post-deploy-check.mjs [--wait <seconds>]
// Exit 0 = every deployed file matches. Exit 1 = a mismatch, or nothing could be observed.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';

const args = process.argv.slice(2);
const w = args.indexOf('--wait');
// --wait with no value must never yield NaN silently — the loop would never run, and the
// script would print the exact words of a real outage. The one message this must be
// incapable of faking.
let budget = 240;
if (w >= 0) {
  const v = Number(args[w + 1]);
  if (!Number.isFinite(v) || v <= 0) { console.error(`--wait needs a positive number, got ${JSON.stringify(args[w + 1])}`); process.exit(2); }
  budget = v;
}

// A datacenter-egress-hostile edge (Kolwen measured this live: kolwen.com refuses
// GitHub-runner IPs with HTTP 403, 200 from a residential IP) may block CI entirely even
// though the deploy is fine. Try a fallback origin (e.g. the workers.dev subdomain) if the
// primary refuses. If NEITHER answers, that is an observation failure — never a pass.
const ORIGINS = [
  'https://{{PLACEHOLDER-primary-domain}}/',
  'https://{{PLACEHOLDER-fallback-workers-dev-domain}}/',
];

// Strip Cloudflare's injected script STRUCTURALLY — any script mentioning /cdn-cgi/ or its
// __CF$cv$params global — rather than by a byte-prefix of today's minified output. A literal
// prefix breaks the day the edge changes its bundler, reddening a correct deploy.
const CF_INJECT = /<script\b[^>]*>(?:(?!<\/script>)[\s\S])*?(?:\/cdn-cgi\/|__CF\$cv\$params)(?:(?!<\/script>)[\s\S])*?<\/script>/g;
// Applied to a FIXED POINT, not once — closes the iterate-once case where removing one
// match reveals another (CodeQL js/incomplete-multi-character-sanitization). It does NOT
// close the reassembly case (a stripped match can weld into a fresh unmatched "<script"),
// survivable here only because this output is compared for equality and never re-served
// as HTML. The loop is an improvement, not a sanitizer.
const stripEdge = t => { let prev; do { prev = t; t = t.replace(CF_INJECT, ''); } while (t !== prev); return t; };
const normHtml = t => stripEdge(t.replace(/\r\n/g, '\n')).replace(/\n{2,}/g, '\n').trim();
const sha = b => createHash('sha256').update(b).digest('hex').slice(0, 16);

// The assets directory the trigger covers must match what this walks — checking only
// index.html would print "deploy confirmed" for a commit that changed a different file and
// never looked at it.
const ASSETS_DIR = '{{ASSETS_DIR}}';
const files = readdirSync(ASSETS_DIR).filter(f => statSync(`${ASSETS_DIR}/${f}`).isFile());
const TEXT = /\.(html|xml|txt|svg|json)$/i;

async function probe(origin) {
  const misses = [];
  for (const f of files) {
    const url = origin + (f === 'index.html' ? '' : f) + '?cb=' + Date.now();
    const r = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
    if (!r.ok) throw new Error(`HTTP ${r.status} on ${f}`);
    if (TEXT.test(f)) {
      const live = normHtml(await r.text());
      const want = normHtml(readFileSync(`${ASSETS_DIR}/${f}`, 'utf8'));
      if (live !== want) misses.push(`${f}: served ${live.length} chars, committed ${want.length}`);
    } else {
      const live = sha(Buffer.from(await r.arrayBuffer()));
      const want = sha(readFileSync(`${ASSETS_DIR}/${f}`));
      if (live !== want) misses.push(`${f}: served sha ${live}, committed ${want}`);
    }
  }
  return misses;
}

// The wait is for PUBLICATION, not merely reachability. A gate that stops on the first
// origin that merely ANSWERS compares against the PREVIOUS page while a deploy is still in
// flight and goes red on a commit that is in fact fine. A mismatch RETRIES until the
// budget runs out; only the final state is reported.
const started = Date.now();
let matched = false, lastMisses = null, lastErr = {};
while (!matched && (Date.now() - started) / 1000 < budget) {
  for (const origin of ORIGINS) {
    try {
      const misses = await probe(origin);
      if (misses.length === 0) {
        console.log(`all ${files.length} deployed files match what is committed, via ${origin}`);
        matched = true;
      } else {
        lastMisses = { origin, misses };
      }
      break;
    } catch (e) { lastErr[origin] = e.message; }
  }
  if (matched) break;
  await new Promise(r => setTimeout(r, 15000));
}

if (matched) {
  process.exitCode = 0;
} else if (lastMisses) {
  const waited = Math.round((Date.now() - started) / 1000);
  console.error(`post-deploy check FAILED via ${lastMisses.origin} — still not published after ${waited}s:`);
  lastMisses.misses.forEach(m => console.error('  - ' + m));
  process.exitCode = 1;
} else {
  console.error(`post-deploy check could not OBSERVE anything after ${budget}s — this is a reachability failure, not a staleness one:`);
  for (const o of ORIGINS) console.error(`  ${o} -> ${lastErr[o] || 'no attempt completed'}`);
  console.error('  A gate that cannot see must not report success. Failing.');
  process.exitCode = 1;
}
