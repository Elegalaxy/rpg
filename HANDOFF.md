# Project Handoff State

- **Last Updated By:** Cursor (2026-11-16)
- **Current Goal:** Gear shops (Weaponsmith, Armorer, Jeweler) show one job at a time so the counter is understandable on arrival. Playtest of drills, sockets, and ranks is still waiting.
- **Recent Changes & Files Touched:**
  - `src/ui/town/Town.tsx`: gear job bar (Buy, Sell, Repair, Craft, Upgrade, Sockets, Ranks, Queue). Repair and Queue show a count when something is waiting.
  - `src/ui/town/Craft.tsx`: `part` draws one crafting job; omitted still draws the whole page.
  - `src/ui/theme.css`: `.gear-jobs` sticks under the place tabs on a wide screen.
  - `CHANGELOG.md`: one Improved line under Unreleased.
- **Active Decisions / Constraints:**
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Do not change the golden duel-basic snapshot. Never remove `// admin code`.
  - One commit per finished stage or main function, pushed to `origin/main` before the next one starts. No force-push. Every game-changing commit adds a line under `Unreleased`.
  - Guards stay byte-identical. An item in a queued job takes no other socket, infuse, or rank job until it returns. Hauler's cannot be ranked. Drill XP is rounded half up.
- **Exact Next Step:** User playtest of the gear job bar, drills, sockets, and ranks. After that, close Steps 13.7 to 13.10 into a `## 0.x.0` changelog heading.
