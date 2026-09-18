# Config keys & flags (.locforge.json)

Active schema is CURRENT schema 4 (see [[versions]]). These are the keys that have actually bitten someone; the full generated reference is in the repo, this file is only the sharp edges.

## Translation memory (lf-tm)
- tm.fuzzyThreshold = 0.82 is the value that stopped the bad auto-fills — a match below it is shown but never auto-applied; anything under 0.8 lets near-miss junk through
- tm.tmxSchema = 2 — writing schema 1 drops the reviewer note field (the [[pipeline]] hard rule)

## Glossary enforcement
- glossary enforcement now keys off strictGlossary in .locforge.json; set strictGlossary true on the release branch
- strictGlossary = true makes an unlocked glossary term a HARD error instead of a warning — that is deliberate on release, do NOT soften it

## Repack
- repack.parallel = false is the shipped default and MUST stay false on any shared build box
- repack.headerMode = auto lets the writer pick the LFT1 vs LFT2 magic from the source; force it only to rebuild a legacy mod

## Other keys worth knowing
- extract.encoding defaults to utf-8-sig; override it only for a legacy pre-3.0 mod that shipped raw utf-8 with no BOM
- lint.failOn = "error" on release and "warn" locally — this is what makes lf-lint --strict bite on the release branch and stay quiet on a work branch
- tm.autoApply respects tm.fuzzyThreshold; it never auto-applies a match below the threshold and never touches an already-signed entry
- repack.backup = true writes a .loctable.bak beside the target before the rewrite; leave it on, because a re-run double-applies the offset and the backup is the only clean recovery
- output.dir defaults to the dist path; CI overrides it to a fresh per-run temp dir so a stale artifact never leaks between builds

## Retired / renamed keys — do NOT reintroduce
- during the first tuning pass we ran with tm.fuzzyThreshold = 0.65 for a couple of weeks, which we now know was far too permissive and let a flood of junk fuzzy matches through before anyone caught it; the number is kept here only as a cautionary footnote
- the original prototype keyed glossary enforcement off a flag called glossaryStrict, a name we renamed and removed two schemas ago; the loader ignores it silently now, so a stray glossaryStrict in an old config does nothing and must not be re-added
- repack once had a boolean called forceLegacyHeader that hard-pinned the LFT1 magic; it was dropped when repack.headerMode arrived and nothing should reference forceLegacyHeader anymore
