# Project Handoff State

- **Last Updated By:** Claude Code (2026-11-09)
- **Current Goal:** Step 13.5 class balance pass, Assassin rules fix done (commits 29e610c docs, 74d52c0 content, part 3 harness). Remaining Step 13.5: part 6 telegraph check, part 7 crafted supplies trim, part 8 full re-measure and close; then a separate Colossus/Reaver time-pressure ramp step.
- **Recent Changes & Files Touched (Assassin rules fix):**
  - `src/content/scenarios.ts` (+ `scenarios.test.ts`): Assassin reference `mark-for-death` row has `targetPriority: 'lowestArmor'` (Mark was landing on the Warden while damage hit the Echo). New heroes only; existing saves keep the untargeted row.
  - `src/harness/builds.ts`: `UNLOCKED_ROWS` values are `{ row, place: 'first' | 'last' }`; Assassin Smoke Step is a no-condition row placed last (active skills never roll to hit, so the old `telegraph present` row did nothing).
  - Docs: GAME_DESIGN §7 "Assassin rules fix (Step 13.5)" (diagnosis, results, guards); IMPLEMENTATION_PLAN Step 13.5 Progress.
  - Results (seeds 1-3 x 100): Assassin Warden prepared 18 to 42, Colossus prepared 33 to 53 (both in band), Reaver prepared 100 (above band, unchanged); over/causeway 100; other classes unchanged. Reference CSV: only Assassin bastion-mixed, grove-mixed, echo-knight rows moved (win % unchanged).
  - Earlier in Step 13.5: targeting fix (Warrior/Cleric lowestArmor/lowestResistance rows), Warden HP x7, pressure every 3 s up to 10 stacks, Second Wind 10% (Warrior Warden prepared 52%).
- **Active Decisions / Constraints:**
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Do not change the golden duel-basic snapshot. Never remove `// admin code`.
  - One commit per finished part, pushed to `origin/main`, no force-push. No shared vault between heroes.
  - Crafted supplies lift prepared tiers by 45-58 points for the Assassin (and 45-52 for Ranger, Mage, Cleric), beyond the 30-point ceiling: part 7, not touched yet.
  - The game UI ships no Smoke Step row; the harness filler row is harness-only.
  - Matrix runs are slow with several in parallel (8 jobs took about 25 min); run them in the background and filter with `--classes` where supported (`elites` only).
- **Still out of band:** Colossus and Reaver prepared are above the 40-85 band for Warrior, Cleric and Mage, and Reaver prepared for every class (needs time pressure or class power); mixed fights mostly outside 15-40 (GAME_DESIGN §7).
- **Exact Next Step:** (1) Part 6 telegraph check. (2) Part 7 crafted supplies trim. (3) Part 8 full re-measure and close Step 13.5. (4) Then the Colossus/Reaver time-pressure ramp as its own step. (5) User still to playtest the Causeway and check offline, away route, Save panel, Wear button, Going in with.
