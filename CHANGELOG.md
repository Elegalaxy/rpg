# Changelog

Every notable change to the game, newest first. Built from the git history (first commit 2026-10-22).
Design numbers live in `doc/GAME_DESIGN.md` and step status in `doc/IMPLEMENTATION_PLAN.md`; this file is the readable summary.

**Categories:** New (feature or content) · Improved (UX, clarity, quality of life) · Balance (numbers and rules that change difficulty) · Fixed (bug) · Tech (tests, harness, tooling, docs)

**How to update:** when a part or batch is committed, add its lines under `Unreleased`. When a milestone is closed, move them under a new patch heading (`## 0.x.0 · date · name`). Keep one line per change, in plain player-facing words, with the plan step in brackets.

---

## Unreleased

- Improved: the Legacy screen shows what carries over (gold, debt, tokens, materials, supplies) before you reincarnate, and the shop marks earlier-life gear with the lower price it pays. [13.31]
- Improved: the Guide's Reincarnation page explains the carried share, Stockpile and the new purchases, with the numbers listed. [13.31]
- Balance: reincarnating keeps 20% of gold, materials and supplies; all gear is still kept. [13.31]
- New: Legacy purchases Stockpile, Artisan's Favor, Long Memory, Head Start III and Third Heirloom. [13.31]
- Tech: record the lean-inheritance design (a share of gold, materials and supplies carries over; new Legacy purchases) in the design doc. [13.31]
- Improved: Legacy purchases (Attribute Seed, Skill Point Seed, Head Start) now apply to the hero's current life as soon as you buy them, not only after the next reincarnation. [13.30]

## 0.16.0 · 2026-11-18 · Supplies, the Guide, first clears and Auto run modes (Steps 13.20-13.29)

- Improved: the reincarnation screen lists each Legacy bonus on its own row, with the total above them, instead of one long sentence.
- Fixed: a kept heirloom can now be worn right after reincarnating, with all its modifiers. [13.29]
- Improved: on a phone, the Map shows a running expedition first, folds the world map and locked routes away, pins Start expedition above the tabs, and folds each preparation group to a one-line summary.
- Improved: beating the Fractured Warden now also unlocks reincarnation, so you no longer have to lose to a boss. [13.27]
- Improved: route cards, the outcome card, the away report and the Guide show first-clear rewards and whether they are claimed. [13.24]
- New: the Trading Post sells common materials (scrap, hide, shard, witherbark, oathsteel) at five times their sell price. [13.28]
- New: the Guide has a Gear topic (slots, quality, durability, modifiers and their limit, sockets, ranks, temper, heirlooms), an entry for every modifier and base item, and a Greyhaven topic on what each shop does. [13.25]
- New: Auto run can climb Echo ranks on Fracture Gate through the Bastion. A Warden win raises the next rank by one, and a loss to the Warden stops Auto run. [13.26]
- Improved: the Trading Post sells materials 1, 10, 100 or all at a time, and each button shows the gold it pays. [13.25]
- Improved: the contract tracker names the zone after each contract, such as Bounty: Oathbound Echos (Fallen Bastion / Drowned Causeway), so you know where to go. [13.25]
- Improved: A Cleric's run shows the vow they took in the bar that stays on screen.
- Improved: on a phone, the status is one pinned line (hero, level, HP during a run, XP) that opens the full status, the tabs move to a bar along the bottom (Map, Town, Hero, More), and the away report shows as cards.
- Improved: Typing a Fractured Warden Echo rank above the unlocked rank sets it to that rank. [10.1]
- Improved: The Fractured Warden's card shows its Echo rank during the fight. [10.1]
- New: Auto run can hand in finished contracts and take board contracts that fit the route every time the hero gets home; switch it on under the Auto run controls. [13.26]
- New: Auto run can now keep going until you retreat or fall, instead of repeating the route; choose it next to the Auto run switch, and the away report says how an endless run ended. [13.26]
- Fixed: kill bounties now count enemies that join a fight as summons, such as the Oathbound Echo called by the Echo Knight. [13.25]
- Tech: `--matrix free` measures free first-clear upgrades (sockets and rank IIs) against plain gear at hero levels 10 to 17. [13.24]
- Improved: Repair everything worn here sits at the top of the Repair tab, like Queue all on Upgrade.
- New: spend a free upgrade at the crafters to open a socket or rank a modifier up to II at no cost. [13.24]
- New: the first time a hero clears a zone and gets home, it earns gold, the zone's material and a free gear upgrade; the three late zones also give Legacy at the next reincarnation. [13.24]
- Tech: record first-clear rewards in the design doc. [13.24]
- Improved: the map and a live fight show the hero's current contracts and this run's progress, so you do not have to go back to the Contract Board to check.
- Balance: A backpack now lets a run carry up to 3 of each supply, up from 2. [13.22]
- New: the Armorer has a Backpack counter. Craft a Satchel (5 supply slots, hero level 10) and then a Field Pack (6 slots, level 17) from a good material; the pack is kept through reincarnation. With a pack a run carries at most 2 of each supply, and the packing screen says so when a third is refused. [13.22]
- Improved: the Potion Shop Buy and Brew batches match what a run can carry of one supply (4, or 2 with a pack). [13.22]
- Tech: a hero can own a Satchel or Field Pack (more supply slots), crafted as a queued job and kept through reincarnation; there is no screen for it yet. [13.22]
- Tech: a run with a backpack (more than 4 supply slots) carries at most 2 of any one supply; the `--matrix pack` measurement fills the extra slots under that limit. [13.22]
- New: a Guide page explains classes, races, Cleric vows, skills, statuses, supplies, expeditions and reincarnation, with search. [13.23]
- Improved: "Guide" links on hero creation, the vow picker, Combat setup and the skill web open the matching Guide entry. [13.23]
- Fixed: Auto run no longer waits for you when the bag is nearly full and the order is "Hold and wait for me"; it walks home, banks the loot and reruns the route, live and while you are away.
- Tech: the road can run with 5 or 6 supply slots (not used yet), and a new `--matrix pack` measures 4, 5 and 6 slots against the elites. [13.22]
- Tech: the design for a craftable backpack (Satchel 5 slots, Field Pack 6) is written down; nothing changes in play yet. [13.22]
- Balance: the Greater Draught now restores 40% of maximum HP (was 35%), a wider step up from the Healing Draught's 30%. [13.21]
- Balance: the Riftglass Ward now lasts 8 s and wards off the next 2 telegraphed attacks (elites and bosses still deal 35% of each, was 25% of one). The Ward Charm is unchanged. [13.21]
- Tech: a supply ward can carry several charges. [13.21]
- Improved: the fight log has a Stack switches filter that shows only the moments the hero changed rule stack, automatically or by hand. Those lines still show under Rule choices too. [13.19]
- Tech: the Warden and Causeway measurements gain a 'fourth Draught instead of the Ward Charm' row. [13.20]
- Tech: supplies can ward off a telegraphed attack (not used yet). [13.20]
- Balance: the Ward Charm and Riftglass Ward no longer raise a barrier; they ward off the next telegraphed attack within 5 s (no damage, no statuses). Elites and bosses still deal 50% (Charm) or 25% (Riftglass Ward) of it. [13.20]
- Improved: the Ward with supplies template now uses both wards on a telegraph, the stronger one first. [13.20]
- Fixed: the skill info text for damage reduction now says it cuts every hit until your next action. [13.20]

## 0.15.0 · 2026-11-17 · Combat setup helpers (Step 13.19)

- Improved: the preparation screen names Auto run and AFK as separate groups, tags who each setting applies to, and drops the long explanations.
- Improved: Combat setup rules can be reordered by dragging the card. Move up and Move down still work.
- Improved: in a fight, the stack, supplies and Escape now sit beside the hero card, and the "vs" between the sides is gone.
- Fixed: a shop compare that rounds to 0.0 (for example Evasion 43.8 → 43.8) is no longer shown as a green upgrade.
- New: two rule templates for every class, Drink when low and Ward with supplies, that set up your healing and barrier supplies. Pick the HP % and they are ready. [13.19]
- New: a Reset to starting rules button in the combat setup puts the default rules back to what the class starts with (only the skills the hero can use). Nothing changes until you press Save rules, and Undo reset brings your rules back. Rule stacks are kept. [13.19]
- Improved: opening a rule in the combat setup now shows what its skill costs, its cooldown and what it does, so you no longer have to go back to the Skills tab. [13.19]

## 0.14.0 · 2026-11-17 · Later lives (Step 13.18)

- Improved: the Legacy screen shows Legacy, lives, mastery and peak level at a glance, a purchases table with price, how many you own and why a Buy is disabled, and a "Next life" block (start level, Recall level, remembered zones). [13.18]
- New: Head Start, a Legacy purchase: tier I starts every new life at level 5 (20 Legacy), tier II at level 10 (35 Legacy). The attribute and skill points of those levels are yours to spend, and the levels still count toward the Legacy you earn. [13.18]
- New: Recall. A hero who reincarnated earns double run XP until they are back at the highest level they ever reached; drills are not doubled, and the outcome card shows "Recall +N". [13.18]
- New: from your second life on, a hero remembers the elites beaten in earlier lives, so the Drowned Causeway, Rift Hollows and Cinder Scar open again without redoing the elite fights (the Fracture Gate still asks for this life's elites). [13.18]
- Tech: design notes for later lives (Recall XP, Remembered Paths, Head Start) are written down. [13.18]

## 0.13.0 · 2026-11-16 to 2026-11-17 · Keep going, away rules and stronger gold sinks (Steps 13.15-13.17)

- Balance: trainer drills give a fifth of a level's XP from level 10 (still a tenth below it); prices are unchanged. [13.17]
- Balance: modifier ranks are stronger (rank II raises a modifier's numbers by 50%, rank III by 100%) and the material you spend tempers it far more (riftglass +45%, cinderite +75% instead of +9% and +15%). Items you already tempered or ranked get stronger too. [13.17]
- Tech: the modded matrix has two more rows, riftglass-only infuse and a riftglass-only full stack, because riftglass is the best material a level-17 hero holds. [13.17]
- Tech: a new harness matrix (`--matrix modded`) compares a level-17 hero on the Drowned Causeway with plain gear, a second infused modifier, ranks II and III, and top-grade tempers, building the gear with the game's own crafting code. [13.16]
- Improved: the preparation panel says that Auto run also decides what happens when you go away (it waits at Push on with Auto run off), and that "Start a run when I leave" only starts a run when you have none (Step 13.15, part 4).
- Improved: the "While you were away" screen has one clear line per hero: "Auto run kept going while you were away: N fights, N runs" with why it stopped (for example a piece at 0 durability), "Paused at Push on", or "Away route started" (Step 13.15, part 3).
- Improved: going away no longer turns a manual run into an auto run. With Auto run off your run waits at Push on until you are back; with Auto run on it keeps going under your standing orders, reruns the route and stops on a defeat, a broken piece, missing supplies or your fight limit; the away route only starts a run when you have none (Step 13.15, part 2).
- Improved: the preparation panel is grouped by who uses each setting: Every run, Pack for the road, Standing orders (push on, fight limit, full bag), Auto run, and While you are away (start route, repeat).
- New: a "Keep going" choice for a nearly full bag: the run pushes on instead of walking home or waiting, gold and XP still count, and loot that does not fit is lost; it works live, with Auto run and while you are away.
- Improved: fights played while you were away are labelled "AFK run" on the fight chips.
- Fixed: the escape banner no longer shows HP as a long float such as 30.400000000000034.
- Improved: the run bar keeps Push on, Return, Auto run and Auto-escape in one place while walking, so a fast Auto run does not jump the buttons.

## 0.12.0 · 2026-11-16 · Gear wear, Auto run and the rule chain editor (Steps 13.12-13.14)

- Improved: socket and rank lists on a gear shop stay open. The job tab is the section, so there is nothing to expand.
- Improved: while a run is out the sidebar shows the gold you own in total, with a second line for what is carried and what is banked, instead of 0 (Step 13.14, part 3).
- New: Auto run. Switch it on in the preparation, the run bar or the run dock and the hero pushes on or walks home after each fight by your standing orders, and reruns the same route after each safe return, on any route you can start, until a defeat, a refused start, you switch it off, or an optional total fight limit is reached (Step 13.14, part 2).
- Balance: every worn piece now loses 1 durability for each 3 fights won in a run (an elite or boss win counts as 2), taken when you return; defeat still costs 10 on top, and repair prices are unchanged (Step 13.12, part 2).
- New: the Priority rules screen shows your rules as a chain: each rule is a card with its skill, its plain sentence, how often it fired this fight, and an "else" arrow down to the Fallback. Tap a card to edit it in place, and a removed rule can be undone (Step 13.13, part 3).
- Improved: with extra stacks, the stack tabs become a router list in priority order: each stack shows its trigger sentence and an Auto or Manual only tag, ending in "Otherwise: Default" (Step 13.13, part 4).
- New: each rule and stack in the Priority rules screen shows "Used N×", how often it fired in the fight now on screen ("Used —" when there is no fight to read) (Step 13.13, part 5).
- New: starter templates on the Priority rules screen (Templates, or Start from template on an empty chain): ten scaffolds across the five classes, each with a stated trade-off and a blank you must fill in before it will save; some unlock after you defeat a telegraphing enemy, a swarm or a phased boss (Step 13.13, part 7).

## 0.11.0 · 2026-11-11 to 2026-11-16 · Playtest fixes, rule stacks and gold sinks (Steps 13.7-13.11)

Source: playtest feedback of 2026-11-11 and the sessions after it: bug fixes, the interface rework, rule stacks, the run bar and fight limit, and new ways to spend gold and materials (Trainer drills, a second modifier socket, modifier ranks and material temper).

- Improved: a weaponsmith, armorer, or jeweler opens one job at a time — Buy, Sell, Repair, Craft, Upgrade, Sockets, Ranks, or Queue — with a count when something is waiting.
- Improved: on a wide screen the town and hero section tabs stay pinned while the page scrolls, so a shop can be switched without returning to the top.
- Improved: a gold price written on an amber button uses the button text colour, so the Trainer drill price stays readable.
- New: modifier ranks: raise a modifier on a worn or stored item from rank I to II (+20%) or III (+40%) in the crafting queue for gold by the modifier's level and materials; rank III takes riftglass, duskiron or cinderite (Step 13.10, part 4).
- New: open a socket on a worn or stored item at hero level 10 (item level x 40 gold and 8 riftglass, duskiron or cinderite), then Infuse a second, different modifier (item level x 10 gold and 6 materials); both take 30 seconds in the crafting queue and both modifiers count (Step 13.10, part 3).
- Improved: a Trainer drill now takes 45 seconds and you can queue up to three; each drill's XP lands when it finishes, the queue waits while the hero is away, and reincarnation waits for it (Step 13.11, part 2).
- Tech: items can carry a temper per modifier (0 to 5) that adds 3% of the modifier's strength per point, up to x1.55 at rank III; nothing applies one yet, and untempered items are unchanged (Step 13.11, part 3).
- Balance: the material you spend now tempers a modifier: crafting, Infuse and Rank up bind its grade (scrap 0 to cinderite 5), each point adding 3% to that modifier's numbers (up to x1.55 at rank III), and Open socket also raises the item's quality like an upgrade (Step 13.11, part 4).
- Improved: the Craft, Open socket, Infuse and Rank up pickers show what the chosen material does before you spend it (Temper +15%, Quality +5 up to 120%), and the gear compare notes name a modifier's temper (Step 13.11, part 5).
- New: a Trainer in Greyhaven sells up to three drills per level, each worth a tenth of the level's XP for level x 40 gold, then x 80, then x 120 (Step 13.10, part 2).
- Balance: the rest after a defeat is 30 seconds instead of 5 minutes, since the rescue fee, lost loot and durability loss already cost enough (Step 13.9, defeat rest).
- Improved: the run dock shows the fight number (with your fight limit when set), the fight's name and its enemies, or the last fight's name and result between fights (Step 13.9, dock).
- New: a "Stop after fights" standing order: after that many fights in one run the hero walks home and secures the loot instead of pushing on, live or while away; the run bar shows "Fight 3 / 10" (Step 13.9, part 2).
- Improved: on the Map during a run, Push on, Return to town and Auto-escape stay pinned above the fight while you scroll, the fight sits right under them, and the extra numbers are folded under Run details (Step 13.9, part 1).
- Improved: the What's new page no longer shows plan step tags such as "(Step 13.8, part 4)" (Step 13.7, polish).
- New: the fight view shows which rule stack is active and why, and you can pin a stack or go back to Auto while watching; the run dock shows the active stack too (Step 13.8, part 4).
- New: you can build extra rule stacks that switch by trigger, for example one for groups and one for single targets, with a tab for each and a Switch-when condition list (Step 13.8, part 3).
- Tech: rule stacks are saved with each hero, carried into runs and away replays, pruned when you unequip a skill, and cleared on reincarnation; the Going in panel shows the stack count (Step 13.8, part 2).
- Tech: rule stacks in the combat sim — a hero can switch between named sets of automation rows by trigger (Step 13.8, part 1).
- Fixed: gear no longer returns to 100% durability at the start of every run, so wear carries over and repair matters again (Step 13.7, batch 1).
- Improved: a run cannot start while a worn piece is disabled or the rest after a defeat is pending, and the reason is shown (Step 13.7, batch 1).
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
- Improved: the Craft modifier picker lists every modifier with its effect and unlock level, so you can compare them without opening a dropdown (Step 13.7, batch 6).
- New: an in-game "What's new" page lists the patch notes with category filters (Step 13.7).
- Improved: the Contract Board is now the first town tab and opens by default (Step 13.7, batch 6).
- Balance: walking between fights plays at 8x your chosen speed, and 16x on a mastered route; it is playback only, so nothing in the run changes (Step 13.7, batch 6).
- Improved: a "?" next to Mastery and the locked 8x button explains what mastery counts and what it unlocks (Step 13.7, batch 6).
- Improved: a "?" next to item quality and in the Upgrade section explains what quality does and that upgrades never lower it (Step 13.7, batch 6).
- Improved: the "while you were away" table shows which route each hero ran (Step 13.7, batch 6).
- Improved: the fight view shows the last escape attempt (Escaped at X s, or Escape failed, with HP and the roll), and escaped fights are marked "Escaped" on the run chips (Step 13.7, batch 6).
- New: a run dock on every page except the Map shows what the hero is doing (walking, fighting which encounter, waiting), HP, and Push on and Return buttons, so you no longer have to open the Map to continue (Step 13.7, batch 6).
- Improved: the dock unfolds to the route, loot bag, momentum, gold, enemies left, Escape now, the auto-escape switch and a Map shortcut; it remembers whether you left it folded (Step 13.7, batch 6).
- New: on a mastered route you can switch "Run this route again" while the run is out, from the dock; on other routes it is shown locked with your safe returns (Step 13.7, batch 6).
- Improved: the Enchanter groups recipes by what they go on (weapons, off-hands, armor, accessories), sorted by level, price and name; each group folds and shows how many you can learn now (Step 13.7, batch 6).
- New: a badge on the Enchanter tab and on Town counts recipes you can now learn and have not seen yet; a "New" tag marks them until you leave (Step 13.7, batch 6).
- New: Brew 1, Brew 4 and Brew max buttons in the Potion Shop, with the reason shown when one is out of reach (Step 13.7, batch 6).
- Improved: the Trading Post lists every material, even ones you own none of, with a "Where to find" line naming the routes, enemies and resource nodes (Step 13.7, batch 6).
- Improved: the Loadout and each priority rule fold into sections with counts, so long setups are easier to scan (Step 13.7, batch 6).
- Balance: the craft queue has no limit any more; an item can have several +1 upgrades queued in a row, each taking the usual time and cost and checked against the level it will have when its turn comes (Step 13.7, batch 6).
- New: "Queue all" queues +1 upgrades for every worn item, lowest level first, as far as your gold and the chosen material allow, and shows the total cost first (Step 13.7, batch 6).
- Improved: each upgrade row has its own material, shows Level and Quality before and after, the cost, the time and how many upgrades are already queued; long queues show five jobs with "Show all" (Step 13.7, batch 6).
- Improved: the map is laid out as a hub with spokes, so no walk passes next to a place it does not visit (Step 13.7, batch 6).
- Fixed: the escape banner shows the roll and the chance as whole percents instead of a long decimal (Step 13.7, batch 6).
- Fixed: the run dock no longer hides the end of the page; the page keeps clear of it however tall it is (Step 13.7, batch 6).
- Fixed: the Roster page no longer scrolls sideways on a narrow screen (Step 13.7, batch 6).
- Fixed: gear compare changes now match the shown numbers and always show one decimal (Step 13.7, batch 6).

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
