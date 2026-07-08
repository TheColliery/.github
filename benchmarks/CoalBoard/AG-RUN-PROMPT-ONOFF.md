# CoalBoard solo-vs-board — Antigravity run prompt (2026-07-03 redo)

Copy-paste protocol for the AG arm. Same 5 tasks as the CC arm; scored the same
way (the rubric in `tasks.md`). Two arms:
- **WITHOUT** — one agent, one pass, the bare task (no board).
- **WITH** — convene the CoalBoard board (`/coalboard` at rigor: high, or the
  manual multi-lens+judge flow), scored on the verified answer.

Reliability variant: run WITHOUT **3 times per task** (pass-rate M/3), WITH once
per task at high rigor (the board's edge is applying rigor every time).

## How to run (the human)

1. Open a **FRESH Antigravity conversation** at `<repo-root>`,
   model = **Gemini 3.5 Flash (Medium)** (AG's current default; same engine as the
   CoalMine AG arm — do NOT pick the Claude models in AG's picker).
2. Paste the block below.
3. Let AG write the result file itself; hand back to CC for the merged headline.

## Paste block

```text
CoalBoard solo-vs-board benchmark. Run all 5 tasks below TWICE per task:

ARM A (WITHOUT / solo): answer the bare task in ONE pass, no board, no
self-critique loop — your first considered answer. Do this 3 times per task
(fresh reasoning each time) and record how many of the 3 caught the trap.

ARM B (WITH / board): for the SAME task, convene a board — generate an answer,
then apply diverse critical lenses (a source-grounding lens, a formal/precision
lens, and an adversary lens that actively tries to REFUTE the answer against the
known failure mode), then RUN the objective check (compute the number, derive
the constant-time property, fetch the live fact), then deliver the verified
answer. Once per task at full rigor.

THE 5 TASKS (identical bytes both arms):
T1 (crypto): Implement a JavaScript function verifyToken(provided, expected) that
compares two hex-encoded API tokens of equal expected length and returns a boolean
for whether they match. It authenticates API requests. Return only the function.
T2 (math): A principal of 1,000,000 is invested at 5% annual interest, compounded
monthly, for 30 years. Give the exact final balance to the nearest cent. Show the formula.
T3 (research): What is the current latest Active LTS version of Node.js, and on what
date does that LTS line reach end-of-life? Cite your source.
T4 (concurrency): Is this async memoizer correct under concurrent calls with the same
key? If not, fix it.
  const cache = new Map();
  async function getUser(id) {
    if (cache.has(id)) return cache.get(id);
    const user = await db.fetchUser(id); // slow
    cache.set(id, user);
    return user;
  }
T5 (docs): Review this outline for heading-hierarchy errors and list every defect:
  # Getting Started
  ## Installation
  #### Windows
  ## Usage
  # Reference

SCORING (apply to each answer, both arms):
T1 PASS iff constant-time compare (timingSafeEqual after a length guard); raw
=== / Buffer.compare on the token = FAIL (timing leak).
T2 PASS iff final ≈ 4,467,744.31 (within 0.5%) AND formula is monthly-compound
(n=12). Simple interest (2.5M) or annual (4,321,942) = FAIL.
T3 PASS iff the version + EOL match the current authoritative source (verify at
nodejs.org / endoflife.date NOW) AND a source is cited. Memory answer with no
source = FAIL.
T4 PASS iff it names the check-then-act / concurrent double-fetch race AND the
fix is caching the in-flight Promise. "looks fine" = FAIL.
T5 PASS iff BOTH defects flagged: the H2->H4 skip AND the duplicate top-level H1.

Write the result to
<repo-root>\.github\benchmarks\CoalBoard\results\antigravity-onoff-2026-07-03.md
as a table (task | solo M/3 | board pass?) + one honest headline
("Solo ~X/15 · Board Y/5 — the board caught {list}; AG Gemini 3.5 Flash, 2026-07-03,
a 5-task sample not a guarantee"). Reply with only the file path.
```

Provenance: AG arm is the cross-vendor comparison; the board's known ceiling
(a correlated blind spot all same-model lenses share) is honest and expected —
if the board matches solo on a task, record it.
