# Project Handoff State

- **Last Updated By:** Claude Code implementer (2026-11-18)
- **Current Goal:** Step 13.30 "Legacy purchases apply now" is done (3 parts). Next is the user's playtest. Step 13.22 (crafted backpack) still awaits its playtest and the Satchel balance call (see below).
- **Recent Changes & Files Touched (13.30):**
  - Docs: GAME_DESIGN §10 ("Purchases apply now" bullet, Head Start bullet), plan Step 13.30, CHANGELOG `Unreleased` [13.30].
  - Code: `buyPurchase` in `src/persist/reincarnation.ts` now also updates `hero.progress` via `applyToCurrentLife` (Attribute Seed +1 to that attribute, Skill Point Seed +1 `legacySkillPoints`, Head Start raises a lower hero with `awardXp` of the XP difference so level-up points stay unspent; a hero at or above the tier level changes nothing) and runs `scaleHeirlooms` when the level changed. Second Heirloom and Deep Pockets unchanged.
  - UI: `src/ui/character/Legacy.tsx` purchase rows say "Applies now and every later life" / "Applies at your next reincarnation" (Second Heirloom), buy messages updated; Guide reincarnation text in `src/content/guide.ts`.
  - Tests: `src/persist/reincarnation.test.ts` (apply now, no double count on reincarnate, Head Start variants, heirloom scaling), `src/ui/character/Legacy.test.tsx`.
- **Active Decisions / Constraints:**
  - Purchases bought before 13.30 are NOT applied retroactively (cannot tell what the current life has); they take effect at the next reincarnation as before. No save fields, no version bump. Sim untouched.
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Never remove `// admin code`. One commit per part, pushed to `origin/main`, every game change adds a `CHANGELOG.md` line under `Unreleased`. `npm test` rewrites the scenarios snapshot: restore it, never commit it. Docs files use CRLF: keep line endings when editing.
- **13.22 Satchel note:** above 4 slots a run carries at most 3 of any supply; plain prepared 57.6 / 57.6 / 57.6 wins (4/5/6 slots), crafted 88.2 / 90.9 / 96.5. The Satchel is neutral for default rows; only the Field Pack is a large step.
- **Not verified:** the Legacy screen in a browser or at 375 px (render tests only); buying mid-life in the live game.
- **Exact Next Step:** (1) User playtest: buy a seed and a Head Start on a low-level hero, check attributes, points and heirloom level update at once. (2) Decide on the Satchel balance. (3) Close 13.22 and 13.30 into a `## 0.x.0` changelog heading.
