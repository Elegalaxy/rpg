# Project Handoff State

- **Last Updated By:** Claude Code implementer (2026-11-17)
- **Current Goal:** Step 13.22 "Crafted backpack". Parts 1 and 2 are done; the work is PAUSED at the part 2 go/no-go. Parts 3 (persist) and 4 (UI) are not started and wait for the user's decision.
- **Recent Changes & Files Touched:**
  - Part 1 docs: GAME_DESIGN §9 Inventory ("Crafted backpack (Step 13.22)": Satchel 5 slots, level 10, grade 2+ material x8, 400 gold; Field Pack 6 slots, level 17, grade 3+ x10, 1,200 gold, needs the Satchel; kept through reincarnation) and the §10 carries-over list; IMPLEMENTATION_PLAN Step 13.22.
  - Part 2 sim and harness: `ExpeditionBlueprint.supplySlotCount` and `MAX_SUPPLY_SLOTS = 6` in `src/sim/expedition.ts` (default 4, no new state key, `assertExpedition` takes 4 to 6 slots); `src/harness/pack.ts`, `pack.test.ts`, `--matrix pack` in `cli.ts`; test in `src/sim/expedition.test.ts`.
  - Persist and UI untouched (`SUPPLY_SLOT_COUNT` is still used by preparation.ts, save.ts, ExpeditionPanel, SupplyCard, Town).
- **Measured (seeds 1-3 x 100, mean wins, 4 / 5 / 6 slots, 20 cells = 4 elites x 5 classes):** crafted prepared mean 88 > 96 > 98, cells at 95 or more 5 > 16 > 17; plain prepared mean 58 > 84 > 93, cells at 95 or more 0 > 4 > 13. Crafted 6 over 5 is at most +5 in every cell. Full tables in GAME_DESIGN §9.
- **Active Decisions / Constraints:**
  - The go/no-go trigger (crafted 95% or more in most elite cells) is hit. The user decides: keep 6, cap at 5, limit stacks per supply, or raise the elites.
  - Numbers go in `doc/GAME_DESIGN.md` before code. Never remove `// admin code`. One commit per part, pushed to `origin/main`; every game change adds a `CHANGELOG.md` line under `Unreleased` tagged [13.22].
  - `npm test` rewrites `src/content/__snapshots__/scenarios.test.ts.snap`; restore it with `git checkout --` and never commit it.
- **Not verified:** nothing in the UI exists yet, so no browser check.
- **Exact Next Step:** (1) User decides the cap. (2) Part 3: `src/persist/pack.ts` (+test) with cost, requirement and slot helpers; `SavedHero.pack?` (absent = none, no migration needed); a `pack` craft job (see `queueSocket` and `finishJob` in `persist/crafting.ts`, `assertJob` in `save.ts`); `blueprintForHero` sets `supplySlotCount` only above 4; `preparation.ts` and `save.ts` use the hero's slots instead of `SUPPLY_SLOT_COUNT`; `reincarnate` already spreads the hero, so add a test. (3) Part 4: `PackWorkshop.tsx` at the Armorer, supply slots in the preparation screen, Potion Shop "Buy N / Brew N" and Town text read the hero's slots.
