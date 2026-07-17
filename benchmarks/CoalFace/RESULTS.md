# CoalFace fan-out results — ad-hoc vs scout-digest, and the cost of fanning out at all (2026-07-03)

**Measured:** 2026-07-03 · CoalFace **v0.1.0-beta.2** · workers = Haiku 4.5, scout = Sonnet 5,
solo = Opus 4.8 · K=1 per spot (token accounting on a deterministic mechanical task; per-worker
token draw was dead-stable at ±20 across 6 spots, so K=1 is defensible here; the CF arm ran 3
workers and its 6-worker total is extrapolated ×2 — disclosed under Tokens).

> **TL;DR (three flips, all honest):** on a 6-spot fan-out (add a JSDoc header to 6 functions
> from one shared style spec) — **(1)** fanning out costs **MORE raw tokens than solo**, not less:
> ad-hoc 6-worker = **4.2×** the solo tokens, CF (scout+workers) = **5.3×** (the CF total
> extrapolates 3 measured workers ×2 to 6 — disclosed under Tokens) — the fixed per-sub
> baseline (~25k) multiplied by N swamps everything. The "the swarm fits inside solo cost" wallet
> claim is **FALSE in raw tokens.** **(2)** In **dollars** it flips: cheap-tier workers make
> fan-out **cheaper than solo-on-an-expensive-main** (6 Haiku = $0.75 vs 1 Opus = $0.89, **−15%**),
> because Haiku is ~5× cheaper per token — so CF's wallet is a **$-via-cheap-tier** claim, exactly
> what the skill says it is, not a token claim. **(3)** CF's scout+digest is **net overhead on a
> SMALL shared context**: the scout cost (39k) dwarfs what the digest saves per worker (~26 tokens),
> so here CF is *more* expensive than plain ad-hoc — the digest only pays off above a shared-context
> size threshold, and below it CF's own **min-unit floor** says *don't fan out*. The benchmark
> validates CF's design by showing exactly where each lever does and doesn't apply.

## The worksite

6 disjoint edit-spots, one shared context: add a JSDoc header to each of 6 functions, all
following the SAME ~18-line doc-style spec (imperative summary, `@param`/`@returns`/`@throws`
rules, money-unit rule, `@deprecated` rule). This is the canonical fan-out shape: N independent
units that each need the same shared spec. Deterministic + mechanical → a clean token measurement.

## Three arms

| Arm | Shape | Subs | Model |
|---|---|---|---|
| **SOLO** | one agent does all 6, reads the spec once | 1 | Opus 4.8 |
| **AD-HOC** | 6 workers, each re-reads the FULL spec + does 1 spot | 6 | Haiku 4.5 |
| **CF** | 1 scout digests the spec once → 6 workers get the compact digest + 1 spot | 1 + 6 | Sonnet scout, Haiku workers |

All arms produced correct JSDoc (the mechanical task is easy for every tier — this is a **token**
benchmark, not a quality one; the one nuance was Opus typing `chargeOrder` as `Promise<any>` where
Haiku said `Promise<void>`, a wash for the point being measured).

## Tokens (`subagent_tokens`)

| Arm | Per-worker | Total tokens | vs solo |
|---|---|---|---|
| SOLO (Opus, all 6) | — | **35,538** | 1.0× |
| AD-HOC (6× Haiku, full spec) | ~25,090 | **150,562** | **4.2×** |
| CF (scout + 6× Haiku†, digest) | ~25,064 | **189,431** | **5.3×** (1.26× ad-hoc) |

- The per-worker draw is **~25k regardless of arm** — the Explore-agent baseline (system prompt +
  governance + tools) dominates; the spec (full ~18 lines) vs the digest (~90 words) differ by only
  **~26 tokens/worker**. At this shared-context size the digest lever is in the noise.
- **Fan-out multiplies the baseline by N.** 6 workers = 6 baselines ≈ 150k, whether ad-hoc or CF.
  CF adds a 7th sub (the scout, 39k) on top — so CF is the *most* token-expensive arm here.

† **Extrapolation, disclosed.** The CF arm logged **3** worker draws (chargeOrder 25,069 · taxFor
25,068 · legacyExport 25,056; avg 25,064) plus the scout — see [`results/onoff-raw.tsv`](results/onoff-raw.tsv).
Its 6-worker total (189,431) **extrapolates those 3 ×2** to the full 6-spot job — justified, not
independently measured, by the per-worker baseline being dead-stable across all **9** real
single-spot Haiku workers here (6 ad-hoc + 3 CF, every draw 25,056–25,104, ±0.1%). The **ad-hoc arm
(4.2×), the coarse arm (−67%), and the −15% dollar headline are fully measured** — no extrapolation.
The conclusion does not hinge on the ×2: the 3 measured CF workers + scout already = 114,238 =
**3.2× solo**, so "fan-out costs more raw tokens than solo" is measured-true on its own; the ×2 only
sharpens 3.2×→5.3× to represent all 6 spots, it does not manufacture the effect.

## Dollars (relative-cost proxy)

Output-token rates as a proxy ($/MTok: Opus 25, Sonnet 15, Haiku 5) applied to total
`subagent_tokens`. **This is a relative-ordering proxy, not a billing figure** (subagent_tokens
blends input+output) — but the ordering is the signal:

| Arm | $ proxy | vs solo |
|---|---|---|
| SOLO (Opus) | **$0.888** | 1.0× |
| AD-HOC (6× Haiku) | **$0.753** | **−15%** |
| CF (scout=Sonnet + 6× Haiku) | $1.338 | +51% |
| CF (scout=Haiku + 6× Haiku) | $0.947 | +7% |

**The flip:** ad-hoc burns 4.2× the *tokens* but costs *less* in *dollars* than solo — because the
workers are a 5×-cheaper tier. This is CF's wallet claim, precisely: fan-out to cheap tiers ≤
solo-on-an-expensive-main **in dollars**, never in tokens. CF's own scout is overhead that has to
be *earned back* by the digest — and on this small spec it isn't.

## The crossover (why CF's scout is overhead here — and when it stops being)

CF beats ad-hoc only when the digest saves more than the scout costs:

```
N × (spec_tokens − digest_tokens)  >  scout_tokens
6 × (~26 saved per worker)  =  ~156   ≪   39,045   → CF loses on this small spec
```

The scout amortizes only when the shared context is **big** (a large spec/API surface/design doc
where a full re-read per worker is thousands of tokens). Below that threshold, CF's **min-unit
floor** rule fires: a unit smaller than the spawn overhead should NOT be fanned out — it should be
done inline. So the benchmark doesn't contradict CF; **it draws the exact line CF's floor already
encodes.** CF is for *large* shared context × *many* right-sized units; on a small one, ad-hoc
(or solo) is correctly cheaper.

## What CF actually buys (measured, on this shape)

Not raw-token savings. On a right-sized fan-out CF delivers:

1. **$-discipline** — routing the workers to a cheap tier is what makes the swarm ≤ solo in dollars
   (the −15% flip). CF's contract enforces that; ad-hoc leaves it to chance.
2. **Structural safety** — bounded worker count, single-writer sequential apply behind a snapshot,
   QC at collection, no retry storms, no over-fan. None of these show up in a token count; they show
   up as *not* corrupting the tree when 6 writers race. (Not stress-tested here — this worksite has
   no write conflicts by construction.)
3. **Digest amortization** — real, but only above the shared-context threshold shown above.

## The token-hack: fan out COARSER (measured)

"Can we hack the token cost down?" — yes, and the lever is **worker count, not spot count**. Since
the per-worker baseline (~25k) is the whole cost and content is ~free (~27 tokens per extra spot),
packing the same 6 spots into FEWER workers collapses the bill:

| Partition | Workers | Total tokens | vs ad-hoc | $ proxy | Parallelism |
|---|---|---|---|---|---|
| ad-hoc (naive) | 6 × 1 spot | 150,562 | — | $0.753 (Haiku) | 6× |
| **coarse (the hack)** | **2 × 3 spots** | **50,360** | **−67%** | **$0.252 (Haiku)** | 2× |
| solo | 1 × 6 spots | 35,538 | −76% | $0.888 (Opus) | 1× |

A worker doing 3 functions cost **25,173 / 25,187** — statistically identical to one doing 1
(~25,090); the 3 extra spots added ~80 tokens. So naive 1-spot-per-worker fan-out pays the ~25k
baseline **6× for no reason**. **Token cost ≈ worker_count × 25k.** The token-optimal fan-out is the
**COARSEST partition that still delivers the parallelism you need** — exactly what CF's **min-unit
floor** (merge a unit smaller than the spawn overhead) and **granularity optimizer** (don't slice
finer than ~2-4× the wave width) enforce. Naive ad-hoc UNDER-packs; CF forces the packing.

**The real sweet spot = coarse × cheap tier:** 2×3 Haiku = **$0.25, 2× parallel** — cheaper than
BOTH naive ad-hoc ($0.75) AND solo-Opus ($0.89), while staying parallel. That is CF's wallet,
precisely located: not "more workers," but "**fewest cheap workers for the needed parallelism**."

**Ceiling:** you still cannot beat **solo's single baseline** (35.5k) in raw tokens — fan-out's win
is wall-clock + dollars, never fewer tokens than solo. If raw tokens are the only metric, don't fan
out at all.

## Cross-vendor arm (Antigravity / Gemini 3.5 Flash)

Run separately ([`results/antigravity-2026-07-03.md`](results/antigravity-2026-07-03.md)). The worker-count
shape reproduces: **solo 26,311 · ad-hoc 155,018 (5.9×) · coarse 52,718 (−66% vs ad-hoc)** — the
coarse-pack hack lands within a point of the CC result (−66% vs −67%), and AG carried the honest
**"no cheap-tier dollar offset on AG"** caveat (no per-worker tier-pick → the $-flip is a CC-only
privilege, confirmed cross-vendor).

**Measurement caveat (weaker than the CC arm — stated honestly).** AG v2.2.1 does not expose real
per-sub token counts, so the run ESTIMATED them as measured prompt/response char-counts (÷3.8) **plus
an ASSUMED flat 25k baseline per worker**. Consequence: the "worker-count × baseline" scaling is
partly baked into the estimation *method*, not independently measured the way CC's real
`subagent_tokens` are (and the 25k figure may even have been read from this repo's CC record). What
the char-counts DO independently confirm is that the per-worker CONTENT is small (~1,000–1,500
tokens), matching the CC finding that content is ~free and the fixed baseline is the whole cost. So:
directional cross-vendor confirmation, on an estimate — not an independent magnitude proof.

## Honest scope

- **Benchmark ≠ graduation.** This measures CF's token/$ claims on a **synthetic** worksite — a
  token measurement is not a real-worksite field proof, and the structural-safety value
  (single-writer, QC) is *asserted by construction here, not stress-tested*. **Measured at CF
  v0.1.0-beta.2; CF graduated v0.2.0 stable on 2026-07-09 via a separate real fan-out worksite
  (the flock doc-conform sweep) — these figures are unchanged until the next benchmark run.**
- Workers were Haiku (cheap tier, and the mechanical task fits it) — partly to conserve the
  operator's Fable quota.
- K=1: defensible only because the per-worker token draw was deterministic-stable (25,056–25,104
  across the 9 measured single-spot workers). The CF arm ran **3** workers; its 6-worker total is
  **extrapolated ×2** (disclosed under Tokens) — ad-hoc, coarse, and the −15%-$ headline are fully
  measured. A quality benchmark would need K≥3 and a harder task.
- The $ figures are a rate-proxy on blended tokens, for *ordering* — not a bill.

Dated 2026-07-03; a single synthetic worksite, not a guarantee.
