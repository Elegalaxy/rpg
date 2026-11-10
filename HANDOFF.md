# Project Handoff State

- **Last Updated By:** Claude Code (2026-11-10)
- **Current Goal:** Step 13.6 Cinder Scar is closed as `done` with accepted deviations (part 10, Option A). Open items: user playtest of the Causeway, Hollows and Cinder Scar; Warrior/Cleric Warden gap; optional Cleric telegraph rows.
- **Recent Changes & Files Touched (part 10):**
  - `src/harness/cinder.ts`: `CINDER_PREPARED_MODIFIERS` is the Arrived set with Emberward on hands and feet (replaces Nimble); Bloodbound, Stalwart, Vicious, Quick kept; Prepared and Over use it; Cleric override `{ offHand: 'kindled', accessory1: 'devout' }`; new variant `prepared-noember` (`noemberVariant`) beside `prepared-notonic`.
  - `src/content/enemies.ts`: Tyrant 5,400 HP, Power 68 (user-approved deviation outside 50-62); Imp xpMultiplier 0.88, Golem 2.2, Acolyte 2.2 (in its overrides).
  - Tests: `src/harness/cinder.test.ts` (variants, modifier checks), `src/content/cinder.test.ts` (Tyrant 5400/68, Acolyte overrides, XP about 40-41 fights per level).
  - Docs: GAME_DESIGN §6 "Option A" (tiers, Tyrant, XP, Emberward check replaces the Burn check, final tables, accepted deviations); IMPLEMENTATION_PLAN Step 13.6 done, Part 10 line.
- **Results (seeds 1-3 x 100, rules):** Tyrant wins arrived/prepared/over: Warrior 0/35/89, Assassin 6/75/95, Ranger 4/59/96, Mage 3/74/97, Cleric 0/43/100. Regular fights 100%. Emberward check +15 to +43 (all five classes).
- **Active Decisions / Constraints:**
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Do not change the golden duel-basic snapshot. Never remove `// admin code`.
  - No shared vault between heroes. One commit per finished part, pushed to `origin/main`, no force-push.
  - Guards byte-identical to the pre-change baseline: reference CSV, warden, causeway, hollows, built, telegraph; elites apart from Tyrant rows.
  - Accepted deviations: Mage telegraph 0, Assassin +6; mixed-fight HP 5 of 10 cells in band; Warming Tonic close to obsolete in the Scar (Burn immunity on the Tonic needs a new sim effect, follow-up); Tempered looks like a trap pick vs Bloodbound on the weapon slot (in no tier, flagged).
- **Not verified:** Golem, Acolyte and Tyrant fights, a cinderite drop and Salvage in the browser; offline and away route with the new zone; the Tyrant at Power 68 in the live UI.
- **Exact Next Step:** (1) User playtest of the Causeway, Hollows and Cinder Scar (Tyrant at Power 68). (2) Optional: Cleric telegraph rows, Warrior/Cleric Warden gap, Tonic Burn immunity effect, Tempered review. (3) Later: Grove/Bastion material drops, a post-Cinder zone.
