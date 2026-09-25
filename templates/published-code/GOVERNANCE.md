# Governance

One maintainer decides. Every TheColliery repository is maintained by one person, who holds the final word on what is merged, released and retired. There is no committee and no vote.

## How a change is accepted

A change reaches the default branch only after the repository's own gates pass: the CI workflow (the test suite on every supported platform), CodeQL, markdownlint and, for a skill repository, the build-and-verify scripts that keep the shipped distribution identical to its source. Branch rulesets forbid force-pushes and deletions on the default branch and require those checks. Dependabot's patch and minor updates merge on green checks through a separate workflow that no other author can trigger; a major update waits for the maintainer.

## Who writes the changes

AI agents author most of the code, tests and documentation. They work inside the maintainer's own environment, with credentials the maintainer holds, under the gates above and the maintainer's review; the `Co-Authored-By` trailer on a commit records which model wrote it, and the signing key records who let it ship. An agent never widens its own permissions, installs an integration or changes a repository setting; those are the maintainer's clicks.

## Where to report

Defects and questions go to the repository's issue tracker ([SUPPORT.md](SUPPORT.md)), security reports to the channel in [SECURITY.md](SECURITY.md), conduct concerns to [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

The maintainer's internal working rules are private. This file is the public summary of who decides and how, not a copy of them.
