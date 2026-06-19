# CoalBoard eval — Antigravity (run 2026-06-19, Gemini 3.1 Pro (Low), both arms)

Run by the maintainer in Antigravity (Claude Code cannot actuate AG — these are AG's real answers, scored here, unedited). CoalBoard is not installed in AG, so the BOARD arm applied the discipline **by hand** from the run prompt. **Important (maintainer-observed): AG ran this as a SINGLE agent — it spawned NO subagents.** So this arm is the board's **DISCIPLINE** (adversarial *self*-review + live fetch + run-the-check) **without the parallel-blind multi-lens INDEPENDENCE** that is the board's core decorrelation mechanism — a single agent attacking its own answer shares its own blind spot. Read this as a **lower bound**: the discipline alone, no independent lenses. (A follow-up run that explicitly spawns parallel-blind lenses — the true board — is the matched full-board point.) Single run per arm. Scored against the same golds, judge-verified (T2 computed, T3 re-checked: Node 24 / EOL 2028-04-30).

| task | domain | WITHOUT — solo (1 pass) | WITH — board discipline |
|------|--------|--------------------------|--------------------------|
| T1 | crypto | ❌ shipped `provided === expected` — a **timing side-channel** | ✅ `crypto.timingSafeEqual` + length/type guard |
| T2 | math | ✅ $4,467,744.31 (monthly formula) | ✅ same, but **ran the calc** to confirm |
| T3 | research | ❌ **"Node 20 (Iron), EOL 2026"** — stale from memory (Node 20 is already EOL) | ✅ **fetched** the live schedule → Node **24**, EOL **2028-04-30** |
| T4 | concurrency | ❌ "standard caching pattern" — **missed the race** | ✅ caught the check-then-act stampede + promise-cache fix + reject-evict |
| T5 | docs | ❌ caught the H2→H4 skip, **missed the duplicate-H1** | 🟡 same — caught the skip, **also missed the duplicate-H1 (MD025)** |
| **total** | | **1 / 5** | **4 / 5** |

## Honest headline

**Solo 1/5 → Board 4/5** on Gemini 3.1 Pro (Low). The board's discipline fixed the **three dangerous errors a casual pass shipped**: a token compare with a **timing side-channel**, a **stale Node version** (answered from memory), and an **unspotted race condition** — exactly the error-not-allowed cases. Both arms caught the obvious doc-skip; **both missed the debatable duplicate-H1** (the weaker model didn't apply the MD025 check even under the discipline — the board *improves*, it does not *perfect*).

**Cross-platform reading (with the Claude Code arm).** On strong Opus (Claude Code) the board edge was *modest* (3.5→5 — a strong solo already knows the textbook traps). On a weaker, **different-vendor** model (Gemini, here) the edge is *large* (1→4). So the board's value **scales inversely with model strength** — it lifts a weaker/cheaper model toward correctness — and the discipline is **not Claude-specific** (it works on Gemini). Single-run, dated; a 5-task sample, not a guarantee.

## Full board (real subagents) — follow-up run

The run above applied the discipline as a *single* agent. This follow-up forced the real board: **Antigravity spawned 3 parallel-blind lens subagents** (Empirical, Formal, Adversary; Gemini 3.1 Pro Low). *(Observed live: the Empirical lens first BLOCKED on its live-fetch — "Needs Attention" — and stalled the main until unblocked: the platform's subagent-fetch limit. This drove the **anti-hang hardening** now in the skill — a stuck/blocked lens is reaped on timeout and the board proceeds with a flag, never waits forever; the empirical lens degrades to ground-from-context + flag when it cannot fetch.)*

| task | full board (3 blind subs) |
|---|---|
| T1 | ✅ + hardened — the Adversary caught the length-leak, hashed to a fixed length before `timingSafeEqual` |
| T2 | ✅ $4,467,744.31 (+ a labeled real-world per-month step-rounded variant, $4,467,744.39 — a bonus, not a replacement) |
| T3 | ✅ fetched → Node 24 / 2028-04-30 |
| T4 | ✅ race + promise-cache + evict + unbounded-growth |
| T5 | 🟡 caught the skip; **missed the duplicate-H1 again** |
| **total** | **4/5** |

**The finding that matters — the design's ceiling, demonstrated live.** Three *independent* lenses STILL missed the duplicate-H1 (T5) — the same miss as the single-agent run and the solo. Why: all three lenses are the **same model** (Gemini), so they **share the blind spot** — prompt-diversity does not break a blind spot shared by copies of one model (Knight–Leveson correlated failure, exactly as the design states). The Claude Code board *did* catch it — a **different** model (Opus) + a judge that knew MD025. So the board lifts a weak model on cases SOME lens can see (solo 1 → board 4), but a defect ALL copies share survives even the full board. The honest ceiling, not papered over.

**AG, three points:** solo **1/5** → discipline (1 agent, no subs) **4/5** → full board (3 blind subs) **4/5**. The subagents added *depth* (richer T1/T2) and visible independence, but not a higher score here — the remaining miss is a model-shared blind spot, not a rigor gap. (A genuinely diverse board — cross-vendor lenses — is the only thing that would break it; on a single-vendor platform the human gate is the out-of-frame backstop.)
