# Skill-prose determinism — preregistration

Written before Run 15's data existed. Runs 11-14 predate this benchmark directory (they were run under
a standing method, not this preregistration) and are reported as prior data, clearly marked as such.

## The claim under test

A skill's behaviour splits into CODE-borne (tests already check it) and PROSE-borne (a `SKILL.md`
body, its `references/*.md`, a hook-injected coordination cue) — **nothing checks the prose half**.
It ships on its author's belief that it reads the same way to every reader. This benchmark measures
that belief directly: have independent readers read the SAME text and check whether they extract the
SAME set of directives.

## The method (standing, USER-locked 2026-07-27)

<!-- lang-exempt: quoted user ruling establishing the standing method — data, not our own prose -->
> *"ต่อจากนี้ ถ้ามีการปรับแต่ง md ใหม่ ไม่ว่าจะเพิ่ม/ลด/แก้ไข ก็ต้องเทส 3 โมเดล โมเดลอ่อน กลาง เก่ง +
> ปรับ md จน lean จนไม่มีการแกว่ง ใน 3-5 รอบ ใหม่อีกรอบ ล็อกเรื่องนี้เลย นับเป็นส่วนหนึ่งของแล็ปเทส"*
> — every SKILL.md edit re-walks with 3 model tiers (weak/mid/strong), 3-5 identical rounds each,
> until the enumerated rails stop wavering. Locked as part of the lab test, not an optional extra.

**Metric:** `divergence(rail) = 1 − (walkers matching the modal answer / N)`, **MAX across rails,
POOLED across tiers.**
- MAX, not mean — a mean lets one broken rail hide behind several healthy ones.
- Pooled, not per-tier — a file stable only on the strong tier has already failed: the promise is
  that the WEAKEST plausible model follows the contract, and a per-tier report can publish a clean
  number for the tier nobody was worried about while hiding the one that broke.

**Pass condition:** zero variance in every enumerated rail, at every tier fired. A lane that fails at
the weak tier fails outright and is not rescued by a clean strong tier.

**A confirmed prediction and a wavering one are reported with equal prominence.** The negative result
— the index does NOT predict variance — is exactly as publishable as the positive one; that is stated
here, before Run 15 ran, so it cannot be walked back after seeing the data.

## The hypothesis under test (Run 15 and beyond)

**Index:** `prose chars (SKILL.md bodies + references/*.md, frontmatter stripped, plugin/ dist
excluded) / non-test code lines (scripts|hooks|lib|bin, .mjs/.js/.cjs, *.test.* excluded)`, per room.

**HYPOTHESIS:** walk-variance risk scales with the prose-borne index — a skill whose rails live mostly
in unstructured prose (high index) wavers more under repeated reads than one whose rails live in
numbered/tabular ledgers (low index), independent of index alone if the LOW-index file still has
scattered prose rails.

**Support before Run 15, and why it is not enough:** two high-index skills (CoalBoard ~83, and the
CT/CB hook cue — unindexed but prose-thin-and-unstructured) both failed the walk. **Two points on the
same side of a line is not a test of the line.** No low-index skill had ever been walked. That is the
hole this benchmark's first hypothesis-test run (Run 15) closes.

**THE PREDICTION, locked before Run 15 fired (2026-08-03, before any walker was dispatched):**

> CoalMine's `rot-canary` (index 12.0 — third-lowest measured, and its body is already shaped like
> the "labeled home" structure that Run 1's post-carve wave found to be the actual driver of
> stability: a numbered tier rubric, a 3-option fix menu, a 3-row escalation table) is predicted to
> PASS wave 1 at the weak tier: zero variance across 3 haiku walkers on (a) the tier score + resulting
> tier, (b) whether the fix-menu presents, (c) the fix-menu option count, (d) the entanglement-offer
> canary name for this scenario. A waver here would falsify the index as the driver and is reported
> exactly as readily as a pass.

**What actually happened (full record: `RESULTS.md` + `results/2026-08-03-skill-determinism-walks.md`):**
all four predicted rails held at zero variance — confirmed. One UN-predicted, emergent rail (the total
count of `ask_question` points, where one is conditional and un-numbered against the file's own
structure) wavered at 33.3%. **The refined reading, stated honestly: it is not the index alone — it
is whether a rail has a labeled home. A low-index file with one un-enumerated conditional still
wobbles on exactly that one rail, at an amplitude far smaller than a high-index file's scattered
rails.** The index and the enumerability finding compose; neither alone explains the data.

## Declared limitations

- **Not decorrelated evidence.** Every walker (`blind-ic` / `Explore`) is a fresh leaf, but the
  platform injects the umbrella governance stack at spawn regardless of "blind" framing (measured
  2026-07-26). Between-walker spread is real; walker-to-walker AGREEMENT is never cited as
  independent confirmation of anything outside this file's own text.
- **Small N per cell** (3 per tier, up to 9 per run). This bounds precision, not direction: a 1-in-3
  split is real signal at this scale, a 1-in-9 split is a genuine minority reading, but neither is a
  population estimate.
- **The walk measures AGREEMENT, never CORRECTNESS.** Run 14 is the record that makes this binding:
  a text reached zero variance while every reader agreed on the wrong answer. Every run scores the
  modal answer against ground truth (where one exists) alongside the spread — never spread alone.
- **Four distinct instrument shapes exist in the full record** (lane execution · lane selection · a
  hook-injected coordination cue · this benchmark's index-hypothesis test) and are never pooled into
  one cross-run number — each is tabled on its own terms in `results/`.
- **Novelty is a separate, weaker claim.** A market survey (2026-08-01) found no existing tool
  variance-tests a shipped instruction file for repeated-read determinism across model tiers as a
  shipping gate. Stated as "not found in a real search of ~18 candidates", never as "nobody does this".
