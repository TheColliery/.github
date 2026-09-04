# Series Canon — L1 (TheColliery)

> The series-wide shape every repo in every zone shares, written per **REPO KIND** rather than per species — the shape found when the seven Coal* repos were measured against each other (internal record, 2026-09-04). Companion to [SKILL-REPO-PATTERN.md](./SKILL-REPO-PATTERN.md), which is the **L2** layer on top of this one — the Coal* skill-repo species' own overlay (the 5 Standard Systems). Scope: the three series zones — **CoalWorks · LLMWorks · Articles** — a partner workspace under the same parent directory is not part of the series and is out of scope here.
> **A single GitHub "template repository" object cannot express this shape.** The de-facto common shape breaks by REPO KIND, not by a single central template, so L1 is written per kind here, and the [`templates/<kind>/`](./templates/) directory in this repo is the machine-checkable embodiment of it — never a loose prose restatement.

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
| Workflows | `ci.yml` · `codeql.yml` · `markdownlint.yml` · `scorecard.yml` · `dependabot-auto-merge.yml` | one `gate.yml` (single OS/Node — sized to a shared Free-plan Actions-minutes pool, never the 3-OS×2-Node published-code matrix) | `check.yml` + `watch-sources.yml` (monthly cron) |
| `dependabot.yml` | Yes | Not shipped in the base skeleton | Not shipped in the base skeleton |
| Release mechanics | Full [RELEASE-PATTERN.md](./RELEASE-PATTERN.md) chain | N/A — a private working repo does not cut public Releases | Full chain where the repo tags versions |
| Publishing dialect | N/A unless the repo also publishes to GitBook | N/A | GitBook shared dialect where the repo is GitBook-synced |
| Typography | Public-class prose (README, docs, SECURITY, and the like) uses an unspaced em dash — like this — for a parenthetical break, never a spaced dash or an ASCII double hyphen | N/A by declaration — a private repo's own prose is not held to a public presentation convention | Same as `published-code` — public-class prose uses the unspaced em dash |

**Source of truth**: [`templates/published-code/`](./templates/published-code/), [`templates/private-working/`](./templates/private-working/), [`templates/article/`](./templates/article/) in this repo — versioned beside this doc and diffable against any live clone with [`scripts/skeleton-check.mjs`](./scripts/skeleton-check.mjs) (`node scripts/skeleton-check.mjs`). A table cell above that disagrees with the directory is this FILE's bug, never the directory's — re-derive before trusting either.

## A private, unpublished instance of `article`

An `article` repo that is never published (no GitBook sync, no public Release) declares
this with a repo-root marker file, `.article-private` — an empty sentinel; its presence
is the whole signal, since classification here reads only the filesystem, never external
metadata. [`scripts/skeleton-check.mjs`](./scripts/skeleton-check.mjs) reports this
variant as `article (private)`.

The declaration changes three cells from the table above, by design — a stated property
of the variant, never an unfilled gap:

| L1 cell | `article` | `article (private)` |
|---|---|---|
| Docs spine | LICENSE + CONTRIBUTING + CHANGELOG | LICENSE + CHANGELOG — **CONTRIBUTING not required** (a single-maintainer private spec invites no contribution) |
| Release mechanics | Full chain where the repo tags versions | **N/A by declaration** — a private, unpublished repo cuts no public Releases |
| Publishing dialect | GitBook shared dialect where GitBook-synced | **N/A by declaration** — never published, not merely unmeasured |

Workflows and LICENSE are unchanged from the public `article` row: a private spec with
external references still needs the same staleness-watching shape, and the LICENSE
row's own law (full text, never a stub) binds regardless of visibility.

**No fourth kind exists for this.** One known instance does not justify a new template
directory, a new classification signature, and a new table column — the marker declares
a variant of the existing `article` kind, not a species of its own.

## Three universal facts, ruled 2026-09-04

Measuring the seven Coal* repos against each other (internal record) found three facts true of **all seven** at once — a canon-level question, not seven separate per-repo fixes.

1. **`concurrency:` groups.** Measured zero of seven repos carrying a `concurrency:` block before this ruling — the canon was silent, not the repos drifting. **Now ruled** in [SKILL-REPO-PATTERN.md](./SKILL-REPO-PATTERN.md) (see "Workflow permissions, dangerous patterns, and branch protection") and applied to every workflow under [`templates/`](./templates/). Re-derive any live-repo gap with `node scripts/skeleton-check.mjs` — a repo's own adoption pass is that repo's, not this repo's.
2. **No doctor/repair verb.** Six of seven repos confirmed absent (the seventh unmeasured this pass). This canon already treats a doctor/repair verb as a recommended practice rather than a requirement — the measurement confirms that calibration was already right, not a gap to close. A future doctor verb is a per-repo quality improvement, never a canon requirement.
3. **Shared release-gate coverage.** The factory's shared release gate covers 3 of the 7 Coal* repos (CoalMine, CoalTipple, CoalBoard) — measured 2026-09-04 (internal record). The remaining four (CoalLedger, CoalWash, CoalHearth, CoalFace) release without it today. This is a fact about the shared release tooling, not a per-repo gap — widening its coverage is a tooling change, noted here rather than fixed here.

## Tag protection

A repo whose release mechanism publishes on a tag push to a public package registry or index — the shape `templates/overlay-llm-deploy/`'s PyPI publish workflow ships — needs a GitHub tag-protection ruleset restricting who may create or push a tag matching that release pattern (for example `v*`, or a project-specific prefix). Without one, anyone with push access can trigger a real publish by pushing an unintended tag, and a cancelled or duplicated publish to a package index is not always retryable. This canon states the requirement; applying the ruleset to a live repo's GitHub settings is a separate, per-repo action — no template file can carry a repository setting.

## A declared absence has a home

The docs spine in the table above is a floor, not a mandate frozen at day one — a young repo may legitimately not yet carry every spine document it lists. The repo's own README Status line is where that is stated (for example, "CONTRIBUTING: not until v1"). A comparison against this canon treats a spine document named absent there as N/A-with-reason, never as drift — the declaration is what turns a gap into a decision.

## A private-working repo's own surfaces are its own

The `private-working` row above states a floor, not a ceiling. A private-working repo may carry additional surfaces this canon does not name — a bespoke evidence tier, a project-specific queue file, a custom verification gate, design artefacts — and those are that room's own choice. Absence from this table is not drift; this canon names only what every `private-working` repo shares, never everything a given one may add on top.

## What this file does not cover

- The 5 Standard Systems and every skill-repo-specific mechanism — [SKILL-REPO-PATTERN.md](./SKILL-REPO-PATTERN.md) (L2).
- Release-body shape and the publish chain — [RELEASE-PATTERN.md](./RELEASE-PATTERN.md).
- Doc writing pattern (headings, spine, data-verbatim) — [DOC-PATTERN.md](./DOC-PATTERN.md).

<!-- coalmine: verified 2026-09-04 · exemplar: a cross-repo measurement across the seven Coal* repos (internal record), re-verified against each repo's own templates/workflows at write time · revalidate 90d -->
