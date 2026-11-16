# Project Handoff State

- **Last Updated By:** Claude Code implementer (2026-11-17)
- **Current Goal:** Step 13.17 (gold sinks retune) is done, parts 1 to 4, pushed to `origin/main`. Next is the user's decision on the missed `infuse-rift` target, then a playtest and closing 13.12 to 13.17 into a `## 0.x.0` changelog heading.
- **Recent Changes & Files Touched:**
  - Part 1 docs: GAME_DESIGN §9 (ranks 1.0 / 1.5 / 2.0, `TEMPER_PER_POINT = 0.15`, drills 20% from level 10, "Retune (Step 13.17)" note with measured results); plan Step 13.17.
  - Part 2: `sim/economy.ts` (rank multipliers, temper per point, factor rounded to two decimals); `ui/town/Ranks.tsx` help text from the constants; `ui/town/materialEffect.ts` comment; `ui/town/groupItems.ts` key includes `modifierTempers`; tests recomputed in `sim/modifiers.test.ts`, `persist/crafting.test.ts`, `persist/ranks.test.ts`, `ui/town/Ranks.test.tsx`, `Sockets.test.tsx`, `groupItems.test.ts`.
  - Part 3: `harness/modded.ts` rows `infuse-rift`, `stack-rift` (riftglass only) and `modded.test.ts`.
  - Part 4: `persist/training.ts` (`DRILL_BOOST_LEVEL = 10`, `DRILL_BOOST_XP_FRACTION = 0.2`), `training.test.ts`, Trainer text in `ui/town/Town.tsx`.
- **Active Decisions / Constraints:**
  - Prices unchanged. Guard runs, `--matrix causeway` and `--matrix cinder` are byte-identical to before; `plain` and `arrived` rows of the modded matrix too.
  - Existing tempered or ranked items get stronger in saves (no save change).
  - Measured (seed 1, 100 runs): `stack-rift` Colossus warrior 75, assassin 53, ranger 55, mage 37, cleric 97%; `causeway-deep` HP left +6.1 points; `rank3` 10 to 27%; `infuse-rift` only about +2 points over `socket` (target 5 MISSED). Not tuned further.
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Never remove `// admin code`. One commit per part, pushed to `origin/main`, every game change adds a `CHANGELOG.md` line under `Unreleased`.
- **Not verified:** the new numbers in the browser (Ranks and Trainer text only by static tests).
- **Exact Next Step:** (1) User decides whether to raise the rank I second-modifier effect or accept `infuse-rift`. (2) Playtest ranks, tempers and drills. (3) Close Steps 13.12 to 13.17 into a `## 0.x.0 · date · name` changelog heading.
