# Project Handoff State

- **Last Updated By:** Claude Code implementer (2026-11-16)
- **Current Goal:** Step 13.16 (harness check for the gold sinks) is done. Next is the user's call on whether the numbers need tuning.
- **Recent Changes & Files Touched (harness and docs only; sim, content numbers, saves and snapshots untouched):**
  - `src/harness/modded.ts` (new): rows arrived, plain, socket, rank2, rank3, temper, rank3-top, stack for a level-17 hero on the 7 Causeway fights. Gear is built with `queueSocket`, `queueInfuse`, `queueRankUp` and `advanceCrafting` from `persist/crafting.ts`; costs read from the purse.
  - `src/harness/modded.test.ts` (new); `src/harness/cli.ts`: `--matrix modded` writes `reports/modded-seed<seed>.csv` (gitignored).
  - `tests/architecture.test.ts`: `harness/modded.ts` and its test may import persist (the only exception to "harness must not import persist").
  - Docs: plan Step 13.16, CHANGELOG Tech line.
- **Active Decisions / Constraints:**
  - Second modifiers only on weapon, off-hand and both accessories; armor has only Sturdy and Nimble open at level 17 and both are already at the stack cap of 2.
  - Rank III needs riftglass or better, so it also carries temper 3 (cinderite: 5).
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Never remove `// admin code`. One commit per part, pushed to `origin/main`.
- **Result (seed 1, runs 100):** see the plan Step 13.16 and the session report. Win rates are saturated at 100% on six of seven fights; only the level-22 Colossus moves, and only the full stack moves it.
- **Exact Next Step:** User reads the numbers and decides whether single sinks are too weak (they change HP left by 0 to 3 points) before any tuning; tuning goes in GAME_DESIGN first.
