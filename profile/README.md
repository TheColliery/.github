# TheColliery

<p align="center">
  <img src="./thecolliery_banner.png" width="25%" alt="TheColliery Banner">
</p>

<p align="center">
  <strong>Quality tooling for AI coding agents — mined, sorted, and shipped.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Suite-TheColliery-blueviolet?style=for-the-badge" alt="Suite">
  <img src="https://img.shields.io/badge/Downloads-3.0k%2B%20%2F%2014d-orange?style=for-the-badge" alt="Downloads">
  <img src="https://img.shields.io/badge/Developers-682%2B%20%2F%2014d-brightgreen?style=for-the-badge" alt="Developers">
  <img src="https://img.shields.io/badge/Works_With-Mostly_Cross--Agent-cyan?style=for-the-badge" alt="Mostly Cross-Agent">
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License">
</p>

---

## 🏗️ What is TheColliery?

A *colliery* is the complete coal mining operation: the mine, the tipple, and the workspace that turns a raw underground seam into clean, burning fuel.

**TheColliery** is a series of small, sharp, offline-first tools designed to keep AI coding agents honest, secure, and blazing fast. We build the infrastructure that helps agents execute safely, coordinate concurrently, and optimize their token budgets without sacrificing quality.

---

## ⛏️ The Series Suite

The Colliery structures its tools by the processing stages of raw digital coal:

| Project | Stage | Status | Concept |
| :--- | :--- | :--- | :--- |
| **[CoalMine](https://github.com/HetCreep/CoalMine)** | *Extraction* | **Live** ![ver](https://img.shields.io/github/v/tag/HetCreep/CoalMine?sort=semver&label=&color=success&style=flat-square) | Nine quality-**canary** skills (code-health, grounding, supply-chain, resilience, observability, testability, scaling, drift, completeness) that equip agents for raw, safe code extraction. |
| **[CoalTipple](https://github.com/TheColliery/CoalTipple)** | *Sorting* | **Live** ![ver](https://img.shields.io/github/v/tag/TheColliery/CoalTipple?sort=semver&label=&color=success&style=flat-square) | A model/effort **router**: **delegation** (down, to save tokens) and **escalation** (up, for quality), a `qualityBar` staircase, and a fail-safe model-ranking **Lock**. **Claude Code only** — routing actuates only where an agent can pick a spawned worker's model + effort (built and validated across the 2.1.x line). |
| **CoalHearth** | *Session Storage* | **Design** | An ephemeral session memory and warm-resume engine that protects token budgets and logs handover states across session limits. *(Not yet public.)* |
| **CoalFace** | *Active Front* | **Design** | An agent swarming and concurrent orchestration engine that splits a fixed token budget into parallel workers without logical collisions. *(Not yet public.)* |
| **[CoalBoard](https://github.com/TheColliery/CoalBoard)** | *Governance* | **Live** ![ver](https://img.shields.io/github/v/tag/TheColliery/CoalBoard?sort=semver&label=&color=success&style=flat-square) | A **consensus & debate board**: on an error-not-allowed task — or any hard problem worth several lenses — with consent, diverse epistemic lenses (empirical/source-grounded · formal · a show-me skeptic) debate in parallel, a judge synthesizes on VERIFIED inputs, an independent solver breaks ties, and the human signs off. Bounded cost + zero-breakage. |
| **CoalPortal** | *Surface Gateway* | **Design** | A secure, remote **Web-to-CLI chat gateway**: monitor running sessions, review agent-proposed changes, and approve/reject from any device over an end-to-end-encrypted tunnel — a Messenger-style interface served from a single static page, no server to host. *(Not yet public.)* |

---

## 📦 Install — pick your DLC

Each tool installs on its own, or grab them together — like choosing DLC on a store page: take the whole pack, or just the pieces you want.

**One-step selector** (needs `node` + `git` on PATH; the `claude` CLI for the plugins):

```bash
curl -fsSL https://raw.githubusercontent.com/TheColliery/.github/main/install.mjs -o colliery-install.mjs
node colliery-install.mjs all     # the whole suite
node colliery-install.mjs 2       # just CoalTipple
node colliery-install.mjs 1 2     # CoalMine + CoalTipple
```

**Or install each tool directly** — each repo's README has the authoritative, always-current steps:

| # | Tool | How |
| :--- | :--- | :--- |
| 1 | **[CoalMine](https://github.com/HetCreep/CoalMine)** | a Claude Code **plugin** — `claude plugin marketplace add HetCreep/CoalMine` then `claude plugin install coalmine@coalmine` |
| 2 | **[CoalTipple](https://github.com/TheColliery/CoalTipple)** | a Claude Code **plugin** — `claude plugin marketplace add TheColliery/CoalTipple` then `claude plugin install coaltipple@coaltipple` (or `install.mjs` for other agents) |
| 3 | **[CoalBoard](https://github.com/TheColliery/CoalBoard)** | a Claude Code **plugin** — `claude plugin marketplace add TheColliery/CoalBoard` then `claude plugin install coalboard@coalboard` |
| 4 | CoalHearth / CoalFace / CoalPortal | *not yet public* |

---

## 📊 Benchmarks

Headline results — **CoalMine** 100% recall · 100% precision (rot-canary, 16 fixtures) · **CoalTipple** 20/20 output-correctness on +1-rung escalation + ~70–75% routing-cost savings · **CoalBoard** 10/10 vs an un-primed solo ~13/20 on error-not-allowed tasks. Small, dated samples; the full tables + caveats (including CoalBoard's honest correlated-blind-spot ceiling) stay in each tool's `RESULTS.md` — the single source of truth, never duplicated. See **[the benchmark records](https://github.com/TheColliery/.github/tree/main/benchmarks)**.

---

## 📜 The 5 Doctrine Layers

Every tool inside **TheColliery** is governed by our core constitution — the **[full doctrine](https://github.com/TheColliery/.github/blob/main/DESIGN-PRINCIPLES.md)** spells out every Phoenix-13 and Quantum-11 point. The lines below are one-line digests:

1. 🌐 **Works in Every Mine (Cross-Agent):** Vendor-agnostic by design — CoalMine and CoalBoard run on Claude, Gemini, Cline, Cursor, Codex, and custom frameworks. (CoalTipple is the deliberate exception: model/effort routing only actuates where an agent can pick a spawned worker's model, which today is **Claude Code only**.)
2. 🦅 **Phoenix 13 Compliance:** Immortal hooks, all **13** commandments — fail-silent · zero-dependency · zero-latency · zero-garbage · zero-side-effects · stateless · offline · deterministic · portable · sandboxed · future-proof · self-healing · zero-noise.
3. 🔬 **Quantum 11 Performance:** All **11** principles — maximum output · zero visible errors · single brand · minimum power + consent · essential accessories · error correction · determinism · isolation · measurement · trust · entanglement.
4. 🛡️ **Antivirus/ESET Heuristics:** Adaptive freshness checks, signature validation, and secure credential handling.
5. 🔌 **Single Power Button:** Absolute minimal setup — a single command installs and runs the conductor.

---

<p align="center">
  <em>More tools and skills are still deep underground. 🔦</em>
</p>
