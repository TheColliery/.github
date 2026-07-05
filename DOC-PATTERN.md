# Public-Doc Pattern (TheColliery)

> The shared writing pattern for every series repo's public docs — `README.md`, `SECURITY.md`, `CONTRIBUTING.md`, `PRIVACY.md` — and the org `benchmarks/<Tool>/` dir shape. Extracted from the live CoalMine / CoalTipple / CoalBoard docs so a new repo (and an edit to an old one) ships sibling-consistent.
> Three standing doc rules govern all of them: **trim the fat** (say each thing once, cut filler), **correct heading hierarchy** (clean `H1 → H2 → H3`, no skipped or duplicated levels), and **a README matches the code** (every claim = shipped behaviour, re-verified against the source, never aspirational).

## Cross-cutting rules (all four docs)

- **One `H1` per file** (the title), then `H2` sections, then `H3` sub-sections. Never skip a level (no `H1 → H3`) and never repeat the `H1`.
- **Platform-neutral** — these tools are cross-agent. A user-facing instruction is COMPLETE for every platform (Claude Code plugin command AND the other-agent path) or it points to the README's per-platform section. Never a single-vendor-only line. (CoalTipple is the one exception that is *correctly* Claude-Code-only — and it says so explicitly, with the reason.)
- **Data is verbatim from its source, never invented.** A version = `plugin.json`; a benchmark figure = the `.github/benchmarks/<tool>/` record (LINK to it, never copy the number into the doc — a copied number drifts); a behaviour claim = the code. If you cannot source it, do not write it.
- **Number-free where it rots.** A README status line is a dynamic shields.io badge or `Status: stable` + a link to CHANGELOG/Releases — never a hardcoded version. The live version lives in `plugin.json` / the GitHub releases.
- **Clean-clone:** benchmarks and process docs live in the org `.github/`, not the skill repo. The repo's docs LINK out to them.
- **Emoji section icons are optional but consistent within a file** — if the README uses them, use them on every `H2`; if not, none. Do not half-decorate.

## README.md

The shop window. Lead with what the tool IS and the one install command; push depth down the page.

| # | Section (`H2`) | Holds |
|---|---|---|
| 1 | Title + tagline (`H1` + bold one-liner) | Name, a one-sentence "what it does", a badge row (version via dynamic tag badge, license, status), a links row (Changelog · Security · Privacy · Releases), and the "Part of TheColliery" sibling line. |
| 2 | What it is | The metaphor + the core idea in 2–4 sentences. For a router/board, a small table of the core decision (delegate-down / escalate-up; the lens roles). |
| 3 | How it works | The mechanism: the canary table, the two knobs, the board's phases. One table beats three paragraphs. |
| 4 | Compatibility / platform support | Which agents, what ports where. A matrix when the tool is cross-agent; an explicit `[!CAUTION]` + reason when it is single-platform. |
| 5 | Install | The one-command plugin path first, then the universal/other-agent path. |
| 6 | Configure | The config file + precedence in one intro line, then a **key TABLE** (`Key · Default · What it does`) of the high-impact keys **that must match the `config-schema.mjs` SSoT** — gate it, or re-verify on every config change (an un-gated table drifts silently). A large key set stays a table — list the high-impact keys only; a narrative dial (e.g. a rigor preset) gets ONE line above the table, never a prose paragraph replacing it. Close with the standard footer: "Full key reference: `scripts/lib/config-schema.mjs` + the commented `platform-configs/` template." (Table-only became the flock shape 2026-07-04 — the earlier prose-for-large-key-sets option is retired; a prose Configure is a conform target, not a choice.) |
| 7 | Benchmark | A short honest framing + a LINK to `.github/benchmarks/<tool>/`. Never inline the figures. **A headline figure MUST name the tested VERSION + date** — LOAD-BEARING (sourced from the benchmark record, never a copied number): a version-less figure silently rots as releases ship past it, and if a later release changed the measured behaviour, say it is *not re-benchmarked* rather than implying a current-version result. Keep the honest-scope caveat (dated, small samples). **Attribute each figure to the exact arm/condition it was measured on** — never credit a number measured on one arm (e.g. cheap-tier ad-hoc fan-out) to a different subject (e.g. the skill itself). |
| 8 | Part of TheColliery | The sibling links + the shared doctrine (Phoenix-13, SSoT config, no-overkill). |
| 9 | License | `Apache License 2.0. See [LICENSE](LICENSE).` — **the LICENSE file MUST exist in the repo** (a `License: Apache-2.0` badge or claim with no backing file is a false claim). |

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

## CONTRIBUTING.md

| # | Section (`H2`) | Holds |
|---|---|---|
| 1 | Intro (no heading) | One line: what the tool is + "issues, bug reports, and PRs welcome". |
| 2 | Proposing a Change | Open an issue first (especially for a `SKILL.md` edit) → make the change, keep the gates green → validate behaviour against a real fixture / dogfood it live. |
| 3 | Developing & Testing | Zero-dependency (Node 18+, no `npm install`). The green-gate commands (`build-plugin` → `verify` → `test`). A **Development Rules** `H3`: the SSoT file, rebuild `plugin/` after a source edit, keep hooks Phoenix-pure + hermetic-tested, add unit tests, code style, English-only source. |
| 4 | Supported Platforms | Mirror the README's stance (cross-agent matrix, or the single-platform statement + reason). |
| 5 | Project Layout | A path → purpose table. |
| 6 | Releasing (Maintainers) | The bump → CHANGELOG → green gates → signed tag → push → GitHub Release (stable tags only) chain. |
| 7 | License & Conduct | Apache-2.0, good faith, report security per SECURITY.md. |

## PRIVACY.md

Title is `# <Tool> Privacy Policy`, then a bold one-liner, then one bullet list — no sub-headings.

- **Lead:** **`<Tool> collects nothing and phones nowhere.`**
- **The bullets (bold lead-in each):** No telemetry · No network calls from the hook (Phoenix #7) · It runs inside YOUR agent (no servers, your account, your platform's permission gate) · the tool-specific honesty note (a local-estimate stat figure, a best-effort secret-scrub that is NOT a guarantee, propose-never-execute staging) · Error reports are manual (offered, never auto-submitted, you edit first) · Local files only (name the exact files the user can read).
- **Close:** `Questions: open an issue at <repo-issues-url>.`

## benchmarks/\<Tool\>/ (the org benchmark dir — two layers, same shape every tool)

Decided 2026-07-04: **`RESULTS.md` = the OVERVIEW (short digest) · `results/` = the DETAIL.** One shape for all tools:

| File | Role |
|---|---|
| `README.md` | The protocol — what is measured, the task/fixture table, method, how to run both arms. Evergreen: no result figures, no dates (except inside task golds). |
| `RESULTS.md` | The digest + entry point — a `**Measured:**` line (date · tested tool VERSION · engines) + a `<!-- version-frozen -->` marker, a TL;DR blockquote, the headline table, LINKS down to `results/`, and an honest-scope close. **Short — detail lives below, never duplicated up.** The org-landing row and the tool repo's README § Benchmark link HERE, never deeper. |
| `results/` | The detailed dated records — one `.md` per platform/run (`<topic>-<platform>-YYYY-MM-DD.md`) with full per-task tables and analysis, plus raw machine files (`.json` / `.tsv` / logs). Anything a stranger needs to reproduce the digest. |
| inputs + scorer | `fixtures/` or `tasks.md`; `score.mjs` where scoring is executable (CM/CT). A judgment-scored bench says so in its README (CB does). |

Named divergences (grandfathered — conform at each tool's next benchmark re-run, not by churning public links today): **CoalTipple** raw lives in `dogfood/output/` + top-level `ROUTING-SAVINGS.md` (publicly linked 4×) → fold into `results/` at the next re-run · **CoalMine** raw is machine `.json` only (fine — its RESULTS.md carries the narrative) · **CoalHearth** is a single-run bench, RESULTS.md serves both layers until a second run exists.

## When you touch any of these docs

1. Re-verify every claim against the current code/schema before calling it done (a README is the easiest doc to let rot).
2. Run the per-version doc sweep in [scripts-quality.md](./scripts-quality.md) — the `version-transition` spots (SECURITY scan pin, About, this landing's suite table, any hardcoded version).
3. Keep it lean: if cutting a line changes nothing the reader does, cut it.
