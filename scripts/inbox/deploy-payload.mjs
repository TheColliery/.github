#!/usr/bin/env node
// Prints the body of the Cloudflare MCP `execute` call that deploys the GitHub event inbox. Same shape as scripts/watcher/deploy-payload.mjs: the modules
// travel INSIDE the payload (the MCP sandbox cannot fetch from GitHub), a git blob guard refuses to write when any module differs from the id embedded here,
// and the verified destination address is read inside the sandbox and never returned.
//
// The webhook secret never passes through chat. On a first deploy the SANDBOX draws it (32 random bytes), binds it to the Worker as a secret, and writes the
// same value to ONE key of the Worker's KV namespace with a time-to-live (setup:webhook-secret, 3 days). The owner copies it from the Cloudflare dashboard
// (Storage & databases > KV > the namespace) into the GitHub webhook form; the key expires on its own. The payload returns the mode and the lifetime, never
// the value. A redeploy keeps the existing secret (an `inherit` binding); --rotate draws a new one.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitBlobId } from '../watcher/deploy-payload.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SECRET_KEY = 'setup:webhook-secret';
export const SECRET_TTL = 259200; // 3 days, in seconds

const lf = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
export const loadFiles = (dir = HERE) => ({ 'worker.mjs': lf(path.join(dir, 'worker.mjs')), 'inbox.mjs': lf(path.join(dir, 'inbox.mjs')) });

export function buildPayload({ files, name, from, org, cron = '41 * * * *', rotate = false }) {
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(name ?? '')) throw new Error('name must be a lowercase worker name (letters, digits, hyphens)');
  if (!/^(\S+\s+){4}\S+$/.test(cron ?? '') || /[^0-9*/,\-\sA-Za-z]/.test(cron)) throw new Error('cron must be five fields, for example "41 * * * *"');
  if (!/^[^\s@"'\\]+@[^\s@"'\\]+\.[^\s@"'\\]+$/.test(from ?? '')) throw new Error('from must be a sender address such as inbox@your-domain');
  if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(org ?? '')) throw new Error('org must be a GitHub organization name');
  const expected = Object.fromEntries(Object.entries(files).map(([k, t]) => [k, gitBlobId(t)]));
  return `async () => {
  const texts = ${JSON.stringify(files)};
  const expected = ${JSON.stringify(expected)};
  const NAME = ${JSON.stringify(name)};
  const ROTATE = ${rotate ? 'true' : 'false'};
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
  const addrs = await cloudflare.request({ method: 'GET', path: acct + '/email/routing/addresses' });
  const dest = (addrs.result || []).find(a => a.verified);
  if (!dest) return { stage: 'no verified destination address, nothing written', blobs };
  let hadSecret = false;
  try {
    const cur = await cloudflare.request({ method: 'GET', path: acct + '/workers/scripts/' + NAME + '/settings' });
    hadSecret = ((cur.result || {}).bindings || []).some(x => x.name === 'WEBHOOK_SECRET');
  } catch (e) {
    // only "no such Worker" means a first deploy; any other failure must not look like one, or a blip would rotate a secret GitHub already holds
    const msg = String(e && e.message || e);
    if (!/10007|not found|does not exist/i.test(msg)) return { stage: 'settings read failed, nothing written', error: msg.slice(0, 160), blobs };
    hadSecret = false;
  }
  let kvId; let reused = true;
  const list = await cloudflare.request({ method: 'GET', path: acct + '/storage/kv/namespaces', query: { per_page: 100 } });
  const found = (list.result || []).find(n => n.title === NAME + '-state');
  if (found) kvId = found.id;
  else {
    const made = await cloudflare.request({ method: 'POST', path: acct + '/storage/kv/namespaces', body: { title: NAME + '-state' } });
    if (!made.success) return { stage: 'kv namespace not created', errors: made.errors, blobs };
    kvId = made.result.id; reused = false;
  }
  let secret = null;
  let secretBinding;
  if (hadSecret && !ROTATE) secretBinding = { type: 'inherit', name: 'WEBHOOK_SECRET' };
  else {
    secret = [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, '0')).join('');
    secretBinding = { type: 'secret_text', name: 'WEBHOOK_SECRET', text: secret };
  }
  const metadata = {
    main_module: 'worker.mjs',
    compatibility_date: '2026-10-04',
    bindings: [
      { type: 'kv_namespace', name: 'STATE', namespace_id: kvId },
      { type: 'send_email', name: 'EMAIL', destination_address: dest.email },
      { type: 'secret_text', name: 'DIGEST_TO', text: dest.email },
      { type: 'plain_text', name: 'DIGEST_FROM', text: ${JSON.stringify(from)} },
      { type: 'plain_text', name: 'ORG', text: ${JSON.stringify(org)} },
      secretBinding,
    ],
    observability: { enabled: true },
  };
  const b = '----inbox' + Date.now();
  const parts = ['--' + b, 'Content-Disposition: form-data; name="metadata"', 'Content-Type: application/json', '', JSON.stringify(metadata)];
  for (const [part, t] of Object.entries(texts)) parts.push('--' + b, 'Content-Disposition: form-data; name="' + part + '"; filename="' + part + '"', 'Content-Type: application/javascript+module', '', t);
  parts.push('--' + b + '--', '');
  const up = await cloudflare.request({ method: 'PUT', path: acct + '/workers/scripts/' + NAME, contentType: 'multipart/form-data; boundary=' + b, body: parts.join('\\r\\n'), rawBody: true });
  const out = { blobs, kv: { reused }, upload: { ok: up.success, status: up.status, errors: up.errors } };
  if (!up.success) return out;
  out.secret = { mode: secret ? 'generated' : 'kept', kvKey: secret ? ${JSON.stringify(SECRET_KEY)} : null, ttlSeconds: secret ? ${SECRET_TTL} : null };
  if (secret) {
    const put = await cloudflare.request({ method: 'PUT', path: acct + '/storage/kv/namespaces/' + kvId + '/values/' + encodeURIComponent(${JSON.stringify(SECRET_KEY)}), query: { expiration_ttl: ${SECRET_TTL} }, contentType: 'text/plain', body: secret, rawBody: true });
    out.secret.kvWritten = put.success;
  }
  const sch = await cloudflare.request({ method: 'PUT', path: acct + '/workers/scripts/' + NAME + '/schedules', body: [{ cron: ${JSON.stringify(cron)} }] });
  out.scheduleSet = sch.success;
  const sub = await cloudflare.request({ method: 'POST', path: acct + '/workers/scripts/' + NAME + '/subdomain', body: { enabled: true, previews_enabled: false } });
  out.subdomain = sub.result;
  const acctSub = await cloudflare.request({ method: 'GET', path: acct + '/workers/subdomain' });
  const host = (acctSub.result || {}).subdomain;
  out.url = host ? 'https://' + NAME + '.' + host + '.workers.dev/' : null;
  const set = await cloudflare.request({ method: 'GET', path: acct + '/workers/scripts/' + NAME + '/settings' });
  out.bindings = ((set.result || {}).bindings || []).map(x => x.name + ':' + x.type);
  const back = await cloudflare.request({ method: 'GET', path: acct + '/workers/scripts/' + NAME + '/schedules' });
  out.crons = ((back.result || {}).schedules || []).map(s => s.cron);
  out.probe = {};
  if (out.url) {
    for (const [label, init] of [['getStatus', { method: 'GET' }], ['unsignedPostStatus', { method: 'POST', body: '{}' }]]) {
      try { out.probe[label] = (await fetch(out.url, { ...init, signal: AbortSignal.timeout(8000) })).status; } catch (e) { out.probe[label] = 'unreachable: ' + String(e && e.message || e).slice(0, 80); }
    }
  }
  return out;
}`;
}

const USAGE = `usage: node scripts/inbox/deploy-payload.mjs --from <sender> --org <github org> [--name <worker>] [--cron "<5 fields>"] [--rotate] [--out <file>]
  Prints the body of the Cloudflare MCP execute call that deploys the GitHub event inbox (modules embedded, git blob guard, KV namespace found or created,
  webhook secret drawn in the sandbox and left for the owner in a 3-day KV key, schedule set, workers.dev on, bindings and schedule read back, two probes).
  --name defaults to <org lowercased>-github-inbox; --cron to "41 * * * *" (hourly digest); --rotate draws a new webhook secret.
  example: node scripts/inbox/deploy-payload.mjs --from inbox@thecolliery.org --org TheColliery --out payload.js
  exit 0 done · 1 refused`;

function main() {
  const args = process.argv.slice(2);
  if (args.includes('-h') || args.includes('--help')) { console.log(USAGE); return; }
  const opts = {};
  const flags = { '--from': 'from', '--org': 'org', '--name': 'name', '--cron': 'cron', '--out': 'out' };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--rotate') opts.rotate = true;
    else if (flags[a]) { opts[flags[a]] = args[++i]; if (opts[flags[a]] === undefined) { console.error(`deploy-payload: ${a} needs a value\n${USAGE}`); process.exitCode = 1; return; } }
    else { console.error(`deploy-payload: unexpected argument ${a}\n${USAGE}`); process.exitCode = 1; return; }
  }
  if (!opts.from || !opts.org) { console.error(`deploy-payload: --from and --org are required\n${USAGE}`); process.exitCode = 1; return; }
  try {
    const files = loadFiles();
    const code = buildPayload({ files, name: opts.name ?? `${opts.org.toLowerCase()}-github-inbox`, from: opts.from, org: opts.org, cron: opts.cron, rotate: !!opts.rotate });
    if (opts.out) {
      fs.writeFileSync(opts.out, code, 'utf8');
      console.log(`deploy-payload: inbox, ${code.length} characters written to ${opts.out}; blob ids ${Object.entries(files).map(([k, t]) => `${k}=${gitBlobId(t)}`).join(' ')}`);
    } else process.stdout.write(code);
  } catch (e) {
    console.error(`deploy-payload: ${e.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
