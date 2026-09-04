# New-Repo Wizard (TheColliery)

> **THE 3-KIND SKELETON (UMB-045, 2026-09-03) supersedes phases A–C below for a repo of a
> known KIND—published-code (a Coal* skill or Kolwen-shaped repo) · private-working (a
> Free-plan private repo, Bankfire-shaped) · article (a GitBook-published standard,
> SpriteDesignDatum-shaped).** One command replaces the manual walk for everything a
> skeleton owns: `node .github/scripts/new-repo.mjs <kind> [--overlay coal-skill|llm-deploy]
> --name <repo> --license <spdx> <target-dir>`. It copies `templates/<kind>/` (+ the named
> overlay), fills `{{PLACEHOLDER}}` tokens it can from flags, and refuses a non-empty
> target—content-only placeholders (a README's "what it is" prose, a SECURITY.md's threat
> model) are left for a human, named in the script's own output. `node
> .github/scripts/skeleton-check.mjs` is the companion DERIVING instrument—it walks every
> zone directory carrying either a `.git` of its own OR at least one file from any kind's
> own skeleton (`.git` is one enumeration signal, never the sole gate—a folder published
> by a non-git mechanism, e.g. a GitBook change request, still belongs in the report),
> classifies it by kind, and reports each skeleton-owned file identical / DIFFERS /
> absent; it never fixes drift, only names it. **Phases A–C below still apply
> to anything the skeleton does not own**—the repo's own README prose, its `SKILL.md`
> contract, local governance files, and any org-mechanics step (Phase D onward) untouched
> by a skeleton copy. `overlay-coal-skill/` carries the 5-Standard-Systems shipping
> mechanics for a Coal*-shaped repo (today: the claude.ai ZIP-packaging pair only—the
> config/`configure.mjs`/`verify.mjs`-gate/`/stats` pieces are named pending in that
> overlay's own README, not fabricated). `overlay-llm-deploy/` is a placeholder directory,
> not yet populated.
>
> **This is an ENUMERATION, not a design.** Every pattern named below already exists somewhere in the org; this document is the ORDERED LIST a human or a room head walks through when a new repo is born, with each step pointing at the file that governs it. Where a step has no pattern, that is said plainly rather than invented here. Duplicating a governing file's content here would create a second source of truth that rots—so this file is one line plus a pointer, per step.
>
> **First customer: CoalGob**, founded 2026-08-04 as org repo #8, **LOCAL ONLY—no remote yet** (main's ruling). This wizard is what CoalGob runs before that changes.
>
> **Org-level, UNREVIEWED.** This document was produced by the umbrella doc-writer with no INSPECT pass—`AGENTS.md`'s own deputies-INSPECT gap names org-level work as reviewed-by-nobody-yet, and this is org-level. Say so rather than let silence imply it passed a review it never got.

## Phase A—Local founding · owner: the new room's `coder`

1. `git init`, default branch `main`.
2. The flock-canonical tree (plugin manifests, source-vs-dist split, config system, scripts/gates) → [`SKILL-REPO-PATTERN.md`](./SKILL-REPO-PATTERN.md) §"The shape" + its own "New-repo checklist" (items 1-4). Only build what the tool's variant actually needs—§"Variant matrix" names which layers a tool type ships.
3. License—**Apache-2.0** (series-relicensed 2026-07-04) → `LICENSE` + `NOTICE`, copied from any live sibling. **Three deliberate MIT keeps exist elsewhere in the org—do not copy those paths, and do not "fix" a repo that intentionally kept MIT** (the umbrella `MEMORY.md`, `series-relicensed-apache-2.0` entry, names the exact keep-paths).
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
7. **The git hooks are NOT installed by cloning—this is the step that gets skipped.** `git config core.hooksPath .githooks`, **then the proof step: plant a defect, watch the commit get REJECTED.** [`scripts-quality.md`](./scripts-quality.md) §2 measured **7 of 8 repos with ZERO hooks installed**—the "never commit with `--no-verify`" rail was protecting nothing on 7 of them. **Mechanism: NONE.** Nothing in the org today checks `core.hooksPath` is set on a repo; a fresh clone is silently ungated until this line is run by hand and nobody is warned. Named here as an unenforced rule, not fixed here.

## Phase B—Everything owed at first push · owner: the new room's `coder` + `doc-writer`

8. Public docs (README, SECURITY.md, CONTRIBUTING.md, `CODE_OF_CONDUCT.md`, PRIVACY.md, CHANGELOG.md) → [`DOC-PATTERN.md`](./DOC-PATTERN.md)—each has its own section spine (SECURITY.md's 6-row table, CONTRIBUTING.md's 7-row table, `CODE_OF_CONDUCT.md`'s name-a-well-known-text shape, PRIVACY.md's fixed shape, CHANGELOG's keep-a-changelog format). **`CODE_OF_CONDUCT.md` is a NEW required file as of UMB-021 (2026-09-02)—absent from every repo founded before this line; a room conforming an OLD repo adds it at its next doc touch, not retroactively on this pass.** Not restated here.
9. The repo's own `.github/`—`ISSUE_TEMPLATE/` (`bug-report.yml` + `config.yml`; add `platform-report.yml` when the tool is cross-agent) and, only where the tool ships to claude.ai, `marketplace.json` + `zip-skills.yml` (copied verbatim from [`templates/zip-skills.yml`](./templates/zip-skills.yml)—see `SKILL-REPO-PATTERN.md` Layer 5). Version-carrying issue-template placeholders get a `version-pin:` marker so `verify.mjs` catches drift.
10. Machine-local governance (`CLAUDE.md`/`AGENTS.md`/`MEMORY.md`/`.claude/`/`.agents/`)—gitignored by `.gitignore` above, never pushed, but the room needs them locally: a thin room `CLAUDE.md` `@import`ing `AGENTS.md`+`MEMORY.md`+the ecc domain rules, matching the shape every existing room carries. No pattern file names this shape explicitly today—**the pattern is "read how every live room's `CLAUDE.md` does it," an absent written pattern, said plainly.**

## Phase C—CI · owner: the new room's `coder`

11. **Per-repo workflows (copied INTO the new repo), all SHA-pinned 40-char with a `# vX` comment:** `ci.yml` · `codeql.yml` · `markdownlint.yml` · `scorecard.yml` · `dependabot-auto-merge.yml` + `dependabot.yml` → `SKILL-REPO-PATTERN.md` Layer 5. **Verified today: `code-scanning-digest.yml`, `skillspector-version-watch.yml`, `update-readme.yml`, `verify-landing.yml` live ONLY in `.github`'s own workflows—zero copies exist in any room repo.** These are org-level sweeps a new repo is covered by automatically once added to the org; copying them into a room repo would be the wrong move, not a missed one—naming this because the dispatch's own workflow list mixes both classes and a reader could conflate them.
12. Node matrix floor **`[22, 24]`** (LTS only) → `.claude/rules/ecc/node/runtime.md` §6.
13. **`fetch-depth: 0` on checkout.** Measured today (`CoalMine/.github/workflows/ci.yml`): without it, a tag-dependent gate takes a silent SKIP on every run—CoalMine's own gate was inert until commit `4991129`. Not yet verified present on every other sibling; a new repo should not inherit the gap by copying a stale example.
14. `paths-ignore` on the three gated workflows (`ci.yml`/`codeql.yml`/`scorecard.yml`) skips doc-only commits—`NOTICE` belongs in that ignore list beside `LICENSE`, per `SKILL-REPO-PATTERN.md` Layer 5.
15. The **`all-green` summary job** the branch ruleset (step 18 below) requires as its single required check → live in every sibling's `ci.yml`; point at any one as the exemplar, not restated here.

## Phase D—The remote and its settings · owner: **main**

16. Create the remote (`gh` CLI is NOT on this machine, removed 2026-07-30—REST + `$env:GITHUB_TOKEN`, per `AGENTS.md`'s GitHub section and the umbrella `MEMORY.md`'s `gh-not-on-tool-path-use-github-token` note).
17. **Repo settings—the one-time creation config** → [`SWEEP-MARKS.md`](./SWEEP-MARKS.md) §"GitHub repo settings—the creation-time setup," full table there (Issues/Discussions on, Projects/Wiki off, auto-delete-branch on, auto-merge on, the `dependabot-auto-merge-gate` ruleset, security-and-analysis all on, workflow-token read-only, default branch `main`, `FUNDING.yml`, Scorecard posture dismissals). **`MEMORY.md`'s "GitHub / org facts" already records what is enabled org-wide—read it before re-deriving, per its own instruction.**
18. **This settings half is the one that gets skipped**, proven live at the CoalWash + CoalLedger launch (2026-07-09): the file-diff-producing marks were done, the invisible API-state settings were not. `SWEEP-MARKS.md`'s own text: **"run BOTH halves and VERIFY the settings via the API afterward, comparing against a live sibling."** No mechanism catches a missed setting today beyond that manual comparison—**named as unenforced.**

## Phase E—The repo-details surface · owner: the new room's **`code-reviewer`**

19. About description, topics, website, Releases panel seeding, license detection → `DOC-PATTERN.md` §"Repo details (the front-most door—outranks the README)" names the SHAPE. `AGENTS.md`'s REPO-DETAILS OWNERSHIP rule (2026-07-25) says who supplies the text: **the room's code-reviewer holds this surface—this wizard names the owner, not the words**, per its own rail.
20. **Front-most rule:** a visitor hits repo-details BEFORE the README ever renders—sweep this before, not after, a polished README.

## Phase F—Org landing · owner: **`.github` deputy** (steps 1-4, 7-8) + each new room's own people (steps 5-6, 9)

21. `SWEEP-MARKS.md` §"Event 4—New skill/tool launch" already enumerates the full 9-mark list with an owner per mark—**cited, not copied here.** A copied count drifts; this org has measured that exact drift once already (the `SKILL_REGISTRY.md` rule against embedding version numbers exists for the identical reason).

## Where the org has a rule but no mechanism—every instance found while writing this

- Step 4 (`.gitattributes` shape)—verified today: **6 of 7 live rooms** (CoalBoard, CoalTipple, CoalHearth, CoalFace, CoalWash, CoalLedger) carry the pre-fix THIN shape that bit CoalGob; only CoalMine carries the full one. Nothing detects the drift or backports the fix—named here, not fixed here (out of this document's scope).
- Step 7 (git hooks installed on clone)—no automatic check that `core.hooksPath` is set on a fresh repo.
- Step 10 (local governance file shape)—no written pattern for the room `CLAUDE.md`'s `@import` shape; it exists only as convention across live rooms.
- Step 13 (`fetch-depth: 0`)—no gate asserts every repo's `ci.yml` carries it; CoalMine's own fix landed reactively, after the SKIP had already been silently wrong.
- Step 18 (repo settings)—no API-diff tool compares a new repo's settings against a live sibling automatically; `SWEEP-MARKS.md` itself names this as a manual comparison, and separately notes a `repo-setup.mjs` that COULD script the whole settings table does not exist.
- Step 21 (org landing marks)—the 9-mark list is a checklist a human/head executes by reading it; nothing fails CI if a mark is missed.

## What I pointed at versus what I had to write fresh

**Pointed at (no restatement, verified current against the file):** `SKILL-REPO-PATTERN.md` (shape, layers, New-repo checklist), `DOC-PATTERN.md` (public docs, repo-details), `SWEEP-MARKS.md` (Event 4's 9 marks, the repo-settings table), `scripts-quality.md` (hooks-not-installed-by-cloning), `node/runtime.md` §6 (Node floor), `AGENTS.md` (REPO-DETAILS OWNERSHIP, no-external-assumption, GitHub/`gh`-removed facts), `MEMORY.md` (GitHub org facts, the Apache-2.0 relicense note).

**Written fresh here (no existing pattern named it):** the local-governance-file-shape gap (step 10), the explicit per-repo-vs-org-level workflow split (step 11, verified by directly checking which files exist where—this distinction was not written down anywhere before this document), and the "fourth-tense" mechanism-or-none list above, which is this document's own accounting, not copied from any source.

## No-external-assumption check

Every step above degrades to "ask a human" rather than hard-requiring a tool this machine might lack: no step assumes the `gh` CLI (removed 2026-07-30); GitHub operations route through REST + `$env:GITHUB_TOKEN` per `AGENTS.md`. No step assumes a `repo-setup.mjs` or equivalent automation exists—none does, and the checklist form is the honest floor for a rare event (`SWEEP-MARKS.md`'s own words).

## Not touched by this dispatch

No remote was created, no repo setting was changed, CoalGob was not touched. This document only.
