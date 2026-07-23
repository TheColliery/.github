# Loss-class catalog additions — classes #55–#58

**Date:** 2026-07-16 · **Type:** taxonomy catalog additions (damage mechanism + precondition + executable trap per class) — **not scored wear-lab runs; no scores or measured figures exist for these entries** · **CoalWash version under test:** none (no run occurred) · **Source of truth:** the series' internal `MASTER-LOSS-TAXONOMY.md` (v1), where each full entry lives.

Four loss classes were catalogued on 2026-07-16: two by world-incident mining (#57, #58), one by a live read-only probe of the real memory-store population (#55), and one by round 1 of the estate-layer wear campaign (#56). Per the taxonomy's own re-validation law, every class is referenced by its damage PATTERN + PRECONDITION + an executable TRAP — dates are provenance, never expiry — and this record publishes the classes as exactly that: catalogued and trap-specified. None of them is a scored benchmark run (contrast [the #54 mini-lab record](generational-compounding-claude-code-2026-07-15.md), which carries measured tables); the closed 53-class wear campaign's scorecard is unchanged.

**Detector status (verified against the taxonomy):** #54's detector is built and shipped (`anchor-diff.mjs`). #55 is grouped in the taxonomy's detector family, but its detector is a SKETCH — designed, not built. #56–#58 are signature/trap entries: the executable trap is specified; no detector code exists.

## #55 — MULTI-STORE PROPAGATION GAP

*Stale-copy fork; native-memory-native. Found 2026-07-16 by a live read-only probe of the real store population, not the what's-new antenna.*

- **Mechanism:** a correction lands in one memory store but never reaches sibling stores holding a duplicate/dependent copy of the same fact. The stale copy is not touched by ANY rewrite — nothing compressed or trimmed it, it simply never re-synced — so every single-artifact gate (classes 1–53) and the lineage detector (#54) are structurally blind to it. Confirmed dangerous instance, live: a hook-contract correction landed in the primary store, yet every sibling per-agent store dedicated to exactly that work still presented the refuted spec as actionable — each edited AFTER the correction existed, which rules out ordinary staleness: propagation failure, proven.
- **Secondary same-precondition mode:** cross-store FABRICATION — a generation-time claim about a sibling store's content made without verifying it; more stores = more citable phantoms. Mitigating convention observed working: stores that self-disclaim ("version ground-truth = plugin.json/CHANGELOG, not duplicated here") turn version drift into honest snapshots.
- **Precondition:** the same fact lives in N independently-edited stores (per-agent memories, room memories, a main store).
- **Trap:** a correction applied only where the error was FOUND. The fix pattern is push-to-all-holders — grep the population for the fact's anchors at correction time — never fix-in-place-only.
- **vs neighbors:** #54 is LINEAGE (one chain, each hop rewrites the last); #55 is POPULATION (N independently-edited copies, no lineage, no rewrite event on the stale member).

## #56 — VERIFY-SCOPE / DELETE-SCOPE MISMATCH (prune-superset)

*Class-A prune side. Found 2026-07-16 by round 1 of the estate-layer wear campaign, confirmed live in the pre-ship estate archive prototype — caught before it shipped, which is the campaign's job.*

- **Mechanism:** a copy/snapshot-verify-then-delete protocol whose DELETE step uses a COARSER handle (a whole-directory `rm -rf`, a glob) than the VERIFY step's enumerated set — any member of the delete scope outside the verified set is destroyed un-backed. First instance: the prototype's archive step verified+archived its enumerated file list, then removed the whole session directory gated only on "all enumerated deletes succeeded" (never on directory-emptiness) — a file past the enumeration walk's cap would die un-archived.
- **Precondition:** the enumeration can legitimately be a SUBSET of the physical scope — a walk/file cap, a file appearing after listing, a stat-skipped / symlink / permission entry.
- **Trap:** assert **delete_scope == verified_set** — delete only the enumerated+verified originals, and `rmdir` a container ONLY-IF-EMPTY (readdir length 0), NEVER `rm -rf`; a non-empty residual after deleting the verified set = un-enumerated survivors → LEAVE them + report. Fail toward keeping unknown bytes, never toward destroying them.
- **General form:** any prune whose "delete" is a directory/glob and whose "verify" is a file list.
- **vs neighbors:** distinct from classes 1–53 (rewrite/meaning loss) and #54–#55 (multi-copy propagation) — this is byte-destruction, not meaning-drift, on the class-A prune side, previously unmodeled. Sibling of #57 (both estate-layer, both byte-destruction), but #56 sits at the ENUMERATION layer where #57 sits under the I/O primitives.

## #57 — FILESYSTEM-SEMANTICS-ASSUMPTION BREAK

*POSIX-assumption family. Lineage: SVN BDB-on-NFS corruption · `rename(2)` `EXDEV` · the 2009 ext4 delayed-allocation lore · Claude Code's own #32533 (sessions vanish — a `.json.tmp` that never renames across drives). Found 2026-07-16 by the git/VCS incident-mining round; 4th member same day from Claude Code's own #62140 (OneDrive Files-On-Demand) + #32637 (iCloud offload).*

- **Mechanism:** durability code assumes POSIX-LOCAL filesystem semantics the actual mount does not provide: **rename-atomicity** (an atomic write's tmp→target rename breaks with `EXDEV` the moment tmp and target straddle filesystems) and **exclusive-create atomicity** (`wx`/`O_EXCL` locking is not truly atomic on some network/cloud-sync mounts). Fourth member: **cloud-placeholder read poison** — a Files-On-Demand / iCloud-optimized placeholder returns short/stub bytes on a plain `read()` with NO error, and the SAME wrong bytes on every re-read — so an external-writer guard that proves a file didn't change between two reads is structurally blind (zero drift — self-consistent nonsense), a copy-verify-then-delete verifies stub-against-stub and deletes the real original, and a rewrite writes a truncated body over a not-yet-hydrated file that then syncs UP and destroys the full content. This breaks the fourth implicit OS-level I/O assumption — "a plain `read()` returns complete, current bytes" — after rename-atomicity, `O_EXCL`-atomicity, and read-returns-current.
- **Precondition:** a store, archive dir, or lock path resolving onto a non-local mount (OneDrive / Dropbox / NFS / a mapped drive — a plausible DEFAULT on Windows), or a cross-device archive dir.
- **Trap:** (a) assert `dirname(tmp) === dirname(target)` at every rename site — anything genuinely cross-device rides copy+verify+delete, never rename; (b) hermetic `EXDEV` fault-injection (patch the rename to throw, assert fail-closed, not silent-strand); (c) name the local-fs assumption at the lock site + fault-inject a non-atomic exclusive-create; (d) before trusting ANY source read as ground truth for a copy-verify-then-delete or a rewrite, sniff for placeholder signals (Windows `FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS` / a reparse point via `lstat`; a zero-blocks-but-nonzero-size stat; a suspiciously round/capped size) → fail-closed (skip + report), never archive or rewrite a stub.
- **General form:** any "atomic" file operation whose atomicity is a property of the FILESYSTEM, exercised on a filesystem the author never named as an assumption.
- **vs neighbors:** the byte-side sibling of #56 — both byte-destruction, not meaning-drift — but #57 sits UNDER every atomic-write/lock (primitive semantics), not at the enumeration layer.

## #58 — DELETION-UNAWARE TIME-TRAVEL RESTORE

*Designed-recovery-path resurrection; AI-memory-native. Found 2026-07-16 by the world-incident-mining round — root mechanism: Cassandra's tombstone / `gc_grace_seconds` zombie-data resurrection.*

- **Mechanism:** a DESIGNED archive/recovery path reads a FROZEN pre-deletion copy of a fact and presents it as current, with NO cross-check against the tombstone registry of things the user DELIBERATELY cut — silently un-deleting what a gate-approved Full wash deliberately removed. Verified reachable live in the pre-ship estate archive prototype: its search/restore paths never consulted `keeps.json` or a bin death-certificate, so an old archived transcript still holding pre-cut wording would be dug up and surfaced as plain, unqualified fact-recovery.
- **Precondition:** a deliberate gate-approved cut recorded in the tombstone registry (`keeps.json` / bin death-certificates) AND a recovery path that reads from a store PREDATING the cut (the estate search/restore path, or any cross-skill seam that digs into archived session history).
- **Trap:** before presenting recovered content as current fact, cross-check it against the tombstone registry (`keeps.json` + the bin death-log) — surface a signal ("this was later removed from the live store, see the keeps entry"), never plain unqualified recovery.
- **General form:** any designed un-delete / time-travel / replay path that reads a pre-deletion snapshot without checking whether the content was since deliberately removed.
- **vs neighbors:** the MIRROR-IMAGE of #54 — #54 is loss accumulating silently across a lineage; #58 is a deliberately-removed fact RESURRECTING via a time-frozen copy. Distinct from #55 (simultaneous cross-store contradiction, not time-delayed resurrection) and from #56/#57 (byte-prune / OS-semantics).

## What this record is, and is not

These four entries extend the master taxonomy to 58 classes. Each is published the way the taxonomy's re-validation law defines a class — mechanism + precondition + executable trap, so re-validation means re-running the traps against the current agent, never restarting a campaign — and none carries a score, a recall figure, or a wear-round verdict, because no scored run exists for them. When any of them graduates to a targeted mini-lab round (the #54 path), that round's dated record will land alongside this one.
