# Controlled equal-size fidelity benchmark — v1

**Date:** 2026-07-12 · **Platform/engine:** Claude Code (naive arm = 4 general-purpose subagents; corpus/coalwash arm = a real dogfood re-wash) · **CoalWash version under test:** the coalwash arm is the shipped re-wash output; scoring uses the shipped inventory engine `coalwash@0.1.0-rc.3` (`scripts/lib/fidelity-gate.mjs`).

## What this measures (and why it is designed this way)

The thesis under test: **CoalWash's value is maximum saving UNDER the constraint of zero fact-loss — not the smallest file.** A naive "unchecked-growth vs CoalWash" size race is a broken benchmark: it rewards blind deletion (cutting muscle shrinks the file too) and ignores both fidelity and the time-flip ("today's fat is tomorrow's muscle").

The fix is a **controlled experiment: hold output SIZE constant across the cutting arms, then measure what each arm LOST.** At equal saving, the only remaining variable is fidelity.

- **Controlled variable:** every cutting arm targets the SAME output size (~the real CoalWash result, 68,924 B).
- **Independent fidelity:** recall is recomputed here directly from each arm's output using the shipped inventory engine. CoalWash's own gate result is NOT cited as proof — a tool may not grade itself. (Our independent number is *consistent with* the tool's self-report; that consistency is a cross-check, not the evidence.)

### The three arms

| Arm | What it is | Fidelity gate | Archive/externalize |
|---|---|---|---|
| **unchecked** | the corpus left untouched | n/a (100% by identity) | n/a — pays max tokens every session forever |
| **naive-compress** | a FAIR market competitor: an LLM told "compress this to ~69 KB, keep it useful and readable," no token-preservation instruction | none | none (lossy-summarize-and-hope — what memory-defrag / consolidate-memory ship) |
| **coalwash** | the real re-wash already run on this corpus (dogfood) | yes (code diff, zero-structured-token-loss) | yes (LATENT content relocated to `LAB-ARCHIVE.md`) |

### The three labels (narrative + the recoverability metric)

- **FAT** = waste (duplicate / dead / verbose prose). Correct action: delete.
- **MUSCLE** = load-bearing (a live fact / link / number / version / quote). Correct action: keep in the live file.
- **LATENT** = "done today, maybe needed later" (lab records, dated point-in-time entries). Correct action: **EXTERNALIZE** (relocate, do not delete) — this is the time-flip guard.

## Corpus identity (N = 1)

| File | Role | Bytes | Structured tokens |
|---|---|---|---|
| `snap-1783860774962/f0` (pre-re-wash `MEMORY.md`) | **corpus** / `unchecked` baseline | **150,115** | **448** |
| `MEMORY.md` (current, live) | coalwash arm — live output | 68,924 | — |
| `LAB-ARCHIVE.md` (current) | coalwash arm — externalized archive | 113,560 | — |

**Corpus token inventory (448 total, by class):** wikilinks 12 · dates 5 · versions 11 · links 1 · frontmatter 0 · codespans 121 · quotes 175 · numbers 123. (Measured by `inventory()` in the rc.3 engine — the same 8 structured-token classes CoalWash's gate diffs.)

### Corpus selection — which snapshot, and why (the brief said "note which")

Two snapshots exist in `.claude/coalwash/`:

- `snap-1783844097736/f0` = **pre-first-wash**, 246,077 B, 772 tokens (the *largest*).
- `snap-1783860774962/f0` = **pre-re-wash**, 150,115 B, 448 tokens.

The brief offered "pick the LARGEST." **The largest (246,077 B) is the WRONG corpus for this arm, empirically:** the coalwash union (`MEMORY.md` ∪ `LAB-ARCHIVE.md`) recalls only **52.98%** of the 246,077 B file's tokens — its first-wash deletions live only in the `store.old` bin, not the archive — so the "0-lost" claim would be *false* against it. The **pre-re-wash 150,115 B file is the coalwash arm's actual input**: its 448 tokens are recalled **448/448 = 100%** by the union, matching the re-wash's cited "0/448 lost" proof exactly, and it yields the ~54% saving the controlled design targets. The pre-first-wash file is a *prior wash generation*; folding it in would (a) break the equal-size control (the real arm cut from 150k, not 246k) and (b) measure two wash operations as one. **Corpus = the pre-re-wash 150,115 B file.**

### How the labels map to measurable token sets (by the coalwash arm's disposition)

- **MUSCLE** = 258 tokens kept in the live `MEMORY.md` (448 − 190).
- **LATENT** = **190** tokens relocated to `LAB-ARCHIVE.md` and NOT retained in the live file (the "strict latent" / purely-externalized set). (293 corpus tokens appear in the archive; 103 of those also remain live = shared muscle/latent overlap. The 190 strict-latent set is the clean "removed-from-live-but-relocated" quantity.)
- **FAT** = the ~81,191 deleted bytes carrying **no unique structured token** — guaranteed by the union recall being 100% (every structured token survives somewhere), so the deleted-only content held only verbose/duplicate prose.

## Metrics (three per arm)

1. **saving%** of always-loaded bytes = (corpus − live-output) / corpus.
2. **structured-token recall** = of the corpus's 448 tokens, the fraction present in (output ∪ any archive the arm produced). Recomputed independently per arm with the rc.3 `inventory()`. A dropped token with a surviving duplicate counts as preserved (set semantics).
3. **latent-recoverability** = of the tokens the arm removed from the live file, the fraction still recoverable afterward (externalized/binned = recoverable; hard-deleted = not).

## Results

| Arm | bytes (live) | saving% | token-recall | tokens lost (of 448) | latent-recoverability |
|---|---|---|---|---|---|
| **unchecked** | 150,115 | 0.00% | **100.00%** (448/448) | 0 | 100% (nothing removed) |
| **naive-compress** (K=4 mean) | 69,064 | 53.99% | **51.17%** (229/448) | **218.8** | **0%** of removed (no archive) |
| **coalwash** | 68,924 | **54.09%** | **100.00%** (448/448) | 0 | **100%** (190/190 relocated to archive) |

Naive mean recall 51.17% = mean kept 229.2/448. Coalwash's on-demand archive adds 113,560 B of relocated content that is NOT always-loaded (read only when needed), so the 54.09% always-loaded saving is real per session.

### naive-compress — every run, raw

Target 68,924 B; ±5% band 65,478–72,370 B. **All 4 runs in-band.** Identical prompt, nothing varied but the attempt (stochastic LLM compression).

| Run | bytes | in band | saving% | recall | tokens lost | removed-from-live | recoverable |
|---|---|---|---|---|---|---|---|
| 1 | 69,574 | yes | 53.65% | 50.89% (228/448) | 220 | 220 | 0 |
| 2 | 67,831 | yes | 54.81% | 49.78% (223/448) | 225 | 225 | 0 |
| 3 | 69,361 | yes | 53.79% | 49.55% (222/448) | 226 | 226 | 0 |
| 4 | 69,489 | yes | 53.71% | 54.46% (244/448) | 204 | 204 | 0 |
| **mean** | **69,064** | — | **53.99%** | **51.17%** | **218.8** | **218.8** | **0** |
| **range** | 67,831–69,574 | — | 53.65–54.81% | 49.55–54.46% | 204–226 | — | — |

**What the naive arm loses, by class (mean of K=4, of the corpus count):**

| Class | corpus | naive dropped (mean) | % lost |
|---|---|---|---|
| wikilinks | 12 | 10.0 | 83% |
| dates | 5 | 0.0 | 0% |
| versions | 11 | 7.5 | 68% |
| links | 1 | 0.0 | 0% |
| codespans | 121 | 29.75 | 25% |
| quotes | 175 | 145.25 | 83% |
| numbers | 123 | 26.25 | 21% |

The loss is concentrated exactly where the market tools are weakest: **wikilinks (memory-anchors, 83% gone), verbatim quotes (83% gone), and version strings (68% gone)** — the fact-carriers a "useful readable summary" paraphrases away. Salient, sparse classes (dates, the single link) survive; dense structured classes are decimated.

### coalwash — recoverability, framed around the live file

- Removed from the always-loaded live file: **190** tokens. Recoverable via `LAB-ARCHIVE.md`: **190/190 = 100%**. Net structured-token loss: **0**.
- Strict-latent set (190, purely relocated): coalwash 100% recoverable; naive keeps only ~29% of these *inline* (29.21% mean survive in output) and hard-deletes the rest — **0% recoverable** because it produced no archive.

## The one-paragraph finding

**At an equal ~54% cut of always-loaded bytes** (corpus 150,115 B → ~68,924 B), **CoalWash lost 0 of 448 structured tokens** (recall 100%, independently recomputed) **and kept 100% of the 190 tokens it removed from the live file recoverable** in the on-demand archive. A **fair** naive lossy-compress — an LLM told only "make it ~69 KB and useful," no fidelity gate, no archive, the honest market baseline — **at the same size lost a mean of 218.8 tokens (K=4, range 204–226; recall 51.2%) and 0% of what it removed is recoverable.** Equal saving, opposite fidelity. **The differentiator is SAFE saving, not a smaller file.**

## Assumptions, method notes, and LIMITATIONS

- **N = 1 corpus.** One real dogfood memory file. This is the deliberate v1 trade: the value is the *controlled at-equal-size design* + a *real* coalwash arm (not a synthetic one), not a large-N claim. The fixture-based harness (see the benchmark README) carries the multi-store, planted-ground-truth breadth; this is the complementary "real dogfood, controlled size" point.
- **Naive arm is stochastic** → K=4 runs, mean±range reported. All landed in-band, so the size control is tight (spread 67,831–69,574 B) and the recall spread (49.55–54.46%) is the genuine run-to-run variance, not a size artifact.
- **FAIR competitor, checked.** The naive prompt was a genuine "make it smaller + useful" ask (recorded verbatim in the scorer/record), never sabotaged — no instruction to drop tokens. It even *kept* all dates and the link. It still lost ~49% of tokens because that is what lossy summarization to half-size does.
- **Contamination caveat (biases AGAINST the thesis, i.e. conservative):** the naive subagents ran with this repo's governance in context (the CoalWash fidelity doctrine). A neutralizing line told them those rules don't apply (faithful to a real tool's *absence* of such rules). Any residual priming would make them preserve MORE than a rule-free market tool, so the real-world naive recall is plausibly ≤ our 51%. Our naive number is an upper bound on a real tool's fidelity.
- **Independent fidelity.** Recall was recomputed here from each arm's output via the shipped `inventory()`; the coalwash gate's self-report was used only as a consistency cross-check, never as the proof.
- **LATENT operationalization.** "LATENT" tokens = corpus tokens the coalwash arm relocated to the archive. This uses coalwash's own externalization decision as the ground truth for "what was latent" — defensible (the archive is literally the lab-record dump named for it) but a mild dependency; a future version could label blocks independently.
- **Saving is always-loaded bytes**, a proxy for per-session token cost (the engine's `~est` token proxy would scale it ~1 token / ~4 bytes). CoalWash's archive is a real on-disk cost but not an always-loaded one.
- **DEFERRED to v2 — the time-flip / regret-timeline arm.** This v1 proves fidelity-at-equal-size at a single point in time. It does NOT yet simulate the *regret timeline*: over M future sessions, how often is a naive-deleted LATENT token needed again and unrecoverable, vs coalwash restoring it from the archive? That dynamic "cost of the time-flip" arm is v2. It is the natural pairing with the fixture harness's pending Measurement 3 (sawtooth-vs-bloat).

## Reproducing

Scorer: `benchmarks/CoalWash/controlled-fidelity-score.mjs` (zero-dep beyond the shipped rc.3 inventory engine). It recomputes every number above from the input files. **The corpus / live / archive / naive outputs are the real private dogfood memory and are NOT committed** (clean-clone / doc-leak discipline — the public repo ships numbers + method, not private governance content, exactly as the fixture harness withholds its trap corpus). A maintainer with the private files re-runs `node controlled-fidelity-score.mjs <dir>` to verify or re-measure on a new CoalWash version; the byte sizes + token counts above make the numbers auditable against those files.
