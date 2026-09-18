# CoalLedger Benchmark—Results Digest

<!-- version-frozen: fill the Measured line + headline table from an actual run record in results/; never edit figures without a matching dated record. -->
**Measured:**—*(corpus ready—awaiting first dated run)* · CoalLedger version:—· engines: —

> **TL;DR:** the org-level benchmark is not yet run—CoalLedger launched **unbenchmarked** rather than with an invented number. The corpus and scorer shipped first; this digest fills from the first dated record, never before.

| Suite | Fixtures | Decoys | Recall (mean ± range) | FP (mean) | Runs |
|-------|----------|--------|----------------------|-----------|------|
| doc-rot (27 planted) | 5 | 2 |—|—|—|
| doc-leak (33 planted) | 4 | 2 |—|—|—|

**Current evidence (in-repo, not the org benchmark):** the mechanical AST layer is fixture-gated in the CoalLedger repo—**13/13 planted defects found, 0 findings on clean decoys** (anti-cry-wolf), Thai fixtures included—*fixture gate re-counted 2026-07-25 at v0.3.0-beta.1 (11 in `defects-structure.md` + 2 in `defects-thai.md`); re-derive with `node scripts/lib/md-checks.mjs` over `scripts/fixtures/`*. That gate proves the deterministic detector; the org benchmark below will measure per-canary RECALL on an independent foreign corpus (the canaries whose severity is context-judged, not mechanical, need the corpus, not a fixture).

**Honest scope:** a docs-health recall figure is corpus- and version-bound (each future record names both). Detection is deterministic (AST, not regex); severity is context-judged and never benchmarked as a fixed number.
