// The Worker entry for the Release mirror: no fetch handler (the bucket is served by its custom domain, not by this Worker), one scheduled handler.
// Bindings: BUCKET (r2_bucket).
import config from './config.mjs';
import { runOnce, validateConfig } from './mirror.mjs';

async function tick(event, env) {
  const fault = validateConfig(config);
  if (fault) { console.error(JSON.stringify({ mirror: config?.org, configFault: fault })); return; }
  try {
    const { problems, ...summary } = await runOnce({ config, bucket: env.BUCKET, fetchFn: (url, init) => fetch(url, init), now: event.scheduledTime });
    console.log(JSON.stringify({ mirror: config.org, ...summary, firstProblem: problems[0] ?? '' }));
  } catch (e) {
    console.error(JSON.stringify({ mirror: config.org, error: String(e?.message ?? e).slice(0, 200) }));
  }
}

export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(tick(event, env)); },
};
