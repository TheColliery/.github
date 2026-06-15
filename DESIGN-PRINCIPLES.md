# TheColliery — Design Principles (the Quantum Computer Spec)

The eleven binding principles of the **TheColliery** series. Every skill, hook, script, config, and doc in every tool (**CoalMine**, **CoalTipple**, and what follows) must satisfy all eleven; every change is judged against them. Principles 1–5 describe **what each machine is**; 6–10 describe **the disciplines that keep it that way**; 11 describes **where its power comes from**.

| # | Principle | Meaning across the series |
|---|---|---|
| 1 | **Maximum performance** | Detection/routing depth and accuracy are uniform across every tier, platform, and tool. Per-stack/per-platform procedures live in `references/`; behavior is rubric-driven, never mood-driven. |
| 2 | **Zero visible errors** | Bugs die before users see them: unit + integration tests and a two-direction verify gate run on every commit and push; each tool scans its own code. |
| 3 | **Single brand, single color, single company** | Total internal consistency — one naming pattern, one section structure, one voice, and exactly one source of truth for every fact (a config schema, a keyword list, a render core). No two definitions of the same thing. |
| 4 | **Minimum necessary power** | Tokens are spent only when and where needed: lean always-loaded surfaces, progressive disclosure, tiers that scale cost to scope. **Spending the user's tokens always requires consent** — per-instance (a question menu) or standing (capped, opt-out-able). A silent expensive operation is theft, not a feature. |
| 5 | **Only essential accessories** | Every auxiliary file must earn its place. Anything unused, duplicated, or decorative is removed — an accessory that ships is one someone must maintain and trust. |
| 6 | **Error correction, not error avoidance** | Failures are assumed and recovered: checkpoint → fix → test → auto-revert; clean re-installs; unknown state re-nudges instead of being swallowed; dead runs resume from recorded results. |
| 7 | **Determinism** | Same input, same answer — rubric scores, reproducible builds, deterministic hooks. Judgment is reserved for the model layer; everything mechanical is mechanical. |
| 8 | **Isolation** | No side effects across components: hooks never spawn, never touch the network, write only inside their sandbox; one tool's run never contaminates another's state. (Enforced for the hook layer by the Phoenix 13 Commandments.) |
| 9 | **Measurement & calibration** | What is not measured cannot improve: field reports flow in through an issue funnel; behavior is calibrated per project and per platform — never assumed. |
| 10 | **A machine you can trust** | It never harms its owner (path-escape hardening, no secrets, signed releases, a SECURITY policy) and its manual never lies — docs state exactly what the code does. It distrusts its own non-code artifacts too: installed copies, doctrine mirrors, and memory/rules are all verified, not just trusted. An agent that believes a tampered memory is as compromised as one running tampered code. |
| 11 | **Entanglement** | The suite's power exceeds the sum of its tools: components hand findings to each other and share layers — triggers, gates, rubric, language policy, config schema — that bind them into one machine. |

**No external assumption (series rule).** None of the above may HARD-require a system the user might not have — git, GitHub, a network, or a specific CLI are *optional enhancements with a graceful fallback*, never a runtime requirement. A non-git, offline user must still get full function. Phoenix #7 ("offline-capable") is the hook-layer instance of this rule; CoalTipple's damage control is the skill-layer instance (a git worktree/commit is a bonus, the sandbox journal is the universal recovery).

Relationship to the other rule layers: the **[Phoenix 13 Commandments](./hooks-safety.md)** implement principles 6–8 and 10 for hooks; **[scripts-quality](./scripts-quality.md)** implements 2 and 6 for CLI scripts; this file governs the whole series. Each tool re-validates its stamped copies of those layers through the gold-standard lifecycle.
