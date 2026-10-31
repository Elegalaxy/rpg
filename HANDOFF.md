# Project Handoff State

- **Last Updated By:** Claude Code
- **Current Goal:** First playable is built through Step 11.1. Step 11.2 (success-criteria playtest) is waiting on the user.
- **Recent Changes & Files Touched:**
  - Stages 6-10 and Step 11.1 are committed and pushed to `origin/main` (last code commit 56ab991).
  - 11.1: `src/ui/App.tsx` (start screen, header, tabs, exported `CombatViewer`), `src/persist/guidance.ts` (`nextHint`), `src/persist/walkthrough.test.ts`.
  - 11.2: matrices run (seed 1, 50 runs): combos errors 0; reference shows only accepted misses. Results and the §15 table are in `doc/IMPLEMENTATION_PLAN.md` Step 11.2 Progress.
  - `npm test` 640 tests, typecheck and lint clean on 2026-11-01.
- **Active Decisions / Constraints:**
  - Do not change combat coefficients to force a matrix match. Do not change the golden duel-basic snapshot. Never remove `// admin code`.
  - Preserved checks: duel-basic seed 42 victory 20688 ms; road seed 5 `encounters 4 victories 3 defeats 0 timeouts 0 retreats 1`, 8 shard, 8 hide, 4 scrap.
  - One commit per finished step, pushed to `origin/main`. No force-push.
  - Known gaps: page unstyled; no skill-allocation policy in the harness; no floor build beats the Rootmaw Stalker.
- **Exact Next Step:** The user plays from a fresh profile and marks §15 criteria 2, 5, 6, 7, 10 pass or fail in Step 11.2 Progress, then sets the step to `verified`. Then decide whether to tune elite difficulty (record in GAME_DESIGN first).
