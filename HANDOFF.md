# Project Handoff State

- **Last Updated By:** Claude Code implementer (2026-11-19)
- **Current Goal:** Step 13.34 "Fifth skill slot" is done (parts 1 to 4). A Legacy purchase (90, once, hero-bound) raises the loadout from 4 to 5 skills, now and in every later life. Next is the user's playtest.
- **Recent Changes & Files Touched:**
  - Docs: GAME_DESIGN §10 "Fifth skill slot", plan Step 13.34, CHANGELOG `Unreleased` [13.34].
  - Sim (part 2): `LOADOUT_SLOT_COUNT` 4, `MAX_LOADOUT_SLOTS` 5, `setLoadout(progress, ids, slotCount)`; harness `--matrix slots` (GO).
  - Persist (part 3): new `src/persist/skillSlots.ts` (`loadoutSlots(hero)`); `save.ts` optional `purchases.fifthSlot` plus check that the loadout fits the slots; `loadout.ts` `saveLoadout` passes the count; `reincarnation.ts` `FIFTH_SLOT_COST`, `'fifthSlot'` kind.
  - UI (part 4): `ui/character/Loadout.tsx` ("of N", "Fifth slot" tag), `Legacy.tsx` row, Guide (`content/guide.ts`, `ui/guide/guideIndex.ts` fact), tests.
- **Active Decisions / Constraints:**
  - Nothing is auto-equipped: after buying, the player picks a fifth skill in Loadout. A new life starts with four starting skills and the fifth slot empty.
  - Absent `fifthSlot` means false, no migration. A save with five equipped skills and no purchase is refused.
  - Combat, content numbers and the default harness are untouched; guards identical.
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Never remove `// admin code`. One commit per part, pushed to `origin/main`, every game change adds a `CHANGELOG.md` line under `Unreleased`. `npm test` rewrites the scenarios snapshot: restore it, never commit it.
- **Risks:** a fifth skill may shift balance for hand-built loadouts; the harness measured it as GO at the prepared tier.
- **Not verified:** see the final report (browser check of Loadout and Legacy at 375 px).
- **Exact Next Step:** (1) User playtest: buy the slot with Legacy, equip a fifth skill, reincarnate and check the slot stays. (2) Close 13.34 into a `## 0.x.0` changelog heading.
