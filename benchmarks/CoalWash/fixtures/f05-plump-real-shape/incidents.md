# Incidents & dated lessons

Format: date — what happened — ROOT CAUSE — LESSON. Only the LESSON is load-bearing; the narrative can compress, the dated kernel cannot.

- 2026-05-22: the sara-am mojibake — a batch of TH strings shipped with decomposed sara-am and rendered as tofu boxes in-game. ROOT CAUSE: a translator's editor saved NFD, and nothing checked normalization before repack. LESSON: lf-lint TH-07 plus NFC-on-commit, both now enforced on the release branch.
- 2026-06-05: RoA game patch 3.4 flipped the .loctable magic to LFT2 mid-freeze and every extract broke for most of a day. ROOT CAUSE: the extractor hard-assumed LFT1. LESSON: auto-detect the magic and pin the tracked RoA build in [[config-keys]].
- 2026-04-30: lf-repack ran under repack.parallel on the shared box during the Ironwood push and corrupted the offset table across three packs. ROOT CAUSE: parallel writers on one offset index. LESSON: the do-NOT-parallel rule, single-writer forever.
- 2026-06-11: a schema-1 .tmx round-trip silently dropped every reviewer note on a forty-string pack. ROOT CAUSE: schema 1 has no note field. LESSON: lf-tm writes schema v2, and KEY-01-style guards flag a lost field.

- 2026-03-12: an early TH pack shipped with straight ASCII quotes where the RoA renderer expects its own curly glyphs, and the dialogue read as broken boxes. ROOT CAUSE: no quote-style check anywhere in the pipeline. LESSON: the glossary quote rule plus a lint pass, both folded into the orthography rules.
- 2026-06-02: lf-tm merged a fuzzy match onto an already-signed entry and quietly changed an approved string in a shipped pack. ROOT CAUSE: an off-by-one in the status guard let signed entries fall through. LESSON: never auto-apply onto a signed entry, and the status guard now carries a regression test.

## Closed — no action outstanding (kept only as a paper trail)
- 2026-06-16: chased a suspected offset bug for a whole afternoon; it turned out to be a stale local build, not a real defect, and the moment the build was refreshed the symptom vanished with nothing left to fix or follow up.
- 2026-06-17: a contributor floated switching the .tmx store to plain JSON; we talked it over for ten minutes, decided not now, and there is no pending decision or task left over from that conversation at all.

SUPERSEDED workaround, left only for the record and safe to drop: for a stretch in April, while the shared build box was flaky, we routed all extraction through a single maintainer's laptop and asked everyone to hand their .loctable files to that maintainer and wait for a manual turnaround before translating; the shared box has been stable for weeks and this hand-off dance applies to nobody now.
