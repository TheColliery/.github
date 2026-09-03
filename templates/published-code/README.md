<div align="center">

# {{EMOJI}} {{REPO_NAME}}

> {{ONE_SENTENCE_TAGLINE}}

**{{ONE_SENTENCE_WHAT_IT_DOES}}**

![version](https://img.shields.io/github/v/tag/{{ORG}}/{{REPO_NAME}}?label=version&color=blue)
![license](https://img.shields.io/badge/license-{{LICENSE_BADGE}}-blue)
![status](https://img.shields.io/badge/status-{{STATUS}}-brightgreen)

[Changelog](CHANGELOG.md) · [Security](SECURITY.md) · [Privacy](PRIVACY.md) · [Releases](https://github.com/{{ORG}}/{{REPO_NAME}}/releases)

</div>

<!-- Add a Table of Contents once the reader cannot see the whole section list in one screen. -->

## What it is

<!-- 2-4 sentences: the metaphor + the core idea. For a router/board, a small table of the core decision. -->

{{WHAT_IT_IS}}

## How it works

<!-- The mechanism. One table beats three paragraphs. -->

{{HOW_IT_WORKS}}

## Compatibility

<!-- A matrix for a cross-agent tool; an explicit [!CAUTION] + reason for a single-platform tool.
     Headline tier per platform is ONE of exactly two words: `validated` (we build/test/run it here
     daily — Claude Code) or `works with` (it installs and runs; documented, not run by us). Never
     invent a third word. A works-with row links its own problem-report channel. -->

| Platform | Support |
|---|---|
| Claude Code | {{TIER}} |

## Install

```bash
{{INSTALL_COMMAND}}
```

{{OTHER_AGENT_INSTALL_PATH}}

## Commands

<!-- Grep anchor -- no emoji on this heading. Every invocable thing, including stats and update. -->

| Command | What it does |
|---|---|
| `{{COMMAND}}` | {{WHAT_IT_DOES}} |

## Configure

Every tool supports TWO config levels — a global `~/.claude/.{{TOOL_KEY}}.json` and a per-project `.{{TOOL_KEY}}.json` override (project wins) — so a globally-installed skill can be tuned or shut off per project (`{{OFF_SWITCH_KEY}}: false`).

| Key | Default | What it does |
|---|---|---|
| `{{KEY}}` | `{{DEFAULT}}` | {{WHAT_IT_DOES}} |

Full key reference: `scripts/lib/config-schema.mjs` + the commented `platform-configs/` template.

## Permissions

<!-- Grep anchor -- no emoji on this heading. 2-4 plain-language lines. -->

{{REPO_NAME}} {{WHAT_IT_REQUESTS}}. It never {{WHAT_IT_NEVER_REQUESTS}}. Workers get strictly less than main — no spawning, no prompting you directly.

[Permission Matrix](https://github.com/TheColliery/.github/blob/main/PERMISSION-MATRIX.md)

## Benchmark

{{BENCHMARK_ONE_LINE_HONEST_FRAMING}} — see [`.github/benchmarks/{{REPO_NAME}}/`](https://github.com/TheColliery/.github/tree/main/benchmarks/{{REPO_NAME}}).

## Part of TheColliery

{{REPO_NAME}} is {{ROLE_IN_SERIES}}:

- [CoalMine](https://github.com/HetCreep/CoalMine) — quality canary suite
- [CoalTipple](https://github.com/TheColliery/CoalTipple) — model/effort router
- [CoalBoard](https://github.com/TheColliery/CoalBoard) — multi-agent consensus board
- [CoalHearth](https://github.com/TheColliery/CoalHearth) — session warm-resume
- [CoalFace](https://github.com/TheColliery/CoalFace) — fan-out discipline
- [CoalWash](https://github.com/TheColliery/CoalWash) — memory washer/defragmenter
- [CoalLedger](https://github.com/TheColliery/CoalLedger) — docs-health canary suite

Install one and it stands alone; {{COMPOSE_PROMISE}}. Every tool in the series shares Phoenix-13 hooks, a single-source-of-truth config, and a no-overkill design bar.

{{OFFLINE_CLAIM_IF_TRUE}}

## License

{{LICENSE_STATEMENT}} See [LICENSE](LICENSE).
