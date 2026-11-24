# Project Handoff State

- **Last Updated By:** Claude Code implementer (2026-11-24, Step 14.5, parts 1-8 done, part 9 blocked)
- **Current Goal:** Step 14.5, fifth Frontier zone "Bloodthorn Barrens" (levels 34-40). The content, harness, world node, bloodstone and Swift move are in and pushed; the Briar Matriarch cannot be tuned into its bands without a user decision (Step status `blocked`).
- **Recent Changes & Files Touched:**
  - P1 docs (GAME_DESIGN "Fifth zone: Bloodthorn Barrens", plan Step 14.5). P2 `content/enemies.ts` + `encounters.ts` (Barbed Stalker, Venomhide Crawler, Thornwitch, Briar Matriarch; XP scaled to about 40 barrens-mixed fights per level: Crawler/Thornwitch 3.4, Stalker 2.9) and `content/barrens.test.ts`.
  - P3 `harness/barrens.ts` (`--matrix barrens`, filters `--classes --tiers --fights`), `matriarch` cells in `--matrix elites`, 12th node per class in `BUILD_ORDER`.
  - P4 world node/leg/route `bloodthorn-barrens` (map {430,205}, `EXPEDITION_IDS`, guidance). P5 bloodstone (tables, `materialTemper` clamp to 5, `rareMaterialsText()`). P6 Swift needs the Matriarch. P7 Salvage bloodstone, Legacy (+3 elite, +2 zone), Remembered Paths.
  - P8 browser check done except a live fight (the Browser pane was hidden, so the fight loop did not advance). All CHANGELOG lines are under `Unreleased`.
- **Active Decisions / Constraints:**
  - Never remove `// admin code`. One commit per part, pushed to `origin/main`; every game change adds a `CHANGELOG.md` line. `npm test` rewrites the scenarios snapshot: restore it (`git checkout --`).
  - Do not run measurements at the same time as the full `npm test`. A filtered `--matrix elites --elites matriarch --tiers prepared --modes rules --runs 100` takes about 70 s.
  - The Matriarch in code keeps the proposed numbers (6,300 HP, Power 78, enrage 100 s, status 0.15, interrupt 5%).
- **Blocker (needs the user):** Matriarch prepared is 98 / 95 / 31 / 57 / 96 (W/A/R/M/C) against Tyrant prepared 52 / 96 / 61 / 93 / 45. No point in HP 5,800-6,800 x Power 72-84, enrage 90 s, interrupt 4-8% or status 0.18 satisfies band (a): Warrior, Assassin and Cleric stay at 90%+ until the Ranger and Mage fall under 30%. Tables in GAME_DESIGN under Fifth zone.
- **Risks:** Antidote is worse than a Draught at the Matriarch (prepared minus noantidote -2 / -3 / -41 / -29 / -1); Staunch check passes for 1 class of 5 (needs 3); arrived passes for 3 of 5; Swift becomes unbuyable for accounts that beat the Tyrant but not the Matriarch and have not learned it.
- **Not verified:** guards causeway, hollows, cinder, late and elites vs the pre-step baseline (the long runs were stopped; reference, warden, built and telegraph at seed 1 x 100 are byte-identical); a live fight with Bleed on the hero card. `--expedition bloodthorn-barrens` seeds 1-5 run cleanly (1 defeat at seed 4, in the first Barrens fight).
- **Exact Next Step:** Decide the Matriarch: allow Power above 84 or class-specific pressure, relax band (a), or give the Ranger/Mage more sustain; then finish P9 (tune, run the guards and the expedition check) and P10 (close docs, changelog heading).
