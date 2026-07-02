# Output-quality benchmark — results

> Run per [README.md](README.md): each task run at **EACH tier directly** (no escalation — measures raw tier
> capability; CoalTipple routing then picks the cheapest *sufficient* tier). Scored against the objective gold
> ([`score.mjs`](score.mjs)) or a judge — never the main's eyeball.

## ON-vs-OFF benchmark — routing savings AND quality, paired (2026-07-03)

**Measured:** 2026-07-03 · CoalTipple **v1.0.23** (the routing policy under test) · engines: Haiku 4.5 / Sonnet 5 / Opus 4.8 · K=3 stochastic repeats per task×tier cell (fresh worker per rep), majority ≥2/3 = the cell verdict.
<!-- version-frozen: measured against v1.0.23's routing table; re-run to update. -->

> **TL;DR:** the same 4 tasks were run at every tier (36 runs), then the skill-ON and skill-OFF
> arms were derived from CoalTipple's routing table against two baselines. **Routing ON scored
> 4/4 task quality on BOTH baselines; OFF scored 3/4 on both — and failed a DIFFERENT task each.**
> From an Opus main, ON is also **~23% cheaper** (the mechanical task rides Haiku). From a Sonnet
> main, ON is cost-neutral (+3%) and fixes a real legal-liability translation error.

**Method.** 4 tasks × 3 tiers × K=3 = 36 fresh worker runs, no skill contract in any worker
prompt (the worker measures the TIER; ON/OFF is derived from the routing table afterwards —
routing = which tier runs which task). Tasks: `M1` mechanical CRUD scaffold (grade 1 —
delegate-down cell, structural scorer) · `S1` webhook HMAC verify (grade 5 sensitive — the
timing-side-channel + wrong-length-tag traps, script-scored) · `S2` legal clause → Thai
(grade 4 sensitive — the *"to the extent"* proportional carve-out trap, ONE fixed judge over
all 9 outputs) · `V1` marketing→technical rewrite (preserveVoice — 4-fact checklist,
script-scored). Blind: workers ran with a no-tools clause (one early S1 batch that could read
the gold was invalidated and re-run — contamination QC).

**Raw quality per cell (PASS reps /3):**

| Task | Haiku 4.5 | Sonnet 5 | Opus 4.8 |
|---|---|---|---|
| M1 mechanical scaffold | **3/3** | **3/3** | 1/3 † |
| S1 crypto (sensitive) | **0/3** ‡ | 3/3 | 3/3 |
| S2 legal→Thai (sensitive) | 2/3 | **1/3** ¶ | **3/3** |
| V1 voice/facts | 3/3 | 2/3 | 3/3 |

† Opus twice answered the mechanical spec with a DRY factory (computed names, shared JSDoc) —
better engineering, but the spec's letter said 15 functions each with a JSDoc: an
instruction-compliance miss, not a capability one. The cheap tier followed the boring spec
perfectly every rep. ‡ All three Haiku runs missed the length guard — a wrong-length tag makes
`timingSafeEqual` throw instead of returning false (the planted trap). ¶ Sonnet collapsed the
proportional *"to the extent"* into a blanket carve-out (`เว้นแต่ในกรณีที่`) in 2/3 reps —
reproducing the 2026-06-22 finding under a new model version (Sonnet 5 vs 4.6); Opus held
`เว้นแต่ในขอบเขตที่` in 3/3.

**The derived arms** (majority-verdict quality · cost = mean tokens × representative output
rates $5/$15/$25 per MTok, fetched 2026-06-19/30):

| Arm | Routing | Quality | Cost | Failing task |
|---|---|---|---|---|
| Opus-main **OFF** | opus does all 4 | 3/4 | $3.59 | M1 (spec compliance) |
| Opus-main **ON** | M1→haiku, rest opus | **4/4** | **$2.78 (−23%)** | none |
| Sonnet-main **OFF** | sonnet does all 4 | 3/4 | $2.42 | S2 (legal liability) |
| Sonnet-main **ON** | M1→haiku, S1/S2→opus, V1 stays | **4/4** | $2.49 (+3%) | none |

**Findings.**
1. **Both OFF arms fail — at different tasks.** An expensive main fails the boring spec
   (over-engineering past the letter); a mid main fails the sensitive nuance. Routing closes
   both: delegate-down puts the letter-follower on the boring work, escalate-up puts the
   nuance-holder on the sensitive work.
2. **Savings and quality are not a trade-off here.** From Opus, ON is cheaper AND better.
   From Sonnet, ON converts ~2% extra spend into removing a material liability error.
3. **The sensitive gate is re-confirmed on the new lineup**: Haiku 0/3 on crypto, Sonnet 1/3
   on the legal nuance — never-delegate-sensitive-down survives the model refresh.

**Honest scope.** n=3 per cell (majority verdicts; a 2/3 cell is not a rate). The S2 judge is
one fixed Claude judge (self-family bias risk; the objective cells avoid it). Cost uses
`subagent_tokens` × output-rate as a representative price, not metered billing. Two infra
null-runs (empty/garbled returns) were respawned and noted; one scorer gold bug (a static
throw-count that punished correctly-DRY validation) was fixed mid-run and ALL cells re-scored
under the fixed gold.

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
