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
| `results/raw/` | The frozen prompt files (hashes in `tasks.md`). Earlier files are byte-identical to what was dispatched; later ones differ from the dispatched file by one line, the local path of the file under test, which is replaced by a placeholder. |

## Standing rails

- **Metric:** `divergence(rail) = 1 − (walkers matching the modal answer / N)`, **MAX across rails,
  POOLED across tiers.** MAX because a mean lets one broken rail hide behind healthy ones; pooled
  because a file stable only on the strong tier has already failed the promise it exists to keep —
  the weakest plausible model must follow the contract too.
- **Not decorrelated evidence.** Every walker here is a fresh `blind-ic`/`Explore` leaf, and the
  platform injects the umbrella governance stack at spawn regardless (measured 2026-07-26). Between-
  walker spread is real data; agreement across walkers is never cited as independent confirmation.
- **Six instrument shapes exist and are NEVER pooled into one cross-run number:** lane EXECUTION,
  lane SELECTION (with a post-verdict disposition variant), a hook-injected coordination cue (sequential
  carves of one clause), this benchmark's own prose-index hypothesis test, an enumerated-rail COUNT walk,
  and a scoped categorical rail reading. Each is tabled on its own terms in `tasks.md`; a rail from one is
  never averaged against a rail from another.
- **The scorer is part of the instrument.** Read at least one answer per tier by eye before a number is
  tabled; require numbered answer markers; score count and membership, not count alone; refuse to
  aggregate over a walker that did not parse. A silent drop moves the number in the direction that
  looks like success.
- **Report the divergence and the modal answer for every cell**, and the key it was scored against. A
  key is written before the first walker and changes only because the walked text changed.
- **A walk certifies one blob.** Every result names the blob it walked and which hash convention the stamp
  uses; a later edit to the file re-opens the walk, and the coverage table in `RESULTS.md` says where
  that has not yet happened.
- **A noise floor comes from a null control** (the same blob and prompt, a second draw), and is quoted
  with the instrument and skill it came from, never as a general constant.
- **A prediction is written down before the walkers fire, every time.** A hypothesis confirmed after
  the fact is not evidence; the value of this method is that it can be wrong in public.
- **Novelty is a separate, weaker claim than the measurement itself.** A market survey (2026-08-01,
  ~18 candidates) found no tool doing all four of: tests a *shipped instruction file* · for
  *determinism across repeated identical reads* · *across model tiers* · *as a shipping gate*. The
  closest was Anthropic's own skill-authoring guidance (3/4—it recommends cross-tier testing and
  states outright that no built-in runner exists). State this as "not found in a real search",
  never as "nobody does this".
