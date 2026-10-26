# New-Repo Wizard (TheColliery)

> **THE 3-KIND SKELETON (UMB-045, 2026-09-03) supersedes phases A–C below for a repo of a
> known KIND—published-code (a Coal* skill or Kolwen-shaped repo) · private-working (a
> Free-plan private repo, Bankfire-shaped) · article (a GitBook-published standard,
> SpriteDesignDatum-shaped).** One command replaces the manual walk for everything a
> skeleton owns: `node .github/scripts/new-repo.mjs <kind> [--overlay coal-skill|llm-deploy]
> --name <repo> --license <spdx-or-a-file-path> [--license-id <spdx-or-name>]
> <target-dir>` (paths are from the UMBRELLA root; inside this repo drop the leading `.github/`—`node scripts/new-repo.mjs …`—and the same holds for `skeleton-check.mjs` below). It copies `templates/<kind>/` (+ the named overlay), fills
> `{{PLACEHOLDER}}` tokens it can from flags, and refuses a non-empty target—content-only
> placeholders (a README's "what it is" prose, a SECURITY.md's threat model) are left for
> a human, named in the script's own output. **The licence-identity triangle (UMB-058 +
> UMB-059): the README badge, NOTICE and the LICENSE body must agree, in both
> directions—a bare `--license` SPDX string that contradicts the shipped body REFUSES; a
> `--license <file>` derives the badge/NOTICE from the substituted body's own identity
> and REFUSES an unidentifiable one (a licence outside the flock's 5-licence portfolio)
> unless `--license-id` states it explicitly.** `node
> .github/scripts/skeleton-check.mjs` is the companion DERIVING instrument—it walks every
> zone directory carrying either a `.git` of its own OR at least one file from any kind's
> own skeleton (`.git` is one enumeration signal, never the sole gate—a folder published
> by a non-git mechanism, e.g. a GitBook change request, still belongs in the report),
> classifies it by kind, and reports each skeleton-owned file identical / DIFFERS /
> absent; it never fixes drift, only names it. **Phases A–C below still apply
> to anything the skeleton does not own**—the repo's own README prose, its `SKILL.md`
> contract, local governance files, and any org-mechanics step (Phase D onward) untouched
> by a skeleton copy. `overlay-coal-skill/` carries the 5-Standard-Systems shipping
> mechanics for a Coal*-shaped repo—the claude.ai ZIP-packaging pair plus the `config`
> mechanism (`config-schema.mjs`/`configure.mjs`/`config-keys.mjs`) and a `/stats`
> command stub, every piece named in its own `OVERLAY-README.md` (renamed from `README.md`
> UMB-056/4, so applying the overlay never overwrites the scaffolded repo's real product
> README). `overlay-llm-deploy/` carries a Cloudflare Workers post-deploy check
> (`post-deploy-check.mjs` + its shipped test) and a `wrangler.jsonc` stub, per its own
> `OVERLAY-README.md`.
>
> **This is an ENUMERATION, not a design.** Every pattern named below already exists somewhere in the org; this document is the ORDERED LIST a human or a room head walks through when a new repo is born, with each step pointing at the file that governs it. Where a step has no pattern, that is said plainly rather than invented here. Duplicating a governing file's content here would create a second source of truth that rots—so this file is one line plus a pointer, per step.
>
> **First customer: CoalGob**, founded 2026-08-04 as org repo #8; **public beta since 2026-09-21** (`TheColliery/CoalGob`), local-only until then. This wizard is what CoalGob ran before that changed.
>
> **Newest birth: Pithead** (2026-10-24, `private-working`, zone `LLMWorks`, repo `TheColliery/Pithead`). Its lessons are steps 11b (CodeRabbit) and 11c (what a private kind does not get) in Phase C.
>
> **Org-level, UNREVIEWED.** This document was produced by the umbrella doc-writer with no INSPECT pass—`AGENTS.md`'s own deputies-INSPECT gap names org-level work as reviewed-by-nobody-yet, and this is org-level. Say so rather than let silence imply it passed a review it never got.
>
> **Revised 2026-10-26** (the `.github` deputy, order 2026-10-26a): every hypothesis re-checked against the file that governs it; `git log -p NEW-REPO-WIZARD.md` names what changed. Also unreviewed: no INSPECT seat exists for org-level surfaces.

## Phase 0—Before the repo exists · owner: main, or the zone chief for its zone

0. **A new SYSTEM is born by its own sequence first.** `.claude/SYSTEM-BIRTH.md` (umbrella) governs it: §1 the home and the team (a repository created with the org custom properties `repo-kind` and `zone` and the canon for its kind; Phases A to F below are the mechanics of that home step only), §2 the study visit, §3 the blueprint judged by the build anchor, §4 the prototype, §5 the build and first life. Nothing in Phases A to F replaces §2 to §5.
   A working folder that will host seats is set up before its first seat, per the umbrella `.claude/CWD-SETUP.md`. That is a wider category than a new system: a tool yard or an article room is one too.

## Phase A—Local founding · owner: the new room's `coder`

1. `git init`, default branch `main`.
2. The flock-canonical tree (plugin manifests, source-vs-dist split, config system, scripts/gates) → [`SKILL-REPO-PATTERN.md`](./SKILL-REPO-PATTERN.md) §"The shape" + its own "New-repo checklist" (items 1-4). Only build what the tool's variant actually needs—§"Variant matrix" names which layers a tool type ships.
3. License—**per zone, never one blanket licence** → the portfolio table in the umbrella `.claude/DESIGNER-CONTRACT.md`, section "LICENSE—the org-wide family rule" (a pointer only): the Coal* suite Apache-2.0, Chotmeter FSL-1.1-Apache-2.0, articles © plus CC BY-NC-ND 4.0, Kolwen open, Bankfire proprietary. A new zone's licence is a fresh per-artifact decision, never read off that table. The full legal text goes in `LICENSE`: never SPDX-only, never a stub. `new-repo.mjs --license <file>` takes that text, and `--license-id` names a licence its recognizer does not know (a proprietary body is one); the script refuses a stub and a badge that contradicts the body. The three deliberate MIT keeps in the Coal* suite are named in the umbrella `MEMORY.md` portfolio bullet: do not copy those paths, and do not "fix" a repo that kept MIT.
4. `.gitattributes`—**state the SHAPE below verbatim; do not point at one sibling and say "copy that one."** This exact instruction broke on its first customer (CoalGob, 2026-08-04): it named CoalBoard as the exemplar, CoalBoard carries the THIN shape (hooks-only, no base LF rule), and without the base rule a Windows box commits CRLF into `.mjs` source—caught in CoalGob only by luck of commit sequencing, before the wizard existed to catch it.
   ```gitattributes
   # Normalize line endings: LF everywhere except Windows-only scripts.
   * text=auto eol=lf
   # Redundant under the rule above, but stated explicitly: a CRLF checkout of a
   # /bin/sh hook is `bad interpreter` on POSIX, i.e. a silently absent gate.
   /.githooks/** text eol=lf
   *.ps1 text eol=crlf
   *.cmd text eol=crlf
   *.bat text eol=crlf
   ```
   `.githooks/**` MUST be pinned `eol=lf` no matter what else the file carries—[`scripts-quality.md`](./scripts-quality.md) §2: under `core.autocrlf=true`, a CRLF checkout of a `/bin/sh` hook is `bad interpreter` on POSIX, i.e. a silently absent gate. **See also:** CoalMine already carries this full shape (the one live instance of it)—named for reference only, not as the thing to copy.
5. `.gitignore`—the private-governance ignores (`CLAUDE.md`/`AGENTS.md`/`MEMORY.md`/`.claude/`/`.agents/`/design docs) → `SKILL-REPO-PATTERN.md` checklist item 6, the clean-clone principle.
6. `.markdownlint.json`—copy `.github/.markdownlint.json` verbatim. Verified byte-identical against a live sibling (CoalMine) today—this one file genuinely is flock-canonical from `.github`'s own copy, unlike `.gitattributes` above.
7. **The git hooks are NOT installed by cloning—this is the step that gets skipped.** `git config core.hooksPath .githooks`, **then the proof step: plant a defect, watch the commit get REJECTED.** The hook pair now runs the secret scan first (`scripts/secret-gate.mjs`, SERIES-CANON.md): a skeleton-born repo that has not run this line pushes unscanned. [`scripts-quality.md`](./scripts-quality.md) §2 measured **7 of 8 repos with ZERO hooks installed**—the "never commit with `--no-verify`" rail was protecting nothing on 7 of them. **Mechanism: NONE.** Nothing in the org today checks `core.hooksPath` is set on a repo; a fresh clone is silently ungated until this line is run by hand and nobody is warned. Named here as an unenforced rule, not fixed here. **And the hook must be committed EXECUTABLE (mode `100755`)**—git silently skips a non-executable hook on Linux and macOS, so a fence committed as `100644` does not exist there. The templates now ship `100755`, but a scaffold run on Windows writes files with no execute bit: after `git add`, run `git update-index --chmod=+x .githooks/*` (and read it back with `git ls-files -s .githooks`) before the first commit. Measured at the API 2026-09-21: Kolwen and Bankfire commit their hooks `100644` (the fence is absent on a POSIX clone), the seven Coal rooms and Chotmeter carry `100755`.

## Phase B—Everything owed at first push · owner: the new room's `coder` + `doc-writer`

8. Public docs (README, SECURITY.md, CONTRIBUTING.md, `CODE_OF_CONDUCT.md`, PRIVACY.md, CHANGELOG.md) → [`DOC-PATTERN.md`](./DOC-PATTERN.md)—each has its own section spine (SECURITY.md's 6-row table, CONTRIBUTING.md's 7-row table, `CODE_OF_CONDUCT.md`'s name-a-well-known-text shape, PRIVACY.md's fixed shape, CHANGELOG's keep-a-changelog format). **`CODE_OF_CONDUCT.md` is a NEW required file as of UMB-021 (2026-09-02)—absent from every repo founded before this line; a room conforming an OLD repo adds it at its next doc touch, not retroactively on this pass.** Not restated here.
9. The repo's own `.github/`—`ISSUE_TEMPLATE/` (`bug-report.yml` + `config.yml`; add `platform-report.yml` when the tool is cross-agent) and, only where the tool ships to claude.ai, `marketplace.json` + the claude.ai ZIP-packaging pair (copied verbatim from [`templates/overlay-coal-skill/`](./templates/overlay-coal-skill/)—see `SKILL-REPO-PATTERN.md` Layer 5). Version-carrying issue-template placeholders get a `version-pin:` marker so `verify.mjs` catches drift.
10. Machine-local governance (`CLAUDE.md`/`AGENTS.md`/`MEMORY.md`/`.claude/`/`.agents/`)—gitignored by `.gitignore` above, never pushed, but the room needs them locally: a thin room `CLAUDE.md` `@import`ing `AGENTS.md`+`MEMORY.md`+the ecc domain rules, matching the shape every existing room carries. No pattern file names this shape explicitly today—**the pattern is "read how every live room's `CLAUDE.md` does it," an absent written pattern, said plainly.** A working folder that will host seats is approved first, per the umbrella `.claude/CWD-SETUP.md`: the owner opens it once, and `node scripts/include-flags.mjs --require <folder>` must exit 0. Re-checked 2026-10-26: no other `.github` markdown file carries an `@import` pattern.

## Phase C—CI · owner: the new room's `coder`

11. **Per-repo workflows (copied INTO the new repo), all SHA-pinned 40-char with a `# vX` comment:** `ci.yml` · `codeql.yml` · `markdownlint.yml` · `scorecard.yml` · `coverage.yml` (report-only; the converter it runs, `.github/scripts/lcov-to-cobertura.mjs`, travels with it) · `dependabot-auto-merge.yml` + `dependabot.yml` → `SKILL-REPO-PATTERN.md` Layer 5, and `front-door-links.yml` (the outward-link checker for a front door; engine `scripts/front-door-links.mjs`). **Per kind, what the skeleton ships (checked 2026-10-26 against `templates/*/`):** `published-code` ships all of these; `private-working` ships only `.github/workflows/gate.yml` (no CodeQL, Scorecard, coverage or Dependabot files; see 11c); `article` ships `check.yml`, `create-release.yml` and `watch-sources.yml`, and none of the Coal* set. The list above is the `published-code` list. **Coverage also needs Code Quality switched on for the new repository (Settings → Security → Code quality)—a per-repo setting no template carries; until it is on, expect the upload to be refused (annotated, not red—`fail-on-error: false`).** **Verified today: `update-readme.yml`, `verify-landing.yml` live ONLY in `.github`'s own workflows—zero copies exist in any room repo (a third, `skillspector-version-watch.yml`, was retired on 2026-09-26).** These are org-level sweeps a new repo is covered by automatically once added to the org; copying them into a room repo would be the wrong move, not a missed one—naming this because the dispatch's own workflow list mixes both classes and a reader could conflate them.
12. Node matrix floor **`[22, 24]`** (LTS only) → `.claude/rules/ecc/node/runtime.md` §6.
13. **`fetch-depth: 0` on checkout.** Measured today (`CoalMine/.github/workflows/ci.yml`): without it, a tag-dependent gate takes a silent SKIP on every run—CoalMine's own gate was inert until commit `4991129`. Measured 2026-10-26: the published-code template carries it; 5 of 8 CoalWorks rooms carry it in `ci.yml`, and CoalFace, CoalLedger and CoalWash carry no `fetch-depth` line at all (checkout depth 1). A new repo inherits the template, never a room's stale example.
14. `paths-ignore` on the three gated workflows (`ci.yml`/`codeql.yml`/`scorecard.yml`) skips doc-only commits—`NOTICE` belongs in that ignore list beside `LICENSE`, per `SKILL-REPO-PATTERN.md` Layer 5.
15. The **`all-green` summary job** the branch ruleset (step 18 below) requires as its single required check → live in every sibling's `ci.yml`; point at any one as the exemplar, not restated here.

11b. **CodeRabbit is not on by default for a new repo.** The skeleton ships the kind's `.coderabbit.yaml` (`private-working` opts the knowledge base out), but no review starts until the owner has set that repo's own configuration (`language`, `reviews.profile`, `path_filters`, `path_instructions`) against the schema, per the owner's machine-local CodeRabbit rule, "Before first use on a repo". A session drafts it and hands it to the owner; it never presses a review on the skeleton alone. Exhibit: Pithead on 2026-10-26 (card BB-284), where a review was nearly pressed on the skeleton. An instruction a deterministic check would catch belongs in CI instead (`.claude/rules/ecc/common/code-review.md` §Outside patrols, the CI-gate MUST).
11c. **What a private kind does not get.** `private-working` sits on the Free plan. `templates/repo-settings.private-working.json` states secret scanning, private vulnerability reporting and both ruleset rows as N/A with their reasons, and the umbrella `MEMORY.md` adds code scanning and push protection to the same list; only Dependabot alerts and security updates are on. The house secret scan runs from the repo's `.githooks` gate (step 7), and CI is the one `gate.yml` the kind ships. Nothing checks that these N/A rows stay N/A, or that the kind ships no CodeQL file, which is the intended state.

## Phase D—The remote and its settings · owner: **main**

16. Create the remote with REST, never the `gh` CLI. `gh` is installed on this machine (since 2026-08-20, for the owner's own session), and Colliery seats never call it or uninstall it. Read `$env:GITHUB_TOKEN` by name, per `AGENTS.md`'s GitHub section.
17. **Repo settings—the one-time creation config** → [`SWEEP-MARKS.md`](./SWEEP-MARKS.md) §"GitHub repo settings—the creation-time setup," full table there (Issues on, Discussions off (org announcements live in `.github`'s Discussions), Projects/Wiki off, auto-delete-branch on, auto-merge on, the `dependabot-auto-merge-gate` ruleset, the `main-guard` and `tag-immutable` rulesets (empty bypass; `node scripts/new-repo.mjs --apply-settings <kind> --repo <owner>/<name> --only rulesets`), the two org custom properties `repo-kind` and `zone` (required, so a new repo carries their defaults until a full `--apply-settings <kind> --repo <owner>/<name> --zone <zone>` sets the real values; [`SERIES-CANON.md`](./SERIES-CANON.md) names the values), security-and-analysis all on, workflow-token read-only, default branch `main`, `FUNDING.yml`, Scorecard posture dismissals). **`MEMORY.md`'s "GitHub / org facts" already records what is enabled org-wide—read it before re-deriving, per its own instruction.** **Per kind (checked 2026-10-26):** for `private-working` the `main-guard` and `tag-immutable` rows are N/A in `templates/repo-settings.private-working.json` (rulesets answer 403 on the Free plan), so skip the `--only rulesets` command for a private repo. The settings file of each kind is the authority.
18. **This settings half is the one that gets skipped**, proven live at the CoalWash + CoalLedger launch (2026-07-09): the file-diff-producing marks were done, the invisible API-state settings were not. `SWEEP-MARKS.md`'s own text: **"run BOTH halves and VERIFY the settings via the API afterward, comparing against a live sibling."** `node scripts/skeleton-check.mjs --settings` (needs `GITHUB_TOKEN`) diffs a live repo's settings against its kind's file and prints each N/A reason, but it reports and never fails, and it does not read the org custom properties. Nothing gates a missed setting—**named as unenforced.**

## Phase E—The repo-details surface · owner: the new room's **`code-reviewer`**

19. About description, topics, website, Releases panel seeding, license detection → `DOC-PATTERN.md` §"Repo details (the front-most door—outranks the README)" names the SHAPE. `AGENTS.md`'s REPO-DETAILS OWNERSHIP rule (2026-07-25) says who supplies the text: **the room's code-reviewer holds this surface—this wizard names the owner, not the words**, per its own rail.
20. **Front-most rule:** a visitor hits repo-details BEFORE the README ever renders—sweep this before, not after, a polished README.

## Phase F—Org landing · owner: **`.github` deputy** (steps 1-4, 7-8) + each new room's own people (steps 5-6, 9)

21. `SWEEP-MARKS.md` §"Event 4—New skill/tool launch" already enumerates the full mark list with an owner per mark—**cited, not copied here.** A copied count drifts; this org has measured that exact drift once already (the `SKILL_REGISTRY.md` rule against embedding version numbers exists for the identical reason).

## Where the org has a rule but no mechanism—every instance found while writing this

- Step 4 (`.gitattributes` shape)—re-measured 2026-10-26 with `md5sum` over `CoalWorks/*/`, `LLMWorks/*/` and `.github/templates/*/`: the eight CoalWorks rooms, Pithead and both templates share one hash; Bankfire, Chotmeter and Kolwen each carry their own, so Kolwen no longer matches the shape measured on 2026-09-25; this repo's root `.gitattributes` differs too. ChotUnitDatum and GachaRateDesignDatum are not in this checkout set and were not re-measured. `scripts/skeleton-check.mjs` reports the file per kind; nothing backports a fix.
- Step 7 (git hooks installed on clone)—no automatic check that `core.hooksPath` is set on a fresh repo. Re-checked 2026-10-26: `hooksPath` appears only in two test files under `scripts/`; still unenforced.
- Step 10 (local governance file shape)—no written pattern for the room `CLAUDE.md`'s `@import` shape; it exists only as convention across live rooms. Re-checked 2026-10-26: unchanged.
- Step 13 (`fetch-depth: 0`)—no gate asserts every repo's `ci.yml` carries it; 3 of 8 CoalWorks rooms lack it (measured 2026-10-26, step 13 above); CoalMine's own fix landed reactively, after the SKIP had already been silently wrong.
- Step 18 (repo settings)—`skeleton-check --settings` now diffs a live repo against its kind's file (report only, step 18 above); no tool compares the org custom properties or gates a missed setting. `repo-setup.mjs`, which the earlier text named, does not exist (re-checked 2026-10-26).
- Step 21 (org landing marks)—the mark list is a checklist a human/head executes by reading it; nothing fails CI if a mark is missed.
- Step 11c (private kind)—no gate checks that a private repo's N/A rows (CodeQL, secret scanning, rulesets) stay N/A by plan, or that the kind ships no CodeQL file.

## What I pointed at versus what I had to write fresh

**Pointed at (no restatement, verified current against the file):** `SKILL-REPO-PATTERN.md` (shape, layers, New-repo checklist), `DOC-PATTERN.md` (public docs, repo-details), `SWEEP-MARKS.md` (Event 4's mark list, the repo-settings table), `scripts-quality.md` (hooks-not-installed-by-cloning), `node/runtime.md` §6 (Node floor), `AGENTS.md` (REPO-DETAILS OWNERSHIP, no-external-assumption, the GitHub section's `gh` facts), `MEMORY.md` (GitHub org facts, the licence portfolio note).

**Written fresh here (no existing pattern named it):** the local-governance-file-shape gap (step 10), the explicit per-repo-vs-org-level workflow split (step 11, verified by directly checking which files exist where—this distinction was not written down anywhere before this document), and the "fourth-tense" mechanism-or-none list above, which is this document's own accounting, not copied from any source.

## No-external-assumption check

Every step above degrades to "ask a human" rather than hard-requiring a tool this machine might lack: no step assumes the `gh` CLI (installed since 2026-08-20; no Colliery seat calls it); GitHub operations route through REST + `$env:GITHUB_TOKEN` per `AGENTS.md`. No step assumes a `repo-setup.mjs` or equivalent automation exists—none does, and the checklist form is the honest floor for a rare event (`SWEEP-MARKS.md`'s own words).

## Not touched by this dispatch

No remote was created, no repo setting was changed, CoalGob was not touched. This document only.
