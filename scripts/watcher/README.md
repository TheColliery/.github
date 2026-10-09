# Change watcher

One Cloudflare Cron Worker per Cloudflare account (owner ruling BB-28, UMB-445). The code is the same for every instance; the source list is the only thing that differs.

| Instance | List | Watches |
| --- | --- | --- |
| TheColliery | `sources/thecolliery.mjs` (30 sources) | every AI agent platform the Coal* skills support, and GitHub's own changelog by label (actions, application security, supply chain security, platform governance, account management, copilot) |
| Kolwen | `sources/kolwen.mjs` (63 sources; the LLM chief deploys it) | the commercial hub's beat: Cloudflare, GitHub, CodeRabbit, Claude Code, the model vendors and the open-weight organisations (rows from `LLMWorks/warehouse/antenna-beat-2026-10.md`), the Paddle changelog, and two status watches (Cloudflare, Groq) |

A new website joins as ONE data row in the instance's list, appended at the END (the order is the stagger). The busiest hour of the week stays under `maxPerRun` and the Free plan's 50 subrequests: a test prints the worst hour and holds it near the mean. A feed URL appears once per list.

## What one run does

1. Picks the sources due this hour: a source with `everyHours: n` is due when `(hour + its index in the list) % n === 0`, so a list spreads over the hours by construction.
2. Fetches each with a User-Agent that names TheColliery and `https://thecolliery.org`, sending the stored `ETag` / `Last-Modified`; reads at most 64 KB of a body.
3. Compares the newest entry's key with the stored state. State is one KV key, written only when something changed.
4. When anything changed, sends ONE digest email for the run through the `send_email` binding, and keeps the last digest in KV (`digest:last`).
   The digest ends with a machine-readable change list for the zone editors (one JSON line per reported source under a marker line, also in `digest:last.changes`): its shape, the registry, the sizing for hundreds of sources and the push-intake design are in [ANTENNA.md](./ANTENNA.md).

A source that fails three runs in a row, or four times within its last eight runs (a source that answers every other hour), is reported once per trouble spell; the spell ends after three answered runs. A feed that mints a new entry id on every render but shows the same title at the same link is quiet. A feed whose newest entries are all ignored (`ignoreTitle`) is quiet, not an error.

## Source kinds

| Kind | Source | Change key |
| --- | --- | --- |
| `atom`, `rss` | a feed | the newest entry that `ignoreTitle` does not match |
| `raw` | a markdown or text file, or an npm `latest` manifest | a hash of the first 64 KB |
| `headings` | an HTML changelog page | its first three headings |
| `incidents` | a Statuspage v2 `incidents.json` (the history, not the unresolved list) | the ids of its five newest incidents by `created_at`: a new incident moves the key even when it opened and closed between two reads, an update to a known one moves nothing |

No credential rides this Worker. A source that needs one is a gap to report, never an entry.

## Deploy an instance

One command prints the whole deploy as the body of a Cloudflare MCP `execute` call. The MCP sandbox cannot fetch from GitHub, so the modules travel inside the payload, and the payload checks each module's git blob id before it writes anything.

```text
node scripts/watcher/deploy-payload.mjs <instance> --from <sender address> [--name <worker>] [--cron "<5 fields>"] [--kv-id <32 hex>] [--out <file>]
```

The payload finds or creates the KV namespace `<name>-state`, uploads `worker.mjs`, `watcher.mjs` and `sources/<instance>.mjs` (as `sources.mjs`), sets the schedule (default hourly, `17 * * * *`), switches the workers.dev route off, and reads the bindings and the schedule back. It reads no credential: the MCP session holds the grant, and the account's verified destination address is read inside the sandbox and never returned.

| Instance | Command | Account |
| --- | --- | --- |
| `thecolliery` | `node scripts/watcher/deploy-payload.mjs thecolliery --from antenna-coal@thecolliery.org` | TheColliery |
| `kolwen` | `node scripts/watcher/deploy-payload.mjs kolwen --from antenna-llm@kolwen.com` | Kolwen |

Bindings of the deployed Worker: `STATE` (KV namespace), `EMAIL` (`send_email`, restricted to the verified destination address), `DIGEST_TO` (secret text, that address), `DIGEST_FROM` (plain text, the sender).

Free-plan budget, from Cloudflare's docs read 2026-10-04: 10 ms CPU per Cron run, 50 external subrequests per run, KV 1,000 writes a day, 5 Cron Triggers per account. `validateConfig` keeps `maxPerRun` at 45 or less, and a test holds that no hour of the week asks for more.

## Dated notes

- **2026-10-09, status source (Issues 39 and 41).** The Cloudflare status row read `incidents/unresolved.json` hourly, so an incident that opened and closed between two reads was never seen (an 11-minute CDN incident of 2026-10-02 fell through). It now reads the history, `incidents.json`, as kind `incidents`. The first run after the redeploy reports that source once, because its stored key was a hash. Groq's row stays `raw` on its own `incidents.json`: that page lists newest first and was never blind to a closed incident.
- **2026-10-09, Workers Logs become Observability on 2026-12-01 (Issues 39 and 41).** The docs page `observability/pricing` (read 2026-10-09) lists Free as "0.5 GB per day", "Seven-day retention included", and says "On Free, Cloudflare stops ingesting new data when the account reaches its daily limit". This Worker writes ONE console line per Cron run; a test runs the real `worker.mjs` with the Kolwen list through 24 runs in the largest shape (every source baselined, a mail binding that fails with a long code) and holds the day to 1% of 0.5 GB with 4 KB per run allowed for Cloudflare's own invocation record, which is an assumption and was not measured. Observability stays on in `deploy-payload.mjs`. If the allowance were ever reached, ingestion stops and the Worker keeps running: logs are the only thing lost, the digest mail and KV state do not depend on them.
- **2026-10-09, Free-plan numbers re-read** on the pages the sweep Issues quoted: 10 ms CPU per Cron Trigger, 50 subrequests per request, 5 Cron Triggers per account (`workers/platform/limits`), 100,000 requests a day (`workers/platform/pricing`), KV 1,000 writes and 1,000 list requests a day (`kv/platform/pricing`): unchanged. The sweep Issues add, not re-read here: the Worker size limit rose to 64 MiB uncompressed on every plan (2026-09-04), which changes nothing for this Worker, and the blog's "Enterprise for all" limits do not touch the Free plan. Seven pages (those, KV limits, Observability pricing, R2 pricing, Email Service limits) are now Kolwen rows of kind `raw`, so a changed number reaches the digest.

## Tests

```text
node --test scripts/watcher/watcher.test.mjs scripts/watcher/deploy-payload.test.mjs
```
