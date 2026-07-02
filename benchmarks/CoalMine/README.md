# CoalMine Eval Harness

Antivirus-style detection-rate measurement for the canaries — the same idea as
AV-Comparatives: a corpus of **planted, labeled defects** plus **clean decoys**,
scored mechanically.

```
benchmarks/CoalMine/
  fixtures/<suite>/                 ← 7 suites: rot-canary (16 fixtures) +
    f01-… f08/f12-…                    scale-canary · resilience-audit ·
                                       telemetry-canary · testability-canary ·
                                       drift-canary · supply-chain-audit
                                       (8 fault fixtures + 3 clean decoys each),
                                       every fixture with expected.json
                                       (ground truth: file, line, category, severity)
    d01-…-clean-decoy/              ← zero-defect files; any finding = false positive
  results/<date>[-<suite>]-<model>-r<N>.json ← one agent run (rep N): structured findings
                                       + a "suite" field (absent = rot-canary)
  score.mjs                         ← mechanical matcher (suite-aware) → report
  RESULTS.md                        ← K-rep aggregate across suites + engines
  AG-RUN-PROMPT.md                  ← the Antigravity arm's copy-paste protocol
```

## Running an eval

1. Have your agent run the **rot-canary** skill (DEPTH=QUICK) over each fixture
   directory, recording findings as
   `{ fixture, file, line, category, severity }`.
   Categories: `dead-code · bug-prone · resource-leak · concurrency ·
   silent-failure · input-boundary · doc-rot`.
2. Save the run as `results/<YYYY-MM-DD>-<model>.json`:
   `{ "model": "...", "date": "...", "skillVersion": "...", "findings": [...] }`
3. Score it: `node score.mjs` (newest run by default) — prints the report.
   Add `--write` to (re)generate `RESULTS.md`: `node score.mjs --write`.

A match = same fixture + file + category, line within ±3. Severity is scored
separately. Findings on decoys are false positives.

## Why

"Antivirus-grade quality" needs a number, not an adjective. Results are
model-dependent — like AV detection rates are engine-dependent — so every run
records the model and skill version, and re-running after a skill or model
change shows regressions mechanically.
