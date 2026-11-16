# Project Handoff State

- **Last Updated By:** Cursor (2026-11-16)
- **Current Goal:** Step 13.12 gear wear is done. Socket and rank lists stay open under their job tab. Next is the user's playtest of repair as a routine cost.
- **Recent Changes & Files Touched:**
  - `src/ui/town/Ranks.tsx`, `src/ui/town/Sockets.tsx`: the fold is gone. The count line and the rows show immediately.
  - Wear: `src/persist/world.ts` (`gearWearOf`, settle), outcome card note in `src/ui/map/ExpeditionPanel.tsx`, tests in `src/persist/gearWear.test.ts`.
- **Active Decisions / Constraints:**
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Do not change the golden duel-basic snapshot. Never remove `// admin code`.
  - One commit per finished part, pushed to `origin/main`, no force-push. A game-changing commit adds a line under `Unreleased`.
  - Implement in a worktree from `main`, then remove that worktree when the push is done.
  - Wear is persist-only. Repair prices unchanged. Defeat still costs a flat 10, and wear stacks. Runs of 1 to 2 wins wear nothing.
- **Exact Next Step:** User playtest of repair cost over several runs, and of the open socket and rank lists. Tune `WEAR_FIGHTS_PER_POINT` if repair feels too cheap or too dear.
