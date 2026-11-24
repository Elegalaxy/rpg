# Project Handoff State

- **Last Updated By:** Claude Code implementer (2026-11-24, Steps 14.3 and 14.4)
- **Current Goal:** Steps 14.3 and 14.4 are done and pushed to `origin/main`: Warming Tonic Burn immunity, Tempered fix, four late modifiers, and the Amulet and Talisman accessory bases.
- **Recent Changes & Files Touched:**
  - 14.3: `statusImmunity` supply effect (`sim/types.ts`, `skills.ts`, `combat.ts`, `statuses.ts`, `log.ts`); Warming Tonic 10 s Burn immunity, 15 gold, brew 5 gold (`content/skills.ts`, `supplies.ts`); `physicalStatusResistanceBonus` (`economy.ts`, `stats.ts`, hero field in `combat.ts`, stat row in `persist/equipment.ts`); Staunch, Ruthless, Ironbound (7% after fallback), Swift unlock on the first Tyrant defeat; Tempered +6 on weapons and accessories.
  - 14.4: accessory bases Amulet (0.025% max HP per item level) and Talisman (0.1 points crit damage per item level) after halving once; Ring and Charm are `starterOnly`; `implicitBonuses`, `addStatBonuses`, `gearBonusesFor` in `economy.ts`, used by `persist/equipment.ts` and `expeditionSetup.ts`; `ImplicitLine` in `ui/Kit.tsx`.
  - Harness: `src/harness/late.ts`, `--matrix late [--classes ..] [--tiers ..]`. Numbers and tables in GAME_DESIGN "Late modifiers and Cinder fixes" and section 9 "Accessory bases".
  - Guards (reference CSV, warden, causeway, hollows, built, telegraph) byte-identical at seed 1 x 100; elites differ only in Tyrant rows.
- **Active Decisions / Constraints:**
  - Never remove `// admin code`. One commit per part, pushed to `origin/main`; every game change adds a `CHANGELOG.md` line under `Unreleased`. `npm test` rewrites the scenarios snapshot: restore it (`git checkout --`).
  - Do not run measurements at the same time as the full `npm test`.
- **Risks:** Tyrant prepared was already 46 / 93 / 59 / 93 / 41 before 14.3 (Assassin and Mage above the 85 band, the 2026-11-10 numbers stale); 14.3 moved it +6 / +3 / +2 / +1 / +4. Tempered on the weapon still loses badly to Bloodbound (-17 to -55 points); Staunch has no use until a level 32+ enemy applies Bleed or Poison. Warden prepared per-seed results are noisy (about +/-10).
- **Not verified:** the late modifiers in the Enchanter and Craft screens in a browser (unit-tested only); the implicit line was browser-checked at 1280 and 375 wide.
- **Exact Next Step:** decide whether to rebalance the Tyrant cells (Assassin and Mage too strong); close 13.36 to 13.50 and 14.x into a `## 0.x.0` changelog heading after the user's playtest.
