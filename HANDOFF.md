# Project Handoff State

- **Last Updated By:** Claude Code implementer (2026-11-18)
- **Current Goal:** Step 13.26 "Auto run modes" is done (parts 1 to 4). Next is the user's playtest.
- **Recent Changes & Files Touched:**
  - Docs: GAME_DESIGN §11 "Auto run modes" and "Auto run contracts", plan Step 13.26, CHANGELOG `Unreleased` [13.26] (two New lines).
  - Mode: `SavedHero.autoRunMode?: 'repeat' | 'endless'` (`persist/save.ts`, validated; kept by reincarnation through `...hero`). `isEndlessAutoRun` and the mode inside `decideHold` (`persist/world.ts`): endless gives `push` at every hold, so the live loop (`ui/store.ts`) and the away replay (`persist/offline.ts`) needed no new branch. Away summary `endless`/`endlessRetreats` and a banner (`offline.ts`). Draft field in `persist/preparation.ts`.
  - Contracts: `SavedHero.autoContracts?: boolean`; `persist/autoContracts.ts` (`autoContractsStep`, `contractFitsRoute`) called after a safe return is settled and before the rerun, in `store.ts afterAutoRun` and `offline.ts rerun`. Away summary `contractsHandedIn`/`contractsTaken`, a line in `ui/AwayPanel.tsx`.
  - UI: "When the route ends" select, mode note, no-retreat warning, "Hand in and take contracts at home" checkbox in `ui/map/ExpeditionPanel.tsx`; "Auto · endless" tag in `ui/RunDock.tsx`; styles in `ui/kit.css`; two Guide sentences in `content/guide.ts` (expeditions topic).
  - Tests: `persist/autoRunMode.test.ts`, `persist/autoContracts.test.ts`, additions in `ui/map/autoRun.test.tsx` (live loop, live vs away agreement, render) and `persist/preparation.test.ts`.
- **Active Decisions / Constraints:**
  - Endless ignores Stop after fights, the push-on HP floor and the bag order; it ends by retreat (then the route reruns), defeat, or the total fight limit. Loot that does not fit is lost.
  - Contract matching: kill = enemy in an encounter at a route node, fights = node on route, encounters = encounter at a route node, secure = a route node's resource. Summoned enemies are not considered (tidy-ui 13.25 had not landed). The board is rerolled on return, so the offers taken come from the refreshed board.
  - Sim, harness and content untouched. Never remove `// admin code`. `npm test` rewrites the scenarios snapshot: restore it, never commit it.
- **Not verified:** the preparation screen and dock in a browser or at 375 px (render tests only); guard matrices were not re-run (no sim change).
- **Exact Next Step:** (1) User playtest: endless with and without a retreat level, contracts toggle over a few reruns. (2) Consider counting summoned enemies for bounty matching once 13.25 is on main. (3) Close 13.26 into a `## 0.x.0` changelog heading.
