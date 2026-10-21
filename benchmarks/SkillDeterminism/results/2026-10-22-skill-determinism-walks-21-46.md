# Skill-prose determinism—detail record, Runs 21–46 and two later walks, 2026-08-03 to 2026-10-18

Companion to [`2026-08-03-skill-determinism-walks.md`](2026-08-03-skill-determinism-walks.md) (Runs 11–20).
Compiled 2026-10-22 from the internal lab record (machine-local, not published) and from the written
records of two later walks. Digest and verdicts: [`../RESULTS.md`](../RESULTS.md). Frozen instruments and
their hashes: [`../tasks.md`](../tasks.md); the prompt files are in [`raw/`](raw/).

**What is in here, and what is not.** The lab record holds 49 run headings (`grep -c '^## Run'`) for 46
run numbers (a run continued under a second heading is counted once; the first ten runs carry 13
headings). Runs 21–46 are 26 run numbers: **24 are tabled below; Runs 32 and 33 are not, and
§Not tabled says why.** Two walks recorded outside the lab record meet the same bar and are tabled as
OW-1 and OW-2. Runs 1–10 and Run 16 are outside this update (Runs 1–10 pre-date the published series;
Run 16 claims no pooled score).

## Conventions

- **Tiers:** weak = haiku · medium = sonnet · strong = opus, 3 walkers per tier per round, so N = 9 per
  scored cell unless stated. Divergence = 1 − (walkers matching the modal answer / N), as in
  [`../PREREGISTRATION.md`](../PREREGISTRATION.md). A cell reports divergence **and** the modal answer; Run
  41 measured modal answers that flipped at an unchanged divergence.
- **Engine labels:** the lab record names tiers by alias (haiku / sonnet / opus). **Exact model ids were not
  recorded per run**, and neither was the Claude Code version for most runs; the version of record is the
  blob (below). Dates are the record's own.
- **Leaf kinds:** Runs 21–31 and 44–46: read-only `Explore` leaves. Runs 34–43: fresh single-use
  `claude -p` sessions, no resume, foreground. OW-1 and OW-2: read-only `blind-ic` leaves. No walker is
  decorrelated from the room's governance (see §What this does not show).
- **Hashes.** "Blob" is the git blob id of the walked file (`git rev-parse <commit>:<path>`; re-derivable).
  Two exceptions are named where they occur: the stamps of Runs 44 and 46 are a plain `sha1sum` of the
  file as checked out on Windows (CRLF line endings), re-derived as
  `git show <commit>:<path> | sed 's/$/\r/' | sha1sum`; and a blob a run walked but never committed
  cannot be re-derived (Runs 23 wave 1, 27 wave 1, 29 walked state, 45).
- **Prompts.** A dispatched prompt carried one line with a local file path. The copies in `raw/` replace
  that line with `<path to the SKILL.md under test>` and are otherwise byte-identical; `tasks.md` gives
  the dispatched blob and the published blob of each.
- **Ground truth ("key").** Where a run says "pre-registered", the key was written to the lab record
  before any walker ran. Where it says "declared alongside the fix", it was written with the carve, not
  before it.

## How the method moved after Run 20

Each change was made **between** skills, never inside one skill's before/after pair, because a changed
instrument cannot be differenced (Run 35 states this; Run 36 re-committed the error once, in its own
experiment, and says so).

1. **The extractor is part of the instrument (after Run 34).** Run 34's first automated pass mis-parsed 6
   of 9 answers; Run 36's read each answer's count from the wrong question. Both were caught by reading
   one answer per tier by eye. From Run 39 on, every answer carries numbered markers `COUNT-Q1:` …
   `COUNT-Q5:`; **18 of 18 answers parsed on the first pass in each of Runs 39–43, no eye-corrections.**
2. **The pass bar is count AND membership.** A count-only table would have scored Run 34's weak tier as
   its best rail (below).
3. **The key and a prediction are written before the first walker (pre-registration) in Runs 38–43**
   (Runs 29 and 30 carry a written prediction; Runs 44–46 reuse Run 21's key). A key may change only
   because the walked text changed, and the change is recorded before the next walker runs (Run 38's
   amendment).
4. **A lane-scoped key applies only to rails that ask what applies in a lane, not to rails that ask what
   the file names** (Runs 39–42; Run 40 is the measured error that produced it).
5. **A null control (Run 41) gives a noise floor** for one instrument on one skill: 2 walkers of 9 =
   22.2 points.
6. **The record is written as the data arrives.** A session limit destroyed the first attempt of Run 37.

## Instrument shapes added (never pooled with each other or with Shapes 1–4)

| Shape | What the walker is asked | Runs |
|---|---|---|
| 2 (lane selection), template `run12-v2` | four scenarios → one of OPINION / FULL-BOARD / NEITHER; offer-vs-convene; enumerate the auto-trigger conditions | 21, 22, 44, 45, 46 |
| 2 (disposition), `opinion-disposition v1` | four scenarios → ACT or ESCALATE after a verdict; count the escalation conditions | 25, 26, 28 |
| 1 (lane execution, EN frame) | the routing-OFF lane, eight numbered questions | 23 |
| 5 (enumerated-rail count) | count the consent gates / prohibitions / output locations / fail paths / config keys the document defines, and list them | 24, 27, 29, 30, 31, 34–43 |
| 6 (categorical rail reading, scoped) | a JSON object answering named questions about the edited rows only | OW-1, OW-2 |

## Master stamp (five parts per run)

Part 1 blob · part 2 instrument · part 3 scoring key · part 4 tiers × leaves · part 5 lane + load layer.
Load layer is "body" (the `SKILL.md` text alone) unless stated.

| Run | 1 Blob(s) walked | 2 Instrument | 3 Key | 4 Tiers × leaves | 5 Lane · load |
|---|---|---|---|---|---|
| 21 | CoalBoard `skills/coalboard/SKILL.md` `73bbb05e` | `run12-v2` (reconstructed; sha256/12 `1b20fadd226c`, 2,369 B); body-substituted prompt 49,321 B, `f459d0316693` | S1 OPINION · S2 FULL-BOARD · S3 NEITHER · S4 OPINION · trigger count 3 | 3 × 3, `Explore` | lane selection · body |
| 22 | same file, after carve `398edf6e` | same template | same | 3 × 3, fresh | same |
| 23 | CoalTipple `skills/coaltipple/SKILL.md`: baseline `28484766` · wave 1 `ad648b5a` (never committed) · wave 2 `cc8c5fdd` | EN L1 frame, 2,403 B, sha256/12 `b2bc808abf18` (same L1 block as Run 11) | pre-registered per rail (below) | 3 × 3 per round, 3 rounds, `Explore` | routing-OFF lane (shared section THE FRAME) · body |
| 24 | CoalWash `skills/coalwash/SKILL.md` `5330b830` → `7d1df3c0`; `references/method.md` `0b4d8efd`, `platform-cc.md` `1152b608` | one prompt, two scenarios, five questions (text in §Run 24) | consent: the 10-row ledger itself (after); baseline had no independent key | 3 × 3 per round, 2 rounds, `Explore` | ambient FULL + wizard choice 2 · body + both references (all 9 opened both) |
| 25 | CoalBoard `398edf6e` | `opinion-disposition v1`, sha256/12 `3830ec8365c4`, 2,321 B; prompt with body 48,126 B, `c8a6a183326d` | declared with the fix: S1 ACT · S2 ESCALATE · S3 ESCALATE · S4 ESCALATE · count 3 | 3 × 3, `Explore` | opinion-lane disposition · body |
| 26 | `c3cdd5d2` (walked text `941c9944`, differs by one heading only) | same; prompt 49,093 B, `99cd07db0be1` | same | 3 × 3, fresh | same |
| 28 | `1d1afeee` | same; prompt 49,173 B, `ee44706abd78` | same | 3 × 3, fresh | same |
| 27 | CoalWash `7d1df3c0` → wave 1 (41 rows, never hashed) → `78c5ac00` | whole-document prohibitions list (§Run 27) | none external: the score is the modal count and range | 3 × 3 per round, 3 rounds, `Explore` | whole body · body only (none opened a reference) |
| 29 | `78c5ac00` → walked `c47fee73` (never committed) → shipped `e79d0337` | Run 27's prompt, reused | modal vs the walked table's row count (49) | 3 × 3, `Explore` | whole body · body only |
| 30 | `e79d0337` → `33e14750`; `method.md` `4e9d2b3c` | Run 27's prompt, reused | modal vs the walked table's row count (51) | 3 × 3, `Explore` | whole body · body only |
| 31 | CoalFace `skills/coalface/SKILL.md` `c4a3621d` → `e977fafb` | one scenario (47-file header sweep, `coalfaceMode: auto`, `autoFanoutFloor: 4`) | gates 2 (read from the body); prohibitions 28 after (the declared ledger) | 3 × 3 baseline, 3 × 3 after, `Explore` | conductor's default flow · body only in 17 of 18 walks per the record, which also describes two walkers opening a reference (the two figures do not reconcile) |
| 34 | CoalMine `plugin/skills/rot-canary/SKILL.md` `57406d5a` | `run34` prompt, dispatched blob `d5aef97b` | gates 4 · config keys 5 · others none | 3 × 3, `claude -p` | Stop-hook lane · body in 5 of 9, body + references in 4 of 9 |
| 35 | same file `9a83c510` | `run35` agent / hook prompts | hook 2 (+1 non-firing) · agent 3 (+1 non-firing) | 2 lanes × 3 × 3 | both lanes · body pinned |
| 36 | `plugin/skills/gold-standard/SKILL.md` `4fd15b89` | `run36` agent prompt; definition arm `run36` "defined" prompt | gates 6–7 (a band) · config 1 | arm 1: 3 × 3 · arm 2: 3 × 3 (Q1 only) | agent lane · body pinned |
| 37 | `4fd15b89` | `run36` hook prompt | gates: none single (file-level vs lane-level question) · config 1 | 3 × 3 | hook lane · body pinned |
| 38 | `a21508ee` (post-carve) | Runs 36/37 prompts, unchanged | pre-registered: Q1 6 · Q2 15 · Q3 5 · Q4 7 · Q5 1 | 2 lanes × 3 × 3 | both lanes · body pinned |
| 39 | `plugin/skills/source-grounding/SKILL.md` `d2f41e3e` (release v3.14.1) | `run39` agent / hook prompts (numbered markers, lane-scoped wording, gate definition) | pre-registered: Q1 agent 4 / hook 3 · Q5 2 | 2 lanes × 3 × 3 | both lanes · body pinned |
| 40 | `dcfa48b7` (v3.14.2) | same prompts | pre-registered, lane-scoped: Q1 4/3 · Q5 2/**1** (an error, below) | 2 lanes × 3 × 3 | same |
| 41 | `dcfa48b7` (null control) | same prompts | identical to Run 40's, error included | 2 lanes × 3 × 3 | same |
| 42 | `8a00fdd4` (post-carve) | same prompts | pre-registered: Q1 4/3 · Q2 6 · Q3 3 · Q4 3/4 · Q5 2 | 2 lanes × 3 × 3 | same |
| 43 | `bcc08f3e` (v3.14.3) | `run43` scoped Q3+Q4 prompts (a different instrument) | pre-registered: Q3 2/2 · Q4 2/3 | 2 lanes × 3 × 3 | same |
| 44 | CoalBoard SKILL.md: `sha1sum` (CRLF) `011bcd49` = git blob `fa6b5344` | `run12-v2`, byte-identical; **walkers Read the file by path** instead of receiving the body (declared deviation) | as Run 21 | 3 × 3, two independent draws (18 walkers), `Explore` | lane selection · body |
| 45 | working-tree blob `7e727174` (never committed; superseded) | as Run 44 | as Run 44 | 3 × 3 | same |
| 46 | `sha1sum` (CRLF) `9bf599fe` = git blob `0f07fdb3` | as Run 44 | as Run 44 | 3 × 3 | same |
| OW-1 | CoalWash SKILL.md `f4c28cee` | JSON object, six questions; dispatched blob `0d30a6f4d95d` | written before any walker | 3 × 3, three waves of one walker per tier, `blind-ic` | consent ledger, Choice-4 ③ hand-off, activation ladder · body |
| OW-2 | CoalWash SKILL.md candidate `83e4495a` (the blob later shipped) | JSON object, six questions; dispatched blob `2a17146a7b5a` | written before any walker | 3 × 3, `blind-ic` | the keeps-refusal row · body |

---

## Series A—CoalBoard lane selection (Shape 2, template run12-v2): Runs 21, 22, 44, 45, 46

**Run 21—baseline, 2026-08-03.** The earlier Run 12 instrument had never been frozen to disk, so this
run's template is a **reconstruction** (it adds a separate OFFER-vs-CONVENE answer): a fresh baseline,
not a literal re-score of Run 12.

| rail | divergence | modal | vs key |
|---|---|---|---|
| S1 / S2 / S3 lead | 0% | OPINION / FULL-BOARD / NEITHER | correct |
| **S4 lead** | **33.3%** | **NEITHER** | **wrong** (key OPINION) |
| S1 offer-vs-convene | 0% | OFFER | correct |
| trigger-count | 11.1% | 3 | correct membership |

Cause, named by 9 of 9 walkers: a "too small to be worth the bill" floor had no positive test, so it also
excluded a genuine low-stakes decision (S4). A second item, flagged by 7 of 9 (as it had been in Run 12):
the entry text and Step 0 restate the trigger list with different members. One walker only: a ledger
heading said "5 writes" over six bullets.

**Run 22—after the carve, 2026-08-03** (positive test added; the duplicate list collapsed to one home; the
heading corrected). Fresh 9 walkers. **S4 33.3% → 0%, modal OPINION (correct); S1–S3 and offer-vs-convene
unchanged at 0%; trigger count 11.1% → 0% (count 3).** The edit had introduced its own defect: it said
"the THREE activation signals Step 0 enumerates" while Step 0 listed four. All 9 walkers flagged it, and
all 9 still answered 3. The fix deleted the count claim; **that wording was not re-walked.**

**Runs 44–46—2026-08-16.** Run 44 is a baseline plus a null control in one: two independent 9-walker
draws on the same unedited blob.

| rail | draw A | draw B (null control) | modal | vs key |
|---|---|---|---|---|
| S1–S4 lead, offer-vs-convene | 0% | 0% | correct on all | correct |
| **C—auto-trigger count** | **77.8%** (2 of 9 correct) | **77.8%** (2 of 9 correct) | **4** (6 of 9) | **wrong** (key 3) |

The two draws landed on the same divergence and the same failure shape: **for this rail, on this
instrument, at this blob, the repeat spread was 0 walkers** (one skill, one rail; it is not a floor for
other instruments). Cause: "what triggers the board" had three non-reconciled homes (the frontmatter
description, an unnumbered activation list in Step 0, a stakes signal in a prohibition). By tier: weak
4 of 6 correct, medium 0 of 6, strong 0 of 6. Several medium and strong walkers quoted both competing
enumerations, so they detected the ambiguity; the weak tier's higher hit rate came from reading only the
shorter list.

**Run 45** (a numbered "exactly 3" ledger replaced the unnumbered list; manual `/coalboard` moved out of
the list; seven duplicate-explanation passages cut): **rail C 77.8% → 0%, count 3, all 9 quoting the
numbered list; S1–S4 unchanged.** It walked a working-tree blob that **did not ship**: two further edits
landed afterwards, which a review of the unit found the same day. **Run 46** re-walked the committed blob:
**rail C 0%, count 3, 9 of 9; S1–S4 0%, correct.** Walkers in all three runs flagged that the question
conflates "the trigger fires" with "the board convenes without asking"; the file keeps the two apart, so
this is a property of the question, not of the file.

## Series B—CoalBoard opinion-lane disposition (Shape 2, disposition v1): Runs 25, 26, 28

The prompt text of `opinion-disposition v1` was not kept as a file (hash only in the stamp). The four
scenarios: S1 a purely technical disposition · S2 a verdict recommending a premium-priced seat later (real
spend) · S3 a verdict that changes a shipped product claim · S4 seats that do not converge, or converge at
stated low confidence.

| rail | Run 25 (baseline) | Run 26 (new ledger) | Run 28 (findings-back) |
|---|---|---|---|
| S1 | 0%, ACT | 0%, ACT | 0%, ACT |
| S2 | **44.4%** (ACT 4 / ESCALATE 5) | 0%, ESCALATE | 0%, ESCALATE |
| S3 | **0%, ACT—unanimous, wrong** | 0%, ESCALATE | 0%, ESCALATE |
| S4 | **33.3%** (ACT 6 / ESCALATE 3) | 0%, ESCALATE | 0%, ESCALATE |
| escalation-condition count | 33.3%, modal 0 (6 of 9) | 0%, 3 | 0%, 3, membership identical in 9 of 9 |

S3 is the clean case of agreement without correctness: 9 of 9 said ACT because the text named **no**
condition for "changes what the product promises"—an absent case, not an ambiguous one. The key was
**declared alongside the fix**, not before it. Run 26 passed every rail on its first wave; 4 of 9 walkers
(3 strong, 1 weak) noted the ledger heading said "exactly one of four" over three escalating items, the
heading was tightened before commit, and the tightening was not re-walked. Run 28 followed an independent
review of that commit: it repaired a pointer, moved the fourth bullet out of the list, and added one line
that the ledger never relaxes the confirm-before-irreversible rule. **The heading-tension flags fell from
4 of 9 to 0 of 9; 2 of 9 strong walkers named the irreversible-but-technical boundary as worth watching
(the accepted residual).** **The pointer-navigation fix is not tested by this run:** the whole body is
substituted into every prompt, so a walker never has to follow the pointer.

## Series C—CoalTipple routing-OFF lane (Shape 1): Run 23, 2026-08-03

Baseline, then two waves, 9 fresh walkers each. Run 11 had left this lane failing at the weak tier on one
seam: whether a declared off-state stands down only the three-outcome decision or the whole contract.

| rail | baseline | wave 1 | wave 2 |
|---|---|---|---|
| activation = NO; off-state count 5; asks 0 | 0% | 0% | 0% |
| **do the prohibitions bind under a declared off-state** | **33.3%, modal UNCERTAIN** (6 of 9 flagged it unprompted, all sonnet and opus; 3 haiku answered confidently) | **0%** ("none bind") | 0% |
| output location; fail path; grade/mode | 0% | 0% | 0% |
| **"governed by other project rules" pointer** | n/a | **55.6%** (5 of 9 flagged a pointer with no referent) | **0%** (clause cut) |
| does the "Always" (language) rule survive an off-state | not probed | 33.3% (s3, o2, o3) | 33.3% (same three) |

Wave 1 added one sentence to the frame (+260 characters) and **introduced a defect**: a trailing clause
with no referent. The same re-walk caught it; wave 2 cut it (the clause named no action, so it was
explanation, not a rail). **The "Always" residual is a declared bound, not a pass:** it did not move
across two waves, no haiku walker raised it, and every walker who did resolved it the same way. The edit
touched a section that three other lanes read; **those lanes were not re-walked** in this run.

## Series D—CoalWash (Shape 5): Runs 24, 27, 29, 30

**Run 24—consent-gate count, 2026-08-04.** One prompt, two scenarios (ambient FULL band, then a manual
wizard choice), then five flat-list questions:

> You are being asked to describe how you would follow a documented operational contract. You will NOT
> execute anything — only report what you would do. Read the file […] in full. It references on-demand
> detail files […] — read `method.md` and `platform-cc.md` too if the contract sends you to them for a
> step you need to describe. SCENARIO A (ambient): session-start gauge reports band FULL, capHit
> 'economic' (both break-evens hold), NOT the first crossing this episode — the forced Quick pass already
> ran once this episode and the store is STILL over FULL afterward. SCENARIO B (manual): later in the same
> session, the user types `/coalwash`, picks choice 2 ("Fat + reorganize muscle"), background toggle OFF.
> Report, as a numbered list, EXACTLY what you would do in order for EACH scenario separately. Then answer
> five questions as flat lists (CONSENT GATES / PROHIBITIONS / OUTPUT LOCATIONS / FAIL PATHS /
> CONFIG-MODE SET), drawing on the WHOLE document. Finally: state anything UNCLEAR or ambiguous, honestly.

| rail | baseline | after (one wave) |
|---|---|---|
| **consent-gate count** | 5, 6, 6, 7, 7, 9, 10, 10, 12—no modal | **10 × 9, 0%** (membership identical to the new 10-row ledger in 9 of 9) |
| prohibitions count | 18, 20, 20, 25, ~27, ~30, 33, 41, ~40 (counts marked "~" are the record's own approximations) | **not re-scored** |
| `wizardEscalation` "run" target | ~5 of 9 unprompted, two readings | 0 of 9 |
| "stop on LEAN" vs "wizard opens on LEAN" | ~5 of 9 | 1 of 9 |
| Full-tier consent vs "the bill is not a second consent" | ~7 of 9 | ~2 of 9 (declared bound) |

The fix was a single 10-row ledger plus three one-sentence edits. The key for the consent rail after the
carve is the ledger itself, so it measures transcription of a stated table; the baseline had no
independent key. The edit touches rows read by wizard choices 1, 3 and 4, the write-guard and the
dig-gauge lanes; **none was walked.** Body 19,712 → 21,426 characters.

**Run 27—prohibitions count, 2026-08-04.** A narrower prompt: list every explicit prohibition, with the
bundling decision left to the walker ("there is no fixed rule handed to you"), then state the count
(abridged in the source record). Counts, 9 walkers per round:

| round | counts | modal (agree) | divergence |
|---|---|---|---|
| baseline | 39, 43, 46, 48, 50, 51, 52, 75, 79 | none | ~100% |
| wave 1 (41-row ledger + a stated counting unit) | 41, 41, 41, 42, 45, 46, 51, 57, 75 | 41 (3/9) | 66.7% |
| wave 2 (49 rows) | 49, 49, 49, 49, 50, 50, 51, 52, 66 | 49 (4/9) | 55.6% |

The disagreement at baseline was about the **counting unit**, along three axes (does a sentence about what
code refuses count; is a bundled sentence one rule or several; does a "never" inside a consent sentence
belong to which ledger). Wave 1 wrote the unit into the file. Three walkers transcribed the 41 rows; six
found real prohibitions the ledger lacked; wave 2 added eight rows. **Declared bound, not a pass:** the
residual five walkers flag their own extras as arguable. The wave-1 blob was never hashed.

**Run 29—a header experiment, 2026-08-04.** A sweep replaced restated clauses with pointers to the ledger
rows (body 27,069 → 25,459 characters), and the ledger header was changed to assert completeness, with
the counting rules moved to a maintainer note. **Pre-registered prediction:** "divergence drops
substantially but does not reach 0%, in a 20–40% band".

| tier | round 1 | round 2 | round 3 |
|---|---|---|---|
| weak | 49 | 49 | 49 |
| medium | 51 | 53 | 49 |
| strong | 61 | 67 | 58 |

Modal 49 (4/9), **55.6% divergence—the same percentage as Run 27's wave 2, on a different spread, and
outside the predicted 20–40% band** (the "not 0%" half held). The weak tier converged perfectly by
transcribing the table; the strong tier distrusted the completeness claim, re-scanned the document and
found three real prohibitions outside the ledger (checked against the file, not taken from the
walkers). **The completeness claim was false.** A text that is honestly ambiguous invites judgment-shaped
variance; a text that falsely claims to be settled produced a bimodal split. Divergence alone cannot tell
the two apart. The claim was reverted before shipping, so **the walked blob (`c47fee73`) is not the
shipped blob (`e79d0337`)**; the maintainer-note move was kept.

**Run 30—two gaps closed, 2026-08-04.** A reviewer found the same false completeness claim still standing
in the maintainer note; it was reworded as intent, and the three prohibitions Run 29 named were verified at
source and ledgered (two added as rows, one folded into an existing row): 51 rows.
**Pre-registered prediction:** 30–55% divergence, modal 51.

| tier | r1 | r2 | r3 |
|---|---|---|---|
| weak | 51 | 51 | 51 |
| medium | 51 | 51 | 51 |
| strong | 61 | 71 | 68 |

Modal 51 (6/9), **33.3% divergence** (prediction held, band and modal). Weak and medium converged
(6 of 6 at 51). All three strong walkers marked their own extras as debatable, and no two found the same
extras. **Declared bound 33.3%.** Two presentation levers were deliberately left untested (a total on its
own header line; rewording every row).

## Series E—CoalFace (Shape 5): Run 31, 2026-08-04

First walk of this skill. Baseline, then one carve (a "Consent—2" ledger G1–G2 and a "Prohibitions—28"
ledger P1–P28; the word "consented" deleted from two steps and the taxonomy, where it had named no real
gate; two undocumented config values filled in), then three rounds.

| rail | baseline pooled | divergence | modal vs key | after |
|---|---|---|---|---|
| prohibitions | 11, 12, 16, 16, 16, 19, 30, 30, 31 | **66.7%** | 16 (3/9) | 28 × 9, **0%** (key 28) |
| consent gates | 0, 1, 1, 1, 1, 1, 1, 2, 2 | **33.3%** | **1 (6/9)—wrong** (key 2) | 2 × 9, **0%** (key 2) |

By tier at baseline the prohibitions were weak 13.0 · medium 17.0 · strong 30.3 (spread 1 at strong): the
weak and medium tiers counted about half. The consent rail is the second clear case of low divergence
with a wrong modal answer: the stray word "consented" pulled readers toward an undercount or a phantom
third gate. Output-location and fail-path rails were observed wide at baseline (about 6–16 and 9–34 items)
and **not scored to the same standard before or after.** The source record's section heading says "2
rounds"; its table, its note and its stamp (9 after-carve walkers) say 3 rounds, and 3 is used here.

## Series F—rot-canary (Shape 5): Runs 34, 35

**Run 34—first walk of any CoalMine canary, baseline only, 2026-08-04.** No `SKILL.md` was edited in the
run. Pooled over 9 `claude -p` walkers (rows are weak · medium · strong, rounds 1 / 2 / 3):

| tier | Q1 gates | Q2 prohibitions | Q3 output | Q4 fail paths | Q5 config |
|---|---|---|---|---|---|
| weak | 2 / 2 / 2 | 7 / 6 / 8 | 4 / 3 / 2 | 9 / 5 / 6 | 5 / 2 / 5 |
| medium | 4 / 4 / 4 | 11 / 11 / 11 | 3 / 3 / 4 | 12 / 10 / 8 | 5 / 5 / 5 |
| strong | 4 / 4 / 4 | 23 / 22 / 18 | 5 / 4 / 3 | 15 / 14 / 17 | 5 / 5 / 5 |

| rail | pooled | modal | divergence |
|---|---|---|---|
| Q1 consent gates | 2,2,2,4,4,4,4,4,4 | 4 | 33.3% |
| Q2 prohibitions | 6,7,8,11,11,11,18,22,23 | 11 | 66.7% |
| Q3 output locations | 2,3,3,3,3,4,4,4,5 | 3 | 55.6% |
| Q4 fail / degrade | 5,6,8,9,10,12,14,15,17 | 5 | **88.9%** |
| Q5 config keys | 2,5,5,5,5,5,5,5,5 | 5 | 11.1% |

Keys: gates 4 and config keys 5 (read from the shipped body before the walk); the other rails have no
determinate key because the counting unit is undefined. **The weak tier's three identical answers hide
non-identical membership:** the three sets were {fix menu, entanglement offer} twice and {fix menu, a
sub-branch inside the fix menu} once; the second set contains a thing that is not a gate and drops a real
one. A count-only table would have scored this rail as the run's best; the pass bar is count and
membership for that reason. The two gates the weak tier dropped were the tier pick and the
self-error-report offer. One strong walker found a **missing** rail, not an ambiguous one: the body makes
the fix menu conditional on a config file and never orders the agent to read it. That gap was carved
afterwards; the carve was checked by a **non-walk** (2 weak-tier readers, presence only, n = 2; 2 of 2
read the config first) and is declared a bound, not a pass. Load layer: body only in 5 of 9, body and
references in 4 of 9, so **tier and load layer are confounded** in this run.

**Run 35—the Fix-mode consent rail, both lanes, post-carve, 2026-08-04.** 18 walkers, load layer pinned
to body only, a lane-scoped question, and a mandated `COUNT:` line (18 of 18 found).

| lane | weak | medium | strong | pooled | modal | divergence |
|---|---|---|---|---|---|---|
| Hook | 2 / 2 / **1** | 2 / 2 / 2 | 2 / 2 / 2 | 1,2,2,2,2,2,2,2,2 | 2 | **11.1%** |
| Agent (first baseline of that lane anywhere) | 2 / 3 / 2 | 3 / 3 / 4 | 3 / 4 / 4 | 2,2,3,3,3,3,4,4,4 | 3 | **55.6%** |

Membership was unanimous in the Hook lane (9 of 9 on {fix menu, entanglement offer}); the one `1` is a
walker that listed both and declined to count the conditional one. In the Agent lane all 9 name {tier
pick, fix menu, entanglement}; the 2 / 3 / 4 spread is whether the entanglement offer and the
self-error-report offer count. **The weak tier did not mention the self-error-report offer at all
(0 of 6 weak walkers); 12 of 12 medium and strong walkers either counted it or excluded it with a reason.**
It sits in the body's last line. No weak walker invented a gate this time (Run 34's did).
**Attribution is not answerable from this run:** the blob, the question wording and the load layer all
changed from Run 34, so Run 35 is a new baseline, not a before/after.

## Series G—gold-standard (Shape 5): Runs 36, 37, 38

**Run 36—agent lane, baseline plus a definition arm, 2026-08-04.** Arm 1 (five questions, no definition):

| tier | Q1 gates | Q2 prohib. | Q3 output | Q4 fail | Q5 config |
|---|---|---|---|---|---|
| weak | 4 / 3 / 4 | 7 / 11 / 10 | 3 / 3 / 2 | 6 / 7 / 8 | 1 / 1 / 1 |
| medium | 8 / 8 / 6 | 14 / 14 / 13 | 3 / 4 / 3 | 6 / 6 / 10 | 1 / 1 / 1 |
| strong | 9 / 7 / 8 | 19 / 17 / 15 | 5 / 5 / 5 | 16 / 11 / 11 | 1 / 1 / 1 |

Pooled divergence: Q1 66.7% (modal 8) · Q2 77.8% (14) · Q3 55.6% (3) · Q4 66.7% (6) · **Q5 0.0% (1)**—the
first 0% rail in the series: one config key, named in one place, with one label, read identically by 9 of
9. Arm 2 supplied the definition of a consent gate (a point where the skill must not proceed without a
human answer; a conditional gate is still a gate) and asked Q1 only: weak 4 / 6 / 5, medium 8 / 7 / 8,
strong 7 / 7 / 8; modal 7 (3/9), **66.7%—identical to the undefined arm.** The definition narrowed the
range (3–9 → 4–8) and halved the weak-to-strong gap in means (4.33 → 2.33), and the three weak walkers
named the same five core gates (previously ragged), so it repaired **membership** and not **count**.
**The arm differs from arm 1 in two variables** (the definition, and a leaner prompt), which the record
declares: the direction of the membership result is reportable, the size of the count effect is not.
The weak tier did not name the self-error-report gate (0 of 3), as in Run 35. Six of nine baseline
walkers reported unprompted that the shared footer promises a "fix menu" this skill does not define.

**Run 37—hook lane, same blob, 2026-08-04.** A first attempt was destroyed by a session limit (eight
unparseable error bodies; nothing reused), then the lane was re-run in full.

| tier | Q1 | Q2 | Q3 | Q4 | Q5 |
|---|---|---|---|---|---|
| weak | 4, 2, 5 | 13, 12, 10 | 7, 4, 4 | 8, 5, 7 | 1, 1, 1 |
| medium | 7, 8, 8 | 14, 14, 15 | 4, 4, 4 | 5, 7, 6 | 1, 1, 1 |
| strong | 7, 9, 8 | 18, 20, 17 | 5, 6, 4 | 13, 19, 15 | 1, 1, 1 |

Pooled divergence: Q1 66.7% (modal 8) · Q2 77.8% (14) · Q3 33.3% (4) · Q4 77.8% (5) · Q5 0.0% (1). Against
Run 36, **three of five rails have the same modal and the same divergence to the digit** (Q1, Q2, Q5);
Q3 reads better in the hook lane (the scenario names the report as the product) and Q4 worse (the lane
adds its own degrade branches). At the weak tier the three Q1 readings were three different sets, and
**two of three built a consent gate out of the footer's "offer the fix menu"**, a menu the skill does not
define, dropping real gates to make room; no medium walker did. A file-level question over a lane-level
scenario makes the tier-pick count ambiguous (it was counted by 1 weak, 1 medium, 3 strong walkers);
declared.

**Run 38—post-carve, both lanes, 2026-08-04.** The carve added a consent ledger G1–G6 with a per-lane
column, a prohibitions ledger P1–P15, a degrade ledger D1–D7 and a declared output total of 5; the
reviewer stripped the three ledgers and the inline tags and found the residue differed from the pre-carve
body in one disclosed preamble line, so nothing behavioural was removed. **Key pre-registered:** Q1 6 ·
Q2 15 · Q3 5 · Q4 7 · Q5 1. Prompts unchanged from Runs 36/37.

| rail | agent, before → after | hook, before → after | key | correct (agent / hook) |
|---|---|---|---|---|
| Q1 consent gates | 66.7% → **11.1%** | 66.7% → **33.3%** | 6 | 8/9 · 6/9 |
| Q2 prohibitions | 77.8% → **0.0%** | 77.8% → **0.0%** | 15 | 9/9 · 9/9 |
| Q3 output locations | 55.6% → 44.4% | 33.3% → 55.6% | 5 | 4/9 · 4/9 |
| Q4 degrade paths | 66.7% → **11.1%** | 77.8% → **0.0%** | 7 | 8/9 · 9/9 |
| Q5 config keys | 0.0% → 0.0% | 0.0% → 0.0% | 1 | 9/9 · 9/9 |

Variance fell and correctness rose on every carved rail, so Run 14's shape does not appear. Two residues
are attributed to the instrument or key, with quotes, and **not rescored**: Q3 (membership is unanimous
in all 18; walkers split on whether to report the declared 5 or the 8 write targets the file lists, so
the key measures the question's scope), and hook Q1 (two weak walkers excluded G1 because the lane's
column says it is suppressed, which is the correct reading; the key counted ledger rows). **A prediction
was falsified in the good direction:** the pre-registration named the false footer promise as the first
suspect if hook Q1 missed zero; **0 of 9** walkers made a gate of it, against 2 of 3 weak walkers before
the carve. A later change to the shared footer removed a degrade row, so the key for any future walk is
Q4 = 6 (**Run 38's numbers stand against Q4 = 7; the amendment binds later walks only**). The carved body
is 13,220 characters, projected at about 4,667 tokens on invoke, about 6.7% under the ~5,000-token guide.

## Series H—source-grounding (Shape 5): Runs 39, 40, 41, 42, 43

**Run 39—baseline, both lanes, 2026-08-04.** First run with numbered markers, a lane-scoped question and
the gate definition. Release v3.14.1; the smallest body walked so far (5,907 characters). **Pre-registered
prediction:** the weak tier will not complete the footer's conditional ("follow this skill's Fix mode
section, if it defines one"; it defines none).

| rail | agent | key | hook | key |
|---|---|---|---|---|
| Q1 gates | **11.1%**, modal 4, 8/9 | 4 | **66.7%**, modal 3, 3/9 | 3 |
| Q2 prohibitions | 66.7% (6) | — | 77.8% (4) | — |
| Q3 output | 22.2% (2) | — | 11.1% (2) | — |
| Q4 degrade | 66.7% (3) | — | 77.8% (2) | — |
| Q5 config | **0.0%** (2) | 2 | 44.4% (2) | 2 |

Hook Q1 was perfectly tier-stratified with no within-tier variance (weak 1 / 2 / 2, medium 3 / 3 / 3,
strong 4 / 4 / 4). **The prediction held:** weak 0 of 3, medium 2 of 3, strong 2 of 3 resolved the hook
lane to report-only. All three strong walkers counted a fourth gate; one wrote it out as applying a fix
in the hook lane—**a consent gate manufactured from the footer's unconditional "never fix without a chosen
option"** in a skill with no fix path. The Q5 hook figure is the key's error (file-level key; the Run 40
paragraph below records the correction).

**Run 40—after scoping that clause, 2026-08-05.** Release v3.14.2: the footer's last clause became "Where
a Fix mode section exists, never fix without a chosen option". One variable moved (the blob); prompts
byte-identical. **Pre-registered prediction:** strong-tier hook Q1 drops from 4 to 3 ("if not, the diagnosis
was wrong").

| rail | hook, Run 39 → Run 40 | agent, Run 39 → Run 40 |
|---|---|---|
| Q1 | 66.7% → 44.4%, correct 3/9 → 5/9 | 11.1% → 22.2%, 8/9 → 7/9 |
| Q2 | 77.8% → 55.6% | 66.7% → 66.7% |
| Q3 | 11.1% → 44.4% | 22.2% → 22.2% |
| Q4 | 77.8% → 66.7% | 66.7% → 44.4% |
| Q5 | 44.4% → 33.3% | 0.0% → 0.0% |

**The prediction was confirmed exactly: strong tier 4 / 4 / 4 → 3 / 3 / 3.** A mechanical sweep of all 18
answers for the manufactured-gate phrasing found **0 hits** (Run 39: 3 of 3 strong hook walkers). The
agent lane, which the edit does not touch, was a natural control and was materially unchanged. **A key
error:** Run 40 set the hook Q5 key to 1 on the reading of four walkers who had excluded the tier key as
not lane-relevant; correctness fell from 5/9 to 3/9, and the modal answer was 2. The rule that came out
of it: lane-scope the key for rails that ask what applies; **do not** lane-scope rails that ask what the
file names. The error stays in the Run 40 and 41 keys, unrescored. Two strong agent-lane leaves were lost
to a session limit and **re-run, not salvaged**.

**Run 41—the null control, 2026-08-05.** The identical blob, identical prompts and identical key (error
included), a second draw. Decision rule fixed before the draw: 0–1 walker = tight floor; 2 walkers =
loose floor; 3 or more = no floor.

| lane | rail | Run 40 modal / agreeing | Run 41 modal / agreeing | shift | modal moved |
|---|---|---|---|---|---|
| Hook | Q1 | 3 / 5 | 3 / 6 | 1 | no |
| Hook | Q2 | 6 / 4 | 6 / 3 | 1 | no |
| Hook | Q3 | 3 / 5 | 2 / 7 | **2** | yes |
| Hook | Q4 | 3 / 3 | 4 / 3 | 0 | yes |
| Hook | Q5 | 2 / 6 | 2 / 6 | 0 | no |
| Agent | Q1 | 4 / 7 | 4 / 7 | 0 | no |
| Agent | Q2 | 6 / 3 | 7 / 3 | 0 | yes |
| Agent | Q3 | 2 / 7 | 2 / 5 | **2** | no |
| Agent | Q4 | 4 / 5 | 7 / 3 | **2** | yes |
| Agent | Q5 | 2 / 9 | 2 / 9 | 0 | no |

**Noise floor: 2 walkers of 9 = 22.2 points, for this instrument on this skill, from one repeat.** Hook
Q3's modal ran 2, 3, 2 across Runs 39, 40, 41 with the text identical in the last two: Run 40's 33-point
jump was a second draw. **Four of ten cells changed their modal answer with no text change (hook Q3, hook
Q4, agent Q2, agent Q4), two of them (hook Q4, agent Q2) at an unchanged agreement count.** The source
record counts three because it discusses hook Q3 separately. Agent Q5 held 9 of 9 at 2 in Runs 39, 40, 41 and 42. After Run 41, a
one-walker difference is not reported as a finding, and Run 40's hook Q1 gain (3/9 → 5/9 correct, 2
walkers) is reported as at the floor, not as a clean win; the categorical result (0 of 18 manufactured
gates) is unaffected by it.

**Run 42—post-carve, both lanes, 2026-08-05.** The carve added declared ledgers G1–G4, P1–P6, D1–D4 and an
output list; the body grew from 5,940 to 8,293 characters. Key pre-registered, lane-scoped for gates and
degrade paths only; the floor applied for the first time (nothing below 3 walkers is a finding on count
alone).

| rail | hook, before → after (correct) | agent, before → after (correct) |
|---|---|---|
| Q1 gates | 44.4% → **0.0%** (9/9), +4 walkers | 22.2% → **0.0%** (9/9), +2: at the floor |
| Q2 prohibitions | 55.6% → **0.0%** (9/9), +6 | 66.7% → **0.0%** (9/9), +6 |
| Q3 output | 44.4% → 33.3% (3/9), +2 | 22.2% → 11.1% (0/9), +2 |
| Q4 degrade | 66.7% → 55.6% (4/9), 0 | 44.4% → 44.4% (1/9), 0 |
| Q5 config | 33.3% → 22.2% (7/9) | 0.0% → 0.0% (9/9), positive control intact |

**Past the floor:** Q2 in both lanes and hook Q1. Categorical checks chosen before the draw: **ledger-row
uptake 18 of 18** (walkers cite row ids), last-row reach 25 of 27 (hook) and 23 of 27 (agent), and **0 of
18 manufactured gates** (the pre-registered suspect did not fire). The walk also **found two ledger
defects the readers were right about:** the output ledger counted "no annotation needed", the absence of
an output, as an item (modal 2 against a declared 3), and a degrade row was labelled universal though it
fires only on non-interactive runs.

**Run 43—Q3 and Q4 only, after the fixes, 2026-08-05.** Release v3.14.3: a membership test for an output
location was stated in the body; the lane labels on D-rows were audited. **A different (scoped) instrument:
its divergence is not comparable with Run 42's** (two variables moved); it measures correctness against
a corrected key fixed before any leaf (Q3 = 2 both lanes; Q4 = agent 2, hook 3).

| rail | lane | pooled | modal | divergence | correct |
|---|---|---|---|---|---|
| Q3 output | agent | 2,2,2,2,2,2,2,2,6 | 2 | 11.1% | **8/9** |
| Q3 output | hook | 2,2,2,2,2,2,2,2,5 | 2 | 11.1% | **8/9** |
| Q4 degrade | agent | 2,2,2,3,3,4,4,5,6 | 2 | 66.7% | 3/9 |
| Q4 degrade | hook | 2,2,2,2,2,4,4,4,4 | 2 | 44.4% | **0/9** |

**Q3 fixed**: the membership test written into the body was applied by the readers; 6 of 9 (agent) and 8
of 9 (hook) named the non-item. **Q4 was not fixed, and the walk located why:** hook Q4 is bimodal (five
walkers say 2, four say 4, none says 3), so the key describes a model nobody holds. Both camps agree the
ledger contributes two rows in this scenario and differ on whether branches elsewhere in the body count;
and the lane column sorts a row whose real condition is a **mode** (non-interactive), not a lane. The
builder's unmeasured inference about one relabelled row survived (9 of 9 readers in both lanes cited it).

## Series I—two later CoalWash walks (Shape 6): OW-1 and OW-2

Both are categorical readings of enumerated rails, with the key written and blob-stamped before any
walker, `blind-ic` leaves, 3 per tier, and **no null control on this instrument** (so only agreement
with the key, not a divergence delta, is read).

**OW-1—2026-09-25, SKILL.md `f4c28cee`, scope: the consent ledger, the Choice-4 CoalFace hand-off and the
activation ladder.** Three waves of one walker per tier.

| rail | W1 weak / medium / strong | W2 | W3 | modal vs key |
|---|---|---|---|---|
| gate count | 10 / 10 / 10 | 10 / 10 / 10 | 10 / 10 / 10 | 10 = key |
| gate 9 carries the install condition | yes × 3 | yes × 3 | yes × 3 | present |
| no CoalFace → no offer and no extra workers | yes × 3 | yes × 3 | yes × 3 | both |
| CoalFace installed → offer once, no extra workers | yes × 3 | yes × 3 | yes × 3 | both |
| hookless install: manual only, the offer is designed | yes × 3 | yes × 3 | weak adds one mislabel; medium, strong yes | manual only (extra claim: 1 of 9) |
| standing-consent items | 3 / 3 / 3 | 3 / 3 / 3 | 3 / 3 / 3 | 3 = key |

**0 of 9 divergence on every rail; modal correct.** The one weak-tier extra claim sits at the instrument's
one-walker floor. Five named residual ambiguities were boarded for a later lean pass; none was a rail
split. **Instrument contamination found by the run:** 5 of 9 walkers reported that a path-gated rule file
holding earlier walk results on this very `SKILL.md` was injected into their context after they read it,
**although these leaves are configured to omit the project instruction files**. The answers here are
reads of a ledger and agree 9 of 9, so the verdict stands; the leak matters for any walk whose answers are
judgement calls.

**OW-2—2026-10-18, candidate `83e4495a` (the blob later shipped), scope: the row that says what to do
when a keep write is refused.** A one-line, +191 character body edit, walked before it shipped.

| walker | `.ok` tested | not stopped · not recorded · re-flags | report + record again | report + fix first | shapes | applyPlan denial |
|---|---|---|---|---|---|---|
| sonnet × 3 | yes | yes · yes · yes | yes | yes | 3 | yes |
| haiku × 3 | yes | yes · yes · yes | yes | yes | 3 | yes |
| opus × 3 | yes | yes · yes · yes | yes | yes | 3 | yes |

**9 of 9 match the key on every enumerated rail; zero variance; modal = key.** Legibility notes, not
rails: the retry limit (6 of 9) and who performs the fix (7 of 9) are not stated in the row; whether the
no-error case tells the user was left open for a later edit (5 of 9). One walker reported it had seen a
repository status line in its context (not used). The record notes that any wording change to the row
re-opens the walk.

---

## Not tabled, and why (every subject named)

| Subject | Why it is not a row |
|---|---|
| **Run 32** (2026-08-04), a weak-tier-only cold read of the CoalBoard body: 2 readers, 2 rounds, identical counts (gates 3 · prohibitions 18 · output locations 5 · fail paths 12) | One tier, two rounds; **the blob was not captured** (the stamp's part 1 is missing), so a stranger cannot re-run it. The lab record says itself that it does not meet the bar. The two readings agreed with each other exactly and with the body's declared ledger. |
| **Run 33** (2026-08-04), a cross-vendor walk on another agent platform | A method record plus **one surviving answer whose model was never recorded**; the planned effort sweep (one model at three efforts) is unrecorded. Nothing can be tabled, not even a spread. The surviving answer matched the declared ledger (3 · 18 · 5 · 12) and quoted a verbatim line for each count. |
| **CoalFace, 2026-08-22**, a post-lean check of two behavioural rails: 5 readers (2 haiku, 2 sonnet, 1 opus), one round, one frozen prompt | **Zero variance in 5 of 5, both questions.** No pre-registered key, one round of unequal tiers; the blob is not named in the record. It also found a pointer that omitted one failure row, fixed in the unit. |
| **CoalFace, 2026-09-21**, a rail-survival check after seven cuts: 3 readers answered, 1 refused at admission | A positive control on the cut sites (7 of 7 rails present in 3 of 3 readings), not a variance walk and not a before/after. **The refused reader is named:** a haiku session in the full governance stack was refused at admission with `Prompt is too long` (about 216,000 tokens against a 200,000 limit), $0.00; the same model with the stack stripped answered. |
| **CoalWash CLASSIFY-BLOCK walks, 2026-08-21** ("ran twice and converged") | The record of the walk was later evicted from the room's notes; the surviving line names no blob, tiers or per-rail result. |
| **CoalBoard check-walks, October 2026**, four of them: 15 leaves each, sonnet and opus only (9 and 6), scopes derived from the edit sites. As recorded in room returns: 134/135, 120/120 and 150/150 answers correct on three of them; the fourth's result was not read here | **No weak tier**: the tier the pass rule exists to protect was not exercised, and a scope derived from the edit sites is a regression check, not coverage. Not independently re-scored here. |
| **Run 1–10, Run 16** | Outside this update: Runs 1–10 pre-date the published series; Run 16 reports no pooled score. |

The CoalTipple addition of 2026-08-21 (a declarative grants-and-denials block) was committed with its
walk **declared disproportionate and not run**; a reviewer found two of the premises for that call false
and the release was held. No walk record for it was found in the lab record or the room returns read for
this update. It is not a walk; it is listed because it is an edit to a walked file with no walk record.

## What this record does NOT show

- **One author, one program.** Every carve was written by the party reading the previous walk, against
  the same fixed scenario sets (reused across waves). A rail that reads cleanly on the scenarios it was
  tuned against has not been shown to read cleanly on fresh ones.
- **The noise floor is one measurement.** 2 of 9 comes from one repeat of one instrument on one skill
  (Run 41, 10 cells). It is not inherited by any other skill's walk or by Shape 6, and most rows here
  have **no null control at all**; Run 44's two draws are a second such repeat for one rail (a 0-walker
  shift on rail C).
- **Not decorrelated.** The platform injects the project instructions into leaves that do not omit them;
  and OW-1 measured a path-gated rule file reaching 5 of 9 leaves that did omit them. A walker's agreement
  with another walker is never evidence the skill's design is right.
- **Exact model ids and tool versions were not recorded per run** (aliases only), so a re-run on a later
  model is a new measurement, not a replication.
- **Some keys were declared alongside the fix** (Run 25) or amended because the text changed (Run 38), and
  two keys contained errors that the record kept unrescored (Run 40's hook Q5, Run 41's by design).
- **Count and agreement are not correctness.** Where a modal answer was wrong (Runs 21, 25, 31, 44) or a
  stable count hid unstable membership (Run 34), the row says so.
- **Several walked blobs are not the shipped blob** (Runs 23 wave 1, 27 wave 1, 29, 45); each says so.
