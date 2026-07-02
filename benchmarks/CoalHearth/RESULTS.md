# CoalHearth damage results — cold restart vs warm resume (2026-07-03)

**Measured:** 2026-07-03 · CoalHearth **v1.0.0** · workers = Sonnet 5, K=3 per arm · fidelity
arm run through the real `lib/state-snapshot.js`.

> **TL;DR:** on a 10-file mid-refactor interruption, warm resume (CH recovery block) and cold
> restart both finished **correctly** (4/4 remaining refs found, 0 redone) and the **token delta
> was <1%** — at this scale a strong model reconstructs state from the tree, so CH's token
> saving is a **large-session** effect, not a small-session win. CH's **irreducible** value is
> state **fidelity**: its journal preserves the goal, the modified-file set, and — the piece a
> cold restart can NEVER reconstruct — the **in-flight sub-agents** (CH 1, cold 0).

## Arm 1 — completion (correctness + tokens)

| Arm | Found all 4 remaining? | Redid a done file? | Missed the doc-ref? | Mean tokens (K=3) |
|---|---|---|---|---|
| COLD (re-scan all 10) | ✅ 3/3 | none | none | 39,584 |
| WARM (CH block + 4 files) | ✅ 3/3 | none | none | 39,303 |

Token delta: **−0.7%** (281 tokens). Both arms 100% correct on this fixture. The delta is
swamped by the fixed per-agent baseline (~39k) at a 10-file scale — the re-scan CH avoids is
only ~6 small files here. On a large repo the cold re-scan-to-reconstruct is what balloons; this
toy cannot show that, and we do not extrapolate a number.

**Honest read:** at small interruption scale, cold restart is *not* materially worse on tokens
OR correctness with a strong model — CH's completion-time win is a scale effect. Its value at
*any* scale is the fidelity arm below.

## Arm 2 — state fidelity (through CH's real lib)

`buildStateSnapshot()` on the mid-refactor state, with one in-flight sub-agent recorded:

| State item | CH recovers | Cold restart recovers |
|---|---|---|
| Goal / task | ✅ yes | guess from the tree |
| Modified-file set | ✅ 6 (journaled exactly) | git-status guess (mixes pre-existing) |
| Remaining work | ✅ the checklist | infer from the tree (lossy at scale) |
| **In-flight sub-agents** | ✅ **1** | ❌ **0 — no tree signal exists** |

**The irreducible finding:** a sub-agent that was spawned and then lost to the interruption
leaves **zero trace in the working tree** — a cold restart cannot know it ever ran. Only CH's
PostToolUse journal records it (Incident E). CH's honest scope holds: it records that the worker
**existed** + its residue path, so a human/agent can find and reconcile it — it does **not**
recover the worker's lost compute. That is a categorical recovery (0 → 1), independent of scale
or engine, and it is the honest core of CH's value — not a token percentage.

## Conclusion

CH does not make a small interruption cheaper or more correct with a strong model — the tree
carries enough signal to reconstruct simple state. CH earns its keep as (1) a **large-session**
re-scan avoider (scale effect, not shown on a toy) and (2) the **only** mechanism that preserves
the in-flight-agent record a cold restart categorically cannot. Dated 2026-07-03; a
single-scenario sample, not a guarantee.
