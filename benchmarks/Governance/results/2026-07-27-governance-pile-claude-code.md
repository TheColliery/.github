# Governance pile—volume, self-contradiction, and adherence

**Date:** 2026-07-27 · **Platform:** Claude Code · **Engine:** claude-opus-5 (main + all nine workers) · **Agent type for every worker:** `blind-ic`
**Target version:** the pile is not a released artifact. It is pinned by **byte snapshot + timestamp**, below, because it was **edited by another agent while this benchmark ran**.
**Pre-registration:** `../PREREGISTRATION.md` (written before any adherence data) · **Harness:** `../tasks.md` · **Scorer:** `../score.mjs` · **Raw:** `raw/r{1,2,3}-{A,B,C}-*.txt`

---

## What was asked

Anthropic, *Steering Claude Code* (2026-06-18), asserts that appending the system prompt has **diminishing returns for adherence**, that **more instructions mean less strict following, particularly if any contradict**, and tips **"keep CLAUDE.md under 200 lines."** The question was whether that is true of *our* pile, and at what level.

Three separable claims were tested: **H1** volume degrades adherence · **H2** contradiction degrades it further · **H3** the 200-line count is a usable proxy for volume.

---

## Arm 1—VOLUME (deterministic, no model runs)

Measured with `census.mjs`; the file set is **exactly** the set this session's own context lists as injected, cross-checked against the `paths:` frontmatter split (the six `typescript/` + `node/` files carry `paths:` and are confirmed **absent** from the injected context).

| Snapshot | Files | Lines | Chars | Est. tokens |
|---|---|---|---|---|
| **08:12 UTC** (matches this session's injected context) | 22 | 1,524 | **191,254** | **~76,637** |
| **08:31 UTC** (after a concurrent edit landed) | 21 | 1,510 | **198,129** | **~79,281** |

By tier, at 08:31: umbrella 87,487 · `ecc/domain` 51,715 · `ecc/common` 29,037 · machine-global 11,370 · auto-memory 18,520.

### The user's 158,754 baseline reconciles exactly, and it undercounts

`158,754` = umbrella (3 files) + `ecc/domain` (4) + `ecc/common` (10), to the character. It **omits three classes that are injected anyway**: the machine-global files (11,370), the auto-memory index (18,520), and the then-present `ecc/RETIRED.md` (2,610). **The real injected pile was 20.5% larger than the working baseline.** `AGENTS.md` at 185 lines / 58,094 chars verified to the character against the user's figure.

### Token calibration—measured, not assumed

`chars/4` is wrong for this corpus and the error was quantified rather than guessed. `claude plugin details` reports a per-skill on-invoke cost; that cost is the SKILL.md **body**, whose chars are directly measurable.

**n=13 skill bodies · ratio (platform tokens ÷ chars/4) = 1.399 to 1.586 · median 1.511 · pooled 1.539 · pooled 2.60 chars/token.** This independently reproduces and extends the user's n=4 (1.48–1.55) figure.

> ⚠️ **These token figures are CALIBRATED ESTIMATES, not a tokenizer count.** The platform's own counter is rounded and self-labelled "estimates and may differ from actual usage", so the calibration inherits that. The **char counts are measured; the token counts are derived.** Thai text is scored separately at a conservative 1 token/char and is only 4,957 chars of the pile, so it moves nothing material.

**Verified against the platform counter:** the seven plugins' always-on total is **5,697 tokens**, matching the user's figure exactly. That is **7.2%** of the governance pile's ~79.3k—the plugins are not the cost centre; the pile is.

### The pile is not a stable object

`AGENTS.md`, `MEMORY.md`, and three `ecc/domain` files were **edited between 15:19 and 15:24 local, inside this benchmark's own run window.** Net **+6,875 chars in ~19 minutes** (gross +9,485; `RETIRED.md`'s 2,610 chars were removed in the same window). This is recorded as a confound (below) and as a fact in its own right: **a pile measured once is a figure with a shelf life measured in minutes on an active day.**

---

## Arm 2—H3, the 200-line tip (deterministic)

Line density of conventional markdown in this repo, measured on the ten `ecc/common/` files: **43.6 chars/line.** A 200-line file at that density is **~8,720 chars**.

| File | Lines | Under the 200 tip? | Chars | Chars/line | Content vs a "compliant" 200-line file |
|---|---|---|---|---|---|
| `AGENTS.md` | 188 | **YES** | 61,088 | 324.9 | **7.0×** |
| `MEMORY.md` | 51 | **YES** | 25,711 | 504.1 | **2.9×** |

**H3 is FALSE for this corpus.** Both files pass the tip's cap comfortably, and both carry several times the content the cap intends to limit. The house style is dense tables and long bullet lines, so a line count is not a proxy for anything the tip cares about. **A rule expressed in lines reads green on a file that is 7× over in substance.**

This is the same failure mode already recorded one layer down in `skill-authoring.md` §3b, where a `< 500 lines` guide reads green on bodies 70% over their token budget. Two independent instances of the same defect: **gate on tokens; a line count is not the unit.**

---

## Arm 3—CONTRADICTION CENSUS (deterministic, rubric stated)

**Rubric (fixed before enumerating).** A contradiction is two statements in the *always-injected* pile such that an agent obeying both must violate one. **HARD** = same subject, opposing prescription, no scope qualifier separating them. **SCOPED** = conflicting on their face but resolved by a stated scope; not a finding. **STALE-CLAIM** = a durable claim the pile makes about itself that measurement contradicts.

### C1—HARD, live, verified at source

`.claude/rules/ecc/domain/hooks-safety.md` §9, **both lines present right now**, eighteen lines apart in one always-loaded section:

- **:104**—*"THE SCOPE TEST WAS WRONG WHEN FIRST WRITTEN—CORRECTED 2026-07-27 ... The test below originally read "does a HOOK read it?" and that is too loose ... The real test is: DOES THE CLAMP REACH EVERY READ THAT FEEDS THE GATED DECISION?"*
- **:122**—*"So the clamp's scope test is not "is this key consent-bearing?" but "does a HOOK read it?""*

The amendment at :104 explicitly retires the test that :122 still states as the rule. **An agent reading §9 top-to-bottom is told the scope test is wrong, then told it is the rule.** The mechanism is generic and worth naming: **an amendment that does not delete the sentence it corrects manufactures a contradiction.** That is the reusable detection method—scan for correction markers, then check whether the corrected original was left standing.

### C2—STALE-CLAIM, found by this benchmark, fixed by a concurrent editor mid-run

The pile asserted that the tombstone ledger *"is never `@imported`, so retiring a dead rule costs zero always-loaded tokens."* **`ecc/RETIRED.md` was in this session's injected context**—the tree auto-loads as a *directory*, which the pile itself states elsewhere. The zero-cost claim was false about itself, and **retirement was silently the most expensive way to remove a rule.** Measured cost while it stood: **2,610 chars ≈ 1,004 tokens every session, growing forever by design.**

**This was independently found and fixed by whoever holds the rule files, during this run**—the ledger now lives at `TheColliery/RULES-RETIRED.md`, outside both trees. Recorded because the *measurement* stands and the mechanism generalises: a file's claim about its own load cost is not evidence of its load cost.

### C3—NOT a pile contradiction (scope correction)

The `ecc/typescript/` layer prescribes six npm dependencies against Phoenix #2's zero-dep commandment. Real, and already recorded in `AGENTS.md`—**but those five files carry `paths:` frontmatter and are NOT in the injected set** (verified: they are absent from this session's context). It is a latent repo defect, **not** a contradiction inside the always-loaded pile, and it must not be counted as one.

**Census: 1 HARD live · 1 STALE-CLAIM (fixed during the run) · 1 correctly excluded.** This is a *targeted* census following correction markers, **not an exhaustive one**—it establishes that live contradictions exist in the injected pile; it does not bound how many.

---

## Arm 4—ADHERENCE (9 model runs, 3 conditions × 3 rounds)

Design, predicates, and probe classes were fixed in `../PREREGISTRATION.md` before any run. Cells: **A** = probes only · **B** = probes + 30 dispatch instructions, consistent · **C** = probes + 30 dispatch instructions, 5 pairs directly contradicting. B and C carry identical counts and identical canaries at identical positions, so only *conflict* varies between them.

### Every cell, every round

| Cell | Round 1 | Round 2 | Round 3 | Mean | **Spread** |
|---|---|---|---|---|---|
| **A / control**—pile-specific (5) | 5/5 | 5/5 | 5/5 | 100% | **0 pp** |
| **A**—all probes (10) | 10/10 | 10/10 | 10/10 | 100% | **0 pp** |
| **B / volume**—pile-specific | 5/5 | 5/5 | 5/5 | 100% | **0 pp** |
| **B**—all probes | 10/10 | 10/10 | 10/10 | 100% | **0 pp** |
| **B**—dispatch canaries (5) | 5/5 | 5/5 | 5/5 | 5.0 | **0** |
| **C / conflict**—pile-specific | 5/5 | 5/5 | 5/5 | 100% | **0 pp** |
| **C**—all probes | 10/10 | 10/10 | 10/10 | 100% | **0 pp** |
| **C**—dispatch canaries (5) | 5/5 | 5/5 | 5/5 | 5.0 | **0** |

**90 of 90 probe items PASS. 45 of 45 pile-specific items PASS. 30 of 30 canaries PASS. Zero INDETERMINATE. Zero spread in every cell.**

By the pre-registered decision rule (spread ≤ 20 pp ⇒ decidable), **this is decidable and it does not wobble.** The one measurable difference between cells is reply *length*—A ran 6,328 chars mean against B's 2,045—which is the length instructions doing exactly what they said, not a degradation.

### Zero-event bounds (Rule of Three, the series' standing discipline)

0 failures in N gives a 95% upper bound of 3/N:

- pile-specific rule adherence: 0/45 → **true per-item failure rate < 6.7%**
- all probes: 0/90 → **< 3.3%**
- dispatch-canary adherence under 5 live contradictions: 0/30 → **< 10%**

### The qualitative result is the sharper one

**In 3 of 3 conflict runs the worker detected the contradictions, enumerated them by number, and stated its resolution rule**—*"requirements 2/26, 4/27, 15/28, 19/29 and 23/30 are mutually exclusive, so the responder followed the lower-numbered rule of each pair"* (r1-C), *"flagged not silently resolved ... kept the first of each pair"* (r2-C), *"followed the earlier of each pair"* (r3-C). Same resolution rule, three independent runs.

**At this dose the failure mode Anthropic warns about did not appear as silent degradation. It appeared as detection, disclosure, and a deterministic tie-break.** That is a materially different failure mode from the one the blog sentence implies, and it is the finding most worth carrying forward.

### Scorer correction, disclosed

The pre-registered **P9 v1** predicate scored FAIL on r1-A and r1-C, both of which had answered correctly (*"No—don't write that sentence ... no raw-token win"*). The predicate required a comma after "No" and a closed phrase list—an **instrument defect, not a finding.** P9 was amended to **v2**, which requires *both* a denial signal *and* the token-direction evidence—strictly **tighter** than v1, not looser—and **all nine runs were re-scored under v2.** Under v1 the table would have read A 80/100/100 and C 80/100/100; under v2 all cells are 100. Both are stated here. Precedent: CoalTipple 2026-07-03, where a gold bug was found mid-run, fixed, and every cell re-scored.

---

## What this does NOT show—read this before quoting any number above

1. **A ceiling result cannot measure a slope.** Every cell sat at 100%. The instrument therefore has **no resolution below its ceiling**: it can prove adherence is high, and it cannot rank A against B against C. **H1 and H2 are NOT confirmed and NOT refuted—they are untested at their own margin**, because nothing degraded enough to compare.
2. **We never varied the pile itself.** Editing the rule files was forbidden for this task and the platform injects the whole stack at spawn regardless of cwd. **The dose rode the DISPATCH channel, which is not the system-prompt channel Anthropic's sentence is about.** Nothing here is a replication of their setup and it must never be quoted as one.
3. **No zero-pile arm exists**, so absolute adherence is attributable to the pile only through the PILE-SPECIFIC/GENERIC-OVERLAP split—a weaker instrument than a real control.
4. **The workers are not decorrelated and their agreement is not independent evidence.** All nine received the same governance stack at spawn (measured 2026-07-26). Every worker said so unprompted—*"I am a mirror confirming that the stack which arrived with my spawn contains answers to the ten questions the stack itself anticipated"* (r2-A). **What Arm 4 measures is that the pile is internally sufficient and self-consistent on these ten surfaces, and that it survives 30 competing instructions. It does not measure whether the pile is TRUE.**
5. **The pile moved during the run.** Waves 2 and 3 straddled live edits totalling +6,875 net chars. Since every cell scored identically before and after, this did not visibly matter—but the runs are **not** all against one byte-identical pile, and the snapshot hashes above are the honest pin.
6. **n=3 per cell, 5 items per headline.** Only large effects are visible.
7. **`blind-ic`'s own role prompt is a constant additive instruction load** present in all nine runs. It cannot confound the between-cell contrast; it may raise the absolute baseline.

---

## The answer to the question as asked

- **H3 (the 200-line tip): FALSE for us, decisively and deterministically.** `AGENTS.md` passes at 188 lines while carrying **7.0×** the content of a compliant 200-line file. The tip's unit does not measure its own target on this corpus. **If the tip is adopted, adopt it in tokens (~8.7k for a 200-line-equivalent), never in lines.**
- **H2 (contradiction): the mechanism is real in our pile—one HARD live instance verified at `hooks-safety.md:104` vs `:122`—but its predicted behavioural cost did not appear at the dose tested.** Conflict was detected and disclosed 3/3 times rather than silently degrading anything.
- **H1 (volume): NOT ANSWERED, and saying so is the result.** At ~79.3k estimated tokens of always-injected governance, adherence to ten pile-dictated behaviours is at ceiling—0 failures in 90 observations, < 3.3% true failure rate at 95%. **That locates us on a plateau; it does not locate the cliff, and no run here can.**

## What would reduce the remaining uncertainty (the next arm, not run)

The ceiling is the binding limitation, so the next arm must **push until something breaks**, not repeat this one. Concretely: escalate the dispatch dose (30 → 100 → 300 instructions) and the conflict density (5 pairs → 25 pairs) until the canary compliance rate leaves 5/5, then bisect. That locates the knee of the curve on the channel we *can* vary. Until an arm actually produces a failure, any "our pile is fine" claim rests on a ceiling result and must say so.

**A true test of H1 needs the pile itself varied**, which requires ownership of the rule files and a quiet window with no concurrent editor. That is a main-level scheduling decision, not a benchmark one.
