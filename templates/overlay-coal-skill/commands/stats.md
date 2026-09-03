---
description: {{TOOL}} measurement dashboard — activity this session + a state summary, per the 5 Standard Systems #5 (measurement)
---

Produce the {{TOOL}} stats report for this project, in the user's language. Sourced from
CoalMine's exemplar (`commands/stats.md`, live 2026-09-03) — the SHAPE below is the
umbrella's own gold-standard fill (Google SRE golden-signals framing: traffic + errors
beside the existing activity/impact split). Fill in this tool's own natural metric
(savings, findings, fidelity — per the umbrella's 5 Standard Systems #5) before shipping;
do not leave the placeholder rows.

**1. Activity this session (from conversation context):**
| {{unit}} | runs | outcome | notes |
Count every {{TOOL}} invocation visible in this session (manual or hook-nudged). If none
ran, one line saying so.

**2. State — freshness/health, scanned now:**
{{PLACEHOLDER}} — the natural per-tool check (e.g. a rule-freshness grep for
`coalmine: verified` stamps, a config-drift check, an install-state read). **Config
reads — every key, always the CASCADE, never the bare project file:** `~/.claude/.{{TOOL}}.json`
first, then the project config, project wins per key. A bare project read is ABSENT on a
machine configured only globally, so it silently yields defaults.

**3. STATE — an error-rate signal (gold-standard UMB-023, prefer not MUST):** a
failure/abnormal-outcome count beside the activity + state above, if this tool tracks
one (a failed hook run, a refused admission, a gate FAIL). Omit the row honestly if
nothing counts this today, rather than fabricating a zero.

No prose beyond the tables and any consent-gated offer named in step 2. Do not modify
any file.
