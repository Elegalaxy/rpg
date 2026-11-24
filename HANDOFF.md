# Project Handoff State

- **Last Updated By:** Claude Code implementer (2026-11-24, Step 14.5 parts 9 and 10, gates partly open)
- **Current Goal:** Step 14.5, fifth Frontier zone "Bloodthorn Barrens" (levels 34-40). All content, harness, world, bloodstone, Swift move, Salvage/Legacy and an Antidote Bleed rule are in and pushed. The Briar Matriarch is at the best point found after the user's option-1 round; four gates are still open (below). Changelog lines are closed under `## 0.24.0 · 2026-11-24 · Late Frontier`.
- **Recent Changes & Files Touched:**
  - Antidote Bleed rule: `ANTIDOTE_BLEED_ROW` + `withAntidoteBleedRow` (`content/supplies.ts`), added by `startingRules` when the 12-rule limit has room (a Mage has none), hero update `antidote-bleed-rule` (`persist/heroUpdates.ts`), harness tier flag `bleedRow` (Barrens tiers on, all earlier matrices off), `--modes` filter on `--matrix barrens`.
  - Matriarch (`content/enemies.ts`): 6,800 HP, Power 72, enrage 90 s, interrupt 4%, Lash one Bleed at 0.10, Venom Burst five Poison at 0.30, Stalker Bleed 0.30, summon at 50% with level-35 Stalkers. XP: Crawler/Thornwitch 3.4, Stalker 2.9.
  - Guards at seed 1 x 100 against a fresh pre-change baseline: reference, warden, causeway, hollows, cinder, built, telegraph, late byte-identical; elites see the plan Progress line.
- **Active Decisions / Constraints:**
  - Never remove `// admin code`. One commit per part, pushed to `origin/main`; every game change adds a `CHANGELOG.md` line. `npm test` rewrites the scenarios snapshot: restore it (`git checkout --`).
  - Do not run measurements at the same time as the full `npm test`. A filtered `--matrix elites --elites matriarch --tiers prepared --modes rules --runs 100` takes about 70 s.
- **Open gates (Matriarch prepared 55 / 96 / 34 / 52 / 51, Tyrant 52 / 96 / 61 / 93 / 45):** (a) Cleric 51 against a ceiling of 50.3; (b) over-levelled Ranger and Mage 84 (need 85) and crafted minus plain +41 / +2 / +52 / +26 / +35 (limit +30); (d) Ranger rules minus blind -3 (need +10). (c) passes (+31 / +3 / +4 / +19 / +14), (e) and (f) pass. The crafted-minus-plain band and the ceilings of (a) pull in opposite directions (a harder Matriarch drops the Ranger and Mage under 30).
- **Risks:** Antidote is still worse than a Draught at the Matriarch for the Cleric (-24), Warrior and Ranger (-9); Swift is unbuyable for accounts that beat the Tyrant but not the Matriarch and have not learned it; the Matriarch hits the Ranger hardest through Poison and Bleed.
- **Not verified:** a live fight with Bleed on the hero card (the Browser pane was hidden earlier, the loop did not advance).
- **Exact Next Step:** Decide the open gates: accept (b) crafted-minus-plain and (d) Ranger as exceptions, allow Power above 72 with a Ranger/Mage sustain fix, or rework the Antidote (its rule threshold at 3 stacks wastes it against five-stack Venom Burst). Then record the decision in GAME_DESIGN and close Step 14.5.
