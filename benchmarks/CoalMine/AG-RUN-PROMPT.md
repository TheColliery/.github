# CoalMine rot-canary eval — Antigravity run prompt

> **THIS IS A BENCHMARK LOOP: 3 ROUNDS (K=3).** One paste = one round. Run the
> paste block **3 times total** — REP=1, REP=2, REP=3 — each in a fresh
> conversation. The benchmark is incomplete until all 3 result files exist.
> (K=3 per the locked methodology: 3 stochastic repeats per condition, extend a
> flip to 5 — see `RESULTS.md` Methodology / arXiv 2411.00640.)

## Model pick (fixed for ALL 3 rounds)

Select **Gemini 3.5 Flash (Medium)** in the Antigravity model picker — AG's
current default engine. Same model every round (mixing models breaks the arm).
Do NOT pick the Claude models in AG's picker (Sonnet/Opus 4.6) — the AG arm
exists to measure a DIFFERENT vendor's engine; Claude arms already run on the
CC side.

## How to run (the human's 3 steps)

1. Open a **FRESH Antigravity conversation** at `<repo-root>`,
   model = **Gemini 3.5 Flash (Medium)**.
2. Paste the block below, replacing `REP=1` on the first line with the round
   number (`1`, `2`, or `3`).
3. Repeat in a **new fresh conversation** for each round — 3 pastes total. Fresh
   conversations keep the rounds independent (a round that remembers the previous
   round's findings is contaminated).

When all 3 files exist, hand back to Claude Code for scoring
(`node score.mjs results/<file>.json` each + the K=3 aggregate).

## Paste block

```text
REP=1

BENCHMARK SCAN WORKER (CoalMine rot-canary eval — non-interactive, report-only).
Single pass, no questions, no fix offers, no subagents.

STEP 1 — Load the skill contract: read
<repo-root>\CoalMine\plugin\skills\rot-canary\SKILL.md
and apply its rot-canary scan contract at DEPTH=QUICK, single-agent, report-only
(no fix menu, no tier question).

STEP 2 — Scan scope: the 16 fixture directories under
<repo-root>\.github\benchmarks\CoalMine\fixtures\rot-canary\
For EACH fixture directory, read ONLY the files under its src\ subfolder and
scan them for defects per the skill contract.

BLIND PROTOCOL (hard rule): do NOT read or open expected.json, the results\
directory, RESULTS.md, score.mjs, or README.md — nothing outside the fixtures'
src\ folders. Ground-truth contamination invalidates the run. A clean file
yields NO findings — do not invent findings to look thorough; false positives
are scored against the run.

STEP 3 — Write the result file (create it yourself):
<repo-root>\.github\benchmarks\CoalMine\results\<TODAY YYYY-MM-DD>-antigravity-r<REP>.json
with EXACTLY this shape (UTF-8, no BOM):
{
  "model": "Antigravity (<engine/model name as precisely as you know it>)",
  "date": "<TODAY YYYY-MM-DD>",
  "skillVersion": "3.8.4",
  "findings": [
    {"fixture": "<fixture dir name, e.g. f01-dead-code>", "file": "src/<name>.js",
     "line": <int>, "category": "<one of: dead-code|bug-prone|resource-leak|concurrency|silent-failure|input-boundary|doc-rot>",
     "severity": "<CRITICAL|HIGH|MEDIUM|LOW>"}
  ]
}

Rules: category MUST be one of the 7 slugs (map the skill's categories onto
them: async/race → concurrency · input security/validation → input-boundary ·
stale comment/doc → doc-rot). file = path relative to the fixture dir, forward
slashes. line = the defect's line number in that file. After writing the file,
reply with only the file path and the finding count.
```

## Multi-suite run — the 6 new canaries (2026-07-03 corpora)

Same 3-round loop, but ONE paste covers all 6 suites (scale-canary ·
resilience-audit · telemetry-canary · testability-canary · drift-canary ·
supply-chain-audit) and writes 6 result files per round — 18 files total for
K=3. Fixed suite order every round (a within-round ordering bias is constant
and comparable across rounds; noted in RESULTS methodology). Corpus must be
FROZEN (committed) before round 1 — never scan mid-review corpora.

Paste block: see the session hand-off (REP=N header + the 6-suite loop with
per-suite slug lists + the same blind protocol; result files named
`<date>-<suite>-antigravity-r<REP>.json` and carrying `"suite"` +
`"rep"` fields so `score.mjs` resolves the right ground truth).

## Provenance rules

- The AG arm is **blind** (fixtures + ground truth authored on the CC side;
  expected.json off-limits to the scanning agent).
- One result file per rep; never overwrite a previous rep's file.
- Record the engine/model string AG reports about itself — the benchmark is
  engine-dependent (AV-style), so the label matters.
