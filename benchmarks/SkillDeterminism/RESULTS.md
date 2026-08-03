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

**The CT↔CB corpus across four sequential carves: 55.6% → 0% → 33.3% → 44.4%, never converging and
never landing on a correct modal answer.** See §Publishability verdict below for what this sequence
does and does not support.

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

## Publishability verdict — the CT↔CB corpus (Runs 13/14/17/18), written 2026-08-03

**Two claims live in this corpus. They carry different strength and must not be quoted with the same
confidence.**

**Claim 1 — agreement and correctness are different axes; a text can become MORE deterministic while
becoming MORE wrong.** Run 14 alone establishes this: 55.6% variance → 0% variance, modal answer
unchanged from wrong to wrong. **PUBLISHABLE, at the strength already used above and in `README.md`.**
It needs only one clean before/after pair with a scored ground truth, and Run 14 is exactly that,
independently reproducible against the pinned blobs in `tasks.md`. This is the strongest single
result in the whole benchmark and the one worth leading with.

**Claim 2 — sequential, targeted revision of a single clause does not reliably converge either
number.** Four waves, one clause, same 5 scenarios: 55.6 → 0 → 33.3 → 44.4, and the modal answer was
wrong in all four. This is real and it is honestly measured — but it is **NOT the same strength of
claim as Claim 1**, for reasons specific to how the corpus was built, not to the number itself:

- **The waves are not independent trials.** Each carve was a targeted patch for the specific
  undefined term the PRIOR wave's readers named (`stakes signal` → `a real routing need` → `needs a
  different tier`), written by the same author who read those results. That is good iterative
  practice — each fix demonstrably closed the defect it targeted — but it means "four waves" is not
  four draws from "how does prose editing generally affect determinism." It is one author's guided
  walk down one clause's defect tree, and the tree turned out deeper than the walk's own §3b method
  anticipated when it wrote the pass rule.
- **The scenario set was reused, not resampled, across all four waves.** By Run 18 the clause has
  been iterated against the same fixed 5 situations three times. A rail that now reads cleanly on
  those five scenarios has not been shown to read cleanly on a fresh set — this is the same
  overfitting risk as tuning against a fixed validation set, and it has not been controlled for here.
- **The predicted trajectory was wrong twice, which is good science but bounds the claim.** The
  wave-2 carve predicted the correct answer would stabilize at the weak tier; it landed at strong
  instead (Run 17). The wave-3 carve predicted variance would fall and the modal would flip to
  correct; neither happened (Run 18). Two falsified predictions in a row is honest evidence that the
  authors do not yet have a working model of *why* this specific clause resists convergence — which
  means the "targeted carve" method itself is unproven here, not just the clause.

**So: Claim 2 is reported, not asserted as a general law.** The honest sentence is *"across four
sequential, non-independent waves on one hook-injected clause, in one corpus, variance did not
converge toward zero and the modal answer did not converge toward correct — this is evidence that
`divergence -> 0` is an unreliable stopping criterion on its own, not evidence about prose-editing
generally."* That sentence is true, cites its own bound, and does not overreach.

**What a second corpus needs, to promote Claim 2 past a case study:**
1. **A different clause or `SKILL.md`, ideally not iterated by the same author reading the same walk
   output between rounds** — or, if the same author, a pre-registered fix BEFORE seeing which
   scenario it will be scored against, to break the target-the-last-defect loop.
2. **Fresh scenarios per wave**, or at minimum a held-out scenario set scored only at the end, so a
   later wave's apparent improvement (or lack of one) is not measured against the same fixture its
   carve was implicitly tuned to.
3. **A pre-registered prediction for every wave, not only the first** — Run 15 did this and it is
   this benchmark's cleanest result; Runs 17/18 stated a prediction in the lab record but it was not
   filed in `PREREGISTRATION.md` before firing, so it carries less evidentiary weight than Run 15's.
4. Ideally a clause from a **different room or different author's skill**, to separate "this specific
   clause has a deep defect tree" from "targeted prose carves generally underperform their own
   predictions."

**Disposition:** ship Claim 1 as-is (already at the right strength). Ship Claim 2 as a bounded case
study with the four numbers and the non-convergence stated plainly — do not round it up to "prose
carving doesn't work" or "the walk method needs a redesign." Docket a second corpus per the four
conditions above before either of those stronger claims is written anywhere.

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

A wave-4 clause for the CT↔CB corpus (Run 19) is pending separately, owned by the room doing the
carve. Per the verdict above, the priority ahead of a Run 19 is a **second, independent corpus** —
a different clause walked with fresh, unreused scenarios — since a fifth wave on the same clause and
scenario set adds another point to a case study that already has four, not evidence toward the
general claim.
