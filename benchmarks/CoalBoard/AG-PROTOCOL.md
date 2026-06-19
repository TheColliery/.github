# CoalBoard eval — Antigravity run protocol (you run this; Claude Code cannot)

Claude Code cannot actuate Antigravity, so the AG numbers are produced **by you, in Antigravity**, never fabricated here. The protocol is identical to the Claude Code arm so the two result files are comparable.

## Setup
1. Install CoalBoard in Antigravity (the cross-agent skill — AG has concurrent subagents, so the board runs; lenses all run the parent model, no cost-tiering, which is fine — diversity rides the prompts).
2. Open a project in Antigravity. Have [`tasks.md`](tasks.md) open.

## Run (per task T1–T5)
1. **WITHOUT** — start a fresh agent turn, paste the task prompt **verbatim**, let it answer in **one pass** (do NOT invoke the board). Record the answer.
2. **WITH** — fresh turn, paste the same prompt, then invoke the board (`/coalboard`, or however AG surfaces the skill) at **rigor: high**. Let the lenses + adversary + verify run. Record the answer.
3. **Score** with the objective scorer in `tasks.md` (T2: actually compute it; T3: re-fetch the current Node LTS the day you run — its gold is time-varying). Mark ✅ trap-caught / ❌ trap-missed.

## Fill in `results/antigravity.md`
Copy this table, fill the two arms, date it:

```
# CoalBoard eval — Antigravity (run YYYY-MM-DD, models: <main / lens models>)

| task | domain | WITHOUT (solo) | WITH (board) | gold met by board? |
|------|--------|----------------|--------------|--------------------|
| T1 | crypto      | ✅/❌ + 1-line why | ✅/❌ + 1-line why | ✅/❌ |
| T2 | math        | | | |
| T3 | research    | | | |
| T4 | concurrency | | | |
| T5 | docs        | | | |

Headline: solo M/5 · board K/5. Traps the board caught that solo missed: <list>.
Honest caveat: 5-task sample, dated; improved-not-proven; a shared-model blind spot can still slip.
```

Send me the filled table and I will fold it into the published benchmark beside the Claude Code numbers — **as you measured them** (no edits to your data, per the doc-standard: data shown = source verbatim).
