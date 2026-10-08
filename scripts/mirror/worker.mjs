// The Worker entry for the Release mirror: no fetch handler (the bucket is served by its custom domain, not by this Worker), one scheduled handler.
// Bindings: BUCKET (r2_bucket); EMAIL (send_email), DIGEST_TO (secret) and DIGEST_FROM (plain text) for the failure mail, which is skipped when EMAIL is not bound.
import config from './config.mjs';
import { runOnce, settle, validateConfig } from './mirror.mjs';

async function tick(event, env) {
  const fault = validateConfig(config);
  if (fault) { console.error(JSON.stringify({ mirror: config?.org, configFault: fault })); return; }
  try {
    const run = await runOnce({ config, bucket: env.BUCKET, fetchFn: (url, init) => fetch(url, init), now: event.scheduledTime });
    const { problems, ...summary } = run;
    const mail = await settle({ bucket: env.BUCKET, run, send: env.EMAIL ? (m) => env.EMAIL.send(m) : undefined, to: env.DIGEST_TO, from: env.DIGEST_FROM, org: config.org });
    console.log(JSON.stringify({ mirror: config.org, ...summary, firstProblem: problems[0] ?? '', streak: mail.fails, mailed: mail.mailed }));
  } catch (e) {
    console.error(JSON.stringify({ mirror: config.org, error: String(e?.message ?? e).slice(0, 200) }));
  }
}

export default {
  async scheduled(event, env, ctx) { ctx.waitUntil(tick(event, env)); },
};
