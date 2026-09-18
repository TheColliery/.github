# SCORE (public) — Round 4b, the judge chair, 2026-09-17

> Scrubbed from the internal round-4b scoring record for public release: every seed identifier, file
> name, function name, and mechanism-level detail is replaced with its trap CLASS. This file adds
> nothing that changes a number.
> **Stamp:** round 4b measured 2026-09-16 19:20:10–20:44:56 UTC, scored 2026-09-17 · judge model
> `claude-haiku-4-5-20251001` throughout · worker models where convened `claude-opus-5` (the receipts'
> own 1M-context billing variant) / `claude-opus-4-8` — verified against Anthropic's models overview
> the same way the main record's ids were, per that record's own note · CoalBoard v2.4.2 with two
> research-only levers on the weak-judge/strong-lens arm only (restored to stock immediately after,
> 0 mismatches after restore) · `cloudflare/security-audit-skill` commit `c1c8a8c` · Claude Code
> 2.1.273 · permission regime `acceptEdits`, verified per run — with the one exception named in §3.D
> and §6 below. Full context, design, and every caveat:
> [`../../../SECURITY-AUDIT-2026-09-16.md`](../../../SECURITY-AUDIT-2026-09-16.md)'s Addendum 1.
> Denominators: 15 real seeds (5 T0 · 3 T1 · 3 T2 · 3 T3 · 1 T4) + 2 decoys; the 13-seed view drops
> one T3-class and one T2-class instance as in the main record, from BOTH the numerator and the
> denominator, applied identically to every arm.

## §2 Per-arm tables (n = 3; min / median / max — no means)

| metric | A-h2 (skill floor) | B-h2 (board floor) | C-h2 (solo floor) | B-hje2 (weak judge, strong lenses) |
|---|---|---|---|---|
| recall /15 | 0.200 / **0.267** / 0.333 | 0.267 / **0.400** / 0.467 | 0.200 / **0.267** / 0.400 | 0.800 / **0.867** / 0.933 |
| recall /13 | 0.231 / **0.308** / 0.385 | 0.308 / **0.385** / 0.462 | 0.231 / **0.308** / 0.385 | 0.769 / **0.923** / 0.923 |
| precision (strict) | 0.800 / **0.889** / 1.000 | 0.667 / **0.727** / 0.800 | 0.857 / **1.000** / 1.000 | ≈0.92 / **≈0.947** / ≈0.95 |
| decoy false positives | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| method-backed fraction | 0 / **0** / 0.429 | 0.111 / **0.182** / 0.200 | 0 / **0** / 0 | 0.186 / **0.211** / 0.308 |
| findings presented | 5 / 7 / 9 | 5 / 9 / 11 | 3 / 4 / 7 | 19 / 26 / 43 |
| cost USD | 1.53 / **1.81** / 1.83 | 1.36 / **1.38** / 1.40 | 0.26 / **0.27** / 0.28 | 5.74 / **6.04** / 6.71 |
| wall seconds (orchestrator) | 506 / **540** / 756 | 320 / **327** / 361 | 76 / **139** / 180 | 506 / **616** / 737 |
| turns | 5 / 6 / 6 | 2 / 2 / 2 | 20 / 21 / 22 | 2 / 2 / 6 |

Each run's own receipt `duration_ms` disagrees with orchestrator wall in every arm here, the same
pattern the main record notes for rounds 1–3 — recorded, not interpreted.

**Trap-class recall per run (matched / class size):**

| run | T0 /5 | T1 /3 | T2 /3 | T3 /3 | T4 /1 | T1–T4 /10 |
|---|---|---|---|---|---|---|
| A-h2 r1 | 3 | 0 | 0 | 1 | 0 | 1 |
| A-h2 r2 | 3 | 0 | 0 | 2 | 0 | 2 |
| A-h2 r3 | 3 | 0 | 0 | 0 | 0 | 0 |
| B-h2 r1 | 4 | 0 | 0 | 0 | 0 | 0 |
| B-h2 r2 | 4 | 1 | 0 | 2 | 0 | 3 |
| B-h2 r3 | 4 | 1 | 0 | 1 | 0 | 2 |
| C-h2 r1 | 4 | 0 | 0 | 0 | 0 | 0 |
| C-h2 r2 | 5 | 0 | 1 | 0 | 0 | 1 |
| C-h2 r3 | 3 | 0 | 0 | 0 | 0 | 0 |
| B-hje2 r1 | 5 | 2 | 3 | 3 | 1 | 9 |
| B-hje2 r2 | 5 | 0 | 3 | 3 | 1 | 7 |
| B-hje2 r3 | 5 | 2 | 3 | 2 | 1 | 8 |

Per arm, T1–T4 recall (min/median/max): A-h2 0.0/0.1/0.2 · B-h2 0.0/0.2/0.3 · C-h2 0.0/0.0/0.1 ·
B-hje2 0.7/0.8/0.9. Strong-judge (rounds 1–3) T1–T4 medians for comparison: A 0.2 · B 0.8 · C 0.2.

**T0 does not sit uniformly near ceiling** across arms: B-hje2 hits 5-of-5 every round; the board
floor holds steady at 4-of-5 every round; the skill floor holds steady at 3-of-5 every round; the
solo floor varies 3-to-5-of-5 across its three rounds.

**T1-class miss taxonomy:** A-h2 — scoped away by the skill's own offline design in every run
(forbidden to look). C-h2 — never reached the class in any run (did not think to look). B-h2 and
B-hje2 matched two of the three T1-class instances correctly in multiple runs at both tiers; the
third instance was never matched by any board run at either tier — every run that reached it fetched
live advisory data but attached an advisory other than the seeded one. The same single-instance
wrong-advisory pattern the main record names for its own strong-judge rounds, reproduced here at both
a weaker floor tier and the weak-judge/strong-lens tier — never the whole class, one instance of it.

## §3.B Judge-robustness rule outputs

Strong-judge (rounds 1–3) medians for comparison: skill 0.900 · board 0.889 · solo 1.000.

| arm | kind | decoy FPs > 0 in # rounds | median p_strict | Δ vs strong median | **rule output** |
|---|---|---|---|---|---|
| A-h2 | floor | 0 of 3 | 0.889 | −0.011 | **JUDGE-ROBUST** |
| B-h2 | floor | 0 of 3 | 0.727 | −0.162 | in between — no label |
| C-h2 | floor | 0 of 3 | 1.000 | 0.000 | **JUDGE-ROBUST** |
| B-hje2 | weak judge / strong lenses | 0 of 3 | 0.947 | +0.058 | **JUDGE-ROBUST** |

**The label that moved.** In the earlier, confounded pass (permission-mode refusals closed most of
the method channel), the skill floor scored median p_strict 0.625 → JUDGE-DEPENDENT. Under the
like-for-like regime it scores 0.889 → JUDGE-ROBUST. The dependence measured under the confounded
pass was the harness refusing the skill's writes and probes and scoring it on truncated output, not
the model tier degrading the verdict. The board-floor and solo-floor labels were unchanged across
both passes.

**B-hje2's three stated limits** (unchanged from the confounded pass): (1) the decoy criterion was
never stimulated — no lens of any strength proposed a look-alike in any of this round's twelve runs;
(2) precision is mostly the strong lenses' own precision, inherited rather than produced by the
judge; (3) the judge's own contribution reads as **retention**: across the three convened runs the
weak judge kept **38 of 39** seat-union seeds (r1 14/14, r2 12/12, r3 12/13). The single loss — one
seed reported by a lens and dropped in the judge's final report in r3 — is the one place the weak
judge visibly failed to carry a strong-lens finding through. No inversion, no invented seed, no decoy
accepted; recall ranged 0.800–0.933 across the three runs vs the strong-judge board's own median
0.867.

**Floor-label reading:** C-h2's JUDGE-ROBUST rests on 3–7 findings per run, nearly all T0, recall
median 0.267 — it holds precision by saying less, the floor's shape. A-h2's JUDGE-ROBUST is genuine
(it completes and, in one round, grounds via executed probes, despite carrying real permission
denials in two of its three rounds — see §3.D/§6). B-h2 sits in between because the floor-tier board
over-calls several non-security hygiene/design observations as findings each round.

## §3.C Method-backed verdict rate

METHOD = an executed probe / a reproducible input→output run / a range-check against a fetched
source. ASSERTION = a reading of the code with no run.

| arm | per run (method / presented-as-confirmed) | min / median / max |
|---|---|---|
| A-h2 | 0/5 · 3/7 · 0/9 | 0 / **0** / 0.429 |
| B-h2 | 1/5 · 2/11 · 1/9 | 0.111 / **0.182** / 0.200 |
| C-h2 | 0/4 · 0/7 · 0/3 | 0 / **0** / 0 |
| B-hje2 | 8/43 · 4/19 · 8/26 | 0.186 / **0.211** / 0.308 |

**The channel the confounded pass measured as closed is open in most of this round.** The earlier
pass scored method = 0 everywhere because every worker probe was harness-refused; under this round's
regime the board and solo arms ran every probe they attempted (zero permission denials across all
nine of their runs), and the fraction is nonzero wherever they did. **The one arm that still carried
real denials is the skill's own floor** — two of its three rounds saw permission-denial events (3 and
6 respectively, mostly worker sub-agents and script-block heuristics), so its own 0-in-two-of-three
method reading is not a clean "the channel was fully open" result the way the other three arms' is;
it may understate what the skill would show under a fully unobstructed regime. The pattern that does
hold cleanly: the weak-judge/strong-lens arm produced the most method-backing (executed
authentication-bypass proofs, data-exposure proofs, a large-sample identity-checksum sweep, live
advisory fetches); the skill produced method only in the one run whose hunters executed against the
real modules; the solo control produced zero method in all three runs — it reads code and asserts,
never runs.

**H-method pairs (precision, method-fraction) — reported, not labelled:** A-h2 (0.889, 0.00) · B-h2
(0.727, 0.18) · C-h2 (1.000, 0.00) · B-hje2 (0.947, 0.21). **Not confirmed, and arguably contradicted
at the extremes:** the highest-precision arm (solo, 1.000) has the lowest method fraction (0),
achieving precision by saying little. What the round does show: the arm whose verdicts rest most on
method (B-hje2) also holds the highest recall (0.867) at high precision (0.947) — method appears to
buy coverage without costing precision, rather than buying precision directly.

## §3.D Workflow completion

| run | reached own final stage? | collected? | note |
|---|---|---|---|
| A-h2 r1 | Yes | **Yes** | full artefact set delivered; 1 permission-denial event during the run |
| A-h2 r2 | Yes | No | complete output written to session scratch — the run's output directory sat outside what it was granted, a path-scope miss; 3 permission-denial events |
| A-h2 r3 | Yes | No | same path-scope miss; 6 permission-denial events |
| B-h2 r1/r2/r3 | Yes | **Yes** | report written + collected; 0 permission-denial events in any of the three |
| C-h2 r1/r2/r3 | Yes | **Yes** | report written + collected; 0 permission-denial events in any of the three |
| B-hje2 r1/r2/r3 | Yes | **Yes** | report written + collected; 0 permission-denial events in any of the three |

**Completion at the level the lab collects: 10 of 12.** Every run in every arm reached its own final
workflow stage — the two A-h2 misses are a directory-scope miss, not a permission denial by
themselves and not an incomplete audit. This retires the confounded pass's reading that a weak tier
cannot complete its workflow unattended: every floor arm completed under this round's regime,
**though the skill's own floor still absorbed real, if far fewer, permission denials than the
confounded pass** (1/3/6 here vs 2–24 there) — the regime is a large improvement, not a byte-for-byte
match to the strong-judge rounds' zero-refusal experience.

## §4.1 Seat compliance, billing, and our own defect

Every B-h2 and B-hje2 run convened the board's own lens seats correctly, except one B-h2 run which
convened three of its four seats (no fourth lens spawned). The seat-substitution and fabricated-
seat-return failures observed under the earlier, confounded permission regime did not reproduce here.

**Our own defect, named as ours, and its scope stated precisely:** the board's documented per-seat
model ladder is a prose instruction the orchestrating session must turn into an actual spawn
parameter; it is not enforced mechanically. On runs where NO research lever was engaged, a strong
orchestrating session applied the ladder on the large majority of its spawns while a weak
orchestrating session applied it on none of its spawns — the real, still-open defect. With a research
lever forcibly engaged (as in every B-hje2 run here), the spawn parameter does reliably show up; that
confirms the lever works, not that the underlying defect is fixed, since neither lever ships as a
user-facing default. Queued fix, not built: a floor tier in the lens seat definitions themselves, and
the billed model of every seat printed in the board's own report.

**Classifier-fallback note:** the second opus model id billed beside the primary one inside the
strong-tier lenses is the platform's own safety-classifier fallback for benign security work,
documented at platform.claude.com/docs/en/build-with-claude/refusals-and-fallback. It appeared only
inside the strong-tier lens billing in this round and never in any weak-tier-only arm — recorded, not
interpreted; no comparative rate against the main record is claimed, since that record does not state
one either.

## §4.2 Per-lens attribution and retention (human-review artefact)

Per-internal-lens attribution is recoverable for this round from the raw per-lens returns (unlike the
main record's rounds, where only merged findings are written) — a design choice made specifically for
this measurement so a human can review what each lens actually reported versus what the judge's final
report carried forward. Across the three convened weak-judge/strong-lens runs, the four lenses'
combined union of findings totalled 14, 12, and 13 seeds respectively; the judge's own report carried
forward 14, 12, and 12 — a single T3-class finding, reported plainly by one lens, was dropped from the
judge's report in the third run.

**Disagreements resolved with no exchange, as a class.** No deadlock, cross-examination, or
tiebreaker convened in any of the twelve runs; every board report asserted a clean consensus. Reading
the raw returns surfaces genuine disagreements the judge folded together silently: in one
weak-judge/strong-lens run, three of the four strong lenses independently proposed different
technical readings of the same T0-class network-boundary defect, merged into one finding with no
visible exchange (the merged finding held up correct on inspection, reached with no cross-exam). At
the opposite tier — a floor run, judge and lens both weak, no research lever involved at all — the
judge's own report header stated flatly that no runtime verification had occurred in that run, while
one of its own weak-tier lenses' output from the identical run showed an executed check had, in fact,
been run: the board's own summary misdescribed its own board's method. Neither changed the scored
recall or precision; both are recorded as the human-review artefact this design exists to surface.

## §5 Host load — instrument gap (unchanged from the earlier pass)

Every sample in this round's window carried one generic sampler tag rather than a per-run one, so the
per-run load figures in `round4/` are derived from the orchestrator's own timing log rather than the
sampler's arm tags — named so nobody re-derives them the same way the main record's rounds were
derived and gets a different number. Host-wide caveats from the main record apply identically: every
figure is an upper bound, not arm-isolated.

## §6 Receipts

| run | rc | subtype | turns | cost USD | wall s | permission denials | models in `modelUsage` | convened |
|---|---|---|---|---|---|---|---|---|
| A-h2 r1 | 0 | success | 5 | 1.53 | 540 | 1 | haiku | n/a |
| A-h2 r2 | 0 | success | 6 | 1.83 | 756 | 3 | haiku | n/a |
| A-h2 r3 | 0 | success | 6 | 1.81 | 506 | 6 | haiku | n/a |
| B-h2 r1 | 0 | success | 2 | 1.36 | 320 | 0 | haiku | yes |
| B-h2 r2 | 0 | success | 2 | 1.38 | 361 | 0 | haiku | partial (3/4 seats) |
| B-h2 r3 | 0 | success | 2 | 1.40 | 327 | 0 | haiku | yes |
| C-h2 r1 | 0 | success | 20 | 0.27 | 76 | 0 | haiku | n/a |
| C-h2 r2 | 0 | success | 21 | 0.28 | 180 | 0 | haiku | n/a |
| C-h2 r3 | 0 | success | 22 | 0.26 | 139 | 0 | haiku | n/a |
| B-hje2 r1 | 0 | success | 6 | 6.71 | 737 | 0 | haiku + opus-5 + opus-4-8 | yes |
| B-hje2 r2 | 0 | success | 2 | 5.74 | 506 | 0 | haiku + opus-5 + opus-4-8 | yes |
| B-hje2 r3 | 0 | success | 2 | 6.04 | 616 | 0 | haiku + opus-5 + opus-4-8 | yes |

Round-4b total: **$28.62** across 12 runs (A-h2 $5.17 · B-h2 $4.14 · C-h2 $0.82 · B-hje2 $18.49) —
re-derived directly from `receipts-r4b.json`. Permission-denial counts are `permission_denied` stream
events, counted directly from each run's own `claude.stream.jsonl`, not the narrower "refusal-ish
line" grep the design record's own preliminary check used — the two counting methods disagree for
A-h2 r2/r3 (that check read 2/4; the direct event count is 3/6), reconciled here in the direct
event count's favour as the more literal reading of the stream.

**Comparison to the confounded pass, one line as instructed, never as the measurement:** confounded
pass (default permission mode, 2–24 refusals per run) recall/p_strict medians — skill floor
0.333/0.625 · board floor 0.400/0.778 · solo floor 0.267/1.000 · weak-judge/strong-lens (convened)
0.733/0.926. Round 4b (acceptEdits; 0 denials for board/solo/weak-judge arms, 1/3/6 for the skill
floor's own three rounds) — skill floor 0.267/0.889 · board floor 0.400/0.727 · solo floor
0.267/1.000 · weak-judge/strong-lens 0.867/0.947. The weak-judge verdict (JUDGE-ROBUST) is identical
across both passes; what the confound moved was the skill floor's precision label
(DEPENDENT→ROBUST), completion (0/14→10/12), and the method fraction (0→nonzero for three of the
four arms; the skill floor's own method reading still carries the caveat above).

## §9 Class-level summary (public-release wording)

Round 4b re-ran the earlier judge-chair protocol at the weakest model tier under a permission regime
that removed nearly all of the earlier pass's refusals for three of its four arms — the board floor,
the solo floor, and the weak-judge/strong-lens arm all saw zero permission denials across their nine
combined runs. The vendor's own quick profile is the one exception: its floor arm still carried a
handful of permission-denial events in two of its three rounds (well below the earlier pass's count,
not zero), which is disclosed rather than smoothed into a clean "channel fully open" reading.

**What the quick profile does at the weakest tier, mostly with the harness out of the way:** it
finishes its own workflow unattended in every run, delivering its artefact where the output directory
was in scope. Median strict precision ≈89% (range 80–100%), close to the strong tier's 90% at this
small a sample. Zero look-alike decoys accepted. Median recall 27% — post-training-cutoff dependency
advisories, locale-checksum defects, and the niche-library-contract class stayed near zero; the
control class (ordinary bugs) held at roughly 60% per round, not a ceiling result.

**Across all methods at the weakest tier:** a weak judge over strong lenses keeps precision (median
≈95%) and recall (median ≈87%), and retained 38 of 39 seeds its strong lenses produced — one true
seed silently dropped, none inverted, none invented, no decoy accepted. The board's own seats
convened correctly in eleven of the twelve runs across the floor and weak-judge/strong-lens arms
combined. A weak solo agent buys precision by omission (highest precision, lowest recall, zero
method). The decoy question at strong-lens strength stays unmeasured: no lens of any strength
proposed a look-alike in this round's twelve runs.

**The automation-ceiling reading.** Where the judge seat is weak, the verdict substantially survives —
precision holds, recall holds close to the strong-judge level on the same lenses, and every run
completes unattended. The one measured failure mode: a weak judge can silently drop a true seed a
lens raised (1 in 39 here). The binding constraints on unattended use at the weak tier are the
permission regime (even a mostly-fixed regime can still cost one arm real coverage, as the quick
profile's own denials here show) and the ceiling on what a weak-tier reader finds at all — the
grounding-dependent classes stay near-zero unless a worker can fetch and run, regardless of judge
strength.
