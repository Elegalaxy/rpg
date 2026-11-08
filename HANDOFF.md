# Project Handoff State

- **Last Updated By:** Claude Code (2026-11-08)
- **Current Goal:** Step 13.3 Supplies expansion is built and pushed. Open: Colossus too easy for Assassin/Ranger/Mage, Warrior/Cleric class power vs the Warden, user playtest of the Causeway and the new supplies.
- **Recent Changes & Files Touched (Step 13.3, commits 4ef72ed, 642e5e3, 5768eb5, a9edbf7 and parts 5-6):**
  - Design in GAME_DESIGN §9 "Crafted supplies" (table, Stun cleanse dropped, measurements). Plan: Step 13.3 done.
  - Data model: `SupplyDef.price` is `number | null`, `requires?: ModifierRequirement` (`src/content/supplies.ts`); `requirementLock` and `supplyLock` (`src/persist/crafting.ts`); `buySupply` rejects unsold, `brewSupply` rejects locked (`src/persist/town.ts`).
  - Supplies: Warming Tonic (12 gold, brew 2 hide + 4 gold, clears Chill and Burn, heals 10%), Greater Draught (brew 2 riftglass + 10 gold, heals 50%, needs Causeway discovered), Riftglass Ward (brew 2 riftglass + 12 gold, 30% barrier 8 s, needs the Colossus beaten by any hero). Skills in `src/content/skills.ts`.
  - Default rules: `DEFAULT_SUPPLY_ROWS` is now 6 rows (Greater Draught above Healing Draught, Riftglass Ward above Ward Charm, Tonic last). Hero updates `warming-tonic-rule` and `crafted-supply-rules` (`src/persist/heroUpdates.ts`).
  - Harness: `WARDEN_VARIANTS`, `CAUSEWAY_VARIANTS`, `craftedVariant`, `tonicVariant` run beside the tiers. Baseline rows verified identical; reference matrix unchanged.
  - UI: `src/ui/town/SupplyCard.tsx` (Brew only tag, Locked tag and reason), pack list in `src/ui/map/ExpeditionPanel.tsx` hides locked supplies the stash lacks.
  - Measured (seeds 1-2, 60 runs): crafted supplies (3 Greater Draught + Riftglass Ward) lift the prepared Colossus fight to 100% for all five classes (Warrior 37 to 100, Cleric 77 to 100) and the prepared Warden for Assassin 2-5 to 83-90, Ranger 28-40 to 100, Mage to 100; Warrior and Cleric stay 0% at the Warden. The Tonic swap lowered Warden results because the Warden applies no Chill (wasted slot).
- **Active Decisions / Constraints:**
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Do not change the golden duel-basic snapshot. Never remove `// admin code`.
  - No shared vault between heroes. One commit per finished part, pushed to `origin/main`, no force-push.
  - "Skill is ready" ignores resource cost and target availability. Reference loadouts carry no supplies.
  - No win bands were set for crafted supplies; nothing was tuned in code.
- **Checked in the browser (2026-11-08):** Potion Shop cards (Brew only, Locked reasons, Brew disabled), pack list hides locked supplies, Rules editor lists the three new supplies, no console errors. Not checked: fight bar with the new supplies, an unlocked brew in play, Chill/Burn fights with the Tonic. Earlier unchecked: offline, away route, Save panel, Wear button, Going in with.
- **Exact Next Step:** (1) Ask the user to playtest the Causeway and brew a Greater Draught after the Causeway is found. (2) Decide whether crafted supplies make the Colossus too easy (they do for every class) and whether to raise their brew cost or cap packing. (3) Warrior/Cleric class work and Warden HP tweak (8 to 7 or 6) still open. (4) Later: a Steadfast Tonic needs a timed-buff effect; a post-Warden zone (Rift Hollows L22-28).
