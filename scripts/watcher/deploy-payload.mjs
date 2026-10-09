#!/usr/bin/env node
// Prints the body of the Cloudflare MCP `execute` call that deploys a change-watcher instance. The MCP sandbox cannot fetch from GitHub (its egress is an
// allowlist), so the three modules travel INSIDE the payload, exactly: worker.mjs, watcher.mjs and sources/<instance>.mjs (uploaded as sources.mjs). The
// payload recomputes each module's git blob id in the sandbox and refuses to write anything when one differs from the id this generator embedded, so a
// payload damaged in transit uploads nothing. It reads no credential: the MCP session holds the grant, and the destination address is read INSIDE the
// sandbox and never returned.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const INSTANCES = fs.readdirSync(path.join(HERE, 'sources')).filter((f) => f.endsWith('.mjs')).map((f) => f.slice(0, -4)).sort();
const MODULES = ['worker.mjs', 'watcher.mjs'];

export const gitBlobId = (text) => {
  const bytes = Buffer.from(text, 'utf8');
  return crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes])).digest('hex');
};

const lf = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
// `dir` is the watcher folder; the default is this one. A test points it at a fixture folder.
export function loadInstance(instance, dir = HERE) {
  const shipped = fs.readdirSync(path.join(dir, 'sources')).filter((f) => f.endsWith('.mjs')).map((f) => f.slice(0, -4)).sort();
  if (!shipped.includes(instance)) throw new Error(`unknown instance "${instance}"; the shipped lists are: ${shipped.join(', ')}`);
  return { 'worker.mjs': lf(path.join(dir, 'worker.mjs')), 'watcher.mjs': lf(path.join(dir, 'watcher.mjs')), 'sources.mjs': lf(path.join(dir, 'sources', instance + '.mjs')) };
}

export function buildPayload({ files, name, from, cron = '17 * * * *', kvId = null }) {
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(name ?? '')) throw new Error('name must be a lowercase worker name (letters, digits, hyphens)');
  if (!/^(\S+\s+){4}\S+$/.test(cron ?? '') || /[^0-9*/,\-\sA-Za-z]/.test(cron)) throw new Error('cron must be five fields, for example "17 * * * *"');
  if (!/^[^\s@"'\\]+@[^\s@"'\\]+\.[^\s@"'\\]+$/.test(from ?? '')) throw new Error('from must be a sender address such as antenna-coal@your-domain');
  if (kvId !== null && !/^[0-9a-f]{32}$/.test(kvId)) throw new Error('kvId must be a 32-hex namespace id');
  const expected = Object.fromEntries(Object.entries(files).map(([k, t]) => [k, gitBlobId(t)]));
  return `async () => {
  const texts = ${JSON.stringify(files)};
  const expected = ${JSON.stringify(expected)};
  const NAME = ${JSON.stringify(name)};
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
  let kvId = ${JSON.stringify(kvId)}; let reused = true;
  if (!kvId) {
    const list = await cloudflare.request({ method: 'GET', path: acct + '/storage/kv/namespaces', query: { per_page: 100 } });
    const found = (list.result || []).find(n => n.title === NAME + '-state');
    if (found) kvId = found.id;
    else {
      const made = await cloudflare.request({ method: 'POST', path: acct + '/storage/kv/namespaces', body: { title: NAME + '-state' } });
      if (!made.success) return { stage: 'kv namespace not created', errors: made.errors, blobs };
      kvId = made.result.id; reused = false;
    }
  }
  const metadata = {
    main_module: 'worker.mjs',
    compatibility_date: '2026-10-04',
    bindings: [
      { type: 'kv_namespace', name: 'STATE', namespace_id: kvId },
      { type: 'send_email', name: 'EMAIL', destination_address: dest.email },
      { type: 'secret_text', name: 'DIGEST_TO', text: dest.email },
      { type: 'plain_text', name: 'DIGEST_FROM', text: ${JSON.stringify(from)} },
    ],
    // invocation_logs false drops the platform's per-run record and keeps the Worker's one console line; the API requires logs.enabled beside it (schema workers_observability-2)
    observability: { enabled: true, head_sampling_rate: 1, logs: { enabled: true, invocation_logs: false } },
  };
  const b = '----watcher' + Date.now();
  const parts = ['--' + b, 'Content-Disposition: form-data; name="metadata"', 'Content-Type: application/json', '', JSON.stringify(metadata)];
  for (const [part, t] of Object.entries(texts)) parts.push('--' + b, 'Content-Disposition: form-data; name="' + part + '"; filename="' + part + '"', 'Content-Type: application/javascript+module', '', t);
  parts.push('--' + b + '--', '');
  const up = await cloudflare.request({ method: 'PUT', path: acct + '/workers/scripts/' + NAME, contentType: 'multipart/form-data; boundary=' + b, body: parts.join('\\r\\n'), rawBody: true });
  const out = { blobs, kv: { reused }, upload: { ok: up.success, status: up.status, errors: up.errors } };
  if (!up.success) return out;
  const sch = await cloudflare.request({ method: 'PUT', path: acct + '/workers/scripts/' + NAME + '/schedules', body: [{ cron: ${JSON.stringify(cron)} }] });
  out.scheduleSet = sch.success;
  const sub = await cloudflare.request({ method: 'POST', path: acct + '/workers/scripts/' + NAME + '/subdomain', body: { enabled: false, previews_enabled: false } });
  out.subdomain = sub.result;
  const set = await cloudflare.request({ method: 'GET', path: acct + '/workers/scripts/' + NAME + '/settings' });
  out.bindings = ((set.result || {}).bindings || []).map(x => x.name + ':' + x.type);
  const back = await cloudflare.request({ method: 'GET', path: acct + '/workers/scripts/' + NAME + '/schedules' });
  out.crons = ((back.result || {}).schedules || []).map(s => s.cron);
  return out;
}`;
}

const USAGE = `usage: node scripts/watcher/deploy-payload.mjs <instance> --from <sender> [--name <worker>] [--cron "<5 fields>"] [--kv-id <32 hex>] [--out <file>]
  Prints the body of the Cloudflare MCP execute call that deploys a change-watcher instance (the modules embedded, a git blob guard, the KV namespace
  found or created, the schedule set, workers.dev switched off, bindings and schedule read back). Instances: ${INSTANCES.join(', ')}.
  --name defaults to <instance>-change-watcher; --cron to "17 * * * *" (hourly). With --out the payload goes to that file and stdout carries one summary line.
  example: node scripts/watcher/deploy-payload.mjs kolwen --from antenna-llm@kolwen.com --out payload.js
  exit 0 done · 1 refused · 64 usage error`;

function main() {
  const args = process.argv.slice(2);
  if (args.includes('-h') || args.includes('--help')) { console.log(USAGE); return; }
  const opts = {}; let instance = null;
  const flags = { '--from': 'from', '--name': 'name', '--cron': 'cron', '--kv-id': 'kvId', '--out': 'out' };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (flags[a]) { opts[flags[a]] = args[++i]; if (opts[flags[a]] === undefined) { console.error(`deploy-payload: ${a} needs a value\n${USAGE}`); process.exitCode = 1; return; } }
    else if (a.startsWith('-')) { console.error(`deploy-payload: unknown flag ${a}\n${USAGE}`); process.exitCode = 1; return; }
    else if (instance === null) instance = a;
    else { console.error(`deploy-payload: unexpected argument ${a}\n${USAGE}`); process.exitCode = 1; return; }
  }
  if (!instance) { console.error(`deploy-payload: name an instance (${INSTANCES.join(', ')})\n${USAGE}`); process.exitCode = 1; return; }
  if (!opts.from) { console.error(`deploy-payload: --from <sender address> is required\n${USAGE}`); process.exitCode = 1; return; }
  try {
    const files = loadInstance(instance);
    const code = buildPayload({ files, name: opts.name ?? `${instance}-change-watcher`, from: opts.from, cron: opts.cron, kvId: opts.kvId ?? null });
    if (opts.out) {
      fs.writeFileSync(opts.out, code, 'utf8');
      console.log(`deploy-payload: ${instance}, ${code.length} characters written to ${opts.out}; blob ids ${Object.entries(files).map(([k, t]) => `${k}=${gitBlobId(t)}`).join(' ')}`);
    } else process.stdout.write(code);
  } catch (e) {
    console.error(`deploy-payload: ${e.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();