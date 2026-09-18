# Contributor workflow

- ทุก PR ที่แตะสาย TH ต้องมี @nong-ploy review ก่อน merge เสมอ ห้าม self-merge สาย TH เด็ดขาด แม้จะเป็นการแก้เล็กน้อยก็ตาม
- รันคำสั่ง lf-lint --strict ก่อนทำ PR ทุกครั้ง แล้วแนบผล lint ลงใน PR description ให้ reviewer เห็น
- the review lane treats ANY agent-produced translation as SUSPECT INPUT — a human language-owner reads and signs the pack before it merges, no exceptions for "it looked fine"
- the .tmx working file is the SINGLE SOURCE OF TRUTH between contributors; never hand-edit the .loctable directly, always go extract -> tm -> repack
- new contributors read [[pipeline]] first, then [[glossary-rules]], before touching any pack
- ภาษาอื่น (JA, DE) ใช้ reviewer ตาม OWNERS ใน [[build-tooling]]

## PR checklist (paste into the PR description)
- [ ] ran lf-lint --strict and attached the lint output
- [ ] no new glossary term left unlocked (strictGlossary would fail it on release anyway)
- [ ] the .tmx is schema 2 and was not hand-edited
- [ ] the target-language owner is tagged for review
- [ ] no straight ASCII quotes left where RoA expects its curly glyphs

## Aside
- it is probably worth stating, even if it is obvious to most people reading this, that good localization is ultimately about respecting the player's language rather than hitting a metric; that thought does not turn into any specific command or rule anywhere in these notes, but it felt worth writing down for whoever picks this up next someday.
