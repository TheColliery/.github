# Contributing to {{REPO_NAME}}

{{REPO_NAME}} is {{ONE_LINE_WHAT_IT_IS}} of the [TheColliery](https://github.com/TheColliery) series. Issues, bug reports, and pull requests are welcome.

---

## 🤝 Proposing a Change

1. **Open an issue first** describing the problem, gap, or proposed feature (especially for a change to `SKILL.md`, where one exists).
2. Make your code changes and keep the verification gates green (below).
3. Validate the change against a real fixture — for a routing/prompt-shaped change, **dogfood it live** on Claude Code and document the behavior in your PR description.

A first-time contributor: the gate commands in the next section ARE the getting-started steps — clone, install nothing extra (Phoenix #2), run the green gate. An issue labelled for newcomers is the entry point where one exists.

---

## 💻 Developing & Testing

{{REPO_NAME}} is **zero-dependency** (Node.js built-ins only, Node 22+). No `npm install` is required.

Keep the verification gates green before and after making edits:

```bash
node scripts/build-plugin.mjs   # re-sync the plugin distribution from source
node scripts/verify.mjs         # validates config schemas, dist-sync, and repo consistency
node scripts/test.mjs           # runs the zero-dependency test runner (node --test)
```

### Development Rules
* **{{SSOT_FILE}} is the Single Source of Truth** for {{SSOT_CONTENT}} — edit there, then rebuild `plugin/`. Do not hand-edit the generated distribution.
* **Synchronize `plugin/`:** rebuild the distribution after modifying source, hooks, or the manifest.
* **Add unit tests:** every shared helper carries a matching `*.test.mjs`.
* **Keep hooks Phoenix-pure:** zero dependencies, fail-silent (wrap in try/catch, never exit non-zero), 100% local — hooks ship a hermetic spawn test.
* **Language & tone:** shipped source files and documentation stay in English.

---

## 🖥️ Supported Platforms

{{PLATFORM_SUPPORT_STATEMENT}} — mirror the README's Compatibility section exactly; do not restate a different claim here.

---

## 🗂️ Project Layout

| Path | Purpose |
|---|---|
| {{PATH}} | {{PURPOSE}} |

---

## 🚀 Releasing (Maintainers)

Bump version in `.claude-plugin/plugin.json` → add a CHANGELOG entry → ensure `verify.mjs` and `test.mjs` pass → commit → create a signed git tag (`vX.Y.Z`) → push `--follow-tags` → create a GitHub Release (stable tags only).

---

## 📄 License & Conduct

Contributions are licensed under this repo's own outbound license — see [LICENSE](LICENSE). No separate CLA: sending a PR licenses it the way the project already ships. Please assume good faith and be respectful, per [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Report security issues per [SECURITY.md](SECURITY.md).

**Response time:** best effort by a solo maintainer; no SLA is promised. When a target window is set it is stated here.
