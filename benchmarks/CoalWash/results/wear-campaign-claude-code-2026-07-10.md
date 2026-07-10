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

## Method notes (instrument lessons, cumulative)

- Inventory v2 requirements: verbatim quotes + line anchors + fat/muscle tags (paraphrased facts defeated substring mapping).
- Raw probe numbers ALWAYS deconflate (authorized-vs-collateral) before any UFER claim; headline counts collateral only.
- True-fix "losses" (a wrong fact corrected) are accounting events, not damage.
- Zero-event claims use rule of three: 0 in N → UFER < 3/N @95%.
- Mapping heuristics narrow only; judgment closes (an opus loss-adjudicator on the residue).

*(Campaign continues: round 3+, arm-4 workability probe, corpus rotation on dry — this file will gain rounds or a successor record.)*
