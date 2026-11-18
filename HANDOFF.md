# Project Handoff State

- **Last Updated By:** Claude Code implementer (2026-11-18), Step 13.24
- **Current Goal:** Step 13.24 "First-clear rewards" is done (parts 1 to 5). Next is the user's call on the early-socket question below.
- **Recent Changes & Files Touched:**
  - Docs: GAME_DESIGN §9 "First-clear rewards (Step 13.24)" plus the free-upgrade measurement, §10 (ZONE_CLEAR_BONUS, carries over), §12 Guide line; plan Step 13.24; CHANGELOG `Unreleased` [13.24].
  - Content/persist: `content/firstClear.ts`, `persist/firstClear.ts`, `SavedHero.firstClearIds?/freeUpgrades?`, payout in `settleExpedition` (returned runs only), `firstClearPreview` in `persist/world.ts`, `HeroAwaySummary.firstClears`, `zone:<node>` Legacy bonus in `persist/reincarnation.ts`, `spendFreeUpgrade` + `free` arg on `socketCheck`/`rankCheck` in `persist/crafting.ts`.
  - UI: `ui/town/FreeUpgrade.tsx`, Sockets/Ranks buttons and tag, outcome-card pill line, route-card Kpi (`route-first-clear`), away report line, Guide prose and per-zone facts.
  - Harness: `--matrix free` (`src/harness/freeUpgrade.ts`; env `FREE_LEVELS=10,13`, `FREE_HARD=1`). Sim untouched.
- **Active Decisions / Constraints:**
  - The store/crafting functions are named `spendFreeUpgrade*` (not `use*`): oxlint treats `use*` as a hook.
  - Tokens: socket (hero level 10, no quality lift, no cost) or rank I to II only. Paid per hero per zone NODE, only on a returned run; old saves paid retroactively; reincarnation keeps both fields.
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Never remove `// admin code`. One commit per part, pushed to `origin/main`, every game change adds a `CHANGELOG.md` line. `npm test` rewrites the scenarios snapshot: restore it, never commit it.
- **Measured (seeds 1-3 x 100):** level 10 free sockets (+ scrap infuse) lift mean wins +1.7 (3 tokens) / +2.8 (4) vs paid socket +3.8; one cell (Warrior vs Echo Knight) 21% to 50%. Levels 13, 16, 17 already 0 or 100% in every cell. No spike, so no fallback applied.
- **Not verified:** the Legacy screen's "First clear" bonus line and the Ranks free button in a browser; away report line only in tests. Level-13 Causeway "hard" run was not finished. Checked in a browser: outcome pill, route Kpi, Sockets free button + confirm + result + token tag at 375 px, Guide facts.
- **Exact Next Step:** (1) User decides: keep early free sockets, or limit sockets to the Causeway, Hollows and Cinder tokens (earlier tokens rank up only). (2) Follow-up: hero-card title for first clears.
