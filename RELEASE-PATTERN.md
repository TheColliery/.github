# Release Pattern (TheColliery)

> The shared shape for every series repo's GitHub **Releases**—the title line, the notes body, and which tags get one at all. Companion to [DOC-PATTERN.md](./DOC-PATTERN.md) (the writing pattern for the repo's docs) and [SKILL-REPO-PATTERN.md](./SKILL-REPO-PATTERN.md) (layout + machinery). Written after a title audit found three live drift classes—a repo-name prefix on some titles, hyphen and em-dash separators alternating inside the same repo, and titles carrying a version with no summary at all.
> Two standing rules: **a Release traces to the CHANGELOG** (condense that entry, never invent past it), and **the panel is a front door**—a visitor reads the newest release title before most of the README.

<!-- coalmine: verified 2026-09-22 · exemplar SemVer 2.0.0 + Keep a Changelog 1.1.0—de-facto world conventions we conform to, not treaty-class standards · revalidate 90d -->
## Write once, derive everything

**The CHANGELOG entry is written once; the version bump, the Release title, and the Release body are all DERIVED from it—never separately hand-composed.** (Owner-proposed, main-confirmed 2026-09-21: "เขียนข้อมูลที่เดียว จากนั้นก็ค่อยขยับเลข.") Root cause this closes: `claude-ai-zips.yml`'s "Ensure the GitHub Release exists" fallback (`gh release create ... --title "${GITHUB_REF_NAME}" --generate-notes`) raced a head's own manual `POST /releases`—whichever won produced a different Release shape, and the bare-titled ones (CoalMine `v3.20.0`, `v3.19.0`, nine more flock-wide per `release-conform.mjs`'s own findings) are the fallback winning. Discipline alone had already failed to hold this shape steady across ten releases; the fix removes the second writer instead of asking the first one to be more careful.

- **The CHANGELOG entry gains a REQUIRED one-line summary**—one plain sentence, immediately below the `## [X.Y.Z] - YYYY-MM-DD` heading, before any Keep-a-Changelog subsection heading (`### Added`, `### Fixed`, and the rest). It states what changed and why it matters, in the same register "The body"'s Part 1 (Lead) already asks for—because it **is** that Lead, verbatim.
- **The tag-push workflow is the SOLE Release creator.** A head no longer POSTs a Release via REST by hand—the race that produced a bare title disappears because there is only one writer left, not because the discipline is followed better this time.
- **Derivation, mechanical:** the title is `vX.Y.Z - <summary>` (the summary line, case-adjusted per "The title" below); the body's Part 1 is the summary line unchanged, Part 2 is the entry's own Keep-a-Changelog sections unchanged. Parts 3–5 (What you need to do / Gate / Provenance) are **not** derived—each needs judgement a mechanical pass cannot supply, so a room wanting one writes it into the CHANGELOG entry itself, before the tag, and it rides through inside Part 2 like any other line.
- **The trade, named rather than hidden:** a hand-tuned title could always be shorter and punchier than the summary line it is now built from verbatim. A mechanically consistent shape that cannot race itself is worth a few extra words in the title bar.
- **`release-conform.mjs` stays the audit, not the enforcement.** It still reads every published Release after the fact and reports drift; the workflow above is what stops drift from being published in the first place.
- **Mechanism:** [`templates/overlay-coal-skill/scripts/lib/release-shape.mjs`](./templates/overlay-coal-skill/scripts/lib/release-shape.mjs) (pure parsing/derivation, unit-tested) + [`scripts/release-notes.mjs`](./templates/overlay-coal-skill/scripts/release-notes.mjs) (the CLI the workflow runs) + [`scripts/verify-release-shape.mjs`](./templates/overlay-coal-skill/scripts/verify-release-shape.mjs) (the re-read rail, below, run by the workflow itself now). A malformed or version-mismatched CHANGELOG entry fails the workflow loud—never a silent fallback to a bare title.

## The title

`vX.Y.Z - <summary>`

| Part | Rule |
|---|---|
| Version | **Bare `vX.Y.Z`**—never a repo-name prefix. The reader is already on the repo page; a prefix buys nothing and renders as a mismatch beside its bare-titled neighbours. |
| Separator | **A spaced hyphen `-`**—not an em-dash. Same forward rule as the CHANGELOG version heading, so the title and its entry read alike. |
| Summary | **Required**—a version alone is not a title. Lower-case sentence style naming WHAT changed ("`- conductor count gate + honest split`"), never marketing ("`- a huge leap for agent quality`"). |
| Breaking | A MAJOR release names the break in the title ("`v2.0.0 - budget guardrail REMOVED`"). |
| Subject | **The title's grammatical subject is THIS repo's own change**—a sibling repo's name may appear only after the own-subject, never leading. Caught live 2026-07-27: CoalBoard's `v1.8.1 - SKILL doc-truth: CoalHearth is LIVE` read as an announcement about the sibling (the USER opened the page and asked whose release it was); a title-sweep found the same shape twice more (`- CoalBoard-audit hardening`). The CHANGELOG heading was fine each time—the error enters at the compress-to-a-headline step, so the check belongs HERE, at the title rule, not in the CHANGELOG discipline. |

<!-- coalmine: verified 2026-08-09 · task-37 audit R2—RATIFIED HYPHEN, decided on real data, not left as prose. Post-manual population (published_at >= 2026-07-25, the manual's own git-add date): 28 releases, of which 25 carry a well-formed leading-version title—12 hyphen vs 13 em-dash, a near-tie in raw practice. The tiebreaker: the CHANGELOG version heading this rule keeps forward-consistent with is 100% hyphen, zero exceptions, across every repo in the flock (`## [X.Y.Z] - YYYY-MM-DD`—also keepachangelog.com's own spec format)—ratifying em-dash would break the one alignment this rule exists to keep. scripts/release-conform.mjs already gates em-dash as a finding; no script change needed, manual and machine agree. Full evidence: scratchpad/dispatch/r2r4-return.md. · revalidate 90d -->

## The body

Five parts, in this order. **1-2 are REQUIRED; 3-5 are conditional—except 3 is REQUIRED on a MAJOR/breaking release**, where an action is near-certain anyway.

<!-- coalmine: verified 2026-08-09 · task-37 audit R3 (flock 3/148 = 2%, 0/9 since the manual shipped; 0/7 exemplar projects carry a standing action block) · demoted 1-3-REQUIRED to conditional · revalidate 90d -->

| # | Part | Rule |
|---|---|---|
| 1 | **Lead**—one sentence, no heading | What changed and why it matters to a reader. A plain statement: no marketing adjective, no "we are excited". A MAJOR/breaking release names the break **here, first**, before anything else. |
| 2 | **What changed** | The CHANGELOG entry's own content, kept under the SAME keep-a-changelog headings that entry uses (`### Added` · `### Changed` · `### Deprecated` · `### Removed` · `### Fixed` · `### Security`—the spec's full six, [keepachangelog.com/en/1.1.0](https://keepachangelog.com/en/1.1.0/)) so the mapping is 1:1 and any line traces back. Condensing is allowed; **re-ordering the headings, merging them, or inventing a line is not**. A long entry gets condensed—never summarized into a claim the entry does not make. **A release fixing a known vulnerability names it under its own `### Security` heading, with the assigned CVE where one exists** (OpenSSF Best Practices Badge `release_notes_vulns`—[bestpractices.dev/en/criteria/0](https://www.bestpractices.dev/en/criteria/0): security fixes are called out, not buried inside a generic `### Fixed`). |
| 3 | **What you need to do**—one short block, conditional (required on MAJOR/breaking) | Where the release needs an action from the reader—an update command, a new or changed config key, a migration step—say so plainly. **Where it does not, say nothing**—omit the block rather than write "nothing to do here". |
| 4 | **Gate**—one line, conditional | Test counts · VERIFY · CI. Only if **verified at press**—never a number nobody re-ran. |
| 5 | **Provenance**—one line, conditional | A back-dated Release says it is back-dated for an already-published tag and names the CHANGELOG entry it was written from. Notes citing a sibling repo name it and state it was verified at press. |

### How it is written

- **English, plain, declarative.** Technical terms, commands, paths, config keys and identifiers stay **VERBATIM**—never translated, never prettified.
- **Honest framing survives into the notes.** If the CHANGELOG says a bound is a dollar-and-speed bound and not a token bound, or that a port is wired-not-validated, the Release says the same. **A Release must never be the surface where a caveat quietly drops.**
- **No figure without its test date + tested version.**
- **Lean.** A release body is read at a glance, not studied. If part 2 runs past a screen, condense it and let the CHANGELOG carry the depth.

### Never in a body

- A claim absent from the CHANGELOG and unverified at press.
- An internal path, a rule identifier, or a reference to machine-local agent or memory notes.
- Marketing language.
- **An emoji headline—including inside a body heading, however severe the section.** WHY this differs from a README's `H2` icons (DOC-PATTERN.md's "Emoji section icons are optional but consistent within a file"—that rule governs README navigation, not a Release body, and does not carry over here): a Release surfaces compressed into a single-line card (the `/releases` panel, the Atom feed, a notification email), where an emoji reads as decoration nobody can act on; a README `H2` is a persistent, browsed page where the same emoji reads as a landmark. **Ruled 2026-08-09 (task-37 audit R4), decided explicitly rather than left for the next writer to guess: a MAJOR/breaking section that needs skim-visibility uses the flock's own GFM alert (`> [!WARNING]` / `> [!CAUTION]`, DOC-PATTERN.md's callout table)—never an emoji heading.** GitHub renders the alert natively with the same visual weight, without touching the ban—it is a strictly better fit than an exception would have been, since Part 1's Lead already requires naming a break "here, first" and the alert doesn't need a new carve-out in this rule or in the emoji detector. (CoalHearth `v2.0.2`'s `## ⚠️ BREAKING (v2.0.0)` predates this ruling and is history, not retroactively fixed—it is the one case that prompted it.)

## Which tags get a Release

**Tags = beta + stable · Releases = STABLE only, plus ONE launch-form Release.** Every stable tag gets one, no gaps. A beta/rc/pre-release tag is history: it gets the tag and no Release—**except the launch form (owner-ruled 2026-09-21): a repo whose FIRST public version is a pre-release form (beta · rc · alpha—any SemVer pre-release identifier) gets ONE GitHub Release marked `prerelease: true` as its launch announcement, because with no stable in existence the panel would otherwise read as abandoned on day one—the exact failure the stable rule exists to prevent.** Later pre-release tags on that line stay tag-only (the no-churn rule, unchanged); the first stable gets its Release as usual and closes the launch form. The launch Release follows the same title and body rules as any Release; only its `prerelease: true` flag differs. Exhibit: CoalGob's public beta, `v0.1.0-beta.1`, launched under this form the day it was ruled. An all-beta or all-rc repo therefore shows exactly ONE Release (the launch one), never one per beta tag. `scripts/release-conform.mjs` reads a repo's OLDEST published Release as the launch-form Release when it is a pre-release, and reports any other `prerelease: true` Release, and a launch Release whose tag carries no SemVer pre-release identifier.

<!-- coalmine: verified 2026-09-02 · exemplar SemVer 2.0.0 cl.3 ("A version once released MUST NOT be modified") + OpenSSF Best Practices Badge `version_unique`/`delivery_unsigned` (bestpractices.dev/en/criteria/0) · revalidate 90d -->
## A published version is immutable—NEVER

**NEVER move, re-cut, force-push over, or delete a published tag; NEVER edit a published Release's substance after the fact.** A tag a user may already have built against, or a Release a user may already have read, is a promise about a specific point in history—moving it silently breaks that promise for anyone who trusted it between the two states. This is the RELEASE half of a rule already half-shipped: the CHANGELOG half already exists—`DOC-PATTERN.md`'s "**A released entry is IMMUTABLE**… to correct one, add a forward-pointing note in the NEW entry"—this section is the same rule applied to the tag and the Release object, not a duplicate of it. A correction to a published Release follows the CHANGELOG's own pattern: a NEW release with a forward-pointing note, never an edit to the old one. The one sanctioned exception is [Back-filling a missed Release](#back-filling-a-missed-release) below, which is filling a GAP, not altering a published state.

<!-- coalmine: verified 2026-09-22 · exemplar GitHub "Managing releases in a repository" (docs.github.com/en/repositories/releasing-projects-on-github/about-releases, "Storage and bandwidth quotas": each file under 2 GiB, no total-size or bandwidth limit) + the owner's own N=2 ruling · revalidate 90d -->
## Build-artefact retention—pruning a ZIP is not a substance edit

**The immutability rule above governs the Release's SUBSTANCE (title, body, which tag it names); it does not forbid pruning a downloadable ZIP once a newer one exists.** GitHub's own storage/bandwidth quotas for release assets carry no total-size cap—so nothing here is forced by a quota running out—but the owner set a bound anyway: **keep the ZIP assets of the LATEST stable Release plus ONE previous** (signed 2026-09-21, "ใช่ เก็บ 2 ล็อกเลย"—N=2, the rollback a user who updated and broke can take without a rebuild). What this DOES NOT touch, ever: the Release record itself, or the tag—both stay forever, exactly as "immutable" above already requires; history is evidence, not storage to reclaim.

- **What is prunable:** an asset named `*.zip` or `SHA256SUMS.txt` on a STABLE release older than the newest + one previous. Anything else a room attaches to an old Release (a `MIGRATION.md`, a signed checksum file under a different name) is left alone.
- **Mechanism, flag-gated, OFF by default:** [`templates/overlay-coal-skill/scripts/lib/release-prune.mjs`](./templates/overlay-coal-skill/scripts/lib/release-prune.mjs) is the pure selection logic (unit-tested against fixture release lists); [`scripts/prune-release-zips.mjs`](./templates/overlay-coal-skill/scripts/prune-release-zips.mjs) is the executor, wired into `claude-ai-zips.yml` behind the repository Actions variable `PRUNE_OLD_RELEASE_ZIPS`—a room's head opts in per repo; nothing prunes anywhere until that variable reads exactly `"true"`, checked both in the workflow's own `if:` and again inside the script.
- **`--clobber` only on the genuinely first upload for a tag** (the named divergence UMB-163 found and closed): the workflow now checks whether a `SHA256SUMS.txt` already exists on the tag's own Release before uploading—absent, it clobbers freely (nothing to clobber); identical, it skips (an idempotent re-run); **different, it FAILS LOUD**, never a silent overwrite of a tag's own already-published bytes. Decision logic: [`scripts/lib/asset-upload-mode.mjs`](./templates/overlay-coal-skill/scripts/lib/asset-upload-mode.mjs).
- **The Actions-artifact store is separate and smaller-stakes**, and needs no flag: every `actions/upload-artifact` step in a template sets an explicit `retention-days` (GitHub's own vendored default is 90 days—[`actions/upload-artifact`'s README](https://github.com/actions/upload-artifact#retention-period), 1–90 range on the action's own input), sized to what the artifact is actually for rather than left at the vendor default. The org/repo-level Actions-artifact-retention SETTING (1–90 days on a public repo, 1–400 on private—an owner/head UI click, Settings → Actions → General) is a ceiling above this, never set by a workflow file.
- **⚠️ Time-sensitive vendor change, unverified beyond this file's own read (docs.github.com/en/organizations/managing-organization-settings/configuring-the-retention-period-for-github-actions-artifacts-and-logs-in-your-organization, fetched 2026-09-22): starting October 1, 2026, the SAME retention setting that today governs only artifacts and logs will also start governing checks, workflow runs, and commit statuses** (currently retained 400+ days regardless of the configured period). Re-check this org's retention setting before that date.
- **Packages, Pages, PyPI: measured, none pruned.** This org publishes zero GitHub Packages (measured empty across every package type, `GET /orgs/{org}/packages`) and uses no GitHub Pages anywhere (`GET /repos/{o}/{r}/pages` 404 on every repo checked)—nothing to design a prune for. Kolwen's PyPI project (`kolwen`) holds one release, one file, 2,710 bytes—nowhere near PyPI's own 100 MiB file / 10 GiB project defaults ([pypi.org/help/#project-size-limit](https://pypi.org/help/#project-size-limit))—so no prune is warranted there either; PyPI has no delete-file API in any case (only "yanking," which hides a release from unpinned installs without removing it). Kolwen's own Cloudflare Pages deployments (a separate store from anything in this file—see the two-domain ruling, `MEMORY.md`) DO have a documented delete endpoint (Cloudflare API, "Delete deployment," under Pages → Projects → Deployments) if that store ever needs one; out of this file's reach (no Cloudflare credential in this unit) and the LLM zone's to design if it ever does.

<!-- coalmine: verified 2026-08-01 · exemplar ECC-MIGRATION-1X-TO-2.0 · revalidate 90d -->
## A MAJOR release ships a migration note

The body's part 3 ("what you need to do") is one short block. A MAJOR that renames the plugin id, moves the install path, or removes a capability needs more room than that—so it ships a `MIGRATION.md` at the repo root, and part 3 becomes one line pointing at it.

**Source of this shape: UPSTREAM, adopted whole.** ECC's [`docs/MIGRATION-1X-TO-2.0.md`](https://github.com/affaan-m/ECC/blob/HEAD/docs/MIGRATION-1X-TO-2.0.md) is the only migration artifact in either house; we had none. Its three load-bearing parts, in its own words:

| Part | Upstream's wording | Why it earns a slot |
|---|---|---|
| The duplicate symptom, named as expected | *"I now see two ECC plugins" … "Expected. … Running both duplicates skills, commands, and hook executions."* | A rename leaves the old plugin installed. A user who is not told this reads it as a broken upgrade. |
| The leftover list **with an explicit do-NOT-delete list** | *"Safe to delete after the old plugin no longer appears in `/plugin` list"* … followed by *"Do NOT delete `~/.claude/rules/` content you copied intentionally, or personal memory/state files."* | This is the half that makes the section safe to follow. A cleanup list without its exclusions turns a migration doc into a data-loss instruction. |
| One install path only | *"Do not stack the plugin install with the manual installer … Pick one path; stacking creates duplicate skills and duplicate hook runs."* | Every cross-agent sibling ships both a plugin path and a file-copy path, so this hazard is already live here. |

Rules for ours:
- **A MAJOR ships it; a MINOR/PATCH never does.** If the "what you need to do" block fits in three lines, it is not a migration.
- **It answers "does this touch my projects?" explicitly.** Upstream does: *"No. ECC is a harness layer … It does not alter your project code or git history."* A migration doc that leaves that unanswered gets asked it anyway.
- **Every path in the delete list is verified on a real install before the doc ships**—a wrong path in a delete instruction is the worst defect this file can carry.
- The Release body links it; the CHANGELOG entry's breaking `### Removed`/`### Changed` line links it too. It is not a version-pinned file—one `MIGRATION.md` per breaking transition, named for the transition it covers if a repo ever needs two.

**Not adopted from the same source, named so nobody re-derives it:** upstream's release notes lead with a `## Positioning` section and carry repo star/fork counts ([`docs/releases/1.10.0/release-notes.md`](https://github.com/affaan-m/ECC/blob/HEAD/docs/releases/1.10.0/release-notes.md)). Our body rule bans marketing language and requires every line to trace to the CHANGELOG entry; a positioning section traces to nothing. **Ours stands.**

## Back-filling a missed Release

A missed stable Release is back-filled from its CHANGELOG entry, never skipped.

> [!IMPORTANT]
> **Re-pin `Latest` after any back-fill, then re-read it.** Back-filling sets `published_at` to NOW, so the back-filled Release silently steals the `Latest` badge from the newest stable—the panel then advertises an old version as current. Set `make_latest` on the newest stable and CONFIRM it moved by reading the panel back; the badge is the one thing a visitor sees without scrolling. (Caught live on a back-fill, 2026-07-25.)

## A Release body is re-read after every write

**MUST — every Release create/patch (`POST`/`PATCH .../releases/{id}`) is followed by a
GET on that same release and a SHA256 compare over the UTF-8 BYTES of the returned
`body` against the intended text, before the return says "published." NEVER a length
compare — a length match proves nothing when the corruption is a byte-for-byte
substitution.** (`AGENTS.md`'s "A RELEASE BODY IS RE-READ AFTER EVERY WRITE" bullet,
UMB-050/CoalFace r18b, cited not restated — a 200 status on the create/patch call is
evidence the request was well-formed, never evidence the body it carried was the
intended text.)

**Measured, CoalWorks r29 (CoalHearth's r29 gate-OUT, `CoalWorks/CoalHearth/MEMORY.md`,
2026-09-10 — re-derive from that room's own record, never trust this line alone):
`Invoke-RestMethod -Body <string>` re-encoded every em dash in the payload to a plain
hyphen. The API answered 200. The published body's LENGTH equalled the intended
text's length — an em dash and a hyphen are both one character — so a length compare
would have read this as identical when it was not.** Only a SHA256 over the actual
bytes caught it. The cure CoalHearth shipped, now the flock's own standard for this
call: build the request body as UTF-8 bytes explicitly —
`[Text.Encoding]::UTF8.GetBytes($payload)` — and set `charset=utf-8` on the request's
content type, rather than handing `Invoke-RestMethod` a plain string and trusting its
own default encoding.

```powershell
$bytes = [Text.Encoding]::UTF8.GetBytes($payload)
Invoke-RestMethod -Uri $url -Method Patch -Body $bytes `
  -ContentType 'application/json; charset=utf-8' -Headers $headers
```

This is a SEPARATE trap from the ETS-decoration one below — both live under the same
PS 5.1 heading because both defeat the same MUST (a byte-faithful publish) through the
same tool, but neither cure substitutes for the other: the `[string]` cast strips
provider metadata a piped `Get-Content -Raw` carries; the explicit UTF-8 byte array
stops `Invoke-RestMethod`'s own string-body path from re-encoding characters outside
its default codepage. A script guarding against one is not thereby guarded against
the other.

**The mechanism** (`AGENTS.md` Hard-won lessons "PS 5.1," cited not restated): PowerShell
5.1's `Get-Content -Raw` attaches ETS NoteProperties (`PSPath`/`PSParentPath`/
`PSChildName`/`PSDrive`/`PSProvider`/`ReadCount`) to the string it returns. Passing that
decorated string into `ConvertTo-Json`—piped directly, OR wrapped first in a hashtable
(`@{ body = $raw }`)—serializes the *whole decorated object*, publishing PowerShell
provider internals in place of the file's own text. The incident this rule closes:
26,668 characters of provider metadata replaced a two-line intended body, and the GitHub
API returned 200 the entire time—a well-formed request carrying the wrong content is not
a request failure, and nothing short of reading the artefact back catches it.

**The safe shape: strip the ETS wrapper with an explicit `[string]` cast BEFORE the value
reaches `ConvertTo-Json`—`[string]$raw` (or `$raw.ToString()`) first, THEN into the
hashtable:**

```powershell
$body = [string](Get-Content -Raw ./release-body.md)
$json = @{ body = $body } | ConvertTo-Json -Compress
```

Measured clean (round-trips exactly, no provider metadata). **Never pipe or pass a raw
`Get-Content -Raw` result into `ConvertTo-Json` without that cast first**—not even
through an intermediate hashtable, which does not strip the decoration on its own.

## The chain around the press

| Order | Step |
|---|---|
| 1 | CHANGELOG entry, with its REQUIRED one-line summary ([Write once, derive everything](#write-once-derive-everything), above), written **BEFORE** the tag |
| 2 | SemVer sized by that entry's own sections (`### Added` or `### Deprecated` ⇒ MINOR-minimum · a breaking `### Removed`/`### Changed` ⇒ MAJOR) |
| 3 | Version pins bumped with the release—but the SkillSpector scan pin is the ANTI-mark: it names the last real scan and never bumps on a release |
| 4 | **`git status` clean on the tagged commit—MUST, no exceptions.** A tag cut over a dirty tree ships bytes nobody reviewed alongside the commit history that claims to describe it (Cargo's own dirty-tree publish block is already the flock's cited exemplar for this class—[scripts-quality.md](./scripts-quality.md) §2). Gates green · signed tag pushed |
| 4b | A MAJOR only: `MIGRATION.md` written and its every path verified on a real install |
| 5 | Release published per this file—**and re-read** ([A Release body is re-read after every write](#a-release-body-is-re-read-after-every-write), above) before the step counts as done. **Where the repo ships `claude-ai-zips.yml` (row 7 below), the tag push does both steps by itself**—the head's own hands never touch `POST`/`PATCH .../releases` for that repo. Elsewhere, a head still presses the Release by hand, per the umbrella constitution's own Dogfood/Release pattern, and still owes both halves. |
| 6 | Repo details (About · topics · Releases panel) checked BEFORE the README |
| 7 | Where the repo ships the claude.ai ZIP-packaging pair (`.github/workflows/claude-ai-zips.yml`, [`templates/overlay-coal-skill/`](./templates/overlay-coal-skill/)): publishing the Release fires it—confirm the claude.ai skill ZIPs actually attached, since a failed build leaves the Release assetless ([CLAUDE-AI-INSTALL.md](./CLAUDE-AI-INSTALL.md)). **A digest is REQUIRED for every downloadable archive artifact—the MECHANISM already ships (`SHA256SUMS.txt` alongside CoalMine's and CoalFace's ZIPs, [CLAUDE-AI-INSTALL.md:15](./CLAUDE-AI-INSTALL.md)), this is the missing RULE that makes it mandatory rather than incidental** (OpenSSF Best Practices Badge `delivery_unsigned`—a downloadable artifact with no integrity check has no path for a downloader to know it wasn't corrupted or tampered with in transit). A repo shipping a downloadable archive with no `SHA256SUMS.txt` (or equivalent) is a gap to close before its next Release, not a style choice. |

Bump sizing and propagation are owned by [scripts-quality.md](./scripts-quality.md) §3; the full per-release mark list and its owners live in [SWEEP-MARKS.md](./SWEEP-MARKS.md) Event 2. Neither is restated here.

## A worked example

Illustrative only—an invented MINOR, not any real release (a copied real one would rot the moment that release is edited). Its version, keys and figures are made up to show the shape.

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

Gate: 148 tests green, VERIFY clean, CI green on the supported Node matrix.
```

Why it passes: the lead is one plain sentence · part 2 keeps the entry's own `### Added` / `### Fixed` headings · part 3 is omitted because the release asks nothing of the reader (the rule is to leave the block out, never to write "nothing to do here") · the gate line was re-run at press. Part 5 is absent because nothing applies—a back-filled one would add a single line such as `Back-dated for tag v1.3.0 (published 2026-05-02); written from that version's CHANGELOG entry.`
