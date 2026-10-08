# GitHub event inbox

A Cloudflare Worker that receives the TheColliery org's webhook deliveries and keeps only the events GitHub's own notifications do not cover (owner ruling, UMB-445 (2)). It is the machine feed for the config-audit program (UMB-214), because the org audit log's REST endpoint is Enterprise Cloud only.

## What it does

- `fetch` is the webhook's payload URL. It takes POST only, reads at most 1 MiB, checks the `X-Hub-Signature-256` MAC with the webhook secret in constant time before parsing anything, and refuses a bad MAC with 401. A `ping` is answered 200.
- A kept event becomes one KV key, `ev:<delivery id>`, whose metadata is the whole compact record (event, action, repository or org, sender login, one detail, time). A redelivery is the same key.
- `scheduled` (hourly, minute 41) reads the pending keys with one list call, sends ONE digest email for the batch (at most 50; the rest wait for the next tick), then deletes those keys. A failed send deletes nothing, so the next tick retries. The last digest stays readable in KV (`digest:last`).

No address of anyone is read from a payload, and the digest holds GitHub logins only.

## Events

Subscribe the org webhook to exactly these ten events (a GitHub webhook's event list, the "Let me select individual events" choice):

| Event | Kept actions |
| --- | --- |
| `repository` | created, deleted, renamed, transferred, publicized, privatized, archived, unarchived |
| `repository_ruleset` | all |
| `branch_protection_rule` | all |
| `branch_protection_configuration` | all |
| `deploy_key` | all |
| `member` | all |
| `membership` | all |
| `organization` | all |
| `team` | all |
| `security_and_analysis` | all |

GitHub documents `installation` and `installation_repositories` (app installations and their repository selection) as GitHub-App-only: an organization webhook is never sent them, so this inbox cannot see those changes. Reading them needs `GET /orgs/{org}/installations`, which needs a credential, and no credential rides this Worker.

## Deploy

```text
node scripts/inbox/deploy-payload.mjs --from <sender address> --org <github org> [--name <worker>] [--cron "<5 fields>"] [--rotate] [--out <file>]
```

The output is the body of a Cloudflare MCP `execute` call: the modules embedded (the MCP sandbox cannot fetch from GitHub) behind a git blob guard, the KV namespace `<name>-state` found or created, the Worker uploaded, the schedule set, workers.dev switched on (the Worker has a `fetch` handler), and the bindings, schedule and two probes read back. Bindings: `STATE` (KV), `EMAIL` (`send_email`, restricted to the verified destination address), `DIGEST_TO` (secret), `DIGEST_FROM` and `ORG` (plain text), `WEBHOOK_SECRET` (secret).

## The webhook secret never passes through chat

On a first deploy the sandbox draws the secret (32 random bytes), binds it to the Worker, and writes the same value to one KV key, `setup:webhook-secret`, with a three-day lifetime. The payload returns the mode and the lifetime, never the value. The owner copies the value from the Cloudflare dashboard (Storage & databases > KV > the namespace) into the GitHub webhook form's Secret field; the key expires on its own. A redeploy keeps the secret; `--rotate` draws a new one.

### The window, and who can read the key in it

For those three days the value sits in KV in the clear. Anyone who holds a read token for the account's KV, an all-accounts read token included, can read it, and nothing deletes it once the owner has copied it: it expires on its own at the end of the three days (a redeploy that keeps the secret writes no key at all). The owner's trade is therefore to copy the value into the GitHub webhook form soon after a first deploy or a `--rotate`. To end the window early, delete that one key, `setup:webhook-secret`, from the namespace in the dashboard; it is the only key of that name and nothing else reads it. (Auditor's pass 18, B-4.)

## Limits

- A tick reads at most five KV list pages (5,000 pending records) and mails the 50 oldest; the rest wait for the next tick. KV allows 1,000 list calls a day on the Free plan, and one tick is one to five.
- A private repository's line carries `[private]`; the digest names the repository, the action, the sender's login and one detail, nothing else.
- The MAC is checked over the raw bytes GitHub sent, before anything is decoded.

## Tests

```text
node --test scripts/inbox/inbox.test.mjs scripts/inbox/deploy-payload.test.mjs
```
