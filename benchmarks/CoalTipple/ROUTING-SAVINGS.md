# CoalTipple eval — routing savings (main does it itself vs main delegates to a cheap worker)

> **What this measures.** CoalTipple's headline move is **delegate-down**: route a big *mechanical* task to a cheap tier instead of grinding it on the expensive main. This benchmark runs the **same** task two ways and prices it:
> - **SELF** — the expensive main does it itself (measured: an Opus worker).
> - **DELEGATE** — the main hands it to a cheap new worker + verifies the result (measured: a Haiku worker + an Opus merge-check).
>
> **The honest scope.** CoalTipple is advise-only — it cannot meter tokens itself — so these are **controlled-run** measurements (`subagent_tokens` reported per spawn) × the **published per-token rates**, dated. The saving is real **for big mechanical work**; it is *not* a blanket "X% off everything" (see the floor + the hard gate below).

## Inputs (measured + source-grounded, 2026-06-19)

**Task (identical both arms):** scaffold a TypeScript REST API — 3 resources × 4 CRUD Express handlers = **12 handlers**, each typed + validated + try/catch + JSDoc. Pure mechanical bulk.

**Measured token totals** (`subagent_tokens`, this machine, 2026-06-19):
| arm | model | tokens |
|---|---|---|
| SELF | Opus 4.8 | **71,150** |
| DELEGATE | Haiku 4.5 | **51,490** (also terser for the same deliverable) |

**Published rates** ([platform.claude.com pricing](https://platform.claude.com/docs/en/docs/about-claude/pricing), fetched 2026-06-19 — ⚠️ version-sensitive, re-fetch before re-citing):
| model | input $/MTok | output $/MTok |
|---|---|---|
| Opus 4.8 | $5 | $25 |
| Haiku 4.5 | $1 | $5 |

→ **Opus is exactly 5× Haiku per token** (both input and output). Routing the bulk down to Haiku pays **1/5** the rate.

## The cost

Code-gen is output-dominated, so this prices the measured totals at each model's **output** rate (the dominant term; the exact input/output split is not instrumented — CT is advise-only — so treat these as representative, not to-the-cent):

- **SELF** = 71,150 tok × $25/MTok ≈ **$1.78**
- **DELEGATE** = 51,490 tok × $5/MTok (Haiku worker) + ~8,000 tok × $25/MTok (Opus merge-check) ≈ $0.26 + $0.20 ≈ **$0.46**

**≈ 74% cheaper** to delegate this task down — driven by the 5× tier ratio, helped by Haiku's terser output. (Counting the real SELF as *inline on the main* — no spawn overhead — nudges it slightly cheaper, ~70%; either way the tier ratio dominates.)

## The honest caveats (why this is not "always cheaper")

1. **The floor / crossover.** A spawn carries a fixed overhead (~35–58k tokens, measured in prior dogfood). For a **small** task — say a one-line helper — that overhead **exceeds** the saving, so delegating *loses*. This is exactly why CoalTipple has `delegateMinLines`: below the floor it **keeps the task inline** (no loss), above it delegates (the saving above). The benchmark's big task clears the floor; a small one would not.
2. **The sensitive hard gate.** Security / crypto / auth / payments / migrations are **never** delegated down, whatever the saving — a cheaper tier's plausible-but-wrong output (a timing leak, a bad migration) passes tests and ships the bug. CT escalates these UP or keeps them on a capable main. Savings never override correctness on error-not-allowed work.
3. **Voice.** A user-facing deliverable (a translation, a write-up) is not delegated to a cheaper model even when bulky — reviewing it to protect voice costs about as much as redoing it.

## Honest headline

> *On a big mechanical task (a 12-handler API scaffold), routing the work down from Opus to Haiku cut cost ~**70–75%** (Opus is 5× Haiku/token; Haiku also ran terser, 51k vs 71k tokens). The saving holds only **above** the delegate floor — a small task costs more to hand off than to do inline, which is why CoalTipple keeps small/sensitive work on the main. Measured + priced 2026-06-19; rates are version-sensitive.*
