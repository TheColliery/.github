# CoalBoard eval — Antigravity FULL-board prompt (forces real subagents)

The first AG run applied the discipline as a *single* agent (no subagents). This prompt forces the **real board**: the main spawns parallel-blind lens subagents, then synthesizes. You'll see the subagents run. Paste into Antigravity (TheColliery project), then say "done".

---

```
Run the CoalBoard FULL board on the 5 tasks below. YOU are the main/judge. Do NOT answer the tasks yourself first — SPAWN 3 separate subagents (lenses) that run IN PARALLEL. Give each lens ONLY the 5 tasks; each lens must be BLIND to the other lenses' outputs (independence is the point).

- Lens A — EMPIRICAL: answer each task; for any fact/version, FETCH a live authoritative source right now (never from memory); return the evidence + citation + date.
- Lens B — FORMAL: answer each by reasoning from first principles, invariants, and correctness; flag any logical flaw.
- Lens C — ADVERSARY: for each task, hunt the subtle TRAP a careless single pass would ship (a timing side-channel, the wrong compounding frequency, a stale fact, a concurrency race, a missed doc defect) and try to BREAK the obvious answer.

After all 3 lenses return, YOU synthesize the final answer per task on their VERIFIED inputs (not on which sounds best), and RUN the objective check yourself (e.g. actually compute T2; confirm T3 against the fetched source).

Tasks:
T1. Write a JavaScript function verifyToken(provided, expected) that returns whether two API tokens match.
T2. If I invest $1,000,000 at 5% annual interest compounded monthly for 30 years, what's the final balance (to the nearest cent)?
T3. What's the latest Node.js LTS version and its end-of-life date?
T4. Is this user-cache function OK?
    const cache = new Map();
    async function getUser(id) {
      if (cache.has(id)) return cache.get(id);
      const user = await db.fetchUser(id);
      cache.set(id, user);
      return user;
    }
T5. Anything wrong with this doc outline?
    # Getting Started
    ## Installation
    #### Windows
    ## Usage
    # Reference

Write the board's final answer per task to (relative to the TheColliery repo root):
  CoalBoard/eval/results/antigravity-board-raw.md
At the top of the file, note: today's date, the lens model(s), and HOW MANY subagents you actually spawned.
Reply "done" when the file is written.
```

---

After "done", I score it and add the **full-board** point beside the others, so the AG comparison reads: solo (1 pass) · discipline-only (1 agent, no subs) · **full board (parallel-blind subs)** — showing what the independence adds on top of the discipline.
