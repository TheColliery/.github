# Verifying {{REPO_NAME}}

{{REPO_NAME}} is verified under the same framework as its TheColliery siblings — Phoenix-13 hooks, reproducible builds, and event-driven independent scans. {{THREAT_MODEL_SUMMARY}}

## Reporting a Vulnerability

Report a security issue in this repo through GitHub's private vulnerability reporting — [Security → Report a vulnerability](https://github.com/{{ORG}}/{{REPO_NAME}}/security/advisories/new) — never a public issue; enabled and verified live at press. In scope: {{IN_SCOPE_SUMMARY}}. This is a one-person-maintained project: expect the report to be read and acknowledged, triaged against the scope above, and disclosed once a fix ships, with no fixed response-time SLA. A public GitHub issue remains the right channel for an ordinary, non-security bug.

## Commit & Tag Signatures

Release tags and maintainer commits are SSH-signed (`gpg.format=ssh`); GitHub shows the Verified badge on them. Automated Dependabot / CI commits are unsigned by design (they carry no maintainer key), so verify a signed release tag — the artifact a release consumer trusts:

```bash
echo "* ssh-ed25519 {{SSH_PUBLIC_KEY}}" > {{REPO_NAME}}_signers
git config gpg.ssh.allowedSignersFile ./{{REPO_NAME}}_signers
git tag -v "$(git describe --tags --abbrev=0)"
```

## Dist Integrity

`plugin/` is generated, never hand-edited. `node scripts/build-plugin.mjs` reproduces it from source; `node scripts/verify.mjs` byte-checks dist-sync in BOTH directions (stale file and source-less orphan both fail) plus manifests, factory-config-vs-schema, and version pins; `node scripts/test.mjs` runs the zero-dependency suite with an explicit file list. Zero dependencies — no lockfile, nothing to `npm audit`.

<!-- version-transition: SkillSpector scan — re-scan is event-driven (a new SkillSpector version or a genuinely new attack surface, maintainer-commanded), NOT per release; record the version/score/date/commit here only after a real scan. -->
## Independent Scanning — NVIDIA SkillSpector

Last scan: {{REPO_NAME}} **{{SCANNED_VERSION}}** dist (`plugin/`), on **{{SCAN_DATE}}**, with [NVIDIA SkillSpector](https://github.com/NVIDIA/skillspector) **{{SCANNER_VERSION}}** (self-reported — the tool ships no tagged releases), static stage (`--no-llm`, the documented FP-prone baseline). {{SCAN_RESULT_SUMMARY}}

Re-scan stays event-driven (a new SkillSpector version or a genuinely new attack surface), not per release — this pins the last version actually verified.

## Structural Safety

{{STRUCTURAL_SAFETY_BULLETS}}

Honest scope: these measures are the series' data-safety discipline — injection-safe, path-safe, snapshot-reversible deletes, scrubbed output, offline code, opt-in zero-transmission (where applicable). No formal verification, no crypto-at-rest, no "military-grade" claim.
