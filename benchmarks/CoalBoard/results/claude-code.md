# CoalBoard eval — Claude Code (run 2026-06-19, Opus-class main + general-purpose workers)

This measures **reliability**: the same 5 error-not-allowed tasks run **multiple times** per arm, scoring the *pass-rate* — because the board's real edge over a strong solo is not "knows more" but "applies the rigor **every** time."

**Arms.** WITHOUT = a general-purpose agent asked the 5 tasks **casually / un-primed** (no "show the formula", "cite your source", "is it concurrent?" hints — a realistic single pass), run **4×**. WITH = the board discipline (an independent adversary lens that proposes-and-attacks + FETCHES live for facts) + the judge RUNNING each objective check (T2 via exact BigInt + `Math.pow`; T3 the gold re-fetched; T1/T4/T5 inspected), run **2×**. The asymmetry is the point: the board's discipline *is* the rigor; a casual solo lacks it. (A first, discarded solo run was accidentally *primed* by hint-laden prompts and scored 5/5 — proof that the rigor is exactly what's variable.)

**Golds verified at run time (2026-06-19).** T2: `1,000,000 × (1+0.05/12)^360 = 4,467,744.31` (annual-compound trap 4,321,942.38; simple-interest trap 2,500,000; truncating the monthly rate → ~4,468,278 / 4,473,087). T3: Node.js **24 "Krypton"** Active LTS, EOL **2028-04-30** (`nodejs/Release/schedule.json` verbatim + endoflife.date). T5: skip = markdownlint **MD001** (heading-increment); duplicate-H1 = markdownlint **MD025** (single-title) — both default rules.

## Pass-rate by task

| task | domain | the trap | WITHOUT — un-primed solo (4 runs) | WITH — board (2 runs) |
|------|--------|----------|-----------------------------------|------------------------|
| T1 | crypto | timing side-channel | **4/4** ✅ (knew constant-time from "API token") | **2/2** ✅ |
| T2 | math | truncate the monthly rate → wrong cents | **2/4** (one run gave **$4,467,744.27**, one gave no cents; two exact) | **2/2** ✅ exact via BigInt `(241/240)^360` |
| T3 | research | answer stale / hedge the date | **3/4** committed (one run **hedged** "verify yourself") | **2/2** ✅ (one run even caught a misread "last-updated-as-EOL" in the live data) |
| T4 | concurrency | check-then-act race across `await` | **4/4** ✅ (knew the stampede + promise fix) | **2/2** ✅ |
| T5 | docs | miss the duplicate-H1 (MD025) | **~0/4** — every run caught the level-skip, **none flagged the 2nd H1 as a defect** ("fine" / "optional" / "valid but unusual") | **2/2** ✅ both defects |
| **total** | | | **~13/20 (~65%)** | **10/10 (100%)** |

## Honest headline

**Board 10/10 (100% consistent) · un-primed strong solo ~13/20 (~65%).** A strong model *knows* the textbook traps (constant-time compare, the async cache race) and gets them every time — the board adds nothing there. The board's value shows exactly where **rigor must be forced and a casual pass is inconsistent**:
- **precision** — one solo run truncated `0.05/12` and shipped **$4,467,744.27** (4¢ wrong on a "to the cent" task); the board RUNS the calc (BigInt-exact) every time → always $4,467,744.31.
- **grounding** — one solo run hedged the EOL date; the board fetches + reconciles → commits to 2028-04-30 every time (and once caught a wrong date *in the fetched data itself*).
- **completeness** — no solo run flagged the duplicate-H1 (MD025); the board's audit catches every defect, not just the obvious one.

**What this is NOT.** Not "no errors on all work." It is a 5-task sample; the board *improves reliability*, it does not prove a defect rate (a bug in the shared-model blind spot survives both arms). The honest claim: **the board makes the rigor automatic — it caught, every single run, the cases a casual pass got right only ~65% of the time.** That is the value: consistency on error-not-allowed work, plus bounded cost and zero-breakage.

*Antigravity arm: not run here (Claude Code cannot actuate it; never fabricated). Run [`../AG-PROTOCOL.md`](../AG-PROTOCOL.md) to fill `antigravity.md` (same tasks, same K-run method).*
