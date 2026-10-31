# Security policy

**Report a vulnerability privately, never in a public issue.** Open the repository's **Security** tab and choose **Report a vulnerability**. For the `TheColliery/.github` repository itself, that is [Report a vulnerability](https://github.com/TheColliery/.github/security/advisories/new); for any other repository, open that repository's own Security tab. Private vulnerability reporting is on for every public repository in this organization. There is no e-mail address for security reports.

**What to expect:** the report is read and acknowledged, triaged against the repository's scope, and disclosed once a fix ships as a GitHub security advisory. This is a small team, so there is no fixed response time. A public issue stays the right place for an ordinary, non-security bug.

A repository's own `SECURITY.md` wins where it has one: it names that project's scope and how it is verified.

## What counts as a vulnerability

The shipped code is in scope: what this project installs and runs for a user, including anything it reads from a repository or file the user did not write. This repository's own tooling (its CI workflows, its release and build scripts, and its test harness, as a maintainer runs them on the maintainer's checkout) is welcome to report on, and a flaw in it is fixed as hardening. Either part earns a published advisory only when an outsider can reach the flaw through input they control: a repository they clone, a file they send, a pull request from a fork, or a network response. A flaw that only the maintainer or the user feeds does not get one. Where it is unclear whether an outsider can reach a flaw, it counts as reachable until the maintainers have decided.
