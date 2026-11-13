# Project Handoff State

- **Last Updated By:** Claude Code (implementer, 2026-11-13)
- **Current Goal:** Step 13.7 batch 6 (UI rework), done in parts. Part 1 (quick wins) is committed and pushed. Bug batches 1-5 and the in-game What's new page are already in.
- **Recent Changes & Files Touched (Part 1):**
  - Contract Board is the first town tab and the default (`src/ui/App.tsx` `TOWN_PARTS`; `PLACES` in `src/content/places.ts` unchanged).
  - Walking plays at x8, x16 on a mastered route: `TRAVEL_SPEEDUP = 8`, `MASTERED_TRAVEL_SPEEDUP = 16`, `travelSpeedup()` in `src/ui/store.ts`; panel text in `src/ui/map/ExpeditionPanel.tsx`; recorded in GAME_DESIGN section 11; tests in `expedition.test.tsx`, `mastery.test.tsx`.
  - Mastery help (`src/ui/masteryHelp.ts`, used in `MapView.tsx` and the locked 8x note in `App.tsx`); `.kpi-note .help-tip` opens leftwards in `map.css`.
  - `src/ui/town/QualityHelp.tsx` used in `Equipment.tsx` ItemFacts and the Craft Upgrade heading (claim checked against `upgradedQuality`: never lowers).
  - `HeroAwaySummary.routeId` (`src/persist/offline.ts`, memory-only) and a Route column in `src/ui/AwayPanel.tsx`.
  - Escape banner `.fight-escape-banner` in `src/ui/combat/FightView.tsx` (+ `combat.css`, test in `fightControls.test.tsx`); run chips show "Escaped" with an arrow icon.
  - Nothing in `src/sim` changed; no snapshot changed.
- **Active Decisions / Constraints:**
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Do not change the golden duel-basic snapshot. Never remove `// admin code`.
  - No shared vault between heroes. One commit per finished part, pushed to `origin/main`, no force-push.
  - Guards must stay byte-identical. Every game-changing commit adds a line under `Unreleased` in `CHANGELOG.md`.
  - Approved defaults: upgrade queue unlimited with costs paid at queue time, "Queue all" queues everything affordable; live auto-repeat toggle at mastery; docked collapsible run mini-panel (top-right wide, bottom on mobile).
- **Not verified:** the escape banner filled state in the live UI (only unit-tested; empty reserved state seen at 375 px); Tyrant at Power 68, Cinder Scar offline route; user playtest.
- **Exact Next Step:** Part 2: run mini-panel (dock; include a live auto-repeat toggle at mastery in the dock). Then Part 3: town lists + combat setup list grouping; Part 4: upgrades (unlimited queue, Queue all queues everything affordable, costs paid at queue time); Part 5: map layout.
