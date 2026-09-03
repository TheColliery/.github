# Skill-prose determinism—detail record, 2026-08-03

Five walks, four instrument shapes (see `../../tasks.md`), condensed from the internal lab record
(`TheColliery/scratchpad/longrun/SKILL-VARIANCE-WALK.md`, machine-local—not itself published, per
the series' clean-clone rule that a tool repo carries only the benchmark, not the working notes).
Each run below carries its five-part stamp: blob(s) walked, instrument, scoring key, tier
composition, lane + load layer.

---

## Run 11—CoalTipple, lane EXECUTION, four lanes, 2026-07-31

Target: `coaltipple@coaltipple`, `skills/coaltipple/SKILL.md`, blob `2848476...` (mirror-verified
against the room's tree; installed plugin at the time was one patch behind, correctly—the walk
gates unshipped work). Instrument: Shape 1 (tasks.md), Thai end-user line kept verbatim, EN frame.

**L1—routing-OFF / skill-does-not-apply, haiku ×3—FAIL at the weak tier.**

| rail | h1 | h2 | h3 | divergence |
|---|---|---|---|---|
| activation = NO on a declared off-state | ✓ | ✓ | ✓ | 0% |
| off-state COUNT (five, never a sixth) | ✓ | ✓ | ✓ | 0% |
| asks = 0 | ✓ | ✓ | ✓ | 0% |
| **prohibitions bound** | "none—inert" | "P7 binds unconditionally" | "P7—ambiguous whether it binds" | **3-way split** |
| **output location** | user's files, cites line 77 | same | "SKILL.md does not specify" | **split** |
| **does OFF collapse into SELF?** | explicitly DENIES | implies YES | silent | **split, and this is the rail the fix was meant to install** |

Root cause: one unresolved seam (does OFF collapse into the SELF outcome) drives three downstream
rails apart. Disposition: does not pass; carve routed to the room. L2/L3/L4 not fired pending the fix.

---

## Run 12—CoalBoard, lane SELECTION, 2026-08-01—**FAIL, top tier splits against itself**

Different instrument (Shape 2): 4 scenarios (1 real + 3 controls), question B = enumerate the
FULL-board trigger list. Target: installed `coalboard@coalboard 1.10.0`, `SKILL.md` alone (blob
`fc4adbf46990`, no reference loaded). 12 walkers (3 tiers × 3 + a 3-round control), 9 in the scored pool.

| tier | R1 | R2 | R3 |
|---|---|---|---|
| weak | OPINION | OPINION | OPINION |
| mid | OPINION | OPINION | OPINION |
| **strong** | **NEITHER** | **NEITHER** | OPINION |
| control (weak, unlabelled) | OPINION | OPINION | OPINION |

Routing rail: 16.7% divergence. **Enumeration rail (question B): 67%**—weak counted 11/8/9 items,
mid counted 4/4/4 (stable), strong counted 5/5/5 (stable, different structure from mid). **Headline
= MAX pooled = 67%.** Two upper tiers were each internally perfect and answered DIFFERENT things,
which is exactly the case the pooling rule exists to catch—a per-tier report would have shown
`strong 0%` and hidden the worse number in the same dataset.

---

## Run 13—the CT↔CB double-hook arbitration cue, 2026-08-02—**FAIL, wrong modal answer**

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
wrong**—worse than Run 12's shape, where the top tier at least disagreed with itself. Mechanism,
named independently by 6 of 9 walkers: the rule's tie-break clause ("in doubt WITH any stakes signal
→ CoalBoard") can overturn its own semantic Layer-2 acquittal on the same input. Enumeration rail
(the 4-item stakes list) held at 11.1%—a bounded four-token parenthetical, close to the enumerable
end already.

---

## Run 14—the same cue after a wave-1 carve, 2026-08-02—**FAIL, 0% variance and 0% correct**

Same 5 scenarios, one substitution (hook line A only). Weak tier only (haiku ×3)—a structural
defect doesn't need a strong tier to prove it's structural.

| rail | R1 | R2 | R3 | verdict |
|---|---|---|---|---|
| lead, S1 | CT | CT | CT | **0% variance, UNANIMOUSLY WRONG** (GT = NEITHER) |
| lead, S2-S5 | correct ×4 | same | same | 0%, correct |
| action, S2 & S5 | ASK | ROUTE-TIER | ASK | **33.3%, REGRESSED from Run 13's 11.1%** |
| stakes-set enumeration | 4 items, exact | same | same | 0%, correct |

**The carve worked on its NAMED target** (a keyword can no longer re-arm an acquitted Layer-2
verdict) **and the text still failed**, because the underlying partition—Stakes → CoalBoard /
capability-gap → CoalTipple / trivial → neither—has no bucket for "read-only work whose keywords
fire but whose intent is not stakes." Everything of that shape falls into bucket two by elimination.
**This is the run that makes the metric's own warning concrete: the walk measures whether readers
agree, never whether they are right.** Report both numbers, always—the 0% on the lead rail without
the 0%-correct qualifier would read as a clean pass.

---

## Run 15—the prose-index hypothesis test, CoalMine `rot-canary`, 2026-08-03

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

CoalHearth carries no `skills/` directory and no `SKILL.md` anywhere in the room—the zero-prose
control, verified by search, not inferred.

**Prediction, locked in `PREREGISTRATION.md` before any walker fired:** `rot-canary` (index 12.0,
third-lowest, and already shaped as numbered ledgers—a tier rubric, a 3-option fix menu, an
entanglement map) predicted to pass wave 1 at the weak tier on four named rails.

Target: installed `coalmine@coalmine 3.14.0`, `skills/rot-canary/SKILL.md`, blob
`57406d5a42f55474672bbbed3d31a62a86cadd59` (the room's own working tree and mirror sit one edit
ahead of this blob—declared, out of scope here; the installed artifact is what a user actually runs).

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
never states a single numbered list of "the ask points"—the entanglement ask (line 77) is
conditional and lives in its own section, structurally distinct from the two unconditional asks.
Same defect CLASS as every prior run's un-enumerated-count problem (Run 1's consent-point spread of
2-7; Run 13's own tie-break ambiguity)—at far smaller amplitude, because most of this file's rails
already have a labeled home.

**Self-report (Q8) split again:** one of three walkers named two genuine, real ambiguities the file
does carry (DEPTH vs TIER stated as separate axes with no interaction rule; the severity table's
"normal path" vs "reachable path" used as if synonyms, never defined)—the other two answered
"none." The self-report is not the instrument; the between-walker spread is.

**Reading:** the hypothesis is refined, not simply confirmed—**index correlates with variance, and
the mechanism underneath it is enumerability.** A low-index file still wobbles on the one rail it
leaves un-numbered; a high-index file (CB pre-carve, the hook cue) wobbles broadly because most of
its rails are scattered prose. Both statements are true in the same dataset.

**Mid/strong tiers not fired**—the single wobble is small and traceable to one named seam; the
economical next step is carving that seam, then re-walking three tiers on the carved text, rather
than spending sonnet/opus trios confirming a wobble already explained.

**Reaping:** 3 `blind-ic` leaves spawned, 3 collected, 0 alive. Transcripts destroyed after this
record was written (standing lab-hygiene rule)—the frozen prompt (`results/raw/run15-prompt-v1.txt`)
and this scored table are what persist.

---

## Run 17—the CT↔CB cue after wave-2 (2026-08-03)

Same 5 scenarios as Runs 13/14, both hook lines now substituted (one-flock: CoalTipple's copy
carries the same clause after wave 2). Weak/mid/strong × 3, `--safe-mode --effort medium`. $0.69.

| tier | r1 | r2 | r3 |
|---|---|---|---|
| weak | COALTIPPLE | COALTIPPLE | COALTIPPLE |
| mid | COALTIPPLE | COALTIPPLE | COALTIPPLE |
| **strong** | **NEITHER** | **NEITHER** | **NEITHER** |

S2-S5 unanimous across all nine. **S1-lead divergence: 33.3%, and it is tier-STRATIFIED with a clean
boundary**—weak+mid unanimously wrong, strong unanimously correct. The wave-2 carve's own
prediction was half right: it predicted NEITHER would become reachable (it did—Run 14 made it
unreachable by elimination) and that variance would rise off 0% (it did). It predicted the correct
answer would land at the WEAK tier; it landed at STRONG instead. **By the pass rule ("a file stable
only on the strong tier has failed") this is still a FAIL**—6 of 9 readers still route read-only
measurement work to CoalTipple. Pooling is what shows this: a per-tier report would have published
`strong 0%` and read as a pass.

**Mechanism, named independently in the free-text answers:** wave 1's undefined term (`stakes
signal`) was fixed by the wave-2 partition, and the same shape moved one bucket over — `No stakes: a
real CoalTipple routing need -> CoalTipple leads, else -> neither` leaves **"a real routing need"**
undefined. Weak/mid resolve it toward CoalTipple because line B fired with a grade; strong reads the
actual work and acquits. A second, smaller defect (one witness): whether a 400-file rename counts as
`migration`—the same keyword-vocabulary collision Run 13 recorded, still live.

**Instrument note:** the auto-scorer initially reported 55.6% by anchoring on an `S<n>` label and
dropping two walkers whose format varied (one omitted S-labels, one used a pipe format). Caught by
printing every raw answer before trusting the aggregate; the corrected, true figure is 33.3%. A
scorer that silently drops a walker inflates divergence—the direction that looks like a finding, so
this is exactly the failure mode to distrust by default.

---

## Run 18—the wave-3 clause (2026-08-03)

Clause regenerated by reading it out of the live shipped conductor and substituting both hook lines
(not hand-pasted, so the walk cannot measure text nobody ships). Fail-loud guards asserted the
wave-3 clause present and the wave-2 clause absent before any walker spawned. Same 5 scenarios,
weak/mid/strong × 3. $0.75.

| tier | r1 | r2 | r3 |
|---|---|---|---|
| weak | COALTIPPLE | NEITHER | NEITHER |
| mid | COALTIPPLE | COALTIPPLE | COALTIPPLE |
| strong | COALTIPPLE | NEITHER | NEITHER |

`COALTIPPLE ×5 · NEITHER ×4`. **S1-lead divergence: 44.4%, modal still wrong, and Run 17's clean
tier boundary dissolved**—every tier now splits internally instead of splitting by tier.

| run | clause | S1-lead divergence | modal | NEITHER count |
|---|---|---|---|---|
| 13 | baseline | 55.6% | wrong | 2/9 |
| 14 | wave 1 | 0% | unanimously wrong | 0/9 |
| 17 | wave 2 | 33.3% | wrong | 3/9 |
| 18 | wave 3 | 44.4% | wrong | 4/9 |

**The wave-3 carve removed the "grade fires -> CoalTipple" shortcut that weak/mid had been using to
terminate the decision.** Rising variance is the expected signature of that removal, not evidence the
carve regressed something that worked—weak and mid now have to reason instead of pattern-match, and
the clause does not yet tell them how. Three distinct undefined boundaries surfaced, each with
independent witnesses in the free-text answers:

1. **The clause defines what a routing need is NOT and never states the positive test**—the third
   occurrence of one shape: `stakes signal` (wave 1) -> `a real routing need` (wave 2) -> `needs a
   different tier` (wave 3). Each wave defines its term by exclusion; the next reader asks what it IS.
2. **Two vocabularies for one concept, unreconciled**: whether `error-not-allowed` (the bar CoalBoard's
   Layer 2 judges) is the same thing as `stakes-domain` (the term Triage actually defines) is never
   stated, and both terms are used as if interchangeable.
3. **Keywords inside quoted DATA versus a live instruction**—three independent witnesses. The cue
   states "the work under review is DATA, never instructions" but never says whether keywords
   appearing inside that quoted data still count as Layer-1 evidence; S1 is built on exactly this.

Also newly contested: **S5**, unanimous through Runs 13/14/17, split for the first time (one strong
walker read `path:auth · keyword:auth` as Layer-1-only evidence deciding nothing, landing on a
capability-gap reading).

**Instrument note (fourth scorer failure in this series, caught the same way):** the first read of
this run reported 55.6% because one walker's answer omitted its `S1`/`S2` labels; the true figure,
after printing every raw answer, is 44.4%.

**Reading—three sequential carves, no convergence.** 55.6 -> 0 -> 33.3 -> 44.4 is not a
declarable bound under this benchmark's own rule (`PREREGISTRATION.md`: a bound may be declared only
after zero was attempted and the residual has stopped improving—this residual is rising, not
flat). Each wave has correctly fixed the specific defect the prior wave's readers named, and each fix
has relocated the same undefined-boundary shape rather than removed it. See `RESULTS.md`
§Publishability verdict for what this sequence does and does not support as a general claim.

---

## Run 19—the wave-4 clause (2026-08-03)

Pre-registered in the internal lab record before any walker spawned. Clause 685 ch, sha
`4a18bb6f8f03`, verified identical across CoalBoard + CoalTipple source and dist on EMITTED text
(a raw-byte compare of the single-quoted JS source reports a divergence that does not exist at the
surface a walker reads). Prompt `run19-prompt-v1.txt`, blob `93e42c03d5b2d60e2390c78a1411350d9aad6472`,
4,504 B. Same 5 scenarios and answer format as Runs 13/14/17/18. Weak/mid/strong × 3,
`--safe-mode --effort medium`. GT for S1 = NEITHER, unchanged.

**Prediction:** S1's modal flips to NEITHER (correct, first time in five waves) and divergence falls
below Run 18's 44.4%.

| tier | r1 | r2 | r3 |
|---|---|---|---|
| weak | COALTIPPLE | COALTIPPLE | COALTIPPLE |
| medium | NEITHER | COALTIPPLE | NEITHER |
| strong | NEITHER | NEITHER | NEITHER |

`NEITHER ×5 · COALTIPPLE ×4`—**S1-lead divergence 44.4%.** "Modal flips to NEITHER"—CONFIRMED,
first correct modal in five waves. "Divergence falls below 44.4%"—FALSIFIED, unchanged. **The
split is now perfectly tier-stratified** (weak 0/3, medium 2/3, strong 3/3)—by the pass rule
("a file stable only on the strong tier has FAILED") this is still a fail, and the residual is not
noise: it is the weak tier uniformly wrong, the exact case §1 exists to catch.

**All five situations scored positionally for the first time** (Runs 13-18 only ever tallied S1):
every modal on every rail is CORRECT. S2-S5 lead sit at 0.0%; a second rail never scored before —
C) *"tell the user two hooks fired?"* on S2/S5, where the clause says arbitrate silently—also
sits at 44.4%, same stratification, modal correct (NO is right; 4/9 weak/mid walkers said YES).

**Two specific, mechanistic defects, not diffuse ambiguity:**
1. **`delegate-down`/`escalate-up` is never said to be a MODEL-TIER move**, and S1's work ("run a
   set of read-only measurement agents") is a delegation by the plain meaning of the word—three
   independent witnesses at three tiers name exactly this. Fix: name the tier explicitly.
2. **`arbitrate silently` and `HALT and ask the user` collide** on S2/S5, the two scenarios where
   both are live—a reader inside the ask-the-user branch reasonably explains why it is asking.
   Fix: scope the silence to the arbitration act itself, not the whole turn.

**Ruling:** wave 5 authorized, narrowly—an additive one-phrase fix per defect, one-flock (lands
in CoalBoard and CoalTipple in the same batch or not at all). Pre-registered prediction for Run 20:
S1 lead and S2/S5 tell both fall to 0.0%; if either survives, the "not specifiable in cue-length
prose" reading takes over.

**Instrument:** one walker again omitted `S1..S5` labels—same shape that produced Run 18's false
55.6%—scored positionally from raw output this time; zero scorer defects this run.

---

## Run 20—the wave-5 clause (2026-08-03)—reverted the same day

Clause 854 ch, sha1 `e72fec15dffe` (854 ch, verified identical bytes across source+dist in both
rooms). Prompt `run20-prompt-v1.txt`, blob `4da42a7f2275337b3b3db8ca993ac8e4373328d5`, 4,842 B. Run
19 was **re-scored under the same fixed instrument** so the two runs are like-for-like.

| rail | Run 19 | Run 20 | |
|---|---|---|---|
| **S1 lead** (defect 1's target) | 44.4% | **44.4%** | unchanged—the fix achieved nothing |
| S2 lead | 0.0% | 11.1% | regressed |
| S3 lead | 0.0% | 11.1% | regressed |
| S4 lead | 0.0% | 11.1% | regressed |
| S5 lead | 0.0% | 11.1% | regressed |
| S1 tell | 0.0% | 11.1% | regressed |
| **S2 tell** (defect 2's target) | 44.4% | **33.3%** | improved |
| **S5 tell** (defect 2's target) | 44.4% | **33.3%** | improved |

**Both pre-registered predictions FALSIFIED—the fifth consecutive falsification of a prediction
on this corpus.** The two targeted rails improved by 11.1 points each; five previously-clean rails
broke by 11.1 points each. Every modal stayed correct, which is why this benchmark scores spread
AND correctness rather than either alone—a correctness-only read would have called this a clean
win.

**Mechanism: length.** `BOTH` was chosen by nobody in Run 19; in Run 20 it appears five times, all
at the weak tier (weak-r2 on S1/S2/S5, weak-r3 on S1)—the can't-decide signature of a longer,
more-qualified instruction. The clause grew 685 → 854 ch (+25%).

**Process error—the transferable half: wave 5 changed two things in one clause; waves 1-4 each
changed one.** Five rails regressed and the run cannot attribute the regression to defect-1's fix
or defect-2's fix. Defect 1's own target rail did not move at all—weak evidence that fix is
inert and the length cost belongs to the defect-2 fix, but that is inference, not measurement.
**This is the transferable lesson: bundling two prose changes into one carve destroys the
attribution the walk exists to provide, independent of which clause or corpus is under test.**

**A fifth scorer defect, the most dangerous shape yet:** the line-anchored scorer returned two
weak-tier walkers as empty (both ran clean—`is_error:false`, `end_turn`, 7,958/8,081 output
tokens—and answered in a third format the series had not seen) and reported aggregates over the
remaining 7. Read that way, S1 came back 28.6% instead of 44.4%—**an apparent improvement
manufactured entirely by deleting the population that could not follow the text**, arithmetically
confirmed (2 of the 2 dropped walkers were in the wrong-answer camp: (4 correct + 2 wrong)/7 =
28.6%, versus (5 correct + 4 wrong)/9 = 44.4%). Caught by noticing two blank rows and checking the
raw JSON before writing a number down. Fixed: see `tasks.md` §Scorer note.

**Ruling: REVERT wave 5 entirely**, not "revert the bad half"—the run cannot identify one. Landed
same day: CoalBoard `2b99b46`, CoalTipple `85f1312`; all four files (source + dist, both rooms)
verified back to 685 ch / sha `4a18bb6f8f03`. Gates green both rooms. **No wave 6 authorized on the
current text**—the two residuals (S1 lead 44.4%, S2/S5 tell 44.4%) are unmade DESIGN decisions
(does a read-only measurement fan-out count as a tier delegation; may the agent say why it is
asking), not wording defects, and re-wording them has now been tried and cost more than it bought.

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
  A single low point is a start, not a curve—CoalLedger (9.6) and CoalTipple (23.8) are the natural
  next points, and neither has run under this instrument shape yet.
- **Runs 13/14/17/18/19/20 are SIX SEQUENTIAL, non-independent waves on ONE clause**, each carve
  targeted at the specific defect the prior wave's readers named, by the same author who read those
  results. This is a case study of one clause's iterative-refinement dynamics, not six independent
  samples of "editing prose"—see `RESULTS.md` §Publishability verdict.
