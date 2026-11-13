# Project Handoff State

- **Last Updated By:** Claude Code (implementer, 2026-11-13)
- **Current Goal:** Step 13.7 batch 6 (UI rework), done in parts. Parts 1 (quick wins) and 2 (run dock) are committed and pushed. Bug batches 1-5 and the What's new page are in.
- **Recent Changes & Files Touched (Part 2, run dock):**
  - `src/ui/RunDock.tsx` (view + container), `src/ui/runDockState.ts` (visibility rule, collapse storage `rpg.runDockCollapsed`, folded by default), `src/ui/runDock.css`, `src/ui/runDock.test.tsx`. Mounted once in `src/ui/App.tsx` (`shell-docked` class on `.shell`); css imported in `src/main.tsx`.
  - `src/ui/HoldActions.tsx`: shared Push on / Return buttons with a reserved message line; used by the Running panel (`ExpeditionPanel.tsx`) and the dock.
  - `setRepeatRouteFromUi` in `src/ui/store.ts`: flips the hero's existing `repeatRoute` during a run (savePreparation refuses while a run exists, so it patches the hero directly); mastered route only (`routeMastery`, 10 safe returns). No save-format change. Rule recorded in GAME_DESIGN section 11 (Run dock).
  - Layout: from 1280 px a sticky card in a third `.shell` column; under 1280 a fixed bottom bar (left 280 px from 900 px); collapsed height 61 px; hidden on the Map tab and with no live run.
  - Nothing in `src/sim` changed; no snapshot changed.
- **Active Decisions / Constraints:**
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Do not change the golden duel-basic snapshot. Never remove `// admin code`.
  - No shared vault between heroes. One commit per finished part, pushed to `origin/main`, no force-push.
  - Guards must stay byte-identical. Every game-changing commit adds a line under `Unreleased` in `CHANGELOG.md`.
  - Approved defaults: upgrade queue unlimited with costs paid at queue time, "Queue all" queues every affordable worn item, optional `chained` job field, old saves must load.
  - Combo stacks still need a design description from the user.
- **Not verified:** dock in a live fight (Escape now, enemies left) and the mastered repeat toggle in the browser (unit-tested only); Tyrant at Power 68; Cinder Scar offline route; user playtest.
- **Exact Next Step:** Part 3: town lists (enchanter grouped by item kind, then unlock level, then gold; new-modifier badge; batch brewing Brew 1/5/max; material sources "where to find") plus grouped collapsible sections for the crowded combat-setup lists. Then Part 4: upgrades (unlimited queue, Queue all, costs paid at queue time, optional `chained` job field). Then Part 5: map layout.
