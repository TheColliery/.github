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

## The body

Five parts, in this order. **1-3 are REQUIRED; 4-5 are conditional.**

| # | Part | Rule |
|---|---|---|
| 1 | **Lead** — one sentence, no heading | What changed and why it matters to a reader. A plain statement: no marketing adjective, no "we are excited". A MAJOR/breaking release names the break **here, first**, before anything else. |
| 2 | **What changed** | The CHANGELOG entry's own content, kept under the SAME keep-a-changelog headings that entry uses (`### Added` · `### Changed` · `### Fixed` · `### Removed` · `### Security`) so the mapping is 1:1 and any line traces back. Condensing is allowed; **re-ordering the headings, merging them, or inventing a line is not**. A long entry gets condensed — never summarized into a claim the entry does not make. |
| 3 | **What you need to do** — one short block | Does this need an action from the reader (update command · a new or changed config key · a migration step · a breaking follow-up), or nothing? **"Nothing — update at your convenience" is a valid and common answer, and saying it explicitly is the point.** |
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
- An emoji headline.

## Which tags get a Release

**Tags = beta + stable · Releases = STABLE only.** Every stable tag gets one, no gaps. A beta/rc/pre-release tag is history: it gets the tag and no Release. An all-beta or all-rc repo therefore shows an **EMPTY Releases panel — and that is correct**, not a gap to fill.

## Back-filling a missed Release

A missed stable Release is back-filled from its CHANGELOG entry, never skipped.

> [!IMPORTANT]
> **Re-pin `Latest` after any back-fill, then re-read it.** Back-filling sets `published_at` to NOW, so the back-filled Release silently steals the `Latest` badge from the newest stable — the panel then advertises an old version as current. Set `make_latest` on the newest stable and CONFIRM it moved by reading the panel back; the badge is the one thing a visitor sees without scrolling. (Caught live on a back-fill, 2026-07-25.)

## The chain around the press

| Order | Step |
|---|---|
| 1 | CHANGELOG entry written **BEFORE** the tag |
| 2 | SemVer sized by that entry's own sections (`### Added` ⇒ MINOR-minimum · a breaking `### Removed`/`### Changed` ⇒ MAJOR) |
| 3 | Version pins bumped with the release — but the SkillSpector scan pin is the ANTI-mark: it names the last real scan and never bumps on a release |
| 4 | Gates green · signed tag pushed |
| 5 | Release published per this file |
| 6 | Repo details (About · topics · Releases panel) checked BEFORE the README |
| 7 | Where the repo ships `zip-skills.yml`: publishing the Release fires it — confirm the claude.ai skill ZIPs actually attached, since a failed build leaves the Release assetless ([CLAUDE-AI-INSTALL.md](./CLAUDE-AI-INSTALL.md)) |

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
