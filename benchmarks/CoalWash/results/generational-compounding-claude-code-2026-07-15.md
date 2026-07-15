# Generational-compounding mini-lab — loss class #54

**Date:** 2026-07-15 · **Platform/engine:** Claude Code (4 sequential general-purpose subagents, haiku tier, one per pass; control = 1 independent general-purpose subagent, haiku tier) · **CoalWash version under test (detector):** `anchor-diff.mjs` shipped this round, scored against the rc.3-era `fidelity-gate.mjs` `inventory()` engine (unmodified).

This is a **[MINI-LAB] round** per `MASTER-LOSS-TAXONOMY.md`'s own trigger (a world-discovered class outside the existing list → one targeted detector round through the wear-lab factory, never a full campaign re-run). It is not part of, and does not re-run, the closed 53-class wear campaign (`wear-campaign-claude-code-2026-07-10.md`, `campaign-close-claude-code-2026-07-11.md`).

## The class and the thesis under test

**Generational-compounding / iterative-compression drift** (class #54; primary sources: EverMemOS#133, arXiv 2603.11768, arXiv 2508.04306): a repeated lossy consolidation pass diffs against the PRIOR pass's OUTPUT, never the original — "a photocopy of a photocopy." After pass 1, no ground-truth anchor for the true original survives *in the passed-along text itself*. CoalWash's shipped fidelity gate (`gateFiles`) is exactly a **per-pass** diff (orig-of-THIS-rewrite vs new-of-THIS-rewrite) — by construction it cannot see loss that accumulated across several EARLIER generations, especially generations that happened outside `applyPlan` entirely (a hand-edit, an ad hoc "tidy this" LLM pass, a multi-sitting wizard/muscle-reorg run with no re-anchor step). CW's own safety net already keeps ground-truth anchors on disk as a side effect — `apply.mjs`'s verified snapshots and `bins.mjs`'s per-cut records — so this round asks: (1) does the compounding loss actually happen and does a per-pass view hide it, and (2) can a detector be built from artifacts CW already writes, with no new storage.

## Method

- **Corpus:** one synthetic fixture, "Nightjar Cache — Ops Memory" — a small (2,898 B) project memory/ops-notes file in the series' own house style (headed bullets, wikilinks, dates, versions, quotes, codespans, numbers), built to carry 30 structured tokens across 7 of the shipped `inventory()` classes (wikilinks 3 · dates 3 · versions 2 · links 2 · codespans 7 · quotes 4 · numbers 9; frontmatter 0) plus 6 hand-placed PROSE-ONLY facts spanning 6 taxonomy classes with no structured token to anchor them (negation+procedure [27] · decision+reason [20] · minority dissent attribution [48] · causal claim+warning [3] · evidence anchors [26] · a MUST-modality rule [29]). Synthetic and non-sensitive, but withheld from the public tree by the same discipline the adversarial corpus and the controlled-fidelity corpus both use (numbers + method here, not the fixture bytes); it lived in the session scratchpad only and was not persisted past this round — a re-run reconstructs an equivalent fixture from the spec above rather than expecting byte-identical files.
- **Chain (the experimental arm):** 4 SEQUENTIAL, DECORRELATED passes. Each pass is a fresh subagent (haiku tier) given ONLY the exact instruction *"compress/tidy this memory file, keep it useful"* plus the immediately-PRIOR pass's output — never the original, never any memory of earlier passes, never any mention this is part of a chain or a lab. Pass K+1 sees pass K's output only.
- **Control (the isolating arm):** ONE independent fresh subagent (haiku tier), given the TRUE ORIGINAL plus the instruction *"compress/tidy this memory file down to approximately 700 bytes total... in ONE pass"* — a single-shot compression targeting roughly the chain's final size, to isolate PASS-COUNT as the one varied condition (chain = 4 lossy hops; control = 1 hop, working from the real original throughout).
- **Measurement:** structured-token recall computed by the SHIPPED `inventory()` (fidelity-gate.mjs), never re-implemented, at two angles per pass — CUMULATIVE (vs the true original) and PAIRWISE (vs the immediately-prior pass only, the view a per-pass gate actually has). Prose-fact survival is a manual per-fact judgment (survived / weakened / lost) read directly off each pass's output — this is deliberately NOT mechanized: `fidelity-gate.mjs`'s own doc comment names semantic prose fidelity "the PAID layer... deliberately NOT this module's job," and this round does not change that boundary.
- **Detector verification:** the shipped `anchor-diff.computeCandidates()` (no filesystem, pure function) run directly against (original, each pass) with zero approved-drop texts — the exact shape of loss this class predicts (every hop here happened OUTSIDE any CW pipeline, so nothing is pre-approved).

## Results — structured-token recall

| Stage | bytes | cumulative recall (vs original) | pairwise recall (vs immediately-prior pass) |
|---|---|---|---|
| original | 2,898 | 100.0% (30/30) | — |
| pass 1 | 1,762 | 70.0% (21/30) | 70.0% (21/30) |
| pass 2 | 1,446 | 63.3% (19/30) | **91.3%** (21/23) |
| pass 3 | 977 | 40.0% (12/30) | 61.9% (13/21) |
| pass 4 | 704 | **33.3%** (10/30) | 78.6% (11/14) |
| control (1-shot, ~700 B target) | 948 | **43.3%** (13/30) | n/a (single hop from the original) |

**The contrast this class predicts, measured:** pass 2's pairwise recall (91.3%) and pass 4's pairwise recall (78.6%) both look locally acceptable — a per-pass gate watching only the latest hop would raise no alarm on either. Yet cumulative recall never stops sliding: 70.0% → 63.3% → 40.0% → 33.3%. The product of the four pairwise recalls (0.700 × 0.913 × 0.619 × 0.786 ≈ 31.1%) closely tracks the measured cumulative 33.3% — the decay is well-described as **geometric/multiplicative compounding across hops**; this N=1 run does not establish whether the true process is worse than multiplicative (super-linear), only that ordinary-looking per-hop retention compounds to a cumulative loss no single hop's own number would predict.

**By class, pass 4 (of 30 total):** wikilinks 0/3 · dates 2/3 · versions 1/2 · links 2/2 · codespans 0/7 · quotes 0/4 · numbers 5/9. Fragile: quotes (dead by pass 1: paraphrase drops the exact wording almost immediately), codespans (0/7 by pass 3: a "tidy" merge of `` `KEY` `` + value into `` `KEY=value` `` silently orphans the bare identifier token), wikilinks (0/3 by pass 3). Robust: link destinations (2/2 throughout, even reformatted from an autolink into `[url](url)`) and dates (2/3 — the one loss was a year dropped when "12-Jun-2026" became "12-Jun", not a date-specific fragility).

**Chain vs control — an honest, imperfectly-controlled comparison:** the control landed at 948 B (not the 704 B target), 34.7% MORE bytes than pass 4 — an EASIER compression task. Even so, the control kept more (43.3% vs 33.3% recall) — the chain lost more despite a harder size constraint working against it, which is the conservative direction (if anything this understates the gap a true equal-size comparison would show). The repo's own `controlled-fidelity-claude-code-2026-07-12.md` benchmark already proves single-shot naive compression is lossy at equal size on a REAL corpus (51.2% recall at a 54% cut); this round's finding is orthogonal and additive to that one — not "compression loses facts" (already shown) but "the SAME total compression done across several generations loses MORE than doing it once."

## Results — prose-fact survival (manual judgment, not code-verified)

| Fact (taxonomy class) | pass 1 | pass 2 | pass 3 | pass 4 | control |
|---|---|---|---|---|---|
| P1 negation + remediation procedure (27) | survived | survived | weakened | **weakened** (the procedure itself is gone, only "disabled" remains) | survived |
| P2 decision + reason (20) | survived | survived | survived | survived | survived |
| P3 minority dissent, attributed (48) | survived | survived | weakened (demoted) | **LOST** (survives only as unattributed trivia) | survived |
| P4 causal claim + retro warning (3) | survived | survived | weakened | weakened | weakened |
| P5 evidence anchors, 2 of 2 (26) | 2/2 | 2/2 | 2/2 | 1/2 | **0/2** |
| P6 MUST-modality (29) | survived | survived | survived | **LOST** (collapses to "backup first" — an unmarked suggestion) | survived |

Fully-intact count: pass 1 = 6/6 · pass 2 = 6/6 · pass 3 = 3/6 intact + 3 weakened · pass 4 = **1/6 intact** · control = 4/6 intact. P6 is the sharpest single illustration in this round: the MUST modality survives three full generations unchanged, then collapses exactly at generation 4 — a per-pass gate comparing only pass 3 vs pass 4 sees a small wording tidy-up, not a governance rule silently downgraded to a suggestion. P4 and P5 are honest counter-examples: both eroded to a similar degree under EITHER path (chain or one-shot control) once the size got tight, showing the compounding story is real but uneven — not every fact shows a clean chain-worse-than-control curve; the ones that do (P1, P3, P6) are the ones with no structured token backing them at all.

## Detector verification

`anchor-diff.computeCandidates()` run directly against (original, pass N) with zero approved-drop texts (every hop in this round happened outside any CoalWash pipeline, so nothing is pre-recorded):

| Stage | candidates flagged | matches (30 − cumulative-kept) |
|---|---|---|
| pass 1 | 9 | 9 ✓ |
| pass 2 | 11 | 11 ✓ |
| pass 3 | 18 | 18 ✓ |
| pass 4 | 20 | 20 ✓ |
| control | 17 | 17 ✓ |

Every count matches the independently-computed cumulative-loss count exactly, with the correct `{type, value}` pairs (verified by inspection — e.g. pass 4 flags `versions: v2.5.0-beta.2`, `wikilinks: Rollout-Playbook`, `wikilinks: Nightjar-Cache`, `wikilinks: Vendor-SLA`, all 7 codespans, all 4 quotes, 4 of 9 numbers). This exercises the module's PURE computation only (`computeCandidates`, no filesystem); the filesystem-driven wrapper (`anchorDiff`, which locates the oldest verified snapshot on disk and unions in every CW-recorded bin drop since) is separately covered by 6 hermetic tests in `scripts/lib/anchor-diff.test.mjs`, run against REAL `applyPlan`-produced snapshots and bin records — including the exact scenario this class targets: a token CW itself cut and recorded (excluded, not a candidate) vs a token dropped by a simulated out-of-band edit after that (still flagged).

## The one-paragraph finding

**Generational-compounding is real and detector-worthy, not merely a restatement of "compression loses facts."** On one synthetic fixture (N=1, K=4, haiku), a per-pass fidelity view stayed reassuring at every hop (61.9–91.3% pairwise recall, never triggering an obvious-loss signal) while cumulative recall against the true original collapsed to 33.3% — and a same-model single-shot compression of the true original, working under an EASIER size target, still out-recalled the 4-pass chain (43.3% vs 33.3%). The clearest single case is a MUST-modality governance rule that survived three full generations intact and silently collapsed to an unmarked suggestion exactly at generation 4 — invisible to anything that only ever compares consecutive generations. The shipped `anchor-diff` detector, built entirely from artifacts CoalWash's existing safety net already writes (verified snapshots + bin records, no new storage), reproduces the correct cumulative-loss candidate set exactly on this fixture and is separately proven end-to-end against real CoalWash artifacts.

## Limitations

- **N = 1 fixture, K = 4, one model tier (haiku).** No repeated trials, no cross-model comparison, no real (non-synthetic) corpus. This is a targeted validation round per the mini-lab factory, not a campaign — a future round could add repetition (as `controlled-fidelity-claude-code-2026-07-12.md` did for its single-shot arm) if the class needs a tighter confidence interval.
- **Control is not tightly size-banded.** 948 B vs the chain's 704 B (34.7% larger) — the comparison is directionally honest (the control had the EASIER task and still lost less) but not the strict equal-size control the repo's `controlled-fidelity-score.mjs` methodology uses. A v2 could re-run the control with a tighter byte-band target or an iterative size-matching retry.
- **"Super-linear" is not established.** The measured decay tracks a simple multiplicative model of the pairwise recalls closely (predicted 31.1% vs measured 33.3%); this round does not show the compounding is WORSE than the product of its parts, only that the product itself is invisible to a per-hop-only view — which is the property the detector targets regardless.
- **Prose-fact survival is a manual judgment**, not a code-verified measurement — by design (fidelity-gate.mjs explicitly scopes semantic prose fidelity out of the mechanical layer); a different rater could class P1/P4's "weakened" calls differently. The structured-token numbers are the code-verified half of this record; the prose table is qualitative color, reported honestly as such.
- **Fixture not persisted.** The corpus and pass outputs lived in session scratchpad only; this record carries the method and numbers, not the bytes, per the same corpus-withholding discipline the adversarial and controlled-fidelity corpora already use.

## Reproducing

Method is fully specified above (the exact instruction strings, K=4, haiku tier, the control's target). Detector: `CoalWash/scripts/lib/anchor-diff.mjs` (`computeCandidates` for a pure in-memory check like this round's; `anchorDiff` for the real filesystem/snapshot/bin-driven report) plus its hermetic suite `CoalWash/scripts/lib/anchor-diff.test.mjs` (`node --test scripts/lib/anchor-diff.test.mjs` from the CoalWash repo root). No CoalWash version bump shipped with this round — detector code only, per the mini-lab's own scope (one targeted round, never a campaign).
