# Installing Coal* skills on claude.ai (web / desktop app)

claude.ai can run **custom skills**: a ZIP containing a `SKILL.md` (YAML frontmatter with `name` + `description`), uploaded via **Settings → Capabilities/Skills → Create skill**. Available on Pro / Max / Team / Enterprise with code execution enabled. Two limits to know up front:

- **Per-user** — an uploaded skill is yours alone (an Enterprise owner can provision org-wide; nobody else can).
- **No sync** — claude.ai skills are separate from Claude Code and the API. The same skill = separate installs per surface.

## Which Coal* skills work there

claude.ai runs a skill's `SKILL.md` in a code-execution sandbox — **no hooks, no subagents, no worker-model pick**. That gates the series by capability:

| Tool | On claude.ai | Why |
|---|---|---|
| **CoalMine** (9 canaries) | ✅ Works — manual invocation | The canaries read + analyze; that is exactly what the sandbox does. The Claude-Code hook automation (session-end auto-scan, conductor) does not exist here — you invoke a canary by asking for it. |
| **CoalFace** | ⚠️ Sequential degrade | No subagents → the contract's built-in degrade path runs: scout → units in order → QC → apply, one lane. You keep the discipline (scout, partition, QC, receipt) but none of the parallel speed. |
| **CoalLedger** (docs canaries) | ✅ Works — manual invocation | Same read+analyze shape as CoalMine. |
| **CoalWash** | ⚠️ Partial | The SKILL contract works for judgment; the code-core engine (caliper, fidelity gate) expects a filesystem — usable on uploaded/project files, not a live machine. |
| **CoalBoard** | ❌ Not ported | The board's value is **blind parallel lenses** (decorrelation). claude.ai has no subagent isolation — sequential "lenses" in one context anchor on each other, which silently destroys the one thing the board sells. An honest no-port beats a fake board. |
| **CoalTipple** | ❌ Not portable | Routing actuates by picking a spawned worker's model; no spawn tool exists here. |
| **CoalHearth** | ❌ Not portable | Its engine is lifecycle hooks (Claude Code + Antigravity 2.0); claude.ai has no hook engine. |

## How to package one (about a minute)

No prebuilt ZIPs to hunt for — every skill folder in the repos is already the package. Example, CoalMine's `rot-canary`:

1. Download the repo (green **Code** button → *Download ZIP*, or `git clone`).
2. Take the one skill folder — e.g. `skills/rot-canary/` (it contains `SKILL.md` and, for some skills, a `references/` subfolder — keep that inside).
3. Zip **that folder** (so the ZIP contains `rot-canary/SKILL.md`, not a bare `SKILL.md`).
4. claude.ai → **Settings → Capabilities → Skills → Create skill** → upload the ZIP.
5. Repeat per skill you want (per-user, remember).

That's the whole install. Skills update by re-uploading a newer copy — check the repo's Releases page for what changed.

## Honest frame

On claude.ai you get each skill's **manual core** — the contract text driving the model. The automation layer (hooks that trigger scans, conductors that nudge, per-worker routing) is Claude Code's, and no equivalent exists in this sandbox. If a hookless platform later gains hooks or subagents, the capability ladder moves that platform up — the gate is capability, never a hardcoded platform list.
