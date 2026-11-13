# Project Handoff State

- **Last Updated By:** Claude Code (2026-11-14)
- **Current Goal:** Step 13.7 playtest fixes (feedback of 2026-11-11). Batches 1-6 and the in-game "What's new" page are in; the four defects found by the browser QA of batch 6 are fixed. Next is the user's playtest.
- **Recent Changes & Files Touched (batch 6 fixes):**
  - Escape banner shows roll and chance as whole percents (`ui/combat/FightView.tsx`, `fightControls.test.tsx`). The sim event keeps roll as 0-1 and escape succeeds when roll x100 < chance; the sim log text (`sim/log.ts`) still prints the raw roll (sim is frozen, left alone).
  - Run dock: `RunDock.tsx` publishes its real height as `--run-dock-height` (ResizeObserver plus re-publish on fold); `runDock.css` uses it for the page's bottom padding under 1280px; unfolded details max `calc(50vh - 72px)`. Side column at 1280px and up is unchanged.
  - Roster: `.controls label` in `theme.css` is now a wrapping flex so the Load backup file input shrinks; no sideways scroll at 375 px.
  - Compare deltas (`town/GearChanges.tsx` + test): computed from rounded before/after; stats always show one decimal, "s" lines and bag room stay plain.
  - Start expedition button has `aria-describedby` to its reason (`map/MapView.tsx`).
  - `CHANGELOG.md`: four Fixed lines under Unreleased.
- **Active Decisions / Constraints:**
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Do not change the golden duel-basic snapshot. Never remove `// admin code`.
  - No shared vault between heroes. One commit per finished part, pushed to `origin/main`, no force-push.
  - Guards stay byte-identical; nothing in `src/sim` or `src/content` changed in these fixes.
  - Every game-changing commit adds a line under `Unreleased` in `CHANGELOG.md`.
  - Combo stacks are deferred until the user gives a design description.
- **Not verified:** defeat-rest start refusal, Full/Nearly full note, contract pending line, shop bag-room line, keyboard focus ring, true HP regen rate (needs a visible pane), map labels are small at 375 px; the Tyrant at Power 68 in the live UI, cinderite drop and Salvage, offline/away route with Cinder Scar.
- **Exact Next Step:** (1) User playtest of the Causeway, Hollows and Cinder Scar. (2) Work through the unverified list in a visible pane. (3) Get the combo stacks design description from the user, then close Step 13.7 (move Unreleased lines under a `## 0.x.0` heading).
