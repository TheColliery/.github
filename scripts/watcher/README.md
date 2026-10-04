# Change watcher

One Cloudflare Cron Worker per Cloudflare account (owner ruling BB-28, UMB-445). The code is the same for every instance; the source list is the only thing that differs.

| Instance | List | Watches |
| --- | --- | --- |
| TheColliery | `sources/thecolliery.mjs` | every AI agent platform the Coal* skills support |
| Kolwen | `sources/kolwen.mjs` (the LLM chief adds it) | Cloudflare, GitHub, CodeRabbit, Claude Code |

## What one run does

1. Picks the sources due this hour: a source with `everyHours: n` is due when `(hour + its index in the list) % n === 0`, so a list spreads over the hours by construction.
2. Fetches each with a User-Agent that names TheColliery and `https://thecolliery.org`, sending the stored `ETag` / `Last-Modified`; reads at most 64 KB of a body.
3. Compares the newest entry's key with the stored state. State is one KV key, written only when something changed.
4. When anything changed, sends ONE digest email for the run through the `send_email` binding, and keeps the last digest in KV (`digest:last`).

A source that fails three runs in a row, or four times within its last eight runs (a source that answers every other hour), is reported once per trouble spell; the spell ends after three answered runs. A feed that mints a new entry id on every render but shows the same title at the same link is quiet. A feed whose newest entries are all ignored (`ignoreTitle`) is quiet, not an error.

## Source kinds

| Kind | Source | Change key |
| --- | --- | --- |
| `atom`, `rss` | a feed | the newest entry that `ignoreTitle` does not match |
| `raw` | a markdown or text file, or an npm `latest` manifest | a hash of the first 64 KB |
| `headings` | an HTML changelog page | its first three headings |

No credential rides this Worker. A source that needs one is a gap to report, never an entry.

## Deploy an instance

One command prints the whole deploy as the body of a Cloudflare MCP `execute` call. The MCP sandbox cannot fetch from GitHub, so the modules travel inside the payload, and the payload checks each module's git blob id before it writes anything.

```text
node scripts/watcher/deploy-payload.mjs <instance> --from <sender address> [--name <worker>] [--cron "<5 fields>"] [--kv-id <32 hex>] [--out <file>]
```

The payload finds or creates the KV namespace `<name>-state`, uploads `worker.mjs`, `watcher.mjs` and `sources/<instance>.mjs` (as `sources.mjs`), sets the schedule (default hourly, `17 * * * *`), switches the workers.dev route off, and reads the bindings and the schedule back. It reads no credential: the MCP session holds the grant, and the account's verified destination address is read inside the sandbox and never returned.

| Instance | Command | Account |
| --- | --- | --- |
| `thecolliery` | `node scripts/watcher/deploy-payload.mjs thecolliery --from watcher@thecolliery.org` | TheColliery |
| `kolwen` | `node scripts/watcher/deploy-payload.mjs kolwen --from <a sender on the Kolwen zone>` | Kolwen |

Bindings of the deployed Worker: `STATE` (KV namespace), `EMAIL` (`send_email`, restricted to the verified destination address), `DIGEST_TO` (secret text, that address), `DIGEST_FROM` (plain text, the sender).

Free-plan budget, from Cloudflare's docs read 2026-10-04: 10 ms CPU per Cron run, 50 external subrequests per run, KV 1,000 writes a day, 5 Cron Triggers per account. `validateConfig` keeps `maxPerRun` at 45 or less, and a test holds that no hour of the week asks for more.

## Tests

```text
node --test scripts/watcher/watcher.test.mjs scripts/watcher/deploy-payload.test.mjs
```
