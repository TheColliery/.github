# ULTRA reduce-engine destruction ladder — pre-ship IC-pin campaign (IN PROGRESS)

**Date:** 2026-07-23 (state as of — campaign in progress, not closed) · **Platform/engine:** Claude Code (blind leaf subagents; verifier and fixer subagents kept separate — setter≠solver, no collusion) · **CoalWash version under test:** **none** — the target is the UNCOMMITTED class-A ULTRA **prototype** (`explode.mjs` = the byte-exact reduce/kill-bookkeeping engine + `detonate.mjs` = its input-verify gate). Lab-only; no CoalWash version bump ships with this record.

This is **PRE-SHIP hardening of a PROTOTYPE**, per the blueprint's own gate (`COALWASH_BLUEPRINT.md` §19.6: the engine "MUST NOT be claimed safe until" the full destruction ladder) — the ladder IS that gate. Nothing here claims the engine is shipped or proven safe.

## Method (class only — granular detail withheld by design)

Blind, black-box, contamination-free adversarial red-team: each wave fires fresh blind subagents against a fresh engine clone, with no knowledge of prior waves or fixes; findings are collected (collect-don't-fix), a separate fix round lands, the wave re-fires. Loop until dry. The stopping model is the ported JESD218/219 SSD method — **accelerated-stress-then-verify + rule-of-three**: "dry" is not a wave count, it is "accelerated adversarial stress stops finding breaks," held across enough consecutive clean blind waves to bound the residual break-rate. Phase 1 = synthetic fixtures (current); Phase 2 = a real cloned corpus (pending).

## State as of 2026-07-23

Most invariant legs are **dry** over repeated blind waves: source integrity (never mutate/overwrite the source), byte-exact + execute fidelity (survivors verbatim), resume/recovery integrity, census honesty (no unit silently vanishes), and a heterogeneous mixed-corpus leg. One leg — the engine's **bounded cost** — is still **converging**: repeated blind waves kept finding real, caller-reachable cost-blowup bugs there; each was fixed and blindly re-fired, and the residual has narrowed from architecture to calibration. A win32-only robustness item of the stat lossy-float class (same family as the public `st_blocks` issue #8) was also found; it **fails closed** — over-refuses, never corrupts — and its hardening is queued for graduation.

## The finding

The pure byte-in→byte-out transform is ROBUST: source integrity and byte-exact fidelity went dry fast and stayed dry, including against a deliberately heterogeneous corpus. EVERY break lived at the STATEFUL "pipe-switches" — the wave-loop / resume-checkpoint / cost-budget machinery that streaming a file bigger than memory REQUIRES. It's just input→output; a strong transform can't lose data — so it breaks only where the pipe switches (carries state across a call boundary), and every real bug the ladder caught pre-ship landed exactly there (the recovery-paths-hide-holes pattern). The destruction ladder working — catching real bugs before the engine ships — IS the result.

## Limitations

- **IN PROGRESS.** The cost-bound leg is not dry; no "dry" claim for the whole engine. Every verdict is date-stamped as of 2026-07-23.
- **Scoped to the reduce engine only** (`explode`/`detonate`); the other class-A/estate engines (`retier` merge-redistribute, `estate-archive`, the class-B `apply` wash) are enumerated-but-pending. NOT a whole-CoalWash safety claim.
- **Phase 1 synthetic only**; the real-corpus phase has not run.
- **Granular detail withheld by design** — per-wave verdicts, counts, thresholds, fixture specs, and fix mechanisms are deliberately not published, by the same discipline as the withheld trap corpus: publishing them would let a model be tuned to pass the gate, not be safe.
- **Prototype, uncommitted** (blueprint §19.6 build status); no CoalWash version carries this work yet.

## Reproducing

The engine, its hermetic suite, and the campaign artifacts are uncommitted prototype/lab files; this record publishes the method class and honest state only, per the withholding discipline above. The ladder re-runs as the graduation gate when the engine lands in the CoalWash tree — the dated close-out record ships with it then.
