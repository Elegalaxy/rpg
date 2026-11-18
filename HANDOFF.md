# Project Handoff State

- **Last Updated By:** Claude Code implementer (2026-11-18), Step 13.28
- **Current Goal:** Step 13.28 "Trading Post: buy materials" is done (3 parts). Next is the user's playtest.
- **Recent Changes & Files Touched:**
  - Docs: GAME_DESIGN §9 "Trading Post: buying materials (Step 13.28)", plan Step 13.28, CHANGELOG `Unreleased` [13.28].
  - Code: `MATERIAL_BUY_MULTIPLIER` (5), `BUYABLE_MATERIALS`, `MATERIAL_BUY_PRICE` in `src/content/shop.ts`; `buyMaterial` in `src/persist/town.ts`; `buyMaterialFromUi` in `src/ui/store.ts`; Sell and Buy groups in `TradingPost` (`src/ui/town/Town.tsx`), CSS in `src/ui/theme.css`; Greyhaven Guide prose (`src/content/guide.ts`) and buy price fact (`src/ui/guide/guideIndex.ts`).
  - Tests: `src/persist/town.test.ts`, `src/ui/town/TradingPost.test.tsx`.
- **Active Decisions / Constraints:**
  - Buy = 5 x sell, common materials only (scrap 10, hide 15, shard 15, witherbark 20, oathsteel 20). Riftglass, duskiron, cinderite are never for sale.
  - Gold comes from the selected hero's purse; debt untouched; refused during an expedition.
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Never remove `// admin code`. One commit per part, pushed to `origin/main`, every game change adds a `CHANGELOG.md` line under `Unreleased`. `npm test` rewrites the scenarios snapshot: restore it, never commit it.
  - Sim untouched; no matrices were run (guards unaffected).
- **Not verified:** layout in a browser (Sell/Buy groups, 375 px, the reserved reason line); tests render static markup only.
- **Exact Next Step:** (1) User playtest of the Trading Post. (2) Close 13.28 with other Unreleased lines into a `## 0.x.0` changelog heading when the milestone closes.
