# Project Handoff State

- **Last Updated By:** Claude Code (2026-11-09)
- **Current Goal:** Step 13.5 class balance pass. Part 7 (crafted supplies trim) is done. Parts 6 (telegraph check) and 8 (full re-measure and close), and the Colossus/Reaver time-pressure step, remain. Step 13.5 stays in-progress.
- **Recent Changes & Files Touched (Part 7):**
  - Greater Draught heal 50% to 35%, Riftglass Ward barrier 30% to 25% (`src/content/skills.ts`, effect text in `src/content/supplies.ts`, `src/content/supplies.test.ts`). Warming Tonic unchanged. No snapshot changed; 941 tests pass.
  - Docs first: GAME_DESIGN §9 table, and §7 "Crafted supplies trim" (sweep table, finding, after-table); IMPLEMENTATION_PLAN Step 13.5 progress line.
  - Sweep (seed 1, 60 runs, in-memory patches): the planned 40 / 25 left Assassin Warden +51 and Colossus +30; 35 / 25 chosen (30 equals the Healing Draught, Ward 20 equals the Ward Charm).
  - After (seeds 1-3 x 100, plain prepared > crafted prepared, gap): Warden Warrior 52 > 99 (+47), Assassin 42 > 72 (+30), Ranger 54 > 85 (+31), Mage 48 > 72 (+24), Cleric 45 > 83 (+38); Colossus gaps Warrior 0, Assassin +20, Ranger +8, Mage -3, Cleric 0; Reaver all 100. Causeway-crafted Warden tier 99-100 everywhere.
- **Part 7b (2026-11-09, user OK):** Greater Draught default rule now HP at most 40% (new heroes only). Crafted-minus-plain gaps (seeds 1-3 x 100): Warden W +25, A +37, R +27, M +21, C +19; Colossus W 0, A +23, R +9, M 0, C 0. Only Assassin at the Warden (+37) is over the +30 band, accepted for now. Brew cost 2 to 3 riftglass is an unapplied economy option.
- **Active Decisions / Constraints:**
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Do not change the golden duel-basic snapshot. Never remove `// admin code`.
  - No shared vault between heroes. One commit per finished part, pushed to `origin/main`, no force-push.
  - "Skill is ready" ignores resource cost and target availability. Reference loadouts carry no supplies.
  - Bands: Warden prepared 30-70, Colossus/Reaver prepared 40-85, crafted prepared at most +30 over plain prepared.
- **Still open:** Reaver prepared 100% for all classes (needs class power or a new mechanic); Colossus easy for Mage/Cleric/Warrior; Warrior/Cleric Warden prepared; user playtest of the Causeway; user checks of offline, away route, Save panel, Wear button, Going in with.
- **Exact Next Step:** (1) Part 6 telegraph check, then part 8 full re-measure and close. (2) Colossus/Reaver time-pressure step (Reaver 100% for all classes; Warrior/Cleric Colossus 100%). (3) User playtest: Causeway, Hollows, offline, away route, Save panel, Wear button, Going in with.
