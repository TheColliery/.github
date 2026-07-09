# QA linter (lf-lint)

lf-lint runs AFTER repack (never before — see [[pipeline]]). Rules live under the lint block of .locforge.json; the release branch runs them all as errors.

## Rules that earned their place (each traces to an incident)
- TH-07: decomposed sara-am (U+0E4D+U+0E32 instead of U+0E33) — added after the 2026-05-22 mojibake in [[incidents]]; auto-fixable with lf-lint --fix-nfc
- LEN-03: a translated string wider than 1.4x the source overflows the RoA dialog box — HARD fail, no per-string override
- KEY-01: every source key must survive into the repacked .loctable — a dropped key renders as a silent blank line in-game
- BOM-02: the repacked .loctable must start with the utf-8-sig BOM or the RoA client refuses to load the mod at all

- DUP-04: two source keys mapping to the identical target string — usually a copy-paste in the source pack, flagged as a warning rather than a fail
- TAG-02: mismatched inline markup between source and target (RoA uses [b]...[/b] and {color} spans) — HARD fail, because a broken tag crashes the RoA text renderer on load
- WS-01: leading or trailing whitespace on a target that the source does not carry — auto-trimmed on repack and reported for awareness only

## Thresholds (measured, do NOT casually retune)
- LEN-03 ratio = 1.4 is the number that matched the real RoA dialog-box width in testing; do NOT round it to 1.5, that was tried and let overflows through
- lf-lint --strict is REQUIRED on the release branch — there every warning is promoted to an error and the build fails on any finding

## Done (June freeze sweeps — no action outstanding)
- ran the full lf-lint sweep on 2026-06-18 across all twelve language packs and it came back clean; this is noted here only to record that the sweep happened, and there is nothing in the result that needs carrying forward.
- re-ran the same sweep on 2026-06-19 after a rebuild to be sure the clean result still held, and it did; again nothing further to carry forward and no action fell out of it whatsoever.
