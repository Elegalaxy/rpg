# Project Handoff State

- **Last Updated By:** Claude Code implementer (2026-11-19)
- **Current Goal:** 0.17.0 "Lean inheritance" is closed in the changelog (Steps 13.30 to 13.32). Next: Step 13.33, Guide skill text cleanup.
- **Recent Changes & Files Touched:**
  - `CHANGELOG.md`: lines from 13.30, 13.31, 13.32 moved under `## 0.17.0 · 2026-11-19 · Lean inheritance`. The empty `## Unreleased` heading is left out, as in earlier releases, because the What's new test needs every section to have entries. Add it back with the next line.
  - `HANDOFF.md`: this file.
- **Active Decisions / Constraints:**
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Never remove `// admin code`. One commit per part, pushed to `origin/main`, every game change adds a `CHANGELOG.md` line under `Unreleased`. `npm test` rewrites the scenarios snapshot: restore it, never commit it.
  - `src/sim` numbers and the harness are untouched.
- **Not verified:** the Legacy screen and the Town sell tab in a browser, and at 375 px.
- **Exact Next Step:** (1) Step 13.33: fix Guide skill/status/race effect text (zero-value effects, raw ids). (2) User playtest of 13.31 carry-over and a balance call.
