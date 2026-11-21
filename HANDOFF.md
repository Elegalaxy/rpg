# Project Handoff State

- **Last Updated By:** Claude Code implementer (2026-11-21)
- **Current Goal:** Step 13.39 "Venom passive (Envenomed strikes)" is done (parts 1 to 5). The Assassin's Venom Edge is now an innate passive: every direct-damage action poisons each enemy it damaged. Next is the user's playtest.
- **Recent Changes & Files Touched:**
  - Docs: GAME_DESIGN §4 (trait, Venom cluster, retired skill) and §10 "Venom passive (Step 13.39)" with every measurement table, plan Step 13.39, CHANGELOG `Unreleased` [13.39].
  - Sim: `GameDefs.envenom` and `applyEnvenom` in `sim/classes/assassin.ts`, boss cap via `poisonApplicationAdjust` / `statusStackCap`. Content: `ENVENOM` in `content/scenarios.ts` (`gameDefs()`), Assassin web and reference loadout have three skills, `venom-edge` in `HIDDEN_SKILL_IDS`, `startingSkillIds` 3 to 4, regenerated `nodeText.ts`.
  - Persist: hero update `assassin-venom-passive` in `persist/heroUpdates.ts` (strips Venom Edge from loadout, learned, rules, stacks, `pastLoadout`, `waitingSkillIds`; node kept).
  - UI: Loadout "Passive" line for Assassins, Guide Assassin tip. Harness: `src/harness/venom.ts` (shard and report CLI, variants `live`, `current`, `passive-*`, Toxic and boss-cap probes).
- **Active Decisions / Constraints:**
  - Shipped numbers: tick 8% (10% with the Venom Edge node), 100% base chance, basic attack +10%, bosses keep the full Poison cap while Toxic Opportunity is allocated. Arrived tier is excluded from the GO rule (base about 2%).
  - Measurement-only hook fields stay dormant: `shadowCutBonus`, `bossCoefficient`, `toxicAnyHit`, `toxicEvery`, `toxicCooldownMs`; `gameDefs()` does not set them.
  - A "skill is ready" condition naming Venom Edge is dropped from its rule by the migration, not the rule.
  - `src/sim` stays pure. Record design numbers in `doc/GAME_DESIGN.md` before code. Never remove `// admin code`. One commit per part, pushed to `origin/main`, every game change adds a `CHANGELOG.md` line under `Unreleased`. `npm test` rewrites the scenarios snapshot: restore it, never commit it.
- **Risks:** the Warden prepared cell is one noisy cell (seed spread 10 to 20 points); compare means over 3 x 100 only. The 8% floor tick was never measured on its own (every measured cell had the node).
- **Not verified:** nothing was clicked through in a browser (Loadout passive line, an old save with Venom Edge rules loading in the app).
- **Exact Next Step:** (1) User playtest: load an old Assassin save, check Venom Edge left the loadout and rules, the Loadout tab shows the Passive line, the Venom Edge node still raises the tick. (2) Close 13.36 to 13.39 into a `## 0.x.0` changelog heading.
