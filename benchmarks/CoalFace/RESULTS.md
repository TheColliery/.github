# CoalFace fan-out results — ad-hoc vs scout-digest, and the cost of fanning out at all (2026-07-03)

**Measured:** 2026-07-03 · CoalFace **v0.1.0-beta.2** · workers = Haiku 4.5, scout = Sonnet 5,
solo = Opus 4.8 · K=1 per spot (token accounting on a deterministic mechanical task; per-worker
token draw was dead-stable at ±20 across 6 spots, so K=1 is defensible here).

> **TL;DR (three flips, all honest):** on a 6-spot fan-out (add a JSDoc header to 6 functions
> from one shared style spec) — **(1)** fanning out costs **MORE raw tokens than solo**, not less:
> ad-hoc 6-worker = **4.2×** the solo tokens, CF (scout+workers) = **5.3×** — the fixed per-sub
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
| CF (scout + 6× Haiku, digest) | ~25,064 | **189,431** | **5.3×** (1.26× ad-hoc) |

- The per-worker draw is **~25k regardless of arm** — the Explore-agent baseline (system prompt +
  governance + tools) dominates; the spec (full ~18 lines) vs the digest (~90 words) differ by only
  **~26 tokens/worker**. At this shared-context size the digest lever is in the noise.
- **Fan-out multiplies the baseline by N.** 6 workers = 6 baselines ≈ 150k, whether ad-hoc or CF.
  CF adds a 7th sub (the scout, 39k) on top — so CF is the *most* token-expensive arm here.

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

## Honest scope

- **Benchmark ≠ graduation.** This measures CF's token/$ claims on a **synthetic** worksite. CF
  stays **beta** — a token measurement is not a real-worksite field proof, and the structural-safety
  value (single-writer, QC) is *asserted by construction here, not stress-tested*.
- Workers were Haiku (cheap tier, and the mechanical task fits it) — partly to conserve the
  operator's Fable quota.
- K=1: defensible only because the per-worker token draw was deterministic-stable (±20 over 6
  spots). A quality benchmark would need K≥3 and a harder task.
- The $ figures are a rate-proxy on blended tokens, for *ordering* — not a bill.

Dated 2026-07-03; a single synthetic worksite, not a guarantee.
