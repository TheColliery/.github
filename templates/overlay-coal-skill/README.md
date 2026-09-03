# overlay-coal-skill

Applied on top of `templates/published-code/` by `new-repo.mjs --overlay coal-skill` for a
Coal* skill repo — the 5 Standard Systems' shipping mechanics.

## Included this pass

- `.github/workflows/claude-ai-zips.yml` + `scripts/build-claude-ai-zips.mjs` — the
  claude.ai ZIP-packaging pair, reconciled from the three live copies (CoalMine ·
  CoalFace · CoalLedger) per UMB-045 step 2. **CoalMine is the canonical source**
  (`board #40`, explicitly the flock exemplar in its own `MEMORY.md`; its own
  `claude-ai-zips.yml` was the most recently touched of the three, `2026-08-22`).
  CoalFace's fork carries two real improvements (a combined ref-type+stability check,
  a fuller step-name provenance comment) not folded in here — worth a follow-up
  reconciliation, not done this pass.
- `build-claude-ai-zips.mjs` imports `./lib/desc-cap.mjs` and `./lib/claude-ai-trim.mjs`
  at run time — **those two library files are NOT copied here.** They are general
  cross-platform description-capping utilities (part of the config-schema tooling,
  not zip-specific) — copy them from a live room (e.g. `CoalMine/scripts/lib/`) when
  scaffolding a new repo, or build them fresh per the same contract: `desc-cap.mjs`
  exports `frontmatterField(text, key)`; `claude-ai-trim.mjs` exports
  `trimDescription(str, cap)` + `CLAUDE_AI_DESC_CAP` (200).

## NOT included this pass (deferred, named not silently dropped)

- A config-cascade template (`.<tool>.json` global+project) and `configure.mjs` — the
  5 Standard Systems' `config` mechanism. Every live room's copy is genuinely bespoke
  per tool's own key set; a template here would be a skeleton with no keys, which is
  close to no template at all. Worth building from the SHAPE (global/project cascade,
  safer-value-wins clamp on consent-bearing keys per `hooks-safety.md` §9) rather than
  one room's literal file.
- `verify.mjs`'s config-key gate (the schema-vs-help-text drift check, CWK-059 in
  CoalMine) — same reasoning, genuinely per-tool.
- A `/stats` command reference/template.

These four are the real remaining overlay-coal-skill content; flagged in the deputy's
return as pending, not fabricated here from memory.
