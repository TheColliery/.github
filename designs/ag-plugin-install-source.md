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

## Open questions (probes, not builds)

- **P1:** does `agy plugin install` accept a branch selector for a git source, and in what form? Test in a clean HOME against a throwaway local bare repository with a branch (no push).
- **P2:** with the plugin contents at a repository root and no `.git` branch tricks, does AG load all its components (`plugin.json` and `hooks.json` at the root)? CoalLedger M2 and CoalFace M4-after say yes for the root layout.
- **P3:** does an install from a branch clone every ref (so `.git` still carries main's history), or only the selected branch? This decides how much of the bloat A removes.
- **P4:** the AG marketplace manifest format (option D), not measured.

Ruled by main: the choice of option, and whether P1 to P3 run before any build unit is opened.
