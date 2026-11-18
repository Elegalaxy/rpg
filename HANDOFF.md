# Project Handoff State

- **Last Updated By:** Claude Code implementer (2026-11-18)
- **Current Goal:** Step 13.31 "Lean inheritance" is done (parts 1 to 4). Reincarnating keeps only a share of gold, materials and supplies; five new Legacy purchases carry long-run growth. Next is the user's playtest and a balance call.
- **Recent Changes & Files Touched:**
  - Docs: GAME_DESIGN §10 "Carry-over and Stockpile (Step 13.31)", §9 sell line, plan Step 13.31, CHANGELOG `Unreleased` [13.31].
  - Persist: new `src/persist/carryOver.ts` (share 20%, Stockpile 30/40/50, `carryOver`, `carriedPurse`, `carrySummary`); `save.ts` (optional `purchases.stockpile/artisan/longMemory/thirdHeirloom`, `pastLifeItemIds`, Head Start check up to 3); `reincarnation.ts` (new constants, `recallTarget`, `artisanTokens`, craft-queue block, tiered heirloom, new purchase kinds, `nextLifePreview.carry/tokens`); `town.ts` (`sellPriceFor`, `sellItem` prunes the id).
  - UI: `Legacy.tsx` (two purchase groups, Carried share KPI, "Carries over" block, confirm line), `Town.tsx` (earlier-life price and tag), `groupItems.ts`, `character.css`, Guide (`content/guide.ts`, `guideIndex.ts` facts).
- **Active Decisions / Constraints:**
  - Carry rule: `kept = floor(n * pct / 100)` per material and supply id; debt is paid from gold first, then gold' = floor, debt' = ceil. The rest is lost, not converted to Legacy.
  - Gear, free upgrades, pack, recipes, craft XP, route returns and mastery stay whole. Guard A: archive items at reincarnation sell at the carried share (`pastLifeItemIds`). Guard B: reincarnation is refused while the craft queue is not empty.
  - Purchases: Stockpile 20/35/50, Artisan's Favor 30/45 (tokens stack across lives, +1 token on buy), Long Memory 25/40 (Recall to peak +3/+6), Head Start III 55 (level 15), Third Heirloom 50. 335 Legacy over 9 buys.
  - `src/sim`, content numbers and the harness are untouched: no matrix run was needed.
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Never remove `// admin code`. One commit per part, pushed to `origin/main`, every game change adds a `CHANGELOG.md` line under `Unreleased`. `npm test` rewrites the scenarios snapshot: restore it, never commit it.
- **Risks:** the first reincarnation after this change cuts an existing hoard (10,000 gold keeps 2,000 at the base share). Guard B blocks reincarnating while craft jobs run, which can surprise a player with a long queue.
- **Not verified:** the Legacy screen and the Town sell tab in a browser, and at 375 px (tests are static markup only).
- **Exact Next Step:** (1) User playtest: reincarnate with gold and materials, check the preview numbers match, buy Stockpile and see them change. (2) Decide whether the shares or Legacy costs need tuning. (3) Close 13.31 into a `## 0.x.0` changelog heading.
