# Release Pattern (TheColliery)

> The shared shape for every series repo's GitHub **Releases** — the title line, the notes body, and which tags get one at all. Companion to [DOC-PATTERN.md](./DOC-PATTERN.md) (the writing pattern for the repo's docs) and [SKILL-REPO-PATTERN.md](./SKILL-REPO-PATTERN.md) (layout + machinery). Written after a title audit found three live drift classes — a repo-name prefix on some titles, hyphen and em-dash separators alternating inside the same repo, and titles carrying a version with no summary at all.
> Two standing rules: **a Release traces to the CHANGELOG** (condense that entry, never invent past it), and **the panel is a front door** — a visitor reads the newest release title before most of the README.

## The title

`vX.Y.Z - <summary>`

| Part | Rule |
|---|---|
| Version | **Bare `vX.Y.Z`** — never a repo-name prefix. The reader is already on the repo page; a prefix buys nothing and renders as a mismatch beside its bare-titled neighbours. |
| Separator | **A spaced hyphen `-`** — not an em-dash. Same forward rule as the CHANGELOG version heading, so the title and its entry read alike. |
| Summary | **Required** — a version alone is not a title. Lower-case sentence style naming WHAT changed ("`- conductor count gate + honest split`"), never marketing ("`- a huge leap for agent quality`"). |
| Breaking | A MAJOR release names the break in the title ("`v2.0.0 - budget guardrail REMOVED`"). |
| Subject | **The title's grammatical subject is THIS repo's own change** — a sibling repo's name may appear only after the own-subject, never leading. Caught live 2026-07-27: CoalBoard's `v1.8.1 - SKILL doc-truth: CoalHearth is LIVE` read as an announcement about the sibling (the USER opened the page and asked whose release it was); a title-sweep found the same shape twice more (`- CoalBoard-audit hardening`). The CHANGELOG heading was fine each time — the error enters at the compress-to-a-headline step, so the check belongs HERE, at the title rule, not in the CHANGELOG discipline. |

<!-- coalmine: verified 2026-08-09 · task-37 audit R2 — RATIFIED HYPHEN, decided on real data, not left as prose. Post-manual population (published_at >= 2026-07-25, the manual's own git-add date): 28 releases, of which 25 carry a well-formed leading-version title — 12 hyphen vs 13 em-dash, a near-tie in raw practice. The tiebreaker: the CHANGELOG version heading this rule keeps forward-consistent with is 100% hyphen, zero exceptions, across every repo in the flock (`## [X.Y.Z] - YYYY-MM-DD` — also keepachangelog.com's own spec format) — ratifying em-dash would break the one alignment this rule exists to keep. scripts/release-conform.mjs already gates em-dash as a finding; no script change needed, manual and machine agree. Full evidence: scratchpad/dispatch/r2r4-return.md. · revalidate 90d -->

## The body

Five parts, in this order. **1-2 are REQUIRED; 3-5 are conditional — except 3 is REQUIRED on a MAJOR/breaking release**, where an action is near-certain anyway.

<!-- coalmine: verified 2026-08-09 · task-37 audit R3 (flock 3/148 = 2%, 0/9 since the manual shipped; 0/7 exemplar projects carry a standing action block) · demoted 1-3-REQUIRED to conditional · revalidate 90d -->

| # | Part | Rule |
|---|---|---|
| 1 | **Lead** — one sentence, no heading | What changed and why it matters to a reader. A plain statement: no marketing adjective, no "we are excited". A MAJOR/breaking release names the break **here, first**, before anything else. |
| 2 | **What changed** | The CHANGELOG entry's own content, kept under the SAME keep-a-changelog headings that entry uses (`### Added` · `### Changed` · `### Deprecated` · `### Removed` · `### Fixed` · `### Security` — the spec's full six, [keepachangelog.com/en/1.1.0](https://keepachangelog.com/en/1.1.0/)) so the mapping is 1:1 and any line traces back. Condensing is allowed; **re-ordering the headings, merging them, or inventing a line is not**. A long entry gets condensed — never summarized into a claim the entry does not make. **A release fixing a known vulnerability names it under its own `### Security` heading, with the assigned CVE where one exists** (OpenSSF Best Practices Badge `release_notes_vulns` — [bestpractices.dev/en/criteria/0](https://www.bestpractices.dev/en/criteria/0): security fixes are called out, not buried inside a generic `### Fixed`). |
| 3 | **What you need to do** — one short block, conditional (required on MAJOR/breaking) | Where the release needs an action from the reader — an update command, a new or changed config key, a migration step — say so plainly. **Where it does not, say nothing** — omit the block rather than write "nothing to do here". |
| 4 | **Gate** — one line, conditional | Test counts · VERIFY · CI. Only if **verified at press** — never a number nobody re-ran. |
| 5 | **Provenance** — one line, conditional | A back-dated Release says it is back-dated for an already-published tag and names the CHANGELOG entry it was written from. Notes citing a sibling repo name it and state it was verified at press. |

### How it is written

- **English, plain, declarative.** Technical terms, commands, paths, config keys and identifiers stay **VERBATIM** — never translated, never prettified.
- **Honest framing survives into the notes.** If the CHANGELOG says a bound is a dollar-and-speed bound and not a token bound, or that a port is wired-not-validated, the Release says the same. **A Release must never be the surface where a caveat quietly drops.**
- **No figure without its test date + tested version.**
- **Lean.** A release body is read at a glance, not studied. If part 2 runs past a screen, condense it and let the CHANGELOG carry the depth.

### Never in a body

- A claim absent from the CHANGELOG and unverified at press.
- An internal path, a rule identifier, or a reference to machine-local agent or memory notes.
- Marketing language.
- **An emoji headline — including inside a body heading, however severe the section.** WHY this differs from a README's `H2` icons (DOC-PATTERN.md's "Emoji section icons are optional but consistent within a file" — that rule governs README navigation, not a Release body, and does not carry over here): a Release surfaces compressed into a single-line card (the `/releases` panel, the Atom feed, a notification email), where an emoji reads as decoration nobody can act on; a README `H2` is a persistent, browsed page where the same emoji reads as a landmark. **Ruled 2026-08-09 (task-37 audit R4), decided explicitly rather than left for the next writer to guess: a MAJOR/breaking section that needs skim-visibility uses the flock's own GFM alert (`> [!WARNING]` / `> [!CAUTION]`, DOC-PATTERN.md's callout table) — never an emoji heading.** GitHub renders the alert natively with the same visual weight, without touching the ban — it is a strictly better fit than an exception would have been, since Part 1's Lead already requires naming a break "here, first" and the alert doesn't need a new carve-out in this rule or in the emoji detector. (CoalHearth `v2.0.2`'s `## ⚠️ BREAKING (v2.0.0)` predates this ruling and is history, not retroactively fixed — it is the one case that prompted it.)

## Which tags get a Release

**Tags = beta + stable · Releases = STABLE only.** Every stable tag gets one, no gaps. A beta/rc/pre-release tag is history: it gets the tag and no Release. An all-beta or all-rc repo therefore shows an **EMPTY Releases panel — and that is correct**, not a gap to fill.

<!-- coalmine: verified 2026-09-02 · exemplar SemVer 2.0.0 cl.3 ("A version once released MUST NOT be modified") + OpenSSF Best Practices Badge `version_unique`/`delivery_unsigned` (bestpractices.dev/en/criteria/0) · revalidate 90d -->
## A published version is immutable — NEVER

**NEVER move, re-cut, force-push over, or delete a published tag; NEVER edit a published Release's substance after the fact.** A tag a user may already have built against, or a Release a user may already have read, is a promise about a specific point in history — moving it silently breaks that promise for anyone who trusted it between the two states. This is the RELEASE half of a rule already half-shipped: the CHANGELOG half already exists — `DOC-PATTERN.md`'s "**A released entry is IMMUTABLE**… to correct one, add a forward-pointing note in the NEW entry" — this section is the same rule applied to the tag and the Release object, not a duplicate of it. A correction to a published Release follows the CHANGELOG's own pattern: a NEW release with a forward-pointing note, never an edit to the old one. The one sanctioned exception is [Back-filling a missed Release](#back-filling-a-missed-release) below, which is filling a GAP, not altering a published state.

<!-- coalmine: verified 2026-08-01 · exemplar ECC-MIGRATION-1X-TO-2.0 · revalidate 90d -->
## A MAJOR release ships a migration note

The body's part 3 ("what you need to do") is one short block. A MAJOR that renames the plugin id, moves the install path, or removes a capability needs more room than that — so it ships a `MIGRATION.md` at the repo root, and part 3 becomes one line pointing at it.

**Source of this shape: UPSTREAM, adopted whole.** ECC's [`docs/MIGRATION-1X-TO-2.0.md`](https://github.com/affaan-m/ECC/blob/HEAD/docs/MIGRATION-1X-TO-2.0.md) is the only migration artifact in either house; we had none. Its three load-bearing parts, in its own words:

| Part | Upstream's wording | Why it earns a slot |
|---|---|---|
| The duplicate symptom, named as expected | *"I now see two ECC plugins" … "Expected. … Running both duplicates skills, commands, and hook executions."* | A rename leaves the old plugin installed. A user who is not told this reads it as a broken upgrade. |
| The leftover list **with an explicit do-NOT-delete list** | *"Safe to delete after the old plugin no longer appears in `/plugin` list"* … followed by *"Do NOT delete `~/.claude/rules/` content you copied intentionally, or personal memory/state files."* | This is the half that makes the section safe to follow. A cleanup list without its exclusions turns a migration doc into a data-loss instruction. |
| One install path only | *"Do not stack the plugin install with the manual installer … Pick one path; stacking creates duplicate skills and duplicate hook runs."* | Every cross-agent sibling ships both a plugin path and a file-copy path, so this hazard is already live here. |

Rules for ours:
- **A MAJOR ships it; a MINOR/PATCH never does.** If the "what you need to do" block fits in three lines, it is not a migration.
- **It answers "does this touch my projects?" explicitly.** Upstream does: *"No. ECC is a harness layer … It does not alter your project code or git history."* A migration doc that leaves that unanswered gets asked it anyway.
- **Every path in the delete list is verified on a real install before the doc ships** — a wrong path in a delete instruction is the worst defect this file can carry.
- The Release body links it; the CHANGELOG entry's breaking `### Removed`/`### Changed` line links it too. It is not a version-pinned file — one `MIGRATION.md` per breaking transition, named for the transition it covers if a repo ever needs two.

**Not adopted from the same source, named so nobody re-derives it:** upstream's release notes lead with a `## Positioning` section and carry repo star/fork counts ([`docs/releases/1.10.0/release-notes.md`](https://github.com/affaan-m/ECC/blob/HEAD/docs/releases/1.10.0/release-notes.md)). Our body rule bans marketing language and requires every line to trace to the CHANGELOG entry; a positioning section traces to nothing. **Ours stands.**

## Back-filling a missed Release

A missed stable Release is back-filled from its CHANGELOG entry, never skipped.

> [!IMPORTANT]
> **Re-pin `Latest` after any back-fill, then re-read it.** Back-filling sets `published_at` to NOW, so the back-filled Release silently steals the `Latest` badge from the newest stable — the panel then advertises an old version as current. Set `make_latest` on the newest stable and CONFIRM it moved by reading the panel back; the badge is the one thing a visitor sees without scrolling. (Caught live on a back-fill, 2026-07-25.)

## The chain around the press

| Order | Step |
|---|---|
| 1 | CHANGELOG entry written **BEFORE** the tag |
| 2 | SemVer sized by that entry's own sections (`### Added` or `### Deprecated` ⇒ MINOR-minimum · a breaking `### Removed`/`### Changed` ⇒ MAJOR) |
| 3 | Version pins bumped with the release — but the SkillSpector scan pin is the ANTI-mark: it names the last real scan and never bumps on a release |
| 4 | **`git status` clean on the tagged commit — MUST, no exceptions.** A tag cut over a dirty tree ships bytes nobody reviewed alongside the commit history that claims to describe it (Cargo's own dirty-tree publish block is already the flock's cited exemplar for this class — [scripts-quality.md](./scripts-quality.md) §2). Gates green · signed tag pushed |
| 4b | A MAJOR only: `MIGRATION.md` written and its every path verified on a real install |
| 5 | Release published per this file |
| 6 | Repo details (About · topics · Releases panel) checked BEFORE the README |
| 7 | Where the repo ships `zip-skills.yml`: publishing the Release fires it — confirm the claude.ai skill ZIPs actually attached, since a failed build leaves the Release assetless ([CLAUDE-AI-INSTALL.md](./CLAUDE-AI-INSTALL.md)). **A digest is REQUIRED for every downloadable archive artifact — the MECHANISM already ships (`SHA256SUMS.txt` alongside CoalMine's and CoalFace's ZIPs, [CLAUDE-AI-INSTALL.md:15](./CLAUDE-AI-INSTALL.md)), this is the missing RULE that makes it mandatory rather than incidental** (OpenSSF Best Practices Badge `delivery_unsigned` — a downloadable artifact with no integrity check has no path for a downloader to know it wasn't corrupted or tampered with in transit). A repo shipping a downloadable archive with no `SHA256SUMS.txt` (or equivalent) is a gap to close before its next Release, not a style choice. |

Bump sizing and propagation are owned by [scripts-quality.md](./scripts-quality.md) §3; the full per-release mark list and its owners live in [SWEEP-MARKS.md](./SWEEP-MARKS.md) Event 2. Neither is restated here.

## A worked example

Illustrative only — an invented MINOR, not any real release (a copied real one would rot the moment that release is edited). Its version, keys and figures are made up to show the shape.

Title:

```text
v1.4.0 - per-project cache dir + stale-lock fix
```

Body:

```markdown
Runs in a shared checkout no longer collide: the cache moves under the project, and a
lock left behind by an interrupted run no longer blocks the next one.

### Added
- `cacheDir` — relocates the run cache. Defaults to the project root, so a shared home
  directory is no longer a shared cache.

### Fixed
- A lock file left by an interrupted run blocked every later run until it was deleted by
  hand. The lock is now reclaimed once its owning process is gone.

**What you need to do:** nothing — update at your convenience. `cacheDir` defaults to the
previous behaviour for anyone who does not set it.

Gate: 148 tests green, VERIFY clean, CI green on the supported Node matrix.
```

Why it passes: the lead is one plain sentence · part 2 keeps the entry's own `### Added` / `### Fixed` headings · part 3 answers the action question explicitly instead of leaving it unsaid · the gate line was re-run at press. Part 5 is absent because nothing applies — a back-filled one would add a single line such as `Back-dated for tag v1.3.0 (published 2026-05-02); written from that version's CHANGELOG entry.`
