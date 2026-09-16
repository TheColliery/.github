# CoalBoard audit mode vs cloudflare/security-audit-skill vs a solo control — blind comparison (2026-09-16)

<!--
version-frozen: measured 2026-09-16 (UTC). This record is a DATED SNAPSHOT. It is NOT tracked and
NOT re-run automatically when either product updates — data goes stale on update, and re-tracking
every change would cost more than the record is worth. Re-run on request only. Stamped, not chased.
-->

**Measured:** 2026-09-16 (UTC) ·
`cloudflare/security-audit-skill` at repo commit [`c1c8a8c`](https://github.com/cloudflare/security-audit-skill/commit/c1c8a8c1471069fb0e188eeaff69b8e8db6564a8)
(committed 2026-09-14), **quick profile**, as installed via file-copy (no network fetch beyond the
initial install) ·
**CoalBoard v2.4.2**, audit mode, as installed at run time ·
**solo control**: one plain `claude -p` session, no delegation, no skill ·
model IDs exactly as the run receipts' `modelUsage` report them: `claude-opus-5`, `claude-opus-4-8`,
`claude-haiku-4-5-20251001` (verified 2026-09-16 against Anthropic’s models overview,
platform.claude.com/docs/en/models/overview: `claude-opus-5` and `claude-haiku-4-5-20251001` are the
current Claude API IDs of Claude Opus 5 and Claude Haiku 4.5; `claude-opus-4-8` is Claude Opus 4.8,
listed there as a legacy model still available; the orchestrator pinned the bare `opus` alias for
every run, and `claude-opus-4-8` appears beside `claude-opus-5` in every one of the nine receipts —
recorded here as a receipts oddity, not interpreted) ·
Claude Code 2.1.273 at run time.

## TL;DR

We build one of the three things compared here (CoalBoard) — read every number below with that in
mind; the plain single-agent control is the neutral baseline, not us.

**On this one seeded target, three rounds per arm, same model tier throughout:** the third-party
skill's quick profile matched a single-agent review of the same model tier on recall (0.467 median,
15 seeds, n = 3) at roughly **14.5×** its median cost. CoalBoard's audit mode reached **0.867**
median recall at roughly **3.9× less** median cost than the skill. Precision held high across all
three methods (≥ 0.857 median strict, zero hits on either deliberate decoy in any round). Full
method, every number, and every caveat below — this is a measured signal from n = 3 on one target,
not a verdict about either product in general.

## 1. Design

**Arms**, same target, same commit, same model tier, three rounds each. No fixed budget cap was
enforced on any arm — per-round spend varied naturally ($1.74–$32.27; see §8) — so "same conditions"
here means same target, same model tier, same round structure, never "equal cost":
- **A** — `cloudflare/security-audit-skill`, quick profile (one hunter wave, one critic pass, one
  verifier per candidate, per the skill's own documented shape).
- **B** — CoalBoard convened in audit mode (Generate/Audit mode, epistemic lenses in parallel + a
  judge synthesizing on verified inputs).
- **C (control)** — one plain `-p` session, one prompt, no delegation.

All three arms ran the identical way mechanically: a fresh `claude -p` session per round, fired by
one shared orchestrator against a freshly reset copy of the target, with no session carried between
rounds.

**Target:** a seeded multi-tenant web service, purpose-built for this comparison — trust boundaries
spanning auth/sessions, an HTTP API, file/upload handling, a database, secrets/config, and an
LLM/tool path. **Withheld, and why:** releasing the target hands out the fixed problems and their
answers to anyone who reads this record, which would poison the target for any future re-run and
give a future solver an answer key instead of a real test. What is published below is class-level
only — see §2's trap classes.

**Blinding:** a SETTER seeded the target and held a sealed answer key. SOLVERS (the three arms)
received the target only. A SCORER — a fresh, single-use session with no room memory, no craft
file, and no predecessor brief loaded — received the key and all nine runs' outputs only after every
round had already finished, and matched every finding to a seed by root cause (never by file:line
alone). Honest bound: the scorer is not fully context-free — the platform loads ambient project
governance at spawn regardless of dispatch wording — but it never read the setter's transcript or
any arm's output before scoring began, which is the property that matters for this comparison.

**Pre-registered decision rules** (written into the design before any run fired; A = the skill arm,
B = CoalBoard, C = the solo control, quoted with that substitution and otherwise verbatim):
- **Complementary** — "Jaccard(A,B) ≤ 0.4 AND both recall ≥ 0.6 → install + cherry-pick."
- **Theirs weaker** — "recall_A < recall_B − 0.2 at equal cost, or precision_A < 0.6 → their gap."
- **Ours weaker** — "recall_B < recall_A − 0.2 at equal cost → our gap → post-mortem by STEP."
- "Anything in between → 'no verdict at this n'; a second target before any change."
(Thresholds are ours, declared in advance; a vendor's own claimed numbers are treated as hypotheses
until measured, never adopted as-is.)

## 2. Trap classes in the design

Every LLM's accuracy is strongest inside its training prior. To measure grounding discipline rather
than model recall, the design seeded five classes of defect, only one of which a strong model can
usually answer from memory alone:

| class | what it tests | why memory alone fails |
|---|---|---|
| **T0 control** | ordinary, well-known bug patterns | memory catches these |
| **T1 post-training-cutoff** | a dependency pinned to a version with an advisory published after any model's training cutoff | the model "remembers" the dependency as safe |
| **T2 locale-specific correctness** | a format/checksum validator implemented wrong for a specific locale | a model with no training exposure to that locale's rule has nothing to check the code against |
| **T3 corpus-reinforced myth** | code that follows a widely repeated but wrong "best practice" | the training prior agrees with the bug |
| **T4 non-English library contract** | a library used against its actual, non-English-documented contract | the model cannot recall a contract it never trained on |

15 real seeded defects (5 T0 · 3 T1 · 3 T2 · 3 T3 · 1 T4) plus 2 deliberate look-alike non-bugs
(decoys, to measure precision honestly). A method that scores T0 ≈ T1–T4 is grounding at source; a
method whose T1–T4 collapses relative to T0 is answering mostly from memory.

## 3. Results

### Per-arm tables (n = 3; min / median / max — no means, per subject)

| metric | A (skill, quick profile) | B (CoalBoard audit) | C (solo control) |
|---|---|---|---|
| recall | 0.267 / **0.467** / 0.467 | 0.600 / **0.867** / 0.867 | 0.400 / **0.467** / 0.733 |
| precision (strict) | 0.875 / **0.900** / 1.000 | 0.857 / **0.889** / 0.889 | 0.875 / **1.000** / 1.000 |
| decoy false positives | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| cost USD | 21.97 / **29.95** / 32.27 | 7.61 / **7.66** / 13.86 | 1.74 / **2.06** / 2.87 |
| wall seconds | 1,948 / **2,392** / 2,606 | 839 / **878** / 1,183 | 273 / **412** / 563 |
| turns | 9 / 14 / 17 | 3 / 4 / 7 | 7 / 8 / 20 |

**Trap-class recall**, min / median / max across three rounds (T0 = 5 instances, T1–T4 pooled = 10):

| arm | T0 recall | T1–T4 recall |
|---|---|---|
| A (skill) | 0.4 / 1.0 / 1.0 | 0.2 / 0.2 / 0.2 |
| B (board) | 1.0 / 1.0 / 1.0 | 0.4 / 0.8 / 0.8 |
| C (solo) | 0.8 / 1.0 / 1.0 | 0.2 / 0.2 / 0.6 |

Every arm's T0 recall is 1.0 at the median — but not in every round: the skill's own weakest round
scored 2 of 5 on T0, and the solo control's weakest round scored 4 of 5. The board is the only
method whose T1–T4 recall does not collapse relative to its own T0 line, in every round it ran.

### Overlap and the pre-registered rule outputs

Overlap (Jaccard) between the skill arm and CoalBoard, pooled over three rounds: **0.571**
(individually 0.538 / 0.778 / 0.308 per round). Every seed instance the skill arm matched in any
round, CoalBoard also matched in some round — CoalBoard's coverage is a strict superset of the
skill's here. CoalBoard additionally matched every locale-class (T2) instance and the non-English
library instance (T4) across its rounds, which the solo control never reached in any round; the
solo control matched one post-cutoff-advisory (T1) instance that CoalBoard never matched in any
round (it fetched a live advisory database; CoalBoard's empirical lens did too, in every round, but
attached an advisory other than the seeded one each time — not always the same one across rounds —
see §6).

Applying the pre-registered rules:
- **Complementary — FALSE.** Jaccard 0.571 exceeds the 0.4 ceiling, and the skill's own median
  recall (0.467) sits below the 0.6 floor the rule requires on both arms.
- **Theirs weaker — TRUE, on recall, at the pooled median.** 0.467 < 0.867 − 0.2 = 0.667. Per round
  it holds in two of the three: round 1 (0.467 vs 0.867) and round 3 (0.267 vs 0.867) both clear the
  gap; round 2 does not (0.467 vs 0.600 — 0.600 − 0.2 = 0.400, and 0.467 is not below 0.400). The
  rule's precision clause is false (the skill's own precision, 0.900 median, comfortably clears the
  0.6 floor) — the recall clause on the pooled median is what fires it. Cost was not held equal
  between the arms (see §1); the skill ran roughly 3.9× CoalBoard's median cost, which the rule
  notes cannot rescue a recall shortfall in the skill's favour.
- **Ours weaker — FALSE.** 0.867 is not below 0.467 − 0.2 = 0.267.
- **Rule output: THEIRS WEAKER** at the pooled median (recall gap 0.40, twice the rule's reportable
  ±0.2 threshold), holding in 2 of 3 individual rounds, with no precision gap in either direction
  (all three arms held ≥ 0.857 median strict precision).
- **Control reading (not a pre-registered rule):** the skill's median recall (0.467) equals the solo
  control's median recall exactly, at roughly 14.5× the control's median cost. CoalBoard's median
  recall (0.867) exceeds the control's by 0.40 at roughly 3.7× the control's median cost.

### Coverage-redundancy check

Every one of the fifteen seeded defects was matched by at least one round of at least one arm — no
seed went entirely unfound across all nine runs. All three arms carry a full three-round miss on
some slice of the key: the skill arm missed the same 7 seeds (all of T1, T2, and T4) in every one
of its three rounds; the solo control missed the same 4 seeds (all of T2 and T4) in every one of
its three rounds; CoalBoard missed one T1-class instance (a post-cutoff dependency advisory) in
every one of its three rounds — the only correlated miss inside CoalBoard's own three-round
convening, and the reason it is worth naming separately is that CoalBoard's rounds each reached the
relevant pin and call path and still missed it (see §6), where the skill and solo misses above
reflect the same unit simply never being hunted. Per-internal-lens attribution inside a CoalBoard
convening is not recoverable from its own report artifacts — only the judge's merged findings are
written to disk, so the "missed by every round" statements above are at the arm level, never the
individual-lens level.

## 4. The 13-seed view

Two of the fifteen seeded instances carry scorer-flagged validity caveats: one T3-class (myth)
instance is exploitable only under a non-default deployment configuration — every one of the nine
runs judged it low-impact given the target's actual authentication design, and only 2 of the 6
skill-and-solo rounds declined to raise it as a finding for that reason (the solo control raised it
in all three of its own rounds); one T2-class (locale) instance sits in code with no reachable call
path in the shipped target (dead code by inspection). Both were still scored as matched wherever a
run correctly identified them under the pre-registered key.

Recomputing recall with these two instances removed from the denominator (13 seeds instead of 15),
from the per-run match counts in the scoring record:

| arm | r1 | r2 | r3 | median |
|---|---|---|---|---|
| A (skill) | 6/13 = 0.462 | 7/13 = 0.538 | 4/13 = 0.308 | **0.462** |
| B (board) | 11/13 = 0.846 | 8/13 = 0.615 | 11/13 = 0.846 | **0.846** |
| C (solo) | 6/13 = 0.462 | 5/13 = 0.385 | 10/13 = 0.769 | **0.462** |

**Does any §3 decision-rule output move? No.** Theirs-weaker still fires at the pooled median
(0.462 < 0.846 − 0.2 = 0.646); Complementary is still false (skill recall still below the 0.6
floor); Ours-weaker is still false. Every median shifts by a small amount under the 13-seed view —
the skill and solo medians move by roughly half a recall-point (0.467→0.462) and CoalBoard's moves
by roughly two points (0.867→0.846, a 0.021 shift) — none of which is large enough to change a
rule's verdict.

## 5. Caveats

- **n = 3 per arm, one target.** This is a measured signal on one seeded codebase, not a verdict
  about either product's general capability. Reproduce independently on a different target before
  generalizing further.
- **Self-scored, blind, unaudited.** The scorer had no prior context specific to this experiment and
  never saw any arm's output until every round had finished — but it is still our own instrument,
  checked by nobody outside this house. No third-party audit of the scoring has been done.
- **Host load figures are upper bounds, not arm-isolated measurements.** The sampler ran at roughly
  12-second cadence against the whole machine, and unrelated work (a desktop session, a writing
  task, a background watcher) ran beside several rounds — see `results/security-audit-2026-09-16/`
  for the raw numbers and their derivation (grouped by the sampler's own arm tag). No conclusion
  here rests on the load figures; they are published because they were measured, not because they
  change any verdict.
- **CoalBoard's observed seating differed from the design's plan.** The design called for a fixed
  five-lens-plus-tiebreaker convening; the audit mode's actual convenings did not match that shape
  in every round. Per-lens attribution is unrecoverable from the arm's own report artifacts (only
  merged findings are written), so no number above claims lens-level precision.
- **One CoalBoard round's own report header notes it did not run under fully independence-clean
  conditions** (ambient project governance was loaded at spawn) — recorded here, not scored into any
  number.
- **Receipts oddities**, recorded and not interpreted: `modelUsage` lists a second opus model id
  beside the pinned one in all nine runs; each run's own `duration_ms` field disagrees with the
  orchestrator-measured wall time for every skill- and board-arm run (e.g. one run's `duration_ms`
  reads 389 seconds against 2,606 seconds of measured orchestrator wall). See the raw receipts.
- **Cost-ratio arithmetic, stated precisely:** every ratio in this record (14.5×, 3.9×, 3.7×) is a
  ratio of **median** per-round costs. Ratios of the three-round **totals** differ (skill/board
  totals ≈ 2.9×, skill/solo totals ≈ 12.6×) because the distribution of per-round spend is not
  uniform within an arm — see §8's receipts for the underlying numbers either way.
- **One of CoalBoard's non-seed real findings across its rounds was granted by the scorer on the
  scorer's own recollection of a version-sensitive fact, unverified against a live source (the
  scoring environment had no network access).** Disclosed here rather than folded silently into the
  non-seed-finds count.
- **Scope, stated plainly:** this compares one configuration of each method (the skill's quick
  profile; CoalBoard's audit mode; one plain solo session) on one target. It is not a claim about
  the skill's full profile, about a different model tier, or about either product on a different
  kind of codebase.

## 6. Our own lessons (the board's misses are ours to fix, not the vendor's)

The post-cutoff dependency advisory that CoalBoard missed in all three of its own rounds was not a
coverage gap — every round reached the pinned package and the call path and attached an advisory
other than the seeded one each time (not always the same advisory across rounds). Only the one
solo-control round that fetched a live advisory database matched it correctly. The fix this points
to is ours: an advisory cited against a pinned dependency must be checked against the pinned
package's actual version range, never matched on package name alone. This is queued as a rule for
CoalBoard's empirical lens — not yet implemented in the shipped tool as of this record's date.

Separately: the design assumed a fixed five-lens-plus-tiebreaker convening; the observed seating did
not match that plan in every round, and per-lens attribution is not recoverable from the report
artifacts CoalBoard currently writes. Both are named here as open items for CoalBoard's own
development, not as claims about the third-party skill.

## 7. Disclosure and standing offers

We build CoalBoard, one of the three things compared here — this is stated at the top of the TL;DR
as well as here, because it is the fact most likely to bias a reader's trust in our own arm's
numbers. Read CoalBoard's numbers with that conflict of interest in mind; the plain single-agent
control is the neutral baseline in this comparison, not our own tool.

A class-level report of the gaps named in §3's "theirs weaker" verdict and §6 has been **drafted**
(no seed text, no file:line, no fixed problem-and-answer, the same scrubbing this record applies
throughout) and will be filed with `cloudflare/security-audit-skill`'s maintainers. We will re-run
this comparison on a configuration the maintainers name (the skill's full profile instead of quick,
a different model tier, a target they propose) and publish a dated addendum to this record with the
result, whatever it shows.

**Correction policy:** if anything in this record is wrong, open an issue on this repository. The
record will be amended and the amendment dated; nothing here is presented as a claim about either
product in general — the scope is this one target and these nine rounds, stated as such throughout.

## 8. Receipts

| run | rc | subtype | turns | cost USD | wall s (orchestrator) | `duration_ms` | models in `modelUsage` |
|---|---|---|---|---|---|---|---|
| A-r1 | 0 | success | 9 | 29.95 | 2,606 | 388,762 | opus-5 + opus-4-8 |
| A-r2 | 0 | success | 14 | 21.97 | 2,392 | 511,419 | opus-5 + opus-4-8 |
| A-r3 | 0 | success | 17 | 32.27 | 1,948 | 510,135 | opus-5 + opus-4-8 |
| B-r1 | 0 | success | 3 | 7.66 | 839 | 226,362 | opus-5 + opus-4-8 + haiku-4-5 |
| B-r2 | 0 | success | 4 | 7.61 | 878 | 275,686 | opus-5 + opus-4-8 + haiku-4-5 |
| B-r3 | 0 | success | 7 | 13.86 | 1,183 | 554,812 | opus-5 + opus-4-8 + haiku-4-5 |
| C-r1 | 0 | success | 8 | 1.74 | 273 | 267,536 | opus-5 + opus-4-8 |
| C-r2 | 0 | success | 7 | 2.06 | 412 | 406,002 | opus-5 + opus-4-8 |
| C-r3 | 0 | success | 20 | 2.87 | 563 | 555,835 | opus-5 + opus-4-8 + haiku-4-5 |

Totals: skill arm $84.19 / 6,946 s · board arm $29.13 / 2,900 s · solo control $6.67 / 1,248 s · all
nine runs $119.99. (See §5's caveat on median-vs-total cost ratios.)

**Raw artefacts** (safe-to-publish subset — cost/turns/timing/model-usage only, never the arms'
answers): [`results/security-audit-2026-09-16/`](results/security-audit-2026-09-16/) —
`receipts.json` (this table's source, re-derived directly from each run's own result envelope, spot
verified field-for-field against the raw files), `orchestrate.log` (the orchestrator's own
start/end/cost/turn log, byte-identical to the raw copy), `load-summary.json` (the §5 caveat's
host-load numbers, re-derived independently from the raw sampler log by grouping each sample under
its own recorded arm tag), `SCORE-public.md` (the scoring record with every seed identifier replaced
by its trap class — §3 through §7 of this record trace to it). The full scoring record, the sealed
answer key, and every arm's own findings and artifacts are withheld — publishing them would hand out
the fixed problems and their answers.
