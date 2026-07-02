# CoalBoard solo-vs-board — Claude Code result (2026-07-03)

**Platform:** Claude Code · **Engine:** Opus 4.8 (both arms — solo workers AND board lenses/verify) · **Fable-budget note:** run on Opus to conserve the operator's Fable quota; the finding is about the board mechanism, engine-independent.
**Method:** the 5 `tasks.md` tasks. SOLO = one Opus worker, one pass, no board, no tools (K=2 on the 4 reasoning tasks — stable — and K=3 on T3). BOARD = one Opus worker under full board rigor (generate → adversary-refute vs the known trap → RUN the objective check → verified answer), tools allowed for the ground-truth step.

## Result

| Task | Trap | Solo (Opus) | Board (Opus) | Board caught what solo missed? |
|---|---|---|---|---|
| T1 crypto | timing side-channel | **PASS** 2/2 (`timingSafeEqual`+guard) | **PASS** (static-gate verified) | no — solo already safe |
| T2 compound | wrong compounding basis | **PASS** 1/1 (4,467,744.31, n=12) | **PASS** (2 methods agree) | no |
| T3 stale-fact | training-stale, no source | **MISS** 0/3 (committed Node 22, stale) | **PASS** (fetched → Node 24, EOL 2028-04-30) | **YES — the decisive one** |
| T4 race | check-then-act gap | **PASS** 2/2 (promise-cache fix) | **PASS** (traced interleaving) | no |
| T5 heading | skim-miss a defect | **PASS** 2/2 (both defects) | **PASS** (adversary walk) | no |

> **Headline:** *Solo 4/5 · Board 5/5 — on Opus 4.8, a solo pass already catches the four **reasoning** traps (crypto timing-leak, compounding basis, the async race, the heading defects). The board's irreducible edge is **T3**, the version-sensitive **fact**, where only RUN-the-check (a live fetch) beats training-stale memory — the board fetched Node 24 / EOL 2028-04-30 and caught its own "one-LTS-cycle-stale" recall, while the solo pass committed a stale Node 22 in all 3 runs. Dated 2026-07-03; a 5-task sample, not a guarantee.*

## The honest finding (why this differs from the older ~13/20 solo run)

The earlier result (solo ~65%, board 10/10) was on a weaker/mixed solo model. On **Opus 4.8**, the solo pass climbs to **4/5** — it now catches the reasoning traps unaided. So the board's margin **narrows as the base model strengthens**, with one exception that does NOT narrow:

- **On reasoning traps (T1/T2/T4/T5)** — where the correct answer is derivable from what the model already knows — a strong solo model catches them, and the board's lens debate is confirmatory, not decisive. (Consistent with the correlated-blind-spot ceiling: same-model lenses share the solo model's competence *and* its gaps.)
- **On T3, a fact that lives OUTSIDE the model** — no amount of reasoning fixes a training-cutoff gap; only the board's **RUN-the-check** step (a live fetch) does. Notably even a strong Opus solo *hedged* toward the right answer ("likely Node 24, verify live") but still **committed** the stale primary in every run — honest about its uncertainty, yet wrong on the deliverable. The board committed the verified fact.

**So the board's value, precisely stated:** board = solo **+ ground-truth execution**. Its edge is largest exactly where the answer is external to the model (live facts, run tests, computed numbers) and smallest on pure reasoning a strong model already handles. This is the same frame as the skill's honest ceiling — the board is not an omniscient LLM, it is a harness that RUNS the check.

## Cross-vendor arm (Antigravity / Gemini 3.5 Flash) — the mirror image

Run separately ([`results/antigravity-onoff-2026-07-03.md`](antigravity-onoff-2026-07-03.md);
verified against the same golds — the T3 fact (Node 24 / EOL 2028-04-30) and T2 (`$4,467,744.31`)
match the authoritative sources on independent check, no fabrication). On the **weak** solo model
the board's value **inverts** the Opus finding:

| Base model | Solo | Board | Board's added value |
|---|---|---|---|
| Opus 4.8 (strong) | 4/5 | 5/5 | **small** — only T3 (the external fact) |
| Gemini 3.5 Flash (weak) | ~4/15 (27%) | 5/5 | **large** — all four reasoning traps + T3 |

**The unified finding:** the board's margin scales **inversely with solo-model strength**. A strong
solo catches the reasoning traps unaided (the board only confirms), so its one irreducible win is the
external fact (T3, run-the-check). A weak solo misses the reasoning traps too, so the board's
lens-debate recovers those as well (27% → 100%). At **both** ends, the single task the board wins
regardless of base model is **T3, the version-sensitive fact** — no model, strong or weak, reasons
its way past a training-cutoff gap; only RUN-the-check does. That is the board's engine-independent
core, and it is the same honest ceiling the skill states: the board is a harness that runs the
check, not an omniscient LLM.

## Honest scope

n small (K=1–3, majority verdicts — a 0/3 or 2/2 is a direction, not a rate). Both arms are Opus (same-family; the correlated-blind-spot limit applies to the board's lenses too — its reasoning-trap coverage cannot exceed what an Opus lens can see). The cross-vendor arm (Antigravity / Gemini 3.5 Flash, where the solo model is weaker and the board's reasoning-lens value is expected to be larger) is run separately per `AG-RUN-PROMPT-ONOFF.md` → `results/antigravity-onoff-2026-07-03.md`. The T3 gold is time-varying (re-fetch to re-score): Node 24 Active LTS, EOL 2028-04-30, per nodejs.org/endoflife.date on 2026-07-03.
