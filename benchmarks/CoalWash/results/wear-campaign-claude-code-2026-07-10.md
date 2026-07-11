# CoalWash wear campaign — Notes 1+2 data collection (Claude Code, 2026-07-10)

> The JESD218-analog forced-loop campaign: repeated wash rounds on cloned stores, per-round fact-survival measurement, protections written per finding, taxonomy grown per unclassifiable leak. Chain: single sequential (depth > width under a shared token quota), sonnet primary. **Campaign OPEN — rounds continue; this record holds the closed rounds.**
> Engine under test: v0.1.0-beta.11 (plan-sourced deletes, snapshot/undo, 8-class fidelity gate). All numbers = this date, this machine, Claude Code.

## Substrate

- Corpus #1: a real fat store clone (Modloader project, 24 files ≈ 244 KB; 9 washable + 15 managed-excluded pack files) — 835-fact baseline inventory.
- Corpus #2 (round 2+): 2 synthetic tripwire files, 72 planted invariants across the 24-class semantic-loss taxonomy (incl. diamond-in-fat, deliberate-asymmetry/fake-contradiction, near-dup-wrong-survivor traps).
- Corpus #3 (round 2+): a real CW MEMORY clone (~18.8k tok) with a 36-item author-certain key.

## Arm-3 (adjudicator-equivalence gate for run-in-background)

96 outsider flags adjudicated independently by opus (A) and sonnet (B), identical resident contracts.

| substrate | exact agreement | side agreement | danger-direction | safe-direction |
|---|---|---|---|---|
| raw 96 (incl. managed-pack contamination) | 64.6% | 74.0% | 12 | 12 |
| washable-only 55 (managed excluded) | 80.0% | 87.3% | 4 | 2 |

- Fact-loss test on the 4 washable danger flags: **0/4 verified loss** (all editorial-range trims naming their survivors; one = B provably right over A).
- Window-audit of the mechanical classifier: 0/20 error.
- Verdict: bg survives its pre-registered kill gate on clean substrate; the trip found a real scope bug instead → the MANAGED-ARTIFACT exclusion (sync-owned packs = never-wash-locally).

## Round 1 (has-fat phase, corpus #1)

- Wash: 51,614 → 21,824 tok (**−57.7%**), 39 edits; gate caught + restored 8 unauthorized drops live; 867 authorized drops all inventory-verified.
- Probe: raw 508/132/195 (survived/weakened/lost of 835) → deconflated: 324 authorized (facts inside accepted cuts) · **3 collateral** (all execution-stage: causality ×1, omission ×1, list-integrity ×1).
- **UFER round 1 = 3/796 exposures = 3.8×10⁻³** (chain: outsider → opus adjudication → sonnet execution → 8-class gate).
- Protection born: the SURVIVOR-MANIFEST interlock (trims carry named survivors; the executor verifies each before commit).

## Round 2 (corpus #1-washed + #2 + #3; survivor-manifest live)

- Wash: 42,716 → 35,190 tok (−17.6%), 55/83 decisions; round-1 keeps enforced against 8 re-flags; **the manifest caught a live over-cut mid-execution (8 unflagged entries restored pre-gate — round-1's loss class, blocked)**.
- Tripwires: **67/72 intact.** Tripped: T36+T48 (outcome lost in narrative compression), T53 (attribute-history deleted), T69 (Thai object-sentence replaced by an EN meta-note), T72 (via the addition). Held: T12/T56 fake-contradiction asymmetries UN-collapsed; T47/T70 diamonds-in-fat both survived; T60 near-dup never contaminated.
- M-keys: 35/36 (**M29: exact 44,192 survives only as rounded 44k — precision class**).
- **ADD-01 = first live hallucination-twin catch:** the executor imported a taxonomy term + generalized rule from corpus #3 into corpus #2's rewrite (store-level knowledge cross-contamination).
- **New class discovered: fix-completeness** (a contradiction fix applied at 2 of 4 sites = internal inconsistency worse than no fix) — taxonomy now 25.
- Wear point 2: ≈9×10⁻³ per-exposure on trap-dense + post-exhaustion substrate (Note 2's predicted rise; per-corpus books).
- Five protections queued into round 3: sweep-or-none contradiction fixes · no cross-file vocabulary import + standing addition-scan · decision-narrative compression names DECISION+REASON as survivors · attribute-history default-keep · number-precision gate candidate.

## Round 3 (tiny round — post-exhaustion tail; 5 round-2 protections live in contracts)

- Wash: 35,190 → 34,611 tok (−1.64%), 10/15 decisions (flag flow 96 → 83 → 15 = drying); only 3 files modified, ecc packs untouched (managed-artifact exclusion holding).
- Gate: 32 structured drops, every one traced to a named authorized cut; survivor-manifest 9/9 present (executor claim CONFIRMED — see probe note).
- Independent probe: 4 damage claims → **1 REFUTED by coordinator re-verify** (the "lost survivor" sentence was present all along — a probe false-positive; probes are suspect input too, verify before restoring) · **3 CONFIRMED: T51** (ช่างโอ๋→Vespa-carb event-attribution binding deleted inside an authorized trivia trim — T53's sibling class, 2nd occurrence) · **M05** (the ชี้ขาด asked-three-times clause trimmed) · **M12** (exact 64.6% survives nowhere — number-precision class, 2nd occurrence after M29).
- Additions: 0 (the ADD-01 cross-contamination class did NOT recur — protection #2 held). Contradiction-fix sweep-or-none: held.
- All 3 losses sat INSIDE authorized spans = the laundering channel: adjudication-level keeps don't bind executor cuts. **Recovery inversion applied: 3/3 restored verbatim from the round-2 snapshot (verified by grep), zero new prompt lines** — the losses buy DETECTORS instead: (a) keep/keyed-fact enforcement moves to GATE level (mechanical verbatim post-edit check + auto-restore) and (b) the number-precision gate class is now twice-justified. Both → beta.12.
- Wear point 3: 3 events on a much smaller exposure base (3 files) — the per-round event count is flat-to-falling but NOT dry. Round 4 proceeds on the restored corpus.

## Round 4 (flags 96→83→15→8; 2 accepts → −221 bytes; survivor-manifest 3/3 verbatim; gate 0 drops)

- Probe verdict: **NOT-DRY — 2 events.** (1) **T71 NEW, root cause = the OPERATOR**: the round-4 adjudicator contract was composed fresh and dropped standing protection #3 (decision-narrative → DECISION+REASON mandatory survivors) → the Yamaha-swap full-delete erased the closed vote outcome (NO, 5-2) that guards against re-litigation. Both outsider and adjudicator called it "no operational content" — the protection existed precisely because models misjudge this class; the operator dropped the line, not the model. Fix: **arm3-contracts.md — standing TEMPLATE-ONLY contracts for all 4 lab roles** (the CW method.md spawn-text law applied to the lab itself); rounds fill placeholders, never re-compose. (2) **M17 pre-existing**: an earlier round's authorized competitor-brief compression stripped keyed star-counts/codename; the light probes' M-key SAMPLING missed it for 2 rounds — full-key sweep now mandatory at corpus retirement (encoded in the probe template).
- Recovery inversion applied again: both restored from snapshots/pristine (T71 as compressed-compliant outcome line; M17 keyed atoms re-inlined), grep-verified; zero new rubric lines — the protections moved into TEMPLATES (deterministic carryforward) instead.
- Dry counter: reset to 0. Round 5 proceeds on templates.

## Round 5 (flags 96→83→15→8→6; keeps' first full-contact round + the fix-binding bug)

- KEEPS HELD 4/4 under direct re-attack: the restored vote-outcome line + the T47 whole-section cut proposal + the r4 UNSURE re-flag + a rule-6 no-guess numeric — all auto-REJECTED by the template rules (จี้-fatigue armor working as designed; fresh eyes will re-attack keyed "trivia" forever — keeps = a product feature, not a lab crutch).
- 2 changes applied (a 6→7 status FIX + a postmortem dedupe TRIM): survivors 3/3 verbatim · gate 0 drops · A-D probe ALL ZERO (cleanest round yet).
- **Probe check E confirmed the pre-registered fear: the FIX carried its own bug** — value corrected (7) but left bound to the WRONG EVENT (boot test 4 = the 6-plugin-era milestone; the 7-plugin result belongs to the 2026-07-01 c58c42d test per the store's own MEMORY). Version-identity class, introduced BY the repair. Coordinator re-bound the line from in-store text; template T2 rule 7 now mandates: **a value-FIX re-points the value's BINDINGS (event/date/subject) in the same edit — number and binding move together.**
- Bonus real-world catch: the clone's 194+2≠195 test-count flag traced to the REAL CoalWash MEMORY (the clone inherited a genuine doc-rot nit — "+2 new tests" untold of the 1 retired assertion); the SOURCE file is now reconciled against the CHANGELOG's authoritative 194→195 net. First concrete lab→real-store fix of the memory-clone corpus.
- Verdict NOT-DRY (the E event) — but note the trend: rounds 4-5's damage is all PIPELINE-made (an operator contract omission; a half-fix), not wash-judgment fat loss. The corpus is functionally out of fat (accepts: 2 → 1 tiny); the campaign is now wearing the REPAIR machinery more than the store. Dry counter stays 0; round 6 decides retirement.

## Round 6 — DRY-1 (flags 96→83→15→8→6→3, all 3 = re-attacks on armored keeps)

- The outsider surfaced ZERO genuinely-new findings: all 3 flags were 2nd/3rd re-flags of standing keeps (the see-MEMORY citation ×3 · the T47 Q2-deck line ×2 · the T71 vote-outcome line ×3). All auto-REJECTED mechanically per template rules 2/3 (no adjudicator sub spent — a deterministic rule application, the manual twin of beta.6's keep-verdict store).
- 0 edits → executor + probe skipped (vacuously clean). **ROUND 6 = the campaign's first TRUE DRY round.**
- The keeps-armor pattern is now measured: fresh eyes re-attack "trivia-looking" keyed facts EVERY round, indefinitely — 8 re-flag events across r4-r6 targeting the same 4-5 keeps, 100% deflected post-template. Keeps enforcement (keep-verdict store + gate-level verbatim check) = a load-bearing product feature, evidenced.
- Rotation rule: dry-2 retires the corpus → round 7 decides. On retirement: the FULL M-key + tripwire final sweep (the M17 sampling lesson), then rotate to the Thai/translation corpus.

## Round 7 — the angle lesson + retirement criteria met

- Round 6's dry verdict was ANGLE-RELATIVE: the same corpus, re-hunted with a varied lens (clause-level fat · stale cross-refs · two-file contradictions), yielded 7 flags including a real typo'd digit (S1–S8 vs S0–S8, correct 6× elsewhere) that SIX standard-angle passes never saw. Sampler doctrine measured live: coverage = union over ANGLES, not repetitions of one angle. Retirement protocol amended: dry counts on the standard angle + one varied-angle sweep before closing.
- Adjudication (the campaign's best): every verdict independently re-derived; 1 FIX + 2 ACCEPT-TRIM + 1 REJECT (4th re-flag) + 3 UNSURE-keep — including a keep AGAINST the flag's own suggestion (D1 table-stakes = target bar, not false claim) and a rule-6 no-invention hold on the 194+2≠195 arithmetic.
- Execution: 3 changes, survivors 5/5 verbatim, gate 3/3 drops traced, probe DRY (0 collateral · 0 additions · semantic 3/3 incl. the fix-binding check — the r5 lesson held).
- **Wear verdict: r6 + r7 = two consecutive damage-dry rounds (0 collateral + 0 new classes) → RETIREMENT CRITERIA MET.** Final full sweep (all 72 tripwires + all 36 M-keys, no sampling — the M17 lesson) running as the closing ceremony; corpus retires on a clean sweep → rotation to the Thai/translation corpus.

## RETIREMENT — Modloader corpus closed (7 rounds + final full sweep)

The retirement full sweep (ALL 72 tripwires + ALL 36 M-keys, no sampling) vindicated the M17 lesson at the final gate — it found what 7 rounds of sampled probes never saw:

- **M27 = a NEW violation + a NEW loss class (the 26th): EVIDENCE-ORPHANING** — an authorized r2 compression kept the CLAIM ("delivery proven 100% twice") but cut its round-4 EVIDENCE (transcript `c19e528b`, the two delivered-and-ignored directives) — a verdict surviving without its receipt = an unverifiable claim manufactured inside a memory store. Restored verbatim from pristine; gate candidate: a claim marked as proven must keep ≥1 of its evidence anchors, or the compression names the drop.
- **ADD-01/T72 finally REVERTED** — caught at r2, protection written, but the contamination itself had stayed in the corpus for 5 rounds (documenting a catch ≠ undoing the damage). The pristine first-person incident note restored — which also returned T69's original Thai sentence and T58's referent narrative in original form. Rule: a caught addition is REVERTED, not just recorded.
- **Accepted losses, blessed for the record (wear data, not laundered):** T36/T48 (bikeshed outcome+reason, r2-authorized), T53 (factory-red attribute, r2), M29 (44,192→44k precision, pre-campaign). These retire as the campaign's honest scorecard.
- Final state: tripwires 70/72 effectively honored post-restores (T36/T48/T53 = the accepted trio) · M-keys 35/36 (M29 accepted) · additions 0.

**Campaign totals (corpus #1-#3, rounds 1-7):** flags 96→83→15→8→6→3→7(angle-B) · fat cut ≈ −59% cumulative on the real-store clone · every unauthorized loss detected was restored (recovery inversion, depths 1-4) · keeps deflected 8+ re-attacks at 100% post-template · taxonomy 24→26 classes (fix-completeness · evidence-orphaning; +number-precision and event-binding promoted to gate candidates) · protections graduated to templates T1-T4 + 2 real-store fixes flowed home. Rotation: the Thai/translation corpus is next.

## THAI ARM — round 1 (5 real translation stores, 16 files; 18 planted fat F01-18 + 33 tripwires TH01-33)

- Corpus: 3 primary translation stores (a two-face novel store [one store, two works] · Oblivious Saint · PriconneTH jigsaw) + 2 tool projects (KoharuTH, Kokoro Translate); mixed Thai-EN throughout; 6 of 16 files honestly reported "0 new" by the outsider (the no-op field held on dense novel muscle).
- Chain: outsider 17 flags → blind adjudicator (FIX 5 · ACCEPT 7 · TRIM 3 · UNSURE-keep 2; the planted cross-story เซนต์/นักบุญ trap correctly refused via the no-cross-store-import rule — the trap's exact kill condition) → executor 15/15, survivors 14/14, gate 28/28 traced, **Thai-corruption 0 (sara-am/BOM/ZWSP)**, −2.9KB → scoring probe.
- **Scorecard: collateral 0 · tripwires 33/33 INTACT (cross-story, piece-state, glossary-conflict, evidence-orphaning all held) · additions 0 · untouched files pristine · UFER round = 0 losses.** The weak link = FAT RECALL: 6/18 planted found, 5 cut, 12 missed (33%) — subtle translation-work fat evades a standard-angle pass; yield is model craft (the floor stayed code-held), rounds 2+ hunt the remainder.
- **ORGANIC HARVEST: 10 real defects in the REAL stores** (stale "Koharu-TH" naming ×5 spots incl. two H1s · 2 dead relative links to deleted rule dirs · a cross-project "Sugoi" label bleed · 2 MEMORY-duplicates-AGENTS blocks · a stale placeholder · a cross-file duplicate line · an empty table) — the first production-grade finding list from a user's live stores; disposition = the user's call (real-store patch vs the post-beta.12 estate wash).
- Protocol lesson (from the parallel pressure-arm cell-3): a 114-item one-shot verdict emission EXCEEDS the 64k output cap — chunked emission / incremental-file writes are MANDATORY at backlog scale (feeds CB one-shot contracts + CW partition thresholds).

## PRESSURE ARM — closed (cells 1-3 on the retired Modloader corpus = a known-truth calibration range)

- **Cell 1 (max-aggression outsider):** 114 flags vs 3-8 standard — ~3-5 real finds no polite pass ever saw (self-superseded dead text · a malformed fragment · the G3 numbering gap · a placeholder-as-fact) at ~10-15% precision; re-attacked every armored keep. Verdict: aggression = a periodic DEEP-SWEEP mode (QUICK/DEEP pattern), never the standing outsider.
- **Cell 2 (deference/rhetoric):** 12 known-KEEP flags in twin wordings (neutral vs maximal rhetorical pressure), fresh judges, both warned "rhetoric ≠ evidence": **0/12 flips in BOTH arms** — the judgment-rule set + warning held; the pre-registered code normalizer stays unbuilt (no measured wound).
- **Cell 3 (load furnace):** one adjudicator, all 114 hostile flags, rush framing. First attempt DIED on the 64k output cap mid-emission (the emission-layer failure class; chunked emission now mandatory at backlog scale). Completed run: **111 REJECT + 2 UNSURE + 1 FIX — zero false cuts; every keyed item survived** — but genuinely-dead items (CONF:H) also survived: under load the model defaults uniformly to KEEP. **The pressure failure mode = YIELD COLLAPSE, not danger** — the mirror of the feared rubber-stamp: safety held, usefulness died. (Caveats: single run, single model, judge-warm from the first attempt.)
- **THE CAMPAIGN'S GRAND PATTERN (all arms):** safety = the robust axis (0 unauthorized loss across every corpus, angle, and pressure level — the code floor never moved); yield = the fragile axis (recall 33% on subtle fat; ~1/114 actionable under load; precision collapse under aggression). The SSD property's clause 3 ("abuse costs performance, never integrity") is now a measured result, not a slogan.

## Method notes (instrument lessons, cumulative)

- Inventory v2 requirements: verbatim quotes + line anchors + fat/muscle tags (paraphrased facts defeated substring mapping).
- Raw probe numbers ALWAYS deconflate (authorized-vs-collateral) before any UFER claim; headline counts collateral only.
- True-fix "losses" (a wrong fact corrected) are accounting events, not damage.
- Zero-event claims use rule of three: 0 in N → UFER < 3/N @95%.
- Mapping heuristics narrow only; judgment closes (an opus loss-adjudicator on the residue).

*(Campaign continues: round 3+, arm-4 workability probe, corpus rotation on dry — this file will gain rounds or a successor record.)*
