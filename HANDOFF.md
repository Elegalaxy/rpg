# Project Handoff State

- **Last Updated By:** Claude Code (2026-11-15)
- **Current Goal:** Step 13.8 Rule stacks (combo stacks). Part 1 (docs and sim core) is done; parts 2-4 remain. Step 13.7 batches 1-6 are committed and pushed.
- **Recent Changes & Files Touched (Part 1):**
  - `doc/GAME_DESIGN.md` "Rule stacks" under Automation; `doc/IMPLEMENTATION_PLAN.md` Step 13.8; `CHANGELOG.md` Unreleased Tech line.
  - `src/sim/types.ts`: `DEFAULT_STACK_ID`, `RuleStack`, `StackState`, `StackChangedEvent`, optional `ruleStacks` / `stackState` on `CombatHero`, `ruleStacks` on `CombatHeroSetup`, optional `stackCount` on `RulesChangedEvent`.
  - `src/sim/stacks.ts` (new): `pickStack`, `applyStackPick`, `setManualStack(state, defs, id|null)`, `setRuleStacks`, `activeRules`, `describeCondition`. `src/sim/stacks.test.ts` (new).
  - `src/sim/automation.ts`: `MAX_RULE_STACKS` 3, `STACK_HOLD_MS` 2000, `parseRuleStacks`, exported `conditionFailure` / `watchedEnemy` / `livingEnemies`, `chooseHeroAction(..., rules?)`.
  - `src/sim/combat.ts`: pick in `resolveHeroAction` and `waitingCanAct`; `createCombat` sets stacks only when the setup has them. `src/sim/log.ts` formatter; `src/ui/log/categories.ts` (+ test) automation category.
- **Active Decisions / Constraints:**
  - No skill swapping; 4 stacks (Default + 3) x 12 rows; 2 s hold when switching down, up is immediate; manual pick lasts until Auto or fight end; no gating; reincarnation clears stacks.
  - Heroes without stacks run the exact old path (guards byte-identical). Record design numbers in `doc/GAME_DESIGN.md` first. Never remove `// admin code`. One commit per part, pushed to `origin/main`, no force-push. Every game-changing commit adds a `CHANGELOG.md` line.
- **Not verified:** nothing in the browser yet (part 1 is sim only).
- **Exact Next Step:** Part 2 save/persist: `SavedHero.ruleStacks` required field filled to `[]` in `fillWorldFields`, `assertHero` check, `LATER_HERO_FIELDS` in `legacySaves.test.ts`, `expeditionSetup` (pass stacks into the combat setup), `loadout.ts` drafts/validate/save/prune, `roster.ts`, `reincarnation.ts` clears stacks, `store.ts` `saveRulesFromUi` + `pickStackFromUi`, `goingInLines`. Then Part 3 editor UI, Part 4 fight bar, picker and dock chip.
