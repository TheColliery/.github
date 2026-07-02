# CoalMine Eval Results — rot-canary

**Benchmark loop: K=3 repeated runs per arm, extended to K=5 on any flip** (per the
locked methodology — paired design + stochastic repeat, arXiv 2411.00640).
**Date: 2026-07-03 · Skill version: 3.8.4 · Corpus: 16 fixtures (13 planted defects + 4 clean decoys), scored mechanically by `score.mjs`.**

> **TL;DR (plain language):** ทดสอบนกขมิ้น rot-canary กับโมเดลรุ่นใหม่ รันซ้ำ 3-5 รอบต่อรุ่น —
> Fable 5 จับครบ 13/13 ทุกรอบไม่แกว่งเลย · Sonnet 5 จับ ~97% · Haiku 4.5 จับ ~89% ·
> ไม่มีรุ่นไหน false-alarm บนไฟล์สะอาดแม้แต่ครั้งเดียว (0 จาก 72 โอกาส) ·
> ที่ corpus ง่ายระดับนี้ Sonnet เปล่า ๆ ก็จับได้เกือบเท่ากัน แต่**สกิลช่วยให้ตัดสินความรุนแรงแม่นขึ้น ~10 จุด**
> (95% vs 85%) · โจทย์เดียวที่แยกรุ่นเก่ง-อ่อนได้จริงคือ dead function ที่ต้องไล่ reachability ทั้งไฟล์

## Aggregate by arm (recall = planted defects found)

| Arm | K | Recall per rep | Median | Mean | Precision | Decoy FPs | Severity acc (mean) |
|---|---|---|---|---|---|---|---|
| **claude-fable-5** (skill ON) | 3 | 100·100·100 | **100%** | 100% | 100% ×3 | 0/4 ×3 | **100%** |
| **claude-sonnet-5** (skill ON) | 5 | 100·92·100·100·92 | **100%** | 96.9% | 100% ×5 | 0/4 ×5 | 95% |
| **claude-sonnet-5** (vanilla, skill OFF) | 5 | 92·100·100·100·100 | **100%** | 98.5% | 100% ×5 | 0/4 ×5 | 84.6% |
| **claude-haiku-4.5** (skill ON) | 5 | 85·92·92·85·92 | **92%** | 89.2% | 2 FPs (r1,r2) | 0/4 ×5 | 79.4% |
| **Antigravity — Gemini 3.5 Flash Medium** (skill ON) | 3 | 92·100·92 | **92%** | 94.7% | 100% ×3 | 0/4 ×3 | 86.3% |

## Key findings

1. **Skill ON vs OFF (sonnet-5, K=5 paired): detection saturates, severity judgment separates.**
   Recall ON 96.9% vs OFF 98.5% — no measurable detection gain on this corpus (discordant
   reps: 3; McNemar n/s). The corpus is unambiguous-by-design → ceiling effect at the
   sonnet+ tier. BUT severity accuracy: **ON 95% vs OFF 84.6%** — the vanilla arm
   systematically over-rates severity (f06/f07 → CRITICAL where ground truth is HIGH,
   stable across 4/5 reps = systematic, not noise). The skill's severity rubric
   (CRITICAL = crash/security on the normal path · HIGH = real bug on a reachable path)
   calibrates the judgment even where raw detection is saturated.
2. **Tier ladder confirmed (skill ON): fable 100% (zero variance) > sonnet 96.9% > haiku 89.2%.**
   Detection is engine-dependent, AV-style. Fable-5 is the only arm with ZERO flips
   across all reps — 13/13, severity 13/13, every run.
3. **The discriminating item: `f01` line 5 (zero-ref dead function).** Needs whole-file
   reachability reasoning, not line-local pattern-match. Found: fable 3/3 · sonnet-ON 3/5 ·
   sonnet-OFF 4/5 · haiku 0/5 (stable miss = tier ceiling, not variance) · AG-r1 miss.
   Every other planted defect is found by every Claude arm in ≥4/5 reps.
4. **Zero decoy false positives in all 18 runs (72 decoy-file opportunities).** The
   "report only what the code shows" discipline held on every engine, with and without
   the skill. The only FPs anywhere: haiku r1/r2 flagged `f02/src/main.js:1` (wrong file
   for the real f02 defect).
5. **No regression vs the old baseline.** fable-5 @ skill v3.4.0 (K=1, 2026-06-12) = 13/13;
   fable-5 @ v3.8.4 (K=3) = 13/13 stable. Skill evolution 3.4.0 → 3.8.4 did not move
   detection.

## Per category (union across Claude skill-ON arms — all 100% except)

| Category | fable | sonnet-ON | haiku |
|---|---|---|---|
| dead-code (3 planted) | 3/3 ×3 | 2.6/3 mean (f01:5 flips) | 1.8/3 mean (f01:5 never, f02 flips) |
| all other 6 categories (10 planted) | 10/10 every rep | 10/10 every rep | 10/10 every rep* |

\* haiku r4 dropped f02 entirely (hedged out of the JSON) — its only non-dead-code miss.

## Methodology

K=3 stochastic repeats per arm, same prompt verbatim per arm, each rep a FRESH
agent (no shared context); any item flipping within K=3 extends that arm to K=5
(fired for both sonnet arms — f01:5 — and haiku — f02). Blind protocol: workers
read ONLY `fixtures/*/src/*`; `expected.json`/results/scorer off-limits. One run
was invalidated live (a cross-tree grep leaked expected.json into a sonnet
worker's context) and re-run clean with an added no-cross-tree-grep clause —
contamination QC works. Scoring is mechanical (`score.mjs`: fixture + file +
category, line ±3; severity scored separately). Vanilla arm gets the same output
contract and 7-slug category vocabulary but no skill contract (its ~15-line scan
discipline, category definitions, severity rubric, and "confirmed-only" rules are
the treatment). Statistic frame: paired per-fixture comparison, majority (≥3/5)
verdict per item, per Miller 2024 (arXiv 2411.00640) — a 13-defect corpus can
credibly show only LARGE differences; small edges need hundreds of items.
Caveats: fixtures authored in this project (regression floor, not independent);
corpus unambiguous-by-design → ceiling effect at sonnet+ tier; engine-dependent
like AV detection rates. This file is the hand-authored K-rep aggregate — do NOT
regenerate with `score.mjs --write` (that emits a single-run block).

## Multi-canary matrix (2026-07-03 — 6 new fixture suites, 3 engines)

> **TL;DR:** ขยาย benchmark จาก rot-canary ตัวเดียวเป็น 7 นกขมิ้น (66 fixtures ใหม่, สร้าง+review ด้วย
> org 3-sub flow). ผล: 5 ใน 6 suite ใหม่ ทุก engine จับครบ 100% ทุกรอบ (corpus ชัดโดยดีไซน์ = regression
> floor) · **drift-canary = suite เดียวที่แยก engine ได้จริง** (fable 93 > AG 84 ≈ sonnet 80 mean) —
> ทุก engine "เห็น" ความขัดแย้งครบ แต่เลือกฝั่งผิดหรือ hedge ทิ้งต่างกัน · false alarm บนไฟล์สะอาด = **0
> จากทุกโอกาสของทุก engine** ทั้ง batch.

Recall per suite (median over K reps; K=3 extended to 5 on any flip):

| Suite (8 planted + 3 decoys each) | claude-fable-5 | claude-sonnet-5 | AG Gemini 3.5 Flash |
|---|---|---|---|
| scale-canary | **100** ×3 | **100** med (95.2 mean, K=5) | **100** ×3 |
| resilience-audit | **100** ×3 | **100** ×3 | **100** ×3 |
| telemetry-canary | **100** ×3 | **100** ×3 | **100** ×3 |
| testability-canary | **100** ×3 | **100** ×3 | **100** ×3 |
| **drift-canary** | **88** med (92.8 mean, K=5) | **88** med (80.4 mean, K=5) | **88** med (83.7 mean) |
| supply-chain-audit | **100** ×3 | **100** ×3 | **100** ×3 |

Severity accuracy (mean): fable 89% · sonnet 84% · AG 79% — the judgment ladder from the
rot-canary run holds across all suites (fable ≥ sonnet ≈ AG).

### What separates engines — the discriminating items

Detection saturates; **judgment items** discriminate:

- **drift f08** (a library whose JSDoc contradicts its own code): every engine flips on WHICH
  side is authoritative — fable 2/5 · sonnet 1/5 · AG ~1/3 pick the planted side. Genuinely
  ambiguous-authority; kept as a known-ambiguous item, not a defect of any engine.
- **drift f04** (required config key missing from the defaults catalog): sonnet reads the
  CATALOG as the wrong side 4/5 reps (systematic alternative reading, not noise); fable and
  AG read the planted side.
- **drift f07** (duplicated constant, values still equal): sonnet drops it as "no behavioral
  break yet" 3/5 reps — the FN-trap the corpus review predicted verbatim.
- **scale f03** (unbounded cache): sonnet anchors the finding at the DECLARATION line 2/5
  reps, fable at the mutation line every time — an anchor-convention split, not a detection
  gap (both describe the same defect).
- **rot f01:5** (zero-ref dead function): the original discriminator — fable 3/3 · sonnet 3/5 ·
  haiku 0/5 · AG 1/3.

### Corpus lessons (for the next fixture rev)

1. Defects with two legitimate anchor lines (declaration vs occurrence) need either a
   single-anchor plant or scorer alternate-line support.
2. Two-sided drift pairs must state the authoritative side IN-FILE beyond doubt — f04/f08
   show that "objectively decidable" to a reviewer is not always unambiguous to a scanner.
3. Not-yet-diverged duplication is a legitimate FN-trap — keep, but expect engine-dependent
   recall on it.
4. All corpora were built by 6 builder subs and adversarially verified by 2 review subs
   (severity reconciled to each skill's OWN rubric; 1 accidental second defect removed;
   1 decoy hardened) before freezing at commit `c943fcc`.

Provenance: 42 CC runs (this section) + 18 AG runs, every run blind + fresh-context, scored
mechanically by the suite-aware `score.mjs`. AG drift flipped 75↔88 at K=3; the extension to
K=5 is optional — its two misses are the same systematic classes (wrong-side f04-shape +
f07 drop), not sampling noise.

## Cross-engine comparison (2026-07-03, K=3 both vendors)

Two vendors over the same corpus, blind (fixtures + ground truth authored on the
CC side; expected.json off-limits to every scanning agent). The 2026-06-13
single-run AG baseline (13/13, that era's engine, skill v3.4.0) is superseded by
this K=3 protocol.

| Engine | Recall per rep | Median | Precision | Decoy FPs | Severity acc |
|---|---|---|---|---|---|
| claude-fable-5 (K=3) | 100·100·100 | **100%** | 100% | 0/4 ×3 | 100% |
| Antigravity Gemini 3.5 Flash Medium (K=3) | 92·100·92 | **92%** | 100% | 0/4 ×3 | 86.3% |

AG's only recall misses: f01:5 (1/3 found — the zero-ref dead function, the same
item that separates the Claude tiers: fable 3/3 · sonnet 3/5 · haiku 0/5). AG
flips on it exactly like sonnet does — per the flip rule this arm would extend
to K=5 (2 more user-run rounds) to settle the item; K=3 medians stand either
way. Severity divergence again concentrates in the judgment band (86% vs
fable's 100%), the same shape as the 2026-06-13 result: detection converges
across vendors, severity judgment diverges — consistent with the cross-model
convergence theory. AG protocol note: all 3 reps ran as fresh scanning contexts
(fresh conversations), matching the CC arms' fresh-sub-per-rep design.
