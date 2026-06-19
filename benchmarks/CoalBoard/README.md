# CoalBoard eval — with-the-board vs without-the-board

> **What this measures, honestly.** On a fixed set of **error-not-allowed** tasks — each with a *known-correct gold* and a *subtle trap a single-pass agent typically falls for* — it compares two arms:
> - **WITHOUT** — one solo agent, a single pass, the bare task (no board).
> - **WITH** — the CoalBoard board (diverse lenses + the adversary lens + the judge that RUNS the objective check).
>
> It reports **how many traps each arm caught**. It does **NOT** prove "no errors, ever, on all work" — no probabilistic ensemble can (a bug in the shared-model blind spot survives both arms). The honest claim is: *on this dated sample, the board caught the traps the solo pass missed.* The board's value is **bounded-cost + zero-breakage + improved correctness**, not a defect-rate guarantee. (Same honest frame as the skill — NASA-inspired in structure, not in numbers.)

## Why these tasks

"NASA-tier" here = **error-not-allowed + subtle-failure**, not "large". Each task is small to state but has a failure mode that *looks right* until you verify it — the exact case where a solo pass ships a plausible-but-wrong answer and a board (show-me + adversary + run-the-check) does not. The set spans domains on purpose: the board's edge is *general* (it is about how you know, not about code).

| # | Domain | Task (prompt given to both arms) | Gold (correct) | The trap a solo pass falls for | Objective scorer |
|---|---|---|---|---|---|
| T1 | code / crypto | "Implement `verifyToken(provided, expected)` comparing two hex API tokens, return boolean." | constant-time compare (`crypto.timingSafeEqual` after a length guard) | `provided === expected` or `Buffer.compare`/`===` on the digest → **timing leak** (passes every functional test) | uses a constant-time primitive AND length-guards; raw `===`/`Buffer.compare` on the secret = FAIL |
| T2 | math / precision | "A 1,000,000 principal at 5% annual interest **compounded monthly** for 30 years — exact final balance?" | `1000000 × (1+0.05/12)^(12×30)` ≈ **4,467,744.31** | simple interest (2.5M) or annual-compound (4,321,942) → plausible-but-wrong | final number within ±0.5% of the gold; the formula must be monthly-compound |
| T3 | research / stale-fact | "Current latest **Node.js LTS** version and its **EOL** date?" (version-sensitive) | the *current* LTS + EOL, **fetched at run time** with a source | answer from training memory → a **stale** version, no source | matches the current fact (verify against nodejs.org/endoflife.date at scoring time) AND cites an authoritative source |
| T4 | code / concurrency | "This memoizer caches into a shared `Map` across `async` calls. Correct under concurrent access? Fix if not." (check-then-act on an async gap) | identify the **check-then-act race** (two concurrent misses both compute / double-fetch) + fix (cache the in-flight Promise) | "looks fine, it caches" — misses the await-gap interleaving | names the specific check-then-act/double-compute race AND the promise-cache fix |
| T5 | docs / structure | "Review this outline for heading-hierarchy errors: `# A` … `## B` … `#### C` … `# D`." | the **H2→H4 skip** (B→C) AND the **duplicate H1** (A, D) | skim-misses one or both | flags BOTH defects (the skipped level and the second top-level heading) |

The exact prompts + the buggy code snippets for T4/T5 live in [`tasks.md`](tasks.md) (identical bytes fed to both arms and both platforms — apples-to-apples).

## Method (identical on both platforms)

For each task, on each platform:
1. **WITHOUT** — give the bare task prompt to one agent, one pass, no board skill active. Record the answer.
2. **WITH** — invoke CoalBoard (`/coalboard` Audit/Generate at `rigor: high` so the adversary lens + ground-truth verify are on). Record the answer.
3. **Score** each answer against the gold with the objective scorer above (the *judge runs the check* — never eyeballs). Mark trap-caught (✅) or trap-missed (❌).

Same five tasks, same prompts, scored the same way → the only variable is *board / no board* (and, across the two result files, *platform*).

## Run it

- **Claude Code:** the maintainer runs both arms here (real subagents). Results → [`results/claude-code.md`](results/) (dated).
- **Antigravity:** Claude Code cannot actuate Antigravity, so its numbers are **not** produced here (never fabricated). Run the identical protocol in Antigravity per [`AG-PROTOCOL.md`](AG-PROTOCOL.md) and fill [`results/antigravity.md`](results/) — same tasks, same scorers.

## Reading the result

A result file is the scored table + the one honest headline:
> *Solo M/5 · Board 5/5 — the board caught the {list} traps the solo pass shipped. Dated YYYY-MM-DD; a 5-task sample, not a guarantee.*

If the board ever scores **below** solo on a task, that is a real finding (record it — an honest benchmark reports its losses).
