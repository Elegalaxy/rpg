# Project Handoff State

- **Last Updated By:** Claude Code (2026-11-16)
- **Current Goal:** Step 13.12 is done: normal play wears gear (1 durability per 3 fights won, elite or boss win = 2 fights, floor of the run total, applied at settle only). Next is the user's playtest of repair as a routine cost.
- **Recent Changes & Files Touched:**
  - Docs: GAME_DESIGN §8 "Gear wear in normal play"; plan Step 13.12; CHANGELOG `Unreleased: durability wear (Step 13.12)`.
  - `src/persist/world.ts`: `WEAR_FIGHTS_PER_POINT`, `WEAR_ELITE_WEIGHT`, `gearWearOf`, `wornEquipment`; `settleExpedition`, `outcomeStats` (`gearWear`, worn `gear`) and `outcomeSummary` use them.
  - `src/ui/map/ExpeditionPanel.tsx`: outcome card note "Gear wear: -N durability on each worn piece."
  - Tests: `src/persist/gearWear.test.ts` (floor, elite/boss weight, defeat stacking, clamp, retreat, away run).
- **Active Decisions / Constraints:**
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Do not change the golden duel-basic snapshot. Never remove `// admin code`.
  - One commit per finished part, pushed to `origin/main`, no force-push. Every game-changing commit adds a line under `Unreleased` in `CHANGELOG.md`.
  - Wear is persist-only: sim and harness unchanged, guards byte-identical. Repair prices unchanged. Defeat still costs a flat 10, wear stacks.
  - Wear is floored per run, so runs of 1 to 2 wins wear nothing; away runs that settle each run follow the same rule.
- **Not verified:** the outcome card note in the browser; no live "wear so far" display and no away-report gear line were added.
- **Exact Next Step:** (1) User playtest: repair cost over several runs. (2) Tune `WEAR_FIGHTS_PER_POINT` if repair feels too cheap or too dear. (3) Close Step 13.12 into a `## 0.x.0` changelog heading with the next milestone.
