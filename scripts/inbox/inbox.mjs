// The GitHub event inbox (UMB-445 (2)): receives the org webhook's deliveries, keeps ONLY the events GitHub's own notifications do not cover, and sends one
// digest email per batch. Zero dependency beyond the Workers runtime (fetch/Request/Response, crypto.subtle, TextEncoder); nothing is imported.
//
// Per delivery (worker.mjs `fetch`): POST only, body capped, the X-Hub-Signature-256 MAC checked with the webhook secret in constant time BEFORE anything is
// parsed, a bad MAC refused with 401. A kept event is stored as ONE KV key (ev:<delivery id>) whose METADATA is the whole compact record, so the digest run
// reads the batch with a single list call. Per cron tick (`scheduled`): one list, ONE email for the whole batch, then the batch's keys are deleted; a failed
// send deletes nothing, so the next tick retries. Free-plan budget (Cloudflare docs read 2026-10-04): 10 ms CPU per request, 1,000 KV writes a day.

export const MAX_BODY = 1048576; // GitHub org events are a few KB; a megabyte is far past any real delivery
export const BATCH = 50; // records per digest: keeps one tick's KV calls (1 list + n deletes) well under the Free plan's internal-call budget
// What the owner's org webhook subscribes to (ten of GitHub's event names). App installations (installation, installation_repositories) are App-only: an org
// webhook is never sent them, so they are not here; the README names that gap.
export const EVENTS = ['repository', 'repository_ruleset', 'branch_protection_rule', 'branch_protection_configuration', 'deploy_key', 'member', 'membership', 'organization', 'team', 'security_and_analysis'];
const REPO_ACTIONS = new Set(['created', 'deleted', 'renamed', 'transferred', 'publicized', 'privatized', 'archived', 'unarchived']);
const DELIVERY_ID = /^[0-9a-fA-F-]{8,64}$/;
const SIGNATURE = /^sha256=([0-9a-f]{64})$/i;
const CONTROL = new RegExp('[\x00-\x1f\x7f-\x9f' + String.fromCharCode(0x2028, 0x2029) + ']', 'g'); // C0/C1 controls and the Unicode line/paragraph separators

const enc = new TextEncoder();
const txt = (s, n = 100) => (typeof s === 'string' || typeof s === 'number' ? String(s).replace(CONTROL, ' ').replace(/\s+/g, ' ').trim().slice(0, n) : '');
const hexToBytes = (h) => Uint8Array.from(h.match(/../g).map((b) => parseInt(b, 16)));

// true only for a well-formed header whose MAC matches; crypto.subtle.verify compares in constant time.
export async function verifySignature(secret, body, header) {
  const m = SIGNATURE.exec(header ?? '');
  if (!secret || !m) return false;
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, hexToBytes(m[1]), enc.encode(body));
}

const DETAIL = {
  repository: (p) => (p.action === 'renamed' ? from(p.changes?.repository?.name?.from) : p.action === 'transferred' ? from(p.changes?.owner?.from?.user?.login ?? p.changes?.owner?.from?.organization?.login) : ''),
  repository_ruleset: (p) => txt(p.repository_ruleset?.name),
  branch_protection_rule: (p) => txt(p.rule?.name),
  deploy_key: (p) => [txt(p.key?.title), typeof p.key?.read_only === 'boolean' ? (p.key.read_only ? 'read-only' : 'read-write') : ''].filter(Boolean).join(', '),
  member: (p) => txt(p.member?.login),
  membership: (p) => [txt(p.member?.login), txt(p.team?.slug)].filter(Boolean).join(', '),
  organization: (p) => (p.action === 'renamed' ? from(p.changes?.login?.from) : txt(p.invitation?.login ?? p.membership?.user?.login)),
  team: (p) => txt(p.team?.slug),
};
const from = (s) => (txt(s) ? 'from ' + txt(s) : '');

// null when the inbox does not keep this delivery, else the compact record. Only the fields named here are ever read: no address of anyone is.
export function classify(event, payload) {
  if (!EVENTS.includes(event) || !payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  if (event === 'repository' && !REPO_ACTIONS.has(payload.action)) return null;
  return {
    event,
    action: txt(payload.action, 30),
    scope: txt(payload.repository?.full_name ?? payload.organization?.login),
    sender: txt(payload.sender?.login, 40),
    detail: DETAIL[event]?.(payload) ?? '',
  };
}

export function buildDigest({ at, org, records, more }) {
  const sorted = [...records].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  const n = sorted.length;
  const lines = [`${org} GitHub inbox, ${at}`, ''];
  for (const r of sorted) lines.push(`${r.at} ${r.event}${r.action ? '.' + r.action : ''} ${r.scope}${r.detail ? ' (' + r.detail + ')' : ''}${r.sender ? ' by ' + r.sender : ''}`);
  if (more > 0) lines.push('', `${more} more event(s) are waiting and go in the next digest.`);
  return { subject: `[${org} inbox] ${n} org event${n === 1 ? '' : 's'}`, text: lines.join('\n') + '\n', json: { at, org, records: sorted, more } };
}

async function readCapped(request) {
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks = []; let got = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    got += value.length;
    if (got > MAX_BODY) { reader.cancel().catch(() => {}); return null; }
    chunks.push(value);
  }
  const all = new Uint8Array(got); let at = 0;
  for (const c of chunks) { all.set(c, at); at += c.length; }
  return new TextDecoder().decode(all);
}

const reply = (status, body = '') => new Response(body, { status });

// ctx = { kv, secret }. Order matters: method, secret present, size, MAC, only then anything the body says.
export async function handleRequest(request, { kv, secret }, now) {
  if (request.method !== 'POST') return reply(405);
  if (!secret) return reply(500);
  if (Number(request.headers.get('content-length')) > MAX_BODY) return reply(413);
  const body = await readCapped(request);
  if (body === null) return reply(413);
  if (!(await verifySignature(secret, body, request.headers.get('x-hub-signature-256')))) return reply(401);
  const event = request.headers.get('x-github-event') ?? '';
  if (event === 'ping') return reply(200, 'pong');
  const id = request.headers.get('x-github-delivery') ?? '';
  if (!DELIVERY_ID.test(id)) return reply(400);
  if (!EVENTS.includes(event)) return reply(202, 'ignored');
  let payload;
  try { payload = JSON.parse(body); } catch { return reply(400); }
  const rec = classify(event, payload);
  if (!rec) return reply(202, 'ignored');
  await kv.put('ev:' + id, '1', { metadata: { ...rec, at: new Date(now).toISOString() } });
  return reply(202, 'kept');
}

export async function runDigest({ kv, send, now, to, from, org }) {
  const listed = (await kv.list({ prefix: 'ev:', limit: 1000 })).keys.filter((k) => k.metadata);
  if (!listed.length) return { pending: 0, sent: 0, more: 0, emailed: false };
  const batch = listed.slice(0, BATCH);
  const more = listed.length - batch.length;
  const at = new Date(now).toISOString();
  const digest = buildDigest({ at, org, records: batch.map((k) => k.metadata), more });
  const out = { pending: listed.length, sent: batch.length, more, emailed: false };
  try { await send({ to, from, subject: digest.subject, text: digest.text }); out.emailed = true; } catch (e) { out.emailError = String(e?.code ?? e?.message ?? e).slice(0, 120); }
  await kv.put('digest:last', JSON.stringify({ ...digest.json, subject: digest.subject, text: digest.text, emailed: out.emailed, emailError: out.emailError ?? '' }));
  if (out.emailed) await Promise.all(batch.map((k) => kv.delete(k.name)));
  return out;
}
