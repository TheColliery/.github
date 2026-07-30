# CoalLedger Eval Harness — doc-rot + doc-leak corpus

A planted-defect corpus for the two CoalLedger canaries that have no org-level
benchmark yet. Follows the CoalMine eval shape: labeled fixtures, clean decoys,
mechanical scorer.

**Status: first draft — categories, fixture scope, and scorer matching are all
open for review. This is the starting material, not a finished benchmark.**

```
benchmarks/CoalLedger/
  fixtures/
    doc-rot/                       ← 5 defect fixtures + 2 clean decoys
    doc-leak/                      ← 4 defect fixtures + 2 clean decoys
  score.mjs                        ← mechanical matcher (category + file + line ±3)
  RESULTS.md                       ← fills from the first dated run
```

## Suites

| Suite | Canary | Fixtures | Decoys | Planted defects |
|-------|--------|----------|--------|-----------------|
| doc-rot | doc-rot | 5 | 2 | 27 |
| doc-leak | doc-leak | 4 | 2 | 33 |

Both suites test **agent judgment**, not a mechanical detector — recall is
model-dependent, so every run records the model and skill version.

## Fixture design

Each fixture is a realistic document a real project might ship. Defects are
the kind that slip through a careless edit or a hasty publish, not synthetic
stress tests.

- **doc-rot:** stale version requirements (EOL runtimes, outdated dependencies),
  dead TODO/FIXME/TBD markers, expired dates and promises, stale CI badges,
  superseded instructions that reference migrated infrastructure.
- **doc-leak:** internal hostnames and private IPs in troubleshooting guides,
  personal data (names, phones, emails) in onboarding docs, private financial
  figures in roadmaps, mixed leaks in incident runbooks.
- **Clean decoys** are documents with zero planted defects. Any finding on a
  decoy counts as a false positive.

## Proposed categories (open for review)

The `expected.json` categories are my reading of each canary's SKILL.md class
table. They may not match the actual agent output taxonomy — adjust to fit:

**doc-rot** (mapped from the SKILL.md age-marker table):
`stale-version` · `stale-date` · `dead-marker` · `stale-badge`

**doc-leak** (all findings SUSPECTED):
`internal-infrastructure` · `personal-data` · `private-figures` · `unpublished-intent`

## Running an eval

Both suites test agent judgment, so a single pass per model is not a
measurement — the house standard is **3–5 repeated runs per suite × model**
(a single-run recall on a stochastic judge is noise).

1. Have the agent run the corresponding CoalLedger canary over each fixture
   directory, recording findings as `{ fixture, file, line, category, note }`.
2. Save each run as `results/<YYYY-MM-DD>-<suite>-<model>-r<N>.json`:
   ```json
   {
     "suite": "doc-rot",
     "model": "Claude Opus 4.8",
     "date": "2026-07-30",
     "run": 1,
     "skillVersion": "0.3.0-beta.2",
     "findings": [
       { "fixture": "f01-stale-versions", "file": "README.md",
         "line": 7, "category": "stale-version" },
       ...
     ]
   }
   ```
3. Score a single run: `node score.mjs results/<file>.json`.
4. Score all runs for a suite × model:
   `node score.mjs --suite doc-rot --model "Claude Opus 4.8"` — reports
   per-run recall/FP plus mean and min–max across runs.
5. Add `--write` to regenerate `RESULTS.md` with the aggregate.

A match = same fixture + file + category, line within ±3. Findings on decoys
are false positives.

## What this corpus does NOT cover

Stated here rather than silently absent:

- **doc-structure** — already fixture-gated in the CoalLedger repo (13/13).
- **doc-grounding** — needs a paired codebase per fixture (future work).
- **doc-consistency** — needs multiple related docs per fixture (future work).
- **doc-quality** — readability judgment is too subjective for a planted corpus.
- **doc-standard** — needs a declared genre standard per fixture (future work).
