# CoalWash Benchmark Harness

Fixture-based measurement of CoalWash's two load-bearing claims — **fidelity** (the meat survives) and **saving** (the sawtooth beats the bloat) — scored mechanically against planted ground truth, never eyeballed.

```text
benchmarks/CoalWash/
  fixtures/<store>/            <- starter memory stores: MEMORY.md index + memory
    ...*.md                       files with planted, LABELED fat + muscle
    expected.json                 the ground-truth manifest (muscle/fat needles)
  results/                     <- dated detailed records for ALL measurements
  score.mjs                    <- mechanical scorer (zero-dep node)
  RESULTS.md                   <- the short digest (headline only; links here)
```

## Ground truth: fat vs muscle

Every fixture store plants both, labeled in its `expected.json`:

- **muscle** = facts that MUST survive any run: `[[wikilinks]]`, versions, dates, unique identifiers, lesson kernels. Needle discipline: a muscle needle is a short token/phrase a *faithful* compaction must carry verbatim (structured tokens preferred — legitimate rewording never excuses dropping a version, link, or date).
- **fat** = planted bloat that a correct run removes: verbose duplicate filler, superseded verbiage (the superseding fact survives as muscle), done-point-in-time entries with no forward value, hedging padding. Fat needles are distinctive filler phrases that appear ONLY in fat content.

**The human gate is part of the run.** The operator approves deletes of planted fat (that is the designed flow) and any gate-shown drop those deletes entail (an index-link removal) — and must NEVER approve a cut that costs a muscle needle. An operator-refused muscle delete is the system working; a lost muscle needle in the post-run store is a fact-loss, whoever approved it.

## Running any measurement

1. Copy a fixture store to a scratch dir (never run on the fixture itself).
2. Point CoalWash at the copy and run the tier the measurement names.
3. Score: `node score.mjs fixtures/[store] [scratch-store-dir]` — prints muscle kept/lost, fat removed/remaining, the no-op check, and percentages. Add `--json` for the machine record, `--round N --model NAME --phase has-fat|fat-exhausted` to label loop rounds. `node score.mjs --size [dir]` prints a store's bytes + `~est` tokens (for the saving arms).
4. Record the dated result in `results/` (naming: `[topic]-[platform]-YYYY-MM-DD.md` + raw `.json`). Every record carries the date, the CoalWash version tested, and the model tier — an unlabeled number rots.

Scoring is whitespace-normalized exact matching: a muscle needle absent anywhere in the post-run store = a lost fact (an encoding corruption — e.g. a decomposed Thai sara-am — breaks the match and correctly counts as loss); a fat needle still present anywhere = not cleaned.

## Measurement 1 — the consecutive-run ceiling (the loop cap)

**Question:** how many CONSECUTIVE no-rest runs are safe before over-compression begins? The shipped guidance is benchmark-derived, never guessed — this is where it derives from.

Protocol: on each fixture, loop the Full tier round after round with no rest and no new content, scoring after every round (`--round N`). Track the first round at which (a) any muscle needle is lost, or (b) a no-fat fixture stops no-op'ing. The ceiling for a model tier = the minimum over fixtures of (first-bad-round − 1), with the published number rounded DOWN. Publish per model tier; the repo docs cite the minimum across tiers as the conservative default's replacement.

## Measurement 2 — infinity-loop fact-loss (the wedge's proof)

**Question:** past fat-exhaustion, how much meat does a looped model throw away — per model tier?

Protocol: loop the Full tier well past the round where all planted fat is gone (fat remaining = 0 marks the phase boundary; label rounds `--phase has-fat` before it, `--phase fat-exhausted` after). Measure **fact-loss % per round and cumulative, split by phase, per model tier** — the variance is model-dependent; one number is not shippable. The structural target: the LEAN band must make post-exhaustion rounds a **100% no-op** (the run never reaches the semantic layer); any leak past it = the hardening backlog. Iterate: measure → harden what code can harden → re-measure, driving the % to the floor. Publish dated, per-model, in `results/`.

## Measurement 3 — sawtooth-vs-bloat (the headline saving)

**Question:** over N sessions, what does clean-at-threshold actually save vs letting it bloat?

Protocol: two arms from the same starting store, over N simulated sessions (N ≥ 20 recommended):

- **Arm A (sawtooth):** each session, append the scripted growth feed, then run CoalWash exactly when its band gauge fires (and only then — the gauge's own cadence, no operator override).
- **Arm B (bloat):** identical growth feed, no CoalWash ever.

After each session, record each arm's always-loaded size (`score.mjs --size` on the index + governance files, or the CoalWash caliper). The cumulative always-loaded token cost over all N sessions is each arm's total; **Δ% = (B − A) / B** is the headline saving. Arm A's total must INCLUDE the runs' own one-time costs (a saver that ignores its own spend is a fraud). Growth feed: reusable chunks in the fat classes above; whatever feed you use, commit it with the dated record so a stranger reproduces the run.

## Why mechanical

"Zero fact-loss" needs a number, not an adjective — and the scorer must not share the model's blind spot. Planted ground truth + exact matching = a stranger runs `score.mjs` and reproduces the verdict. Results are model-dependent (like AV detection rates are engine-dependent), so every record names its model, CoalWash version, and date; re-running after a skill or model change shows regressions mechanically.
