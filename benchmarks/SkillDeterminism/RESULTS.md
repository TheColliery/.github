# Skill-prose determinism — results

**Measured:** 2026-07-31 through 2026-08-03 · **Platform:** Claude Code · **Engine:** claude-haiku /
claude-sonnet / claude-opus (per-tier, see each run) · **Target:** installed CoalBoard / CoalTipple /
CoalMine `SKILL.md` bodies + the CT↔CB hook-injected coordination cue.
**Detail + raw prompts:** [`results/2026-08-03-skill-determinism-walks.md`](results/2026-08-03-skill-determinism-walks.md)
· [`tasks.md`](tasks.md) · **Pre-registered** before the hypothesis-test run: [`PREREGISTRATION.md`](PREREGISTRATION.md)

Measures the half of a shipped skill nothing else checks: whether independent readers extract the
SAME set of directives from the SAME prose, read once each, under Claude Code's own locked method
(3 model tiers, repeated identical rounds, per SKILL.md edit). **This is agreement, not correctness —
Run 14 is the result that makes the distinction binding: a text reached zero variance while every
reader agreed on the wrong answer.**

## TL;DR

| Run | What was walked | Instrument | Headline (MAX, pooled) | Modal answer correct? |
|---|---|---|---|---|
| 11 | CoalTipple, routing-OFF lane | lane execution | FAIL at weak tier (3 rails split) | n/a — 3-way split, no clean modal |
| 12 | CoalBoard, lane selection | lane selection | **67%** | strong tier split 2:1, itself |
| 13 | CT↔CB hook cue, before carve | coordination cue | **55.6%** | **NO** — modal was CoalBoard on a NEITHER case |
| 14 | CT↔CB hook cue, after carve 1 | coordination cue | **0%** on the lead rail (33.3% MAX, pooled with the action rail) | **NO** — unanimously wrong, action rail regressed |
| **15** | CoalMine `rot-canary` (index 12.0) | prose-index test | **0%** on all 4 predicted rails · **33.3%** on 1 emergent rail | **YES**, on every scored rail |
| 17 | CT↔CB hook cue, after carve 2 | coordination cue | **33.3%**, tier-stratified (weak+mid wrong, strong correct) | **NO** — 6 of 9 readers still wrong |
| 18 | CT↔CB hook cue, after carve 3 | coordination cue | **44.4%**, tier boundary dissolved | **NO** — 5 of 9 readers still wrong |
| 19 | CT↔CB hook cue, after carve 4 | coordination cue | **44.4%** on S1-lead, unchanged | **YES** — first correct modal in 5 waves; still fails §3b (weak tier 0/3) |
| 20 | CT↔CB hook cue, after carve 5 — **REVERTED same day** | coordination cue | 2 target rails 44.4%→33.3%, 5 clean rails 0%→11.1% | YES, but 5 of 9 lead rails newly wrong |

**The CT↔CB corpus across six sequential carves: 55.6% → 0% → 33.3% → 44.4% → 44.4% → (regressed,
reverted).** Wave 4 (Run 19) is the best-measured state in the series — first correct modal, 4 of 5
lead rails at 0.0% — and is what ships today. Wave 5 (Run 20) traded a length increase for two
targeted rails while breaking five clean ones and was reverted the same day in both rooms. See
§Publishability verdict below for what this sequence does and does not support.

## The prose-index, independently re-derived (2026-08-03, script over the live tree)

`index = prose chars (SKILL.md + references/*.md, frontmatter stripped) / non-test code lines`

| room | index | test/code ratio |
|---|---|---|
| CoalBoard | **83.3** | 0.75 |
| CoalFace | **41.3** | 1.01 |
| CoalTipple | **23.8** | 0.95 |
| CoalMine | **12.0** | 0.87 |
| CoalLedger | **9.6** | 0.62 |
| CoalWash | **6.3** | 1.53 |
| CoalHearth | **0** | 1.54 — no `SKILL.md` anywhere in the room; the zero-prose control |

**The hypothesis:** walk-variance risk scales with the prose-index. **Before Run 15, two points, both
at the high end** (CoalBoard ~83, the un-indexed-but-prose-scattered hook cue), both failing — not a
test of a line, a test of one side of it. **Run 15 is the first low-index point (12.0), and its
prediction — locked in `PREREGISTRATION.md` before firing — held on all four named rails at 0%
variance.**

**The refinement the data actually supports:** index alone is not the whole mechanism — a low-index
file still wobbled, at 33.3%, on the ONE rail its own structure leaves un-numbered (a conditional
`ask_question` point sitting outside the file's two enumerated ones). **Enumerability — does a rail
have a labeled, countable home — is the variable underneath the index correlation, and Run 15 shows
both effects in one dataset:** overall stability tracks the index, and the residual wobble tracks the
one un-enumerated seam.

## What this does NOT show

- **The curve has one low point.** CoalLedger (9.6) and CoalTipple (23.8) are the next natural targets
  under this same instrument; a single confirming point is a start, not a fitted line.
- **No walker is decorrelated from the room's own governance** — the platform injects it at spawn
  regardless of "blind" framing. Agreement across walkers proves the text is internally consistent to
  read; it does not prove the room's design is correct.
- **Small N** (3 per tier). A 1-in-3 split is real signal at this scale, not a population rate.
- **Four instrument shapes, never pooled** — a 55.6% on the hook-cue instrument and a 33.3% on a
  SKILL.md instrument share a formula, never a combined score.

## Publishability verdict — the CT↔CB corpus (Runs 13/14/17/18/19/20), updated 2026-08-03 by the third benchmark deputy

**Runs 19 and 20 closed the loop this corpus's own §Publishability verdict opened.** Both were
pre-registered before firing (condition 3 of the four below, now satisfied for the first time on
this corpus), and Run 19 supplied the corpus's first correct modal answer in five waves. That does
**not** upgrade Claim 2 below — conditions 1, 2 and 4 (a different clause/author, fresh scenarios, a
different room) are still unmet, and Runs 19/20 are the fifth and sixth point in the SAME case
study, not a second corpus. Three narrower items from this pair of runs stand on their own,
independent of Claim 2's cross-corpus bar, for the same reason Claim 1 does — each is a single
measured instance with a scored ground truth, not a claim about prose-editing in general:

- **A targeted carve can improve its two target rails while regressing five previously-clean
  ones, in the same run.** Run 20 vs Run 19: S2/S5-tell fell 44.4%→33.3% (the carve's own targets)
  while S2/S3/S4/S5-lead and S1-tell rose 0.0%→11.1% (untouched rails). The mechanism is visible and
  measured, not inferred: the clause grew 685→854 ch (+25%), and `BOTH` — chosen by no walker in Run
  19 — appears five times in Run 20, all at the weak tier, the can't-decide signature of a longer,
  more-qualified instruction. **Publishable as an existence proof** (a targeted fix traded breadth
  for depth, at a measured length cost) — not as a general rate at which this happens.
- **Bundling two independent prose fixes into one carve destroys attribution, and this is a
  methodology finding, not a data finding — it needs no second corpus to be true.** Wave 5 changed
  two things (name the tier; scope the silence) in one clause; waves 1-4 each changed one. Five
  rails regressed and the run structurally cannot say which fix caused it — defect-1's own target
  rail (S1-lead) did not move at all, which is *weak* evidence the length cost is the other fix's,
  but that is inference, not measurement, precisely because the design confounded the two. This is
  main's process error to own (main authorized the bundled carve), not the builder's.
- **The instrument itself produced a fifth defect, and this one manufactures improvement rather
  than noise — the strongest and most transferable of the three.** The line-anchored scorer
  returned two weak-tier walkers as empty (both ran clean: `is_error:false`, `end_turn`,
  7,958/8,081 output tokens, a third answer format the series had not seen) and reported aggregates
  over the remaining 7. Read that way, S1 came back **28.6% instead of 44.4%** — arithmetically
  confirmed as an artifact, not a rounding quirk: both dropped walkers were in the wrong-answer
  camp, so (4 correct + 2 wrong)/7 = 28.6% versus the true (5 correct + 4 wrong)/9 = 44.4%. **A
  scorer that silently shrinks its denominator when it cannot parse an answer moves the number in
  the direction that looks like success, and it does so precisely on the rail measuring whether the
  weak tier can follow the text at all** — the population most likely to fail is the population
  most likely to be dropped. This is not bound to this clause, this corpus, or even this benchmark:
  any scorer assuming a fixed answer shape carries the same risk. Fixed the same day (`tasks.md`
  §Scorer note): the replacement scorer is format-agnostic and refuses to aggregate unless all N
  walkers parse. **Publishable now, independent of any second corpus — it is an infrastructure
  finding, verified by re-reading raw output, not an empirical claim requiring replication.**

**Two claims live in this corpus. They carry different strength and must not be quoted with the same
confidence.**

**Claim 1 — agreement and correctness are different axes; a text can become MORE deterministic while
becoming MORE wrong.** Run 14 alone establishes this: 55.6% variance → 0% variance, modal answer
unchanged from wrong to wrong. **PUBLISHABLE, at the strength already used above and in `README.md`.**
It needs only one clean before/after pair with a scored ground truth, and Run 14 is exactly that,
independently reproducible against the pinned blobs in `tasks.md`. This is the strongest single
result in the whole benchmark and the one worth leading with.

**Claim 2 — sequential, targeted revision of a single clause does not reliably converge either
number.** Six waves, one clause, same 5 scenarios: 55.6 → 0 → 33.3 → 44.4 → 44.4 → (regressed,
reverted). The modal answer was wrong in the first four and correct in the fifth (Run 19) — the
loop's first correct modal — but the sixth wave (Run 20) traded that gain for five newly-broken
clean rails and was reverted the same day, so the corpus's SHIPPED state is Run 19's, still failing
§3b on the weak tier. This is real and it is honestly measured — but it is **NOT the same strength of
claim as Claim 1**, for reasons specific to how the corpus was built, not to the number itself:

- **The waves are not independent trials.** Each carve was a targeted patch for the specific
  undefined term (or, from Run 19 on, the specific named mechanism) the PRIOR wave's readers
  surfaced, written by the same author who read those results. That is good iterative practice —
  each fix demonstrably closed or narrowed the defect it targeted — but it means "six waves" is not
  six draws from "how does prose editing generally affect determinism." It is one author's guided
  walk down one clause's defect tree, and the tree turned out deeper than the walk's own §3b method
  anticipated when it wrote the pass rule.
- **The scenario set was reused, not resampled, across all six waves.** By Run 20 the clause has
  been iterated against the same fixed 5 situations five times. A rail that now reads cleanly on
  those five scenarios has not been shown to read cleanly on a fresh set — this is the same
  overfitting risk as tuning against a fixed validation set, and it has not been controlled for here.
- **The predicted trajectory has now been wrong on every wave since Run 17 — four in a row.** The
  wave-2 carve predicted the correct answer would stabilize at the weak tier; it landed at strong
  instead (Run 17). The wave-3 carve predicted variance would fall and the modal would flip to
  correct; neither happened (Run 18). The wave-4 carve predicted divergence would fall below 44.4%;
  the modal flipped correct but divergence held exactly at 44.4% (Run 19). The wave-5 carve
  predicted both residual rails would reach 0.0%; instead five other rails broke (Run 20). Four
  falsified predictions in a row is honest evidence the authors do not have a working model of *why*
  this specific clause resists convergence — which means the "targeted carve" method itself remains
  unproven here, not just the clause. **Runs 19/20 additionally identified WHY, mechanistically, for
  the first time:** the two residual rails are not wording defects at all but two unmade product
  decisions (does a read-only measurement fan-out count as a model-tier delegation; may the agent
  state why it is asking) — no wave of re-wording can close a boundary the product itself has not
  drawn, which is a candidate explanation for why five wording-only waves never converged.

**So: Claim 2 is reported, not asserted as a general law.** The honest sentence is *"across six
sequential, non-independent waves on one hook-injected clause, in one corpus, variance did not
converge toward zero and the modal answer did not converge to a passing state (one wave reached a
correct-but-still-failing modal, the next regressed and was reverted) — this is evidence that
`divergence -> 0` is an unreliable stopping criterion on its own, not evidence about prose-editing
generally."* That sentence is true, cites its own bound, and does not overreach.

**What a second corpus needs, to promote Claim 2 past a case study — three of four conditions still
open:**
1. **A different clause or `SKILL.md`, ideally not iterated by the same author reading the same walk
   output between rounds** — still open. Runs 19/20 are the fifth and sixth wave on the SAME clause
   by the SAME author.
2. **Fresh scenarios per wave**, or at minimum a held-out scenario set scored only at the end — still
   open. The same 5 situations have now been reused six times.
3. **A pre-registered prediction for every wave, not only the first** — **CLOSED by Runs 19 and 20.**
   Both predictions were written into the lab record and committed before their walkers fired, and
   both were reported as falsified rather than quietly revised after the fact.
4. Ideally a clause from a **different room or different author's skill** — still open.

**Disposition (reaffirmed 2026-08-03 by the third benchmark deputy):** ship Claim 1 as-is (already
at the right strength). Ship Claim 2 as a bounded case study with the six numbers and the
non-convergence stated plainly, including the wave-4 partial success and the wave-5 revert — do not
round it up to "prose carving doesn't work," "the walk method needs a redesign," or "the corpus
converged." One condition of the second-corpus bar (pre-registration on every wave) is now met by
this same corpus; that strengthens the METHOD's discipline, not Claim 2's generality — the other
three conditions require a genuinely different clause and scenario set. Docket a second corpus per
the (now three, not four) open conditions above before either of those stronger claims is written
anywhere.

## Novelty — a separate, weaker claim

A market survey (2026-08-01, ~18 candidates, full table in the internal record) found no tool doing
all four of: tests a *shipped instruction file* for *determinism across repeated identical reads*
*across model tiers* as a *shipping gate*. Closest: Anthropic's own skill-authoring best-practices
page (3/4 — recommends testing "with all the models you plan to use it with", and states outright
*"There is not currently a built-in way to run these evaluations."*). **Stated as "not found in a
real search", never as "nobody does this"** — enterprise/closed-source practice is invisible to a
public search by construction.

## Next arm (not run)

Walk CoalLedger (9.6) and CoalTipple (23.8) under the same Shape-1/Shape-4 instrument to place two
more points on the curve; carve `rot-canary`'s one named seam (fold the conditional entanglement ask
into the same enumerated list as the other two) and re-walk fresh across all three tiers to see
whether a full §3b pass (zero variance, every rail, every tier) is reachable at this index — that
result, either way, is the sharper test of the enumerability refinement than another index point.

**The CT↔CB corpus is CLOSED — no wave 6 is authorized on the current text.** Runs 19 and 20 ran,
and Run 20 was reverted the same day back to Run 19's clause (685 ch, sha `4a18bb6f8f03`), which is
what ships. The two residual rails (S1-lead 44.4%, S2/S5-tell 44.4%) are named as unmade product
decisions, not wording defects — a cue cannot specify a boundary its own product has not drawn.
Both return to the room's owner as a design question, not to a seventh wave of prose. The priority
ahead of any further work on this corpus is a **second, independent corpus** — a different clause
(or a different room's skill) walked with fresh, unreused scenarios — since a further wave on the
same clause and scenario set adds another point to a case study that already has six, not evidence
toward the general claim.
