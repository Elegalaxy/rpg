# Project Handoff State

- **Last Updated By:** Claude Code implementer (2026-11-16)
- **Current Goal:** Step 13.15 (away rules follow Auto run) is done, parts 1 to 4. Next is the user's playtest, then closing 13.12 to 13.15 into a `## 0.x.0` changelog heading.
- **Recent Changes & Files Touched (UI and persist only; sim, harness, content defs, saves and snapshots untouched):**
  - Part 1 docs: GAME_DESIGN §11 "Away rules for a run"; plan Step 13.15.
  - Part 2: `persist/offline.ts` lane modes (`auto`, `away`, `hold`), stops `held` and `autoLimit`, `awayBanner`, `createOffline(..., autoFights)`; `persist/world.ts` `autoRerunRefusal` (shared with the live `afterAutoRun` in `ui/store.ts`); `finishCatchUp` carries the session count and sets the Auto run notice. Tests: `persist/offline.away.test.ts` (new), `offline.test.ts` (old away-order tests now use `runOwn`), `ui/map/autoRun.test.tsx` (0 durability at the live rerun).
  - Part 3: `ui/AwayPanel.tsx` banner list (`away-banner-<heroId>`), new status tags; `ui/AwayPanel.test.tsx`.
  - Part 4: `ui/map/ExpeditionPanel.tsx` texts (groups, Help, "What will happen"); `expedition.test.tsx`.
- **Active Decisions / Constraints:**
  - Auto run is the one switch for continuing a run while away; Auto off holds at Push on (only the per-run fight limit walks home). The away route starts only with no run at all.
  - Auto lanes ignore `repeatRoute`, the cleared-route rule and `repeatLimit`. Background heroes continue only on their away route or with their own Auto run on (such a hero now becomes a lane).
  - Auto run's session count continues from the live count when the replay starts.
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Never remove `// admin code`. One commit per part, pushed to `origin/main`, every game change adds a `CHANGELOG.md` line under `Unreleased`.
- **Not verified:** a real away replay and the return banner in the browser (only static tests); an ended-uncollected defeat still shows "Defeated" on every return (old behaviour, unchanged).
- **Exact Next Step:** (1) User playtest: leave mid-run with Auto run off and on, and with an away route. (2) Close Steps 13.12 to 13.15 into a `## 0.x.0 · date · name` changelog heading.
