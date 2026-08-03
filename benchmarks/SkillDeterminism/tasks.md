# Frozen walker instruments

Four instrument shapes. Each is reproducible against the named blob; none is pooled with another.

## Shape 1 — lane EXECUTION (Run 11's EN frame)

Walks how a lane's rails execute (gates, prohibitions, fail-routes, writes) from a frozen contract
prompt. Common wrapper, byte-identical across every dispatch; only `[SCENARIO BLOCK]` differs.

```
Contract walk — READ THE SKILL AND REPORT WHAT YOU WOULD DO, IN WHAT ORDER. DO NOT ACTUALLY DO ANY OF IT.

## What to read (read all of it before answering)
<path to the SKILL.md under test>
If it points at another file and you judge that file necessary to decide the situation below, you MAY read it — then say which file you read and why.

## The situation to walk
[SCENARIO BLOCK]

## What to answer — answer as numbered items EXACTLY as listed. Do not add headings. Do not skip an item.
1. Does this skill's activation condition apply? — yes/no, and which sentence in SKILL.md made you decide that (quote it).
2. The sequence of steps you would take — a numbered list to the end; walk ONE path; if information is insufficient, follow the skill's own unknown/default rule and say where you got stuck.
3. Points where you must ask the user's permission first — how many, where, what each asks.
4. Points that are absolutely forbidden — list every prohibition SKILL.md states.
5. Where the output goes — which file, which folder.
6. If something goes wrong mid-way — what does the skill tell you to do.
7. Any grade / level / mode you must choose — if so, what did you choose and why.
8. What in SKILL.md you read and were NOT sure about — quote the ambiguous sentence, or write "none".

## RAILS
- Never actually do the work — no spawn, no write, no edit, no state-changing command. Read-and-report only.
- Do not search the web. Do not read any other repo.
- Answer from what you read in the file — if SKILL.md does not say it, write "SKILL.md does not say".
- Answer in English, except technical terms and text quoted from the file.
```

Full scenario blocks (4 lanes: routing-OFF, sensitive/never-down, escalate-up, route-to-self) and the
per-run results live in `results/2026-08-03-skill-determinism-walks.md` §Run 11 (this benchmark's
detail file consolidates the prior lab record — the canonical working copy is
`TheColliery/scratchpad/longrun/SKILL-VARIANCE-WALK.md`, machine-local and not part of this public repo).

## Shape 2 — lane SELECTION (Run 12's shape)

Walks the decision UPSTREAM of execution — given a situation, which entry does the reader pick at
all. 4 scenarios (one real, three controls), EN, ~1.1k chars, questions A (routing pick) / B
(enumerate the trigger list) / C (free-text criticism). **Not pinned at fire time** (declared gap in
the original record) — reconstructable from the scenario summaries in the detail file, not
byte-reproducible the way Runs 13-15 are.

## Shape 3 — hook-injected coordination cue (Runs 13 & 14)

Walks a `UserPromptSubmit`-injected cue, not a SKILL.md body — the load layer is two hook-emitted
lines. 5 scenarios, EN, answer format A (which leads) / B (next action) / C (surface to user Y/N) /
D (enumerate the stakes set) / E (self-reported uncertainty).

- Run 13 (before carve): [`results/raw/run13-prompt-v1.txt`](results/raw/run13-prompt-v1.txt), blob
  `3b4ff7080d7ccf935a32aa254bcc1c3bdd32b91c`, 3,760 B.
- Run 14 (after wave-1 carve, hook line A substituted, scenarios untouched):
  [`results/raw/run14-prompt-v1.txt`](results/raw/run14-prompt-v1.txt), blob
  `cd7c82405ffa9ad4c40ac9ade85ad471ce904d52`, 3,999 B.

## Shape 4 — this benchmark's prose-index hypothesis test (Run 15)

Same shell as Shape 1 (8 numbered questions, read-only rails), scenario constructed so every branch
of the target skill's own deterministic tier rubric is satisfied by the prompt's own wording — a
clean test of whether the walker COMPUTES the branch rather than guessing it.

- Run 15 (CoalMine `rot-canary`, prediction locked before firing):
  [`results/raw/run15-prompt-v1.txt`](results/raw/run15-prompt-v1.txt), blob
  `c9ccd10f9f644796d77f853b5006e58f95696437`, 2,874 B.
- Target walked: installed `coalmine@coalmine 3.14.0` `skills/rot-canary/SKILL.md`, blob
  `57406d5a42f55474672bbbed3d31a62a86cadd59`.

## Reproducing a run

1. Fetch the target blob at the pinned hash (the installed plugin cache, or `git cat-file blob <hash>`
   against the tool repo's history if the blob is a commit-reachable object there).
2. Dispatch the frozen prompt to N fresh, memory-less, no-spawn leaves per tier (this record used
   `blind-ic` under Claude Code; any zero-context, zero-tool-beyond-read leaf qualifies).
3. Score each rail's modal answer and membership per the formula in `PREREGISTRATION.md`.
4. Walker transcripts are collected into the detail record, then destroyed (standing lab-hygiene
   rule) — only the frozen PROMPT and the scored TABLE persist; a stranger re-running this gets a
   fresh, independent reading rather than an answer key.
