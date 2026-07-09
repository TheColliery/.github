# CoalWash Benchmark — Results Digest

<!-- version-frozen: fill the Measured line + headline table from an actual run record in results/; never edit figures without a matching dated record. -->
**Measured:** 2026-07-09 · CoalWash **v0.1.0-beta.5** · engine: claude-fable-5 washer (outsider reviewers claude-sonnet-5) — Measurements 1 + 2 only; Measurement 3 (sawtooth) not yet run.

> **TL;DR:** first dated run covers the **consecutive-run ceiling** and **infinity-loop fact-loss** (Measurements 1 + 2): ceiling **≥ 2** (tested to round 2; no loss observed — never extrapolated) · post-fat-exhaustion rounds **100% no-op, 0% fact-loss/round** (the structural target met) · fidelity gate PASS on every round, 0 facts lost · the post-exhaustion outsider flags turned muscle-hungry exactly as the wedge predicts, and adjudication rejecting them is what held loss at 0%. **Arm 2 (real-store clone, 201 sealed probes, blind answerers + an out-of-frame full diff): fact-survival 199/201 → 201/201 after the catch layers; washed recall 83.6% ≥ pristine 81.1%; the three catch layers found fully DISJOINT loss classes — and the run's findings shipped the same day as v0.1.0-beta.6 (3 new gate classes + 5 incident-ported apply guards).** Full per-round tables: [the dated record](results/ceiling-infinity-loop-claude-code-2026-07-09.md). The headline **sawtooth-vs-bloat saving** (Measurement 3 in the [protocol](README.md)) is still unmeasured — protocol ready, table below fills from its first dated record.

| Arm | Cumulative always-loaded cost (N sessions, ~est tok) | Δ% vs bloat |
|---|---|---|
| A — sawtooth (CoalWash at its band gauge) | — *(measurement pending — protocol ready)* | — |
| B — bloat (no CoalWash) | — | (baseline) |

Detailed dated records — including the consecutive-run ceiling and the per-model infinity-loop fact-loss measurements — live in [`results/`](results/).

**Honest scope:** fixture stores, scripted growth, small N; single model tier measured so far (fable — multi-tier pending); figures are model- and version-bound (each record names both). The saving claim will be the measured Δ% on these fixtures — not a universal promise.
