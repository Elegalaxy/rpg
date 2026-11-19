# Project Handoff State

- **Last Updated By:** Claude Code implementer (2026-11-19)
- **Current Goal:** Step 13.34 follow-up: tuned fifth-skill measurement done (harness only). Verdict GO, the 90 Legacy price stays.
- **Recent Changes & Files Touched:**
  - `src/harness/slots.ts` (+test): `TUNED_ROWS`, variants `tuned-first` and `tuned-last`, filters `variants` and `skills`. New `src/harness/slotsTuned.ts` shard runner (not in the default CLI).
  - GAME_DESIGN section 10 "Tuned fifth skill rows": conditions, method, table, verdict. IMPLEMENTATION_PLAN 13.34 Progress. CHANGELOG `Unreleased` Tech line.
  - Best tuned five per class at prepared: Warrior Cleave +7.6, Assassin Fan of Knives +7.1, Mage Chain Lightning +7.4, Cleric Consecration +5.4 (three elites), Ranger +0.0. 0 of 18 cells cross to 95.
- **Active Decisions / Constraints:**
  - `src/sim`, content numbers and default harness behaviour stay untouched; guards stay byte-identical.
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Never remove `// admin code`. One commit per part, pushed to `origin/main`, every game change adds a `CHANGELOG.md` line. `npm test` rewrites the scenarios snapshot: restore it, never commit it.
  - The old slots measurement (naive unconditional fifth row) said GO; Cleric Consecration was +9.2, near the 10-point line.
- **Not verified:** Legacy screen, Loadout and Town in a browser and at 375 px.
- **Exact Next Step:** user reads the verdict; no player-visible change was made. Optionally a browser check of the Legacy and Loadout screens.
