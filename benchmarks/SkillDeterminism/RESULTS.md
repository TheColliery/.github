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
| 14 | CT↔CB hook cue, after 1 carve | coordination cue | **33.3%** | lead rail 0% variance, **still wrong**; action rail regressed |
| **15** | CoalMine `rot-canary` (index 12.0) | prose-index test | **0%** on all 4 predicted rails · **33.3%** on 1 emergent rail | **YES**, on every scored rail |

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
