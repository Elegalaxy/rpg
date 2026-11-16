# Project Handoff State

- **Last Updated By:** Cursor (2026-11-16)
- **Current Goal:** Step 13.10 gold sinks are done. Town tabs stay pinned on a wide screen, and the Trainer drill price is readable. Next is the user's playtest, then a `0.x.0` changelog heading.
- **Recent Changes & Files Touched:**
  - `src/ui/theme.css`: wide-screen `.content .subtabs` stick to the top; gold text on an amber button inherits the button colour.
  - `CHANGELOG.md`: two Improved lines under Unreleased.
- **Active Decisions / Constraints:**
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Do not change the golden duel-basic snapshot. Never remove `// admin code`.
  - One commit per finished stage or main function, pushed to `origin/main` before the next one starts. No force-push. Every game-changing commit adds a line under `Unreleased`.
  - Guards stay byte-identical. An item in a queued job takes no other socket, infuse, or rank job until it returns. Hauler's cannot be ranked. Drill XP is rounded half up.
- **Exact Next Step:** User playtest of drills, sockets, ranks, the pinned town tabs, and the drill price. After that, close Steps 13.7 to 13.10 into a `## 0.x.0` changelog heading.
