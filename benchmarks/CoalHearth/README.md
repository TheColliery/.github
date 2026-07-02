# CoalHearth eval — interruption damage: cold restart vs warm resume

> **What this measures, honestly.** CoalHearth journals session state so an interrupted
> session (limit-hit, crash) RESUMES instead of restarting cold. This benchmark quantifies the
> **damage a cold restart pays that a warm resume avoids** — on a mid-task interruption with a
> known-correct completion. It does **NOT** claim CH recovers lost in-flight compute (it does
> not — Incident E scope: it records that a spawned worker existed + its residue path, never
> its result).

## Two arms, one interruption

A 10-file refactor (rename `getUserData` → `fetchUserProfile`, update every reference) is
interrupted **6 of 10 steps in**: the definition + 5 call sites are done; 4 references remain
(2 call sites, a test, and a stale doc-comment — the last is a non-import ref that is easy to
skim past). Fixture: `fixtures/refactor-midway/`.

- **COLD** (no CH) — an agent is handed the working tree with **no record of what was done**
  and must reconstruct state by re-scanning all 10 files, then finish.
- **WARM** (CH) — the same agent is handed CH's **recovery block** (what's done, what's
  modified, what remains, any in-flight agents) + only the remaining files, then finishes.

Scored: (a) **correctness** — did it find all 4 remaining refs, redo none of the 6 done?
(b) **tokens** — `subagent_tokens` per arm. (c) **state fidelity** — what CH's real lib
(`lib/state-snapshot.js`) reconstructs vs what a cold restart can.

## Honest scope

The token arm is engine- and scale-sensitive: on a small tree the per-agent baseline dominates
and a strong model reconstructs state unaided, so the token delta is tiny — CH's token value is
a **large-session** effect (re-scanning a big repo to reconstruct state is what costs). The
**fidelity** arm is the categorical one: the in-flight-agent record has **no tree signal**, so a
cold restart recovers 0% of it at any scale. See [`RESULTS.md`](RESULTS.md). CC-hook-only skill
(no Antigravity arm — AG doesn't run hooks).
