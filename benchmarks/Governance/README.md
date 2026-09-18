# Governance-pile benchmark—protocol

Measures the series' **own always-injected governance stack**—the umbrella `CLAUDE.md`/`AGENTS.md`/`MEMORY.md`, the `.claude/rules/ecc/**` files without `paths:` frontmatter, the machine-global files and the auto-memory index—against the claim that appended instructions suffer diminishing adherence returns.

Unlike every other dir here, **the target is not a shipped tool and has no version.** It is pinned by **byte snapshot + timestamp**, because it is edited by other agents and can move inside a single run.

## Layout

| File | What it is |
|---|---|
| `PREREGISTRATION.md` | The adherence definition, probe classes, decision rule and declared limitations—**written before any adherence data.** Never edited after the first run; corrections go in the dated record. |
| `tasks.md` | The harness verbatim: common wrapper, ten probes, and the two 30-instruction treatment blocks. |
| `score.mjs` | Mechanical predicates + per-cell spread aggregation. `node score.mjs --all`. |
| `RESULTS.md` | The digest. **The only link target** for an org row or a README. |
| `results/` | Dated detail records. |
| `results/raw/` | Every worker transcript, so any figure can be re-scored by a stranger. |

## Standing rails

- **The injected file set is read off a running session's own context**, cross-checked against the `paths:` frontmatter split—never assumed from the `@import` lines, because `.claude/rules/**` auto-loads as a directory.
- **Token counts are calibrated estimates, never a tokenizer count.** Char counts are measured; the multiplier is re-derived per run against the platform's own counter.
- **Probes are classified PILE-SPECIFIC vs GENERIC-OVERLAP before running.** The headline uses the pile-specific subset only—where a competent model reaches the same answer without the pile, a pass is not attributable to it.
- **The workers are not decorrelated.** The platform injects the governance stack at spawn. Worker agreement is never cited as independent evidence.
- **A ceiling result proves the level, never the slope.** If every cell scores at ceiling, the verdict is "not answered", not "no effect".
- **The dir name and its place in the flock shape are main's to ratify**—this is the first non-tool benchmark in the tree.
