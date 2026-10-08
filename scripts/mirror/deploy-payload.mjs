#!/usr/bin/env node
// Prints the body of the Cloudflare MCP `execute` call that deploys the Release mirror. Same shape as scripts/watcher/deploy-payload.mjs: the modules travel
// INSIDE the payload (the MCP sandbox cannot fetch from GitHub) behind a git blob guard that refuses to write when any module differs from the id embedded
// here. It finds or creates the R2 bucket, uploads the Worker with the bucket binding (no R2 token exists: the binding is the grant), sets the schedule,
// switches workers.dev off (the Worker has no fetch handler), attaches the bucket's custom domain on the zone you name, and reads it all back.
// Only the custom domain's own DNS record is created by the attach; no other record of the zone is read for writing or touched.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitBlobId } from '../watcher/deploy-payload.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const lf = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
export const loadFiles = (dir = HERE) => Object.fromEntries(['worker.mjs', 'mirror.mjs', 'config.mjs'].map((f) => [f, lf(path.join(dir, f))]));

export function buildPayload({ files, name, bucket, domain, zone, from, cron = '23 * * * *' }) {
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(name ?? '')) throw new Error('name must be a lowercase worker name (letters, digits, hyphens)');
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket ?? '')) throw new Error('bucket must be a lowercase R2 bucket name (3-63 letters, digits, hyphens)');
  if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(domain ?? '') || !/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(zone ?? '') || !(domain === zone || domain.endsWith('.' + zone))) throw new Error('domain must be a hostname inside the zone, for example dl.thecolliery.org in thecolliery.org');
  if (!/^[^\s@"'\\]+@[^\s@"'\\]+\.[^\s@"'\\]+$/.test(from ?? '')) throw new Error('from must be a sender address such as antenna-coal@your-domain');
  if (!/^(\S+\s+){4}\S+$/.test(cron ?? '') || /[^0-9*/,\-\sA-Za-z]/.test(cron)) throw new Error('cron must be five fields, for example "23 * * * *"');
  const expected = Object.fromEntries(Object.entries(files).map(([k, t]) => [k, gitBlobId(t)]));
  return `async () => {
  const texts = ${JSON.stringify(files)};
  const expected = ${JSON.stringify(expected)};
  const NAME = ${JSON.stringify(name)};
  const BUCKET = ${JSON.stringify(bucket)};
  const DOMAIN = ${JSON.stringify(domain)};
  const blobs = {};
  for (const [part, t] of Object.entries(texts)) {
    const bytes = new TextEncoder().encode(t);
    const head = new TextEncoder().encode('blob ' + bytes.length + '\\0');
    const all = new Uint8Array(head.length + bytes.length); all.set(head); all.set(bytes, head.length);
    blobs[part] = [...new Uint8Array(await crypto.subtle.digest('SHA-1', all))].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  const mismatch = Object.keys(expected).filter(k => blobs[k] !== expected[k]);
  if (mismatch.length) return { stage: 'blob mismatch, nothing written', mismatch, blobs };
  const acct = '/accounts/' + accountId;
  const zones = await cloudflare.request({ method: 'GET', path: '/zones', query: { name: ${JSON.stringify(zone)}, status: 'active' } });
  const zoneRow = (zones.result || [])[0];
  if (!zoneRow) return { stage: 'no active zone named ${zone}, nothing written', blobs };
  const addrs = await cloudflare.request({ method: 'GET', path: acct + '/email/routing/addresses' });
  const dest = (addrs.result || []).find(a => a.verified);
  if (!dest) return { stage: 'no verified destination address, nothing written', blobs };
  const out = { blobs };
  const have = await cloudflare.request({ method: 'GET', path: acct + '/r2/buckets' });
  const names = ((have.result || {}).buckets || have.result || []).map(b => b.name);
  out.bucket = { name: BUCKET, reused: names.includes(BUCKET) };
  if (!out.bucket.reused) {
    const made = await cloudflare.request({ method: 'POST', path: acct + '/r2/buckets', body: { name: BUCKET } });
    if (!made.success) return { stage: 'bucket not created', errors: made.errors, blobs };
  }
  const metadata = { main_module: 'worker.mjs', compatibility_date: new Date(Date.now() - 864e5).toISOString().slice(0, 10), bindings: [
    { type: 'r2_bucket', name: 'BUCKET', bucket_name: BUCKET },
    { type: 'send_email', name: 'EMAIL', destination_address: dest.email },
    { type: 'secret_text', name: 'DIGEST_TO', text: dest.email },
    { type: 'plain_text', name: 'DIGEST_FROM', text: ${JSON.stringify(from)} },
  ], observability: { enabled: true } };
  const b = '----mirror' + Date.now();
  const parts = ['--' + b, 'Content-Disposition: form-data; name="metadata"', 'Content-Type: application/json', '', JSON.stringify(metadata)];
  for (const [part, t] of Object.entries(texts)) parts.push('--' + b, 'Content-Disposition: form-data; name="' + part + '"; filename="' + part + '"', 'Content-Type: application/javascript+module', '', t);
  parts.push('--' + b + '--', '');
  const up = await cloudflare.request({ method: 'PUT', path: acct + '/workers/scripts/' + NAME, contentType: 'multipart/form-data; boundary=' + b, body: parts.join('\\r\\n'), rawBody: true });
  out.upload = { ok: up.success, status: up.status, errors: up.errors };
  if (!up.success) return out;
  const sch = await cloudflare.request({ method: 'PUT', path: acct + '/workers/scripts/' + NAME + '/schedules', body: [{ cron: ${JSON.stringify(cron)} }] });
  out.scheduleSet = sch.success;
  const sub = await cloudflare.request({ method: 'POST', path: acct + '/workers/scripts/' + NAME + '/subdomain', body: { enabled: false, previews_enabled: false } });
  out.subdomain = sub.result;
  const doms = await cloudflare.request({ method: 'GET', path: acct + '/r2/buckets/' + BUCKET + '/domains/custom' });
  const attached = ((doms.result || {}).domains || []).some(d => d.domain === DOMAIN);
  out.domain = { name: DOMAIN, alreadyAttached: attached };
  if (!attached) {
    const att = await cloudflare.request({ method: 'POST', path: acct + '/r2/buckets/' + BUCKET + '/domains/custom', body: { domain: DOMAIN, zoneId: zoneRow.id, enabled: true, minTLS: '1.2' } });
    out.domain.attached = att.success; out.domain.errors = att.errors;
  }
  const set = await cloudflare.request({ method: 'GET', path: acct + '/workers/scripts/' + NAME + '/settings' });
  out.bindings = ((set.result || {}).bindings || []).map(x => x.name + ':' + x.type);
  const back = await cloudflare.request({ method: 'GET', path: acct + '/workers/scripts/' + NAME + '/schedules' });
  out.crons = ((back.result || {}).schedules || []).map(s => s.cron);
  return out;
}`;
}

const USAGE = `usage: node scripts/mirror/deploy-payload.mjs --bucket <name> --domain <host> --zone <zone> --from <sender> [--name <worker>] [--cron "<5 fields>"] [--out <file>]
  Prints the body of the Cloudflare MCP execute call that deploys the Release mirror (modules embedded behind a git blob guard, R2 bucket found or created,
  Worker with the BUCKET binding, schedule, workers.dev off, the bucket's custom domain attached, everything read back).
  --from is the sender of the failure mail (the beat's antenna address, for example antenna-coal@thecolliery.org); the destination is the account's verified Email Routing address, read in the sandbox and never returned.
  --name defaults to thecolliery-release-mirror; --cron to "23 * * * *" (hourly).
  example: node scripts/mirror/deploy-payload.mjs --bucket thecolliery-releases --domain dl.thecolliery.org --zone thecolliery.org --from antenna-coal@thecolliery.org --out payload.js
  exit 0 done · 1 refused`;

function main() {
  const args = process.argv.slice(2);
  if (args.includes('-h') || args.includes('--help')) { console.log(USAGE); return; }
  const opts = {};
  const flags = { '--bucket': 'bucket', '--domain': 'domain', '--zone': 'zone', '--from': 'from', '--name': 'name', '--cron': 'cron', '--out': 'out' };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (flags[a]) { opts[flags[a]] = args[++i]; if (opts[flags[a]] === undefined) { console.error(`deploy-payload: ${a} needs a value\n${USAGE}`); process.exitCode = 1; return; } }
    else { console.error(`deploy-payload: unexpected argument ${a}\n${USAGE}`); process.exitCode = 1; return; }
  }
  if (!opts.bucket || !opts.domain || !opts.zone || !opts.from) { console.error(`deploy-payload: --bucket, --domain, --zone and --from are required\n${USAGE}`); process.exitCode = 1; return; }
  try {
    const files = loadFiles();
    const code = buildPayload({ files, name: opts.name ?? 'thecolliery-release-mirror', bucket: opts.bucket, domain: opts.domain, zone: opts.zone, from: opts.from, cron: opts.cron });
    if (opts.out) {
      fs.writeFileSync(opts.out, code, 'utf8');
      console.log(`deploy-payload: mirror, ${code.length} characters written to ${opts.out}; blob ids ${Object.entries(files).map(([k, t]) => `${k}=${gitBlobId(t)}`).join(' ')}`);
    } else process.stdout.write(code);
  } catch (e) {
    console.error(`deploy-payload: ${e.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
