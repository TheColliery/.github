# CoalWash Benchmark — Results Digest

<!-- version-frozen: fill the Measured line + headline table from an actual run record in results/; never edit figures without a matching dated record. -->
**Measured:** 2026-07-09 → 2026-07-11 · CoalWash **v0.1.0-beta.12/13 pipeline** (ceiling/infinity-loop arm at beta.5) · engine: Claude Code subagents, CoalTipple-routed (wear chain sonnet-primary; ceiling/infinity-loop arm fable) — Measurements 1 + 2 covered; Measurement 3 (sawtooth) not yet run.

> **TL;DR:** the durability campaign is **CLOSED — 53/53 loss-taxonomy classes covered** (26 forced-wear-measured, 27 adversarial-verified; the class-closing fix round ended empty = the stop condition). Headline scorecards: wear arm (Modloader clone, 7 rounds) retired on 2-dry + varied-angle, every detected loss **restored**, keeps deflected 8+ re-attacks 100% · Thai arm (5 real stores) retired clean, final sweep **33/33 tripwires**, Thai-script corruption 0 · adversarial arm **0/33 traps leaked** · workability arm **10/10 parity** (washed store = pristine store for a working agent). The structural takeaway: **the safety floor is CODE-held (gates/snapshot/keeps); model quality moved yield (fat recall), never the loss floor.** Full summary: [the campaign-close record](results/campaign-close-claude-code-2026-07-11.md); early-round method sample: [the wear record](results/wear-campaign-claude-code-2026-07-10.md). The trap corpus + per-trap identities are **withheld by design** (publishing them would let a model be tuned to pass the gate, not be safe). The headline **sawtooth-vs-bloat saving** (Measurement 3) is still unmeasured — protocol ready, table below fills from its first dated record.

| Arm | Cumulative always-loaded cost (N sessions, ~est tok) | Δ% vs bloat |
|---|---|---|
| A — sawtooth (CoalWash at its band gauge) | — *(measurement pending — protocol ready)* | — |
| B — bloat (no CoalWash) | — | (baseline) |

### Controlled equal-size fidelity (v1 · 2026-07-12)

A complementary controlled experiment — **hold output SIZE constant, measure what each arm LOST** — on one real dogfood corpus (the pre-re-wash `MEMORY.md`, 150,115 B → ~68,924 B, a ~54% cut of always-loaded bytes). Fidelity is recomputed independently with the shipped inventory engine — the tool's own gate is never cited as its own proof.

| Arm (equal ~54% saving) | token-recall | tokens lost (of 448) | latent-recoverable |
|---|---|---|---|
| unchecked (untouched) | 100.00% | 0 | 100% |
| naive-compress (fair LLM, no gate, no archive; K=4) | 51.2% (49.6–54.5) | 218.8 (204–226) | 0% of removed |
| **CoalWash** (fidelity-gated + externalize) | **100.00%** | **0** | **100%** (190/190 → archive) |

**At equal saving, opposite fidelity:** CoalWash lost **0 of 448** structured tokens and kept **100%** of what it removed from the live file recoverable in the on-demand archive; the *fair* naive compress lost a mean **218.8** tokens (K=4, range 204–226) at the same size and **0%** of what it removed is recoverable. The differentiator is **SAFE saving, not a smaller file**. Full record + method + limitations: [controlled-fidelity (v1)](results/controlled-fidelity-claude-code-2026-07-12.md). (The time-flip / regret-timeline arm is deferred to v2.)

### Generational-compounding mini-lab (loss class #54 · 2026-07-15)

A targeted, one-round validation (not a full benchmark axis) for a newly-catalogued loss class: repeated lossy consolidation passes diffing against each PRIOR pass's output, never the original, compound losses invisibly to a per-pass-only fidelity check. On one synthetic fixture (K=4 sequential passes, haiku), pairwise (hop-to-hop) recall stayed a reassuring 62–91% at every step while cumulative recall against the true original collapsed to **33.3%** — a same-size-class single-shot compression of the original, working under an easier size target, still out-recalled the 4-pass chain (43.3%). The shipped `anchor-diff` detector (built from CoalWash's existing snapshot + bin artifacts, no new storage) reproduces the exact cumulative-loss candidate set on this fixture. Full method, tables, and limitations: [generational-compounding (2026-07-15)](results/generational-compounding-claude-code-2026-07-15.md).

### ULTRA reduce-engine destruction ladder (pre-ship IC-pin campaign · IN PROGRESS · as of 2026-07-23)

A blind, black-box adversarial red-team ladder (setter≠solver, loop-fix-to-dry, JESD-ported accelerated-stress + rule-of-three) on the UNCOMMITTED class-A ULTRA **prototype** (`explode.mjs` reduce engine + `detonate.mjs` input-verify) — pre-ship hardening per the blueprint's own gate (§19.6: the engine must not be claimed safe until the full destruction ladder), NOT a shipped-engine result. As of 2026-07-23, most invariant legs are dry over repeated blind waves; one — the engine's cost bound — is still being tightened, and every real bug caught lived at the stateful "pipe-switches" (the wave/resume/budget machinery streaming requires), never the pure byte-in→byte-out transform — caught before the engine ships, which is the ladder's job. Granular detail is withheld by the same discipline as the trap corpus above; honest state + method class: [ultra-destruction-ladder (2026-07-23)](results/ultra-destruction-ladder-claude-code-2026-07-23.md).

Detailed dated records — including the consecutive-run ceiling and the per-model infinity-loop fact-loss measurements — live in [`results/`](results/).

**Honest scope:** fixture stores, scripted growth, small N; single model tier measured so far (fable — multi-tier pending); figures are model- and version-bound (each record names both). The saving claim will be the measured Δ% on these fixtures — not a universal promise.
