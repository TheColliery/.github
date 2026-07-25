# Installing Coal* skills on claude.ai (web / desktop app)

claude.ai can run **custom skills**: a ZIP containing a `SKILL.md` (YAML frontmatter with `name` + `description`), uploaded through the app's skill settings. Two limits to know up front:

- **Per-user** — an uploaded skill is yours alone (an Enterprise owner can provision org-wide; nobody else can).
- **No sync** — claude.ai skills are separate from Claude Code and the API. The same skill = separate installs per surface.

> [!IMPORTANT]
> **The install mechanics below are pending re-verification.** The plan requirements, the exact settings path, and the upload flow were last checked 2026-07-16 and are version-sensitive — claude.ai moves. A verification pass is in flight; until it lands, treat the *menu path* and the *plan list* as unconfirmed and follow whatever the app currently shows. The capability table and the packaging rules below do not depend on it.

## Install

Every supported skill is published as a ZIP **attached to its tool's GitHub Release**, built by CI from the exact code that shipped in that version.

1. Open the tool's **Releases** page and pick the latest stable release.
2. Under **Assets**, download the skill you want — `<tool>-<skill>-claudeai.zip`.
3. In claude.ai, go to skill settings and create a skill from that ZIP.
4. Repeat per skill (per-user, remember).

To update, download the newer release's ZIP and re-upload it — claude.ai has no auto-update and no config file; **re-uploading is how a skill changes on this surface**. The Release notes say what changed.

There is nothing to build by hand. A ZIP contains one skill folder and extracts to `<skill>/SKILL.md`; its contents are byte-reproducible from the tag it was built at.

## Which Coal* skills are published here

claude.ai runs a skill's `SKILL.md` in a code-execution sandbox — **no hooks, no subagents, no worker-model pick**. That gates the series by capability:

| Tool | On claude.ai | Why |
|---|---|---|
| **CoalMine** (9 canaries) | Published — manual invocation | The canaries read + analyze; that is exactly what the sandbox does. The Claude-Code hook automation (session-end auto-scan, conductor) does not exist here — you invoke a canary by asking for it. |
| **CoalLedger** (docs canaries) | Published — manual invocation | Same read+analyze shape as CoalMine. |
| **CoalFace** | Published — sequential degrade | No subagents, so the contract's built-in degrade path runs: scout → units in order → QC → apply, one lane. You keep the discipline (scout, partition, QC, receipt) and none of the parallel speed. |
| **CoalWash** | Not published (yet) | Its safety property is code-enforced — the fidelity gate and snapshot/undo that make a memory rewrite reversible. On a surface where that engine cannot be relied on to run, you would get the judgment layer without the enforcement layer. Revisit when the tool reaches stable and the engine is confirmed to run here. |
| **CoalBoard** | Not ported | The board's value is **blind parallel lenses** (decorrelation). claude.ai has no subagent isolation — sequential "lenses" in one context anchor on each other, which silently destroys the one thing the board sells. An honest no-port beats a fake board, so no CoalBoard ZIP is built, ever. |
| **CoalTipple** | Not portable | Routing actuates by picking a spawned worker's model; no spawn tool exists here. |
| **CoalHearth** | Not portable | Its engine is lifecycle hooks (Claude Code + Antigravity 2.0); claude.ai has no hook engine. |

## Why there is no separate "claude.ai edition"

A published ZIP is the shipped skill folder, unmodified. That is deliberate: **the platform difference belongs in the skill body, not in a second edition of it.** A Coal\* skill states its own capability branch once — "auto-wired where the platform has hooks, manual elsewhere", "no fan-out → degrade to a sequential pipeline" — so the same text is true on every surface and there is no adapted copy to keep in sync.

Two rules follow, and they bind the skills, not the packaging:

- **A skill folder must be self-contained.** Your upload is only that folder, so a `SKILL.md` that points outside it (a sibling `scripts/` directory, a plugin-root path) ships a dangling instruction. CI refuses to package such a skill rather than publish a broken one.
- **A platform claim is capability-keyed, never platform-hardcoded.** "Has hooks → wire hooks; no hooks → manual" survives a platform gaining hooks later; "on claude.ai, manual" does not.

## Honest frame

On claude.ai you get each skill's **manual core** — the contract text driving the model. The automation layer (hooks that trigger scans, conductors that nudge, per-worker routing) is Claude Code's, and no equivalent exists in this sandbox. These packages are **built and published but not yet run end-to-end on claude.ai** — the tier moves to validated on the first real run, not before. If a hookless platform later gains hooks or subagents, the capability ladder moves that platform up: the gate is capability, never a hardcoded platform list.
