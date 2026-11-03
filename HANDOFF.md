# Project Handoff State

- **Last Updated By:** Claude Code
- **Current Goal:** First playable is built and playtested (Step 11.2 verified, second round recorded 2026-11-03). Now acting on playtest notes.
- **Recent Changes & Files Touched:**
  - Log panel redesign (525dedb): `src/ui/log/LogPanel.tsx`, `categories.ts` (`splitLeadTime`, `splitDetail`, `rowKind`, hints), `log.css`, `src/ui/combat/combat.css`. One filter at a time, time column, colour stripes, short headlines with details on demand. `formatEvent` and the golden log are unchanged.
  - Per-hero wealth (55495fa): `src/persist/save.ts` now has `Purse` on each `SavedHero` (gold, materials, contracts, craft queue/counter, debt, archive) with `purseOf`/`withPurse`/`updatePurse`; the account keeps only recipes, discoveries, slots, milestones. Old saves migrate in `splitAccountPurse`. Touched `town.ts`, `crafting.ts`, `contracts.ts`, `equipment.ts`, `reincarnation.ts`, `world.ts`, `roster.ts`, the town/hero UI, tests, and new `src/persist/purse.test.ts`.
  - Earlier today: elite and Ranger/Assassin balance pass (95caa79). 665 tests, typecheck and lint clean.
- **Active Decisions / Constraints:**
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Do not change the golden duel-basic snapshot. Never remove `// admin code`.
  - No shared vault between heroes (rejected 2026-11-03). Only the selected hero's craft queue advances.
  - One commit per finished part, pushed to `origin/main`. No force-push.
  - Known leftovers: rules do not matter before levels 14-16 (playtest criterion 10 note); Ranger/Assassin cannot beat the Echo Knight at level 16; Cleric floor build loses both elites; no consumables; existing saves do not learn Fade Back.
- **Exact Next Step:** Ask the user which follow-up is next: make rules matter early (give an early enemy a telegraph, numbers need approval), consumables, or Cleric floor damage.
