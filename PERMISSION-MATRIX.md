# Permission Matrix (TheColliery)

> The **minimum** set of capabilities each Coal\* skill needs — split by ROLE (main orchestrator vs worker) and written in platform-neutral primitives, so it maps onto any agent platform's permission model.
> It is a **request manifest** — what a skill should ask for — not a grant. What a given platform actually allows is verified per-platform, dated, and stated separately.
> **Why least-power is the doctrine:** a bundled over-request reads as an attack. Ask for delete, bulk-read, and network in one breath and you have described exfiltration, whatever you meant. So each skill requests the fewest rights that let it work, and the rights it deliberately does NOT want are proven absent rather than merely unused.

## The 10 primitives

| # | Primitive | Meaning | Platform expression (examples) |
|---|---|---|---|
| P1 | **READ** (scoped: cwd → repo → home) | Read local files. The SCOPE rung matters — a cwd-jailed role cannot reach home. | Claude Code tool allow · Codex `sandbox_mode` read scope · Antigravity file-read gate |
| P2 | **WRITE-SCRATCH** | Write ONLY inside a sandboxed temp/transaction dir. | tmpdir write · Codex `workspace-write` (scoped) |
| P3 | **WRITE-TARGET** | Mutate the user's actual files. | explicit path write |
| P4 | **DELETE** | Remove or overwrite a user file irreversibly. | delete tool · filesystem unlink |
| P5 | **EXEC** | Run a local command or tool (no network). | shell/exec tool · Codex exec |
| P6 | **NETWORK** | Reach the outside world. | fetch/web tool · Codex escalated network |
| P7 | **SPAWN** | Create a worker/subagent. | `Agent`/`Task` · `spawn_agent` · `invoke_subagent` |
| P8 | **SPAWN-WITH-MODEL** | Choose the worker's model/tier at spawn time. | `Agent(model:)` · `agent({model})` |
| P9 | **HUMAN-ASK** | Prompt the user for a decision. | AskUserQuestion · request_user_input · ask box |
| P10 | **HOOKS** | Register on lifecycle events (session start/stop, post-tool-use). | any platform `hooks.json` engine — capability-keyed: has hooks → wire them; none → degrade to manual |

## Per-skill request manifest

> Every row below has been verified against the shipped code by that tool's own maintainers (2026-07-25). Where a row was corrected against the original design draft, the code won.

`M` = main/orchestrator · `W` = worker/sub · `—` = not requested by the skill's CODE · **bold** = a capability spike

| Skill | P1 READ | P2 SCRATCH | P3 WRITE-TGT | P4 DELETE | P5 EXEC | P6 NET | P7 SPAWN | P8 SPAWN-MODEL | P9 ASK | P10 HOOKS |
|---|---|---|---|---|---|---|---|---|---|---|
| **CoalMine** | M+W: repo | M | — | — | M+W (build/lint/dead-code) | — | M (Heavy fan-out) | — | M | M (CC + AG wired) |
| **CoalTipple** | M | M | — | — | — | — | M | **M — the whole mechanism** | M | M (conductor) |
| **CoalBoard** | M+W: repo | W: private memo · M: proposed staging | — (staging only; a human applies) | — | W: show-me + adversary · M: verify | W: empirical lens | M | M (lens tiers) | M | M (conductor) |
| **CoalFace** | M+W: repo | M (snapshot) | **M only — single writer** | — | M (apply-time domain gate) | — | M | — | M | M (CC + AG wired) |
| **CoalHearth** | M: repo + journal (home stat) | M (journal write) | — | — | — | — | — | — | — | M (capability-keyed) |
| **CoalWash** | M: **home reach** · W: only handed content | M (transaction dir) | M (the mutations) | **M: human-gated + UNDO-backed** | — | — | M (none when local-only) | M | M (band asks) | M (conductor) |
| **CoalLedger** | M: named docs + link targets + config | M | **M (choice-gated fix; never auto)** | — | M (doc engine + consented checkpoint) | — | — | — | M | M (CC + AG adapter) |

> **Two layers — what the CODE does vs what the skill INSTRUCTS the agent to do.** A `—` in NETWORK or EXEC means the skill's shipped *code* never does it: the hooks make no network call and the engine spawns no process. Several skills nonetheless *instruct the agent* to reach a live source (CoalMine and CoalLedger grounding, every skill's self-update check) or to run a local command, always through the agent's own tools and always consent-gated. That consented agent-layer action is governed by the **ASK** column, not by granting the skill's code a network or exec right. Read only the hook headers and you get a false "no network"; read only the skill body and you over-claim the code's reach. The row states the code layer; ASK carries the agent layer.

## The two rights a worker never gets

- **No worker SPAWN (P7).** A worker is a leaf. Least-privilege blocks runaway nesting — an unbounded recursive probe once ballooned into 69 orphaned sessions that had to be reaped by hand. Orchestration lives at the main/depth-0 level only.
- **No worker HUMAN-ASK (P9).** Asks route through main. A worker that can prompt the user is an unbounded side-channel.

Both are enforced as **must-fail** checks, not just omissions: a platform that *grants* either to a worker is a finding, not a feature. The response is to re-jail the worker to a least-power profile, or run the skill main-only on that platform.

## The baseline and the two spikes

The baseline is deliberately tiny — **scoped read (P1) + scratch-write (P2)**, plus running the repo's *own* local tooling (build, test, lint, the doc engine). Four skills exec locally that way — CoalMine, CoalLedger, CoalBoard, CoalFace — and that execution never leaves the machine, so it is baseline, not a spike. Two capabilities genuinely rise above the baseline, and each is rare:

1. **NETWORK in the code — CoalBoard's empirical lens**, whose identity is live source-grounding. Everywhere else, reaching a live source is an agent-layer, consent-gated action (CoalMine and CoalLedger grounding) governed by ASK — never a code network right (see the two-layers note above).
2. **HOME-REACH + WRITE-TARGET + DELETE — CoalWash**, the heaviest profile in the series: a cwd-jailed role cannot gauge class-B memory that lives outside the project, nor reach the class-A transcript estate spanning every project under `~/.claude/projects/` — and washing *is* mutation. This is why it carries the full safety stack — human-gated deletes, verified snapshot, whole-run rollback. CoalLedger also writes target files, but only as a fix the user picks item by item from a menu, never a bulk mutation; and only CoalWash deletes.

## Earning a new right

A skill that wants a capability it does not have must earn a row here **first** — stating why, which role needs it, and whether it is a spike. An unearned right is debt: it widens the blast radius, it is one more thing to defend, and to anyone reading the request it looks like an attack.

## Honest frame

This is the **design manifest** — what each skill should request. It is not a claim about what any platform actually granted. A capability is only called verified on a platform when a dated, reproducible check says so; until then it stays marked unverified in that platform's compatibility matrix and is never asserted. A paper claim that something "works on X" is worth nothing; the dated receipt is the point.
