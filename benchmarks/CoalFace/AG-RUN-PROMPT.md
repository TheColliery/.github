# CoalFace fan-out token — Antigravity run prompt (2026-07-03)

Copy-paste protocol for the AG (cross-vendor) arm of the CoalFace fan-out token benchmark.
Same worksite as the CC arm; the question is the same: **how does total token cost move across
solo vs naive ad-hoc fan-out vs a coarse-packed fan-out**, on Antigravity with Gemini workers.

## What the AG arm can and cannot show (honest, read first)

- **The worker-count lever is model-agnostic** — the per-sub baseline × N effect (and the coarse-pack
  hack that collapses it) should reproduce on AG. That is the main thing this arm confirms.
- **The dollar FLIP does NOT happen on AG.** CF's `−15% in dollars` came from routing workers to a
  **cheaper tier** (Haiku) than the main. **Antigravity has no per-worker model-pick** (all subs run
  the same model; effort is a variant, not a cheaper tier), so on AG fan-out is **raw token overhead
  with no dollar recovery** — the wallet's `$-via-cheap-tier` half is a Claude-Code privilege. If the
  AG numbers show fan-out simply costing more with no offset, that is the expected, honest result.
- **Token self-report:** AG must report its own token usage per sub (or a total per arm). If AG does
  not expose per-sub tokens, record its best available total-token estimate per arm and say so.

## How to run (the human)

1. Open a **FRESH Antigravity conversation** at `C:\Users\zxc59\source\repos\TheColliery`,
   model = **Gemini 3.5 Flash** (same engine as the other AG arms).
2. Paste the block below.
3. Let AG write the result file itself; hand back to CC for the merged cross-vendor headline.

## Paste block

```text
CoalFace fan-out token benchmark. Do the SAME 6-function JSDoc job three ways and
report the total token cost of each arm. The job: add a JSDoc header to each of the
6 functions, following this spec (identical bytes in every arm):

DOC STYLE SPEC (v3):
- JSDoc block immediately above the function, no blank line between.
- Line 1: one-sentence summary in IMPERATIVE mood ("Compute...", not "Computes").
- @param {type} name - description, for EVERY parameter in declaration order. TS-style types.
- @returns {type} description — omit only for void. If async, the type is Promise<T>.
- @throws {ErrorType} condition — for EVERY throw reachable from the body.
- Money/amount params: state the UNIT (cents vs dollars) in the description.
- Deprecated functions: add @deprecated with the replacement name.

THE 6 FUNCTIONS:
1) async function chargeOrder(orderId, amountCents) { if (!orderId) throw new PaymentError('no order'); return gateway.charge(orderId, amountCents); }
2) function slugify(title) { return title.toLowerCase().replace(/\s+/g, '-'); }
3) async function fetchInvoices(userId, limit) { return db.query('invoices', userId, limit); }
4) function taxFor(subtotalCents, rate) { if (rate < 0) throw new RangeError('bad rate'); return Math.round(subtotalCents * rate); }
5) function parseRange(header) { if (!header) throw new RangeError('empty range header'); return header.split('-').map(Number); }
6) async function legacyExport(userId) { return csv(await db.dump(userId)); }  // being replaced by streamExport

THE 3 ARMS (each worker answers from its own knowledge, no tools/file reads):
ARM SOLO — one agent does all 6 in a single pass.
ARM AD-HOC — spawn 6 subagents, each given the FULL spec + exactly ONE function.
ARM COARSE — spawn 2 subagents, each given the FULL spec + THREE functions (1-3 and 4-6).

MEASURE: report the total token usage of each arm (sum of all its subagents' tokens,
plus the spawn/orchestration if AG exposes it). If per-sub tokens are not available,
give AG's best total-token estimate per arm and note the limitation.

Write the result to
C:\Users\zxc59\source\repos\TheColliery\.github\benchmarks\CoalFace\results\antigravity-2026-07-03.md
as a table (arm | subs | total tokens | vs ad-hoc) + one honest headline of the form
"Solo X · ad-hoc Y (Nx) · coarse Z (−M% vs ad-hoc) — AG Gemini 3.5 Flash, 2026-07-03;
fan-out cost is worker-count × baseline, no cheap-tier dollar offset on AG". Reply with
only the file path.
```

Provenance: the CC arm (`RESULTS.md`) found fan-out costs MORE raw tokens than solo
(baseline × N), recoverable in DOLLARS only via cheap-tier workers (a CC privilege), and
that packing spots into fewer workers (`coarse`) cuts raw tokens ~67% vs naive ad-hoc. The
AG arm tests whether the worker-count lever reproduces cross-vendor, with the honest
expectation that the dollar-flip does not (no per-worker tier-pick on Antigravity).
