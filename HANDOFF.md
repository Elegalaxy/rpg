# Project Handoff State

- **Last Updated By:** Claude Code implementer (2026-11-25, Step 14.6, stopped at a failed balance gate)
- **Current Goal:** Step 14.6 "Elite uniques". P1 to P6 are built and tested. P1 and P2 are on `origin/main`; P3 to P6 and the measurement commit are LOCAL ONLY on branch `uniques` in `../rpg-worktrees/uniques` (not pushed). P7 is not done.
- **Recent Changes & Files Touched:**
  - Items: `sim/uniques.ts` (table, signature), `gearBonusesFor` (`sim/economy.ts`), `content/uniques.ts`, `itemName`, fixed sell price (`content/shop.ts`), `uniqueId` save check, sell confirm (`persist/sellSafety.ts`).
  - Award: `persist/uniques.ts`, `settleExpedition` and `uniquePreview` (`persist/world.ts`), moments, offline summary, Notices.
  - UI: `ui/town/UniqueLines.tsx`, Equipment, Sell and repair rows, outcome card, AwayPanel, Guide group "Unique items", signature notes in `persist/equipment.ts`.
  - Harness: `--matrix uniques` with record-only signature-only and modifier-only cells.
  - Fallback used: Colossus, Reaver and Tyrant signatures halved (Colossus 1% lifesteal, Reaver +1 crit / +7.5 crit damage, Tyrant +5 magic resist / +2 pens).
- **Open gates (after the fallback, seeds 1-3 x 100, worst class):** Warden + Colossus +29.3, + Reaver +70.3, + Tyrant +43.0 (bound +8); Warden + all six +76 (bound +30); Reaver + Colossus +18.0 (Warrior, bound +8). Passing: Warden + Matriarch +4.3, Tyrant + Reaver +4.3. Full tables in GAME_DESIGN section 9 "Elite uniques (Step 14.6)".
- **Cause:** the Warden failures come mainly from the fixed modifiers (Bloodbound, Kindled on a level 20 tier that never wears them), which halving a signature cannot move; Colossus lifesteal is still strong at 1%.
- **Guards:** reference, warden, causeway, hollows, cinder, barrens, built, telegraph, late, elites (seed 1 x 100) byte-identical to the pre-step run.
- **Active Decisions / Constraints:** Never remove `// admin code`. One commit per part. `npm test` rewrites the scenarios snapshot: restore it. Matriarch tuning is not to be touched. The `legacy-stepper` worktree belongs to another chat.
- **Not verified:** outcome card, toast and away line in a browser (unit-tested only); unique rows were browser-checked at 1280 and 375.
- **Exact Next Step:** User decides: (1) accept the Warden cells as exceptions (they test later-zone modifiers on earlier content), (2) change the gate to signature-only cells, or (3) redesign the fixed modifiers or signatures. Then push the local commits, close the plan Status and the `## Unreleased` changelog lines, and remove the worktree and branch.
