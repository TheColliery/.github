# SWEEP-MARKS — the event → doc-spot registry

Every recurring event below silently rots a FIXED set of surfaces. This file is the
canonical mark list: when the event fires, EVERY mark gets swept in the same batch —
no mark is optional, and the reader-facing "front doors" come before the archives.
(Born 2026-07-03 after three front-door misses in one day: the tool README benchmark
headline, the org-landing benchmark row, and Thai prose reaching a public doc.)

**Integration with the org dispatch model:** any sub dispatched for one of these events
gets the event's mark list embedded verbatim in its contract; the review lane verifies
every mark was touched (or explicitly N/A); the main gates the push on mark-complete.

## Mechanically gated (no longer swept by eye)

`scripts/verify-landing.mjs` — run in CI on every push + PR (`.github/workflows/verify-landing.yml`)
— FAILS the build on the subset a machine can check in THIS repo, so a human never has to catch it:

- **Event 1 mark 3** — every `benchmarks/<Tool>/` has a row in the profile Benchmarks table.
- **Event 1 mark 4 (date half)** — every benchmark record carries a `YYYY-MM-DD`.
- **Language-universal** — no unmarked Thai in the visitor front doors (`profile/` · `benchmarks/` ·
  root `README.md`); intentional Thai (translation-benchmark DATA, e.g. scored Thai output) declares
  `<!-- lang-exempt: reason -->` (the "name the intentional divergence" rule).

The gate sees only THIS repo, so everything else stays MANUAL: cross-repo README front doors
(Event 1 mark 2 — each tool's own repo), version provenance, prose judgment, and Events 2–4's
cross-repo marks. **A green gate is NOT "all marks swept"** — it clears only the local mechanical
subset. The rest is still the review lane + the human reading the rendered landing.

---

## Event 1 — Benchmark re-run (per tool) · 4 marks

| # | Mark | Where |
|---|---|---|
| 1 | The benchmark record (full tables, method, caveats) | `.github/benchmarks/<Tool>/RESULTS.md` |
| 2 | The tool repo's README benchmark headline (the front door) | `<Tool>/README.md` § Benchmark |
| 3 | The org landing Benchmarks table row | `.github/profile/README.md` § Benchmarks |
| 4 | Provenance on every figure: test DATE + tested tool VERSION + engine labels | inside marks 1-3 |

Rules: public docs are language-universal (English) — marks 3, 4-date, and the Thai rule are now
CI-gated (see "Mechanically gated" above); mark 2 (the tool repo's own README) and the tested-VERSION
half of provenance are still manual. A figure without date+version is not publishable.

## Event 2 — Version release (per repo) · 8 marks (+1 anti-mark)

| # | Mark | Where |
|---|---|---|
| 1 | `version-pin:` lines match plugin.json (mechanical gate) | `verify.mjs checkVersionPins` |
| 2 | CHANGELOG entry (keep-a-changelog) | `CHANGELOG.md` |
| 3 | Annotated tag pushed | `git tag -a vX.Y.Z` + `--follow-tags` |
| 4 | GitHub Release — STABLE tags only (beta = tag-only) | `gh`/REST release |
| 5 | **Repo details — the front-MOST door, checked BEFORE the README** (About description incl. counts/status · topics · website link · Releases panel shows the new stable · license auto-detect) | repo settings + the rendered repo page |
| 6 | Org landing suite table (version/status per tool) | `.github/profile/README.md` |
| 7 | Mirror refresh ("push offline") | `clean-export.ps1` |
| 8 | Installed + cross-agent copies | `update-tools.ps1` |
| 9 | **CI green on the release commit + Code scanning 0 new alerts — checked AFTER the push** (the release is not "done" at the push; a red check sits on the repo front door). The review lane owns this; a local-green/CI-red split usually means the PUSHED content differs from the working tree (e.g. a `git add` pathspec that missed a source dir — hit live at CT v1.2.0). **EXPERIMENT RECORD (2026-07-16, deployed AND retired same day — do not re-propose):** an `alert-on-red.yml` net + a codeql fail-on-open-alerts step replaced this ritual for ~2 hours; its first live fire (CoalHearth) proved the design wrong — it DUPLICATED GitHub's native workflow-failure notification ("เด้งซ้อน"), held CodeQL red the whole time a known-FP alert stayed open (re-ping per scheduled run + blocked Dependabot auto-merge), and painted a "code scanning configuration error" banner. USER ruling: what already works, don't touch. The ONE real gap that survives: GitHub has NO documented notification for NEW default-branch code-scanning alerts (verified vs docs 2026-07-16) — this mark's post-push alert check is currently the only coverage. | Actions runs + Security tab, via REST/`gh` |

**Anti-mark:** `SECURITY.md`'s SkillSpector pin is NEVER bumped on a release — it names
the last ACTUAL scan (Event 3 owns it). Bumping it without a scan fabricates coverage.

## Event 3 — SkillSpector re-scan (new scanner version, SATURATED builds only) · 3 marks

| # | Mark | Where |
|---|---|---|
| 1 | SECURITY.md scan pin: scanner version + score + verified finding classes | every scanned repo's `SECURITY.md` (×7 — CoalMine, CoalTipple, CoalBoard, CoalHearth, CoalFace, CoalWash, CoalLedger) |
| 2 | Scan reports stay local | `skillspector-*.json` gitignored, never committed |
| 3 | The scan record (dated, per-repo scores, FP verdicts) | machine-local registry/memory |

Rules: scan LAST — on the version a batch declared done, never a mid-batch snapshot.
Verify every finding before writing a verdict; a sub's clean-scan claim is suspect input.

**Split-baseline hazard (found 2026-07-09):** the root `.skillspector-version` baseline the
version-watch workflow diffs against is ONE number, but the fleet can straddle two scanner
versions — CoalWash + CoalLedger launched already scanned at v2.3.11 while the other 5 siblings
(and the baseline file) still sit at v2.3.9. A single pin can't represent a split fleet; only a
suite-wide re-scan that brings every repo to the SAME version, then bumps the baseline to match,
closes it.

## Event 4 — New skill/tool launch (a new sibling) · 8 marks

| # | Mark | Where |
|---|---|---|
| 1 | Org landing "Active Repositories" badge list | `.github/profile/README.md` |
| 2 | Org landing suite/profile table row | `.github/profile/README.md` |
| 3 | Traffic workflow repo list + badge specs + its test | `scripts/update-readme.mjs` (+ `scripts/update-readme.test.mjs`), run by `.github/workflows/update-readme.yml` |
| 4 | Installer menu + install prose/table | `colliery-install.mjs` + org README install section |
| 5 | EVERY sibling repo's "Part of TheColliery — siblings:" line + doctrine paragraph | all N tool READMEs |
| 6 | Flock-canonical shapes conform (workflows, gitignore, doc shapes) | `SKILL-REPO-PATTERN.md` checklist |
| 7 | Tool registry entry | machine-local `SKILL_REGISTRY.md` |
| 8 | Updater registration | machine-local `update-tools.ps1` |

| 9 | New repo's own repo-details (About description + topics + website per DOC-PATTERN's repo-details shape; Releases panel seeded) | repo settings |

Rule: a suite-size number (tool count, sibling list) is a one-flock invariant — grep-sweep
every surface that enumerates the suite, then read the RENDERED landing as a human.

**Front-most rule (USER 2026-07-08):** the repo-details surface (About · topics · Releases
panel) is the gate a visitor passes BEFORE ever seeing the README — it outranks the README
in sweep order, and the review lane verifies it FIRST on every release/launch. A polished
README behind a stale About loses the visitor before the README loads.

### GitHub repo settings — the creation-time setup (the marks above keep enumeration IN SYNC; this is the one-time repo CONFIG the mark registry did not cover)

> **The settings half is the one that gets SKIPPED** (proven live at the CoalWash + CoalLedger launch, 2026-07-09: the 8 enumeration marks + repo-details were done, but Discussions / delete-branch-on-merge / secret-scanning + push-protection + Dependabot-security-updates were all left at their disabled defaults). Why: the enumeration marks produce a visible FILE DIFF (you see the row you added), the settings produce NONE (an API state change, invisible in git) — so a launch that "looks done" in the diff is not. **On every new-sibling launch, run BOTH halves and VERIFY the settings via the API afterward, comparing against a live sibling** (`GET /repos/{owner}/{repo}` + `.../actions/permissions/workflow`).

The 8 marks above sweep the enumeration surfaces so a new sibling is *listed* everywhere. Separately, a new repo needs its GitHub SETTINGS set once — the mark registry covers up-to-date drift, NOT creation. Apply these (API-scriptable via `PATCH /repos/{owner}/{repo}` + the code-security/actions endpoints):

| Setting | Value | Field / where |
|---|---|---|
| Features: Issues · Discussions | ON | `has_issues` · `has_discussions` (bug reports · community Q&A — owner auto-watches → post notifies) |
| Features: Projects · Wiki | OFF | `has_projects` · `has_wiki` (unused; docs live in README/references) |
| PR: auto-delete head branch | ON | `delete_branch_on_merge` (tidy after a merged Dependabot PR) |
| PR: auto-merge | ON | `allow_auto_merge` — REQUIRED by the Dependabot auto-merge gate below (was OFF/"human merges" until 2026-07-09; the maintainer merged every green bump by hand → days of latency, so it is now automated BEHIND a CI gate, never gateless) |
| Ruleset `dependabot-auto-merge-gate` | active | branch ruleset on `~DEFAULT_BRANCH`, `required_status_checks` = the stable CI contexts (`all-green` + `analyze (javascript)` for a skill repo; `verify` for `.github`), `strict_required_status_checks_policy: false`, **bypass_actors = RepositoryRole Admin (actor_id 5, `always`)** so the maintainer's direct pushes have ZERO friction. This makes `gh pr merge --auto` WAIT for green instead of merging instantly — it is load-bearing, not optional. `POST /repos/{o}/{r}/rulesets`. |
| Security & analysis | ALL ON | secret-scanning · push-protection · Dependabot alerts + security-updates · private-vulnerability-reporting |
| Actions: workflow token | read | `default_workflow_permissions=read` (least-privilege GITHUB_TOKEN) |
| Actions: can approve PRs | OFF | `can_approve_pull_request_reviews=false` |
| Default branch | `main` | |
| FUNDING.yml | `github: HetCreep` | the org-wide default (`.github` repo) reaches ORG repos; a repo OUTSIDE the org (e.g. HetCreep-owned) needs its OWN `.github/FUNDING.yml` |
| Scorecard posture findings | dismiss-with-reason | BranchProtection / Fuzzing / CIIBestPractices = solo-repo not-fixable, dismissed per repo |

The repo FILES (SHA-pinned CI workflows incl. the `all-green` summary job · `dependabot-auto-merge.yml` [top-level `contents: read`, job-level write only — Scorecard Token-Permissions] · gitignore private-governance ignores · markdownlint · LICENSE · SECURITY/CONTRIBUTING/PRIVACY · dependabot.yml · codeql.yml · scorecard.yml) live in [`SKILL-REPO-PATTERN.md`](SKILL-REPO-PATTERN.md) — copy that shape. This table = the API/UI settings that file-shape does not carry. (Scriptable end-to-end: a `repo-setup.mjs` could PATCH all of these in one shot; a checklist is the honest floor for a rare event.)

---

Companion shapes live in [`SKILL-REPO-PATTERN.md`](SKILL-REPO-PATTERN.md); the release
mechanics live in each repo's release gate. This file only answers: *which spots, how many.*
