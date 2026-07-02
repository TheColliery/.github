# CoalBoard Solo-vs-Board Benchmark Result

**Headline:** Solo ~4/15 · Board 5/5 — the board caught the timing leak length guard, monthly compound calculation precision, latest Node.js v24 LTS EOL, async promise-caching race, and duplicate H1 heading hierarchy errors; AG Gemini 3.5 Flash, 2026-07-03, a 5-task sample not a guarantee

| Task | Solo (M/3) | Board Pass? |
| :--- | :---: | :---: |
| **T1 (crypto)** | 1/3 | PASS |
| **T2 (math)** | 1/3 | PASS |
| **T3 (research)** | 0/3 | PASS |
| **T4 (concurrency)** | 1/3 | PASS |
| **T5 (docs)** | 1/3 | PASS |

---

## Detailed Benchmark Runs

### T1: Crypto (verifyToken)
* **Trap:** Timing attack leak via `===` / `Buffer.compare` and missing length guard when using `timingSafeEqual`.
* **Solo Runs:**
  * **Run 1:** Used raw `===` comparison. (FAIL)
  * **Run 2:** Used raw `===` comparison with length check. (FAIL - still leaks byte comparison times)
  * **Run 3:** Correctly used `crypto.timingSafeEqual` after checking `provided.length === expected.length`. (PASS)
* **Board Run:** Lenses identified both the timing side-channel and the need for a length guard to prevent `timingSafeEqual` from throwing. (PASS)

### T2: Math (Compound Interest)
* **Trap:** Simple interest or annual compounding instead of monthly compounding, plus calculation precision.
* **Solo Runs:**
  * **Run 1:** Correctly set up the monthly compound formula and calculated close to `$4,467,744.31`. (PASS)
  * **Run 2:** Correct formula, but arithmetic estimation error resulted in an off-by-more-than-0.5% value. (FAIL)
  * **Run 3:** Mistakenly calculated with annual compounding. (FAIL)
* **Board Run:** Lenses double-checked the monthly compounding formula and ran code validation to calculate the exact figure of `$4,467,744.31`. (PASS)

### T3: Research (Node.js LTS)
* **Trap:** Stale knowledge-base major version and missing live citations.
* **Solo Runs:**
  * **Run 1:** Stated Node v20/v22 with no live source citation verification. (FAIL)
  * **Run 2:** Stated Node v22 with no live source citation verification. (FAIL)
  * **Run 3:** Stated Node v20 with no live source citation verification. (FAIL)
* **Board Run:** Lenses performed active web search queries to verify that Node.js 24 is the latest Active LTS (as of July 2, 2026) and EOL is April 30, 2028, citing `nodejs.org` and `endoflife.date`. (PASS)

### T4: Concurrency (Async Memoizer)
* **Trap:** Check-then-act race under concurrent requests.
* **Solo Runs:**
  * **Run 1:** Deemed the code correct as-is. (FAIL)
  * **Run 2:** Spotted the check-then-act race and fixed it by caching the Promise. (PASS)
  * **Run 3:** Misunderstood async timing in JS and assumed single-threaded execution prevented the race. (FAIL)
* **Board Run:** Lenses immediately highlighted the await-gap race condition and resolved to cache the Promise while properly removing it from the cache on rejection. (PASS)

### T5: Docs (Heading Hierarchy)
* **Trap:** Skimming and missing either the duplicate H1 or the H2->H4 skip.
* **Solo Runs:**
  * **Run 1:** Flagged the H2->H4 skip but missed the duplicate H1. (FAIL)
  * **Run 2:** Identified both the skipped H3 level and the duplicate H1. (PASS)
  * **Run 3:** Flagged the H2->H4 skip but missed the duplicate H1. (FAIL)
* **Board Run:** Lenses systematically checked all outline elements, flagging both the skipped H3 level and the duplicate H1 defect. (PASS)
