<!-- coalmine: verified 2026-08-01 · exemplar ECC-skill-adaptation-policy · revalidate 90d -->
# Adoption Pattern (TheColliery)

> What to do when a rule, a doc shape, or a skill in this series comes from somewhere else. Written 2026-08-01, when a three-way merge against [ECC](https://github.com/affaan-m/ECC) found six inheritable items and two that would have been regressions — and we had no written policy for either outcome. Companion to [SKILL-REPO-PATTERN.md](./SKILL-REPO-PATTERN.md) (the `origin:` frontmatter key this file's rule 4 fills) and [DESIGN-PRINCIPLES.md](./DESIGN-PRINCIPLES.md) (principle 5, only essential accessories).
>
> **Scope: what WE adopt.** It is not a bar for judging anyone else's project — a repo CoalMine or CoalLedger scans is judged by its own author's intent.

## 1. The default rule — adopt the idea, not the identity

**Source: UPSTREAM, adopted whole.** ECC's [`docs/skill-adaptation-policy.md`](https://github.com/affaan-m/ECC/blob/HEAD/docs/skill-adaptation-policy.md), verbatim, on a contribution that starts from another repo, prompt pack, plugin, harness, or personal config:

> - copy the underlying idea, workflow, or structure
> - adapt it to ECC's current install surfaces, validation flow, and repo conventions
> - remove unnecessary external branding, dependency assumptions, and upstream-specific framing

Read `ECC` as `this repo` throughout. Their stated goal — *"reuse without turning ECC into a thin wrapper around someone else's runtime"* — is ours unchanged.

## 2. Keep the name, or rename

**Source: UPSTREAM, adopted whole.** Keep the original name only when **all** of: the contribution is close to a direct port · the name is already descriptive and neutral · the surface still behaves like the upstream concept · no better native name already exists in the repo.

Rename when *"ECC meaningfully expands, narrows, or repackages the original work"* — its four triggers, verbatim:

> - ECC adds substantial new behavior, structure, or guidance
> - the original name is vendor-forward or community-brand-forward instead of workflow-forward
> - the contribution overlaps an existing ECC surface and needs a clearer boundary
> - the contribution now fits as a capability, operator workflow, or policy layer rather than a literal port

## 3. Pick the narrowest surface that does the job

**Source: UPSTREAM, adopted whole** — the ladder we had only half of. Ours covered DEPENDENCIES (zero-dep; "no external assumption"); nothing covered which SURFACE a capability should be. Upstream's, verbatim:

> - `rules/` for deterministic constraints
> - `skills/` for on-demand workflows
> - MCP when a long-lived interactive tool boundary is justified
> - local scripts/CLI for deterministic one-shot execution
> - direct APIs when the remote call is narrow and does not justify MCP

Stop at the first rung that holds. Their dependency rule binds here too: *"Avoid shipping a skill that exists mainly to tell users to install or trust an unvetted third-party package"* and *"never let a new external dependency become the default path without explicit justification"* — which for us is stricter still, since the flock is zero-dependency by construction.

## 4. A borrowed line carries its source

**Source: OURS (the canary's derivation) — upstream's `origin:` covers SKILLS only, and most of what we borrow is a RULE or a DOC SHAPE.** The rule, both halves:

- **A skill** carries the `origin:` frontmatter key ([SKILL-REPO-PATTERN.md](./SKILL-REPO-PATTERN.md) Layer 2).
- **A borrowed rule or doc shape** carries, in place: the source repo, the file, and a link — plus a `<!-- coalmine: verified <date> · exemplar <name> · revalidate <30|90>d -->` stamp. **Quote the source; never paraphrase it into our voice and call it merged.** A paraphrase cannot be re-checked against the original, so the next reader has to re-derive the whole comparison; a quote makes the re-check one fetch.

## 5. Ruling a conflict — and recording the loss

A merge finds items where the two houses disagree. **Name the conflict explicitly and rule, in place. Never drop the other side silently** — an unnamed rejection reads as an oversight and gets re-proposed.

Two live precedents, both ruled OURS on 2026-08-01:

| Their rule | Our position | Ruling |
|---|---|---|
| `Minimum coverage: 80%` (ECC `AGENTS.md`, four places) | Retired by name in [`RULES-RETIRED.md`](https://github.com/TheColliery/.github) as `IMPRACTICAL` — no instrument could enforce it, and a mandate nothing can enforce teaches that mandates are decorative | **OURS.** Not resurrected without the owner's explicit override |
| `200-400 lines typical, 800 max` as a hard cap | `coding-style.md` amended 800 into a review SIGNAL with a declared-over-run mechanism | **OURS** |

The order of operations, and it is not optional: **grep [`RULES-RETIRED.md`](https://github.com/TheColliery/.github) for the subject BEFORE writing any adopted rule.** A rule retired with a reason is not resurrected because a second house happens to hold it.

## 6. Before it ships

**Source: UPSTREAM, adopted whole** — its five review questions, verbatim:

> 1. Is this a real reusable surface in ECC, or just documentation for another tool?
> 2. Does the current name still match the ECC-shaped surface?
> 3. Is there already an ECC skill that owns most of this behavior?
> 4. Are we importing a concept, or importing someone else's product identity?
> 5. Would an ECC user understand the purpose of this skill without knowing the upstream repo?

Upstream's own close: *"If those answers are weak, adapt more, narrow the scope, or do not ship it."*

## 7. What nothing enforces

**Fourth tense, named not covered.** No gate reads this file. `origin:` is checkable and is going into each repo's `verify.mjs` (Layer 4, warn-then-fail); everything else here is judgment and stays judgment — the same shape as [`google/eng-practices`](https://github.com/google/eng-practices), a normative manual set with no machine at all. Do not manufacture a gate for a judgment rule; do build one for a mechanical one.
