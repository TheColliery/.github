// The Worker entry. Deployed with `sources.mjs` beside it: the instance's source list, copied from sources/<instance>.mjs at deploy time, so this
// file is the same for every Cloudflare account and the list is the only thing that differs.
import config from './sources.mjs';
import { runOnce, validateConfig } from './watcher.mjs';

async function tick(event, env) {
  const fault = validateConfig(config);
  if (fault) { console.error(JSON.stringify({ watcher: config?.instance, configFault: fault })); return; }
  try {
    const summary = await runOnce({
      config, kv: env.STATE, fetchFn: (url, init) => fetch(url, init), send: (m) => env.EMAIL.send(m),
      now: event.scheduledTime, to: env.DIGEST_TO, from: env.DIGEST_FROM,
    });
    console.log(JSON.stringify({ watcher: config.instance, at: new Date(event.scheduledTime).toISOString(), ...summary }));
  } catch (e) {
    console.error(JSON.stringify({ watcher: config.instance, error: String(e?.message ?? e).slice(0, 200) }));
  }
}

export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(tick(event, env)); },
};
