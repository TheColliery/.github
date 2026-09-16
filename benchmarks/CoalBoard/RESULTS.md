# CoalBoard benchmark records

## 2026-09-16 — CoalBoard audit mode vs cloudflare/security-audit-skill vs a solo control

<!-- version-frozen: measured 2026-09-16 (UTC) with CoalBoard v2.4.2 and security-audit-skill
     commit c1c8a8c installed; a dated snapshot, not tracked, not auto-re-run on either product's
     update. Re-run on request only. -->

**Measured:** 2026-09-16 (UTC) · CoalBoard **v2.4.2**, audit mode · `cloudflare/security-audit-skill`
commit `c1c8a8c` (quick profile) · a plain solo `-p` control · model ids `claude-opus-5` /
`claude-opus-4-8` / `claude-haiku-4-5-20251001` (⚠️ unverified) throughout, n = 3 rounds per arm,
one seeded target (withheld) — full stamp incl. Claude Code version in the linked record below.

> **TL;DR (disclosure: we build CoalBoard, one of the three arms compared):** the skill's quick
> profile matched a single-agent review of the same model tier on recall (0.467 median, 15 seeds,
> n = 3) at **≈ 14.5×** its median cost. CoalBoard's audit mode reached **0.867** median recall at
> **≈ 3.9× less** median cost than the skill. Precision held ≥ 0.857 median strict across all three
> arms, zero decoy false positives in any round. n = 3, one target — a measured signal, not a
> verdict; the "theirs weaker" reading holds at the pooled median and in 2 of 3 individual rounds
> (see the full record for the round that didn't clear it).

**Full record:** [`SECURITY-AUDIT-2026-09-16.md`](SECURITY-AUDIT-2026-09-16.md) — design, every
per-arm table, the pre-registered decision-rule outputs, a 13-seed sensitivity recompute, host-load
and scoring caveats, and a standing re-run offer to the vendor. Raw safe-to-publish artefacts:
[`results/security-audit-2026-09-16/`](results/security-audit-2026-09-16/).

---

## 2026-07-03 — solo-vs-board, strong-solo and weak-solo, mirrored

**Measured:** 2026-07-03 · CoalBoard **v1.5.5** (the skill installed at run time) · two arms on two platforms: Claude Code / **Opus 4.8** (strong solo) and Antigravity / **Gemini 3.5 Flash** (weak solo) · the 5 `tasks.md` error-not-allowed tasks, judge-run scoring per [`README.md`](README.md).
<!-- version-frozen: measured with v1.5.5 installed; re-run to update. -->

> **TL;DR:** **Opus 4.8: solo 4/5 · board 5/5**—a strong solo already catches the four
> *reasoning* traps; the board's irreducible win is **T3, the version-sensitive fact**
> (run-the-check beats training-stale memory). **Gemini 3.5 Flash: solo ~4/15 (27%) · board
> 5/5**—a weak solo misses reasoning traps too, so the board recovers ALL of them.
> The board's margin scales **inversely with solo strength**; T3 is the win at both ends.
> Board = solo **+ ground-truth execution**, not an omniscient LLM.

## The paired result

| Base model (solo arm) | Solo | Board | Board's added value |
|---|---|---|---|
| Opus 4.8 (strong) | **4/5** (T3 miss: committed stale Node 22, 0/3) | **5/5** | small—only T3, the external fact |
| Gemini 3.5 Flash (weak) | **~4/15 (27%)** (every task ≤1/3) | **5/5** | large—all four reasoning traps + T3 |

The single task the board wins **regardless of base model** is T3: no model reasons its way
past a training-cutoff gap; only the board's RUN-the-check step (a live fetch—Node 24,
EOL 2028-04-30, cited) does. On reasoning traps (T1 crypto / T2 compound / T4 race /
T5 headings) the board's edge exists only where the solo model is weak.

## Full runs (the raw, dated records)

- **Claude Code (Opus 4.8), solo-vs-board:** [`results/onoff-claude-code-2026-07-03.md`](results/onoff-claude-code-2026-07-03.md)—per-task table, K-runs, the honest "margin narrows as the base model strengthens" analysis, run log in [`results/onoff/`](results/onoff/).
- **Antigravity (Gemini 3.5 Flash), solo-vs-board:** [`results/antigravity-onoff-2026-07-03.md`](results/antigravity-onoff-2026-07-03.md)—per-task M/3 runs; golds independently re-verified (no fabrication).
- **Earlier board-reliability runs (2026-06-19, weaker/mixed solo era):** [`results/claude-code.md`](results/claude-code.md) (board 10/10 vs un-primed solo ~13/20) · [`results/antigravity.md`](results/antigravity.md) + [`results/antigravity-board-raw.md`](results/antigravity-board-raw.md) (AG solo 1/5 → board 4/5, incl. the live correlated-blind-spot demo). Kept as history; the 2026-07-03 pair above supersedes them as the current headline.

## Honest scope

Small n (K=1–3 per cell, majority verdicts—a direction, not a rate). The Claude Code arm is
same-family on both sides (Opus lenses share Opus blind spots—the correlated-blind-spot
ceiling applies; the board's reasoning-trap coverage cannot exceed what its lenses can see).
The T3 gold is time-varying—re-fetch `nodejs.org` / `endoflife.date` to re-score. A 5-task
sample, not a guarantee: the board's honest claim stays **bounded-cost + zero-breakage +
improved correctness**, never a defect-rate number.
