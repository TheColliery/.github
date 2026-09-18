# Governance pile—results

**Measured:** 2026-07-27 · **Platform:** Claude Code · **Engine:** claude-opus-5 · **Target:** the always-injected governance pile, pinned by byte snapshot (it is not a released artifact)
**Detail + raw:** [`results/2026-07-27-governance-pile-claude-code.md`](results/2026-07-27-governance-pile-claude-code.md) · **Pre-registered** before any adherence data: [`PREREGISTRATION.md`](PREREGISTRATION.md)

Tests Anthropic's *Steering Claude Code* (2026-06-18) claim—appending the system prompt has diminishing returns for adherence, worse when instructions contradict; keep CLAUDE.md under 200 lines—against **our** pile.

## TL;DR

| Claim | Verdict |
|---|---|
| **"Keep CLAUDE.md under 200 lines"** | **FALSE unit for us.** `AGENTS.md` passes at **188 lines** while carrying **7.0×** the content of a compliant 200-line file (324.9 chars/line vs 43.6 conventional). Gate on tokens; a line count reads green on a file 7× over. |
| **"...particularly if any contradict"** | **Mechanism real, cost not observed.** One HARD live self-contradiction verified at source (`hooks-safety.md:104` retires the test `:122` still states). But under 5 deliberate contradictions, workers **detected, enumerated and disclosed** them 3/3 runs rather than degrading. |
| **"more instructions → less strictly followed"** | **NOT ANSWERED—and that is the result.** Adherence sat at **ceiling in every cell**, so nothing could be ranked. A ceiling proves the level, never the slope. |

## The pile, measured

| | Chars | Est. tokens | Lines |
|---|---|---|---|
| Always-injected governance | **198,129** | **~79,281** | 1,510 |
| All seven plugins' always-on (platform's own counter) |—| **5,697** |—|

The plugins are **7.2%** of the pile. The pile is the cost centre.

- **Token figures are CALIBRATED ESTIMATES, not a tokenizer count.** `chars/4` undercounts by **1.539×** (n=13 skill bodies vs `claude plugin details`; band 1.399–1.586). Char counts are measured; token counts are derived.
- The working baseline of 158,754 chars reconciles exactly but **omits the machine-global files, the auto-memory index and the tombstone ledger—all injected.** The real pile was **20.5% larger.**
- **The pile is not stable.** It grew **+6,875 net chars in ~19 minutes** of concurrent editing *during this benchmark*.

## Adherence—3 conditions × 3 rounds, 9 workers

Ten probes whose correct answer a pile rule dictates; five of them **PILE-SPECIFIC** (the generic answer differs). Cells: control · +30 consistent dispatch instructions · +30 with 5 contradicting pairs.

**90/90 probe items PASS · 45/45 pile-specific · 30/30 dispatch canaries · 0 INDETERMINATE · spread 0 pp in every cell, every round.**

Zero-event bounds (Rule of Three, 95%): pile-specific failure rate **< 6.7%** · all probes **< 3.3%** · canary adherence under live contradictions **< 10%**.

**The sharper finding is qualitative:** in 3/3 conflict runs the worker named the contradicting pairs by number and stated its tie-break—*"mutually exclusive, so the responder followed the lower-numbered rule of each pair."* At this dose the predicted failure mode appeared as **detection and disclosure, not silent degradation.**

## What this does NOT show

- **A ceiling cannot measure a slope.** H1 and H2 are neither confirmed nor refuted at their own margin—nothing degraded enough to compare.
- **The pile itself was never varied.** Editing the rule files was out of scope and the platform injects the full stack at spawn regardless. **The dose rode the DISPATCH channel, not the system-prompt channel Anthropic's sentence is about.** Never quote this as a replication of their setup.
- **The workers are not decorrelated**—all nine got the same governance stack at spawn, and every one of them said so unprompted. This measures that the pile is **internally sufficient and self-consistent** on ten surfaces and survives 30 competing instructions. **It does not measure whether the pile is TRUE.**
- **n=3 per cell, 5 items per headline; the pile moved mid-run;** the P9 scorer predicate was corrected mid-run and all nine cells re-scored (both scorings published).

**Dated 2026-07-27; a 9-run, 10-probe sample against a byte-pinned snapshot—not a guarantee.**

## Next arm (not run)

The ceiling is the binding limit, so the next arm must **push until something breaks**: escalate dose (30 → 100 → 300 instructions) and conflict density (5 → 25 pairs) until canary compliance leaves 5/5, then bisect to find the knee. **Until an arm actually produces a failure, "our pile is fine" rests on a ceiling result and must say so.** A true H1 test needs the pile itself varied—that needs ownership of the rule files and a window with no concurrent editor.
