# Release mirror

A Cloudflare Worker that copies the org repositories' newest Releases from GitHub into an R2 bucket served on a forge hostname (owner ruling BB-30, "one link"; UMB-445). The bucket is the second host behind the stable download link; the switch between hosts stays with `scripts/domain-failover.mjs`.

## What a run does

1. For each repository in `config.mjs`, reads `https://github.com/<org>/<repo>/releases.atom` and takes the newest `keep` (2) tags.
2. For a tag with no marker `.mirror/<repo>/<tag>.json`, reads the release page's asset list once (`https://github.com/<org>/<repo>/releases/expanded_assets/<tag>`, public HTML; the REST API answers a Workers address 403 from its shared unauthenticated limit, measured 2026-10-04) and copies each asset through the `BUCKET` binding to `<repo>/<tag>/<file>`. The SHA-256 the page shows is enforced by R2 on write and recorded on the object, which is how a later run knows to skip it; a file with no published checksum is stored only when the stored length equals the length the server announced, or the object is deleted and the failure reported.
3. Writes the marker LAST. A half-copied release has no marker, is finished next run, and an asset the bucket already holds with the same recorded checksum is not downloaded again.
4. Deletes, by name, every key of that repository whose tag is no longer among the newest `keep`, and its markers. A repository whose feed failed or came back empty is never pruned.
5. Writes `.mirror/last-run.json` (counts, the first few problems, no address).
6. Settles the failure streak (below).

The run stops at 45 external requests (the Free plan allows 50 per invocation); what is left waits for the next tick. A GitHub error is a problem in the record, never a crash.

## Layout

| Key | Holds |
| --- | --- |
| `<repo>/<tag>/<file>` | a Release asset, byte for byte |
| `.mirror/<repo>/<tag>.json` | the marker: the file names and sizes, written when the release is complete |
| `.mirror/last-run.json` | the last run's counts |
| `.mirror/streak.json` | the failure streak: `{ fails, reported }` (and `mailError` when a send failed) |

## The failure mail (UMB-454)

After every run the Worker counts consecutive runs that had an error. At the third it sends ONE mail through its `send_email` binding, from `DIGEST_FROM` (the beat's antenna address) to `DIGEST_TO` (the account's verified address). The mail names the run, the number of failed runs and each failing repository with its error, one line each (ten at most, then a count). It is sent once per trouble spell: a clean run ends the spell, and three failed runs after it start the next. A failed send leaves the spell unreported, so the next failed run tries again; a Worker with no `EMAIL` binding only counts. A run that merely deferred work (the request budget) is not a failure. The streak file is written only when it changes.

## Deploy

```text
node scripts/mirror/deploy-payload.mjs --bucket <name> --domain <host> --zone <zone> --from <sender> [--name <worker>] [--cron "<5 fields>"] [--out <file>]
```

The output is the body of a Cloudflare MCP `execute` call: modules embedded behind a git blob guard, the R2 bucket found or created, the Worker uploaded with the `BUCKET` binding (the binding is the grant: no R2 token exists) and the mail bindings `EMAIL` (restricted to the account's verified destination address, read in the sandbox and never returned), `DIGEST_TO` (secret) and `DIGEST_FROM` (the `--from` sender, plain text), the schedule set (default hourly, `23 * * * *`), workers.dev switched off, the bucket's custom domain attached on the zone, and everything read back. Attaching the domain creates that hostname's own DNS record and nothing else. R2 must be enabled on the account first, which is the account owner's step.

## Tests

```text
node --test scripts/mirror/mirror.test.mjs scripts/mirror/deploy-payload.test.mjs
```
