# Project Handoff State

- **Last Updated By:** Claude Code (2026-11-09)
- **Current Goal:** Step 13.5 class balance pass. Part 7 (crafted supplies trim) is done. Parts 6 (telegraph check) and 8 (full re-measure and close), and the Colossus/Reaver time-pressure step, remain. Step 13.5 stays in-progress.
- **Recent Changes & Files Touched (Part 7):**
  - Greater Draught heal 50% to 35%, Riftglass Ward barrier 30% to 25% (`src/content/skills.ts`, effect text in `src/content/supplies.ts`, `src/content/supplies.test.ts`). Warming Tonic unchanged. No snapshot changed; 941 tests pass.
  - Docs first: GAME_DESIGN §9 table, and §7 "Crafted supplies trim" (sweep table, finding, after-table); IMPLEMENTATION_PLAN Step 13.5 progress line.
  - Sweep (seed 1, 60 runs, in-memory patches): the planned 40 / 25 left Assassin Warden +51 and Colossus +30; 35 / 25 chosen (30 equals the Healing Draught, Ward 20 equals the Ward Charm).
  - After (seeds 1-3 x 100, plain prepared > crafted prepared, gap): Warden Warrior 52 > 99 (+47), Assassin 42 > 72 (+30), Ranger 54 > 85 (+31), Mage 48 > 72 (+24), Cleric 45 > 83 (+38); Colossus gaps Warrior 0, Assassin +20, Ranger +8, Mage -3, Cleric 0; Reaver all 100. Causeway-crafted Warden tier 99-100 everywhere.
- **Key finding:** Warrior (+47) and Cleric (+38) remain over the +30 band at the Warden because of the Greater Draught default RULE threshold (hero HP at most 30%, Healing Draught row 40%), not the heal or Ward number. At heal 30 / Ward 20 with the rule at 40% the gap is exactly 0; with heal 30 / Ward 20 and the rule at 30% it is already +42 for Warrior. Option (not applied, needs user OK): Greater Draught rule to hero HP at most 40% (35 / 25 at 40%, seed 1 x 60: Warden gaps +22 / +36 / +29 / +20 / +23 for W/A/R/M/C, Colossus Assassin +24). Existing heroes keep their own rules. Brew cost 2 to 3 riftglass is an economy-only option (does not change win rates), not applied.
- **Active Decisions / Constraints:**
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Do not change the golden duel-basic snapshot. Never remove `// admin code`.
  - No shared vault between heroes. One commit per finished part, pushed to `origin/main`, no force-push.
  - "Skill is ready" ignores resource cost and target availability. Reference loadouts carry no supplies.
  - Bands: Warden prepared 30-70, Colossus/Reaver prepared 40-85, crafted prepared at most +30 over plain prepared.
- **Still open:** Reaver prepared 100% for all classes (needs class power or a new mechanic); Colossus easy for Mage/Cleric/Warrior; Warrior/Cleric Warden prepared; user playtest of the Causeway; user checks of offline, away route, Save panel, Wear button, Going in with.
- **Exact Next Step:** (1) Ask the user whether to raise the Greater Draught default rule to HP at most 40% (this is what brings Warrior and Cleric near the band). (2) Part 6 telegraph check, then part 8 full re-measure and close. (3) Colossus/Reaver time-pressure step. (4) Later: Grove/Bastion material drops, post-Warden zone (Rift Hollows L22-28).
