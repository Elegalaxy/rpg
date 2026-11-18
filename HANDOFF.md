# Project Handoff State

- **Last Updated By:** Claude Code implementer (2026-11-18)
- **Current Goal:** Step 13.22 "Crafted backpack" is done (parts 1 to 4, 2b, 2c). 2c raised the stack limit from 2 to 3 above 4 slots (user's choice). Next is the user's playtest and the call on the Satchel balance below.
- **Recent Changes & Files Touched:**
  - Docs: GAME_DESIGN §9 Inventory ("Crafted backpack (Step 13.22)": stack limit changed to 3, measurement with limit 3), plan Step 13.22 (Part 2c), CHANGELOG `Unreleased` [13.22].
  - Code: `SUPPLY_STACK_LIMIT = 3` in `src/sim/expedition.ts` (the refusal text, `persist/pack.ts`, save check, Potion Shop batch all follow the constant); `src/harness/pack.ts` fillers now fill under 3 of each (plain 5 slots = 3 Draughts, Ward Charm, Antidote; crafted 5 = 3 Greater Draughts, Riftglass Ward, Ward Charm); tests updated (sim, persist, harness, UI strings "At most 3 of each supply with a backpack.").
- **Active Decisions / Constraints:**
  - Above 4 slots a run carries at most 3 of any supply; 4 slots unchanged. Reincarnation keeps the pack.
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Never remove `// admin code`. One commit per part, pushed to `origin/main`, every game change adds a `CHANGELOG.md` line under `Unreleased`. `npm test` rewrites the scenarios snapshot: restore it, never commit it.
- **Measured (seeds 1-3 x 100, mean wins, 4 / 5 / 6 slots, limit 3):** plain prepared 57.6 / 57.6 / 57.6 (extra slots hold Antidote and Smoke Bomb, which the default rows never use, so the Satchel is neutral); crafted prepared 88.2 / 90.9 / 96.5, cells at 95 or more 5 / 8 / 16 of 20. Only the Field Pack is a large step. Guards at 4 slots identical to before.
- **Also on main (another implementer):** Step 13.23 "In-game Guide"; its text has no digits, so no Guide change was needed.
- **Not verified:** 375 px layout of the Backpack counter; the Potion Shop batch buttons (3 with a pack) in a browser (tests only).
- **Exact Next Step:** (1) User playtest: craft a Satchel at the Armorer, pack a run, reincarnate and check the pack stays. (2) Decide whether the Satchel should do something for plain default rows (needs rules that use the extra slots, for example another Ward Charm row). (3) Close 13.22 into a `## 0.x.0` changelog heading.
