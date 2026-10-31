# Antigravity install source: a plugin-only source for each room

**Status:** design only. Nothing here is built, pushed or wired. The recommendation is the deputy's, for the org's owner to rule on. Probes P1 to P3 are owed before any build.

## Measured need

- An Antigravity (AG) install from a GitHub link runs `agy plugin install https://github.com/TheColliery/<Room>`. It clones the WHOLE repository into the user's plugin folder: `.git/`, `.github/`, the CHANGELOG (about 404 KB in CoalWash) and a second `plugin/` (CoalWash M4, CoalGob M4, 2026-10-31).
- AG's GitHub install treats the repository ROOT as the plugin root. CoalLedger M2: the native route loads 1 hook only when a root `plugin.json` and a root `hooks.json` both exist. CoalFace M4-after: the link install fires its hooks from the root `hooks.json`.
- `agy plugin install <target>` takes a plugin directory or a git URL (`plugin[@marketplace]` also named). Its own error text: `install target must be a directory`. No branch selector appears in its help.
- `agy plugin validate` on a `plugin/` folder with no root manifest exits 1 (CoalWash M1, CoalLedger M1).

## 1. Where the source lives

| Option | What a user gets | Build units (central, then per room) | Cost to the rooms |
|---|---|---|---|
| **A. Branch `ag-plugin` in the room's own repo**, its root holds `plugin/`'s contents | Working tree: plugin files only. `.git` still holds the repository's history. | Central: one release step (2 workflow files) + one canon row + one witness. Per room: the step rides its next release. | ONE shape for every room with `plugin/` (7 today; CoalGob names N/A until it has a skill). Uses the existing `GITHUB_TOKEN` (`contents: write`). No new credential. |
| **B. Separate repo per room**, `TheColliery/<Room>-ag`, default branch = plugin contents | The cleanest clone: no CHANGELOG, no `.github/`, no main history in the working tree. | Central: a sync step + a repo birth per room (SYSTEM-BIRTH sequence: home, team, study visit, blueprint). | Highest. 7 new repos, a repo kind with no slot in SERIES-CANON, and a cross-repo write credential that VENDOR-REGISTER would need the owner's click for. The retired `Colliery` mirror (UMB3-108) was this shape: copies that drift. |
| **C. Release ZIP** per room, `<Room>-ag-plugin.zip` | Two steps: download, unzip, then `agy plugin install <dir>` (the directory form is the only local one the help names). | Central: one ZIP step (the claude.ai ZIP machinery already exists in two rooms) + one canon row. | +1 user step. The ZIP pruning rule (keep latest + one) applies. AG's acceptance of a ZIP URL is unmeasured. |
| **D. AG marketplace** (`plugin@marketplace`, `link <mp> <target>`) | Unknown until measured. | Unknown. | Parked: the marketplace manifest format for AG is not measured here. |
| **E. Status quo** | One command, whole-repo clone. | None. | The measured bloat stays in every user's plugin folder. |

## 2. How a release keeps it in step (option A)

- **Trigger:** the same release event as the Release itself (the tag push, and the dispatch re-post for an existing tag). The step runs LAST, after the derive step, the byte re-read and the publish, so a branch never points at a Release that failed.
- **Write:** a commit whose tree is the tag's `plugin/` subtree (`git rev-parse <tag>:plugin`), parented on the branch's previous tip, message `plugin for vX.Y.Z`. **Fast-forward push only; never a force push.** The branch is the install's audit trail. A re-run for the same tag writes the same tree, so the step skips the commit.
- **Gate:** before the push, a byte check that the subtree equals the tag's `plugin/` (the same shape as the release re-read). A mismatch stops the step red.
- **Immutability:** `RELEASE-PATTERN.md` forbids moving a published tag and editing a published Release's substance. It does not forbid a new commit on a branch. The branch moves forward only, so a user's install traces to one commit.
- **Failure:** if the Release is published but the branch push fails, the step is red and the branch is stale until the dispatch re-run converges. The failure is loud, not silent.
- **Canon rows:** one row in `RELEASE-PATTERN.md` (what the branch is, who writes it, the fast-forward rule) and one line in `SKILL-REPO-PATTERN.md` (the workflow step's shape).

## 3. What a user's install command becomes

- **Today (E):** `agy plugin install https://github.com/TheColliery/CoalWash`
- **A:** `agy plugin install https://github.com/TheColliery/CoalWash` plus a branch selector. **The selector's form is unmeasured (P1).** Candidates: `#ag-plugin` or `/tree/ag-plugin`.
- **B:** `agy plugin install https://github.com/TheColliery/CoalWash-ag`
- **C:** download `CoalWash-ag-plugin.zip` from the Release, unzip, then `agy plugin install <folder>`.

## 4. Recommendation (the deputy's; for main to rule on)

**Option A, gated on P1 and P2.** It adds one shape to the rooms, needs no new credential and no new repository. If P1 shows AG cannot select a branch, take C (cheaper than B, and it removes the bloat). Take B only if the owner accepts seven repositories and a cross-repo credential for the cleanest clone.

## Measured (2026-10-31, local only)

Setup: agy 1.4.12 (`agy --version`), git 2.56.0. A throwaway bare repository under the Windows temp folder (`ag-probe-29e/bare.git`): branch `main` holds the whole-repository shape (README, CHANGELOG, `plugin/` = CoalHearth's shipped plugin folder); branch `ag-plugin` holds the same plugin contents at its root. Every agy run used a clean HOME (`HOME`, `USERPROFILE`, `APPDATA`, `LOCALAPPDATA` set to a sandbox folder). No push, no network. The sandbox was removed by a narrow delete.

**P1, branch selector: not decided locally.** agy's git source is GitHub-only. Every candidate was refused before any clone:
- `agy plugin install file:///…/bare.git#ag-plugin` → exit 1, `install target must be a directory: file:///…/bare.git#ag-plugin`. The same error for `@ag-plugin`, `/tree/ag-plugin`, a plain path with `#ag-plugin`, and the bare URL with no selector.
- `agy plugin install https://127.0.0.1:9/bare.git#ag-plugin` (and `@ag-plugin`, `/tree/ag-plugin`, `http://`) → exit 1, `failed to parse GitHub URL: currently only supports github.com: 127.0.0.1:9`.
- `agy plugin install git@127.0.0.1:bare.git#ag-plugin` → exit 1, `unknown marketplace`.
The help text names no branch option: `install <target>  Install a plugin (supports plugin[@marketplace])`. A selector on a github.com URL is unmeasured; testing it needs a network read of GitHub, which this local-only probe does not do.

**P2, plugin contents at the root: yes, for the directory form (the only local form).** Install from a clone whose root holds the plugin contents: exit 0; `hooks 1 installed (coalhearth)`; `commands: 2 installed (converted to skills)`; `agy plugin list --json` shows it enabled, version 2.8.8, source antigravity. `agy plugin validate` on the source and on the installed root: exit 0, warnings `commands: never loaded` and `hooks/hooks.json: never loaded: plugin hooks are read only from hooks.json at the plugin root` (the root `hooks.json` is the one read). Validate counts `hooks 1` and `skills 0`, so its count disagrees with the install report on the two converted commands; not resolved here.
- The whole-repository shape by directory: `validate` on the source exits 1 (`no plugin.json found at the plugin root`), but `install` exits 0 with `Found bulk plugins directory … Installing plugin "plugin"`. A directory install takes the `plugin/` subfolder and leaves the rest. The GitHub-URL install (M4) took the whole repository, so the two install paths differ.

**P3, refs held: not measured on the GitHub path; measured for the directory form.** agy copied the source clone's `.git` unchanged. A `git clone --branch ag-plugin` (git's default, all branches fetched) gave an installed `.git` of 207 KB holding `refs/heads/ag-plugin`, `refs/remotes/origin/main` and `refs/remotes/origin/ag-plugin`. A single-branch clone would hold one ref. What agy's own GitHub clone fetches stays open.

## Open questions

- **P1 (open):** the branch selector on a github.com URL, measured by a read install in a clean HOME, owed before option A is built.
- **P2 (answered for the directory form):** the root layout loads its hooks and converts its commands. The GitHub-URL path is unmeasured here.
- **P3 (open on the GitHub path):** which refs agy's GitHub clone holds.
- **P4:** the AG marketplace manifest format (option D), not measured.

Ruled by main: the choice of option, and whether P1 to P3 run before any build unit is opened.
