# Release mirror

A Cloudflare Worker that copies the org repositories' newest Releases from GitHub into an R2 bucket served on a forge hostname (owner ruling BB-30, "one link"; UMB-445). The bucket is the second host behind the stable download link; the switch between hosts stays with `scripts/domain-failover.mjs`.

## What a run does

1. For each repository in `config.mjs`, reads `https://github.com/<org>/<repo>/releases.atom` and takes the newest `keep` (2) tags.
2. For a tag with no marker `.mirror/<repo>/<tag>.json`, reads the release's asset list once (`GET /repos/<org>/<repo>/releases/tags/<tag>`, public, no credential) and copies each asset through the `BUCKET` binding to `<repo>/<tag>/<file>`. When GitHub publishes the asset's SHA-256, R2 enforces it on write; the stored size must equal the listed size, or the object is deleted and the failure reported.
3. Writes the marker LAST. A half-copied release has no marker, is finished next run, and an asset already stored at the right size is not downloaded again.
4. Deletes, by name, every key of that repository whose tag is no longer among the newest `keep`, and its markers. A repository whose feed failed or came back empty is never pruned.
5. Writes `.mirror/last-run.json` (counts, the first few problems, no address).

The run stops at 45 external requests (the Free plan allows 50 per invocation); what is left waits for the next tick. A GitHub error is a problem in the record, never a crash.

## Layout

| Key | Holds |
| --- | --- |
| `<repo>/<tag>/<file>` | a Release asset, byte for byte |
| `.mirror/<repo>/<tag>.json` | the marker: the file names and sizes, written when the release is complete |
| `.mirror/last-run.json` | the last run's counts |

## Deploy

```text
node scripts/mirror/deploy-payload.mjs --bucket <name> --domain <host> --zone <zone> [--name <worker>] [--cron "<5 fields>"] [--out <file>]
```

The output is the body of a Cloudflare MCP `execute` call: modules embedded behind a git blob guard, the R2 bucket found or created, the Worker uploaded with the `BUCKET` binding (the binding is the grant: no R2 token exists), the schedule set (default hourly, `23 * * * *`), workers.dev switched off, the bucket's custom domain attached on the zone, and everything read back. Attaching the domain creates that hostname's own DNS record and nothing else. R2 must be enabled on the account first, which is the account owner's step.

## Tests

```text
node --test scripts/mirror/mirror.test.mjs scripts/mirror/deploy-payload.test.mjs
```
