# overlay-llm-deploy

Applied on top of `templates/published-code/` (or `private-working/`, per the target
repo) for an LLM-zone product repo with a Cloudflare-Workers-served static page and/or a
PyPI package. Built UMB-045 letter (D), 2026-09-03 — read from LLMWorks/Kolwen's own live
deploy files first, nothing here is invented.

## Included this pass

- **`wrangler.jsonc`** — the Cloudflare Worker manifest (static-assets mode), shape copied
  verbatim from `LLMWorks/Kolwen/wrangler.jsonc` (read live 2026-09-03). `{{WORKER_NAME}}`,
  `{{COMPAT_DATE}}`, `{{ASSETS_DIR}}` are placeholders.
- **`.github/workflows/deploy-check.yml`** + **`scripts/post-deploy-check.mjs`** — the
  post-deploy smoke check that watches Workers Builds (which deploys OUTSIDE Actions on
  push, and has genuinely produced no build at all before — a live Kolwen incident,
  `LWK-077`). Sourced from `LLMWorks/Kolwen/.github/workflows/deploy-check.yml` +
  `LLMWorks/Kolwen/scripts/post-deploy-check.mjs` (read live 2026-09-03). The mechanism
  (fixed-point Cloudflare-injected-script stripping, dual-origin fallback for a
  datacenter-egress-hostile edge, retry-until-budget so an in-flight deploy isn't read as
  a mismatch) is copied verbatim — genuinely load-bearing, do not simplify it away.
  `{{ASSETS_DIR}}` and the two `{{PLACEHOLDER}}` origin URLs need filling; the rest should
  not be loosened without re-deriving why each guard exists (the comments in the source
  file name the incident each one closes).
- **`.github/workflows/publish-pypi.yml`** — the PyPI Trusted-Publishing workflow, sourced
  from `LLMWorks/Kolwen/.github/workflows/publish-pypi.yml` (read live 2026-09-03). The
  fail-safe TestPyPI-by-default routing (only a clean `{{TAG_PREFIX}}-vX.Y.Z` tag reaches
  real PyPI, everything else — including every manual dispatch — goes to TestPyPI) is
  deliberately conservative: a wrong TestPyPI upload is harmless, a wrong real-PyPI upload
  is permanent. `{{PY_DIR}}` and `{{TAG_PREFIX}}` are the only variables; do not widen the
  regex that gates the real-PyPI branch.

## NOT included this pass

- Any HuggingFace/model-weights deploy path — Kolwen's own room has not shipped one yet
  (`LLMWorks/Kolwen/MEMORY.md`: "No product ships yet"), so there is nothing live to read
  from. Build this overlay's next piece by reading a real one when a room ships it, per
  this same rule: never invent a deploy workflow from a description of what it "should"
  look like.
- npm/VS-Code-Marketplace/Open-VSX publish workflows — Kolwen holds those namespaces
  (`MEMORY.md`'s Standing facts) but has not shipped a publish workflow for any of them
  yet either.

Every file above carries `{{PLACEHOLDER}}` tokens — do not ship any of them unfilled.
