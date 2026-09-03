# Skill-Repo Pattern (TheColliery)

> The shared REPOSITORY-STRUCTURE pattern for every series skill repo—extracted from the live CoalMine / CoalTipple / CoalBoard / CoalHearth trees so a new repo (and a conform pass on an old one) ships sibling-consistent. Companion to [DOC-PATTERN.md](./DOC-PATTERN.md) (which owns the *writing* pattern for the public docs; this file owns the *layout and machinery*).
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
├── README.md CHANGELOG.md SECURITY.md CONTRIBUTING.md PRIVACY.md
├── LICENSE NOTICE             # Apache-2.0 + the §4(d) attribution file (flock-wide since the 2026-07-04 relicense)
└── .gitignore .markdownlint.json
```

## Layer 1—plugin manifests (load-bearing paths)

| File | Rule |
|---|---|
| `.claude-plugin/plugin.json` | The **only** place the version lives. `name` = the plugin id. Never set `version` in the marketplace entry too (Claude Code silently prefers `plugin.json`). |
| `.claude-plugin/marketplace.json` | **Exactly this path**—the Claude Code marketplace loader hard-requires it (`File not found: .claude-plugin/marketplace.json` otherwise). A root-level `marketplace.json` passes local validation yet **breaks `claude plugin marketplace add`**—this shipped live once (CoalHearth beta.1) and the advertised install command failed until moved. `plugins[0].source` = `"./plugin"` (serve the dist, never the repo root—a root source would ship dev files). |

## Layer 2—source vs dist

- **Source dirs** (edit here): `hooks/` + `hooks/hooks.json` · `skills/<name>/SKILL.md` + `references/` + `skill-meta.json` · `commands/*.md` · `agents/*.md` · `bin/` + `lib/` + `config/` (hook-only tools). Which of these exist depends on the tool type—see the variant matrix.
- **`plugin/` dist** (generated): `scripts/build-plugin.mjs` copies the shippable subset—**excluding tests** (`*.test.*` in dist shipped once; the build now filters)—plus `plugin/.claude-plugin/plugin.json`.
- **The sync gate**: `scripts/verify.mjs` byte-compares dist against source **both directions**—stale dist fails AND dist-only orphans fail (nothing ships without a source).
- `hooks/hooks.json` wires entries via `${CLAUDE_PLUGIN_ROOT}/<path>`—verify.mjs asserts the wiring strings.

<!-- coalmine: verified 2026-09-02 · exemplar ECC-CONTRIBUTING · revalidate 30d (re-verified UMB-021: content re-checked against source, unchanged—the exemplar covers only the SKILL.md frontmatter shape, never the doc-spine/CODE_OF_CONDUCT/inbound-licence questions DOC-PATTERN.md and NEW-REPO-WIZARD.md now own) -->
### The skill frontmatter contract

Two rules on `skills/<name>/SKILL.md` frontmatter beyond the `DESC_CAP` length gate. **Source of both: UPSTREAM, adopted whole**—we had a length rule and nothing about SHAPE or SOURCE.

- **`description` is an inline or FOLDED scalar, never a literal block.** ECC's [`CONTRIBUTING.md`](https://github.com/affaan-m/ECC/blob/HEAD/CONTRIBUTING.md) states it exactly: *"Frontmatter `description:` is an inline string or folded (`>`) scalar—not a literal block (`|`, `|-`, or `|+`), which preserves internal newlines and breaks flat-table renderers"*. Live here, not theoretical: our own claude.ai packaging step rewrites `description` with a regex that must already cope with folded `>-`, and a literal block would carry its newlines straight into the packaged frontmatter. Gate it beside `DESC_CAP` (Layer 4)—it is a one-character check on the token after the colon, so there is no reason to leave it to a reader.
- **A skill states where it came from.** ECC's [`RULES.md`](https://github.com/affaan-m/ECC/blob/HEAD/RULES.md) requires an `origin` key: *"Use `origin: ECC` for first-party skills and `origin: community` for imported/community skills."* Ours: **`origin: <Tool>` for a skill this repo authored, `origin: <source>` naming the upstream where the surface was ported**—the flock has been an importer since 2026-08-01 ([ADOPTION-PATTERN.md](./ADOPTION-PATTERN.md)) and shipped no way to tell the two apart. Absent = treat as unstated, not as first-party; the gate warns rather than fails until every shipped skill carries one.

Rejected from the same two files, named so nobody re-derives it: their `200-500 lines typical, 800 lines maximum` skill-body sizing. Our `skill-authoring.md` §3b measured that a line count reads green while a body sits ~1.5× over its real token budget, and gates on the platform's own `claude plugin details` projection instead. **Ours stands.**

## Layer 3—config system (one pattern, every sibling)

| Piece | Rule |
|---|---|
| Schema SSoT | `scripts/lib/config-schema.mjs`—every key: type, bounds, default, one-line help. A runtime-shipped copy (`config/schema.json`) is allowed when the hook itself validates (CoalHearth); it is then dist-synced like any source. |
| Factory template | `platform-configs/.{tool}.json`—fully commented (JSONC), every key present at its default. README's Configure section links it. |
| Precedence | global `~/.claude/.{tool}.json` overlaid by the nearest project `.{tool}.json`. |
| The walk | project lookup walks UP from cwd and **STOPS at the home dir**—a config above home is not "this project" (and an unstopped walk once escaped a hermetic-test sandbox into the real global config, turning 3 tests red with no code change). |
| Parse | JSONC (strip comments with a string-preserving regex) + **drop `__proto__` / `constructor` / `prototype`** via a `JSON.parse` reviver—an untrusted cloned-repo config must not pollute `Object.prototype` through the merge (OWASP prototype pollution). |
| Clamp | every numeric key read by a hook is range-clamped on read (an out-of-range value silently degrades to the default, never misbehaves). |

## Layer 4—scripts + gates

| Script | Role | Required |
|---|---|---|
| `scripts/build-plugin.mjs` | regenerate `plugin/` from source | ALWAYS |
| `scripts/verify.mjs` | fail-loud gate: files exist · manifest valid (semver **accepting pre-release**—a strict `x.y.z` regex once rejected a beta tag at release time) · marketplace points at `./plugin` · factory config validates against the schema · dist in sync + no orphans · version-pin markers current · every skill/command frontmatter `description` ≤ **1024 chars** (`DESC_CAP`—the cross-platform-safe cap, agentskills.io; CC's own listing truncation is 1536 combined `description`+`when_to_use`, docs verified 2026-07-16; USER lock 2026-07-16, past/present/future) · that same `description` is an inline or folded (`>`) scalar, never a YAML literal block (the pipe form and its chomping variants—spelled out in Layer 2, not here, because a literal pipe inside a table cell splits the row) · every `skills/<name>/SKILL.md` carries an `origin:` (warn, not fail, until the flock is fully stamped)—both per Layer 2's frontmatter contract | ALWAYS |
| `scripts/test.mjs` | run the zero-dep tests via `node --test` with an **explicit file list** (the directory form is unreliable; a missing listed file fails loud) | ALWAYS |
| `scripts/lib/*.mjs` + `*.test.mjs` | pure logic + its unit tests; hooks get **hermetic spawn tests** (spawn the real hook file, sandbox TEMP + HOME, assert exit 0 / sanctioned-output-only / state effect) | ALWAYS |
| `scripts/install.mjs` | cross-agent installer (non-Claude platforms) | cross-agent tools only |
| `scripts/configure.mjs` | config CLI over the schema SSoT | ALWAYS (owner-signed ใบ D 2026-08-30—a FLOCK STANDARD, not optional: the 5 standard systems require config to be CLI-settable, not merely documented. CM · CT · CL ship one; CB · CH · CF · CW owe one) |

Green gate = `build-plugin` → `verify` → `test`, wired into pre-commit/pre-push where the repo keeps git hooks. Release chain (bump sizing, CHANGELOG, signed tag, Release-per-stable-tag, propagation) is owned by [scripts-quality.md](./scripts-quality.md), and the Release notes' own shape by [RELEASE-PATTERN.md](./RELEASE-PATTERN.md)—not restated here.

## Layer 5—`.github/` (CI + health)

All workflows **SHA-pinned** (40-char, with a `# vX` comment): `ci.yml` (the green gate on push/PR) · `codeql.yml` · `markdownlint.yml` · `scorecard.yml` · `link-check.yml` (below) · `dependabot-auto-merge.yml` (org-canonical since 2026-07-09—actor-guarded to `dependabot[bot]` only, patch/minor only, `gh pr merge --auto` behind a required-checks ruleset; a MAJOR bump and any human-opened PR still wait for the human). Plus `dependabot.yml` and `ISSUE_TEMPLATE/` (`bug-report.yml` + `config.yml`; add `platform-report.yml` when the tool is cross-agent). Issue templates that name a version carry a `version-pin:` marker so `verify.mjs` catches a stale pin.

<!-- coalmine: verified 2026-09-02 · exemplar OpenSSF Scorecard Token-Permissions + Dangerous-Workflow checks (github.com/ossf/scorecard/blob/main/docs/checks.md) + GitHub Actions security hardening guide · revalidate 90d -->
### Workflow permissions, dangerous patterns, and branch protection—MUST

- **Least-privilege `permissions:` on every workflow, MUST.** Top-level `permissions: contents: read`; a job that needs to write (release-please, the `dependabot-auto-merge` merge itself, a badge commit) declares that write AT THE JOB LEVEL, never `write-all` and never a repo-wide write inherited by every job. The repo SETTING (workflow default token permissions) is not a substitute—Scorecard's Token-Permissions check exists because one workflow declaring its own broader block defeats the setting, and a token that can write is a token that can be abused by anything the workflow runs.
- **The dangerous-workflow ban, MUST.** No `pull_request_target` or `workflow_run` trigger that checks out the PR head (Scorecard's Dangerous-Workflow check: this pattern runs with the base repo's secrets against attacker-controlled code) and no untrusted context (a PR title, an issue body, a commit message) interpolated directly into a `run:` shell string (GitHub's own hardening guide names this "script injection"—pass untrusted values through an `env:` variable instead, never string-substitute them into the script).
- **Branch protection is a STANDING row, MUST—not only the Dependabot precondition.** The default branch and any release branch require the green required-status-checks and forbid force-push, full stop. [SWEEP-MARKS.md](./SWEEP-MARKS.md)'s `dependabot-auto-merge-gate` ruleset is the MECHANISM already live org-wide (`required_status_checks` + no-force-push, admin bypass for the maintainer's own direct pushes)—this row promotes what it already enforces from "the thing that makes auto-merge wait" to a standing repo-hygiene requirement independent of whether Dependabot is even the actor.
- **Marketplace pin discipline, MUST—the channel's own contract.** An `archive`-sourced skill on the Claude Code plugin marketplace pins `ref`+`sha` (the vendor's own docs: *"the `sha` is the effective pin"*) and **bumps the plugin version whenever the archive zip or its digest changes**—a version left unbumped after the artifact moved is a stale pin wearing a fresh-looking manifest.

A repo whose skills are published to claude.ai also ships the **claude.ai ZIP-packaging pair**—on a tag push it stages every skill with its description trimmed to claude.ai's 200-char cap, zips each staged directory, and attaches the ZIPs + a `SHA256SUMS.txt` to the GitHub Release as assets. **Copy it from [`templates/overlay-coal-skill/`](./templates/overlay-coal-skill/)** (`.github/workflows/claude-ai-zips.yml` + `scripts/build-claude-ai-zips.mjs`, reconciled 2026-09-03 per UMB-045 from the three live copies—CoalMine is the canonical source, named the flock exemplar in its own `MEMORY.md`; the retired `templates/zip-skills.yml` is tombstoned in `RULES-RETIRED.md`, never a live copy target). It performs NO adaptation, so **a skill folder must be self-contained** (a `SKILL.md` pointing outside its own folder fails the build rather than shipping a dangling instruction). Scope + the capability table: [CLAUDE-AI-INSTALL.md](./CLAUDE-AI-INSTALL.md).

`paths-ignore`: the three gated workflows (`ci.yml` · `codeql.yml` · `scorecard.yml`) skip doc-only commits—**`NOTICE` belongs in that list beside `LICENSE`**, else a legal-text-only commit burns a full CI run. `markdownlint.yml` carries none by design (markdown IS its subject).

A `.github/codeql/codeql-config.yml` (CodeQL `config-file:` path tuning) is OPTIONAL, not flock-canonical—CoalTipple is the only repo carrying one today; add it only where the tuning is needed, and name the reason there.

<!-- coalmine: verified 2026-09-02 · exemplar Standard Readme spec ("Must not contain broken links", github.com/RichardLitt/standard-readme/blob/main/spec.md) · revalidate 90d -->
**`link-check.yml`, MUST, beside `markdownlint.yml`.** `markdownlint` checks markdown FORMAT; nothing checks that a link in it actually resolves. Zero-dep per Phoenix #2: a small `scripts/lib/link-check.mjs` walking the repo's own `.md` files (internal relative links + anchors) is the default; an external SHA-pinned action (`gaurav-nelson/github-action-markdown-link-check` or equivalent) is acceptable ONLY where it is pinned by 40-char SHA like every other workflow action here—never a bare `@vN` tag. Doc-only paths-ignore applies the same as the other three gated workflows.

## Layer 6—hooks (pointer)

Every shipped hook follows Phoenix-13 ([hooks-safety.md](./hooks-safety.md)—fail-silent, zero-dep, no network, sandboxed, deterministic, silent except sanctioned channels) and ships with a hermetic spawn test per its §7. Self-update, where present, is the split pattern: the HOOK only schedules (offline, crash-safe stamp), the AGENT verifies + offers the update, consent-gated (`updateMode` ask/auto/remind/off + clamped `updateCheckDays`).

## Layer 7—the activation ladder (capability-keyed, never platform-keyed)

Every skill's automation ships as a THREE-TIER ladder, resolved per platform by CAPABILITY at run time—never a hardcoded platform→tier table (tables rot; the stale parallel-subagent footer proved it):

1. **auto**—the platform runs lifecycle hooks → the shipped Phoenix-13 hooks drive it (CC today).
2. **best-effort agent-driven**—no hooks → an ALWAYS-LOADED instruction (the platform's AGENTS.md-equivalent, NOT the SKILL.md—it must act before invocation) tells the agent to detect the trigger condition itself and offer the ask-box. Honest label: probabilistic, never claimed as hook parity. Convert only the classes whose job is already "offer" (conductor nudges, canary offers); NEVER per-tool-call bookkeeping (a journal via instructions = token-huge + unreliable—CoalHearth stays hook-only by design).
3. **manual**—the user invokes the skill themselves.

Ship-text states the CONDITION ("has hooks → wire hooks; no hooks → agent-driven"), and the moment a platform ADDS a hook layer it moves UP (wire the snippet, retire the emulation—no-leftover). The monthly what's-new sweep is the catch.

**These three are the MECHANISM, not the headline.** A compat matrix's headline tier per platform is one of exactly two words—**`validated`** (Claude Code) or **`works with`** (everywhere else)—the words already shipped, re-affirmed by USER ruling 2026-08-01 and owned by [DOC-PATTERN.md](./DOC-PATTERN.md) §"Platform tiers (row 4)". The ladder rung (`auto` · `agent-driven` · `manual`) is the DETAIL sentence beside the row; it never replaces the headline word, and `wired` / `design-supported` are no longer headline words at all.

**What FLIPS a platform from `works with` to `validated` was set long before this wording pass—USER 2026-07-02, the PLATFORM-SUPPORT × INSTALL MATRIX:** **one real end-to-end contract run on that platform.** Not a doc claim, not a capability probe, not a search result—a run. That rule already carries the per-tool calibration and it still governs: CM is cross-agent FULL with no per-platform verify needed (read/analyze degrades safe) · CH is hook-engine-keyed · CF and CB are sub-capable, verify not-strict · **CT is CC-only and verify-STRICT—the spawn-tool schema is checked before ANY adapter, because the product actuates through the model-pick API.** The 2026-08-01 ruling settled the WORDS; this one settles the EVIDENCE, and it is the older and stricter of the two.

## Layer 8—the chokepoint lesson (temporal coverage design)

When a skill must govern a substrate's PAST + PRESENT + FUTURE, look for the substrate's **chokepoint**—a point every unit, of every age, must flow through:

- **Chokepoint exists** → ONE standing gauge there covers all three axes by construction (CoalWash: memory is LOADED every session, so a session-start caliper sees the accumulated past, measures the present, and inescapably catches everything written later). No phases, no sweeps.
- **No chokepoint** → three explicit motions, gold-standard style: install-scan the past + trigger on the present + template-bind the future (CoalLedger: docs are not loaded per-session; gold-standard: rules aren't either).

## Variant matrix—which layers a tool type ships

> 4 exemplar tool types shown (of the 7 siblings—CoalFace/CoalWash/CoalLedger follow the same shapes).

| Layer | CoalMine (skill suite) | CoalTipple (skill + router) | CoalBoard (skill) | CoalHearth (hook-only) |
|---|---|---|---|---|
| `skills/` | 9 skills + `_shared/` | 1 skill | 1 skill |—(no skill) |
| `commands/` | stats · update | memory · off · stats · update | stats · update | stats · update |
| `agents/` | scanner worker |—|—|—|
| `hooks/` conductor | ✓ | ✓ | ✓ | ✓ (2 CC hooks + 2 AG 2.0 hooks; entries in `bin/`, logic in `lib/`) |
| `platform-configs/` | ✓ + per-platform templates + alt hooks | ✓ | ✓ | ✓ (factory + AG hooks.json—CC + Antigravity 2.0) |
| `install.mjs` / `configure.mjs` | ✓ / ✓ | ✓ / ✓ |—/—|—/—|
| `alt/` (PowerShell fallback) | ✓ |—|—|—|

**This matrix predates CoalFace, CoalWash and CoalLedger and covers 4 of the 7 live rooms—a real gap, wider than any single fix in this file, and named here rather than silently carried.** Extending it to 7 columns is its own unit, each room supplying its own column (never authored from here—ORG-SYNC RIDES THE PUSH).

A dir a tool type doesn't need is ABSENT, not empty—no scaffolding "for later".

## Live divergences (re-verified 2026-07-17—the conform backlog, not part of the pattern)

| Repo | Missing / off-pattern | Weight |
|---|---|---|
| CoalHearth | ~~docs/CI/self-update/package.json~~ **closed at v0.1.0-beta.2** · remaining: `SECURITY.md` uses `# Security Policy`, not the pattern's `# Verifying <Tool>` shape | cosmetic; align on next doc touch |
| CoalBoard | no `scripts/lib/jsonc.mjs` (parse inlined in the conductor) · no `install.mjs`/`configure.mjs` (deferred by decision) · no `platform-report.yml` (cross-agent tool without one) | deliberate/deferred |
| CoalWash | no `install.mjs`/`configure.mjs` (cross-agent tools ship a documented file-copy path; config CLI not built) · no `platform-report.yml` (cross-agent field-report funnel not yet added)—but DOES have `scripts/lib/jsonc.mjs` + the `# Verifying <Tool>` SECURITY shape | deferred—conform backlog · a `configure.mjs` is now owed per ใบ D (this room's own line to re-verify) |
| CoalLedger | ~~no `configure.mjs`~~ **closed at `v0.6.0-beta.1`** (`fb349dd`, CWK-023)—ships `scripts/configure.mjs`, CoalMine's shape, schema-table-driven with `--global` · remaining: no `install.mjs` (cross-agent tools ship a documented file-copy path, README `## Install`) · no `platform-report.yml` (cross-agent field-report funnel not yet added)—DOES have `scripts/lib/jsonc.mjs` + the `# Verifying <Tool>` SECURITY shape | partially closed—same strikethrough-plus-**closed at** format this table already uses for CoalHearth and CoalTipple |
| CoalTipple | ~~no committed pre-commit/pre-push hooks, so `verify.mjs` + `test.mjs` ran on CI only~~ **closed 2026-07-27** (`6253f06`)—`.githooks/pre-commit` + `.githooks/pre-push` now ship, both running `verify.mjs` then `test.mjs`, `.gitattributes` pins `.githooks/** text eol=lf`; matches [scripts-quality.md](./scripts-quality.md) §2's shape exactly. Re-verified at source 2026-08-09 (task-37 audit S2): both files present, identical content, correct wiring; `core.hooksPath` enablement is documented inline in the hook's own header comment, same as every other repo | closed |
| CoalMine / CoalFace | re-verify at L3—the 2026-07-17 pass was shallower than L3, so its "none—at the full pattern" verdict is unconfirmed rather than disproven. **No defect is asserted here.** (CoalMine's old `no scripts/test.mjs` gap IS closed—it ships one.) | unknown until re-verified |

## CI hard-won rules (2026-07-02—from CoalHearth's first CI run)

- **The first CI push is not just a drift-catch—it is the FIRST REAL EXECUTION of capability-gated tests** the dev box silently skips (symlinks/admin, case-sensitivity, CRLF). Expect first-push reds; they are the pattern working, not the workflow failing.
- **A capability-gated test must skip VISIBLY** (`t.skip(...)`)—never a bare `return` inside a `catch`: a silent vacuous pass reads as green while the assertion has never run (this hid a real symlink-escape bug). Use the unprivileged capability shim where one exists (symlink type `'junction'` on Windows; the type arg is ignored on POSIX).
- **Lexical resolve-and-contain (`path.resolve` + `path.relative`) is NOT symlink-safe.** Any sweep that DELETES or WRITES through a checked path needs **realpath-and-contain**: `fs.realpathSync` BOTH sides (the root too—macOS's `/private`-symlinked tmpdir otherwise no-ops legitimate work), unresolvable candidate = fail-closed.
- **The same applies to read-only PATH COMPARES—the stop-at-home walk.** On macOS `process.cwd()` returns the physical path (`/private/var/...`) while `os.homedir()` returns the raw symlink (`/var/...`), so a lexical `dir === home` NEVER matches and the walk escapes above home. Canonical fix (CF v0.1.0-beta.2, swept to CB + CH same day—one-flock): `function physical(p) { try { return fs.realpathSync(p); } catch { return path.resolve(p); } }` applied to BOTH sides before the compare; walk stays lexical after (fail-open is correct here—a compare, not a delete).

## One flock, one color (series law—USER 2026-07-02)

Siblings share ONE canonical shape on EVERY shared surface (workflows · paths-ignore · scripts · config/walk idioms · doc shapes · hook patterns · fix classes)—not only the surface where a divergence was first noticed. A fix on one sibling is grep-swept to ALL siblings carrying that surface in the same batch. An intentional divergence is NAMED with its reason where it lives; unnamed divergence = drift to fix. New surfaces copy this pattern doc, never a hand-rolled variant.

## New-repo checklist

1. `.claude-plugin/plugin.json` (version `0.1.0-beta.1`) + `.claude-plugin/marketplace.json` → `"./plugin"`.
2. Source dirs per the variant matrix—only what the tool type needs.
3. `platform-configs/.{tool}.json` factory + `scripts/lib/config-schema.mjs`; config load = global→project, stop-at-home, proto-guarded JSONC, clamped reads.
4. `scripts/{build-plugin,verify,test}.mjs` + hermetic hook tests; gate green before the first commit.
5. `.github/`—the SHA-pinned workflow set (Layer 5) + dependabot + issue templates.
6. Public docs per [DOC-PATTERN.md](./DOC-PATTERN.md); machine-local files (`CLAUDE.md` `AGENTS.md` `MEMORY.md` `.claude/` `.agents/` design docs) gitignored—clean-clone.
7. Release + propagation per [scripts-quality.md](./scripts-quality.md); tags = beta + stable, GitHub Releases = stable-only—a beta/rc tag gets no Release; [RELEASE-PATTERN.md](./RELEASE-PATTERN.md) governs, not restated here.
8. **Live-test the advertised install command against the pushed repo** (`claude plugin marketplace add <owner>/<repo>`)—local validation does not catch a wrong manifest path; only the real loader does.
