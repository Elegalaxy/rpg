# Project Handoff State

- **Last Updated By:** Claude Code implementer (2026-11-18), Step 13.25
- **Current Goal:** Step 13.25 "Playtest fixes" is done (parts A to D, one commit each, pushed to origin/main). Next is the user's playtest.
- **Recent Changes & Files Touched:**
  - A (Fixed): a kill bounty now counts every enemy that dies in a won fight, summons included (Echo Knight's Oathbound Echo). `ExpeditionEncounterRecord.slain?` (defIds of dead enemies) is recorded in `finishEncounter` (`src/sim/expedition.ts`, no behaviour change); `unitsFrom` (`src/persist/contracts.ts`) counts it and falls back to encounter members for old history. `encounterEnemyIds` (members plus summons) in `src/content/contracts.ts` is shared by Auto run's `contractFitsRoute` (`src/persist/autoContracts.ts`) and `contractZone`.
  - B: the contract tracker (map and fight) shows `Name (Zone / Zone)`; `contractZone(target)` derives it, `ContractTrackRow.label` carries it. Board rows already had the zone in their description.
  - C: Trading Post sells 1, 10, 100 (hidden above the stack) and all, each with its gold (`src/ui/town/Town.tsx`, test `TradingPost.test.tsx`). No material buying.
  - D: Guide gets Gear and Greyhaven topics (`src/content/guide.ts`, no digits), sections Gear and Greyhaven, generated modifier and base-item entries (`src/ui/guide/guideIndex.ts`), tests, GAME_DESIGN section 12 line.
- **Active Decisions / Constraints:**
  - The modifier stack cap (2) applies to every modifier. Hauler's gives +3 bag room per counted piece, so at most +6, chest armor or accessory only.
  - Guards (telegraph, built, modded, cinder, hollows, warden, causeway, elites at seed 1 x 5) identical to origin/main apart from the runs/sec line.
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Never remove `// admin code`. One commit per part, pushed to `origin/main`, every game change adds a `CHANGELOG.md` line under `Unreleased`. `npm test` rewrites the scenarios snapshot: restore it, never commit it.
- **Not verified:** the Trading Post buttons at 375 px and the new Guide sections in a browser (tests only). A summoned-kill count in a real simulated Echo Knight fight is covered by synthetic history only.
- **Exact Next Step:** (1) User playtest: take an Echo bounty, fight at the Bastion, check it counts; look at the tracker label and the Trading Post steps. (2) Check the Guide Gear and Greyhaven sections in the browser. (3) Close 13.25 into a `## 0.x.0` changelog heading.
