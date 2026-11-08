# Project Handoff State

- **Last Updated By:** Claude Code (implementer, 2026-11-08)
- **Current Goal:** Step 13.5 class balance pass, corrected "targeting fix" (GAME_DESIGN §7 "Targeting fix"). Done: parts 1-4 of the fix. Pending: Step 13.5 parts 6 (telegraph check), 7 (crafted supplies trim), 8 (full re-measure and close).
- **Recent Changes & Files Touched (commits 95ae8cc, 818d9e2, e03afa2 + docs commit):**
  - Diagnosis corrected: Warrior/Cleric lost the Warden because their reference rules never targeted the Echoes (Ward Echo kept healing the Warden). The old `lowestHpPercent` Echo-first check was invalid. Older Step 13.5 parts 2/3/5A results are marked superseded in the doc (kept).
  - Part 1: `referenceLoadouts` in `src/content/scenarios.ts`: Warrior driving/sundering rows `lowestArmor`, Cleric smite/judgment rows `lowestResistance` (existing saves keep their rows). `src/harness/elites.ts` diagnostic row is now "untargeted". Tests updated (scenarios.test, elites.test, report.test uses `ref-assassin-warden`).
  - Part 2: Warden (`src/content/enemies.ts`) `hpMultiplier` 7 (3,360 HP), `pressureIntervalMs` 3000, `pressureMaxStacks` 10; enemies.test and content.test updated.
  - Part 3/5: Second Wind `maxHpFraction` 0.10 (was 0.15, user decision; `src/content/skills.ts`, content.test). Node text unchanged.
  - Results (seeds 1-3 x 100): Warden prepared Warrior 79, Assassin 18, Ranger 54, Mage 48, Cleric 45; over/causeway 100; arrived 0 for all. 941 tests pass; snapshots and duel-basic golden unchanged.
- **Active Decisions / Constraints:**
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Do not change the golden duel-basic snapshot. Never remove `// admin code`.
  - One commit per finished part, pushed to `origin/main`, no force-push. No shared vault between heroes.
  - Colossus/Reaver numbers were not changed in this fix; a time-pressure ramp is a separate later step.
- **Open Items:**
  - Warrior Warden prepared is 52 after Second Wind 10% (seeds 47/51/58; built guard Rootmaw 75, Echo Knight 64 holds). Assassin prepared 18 (band 30+), no class change made.
  - Colossus prepared: Warrior/Cleric/Mage 100, Ranger 87, Assassin 33; Reaver prepared 100 for all (band 40-85). Crafted supplies lift the Warden prepared tier by 21-80 points (ceiling 30).
  - Mixed fights HP lost mostly outside 15-40. Built matrix does not report HP lost (scratch script used).
- **Exact Next Step:** Decide with the user: the Assassin (18% Warden prepared), then Step 13.5 part 7 (crafted supplies 40%/25%), part 6, and the Colossus/Reaver time-pressure ramp. User still to playtest: Causeway, offline, away route, Save panel, Wear button, Going in with.
