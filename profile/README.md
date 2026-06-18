<p align="center">
  <img src="./thecolliery_banner.png" width="25%" alt="TheColliery Banner">
</p>

<p align="center">
  <strong>Quality tooling for AI coding agents — mined, sorted, and shipped.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Suite-TheColliery-blueviolet?style=for-the-badge" alt="Suite">
  <img src="https://img.shields.io/badge/Downloads-2.5k%2B%20%2F%2014d-orange?style=for-the-badge" alt="Downloads">
  <img src="https://img.shields.io/badge/Developers-562%2B%20%2F%2014d-brightgreen?style=for-the-badge" alt="Developers">
  <img src="https://img.shields.io/badge/Works_With-Any_Agent-cyan?style=for-the-badge" alt="Any Agent">
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
| **[CoalTipple](https://github.com/TheColliery/CoalTipple)** | *Sorting* | **Live** ![ver](https://img.shields.io/github/v/tag/TheColliery/CoalTipple?sort=semver&label=&color=success&style=flat-square) | A model/effort **router**: **delegation** (down, to save tokens) and **escalation** (up, for quality), a `qualityBar` staircase, and a fail-safe model-ranking **Lock**. Built and validated in real use on Claude Code (across the 2.1.x line). |
| **CoalHearth** | *Session Storage* | **Design** | An ephemeral session memory and warm-resume engine that protects token budgets and logs handover states across session limits. *(Not yet public.)* |
| **CoalFace** | *Active Front* | **Design** | An agent swarming and concurrent orchestration engine that splits a fixed token budget into parallel workers without logical collisions. *(Not yet public.)* |
| **CoalBoard** | *Governance* | **Design** | A multi-agent consensus and debate engine (3 workers + 1 judge) that runs parallel checks on high-precision tasks before committing changes. *(Not yet public.)* |

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
| 1 | **[CoalMine](https://github.com/HetCreep/CoalMine)** | a Claude Code **plugin** — `claude plugin install coalmine@coalmine` |
| 2 | **[CoalTipple](https://github.com/TheColliery/CoalTipple)** | a Claude Code **plugin** — `claude plugin marketplace add TheColliery/CoalTipple` then `claude plugin install coaltipple@coaltipple` (or `install.mjs` for other agents) |
| 3 | CoalHearth / CoalFace / CoalBoard | *not yet public* |

---

## 📜 The 5 Doctrine Layers

Every tool inside **TheColliery** is governed by our core constitution — the **[full doctrine](https://github.com/TheColliery/.github/blob/main/DESIGN-PRINCIPLES.md)** spells out every Phoenix-13 and Quantum-11 point. The lines below are one-line digests:

1. 🌐 **Works in Every Mine (Cross-Agent):** Vendor-agnostic universality — runs on Claude, Gemini, Cline, Cursor, Codex, and custom frameworks.
2. 🦅 **Phoenix 13 Compliance:** Immortal hooks, all **13** commandments — fail-silent · zero-dependency · zero-latency · zero-garbage · zero-side-effects · stateless · offline · deterministic · portable · sandboxed · future-proof · self-healing · zero-noise.
3. 🔬 **Quantum 11 Performance:** All **11** principles — maximum output · zero visible errors · single brand · minimum power + consent · essential accessories · error correction · determinism · isolation · measurement · trust · entanglement.
4. 🛡️ **Antivirus/ESET Heuristics:** Adaptive freshness checks, signature validation, and secure credential handling.
5. 🔌 **Single Power Button:** Absolute minimal setup — a single command installs and runs the conductor.

---

<p align="center">
  <em>More tools and skills are still deep underground. 🔦</em>
</p>
