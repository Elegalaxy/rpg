# Project Handoff State

- **Last Updated By:** Claude Code implementer (2026-11-17)
- **Current Goal:** Step 13.21 "Wider supply tiers" is done, parts 1 to 4. Next is the user's call on the band misses below.
- **Recent Changes & Files Touched:**
  - Docs: GAME_DESIGN §9 ("Changed 2026-11-17 (Step 13.21)": rules, both sweeps, before/after tables), plan Step 13.21.
  - Sim: `telegraphWard` effect gets optional `charges` (`types.ts`, `skills.ts` parse, `combat.ts` spend: one charge per warded skill, cleared at 0). `hero.telegraphWard.charges`. Omitted means 1, key absent in the parsed effect, so the Ward Charm and all other content are unchanged.
  - Content and UI: `content/skills.ts` (Greater Draught 40%, Riftglass Ward 8 s, 2 charges, 0.35), `content/supplies.ts` texts, `ui/skillInfo.ts` ("next 2 telegraphed attacks"), `content/ruleTemplates.ts` Riftglass hint ("8 seconds or 2 hits"), tests in `sim/telegraphWard.test.ts` and `content/supplies.test.ts`.
- **Active Decisions / Constraints:**
  - Greater Draught row stays at HP at most 40%. Ward Charm stays 1 hit, 5 s, 0.5. `ward already up` skips while charges and time remain.
  - Record design numbers in `doc/GAME_DESIGN.md` before code. Never remove `// admin code`. One commit per part, pushed to `origin/main`, every game change adds a `CHANGELOG.md` line under `Unreleased`.
- **Measured (elites matrix, rules, seeds 1-3 x 100, crafted minus plain, band at most +30):** Draught 40 / 45 / 50 all break it far more than 13.20 did; 40 chosen (smallest). Cells above +30: 2 before, 8 after (Warden Warrior +53, Assassin +55, Ranger +41, Mage +49; Colossus Ranger +38, Mage +36; Reaver Warrior +43; Tyrant Warrior +40). Crafted tier now wins 84-99% against the elites. Riftglass fraction 0.25 / 0.35 / 0.5 moves wins by at most noise except Tyrant Cleric (74 / 67 / 66).
- **Guards:** telegraph, built, modded, cinder, hollows, reference (seed 1), reference CSV, golden duel snapshot identical to before; warden and causeway matrices change only in crafted rows.
- **Not verified:** the in-game UI (supply text, skill info line, template picker) in a browser.
- **Exact Next Step:** (1) User decides: accept the band misses, or weaken the crafted tier (smaller Draught gap, or fewer crafted supplies per run) and re-measure. (2) Crafted backpack ideas (the original 13.21 note) are still open.
