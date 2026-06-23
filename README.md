# 🗂️ TheColliery — Global Configuration & Landing Page (.github)

This repository houses the global configuration, landing page profile, central installation scripts, and shared developer doctrines for **[TheColliery](https://github.com/TheColliery)** organization.

---

## ⛏️ Active Repositories

* **[CoalMine](https://github.com/HetCreep/CoalMine)**: Quality-canary skills suite for AI coding agents.
  <br>
  [![Stars](https://img.shields.io/github/stars/HetCreep/CoalMine?style=flat-square&logo=github)](https://github.com/HetCreep/CoalMine/stargazers)
  [![Forks](https://img.shields.io/github/forks/HetCreep/CoalMine?style=flat-square&logo=github)](https://github.com/HetCreep/CoalMine/network/members)
  [![Downloads](https://img.shields.io/badge/CoalMine_Downloads-2.0k%2B%20%2F%2014d-orange?style=flat-square)](https://github.com/HetCreep/CoalMine)
  [![Developers](https://img.shields.io/badge/CoalMine_Developers-431%2B%20%2F%2014d-brightgreen?style=flat-square)](https://github.com/HetCreep/CoalMine)
* **[CoalTipple](https://github.com/TheColliery/CoalTipple)**: Model and effort router with budget protection locks.
  <br>
  [![Stars](https://img.shields.io/github/stars/TheColliery/CoalTipple?style=flat-square&logo=github)](https://github.com/TheColliery/CoalTipple/stargazers)
  [![Forks](https://img.shields.io/github/forks/TheColliery/CoalTipple?style=flat-square&logo=github)](https://github.com/TheColliery/CoalTipple/network/members)
  [![Downloads](https://img.shields.io/badge/CoalTipple_Downloads-1.2k%2B%20%2F%2014d-orange?style=flat-square)](https://github.com/TheColliery/CoalTipple)
  [![Developers](https://img.shields.io/badge/CoalTipple_Developers-253%2B%20%2F%2014d-brightgreen?style=flat-square)](https://github.com/TheColliery/CoalTipple)
* **[CoalBoard](https://github.com/TheColliery/CoalBoard)**: Consensus & debate board — diverse lenses verify error-not-allowed work before it ships.
  <br>
  [![Stars](https://img.shields.io/github/stars/TheColliery/CoalBoard?style=flat-square&logo=github)](https://github.com/TheColliery/CoalBoard/stargazers)
  [![Forks](https://img.shields.io/github/forks/TheColliery/CoalBoard?style=flat-square&logo=github)](https://github.com/TheColliery/CoalBoard/network/members)
  [![Downloads](https://img.shields.io/badge/CoalBoard_Downloads-651%2B%20%2F%2014d-orange?style=flat-square)](https://github.com/TheColliery/CoalBoard)
  [![Developers](https://img.shields.io/badge/CoalBoard_Developers-177%2B%20%2F%2014d-brightgreen?style=flat-square)](https://github.com/TheColliery/CoalBoard)

---

## 📦 How to Install the Suite

You can install any or all tools in the series (`CoalMine`, `CoalTipple`, `CoalBoard`) using the central installer located in this repository:

```bash
curl -fsSL https://raw.githubusercontent.com/TheColliery/.github/main/install.mjs -o colliery-install.mjs
node colliery-install.mjs all       # the whole suite
node colliery-install.mjs 3         # just CoalBoard
node colliery-install.mjs 1 2 3     # CoalMine + CoalTipple + CoalBoard
```

---

## 📊 Series Benchmarks

Periodic blind output-quality evaluations and regression tests. To keep them honest, this page **links to each tool's `RESULTS.md` (the single source of truth) and never copies the figures** -- so a number here cannot drift from, or be invented apart from, the measured run.

* **CoalMine** -- defect-detection recall/precision on 16 fixtures (12 with planted defects — 13 in total, one fixture plants 2 — plus 4 clean decoys), Claude Code. Results: [benchmarks/CoalMine/RESULTS.md](benchmarks/CoalMine/RESULTS.md).
* **CoalTipple** -- dynamic model escalation + output correctness across 5 domains (crypto, proof, research, legal, voice), Claude Code. Results: [benchmarks/CoalTipple/RESULTS.md](benchmarks/CoalTipple/RESULTS.md); routing-cost savings: [benchmarks/CoalTipple/ROUTING-SAVINGS.md](benchmarks/CoalTipple/ROUTING-SAVINGS.md).
* **CoalBoard** -- with-the-board-vs-without on error-not-allowed tasks, two platforms (Claude Code reliability + Antigravity cross-vendor), including the honest correlated-blind-spot ceiling. Results: [benchmarks/CoalBoard/results/](benchmarks/CoalBoard/results/).

---
## 🏛️ Repository Structure

This specific repository (`.github`) manages the following internal assets:

* **[`profile/README.md`](profile/README.md)**: The main landing page displayed on the [TheColliery Organization Profile](https://github.com/TheColliery).
* **[`install.mjs`](install.mjs)**: The unified cross-platform DLC selector installation script for all active tools in the suite.
* **[`DESIGN-PRINCIPLES.md`](DESIGN-PRINCIPLES.md)**: The **Quantum 11** performance & design guidelines governing all series projects.
* **[`hooks-safety.md`](hooks-safety.md)**: The **Phoenix 13** safety hook commandments (sandboxing, fail-silent execution).
* **[`scripts-quality.md`](scripts-quality.md)**: The CLI and script quality rules for release-gating.
* **[`DOC-PATTERN.md`](DOC-PATTERN.md)**: The shared public-doc pattern (README / SECURITY / CONTRIBUTING / PRIVACY) that keeps every repo's docs sibling-consistent.

---

<p align="center">
  <em>For the public-facing organization profile, please visit <strong><a href="https://github.com/TheColliery">github.com/TheColliery</a></strong>.</em>
</p>
