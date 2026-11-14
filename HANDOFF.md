# Project Handoff State

- **Last Updated By:** Claude Code (2026-11-15)
- **Current Goal:** Step 13.8 Rule stacks. Part 1 (sim core, 7015d74) and Part 2 (save and persist) are done. Part 3 (editor UI) is next, then Part 4 (fight UI). Step 13.7 batches 1-6 are committed.
- **Recent Changes & Files Touched (Part 2):**
  - `src/persist/save.ts`: `SavedHero.ruleStacks` (required), `fillWorldFields` sets `[]`, `assertHero` validates with sim `parseRuleStacks`. No version bump.
  - `src/persist/loadout.ts`: `StackDraft` (`id, name, when, keptWhen?, rows`), `draftsFromStacks`, `validateStacks` (errors name stack and rule), `saveRuleStacks`, `summarizeTrigger`, `nextStackId`; `saveLoadout` prunes stack rows and counts them.
  - `src/persist/expeditionSetup.ts` passes `ruleStacks` only when the hero has some; `roster.ts` and `reincarnation.ts` set `[]`.
  - `src/ui/store.ts`: `saveRulesFromUi(rows, stacks?)` also applies `setRuleStacks` to the live fight; new `pickStackFromUi(id | null)` (sim `setManualStack`). `src/ui/map/goingInLines.ts` shows "N priority rules · M stacks".
  - Tests: `src/persist/ruleStacks.test.ts`, plus `legacySaves`, `save`, `reincarnation` tests. Docs: plan Step 13.8 Part 2 done, CHANGELOG Tech line.
- **Active Decisions / Constraints:**
  - Stacks do not swap equipped skills; 3 extra stacks plus Default, 12 rows each; 2 s hold when switching down, up is immediate; manual pick lasts to fight end or Auto; no gating; reincarnation clears stacks.
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Do not change the golden duel-basic snapshot. Never remove `// admin code`.
  - One commit per finished part, pushed to `origin/main`, no force-push. Every game-changing commit adds a line under `Unreleased` in `CHANGELOG.md`.
  - Guards must stay byte-identical (reference CSV, warden, causeway, hollows, built, telegraph, elites, cinder).
- **Not verified:** the stack plumbing in the browser (no UI yet); batches 5-6 in the browser; Cinder Scar Tyrant at Power 68 in the live UI.
- **Exact Next Step:** Part 3, stack editor in `src/ui/character/Rules.tsx`: tabs per stack with an Auto / Manual-only tag, "New stack" button disabled at 4 with a title, name field, trigger ConditionList extracted and reusing `kindsFor(classId)`, move up/down = priority order, Duplicate, Delete with inline confirm, one Save rules button calling `saveRulesFromUi(rows, stacks)`, errors naming the stack and rule, check at 375 px. Then Part 4 (fight bar, picker via `pickStackFromUi`, dock chip).
