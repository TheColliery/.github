# CoalFace eval — fan-out cost: ad-hoc spawning vs the CF scout-digest contract

> **What this measures, honestly.** CoalFace disciplines a fan-out: instead of N workers each
> re-reading the full shared context, a scout digests it once and hands workers a compact digest,
> under a bounded single-writer contract. This benchmark measures the **token and dollar cost** of
> three ways to do the same 6-spot job — solo, ad-hoc fan-out, and the CF contract — to test CF's
> **wallet** claim ("the swarm fits inside the solo cost"). It does **NOT** by itself graduate CF
> and it does **NOT** stress-test the structural-safety machinery (single-writer, QC) — this
> worksite has no write conflicts by construction.

## Three arms, one worksite

Add a JSDoc header to each of 6 functions, all following one shared ~18-line doc-style spec
(`fixtures/` is inline in the arm prompts — a deterministic mechanical task, chosen so tokens, not
quality, are what varies).

- **SOLO** (Opus) — one agent reads the spec once, does all 6.
- **AD-HOC** (6× Haiku) — 6 workers, each re-reads the FULL spec, does 1 spot. The naive fan-out.
- **CF** (Sonnet scout + 6× Haiku) — the scout digests the spec once; each worker gets the compact
  digest + 1 spot. The CF contract.

Scored: **total `subagent_tokens` per arm** + a **dollar proxy** (per-tier output rates on the
totals — a relative-ordering figure, not a bill).

## The honest result (three flips)

1. **Fan-out costs MORE raw tokens than solo** — the fixed per-sub baseline (~25k) × N dominates:
   ad-hoc = 4.2× solo (fully measured), CF = 5.3× (the CF total extrapolates 3 measured workers ×2
   to 6 — disclosed in [`RESULTS.md`](RESULTS.md)). The wallet claim is **false in tokens**.
2. **In dollars it flips** — cheap-tier workers make fan-out **−15% vs solo-on-Opus** (Haiku is ~5×
   cheaper/token). CF's wallet is a **$-via-cheap-tier** claim, not a token claim.
3. **CF's scout is overhead on a small shared context** — the scout (39k) costs far more than the
   digest saves per worker (~26 tokens), so here CF > ad-hoc. The digest amortizes only above a
   shared-context size threshold; below it, CF's own **min-unit floor** says don't fan out.

So the benchmark **validates CF's design by drawing the exact line its floor already encodes**: CF
is for *large* shared context × *many* right-sized units, routed to *cheap* tiers. See
[`RESULTS.md`](RESULTS.md). Raw token log: [`results/onoff-raw.tsv`](results/onoff-raw.tsv).

## Honest scope

Synthetic worksite, K=1 (defensible only because the per-worker token draw was deterministic-stable
±20; the CF arm ran 3 workers, extrapolated ×2 to 6 — [`RESULTS.md`](RESULTS.md) discloses it, and
ad-hoc/coarse/the −15%-$ headline are fully measured). Workers = Haiku (cheap tier + fits the mechanical task, and conserves Fable quota). Benchmark
≠ graduation — this synthetic run alone does not prove the structural-safety machinery under real
write contention. **CF graduated v0.2.0 stable on 2026-07-09 via a separate real fan-out worksite**
(the flock doc-conform sweep); these token/dollar figures are unchanged and still describe the
beta.2 run dated below. Dated 2026-07-03.
