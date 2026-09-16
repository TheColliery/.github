# SCORE (public) — security-audit-skill vs CoalBoard audit vs solo control, 2026-09-16

> Scrubbed from the internal scoring record for public release: every seed identifier, file name,
> function name, and mechanism-level detail is replaced with its trap CLASS. This file reproduces
> the internal record's tables and verdicts, with one seed-identifying sentence removed from §8 (see
> that section's own note) — it adds nothing that changes a number.
> **Stamp:** measured 2026-09-16 (UTC) · `cloudflare/security-audit-skill` commit
> [`c1c8a8c`](https://github.com/cloudflare/security-audit-skill/commit/c1c8a8c1471069fb0e188eeaff69b8e8db6564a8)
> (2026-09-14), quick profile · CoalBoard v2.4.2, audit mode · model ids `claude-opus-5` /
> `claude-opus-4-8` / `claude-haiku-4-5-20251001` (⚠️ unverified against vendor docs) · Claude Code
> 2.1.273. Full context, design, and every caveat: [`../../SECURITY-AUDIT-2026-09-16.md`](../../SECURITY-AUDIT-2026-09-16.md).
> Denominators: 15 real seeds (5 T0 · 3 T1 · 3 T2 · 3 T3 · 1 T4) + 2 decoys, all matched by root cause
> against a pre-registered key never opened by any solver.
> Trap classes: **T0** control-class bugs (ordinary, memory-catchable) · **T1** post-training-cutoff
> dependency advisories · **T2** locale-specific format/checksum correctness · **T3** corpus-reinforced
> security myths · **T4** a non-English library's documented contract · **decoys** two deliberate
> look-alike non-bugs.

## §2 Per-arm tables (n = 3; min / median / max — no means)

| metric | A (skill, quick profile) | B (CoalBoard audit) | C (solo control) |
|---|---|---|---|
| recall | 0.267 / **0.467** / 0.467 | 0.600 / **0.867** / 0.867 | 0.400 / **0.467** / 0.733 |
| precision (strict) | 0.875 / **0.900** / 1.000 | 0.857 / **0.889** / 0.889 | 0.875 / **1.000** / 1.000 |
| precision (incl. near-misses, sensitivity only) | 0.900 / 1.000 / 1.000 | 0.944 / 0.963 / 1.000 | 1.000 / 1.000 / 1.000 |
| findings reported | 7 / 8 / 10 | 14 / 18 / 27 | 7 / 8 / 10 |
| decoy false positives | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| cost USD | 21.97 / **29.95** / 32.27 | 7.61 / **7.66** / 13.86 | 1.74 / **2.06** / 2.87 |
| wall seconds (orchestrator) | 1,948 / **2,392** / 2,606 | 839 / **878** / 1,183 | 273 / **412** / 563 |
| turns | 9 / 14 / 17 | 3 / 4 / 7 | 7 / 8 / 20 |

**Trap-class recall per run (matched / class size):**

| run | T0 /5 | T1 /3 | T2 /3 | T3 /3 | T4 /1 | T1–T4 /10 |
|---|---|---|---|---|---|---|
| A-r1 | 5 | 0 | 0 | 2 | 0 | 2 |
| A-r2 | 5 | 0 | 0 | 2 | 0 | 2 |
| A-r3 | 2 | 0 | 0 | 2 | 0 | 2 |
| B-r1 | 5 | 1 | 3 | 3 | 1 | 8 |
| B-r2 | 5 | 1 | 0 | 3 | 0 | 4 |
| B-r3 | 5 | 1 | 3 | 3 | 1 | 8 |
| C-r1 | 5 | 0 | 0 | 2 | 0 | 2 |
| C-r2 | 4 | 0 | 0 | 2 | 0 | 2 |
| C-r3 | 5 | 3 | 0 | 3 | 0 | 6 |

Per arm, T0 recall min/median/max: A 0.4/1.0/1.0 · B 1.0/1.0/1.0 · C 0.8/1.0/1.0. T1–T4 recall:
A 0.2/0.2/0.2 · B 0.4/0.8/0.8 · C 0.2/0.2/0.6.

**T1-class miss causes:** the skill arm was either scoped away from the class by its own offline
design in two of three rounds (recognized the fact it needed was external and correctly declined
to guess), or never reached those units after a malformed hunter return in the third. The board
arm reached the pinned dependency and the call path in every round but attached an advisory other
than the seeded one each time — not always the same advisory across rounds — a real defect in
advisory-matching discipline, not a coverage gap; only one solo-control round, which fetched a live
advisory database, matched it. **T2/T4-class miss causes:** the skill arm never mapped the relevant
files onto any hunting unit in any round; one board round examined the class for a different defect
shape and missed it; the solo control reached the validators twice and ruled checksum correctness
out of security scope both times.

## §3 Overlap and pre-registered decision-rule outputs

**Matched-class-instance sets, union over three rounds (by count, never by seed identity):** the
skill arm's union covers all 5 T0 instances plus 3 of 3 T3 instances (8 of 15) · the board's union
covers all 15 except one T1 instance (14 of 15) · the solo control's union covers all 5 T0, all 3
T1, and all 3 T3 instances (11 of 15).

| pair | union-over-rounds Jaccard | r1 | r2 | r3 |
|---|---|---|---|---|
| skill ∩ board | **0.571** | 0.538 | 0.778 | 0.308 |
| skill ∩ solo | **0.727** | 1.000 | 0.625 | 0.364 |
| board ∩ solo | **0.667** | 0.538 | 0.667 | 0.600 |

**Set relation:** every seed instance the skill arm matched in any round, the board arm also matched
in some round (skill-union ⊂ board-union). The board additionally matched every T2-class instance
(3) and the T4-class instance (1) that the solo control never reached in any round; the solo control
matched one T1-class instance (post-cutoff dependency advisory) that the board never matched in any
round.

Non-seed real findings beyond the 15-seed key (verified by the scorer at target source): the skill
arm found 3 distinct ones across its three rounds, the board found 11, the solo control found 1.
⚠️ One of the board's 11 was granted on the scorer's own recollection of a version-sensitive fact,
unverified against a live source (the scoring environment had no network access) — disclosed rather
than folded silently into the count.

**§6 pre-registered decision rules, applied (recall = per-arm median of three rounds unless stated
per-round; the pooled union gives the same verdicts):**
- **Complementary** — Jaccard(A,B) ≤ 0.4 AND both recall ≥ 0.6: Jaccard 0.571 > 0.4 (two of three
  rounds individually above 0.4 too); skill recall 0.467 < 0.6. **FALSE.**
- **Theirs weaker** — recall_A < recall_B − 0.2 at equal cost, OR precision_A < 0.6: at the pooled
  median, 0.467 < 0.867 − 0.2 = 0.667 → **TRUE on recall.** Per round: r1 (0.467 vs 0.867) and r3
  (0.267 vs 0.867) both clear the gap; r2 does NOT (0.467 vs 0.600 — 0.600 − 0.2 = 0.400, and 0.467
  is not below 0.400), so the rule holds in 2 of 3 individual rounds, not all three. Precision_A
  0.900 ≥ 0.6 → the precision clause is false. Cost was not equal: median A $29.95 vs B $7.66 (A ≈
  3.9× B). The qualifier "at equal cost" is not literally met; A had the larger spend, so equalising
  cost could not move the pooled-median inequality in A's favour. **Rule output: "Theirs weaker"
  fires at the pooled median.**
- **Ours weaker** — recall_B < recall_A − 0.2: 0.867 is not below 0.467 − 0.2 = 0.267 → **FALSE.**
- **Rule output: THEIRS WEAKER at the pooled median (recall gap 0.40, twice the reportable ±0.2
  size), holding in 2 of 3 individual rounds; no precision gap — all three arms ≥ 0.857 median
  strict, zero decoy hits.**
- Control reading, same arithmetic, not a pre-registered rule: recall_B 0.867 vs recall_C 0.467
  (gap 0.40); recall_A equals recall_C at the median (0.467) at ≈ 14.5× C's median cost.

## §4 NASA precondition list

**Seeds matched by NO run of any arm: none (0 of 15).** Every seed was matched at least once.

All three arms carry a full three-round miss on some slice of the key. Seeds missed by every round
of arm A: T1-class (all 3), T2-class (all 3), and the T4-class instance (7 of 15) — never hunted.
Seeds missed by every round of arm C: T2-class (all 3) and the T4-class instance (4 of 15) — ruled
out of scope on inspection. Seeds missed by every round of arm B: one T1-class instance (a
post-cutoff dependency advisory, published after any model's training cutoff, against a widely-used
and ordinarily-trusted package) — the only one of these three full-miss cases where every round
reached the relevant pin and call path and still missed, rather than never hunting the unit at all
(see §6 of the full record). B's empirical seats did reach the pin and the reach path in all three
rounds and attached an advisory other than the seeded one each time — round 1 cited a different
advisory family than rounds 2 and 3, which shared one between them, so it was never literally "a
different one every time" though it was always wrong. The only match came from C-r3, the solo run
that fetched advisories. Per-lens attribution (which of the board's seats saw it) is not recoverable
from the report artifacts — see §7.

## §5 Host load per arm (load.log; sampler cadence measured ≈ 12 s, not 10 s)

| arm·round | n | CPU % min / median / max | min free RAM MB | claude.exe min–max |
|---|---|---|---|---|
| A r1 | 217 | 4 / 27 / 100 | 10,757 | 16–17 |
| A r2 | 201 | 4 / 19 / 76 | 11,586 | 16–18 |
| A r3 | 164 | 4 / 21 / 90 | 9,832 | 16–22 |
| B r1 | 71 | 7 / 19 / 52 | 12,867 | 16–18 |
| B r2 | 74 | 5 / 21.5 / 57 | 13,062 | 16–18 |
| B r3 | 97 | 12 / 32 / 86 | 9,954 | 16–19 |
| C r1 | 23 | 7 / 26 / 68 | 14,545 | 16–17 |
| C r2 | 35 | 7 / 19 / 61 | 14,459 | 15–16 |
| C r3 | 46 | 13 / 35 / 86 | 10,383 | 16–18 |

**Caveat:** these are host numbers, not arm-only numbers. The desktop app, the orchestrating
session, unrelated background work, and the sampler ran beside the arms — every row is an upper
bound. Arm-attributable load cannot be separated from these samples. Grouped by the sampler's own
per-sample arm tag (not a derived time window), and cross-checked against `load-summary.json` in
this same results directory — both agree exactly.

## §6 Receipts

| run | rc | subtype | turns | cost USD | wall s (orchestrator) | `duration_ms` (result.json) | models in `modelUsage` |
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

Totals: A $84.19 / 6,946 s · B $29.13 / 2,900 s · C $6.67 / 1,248 s · all $119.99. Every ratio quoted
elsewhere in this record and the full record is a ratio of **median** per-round costs; the ratio of
these **totals** differs (skill/board ≈ 2.9×, skill/solo ≈ 12.6×) because per-round spend is not
uniform within an arm — both are correct, they answer different questions. Wall uses
`orchestrate.log` `secs`; `result.json` `duration_ms` disagrees with it for every A and B run (for
example A-r1 389 s vs 2,606 s) and is shown for the record only, not interpreted. `modelUsage` lists
`claude-opus-4-8` in all nine runs beside `claude-opus-5`; the orchestrator pinned opus. The scorer
records this and does not interpret it.

## §7 What could not be scored, and judgment calls

1. **No unscorable run.** All nine produced their findings artifact; no finding came from free-text
   alone.
2. **Per-lens attribution (NASA test) is not scorable.** The board's reports name its own internal
   seats but carry only the judge's merged findings; lens-level returns are not written to disk. The
   "missed by all seats" statement above therefore reads at arm level, not lens level. The design's
   originally planned convening shape did not match the observed seating in every round.
3. **T1 advisory identity unverified by the scorer (no network, by rail).** The key's advisories
   were quoted independently by arms that fetched live data — corroboration by the solvers, not
   verification by the scorer. Advisories arms cited that were not verifiable here stay classed as
   NEAR (not proven matched), so `p_strict` treats them as unmatched.
4. **Seed-validity observations for the setter (scored per key regardless):** one T3-class instance
   is live only under a non-default configuration; every run judged it low-impact given the target's
   actual auth design, and two of six skill/solo rounds declined to raise it for that reason (the
   solo control raised it in all three of its own rounds). One T2-class instance has zero call sites
   (dead code by inspection).
5. **Judgment calls in bucketing** (applied identically to every run — crediting a finding that
   bundles two seeds under one heading as one finding but two credits, crediting a class match on a
   stated mechanism with no advisory identifier attached at the same bar in two different runs,
   ruling two specific claims false on inspection): recorded in the internal record by run and
   finding number. None of these moves any §3 verdict: B's median recall stays ≥ 0.8 and A's stays
   ≤ 0.467 under any of them.
6. **Independence caveat carried from one board round's own header:** that round ran with ambient
   governance loaded, "not independence-clean." This is recorded, not scored.
7. **Target copy state:** the lab target the scorer read for verification is the post-final-round
   reset copy. Its source matches the seeded diff on every seed hunk the scorer read.

## §8 Class-level summary for the vendor (no seed text, no locations, no fixed problem + answer)

> The "corpus-reinforced myths" bullet below is generalized relative to the internal record — the
> internal version names which specific defect patterns were caught and describes the mechanism
> behind the one inconsistently-raised instance; both are removed here because, combined with the
> class breakdown elsewhere in this file, that level of specificity sits too close to identifying a
> specific seed for a public release. The aggregate (median 2 of 3) is unchanged.

Nine blind runs on one seeded multi-tenant web service: three per method, same model tier, three
rounds each, with a solo control.
- **Control-class bugs (ordinary, memory-catchable):** the skill's quick profile matched them at a
  median of 100 % per round. One round fell to 40 % when a hunter return was malformed and the
  quick-profile budget could not re-fund the lost units. Hard-won coverage then depended on a single
  worker's output format.
- **Post-training-cutoff dependency advisories:** 0 % in all three rounds. In two of the three
  rounds the runs reached the pinned parsers and stopped, stating that installed-dependency or
  advisory facts were outside what the profile may check; in the third, the relevant units were
  never reached after an earlier malformed worker return (see the control-class bullet above). That
  reads as a design boundary in the two rounds that reached it, not a lapse. Methods that looked up
  advisory ranges scored here.
- **Locale-specific format/checksum correctness and a non-English library contract:** 0 % in all
  three rounds. Those validators never became hunting units. The attack taxonomy did not map "wrong
  domain arithmetic on an identity/payment field" to a surface worth hunting.
- **Corpus-reinforced myths:** median 2 of 3. Most of the class was caught in every round; one
  instance was raised and credited in only one of the three rounds, the other two rounds correctly
  judging it low-impact under the target's own deployment configuration (see §4/§7 above).
- **Precision:** high, a median of 90 %. Zero hits on either deliberate look-alike decoy in any
  round. Every claim carried a trace.
- **Cost:** the highest of the three methods, about 3.9× the board's median and about 14.5× a
  single-agent review. Median recall equalled the single-agent control.
- **Gap classes, stated as classes:**
  1. Grounding against external advisory data is forbidden by the offline design.
  2. Domain-correctness defects outside the security taxonomy fall through coverage mapping.
  3. Quick-profile coverage is fragile to one malformed worker return.
  4. Exploitability gating removes defects that are real by standard but not reachable today.
