# Changelog

Every notable change to the game, newest first. Built from the git history (first commit 2026-10-22).
Design numbers live in `doc/GAME_DESIGN.md` and step status in `doc/IMPLEMENTATION_PLAN.md`; this file is the readable summary.

**Categories:** New (feature or content) · Improved (UX, clarity, quality of life) · Balance (numbers and rules that change difficulty) · Fixed (bug) · Tech (tests, harness, tooling, docs)

**How to update:** when a part or batch is committed, add its lines under `Unreleased`. When a milestone is closed, move them under a new patch heading (`## 0.x.0 · date · name`). Keep one line per change, in plain player-facing words, with the plan step in brackets.

---

## Unreleased: playtest fixes (Step 13.7, in progress)

Source: playtest feedback of 2026-11-11. Bug batches 1-5 are being built; the UI rework (batch 6) follows.

- Fixed: gear no longer returns to 100% durability at the start of every run, so wear carries over and repair matters again (Step 13.7, batch 1).
- Improved: a run cannot start while a worn piece is disabled or the 5-minute rest after a defeat is pending, and the reason is shown (Step 13.7, batch 1).
- Fixed: the live fight is numbered from the run, and fights played while you were away show as "Fight N · played while away" chips (Step 13.7, batch 2).
- Fixed: the loot bag says "Full" at capacity and "Nearly full" below it (Step 13.7, batch 2).
- Improved: the run panel shows Carried gold, Banked gold and gold dropped this run, so the purse reading 0 during a run is explained (Step 13.7, batch 2).
- Improved: preparation changes save automatically; an invalid or unsaved change blocks Start and says so (Step 13.7, batch 2).
- Improved: contracts show "+N pending this run" on the live run, and the run panel states your standing orders (Step 13.7, batch 2).
- Improved: the "while you were away" report says how often the standing orders pushed on or walked home (Step 13.7, batch 2).
- Fixed: the fight view no longer jumps when you queue a skill or supply: Queue buttons are always drawn (disabled with the reason in the tooltip), and the queued, error, "used" and "just used" lines keep their space (Step 13.7, batch 3).
- Fixed: crafting and upgrade selects keep one width, with short option names and the effect text on its own reserved line (Step 13.7, batch 3).
- Improved: shop and archive comparisons name the worn piece that is replaced ("Replaces: Hauler's Medium Chest · L8 · 98%"), show bag room and lost or gained modifiers, round stats to one decimal and sign each change (Step 13.7, batch 4).
- Fixed: HP regeneration while walking is no longer rounded each second; the leftover fraction carries over, so low-VIT heroes (Elf, Undead at VIT 9 heal 0.45 HP/s) heal too, and the run panel shows the rate as "+N HP/s between fights" (Step 13.7, batch 5).
- New: an in-game "What's new" page lists the patch notes with category filters (Step 13.7).
- Improved: the Contract Board is now the first town tab and opens by default (Step 13.7, batch 6).
- Balance: walking between fights plays at 8x your chosen speed, and 16x on a mastered route; it is playback only, so nothing in the run changes (Step 13.7, batch 6).
- Improved: a "?" next to Mastery and the locked 8x button explains what mastery counts and what it unlocks (Step 13.7, batch 6).
- Improved: a "?" next to item quality and in the Upgrade section explains what quality does and that upgrades never lower it (Step 13.7, batch 6).
- Improved: the "while you were away" table shows which route each hero ran (Step 13.7, batch 6).
- Improved: the fight view shows the last escape attempt (Escaped at X s, or Escape failed, with HP and the roll), and escaped fights are marked "Escaped" on the run chips (Step 13.7, batch 6).
- Improved (planned): run mini-panel, grouped enchanter, batch brewing, upgrade queue and map layout (batch 6, next parts).

## 0.10.0 · 2026-11-09 to 2026-11-10 · Cinder Scar (Step 13.6)

- New: **Cinder Scar**, a fourth zone (levels 28-34) behind the Hollowmaw Reaver. Enemies Cinder Imp, Slag Golem, Pyre Acolyte and the elite **Emberwrought Tyrant**; first enemies that burn heroes.
- New: **cinderite** material (sells 10, craft quality 110-120%, upgrade cap 120%) and its Salvage contract.
- New: **Emberward**, **Tempered** and **Kindled** modifiers; gear can now give magical status resistance.
- New: default Warming Tonic rule that fires at 3 Burn stacks, added once to existing heroes.
- New: Tyrant first defeat gives Legacy +3.
- Balance: Tyrant 5,400 HP and Power 68; Prepared keeps Bloodbound and Stalwart and adds Emberward; Golem and Acolyte XP x2.2.
- Tech: `--matrix cinder`, Tyrant rows in `--matrix elites`, no-Tonic and no-Emberward variants, 11-node builds.

## 0.9.0 · 2026-11-08 to 2026-11-09 · Class balance pass (Step 13.5)

- Balance: Warrior (Driving Blow, Sundering Blow, Second Wind 10%, Shield Brace), Cleric (Smite, Judgment, Zeal) and Mage (Mana Ward) retuned.
- Fixed: Warrior, Cleric and Assassin reference rules now target the lowest Armor or Resistance (the real cause of the Warden gap), Assassin Smoke Step moved to a filler row.
- Balance: Warden HP x7 with stacking pressure; Colossus and Reaver get a late enrage (`timePressure`), Colossus action time 2.2 s, Reaver Power 65 and Rift Surge cooldown 9 s.
- Balance: Greater Draught heal 50% to 35% and its default rule at 40% HP; Riftglass Ward barrier 30% to 25%.
- Fixed: Ranger at the Reaver (arrived 84% to 8%) by making Fade Back only partly dodge Rift Surge (`dodgedDamageFraction` 0.6).
- Tech: `--matrix elites` with row filters; vitest timeout raised to 30 s; full re-measure recorded in the design doc.

## 0.8.0 · 2026-11-08 · New zones, drops, supplies and offline extras (Steps 12.6, 13.1-13.4)

- New: **Drowned Causeway** zone, **Tidebound Colossus**, riftglass material, Hallowed, Rending and Siphoning modifiers (lifesteal hook), Salvage contract.
- New: **Rift Hollows** zone (levels 22-28) behind the Colossus, **Hollowmaw Reaver**, duskiron material, Stalwart, Devout and Bloodbound modifiers, zone-aware Salvage.
- New: Grove and Bastion enemies drop witherbark and oathsteel (hide and shard); fights before a route's last node drop gold only.
- New: crafted supplies **Warming Tonic**, **Greater Draught** and **Riftglass Ward** (brew only, unlocked by progress) with default rules.
- New: offline extras: per-hero run limit, other heroes run their away route while you are away or the page is open, per-hero away table and Roster badges, mastered routes (10 safe returns) play at x8.
- Improved: Potion Shop shows "Brew only" and locks; pack list hides locked supplies.
- Fixed: offline seed derivation threw for real timestamps.

## 0.7.0 · 2026-11-07 to 2026-11-08 · Telegraphs and the Warden (Steps 12.3-12.5)

- New: mid-game heavy telegraphs: Bramble Slam and Shield Bash are interruptible (25% of max HP); telegraph and interrupt rules watch every enemy; UI shows wind-ups and interrupt progress.
- Balance: Ward Charm default rule is telegraph and hero HP at most 70%.
- Tech: `--matrix telegraph` and `--matrix warden` (class x three tiers); findings recorded.

## 0.6.0 · 2026-11-06 to 2026-11-07 · Playtest batches A-C and a cleaner UI

- New: Mend's cleanse, the Ward Charm, supply brewing and Deserter theft.
- New: bigger bag, safe pouch and bag-full order; queue carried supplies and an Escape now button; Vicious, Sturdy and Hauler's modifiers with a two-per-modifier stack cap.
- New: new rule conditions (HP points, missing HP, skill ready, fight time, rank, boss phase), rule summaries and Duplicate.
- New: Buy and wear, gear comparison in shops, a "Going in with" summary, purse bar, route facts and Delete hero.
- Improved: every screen converted to scannable components (stat cards, key-value rows, tags, tighter rule rows); explanations moved into "?" tooltips.
- Improved: upgrade materials add quality; away route auto-starts; skill facts on known nodes; starting-skill nodes each add a small bonus.
- Fixed: recipe level gate, per-shop craft badges, route facts alignment, defeat supplies.

## 0.5.0 · 2026-11-04 · Offline catch-up and playtest round 3

- New: **offline catch-up**: time away is replayed with standing orders and a summary; loot and gold of fights won while away are halved.
- New: Save file panel; the oldest save shape is tested to load.
- Improved: backpack steppers, outcome-coloured fight tabs, green/red gear comparison, badges, shared log filter, Items used filter, split damage and healing filters, crafting on the wall clock.
- Fixed: upgrades always succeed; discovered places are announced.

## 0.4.0 · 2026-11-02 to 2026-11-03 · Playtest rounds 1-2, supplies and per-hero wealth

- New: supplies (Healing Draught, Antidote, Smoke Bomb); each hero has its own gold, materials, items, contracts, crafting queue and debt (recipes and discoveries stay shared).
- New: Fade Back (Ranger dodge, 16 s cooldown); stance and interruptible-telegraph rule conditions; Greyhaven split into places with crafting anywhere; rolled contract board; Bank and Potion Shop renames.
- New: class gear limits with Cross-Training; worn gear can be sold; upgrade worn items in place; all modifier recipes sold in the shop.
- Improved: first styling pass, themes and Style menu, desktop side panel, sub-tabs, redesigned Gear screen, fight view and log panel, skill web intros and node descriptions.
- Balance: Ranger arrows +30%, lowest-Armor targeting for Ranger and Assassin, Echo Knight 3,200 HP, Rootmaw Stalker 1,000 HP, Vow of Zeal 7 Faith.
- Tech: built-hero reference builds and matrix.

## 0.3.0 · 2026-11-01 · Reincarnation and first playable shell

- New: Echo ranks, reincarnation, Legacy purchases, mastery and heirlooms; start screen, tabs and next-step hint; XP needed shown in roster and header.
- Improved: expedition walk plays four times faster (the simulated journey is unchanged).
- Tech: GitHub Pages deploy so the game can be tried on a phone.

## 0.2.0 · 2026-10-31 · The playable loop

- New: racial cores, five class webs, sixteen racial nodes and three Undead curses; hero creation and roster (20 race and class pairs); attribute and skill-web screens; loadout and priority-rule editor.
- New: Fractured Frontier world, node map with a travelling marker, full expedition panel (prepare, play, settle), items and equipment, town services, crafting, contracts and hero XP.
- New: versioned local save that survives reloads and in-progress expeditions.

## 0.1.0 · 2026-10-22 to 2026-10-24 · Foundation

- New: deterministic combat simulation, seeded RNG, reference fights with regional enemies and the Fractured Warden, combat viewer with logging and manual queue, road expedition (loot carry, retreat, defeat cost).
- Tech: reference matrix and accepted floor-build deviations.
