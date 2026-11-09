# Project Handoff State

- **Last Updated By:** Claude Code (2026-11-09)
- **Current Goal:** Step 13.5 class balance pass. Parts 0-7 and 8a are done and pushed; part 8 (full re-measure and close) is open. Open items: user playtest of the Causeway and Hollows, Warrior/Cleric Warden gap, Greater Draught rule threshold decision.
- **Recent Changes & Files Touched (part 8a, commits 343f7c3, 916e5f7, 188940d, d9c4ccf; 949 tests):**
  - Sim: new `EnemyDef.timePressure` (`TimePressureDef` in `src/sim/types.ts`, validation in `enemyAi.ts`, `timePressureFields` in `combat.ts`). A late enrage reusing the pressure stacks: first stack at `startMs`, then every `intervalMs` up to `maxStacks`. Stance fix: `applyPhaseModifiers` now keeps the stance and scales it by pressure stacks and the timed defense bonus (`applyStanceNumbers` takes scales). Reference CSV, `--matrix warden`, `--matrix elites` were byte-identical before and after. Tests: `src/content/timePressure.test.ts`.
  - Content (`src/content/enemies.ts`, `eliteEnrage(startMs)` = Warden per-stack numbers: 3 s, 10 stacks, x1.1 Power, x0.95 defence, x1.05 speed): Colossus action time 2.2 s, Breaker Wave interrupt 5%, enrage 140 s. Reaver Power 65, Rift Surge cooldown 9 s, enrage 90 s. Tests: `causeway.test.ts`, `hollows.test.ts`.
  - Results (seeds 1-3 x 100, rules, prepared W/A/R/M/C): Colossus 74/57/65/67/59, over 100, arrived 0; Reaver 42/76/99/45/57, over 94-100. Crafted minus plain at most +28. Seed spread up to 16 points in mid-band cells (the within-8 check is not met). Regular fights, mixed-fight HP and Warden unchanged (guards run).
  - Part 6 telegraph check recorded in GAME_DESIGN §7 "Elite pressure": rules minus blind wins: Colossus W+37 A-7 R+53 M+18 C-30; Reaver W+41 A+26 R+85 M+19 C-34. Cleric (both) and Assassin (Colossus) not met; Cleric rules left unchanged by decision. Single-action interrupt not built.
- **Active Decisions / Constraints:**
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Do not change the golden duel-basic snapshot. Never remove `// admin code`.
  - No shared vault between heroes. One commit per finished part, pushed to `origin/main`, no force-push.
  - Reaver Power 65 is outside the planned sweep range (58-62); no in-range point fit Warrior and Assassin together. Ranger accepted at about 100 at the Reaver (blind Ranger 14).
  - Cleric enrage start is a cliff at the Colossus (130 s: 20%, 140 s: 68%, 150 s: 90%); retune with care.
- **Not verified:** the new enrage in the browser (ActorCard shows "Pressure n" for stacks); offline, away route, Save panel, Wear button, Going in with (earlier user checks still open).
- **Exact Next Step:** (1) Part 8: full re-measure (`--matrix elites`, warden, causeway, hollows, built guards at seeds 1-3 x 100), update the baseline tables and close Step 13.5. (2) Decide the Greater Draught default rule threshold (30 vs 40% HP, Warden Warrior/Cleric crafted gap). (3) Optional: Cleric telegraph rows, Warrior/Cleric Warden gap, Warden HP multiplier 7 to 6. (4) Later: Grove/Bastion material drops, a post-Warden zone (Rift Hollows L22-28 exists; next zone TBD). (5) User playtest of the Causeway and Hollows.
