# Release Notes Template (TheColliery)

> A FIXED FILL-IN SKELETON, not a new set of prose rules. The user's ruling: every sibling's
> release notes should look like family, so there is one skeleton to fill in—not a style
> guide injected into every write, and not something every room's release must "flow into"
> automatically. If a room is writing release notes at all, it fills THIS shape.
> Who fills it: **that room's own doc-writer**—drafted deliberately by a doc-writer and not
> by main, so the voice stays the room's own and does not collapse into main's. **Who presses:
> main**—final check, tag, and the GitHub Release publish stay main's action.
> Companion to [RELEASE-PATTERN.md](./RELEASE-PATTERN.md) (the rules this skeleton implements —
> read that file for the WHY; this file is the fill-in HOW), [DOC-PATTERN.md](./DOC-PATTERN.md)
> (CHANGELOG's own format rules), and [scripts-quality.md](./scripts-quality.md) §3 (bump
> sizing + the release chain this skeleton sits inside).

## 1. The skeleton

Two artifacts, filled together, in this order. The Release **traces to** the CHANGELOG entry —
write the entry first, then condense it into the Release body. Never invent a Release claim the
CHANGELOG entry does not already make.

### 1a. CHANGELOG.md entry

```markdown
## [X.Y.Z] - YYYY-MM-DD

<Optional one-line bump-size + theme summary, bold or plain — only if the entry needs more
than its own section headings to orient a reader. Many entries skip this line entirely.>

### Added
- <a new backward-compatible capability>

### Changed
- <a behavior change that is not a capability add or a break>

### Deprecated
- <a feature marked for future removal — not yet gone>

### Removed
- <a removed capability — MAJOR unless it was already dead/unreachable, see §3 below>

### Fixed
- <a bug fix>

### Security
- <a security-relevant fix>
```

Use only the section headings you need—most entries carry one or two, not all five. Section
choice is not decoration: it is what sizes the SemVer bump (§3).

### 1b. GitHub Release (title + body)

```text
TITLE:
vX.Y.Z - <lower-case sentence naming what changed, no trailing period>

BODY:
<One-sentence lead, no heading. What changed and why it matters to a reader. A MAJOR/breaking
release names the break here, first, before anything else.>

### <the same heading(s) used in the CHANGELOG entry, same order, condensed content>
- <condensed version of each CHANGELOG bullet — trim, never invent>

**What you need to do:** <a required action (update command, new/changed config key,
migration step) — REQUIRED on a MAJOR/breaking release, conditional otherwise. Where
nothing is needed, OMIT this whole line entirely — do not write "Nothing to do" as a
placeholder (RELEASE-PATTERN.md's Part 3, ratified 2026-08-09).>

Gate: <test count / VERIFY / CI status — ONLY if re-run at press; omit the line entirely
if nobody re-ran it for this release>

<Provenance line — ONLY if this is a back-dated Release ("Back-dated for tag vX.Y.Z
(published YYYY-MM-DD); written from that version's CHANGELOG entry.") or the body cites a
sibling repo by name (state that the citation was verified at press).>
```

Fill-in notes:
- Title separator is a **spaced hyphen `-`**, never an em-dash—matches the CHANGELOG
  version heading's own separator so the two read as one family.
- The summary after the version is **required**. `vX.Y.Z` alone is not a title.
- No emoji in the title or a body heading—the ban is headline-shaped, not whole-body
  (body PROSE that quotes an emoji as data is not itself a violation). A MAJOR/breaking
  section needing skim-visibility uses a GFM alert (`> [!WARNING]` / `> [!CAUTION]`)
  instead of an emoji heading—never an emoji, whatever the section's severity
  (RELEASE-PATTERN.md "Never in a body", ratified 2026-08-09; no exception was carved).
- Technical terms, commands, paths, config keys, identifiers: verbatim, never translated or
  prettified, regardless of what language the surrounding prose is in.

### 1c. `MIGRATION.md`—a MAJOR only

<!-- coalmine: verified 2026-08-01 · exemplar ECC-MIGRATION-1X-TO-2.0 · revalidate 90d -->
A MAJOR that renames the plugin id, moves the install path, or removes a capability outgrows part
3's one short block. It ships a root `MIGRATION.md`, and part 3 shrinks to one line pointing at it.
The shape and its rules are [RELEASE-PATTERN.md](./RELEASE-PATTERN.md)'s (§"A MAJOR release ships a
migration note")—adopted whole from ECC's own migration guide, the one release artifact upstream
has that we did not. The skeleton:

```markdown
# Migrating from <old> to <new>

## TL;DR
<the two or three commands, in order>

## "<the symptom a user will actually see>"
<name it as EXPECTED, then say what to do — a rename leaves the old install in place, and a
user who is not told this reads it as a broken upgrade>

## Leftovers after uninstalling <old>
Safe to delete once <old> no longer appears in <the list command>:
- <path> …

Do NOT delete: <the exclusions — user-authored config, personal memory/state files>.

## Does this affect my existing projects?
<answer it explicitly, even when the answer is "no">

## One install path only
<never stack the plugin path with the file-copy path — it duplicates skills and hook runs>
```

Every path in the delete list is verified on a real install before the doc ships. A MINOR or PATCH
never gets one; if the "what you need to do" block fits in three lines, it is not a migration.

## 2. Worked example—CoalHearth v2.1.1 (real, verifiable)

Filled from the actual shipped CHANGELOG entry
(`CoalHearth/CHANGELOG.md`, `## [2.1.1] - 2026-07-27`) and RELEASE-PATTERN.md's shape.
Check it yourself: `github.com/TheColliery/CoalHearth/blob/main/CHANGELOG.md` and
`github.com/TheColliery/CoalHearth/releases/tag/v2.1.1`. **This is the skeleton filled
correctly**—see §5 for exactly how the Release actually published for this tag differs
from what follows.

### CHANGELOG entry (real, condensed for space—full text is longer in the shipped file)

```markdown
## [2.1.1] - 2026-07-27

**PATCH** — the journal directory is no longer planted wherever a tool call's cwd happens
to sit. Two commits on one branch: the root-anchor fix, then a station-3 review pass that
found the anchor itself had a containment bug and one path it didn't yet cover.

### Security
- The journal (`lib/contained-dir.js` `containedOutputDir`) no longer plants
  `.claude/coalhearth/` in whatever directory a hook's cwd happens to be. [...]
- The self-clean step that mops up a legacy phantom directory had its own containment bug:
  it could delete the journal directory it had just created. [...]
- The orphan sweep now anchors to the same project root as the journal write, not to raw
  `process.cwd()`. [...]
- The journal directory now self-ignores: a local `.gitignore` (just `*`) is written inside
  `.claude/coalhearth/`. [...]
- Two config keys that gate an outward action can now only be QUIETENED by a project
  config, never escalated: `update.updateMode` and `recovery.autoInjectPrompt`. [...]

### Changed
- Config merge semantics: `.coalhearth.json` is documented as "project wins" throughout,
  and still is for every key except the two named above.

### Fixed
- 6 remaining `fs.realpathSync` containment/prune calls upgraded to `.realpathSync.native`.
- Doc comments left stale by the root-anchor change corrected.
- The legacy-phantom mop-up now also removes the `.gitignore` self-ignore leaves behind.
```

### Release (title + body, filled to the skeleton)

```text
TITLE:
v2.1.1 - phantom-slug root anchor + junction-proof self-ignore

BODY:
PATCH, security-led: the journal directory can no longer be planted wherever a tool call's
cwd happens to sit, and the fix's own containment gap and one uncovered path are closed in
the same release.

### Security
- The journal no longer plants `.claude/coalhearth/` in whatever directory a hook's cwd
  happens to be — it now anchors to the resolved project root (the nearest ancestor with a
  `.git`, a legacy `.coalhearth.json`, or a `.<agent-dir>/coal/coalhearth.json`
  (`.claude`/`.agents`/`.gemini`), never past `$HOME`).
- The self-clean step that mops up a legacy phantom directory could delete the journal
  directory it had just created, on any filesystem where a directory has more than one
  valid spelling; fixed by resolving `process.cwd()` once and reusing that value on both
  sides of the comparison.
- The orphan sweep now anchors to the same project root as the journal write.
- The journal directory now self-ignores (`.gitignore` written inside
  `.claude/coalhearth/`), scoped to the default owned directory only.
- `update.updateMode` and `recovery.autoInjectPrompt` can now only be QUIETENED by a
  project config, never escalated back on.

### Changed
- Config merge semantics: `.coalhearth.json` is "project wins" for every key except the
  two named above.

### Fixed
- 6 remaining realpath containment/prune calls upgraded to `.realpathSync.native`.
- Stale doc comments from the root-anchor change corrected.
- The legacy-phantom mop-up now also removes its own leftover `.gitignore`.
```

Why it fits the skeleton: the lead names PATCH + the security theme in one sentence · the
`### Security` / `### Changed` / `### Fixed` headings are the CHANGELOG entry's own, same
order, condensed—no heading invented, none dropped. **Both "What you need to do" and the
Gate line are deliberately absent**, matching what the real Release actually shipped —
neither is an oversight. "What you need to do" is absent because this is a PATCH with no
required action (no config key changed shape; the two QUIETEN-only keys behave the same
unless a project config was actively using them to re-enable something the global config
had turned off)—per RELEASE-PATTERN.md's current Part 3 rule (conditional, required only
on MAJOR/breaking), the honest fill omits the block rather than writing a null placeholder
like "Nothing—update at your convenience." (an earlier draft of this template did exactly
that, which conflict-note #3 in §5 below used to flag as unresolved against real practice —
resolved 2026-08-09). The Gate line is absent because the room's own record ties a
`159/159` figure to a doc pass two days after this tag actually pressed, not to the v2.1.1
press moment itself—I could not verify a re-run number AT press, so per RELEASE-PATTERN.md's
own rule ("only if verified at press—never a number nobody re-ran") the honest fill is no
Gate line at all, exactly what the real release did. Provenance is absent because nothing
applies—this was not a back-fill and cites no sibling repo.

## 3. Rules already binding—do not re-litigate per room

These are settled elsewhere in `.github/` and this template does not reopen them. A
room's doc-writer follows them; a room disagreeing with one of them is a conversation with
main, not a local variance in the release notes.

- **Stable tags get a GitHub Release; beta/pre-release tags are history only.** Tags = beta
  + stable, Releases = stable-only. An all-beta repo's empty Releases panel is correct, not
  a gap. (RELEASE-PATTERN.md "Which tags get a Release".)
- **A change that does not reach the shipped `plugin/` dist gets NO version, NO tag, NO
  CHANGELOG entry, and NO `[Unreleased]` heading either.** A doc-only edit (README,
  CONTRIBUTING, etc.) is recorded in the commit and the room's `MEMORY.md`, never in the
  CHANGELOG. (scripts-quality.md §3.)
- **SemVer is sized by the CHANGELOG entry's own sections, decided BEFORE picking the
  number.** Shipping a feature as a PATCH is the bug, not a style choice. The exact
  section→bump mapping is scripts-quality.md §3's own—read it there rather than a copy
  here, so this template can't drift from it a second time (it already had: this bullet
  was missing `### Deprecated` from the mapping until this reconciliation).
- **Every claim in a Release matches shipped behaviour; every figure is verbatim from its
  source.** A version comes from `plugin.json`, a test count from an actually-re-run gate at
  press, a behaviour claim from the code—never invented, never carried forward from an
  older release's number. Honest framing (a bound is dollar-not-token, a port is
  wired-not-validated) survives into the Release exactly as the CHANGELOG states it; the
  Release is never the surface where a caveat quietly drops. (RELEASE-PATTERN.md "How it is
  written"; DOC-PATTERN.md "Data is verbatim from its source, never invented.")

## 4. What this template deliberately does NOT fix

Naming these so nobody reads the skeleton as covering more ground than it does:

- **It does not decide the bump size.** That classification (§3 above) happens BEFORE this
  skeleton is filled—the skeleton has no opinion on MAJOR vs MINOR vs PATCH, it only
  shapes whatever entry the sizing already produced.
- **It does not decide release cadence or batching**—whether five small fixes ship as one
  tag or five, whether a fix waits for a bigger release. That is each room's own judgment.
- **It does not set CHANGELOG voice.** DOC-PATTERN.md is explicit: the FORMAT is
  flock-shared, the VOICE is not—CoalHearth's dense, file-and-line-level style and a
  terser sibling's style are both correct. This template only fixes the SHAPE (headings,
  order, required parts), never the sentence-level register.
- **It does not cover the benchmark/`RESULTS.md` release surface.** That has its own shape
  in DOC-PATTERN.md's `benchmarks/<Tool>/` section—a headline figure there is dated and
  version-tagged on its own terms, separate from this skeleton.
- **It does not cover the per-version doc-transition sweep** (SECURITY.md's SkillSpector
  pin, the repo About description, the org landing suite table, a README status line). That
  checklist is scripts-quality.md §3's own, runs at the same time as a release, and is not
  restated here—filling this skeleton does not substitute for running that sweep.
- **It does not mechanically enforce itself.** No gate script in any room's `scripts/`
  checks a Release title or body against this shape today—this is a fourth-tense gap
  (named, not covered): a Release that violates §1's shape currently ships without any
  script noticing. §5 below is live evidence of exactly that.
- **It did not resolve the conflicts found while drafting it, on its own** (§5). They were
  reported to main rather than silently absorbed—a skeleton that quietly picks a side in
  an unresolved disagreement would misrepresent it as already settled. As of 2026-08-09,
  three of the four (#2/#3/#4) have since been ruled by main and folded into
  RELEASE-PATTERN.md itself (and into this skeleton, above); the fourth (#1) is still open.

## 5. Conflicts found—reported, not resolved here

Found while reading the pattern docs against what CoalHearth's own GitHub Releases actually
shipped (`api.github.com/repos/TheColliery/CoalHearth/releases`, fetched live). Each was a
pattern-vs-artifact mismatch, not a one-off typo—every one recurred across multiple real
releases. Main ruled; this section now states the evidence AND the disposition for each —
**three of the four are resolved (2026-08-09); #1 is still open.** Line numbers below are
as they stood when each conflict was found—RELEASE-PATTERN.md has grown since (R3's Part-3
demotion, R6's `### Deprecated`, R2/R4's own stamps), so a citation here may no longer land
on the quoted number; the quoted TEXT is what was verified, not the line.

1. **STILL OPEN—unrelated to the R2/R3/R4 rulings below, no owner decision yet.** Title
   summary is stated as required ("Required—a version alone is not a title"), but the most
   recent real release at the time this was found violated it outright: `v2.1.2` (published
   2026-07-31) has no summary at all—the GitHub Release title is the bare string `v2.1.2`.
   Every earlier CoalHearth release carries a summary; this was the first to drop one. The
   fix could be "conform the Release" (a live-surface edit) or "the rule needs a documented
   escape hatch"—main's call, not made here.

2. **RESOLVED 2026-08-09—RATIFIED HYPHEN.** Title separator was specified as a spaced
   hyphen only, but `v2.1.1`'s real title used an em-dash: `v2.1.1—phantom-slug root
   anchor + junction-proof self-ignore`. Re-scoped to the post-manual population
   (`published_at >= 2026-07-25`) across all 8 repos: 12 hyphen vs 13 em-dash, a near-tie —
   but every CHANGELOG version heading in the flock is 100% hyphen with zero exceptions
   (also keepachangelog.com's own spec format), which is the thing the title separator is
   meant to stay consistent with. Ratifying em-dash would have broken that alignment
   instead of resolving a real disagreement, so: hyphen stands. `v2.1.1` is pre-ratification
   history and is not retroactively fixed. Full evidence:
   `scratchpad/dispatch/r2r4-return.md`.

3. **RESOLVED 2026-08-09—DEMOTED TO CONDITIONAL.** "What you need to do" was listed as
   REQUIRED, but zero of the fourteen real CoalHearth Releases at the time contained an
   explicit "What you need to do" line—not v1.0.0, not the security-led v2.1.1, not the
   BREAKING v2.0.0/v2.0.2, not v2.1.2. RELEASE-PATTERN.md's Part 3 is now conditional
   (required only on MAJOR/breaking; where nothing is needed, OMIT the block rather than
   write "nothing to do here")—matching what every real release had already been doing.
   §1b and §2's worked example above are updated to the current shape.

4. **RESOLVED 2026-08-09—BAN KEPT, NO EXCEPTION CARVED.** "Never in a body: ... An emoji
   headline", but v2.0.2's real, currently-published body contains `## ⚠️ BREAKING
   (v2.0.0)` as an `H2` with a leading emoji. Ruled: the ban stays absolute, including for a
   BREAKING section—a MAJOR/breaking section needing skim-visibility uses a GFM alert
   (`> [!WARNING]` / `> [!CAUTION]`) instead, which gets the same visual weight without an
   emoji or a new carve-out in the ban. `v2.0.2` predates the ruling and stays as history,
   unfixed—it is the case that prompted the ruling.
