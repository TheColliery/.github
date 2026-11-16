# Advisory Pattern (TheColliery)

> The shared shape for every GitHub **repository security advisory** a series room drafts: whether a finding gets one at all, the fields GitHub needs before a CVE can be requested, the body, and who does what. Sibling of [RELEASE-PATTERN.md](./RELEASE-PATTERN.md) (the shape of a Release) and companion to [DOC-PATTERN.md](./DOC-PATTERN.md), whose SECURITY.md row 2 already says that a fixed vulnerability is announced as an advisory and what `SECURITY.md` keeps of it; this file does not restate that row.
> Born from a measured miss (2026-11-16, owner order UMB4-033, card BB-489): the CoalWash draft `GHSA-mx8v-3554-mxjj` was about a program with the user's own rights overwriting a file in the user's own folder. It failed the gate below and was closed unpublished on 2026-11-16 (no CVE). It had also reached the owner with no severity, no CVSS vector and no CWE, so GitHub's form kept its Request CVE button disabled. The second miss is why the fields are listed below; the first is why the gate comes first.

<!-- coalmine: verified 2026-11-16 · exemplar GitHub Docs, repository security advisories (the six pages in "What GitHub says", each read 2026-11-16) · revalidate 90d -->
## The gate: does this finding get an advisory at all

**Ask and answer this BEFORE any draft is written.** A finding that fails it has no advisory and no `SECURITY.md` write-up; it goes to the room's triage file and to its `CHANGELOG.md` line, and nothing else. The owner's rule (card BB-316 (4), 2026-10-28) is an advisory only for a finding an outsider can really attack, at any severity. On 2026-11-06 he widened it to a screen of several criteria: use the one that fits the case, and name it in the triage file. The four are below, each cited to its own public page, read 2026-11-16.

| # | Criterion | The question it asks | Source |
|---|---|---|---|
| 1 | The house's own: an outsider triggers it | Can an OUTSIDER make it happen, through data they control: a repository the user clones, a file the user is sent, a network answer? A path where only the user supplies the data (their own configuration, a command they type) does not count. | The house rule, card BB-316 (4). |
| 2 | A security boundary is crossed | Does it violate the goal or intent of a security boundary: network to machine, one user to another? "By default, components are not considered boundaries unless explicitly named as such." | [Microsoft Security Servicing Criteria for Windows](https://www.microsoft.com/en-us/msrc/windows-security-servicing-criteria) |
| 3 | It is a vulnerability by the CVE program's definition | "an instance of one or more weaknesses in a Product that can be exploited, causing a negative impact to confidentiality, integrity, or availability; a set of conditions or behaviors that allows the violation of an explicit or implicit security policy." Conditions that "do not lead to a security impact SHOULD NOT be determined to be Vulnerabilities" (4.1.2), and neither do "Well-documented or commonly-understood non-default configuration or runtime changes made by an authorized user" (4.1.3). | [CVE Numbering Authority Operational Rules, version 4.1.0, effective 2025-05-14, section 4.1](https://www.cve.org/Resources/Roles/Cnas/CNA_Rules_v4.1.0.pdf) (read 2026-11-16; section 4.1 reads the same in version 4.0; the current version is listed on [cve.org](https://www.cve.org/resourcessupport/allresources/cnarules)) |
| 4 | The attacker already has what it would gain | An attacker who already controls the machine or already runs as the user gains nothing, so it does not count: "The attacker's code, when it runs as your user account on your machine, can do anything you can do." | [Chromium security FAQ, "Why aren't compromised/infected machines in Chrome's threat model?"](https://chromium.googlesource.com/chromium/src/+/main/docs/security/faq.md) |

How the four are used:

- **The reviewer names the criterion that decided each finding, and why, in the triage file, for every finding** (the attack route if it passes, the reason it fails if it does not). A draft with no such line behind it has not passed the gate. Criteria 1 to 3 say what makes a finding count; criterion 4 says what does not.
- **An unclear case counts as attackable** and goes to CoalBoard to rule. It is never dropped on a guess.
- **Severity does not decide it.** A LOW finding an outsider can trigger gets an advisory; a HIGH finding that only a program already running as the user can trigger does not.

The gate applies to every finding from a Deep Scan in every repo, and to any other fixed vulnerability a room would announce.

## What GitHub says (read 2026-11-16)

Every rule below is cited to the page it comes from, read on 2026-11-16; none is from memory. GitHub's pages carry no last-updated date, so the date a seat read them is the only date there is; re-read before relying on a rule after the stamp above expires.

| Rule | Page |
|---|---|
| The form asks a title, a CVE identifier choice, a description ("including its impact"), affected products (ecosystem, package name, affected and patched versions, vulnerable functions), a severity, weaknesses (CWE), and optional credits. The page says "the fields marked with an asterisk are required" and does not say which they are. | [Creating a repository security advisory](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/fix-reported-vulnerabilities/create-repository-advisory) |
| Severity is a dropdown, or "Assess severity using CVSS" with GitHub's calculator ("GitHub calculates the score according to the Common Vulnerability Scoring System Calculator"). Credit types are Finder, Reporter, Analyst, Coordinator, Remediation developer, Remediation reviewer, Remediation verifier, Tool and Sponsor; a credited person gets a notification, and their username is public once they accept and the advisory is published. | the same page |
| Over REST, a create call requires `summary`, `description` (the response schema lists 65,535 characters as its length limit) and `vulnerabilities[]` with `package.ecosystem`; `cwe_ids`, `credits`, `vulnerable_version_range` and `patched_versions` are optional. Severity is set one of two ways: "You must choose between setting this field or cvss_vector_string", that is, one or the other, not both; `cvss_vector_string` is "The CVSS vector that calculates the severity of the advisory". The ecosystems include `other`. | [REST API endpoints for repository security advisories](https://docs.github.com/en/rest/security-advisories/repository-advisories) |
| A CVE is requested by `POST .../security-advisories/{ghsa_id}/cve`, for a public repository only, by a security manager or administrator of it. | the same page |
| "GitHub is a CVE Numbering Authority (CNA) and is authorized to assign CVE identification numbers." "GitHub usually reviews the request within 72 hours." "If your security advisory is eligible for a CVE, GitHub will reserve a CVE identification number." Requesting one "doesn't make your security advisory public"; GitHub publishes the CVE details after the advisory is public. It cannot assign one where another CNA covers the project. | [Repository security advisories (concepts), CVE identification numbers](https://docs.github.com/en/code-security/concepts/vulnerability-reporting-and-management/repository-security-advisories) |
| "Before you can publish a security advisory or request a CVE identification number, you must create a draft security advisory and provide information about the versions of your project affected by the security vulnerability." The page's two screenshots show a "Required advisory information has been provided" area of the form beside the Publish advisory and the Request CVE buttons. It also says to "add a fix version ... prior to publishing", or Dependabot alerts users "without offering any safe version to update to". Publishing deletes the temporary private fork. | [Publishing a repository security advisory](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/fix-reported-vulnerabilities/publish-repository-advisory) |
| A range is written as an operator, one space and a version (`>=`, `>`, `=`, `<=`, `<`); a lower bound first, then a comma and one space, then the upper bound; one product section per range. A patched version "cannot be smaller than the largest number in the" range, and `< n` is only for an `n` that is not vulnerable. A bare lower bound is not recommended (the implicit upper bound is infinity). A version with letters counts the letters as a pre-release marker. | [Best practices for writing repository security advisories](https://docs.github.com/en/code-security/tutorials/fix-reported-vulnerabilities/write-security-advisories) |
| The Advisory Database "supports both CVSS version 3.1 and CVSS version 4.0" (and 3.0 for an imported CVE); a maintainer's CVE uses "the CVSS version assigned by the maintainer, which can be version 3.1 or 4.0". | [About the GitHub Advisory Database](https://docs.github.com/en/code-security/security-advisories/working-with-global-security-advisories-from-the-github-advisory-database/about-the-github-advisory-database) |

**What is GitHub's requirement and what is the house's bar.** GitHub's form will not let a CVE be requested until its required advisory information is complete. The pages do not list the items, but they name the check (the form area above) and name the affected versions as a precondition of both publishing and a CVE request. On 2026-11-16 the draft `GHSA-mx8v-3554-mxjj` had no severity set and its Request CVE button was disabled. A CVSS vector sets the severity (REST page above). So **severity, set by a CVSS 3.1 vector, and the affected versions are GitHub's requirements** before a CVE request; **at least one CWE is the house's own bar**, which no page above requires.

## The fields (all of them set on the draft, before the CVE request)

| Field | The rule | Why / where it came from |
|---|---|---|
| Title (`summary`) | One plain sentence saying what an outsider could make happen, as the Summary section does. | Every house advisory has one. |
| Severity and CVSS | GitHub's requirement. Set the CVSS **vector**, `cvss_vector_string`, never the severity dropdown alone; GitHub derives the severity from the vector. **CVSS 3.1.** | All 65 house advisories that have a vector use 3.1, none 4.0 (read 2026-11-16, measured below). A mixed series would make its scores incomparable. FIRST calls 4.0 "the next generation of the Common Vulnerability Scoring System standard" ([first.org/cvss/v4-0](https://www.first.org/cvss/v4-0/), read 2026-11-16) and GitHub supports it (page above), so moving is possible, but as one series-wide decision for all rooms and a rescore of the published ones, never one room at a time. Score each metric from the finding's own trigger, and say why in the body in a `CVSS reasoning` line (eight house advisories already do). |
| CWE (`cwe_ids`) | The house's own bar: at least one. Choose the weakness the FIX removes, from the [CWE list](https://cwe.mitre.org/index.html); several only when the finding really is several. | 11 of the 64 published advisories have none (read 2026-11-16, below). |
| Ecosystem and package | Ecosystem `other`; package name the room's lower-case repository name. | 66 of 66 use `other` and the repository name. The rooms ship through plugin marketplaces and file copies (the README install rows), not a package registry, so no registry ecosystem fits. |
| Affected range (`vulnerable_version_range`) | GitHub's requirement. The first version that carries the defect, up to the last version before the fix, in GitHub's syntax: `>= first, < fixed` (or `<= last` when the fix is the next version after it). A single version is `= n`. When the first affected tag was not found by reading each tag, the body says how the range was derived. | The publishing and best-practices pages above; the house practice in `GHSA-x5wj-m7xx-8895`, whose body says "the tags between were not each read". |
| Patched version (`patched_versions`) | The one version that carries the fix, as its release tag names it. Never empty: no house advisory leaves it empty. | The publish page above (Dependabot offers a safe version only if one is set). |
| Credits (`credits`) | A person or tool account that found, reported or fixed it, with its credit type, gets the field; the person is notified and is public only when they accept. The maintainer's own review, or a scanner with no account, is a `**Credit:**` line in the body. Either way the advisory says who found it. | 0 of 66 use the field; 31 bodies say who found it (24 as a `**Credit:**` line, 7 in a sentence) and 35 say nothing (read 2026-11-16, the counting rule below). |
| CVE (`cve_id`) | Leave it empty: the CVE is requested after the draft is signed (the seats below), and GitHub fills the number itself. | DOC-PATTERN SECURITY.md row 2; 0 of 66 carry a number today. |
| Description | The body below, at most 65,535 characters. | The REST page above. |

## The body

Headings are `###`, in this order. The first four are in all 66 house advisories. `What is not known`, `Patches` and `Workarounds` are in some (8, 9 and 9 of 66) and become one shape here; `Who is affected` and `References` are in none and are new in this pattern.

| # | Heading | What it holds |
|---|---|---|
| 1 | `### Summary` | One short paragraph in plain words: what could happen, to whom, because of what, in which versions. No jargon an affected user would have to look up. |
| 2 | `### Details` | The mechanism: the code path, the file and function, what the outsider's data does there, and what the fix changes (the commits, by short hash). Data verbatim from the CHANGELOG entry and the fix commit; never a number nobody re-ran. |
| 3 | `### Proof of concept` | What was run or read to show it, and where the test lives. A finding that was only read says so in a sentence ("found by reading ... at the tags; not run as a witness"). Never a working exploit for a finding that is still unpatched. |
| 4 | `### Impact` | What is lost or exposed, and what is NOT, as two plain lists when both are true. A **limit no version closes** stays here when there is one. The `**CVSS reasoning:**` line and the CWE name (for example "CWE-78, OS Command Injection") sit at the end. |
| 5 | `### Who is affected` | New. The trigger in one line (`**Triggered by:**` what the outsider controls and what the user does), the platform or setting it needs, then `**Affected versions:**` and `**Patched version:**` copied from the fields, so the text and the fields cannot differ (the checker compares them). Today 28 of 66 bodies carry a labelled affected-versions line and 20 a labelled patched-version line; 9 carry a `**Triggered by:**` line. |
| 6 | `### Patches` | The fixed version and what it does differently, in the reader's words. |
| 7 | `### Workarounds` | What a user who cannot update can do, or "None. Upgrade." in those words. Never left out: GitHub's own page lists it. |
| 8 | `### What is not known` | Only when something is unproven (a step no test showed, a platform not tried). Named, never papered over. |
| 9 | `### References` | New. The `CHANGELOG.md` entry, the release tag, the fix commit, each as a link. GitHub's description rule names references (creating page above). |
| - | `**Credit:**` | One closing line when the credit is not in the field. |

Write in the house's plain style ([DOC-PATTERN.md](./DOC-PATTERN.md)): short sentences, no marketing word, no "we are pleased", no alarm. A reader who is a user of the tool must be able to answer three questions from the first screen: am I affected, what do I do, and how bad is it.

## The seats

The same roles the house gives a Release (a drafter, a checker, a signer, then the one who presses publish), so a room learns one shape; a gate seat comes first for an advisory:

| Seat | Who | Does |
|---|---|---|
| Gate | the room's reviewer | Writes the triage line for each finding, naming the criterion that decided it and why (the gate above), before anyone drafts. |
| Drafter | the room's doc-writer | Writes the body and fills every field above, from the CHANGELOG entry and the fix commit. |
| Checker | the room's reviewer | Reads the draft against this pattern, not against its author's account: the gate's triage line present, every field set, the vector scored from the stated trigger, a CWE chosen, the range and patched version equal in the fields and the body, a credit named, a References section. A draft that fails one is bounced to the drafter with the failing row, never patched by the checker. |
| Signer | the room's department head | Creates the draft through REST (DOC-PATTERN SECURITY.md row 2) only after the checker passes, and states in its return which fields were set and who checked. |
| Publisher | the owner | Publishing the advisory and requesting its CVE are the owner's. He presses them, or main does on the owner's go for the batch, through REST, reading each back; this is the practice DOC-PATTERN SECURITY.md row 2 states. No room seat publishes or requests a CVE on its own. The CVE is requested before the advisory is published: the request does not make the advisory public (concepts page above), and GitHub adds the number after publication. |

## What the house's own advisories show (read 2026-11-16)

Read through REST with the read-only token (never printed) over the seven rooms that hold advisories: 66 advisories, 64 published (2026-11-02 to 2026-11-08), 2 closed, none a draft (`GHSA-68r3-r494-2rfg` closed 2026-11-06, `GHSA-mx8v-3554-mxjj` closed 2026-11-16). Re-derive with `GET /repos/TheColliery/<room>/security-advisories?per_page=100` for CoalMine, CoalTipple, CoalFace, CoalHearth, CoalLedger, CoalWash and CoalBoard.

**Counting rule: every count is of a field's value or a heading in the body, never of a phrase.** The patched version is counted by its own string from `patched_versions`; the range by each version number in `vulnerable_version_range`; a heading by a line that starts with it; a credit by a `**Credit:**` line, or else a sentence naming who found it (`credit`, `found by`, `reported by`, `discovered by` or `finder`, any case).

| Shared by | Measured |
|---|---|
| Body shape | `Summary`, `Details`, `Proof of concept` and `Impact` as `###` headings: 66 of 66. |
| Package | Ecosystem `other`, name the repository's lower-case name: 66 of 66. |
| Scoring | A CVSS 3.1 vector: 65 of 66 (none 4.0); AV:L (local) on 64 of the 65, the one AV:N being `GHSA-254w-jjf2-hpmc`. The one without a vector is the closed draft. |
| Range | `vulnerable_version_range` and `patched_versions` both set: 66 of 66, a single patched version each; the patched version's own string is in the body of 66, and every version number of the range in the body of 62 (at least one in 64). |

| Missed by | Measured |
|---|---|
| Severity, CVSS and CWE | The closed draft `GHSA-mx8v-3554-mxjj`: none of the three. |
| CWE | 11 of the 64 published: all 9 of CoalBoard's and 2 of CoalHearth's (`GHSA-73ff-9jwm-5675`, `GHSA-f9pv-2vp5-9rch`). |
| Credits field | 0 of 66. |
| Who found it, stated anywhere in the body | 31 of 66 do (24 a `**Credit:**` line such as "the maintainer's own review", 7 a sentence); 35 say nothing. |
| A `Who is affected` section | 0 of 66. Labelled lines in the body: `**Affected versions:**` 28, `**Patched version:**` 20, `**Triggered by:**` 9. |
| A `References` heading | 0 of 66. (3 bodies carry a link anywhere; 54 name a commit.) |
| `Patches` and `Workarounds` as headings | 9 of 66 each; the rest use bold lines or prose. |
| CVE number | 0 of 66 have one yet; GitHub adds it after a request. |

Published advisories are not rewritten to this pattern by this file. Editing one is the owner's decision, and a missing CWE or credit on a published advisory is added by a PATCH only on his word; the pattern binds drafts from now on.

## What checks this today

FOURTH TENSE: nothing mechanical. No script or gate refuses a draft without a severity, a vector, a CWE or a triage line; the only check that has fired is GitHub's own form, which disabled the Request CVE button on `GHSA-mx8v-3554-mxjj`, the latest and most public point to learn that a field is missing. The checker seat above is prose, applied by the room's reviewer. A later unit can read a draft through REST and print the missing fields; none is built.

FORCE: MUST for the gate and its named criterion, for severity (a CVSS 3.1 vector) and the affected range (GitHub's requirements, above), for the patched version and at least one CWE (the house's own bar; GitHub's publishing page warns without a fix version but lets the advisory out), for a stated credit before a draft is signed, and for the seats; prefer for the body's heading order and wording.
