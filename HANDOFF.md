# Project Handoff State

- **Last Updated By:** Claude Code (2026-11-09)
- **Current Goal:** Step 13.5 class balance is closed (part 8) plus the Ranger Reaver half-dodge fix. Open items: user playtest of the Causeway and Hollows, Warrior/Cleric Warden gap, Greater Draught rule threshold decision.
- **Recent Changes & Files Touched (Ranger Reaver half-dodge; 954 tests):**
  - Sim: new optional `EnemySkillDef.dodgedDamageFraction` (`src/sim/types.ts`, validated 0 < x < 1 in `enemyAi.ts`). `combat.ts`: a readied dodge (Fade Back) on such a skill still lets that share of each damage effect land (`resolveEnemyStrike` takes a scale); statuses and supply theft stay avoided. `SkillDodgeEvent.damageFraction` and the "partly dodges" log line in `log.ts`. Behaviour unchanged when the field is absent.
  - Content: Rift Surge (`src/content/enemies.ts`) sets 0.6, the only skill that does.
  - Tests: `hollows.test.ts`, `enemyAi.test.ts`, `log.test.ts`, `fade-back.test.ts`.
  - Docs: GAME_DESIGN Rift Surge and Fade Back lines, §7 "Ranger Reaver half-dodge" (sweep 0 / 0.5 / 0.6), final measurement table, IMPLEMENTATION_PLAN Progress line.
  - Results (Ranger, seeds 1-3 x 100): Reaver arrived 84 -> 8, prepared 99 -> 76, over 100 -> 99, crafted 99 -> 93, telegraph check +62 wins / +19 HP. Reference CSV, warden, causeway, telegraph, built, and all other class/elite rows byte-identical.
- **Active Decisions / Constraints:**
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Do not change the golden duel-basic snapshot. Never remove `// admin code`.
  - No shared vault between heroes. One commit per finished part, pushed to `origin/main`, no force-push.
  - Reaver Power 65 is outside the planned sweep range (58-62); no in-range point fit Warrior and Assassin together.
  - Cleric enrage start is a cliff at the Colossus (130 s: 20%, 140 s: 68%, 150 s: 90%); retune with care.
- **Not verified:** the new enrage and the half-dodge log line in the browser (ActorCard shows "Pressure n"); offline, away route, Save panel, Wear button, Going in with (earlier user checks still open). The UI telegraph chip "half-dodge" is an optional follow-up; the log line covers it.
- **Exact Next Step:** (1) Decide the Greater Draught default rule threshold (30 vs 40% HP, Warden Warrior/Cleric crafted gap). (2) Optional: Cleric telegraph rows, Warrior/Cleric Warden gap, Warden HP multiplier 7 to 6, UI "half-dodge" chip. (3) Later: Grove/Bastion material drops, a post-Warden zone (next zone TBD). (4) User playtest of the Causeway and Hollows.
