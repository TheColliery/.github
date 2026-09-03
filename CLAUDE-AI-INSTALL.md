# Installing Coal* skills on claude.ai (web / desktop app)

claude.ai can run **custom skills**: a ZIP containing a `SKILL.md` (YAML frontmatter with `name` + `description`), uploaded through the app's skill settings. Two limits to know up front:

- **Per-user**—an uploaded skill is yours alone (an Enterprise owner can provision org-wide; nobody else can).
- **No sync**—claude.ai skills are separate from Claude Code and the API. The same skill = separate installs per surface.

> [!IMPORTANT]
> **The install mechanics below are pending re-verification.** The plan requirements, the exact settings path, and the upload flow were last checked 2026-07-16 (31 days ago as of this note) and are version-sensitive—claude.ai moves. A pass was said to be in flight as of 2026-07-25; no evidence since then shows it landed, so that claim is retracted rather than carried forward unconfirmed. Treat the *menu path* and the *plan list* as unconfirmed and follow whatever the app currently shows. The capability table and the packaging rules below do not depend on it.

## Install

Two ways to get the ZIP—which one applies depends on the tool.

**Fastest, where a Release ships one:** CoalMine and CoalFace attach pre-built ZIPs to every Release (one per CoalMine canary, one for CoalFace) plus a `SHA256SUMS.txt`. Open the Release's Assets, download the skill's `.zip`, verify it against `SHA256SUMS.txt` (`sha256sum -c SHA256SUMS.txt` or your OS's equivalent—the checksum file exists so you can check the ZIP wasn't corrupted or tampered with in transit, not as decoration), then upload it. No build step. CoalLedger's version of this is in progress and has not shipped on a stable Release yet; every other tool in the table below is either excluded from claude.ai entirely or has no ZIP workflow.

**Always works, any tool:** build it yourself—every skill folder in the repos already IS the package.

1. Get the repo (green **Code** button → *Download ZIP*, or `git clone`).
2. Take one skill folder from `plugin/skills/`—e.g. `plugin/skills/rot-canary/`. Keep its `references/` subfolder inside.
3. Zip **that folder**, so the archive contains `rot-canary/SKILL.md` and not a bare `SKILL.md`.
4. In claude.ai, go to skill settings and create a skill from that ZIP. Repeat per skill (per-user, remember).

Use `plugin/skills/`, not `skills/`—the top-level source tree still holds unexpanded template markers, so a ZIP built from it ships broken text.

To update, rebuild the folder (or download the newer Release ZIP) and re-upload—claude.ai has no auto-update and no config file; **re-uploading is how a skill changes on this surface**.

## Which Coal* skills work here

claude.ai runs a skill's `SKILL.md` in a code-execution sandbox—**no hooks, no subagents, no worker-model pick**. That gates the series by capability:

| Tool | On claude.ai | Why |
|---|---|---|
| **CoalMine** (9 canaries) | Works—manual invocation | The canaries read + analyze; that is exactly what the sandbox does. The Claude-Code hook automation (session-end auto-scan, conductor) does not exist here—you invoke a canary by asking for it. |
| **CoalLedger** (docs canaries) | Works—manual invocation | Read+analyze like CoalMine, with one difference: `doc-structure` RUNS a bundled Node engine, so ZIP the built `plugin/skills/doc-structure/` folder (the engine rides inside it at `lib/`) and keep code execution on. |
| **CoalFace** | Works—sequential degrade | No subagents, so the contract's built-in degrade path runs: scout → units in order → QC → apply, one lane. You keep the discipline (scout, partition, QC, receipt) and none of the parallel speed. |
| **CoalWash** | Held back | Its safety property is code-enforced—the fidelity gate and snapshot/undo that make a memory rewrite reversible. On a surface where that engine cannot be relied on to run, you would get the judgment layer without the enforcement layer. Revisit when the tool reaches stable and the engine is confirmed to run here. |
| **CoalBoard** | Not ported | The board's value is **blind parallel lenses** (decorrelation). claude.ai has no subagent isolation—sequential "lenses" in one context anchor on each other, which silently destroys the one thing the board sells. An honest no-port beats a fake board, so no CoalBoard ZIP is built, ever. |
| **CoalTipple** | Not portable | Routing actuates by picking a spawned worker's model; no spawn tool exists here. |
| **CoalHearth** | Not portable | Its engine is lifecycle hooks (Claude Code + Antigravity 2.0); claude.ai has no hook engine. |

## Why there is no separate "claude.ai edition"

A ZIP you build is the shipped skill folder, unmodified. That is deliberate: **the platform difference belongs in the skill body, not in a second edition of it.** A Coal\* skill states its own capability branch once—"auto-wired where the platform has hooks, manual elsewhere", "no fan-out → degrade to a sequential pipeline"—so the same text is true on every surface and there is no adapted copy to keep in sync.

Two rules follow, and they bind the skills, not the packaging:

- **A skill folder must be self-contained.** Your upload is only that folder, so a `SKILL.md` that points outside it (a sibling `scripts/` directory, a plugin-root path) ships a dangling instruction. CI refuses to package such a skill rather than publish a broken one.
- **A platform claim is capability-keyed, never platform-hardcoded.** "Has hooks → wire hooks; no hooks → manual" survives a platform gaining hooks later; "on claude.ai, manual" does not.

## Honest frame

On claude.ai you get each skill's **manual core**—the contract text driving the model. The automation layer (hooks that trigger scans, conductors that nudge, per-worker routing) is Claude Code's, and no equivalent exists in this sandbox. These packages are **not yet run end-to-end on claude.ai**—the tier moves to validated on the first real run, not before. If a hookless platform later gains hooks or subagents, the capability ladder moves that platform up: the gate is capability, never a hardcoded platform list.
