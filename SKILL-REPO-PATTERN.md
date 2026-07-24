# Skill-Repo Pattern (TheColliery)

> The shared REPOSITORY-STRUCTURE pattern for every series skill repo — extracted from the live CoalMine / CoalTipple / CoalBoard / CoalHearth trees so a new repo (and a conform pass on an old one) ships sibling-consistent. Companion to [DOC-PATTERN.md](./DOC-PATTERN.md) (which owns the *writing* pattern for the public docs; this file owns the *layout and machinery*).
> Three standing structure rules govern everything: **`plugin/` is generated, never hand-edited** (the gate byte-checks it), **one SSoT per fact** (version = `plugin.json`, config keys = the schema module, shipped behaviour = the source dirs), and **zero-dependency** (Node built-ins only; no `npm install` anywhere in build, test, or runtime).

## The shape

```text
<tool-repo>/
├── .claude-plugin/
│   ├── plugin.json            # THE version SSoT + plugin manifest
│   └── marketplace.json       # marketplace catalog -> "source": "./plugin"
├── .github/                   # CI + community health (SHA-pinned)
├── <source dirs>              # hooks/ skills/ commands/ agents/ bin/ lib/ config/  (per tool type)
├── platform-configs/          # commented factory .{tool}.json (+ per-platform templates if cross-agent)
├── plugin/                    # GENERATED dist — what the marketplace serves; never hand-edit
├── scripts/                   # build-plugin.mjs · verify.mjs · test.mjs · lib/ (logic + hermetic tests)
├── README.md CHANGELOG.md SECURITY.md CONTRIBUTING.md PRIVACY.md LICENSE
└── .gitignore .markdownlint.json
```

## Layer 1 — plugin manifests (load-bearing paths)

| File | Rule |
|---|---|
| `.claude-plugin/plugin.json` | The **only** place the version lives. `name` = the plugin id. Never set `version` in the marketplace entry too (Claude Code silently prefers `plugin.json`). |
| `.claude-plugin/marketplace.json` | **Exactly this path** — the Claude Code marketplace loader hard-requires it (`File not found: .claude-plugin/marketplace.json` otherwise). A root-level `marketplace.json` passes local validation yet **breaks `claude plugin marketplace add`** — this shipped live once (CoalHearth beta.1) and the advertised install command failed until moved. `plugins[0].source` = `"./plugin"` (serve the dist, never the repo root — a root source would ship dev files). |

## Layer 2 — source vs dist

- **Source dirs** (edit here): `hooks/` + `hooks/hooks.json` · `skills/<name>/SKILL.md` + `references/` + `skill-meta.json` · `commands/*.md` · `agents/*.md` · `bin/` + `lib/` + `config/` (hook-only tools). Which of these exist depends on the tool type — see the variant matrix.
- **`plugin/` dist** (generated): `scripts/build-plugin.mjs` copies the shippable subset — **excluding tests** (`*.test.*` in dist shipped once; the build now filters) — plus `plugin/.claude-plugin/plugin.json`.
- **The sync gate**: `scripts/verify.mjs` byte-compares dist against source **both directions** — stale dist fails AND dist-only orphans fail (nothing ships without a source).
- `hooks/hooks.json` wires entries via `${CLAUDE_PLUGIN_ROOT}/<path>` — verify.mjs asserts the wiring strings.

## Layer 3 — config system (one pattern, four repos)

| Piece | Rule |
|---|---|
| Schema SSoT | `scripts/lib/config-schema.mjs` — every key: type, bounds, default, one-line help. A runtime-shipped copy (`config/schema.json`) is allowed when the hook itself validates (CoalHearth); it is then dist-synced like any source. |
| Factory template | `platform-configs/.{tool}.json` — fully commented (JSONC), every key present at its default. README's Configure section links it. |
| Precedence | global `~/.claude/.{tool}.json` overlaid by the nearest project `.{tool}.json`. |
| The walk | project lookup walks UP from cwd and **STOPS at the home dir** — a config above home is not "this project" (and an unstopped walk once escaped a hermetic-test sandbox into the real global config, turning 3 tests red with no code change). |
| Parse | JSONC (strip comments with a string-preserving regex) + **drop `__proto__` / `constructor` / `prototype`** via a `JSON.parse` reviver — an untrusted cloned-repo config must not pollute `Object.prototype` through the merge (OWASP prototype pollution). |
| Clamp | every numeric key read by a hook is range-clamped on read (an out-of-range value silently degrades to the default, never misbehaves). |

## Layer 4 — scripts + gates

| Script | Role | Required |
|---|---|---|
| `scripts/build-plugin.mjs` | regenerate `plugin/` from source | ALWAYS |
| `scripts/verify.mjs` | fail-loud gate: files exist · manifest valid (semver **accepting pre-release** — a strict `x.y.z` regex once rejected a beta tag at release time) · marketplace points at `./plugin` · factory config validates against the schema · dist in sync + no orphans · version-pin markers current · every skill/command frontmatter `description` ≤ **1024 chars** (`DESC_CAP` — the cross-platform-safe cap, agentskills.io; CC's own listing truncation is 1536 combined `description`+`when_to_use`, docs verified 2026-07-16; USER lock 2026-07-16, past/present/future) | ALWAYS |
| `scripts/test.mjs` | run the zero-dep tests via `node --test` with an **explicit file list** (the directory form is unreliable; a missing listed file fails loud) | ALWAYS |
| `scripts/lib/*.mjs` + `*.test.mjs` | pure logic + its unit tests; hooks get **hermetic spawn tests** (spawn the real hook file, sandbox TEMP + HOME, assert exit 0 / sanctioned-output-only / state effect) | ALWAYS |
| `scripts/install.mjs` | cross-agent installer (non-Claude platforms) | cross-agent tools only |
| `scripts/configure.mjs` | config CLI over the schema SSoT | optional (CM/CT have it; CB deferred) |

Green gate = `build-plugin` → `verify` → `test`, wired into pre-commit/pre-push where the repo keeps git hooks. Release chain (bump sizing, CHANGELOG, signed tag, Release-per-stable-tag, propagation) is owned by [scripts-quality.md](./scripts-quality.md) — not restated here.

## Layer 5 — `.github/` (CI + health)

All workflows **SHA-pinned** (40-char, with a `# vX` comment): `ci.yml` (the green gate on push/PR) · `codeql.yml` · `markdownlint.yml` · `scorecard.yml`. Plus `dependabot.yml` and `ISSUE_TEMPLATE/` (`bug-report.yml` + `config.yml`; add `platform-report.yml` when the tool is cross-agent). Issue templates that name a version carry a `version-pin:` marker so `verify.mjs` catches a stale pin.

## Layer 6 — hooks (pointer)

Every shipped hook follows Phoenix-13 ([hooks-safety.md](./hooks-safety.md) — fail-silent, zero-dep, no network, sandboxed, deterministic, silent except sanctioned channels) and ships with a hermetic spawn test per its §7. Self-update, where present, is the split pattern: the HOOK only schedules (offline, crash-safe stamp), the AGENT verifies + offers the update, consent-gated (`updateMode` ask/auto/remind/off + clamped `updateCheckDays`).

## Layer 7 — the activation ladder (capability-keyed, never platform-keyed)

Every skill's automation ships as a THREE-TIER ladder, resolved per platform by CAPABILITY at run time — never a hardcoded platform→tier table (tables rot; the stale parallel-subagent footer proved it):

1. **auto** — the platform runs lifecycle hooks → the shipped Phoenix-13 hooks drive it (CC today).
2. **best-effort agent-driven** — no hooks → an ALWAYS-LOADED instruction (the platform's AGENTS.md-equivalent, NOT the SKILL.md — it must act before invocation) tells the agent to detect the trigger condition itself and offer the ask-box. Honest label: probabilistic, never claimed as hook parity. Convert only the classes whose job is already "offer" (conductor nudges, canary offers); NEVER per-tool-call bookkeeping (a journal via instructions = token-huge + unreliable — CoalHearth stays hook-only by design).
3. **manual** — the user invokes the skill themselves.

Ship-text states the CONDITION ("has hooks → wire hooks; no hooks → agent-driven"), and the moment a platform ADDS a hook layer it moves UP (wire the snippet, retire the emulation — no-leftover). The monthly what's-new sweep is the catch. Compat matrices name the tier per platform with the honest label.

## Layer 8 — the chokepoint lesson (temporal coverage design)

When a skill must govern a substrate's PAST + PRESENT + FUTURE, look for the substrate's **chokepoint** — a point every unit, of every age, must flow through:

- **Chokepoint exists** → ONE standing gauge there covers all three axes by construction (CoalWash: memory is LOADED every session, so a session-start caliper sees the accumulated past, measures the present, and inescapably catches everything written later). No phases, no sweeps.
- **No chokepoint** → three explicit motions, gold-standard style: install-scan the past + trigger on the present + template-bind the future (CoalLedger: docs are not loaded per-session; gold-standard: rules aren't either).

## Variant matrix — which layers a tool type ships

> 4 exemplar tool types shown (of the 7 siblings — CoalFace/CoalWash/CoalLedger follow the same shapes).

| Layer | CoalMine (skill suite) | CoalTipple (skill + router) | CoalBoard (skill) | CoalHearth (hook-only) |
|---|---|---|---|---|
| `skills/` | 9 skills + `_shared/` | 1 skill | 1 skill | — (no skill) |
| `commands/` | stats · update | memory · off · stats · update | stats · update | stats · update |
| `agents/` | scanner worker | — | — | — |
| `hooks/` conductor | ✓ | ✓ | ✓ | ✓ (2 CC hooks + 2 AG 2.0 hooks; entries in `bin/`, logic in `lib/`) |
| `platform-configs/` | ✓ + per-platform templates + alt hooks | ✓ | ✓ | ✓ (factory + AG hooks.json — CC + Antigravity 2.0) |
| `install.mjs` / `configure.mjs` | ✓ / ✓ | ✓ / ✓ | — / — | — / — |
| `alt/` (PowerShell fallback) | ✓ | — | — | — |

A dir a tool type doesn't need is ABSENT, not empty — no scaffolding "for later".

## Live divergences (re-verified 2026-07-17 — the conform backlog, not part of the pattern)

| Repo | Missing / off-pattern | Weight |
|---|---|---|
| CoalHearth | ~~docs/CI/self-update/package.json~~ **closed at v0.1.0-beta.2** · remaining: `SECURITY.md` uses `# Security Policy`, not the pattern's `# Verifying <Tool>` shape | cosmetic; align on next doc touch |
| CoalBoard | no `scripts/lib/jsonc.mjs` (parse inlined in the conductor) · no `install.mjs`/`configure.mjs` (deferred by decision) · no `platform-report.yml` (cross-agent tool without one) | deliberate/deferred |
| CoalWash / CoalLedger | no `install.mjs`/`configure.mjs` (cross-agent tools ship a documented file-copy path; config CLI not built) · no `platform-report.yml` (cross-agent field-report funnel not yet added) — but both DO have `scripts/lib/jsonc.mjs` + the `# Verifying <Tool>` SECURITY shape | deferred — conform backlog |
| CoalMine / CoalTipple / CoalFace | none — at the full pattern (CoalMine's old `no scripts/test.mjs` gap is closed — it now ships one) | — |

## CI hard-won rules (2026-07-02 — from CoalHearth's first CI run)

- **The first CI push is not just a drift-catch — it is the FIRST REAL EXECUTION of capability-gated tests** the dev box silently skips (symlinks/admin, case-sensitivity, CRLF). Expect first-push reds; they are the pattern working, not the workflow failing.
- **A capability-gated test must skip VISIBLY** (`t.skip(...)`) — never a bare `return` inside a `catch`: a silent vacuous pass reads as green while the assertion has never run (this hid a real symlink-escape bug). Use the unprivileged capability shim where one exists (symlink type `'junction'` on Windows; the type arg is ignored on POSIX).
- **Lexical resolve-and-contain (`path.resolve` + `path.relative`) is NOT symlink-safe.** Any sweep that DELETES or WRITES through a checked path needs **realpath-and-contain**: `fs.realpathSync` BOTH sides (the root too — macOS's `/private`-symlinked tmpdir otherwise no-ops legitimate work), unresolvable candidate = fail-closed.
- **The same applies to read-only PATH COMPARES — the stop-at-home walk.** On macOS `process.cwd()` returns the physical path (`/private/var/...`) while `os.homedir()` returns the raw symlink (`/var/...`), so a lexical `dir === home` NEVER matches and the walk escapes above home. Canonical fix (CF v0.1.0-beta.2, swept to CB + CH same day — one-flock): `function physical(p) { try { return fs.realpathSync(p); } catch { return path.resolve(p); } }` applied to BOTH sides before the compare; walk stays lexical after (fail-open is correct here — a compare, not a delete).

## One flock, one color (series law — USER 2026-07-02)

Siblings share ONE canonical shape on EVERY shared surface (workflows · paths-ignore · scripts · config/walk idioms · doc shapes · hook patterns · fix classes) — not only the surface where a divergence was first noticed. A fix on one sibling is grep-swept to ALL siblings carrying that surface in the same batch. An intentional divergence is NAMED with its reason where it lives; unnamed divergence = drift to fix. New surfaces copy this pattern doc, never a hand-rolled variant.

## New-repo checklist

1. `.claude-plugin/plugin.json` (version `0.1.0-beta.1`) + `.claude-plugin/marketplace.json` → `"./plugin"`.
2. Source dirs per the variant matrix — only what the tool type needs.
3. `platform-configs/.{tool}.json` factory + `scripts/lib/config-schema.mjs`; config load = global→project, stop-at-home, proto-guarded JSONC, clamped reads.
4. `scripts/{build-plugin,verify,test}.mjs` + hermetic hook tests; gate green before the first commit.
5. `.github/` — 4 SHA-pinned workflows + dependabot + issue templates.
6. Public docs per [DOC-PATTERN.md](./DOC-PATTERN.md); machine-local files (`CLAUDE.md` `AGENTS.md` `MEMORY.md` `.claude/` `.agents/` design docs) gitignored — clean-clone.
7. Release + propagation per [scripts-quality.md](./scripts-quality.md); tags = beta + stable, GitHub Releases = stable-only (a beta launch still gets its prerelease Release).
8. **Live-test the advertised install command against the pushed repo** (`claude plugin marketplace add <owner>/<repo>`) — local validation does not catch a wrong manifest path; only the real loader does.
