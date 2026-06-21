# CoalBoard eval — task prompts (exact, fed identically to WITHOUT and WITH, on both platforms)

Give each prompt verbatim. WITHOUT = one agent, one pass. WITH = `/coalboard` at `rigor: high`. Each arm may instead be run **K times** and scored as a **pass-rate** (the sanctioned reliability variant — rigor is what's variable; see [`README.md`](README.md)). Tasks are **judgment-scored by prose** (the rubric below, applied by a strong judge) — no executable scorer by design.

---

## T1 — code / crypto

> Implement a JavaScript function `verifyToken(provided, expected)` that compares two hex-encoded API tokens of equal expected length and returns a boolean for whether they match. It is used to authenticate API requests. Return only the function.

**Gold:** constant-time compare — `crypto.timingSafeEqual` on equal-length buffers (length checked first, since `timingSafeEqual` throws on length mismatch).
**Trap:** `provided === expected`, or `Buffer.compare(...) === 0` on the secret — a **timing side-channel** that passes every functional test.
**Scoring rubric (judge-run):** PASS iff it uses a constant-time primitive AND guards length; raw `===` / `Buffer.compare` on the secret = FAIL.

---

## T2 — math / precision

> A principal of 1,000,000 is invested at 5% annual interest, compounded monthly, for 30 years. Give the exact final balance to the nearest cent. Show the formula.

**Gold:** `1000000 × (1 + 0.05/12)^(12×30)` ≈ **4,467,744.31**.
**Trap:** simple interest (`1,000,000 × (1 + 0.05×30)` = 2,500,000) or annual compounding (`×1.05^30` ≈ 4,321,942.38) — plausible-but-wrong.
**Scoring rubric (judge-run):** PASS iff the final figure is within ±0.5% of 4,467,744.31 AND the formula is monthly-compound (n=12). RUN the calc to score — do not eyeball.

---

## T3 — research / stale-fact (version-sensitive)

> What is the current latest Active LTS version of Node.js, and on what date does that LTS line reach end-of-life? Cite your source.

**Gold:** the *current* Active-LTS major + its EOL date, **fetched at scoring time** (nodejs.org/en/about/previous-releases or endoflife.date/nodejs).
**Trap:** answered from training memory → a stale major and/or no source.
**Scoring rubric (judge-run):** PASS iff the version + EOL match the current authoritative source at scoring time AND an authoritative source is cited. (Re-fetch the gold the day you score — this task's gold is intentionally time-varying.)

---

## T4 — code / concurrency

> Is this async memoizer correct under concurrent calls with the same key? If not, fix it.
> ```js
> const cache = new Map();
> async function getUser(id) {
>   if (cache.has(id)) return cache.get(id);
>   const user = await db.fetchUser(id);   // slow
>   cache.set(id, user);
>   return user;
> }
> ```

**Gold:** identify the **check-then-act race** — two concurrent calls with the same `id` both see a miss (the `await` gap), both hit `db.fetchUser`, so the fetch is duplicated (and any per-fetch side effect runs twice). Fix: cache the **in-flight Promise** (`cache.set(id, db.fetchUser(id))` before awaiting; await the cached promise), evicting on reject.
**Trap:** "looks fine — it caches the result" (misses the await-gap interleaving).
**Scoring rubric (judge-run):** PASS iff it names the concurrent double-fetch / check-then-act race AND proposes the promise-caching fix.

---

## T5 — docs / structure

> Review this document outline for heading-hierarchy errors and list every defect:
> ```
> # Getting Started
> ## Installation
> #### Windows
> ## Usage
> # Reference
> ```

**Gold:** two defects — (1) the **H2→H4 skip** (`## Installation` → `#### Windows`, the H3 level is skipped); (2) a **second top-level `#`** (`# Reference` — a document should have one H1).
**Trap:** skim-misses one or both (commonly catches the skip, misses the duplicate H1).
**Scoring rubric (judge-run):** PASS iff BOTH defects are flagged.
