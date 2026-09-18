# Pipeline architecture

Three stages, always in this order: **lf-extract** pulls source strings from the RoA .loctable into a working .tmx; translators fill the .tmx through **lf-tm**; **lf-repack** writes a patched .loctable back for the game to load. Working root on the build box is C:\mods\locforge\work; on CI it is /opt/roa-mods/work. The RoA SDK supplies the source .loctable; see [[build-tooling]] for the SDK path.

## Hard rules (each cost us an incident — do NOT relax)
- do NOT run lf-repack with repack.parallel on the shared build box — the parallel writers race on the .loctable offset index and silently corrupt string offsets; single-writer only. The dated incident is in [[incidents]].
- always extract with extract.encoding = utf-8-sig — RoA writes a UTF-8 BOM on the .loctable and a plain utf-8 read silently drops the first key of the file.
- lf-tm MUST write the .tmx as schema v2 — schema v1 drops the per-entry reviewer note field, and the review lane depends on those notes to sign off a pack.
- the repack step is NOT idempotent — re-running lf-repack on an already-patched .loctable double-applies the header offset and shifts every string; extract fresh, then repack once.

## Auto-detection & ordering
- the extractor auto-detects the header magic and switches between the LFT1 and LFT2 read paths; the override lives in [[config-keys]] under repack.headerMode.
- [[qa-linter]] runs strictly AFTER repack — a pre-repack lint reads stale offsets and cries wolf.

## Data shapes (reference)
- a .loctable is a flat header + an offset table + a UTF-8 string blob; lf-extract only ever reads it, lf-repack rewrites the offset table and the blob together in a single pass so a partial write is never valid
- a .tmx entry is { sourceKey, source, target, note, status }; status is one of new / fuzzy / reviewed / signed, and only signed entries are repacked on the release branch
- extraction is keyed by the source key, NEVER by string index — RoA reorders strings between patches, so an index-keyed merge silently mismatches every entry after the first insert
- the working .tmx for a full RoA pack runs a couple of megabytes and is streamed, not loaded whole; any tooling built around lf-tm must stream it too or it blows the heap on the big packs

## Notes (color, not contract)
- early on we did run lf-repack with repack.parallel enabled on the shared build box and it seemed fine for small mods, right up until the RoA "Ironwood" DLC landed at roughly forty thousand strings and the offset table shredded across three packs at once; that is the whole reason the single-writer rule exists, but the anecdote itself carries nothing you need to keep.
- To repeat what is already written above for the record, the flow is extract, then translate, then repack, and that ordering is the ordering the entire toolchain assumes at every stage, and it should be treated as the reference ordering by anyone who reads this file later, which is a point already made in full above.
