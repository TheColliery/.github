# The news antennas: design note (UMB-453)

The watcher is the border post of the zone editors' beat: it learns which website moved, and an editor sends the warehouse's free lanes only where something moved. This note says where the change list lands and what it holds, how a website joins, how a run is sized for hundreds of sources, and what a push intake would add. Facts below carry their date; a limit is the vendor's figure, re-read before you rely on it.

## 1. The change list (built, schema v1)

**Where it lands.** Every digest mail ends with the list, under one marker line, and the same list sits in the KV key `digest:last` (field `changes`), readable through the Cloudflare API. The editors already read the mail through their Gmail label (`TheColliery/Antenna/Coal`, `TheColliery/Antenna/Articles`, `Kolwen/Antenna/LLM`), so the list needs no new channel and no credential.

**How an editor reads it.** Find the line `--- change list (JSON lines, schema v1) ---` in the mail body; every line after it is one JSON object. A mail without the marker (an older digest) holds the prose sections only.

**Shape.** One record per reported source, in the order changed, baselined, failing:

| Field | Meaning |
| --- | --- |
| `v` | schema version, 1 |
| `instance` | the watcher instance (`thecolliery`, `kolwen`) |
| `at` | the run's time, ISO 8601 UTC |
| `kind` | `changed` (the newest entry moved), `baselined` (first sight of a source, no earlier state), `failing` (three runs in a row, or four of the last eight) |
| `id` | the source id in the registry, the join key to the warehouse row |
| `site` | the source's name in the registry (the website and page) |
| `host` | the URL's host, so an editor groups rows by website |
| `url` | the source URL the watcher reads |
| `link` | the changed entry's own link, when the feed gives one (capped at 500 characters) |
| `from`, `to` | the previous and the new newest title or id (`changed` has both, `baselined` has `to`; each capped at 200) |
| `error` | the error text of a `failing` record |

Absent fields are absent, never empty. Every string is JSON-escaped, so a record is one line whatever the text holds. The title of a raw JSON source is its newest incident name (a status page) or its newest model id (the Hugging Face list), so a status or a model change reads as a name, not as a hash.

**What the list does not do.** It says WHERE to cast, never what changed in substance: an editor reads the page, and a changed hash on a status page can be an edit to an old incident. `baselined` records are the hello digest of a new source; an editor usually skips them.

## 2. The registry (built): a website is a data row

`sources/<instance>.mjs` is DATA ONLY (a test round-trips it through JSON). A new website joins as one row appended at the END of the instance's list: `id` (lowercase), `name`, `url` (https, no credential), `kind` (`atom`, `rss`, `headings`, `raw`, `incidents`), `everyHours` (1 to 24), and `ignoreTitle` when a repository mixes release lines. The order is the stagger: a source is due when `(hour + its index) % everyHours === 0`, so an append moves no earlier slot. The tests hold: a valid list, no URL twice in a list, the busiest hour of the week under `maxPerRun` and near the mean, every source due exactly once per cycle. The two lists today: TheColliery 41 sources (busiest hour 13, mean 10.92), Kolwen 63 (busiest 16, mean 13.54), measured over the 168 hours of a week with the real `pickRun`.

## 3. Sizing a run for hundreds of sources

The Free plan's limits (Cloudflare docs, read 2026-10-04; re-read 2026-10-09 on the pages `workers/platform/limits`, `workers/platform/pricing` and `kv/platform/pricing`, every number below unchanged, and now watched as seven `raw` rows of the Kolwen list): 10 ms CPU per Cron invocation, 50 external subrequests per invocation, 100,000 requests a day, 5 Cron Triggers per account, KV 1,000 writes and 1,000 list calls a day.

- **Subrequests are not the wall.** The average load is the sum of `1 / everyHours` over the list, and the stagger keeps the busiest hour close to it. 300 sources at 12 hours average 25 an hour; at 6 hours, 50. `validateConfig` refuses `maxPerRun` above 45. A list of 300 sources at 12 hours fits one tick; a list of 300 at 6 hours does not.
- **KV writes are not the wall.** State is one key written only when something changed, and `digest:last` once per reporting run: at most 48 writes a day, against 1,000.
- **CPU is the wall, and it is unmeasured.** Each fetched source costs a parse (a regex over at most 64 KB) or a SHA-256 of 64 KB. The deployed instances have never been read for CPU time; the 10 ms per run is the figure to measure first, from the Workers Logs of a real run, before any list passes about 100 sources. Kolwen at 51 is the first instance that will tell.
- **If the wall is reached: shard by Cron Trigger.** An account may hold 5 triggers; each invocation has its own 50 subrequests and its own 10 ms. The Worker would read `event.cron`, take the sources whose index falls in that trigger's shard, and keep one state key per shard (so no tick rewrites another shard's state). That multiplies the budget by up to 5 inside one Worker, with no new Worker and no credential. Not built: nothing today needs it, and the measurement above comes first.

## 4. Push intakes (design only: nothing built, decisions returned)

Beside polling, a site's own push can feed the same change list. Polling stays conditional (ETag, Last-Modified), so an unchanged site costs one small request. Both intakes would write a pending record to KV (one key per event, the inbox Worker's pattern) that the next hourly tick folds into its ONE digest, with `kind: "pushed"` and the same fields.

**WebSub.** A W3C standard: a feed names a hub, the subscriber's callback receives the hub's verification challenge (a GET) and then each update (a POST, signed with a shared secret). Measured 2026-10-08, n = 1: of the 41 distinct RSS and Atom sources across both lists, **none names a hub**, neither in the first 64 KB of the body nor in a `Link` response header. A WebSub intake would have no subscription to make today, and it needs a public callback route, a per-subscription secret and a renewal job before the first lease runs out. Recommendation: do not build it until a source worth watching names a hub.

**Email.** Cloudflare Email Routing can send a rule's mail to a Worker whose `email(message, env, ctx)` handler receives the sender (`message.from`), the recipient (`message.to`), the headers (`message.headers`) and the raw MIME as a stream (`message.rawSize` says its size); the runtime page (read 2026-10-08) names 25 MiB as the inbound limit and does not say whether one Worker may also export `fetch` and `scheduled` beside `email` (⚠️ unverified: check the Workers handler docs before merging the intake into the watcher; a separate small Worker is the safe fallback). The handler would read only the headers (sender domain and subject), look the sender domain up in a registry map (sender domain to source id), and store one `pushed` record; it would never store a body, and it would reject mail from any other sender with `setReject`. A vendor's changelog or status mail is the push line that exists today.

**What only the owner can decide** (an address and a subscription are outward acts, per list, from the identity whose beat it is):

1. Whether to build the email intake at all, and on which address: one inbound address per beat on the zone that owns it (for example `antenna-coal-in@thecolliery.org` for the forge; the Kolwen beat on `kolwen.com`), separate from the existing `antenna-coal@` digest address so a vendor's mail never mixes with the watcher's own.
2. Which lists to subscribe, each by name. The classes this note proposes, none yet confirmed to offer email: a status page's own "Subscribe to updates" (BB-56 already has Cloudflare and Groq), a vendor's developer or changelog newsletter where the vendor's page offers one. The owner subscribes, because the subscription is made from his identity.
3. The sender-domain map: which sender domain stands for which source id (one data row each, in the same registry as the sources).

None of the three is decided here.
