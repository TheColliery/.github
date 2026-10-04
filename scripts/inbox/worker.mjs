// The Worker entry for the GitHub event inbox. `fetch` is the org webhook's payload URL; `scheduled` sends the digest. Bindings: STATE (KV), EMAIL
// (send_email), WEBHOOK_SECRET (secret), DIGEST_TO (secret), DIGEST_FROM and ORG (plain text).
import { handleRequest, runDigest } from './inbox.mjs';

async function tick(event, env) {
  try {
    const summary = await runDigest({ kv: env.STATE, send: (m) => env.EMAIL.send(m), now: event.scheduledTime, to: env.DIGEST_TO, from: env.DIGEST_FROM, org: env.ORG || 'org' });
    console.log(JSON.stringify({ inbox: env.ORG, at: new Date(event.scheduledTime).toISOString(), ...summary }));
  } catch (e) {
    console.error(JSON.stringify({ inbox: env.ORG, error: String(e?.message ?? e).slice(0, 200) }));
  }
}

export default {
  async fetch(request, env) {
    try {
      const res = await handleRequest(request, { kv: env.STATE, secret: env.WEBHOOK_SECRET }, Date.now());
      console.log(JSON.stringify({ inbox: env.ORG, status: res.status }));
      return res;
    } catch (e) {
      console.error(JSON.stringify({ inbox: env.ORG, error: String(e?.message ?? e).slice(0, 200) }));
      return new Response('', { status: 500 });
    }
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(tick(event, env)); },
};
