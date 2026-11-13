# Project Handoff State

- **Last Updated By:** Claude Code (2026-11-14)
- **Current Goal:** Step 13.7 playtest fixes (feedback of 2026-11-11). Bug batches 1-5 and UI rework batch 6 (parts 1-5) are all committed and pushed. Remaining: browser check of batches 1-6 and the user playtest.
- **Recent Changes & Files Touched:**
  - Batch 6 part 5 (map layout): `NODE_POSITIONS` moved from `src/ui/map/MapView.tsx` to new `src/ui/map/layout.ts` (hub and spokes, 540x330 viewBox); new `src/ui/map/layout.test.ts` (every leg >= 24 px from non-end nodes, node plus label inside the viewBox, every node positioned). Road to Cinder no longer passes Hollows. Cinder Scar sits at 490,245 and Fallen Bastion at 270,148 (changed from the brief so the Cinder leg clears the Bastion node and label). `CHANGELOG.md` updated. No sim, content, save or snapshot change.
  - Batch 6 parts 1-4: quick wins (Contract Board first, walking x8/x16, help, away route column, escape banner), run dock, town lists (enchanter folds and new badge, batch brewing, material sources), upgrades (unlimited queue, Queue all, Show all/fewer).
  - Earlier: batches 1-5 (durability carry-over, run-panel truth, no layout shift, shop compare, fractional regen), What's new page (482a4f8).
- **Active Decisions / Constraints:**
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Do not change the golden duel-basic snapshot. Never remove `// admin code`.
  - No shared vault between heroes. One commit per finished part, pushed to `origin/main`, no force-push.
  - Guards stay byte-identical (reference CSV, warden, causeway, hollows, built, telegraph, elites, cinder).
  - Every game-changing commit adds a line under `Unreleased` in `CHANGELOG.md`.
  - Combo stacks stay deferred until the user gives a design description.
- **Not verified in the browser:** filled escape banner; x16 walking on a mastered route; run dock mid-fight and the mastered repeat toggle; enchanter new-recipe badge; Show all/fewer in the upgrade queue; the Tyrant at Power 68, cinderite drop and Salvage; offline and away route with Cinder Scar; batches 1-5 in general. Map layout was checked at desktop and 375 px.
- **Exact Next Step:** (1) Browser check of batches 1-6 using the list above. (2) Ask the user for a design description of combo stacks. (3) User playtest of the Causeway, Hollows and Cinder Scar; then close Step 13.7 by moving the `Unreleased` lines under a new `## 0.x.0` heading in `CHANGELOG.md`.
