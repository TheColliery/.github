# Skill-prose determinism — detail record, 2026-08-03

Five walks, four instrument shapes (see `../../tasks.md`), condensed from the internal lab record
(`TheColliery/scratchpad/longrun/SKILL-VARIANCE-WALK.md`, machine-local — not itself published, per
the series' clean-clone rule that a tool repo carries only the benchmark, not the working notes).
Each run below carries its five-part stamp: blob(s) walked, instrument, scoring key, tier
composition, lane + load layer.

---

## Run 11 — CoalTipple, lane EXECUTION, four lanes, 2026-07-31

Target: `coaltipple@coaltipple`, `skills/coaltipple/SKILL.md`, blob `2848476...` (mirror-verified
against the room's tree; installed plugin at the time was one patch behind, correctly — the walk
gates unshipped work). Instrument: Shape 1 (tasks.md), Thai end-user line kept verbatim, EN frame.

**L1 — routing-OFF / skill-does-not-apply, haiku ×3 — FAIL at the weak tier.**

| rail | h1 | h2 | h3 | divergence |
|---|---|---|---|---|
| activation = NO on a declared off-state | ✓ | ✓ | ✓ | 0% |
| off-state COUNT (five, never a sixth) | ✓ | ✓ | ✓ | 0% |
| asks = 0 | ✓ | ✓ | ✓ | 0% |
| **prohibitions bound** | "none — inert" | "P7 binds unconditionally" | "P7 — ambiguous whether it binds" | **3-way split** |
| **output location** | user's files, cites line 77 | same | "SKILL.md does not specify" | **split** |
| **does OFF collapse into SELF?** | explicitly DENIES | implies YES | silent | **split, and this is the rail the fix was meant to install** |

Root cause: one unresolved seam (does OFF collapse into the SELF outcome) drives three downstream
rails apart. Disposition: does not pass; carve routed to the room. L2/L3/L4 not fired pending the fix.

---

## Run 12 — CoalBoard, lane SELECTION, 2026-08-01 — **FAIL, top tier splits against itself**

Different instrument (Shape 2): 4 scenarios (1 real + 3 controls), question B = enumerate the
FULL-board trigger list. Target: installed `coalboard@coalboard 1.10.0`, `SKILL.md` alone (blob
`fc4adbf46990`, no reference loaded). 12 walkers (3 tiers × 3 + a 3-round control), 9 in the scored pool.

| tier | R1 | R2 | R3 |
|---|---|---|---|
| weak | OPINION | OPINION | OPINION |
| mid | OPINION | OPINION | OPINION |
| **strong** | **NEITHER** | **NEITHER** | OPINION |
| control (weak, unlabelled) | OPINION | OPINION | OPINION |

Routing rail: 16.7% divergence. **Enumeration rail (question B): 67%** — weak counted 11/8/9 items,
mid counted 4/4/4 (stable), strong counted 5/5/5 (stable, different structure from mid). **Headline
= MAX pooled = 67%.** Two upper tiers were each internally perfect and answered DIFFERENT things,
which is exactly the case the pooling rule exists to catch — a per-tier report would have shown
`strong 0%` and hidden the worse number in the same dataset.

---

## Run 13 — the CT↔CB double-hook arbitration cue, 2026-08-02 — **FAIL, wrong modal answer**

Third instrument (Shape 3): the cue two `UserPromptSubmit` hooks inject, not a SKILL.md. 5 scenarios,
9 walkers (3 tiers × 3), all scored. Live fixture measured the same day: 23 real fires in one session,
**zero** error-not-allowed tasks among them, 74% on the harness's own machine-generated text.

| scenario | ground truth | weak | mid | strong | modal | divergence |
|---|---|---|---|---|---|---|
| S1 (data-vs-intent) | NEITHER | CB·NEITHER·NEITHER | CT·CT·NEITHER | CB·CB·CB | **CB, WRONG** | **55.6%** |
| S2 (crypto migration) | CB | CB×3 | CB×3 | CB×3 | CB | 0% |
| S3 (400-file rename) | CT | CT×3 | CT×3 | CT×3 | CT | 0% |
| S4 (typo near a token var) | NEITHER | NEITHER×3 | NEITHER×3 | NEITHER×3 | NEITHER | 0% |
| S5 (Rust port, login path) | CB | CB×3 | CB×3 | CB×3 | CB | 0% |

S1 splits three ways and is TIER-STRATIFIED: weak leans correct, mid splits, **strong is unanimously
wrong** — worse than Run 12's shape, where the top tier at least disagreed with itself. Mechanism,
named independently by 6 of 9 walkers: the rule's tie-break clause ("in doubt WITH any stakes signal
→ CoalBoard") can overturn its own semantic Layer-2 acquittal on the same input. Enumeration rail
(the 4-item stakes list) held at 11.1% — a bounded four-token parenthetical, close to the enumerable
end already.

---

## Run 14 — the same cue after a wave-1 carve, 2026-08-02 — **FAIL, 0% variance and 0% correct**

Same 5 scenarios, one substitution (hook line A only). Weak tier only (haiku ×3) — a structural
defect doesn't need a strong tier to prove it's structural.

| rail | R1 | R2 | R3 | verdict |
|---|---|---|---|---|
| lead, S1 | CT | CT | CT | **0% variance, UNANIMOUSLY WRONG** (GT = NEITHER) |
| lead, S2-S5 | correct ×4 | same | same | 0%, correct |
| action, S2 & S5 | ASK | ROUTE-TIER | ASK | **33.3%, REGRESSED from Run 13's 11.1%** |
| stakes-set enumeration | 4 items, exact | same | same | 0%, correct |

**The carve worked on its NAMED target** (a keyword can no longer re-arm an acquitted Layer-2
verdict) **and the text still failed**, because the underlying partition — Stakes → CoalBoard /
capability-gap → CoalTipple / trivial → neither — has no bucket for "read-only work whose keywords
fire but whose intent is not stakes." Everything of that shape falls into bucket two by elimination.
**This is the run that makes the metric's own warning concrete: the walk measures whether readers
agree, never whether they are right.** Report both numbers, always — the 0% on the lead rail without
the 0%-correct qualifier would read as a clean pass.

---

## Run 15 — the prose-index hypothesis test, CoalMine `rot-canary`, 2026-08-03

Fourth instrument (Shape 4). **Independently re-derived prose-index table** (script over the live
tree, not a copy of any prior figure):

| room | prose chars | non-test code lines | **index** | test/code ratio |
|---|---|---|---|---|
| CoalBoard | 93,958 | 1,128 | **83.3** | 0.75 |
| CoalFace | 26,621 | 644 | **41.3** | 1.01 |
| CoalTipple | 53,483 | 2,250 | **23.8** | 0.95 |
| CoalMine | 46,394 | 3,856 | **12.0** | 0.87 |
| CoalLedger | 26,592 | 2,766 | **9.6** | 0.62 |
| CoalWash | 250,832 | 39,803 | **6.3** | 1.53 |
| CoalHearth | 0 | 2,302 | **0** | 1.54 |

CoalHearth carries no `skills/` directory and no `SKILL.md` anywhere in the room — the zero-prose
control, verified by search, not inferred.

**Prediction, locked in `PREREGISTRATION.md` before any walker fired:** `rot-canary` (index 12.0,
third-lowest, and already shaped as numbered ledgers — a tier rubric, a 3-option fix menu, an
entanglement map) predicted to pass wave 1 at the weak tier on four named rails.

Target: installed `coalmine@coalmine 3.14.0`, `skills/rot-canary/SKILL.md`, blob
`57406d5a42f55474672bbbed3d31a62a86cadd59` (the room's own working tree and mirror sit one edit
ahead of this blob — declared, out of scope here; the installed artifact is what a user actually runs).

| rail (predicted) | r1 | r2 | r3 | divergence |
|---|---|---|---|---|
| tier score + tier | 4/4 → Heavy | 4/4 → Heavy | 4/4 → Heavy | **0%** |
| fix-menu presents | yes | yes | yes | **0%** |
| fix-menu option count | 3 | 3 | 3 | **0%** |
| entanglement canary named | deferred (findings unknown) | same | same | **0%**, same deferral |

**All four predicted rails: zero variance. Prediction CONFIRMED.**

**One emergent, un-predicted rail wobbled: the TOTAL count of `ask_question` points.** r1 and r3
counted three (tier ask + fix-menu ask + the conditional entanglement ask, folded into one list); r2
counted two, answering the conditional ask separately. **Divergence 33.3%.** Root cause: the file
never states a single numbered list of "the ask points" — the entanglement ask (line 77) is
conditional and lives in its own section, structurally distinct from the two unconditional asks.
Same defect CLASS as every prior run's un-enumerated-count problem (Run 1's consent-point spread of
2-7; Run 13's own tie-break ambiguity) — at far smaller amplitude, because most of this file's rails
already have a labeled home.

**Self-report (Q8) split again:** one of three walkers named two genuine, real ambiguities the file
does carry (DEPTH vs TIER stated as separate axes with no interaction rule; the severity table's
"normal path" vs "reachable path" used as if synonyms, never defined) — the other two answered
"none." The self-report is not the instrument; the between-walker spread is.

**Reading:** the hypothesis is refined, not simply confirmed — **index correlates with variance, and
the mechanism underneath it is enumerability.** A low-index file still wobbles on the one rail it
leaves un-numbered; a high-index file (CB pre-carve, the hook cue) wobbles broadly because most of
its rails are scattered prose. Both statements are true in the same dataset.

**Mid/strong tiers not fired** — the single wobble is small and traceable to one named seam; the
economical next step is carving that seam, then re-walking three tiers on the carved text, rather
than spending sonnet/opus trios confirming a wobble already explained.

**Reaping:** 3 `blind-ic` leaves spawned, 3 collected, 0 alive. Transcripts destroyed after this
record was written (standing lab-hygiene rule) — the frozen prompt (`results/raw/run15-prompt-v1.txt`)
and this scored table are what persist.

---

## What this does NOT show

- **N is small.** 3-9 walkers per run. A 1-in-3 split is real signal at this scale; it is not a
  population estimate of any real user population.
- **No walker here is decorrelated from the room's own governance.** The platform injects the
  umbrella stack at spawn regardless of a "blind" leaf's framing (measured 2026-07-26 elsewhere in
  the series). Between-walker spread is genuine; walker AGREEMENT is never cited as independent proof
  the room's design is correct.
- **The four instrument shapes are not comparable to each other.** A 55.6% on the hook-cue instrument
  and a 33.3% on the SKILL.md instrument are not the same kind of number; they share only the
  divergence FORMULA, never a combined score.
- **Only one point below index-40 has been walked** (Run 15, index 12.0). The hypothesis has two
  points confirming it at the high end (CB ~83, the hook cue) and one confirming it at the low end.
  A single low point is a start, not a curve — CoalLedger (9.6) and CoalTipple (23.8) are the natural
  next points, and neither has run under this instrument shape yet.
