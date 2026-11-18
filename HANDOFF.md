# Project Handoff State

- **Last Updated By:** Claude Code implementer (2026-11-18)
- **Current Goal:** Step 13.29 "Heirloom equip fix" is done: a kept heirloom can be worn at any hero level its item level allows, with all modifiers at full strength.
- **Recent Changes & Files Touched:**
  - `src/sim/economy.ts` `equipBlock`: skips the per-modifier minLevel refusal when `item.heirloom !== undefined`. Non-heirloom items still blocked. Nothing else changed.
  - Tests in `src/sim/modifiers.test.ts`; Guide sentence in `src/content/guide.ts`; CHANGELOG `Unreleased` [13.29]; GAME_DESIGN §10 "Heirloom equip rule"; plan Step 13.29.
- **Active Decisions / Constraints:**
  - User chose full strength from level 1 (no dormant modifiers). Early power spike is possible (rank III heirloom at level 1); 13.18 Later-lives numbers not re-measured, nothing tuned.
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Never remove `// admin code`. One commit per part, pushed to `origin/main`, every game change adds a `CHANGELOG.md` line. `npm test` rewrites the scenarios snapshot: restore it, never commit it.
- **Not verified:** UI in a browser; before/after harness matrices (harness uses no heirloom).
- **Exact Next Step:** User playtest of a level-1 heirloom after reincarnation; optionally re-measure Later lives with a strong heirloom.
