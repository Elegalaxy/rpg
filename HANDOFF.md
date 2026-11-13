# Project Handoff State

- **Last Updated By:** Claude Code (2026-11-14)
- **Current Goal:** Step 13.7 playtest fixes (feedback of 2026-11-11). Bug batches 1-5, the What's new page and batch 6 parts 1-3 are done; Part 4 (upgrades) and Part 5 (map layout) remain.
- **Recent Changes & Files Touched:**
  - Batch 6 part 3 (town lists): Enchanter grouped into folding sections by first item kind (`Town.tsx`), new-recipe badge from `src/ui/town/enchanterSeen.ts` (localStorage `rpg.enchanterSeen`, Town nav + Enchanter sub-tab), Brew 1 / Brew 4 / Brew max in `SupplyCard.tsx`, Trading Post lists all materials with "Where to find" (`src/content/materialSources.ts`), Loadout and each rule's Conditions fold (`Loadout.tsx`, `Rules.tsx`), shared `src/ui/Collapsible.tsx` + `.fold` styles in `kit.css`.
  - Earlier: batch 6 part 1 (quick wins) and part 2 (run dock), What's new page, batch 5 fractional regen.
- **Active Decisions / Constraints:**
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Do not change the golden duel-basic snapshot. Never remove `// admin code`.
  - No shared vault between heroes. One commit per finished part, pushed to `origin/main`, no force-push.
  - Guards byte-identical; `src/sim` must not change. Every game-changing commit adds a line under `Unreleased` in `CHANGELOG.md`.
  - A recipe that fits several kinds of item is listed under its first kind (no Accessories group exists today: none starts with accessory).
  - Combo stacks still need a design description from the user.
- **Not verified:** the new-recipe badge and "New" tag in the browser (the test hero had learned every level-appropriate recipe); loadout "Learned, not equipped" fold with spare skills.
- **Exact Next Step:** (1) Part 4, upgrades: unlimited queue, "Queue all" queues every affordable worn item, costs paid at queue time, optional `chained` job field, old saves must load; per-item rows with their own material select; `QualityHelp` already exists. (2) Part 5, map layout. (3) User playtest of the Causeway, Hollows and Cinder Scar.
