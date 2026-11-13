# Project Handoff State

- **Last Updated By:** Claude Code (2026-11-14)
- **Current Goal:** Step 13.7 batch 6 (UI rework). Parts 1-4 are committed and pushed (quick wins, run dock, town lists, upgrades). Part 5 (map layout) is next. Step 13.6 Cinder Scar is closed as done with accepted deviations.
- **Recent Changes & Files Touched:**
  - Batch 6 part 4 (upgrades): the craft queue has no limit (craft and upgrade jobs; `QUEUE_MAX` removed, save check no longer caps it). An item may have several +1 upgrade jobs in a row: `queueUpgrade` marks the previous job for that item `chained: true` (optional field on the upgrade job in `src/persist/save.ts`, absent in old saves) and the new job holds the projected item (`itemLevel + 1`, `upgradedQuality`). `finishJob` gives craftXp but returns nothing for a chained job. `upgradeCandidates` and `planUpgradeAll` added in `src/persist/crafting.ts`; `queueUpgradeAllFromUi` in `src/ui/store.ts` (one commit, stops at first refusal). UI in `src/ui/town/Craft.tsx` and `src/ui/kit.css`: Queue all with its own material select, per-item rows (Level, Quality, Time, cost, own material, "queued +k"), queue list shows "lvl a -> b" and folds beyond 5 with "Show all N". Tests in `src/persist/crafting.test.ts`. Design in `doc/GAME_DESIGN.md` section Crafting.
  - Earlier: batches 1-5, What's new page, batch 6 parts 1-3 (Contract Board first, walking x8, run dock, town lists).
- **Active Decisions / Constraints:**
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Do not change the golden duel-basic snapshot. Never remove `// admin code`. Nothing in `src/sim` changes in batch 6.
  - No shared vault between heroes. One commit per finished part, pushed to `origin/main`, no force-push.
  - Guards stay byte-identical (reference CSV, warden, causeway, hollows, built, telegraph, elites, cinder).
  - Every game-changing commit adds a line under `Unreleased` in `CHANGELOG.md`.
  - There is no way to cancel a craft job; if one is added, only the last job of a chain may be cancelled and it must clear `chained` on the job before it.
  - Queue all is for worn items only; archive items are upgraded one row at a time.
- **Not verified:** the Tyrant at Power 68 in the live UI, cinderite drop and Salvage; offline and away route with Cinder Scar; `--expedition cinder-scar` after the tier change; batches 1-6 in the browser end to end (part 4 was checked at desktop and 375 px with a hand-edited save).
- **Exact Next Step:** (1) Part 5: map layout. (2) Browser check of batches 1-6. (3) Combo stacks need a design description from the user before any work. (4) User playtest of the Causeway, Hollows and Cinder Scar.
