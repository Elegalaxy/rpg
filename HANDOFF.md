# Project Handoff State

- **Last Updated By:** Claude Code (2026-11-16)
- **Current Goal:** Step 13.11 is done (parts 1-5): timed queueable Trainer drills and material temper. Next is the user's playtest, then closing 13.7 to 13.11 into a 0.x.0 changelog heading.
- **Recent Changes & Files Touched:**
  - Part 1 docs: GAME_DESIGN §9 (Trainer timing, Temper), the wrong "cancel and refund" line fixed, plan Step 13.11.
  - Part 2: `SavedHero.training` and `DRILL_MS` (`persist/save.ts`), `heroAway`, `trainHero` (queues), `advanceTraining` (`persist/training.ts`), called beside `advanceCrafting` in `ui/store.ts` and `persist/offline.ts`; reincarnation blocked while drills queued; Trainer queue in `ui/town/Town.tsx`.
  - Part 3: `modifierTempers`, `TEMPER_PER_POINT`, `scaledBonus(key, value, rank, temper)`, `modifierTextAt(..., temper)` in `sim/economy.ts`; `assertItem` validation.
  - Part 4: `temperGrade`, `withTempers` in `persist/crafting.ts`: craft sets slot 0, Infuse slot 1, Rank up max(old, grade), Open socket also lifts quality.
  - Part 5: `ui/town/materialEffect.ts`, pickers in Craft, Sockets, Ranks; compare notes in `persist/equipment.ts`.
- **Active Decisions / Constraints:**
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Do not change the golden duel-basic snapshot. Never remove `// admin code`.
  - One commit per finished part, pushed to `origin/main`, no force-push. Every game-changing commit adds a line under `Unreleased` in `CHANGELOG.md`.
  - Queueing a drill is still refused while the hero is away; a queue made at home pauses while away. Max 3 queued at once. Offline catch-up advances drills in the same chunks as crafting.
  - Temper is the material grade (scrap 0 to cinderite 5), +3% per point; Hauler's gets none. Rank I with temper 0 runs the old arithmetic (guards byte-identical at seed 1, 5 runs, all eight matrices).
- **Not verified:** a drill finishing in the browser across a tab change; Sockets and Ranks pickers in a browser (tests only); the 300-run matrix diff; an elites variant with tempered gear.
- **Exact Next Step:** (1) User playtest: drills (queue, away pause) and tempered crafting at level 17. (2) Optional harness `--matrix elites` variant with tempered gear (ADD rows only). (3) Close Steps 13.7 to 13.11 into a `## 0.x.0 · date · name` changelog heading.
