# Project Handoff State

- **Last Updated By:** Claude Code implementer (2026-11-20)
- **Current Goal:** Step 13.36 "Plan the next life" is done (parts 1 to 4). "Plan your next life..." on the Legacy screen opens a "Between lives" planner: this life's Legacy is spendable first, one atomic `reincarnate(..., plan)` commits. Next is the user's playtest.
- **Recent Changes & Files Touched:**
  - Docs: GAME_DESIGN §10 "Planning the next life (Step 13.36)", plan Step 13.36, CHANGELOG `Unreleased` [13.36].
  - Persist: `src/persist/reincarnation.ts` (`pricePurchase` shared with `buyPurchase`, `PlannedPurchase`, `stageNextLife`, `reincarnate(save, heroId, heirlooms, plan = [])`), tests in `reincarnation.test.ts` (`planned next life`).
  - UI: new `src/ui/character/legacyParts.tsx` (purchase rows and tables, `CarryFacts`, `NextLifeFacts`, `HeirloomPickers`, `gainLines`, `StockTable`), new `NextLifePlanner.tsx` (+ test), `Legacy.tsx` slimmed (opens the planner; `initialPlanning` prop for tests), `store.ts` `reincarnateFromUi(ids, plan)`, `character.css` (`.legacy-plan*`), Guide text in `content/guide.ts`.
- **Active Decisions / Constraints:**
  - The plan is never saved: reload drops it, nothing is spent until "Begin new life". Planned purchases are not applied to the ending life (no seed, Head Start adds no Legacy and keeps the peak); Artisan's Favor still gives +1 token.
  - The Legacy tab keeps the normal buy table (applies now) and the heirloom claim for mid-life.
  - "Life n" text in the planner counts `lives + 2` (lives is completed lives, so the first reincarnation starts life 2).
  - `src/sim`, content numbers and the harness are untouched. Record design numbers in `doc/GAME_DESIGN.md` before code. Never remove `// admin code`. One commit per part, pushed to `origin/main`, every game change adds a `CHANGELOG.md` line under `Unreleased`. `npm test` rewrites the scenarios snapshot: restore it, never commit it.
- **Risks:** the planner is one long page; its purchase tables repeat the Legacy tab tables.
- **Not verified:** the planner was clicked through once at 375 px in the dev preview (fresh profile, Stockpile I planned, begin and confirm worked, no sideways scroll); desktop width, the heirloom pickers, other purchase kinds and the "Back" path were not exercised in a browser.
- **Exact Next Step:** (1) User playtest: Legacy tab, "Plan your next life...", stage Stockpile and a Head Start, check the carried share and start level change, begin the new life and confirm the Legacy left. (2) Decide whether the planner needs trimming. (3) Close 13.36 into a `## 0.x.0` changelog heading.
