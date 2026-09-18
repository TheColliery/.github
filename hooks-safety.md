# Hook Safety and Robustness Rules

<!-- coalmine: verified 2026-09-02 · exemplar Claude Code hooks contract (args exec-form) + husky · revalidate 90d -->

> This is the full public copy, deliberately ABRIDGED—the canonical source is `CoalWorks/.claude/rules/hooks-safety.md` (moved into the CoalWorks zone home at the 2026-08-27 LAW-MOVE—"the FACTORY layer lives one level up," `AGENTS.md` §2). The source is gitignored, invisible on GitHub, so this file is the only version an outside reader can ever see. Drift is repaired in one direction, source → showcase.
>
> **Omitted here by design, not by drift** (every canonical section absent from this copy, named so a reader can tell an abridgement from a stale copy):
> - **§1.0** (the full exit-code-by-host table—user-invoked CLI vs git pre-commit/pre-push vs git post-* vs a Claude Code hook, each with a different non-zero meaning). This copy's §1/§4 state the Claude-Code-hook case only, which is the one that binds a *hook* as this file's own title promises; the fuller table is release/CLI-gate machinery, covered by `scripts-quality.md`.
> - **§8** (the phantom-slug law—project-registry state anchoring for a skill that persists per-project state keyed by a platform registry slug). An implementation-depth rule for CoalMine's own state-write path, not a general hook-safety property a reader here needs.
> - **§9** (the config-cascade clamp—consent-bearing config keys merge safer-value-wins across the global/project layers). Config-system internals, adjacent to hook safety but owned by the config machinery, not the hook contract this file states.
>
> **Not omitted, but genuinely correct as shipped and left untouched on purpose:** Phoenix #11's Node-version floor already read "Node 22+" here before the canonical source itself was corrected to match—the propagate-miss running backwards, named once at the source and not re-litigated here.

This document outlines the design standards for Node.js-based terminal hooks, git hooks, and pre/post-tool execution scripts.

## 1. Exception Isolation & Graceful Fallbacks

- **No Blocking Failures:** All hooks must wrap their core execution logic in try-catch blocks. If a hook fails (e.g., due to file system permission issues or missing dependencies), it must SWALLOW the error and exit gracefully with code `0`, producing NO output (per Phoenix #13—Zero Noise; a logged warning would violate it, and the shipped hooks are silent). It must never cause the parent process (git, CLI, or agent) to fail or abort.
- **Graceful degradation:** If external binaries (e.g., `git`, `node`, or stack-specific compilers) are missing or fail, the script should fallback to reporting mode or a safe default state rather than throwing unhandled exceptions.

## 2. Execution Latency & Performance

- **Fast Execution:** Hooks that run inline during user tasks (e.g., `PostToolUse` or pre-commit hooks) must execute in under 100ms.
- **Lazy Loading:** Avoid importing large packages or executing heavy file-system scans at the top level of scripts. Load resources dynamically only when a scan condition is met.
- **Asynchronous Operations:** Perform file writing or analytics logging asynchronously so as not to block the CLI's main thread.

## 3. Cross-Platform Directory & Shell Handling

- **Path Normalization:** Never hardcode directory separators (`/` or `\`). Always use Node's `path` library.
- **Case-Insensitive Windows Path Checks:** Remember that Windows paths are case-insensitive. When comparing paths on `win32` platform (e.g., checking if a file is already in a list of touched files), normalize them to lowercase to avoid duplicate detections.
- **Prefer the no-shell exec form over escaping:** When a hook spawns a child process with a dynamic path, pass arguments as an ARRAY to a no-shell spawn (Node `spawn(cmd, [args])` without `shell: true`; or a hook's `args: []` exec form)—a path containing quotes, `$`, or backticks then never reaches a shell parser. Per-platform hand-escaping (`cmd.exe` double-quotes vs PowerShell backticks vs bash single-quotes) is the FALLBACK only when a shell is unavoidable; it is error-prone and a common injection vector.

## 4. Output Formatting & Verbosity

- **No Log Clutter:** Produce NO output during normal operation—the hooks are silent (Phoenix #13). The ONLY sanctioned outputs are the three channels named in commandment #13 (Zero Noise)—the Stop hook's structured JSON block when an action is required, and conductor context injection on SessionStart or UserPromptSubmit; never emit incidental logs, warnings, or status lines.
- **Clear Indicators:** When a hook DOES emit on one of those sanctioned channels, use a clean, standard prefix (e.g., `[CoalMine]`) so the user knows the source.

### 4.1 The diagnostic escape hatch—OPT-IN, and never a fourth channel

**The problem this answers is created by our own design, not by a defect: a fail-silent component is undebuggable by construction.** Phoenix #4 guarantees exit 0 on every bail path and Phoenix #13 guarantees silence, so a hook that crashed, a hook whose guard refused, and a hook that correctly found nothing are **indistinguishable from outside**. §7's hermetic tests answer this for code we are actively changing; they do nothing for a user on a machine we cannot reach.

**The hatch, and its whole contract:**
- **OFF unless explicitly switched on** by the operator—an env var read once at entry (`COALMINE_DEBUG` or the skill's own equivalent). Absent or empty ⇒ byte-for-byte today's behaviour. A default-on hatch is not a hatch, it is a fourth channel.
- **It writes to a FILE, never to stdout/stderr**—under the tool's own namespace, `~/.claude/coal/<skill>/` (Phoenix #10's sandbox root, already the home for this skill's other state). **A `node:diagnostics_channel` publish is the SECONDARY route and its silence is CONDITIONAL, not structural**—a hook does not control who is in its own process, and `NODE_OPTIONS=--require <preload>` reaches any `node` child, so an operator, a wrapper, or a CI image can install a subscriber this hook never asked for and cannot cheaply detect. That subscriber is then free to print what it receives. **Phoenix #13 is not breached by that**—the hook still emits nothing, and a third party printing its own data is not our emission—but the hatch's own promise is narrower than it read: on the channel route we guarantee that WE stay silent, never that the DATA stays inside the process. So the FILE route is the one whose containment the hatch can actually keep; reach for the channel only where a subscriber is the point, and never state its silence as a property of the hatch. **Phoenix #13 is UNBREACHED and stays unbreached: the sanctioned-channel list in §6 does NOT grow.** stdout and stderr remain exactly as silent with the hatch on as with it off—that is the property that makes this an escape hatch rather than a logging feature, and any proposal that prints is out of scope of this section, not a variant of it.
- **§1/§4 above are untouched.** The hatch never influences an exit code. A Claude Code hook still exits 0 on every path. A hatch that changed an exit code would convert a debugging aid into a behaviour change, which is the one thing it must never be.
- **Fail-silent still binds the hatch itself.** Every hatch write is inside the same `try {} catch {}` as the code it observes—an unwritable home, a full disk, or a denied path must degrade to silence, never to a crash. The hatch may not be the thing that kills the host.
- **Zero garbage—name the collector, do not assume one.** Whatever the hatch writes is the SKILL's own litter and the skill collects it: the same sweep that already reaps that skill's temp extends to the hatch's files, on the same staleness cutoff. **If a skill adds a hatch and names no collector, it has added a leak**—the hatch is not exempt from Phoenix #1 because it is opt-in, since the operator who switched it on is exactly the person who will forget it is on.

**FOURTH TENSE:** nothing enforces any of this today. No shipped hook carries a hatch, and no gate checks that a future one is env-gated, writes to a file rather than a stream, or has a named collector. This section is the contract a hatch must meet **if** one is built; it is not a report that one exists.

## 5. Localization & Adaptive Language

- **Adaptive Language:** Hooks that output user-facing warnings or prompt the user must detect the user's language and adapt dynamically.
- **Heuristic-Based Language Detection:** If the environment context is not passed directly, detect language by scanning project documentation (e.g., `AGENTS.md`, `MEMORY.md`, `README.md`) for regional characters (e.g., Thai Unicode characters `\u0e00-\u0e7f`). If detected, display messages in the local language; otherwise, default to English.

## 6. Phoenix Canary—13 Commandments

All CoalMine hooks and canary skill scripts must conform to the Phoenix Canary philosophy. A Phoenix Canary is immortal, zero-footprint, and self-sufficient. Each commandment maps to a measurable property:

| # | Commandment (TH) | Principle | Implementation Requirement |
|---|---|---|---|
| 1 | ไม่ขับถ่าย | **Zero Garbage** | Delete every temp file on completion or failure. Use `finally` blocks to guarantee cleanup. |
| 2 | ไม่กินอาหาร | **Zero Dependencies** | Use only Node.js built-in modules (`fs`, `path`, `os`). No `npm install` required to run. |
| 3 | ไม่หายใจ | **Zero Latency** | `PostToolUse` hooks must add ≤5ms of work beyond interpreter startup on the happy path (no file match); total wall-clock ≤100ms including a scan. Node startup itself (~50–80ms) dominates—budget the work, not the process. |
| 4 | ไม่มีทางตาย | **Fail-silent** | Wrap all logic in `try { main(); } catch {}`; never set a non-zero exit code. Let the process exit naturally—do NOT call `process.exit()`, it can truncate pending stdout writes (the Stop hook's JSON nudge). Never crash the parent agent. |
| 5 | ไม่สืบพันธุ์ | **Zero Side-effects** | Never spawn child processes, write to global config, or trigger other hooks as side effects. |
| 6 | ไม่มีตัวตน | **Stateless** | No global state between invocations. Session state lives in temp files scoped by `session_id`, cleaned on stop. |
| 7 | ไม่พึ่งพาใคร | **Offline-capable** | No network calls ever. All lookups must be local filesystem only. |
| 8 | ไม่กลายพันธุ์ | **Deterministic** | Same input → same output, always. No random IDs, no time-based branching outside timestamp stamps. |
| 9 | ไม่จำกัดร่าง | **Portable** | Runs on Windows, macOS, Linux without modification. Use `path.join()`, `os.homedir()`, `os.tmpdir()`. |
| 10 | ไม่ล้ำเส้น | **Sandbox Compliant** | Never read or write outside `os.tmpdir()` (session state) and `os.homedir()/.claude/` (mode config)—EXCEPT reading the project config from the project git root: `<project>/.<agent-dir>/coal/<skill>.json` (own-agent-dir → `.claude` → `.agents` → `.gemini`, first-found-wins), LEGACY root dotfile (`.coalmine.json`/`.coaltipple.json`/`.coalboard.json`) still read until the flock's next MAJOR. (Writes stay strictly inside the two sandbox roots.) |
| 11 | ไม่แก่ตัว | **Future-proof** | Use stable Node.js built-ins only. No deprecated APIs. Compatible with Node 22+ (the maintained LTS line the repos' CI tests, 22 · 24; 18/20 are EOL). |
| 12 | ไม่ต้องการผู้ดูแล | **Self-healing** | On any unexpected state (corrupt temp file, missing session ID), silently skip and return cleanly. |
| 13 | ไม่ส่งเสียง | **Zero Noise** | Hooks output NOTHING to stdout/stderr except the three sanctioned channels: the Stop hook's structured JSON block when an action is required, and conductor context injection on SessionStart or UserPromptSubmit (agent-context stdout—the shipped CB/CT/CW conductors). Everything else is silent. |

## 7. Hermetic Hook Testing

<!-- coalmine: verified 2026-06-13 · exemplar husky/lefthook isolation tests + scripts/lib/hooks.test.mjs · revalidate 90d -->

Fail-silent code hides its own breakage—a hook that crashes looks identical to a hook that found nothing. Every behavior change to a hook therefore ships with a hermetic spawn test:

- Spawn the real hook file as a child process with fixture stdin—never extract its logic into an importable function just to make testing easier.
- Sandbox the environment: point `TEMP`/`TMP`/`TMPDIR` and `USERPROFILE`/`HOME` at a throwaway directory so real session state and kill-switch files can never affect the test.
- Assert all three observable surfaces: exit code 0 on every path; stdout/stderr silent except the sanctioned channels (Phoenix #13); and the expected state effect (file written, file cleaned, or nothing touched).
- Zero-dep (`node:test` only, per scripts-quality.md section 2) and enumerated explicitly in the gate hooks.

Exemplar: husky and lefthook keep isolation test suites despite tiny codebases; CoalMine's own `scripts/lib/hooks.test.mjs` is the in-repo reference implementation.

