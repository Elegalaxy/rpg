# Project Handoff State

- **Last Updated By:** Claude Code implementer (2026-11-19)
- **Current Goal:** Step 13.34 "Fifth skill slot" shipped and closed as 0.18.0. Follow-up: tuned measurement of the fifth skill (harness only).
- **Recent Changes & Files Touched:**
  - `CHANGELOG.md`: the Unreleased lines (13.33, 13.34, phone Town, heirloom picker) moved under `## 0.18.0 · 2026-11-19 · Fifth skill slot`.
  - Fifth Skill Slot is live: 90 Legacy, loadout 1 to 5 (persist, Legacy screen, Loadout, Guide).
- **Active Decisions / Constraints:**
  - `src/sim`, content numbers and default harness behaviour stay untouched; guards stay byte-identical.
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Never remove `// admin code`. One commit per part, pushed to `origin/main`, every game change adds a `CHANGELOG.md` line. `npm test` rewrites the scenarios snapshot: restore it, never commit it.
  - The old slots measurement (naive unconditional fifth row) said GO; Cleric Consecration was +9.2, near the 10-point line.
- **Not verified:** Legacy screen, Loadout and Town in a browser and at 375 px.
- **Exact Next Step:** read the tuned slots measurement in GAME_DESIGN section 10 and decide whether the 90 Legacy price stays.
