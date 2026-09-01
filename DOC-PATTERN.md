# Public-Doc Pattern (TheColliery)

> The shared writing pattern for every series repo's public docs — `README.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `PRIVACY.md`, `CHANGELOG.md` — and the org `benchmarks/<Tool>/` dir shape. Extracted from the live CoalMine / CoalTipple / CoalBoard docs so a new repo (and an edit to an old one) ships sibling-consistent.
> Three standing doc rules govern all of them: **trim the fat** (say each thing once, cut filler), **correct heading hierarchy** (clean `H1 → H2 → H3`, no skipped or duplicated levels), and **a README matches the code** (every claim = shipped behaviour, re-verified against the source, never aspirational).

## Cross-cutting rules (all the public docs)

- **One `H1` per file** (the title), then `H2` sections, then `H3` sub-sections. Never skip a level (no `H1 → H3`) and never repeat the `H1`.
- **Platform-neutral** — these tools are cross-agent. A user-facing instruction is COMPLETE for every platform (Claude Code plugin command AND the other-agent path) or it points to the README's per-platform section. Never a single-vendor-only line. (CoalTipple is the one exception that is *correctly* Claude-Code-only — and it says so explicitly, with the reason.)
- **Data is verbatim from its source, never invented.** A version = `plugin.json`; a benchmark figure = the `.github/benchmarks/<tool>/` record (LINK to it, never copy the number into the doc — a copied number drifts); a behaviour claim = the code. If you cannot source it, do not write it.
- **Number-free where it rots.** A README status line is a dynamic shields.io badge or `Status: stable` + a link to CHANGELOG/Releases — never a hardcoded version. The live version lives in `plugin.json` / the GitHub releases.
- **Clean-clone:** benchmarks and process docs live in the org `.github/`, not the skill repo. The repo's docs LINK out to them.
- **Emoji section icons are optional but consistent within a file** — if the README uses them, use them on every `H2`; if not, none. Do not half-decorate. **Two headings are GREP ANCHORS and carry no emoji in any repo, whatever the file's style: `## Commands` and `## Permissions`.** They exist to be found by one cross-repo `grep -n "^## Commands"`, and an emoji breaks that for every repo that picks a different one. Measured 2026-07-25: CoalMine wrote a bare `## Permissions` deliberately, and the other five each chose their own icon (🔑 🔐 🔒 🔐 🔐) — five spellings of one heading, so the anchor was already dead. This is the one NAMED exception to the consistent-within-a-file rule.
- **Callout semantics are FIXED flock-wide (decided 2026-07-09 — one gate, one grammar):**
  | callout | means | exemplar |
  |---|---|---|
  | `[!CAUTION]` | a hard constraint / absolute prohibition — violating it breaks, loses data, or spends real money | CoalTipple's platform lock · CoalWash's loop prohibition + fact-loss zone |
  | `[!WARNING]` | a real risk that degrades or needs care, not an absolute | an unverified platform · a best-effort mode |
  | `[!IMPORTANT]` | load-bearing information the reader must not skip | CoalHearth's recovery block |
  | `[!TIP]` | a recommendation with no penalty for ignoring | CoalWash's install-globally hint |
  | `[!NOTE]` | supplementary context | scope notes |
  Pick by CONSEQUENCE, not by mood; the same consequence class uses the same callout in every repo.
- **A Table of Contents on any README past the point a reader cannot see the section list in one screen.** Number-free by design — Standard Readme's own "optional under 100 lines" is a variable sized for THEIR typical README; ours (CoalMine's 13 sections, 251+ lines) already reads long by any measure, so the trigger is "the reader cannot see the whole section list without scrolling," judged per file, not a borrowed line count.
- **Prose style, in our own words, adopted from a vendor guideline (Google's developer documentation style guide) — a shape, not a standard we owe conformance to:** second person ("you", never "the user"), active voice, sentence case on headings (never Title Case), and write for a global audience (short sentences, no idiom, no assumed cultural reference).
- **Alt text on every image, and descriptive link text, as an OBLIGATION — not merely detected.** This one DOES trace to a real multi-party standard (W3C WCAG, via Google's style guide) and outranks by THE PRECEDENCE OF STANDARDS. `doc-structure`'s canary already flags a missing alt text as SUSPECTED; this line is what gives that flag something to cite. "Click here" / a bare URL as link text fails the same rule — the link text states the destination.
- **A one-line mode + audience note per doc kind**, cheap and honest rather than a re-architecture: README = reference + a short tutorial (the install path) for a NEW user; SECURITY.md/CONTRIBUTING.md = reference for an existing or prospective contributor; a benchmark RESULTS.md = explanation for anyone deciding whether to trust the tool (Diátaxis's four modes, named — the taxonomy is cited as a framework, not quoted as forbidding mixed modes, since our README spine deliberately mixes tutorial/reference/explanation by construction and that mixing is not being undone here).
- **A README code snippet is RUN or LINTED before a release ships, not merely eyeballed** — generalizing the SECURITY.md verify-snippet precedent (§SECURITY.md row 3) to every runnable snippet in every public doc; a snippet that silently rotted broke that one command once already.

## README.md

The shop window. Lead with what the tool IS and the one install command; push depth down the page.

| # | Section (`H2`) | Holds |
|---|---|---|
| 1 | Title + tagline (`H1` + bold one-liner) | Name, a one-sentence "what it does", a badge row (version via dynamic tag badge, license, status), a links row (Changelog · Security · Privacy · Releases), and the "Part of TheColliery" sibling line. |
| 2 | What it is | The metaphor + the core idea in 2–4 sentences. For a router/board, a small table of the core decision (delegate-down / escalate-up; the lens roles). |
| 3 | How it works | The mechanism: the canary table, the two knobs, the board's phases. One table beats three paragraphs. |
| 4 | Compatibility / platform support | Which agents, what ports where. A matrix when the tool is cross-agent; an explicit `[!CAUTION]` + reason when it is single-platform. **The headline tier per platform is one of exactly TWO words — see "Platform tiers" below.** |
| 5 | Install | The one-command plugin path first, then the universal/other-agent path. |
| 6 | Commands | **No emoji on the heading** (grep anchor, above). A two-column table — `Command` · `What it does` — listing **everything a user can actually invoke — including `stats` and `update`**, which are the two most commonly omitted. Invocation form verbatim, not a bare name: a reader must be able to copy the cell and run it. **Ship-text only: a command that is designed but not shipped does not go here** — the table answers "what can I type right now", and a not-yet-real row makes the whole table untrustworthy. Where the README already carries a capability table (CoalMine's canaries, CoalLedger's doc canaries), do NOT restate it — one row points back to it, e.g. "the 9 canaries — see "The 9 Canaries"". A capability table is not a command table: measured 2026-07-25, CoalMine's canary table lists `Skill Name` with no invocation column and omits `stats`/`update` entirely, so it covered 9 of 11 invocable things and told a reader how to run none of them. |
| 7 | Configure | **Open with the two-level line (the user-benefit frame, never a first-in-market claim):** every tool supports TWO config levels — a global `~/.claude/.<tool>.json` and a per-project `.<tool>.json` override (project wins) — **so a globally-installed skill can be tuned or SHUT OFF per project** (the pain it solves: a globally-installed skill keeps loading — and burning tokens — in every project, needed or not; the per-project off-switch stops that bleed wherever the skill doesn't fit). Keep the example work-type-NEUTRAL — never name specific project types (the tools are deliberately work-type-flexible; a "coding skill in a docs project" example is one user's setup, not the reader's). Name the tool's own off-switch key in that line. Then the **key TABLE** (`Key · Default · What it does`) of the high-impact keys **matching the `config-schema.mjs` SSoT** — gate it, or re-verify on every config change. A large key set stays a table — high-impact keys only; a narrative dial gets ONE line above the table. Close with the standard footer: "Full key reference: `scripts/lib/config-schema.mjs` + the commented `platform-configs/` template." (Table-only = the flock shape, 2026-07-04.) |
| 8 | Permissions | **2-4 lines, plain language — no primitive codes, no table.** What the skill REQUESTS (the least-power list, in reader's words: "reads your files · writes only inside its own scratch dir · asks before anything else"), what it deliberately NEVER requests (name the absents — an unrequested right is only credible when it is stated), and that **workers get strictly less than main — no spawning, no prompting you directly**. Close with the link: `[Permission Matrix](https://github.com/TheColliery/.github/blob/main/PERMISSION-MATRIX.md)`. Placement: immediately BEFORE a `## Security` section where the README has one; where it does not (the common case — Security lives in `SECURITY.md`), immediately after Configure. The lines must not contradict the tool's row in the matrix; a permission change moves both together. **Required, not optional** — measured 2026-07-25, six repos carried this section and CoalLedger shipped without one, so a reader had no way to learn what it may do. |
| 9 | Benchmark | A short honest framing + a LINK to `.github/benchmarks/<tool>/`. Never inline the figures. **A headline figure MUST name the tested VERSION + date** — LOAD-BEARING (sourced from the benchmark record, never a copied number): a version-less figure silently rots as releases ship past it, and if a later release changed the measured behaviour, say it is *not re-benchmarked* rather than implying a current-version result. Keep the honest-scope caveat (dated, small samples). **Attribute each figure to the exact arm/condition it was measured on** — never credit a number measured on one arm (e.g. cheap-tier ad-hoc fan-out) to a different subject (e.g. the skill itself). |
| 10 | Part of TheColliery | The sibling links + the shared doctrine (Phoenix-13, SSoT config, no-overkill). **SHAPE IS LOCKED — see "The Part-of-TheColliery block" below.** |
| 11 | License | **The repo's OWN zone licence, per the portfolio (`MEMORY.md`'s LICENSE-PORTFOLIO ruling, 2026-08-23) — never a hardcoded blanket claim.** `Apache License 2.0. See [LICENSE](LICENSE).` is the Coal* skill-suite (zone 1) EXAMPLE, not the flock default: Chotmeter code ships FSL-1.1-Apache-2.0, the chot unit/spec ships CC BY 4.0, articles ship © + CC BY-NC-ND 4.0, Kolwen weights carry an owner+lawyer OPEN licence/EULA, CoalKiln is private and unlicensed by design. **The LICENSE file MUST exist in the repo** and match the stated licence exactly (a badge or claim with no backing file, or a file that says something else, is a false claim). A non-OSI-approved licence (FSL during its delay window, a proprietary EULA) is NEVER described as "open source" — OpenSSF's own `floss_license_osi` criterion is SUGGESTED, not MUST, and saying so plainly costs nothing. |

These 11 are the REQUIRED spine, in order — but row 3 under-specifies a rich tool, so tool-specific `H2`s ARE allowed: CoalMine carries four (One button · Ultra-Short Summary Format · Escalation Tiers · Design Principles), CoalBoard one ("What it guarantees (and what it doesn't)"). That is a NAMED extension, not drift — an extra slots around row 3 and never displaces, reorders, or absorbs a spine section.

<!-- coalmine: verified 2026-08-01 · exemplar USER-ruling-2026-08-01 · revalidate 90d -->
### Platform tiers (row 4) — LOCKED 2026-08-01

**Source: OURS — a USER ruling, uncontested.** Neither upstream nor any exemplar offered a tier vocabulary; ours had grown four competing headline words (`design-supported` · `unverified` · `works with` · `wired`) across the flock, which is the mis-pickable set our own suite bar forbids.

**TWO headline tiers, and only two — and they are the words ALREADY SHIPPED. Do not invent new ones:**

| Tier | Means | Where |
|---|---|---|
| **`validated`** | We built it here, we test it here, we run it here daily | Claude Code |
| **`works with`** | It installs and it runs; the support is documented, we have not run it ourselves | every other platform |

**The USER ruled the vocabulary 2026-08-01, and ruled it twice — the second time to undo an over-build.** The first framing reached for *Stable / Beta* as a mental model (*"เหมือน Beta สำหรับแพลตฟอร์มอื่น Stable สำหรับ CC"*). Main took the analogy literally and made **Beta** the shipped word — which immediately collided with the suite table's own `Live` / `RC` / **`Beta`** maturity column, one word answering two questions on one page. The USER's correction: *"ทำให้มันยากทำไม — CC ทดสอบแล้ว ติด badge validated · แพลตฟอร์มอื่นรองรับจากข้อมูลกระดาษ แต่ยังไม่เคยวิ่ง ... ติด badge works with"* — **the shipped words were already correct and already distinct; the clash was manufactured by replacing them.** Recorded because the lesson generalises: an analogy is a way to UNDERSTAND a tier, never automatically the right word to PRINT.

- **The suite table's `Live` / `RC` / `Beta` is a different axis and is NOT TOUCHED by this section.** Those grade a tool's own maturity per repo; these grade a platform per compat row. With `validated` / `works with` the two vocabularies share no word, so no rule is needed to keep them apart.
- **`wired` and `design-supported` demote from headline to DETAIL.** A paragraph beside the row may still say *"built and hermetically tested, delivery not run end-to-end"* — true and useful. The badge and the table row stay at the two words above.
- **Why `works with` and not "documented but unproven": these skills install by file-copy elsewhere, so a user CAN already run them.** Calling that "unproven" misdescribes what they have. It works; we have not validated it.
- **A `works with` row is an INVITATION and must carry its report path.** Link the tool's own problem-report channel (Standard System 4, [DESIGN-PRINCIPLES.md](./DESIGN-PRINCIPLES.md)) in the same block. **A `works with` with no report path is just a disclaimer** — and field reports are the only thing that ever moves a platform to `validated` (principle 9).
- **A SPLIT badge stays legal where the split is REAL.** CoalMine on Antigravity is the standing case: `validated canaries · wired auto-cadence` — the two halves genuinely sit at different tiers, and flattening them would hide a difference a user hits. The test is whether a user would experience the two halves differently; if not, one word.

### The Part-of-TheColliery block (row 10) — SHAPE LOCKED 2026-07-27

Measured that day: **all seven repos shipped this block as ONE unbroken paragraph of 701–1,057 characters** — six sibling links, the compose promise, the shared doctrine and a pointer, welded together. Nothing in it is wrong; it is simply unreadable, and it is the block a visitor meets right before the License. The fix is line discipline, not new words.

**The canonical shape — four parts, in this order, blank line between each:**

1. **One sentence** naming what THIS tool is in the series. Ends with a colon.
2. **A bullet LIST of the other six siblings**, one per line, `[Name](url) — role in 2–4 words`. Alphabetical is not required; keep the flock's existing order so a reader who has seen one README recognises the next. **A repo never lists itself.**
3. **The compose promise**, its own short paragraph — **the room's EXISTING sentence, moved verbatim, never retyped.** Any repo-specific interop sentence follows it in the same paragraph; that part is the room's own claim and must stay true to shipped behaviour. **This section deliberately quotes no canonical wording**, because the first version of it did and was wrong: it locked `Install one, it stands alone; …` — CoalWash's comma variant, 1 repo of 7 — while six repos carry `Install one and it stands alone; …`. CoalHearth's doc-writer measured the split and refused to conform, which is the only reason a 6+1 divergence did not become a 5+2 one.

   **The general trap, worth more than the fix:** a pattern doc is written by READING the rooms, so a string it quotes can be one room's variant promoted by accident — and conforming to it then MANUFACTURES the divergence the lock exists to close. A backtick signals verbatim intent; it is not evidence of flock consensus. **Before adopting any quoted "canonical" string from this file, count it across the flock first.**

   **AND IT ALREADY HAPPENED — recorded because the outcome was RATIFIED, and a ratified accident that reads as a decision is a lie.** The correction above arrived too late: five rooms (CM · CT · CB · CF · CL) had already read the bad lock and conformed. Git settles who was right — **before the wave, six repos carried `Install one and it stands alone; …` and only CoalWash carried the comma form.** After it, six carry the comma form and only CoalHearth carries `and`, because its doc-writer counted, refused, and reported. **That refusal is the only reason anyone knows the flock moved at all.**

   Main's ruling: the two forms mean the same thing and neither is wrong, so **the comma form is ratified as canonical and CoalHearth conforms** — reverting five repos of equivalent prose buys nothing. **What is NOT ratified is the mechanism.** Uniformity here was reached by a main error propagating through five obedient rooms in under an hour; the room that behaved correctly is the one that ended up out of step. **Read that as the cost of quoting a string you did not count, not as a precedent for sweeping rooms into a lock.**
4. **The shared doctrine + series pointer**, one short paragraph.

Then the standing `Zero-dependency, offline, no API keys.` line, unchanged.

**Why a list and not a prose paragraph:** six inline links inside running prose is a wall — the reader cannot scan for the one sibling they came for, and on a phone it is ten wrapped lines of blue. The list makes the flock's SHAPE legible at a glance, which is the whole job of this section.

**Named divergences to resolve in the same sweep (measured 2026-07-27, do not "preserve" them):**
- **Heading emoji: 🧭 in six repos, 🏭 in CoalMine.** 🧭 is flock-canonical; CoalMine conforms.
- **CoalTipple has no blank line after the `H2`.** Add it — every other repo has one.
- **The closing `Zero-dependency, offline, no API keys.` line is a CLAIM, not a shape item — it is NEVER swept.** It is absent in CoalMine and reads "offline by default" in CoalLedger. **Do not "add the missing one":** measured 2026-07-27, CoalMine's doc-writer refused exactly that instruction with source evidence — `source-grounding` fetches (WebSearch/WebFetch) and `supply-chain-audit` queries live registries, so a bare "offline" would have contradicted that room's own `## Permissions` section and `PRIVACY.md`, both of which correctly scope the no-network promise to the HOOK layer. A room carries this line **iff its own shipped code makes it true**, in the wording its own behaviour supports; a variant with a stated reason is a named divergence, not drift.

  **The general rule this cost us: a flock pattern locks the SHAPE; the room owns the CLAIM.** A conformance instruction is not a claim verification — before adopting any boilerplate sentence from this file, grep the shipped code for the behaviour it asserts. Row 10 came within one edit of propagating a false network claim into a room whose own two docs already had it right.

## SECURITY.md

Title is `# Verifying <Tool>`. Same section order across the family.

| # | Section (`H2`) | Holds |
|---|---|---|
| 1 | Intro (no heading) | One line: "verified under the same framework as [sibling]" — Phoenix-13 hooks, reproducible builds, periodic scans. |
| 2 | Reporting a Vulnerability | Open an issue / request a private channel for sensitive PoC. |
| 3 | Commit & Tag Signatures | **Release tags and maintainer commits** are SSH-signed (`gpg.format=ssh`); GitHub shows the Verified badge on them — but **Dependabot/CI bot commits are UNSIGNED** (no maintainer key), so NEVER claim “all commits are signed”. The local-verify snippet MUST be self-contained and actually run: it MUST first CREATE the allowed-signers file — `echo "* ssh-ed25519 <key>" > <tool>_signers` — *before* `git config gpg.ssh.allowedSignersFile ./<tool>_signers`, because verification FAILS without it (`allowedSignersFile needs to be configured and exist`). Use the `*` principal (matches any committer email → verifies the KEY, not a hardcoded identity; never invent a principal email — it must match the signer or verify says "No principal matched"). Then — NEVER `git verify-commit HEAD` (a released HEAD is often an unsigned Dependabot/CI commit → non-zero, aborts the check); verify the signed release TAG, which always passes: `git tag -v "$(git describe --tags --abbrev=0)"`. The `echo`+`config` lines are LOAD-BEARING DATA — never trim them as "fat" (doing so silently broke all three repos' verify until 2026-06-22). **A verifiability claim must match what a cloner reproduces on the CURRENT tree: scope it (tags + maintainer commits, not all-commits) and give a command that PASSES regardless of who authored HEAD.** |
| 4 | Dist Integrity | `plugin/` is generated; `verify.mjs` byte-checks dist-sync; `build-plugin.mjs` reproduces it; `test.mjs` runs the zero-dep tests. |
| 5 | Independent Scanning — NVIDIA SkillSpector | The scan result, behind a `<!-- version-transition: ... -->` marker. **Scanning is event-driven** (a new SkillSpector version or a genuinely new attack surface), NOT per-release — the static rules are stable, so a content bump does not change what they read; a scan-pin lagging the ship version is BY DESIGN. Every finding gets a per-finding false-positive reason. Never bump the scanner version / score / date without a real re-scan. |
| 6 | Structural Safety (Phoenix-13) | The hook is zero-dep, no-network, no-child-process, fail-silent, advise-only. No data-exfiltration path. |

A tool whose own architecture carries a security story appends ONE tool-specific `H2` **after** row 6 — `Security by Design — the Swarm` (CoalFace) · `Security by Design — the Board` (CoalBoard). Named extension, not drift; the 6-row spine keeps its order above it.

## CONTRIBUTING.md

| # | Section (`H2`) | Holds |
|---|---|---|
| 1 | Intro (no heading) | One line: what the tool is + "issues, bug reports, and PRs welcome". |
| 2 | Proposing a Change | Open an issue first (especially for a `SKILL.md` edit) → make the change, keep the gates green → validate behaviour against a real fixture / dogfood it live. **A first-time outside contributor gets a named path from here**: the gate commands in row 3 ARE the "getting started" steps (clone, install nothing extra per Phoenix #2, run the green gate) — a repo issue labelled for newcomers (`good first issue` or equivalent) is the entry point where one exists; where none does, row 2's own steps stand in. **What transfers from Kubernetes here is only that a path exists — not its wrangler/approver role structure**, sized for thousands of contributors against our one human + a handful of seats. |
| 3 | Developing & Testing | Zero-dependency (Node 22+ — the maintained LTS floor the repos' CI tests, 22 · 24; no `npm install`). The green-gate commands (`build-plugin` → `verify` → `test`). A **Development Rules** `H3`: the SSoT file, rebuild `plugin/` after a source edit, keep hooks Phoenix-pure + hermetic-tested, add unit tests, code style, English-only source. |
| 4 | Supported Platforms | Mirror the README's stance (cross-agent matrix, or the single-platform statement + reason). |
| 5 | Project Layout | A path → purpose table. |
| 6 | Releasing (Maintainers) | The bump → CHANGELOG → green gates → signed tag → push → GitHub Release (stable tags only) chain. |
| 7 | License & Conduct | **The repo's own licence** (per the portfolio, README row 11 above — never a hardcoded "Apache-2.0"), **inbound contributions are licensed under that same outbound licence** (no separate CLA; the Apache Software Foundation's own LC40 shape — a contributor sending a PR licenses it the way the project already ships, stated plainly rather than left implicit), good faith, report security per SECURITY.md, and a link to `CODE_OF_CONDUCT.md`. **A response-time expectation is OURS to state, never borrowed** (opensource.guide's 7-day figure is sized for a project with a paid triage rotation; a solo maintainer running 8+ repos states their own number). Until the owner sets a target window, the honest ship-text is: **"Response time: best effort by a solo maintainer; no SLA is promised. When a target window is set it is stated here."** — true today, never a placeholder token on a public surface. |

<!-- coalmine: verified 2026-09-02 · exemplar GitHub Open Source Guides "Starting a project" (opensource.guide/starting-a-project — the LICENSE·README·CONTRIBUTING·CODE_OF_CONDUCT four-file floor) · revalidate 90d -->
## CODE_OF_CONDUCT.md

Absent from every shipped repo today — our repos take outside issues and PRs, so the variable genuinely transfers; this is a NEW required file, not a table cell inside CONTRIBUTING.md's old "License & Conduct" row.

- **Content: name a well-known text rather than draft one.** The [Contributor Covenant](https://www.contributor-covenant.org/) is the usual choice industry-wide — link its current version, do not paste and fork it (a pasted-and-forked copy drifts from the upstream text it claims to be).
- **One line naming the enforcement contact** — for a solo-maintainer org this is the same channel `SECURITY.md` already names for a private report; do not invent a second channel.
- **Linked from `README.md`'s badge/links row and from `CONTRIBUTING.md` row 7** — a file nobody links to is a file nobody finds.

## PRIVACY.md

Title is `# <Tool> Privacy Policy`, then a bold one-liner, then one bullet list — no sub-headings.

- **Lead:** **`<Tool> collects nothing and phones nowhere.`**
- **The bullets (bold lead-in each):** No telemetry · No network calls from the hook (Phoenix #7) · It runs inside YOUR agent (no servers, your account, your platform's permission gate) · the tool-specific honesty note (a local-estimate stat figure, a best-effort secret-scrub that is NOT a guarantee, propose-never-execute staging) · Error reports are manual (offered, never auto-submitted, you edit first) · Local files only (name the exact files the user can read).
- **Close:** `Questions: open an issue at <repo-issues-url>.`

## CHANGELOG.md

Keep-a-Changelog format at repo root — the FORMAT is flock-shared, the VOICE is not (each repo's entry style is its own; never conform one sibling's habit onto another). The release chain that fills it (bump sizing, tag, Release) is owned by [scripts-quality.md](./scripts-quality.md) §3, and the Release's own title + notes shape by [RELEASE-PATTERN.md](./RELEASE-PATTERN.md) — not restated here. What a DOC pass checks:

- **Every shipped tag has an entry.** An entry-less tag is the recurring miss (caught live twice in one day) — the entry lands *before* the tag, not after.
- **The section types match the bump size** (the keep-a-changelog ↔ SemVer mapping, all six spec types — [keepachangelog.com/en/1.1.0](https://keepachangelog.com/en/1.1.0/)): an `### Added` or `### Deprecated` entry ⇒ MINOR-minimum · a breaking `### Removed`/`### Changed` ⇒ MAJOR · only `### Fixed` / non-breaking `### Changed` / a `### Security` patch ⇒ PATCH. A feature (or a deprecation notice) shipped under a PATCH number is the bug. **A `### Deprecated` entry follows the flock's own deprecation policy** — the window (deprecated at MINOR, removable at the flock's next MAJOR, never a fixed months-count borrowed from elsewhere) and the required fields (a marker, an actionable notice, the migration owner, and ship-text as the only channel — Phoenix #13 forecloses hook output) are governed at `.claude/rules/ecc/common/coding-style.md` §Deprecation (verified present at source 2026-09-02); the CoalWorks mirror at `CoalWorks/.claude/rules/scripts-quality.md` is CWK-050's to land, not yet present as of this write. This file does not restate the policy, only the CHANGELOG's own type-mapping consequence of it.
- **Newest version first**, each under `## [X.Y.Z] - YYYY-MM-DD` (a leading `## [Unreleased]` block is fine). A released entry is IMMUTABLE — to correct one, add a forward-pointing note in the NEW entry ("Supersedes [X.Y.Z]'s '…' note — true when written; what changed since"), never edit the old text.

## Repo details (the front-MOST door — outranks the README)

A visitor decides in seconds from the repo card/About BEFORE the README ever renders: name · description · topics · language · release recency. A stale About loses them before the page loads (the "5 canaries" description once sat 4 versions stale). The review lane verifies this surface FIRST — before the README — on every release and launch (USER rule 2026-07-08).

| Piece | Shape |
|---|---|
| About description | ONE clear About that is **accurate and non-stale**: what it does + the load-bearing count/status if any ("9 quality canaries…", "…live beta"). **Currency beats brevity** — honest framing (a scope caveat, a platform lock) may run long; a short *stale* About is the failure, a long *accurate* one is not. Any version/count in it joins the Event-2 sweep — prefer number-free. |
| Topics | The flock base set `claude-code` `claude` `ai-agents` `agent-skills` `ai-coding` `developer-tools` (the floor — present on every sibling) + per-tool specifics (e.g. `code-quality` for CM, `model-routing` for CT, `multi-agent`/`consensus` for CB, `memory-management` for CW, `linter` for CL). The base floor + every specific that a searcher would actually type. GitHub's hard cap is 20 — the real limits are RELEVANCE (an off-target topic dilutes the card) and CURRENCY (a retired capability's topic joins the Event-2 sweep, like CoalHearth's dropped `token-optimization`). **The base names `agent-skills`, not `skills`** — amended 2026-07-25 after a seven-room verification found all 7 siblings carrying `agent-skills` and this spec carrying the stale token; `skills` alongside it is permitted, not required (CoalMine keeps it). Do not "conform" a repo back to `skills`. |
| Website field | The org landing (`github.com/TheColliery`) unless the tool has a better front door. |
| Releases panel | Never empty on a stable tool (= reads abandoned); the latest stable visible. Policy: tags = beta+stable, Releases = stable-only. |
| License tag | Auto-detected as **the repo's own zone licence, per the portfolio** (README row 11 above) — `Apache-2.0` is the Coal\* skill-suite (zone 1) EXAMPLE, not the expected detect for every repo. A missing/odd detect means the LICENSE file drifted from what that repo actually ships (caught live: `.github` showed MIT after the relicense missed its own LICENSE) — never "fix" a correct non-Apache detect back toward Apache-2.0. |

## benchmarks/\<Tool\>/ (the org benchmark dir — two layers, same shape every tool)

Decided 2026-07-04: **`RESULTS.md` = the OVERVIEW (short digest) · `results/` = the DETAIL.** One shape for all tools:

| File | Role |
|---|---|
| `README.md` | The protocol — what is measured, the task/fixture table, method, how to run both arms. Evergreen: no result figures, no dates (except inside task golds). |
| `RESULTS.md` | The digest + entry point — a `**Measured:**` line (date · tested tool VERSION · engines) + a `<!-- version-frozen -->` marker, a TL;DR blockquote, the headline table, LINKS down to `results/`, and an honest-scope close. **Short — detail lives below, never duplicated up.** The org-landing row and the tool repo's README § Benchmark link HERE, never deeper. |
| `results/` | The detailed dated records — one `.md` per platform/run (`<topic>-<platform>-YYYY-MM-DD.md`) with full per-task tables and analysis, plus raw machine files (`.json` / `.tsv` / logs). Anything a stranger needs to reproduce the digest. |
| inputs + scorer | `fixtures/` or `tasks.md`; `score.mjs` where scoring is executable (CM/CT). A judgment-scored bench says so in its README (CB does). |

**Field evidence (reported, not measured):** a third-party field report (e.g. a user-run result filed as a public issue) lands as a clearly-labeled `## Field evidence — reported, not measured` section at the END of `RESULTS.md`, plus a verbatim source snapshot under `results/field/` (a subdir, so a scorer globbing `results/*.json` never picks it up as a run). Every entry carries reporter + date + source link + what the report does NOT state (version/engine); it NEVER folds into the measured arms/tables. Shape set by the first entry (CoalMine, 2026-07-25).

Named divergences (grandfathered — conform at each tool's next benchmark re-run, not by churning public links today): **CoalTipple** raw lives in `dogfood/output/` + top-level `ROUTING-SAVINGS.md` (publicly linked 4×) → fold into `results/` at the next re-run · **CoalMine** raw is machine `.json` only (fine — its RESULTS.md carries the narrative) · **CoalHearth** is a single-run bench, RESULTS.md serves both layers until a second run exists.

## When you touch any of these docs

1. Re-verify every claim against the current code/schema before calling it done (a README is the easiest doc to let rot).
2. Run the per-version doc sweep in [scripts-quality.md](./scripts-quality.md) — the `version-transition` spots (SECURITY scan pin, About, this landing's suite table, any hardcoded version).
3. Keep it lean: if cutting a line changes nothing the reader does, cut it.
