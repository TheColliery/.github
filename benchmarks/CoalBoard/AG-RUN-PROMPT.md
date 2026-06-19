# CoalBoard eval — Antigravity run prompt

Paste the block below into Antigravity (in the TheColliery project, so it can write the result file). It runs **both arms** on the 5 tasks and writes the answers to a file. Then tell me "done" and I read + score it (I score against the golds — Antigravity just produces the answers, so it can't teach-to-the-gold).

---

```
Run a small benchmark and WRITE the results to a file. Do TWO arms over the same 5 tasks.

ARM 1 — SOLO: answer each task casually, ONE direct pass, the way you'd normally reply. No special rigor.

ARM 2 — BOARD (CoalBoard discipline): answer the SAME 5 tasks rigorously. If the CoalBoard skill is installed here, invoke it (/coalboard) at rigor:high. Otherwise apply its method by hand: for each task, propose an answer, then ADVERSARIALLY attack it to find the subtle trap; FETCH a live authoritative source for any version/fact (never answer a version from memory); and actually RUN/compute the objective check.

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

WRITE both arms' answers to this file (relative to the TheColliery repo root):
  CoalBoard/eval/results/antigravity-raw.md
If you're in a different project and can't write there, write the file anywhere you can and tell me the full path.
Format the file as:
  # Antigravity raw answers (date: <today>; ARM1 model: <model>; ARM2 model(s): <model(s)>)
  ## ARM 1 — SOLO
  T1: ...
  T2: ...
  (through T5)
  ## ARM 2 — BOARD
  T1: ...
  (through T5)

When the file is written, reply "done".
```

---

After you say "done", I read `results/antigravity-raw.md`, score both arms against the golds (RUN-verifying T2's number and re-fetching T3's current Node LTS), and write the scored `results/antigravity.md` beside the Claude Code result — your data, unedited. Then we push all 4 repos.
