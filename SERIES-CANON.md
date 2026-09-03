# Series Canon — L1 (TheColliery)

> The series-wide shape every repo in every zone shares, written per **REPO KIND** rather than per species — the shape UMB-043 found the flock actually holds when measured (`scratchpad/dispatch/convention-matrix-2026-09.md`; main's own first measurement, 11 local clones, 2026-09-03). Companion to [SKILL-REPO-PATTERN.md](./SKILL-REPO-PATTERN.md), which is the **L2** layer on top of this one — the Coal* skill-repo species' own overlay (the 5 Standard Systems). Scope: the three series zones — **CoalWorks · LLMWorks · Articles** — never `talongate`, a partner workspace under the umbrella directory but outside the series (owner 2026-09-03: *"ไม่เอา TG — TG ไม่อยู่ใน TheColliery"*).
> **A single GitHub "template repository" cannot express this** (owner 2026-09-03: *"Template repository ตอนนี้อาจจะตาย … มีรูปแบบกลางที่ใช้ทั้งหมดไหม"*) — the de-facto common shape breaks by REPO KIND, not by species, so L1 is written per kind and the `templates/<kind>/` directory in this repo is the machine-checkable embodiment of it, never a loose prose restatement.

## The two layers

| Layer | Scope | Home |
|---|---|---|
| **L1 — series-wide** | Every repo in every zone, grouped by REPO KIND (published-code · private-working · article) | This file + [`templates/<kind>/`](./templates/) |
| **L2 — skill-repo species** | The Coal* rooms additionally, on top of L1 | [SKILL-REPO-PATTERN.md](./SKILL-REPO-PATTERN.md) |

A Coal* room is a `published-code` repo (L1) carrying the 5 Standard Systems (L2) on top. An LLM-deploy repo or an article repo is L1 only, with its own species overlay where one exists (`templates/overlay-llm-deploy/`). **Nothing below is invented**: where the docs were silent, the majority shape found by measurement is written down here, WITH its deriving command, so the next measurement can check whether it has rotted.

## L1 by repo kind

| | `published-code` | `private-working` | `article` |
|---|---|---|---|
| Visibility | Public | Private | Public |
| Docs spine | Full [DOC-PATTERN.md](./DOC-PATTERN.md) spine (README/SECURITY/CONTRIBUTING/CODE_OF_CONDUCT/PRIVACY) | None — LICENSE only | LICENSE + CONTRIBUTING + CHANGELOG |
| LICENSE | Full text (never SPDX-only, never a stub) | Full text | Full text |
| `.githooks/` | `pre-commit` + `pre-push` | `pre-push` | none shipped in the base skeleton |
| Workflows | `ci.yml` · `codeql.yml` · `markdownlint.yml` · `scorecard.yml` · `dependabot-auto-merge.yml` | one `gate.yml` (single OS/Node — sized to the org's shared Free-plan Actions-minutes pool, never the 3-OS×2-Node published-code matrix) | `check.yml` + `watch-sources.yml` (monthly cron) |
| `dependabot.yml` | Yes | Not shipped in the base skeleton | Not shipped in the base skeleton |
| Release mechanics | Full [RELEASE-PATTERN.md](./RELEASE-PATTERN.md) chain | N/A — a private working repo does not cut public Releases | Full chain where the repo tags versions |
| Publishing dialect | N/A unless the repo also publishes to GitBook | N/A | GitBook shared dialect where the repo is GitBook-synced (see the `gitbook` skill's own conventions — not restated here) |

**Source of truth**: `templates/published-code/`, `templates/private-working/`, `templates/article/` in this repo — versioned beside this doc and diffable against every live clone by [`scripts/skeleton-check.mjs`](./scripts/skeleton-check.mjs). A table cell above that disagrees with the directory is this FILE's bug, never the directory's — re-derive with `node scripts/skeleton-check.mjs` before trusting either.

## The three ruled universals (CWK-065 shard 1, 2026-09-04)

The CoalWorks shard measured 7 Coal* rooms (284 cells; per-room matrices named in `scratchpad/dispatch/convention-matrix-2026-09.md`) and found three facts true of **all seven** at once — a canon question, never seven room-level fixes (`AGENTS.md`'s own class-vs-instance rule, cited not restated).

1. **`concurrency:` groups.** Measured 0/7 rooms carrying a `concurrency:` block before this ruling—the canon was silent, not the rooms drifting. **Now ruled** in [SKILL-REPO-PATTERN.md](./SKILL-REPO-PATTERN.md) (§"Workflow permissions, dangerous patterns, and branch protection") and applied to every workflow in `templates/` this same sitting (UMB-053). Re-derive the live-room gap with `node scripts/skeleton-check.mjs`—a room's own adoption pass is that room's, not this repo's.
2. **No doctor/repair verb.** 6 of 7 rooms confirmed absent (all but CoalFace, unmeasured this shard). The umbrella's own 5 Standard Systems #3 already states this as a **prefer**, not a MUST (`AGENTS.md`'s "Prefer—install-state is inspectable and the install is reversible" clause)—the shard's measurement confirms the soft ruling was already correctly soft, not a gap to close. A future doctor verb is a per-room quality improvement, never a canon MUST.
3. **`release-gate.ps1` coverage.** Re-verified at source this sitting (read-only, `CoalWorks/release-gate.ps1:37-44`): the gate's own `$map` names exactly `CoalMine`/`CM` · `CoalTipple`/`CT` · `CoalBoard`/`CB`—**3 of 7 rooms**, confirmed independently from the other side by all four uncovered rooms (CoalLedger · CoalWash · CoalHearth · CoalFace each grepped their own tree and found no match). This is a **CoalWorks fact, cited here, not fixed here**—`release-gate.ps1` lives outside every room's own tree (candidate axis D1 from the same shard: *"no room's gates, tests or CI can see it, so a room cannot detect that its own release gate stopped covering it"*), and extending its `$map` is CoalWorks' own follow-up, not an org-level or per-room one.

## Re-verified against the trees, not trusted from the matrix

The matrix that fed this file is a **claim about the rooms, not a source** (`AGENTS.md`'s own UMB-052 lesson, re-applied here per this unit's own rail) — every canon-comparison cell above was re-checked before being written, not copied from the matrix's own prose:

- **`scorecard.yml`'s canon status** — the matrix's own §C6 called this "shipped but named in no canon list." Re-verified: [SKILL-REPO-PATTERN.md:73](./SKILL-REPO-PATTERN.md) already lists `scorecard.yml` in the SHA-pinned workflow set, and a fresh `find`/`ls` across all 7 local Coal room clones confirms **7/7 ship it**. The matrix's claim was already retracted in `AGENTS.md` (UMB-052 bounce-2, `70cbd72`) before this file was written — cited here as the reason `scorecard.yml` needed no canon-list change in this unit, not restated as a live finding.
- **The `~/.claude/coal/<skill>/` namespace cell** (which room did the "old-stamp removal on write") — **deliberately NOT restated here.** `AGENTS.md`'s own RULES-RETIRED.md residue still has this attribution open for the scribe's next sitting; this L1 doc is series-wide by repo KIND, and a skill's own runtime-namespace convention is L2/skill-specific territory in any case — repeating a contested micro-fact here would risk a second, independently-drifting copy of a claim the umbrella is still correcting in its one home.
- **Em-dash spacing, flock-wide** — **deliberately left unmeasured.** The matrix's own §E names this axis as an open instrument problem: different rooms used different regexes, and CoalHearth's own `\w—\w` pattern has already produced two false flock-wide counts (it cannot see an em-dash beside a backtick or a paren). `RELEASE-PATTERN.md`'s own em-dash ruling is narrower and already decided (Release **titles** use a spaced hyphen, never an em-dash — ratified on real data, task-37 audit R2) and is unaffected by this gap. A flock-wide prose em-dash convention needs one fixed regex proven with a positive control before it can become canon text — not invented here.
- **LICENSE = full text per part** — already ruled and homed elsewhere (`TheColliery/.claude/DESIGNER-CONTRACT.md`'s `## LICENSE` section, owner-ordered 2026-08-27/09-01); this file points at it rather than re-deriving or duplicating it.
- **The zone warehouse** (`<zone>/warehouse/`, single writer per file, timestamp + deriving command per row) — named in UMB-043's own row as a **future** step for CoalWorks (*"CoalWorks' version-vs-tag table and release-gate coverage are the same class and move there when its shard runs"*) — not yet built for this zone. First live instance is LLMWorks' `LWK-111`. Stated here as a named direction, not an existing L1 requirement.

## What this file does not cover

- The 5 Standard Systems and every skill-repo-specific mechanism — [SKILL-REPO-PATTERN.md](./SKILL-REPO-PATTERN.md) (L2).
- Release-body shape and the publish chain — [RELEASE-PATTERN.md](./RELEASE-PATTERN.md).
- Doc writing pattern (headings, spine, data-verbatim) — [DOC-PATTERN.md](./DOC-PATTERN.md).
- The ten candidate 8th-dimension axes the shard surfaced (dist-config on-ramp dead links, roster-vs-walk drift, the dist-twin denominator, clamp order, …) — real findings, none yet a ruled canon row; they wait on shard 2 (LLMWorks/Articles) per `scratchpad/dispatch/convention-matrix-2026-09.md` §D/§G, main's to rule.

<!-- coalmine: verified 2026-09-04 · exemplar CWK-065 shard 1 (284 cells) + AGENTS.md UMB-052 CANON CORRECTIONS, re-verified against CoalWorks/release-gate.ps1 and 7 live Coal room clones at write time · revalidate 90d -->
