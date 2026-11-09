# Project Handoff State

- **Last Updated By:** Claude Code (2026-11-09)
- **Current Goal:** Step 13.6 Cinder Scar (fourth zone, levels 28-34). Parts 1-8 are done and pushed; part 9 (tuning) is done as far as the decided ranges allow, but several acceptance bands are not reachable, so the step is `blocked` on a user decision. Older open items: user playtest of the Causeway, Hollows and Scar; Warrior/Cleric Warden gap.
- **Recent Changes & Files Touched (Step 13.6, 9 commits, 995 tests):**
  - Content: `src/content/enemies.ts` (Cinder Imp, Slag Golem, Pyre Acolyte, Emberwrought Tyrant: first enemy Burn on heroes), `encounters.ts` (`imp-swarm`, `golem`, `cinder-mixed`, `cinder-deep`, `emberwrought-tyrant`), `world.ts` (node/leg/route `cinder-scar`, gate: Reaver defeated), `shop.ts`, `supplies.ts` (`WARMING_TONIC_BURN_ROW`), `contracts.ts` (cinderite Salvage).
  - Sim: new `magicalStatusResistanceBonus` (economy, stats, combat hero actor, equipment stat line); modifiers Emberward, Tempered, Kindled in `ITEM_MODIFIERS`; cinderite in `MATERIAL_RARITY`, crafting tables; `EXPEDITION_IDS`; Tyrant Legacy +3 (`reincarnation.ts`); hero update `warming-tonic-burn-rule` (`heroUpdates.ts`).
  - Harness: `src/harness/cinder.ts` (`--matrix cinder`, tiers Arrived/Prepared/Over, `prepared-notonic`), Tyrant cells in `--matrix elites`, `BUILD_ORDER` now 11 nodes per class, `WardenTier.burnRow` (opt-in; Assassin 13-rule limit handled by dropping the Chill Tonic row).
  - Map: `MapView.tsx` position {470, 290}, height 330. Browser-checked (map, Enchanter locks, Craft ranges, live Imp swarm with Burn on the hero card).
  - Tyrant tuned to 5,200 HP, Power 50, enrage 100 s, interrupt 5%. Numbers, sweep and band misses are in GAME_DESIGN §6 "Fourth zone: Cinder Scar".
- **Active Decisions / Constraints:**
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Do not change the golden duel-basic snapshot. Never remove `// admin code`.
  - No shared vault between heroes. One commit per finished part, pushed to `origin/main`, no force-push.
  - Guards byte-identical to the pre-step baseline: reference CSV, warden, causeway, hollows, built, telegraph; elites apart from new Tyrant rows. Bands were not loosened.
  - Band misses (no allowed lever): arrived Tyrant at most 20 for Assassin 66, Ranger 66, Mage 93 (Cleric 22); prepared Mage 86; Warrior crafted gap +36; Burn check (Tonic loses 2-16 win points); Mage telegraph +3; mixed-fight HP (Ranger/Mage too low, Warrior/Cleric deep 42/41); XP fights per level (89 for cinder-mixed).
- **Not verified:** Golem, Acolyte and Tyrant fights, a cinderite drop and Salvage in the browser; offline and away route with the new zone.
- **Exact Next Step:** (1) User decision on the band misses: the Arrived tier (Bloodbound, Stalwart) is not weaker than Prepared (Tempered, Emberward) for three classes, so a tier-definition change (for example Prepared keeps Bloodbound and Stalwart, Arrived drops them) or a Burn buff (the Tonic needs Burn that matters, beyond the 0.10-0.15 allowed range) is the likely answer; then re-measure and close Step 13.6. (2) Optional: Cleric telegraph rows, Warrior/Cleric Warden gap. (3) User playtest of the Causeway, Hollows and Cinder Scar. (4) Later: Grove/Bastion material drops, a post-Cinder zone.
