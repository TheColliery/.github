# Skill-prose determinism benchmark—protocol

Measures the half of a shipped skill's behaviour that **nothing else checks**: a `SKILL.md` body,
its `references/*.md`, and a hook-injected coordination cue are all natural-language prose. Their
code-borne behaviour has tests; their **prose-borne** behaviour ships on the author's belief that it
reads the same way to every reader. This benchmark measures whether it actually does—by having
independent readers read the SAME text and checking whether they extract the SAME set of directives.

**This is not a correctness benchmark.** It measures agreement between readers, never whether the
readers are right. Run 14 (below) is the result that makes this distinction load-bearing: a text can
reach zero variance while every reader agrees on the wrong answer. Report both, always.

## Layout

| File | What it is |
|---|---|
| `PREREGISTRATION.md` | The divergence metric, the pass/fail rule, the hypothesis under test, and the declared limitations—written before the hypothesis-test run (Run 15) fired. |
| `tasks.md` | The frozen walker instruments, verbatim, per run—a stranger can re-run any of them against the named blob. |
| `RESULTS.md` | The digest. **The only link target** for an org row or a README. |
| `results/` | Dated detail records with full per-rail tables and the five-part stamp. |
| `results/raw/` | The frozen prompt files, byte-identical to what was dispatched (hashes in `tasks.md`). |

## Standing rails

- **Metric:** `divergence(rail) = 1 − (walkers matching the modal answer / N)`, **MAX across rails,
  POOLED across tiers.** MAX because a mean lets one broken rail hide behind healthy ones; pooled
  because a file stable only on the strong tier has already failed the promise it exists to keep —
  the weakest plausible model must follow the contract too.
- **Not decorrelated evidence.** Every walker here is a fresh `blind-ic`/`Explore` leaf, and the
  platform injects the umbrella governance stack at spawn regardless (measured 2026-07-26). Between-
  walker spread is real data; agreement across walkers is never cited as independent confirmation.
- **Four instrument shapes exist and are NEVER pooled into one cross-run number:** lane EXECUTION
  (Runs 11-a-kind), lane SELECTION (Run 12-a-kind), a hook-injected coordination cue (Runs 13/14/17/18
 —four sequential carves of the same clause), and this benchmark's own prose-index hypothesis test
  (Run 15). Each is tabled on its own terms; a rail from one is never averaged against a rail from
  another.
- **A prediction is written down before the walkers fire, every time.** A hypothesis confirmed after
  the fact is not evidence; the value of this method is that it can be wrong in public.
- **Novelty is a separate, weaker claim than the measurement itself.** A market survey (2026-08-01,
  ~18 candidates) found no tool doing all four of: tests a *shipped instruction file* · for
  *determinism across repeated identical reads* · *across model tiers* · *as a shipping gate*. The
  closest was Anthropic's own skill-authoring guidance (3/4—it recommends cross-tier testing and
  states outright that no built-in runner exists). State this as "not found in a real search",
  never as "nobody does this".
