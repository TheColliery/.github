# CoalWash Benchmark — Results Digest

<!-- version-frozen: fill the Measured line + headline table from an actual run record in results/; never edit figures without a matching dated record. -->
**Measured:** — *(first run pending)* · CoalWash version: — · engines: —

> **TL;DR:** first run pending. The headline below is the **sawtooth-vs-bloat saving** (Measurement 3 in the [protocol](README.md)): cumulative always-loaded token cost over N sessions, clean-at-threshold vs let-it-bloat, Δ% net of CoalWash's own run costs.

| Arm | Cumulative always-loaded cost (N sessions, ~est tok) | Δ% vs bloat |
|---|---|---|
| A — sawtooth (CoalWash at its band gauge) | — | — |
| B — bloat (no CoalWash) | — | (baseline) |

Detailed dated records — including the consecutive-run ceiling and the per-model infinity-loop fact-loss measurements — live in [`results/`](results/).

**Honest scope:** fixture stores, scripted growth, small N; figures are model- and version-bound (each record names both). The saving claim is the measured Δ% on these fixtures — not a universal promise.
