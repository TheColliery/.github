# 🗂️ TheColliery — Global Configuration & Landing Page (.github)

This repository houses the global configuration, landing page profile, central installation scripts, and shared developer doctrines for **[TheColliery](https://github.com/TheColliery)** organization.

---

## ⛏️ Active Repositories

* **[CoalMine](https://github.com/HetCreep/CoalMine)**: Quality-canary skills suite for AI coding agents.
  <br>
  [![Stars](https://img.shields.io/github/stars/HetCreep/CoalMine?style=flat-square&logo=github)](https://github.com/HetCreep/CoalMine/stargazers)
  [![Forks](https://img.shields.io/github/forks/HetCreep/CoalMine?style=flat-square&logo=github)](https://github.com/HetCreep/CoalMine/network/members)
  [![Downloads](https://img.shields.io/badge/CoalMine_Downloads-1.3k%2B%20%2F%2014d-orange?style=flat-square)](https://github.com/HetCreep/CoalMine)
  [![Developers](https://img.shields.io/badge/CoalMine_Developers-340%2B%20%2F%2014d-brightgreen?style=flat-square)](https://github.com/HetCreep/CoalMine)
* **[CoalTipple](https://github.com/TheColliery/CoalTipple)**: Model and effort router with budget protection locks.
  <br>
  [![Stars](https://img.shields.io/github/stars/TheColliery/CoalTipple?style=flat-square&logo=github)](https://github.com/TheColliery/CoalTipple/stargazers)
  [![Forks](https://img.shields.io/github/forks/TheColliery/CoalTipple?style=flat-square&logo=github)](https://github.com/TheColliery/CoalTipple/network/members)
  [![Downloads](https://img.shields.io/badge/CoalTipple_Downloads-667%2B%20%2F%2014d-orange?style=flat-square)](https://github.com/TheColliery/CoalTipple)
  [![Developers](https://img.shields.io/badge/CoalTipple_Developers-132%2B%20%2F%2014d-brightgreen?style=flat-square)](https://github.com/TheColliery/CoalTipple)

---

## 📦 How to Install the Suite

You can install any or all tools in the series (e.g., `CoalMine`, `CoalTipple`) using the central installer located in this repository:

```bash
curl -fsSL https://raw.githubusercontent.com/TheColliery/.github/main/install.mjs -o colliery-install.mjs
node colliery-install.mjs all
```

---

## 📊 Series Benchmarks

We run periodic, blind output quality evaluations and regression tests across our suite.

### 1. CoalMine (rot-canary Evaluation)
Evaluates code defect detection recall and precision on 16 test fixtures (12 with planted defects, 4 clean decoys).

**Overall Performance (Run: 2026-06-13, Model: Antigravity):**
| Metric | Value |
|---|---|
| **Recall (Planted defects found)** | **100%** (13/13) |
| **Precision (True positive rate)** | **100%** (13 true / 0 false) |
| **False Positives on Clean Decoys** | **0%** (0/4 decoys) |
| **Severity Judgment Accuracy** | **92%** (12/13) |

**Cross-Engine Blind Comparison:**
| Engine / Model | Recall | Precision | Decoy FPs | Severity Accuracy |
|---|---|---|---|---|
| `claude-fable-5` (Author baseline) | 13/13 (100%) | 100% | 0/4 | 13/13 (100%) |
| **`Antigravity` (Blind evaluation)** | **13/13 (100%)** | **100%** | **0/4** | **12/13 (92%)** |

### 2. CoalTipple (Output-Quality Escalation)
Evaluates dynamic model escalation and output correctness across five high-complexity domains (Crypto, Proof, Research, Legal, Voice).

**Escalation Success & Correctness (Run: 2026-06-15, CoalTipple v1.0.3, on Claude Code):**
| Main Model | Routing Escalation | Task Deliverables (T1-T5) | Pass Rate |
|---|---|---|---|
| `Haiku` | -> `Sonnet` (+1 rung) | T1, T2, T3, T4, T5 | **100%** (5/5) |
| `Sonnet` | -> `Opus` (+1 rung) | T1, T2, T3, T4, T5 | **100%** (5/5) |
| `Opus 4.6` | -> Self-inline (top tier) | T1, T2, T3, T4, T5 | **100%** (5/5) |
| `Opus 4.7` | -> Self-inline (top tier) | T1, T2, T3, T4, T5 | **100%** (5/5) |

*Total: 20/20 PASS deliverables generated correctly (Fable/reasoning disabled, Opus = top tier). Source: [benchmarks/CoalTipple/RESULTS.md](benchmarks/CoalTipple/RESULTS.md).*

---

## 🏛️ Repository Structure

This specific repository (`.github`) manages the following internal assets:

* **[`profile/README.md`](profile/README.md)**: The main landing page displayed on the [TheColliery Organization Profile](https://github.com/TheColliery).
* **[`install.mjs`](install.mjs)**: The unified cross-platform DLC selector installation script for all active tools in the suite.
* **[`DESIGN-PRINCIPLES.md`](DESIGN-PRINCIPLES.md)**: The **Quantum 11** performance & design guidelines governing all series projects.
* **[`hooks-safety.md`](hooks-safety.md)**: The **Phoenix 13** safety hook commandments (sandboxing, fail-silent execution).
* **[`scripts-quality.md`](scripts-quality.md)**: The CLI and script quality rules for release-gating.

---

<p align="center">
  <em>For the public-facing organization profile, please visit <strong><a href="https://github.com/TheColliery">github.com/TheColliery</a></strong>.</em>
</p>
