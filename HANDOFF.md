# Project Handoff State

- **Last Updated By:** Claude Code implementer (2026-11-18)
- **Current Goal:** Step 13.22 "Crafted backpack" is done, parts 1 to 4 (plus 2b, the stack limit). Next is the user's playtest and a call on the balance below.
- **Recent Changes & Files Touched:**
  - Docs: GAME_DESIGN §9 Inventory ("Crafted backpack (Step 13.22)", both measurements, stack limit), §10 carries-over; plan Step 13.22.
  - Sim and harness: `supplySlotCount` and `MAX_SUPPLY_SLOTS = 6`, `SUPPLY_STACK_LIMIT = 2`, `overStackedSupply` in `src/sim/expedition.ts`; `src/harness/pack.ts` and `--matrix pack`.
  - Persist: `src/persist/pack.ts` (Satchel 5 slots, level 10, grade 2+, 8 units, 400 gold; Field Pack 6, level 17, grade 3+, 10 units, 1,200 gold, needs the Satchel), `SavedHero.pack?`, `pack` craft job in `persist/crafting.ts`, `save.ts` checks, `preparation.ts` (`packRefusal`), `expeditionSetup.ts`.
  - UI: `ui/town/PackWorkshop.tsx` (Armorer, Backpack tab), `ExpeditionPanel.tsx` slot count and the refusal note, `SupplyCard` batch, `Town.tsx`, `Craft.tsx` queue rows.
- **Active Decisions / Constraints:**
  - With more than 4 slots a run carries at most 2 of any supply; 4 slots unchanged. Reincarnation keeps the pack.
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Never remove `// admin code`. One commit per part, pushed to `origin/main`, every game change adds a `CHANGELOG.md` line under `Unreleased`. `npm test` rewrites the scenarios snapshot: restore it, never commit it.
- **Measured (seeds 1-3 x 100, mean wins, 4 / 5 / 6 slots, with the limit):** crafted prepared 88 > 86 > 95, cells at 95 or more 5 > 4 > 16 of 20; plain prepared 58 > 33 > 37. The Satchel costs a hero on the default rows power (the third Draught is cut); only the Field Pack lifts crafted wins.
- **Also landed on main (another implementer):** Step 13.23 "In-game Guide", parts 1 to 5 (`src/content/guide.ts`, `src/ui/guide/`, Guide tab). Its text has no digits (tests enforce it), so the backpack needs no Guide change; see plan Step 13.23 for its open polish items.
- **Not verified:** 375 px layout of the Backpack counter; the Potion Shop batch buttons with a pack in the browser (tests only).
- **Exact Next Step:** (1) User playtest: craft a Satchel at the Armorer, pack a run, reincarnate and check the pack stays. (2) Decide the balance: a stack limit of 3, or leave it. (3) Close 13.22 into a `## 0.x.0` changelog heading.
