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

<!-- version-transition: SkillSpector scan — the re-scan is meant to fire on one event (E2: this repo's own version bump, gated by a per-repo baseline diff), but that machinery is wired in no room yet, so today a re-scan is run by hand; a genuinely new attack surface is a second trigger, also by hand. (E1, a weekly new-SkillSpector-version watcher, was retired on the owner's word on 2026-09-26.) Fill {{SCANNER_TAG_RELATION}} with one of: upstream's tag `vX.Y.Z` (the commit is that tag's) · N commits after upstream's tag `vX.Y.Z` · N commits before upstream's first tag, `v2.5.0`. Record the version/score/date/commit here only after a real scan. -->
## Independent Scanning — NVIDIA SkillSpector

Last scan: {{REPO_NAME}} **{{SCANNED_VERSION}}** dist (`plugin/`), on **{{SCAN_DATE}}**, with [NVIDIA SkillSpector](https://github.com/NVIDIA/skillspector) **{{SCANNER_VERSION}}** (self-reported version string; scan pinned to commit `{{SCANNER_COMMIT}}`, {{SCANNER_TAG_RELATION}}), static stage (`--no-llm`, the documented FP-prone baseline). {{SCAN_RESULT_SUMMARY}}

A re-scan is run when this repo's own version bump calls for it (the automatic baseline-diff trigger is planned and not yet wired) or on a genuinely new attack surface, not on every release — this pins the last version actually verified.

## Structural Safety

{{STRUCTURAL_SAFETY_BULLETS}}

Honest scope: these measures are the series' data-safety discipline — injection-safe, path-safe, snapshot-reversible deletes, scrubbed output, offline code, opt-in zero-transmission (where applicable). No formal verification, no crypto-at-rest, no "military-grade" claim.
