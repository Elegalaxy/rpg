# Project Handoff State

- **Last Updated By:** Claude Code (2026-11-08)
- **Current Goal:** Step 12.6 Offline extras is done and pushed (6 parts, commits c7ad1e7..1403cc3 plus the browser-check commit). Notifications were deferred by the user.
- **Recent Changes & Files Touched (Step 12.6):**
  - Docs: GAME_DESIGN §11 "Offline extras" and Roster rules; IMPLEMENTATION_PLAN Step 12.6.
  - Run limit: `SavedHero.repeatLimit` (0,1,3,5,10,25; `REPEAT_LIMITS` in `save.ts`), stop `runLimit` in `offline.ts`, select in `ExpeditionPanel.tsx`.
  - Other heroes: `SavedHero.awayRun`; `offline.ts` runs lanes (selected hero first, then heroes with an away route) via `withView` (swaps the hero's awayRun in as the selected hero's expedition and back). `AwayReport` = shared facts + `HeroAwaySummary[]`. `selectHero` promotes a background run, `deleteHero` refuses with one. Seeds fixed: `laneSeed` folds `lastSeenAt` into int32 (old code threw for real timestamps).
  - UI: `AwayReportView` table in `AwayPanel.tsx`; Roster badge from `src/persist/awayStatus.ts`.
  - Background ticking while the page is open: `advanceBackground` (persist) and `tickBackground` in `store.ts` on the 10 s heartbeat and on hide/pagehide, before the save stamps `lastSeenAt` (no double count).
  - Mastered routes: `SavedHero.routeReturns`, `MASTERY_RETURNS = 10`, `routeMastery` in `world.ts`; x8 in `PLAYBACK_SPEEDS` (`MASTERED_SPEED`), gated in `store.ts`; Mastery n/10 on the Map.
  - Tests: 935 pass (offline, roster badge, away table, mastery).
- **Active Decisions / Constraints:**
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Do not change the golden duel-basic snapshot. Never remove `// admin code`.
  - No shared vault. One commit per finished part, pushed to `origin/main`, no force-push.
  - `save.expedition` stays the selected hero's run; other heroes keep theirs in `awayRun`. Do not make it a per-hero map.
  - Known limit: a run parked by the run limit in the background is continued by a later reload catch-up (limit counts runs per catch-up).
  - x8 is live only; offline loot and the 0.5 rate are unchanged.
- **Not checked in the browser:** a defeat of a background hero, selecting a hero with a live background run mid-fight (only the persist level is tested), bag-full order for a background hero.
- **Exact Next Step:** (1) User playtest of the offline extras (two heroes with away routes, Away table, Roster badges, x8). (2) Open items from before: Colossus and Warden tuning, Warrior/Cleric class work, Grove/Bastion materials. (3) Later: notifications (deferred).
