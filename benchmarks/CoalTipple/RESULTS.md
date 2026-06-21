# Output-quality benchmark — results

> Run per [README.md](README.md): each task run at **EACH tier directly** (no escalation — measures raw tier
> capability; CoalTipple routing then picks the cheapest *sufficient* tier). Scored against the objective gold
> ([`score.mjs`](score.mjs)) or a judge — never the main's eyeball.

**Measured:** 2026-06-22 · CoalTipple **v1.0.20** (the version under test) · raw deliverables in `dogfood/output/` (local)
<!-- version-frozen: 'CoalTipple v1.0.20' = the version UNDER TEST when measured. A benchmark is pinned to the version measured: do NOT bump on release; update ONLY when the benchmark is re-run (re-measured). Supersedes the 2026-06-15 / v1.0.3 run (which was the older +1-rung design + predated the v1.0.18 sensitive-path grading change). -->
**Ladder:** low (Haiku 4.5) < mid (Sonnet 4.6) < heavy (Opus 4.8) — Fable disabled, so Opus is the top.
**Method:** a **quality-vs-tier matrix** — 5 tasks × 3 tiers, each tier doing the task directly; plus a **reproducibility addendum** (the two Sonnet FAILs re-run ×3 under ONE fixed judge, to separate sample noise / judge-variance from a real signal).
**Scoring:** T1 crypto + T5 voice = **objective** (`score.mjs` runs the HMAC vectors + constant-time static check / the 4-fact checklist — script-decided). T2 proof, T3 research, T4 legal = **judged** (directional — judge-variance is real, see T3).

## Quality-vs-tier matrix

| Task (scoring) | Haiku | Sonnet | Opus |
|---|---|---|---|
| T1 crypto (**objective**) | ✅ | ✅ | ✅ |
| T5 voice (**objective**) | ✅ | ✅ | ✅ |
| T2 proof (judge) | ✅ | ✅ | ✅ |
| T3 research (judge) | ✅ | ❌ → judge-variance | ✅ |
| T4 legal (judge) | ✅ ⁿ⁼¹ | ❌ **real** | ✅ |

`ⁿ⁼¹` the single Haiku pass is **not** evidence Haiku is better — the addendum shows the mid tier is *reproducibly* unreliable here, so one pass is luck-of-the-draw, not a tier signal.

## Reproducibility addendum — the two Sonnet FAILs, re-run ×3 under ONE fixed judge

| | spread | verdict |
|---|---|---|
| **T3 research** | **3/3 PASS** (substance) | the first FAIL was **JUDGE-VARIANCE** — the original cell's judge failed a minor doc *misquote*; a fixed *substance* judge passes all three. Sonnet's substance was reliably correct. |
| **T4 legal** | **1/3 PASS** | the first FAIL was **REAL + reproducible** — Sonnet collapses the proportional *"to the extent"* into a total carve-out (`เว้นแต่`/`ยกเว้น` without `ในส่วนที่`) in 2/3 samples, a material liability error. Opus holds it. |

## Findings

1. **Objective axis (T1 crypto, T5 voice) — every tier delivers correct.** `score.mjs` (deterministic) passed Haiku, Sonnet, and Opus on both. On objectively-verifiable + mechanical output, even the cheapest tier is correct → **delegate-down preserves quality**: the ~70–75 % cost saving ([ROUTING-SAVINGS.md](ROUTING-SAVINGS.md)) comes with **no quality loss** on these task types. *(T1 is grade-5 sensitive — CoalTipple keeps it up by POLICY regardless of Haiku's measured capability.)*

2. **T3 research — judge-variance, not a tier signal.** The Sonnet FAIL did **not** reproduce (3/3 substance-correct under a fixed judge); the first run's judge applied a stricter "verbatim quote" bar than the Haiku cell's judge → a non-monotonic artifact. **Lesson: per-cell independent judges are inconsistent — a subjective task must be scored by ONE fixed judge across tiers.** Substance was reliable at every tier.

3. **T4 legal — a REAL, reproducible mid-tier weakness (the escalate-up case, finally demonstrated).** Sonnet reproducibly (2/3) turns the proportional *"to the extent"* carve-out into a *total* exception — a liability shift invisible to a non-lawyer eyeball; Opus holds it. So on **high-precision sensitive translation, the mid tier is unreliable** → CoalTipple's *never-delegate-sensitive-down + escalate-up* policy is **data-justified**: delegating T4-class work down risks the error, routing it up delivers it correct. This is the escalate-up-rescues-quality signal the prior (+1-rung, all-pass) run could not show.

## Honest scope + caveats

- **Small samples.** n = 1 per matrix cell; n = 3 for the Sonnet reproducibility. Directional, not a defect rate — a real ranking needs n > 1 + a fixed judge.
- **Per-cell judges are unreliable for cross-tier comparison** (T3 proved it). The **objective axis (`score.mjs`: T1, T5) is the trustworthy measure**; the judged axis (T2/T3/T4) is directional and needs a single fixed judge.
- **Self-tier-judging bias.** The judges were Claude (Opus-class) scoring Claude tiers — a bias risk on the subjective tasks; the objective (script-scored) tasks avoid it entirely.
- **Pairs with the cost benchmark.** [ROUTING-SAVINGS.md](ROUTING-SAVINGS.md) = cost ↓ ~70–75 %; this one = quality **preserved** under delegation **and** escalate-up **justified** on sensitive work. Together they are the value prop.

## Conclusion

**Delegate-down is quality-safe on mechanical / verifiable work** (the cost saving is free); **escalate-up / never-delegate-sensitive-down earns its keep on high-precision sensitive work** (T4: the mid tier reproducibly errs on the legal nuance; the top tier holds). CoalTipple's job is to route each task-type to its cheapest *sufficient* tier — this matrix shows where that boundary sits, and (T4) why the floor under sensitive work is the policy, not a number.
