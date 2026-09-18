# Build & tooling

- Node pinned at 20.11.1 for all three lf-* CLIs — the .tmx streaming parser throws on Node 21.x (a WHATWG stream change), so the pin is load-bearing, not habit
- the build box is Windows; CI mirrors it on windows-latest and adds a ubuntu-latest smoke run so a Linux contributor is not blocked
- build the CLIs with npm run pack:cli; the packed artifacts land in C:\mods\locforge\dist and nothing else writes there
- release tags are lf-vX.Y.Z — one monorepo tag covers lf-extract, lf-tm and lf-repack together; there is no per-CLI tag
- the RoA SDK on the build box lives at C:\Games\RangersOfAethel\ModSDK; lf-extract reads the source .loctable schema from there, so a missing SDK fails extraction fast with a clear error

## CI shape (reference)
- windows-latest: full build + full lf-lint --strict + the repack round-trip test on the Ironwood fixture pack
- ubuntu-latest: smoke only — build the three CLIs and run the unit tests, no repack, because the RoA SDK is Windows-only and there is no .loctable to round-trip on Linux
- both legs cache the Node 20.11.1 toolchain and the .tmx parser build; a cache miss adds about ninety seconds, it is not a failure
- the release job runs only on a lf-vX.Y.Z tag, rebuilds clean, and publishes the three CLI artifacts out of the dist path as one versioned bundle

## Ownership (OWNERS, cross-agent)
- @mossback owns lf-extract and lf-repack (the binary format side)
- @kettil owns lf-tm and the .tmx schema; any schema bump goes through him
- @nong-ploy owns the TH glossary and is the required TH reviewer — see [[glossary-rules]]

To say again what is already written elsewhere in these notes, the Node runtime is pinned on purpose, and the reason it is pinned is that a newer runtime broke the streaming parser, and so the pin must not be bumped casually by anyone working in this repository at some later date without checking the parser first.
