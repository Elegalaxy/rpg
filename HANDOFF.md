# Project Handoff State

- **Last Updated By:** Claude Code implementer (2026-11-17)
- **Current Goal:** Step 13.20 (Ward Charm answers a telegraph) is done, parts 1 to 5. Next is the user's call on the band misses below, then Step 13.21 (crafted backpack, not written).
- **Recent Changes & Files Touched:**
  - Docs: GAME_DESIGN §9 (Ward Charm and Riftglass Ward rows, "Changed 2026-11-17" block with the measured tables); plan Step 13.20.
  - Harness: `noCharmVariant` in `harness/warden.ts`, added to `WARDEN_VARIANTS` (prepared) and `CAUSEWAY_VARIANTS`; `warden.test.ts`.
  - Sim: `telegraphWard` effect (`types.ts`, `skills.ts`), `hero.telegraphWard`, `spendTelegraphWard` and the `telegraphed` flag on `applyEnemySkill` (`combat.ts`), `ward` log event (`log.ts`, `ui/log/categories.ts`), `WARD_UP_REASON` skip (`automation.ts`), new `sim/telegraphWard.test.ts`.
  - Content and UI: `content/skills.ts` (Charm 0.5, Riftglass Ward 0.25, 5 s), `content/supplies.ts` texts, `content/ruleTemplates.ts` (Ward with supplies), `ui/skillInfo.ts` (new effect line; damage reduction text fixed), `content/supplies.test.ts`.
- **Active Decisions / Constraints:**
  - Each ward stops the next telegraphed damaging skill: regular enemies deal nothing, elites and bosses 50% (Charm) or 25% (Riftglass Ward), never statuses; `dodgedDamageFraction` is a floor; no barrier; no once-per-fight cap; a ready Fade Back dodge goes first.
  - Default rows unchanged. Template rows now use a blank "telegraph within N seconds" on both rows (a plain "telegraph present" has no blank, which the template tests require).
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Never remove `// admin code`. One commit per part, pushed to `origin/main`; every game change adds a `CHANGELOG.md` line under `Unreleased`.
- **Measured (elites matrix, seeds 1-3 x 100):** the Step 13.5 bands broke in a few cells and the sweep (Charm 0.4/0.5/0.6, Riftglass 0.15/0.25/0.35) did not fix them (the fractions move wins by seed noise only), so 0.5 and 0.25 stay. Outside 40-85 (plain prepared): Warden Warrior 39, Assassin 26, Mage 39.5; Tyrant Mage 93.5. Over-levelled below 94: Reaver Assassin 92.5, Tyrant Warrior 91.5. Crafted minus plain above +30: Warden Assassin +35, Colossus Mage +32, Tyrant Warrior +32.
  - A fourth Draught still beats the Charm at the Warden and Colossus (for example Warden Warrior 85 against 41); at the regular Causeway fights they tie.
- **Not verified:** the in-game UI (skill info line, template picker, supply texts) in a browser; only tests and the harness were run.
- **Exact Next Step:** (1) User decides whether to accept the band misses or change the Ward rules (for example a once-per-ward cap on elites, or the HP gate). (2) Step 13.21 crafted backpack. (3) Close Step 13.20 into a `## 0.x.0` changelog heading with the next milestone.
