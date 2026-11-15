# Project Handoff State

- **Last Updated By:** Claude Code (2026-11-16)
- **Current Goal:** Step 13.10 Gold sinks is done (parts 1-4): Trainer drills, a second modifier socket with Open socket and Infuse jobs, and modifier ranks I to III. Next is the user's playtest, then closing 13.7 to 13.10 into a 0.x.0 changelog heading.
- **Recent Changes & Files Touched:**
  - Part 1 docs: GAME_DESIGN §9 "Gold sinks: trainer, sockets, ranks" (all numbers), §8 notes that "one modifier per item" is replaced by the socket rule; plan Step 13.10.
  - Part 2: `src/persist/training.ts` (`trainHero`, `withXp`), `SavedHero.drillsThisLevel` (save.ts, roster.ts, reincarnation.ts; world.ts and contracts.ts award XP through `withXp`), Trainer place (`content/places.ts`, `Trainer` in `ui/town/Town.tsx`).
  - Part 3: `socketed` and `MAX_ITEM_MODIFIERS` in `sim/economy.ts`; job kinds `socket` and `infuse` in `persist/crafting.ts` and `save.ts`; `ui/town/Sockets.tsx`; tests `persist/sockets.test.ts`, `ui/town/Sockets.test.tsx`.
  - Part 4: `modifierRanks`, `scaledBonus`, `modifierTextAt` in `sim/economy.ts`; job kind `rank` (`queueRankUp`); `ui/town/Ranks.tsx`; compare notes in `persist/equipment.ts`; tests `persist/ranks.test.ts`, `ui/town/Ranks.test.tsx`, `sim/modifiers.test.ts`.
- **Active Decisions / Constraints:**
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Do not change the golden duel-basic snapshot. Never remove `// admin code`.
  - One commit per finished part, pushed to `origin/main`, no force-push. Every game-changing commit adds a line under `Unreleased` in `CHANGELOG.md`.
  - Guards stay byte-identical; rank I and absent ranks run the old arithmetic (checked at seed 1, 5 runs, all eight matrices).
  - An item held by a queued job takes no other socket, infuse or rank job until it is back; jobs cannot be cancelled. Hauler's cannot be ranked. No max hero level exists, so drills have no max-level refusal.
  - Drill XP is rounded half up (351 at level 17); rank III material is riftglass, duskiron or cinderite.
- **Not verified:** a real drill click in the browser (the only test hero was on a run during part 2); an Infuse job on a worn item in the browser (tests cover it); the optional `prepared-infused` elites variant was not added; the Tyrant at Power 68 and Cinder Scar items; defeat-rest start refusal; keyboard focus ring; the 300-run reference matrix diff.
- **Exact Next Step:** (1) User playtest: drills, sockets, ranks against the Drowned Causeway at level 17. (2) Optional harness `--matrix elites` variant with infused and ranked gear (ADD rows only). (3) After the playtest, close Steps 13.7 to 13.10 into a `## 0.x.0 · date · name` changelog heading.
