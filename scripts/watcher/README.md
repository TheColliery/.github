# Change watcher

One Cloudflare Cron Worker per Cloudflare account (owner ruling BB-28, UMB-445). The code is the same for every instance; the source list is the only thing that differs.

| Instance | List | Watches |
| --- | --- | --- |
| TheColliery | `sources/thecolliery.mjs` | every AI agent platform the Coal* skills support, GitHub's own changelog (general and by label) and CodeRabbit's changelog, and the open-source forge's toolchain (Node.js security, Git for Windows, the MCP specification, GitBook, SkillSpector); the sources a machine updates itself carry `tier: 'cold'` and are read by hand |
| Kolwen | `sources/kolwen.mjs` (the LLM chief deploys it) | the commercial hub's beat: the whole Cloudflare family (status, changelog, limits and pricing pages), the model vendors and the open-weight organisations (rows from `LLMWorks/warehouse/antenna-beat-2026-10.md`), the Paddle and Supabase changelogs, the Claude builder blog, and the Groq status watch |

A new website joins as ONE data row in the instance's list, appended at the END (the order is the stagger). The busiest hour of the week stays under `maxPerRun` and the Free plan's 50 subrequests: a test prints the worst hour and holds it near the mean. A feed URL appears once across both lists. A source count is never written here: `watcher.test.mjs` fails on a number of sources in this file or in a registry's header, so it cannot drift again (16m's README said 41 and 63 against a live 37 and 64).

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

`--server` names the MCP server that runs the payload: `claude-ai` (the default, the claude.ai Cloudflare connector, which took the upload with `contentType` and `rawBody` on 2026-11-20) or `cloudflare-api` (the Cloudflare API MCP server, which also needed the upload's Content-Type in `headers`). A missing `<name>-state` KV namespace is created only with `--create-kv`; without it the payload answers "nothing written", so a run on the wrong account or under a drifted name cannot mint a second, empty state store.

Bindings of the deployed Worker: `STATE` (KV namespace), `EMAIL` (`send_email`, restricted to the verified destination address), `DIGEST_TO` (secret text, that address), `DIGEST_FROM` (plain text, the sender).

Free-plan budget, from Cloudflare's docs read 2026-10-04: 10 ms CPU per Cron run, 50 external subrequests per run, KV 1,000 writes a day, 5 Cron Triggers per account. `validateConfig` keeps `maxPerRun` at 45 or less, and a test holds that no hour of the week asks for more.

## Dated notes

- **2026-10-09, status source (Issues 39 and 41).** The Cloudflare status row read `incidents/unresolved.json` hourly, so an incident that opened and closed between two reads was never seen (an 11-minute CDN incident of 2026-10-02 fell through). It now reads the history, `incidents.json`, as kind `incidents`. A source whose stored key belongs to another kind (the old hash) is reported ONCE as a change at its next due run, from the old title; a source with no stored key is baselined silently, and the "Baselined" report belongs only to the very first run of a fresh state. So no one-time report is promised after a redeploy: on the Kolwen instance the status source was baselined silently at 07:17Z on 2026-10-09 and none appeared (the Kolwen head's read, 09e item 23). Groq's row stays `raw` on its own `incidents.json`: that page lists newest first and was never blind to a closed incident.
- **2026-10-09, the TheColliery list gains the Cloudflare surfaces its own Workers run** (main's ruling on the proposal): the status history (kind `incidents`, hourly), the changelog feeds of Workers, KV, R2, DNS, Registrar and Email Service every 6 hours, and four `raw` pages every 24 hours (Workers limits, KV pricing, R2 pricing, Email Service limits), appended at the end. It adds 52 outgoing fetches a day (24 + 24 + 4), measured from the stagger over a week: 262 a day in all against 210. The busiest hour asks for 13 fetches against the Free plan's 50 subrequests a run (`maxPerRun` is 24), so 37 stay free; the Worker is invoked 24 times a day by its Cron Trigger and has no HTTP route, so the 100,000 requests a day are untouched. The GitHub release feeds, the One Client feed and Workers AI stay in the Kolwen list only.
- **2026-10-09, Workers Logs become Observability on 2026-12-01 (Issues 39 and 41).** The docs page `observability/pricing` (read 2026-10-09) lists Free as "0.5 GB per day", "Seven-day retention included", and says "On Free, Cloudflare stops ingesting new data when the account reaches its daily limit". This Worker writes ONE console line per Cron run; a test runs the real `worker.mjs` with the Kolwen list through 24 runs in the largest shape (every source baselined, a mail binding that fails with a long code) and holds the day to 1% of 0.5 GB with 4 KB per run allowed for Cloudflare's own invocation record, which is an assumption and was not measured. Observability is on in `deploy-payload.mjs` with every run kept (`head_sampling_rate` 1) and the platform's invocation record OFF (`logs.invocation_logs: false`, sent with `logs.enabled: true` because Cloudflare's API requires both once `logs` is sent; set 2026-10-09, UMB2-063), so a tick writes the Worker's one console line and no second event. The 4 KB per run in the test below stays as a safety margin for the platform's own wrapper around that line; it is no longer a measured or expected cost. If the allowance were ever reached, ingestion stops and the Worker keeps running: logs are the only thing lost, the digest mail and KV state do not depend on them.
- **2026-10-09, Free-plan numbers re-read** on the pages the sweep Issues quoted: 10 ms CPU per Cron Trigger, 50 subrequests per request, 5 Cron Triggers per account (`workers/platform/limits`), 100,000 requests a day (`workers/platform/pricing`), KV 1,000 writes and 1,000 list requests a day (`kv/platform/pricing`): unchanged. The sweep Issues add, not re-read here: the Worker size limit rose to 64 MiB uncompressed on every plan (2026-09-04), which changes nothing for this Worker, and the blog's "Enterprise for all" limits do not touch the Free plan. Seven pages (those, KV limits, Observability pricing, R2 pricing, Email Service limits) are now Kolwen rows of kind `raw`, so a changed number reaches the digest.
- **2026-10-09, one item is reported once (the owner's rule, the Kolwen head's courier 2, UMB2-063).** A plain missed hour already held: the next due run compares the newest key once, so a gap collapses into one report. Three cases did not, and each has a test. (1) Two runs that overlap: a run now takes what another run committed while it fetched (it re-reads the state before reporting and drops an item whose key is already recorded), then writes the state with its own run id and reads it back, and gives way only when it SEES another run's id written within five minutes; KV has no compare-and-set and is eventually consistent between locations, so this is exact for runs in one location and best effort otherwise, and a read that shows nothing never silences a report. (2) The state is written BEFORE the mail: a KV failure then stops the mail and the next hour sends it once, where the old order mailed first and mailed again every hour while the write failed; the price is that a mail binding that fails after the state is written is not retried, and `digest:last` keeps the text with `emailed: false`. (3) A feed entry or an incident id that returns (A, B, A) is not reported again: the last eight keys of an `atom`, `rss` or `incidents` source are kept in its state entry as `seen`. A `raw` or `headings` source keeps none, because its key is its content and a return to an earlier content is a real change. A reporting run costs the same two KV writes and one more read.

## Tests

```text
node --test scripts/watcher/watcher.test.mjs scripts/watcher/deploy-payload.test.mjs scripts/watcher/cold-read.test.mjs
```

## One source, one account; hot and cold (2026-11-16, the owner 2026-11-10)

- **One account per source.** A URL is fetched by ONE instance. What serves Coal* or the whole house (the agent platforms, GitHub's changelog, CodeRabbit's) is TheColliery's; what serves Kolwen is Kolwen's; the Cloudflare family (status, the changelog feeds, the limits and pricing pages) lives on Kolwen's account once. `watcher.test.mjs` fails on a URL in both registries and prints each account's busiest hour of the week against `maxPerRun` and the Free plan's 50 subrequests.
- **Hot and cold.** A source may carry `tier: 'cold'`. It stays in the registry (nothing is lost, and one edit warms it up again) and the cron never fetches it. A program the box's daily updater installs is cold by default, because learning its news after the update costs nothing; a source stays hot only where its news asks for an act the updater cannot do (a price, a deprecation with a date, a breaking change a room's code must answer).
- **The cold read.** `node scripts/watcher/cold-read.mjs <instance>` fetches the cold sources of one instance one at a time with the watcher's own `fetchSource`, compares them with their own last-seen state (`scripts/watcher/cold-state-<instance>.json`, git-ignored), and prints the change list in the digests' shape. The first run baselines; `--dry-run` writes nothing. The weekly round runs it.
- **`keyPattern`** (a `raw` source only): the source's key is the first match of the pattern, not a hash of the whole page, so a page whose body moves on every render (a build id) but whose newest release line holds still has news only when that line changes (Windsurf's changelog).
- **`until`** (`YYYY-MM-DD`, any source): the last UTC day the cron reads it. The row stays in the registry and is left out from the next day on, a dated drop instead of a deletion (Jules, after 2026-12-31, the Coal* editor's survey of 2026-11-19).
- **A change under the same newest heading.** A `raw` page without `keyPattern`, or a `headings` page, keys on its content, so its key moves when anything in it moves, while the digest names it by its newest heading. When that heading held still, the line reads `the page changed, its newest heading still "<heading>"` (or `the page changed (no heading to name what is new)` for a page with none), never `X -> X` or `? -> ?`. The change is still reported: an entry was edited or a section added below the newest heading.
