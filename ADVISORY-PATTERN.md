# Advisory Pattern (TheColliery)

> The shared shape for every GitHub **repository security advisory** a series room drafts: whether a finding gets one at all, the fields GitHub needs before a CVE can be requested, the body, and who does what. Sibling of [RELEASE-PATTERN.md](./RELEASE-PATTERN.md) (the shape of a Release) and companion to [DOC-PATTERN.md](./DOC-PATTERN.md), whose SECURITY.md section 2 already says that a fixed vulnerability is announced as an advisory and what `SECURITY.md` keeps of it; this file does not restate that section.
> Born from a measured miss (2026-11-16, owner order UMB4-033, card BB-489): the draft `GHSA-mx8v-3554-mxjj` for CoalWash reached the owner with no severity, no CVSS vector and no CWE, and GitHub refused the CVE request; nobody had checked it against the owner's own rule for which findings get an advisory at all.

<!-- coalmine: verified 2026-11-16 · exemplar GitHub Docs, repository security advisories (the six pages in "What GitHub says", each read 2026-11-16) · revalidate 90d -->
## The gate: does this finding get an advisory at all

**Ask and answer this BEFORE any draft is written.** A finding that fails it has no advisory and no `SECURITY.md` write-up; it goes to the room's triage file and to its `CHANGELOG.md` line, and nothing else. *(The owner's rule, card BB-316 (4), 2026-10-28: an advisory only for a finding an outsider can really attack, at any severity; the SECURITY.md row says the same in one sentence.)*

| Question | Answer that passes |
|---|---|
| Can an OUTSIDER make it happen? | Yes, through data the outsider controls: a repository the user clones, a file the user is sent, a network answer. A path where only the user supplies the data (their own configuration, a command they type) does not count. |
| Is it unclear? | An unclear case counts as attackable and goes to CoalBoard to rule. It is never dropped on a guess. |
| Where is the reason written? | In the room's triage file, for every finding, by the room's reviewer: the attack route if it passes, the reason it fails if it does not. A draft with no triage reason behind it has not passed the gate. |
| Does severity matter? | No. A LOW finding an outsider can trigger gets an advisory; a HIGH finding only the user can trigger does not. |

The gate applies to every finding from a Deep Scan in every repo, and to any other fixed vulnerability a room would announce.

## What GitHub says (read 2026-11-16)

Every rule below is cited to the page it comes from, read on 2026-11-16; none is from memory. GitHub's pages carry no last-updated date, so the date a seat read them is the only date there is; re-read before relying on a rule after the stamp above expires.

| Rule | Page |
|---|---|
| The form asks a title, a CVE identifier choice, a description ("including its impact"), affected products (ecosystem, package name, affected and patched versions, vulnerable functions), a severity, weaknesses (CWE), and optional credits. The page says "the fields marked with an asterisk are required" and does not say which they are. | [Creating a repository security advisory](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/fix-reported-vulnerabilities/create-repository-advisory) |
| Severity is a dropdown, or "Assess severity using CVSS" with GitHub's calculator ("GitHub calculates the score according to the Common Vulnerability Scoring System Calculator"). Credit types are Finder, Reporter, Analyst, Coordinator, Remediation developer, Remediation reviewer, Remediation verifier, Tool and Sponsor; a credited person gets a notification, and their username is public once they accept and the advisory is published. | the same page |
| Over REST, a create call requires `summary`, `description` (the response schema lists 65,535 characters as its length limit) and `vulnerabilities[]` with `package.ecosystem`; `cwe_ids`, `credits`, `vulnerable_version_range` and `patched_versions` are optional; "You must choose between setting" `severity` or `cvss_vector_string`. The ecosystems include `other`. | [REST API endpoints for repository security advisories](https://docs.github.com/en/rest/security-advisories/repository-advisories) |
| A CVE is requested by `POST .../security-advisories/{ghsa_id}/cve`, for a public repository only, by a security manager or administrator of it. | the same page |
| "GitHub is a CVE Numbering Authority (CNA) and is authorized to assign CVE identification numbers." "GitHub usually reviews the request within 72 hours." "If your security advisory is eligible for a CVE, GitHub will reserve a CVE identification number." Requesting one "doesn't make your security advisory public"; GitHub publishes the CVE details after the advisory is public. It cannot assign one where another CNA covers the project. | [Repository security advisories (concepts), CVE identification numbers](https://docs.github.com/en/code-security/concepts/vulnerability-reporting-and-management/repository-security-advisories) |
| Publishing needs a draft with the affected versions. "add a fix version ... prior to publishing", or Dependabot alerts users "without offering any safe version to update to". Publishing deletes the temporary private fork. | [Publishing a repository security advisory](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/fix-reported-vulnerabilities/publish-repository-advisory) |
| A range is written as an operator, one space and a version (`>=`, `>`, `=`, `<=`, `<`); a lower bound first, then a comma and one space, then the upper bound; one product section per range. A patched version "cannot be smaller than the largest number in the" range, and `< n` is only for an `n` that is not vulnerable. A bare lower bound is not recommended (the implicit upper bound is infinity). A version with letters counts the letters as a pre-release marker. | [Best practices for writing repository security advisories](https://docs.github.com/en/code-security/tutorials/fix-reported-vulnerabilities/write-security-advisories) |
| The Advisory Database "supports both CVSS version 3.1 and CVSS version 4.0" (and 3.0 for an imported CVE); a maintainer's CVE uses "the CVSS version assigned by the maintainer, which can be version 3.1 or 4.0". | [About the GitHub Advisory Database](https://docs.github.com/en/code-security/security-advisories/working-with-global-security-advisories-from-the-github-advisory-database/about-the-github-advisory-database) |

**What GitHub does not say, and the house's bar above it.** The pages do not name severity, a CVSS vector or a CWE as a condition of a CVE request. GitHub refused the request on `GHSA-mx8v-3554-mxjj`, which had none of the three (BB-489). So the house treats all three as REQUIRED before a draft is signed, even where GitHub's own page calls them optional. This is a house rule written from one refusal, not a GitHub requirement; if GitHub states its condition, this line is rewritten to it.

## The fields (all of them set on the draft, before the CVE request)

| Field | The house rule | Why / where it came from |
|---|---|---|
| Title (`summary`) | One plain sentence saying what an outsider could make happen, as the Summary section does. | Every house advisory has one. |
| Severity and CVSS | Set the CVSS **vector**, `cvss_vector_string`, never the severity dropdown alone; GitHub derives the severity from the vector. **CVSS 3.1.** | All 65 house advisories that have a vector use 3.1, none 4.0 (read 2026-11-16, measured below). A mixed series would make its scores incomparable. GitHub supports 4.0 (page above), so moving is possible, but as one series-wide decision for all rooms and a rescore of the published ones, never one room at a time. Score each metric from the finding's own trigger, and say why in the body in a `CVSS reasoning` line (four house advisories already do). |
| CWE (`cwe_ids`) | At least one. Choose the weakness the FIX removes, from the [CWE list](https://cwe.mitre.org/index.html); several only when the finding really is several. | 11 of the 64 published advisories have none (read 2026-11-16, below). |
| Ecosystem and package | Ecosystem `other`; package name the room's lower-case repository name. | 66 of 66 use `other` and the repository name. The rooms ship through plugin marketplaces and file copies (the README install rows), not a package registry, so no registry ecosystem fits. |
| Affected range (`vulnerable_version_range`) | The first version that carries the defect, up to the last version before the fix, in GitHub's syntax: `>= first, < fixed` (or `<= last` when the fix is the next version after it). A single version is `= n`. When the first affected tag was not found by reading each tag, the body says how the range was derived. | GitHub's syntax page above; the house practice in `GHSA-x5wj-m7xx-8895`, whose body says "the tags between were not each read". |
| Patched version (`patched_versions`) | The one version that carries the fix, as its release tag names it. Never empty: no house advisory leaves it empty. | The publish page above (Dependabot offers a safe version only if one is set). |
| Credits (`credits`) | A person or tool account that found, reported or fixed it, with its credit type, gets the field; the person is notified and is public only when they accept. The maintainer's own review, or a scanner with no account, is a `**Credit:**` line in the body. Either way the advisory says who found it. | 0 of 66 use the field, and 42 of 66 bodies carry no credit at all (read 2026-11-16). |
| CVE (`cve_id`) | Leave it empty: the CVE is requested after the draft is signed (the seats below), and GitHub fills the number itself. | DOC-PATTERN SECURITY.md row 2; 0 of 66 carry a number today. |
| Description | The body below, at most 65,535 characters. | The REST page above. |

## The body

Headings are `###`, in this order. The first four are in all 66 house advisories; the rest are the house's own variants made one shape.

| # | Heading | What it holds |
|---|---|---|
| 1 | `### Summary` | One short paragraph in plain words: what could happen, to whom, because of what, in which versions. No jargon an affected user would have to look up. |
| 2 | `### Details` | The mechanism: the code path, the file and function, what the outsider's data does there, and what the fix changes (the commits, by short hash). Data verbatim from the CHANGELOG entry and the fix commit; never a number nobody re-ran. |
| 3 | `### Proof of concept` | What was run or read to show it, and where the test lives. A finding that was only read says so in a sentence ("found by reading ... at the tags; not run as a witness"). Never a working exploit for a finding that is still unpatched. |
| 4 | `### Impact` | What is lost or exposed, and what is NOT, as two plain lists when both are true. A **limit no version closes** stays here when there is one. The `**CVSS reasoning:**` line and the CWE name (for example "CWE-78, OS Command Injection") sit at the end. |
| 5 | `### Who is affected` | The trigger in one line (`**Triggered by:**` what the outsider controls and what the user does), the platform or setting it needs, then `**Affected versions:**` and `**Patched version:**` copied from the fields, so the text and the fields cannot differ (the checker compares them). Missing in the house today: only 40 of 66 name the affected versions in the body and 20 the patched one. |
| 6 | `### Patches` | The fixed version and what it does differently, in the reader's words. |
| 7 | `### Workarounds` | What a user who cannot update can do, or "None. Upgrade." in those words. Never left out: GitHub's own page lists it. |
| 8 | `### What is not known` | Only when something is unproven (a step no test showed, a platform not tried). Named, never papered over; 8 house advisories already carry it. |
| 9 | `### References` | The `CHANGELOG.md` entry, the release tag, the fix commit, each as a link. **No house advisory has this section** (0 of 66); GitHub's description rule names references. |
| - | `**Credit:**` | One closing line when the credit is not in the field. |

Write in the house's plain style ([DOC-PATTERN.md](./DOC-PATTERN.md)): short sentences, no marketing word, no "we are pleased", no alarm. A reader who is a user of the tool must be able to answer three questions from the first screen: am I affected, what do I do, and how bad is it.

## The seats

The same roles the house gives a Release (a drafter, a checker, a signer, then the one who presses publish), so a room learns one shape; a gate seat comes first for an advisory:

| Seat | Who | Does |
|---|---|---|
| Gate | the room's reviewer | Writes the attackability reason into the triage file for each finding (the gate above) before anyone drafts. |
| Drafter | the room's doc-writer | Writes the body and fills every field above, from the CHANGELOG entry and the fix commit. |
| Checker | the room's reviewer | Reads the draft against this pattern, not against its author's account: every field set, the vector scored from the stated trigger, a CWE chosen, the range and patched version equal in the fields and the body, a credit named, a References section, the gate's reason present. A draft that fails one is bounced to the drafter with the failing row, never patched by the checker. |
| Signer | the room's department head | Creates the draft through REST (DOC-PATTERN SECURITY.md row 2) only after the checker passes, and states in its return which fields were set and who checked. |
| Publisher | the owner | Publishing the advisory and requesting its CVE are the owner's decisions (the BB-332 practice). He presses them, or gives his go for a batch and main carries them out through REST and reads each one back. No room seat publishes or requests a CVE on its own. |

## What the house's own advisories share (read 2026-11-16)

Read through REST with the read-only token (never printed) over the seven rooms that hold advisories: 66 advisories, 64 published (2026-11-02 to 2026-11-08), 1 draft, 1 closed. Re-derive with `GET /repos/TheColliery/<room>/security-advisories?per_page=100` for CoalMine, CoalTipple, CoalFace, CoalHearth, CoalLedger, CoalWash and CoalBoard.

| Shared by | Measured |
|---|---|
| Body shape | `Summary`, `Details`, `Proof of concept` and `Impact` as `###` headings: 66 of 66. |
| Package | Ecosystem `other`, name the repository's lower-case name: 66 of 66. |
| Scoring | A CVSS 3.1 vector: 65 of 66 (none 4.0); AV:L (local) on 64 of the 65, the one AV:N being `GHSA-254w-jjf2-hpmc`. |
| Range | `vulnerable_version_range` and `patched_versions` both set: 66 of 66, a single patched version each. |

| Missed by | Measured |
|---|---|
| Severity, CVSS and CWE | The draft `GHSA-mx8v-3554-mxjj`: none of the three (the incident). |
| CWE | 11 of the 64 published: all 9 of CoalBoard's and 2 of CoalHearth's (`GHSA-73ff-9jwm-5675`, `GHSA-f9pv-2vp5-9rch`). |
| Credits field | 0 of 66. |
| Credit stated anywhere | 24 of 66 bodies carry a `**Credit:**` line ("the maintainer's own review", "the maintainer's Deep Scan review"); 42 say nothing. |
| References | 0 of 66. |
| Affected and patched versions named in the body | only 40 and 20 of 66. |
| Headings for Patches and Workarounds | only 9 of 66; the rest use bold lines or prose (42 mention a workaround at all). |
| CVE number | 0 of 66 have one yet; GitHub adds it after a request. |

Published advisories are not rewritten to this pattern by this file. Editing one is the owner's decision, and a missing CWE or credit on a published advisory is added by a PATCH only on his word; the pattern binds drafts from now on.

## What checks this today

FOURTH TENSE: nothing mechanical. No script or gate refuses a draft without a severity, a vector or a CWE; the only check that has ever fired is GitHub refusing the CVE request, which is the latest and most public point to learn it (`GHSA-mx8v-3554-mxjj`). The checker seat above is prose, applied by the room's reviewer. A later unit can read a draft through REST and print the missing fields; none is built.

FORCE: MUST for the gate, for severity (a CVSS 3.1 vector), at least one CWE, the affected range, the patched version and a stated credit before a draft is signed, and for the seats; prefer for the body's heading order and wording. The house bar on severity, CVSS and CWE is its own (see "What GitHub does not say").
