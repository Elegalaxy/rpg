# Project Handoff State

- **Last Updated By:** Claude Code (2026-11-08)
- **Current Goal:** Step 13.4 Rift Hollows, parts 1-7 built and pushed (part 8, tuning, waits for a class-work decision). Open: the Reaver is far too easy, Colossus too easy for Assassin/Ranger/Mage, Warrior/Cleric class power vs the Warden, user playtest of the Causeway and the Hollows.
- **Recent Changes & Files Touched (Step 13.4, commits ad3df54, cd9f90a, f93edbf, f0444ca, df9e86f, 12470bd and part 7):**
  - Design in GAME_DESIGN §6 "Third zone: Rift Hollows" (numbers, measured table). Plan: Step 13.4 in-progress.
  - Enemies and encounters (`src/content/enemies.ts`, `encounters.ts`, `hollows.test.ts`): Rift Shade (Bleed), Hollow Channeler (6% ally heal), Riftborn Brute (Rift Cleave, 1.8 s, interrupt 25%), elite Hollowmaw Reaver (L26, 3400 HP, 40 Power, Rift Surge 2.5 s 300% magical, not interruptible, stances). Content only, no sim behaviour change.
  - World: node `rift-hollows` L22-28, gate = Tidebound Colossus defeated, leg from the Splintered Road, route `rift-hollows` (also `EXPEDITION_IDS` in `src/sim/expedition.ts`), map {330,250}, height 300, guidance order.
  - Duskiron: rarity last, sells 8, craft 106-116%, upgrade +4 capped 116%, cost 3.
  - Modifiers: Stalwart (armor, L22, 550), Devout (off-hand/accessory, L22, 550), Bloodbound (weapon, L24, 5% lifesteal, 650 via new optional `recipeGold`, 24 x 25 would be 600). Stalwart/Devout need the Hollows discovered, Bloodbound the Reaver beaten by any hero.
  - Contracts/Legacy: `SALVAGE_BY_MATERIAL` in `src/content/contracts.ts` (riftglass as before, duskiron 5-10, level 25, pays riftglass); Legacy +3 `elite:hollowmaw-reaver` (`reincarnation.ts`). No save version bump.
  - Harness: `--matrix hollows` (`src/harness/hollows.ts`), tiers Arrived L22 / Prepared L24 / Over L27.
- **Measured (seeds 1-3 x 100 runs, no tuning):** every class wins every fight 100% at every tier; Reaver HP lost 15-47% (target wins 40-85%), blind equals rules (the Brute's Cleave does not make interrupts matter), Mage hollows-mixed 0-1% and Ranger Brute 0% lost (below the 15-40% band).
- **Active Decisions / Constraints:**
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Do not change the golden duel-basic snapshot. Never remove `// admin code`.
  - No shared vault between heroes. One commit per finished part, pushed to `origin/main`, no force-push.
  - Warrior/Cleric must not be walled in the Hollows: no Tank archetype, no regeneration, no HP-summon adds; danger is burst.
  - `src/harness/cli.test.ts` "prints a 20-run summary" can time out at 5 s when the whole suite runs together; it passes alone (pre-existing, not touched).
- **Checked in the browser (2026-11-08):** Map shows Rift Hollows node and route ("Rift Hollows: Not discovered yet."), Enchanter lists Stalwart, Devout, Bloodbound with Locked reasons, Craft/upgrade lists duskiron (106% to 116%, +4, cap 116%), no console errors. Not checked: entering the Hollows, a Reaver fight, duskiron drops in the UI, a duskiron Salvage on the board.
- **Exact Next Step:** (1) Part 8 tuning needs a lever to harden the Reaver for all classes (Power, HP, a second telegraph, shorter Surge cooldown) and make the Brute's Cleave matter, without walling Warrior/Cleric; wait for the class-work decision. (2) Ask the user to playtest the Causeway and Hollows. (3) Warrior/Cleric class work and Warden HP tweak (8 to 7 or 6) still open. (4) User still to check: offline, away route, Save panel, Wear button, Going in with.
