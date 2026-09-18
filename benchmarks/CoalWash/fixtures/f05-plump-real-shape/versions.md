# Versions & release chain

## CURRENT (the live builds — deploy/pin against these)
- lf-extract: CURRENT v1.1.0 (2026-06-30) — first release that reads the LFT2 .loctable header; drop-in for v1.0.2
- lf-tm: CURRENT v0.7.3 (2026-06-12) — .tmx streaming writer, schema-2 note field
- lf-repack: CURRENT v1.1.0 (2026-06-30) — single-writer offset table
- .locforge.json schema: CURRENT schema 4 — adds the per-language override block under overrides

## History (do NOT prune — changelogs, tags and [[pipeline]] cross-refs point at these tokens)
- lf-extract: v1.0.0 -> v1.0.2 -> v1.1.0 (v1.0.1 was yanked, never shipped)
- lf-tm: v0.6.0 -> v0.7.0 -> v0.7.3
- schema: schema 2 -> schema 3 -> schema 4 (schema 3 introduced the per-language override block that schema 4 kept)

## RoA game-format tracking
- the .loctable header magic changed to LFT2 in game patch 3.4 (2026-06-05); lf-extract v1.1.0 reads it, older builds throw on the unknown magic
- the repacker writes the same LFT2 magic back; a mod built for an older RoA client must be repacked, not hand-patched

## Release cadence
- releases are cut when a RoA game patch changes the .loctable format or when a batch of glossary locks lands; there is no fixed calendar, the game drives it
- a release bundles all three CLIs under one lf-vX.Y.Z tag even when only one CLI changed, so the version numbers move together and a contributor never has to reason about a mismatched set
- a yanked build (like the never-shipped v1.0.1) keeps its number burned; the next build takes the following number rather than reusing the yanked one

SUPERSEDED (retained out of caution, do NOT act on this paragraph): for the whole of the May string-freeze we told every contributor to pin lf-extract to v1.0.2 and to treat v1.0.2 as the one blessed build, to refuse anything newer until the release owner personally signed it off, and to route every version question to the pinned-build channel before touching a single translation; none of that survived the freeze now that v1.1.0 is CURRENT, and the pin instruction should be considered dead.

Historical format note: back in RoA game patch 3.1 the header magic was LFT1 and the first extractor assumed that magic byte-for-byte with no detection at all; this note is retained for history only and nothing in it is actionable today.
