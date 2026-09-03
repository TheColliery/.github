# overlay-coal-skill

Applied on top of `templates/published-code/` by `new-repo.mjs --overlay coal-skill` for a
Coal* skill repo — the 5 Standard Systems' shipping mechanics.

## Included this pass

- `.github/workflows/claude-ai-zips.yml` + `scripts/build-claude-ai-zips.mjs` — the
  claude.ai ZIP-packaging pair, reconciled from the three live copies (CoalMine ·
  CoalFace · CoalLedger) per UMB-045 step 2. **CoalMine is the canonical source**
  (`board #40`, explicitly the flock exemplar in its own `MEMORY.md`; its own
  `claude-ai-zips.yml` was the most recently touched of the three, `2026-08-22`).
  CoalFace's fork's two real improvements are now **merged in** (UMB-045 letter (B),
  2026-09-03, citing CoalFace commit `6f1f3458009c039de44fa2c3fcd548222b0ebc2b`): the
  ref-type + stability check is one env-driven step instead of a job-level `if:` plus a
  separate step, and the step's own `name:` carries the full provenance rationale
  inline (double-quoted, so GitHub's YAML parser does not truncate it at the first
  unescaped `#` — the exact defect CoalFace's own board #119 found and fixed in this
  same file).
- `build-claude-ai-zips.mjs` imports `./lib/desc-cap.mjs` and `./lib/claude-ai-trim.mjs`
  at run time — **those two library files are NOT copied here.** They are general
  cross-platform description-capping utilities (part of the config-schema tooling,
  not zip-specific) — copy them from a live room (e.g. `CoalMine/scripts/lib/`) when
  scaffolding a new repo, or build them fresh per the same contract: `desc-cap.mjs`
  exports `frontmatterField(text, key)`; `claude-ai-trim.mjs` exports
  `trimDescription(str, cap)` + `CLAUDE_AI_DESC_CAP` (200).
- **The `config` mechanism (5 Standard Systems #1), UMB-045 letter (C), 2026-09-03 —
  sourced from CoalMine's live exemplar, genericized:**
  - `scripts/lib/config-schema.mjs` — the single source-of-truth key table
    (`CONFIG_SCHEMA` + `validateValue`), shape copied verbatim from
    `CoalMine/scripts/lib/config-schema.mjs`. **The key list itself is a
    `{{PLACEHOLDER}}` — every real room's keys are genuinely bespoke; fill it in,
    never ship the empty array.**
  - `scripts/configure.mjs` — the `.{{TOOL}}.json` CLI configurator, simplified from
    `CoalMine/scripts/configure.mjs`. Keeps the two-tier cascade (global
    `~/.claude/.{{TOOL}}.json`, project `<gitroot>/.{{TOOL}}.json`, project wins per
    key) — CoalMine's own three-agent-dir walk (`.claude`/`.agents`/`.gemini` +
    legacy root dotfile) is that room's own namespace-campaign migration history
    (`TheColliery/MEMORY.md`'s 2026-08-08 entry), not a day-one requirement; port
    `CoalMine/scripts/lib/config-paths.mjs` later if a room needs multi-agent-dir
    discovery.
  - `scripts/lib/config-keys.mjs` — the documentation-vs-schema drift gate
    (`checkConfigKeys` + `checkConfigReadPath`), wired into `verify.mjs`. Mechanism
    copied verbatim from `CoalMine/scripts/lib/config-keys.mjs` (CWK-059/CWK-061);
    CoalMine's own measured false-positive counts and its own `PENDING_KEYS`/
    `NOT_CONFIG`/`BLIND_KEYS` entries are **not** ported — those are that room's own
    measurements against its own surfaces. Re-measure this tool's own false-positive
    rate before trusting the KEY_SHAPE regex as-is; fill the three declaration
    objects with this tool's own keys (every room hits `BLIND_KEYS` at least once,
    since the umbrella's 5 Standard Systems #2 mandates a `language` key that fails
    the camelCase shape rule by construction).
  - `commands/stats.md` — the `/stats` measurement command (5 Standard Systems #5),
    genericized from `CoalMine/commands/stats.md`. `{{unit}}`/`{{PLACEHOLDER}}` mark
    the per-tool natural metric (savings/findings/fidelity per the umbrella's own
    metric taxonomy) — fill in before shipping.

These four pieces are real, working code (not prose stubs) — but every one carries a
`{{PLACEHOLDER}}`/`{{TOOL}}` that must be filled with the new room's own real keys
before it ships. Do not ship any of them with the placeholder still in.
