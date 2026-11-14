# Project Handoff State

- **Last Updated By:** Claude Code (2026-11-15)
- **Current Goal:** Step 13.8 rule stacks. Parts 1 (sim), 2 (save/persist) and 3 (editor UI) are done and pushed; Part 4 (fight bar, picker, dock chip) is next. Step 13.7 batches 1-6 are closed.
- **Recent Changes & Files Touched (Part 3):**
  - `src/ui/character/Rules.tsx`: stack tab row (Default + stacks, Auto / Manual only tags, New stack disabled at 4 with "A hero can have at most 4 stacks."), per-stack name, "Switch to this stack when" trigger, Move up/down, Duplicate, inline Delete confirm, one Save rules for all stacks and rows. A hero with no stacks sees no tab row, only New stack and a Help note. The form is keyed on loadout plus stack count (so the "Rules saved." line resets when the count changes).
  - New `src/ui/character/ConditionList.tsx` (condition editor extracted from the row editor, same aria-labels) and `src/ui/character/stackEdit.ts` (pure add/duplicate/delete/move/patch). Tests in `src/ui/character/stackEditor.test.tsx`. CSS appended to `src/ui/kit.css` (`.stack-*`).
  - Docs: Step 13.8 Part 3 done in `doc/IMPLEMENTATION_PLAN.md`; one New line in `CHANGELOG.md`.
- **Active Decisions / Constraints:**
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Do not change the golden duel-basic snapshot. Never remove `// admin code`.
  - One commit per finished part, pushed to `origin/main`, no force-push. Every game-changing commit adds a line under `Unreleased` in `CHANGELOG.md`.
  - Guards byte-identical (reference CSV, warden, causeway, hollows, built, telegraph, elites, cinder). Nothing in sim or content changed in Part 3.
  - Stacks: 3 extra + Default, 12 rows each, 2 s hold switching down, manual pick lasts until Auto or the fight ends.
- **Not verified:** Part 3 browser check was DOM-driven (pane hidden, screenshots flaky); tab row scrolls inside itself at 375 px, page does not scroll sideways.
- **Exact Next Step (Part 4):** new `src/ui/combat/StackBar.tsx` under the hero card in `FightView.tsx`, rendered only when the hero has extra stacks: "Stack: <name>" plus reason ("Auto · <trigger>", "Default · no trigger passed", "Manual · until the fight ends", "Held · dropping back in N s"); picker of toggle buttons with `aria-pressed` (Auto + each stack, at least 44 px, wrap at 375); a "Next action" Tag in a fixed-width slot for a pending pick; fixed min-height with an ellipsized reason (no layout shift); run dock chip "Stack: <name>" folded and the picker unfolded; tests in `fightControls.test.tsx` and `runDock.test.tsx`; live browser fight check. Store already has `pickStackFromUi`.
