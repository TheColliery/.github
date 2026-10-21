# Skill-prose determinism—results

**Measured:** 2026-07-31 through 2026-10-18 (last updated 2026-10-22) · **Platform:** Claude Code ·
**Engine:** claude-haiku / claude-sonnet / claude-opus, by tier alias; exact model ids were not recorded
per run · **Target:** CoalBoard / CoalTipple / CoalWash / CoalFace `SKILL.md` bodies, three CoalMine
canaries (`rot-canary`, `gold-standard`, `source-grounding`), and the CT↔CB hook-injected coordination
cue. Each row names the blob it walked in the detail record; a result is a snapshot of that blob, not of
the skill today (§Coverage today).
**Detail + raw prompts:** [`results/2026-08-03-skill-determinism-walks.md`](results/2026-08-03-skill-determinism-walks.md)
(Runs 11–20) · [`results/2026-10-22-skill-determinism-walks-21-46.md`](results/2026-10-22-skill-determinism-walks-21-46.md)
(Runs 21–46 and two later walks) · [`tasks.md`](tasks.md) · **Pre-registered** before the
hypothesis-test run: [`PREREGISTRATION.md`](PREREGISTRATION.md)

Measures the half of a shipped skill nothing else checks: whether independent readers extract the
SAME set of directives from the SAME prose, read once each, under Claude Code's own locked method
(3 model tiers, repeated identical rounds, per SKILL.md edit). **This is agreement, not correctness —
Run 14 is the result that makes the distinction binding: a text reached zero variance while every
reader agreed on the wrong answer.**

## TL;DR

| Run | What was walked | Instrument | Headline (MAX, pooled) | Modal answer correct? |
|---|---|---|---|---|
| 11 | CoalTipple, routing-OFF lane | lane execution | FAIL at weak tier (3 rails split) | n/a—3-way split, no clean modal |
| 12 | CoalBoard, lane selection | lane selection | **67%** | strong tier split 2:1, itself |
| 13 | CT↔CB hook cue, before carve | coordination cue | **55.6%** | **NO**—modal was CoalBoard on a NEITHER case |
| 14 | CT↔CB hook cue, after carve 1 | coordination cue | **0%** on the lead rail (33.3% MAX, pooled with the action rail) | **NO**—unanimously wrong, action rail regressed |
| **15** | CoalMine `rot-canary` (index 12.0) | prose-index test | **0%** on all 4 predicted rails · **33.3%** on 1 emergent rail | **YES**, on every scored rail |
| 17 | CT↔CB hook cue, after carve 2 | coordination cue | **33.3%**, tier-stratified (weak+mid wrong, strong correct) | **NO**—6 of 9 readers still wrong |
| 18 | CT↔CB hook cue, after carve 3 | coordination cue | **44.4%**, tier boundary dissolved | **NO**—5 of 9 readers still wrong |
| 19 | CT↔CB hook cue, after carve 4 | coordination cue | **44.4%** on S1-lead, unchanged | **YES**—first correct modal in 5 waves; still fails §3b (weak tier 0/3) |
| 20 | CT↔CB hook cue, after carve 5—**REVERTED same day** | coordination cue | 2 target rails 44.4%→33.3%, 5 clean rails 0%→11.1% | YES, but 5 of 9 lead rails newly wrong |

**The CT↔CB corpus across six sequential carves: 55.6% → 0% → 33.3% → 44.4% → 44.4% → (regressed,
reverted).** Wave 4 (Run 19) is the best-measured state in the series—first correct modal, 4 of 5
lead rails at 0.0%—and is what ships today. Wave 5 (Run 20) traded a length increase for two
targeted rails while breaking five clean ones and was reverted the same day in both rooms. See
§Publishability verdict below for what this sequence does and does not support.

### Runs 21–46 and two later walks (added 2026-10-22; shapes as in `tasks.md`, never pooled across shapes)

Headline = MAX divergence across the scored rails of the run, pooled across tiers (N = 9 unless stated).
"Modal correct?" is against the key named in the detail record. 24 of the lab record's 26 runs in this
range are tabled; Runs 32 and 33 are not, and the detail record's §Not tabled says why.

| Run | What was walked | Shape | Headline | Modal correct? |
|---|---|---|---|---|
| 21 | CoalBoard, lane selection, baseline | 2 | **33.3%** on S4 (other rails 0–11.1%) | **NO** on S4 |
| 22 | same, after one carve | 2 | S4 33.3% → **0%**; every rail 0% | YES |
| 23 | CoalTipple, routing-OFF lane, baseline + 2 waves | 1 | target rail 33.3% → **0%**; wave 1 added a flagged dangling clause (55.6%), cut in wave 2; one 33.3% residual declared | YES (key = the ruling the carve set) |
| 24 | CoalWash, consent-gate count | 5 | spread 5–12, no modal → **0%** (10 × 9) after one wave; prohibitions (18–41) not re-scored | n/a (key = the new ledger) |
| 25 | CoalBoard, post-verdict disposition, baseline | 2 | **44.4%** (S2), 33.3% (S4, count) | **NO** on S3 (9 of 9 ACT; key declared with the fix) |
| 26 | same, new ledger | 2 | **0%** on every rail | YES |
| 27 | CoalWash, prohibitions list, baseline + 2 waves | 5 | ~100% → 66.7% → **55.6%** (modal 49) | no external key; bound declared |
| 28 | CoalBoard disposition, findings-back | 2 | **0%** on every rail | YES |
| 29 | CoalWash, completeness-header experiment | 5 | **55.6%** (modal 49), the same percentage as Run 27 wave 2, bimodal; the claim was false; reverted | modal = walked table's row count; true count higher |
| 30 | CoalWash, three gaps closed | 5 | **33.3%** (modal 51; weak + medium 6 of 6) | YES vs the walked table; bound declared |
| 31 | CoalFace, first walk, baseline + 1 carve | 5 | prohibitions 66.7% → **0%**; consent gates 33.3% → **0%** | **NO** on gates at baseline (modal 1, key 2); YES after |
| 34 | CoalMine `rot-canary`, baseline | 5 | MAX **88.9%** (fail paths); weak tier's gate count identical 3 of 3 over **two different sets, one holding a non-gate** | gates modal = key, weak tier 0 of 3 |
| 35 | `rot-canary` Fix-mode rail, both lanes | 5 | hook **11.1%** · agent **55.6%** | modal = firm count; attribution to the carve not answerable |
| 36 | `gold-standard`, agent lane + definition arm | 5 | MAX **77.8%**; one **0%** rail; the definition left Q1 at 66.7% | modal above the key band |
| 37 | `gold-standard`, hook lane | 5 | MAX **77.8%**; 3 of 5 rails identical to Run 36 | as Run 36 |
| 38 | `gold-standard`, post-carve, both lanes | 5 | prohibitions 77.8% → **0%** in both lanes; MAX 55.6% (output rail, instrument scope) | YES on carved rails; two residues attributed to key or instrument |
| 39 | `source-grounding`, baseline | 5 | agent gates **11.1%**; hook gates **66.7%**, tier-stratified | hook modal = key, 3 of 9 |
| 40 | same, after one footer clause | 5 | manufactured strong-tier gate **3 of 3 → 0 of 18**; hook gates 66.7% → 44.4% | prediction confirmed |
| 41 | same blob, **null control** | 5 | **noise floor: 2 walkers of 9 = 22.2 points** | n/a |
| 42 | `source-grounding`, post-carve | 5 | prohibitions **0%** both lanes, hook gates **0%**, agent gates 0% (at the floor) | YES; readers found two ledger defects |
| 43 | `source-grounding`, output + degrade rails only | 5 (scoped) | output **11.1%** both lanes (8 of 9 correct); degrade 66.7% / 44.4%, not fixed | output YES; hook degrade 0 of 9 (bimodal) |
| 44 | CoalBoard lane selection, baseline + null control | 2 | trigger-count rail **77.8%**, identical in two independent draws | **NO** (modal 4, key 3) |
| 45 | same, after one carve (blob never shipped) | 2 | trigger-count rail **0%** | YES (superseded) |
| 46 | same, at the committed blob | 2 | trigger-count rail **0%**; all other rails 0% | YES |
| OW-1 | CoalWash consent ledger and hand-off rows, 2026-09-25 | 6 | **0%** on all six rails (9 of 9) | YES |
| OW-2 | CoalWash keeps-refusal row, 2026-10-18 | 6 | **0%** on all rails (9 of 9) | YES |

OW-1 and OW-2 are categorical readings of edited rows with a key written first and no null control; they
are not variance deltas. Read each row with its detail section: a number alone omits the abnormal subjects
(a destroyed first attempt, lost leaves re-run, a refused reader), which are named there.

## Coverage today (2026-10-22): what has and has not been walked

A walk certifies one blob. This table states, for each shipped `SKILL.md` that has been walked, the last
walk, and how many commits have touched the file since (re-derive: `git log <blob's commit>..origin/main
--oneline -- <path>` in the room; counts are of `origin/main` on 2026-10-22). **A commit count measures
exposure, not behaviour change**: many are version, regeneration or documentation commits, but a
one-sentence documentation edit changed a walked rail in Run 23.

| Shipped file | Last three-tier walk (run · date · blob) | What that walk covered | Commits to the file since | Today's blob |
|---|---|---|---|---|
| CoalBoard `skills/coalboard/SKILL.md` | Run 46 · 2026-08-16 · `0f07fdb3` | lane selection and the auto-trigger count; opinion-lane disposition last at Run 28 · 2026-08-04 · `1d1afeee` | **23** | `e235c92d` |
| CoalTipple `skills/coaltipple/SKILL.md` | Run 23 · 2026-08-03 · `cc8c5fdd` | the routing-OFF lane only; all four lanes last at Run 11 · 2026-07-31 · `28484766` | **14** | `b0e32af1` |
| CoalWash `skills/coalwash/SKILL.md` | Run 30 · 2026-08-04 · `33e14750` (prohibitions count); later scoped walks OW-1 · 2026-09-25 · `f4c28cee` and OW-2 · 2026-10-18 · `83e4495a` | consent count (Run 24), prohibitions (Runs 27–30), the consent ledger, hand-off and ladder rows (OW-1), one keeps-refusal row (OW-2) | **12** since Run 30's blob | `83e4495a` (= OW-2's blob; OW-2 read one row) |
| CoalFace `skills/coalface/SKILL.md` | Run 31 · 2026-08-04 · `e977fafb` | prohibitions and consent gates; output-location and fail-path ledgers never scored | **22** | `761b545c` |
| CoalMine `plugin/skills/rot-canary/SKILL.md` | Run 35 · 2026-08-04 · `9a83c510` | the Fix-mode consent rail, both lanes; other rails last at Run 34 on an older blob | **22** | `7995baed` |
| CoalMine `plugin/skills/gold-standard/SKILL.md` | Run 38 · 2026-08-04 · `a21508ee` | five rails, both lanes (a same-day footer change moved the blob to `38ec8986`, not re-walked) | **15** | `d34ba6a2` |
| CoalMine `plugin/skills/source-grounding/SKILL.md` | Run 43 · 2026-08-05 · `bcc08f3e` | output and degrade rails; the other three rails at Run 42 | **10** | `6c0dd9c6` |
| CoalMine, six other canaries (`drift-canary`, `resilience-audit`, `scale-canary`, `supply-chain-audit`, `telemetry-canary`, `testability-canary`) | none | none | n/a | n/a |
| CoalLedger (seven `doc-*` skills) | none | none | n/a | n/a |
| CoalHearth | no `SKILL.md` in the room (the zero-prose control of the prose-index table) | n/a | n/a | n/a |
| CT↔CB hook-injected cue | Run 19 · 2026-08-03 (shipped clause 685 characters, sha `4a18bb6f8f03`) | the corpus of Runs 13–20 | not re-derived | not re-derived |

**What this table does not claim.** The CoalTipple and CoalWash counts confirm the hypothesis that a
walked body has been edited many times since its last walk: 14 commits to CoalTipple's file and 12 to
CoalWash's since 2026-08-05 (re-derived 2026-10-22), and no walk of either appears in the lab record after
Runs 23 and 30. The shipped bodies are therefore **not** walked today, except where the table names a
scoped later walk; upper-tier-only check-walks run in October on the CoalBoard file are not counted as
walks (§Not tabled in the detail record). For CoalWash, the room's own reading on 2026-10-21 was that
seven of its twelve commits changed rows no walk record covers; that reading is the room's, and is not
re-derived here. A walk that follows each edit is the standing method of this benchmark
([`PREREGISTRATION.md`](PREREGISTRATION.md)); this table is where it has not yet been followed up.

## The prose-index, independently re-derived (2026-08-03, script over the live tree)

*Dated snapshot of 2026-08-03; **not re-derived for this update.** The skill bodies of six of the seven
rooms below have been edited since (all but CoalHearth, which has none), so the figures describe the
2026-08-03 trees.*

`index = prose chars (SKILL.md + references/*.md, frontmatter stripped) / non-test code lines`

| room | index | test/code ratio |
|---|---|---|
| CoalBoard | **83.3** | 0.75 |
| CoalFace | **41.3** | 1.01 |
| CoalTipple | **23.8** | 0.95 |
| CoalMine | **12.0** | 0.87 |
| CoalLedger | **9.6** | 0.62 |
| CoalWash | **6.3** | 1.53 |
| CoalHearth | **0** | 1.54—no `SKILL.md` anywhere in the room; the zero-prose control |

**The hypothesis:** walk-variance risk scales with the prose-index. **Before Run 15, two points, both
at the high end** (CoalBoard ~83, the un-indexed-but-prose-scattered hook cue), both failing—not a
test of a line, a test of one side of it. **Run 15 is the first low-index point (12.0), and its
prediction—locked in `PREREGISTRATION.md` before firing—held on all four named rails at 0%
variance.**

**The refinement the data actually supports:** index alone is not the whole mechanism—a low-index
file still wobbled, at 33.3%, on the ONE rail its own structure leaves un-numbered (a conditional
`ask_question` point sitting outside the file's two enumerated ones). **Enumerability—does a rail
have a labeled, countable home—is the variable underneath the index correlation, and Run 15 shows
both effects in one dataset:** overall stability tracks the index, and the residual wobble tracks the
one un-enumerated seam.

## What this does NOT show

- **The curve has one low point.** CoalLedger (9.6) and CoalTipple (23.8) are the next natural targets
  under this same instrument; a single confirming point is a start, not a fitted line. No Shape-4 run
  has been made since Run 15.
- **No walker is decorrelated from the room's own governance**—the platform injects it at spawn
  regardless of "blind" framing, and a walk in September measured a path-gated rule file reaching 5 of 9
  leaves that were configured to omit instruction files (OW-1). Agreement across walkers proves the text
  is internally consistent to read; it does not prove the room's design is correct.
- **Small N** (3 per tier). A 1-in-3 split is real signal at this scale, not a population rate.
- **Six instrument shapes, never pooled**—a 55.6% on the hook-cue instrument and a 33.3% on a
  SKILL.md instrument share a formula, never a combined score. Shape 5 (count walks) reports a count and a
  list; a divergence there is about counting, and is not a measure of whether the readers would act the
  same way.
- **One program, one author.** Every carve was written by the party that had read the previous walk,
  against scenario sets reused between waves. A prediction written before the walkers is recorded for
  Runs 29, 30 and 38–43; the record shows none for the other runs in the range.
- **The noise floor is one measurement.** 22.2 points (2 of 9) comes from one repeat of one instrument on
  one skill (Run 41). Most rows have no null control; Run 44's two draws are a second repeat, for one rail.
- **Exact model ids and tool versions were not recorded per run.** A re-run on a later model is a new
  measurement.
- **Several keys were declared alongside the fix, amended when the walked text changed, or wrong** (Runs
  25, 38, 40); each is stated in the detail record and none was rescored.
- **Some walked blobs never shipped** (Runs 23 wave 1, 27 wave 1, 29, 45); the detail record says which.

## Publishability verdict—the CT↔CB corpus (Runs 13/14/17/18/19/20), updated 2026-08-03 by the third benchmark deputy

**Runs 19 and 20 closed the loop this corpus's own §Publishability verdict opened.** Both were
pre-registered before firing (condition 3 of the four below, now satisfied for the first time on
this corpus), and Run 19 supplied the corpus's first correct modal answer in five waves. That does
**not** upgrade Claim 2 below—conditions 1, 2 and 4 (a different clause/author, fresh scenarios, a
different room) are still unmet, and Runs 19/20 are the fifth and sixth point in the SAME case
study, not a second corpus. Three narrower items from this pair of runs stand on their own,
independent of Claim 2's cross-corpus bar, for the same reason Claim 1 does—each is a single
measured instance with a scored ground truth, not a claim about prose-editing in general:

- **A targeted carve can improve its two target rails while regressing five previously-clean
  ones, in the same run.** Run 20 vs Run 19: S2/S5-tell fell 44.4%→33.3% (the carve's own targets)
  while S2/S3/S4/S5-lead and S1-tell rose 0.0%→11.1% (untouched rails). The mechanism is visible and
  measured, not inferred: the clause grew 685→854 ch (+25%), and `BOTH`—chosen by no walker in Run
  19—appears five times in Run 20, all at the weak tier, the can't-decide signature of a longer,
  more-qualified instruction. **Publishable as an existence proof** (a targeted fix traded breadth
  for depth, at a measured length cost)—not as a general rate at which this happens.
- **Bundling two independent prose fixes into one carve destroys attribution, and this is a
  methodology finding, not a data finding—it needs no second corpus to be true.** Wave 5 changed
  two things (name the tier; scope the silence) in one clause; waves 1-4 each changed one. Five
  rails regressed and the run structurally cannot say which fix caused it—defect-1's own target
  rail (S1-lead) did not move at all, which is *weak* evidence the length cost is the other fix's,
  but that is inference, not measurement, precisely because the design confounded the two. This is
  main's process error to own (main authorized the bundled carve), not the builder's.
- **The instrument itself produced a fifth defect, and this one manufactures improvement rather
  than noise—the strongest and most transferable of the three.** The line-anchored scorer
  returned two weak-tier walkers as empty (both ran clean: `is_error:false`, `end_turn`,
  7,958/8,081 output tokens, a third answer format the series had not seen) and reported aggregates
  over the remaining 7. Read that way, S1 came back **28.6% instead of 44.4%**—arithmetically
  confirmed as an artifact, not a rounding quirk: both dropped walkers were in the wrong-answer
  camp, so (4 correct + 2 wrong)/7 = 28.6% versus the true (5 correct + 4 wrong)/9 = 44.4%. **A
  scorer that silently shrinks its denominator when it cannot parse an answer moves the number in
  the direction that looks like success, and it does so precisely on the rail measuring whether the
  weak tier can follow the text at all**—the population most likely to fail is the population
  most likely to be dropped. This is not bound to this clause, this corpus, or even this benchmark:
  any scorer assuming a fixed answer shape carries the same risk. Fixed the same day (`tasks.md`
  §Scorer note): the replacement scorer is format-agnostic and refuses to aggregate unless all N
  walkers parse. **Publishable now, independent of any second corpus—it is an infrastructure
  finding, verified by re-reading raw output, not an empirical claim requiring replication.**

**Two claims live in this corpus. They carry different strength and must not be quoted with the same
confidence.**

**Claim 1—agreement and correctness are different axes; a text can become MORE deterministic while
becoming MORE wrong.** Run 14 alone establishes this: 55.6% variance → 0% variance, modal answer
unchanged from wrong to wrong. **PUBLISHABLE, at the strength already used above and in `README.md`.**
It needs only one clean before/after pair with a scored ground truth, and Run 14 is exactly that,
independently reproducible against the pinned blobs in `tasks.md`. This is the strongest single
result in the whole benchmark and the one worth leading with.

**Claim 2—sequential, targeted revision of a single clause does not reliably converge either
number.** Six waves, one clause, same 5 scenarios: 55.6 → 0 → 33.3 → 44.4 → 44.4 → (regressed,
reverted). The modal answer was wrong in the first four and correct in the fifth (Run 19)—the
loop's first correct modal—but the sixth wave (Run 20) traded that gain for five newly-broken
clean rails and was reverted the same day, so the corpus's SHIPPED state is Run 19's, still failing
§3b on the weak tier. This is real and it is honestly measured—but it is **NOT the same strength of
claim as Claim 1**, for reasons specific to how the corpus was built, not to the number itself:

- **The waves are not independent trials.** Each carve was a targeted patch for the specific
  undefined term (or, from Run 19 on, the specific named mechanism) the PRIOR wave's readers
  surfaced, written by the same author who read those results. That is good iterative practice —
  each fix demonstrably closed or narrowed the defect it targeted—but it means "six waves" is not
  six draws from "how does prose editing generally affect determinism." It is one author's guided
  walk down one clause's defect tree, and the tree turned out deeper than the walk's own §3b method
  anticipated when it wrote the pass rule.
- **The scenario set was reused, not resampled, across all six waves.** By Run 20 the clause has
  been iterated against the same fixed 5 situations five times. A rail that now reads cleanly on
  those five scenarios has not been shown to read cleanly on a fresh set—this is the same
  overfitting risk as tuning against a fixed validation set, and it has not been controlled for here.
- **The predicted trajectory has now been wrong on every wave since Run 17—four in a row.** The
  wave-2 carve predicted the correct answer would stabilize at the weak tier; it landed at strong
  instead (Run 17). The wave-3 carve predicted variance would fall and the modal would flip to
  correct; neither happened (Run 18). The wave-4 carve predicted divergence would fall below 44.4%;
  the modal flipped correct but divergence held exactly at 44.4% (Run 19). The wave-5 carve
  predicted both residual rails would reach 0.0%; instead five other rails broke (Run 20). Four
  falsified predictions in a row is honest evidence the authors do not have a working model of *why*
  this specific clause resists convergence—which means the "targeted carve" method itself remains
  unproven here, not just the clause. **Runs 19/20 additionally identified WHY, mechanistically, for
  the first time:** the two residual rails are not wording defects at all but two unmade product
  decisions (does a read-only measurement fan-out count as a model-tier delegation; may the agent
  state why it is asking)—no wave of re-wording can close a boundary the product itself has not
  drawn, which is a candidate explanation for why five wording-only waves never converged.

**So: Claim 2 is reported, not asserted as a general law.** The honest sentence is *"across six
sequential, non-independent waves on one hook-injected clause, in one corpus, variance did not
converge toward zero and the modal answer did not converge to a passing state (one wave reached a
correct-but-still-failing modal, the next regressed and was reverted)—this is evidence that
`divergence -> 0` is an unreliable stopping criterion on its own, not evidence about prose-editing
generally."* That sentence is true, cites its own bound, and does not overreach.

**What a second corpus needs, to promote Claim 2 past a case study—three of four conditions still
open:**
1. **A different clause or `SKILL.md`, ideally not iterated by the same author reading the same walk
   output between rounds**—still open. Runs 19/20 are the fifth and sixth wave on the SAME clause
   by the SAME author.
2. **Fresh scenarios per wave**, or at minimum a held-out scenario set scored only at the end—still
   open. The same 5 situations have now been reused six times.
3. **A pre-registered prediction for every wave, not only the first**—**CLOSED by Runs 19 and 20.**
   Both predictions were written into the lab record and committed before their walkers fired, and
   both were reported as falsified rather than quietly revised after the fact.
4. Ideally a clause from a **different room or different author's skill**—still open.

**Disposition (reaffirmed 2026-08-03 by the third benchmark deputy):** ship Claim 1 as-is (already
at the right strength). Ship Claim 2 as a bounded case study with the six numbers and the
non-convergence stated plainly, including the wave-4 partial success and the wave-5 revert—do not
round it up to "prose carving doesn't work," "the walk method needs a redesign," or "the corpus
converged." One condition of the second-corpus bar (pre-registration on every wave) is now met by
this same corpus; that strengthens the METHOD's discipline, not Claim 2's generality—the other
three conditions require a genuinely different clause and scenario set. Docket a second corpus per
the (now three, not four) open conditions above before either of those stronger claims is written
anywhere.

### Update 2026-10-22—what Runs 21–46 add, at the strength they support

**Claim 1 stands and has more instances.** A text can be unanimous or near-unanimous and wrong, or
stable in count and wrong in membership: Run 21 (S4), Run 25 (S3, 9 of 9 ACT with no condition named),
Run 31 (consent gates, modal 1 against 2), Run 34 (the weak tier's identical count of 2 over two
different sets, one holding a non-gate) and Run 44 (the trigger count, 4 against 3, identical across two independent draws).

**Claim 2 is not extended, and is not contradicted.** It was written about one hook-injected clause. The
later runs walk `SKILL.md` bodies in five rooms, mostly by the same author and with reused scenarios, so
they do not meet conditions 1 and 2 (a different author, fresh scenarios), and condition 3 (a prediction
before every wave) is met for Runs 29, 30 and 38–43 only. What they show, as a description of this
program and not a rate: a **declared, numbered ledger for a countable rail reached 0% on its target rail
within one or two waves in most carves** (Runs 22, 24, 26, 31, 38 prohibitions, 42 gates and
prohibitions, 45), and did not
in others (the CoalWash prohibitions list stayed at a declared 33.3%, Runs 27–30; the CoalTipple
"Always" residual stayed at 33.3%; the `source-grounding` degrade ledger was still open after two
re-walks, Runs 42–43). That is the opposite tendency to the hook cue's, and it is **consistent with**,
not shown to be caused by, the explanation Runs 19 and 20 gave for the cue: its residual rails were
product decisions the cue could not state, not wording defects. Two of the ledger carves also failed in
their own way when the ledger itself was wrong (below).

**New findings, each a single measured instance with its raw record, publishable as existence proofs and
not as rates:**

- **A stable count can hide unstable membership** (Run 34). A pass bar of count alone would have scored
  the worst rail in the run as its best.
- **A noise floor can be measured, and one repeat gave 22.2 points** for one instrument on one skill
  (Run 41). The same run showed four of ten cells changing their modal answer with the text unchanged,
  two at an unchanged agreement count: **report the modal answer with every divergence.**
- **A false completeness claim in a ledger header produced a bimodal split** that the divergence number
  could not tell from honest ambiguity (Run 29): the weak tier transcribed the table and converged, and
  the strong tier distrusted the claim, re-read the file and found the real omissions.
- **A ledger can be wrong, and the readers can be right** (Runs 42 and 43): a declared total counted a
  non-event as an item, and a lane column sorted a row whose real condition was a mode. Auditing a row's
  type is not enough; the axis a column sorts on has to be audited too.
- **A shared footer sentence can manufacture a gate the skill does not have, and a declared ledger
  displaced it** (Runs 37–40): in `gold-standard` two of three weak hook walkers built a gate from a promise
  of a menu the skill does not define, and 0 of 9 did after a numbered ledger (Run 38); in
  `source-grounding` all three strong hook walkers built a gate from an unconditional "never fix without a
  chosen option", and 0 of 18 walkers did after one clause was scoped (Run 40).
- **The weak tier did not see a gate stated only in a footer** (0 of 6, Run 35; 0 of 3, Run 36; one weak
  walker in Run 39). It is the same gate position in three skills.
- **A walked blob is not always the shipped blob** (Runs 29, 45): re-walk at the committed text, and say
  which hash convention a stamp uses.
- **Leaves configured to omit instruction files can still receive a path-gated rule file on a read**
  (OW-1: 5 of 9). It matters for any walk whose answers are judgement calls.

**Disposition (2026-10-22):** unchanged for Claims 1 and 2 as stated above. Do not write "ledger carves
converge" as a general claim; write the descriptive sentence with its counts and its bounds. Do not write
that the shipped bodies are walked: §Coverage today says which are, and for how much of each.

## Novelty—a separate, weaker claim

A market survey (2026-08-01, ~18 candidates, full table in the internal record) found no tool doing
all four of: tests a *shipped instruction file* for *determinism across repeated identical reads*
*across model tiers* as a *shipping gate*. Closest: Anthropic's own skill-authoring best-practices
page (3/4—recommends testing "with all the models you plan to use it with", and states outright
*"There is not currently a built-in way to run these evaluations."*). **Stated as "not found in a
real search", never as "nobody does this"**—enterprise/closed-source practice is invisible to a
public search by construction.

## Next arm (not run)

*Revised 2026-10-22.* Of the arm written on 2026-08-03: `rot-canary` has since been walked on five rails
(Run 34) and its Fix-mode rail (Run 35), but its original un-numbered conditional ask (the Run 15 seam)
was not re-tested by name; CoalTipple was walked under Shape 1, not Shape 4; **CoalLedger has not been
walked, and no Shape-4 run has been made since Run 15.** What is next, in the order the data argues for:

1. Walk again every body whose last walk is older than its last edit (§Coverage today) before any
   statement that the shipped bodies are walked: CoalTipple (14 commits since its last walk), CoalBoard
   (23), CoalFace (22), CoalWash (12), the three walked CoalMine canaries (10–22), and the six CoalMine
   canaries and seven CoalLedger skills that have never been walked.
2. Run a null control on more than one instrument and skill, so the noise floor is not one number from one
   place.
3. Hold out a scenario set, scored only at the end, on one skill whose carve is written by someone who has
   not read its walks (the remaining open conditions of Claim 2).
4. Place CoalLedger and CoalTipple on the prose-index curve (Shape 4).

**The CT↔CB corpus is CLOSED—no wave 6 is authorized on the current text** (as of 2026-08-03; no later
wave appears in the record). Runs 19 and 20 ran,
and Run 20 was reverted the same day back to Run 19's clause (685 ch, sha `4a18bb6f8f03`), which is
what ships. The two residual rails (S1-lead 44.4%, S2/S5-tell 44.4%) are named as unmade product
decisions, not wording defects—a cue cannot specify a boundary its own product has not drawn.
Both return to the room's owner as a design question, not to a seventh wave of prose. The priority
ahead of any further work on this corpus is a **second, independent corpus**—a different clause
(or a different room's skill) walked with fresh, unreused scenarios—since a further wave on the
same clause and scenario set adds another point to a case study that already has six, not evidence
toward the general claim.
