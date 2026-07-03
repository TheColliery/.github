# Script Quality and Release Rules

<!-- coalmine: verified 2026-07-01 · exemplar npm + Cargo + husky + Keep a Changelog · revalidate 90d -->

Scope: user-invoked CLI scripts (`scripts/*.mjs`) and release bookkeeping for the CoalMine repo itself. Hooks follow [hooks-safety.md](./hooks-safety.md) (fail-silent); CLI scripts follow the OPPOSITE discipline — fail loud.

## 1. CLI Exit-Code Discipline (Fail Loud)

User-invoked scripts must exit non-zero when any unit of work fails, including partial failures (exemplar: `npm install` exits non-zero on any package failure).

- Per-item catch blocks may warn and continue, but must set `process.exitCode = 1`.
- Done-summary lines must report failed counts (e.g. `Done: 8/9 skill(s), 1 failed`).
- Gate scripts (`verify.mjs`) must wrap every per-item check in try-catch so one corrupt input yields a clean `FAIL <item>: <reason>` line and the remaining checks still run — never a raw stack trace.
- Gates must check both directions: source→dist staleness AND dist-only orphans (nothing ships that has no source).

## 2. Zero-Dep Unit Tests for Core Logic

Core shared logic (`scripts/lib/`) must have unit tests runnable with built-ins only: `node --test` (node:test — available since Node 18, stable since Node 20; exemplar: husky keeps automated tests despite a ~2 kB codebase).

- Cover at minimum: SHARED marker injection, `{{*_INTENT}}` placeholder substitution, missing/corrupt `skill-meta.json` fallback, recursive skill-dir copy.
- The verify gate must have at least one automated negative-path test (stale dist → exit 1; exemplar: Cargo blocks publish from a dirty working tree).
- Wire `node --test <explicit test-file list>` into the pre-commit AND pre-push hooks alongside `verify.mjs` — enumerate every test file and fail loud if a listed file is missing (`node --test` silently ignores missing file args, and the directory form proved unreliable on Node 24: MODULE_NOT_FOUND).

## 3. Release Bookkeeping

On every version bump in `.claude-plugin/plugin.json` (exemplars: Keep a Changelog convention, keepachangelog.com; Cargo registry checksums culture):

- **Size the bump to the change — standard SemVer, the way the whole world does it (USER 2026-07-04 "ต้องขยับเลขแบบที่ทั่วโลกทำ"; correctness, not habit):** MAJOR (`X.0.0`) = a BREAKING change (removed/renamed/incompatibly-changed a public API · config key · CLI · behavior) · MINOR (`x.Y.0`) = a NEW backward-compatible CAPABILITY (feature · new command · a config key with a real consumer · a new canary) · PATCH (`x.y.Z`) = bugfix / internal refactor / doc / repo-meta, NO new capability. **Decisive test: can a user DO something they couldn't before? → yes = MINOR (minimum) · no = PATCH · did something they relied on break? = MAJOR.** **Mechanically checkable via the CHANGELOG sections (keep-a-changelog ↔ SemVer, the world-standard mapping): an `### Added` entry ⇒ MINOR-minimum · a breaking `### Removed`/`### Changed` ⇒ MAJOR · only `### Fixed` / non-breaking `### Changed` / a `### Security` patch ⇒ PATCH.** ENFORCE by CLASSIFYING the change BY ITS CHANGELOG SECTIONS **before** picking the number — an `### Added` shipped as a PATCH is the bug. NEVER ship a feature set as a PATCH — the number must tell the user how big the change is. Two named under-bumps stand as precedent (already tagged, NOT retroactively fixable — from here MATCH the number to the magnitude): **CoalBoard v1.0.13** (a carve's MINOR-worth shipped as a patch) and **CoalTipple v1.0.23** (23 patches with NO minor bump, though Self-Updating v1.0.13 · the memory-anchor · `configure.mjs` were MINOR-worthy capabilities — the 2-digit patch is the symptom a user spotted). Correct FORWARD: CT's next capability bump makes it `1.1.0`, not `1.0.24`.
- Add a `CHANGELOG.md` entry at repo root in keep-a-changelog format.
- Create an annotated git tag `vX.Y.Z` and push it with `--follow-tags` — the GitHub remote is canonical since the marketplace submission (supersedes the early local-git-only decision).
- Publish a GitHub Release for every **stable** tag (a beta/pre-release tag is history only — the policy: tags = beta + stable, Releases = stable-only) (`gh release create vX.Y.Z --title ... --notes ...`) — the tag is history, the Release is the announcement; an empty Releases panel reads as an abandoned repo. Keep the repo About description in sync with the canary count and headline features (it went stale at "5 canaries" for four versions before anyone noticed).
- **After publishing, run BOTH propagation scripts — the release is NOT done at the GitHub push (the installed + cross-agent copies are still STALE):** (1) `clean-export.ps1` (= "push offline") refreshes the dogfood/scan mirror (`Colliery/`) so the user scans the RIGHT state, not the old one (a stale mirror wastes scan tokens); (2) **`update-tools.ps1`** propagates the new version to the INSTALLED Claude plugin (`claude plugin update`), the Antigravity global copy (`~/.gemini/config/skills`), and the `.agents/skills` cross-agent copy (+ repo verify) — without it the installed / AG / cross-agent copies stay at the OLD version while only GitHub has the new one. BOTH are user-flagged recurring misses — don't forget EITHER.

### Per-version doc spots — the doc-transition checklist (re-check EVERY release)

Some docs carry data that must change on every version bump or security re-scan; a missed one silently rots (the About sat at "5 canaries" for four versions; the org landing read `v3.5.1` / "CoalTipple Design Only" after both had already shipped). Two mechanisms keep them honest:

1. **Gated (mechanical):** any doc line carrying a `version-pin:` marker must quote the current `plugin.json` version, or `verify.mjs` fails (`checkVersionPins`) — today, the issue-template placeholders. Prefer dropping a version outright (`git describe`, number-free "major N" counts) over pinning; pin only where the concrete version genuinely helps the reader.
2. **Listed (manual — this checklist, for what a gate can't reach):**
   - `SECURITY.md` — the SkillSpector **version + score + finding line-refs** (line-refs shift on ANY skill edit: re-run the scan, re-sync). Carries an inline `<!-- version-transition: ... -->` marker. SECURITY.md sits at repo root, OUTSIDE the scanned dir (`plugin/` for CoalMine, `skills/coaltipple/` for CoalTipple), so an HTML-comment marker here never trips SkillSpector's own P2 "hidden instructions" flag.
   - `SKILL_REGISTRY.md` (machine-local) — **STRUCTURAL changes only** (a new tool / skill / install mapping). It carries **NO version numbers by its own rule** ("ห้ามใส่เลข version" — they rot; live versions come from `claude plugin list`), so a plain version bump needs **no edit here** — only a new/removed tool or a changed install method does.
   - The repo **About** description and the **org landing** (`TheColliery/.github` profile README) suite table — version + live/design status per tool.
   - **The repo's own `README.md` status/version line — prefer NUMBER-FREE** (a dynamic shields.io badge, OR "Status: stable" + a pointer to CHANGELOG/releases), NEVER a hardcoded version: it rots silently (the CoalBoard README sat at `v1.1.0` for 3 releases — v1.2.0/v1.2.1/v1.3.0 — until a dogfood board caught it; CM/CT use dynamic badges and never rotted). If a README must name a version, it joins this manual sweep.

Rule of thumb: a number that names *this* version is debt. Drop it where the reader does not need it (dynamic / number-free); mark + enumerate it where they do. Grep `version-transition` across a repo's root docs to find every manual spot before tagging.
