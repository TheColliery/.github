# CoalLedger Benchmark — Results Digest

<!-- version-frozen: fill the Measured line + headline table from an actual run record in results/; never edit figures without a matching dated record. -->
**Measured:** — *(first run pending)* · CoalLedger version: — · engines: —

> **TL;DR:** first run pending — CoalLedger launched **unbenchmarked** rather than with an invented number. The org-level benchmark (recall per canary on a foreign docs corpus, dated + versioned, following the flock shape) is not yet run; this digest fills from the first dated record, never before.

| Canary | Recall (planted doc-defects found) | Decoy false alarms |
|---|---|---|
| doc-structure · grounding · standard · rot · consistency · quality (+ doc-leak) | — | — |

**Current evidence (in-repo, not the org benchmark):** the mechanical AST layer is fixture-gated in the CoalLedger repo — **13/13 planted defects found, 0 findings on clean decoys** (anti-cry-wolf), Thai fixtures included. That gate proves the deterministic detector; the org benchmark below will measure per-canary RECALL on an independent foreign corpus (the canaries whose severity is context-judged, not mechanical, need the corpus, not a fixture).

**Honest scope:** a docs-health recall figure is corpus- and version-bound (each future record names both). Detection is deterministic (AST, not regex); severity is context-judged and never benchmarked as a fixed number.
