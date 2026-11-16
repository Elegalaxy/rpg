# Project Handoff State

- **Last Updated By:** Claude Code implementer (2026-11-16)
- **Current Goal:** Step 13.14 Auto run is done (parts 1-3). Step 13.13 (rule chain view) is built by another implementer; see the plan and the git log.
- **Recent Changes & Files Touched (13.14):**
  - Docs: GAME_DESIGN section 11 "Auto run", plan Step 13.14.
  - `SavedHero.autoRun`, `autoRunMaxFights` (optional, validated, no version bump) in `persist/save.ts`; draft fields in `persist/preparation.ts`.
  - `decideHold` and `routeCleared` in `persist/world.ts`, shared by `persist/offline.ts` (away) and `advanceExpedition` in `ui/store.ts` (live). `afterAutoRun` settles and reruns the same route on any startable route (independent of `repeatRoute`), or switches Auto run off at the session limit, a defeat or a refused start (`getAutoNotice` shows why). `autoFights` count is in memory.
  - UI: preparation fieldset and run bar toggle/status (`ui/map/ExpeditionPanel.tsx`), dock chip and checkbox (`ui/RunDock.tsx`), sidebar gold total (`ui/GoldLine.tsx`, `ui/goldTotals.ts`).
  - Tests: `ui/map/autoRun.test.tsx`, `ui/goldLine.test.tsx`; `preparation.test.ts` default draft gained two fields.
- **Active Decisions / Constraints:**
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Do not change the golden duel-basic snapshot. Never remove `// admin code`.
  - One commit per finished part, pushed to `origin/main`, no force-push. A game-changing commit adds a line under `Unreleased`.
  - Auto run limit stop leaves the finished run on the outcome card for the player to collect; a defeat also switches Auto run off. Away behaviour, sim and harness are unchanged.
  - Doc files use CRLF; edit them without converting line endings.
- **Not verified:** a long Auto run across several repeated runs in the browser; the away report is unchanged and was not rechecked in the browser.
- **Exact Next Step:** User playtest of Auto run on a cleared route (limit of fights, repeat), then the 13.7 to 13.14 release heading in the changelog when the user is ready.
