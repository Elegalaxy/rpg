# Project Handoff State

- **Last Updated By:** Claude Code (2026-11-15)
- **Current Goal:** Step 13.8 Rule stacks is done (parts 1-4). Step 13.7 playtest fixes (feedback of 2026-11-11) are in. Next is the user's playtest, then closing 13.7/13.8 into a 0.x.0 changelog heading.
- **Recent Changes & Files Touched:**
  - Step 13.8 part 4: `src/ui/combat/StackBar.tsx` (bar, picker) and `stackSummary.ts` (`summarizeStack`), wired into `FightView.tsx` under the hero card and into `RunDock.tsx` (folded chip in a reserved line, unfolded picker). CSS under `rs-*` classes in `combat.css` and `runDock.css` (`.stack-bar` already belongs to the editor in `kit.css`). `pickStackFromUi` in `store.ts` now acts on the live run's fight when there is one. Tests in `fightControls.test.tsx` and `runDock.test.tsx`.
  - Parts 1-3: sim `src/sim/stacks.ts`, save and persist, editor in `src/ui/character/Rules.tsx`.
  - Another session left uncommitted Craft modifier picker work in `src/ui/town/Craft.tsx`, `src/ui/kit.css` and one CHANGELOG line; it was not part of the part 4 commit.
- **Active Decisions / Constraints:**
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Do not change the golden duel-basic snapshot. Never remove `// admin code`.
  - No shared vault between heroes. One commit per finished part, pushed to `origin/main`, no force-push.
  - Guards stay byte-identical (reference CSV, warden, causeway, hollows, built, telegraph, elites, cinder).
  - Every game-changing commit adds a line under `Unreleased` in `CHANGELOG.md`.
  - A stack pick takes effect at the next action and lasts until the fight ends or Auto; "Held" countdown is asked of `pickStack` at the moment the hold ends (no duplicated sim logic).
- **Not verified:** stacks in a real 375 px browser fight (checked with injected markup only) and Auto release in the live UI (covered by tests); the Tyrant at Power 68 and Cinder Scar items; defeat-rest start refusal; Full / Nearly full note; contract pending line; shop bag-room line; keyboard focus ring; true HP regen rate; the 300-run reference matrix diff never completed.
- **Exact Next Step:** (1) User playtest of rule stacks and of the Causeway, Hollows and Cinder Scar. (2) Optional harness `--matrix stacks` balance comparison. (3) After the playtest, close Step 13.7 and 13.8 into a `## 0.x.0 · date · name` changelog heading.
