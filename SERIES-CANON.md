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

## Article variants — the marker discipline

An `article` repo can depart from the plain public row above in more than one way — not
published at all, or published by a mechanism that never produces the file the plain
row's signature checks for. **The declared discipline for every such departure: a
repo-root MARKER FILE, never a rule inferred from folder location or from what a repo
happens to lack.** A folder sitting directly under a zone with no `.git` cannot, on its
own, say WHY it has none — a scaffolding-in-progress room, a scratch directory, and a
genuinely finished repo published by an unusual mechanism all look identical from
outside. A marker is a maintainer's own deliberate statement, checked first and
unconditionally by [`classify()`](./scripts/lib/skeleton-check-lib.mjs), and it costs
one exported constant plus one `classify()` branch per variant — cheaper than defining
what a "member" is well enough for a location-based rule to tell those cases apart, and
it never guesses.

### A private, unpublished instance of `article`

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

### A publicly-published instance of `article` via GitBook change request

An `article` repo can also be genuinely public and fully published, yet never carry
`.gitbook.yaml` — that file is git-sync configuration, and a room that publishes by
submitting a one-off GitBook *change request* instead of continuous git-sync has nothing
to configure it with. It has no `.git` of its own either. Without a signal, this reads
as UNCLASSIFIED even though it is a complete, working `article`. This declares with its
own repo-root marker, `.article-changerequest` — an empty sentinel, checked before the
plain `.gitbook.yaml` signature since it is the more specific claim.
[`scripts/skeleton-check.mjs`](./scripts/skeleton-check.mjs) reports this variant as
`article (change-request)`.

The declaration changes one cell, and only one — this variant is public and fully
published, so nothing about visibility or release mechanics differs from the plain row:

| L1 cell | `article` | `article (change-request)` |
|---|---|---|
| Docs spine | LICENSE + CONTRIBUTING + CHANGELOG | Unchanged — CONTRIBUTING stays required (this room is public and does want contributors) |
| Publishing dialect | GitBook shared dialect, git-synced | **GitBook change-request dialect — `.gitbook.yaml` is never expected and is not a finding when absent** |

Workflows, LICENSE, and Release mechanics are unchanged from the public `article` row:
a change-request room still needs the same staleness-watching shape, still owes the full
LICENSE text, and still cuts Releases the same way a git-synced article does.

### No fourth or sixth kind exists for either of these

One known instance of a departure does not justify a new template directory, a new
column in the L1 table above, or a location-based rule — a marker declares a VARIANT of
the existing `article` kind, not a species of its own. Both variants above share
`article`'s own template directory; `templates/article (private)/` and
`templates/article (change-request)/` do not exist and are not planned.

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

## A kind signal for `private-working`, the same marker discipline as the article variants

`private-working`'s own classification signature is the workflow file its floor already
requires (`.github/workflows/gate.yml`, present without a `ci.yml`) — but that signature
is only visible once a repo has actually adopted the workflow. A repo that is genuinely
private-working in every other respect, but has not yet wired `gate.yml`, reads
UNCLASSIFIED with no way to say which kind it is — the same shape the two article
variants above already closed, applied here to the third kind.

This declares with a repo-root marker, `.private-working` — an empty sentinel,
checked before the structural `gate.yml` signature since it is the more specific,
deliberate claim. A repo that has already adopted `gate.yml` needs no marker at all;
the structural signature keeps working unchanged.

**Why a marker, not a rule inferred from the repo being private:** visibility (a
GitHub access-control setting) and KIND (a structural shape this canon defines) are
genuinely orthogonal properties. A private repo is not intrinsically `private-working`
— it may be a `published-code` room still in its private, pre-launch phase, the way
many repositories start private and go public later. A rule that classified by
visibility alone would misclassify that repo the moment it gained a GitHub remote,
before its own CI workflows ever landed. The marker never has this failure mode: it
states intent directly, the same reasoning the two article-variant markers above
already use. A visibility-based rule would also need a live REST read (or a local
hint that does not exist) to know a repo's visibility at all — a marker keeps
classification a pure, offline, filesystem-only operation, exactly as it is for
every other kind.

## What this file does not cover

- The 5 Standard Systems and every skill-repo-specific mechanism — [SKILL-REPO-PATTERN.md](./SKILL-REPO-PATTERN.md) (L2).
- Release-body shape and the publish chain — [RELEASE-PATTERN.md](./RELEASE-PATTERN.md).
- Doc writing pattern (headings, spine, data-verbatim) — [DOC-PATTERN.md](./DOC-PATTERN.md).

<!-- coalmine: verified 2026-09-04 · exemplar: a cross-repo measurement across the seven Coal* repos (internal record), re-verified against each repo's own templates/workflows at write time · revalidate 90d -->
