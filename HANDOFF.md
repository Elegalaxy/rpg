# Project Handoff State

- **Last Updated By:** Claude Code (2026-11-16)
- **Current Goal:** Step 13.9 Run screen layout and fight limit is done (parts 1-2). Step 13.7/13.8 still wait for the user's playtest, then closing into a 0.x.0 changelog heading.
- **Recent Changes & Files Touched:**
  - Part 1 (UI): `src/ui/map/ExpeditionPanel.tsx` Running panel split into `RunBar` (sticky: status, Push on, Return to town, Auto-escape), `FightArea` directly under it, `RunHeadline` (HP, Fights won, Loot bag, Carried gold) and `RunDetails` (collapsed `Collapsible`, banked/run gold, momentum, standing orders, Carrying/Safe pouch/Secured, Supplies). CSS `.run-bar` / `.run-area` at the end of `kit.css`. `Collapsible` got optional `persistKey` (localStorage, try/catch). Run dock is not shown on the Map, so no collision; the status header does not really stick, so the bar uses `top: 0`.
  - Part 2: standing order "Stop after N fights". `SavedHero.stopAfterFights` (`number | null`, 1-99) in `save.ts`/`roster.ts`/`preparation.ts` (draft field optional); `fightLimitReached` in `world.ts`; offline `decideAtHold` (before the HP floor, `walkedHomeFights` in summary and `ordersLine`); live walk-home in `advanceExpedition` (`store.ts`); input next to Push on and "Fight n / N" in the bar. Rule in GAME_DESIGN (offline standing orders). Tests: `preparation.test.ts`, `offline.test.ts`, `src/ui/map/fightLimit.test.tsx`, runTruth bar test.
- **Active Decisions / Constraints:**
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Do not change the golden duel-basic snapshot. Never remove `// admin code`.
  - One commit per finished part, pushed to `origin/main`, no force-push. Every game-changing commit adds a line under `Unreleased` in `CHANGELOG.md`.
  - Fight limit counts `history.length` of the current run; a repeat is a new run and counts from 0; a repeat still needs the route cleared.
  - The sim (`src/sim`) was not touched; guards byte-identical.
- **Not verified:** the live auto walk-home in a real browser fight (the pane's clock ran very slowly; covered by `fightLimit.test.tsx`); the 375 px bar (166 px tall, measured, no horizontal overflow) with a fight limit shown; plus earlier items: stacks in a real 375 px fight, Tyrant at Power 68, Cinder Scar items, defeat-rest start refusal, keyboard focus ring, true HP regen rate, 300-run matrix diff.
- **Exact Next Step:** (1) User playtest of the sticky run bar, Run details and the fight limit, plus rule stacks, Causeway, Hollows, Cinder Scar. (2) After the playtest, close Steps 13.7, 13.8 and 13.9 into a `## 0.x.0 · date · name` changelog heading.
