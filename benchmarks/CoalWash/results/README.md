# CoalWash benchmark — dated records

The detailed layer for ALL three measurements (consecutive-run ceiling · infinity-loop fact-loss · sawtooth-vs-bloat). One record per run: `[topic]-[platform]-YYYY-MM-DD.md` (full per-round tables + analysis) plus its raw machine files (`.json` from `score.mjs --json`). Every record names the date, the CoalWash version tested, and the model tier.

Records: [`ceiling-infinity-loop-claude-code-2026-07-09.md`](ceiling-infinity-loop-claude-code-2026-07-09.md) (Measurements 1 + 2, fable tier). Measurement 3 (sawtooth) has no record yet.

A separate **controlled equal-size fidelity** measurement (v1 — hold output size constant across arms, measure what each LOST) lives in [`controlled-fidelity-claude-code-2026-07-12.md`](controlled-fidelity-claude-code-2026-07-12.md), scored by [`../controlled-fidelity-score.mjs`](../controlled-fidelity-score.mjs).

A **[MINI-LAB] loss-class validation** (targeted one-round detector proof, not a benchmark axis) for loss class #54 (generational-compounding / iterative-compression drift) lives in [`generational-compounding-claude-code-2026-07-15.md`](generational-compounding-claude-code-2026-07-15.md) — scored against the shipped `inventory()` engine and the new detector `computeCandidates()`/`anchorDiff()` (`CoalWash/scripts/lib/anchor-diff.mjs`, a separate repo alongside this one).

A **loss-class catalog addition** record — taxonomy entries only (damage mechanism + precondition + executable trap per class), **not scored runs** — for classes #55–#58 (multi-store propagation gap · verify-scope/delete-scope mismatch · filesystem-semantics-assumption break · deletion-unaware time-travel restore) lives in [`loss-class-catalog-2026-07-16.md`](loss-class-catalog-2026-07-16.md).

A **pre-ship destruction-ladder** record — a blind adversarial IC-pin campaign on the class-A ULTRA reduce prototype (`explode`/`detonate`), IN PROGRESS, WHAT-not-HOW (method class + honest state only) — lives in [`ultra-destruction-ladder-claude-code-2026-07-23.md`](ultra-destruction-ladder-claude-code-2026-07-23.md).
