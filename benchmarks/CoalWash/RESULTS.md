# CoalWash Benchmark — Results Digest

<!-- version-frozen: fill the Measured line + headline table from an actual run record in results/; never edit figures without a matching dated record. -->
**Measured:** 2026-07-09 → 2026-07-11 · CoalWash **v0.1.0-beta.12/13 pipeline** (ceiling/infinity-loop arm at beta.5) · engine: Claude Code subagents, CoalTipple-routed (wear chain sonnet-primary; ceiling/infinity-loop arm fable) — Measurements 1 + 2 covered; Measurement 3 (sawtooth) not yet run.

> **TL;DR:** the durability campaign is **CLOSED — 53/53 loss-taxonomy classes covered** (26 forced-wear-measured, 27 adversarial-verified; the class-closing fix round ended empty = the stop condition). Headline scorecards: wear arm (Modloader clone, 7 rounds) retired on 2-dry + varied-angle, every detected loss **restored**, keeps deflected 8+ re-attacks 100% · Thai arm (5 real stores) retired clean, final sweep **33/33 tripwires**, Thai-script corruption 0 · adversarial arm **0/33 traps leaked** · workability arm **10/10 parity** (washed store = pristine store for a working agent). The structural takeaway: **the safety floor is CODE-held (gates/snapshot/keeps); model quality moved yield (fat recall), never the loss floor.** Full summary: [the campaign-close record](results/campaign-close-claude-code-2026-07-11.md); early-round method sample: [the wear record](results/wear-campaign-claude-code-2026-07-10.md). The trap corpus + per-trap identities are **withheld by design** (publishing them would let a model be tuned to pass the gate, not be safe). The headline **sawtooth-vs-bloat saving** (Measurement 3) is still unmeasured — protocol ready, table below fills from its first dated record.

| Arm | Cumulative always-loaded cost (N sessions, ~est tok) | Δ% vs bloat |
|---|---|---|
| A — sawtooth (CoalWash at its band gauge) | — *(measurement pending — protocol ready)* | — |
| B — bloat (no CoalWash) | — | (baseline) |

Detailed dated records — including the consecutive-run ceiling and the per-model infinity-loop fact-loss measurements — live in [`results/`](results/).

**Honest scope:** fixture stores, scripted growth, small N; single model tier measured so far (fable — multi-tier pending); figures are model- and version-bound (each record names both). The saving claim will be the measured Δ% on these fixtures — not a universal promise.
