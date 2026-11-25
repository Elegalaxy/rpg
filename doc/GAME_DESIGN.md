

Part 3 (harness, done 2026-11-09): `UNLOCKED_ROWS` in `src/harness/builds.ts` now maps a skill id to `{ row, place: 'first' | 'last' }`; the Assassin Smoke Step entry is `{ row: { skillId: 'smoke-step' }, place: 'last' }`, and `builtSetup` builds `priorityRows` as first rows, reference rows, last rows (`wardenSetup` still puts supply rows first through `startingRules`). Only the Assassin has an unlocked row, so the other four classes are unchanged (confirmed: built, causeway, hollows and warden matrices differ only on Assassin lines). Results with parts 2 and 3 together (rules mode, wins % with HP lost % / elite left %; seed means over seeds 1-3 x 100 runs, seeds in brackets):

| Assassin cell | Before | After |
| --- | --- | --- |
| Warden prepared (band 30-70) | 18 (98 / 16; 18, 16, 20) | 42 (94 / 6; 42, 40, 45) |
| Colossus prepared (band 40-85) | 33 (94 / 10; 31, 31, 37) | 53 (88 / 6; 52, 55, 51) |
| Reaver prepared (band 40-85) | 100 (43 / 0; 100, 100, 99) | 100 (41 / 0; 100, 100, 99) |
| Warden / Colossus / Reaver over-levelled | 100 / 100 / 100 | 100 / 100 / 100 |
| Warden causeway-geared | 100 | 100 |
| Colossus arrived | 0 | 0 |
| Prepared-crafted Warden / Colossus / Reaver | 98 / 97 / 99 (seed 1) | 100 / 98 / 100 (seed 1; seeds 2-3: 99, 100 / 98, 98 / 99, 99) |

Bands met: Warden prepared (42, seeds 40-45, within 5) and Colossus prepared (53, seeds 51-55, within 4). NOT met: Reaver prepared 100 (band 40-85; unchanged, needs class power or a new mechanic, left for the time-pressure step). Crafted supplies still lift the Assassin by 58 (Warden) and 45 (Colossus) points, beyond the 30-point ceiling (part 7, untouched). `--matrix warden` (seed 1, 100 runs) Assassin: arrived 0 (Warden left 68 / 63), prepared 18 / 42, over 100 / 100 (median 53 s / 50 s), causeway 100 / 100, prepared-crafted 98 / 100, causeway-crafted 100 / 100, prepared-tonic 1 / 1.

Guards (seed 1, 100 runs, Assassin; before / after). Built matrix wins % (enemy HP left %): 0 nodes Deserter 100 / 100, Rootmaw 59 / 59, Echo Knight 5 / 5, Warden 0 / 0; 6 nodes Rootmaw 98 (0) / 95 (0), Echo Knight 19 (16) / 25 (11), Warden 0 / 0; 9 nodes Rootmaw 100 / 100, Echo Knight 42 (9) / 65 (4), Warden 0 / 0. The built table reports wins and enemy HP left, not HP lost; no Rootmaw or Echo Knight cell moved against the Assassin by more than 3 points of wins. Causeway regular fights are 100% in every tier; Hollows regular fights 100%. Mixed-fight HP lost (arrived / prepared / over): causeway-mixed 41 / 29 / 24 to 40 / 28 / 15, hollows-mixed 24 / 19 / 14 to 21 / 21 / 14. Causeway-mixed over-levelled at 15 sits at the bottom edge of the 15-40 band; hollows-mixed over 14 was already just below it. Reference-matrix and golden duel-basic snapshots are unchanged apart from the part 2 rows.



Part 2 (content, done 2026-11-09): the Assassin `mark-for-death` reference row now has `targetPriority: 'lowestArmor'` (`referenceLoadouts.assassin` in `src/content/scenarios.ts`; `src/content/scenarios.test.ts` updated). Reference matrix (seed 1, 100 runs) before / after: only three Assassin multi-enemy rows moved, every other row (all classes, single-target rows, road-mixed, warden) is byte-identical. Assassin bastion-mixed median ms 22080 / 22440, attrition 38.9 / 39.1, wins 100 / 100; grove-mixed 19957 / 20396, attrition 40.5 / 39.3, wins 100 / 100; echo-knight median 60968 / 58110, attrition 92.2 / 96.1, wins 5 / 5 (the Mark does not change the Echo Knight win rate; with lowest-Armor Mark targeting it can land on the summoned Oathbound Echo, which is the same enemy the damage rows hit). The golden duel-basic snapshot is unchanged. 941 tests pass.

#### Assassin rules fix (Step 13.5, 2026-11-09, user accepted all recommendations)

Diagnosis: Assassin Warden prepared 18% (band 30-70) and Colossus prepared 33% (band 40-85) are partly a rules problem. (1) The `mark-for-death` row in `referenceLoadouts.assassin` has no `targetPriority`, so it falls back to the first living enemy (the Warden itself) while the damage rows hit the lowest-Armor Echo. Shadow Cut's Mark bonus, the Mark refresh and the Advantage from poisoning a Marked target then stop working, because the Mark and the damage are on different enemies. (2) The harness Smoke Step row (built matrix, `UNLOCKED_ROWS` in `src/harness/builds.ts`) fired on `telegraph present`, but active skills never roll to hit, so Smoke Step's evasion cannot dodge a heavy hit and the row does nothing useful against telegraphs. As a last-placed filler it fires whenever no other row is eligible and keeps its Advantage and evasion statuses up.

Changes: (a) content: the Assassin `mark-for-death` reference row gets `targetPriority: 'lowestArmor'`, matching the Assassin's other rows (`referenceLoadoutFor`; new heroes only, existing saves keep their untargeted Mark row, no migration). (b) harness only: `UNLOCKED_ROWS` entries gain a placement, `first` or `last`; the Assassin Smoke Step entry becomes a no-condition row placed last (after the reference rows). The game UI ships no Smoke Step row. Crafted supplies are not touched (part 7).

Planner scratch estimates (seed 1, 60 runs, Warden / Colossus prepared wins %): Mark targeting alone 33 / 33; plus Smoke Step as a last filler row 42 / 53. Expected acceptance (seeds 1-3 x 100 runs): Warden about 42, Colossus about 53, seeds within 8 points. Protocol: reference CSV before and after (seed 1, 100 runs; only Assassin multi-enemy rows may move), `--matrix elites --classes assassin` seeds 1-3, `--matrix built|causeway|hollows|warden` seed 1. Guards: built 6-node Rootmaw and Echo Knight HP lost within 15 points of before, regular fights at least 95%, mixed fights stay 15-40% where they were, the other four classes unchanged.

# RPG Living Game Design

Status: Active design; provisional combat baseline accepted for simulation  
Working title: RPG (final title intentionally deferred)  
Portfolio brief: [docs/ideas/incremental-rpg.md](../../docs/ideas/incremental-rpg.md). Keep that brief aligned when this document's concept or status changes. The full idea index is [docs/ideas/README.md](../../docs/ideas/README.md).

## 1. High Concept

A dark-fantasy, single-player incremental RPG built around two connected ideas:

1. Configure an automated combat build and understand exactly why it succeeds or fails.
2. Turn devastating boss defeats into reincarnation, permanent personal mastery, and stronger future lives.

The player directly embodies one hero at a time. Heroes explore a fractured world, travel between regional towns, fight through dangerous routes, gather and craft equipment, and eventually confront bosses beyond their current limits.

The target experience sits between the interconnected progression of *Melvor Idle* and the preparation-driven automated combat of *Loop Hero*.

## 2. Design Pillars

### Build readable automation

The player chooses attributes, equipment, four active skills, a skill-web route, and ordered combat priorities with simple conditions. A detailed log exposes rolls, modifiers, automation-rule triggers, and defeat causes.

### Defeat has weight

Retreat is fallible and defeat is expensive. Unsecured loot, damaged equipment, consumed supplies, recovery time, and rescue costs make expedition planning meaningful. The game must not encourage death as fast travel.

### Mastery makes uncertainty manageable

Combat begins with high variance. Individual hero mastery raises power and narrows the possible outcome range, but never removes uncertainty completely.

### Every hero develops personally

Mastery and reincarnation currency belong to the individual hero. Account-level benefits are shared knowledge (recipes and map discoveries) and character slots rather than unearned combat power. Wealth stays with the hero who earned it.

### Preparation over direct control

Combat runs automatically in real time. Most player agency comes from planning routes, builds, supplies, crafting, event policies, and retreat conditions.

## 3. World and Tone

- Genre: classic fantasy with a dark tone.
- Main threat: fractures are spreading through the world, corrupting regions and strengthening their guardians.
- First region: the Fractured Frontier, a once-safe borderland being warped by the fracture.
- Base campaign target: five regions.
- Each region has a town, several connected zones, regional content, and a major boss.
- Story delivery is light: lore discoveries, environmental details, contracts, and authored lore quests rather than a large linear campaign.
- The player is the currently selected hero, not a deity, guildmaster, or separate management character.

### Reincarnation fiction

A sufficiently brutal defeat by a superior boss, combined with the hero's extraordinary willpower, tears the soul free and causes reincarnation. Across repeated lives, the hero gradually learns to control and benefit from what began as a traumatic event.

## 4. Heroes and Roster

### Roster rules

- Character slots unlock through account milestones and achievements.
- First-playable slots, decided 2026-10-31: the account starts with 2 slots and can reach 5. The extra slots unlock once each, for the whole account, the first time any hero reaches the milestone. Slot 3: the first safe return to town from an expedition. Slot 4: the first boss defeat that sends a hero to reincarnation. Slot 5: the first defeat of the Fractured Warden. A slot never relocks, and a slot is not tied to the hero that earned it.
- Duplicate race/class heroes are allowed, decided 2026-10-31. Each hero has its own id, so two Human Warriors keep separate progress, gear, and mastery. Hero names are trimmed, 1 to 24 characters, and must be unique in the roster when compared without case.
- The first playable has no way to delete or retire a hero, so a slot stays in use. Retiring heroes is left for later.
- The selected hero plays the live screen. Other heroes with an away route also progress while the page is open or closed (GAME_DESIGN §11, "Offline extras"); heroes without an away route rest.
- World-map discoveries are shared, but each hero must clear personal combat gates.
- Recipes and world discoveries are shared. Decided 2026-11-03: gold, materials, unequipped items (the archive), contracts, the crafting queue, and defeat debt belong to each hero. Shared wealth let a grown hero fund a new one and skip the early game. A shared vault for sending gold or items between heroes was considered and rejected for the same reason. Saves from before this change give everything to the selected hero (or the first hero), each queued craft job goes to the hero who queued it, and the other heroes start empty. Every hero's crafting queue advances (since 2026-11-04).
- Equipped gear is bound to its hero.
- A hero must personally unlock the crafting tier required to use a material.
- Race, class, mastery, permanent power, and reincarnation currency are personal to the hero.
- Post-final-boss world tiers advance separately for each hero.

This replaces the old open question about duplicate heroes. See the first-playable slot rules above.

### Initial race roster

All classes must be playable with all races. Some combinations may intentionally be harder, but should offer sufficient mastery rewards, exclusive hybrid nodes, and a higher potential ceiling.

#### Human

- Primary identity: adaptable routing through skill webs.
- Secondary identity: faster learning and mastery.
- Intended role: flexible without becoming the universally optimal race.
- At the start of each life, choose where the Human racial branch attaches to the class web, creating custom shortcuts between clusters.
- Humans have +5% ordinary XP and mastery gain, but not one-time milestone rewards.
- The branch begins with two player-chosen attachment points to the class web.
- Starting attributes: Strength 10, Vitality 10, Agility 10, Intellect 10, Spirit 10.

#### Elf

- Primary identity: Focus gained through successful actions, improving precision and narrowing combat variance.
- Secondary identity: strong combat-resource control and magical affinity.
- Successful actions build Focus.
- Focus uses a 0-100 meter.
- Each successful action generates 10 Focus.
- Direct health damage removes 2 Focus per 1% of maximum HP lost.
- Focus persists between encounters but resets in town, on retreat, defeat, or reincarnation.
- Each Focus raises the minimum direct-damage/healing roll by 0.1 percentage points, up to +10 points, and improves class-resource generation by 0.1%, up to +10%.
- Starting attributes: Strength 8, Vitality 9, Agility 12, Intellect 12, Spirit 9.

#### Beastfolk

- Primary identity: three Ferocity tiers gained from expedition progress.
- Ferocity uses 0-6 progress; every 2 progress grants one tier.
- A regular victory grants 1 progress, an elite victory grants 2, and ending an encounter below 40% HP grants 1 additional progress.
- Each tier grants +5% Physical/Magical/Healing Power and 3% damage reduction.
- Ferocity is an expedition-scale mechanic, not a second in-combat Fury meter.
- Supporting traits: strong constitution and increasing strength during long expeditions.
- Returning to town, retreating, defeat, or reincarnation removes Ferocity.
- Starting attributes: Strength 13, Vitality 13, Agility 9, Intellect 7, Spirit 8.

#### Undead

- Primary identity: Stillness gained by taking three actions without suffering direct health damage. Direct HP damage resets its progress.
- At maximum Stillness, the next offensive action consumes it for +20 Accuracy, +10% final damage, and +10 percentage points to its minimum damage roll.
- A racial node unlocks Soul Fragments from kills.
- Soul Fragments have a small visible expedition cap increased by racial nodes and curses.
- Another racial node unlocks one curse chosen for the expedition. Curses trade a penalty for power and can spend Soul Fragments.
- Starting attributes: Strength 8, Vitality 9, Agility 13, Intellect 11, Spirit 9.

Racial traits should unlock in layers through the individual hero's mastery rather than all applying at full strength immediately.

First-playable racial layers, decided 2026-10-24:

- The core is on at creation. Human ordinary XP is +5%. Elf Focus, Beastfolk Ferocity, and Undead Stillness use the core numbers above.
- Branch nodes wait for skill points. Attachment points, Quick Study, Soul Fragments, and curses are not active.
- Mastery layers wait. A new hero does not start with the stronger mastery version of a racial trait.
- The Human bonus does not apply to one-time milestone rewards. Ordinary mastery will use the same 5% when a mastery counter exists. No mastery counter exists yet.

### Racial branch rules

- Each MVP racial branch contains four passive or automatically triggered nodes.
- The race's core mechanic is available immediately at character creation.
- Racial nodes modify or extend the core mechanic.
- Racial nodes use the same limited skill points as class nodes.
- Node four is a strong racial capstone, but it does not count as a second major keystone.
- Every race has the same total starting attribute points, moderately redistributed to express its tendencies.
- Level-up allocation can overcome the starting distribution.

### Provisional racial branches

#### Human branch

1. Quick Study: increase the Human ordinary XP/mastery bonus from +5% to +8%.
2. Cross-Training: remove the 10% primary-stat effectiveness penalty from equipment outside class preferences.
3. Flexible Route: add a third player-chosen attachment point between the Human branch and class web.
4. Renaissance, capstone: while at least two nodes are allocated in each class cluster, gain +8% Physical/Magical/Healing Power, +8% maximum HP, and +10 Consistency.

#### Elf branch

1. Focused Mind: increase Focus gained per successful action from 10 to 15 and reduce Focus lost from HP damage by 25%.
2. Efficient Flow: increase Focus's maximum class-resource-generation bonus from +10% to +20%.
3. Foresight: at 75 or more Focus, gain +10 Evasion and reveal enemy telegraphs 0.5 seconds earlier.
4. Perfect Clarity, capstone: at 100 Focus, direct damage and healing roll from 95%-100% and total cooldown reduction gains +10 percentage points. Direct HP damage removes all Focus while Perfect Clarity is active.

#### Beastfolk branch

1. Thick Hide: gain +10% maximum HP and +25% out-of-combat natural regeneration.
2. Blood Scent: ending an encounter below 40% HP grants 2 bonus Ferocity progress instead of 1 and immediately restores 5% maximum HP after victory.
3. Long Hunt: each Ferocity tier grants another +5% class-resource generation and +5% out-of-combat regeneration.
4. Apex Instinct, capstone: at Ferocity tier 3, gain +15 percentage points of critical damage and +15% healing/barrier output.

#### Undead branch

1. Patient Killer: improve consumed Stillness to +30 Accuracy, +20% final damage, and +15 percentage points to the minimum damage roll.
2. Soul Harvest: gain one Soul Fragment per kill, with a base cap of 5; fragments persist for the expedition and reset in town, on retreat, defeat, or reincarnation.
3. Cursebound: equip one curse before an expedition:
   - Hollow Hunger: −25% healing received and +15% all Power. When below 30% HP, one Soul may be spent automatically to heal 10% maximum HP, once per encounter.
   - Grave Patience: −15% action speed, but Stillness requires only two undamaged actions. One Soul may be spent when Stillness triggers to preserve one progress after consumption.
   - Soul Debt: rescue fees and resulting debt increase by 50%; each held Soul grants +3% all Power, up to +15%.
4. Deathly Precision, capstone: when consuming Stillness, spend one Soul if available to force a 100% damage roll and gain +25 percentage points of critical chance for that action.

Exact racial-node effects, meter rates, Ferocity requirements/benefits, Soul Fragment cap, and curses remain open.

### Initial class roster

- Warrior
- Assassin
- Ranger
- Mage
- Cleric

Each class has:

- A unique combat resource and rhythm.
- A free-form skill web organized into connected thematic clusters.
- Build-defining keystones.
- Four equipped active skills (five with the Fifth Skill Slot, §10) plus passive effects.
- Preferred weapons and armor, with unconventional equipment enabled through skill-web investment.

#### Warrior: Fury

- Fury is displayed on a 0-100 meter.
- The first encounter begins at 0 Fury.
- A successful basic attack or ordinary Warrior skill generates 5 base Fury.
- Actual HP loss generates 1 base Fury per 1% of maximum HP lost.
- Fury gained from one damaging hit is capped at 20 after applicable gain modifiers.
- Spirit's resource-generation multiplier applies to both action-based and HP-loss Fury.
- Held Fury increases physical damage linearly, reaching +25% at 100 Fury.
- Spend Fury on powerful attacks or survival skills.
- Only actions tagged as Fury generators gain Fury; Fury-spending skills do not refund the generic gain.
- A Fury spender snapshots the held-Fury damage bonus, then pays its cost before resolving.
- Outside combat, Fury waits 3 seconds and then drains at 10 per second. Closely spaced encounters may preserve some Fury.
- Warrior may use hard control such as Stun where appropriate.
- The initial web supports weapon-and-shield and two-handed weapon styles.
- A Warrior may switch styles during the same life, but nodes only function while their required equipment is used.
- Bleed is introduced through Fury/Arms modifiers rather than being required by the base kit.
- A new Warrior begins with Driving Blow in addition to the normal basic attack.
- Warrior Stun is exclusive to the shield-side Shield Impact modifier in the initial web.

#### Assassin: Advantage

- Advantage uses 0-5 discrete stacks.
- Each encounter begins with 0 Advantage.
- A critical hit, successful Evasion, or action that exploits Mark grants one stack, capped to one gain per action.
- Spirit's resource-generation multiplier applies to all three trigger types through a visible fractional-stack accumulator.
- Execute consumes all Advantage. Its damage scales with stacks and the target's missing health.
- All Advantage and fractional Advantage progress are lost when an encounter ends.
- The initial web focuses on daggers and light melee weapons, stealth, Poison, Mark, and execution.
- Envenomed strikes (Step 13.39, live): every direct-damage action (a basic attack or a damaging skill) tries one Poison application on each enemy it damaged, using the normal contact rule (the attack hit and dealt HP damage greater than 0), at most once per target per action, ticking for 10% of snapshotted Physical Power (Step 13.50; it was 8% without the Venom Edge node before). Poison ticks and Toxic Sovereign's spread never trigger it. It replaces the Venom Edge skill; see "Venom passive (Step 13.39)" in section 10.
- Only one enemy can have Mark for Death. Reapplying it moves the Mark.
- Mark for Death lasts 8 seconds and has a 6-second base cooldown.
- Assassin attacks refresh Mark to at least 8 seconds remaining. Extensions from nodes or effects cannot raise it above 12 seconds remaining.
- Poison has a clear base stack cap increased by Venom nodes and equipment. New applications refresh the shared duration.
- A new Assassin begins with Shadow Cut in addition to the normal basic attack.

#### Ranger: Readiness and quivers

- Readiness uses a 0-100 meter.
- The Ranger leaves town at 0 Readiness.
- Travel generates 5 base Readiness per second, filling the meter in 20 seconds before Spirit. Ordinary journeys are therefore calibrated to begin the first encounter at full Readiness; unusually short transitions may begin below full.
- Successful basic attacks generate 20 base Readiness (10 until 2026-11-03: a Ranger spent most of a long fight on basic attacks waiting for arrows).
- Spirit's resource-generation multiplier applies to travel and successful-basic gains.
- Spend Readiness on aimed shots and traps.
- Remaining Readiness persists after an encounter, and travel continues filling it toward 100.
- Readiness does not decay while waiting in combat.
- Basic arrows are unlimited.
- Equip one quiver with a small number of special-ammunition slots. Used special arrows must be bought or crafted; unused arrows follow the normal unused-supply rules.
- The initial web focuses on bows, aimed shots, traps, special arrows, and pathfinding.
- A new Ranger begins with Aimed Shot in addition to the normal basic attack.

#### Mage: Mana

- Mana has a base maximum of 100; equipment and web nodes can modify it.
- The Mage leaves town at full Mana.
- Current Mana persists between encounters.
- Mana regenerates at 2 base Mana per second in combat and 5 per second during travel/outside combat.
- Arcane Recovery restores 30 base Mana, consumes a full action, and has a 10-second base cooldown.
- Spirit's resource-generation multiplier applies to passive regeneration and Arcane Recovery.
- Elemental charges and limited prepared-spell charges are alternative keystone paths rather than simultaneous mandatory systems.
- Fire, Frost, Lightning, and Arcane remain magical damage. Their tags change skill behavior and status interactions rather than adding separate resistance categories.
- Mage is an exception to the normal weapon-basic rule: it has no ordinary basic attack.
- A new Mage begins with Arcane Bolt and Arcane Recovery.
- Arcane Bolt has a very low Mana cost and acts as the fallback when no higher-priority spell is eligible.
- Arcane Recovery may be used whenever its player-configured Mana condition is met.

#### Cleric: Faith

- Faith uses a 0-100 meter.
- The Cleric leaves town at 0 Faith.
- Faith persists between encounters for the expedition and does not naturally decay.
- The three base vows are available at character creation; the skill web improves them. The Cleric equips one vow before leaving town and cannot change it during that expedition.
- Vow of Zeal generates 9 base Faith (Step 13.5, was 7) when a hero action deals direct HP damage, at most once per hero action. It was 5 until 2026-11-03: Zeal was the weakest vow against the Rootmaw (built Cleric, 30 runs, 0/3/6/9 nodes: Zeal 0/0/50/50%, Endurance 0/7/100/100%, Temperance 0/10/93/93%). At 7 Zeal is 0/17/93/93%, and the 0-node Cleric beats the Echo Knight 87% (was 0%).
- Vow of Endurance generates 1 base Faith per 1% of maximum HP lost or barrier damage absorbed, capped at 10 per enemy action.
- Vow of Temperance generates 5 base Faith after an action ends at 40%-80% HP without overhealing or resource overcap.
- Failing an ordinary vow condition only stops generation. Exalted Vow adds an actual break penalty.
- Spend Faith on healing, wards, and judgment.
- A build-defining keystone replaces standard Faith with opposing Grace and Wrath resources.
- Under Sacred Balance, offensive actions generate Wrath spent by defensive skills, while defensive actions generate Grace spent by offensive skills.
- Between-encounter behavior depends on the selected vow.
- Cleric power comes from vows and force of will rather than energy that is inherently anti-undead, allowing Undead Clerics to remain coherent.
- A new Cleric begins with Smite and Mend in addition to the normal basic attack.
- Penance consumes 10% of maximum HP to generate 25 base Faith, has a 10-second base cooldown, and cannot be used when its health cost would be fatal.
- Spirit's resource-generation multiplier applies to vow generation and Penance.
- Under Sacred Balance, Penance becomes a health-cost action that generates both Grace and Wrath. Its cooldown and output must make the loop net-negative after healing.
- Undead Clerics use Soul Restoration presentation for direct healing with the same base numbers. A later Undead/Cleric hybrid node may convert part of it into life-drain with a real trade-off.

Exact generation rates, costs, decay, and keystone rules remain open.

### Attributes

Heroes gain points at level-up and manually allocate them to:

- Strength: physical damage, Armor penetration, and critical-damage scaling.
- Vitality: maximum health, health regeneration, healing received, and resistance to physical statuses.
- Agility: attack speed, Accuracy, Evasion, critical chance, and escape chance.
- Intellect: magical damage, magical penetration, status potency, and cooldown reduction.
- Spirit: class-resource generation, healing power, magical-status resistance, and a small capped XP/mastery bonus.

Primary effects scale mostly linearly. Secondary effects use lower coefficients, diminishing returns, or caps. In particular:

- Agility's critical and escape bonuses must remain modest so Agility is not mandatory for every build.
- Intellect-based cooldown reduction has diminishing returns and a modest hard cap.
- Spirit affects ordinary XP/mastery gain but not one-time milestone rewards.

Initial coefficients are defined in the combat-mathematics section. They remain test hypotheses until simulation.

### Skill-web rules

- Connected thematic clusters with powerful keystones.
- Free routing rather than fixed specialization branches.
- No respec during a life.
- Reincarnation resets the allocated build.
- The interface must preview requirements and consequences clearly because choices are permanent for the current life.
- MVP target: approximately 12-15 meaningful nodes and 2-3 keystones per class.
- A well-progressed life normally reaches approximately 7-9 of 15 class nodes, preserving distinct build directions.
- A hero may activate one build-defining major keystone per life plus compatible minor keystones.
- Each MVP class offers six learnable active skills for a skill loadout of four (five with the Fifth Skill Slot, §10).
- Most skill nodes add specific behavior changes; only a few use repeated numerical ranks.
- A compact, color-coded racial branch attaches to several points on the class web and uses the same skill points.
- Difficult race/class combinations can unlock a small hybrid branch through combination-specific mastery milestones.

First-playable skill web, decided 2026-10-24:

- Each class web is the three named clusters, five nodes each, in the order written below.
- Node 1 of any cluster costs 1 skill point and has no prerequisite. Each later node costs 1 and requires the previous node in that same cluster.
- Node 5 is that cluster's major keystone. A hero can hold one. Taking one blocks the other two.
- There is no respec during a life.
- Reference fights keep their current loadouts and do not spend points. A new hero already knows that class's four starting skills.
- Two racial attachment slots are stored empty. No racial node can be bought yet. Flexible Route's third slot does not exist yet.
- Legacy skill points are an extra pool. A purchase spends ordinary skill points first.

Initial class clusters:

- Warrior: Fury, Arms, and Bulwark
- Assassin: Shadow, Venom, and Execution
- Ranger: Marksmanship, Traps, and Pathfinder
- Mage: Elemental, Arcane, and Prepared
- Cleric: Devotion, Sanctuary, and Judgment

### Provisional Warrior web

The MVP Warrior web has fifteen nodes: five per cluster. Connections follow the first-playable rule above.

#### Fury cluster

1. Driving Blow: add 5 additional base Fury, raising its total generation to 20 before Spirit, and reduce its base cooldown from 3 to 2.5 seconds.
2. Rising Heat: increase all Fury generation by 20%, multiplicative with Spirit.
3. Cleave: unlock the Fury-spending multi-target active skill.
4. Bloodletting: Driving Blow and Cleave gain a 75% base Bleed chance. Each stack ticks for 10% snapshotted Physical Power. Hitting a Bleeding target generates 3 additional base Fury.
5. Berserker, major keystone: held-Fury physical damage reaches +50% at 100 Fury, but all incoming damage is multiplied by 1.25.

#### Arms cluster

1. Sundering Blow: unlock the Expose-applying active skill. Sundering Blow's cooldown falls from 6 to 5 seconds.
2. Weapon Discipline: weapon skills cost 10% less Fury and have 10% shorter base cooldowns.
3. Reckless Strike: unlock the high-risk two-handed active skill.
4. Heavy Follow-Through: after an action with a time coefficient of at least 1.2×, the next weapon action is 25% faster, subject to the global action-time floor.
5. Weapon Master, major keystone: using three different weapon skills in sequence completes Perfect Form. The next weapon skill costs no Fury and rolls from 95%-100%. Repeating a skill resets progress. The chain also resets at encounter end, when the relevant skills are unequipped, or on reincarnation.

#### Bulwark cluster

1. Shield Brace: unlock the shield-based defensive active skill. Being struck during Shield Brace generates 10 base Fury instead of 5.
2. Second Wind: unlock the Fury-spending recovery active skill. Second Wind's cooldown falls from 15 to 12 seconds.
3. Defiance: below 35% HP, increase Fury generation and healing received by 25%.
4. Shield Impact: when Shield Brace reduces damage, the next Driving Blow or Sundering Blow used within 6 seconds gains a 75% base Stun chance.
5. Unbroken, major keystone: halve the held-Fury damage bonus and gain up to 15% damage reduction at 100 Fury. Once per encounter, lethal damage taken at 75 or more Fury consumes all Fury and leaves the Warrior at 1 HP.

Only one of Berserker, Weapon Master, or Unbroken can be active during a life.
The chosen major keystone cannot change until reincarnation because the skill web has no in-life respec.
Increased-damage-taken effects multiply. For example, Berserker and Reckless Strike combine to `1.25 × 1.20 = 1.50×` incoming damage.

### Provisional Assassin web

The MVP Assassin web has fifteen nodes: five per cluster. Connections follow the first-playable rule above. Caps, durations, and exact values remain open.

#### Shadow cluster

1. Shadow Cut: increase damage against a Marked target from 110% to 135% Physical Power.
2. Smoke Step: unlock the temporary Evasion active skill.
3. Elusive Footwork: Smoke Step grants 15 additional Evasion, and a successful Evasion during it reduces Smoke Step's remaining cooldown by 1 second, once per enemy action.
4. Ambush: the first direct-damage action after Smoke Step gains +30% damage and +20 percentage points of critical chance.
5. Ghost, major keystone: Smoke Step grants Veil for up to 4 seconds. Veil grants +50 Evasion until the next Assassin action; that action consumes Veil and gains +40% damage. A successful Evasion while Veiled extends its duration by 1 second. If the empowered action critically hits a Marked target, Veil activates once more without using Smoke Step; this renewal cannot chain into another renewal.

#### Venom cluster

1. Venom Edge: no effect of its own. Envenomed strikes (the Assassin's innate Poison on direct damage) ticks for 10% of snapshotted Physical Power with or without the node; the node is the entry of the Venom branch and the prerequisite of Potent Toxins.
2. Potent Toxins: increase Poison's stack cap from 5 to 7, shared duration from 8 to 10 seconds, and Poison application Potency by 10.
3. Fan of Knives: unlock the multi-target active skill. With Envenomed strikes it spreads Poison to every enemy it hits.
4. Toxic Opportunity: applying at least one Poison stack to the Marked target grants one Advantage, subject to the normal one-trigger-per-action cap. Poison ticks do not generate Advantage. Bosses keep the full Poison stack cap (no 60% reduction) while this node is allocated.
5. Toxic Sovereign, major keystone: Poison on the Marked target no longer loses duration. When that target dies, apply half its Poison stacks, rounded down, to every surviving enemy, subject to each target's cap.

#### Execution cluster

1. Mark for Death: unlock the single-target Mark active skill. Applying the Mark grants 1 Advantage.
2. Exploit Weakness: direct damage against the Marked target gains +15%, and Mark exploitation stores 25% additional fractional Advantage progress.
3. Execute: unlock the all-Advantage finisher. Execute's base damage is 120% instead of 100% before the Advantage and missing-health terms.
4. Relentless: killing the Marked target resets Mark for Death's cooldown and leaves the Assassin with at least 2 Advantage after the killing action resolves, capped normally at 5.
5. Death Sentence, major keystone: Mark persists until its target dies or is moved. Against ordinary enemies, Execute is fatal below 4% HP per consumed Advantage stack, up to 20%. Bosses cannot be executed; Execute instead gains +10% final damage per consumed stack against them.

Only one of Ghost, Toxic Sovereign, or Death Sentence can be active during a life.
The chosen major keystone cannot change until reincarnation.

### Provisional Ranger web

The MVP Ranger web has fifteen nodes: five per cluster. Each node costs 1 skill point, and connections follow the first-playable rule above. Ammunition capacity remains open.

#### Marksmanship cluster

1. Aimed Shot: improve the starting skill to 338% Physical Power when used at 80 or more Readiness (200% until 2026-11-03, 260% until the second Ranger pass the same day).
2. Steady Hands: at 75 or more Readiness, aimed skills gain +10 percentage points to their minimum damage roll and critical chance.
3. Piercing Arrow: unlock the Armor-penetrating active skill. Piercing Arrow costs 15 Readiness instead of 20.
4. Patient Shot: after spending at least 4 seconds without using a Readiness-spending attack, the next aimed skill gains +20% damage. The effect is consumed on use and cannot stack.
5. Deadeye, major keystone: at 100 Readiness, Aimed Shot or Piercing Arrow consumes all Readiness, rolls from 95%-100%, and gains +25 percentage points of critical chance.

#### Traps cluster

1. Snare Trap: unlock the active skill that spends an action placing a trap; it triggers on a later enemy action and attempts Stun. Snare Trap's cooldown falls from 8 to 6 seconds.
2. Reinforced Snare: add 15 Status Potency to Snare Trap. If Stun is resisted, the trap still pushes the target's next action 0.75 seconds later.
3. Flame Arrow: unlock the special-ammunition Fire active skill.
4. Efficient Quiver: add 2 special-ammunition slots. Every third special arrow fired does not consume ammunition; the visible counter persists for the expedition.
5. Trapper, major keystone: automatically deploy one configured trap before the first enemy action, paying its normal Readiness and supply costs but no combat action. This opening effect is ready when leaving town and recharges after three completed encounters.

#### Pathfinder cluster

1. Hunter's Mark: use a very short action to reveal target defenses and traits for the encounter, expose that information to target-priority rules, and gain 20 Readiness; it does not duplicate Assassin execution mechanics.
2. Trail Sense: increase travel-based Readiness generation by 25% and reveal one additional hidden route trait before departure.
3. Volley: unlock the Readiness-spending multi-target active skill.
4. Press the Trail: after each victory, restore 5 Readiness per current expedition-momentum stack and gain +2 percentage points of escape chance per stack.
5. Trailblazer, major keystone: each expedition-momentum stack grants +3% physical damage and another +5% travel Readiness generation. These benefits disappear when momentum resets.

Only one of Deadeye, Trapper, or Trailblazer can be active during a life.
The chosen major keystone cannot change until reincarnation.

### Provisional Mage web

The MVP Mage web has fifteen nodes: five per cluster. Connections follow the first-playable rule above. Mana costs, prepared charges, and exact values remain open.

#### Elemental cluster

1. Fireball: unlock the group Fire/Burn active skill. Fireball costs 25 Mana instead of 30.
2. Frost Lance: unlock the single-target Frost/Chill active skill. Frost Lance deals 130% Magical Power instead of 110%.
3. Chain Lightning: unlock the jumping Lightning disruption active skill.
4. Elemental Affinity: Burn ticks gain +10% damage, Chill lasts 2 seconds longer, and Chain Lightning retains 85% rather than 75% damage per jump.
5. Elemental Convergence, major keystone: cast Fire, Frost, and Lightning once each in one of six possible orders to create a distinct authored spell in a dedicated Convergence slot.

Elemental Convergence rules:

- The MVP supports six visible recipes: every ordering of Fire, Frost, and Lightning used once each.
- Repeated-element recipes may unlock through later mastery.
- An incomplete sequence persists until completed or until the encounter ends.
- Completing a valid sequence stores one temporary invoked spell.
- The invoked spell uses its own automation priority and conditions.
- Completing another sequence replaces the stored spell.
- Each recipe has an authored damage/utility identity rather than being assembled from a generic formula.
- Invoked spells cost no Mana, consume the stored invocation, and use a 1.0× caster action time.

Initial invocation recipes:

- Fire → Frost → Lightning: Thermal Rupture deals 220% Magical Power to one target. If the target has Burn and Chill, consume one intensity/stack of each for +50% damage and a 1-second action delay.
- Fire → Lightning → Frost: Stormglass Aegis creates a pre-mitigation barrier equal to 140% Magical Power and causes the next enemy that breaks it to gain one Burn and one Chill.
- Frost → Fire → Lightning: Steam Burst deals 120% Magical Power to every enemy and pushes each next action 0.75 seconds later.
- Frost → Lightning → Fire: Plasma Lance deals 180% Magical Power to one target with +30 percentage points of magical penetration and applies one Burn.
- Lightning → Fire → Frost: Flash Freeze deals 100% Magical Power to every enemy and applies two Chill stacks to each successful target.
- Lightning → Frost → Fire: Supercell deals 160% Magical Power to one target, then 100% to up to three additional targets, applying one Burn to the first target and one Chill to each secondary target.

#### Arcane cluster

1. Arcane Bolt: reduce Mana cost from 5 to 3 and increase damage from 90% to 100% Magical Power.
2. Mana Ward: unlock the Mana-spending defensive active skill. Its barrier is 85% Magical Power instead of 65%.
3. Arcane Recovery: increase restoration from 30 to 40 base Mana and reduce base cooldown from 10 to 8 seconds.
4. Efficient Channeling: reduce Mana costs by 10% and increase passive Mana regeneration by 20%.
5. Overcast, major keystone: when Mana is insufficient, each missing Mana costs 0.25% maximum HP. The spell gains +1% damage per missing Mana, capped at +30%. Overcast is ineligible if its health cost would be fatal.

#### Prepared cluster

1. Spell Memory: choose one equipped spell other than Arcane Bolt. It gains one expedition charge that makes one cast cost no Mana; the charge fully restores in town.
2. Quick Study: after each encounter, restore one expended prepared charge.
3. Defensive Preparation: Mana Ward gains one separate emergency charge and may use it without Mana when the configured HP condition passes.
4. Rehearsed Casting: using three different prepared spells in sequence grants the third +20% output and reduces its remaining cooldown by 2 seconds after resolution.
5. Grand Grimoire, major keystone: choose three equipped spells other than Arcane Bolt. Each starts the expedition with two charges, requires a charge instead of Mana, and restores one total expended charge after each encounter. Arcane Recovery restores one chosen expended charge instead of Mana. All charges fully restore in town; Arcane Bolt remains the Mana fallback.

Only one of Elemental Convergence, Overcast, or Grand Grimoire can be active during a life.
The chosen major keystone cannot change until reincarnation.

### Provisional Cleric web

The MVP Cleric web has fifteen nodes: five per cluster. Connections follow the first-playable rule above. Vow conditions, Faith costs, and exact values remain open.

#### Devotion cluster

1. Smite: increase damage from 130% to 150% Magical Power and add 5 Status Potency to vow-related effects.
2. Vowkeeper: increase base Faith generation from Zeal, Endurance, and Temperance by 20%.
3. Penance: unlock the health-for-Faith active skill.
4. Steadfast Spirit: fulfilling a vow condition below 50% HP or while an enemy heavy action is telegraphed generates 5 additional base Faith, at most once per hero action.
5. Exalted Vow, major keystone: increase the equipped vow's generation by another 50%. Breaking its condition removes 50 Faith and prevents Faith generation for 5 seconds. The lockout cannot retrigger while active.

#### Sanctuary cluster

1. Mend: increase healing from 120% to 140% Healing Power.
2. Ward: unlock the Faith-spending absorption active skill. Ward's barrier lasts up to 10 seconds instead of 8.
3. Consecration: unlock the temporary damage-and-recovery field.
4. Safeguard: each 5% of maximum HP effectively healed or prevented by a Cleric skill refunds 1 Faith, capped at 5 Faith per action or tick. Overhealing grants nothing.
5. Living Sanctuary, major keystone: while Consecration is active, store 30% of effective healing and barrier damage absorbed, capped at 50% of maximum HP. When the field ends, create a temporary Sanctuary Release skill for 8 seconds. A priority rule may release the stored value as direct healing or magical damage; release consumes a 1.0× action and the stored value.

#### Judgment cluster

1. Judgment: unlock the high-cost magical damage active skill. Judgment deals 280% Magical Power instead of 250%.
2. Righteous Force: Faith-spending offensive skills gain +15% damage and +10 percentage points of magical penetration.
3. Reciprocal Purpose: alternating between offensive and defensive Cleric skills reduces the second skill's Faith cost by 20%.
4. Final Mercy: an effective Mend or Ward empowers the next Smite or Judgment by 25%; killing an enemy empowers the next Mend or Ward by 25%. Each side stores at most one charge.
5. Sacred Balance, major keystone: replace Faith and vows with 0-100 Grace and Wrath meters:
   - Weapon basic attacks generate 5 base Wrath.
   - Smite generates 10 base Wrath.
   - Mend costs 25 Wrath and generates 15 base Grace after effective healing.
   - Ward costs 30 Wrath and generates 20 base Grace after absorbing damage.
   - Judgment costs 50 Grace and generates 25 base Wrath.
   - Consecration costs 20 Grace and 20 Wrath.
   - Penance consumes 10% maximum HP and generates 20 base Grace plus 20 base Wrath.
   - Spirit applies to Grace/Wrath generation. Costs are not multiplied.

Only one of Exalted Vow, Living Sanctuary, or Sacred Balance can be active during a life.
The chosen major keystone cannot change until reincarnation.

## 5. Core Gameplay Loop

1. Select the active hero.
2. Review the destination, route, enemy information, expected resources, and regional conditions.
3. Configure attributes, equipment, the skill loadout (four skills, five with the Fifth Skill Slot, §10), priority rules, consumables, and retreat conditions.
4. Travel and resolve real-time encounters automatically.
5. Build expedition momentum while deciding how deeply to push.
6. Return safely to secure loot, deposit gold, repair, craft, trade, and complete contracts.
7. Reveal and confront zone bosses.
8. After a boss defeat, decide whether to recover and continue or reincarnate.
9. Spend personal legacy rewards, rebuild, and push farther in the next life.

## 6. World Map and Exploration

- Presentation: illustrated regional node map with animated routes and pixel-art elements.
- The player chooses a destination and route; the hero travels automatically.
- The map and major locations are handcrafted.
- Encounters, resources, and some route events are randomized.
- A zone boss is revealed after enough zone progress.
- World discoveries are account-wide.
- Personal combat gates reset on reincarnation.
- Regional towns offer different recipes, materials, services, and predictable price differences.
- Material sources include enemies, map resource nodes, and event rewards.
- Quests consist of repeatable contracts plus authored lore quests and discoveries.

### First playable region: Fractured Frontier

Greyhaven is a strained but functional frontier outpost that is slowly being isolated by the spreading fracture.

The three-zone route:

1. Splintered Road introduces Starved Wolves (speed/Evasion), Fracture Shardlings (groups), and Deserters (Bleed and supply pressure).
2. The route branches:
   - Withered Grove contains Blight Spiders (Poison), Thornbeasts (Armor/regeneration), Fracture Wisps (magical damage/Chill), and the Rootmaw Stalker elite.
   - Fallen Bastion contains Hollow Sentries (Armor), Fallen Arbalists (telegraphed burst), Oathbound Echoes (wards/support), and the Echo Knight elite.
3. Progress from both branches opens the route to the regional fracture and its boss.

First-playable layout, decided 2026-10-31 (the contract list is still open for Step 9.4):

- Nodes: Greyhaven (town), Splintered Road, Withered Grove, Fallen Bastion, and the Fracture Gate, where the Fractured Warden waits. The Road leads to a branch. The Grove and the Bastion each lead on to the Fracture Gate.
- Every leg takes 20 seconds, the same as the road's ordinary journey, and a return walk takes the same. These are simulated seconds. The UI plays the walk 8× faster than the chosen speed (about 2.5 real seconds at 1×), and 16× on a route the hero has mastered, so regeneration, Readiness, and Fury drain keep their ratios to the walk. Fights are not sped up.
- Run dock, decided 2026-11-13 (user, Step 13.7 batch 6): while the selected hero has a running expedition, every page except the Map shows a small "dock" with the fight state, HP, Push on and Return. It is UI only; nothing in the run or the save changes. Its expanded view has a live "Repeat this route" toggle that flips the hero's existing repeat setting (the same `repeatRoute` the Preparation checkbox sets). The toggle is available only on a mastered route (10 safe returns, `MASTERY_RETURNS`); on any other route it is shown disabled with that reason. The Preparation checkbox is unchanged and always available between runs.
- Each zone has one resource node that gives the hero 4 of a material on a visit, using the existing materials: a Scrap Heap on the Road (scrap), a Hollow Thicket in the Grove (hide), and a Shard Seam in the Bastion (shard). New materials wait for crafting (G8). Resource nodes do not change when the Grove and Bastion get their own materials (Step 13.2); those two materials come from enemy drops only.
- Each branch ends in its elite: the Rootmaw Stalker in the Grove and the Echo Knight in the Bastion.
- The Fracture Gate is a personal gate. It opens for a hero once that hero has defeated both elites at least once. The boss is revealed to the hero on arrival at the gate, not before.
- Discovering a node is shared across the account. Defeating the elites is personal to each hero.
- The exact reward for a visit remains open.

First-playable contracts and XP, decided 2026-10-31:

- A won fight awards the hero experience through the encounter XP rules (level-difference modifier, group discount, Spirit factor, and the Human bonus). The XP is added to the hero when the expedition is settled in town, and XP from fights already won is kept after a defeat. Level-ups give the attribute and skill points the progression rules define.
- Rolled contract board, decided 2026-11-04 (user). It replaced six fixed contracts (Cull the Pack, Clear the Shards, Hunt Deserters, Thicket Sweep, Bastion Patrol, Break the Elite); a contract a save already holds keeps its old target and reward.
  - Each hero has its own board of 4 offers, rolled from a seed per hero, so a reload shows the same board.
  - Three kinds. A Bounty asks the hero to defeat 3-8 of one regular monster (6-16 Fracture Shardlings, which come in pairs). A Patrol asks for 3-6 won fights in one zone. An Elite contract asks for one defeat of the Rootmaw Stalker or the Echo Knight.
  - Bounty monsters are the regular monsters in the fixed and drawn fights of zones the account has discovered: Shardling, Wolf, and Deserter on the Splintered Road; Thornbeast and Blight Spider in the Withered Grove; Hollow Sentry and Fallen Arbalist in the Fallen Bastion. Patrols name a discovered zone. An elite is offered once its zone is discovered.
  - Each offer rolls Elite with chance 1 in 8 (when an elite is known), Patrol 1 in 4, and Bounty otherwise. A board does not show two offers with the same target.
  - The reward is the formula below times one roll from 80% to 130%, applied to XP, gold, and material and rounded half up (at least 1 material). `L` is the monster's level in its zone's fixed fight (the zone's highest regular level for a Patrol; 14 and 16 for the elites). The material is the monster's own drop when it has one, else the zone's resource material.
  - Offers not taken are rerolled each time the hero comes back from an expedition. Collecting or abandoning a contract frees its slot for a new offer.
  - A Patrol counts every won fight in its zone, including the drawn fights after a route's fixed ones (those are fought at the route's last zone).
- Up to 3 contracts can be active. Progress counts fights won on any hero's expeditions, even if that expedition ends in defeat, and is added when the expedition is settled. A finished contract is collected in town and can then be taken again. The player can abandon one and lose its progress.
- Rewards are about 60% of normal value for the units a contract asks for (kills or fights) at the zone's level `L`: XP is `round(0.6 × units × (5 + 2L))`, gold is `units × L`, and materials are `ceil(units ÷ 2)` of the zone's material. Gold, materials, and XP go to the hero who collects.

#### Splintered Road enemies

The zone introduces each enemy type in isolated encounters before unlocking mixed groups near the branch point.

Fracture Shardling:

- Levels 1-5; Swarm archetype.
- Usually appears in groups.
- On death, begins a 1-second Fracture Burst telegraph.
- An unresolved burst deals 40% Magical Power to the hero.
- Ending the encounter cancels unresolved death bursts, rewarding rapid group cleanup.

Starved Wolf:

- Levels 2-6; Skirmisher archetype.
- Appears in pairs before packs of three unlock.
- Pack Hunter grants +10% action speed per other living wolf, capped at +20%.
- Pounce has a 1.5-second telegraph, deals 160% Physical Power, can critically hit, and has a 7-second cooldown.
- Stun or action delay can postpone Pounce; ordinary damage does not cancel it.

Deserter:

- Levels 4-7; Standard archetype.
- Rusted Cut deals 90% Physical Power and has a 75% base chance to apply Bleed. Each applied stack ticks for 10% of snapshotted Physical Power. Cooldown: 5 seconds.
- Guard grants 30% incoming-damage reduction until the Deserter's next action. Cooldown: 7 seconds. Action time: 0.75×.
- Predictable offensive/defensive alternation teaches status cleansing and timing around mitigation.
- Supply pressure, decided 2026-11-04: when Rusted Cut hits a hero who carries supplies, there is a 20% chance the Deserter snatches the last supply in the hero's backpack, at most once per Deserter per fight. Winning the fight returns it; a retreat or defeat loses it. A hero with no supplies is never rolled for, so fights without supplies are unchanged.

Splintered Road encounter order, chosen 2026-10-24:

- Each gap, including the walk out of town before the first fight, is the ordinary 20-second journey. Readiness fills from empty over that walk. Fury still waits 3 seconds and then drains at 10 per second, so a 20-second gap empties a full meter.
- The first three encounters are fixed: a Shardling pair (two level-3 Fracture Shardlings), the Starved Wolf pair (two level-6 wolves), then one level-6 Deserter.
- From the fourth encounter on, each draw is an equal chance of that Shardling pair, the wolf pair, the Deserter, or the mixed group (one level-5 Shardling, one level-5 Wolf, and one level-5 Deserter).
- The draw order for that equal chance is Shardling pair, wolf pair, Deserter, mixed group.

#### Withered Grove enemies

Later Grove encounters pair durable Thornbeasts with Spider or Wisp support, teaching target priority.

Blight Spider:

- Levels 6-10; Skirmisher archetype.
- Venom Bite deals 85% Physical Power and has a 70% base chance to apply Poison. Each stack ticks for 10% of snapshotted Physical Power. Cooldown: 4 seconds.
- Web Snare has an 80% base application chance, pushes the hero's next action 1 second later, and reduces Evasion by 15 for 4 seconds. Cooldown: 8 seconds.

Thornbeast:

- Levels 8-13; Tank archetype.
- Regenerates 1% maximum HP per second during combat.
- Burn pauses its regeneration; Expose halves it.
- Bramble Slam has a 1.8-second telegraph, deals 220% Physical Power, cannot critically hit, and has a 9-second cooldown. It is interrupted if the hero deals 25% of the Thornbeast's maximum HP during the telegraph. It was a 1-second, 140%, 6-second skill with no interrupt until 2026-11-07, when mid-game regulars started testing the hero's telegraph rules (Step 12.3). The first numbers were 2 seconds, 200% and 6%; measurement showed the hero's ordinary hits interrupted almost every slam, so they moved to 1.8 seconds, 220% and 10%, and on 2026-11-08 the interrupt moved to 25% so one ordinary hit no longer cancels the slam by accident (see Step 12.3 measurements).

Fracture Wisp:

- Levels 10-14; Burst archetype.
- Uses 0.5× baseline Armor and 1.5× baseline Resistance.
- Cold Spark deals 100% Magical Power, applies one Chill on a successful status roll, and has a 4-second cooldown.
- Fracture Ray has a 2-second telegraph, deals 180% Magical Power, can critically hit, and has a 9-second cooldown.

Rootmaw Stalker:

- Level 14 elite; Skirmisher/Tank hybrid.
- Stats: 1,000 HP, 29 Power, 51 Armor/Resistance, 24 Accuracy, 26 Evasion, 2.0-second base action time, and 25 Consistency. HP was 1,350 until 2026-11-02: at 1,350 no level-20 floor build beat it (0-2% wins over 60 runs each), so it was lowered to 1,000. The reference sweep at 1,000 aims for Warrior and Assassin near half, with player skills, gear, and accessories adding more. Ranger and Cleric floor builds still lose to both elites, and that is a class damage question, not an elite one.
- Regenerates 1% maximum HP per second (10 HP per second at 1,000 HP); Burn pauses it and Expose halves it.
- Venomous Rend deals 120% Physical Power and makes two independent Poison applications at 75% base chance. Each stack ticks for 10% snapshotted Power. Cooldown: 6 seconds.
- Grasping Roots has a 2-second telegraph and a 10-second cooldown.
- Grasping Roots is interrupted if the hero deals 6% of Rootmaw's maximum HP during its telegraph (60 HP). It was 10% until 2026-11-03: one hero action deals 60-80, so 100 was unreachable and the "Telegraph can be interrupted" rule condition had nothing to answer. At 6% one well-timed hit cancels it.
- If not interrupted, it pushes the hero's next action 2 seconds later and reduces Evasion by 20 for 6 seconds.

Mid-game heavy telegraph measurements (Step 12.3, 2026-11-07, seed 1, floor builds at the band-middle hero level, 100 runs each, `npm run sim -- --matrix telegraph`):

- Both regulars were tried at the plan's numbers (2.0 s, 200%/160%, interrupt 6%/8%) and at the hardest values the plan allows (1.8 s, 220%, interrupt 10%). Cooldowns stay 9 s and 10 s. Neither reached the target bands. Every class wins 100% of every changed fight, with the rules and with the telegraph rows removed ("blind"), so nobody is walled and nobody is hurt much either.
- The cause is the interrupt. Any ordinary hero hit during the wind-up counts, and a floor hero hits for more than 10% of a Thornbeast or Sentry in one action. A blind hero therefore cancels most slams by accident (Warrior blind: 2.3 wind-ups started, 0.2 resolved at the first numbers). A wind-up also costs the enemy its actions, so the fights got slightly easier on average.
- Final numbers (the hardest allowed): mean share of maximum HP lost, rules / blind. Thornbeast: Warrior 15 / 16, Assassin 7 / 7, Ranger 7 / 7, Mage 6 / 12, Cleric 17 / 32 (it was 30 / 30 before, with a 1 s wind-up). Sentry: Warrior 8 / 7, Assassin 11 / 11, Ranger 3 / 9, Mage 3 / 3, Cleric 11 / 13. Grove-mixed and Bastion-mixed move by 0-6 points, with the largest gaps for the Ranger (Bastion 13 / 28) and Mage (Grove 41 / 45).
- The band "blind HP lost at least 8 points above rules" holds only for Cleric Thornbeast (+15), Ranger Bastion-mixed (+15), with Ranger Sentry and Mage Thornbeast at +6 (close). The Warrior and Assassin floor builds ignore the telegraph rows either way. The band "blind win 75-90%" is not met anywhere: blind wins stay at 100%.
- Zone 1 solos (Shardling, Wolf, Deserter), Spider, Wisp, Oathbound Echo and Arbalist rows of the reference matrix are unchanged (seed 1, 100 runs). Rootmaw, Echo Knight and Warden win rates are unchanged at 0, 6 and 9 nodes (matrix `built`, 40 runs). The golden duel-basic snapshot is unchanged.
- Interrupt raised to 25% (2026-11-08, option 1, user approved; wind-up 1.8 s, damage 220%, cooldowns 9/10 s and the Sentry's 60% Stun unchanged). Fractions 0.18, 0.25 and 0.30 were measured at seeds 1-3, 100 runs each (mean share of maximum HP lost, rules / blind, mean of 3 seeds; every cell still wins 100%, rules and blind):
  - Thornbeast: Warrior 19 / 20, Assassin 16 / 16, Ranger 7 / 13, Mage 12 / 25, Cleric 17 / 34 at 25%. At 18% the Assassin and Ranger blind Thornbeast cells matched the rules (12 / 12, 7 / 7); 30% gave the same numbers as 25%, so 25% is where one ordinary hit stops cancelling the slam.
  - Sentry at 25%: Warrior 12 / 12, Assassin 13 / 13, Ranger 3 / 10, Mage 3 / 12, Cleric 11 / 17. Bastion-mixed: Ranger 14 / 31, others within 1 point. Grove-mixed: Ranger 21 / 26, Mage 42 / 47.
  - The Warrior and Assassin floor builds carry no telegraph answer, so rules and blind are the same for them in every fraction. Offline expedition defeats (reference heroes, 40 seeds, rules / blind): Grove Assassin 33% before, 20% now; Ranger 23 / 25% before, 23 / 28% now; Warrior 8 / 10% before, 8 / 8% now; Bastion Assassin 13%, Ranger 13% before and 13%, 15% now.
- Open: blind wins stay at 100% in every cell at every fraction tried, so the band "blind win 75-90%" is still not met, and the band "blind loses 8 or more points more HP" holds for Ranger, Mage and Cleric in most changed fights but not for the Warrior and Assassin floor builds. A stronger effect needs a lever outside the plan's ranges, for example a shorter cooldown (6 s still gave no blind defeats), a first-use delay, an interrupt that only counts skill damage, or enemies that hit harder at equal level. Recorded for the user to decide.
- Warrior and Assassin telegraph rows (2026-11-08, Step 12.3 close): no reference rows were added. The Warrior reference loadout already has a Shield Brace row (telegraph resolves within 1 s) and it fires about once per fight, but Shield Brace only cuts the next hit by 30% until the Warrior's next action, so rules and blind stay within 1 point (Thornbeast 19 / 20). The Assassin floor build has no defensive skill (Smoke Step comes with its second node; the built matrix adds a Smoke Step row then, which since the Assassin rules fix (Step 13.5) is a no-condition filler row placed last, because active skills never roll to hit, so a Smoke Step on a telegraph cannot dodge anything). Candidate rows were measured at the floor build (seeds 1-3, 60 runs, mean share of maximum HP lost, rules / blind, Thornbeast, Sentry, Grove-mixed, Bastion-mixed): Warrior Shield Brace resolving within 1.5 s, 2 s or on any telegraph 18-14 / 20-12 (no gap above 2 points either way), Warrior Sundering Blow or Driving Blow on an interruptible telegraph 19 / 20, 11 / 12, 51 / 51, 49 / 50 (no gap, because one skill hit stays under the 25% interrupt); Assassin Execute, Shadow Cut or Venom Edge on an interruptible telegraph made the hero lose more HP than blind in the mixed fights (Grove 41-48 / 41, Bastion 39-48 / 39). With the answer skill present, Assassin at 2 nodes (Smoke Step) measured Thornbeast 15 / 15, Sentry 12 / 12, Grove 42 / 39, Bastion 38 / 38, and Warrior at 5 nodes measured 18 / 18, 12 / 10, 50 / 50, 49 / 50. So no Warrior or Assassin answer exists that opens a gap, and none was added. The band "blind loses 8 or more points more HP" stays unmet for them. Their answer is the burst-and-survive kit, not a telegraph answer.

#### Fallen Bastion enemies

Mixed Bastion encounters use Sentries to protect Arbalist or Echo backlines, making per-rule target selection important.

Hollow Sentry:

- Levels 8-12; Tank archetype.
- Uses 1.75× baseline Armor and 1.0× baseline Resistance instead of the normal Tank Defense multiplier.
- Shield Wall grants 35% incoming-damage reduction to the Sentry and one ally until the Sentry's next action. Cooldown: 7 seconds.
- Shield Bash has a 1.8-second telegraph, deals 220% Physical Power, and has a 60% base Stun chance. Cooldown: 10 seconds. It is interrupted if the hero deals 25% of the Sentry's maximum HP during the telegraph (10% from 2026-11-07 until 2026-11-08). It had no telegraph, 90% Power and an 8-second cooldown until 2026-11-07 (Step 12.3).

Fallen Arbalist:

- Levels 11-14; Burst archetype.
- Aimed Bolt has a 2.5-second telegraph, deals 220% Physical Power, can critically hit, and has a 10-second cooldown.
- After Aimed Bolt, the Arbalist must perform a 2-second Reload and suffers −20 Evasion until Reload completes.

Oathbound Echo:

- Levels 13-16; Support archetype.
- Uses 0.5× baseline Armor and 1.5× baseline Resistance.
- Ward grants the lowest-barrier ally a pre-mitigation barrier equal to 100% Magical Power. Cooldown: 8 seconds.
- Mend heals an ally for 120% Magical Power. Cooldown: 10 seconds.
- Echo Bolt deals 70% Magical Power.

Echo Knight:

- Level 16 elite based on the Tank archetype and normal elite multipliers.
- Stats: 3,200 HP, 26 Power (28 Power until the balance pass of 2026-11-03, which gave the squishier classes no chance at the Knight's own level; approximately 1,920 HP and 25 Power until 2026-11-03: at 1,920 every level-20 Warrior, Mage, Cleric, and Assassin build won about 100%, so the elite did not test skill), 69 Armor/Resistance, 26 Accuracy, 17 Evasion, 2.64-second base action time, and 25 Consistency.
- Alternates stances every 10 seconds.
- Guard stance grants +30% Armor and Resistance.
- Assault stance grants +25% Power and reduces Armor and Resistance by 40%. It was 20% until 2026-11-03; the deeper cut makes Assault a real burst window (the "Target is in Assault stance" rule condition) while the Knight hits harder. (Proposed as +15% damage taken; a defense cut gives the same window without a new damage-taken mechanic on enemies.)
- Once at 60% HP, uses a 2-second telegraph to summon one Oathbound Echo.
- The summoned Echo uses the normal level-16 Support stat block.
- Fractured Charge has a 2-second telegraph (1.5 seconds until 2026-11-03, too short for a defensive skill to answer reliably), deals 180% Physical Power, can critically hit, and has an 8-second cooldown.

### First boss: The Fractured Warden

- A former protector fused with the spreading fracture.
- Rank-0 level: 20.
- Rank-0 stats from the Standard baseline:
  - 7× HP: 3,360 (Step 13.5 targeting fix part 2; was 8×, then 5.75× in part 5A)
  - 1.3× Power: 36
  - 1.5× Armor and Resistance: 68 each
  - Accuracy: 40
  - Evasion: 20
  - Consistency: 50
  - Base action time: 2.2 seconds
- Target successful-fight duration: 60-90 simulated seconds.
- The same floor builds lost every rank-0 fight in that matrix: 0% wins, about 50 seconds to defeat, and no timeouts. That loss is accepted. The duration band remains the target for a successful fight, not a requirement that the floor build win. Enemy stacking pressure after the expected duration stays undesigned (the two late elites, Colossus and Reaver, are the exception: they get a `timePressure` enrage, Step 13.5 part 8a, §7 "Elite pressure"), and the harness still ends a fight at 10 simulated minutes.
- Warden Strike fills ordinary action gaps and deals 100% Physical Power.
- Three telegraphed phases:
  1. Warden's Guard, from 100%-70% HP:
     - Fracture Hammer has a 2-second telegraph, deals 200% Physical Power, can critically hit, and has an 8-second cooldown.
     - Warden's Guard grants +50% Armor and Resistance for 4 seconds and has a 10-second cooldown. Expose applies after this bonus.
  2. Warden's Echoes, from 70%-35% HP:
     - On transition, summon one Blade Echo and one Ward Echo.
     - Each Echo has 15% of the Warden's rank-adjusted maximum HP and 75% of its Armor/Resistance.
     - Blade Echo uses 70% of Warden Power and a 1.65-second action time.
     - Blade Echo's Severing Dash has a 1-second telegraph, deals 160% Physical Power, can critically hit, and has a 6-second cooldown.
     - Ward Echo uses 50% of Warden Power and a 2.2-second action time.
     - Ward Echo can grant one ally a pre-mitigation barrier equal to 5% of Warden maximum HP. Cooldown: 8 seconds.
     - Ward Echo can heal one ally for 3% of Warden maximum HP. Cooldown: 10 seconds.
     - When support skills are unavailable, Ward Echo uses Rift Bolt for 70% Magical Power.
     - The Warden remains active, making target priority part of the phase.
     - Fracture Hammer remains available, but Warden's Guard does not.
  3. Shattered Warden, below 35% HP:
     - Every 3 seconds, gain one stack granting +10% Power and +5% action speed while reducing Armor and Resistance by 5%; maximum 10 stacks (was every 8 seconds and 5 stacks until Step 13.5 part 2).
     - Rift Pulse has a 1.5-second telegraph, deals 120% Magical Power, applies one Chill on a successful status roll, and has a 6-second cooldown.
     - Fracture Hammer remains available.
     - Surviving Blade and Ward Echoes remain until killed.
- Each victory unlocks a stronger personal Fracture Echo rank.
- Losing to, or beating, the Warden at any available Echo rank satisfies that life’s boss requirement for optional reincarnation (a victory counts since Step 13.27).
- Echo ranks prevent a strong hero from being locked out of reincarnation after defeating the only MVP boss.
- First-time Echo-rank milestones can contribute one-time personal reincarnation rewards.
- Echo rank `R` multiplies rank-0 HP, Power, Armor, and Resistance by `1.12^R`.
- Each rank also adds one visible authored modifier.
- Rank reward (Step 13.51, decided 2026-11-23): the first time a hero unlocks Echo rank N (N 1 or more), they get 1 free upgrade, paid at the next safe return like a first-clear reward and recorded once per hero as `echo:N` in `firstClearIds` (reincarnation resets the rank but not that list, so a later life earns nothing for a rank already reached). It stacks with the one-time +5 Legacy. A free upgrade only opens a socket or ranks a modifier to II, so the power is small, and it needs a Warden win at the rank below, so losing on purpose pays nothing. No sim or number change.
- Milestone ranks (Step 13.52, decided 2026-11-24): rank 3 and every fifth rank (5, 10, 15, ...) pay 3 free upgrades and 500 gold per rank number (1,500 g at rank 3, 2,500 g at rank 5, 5,000 g at rank 10) instead of 1 upgrade. Paid the same way, once per hero (`echo:N`). The preparation screen names the reward for the next rank. Ranks already paid are not topped up.
- Milestone Legacy (Step 13.53, decided 2026-11-24): a milestone rank also pays +15 Legacy instead of +5 (`RANK_MILESTONE_BONUS = 10` on top of `RANK_BONUS`), claimed at the next reincarnation like the other one-time bonuses. A milestone claimed earlier at +5 is not topped up. The preparation screen also shows the rank 1 reward to a hero at rank 0.
- Exact Blade/Ward Echo skills, rank modifiers, XP, and rank rewards remain open.
- Measured 2026-11-08 (Step 12.4, measurements only, no number changed): can a realistic hero beat the rank-0 Warden? Command `npm run sim -- --matrix warden --seed N --runs 100` (seeds 1-3 agree within 3 points). Human heroes with the reference attribute split, a 4-slot backpack, the class reference rules behind the default supply rules (Draught at HP 40% or less, Ward Charm on a telegraph), and gear crafted at item level equal to hero level with one modifier per piece (the same modifier counts twice at most). Tiers: Just arrived = level 18, 6 nodes, quality 100%, starter modifiers only (Keen, Precise), 2 Draughts + 1 Ward Charm. Well prepared = level 20, 6 nodes, quality 105%, Piercing weapon, Precise off-hand, Sturdy head and chest, Nimble hands and feet, Keen and Vicious accessories, 3 Draughts + 1 Ward Charm. Over-levelled = level 24, 8 nodes, quality 110%, as prepared but Vicious and Quick accessories, same supplies. A first life earns 6 nodes at level 20 (the elites' Legacy skill points are not granted in code, so they are not counted).
  - Wins (seed 1, 100 runs; seeds 2 and 3 within 3 points), just arrived / well prepared / over-levelled: Warrior 0 / 0 / 0%. Assassin 0 / 4 / 100%. Ranger 0 / 26 / 100%. Mage 2 / 77 / 100%. Cleric 0 / 0 / 0%. Median fight 41-133 s. Warden HP left: Warrior 64 / 51 / 25%, Cleric 73 / 71 / 58%.
  - Level sweep with the prepared kit (40 runs, 3 Draughts + Charm): Assassin 8 / 43 / 73 / 95 / 100% at levels 20 / 21 / 22 / 23 / 24; Ranger 18 / 68 / 90 / 95 / 100%; Mage 73 / 95 / 100% at 20 / 21 / 22; Warrior 0% up to level 26 and 43% at level 28; Cleric 0% through level 28. Supplies at level 20 prepared (none / 2 Draughts / 4 Draughts): Mage 3 / 75 / 100%, Ranger 0 / 0 / 63%, Assassin 0 / 0 / 13%, Warrior and Cleric 0% in every case.
  - What it does: no single hit is dangerous (prepared level-20 hero with 335-400 max HP: Warden Strike mean 12-23, max 37-57; the 200% Fracture Hammer mean 19-40, max 47-94; Blade Echo Severing Dash max 42). The Warden wins by attrition: about 580-1,170 HP of damage per fight against 335-400 max HP plus 3 Draughts (120 HP each) and a Charm. Warden Strike and Hammer are about 55-80% of the damage and the Echoes 20-45%. The Warrior reaches phase 2 at about 31 s. The default Ward Charm rule spends the Charm on the first telegraph (the Hammer) in every run.
  - Reading: a wall that needs preparation for Assassin, Ranger and Mage (about level 22-24, or level 20 with 4 Draughts for the Mage), and out of reach for Warrior and Cleric at every tested level and kit. A Warden HP multiplier of 6 instead of 8 (tested on a copy, not applied) at the prepared tier gives Assassin 70%, Ranger 93%, Mage 100%, Warrior 0%, Cleric 0%: the Warrior and Cleric gap is damage and sustain, not the Warden.

### Second zone: Drowned Causeway

Decided 2026-11-08 (user approved), Step 13.1. One new zone and one elite, no boss. Gear grows through a new material tier (riftglass) and gated modifiers, not new item bases or sets. The zone fixes the XP desert at levels 16-24 and gives the Warden a gear and level path. Grove and Bastion material drops into the later tiers are a later step and are not part of this one.

World:

- Node Drowned Causeway, levels 17-22, reached by a leg from the Splintered Road (20 seconds, like every leg). Resource node Riftglass Shoal gives 3 riftglass per visit.
- Gate: both elites defeated (Rootmaw Stalker and Echo Knight), personal to the hero, the same rule as the Fracture Gate. The gate message names the enemies ("Defeat Rootmaw Stalker and Echo Knight first."), never raw ids.
- Route `sunken-causeway`: Greyhaven, Splintered Road, Drowned Causeway. Fixed fights in order: `leech-swarm` (3 Mire Leeches, level 17), `raider` (one Causeway Raider, level 18), `causeway-mixed` (Drowned Bulwark level 18 and Fracture Wisp level 18), then the elite fight. Drawn fights after the fixed ones: `causeway-mixed`, `causeway-deep` (Drowned Bulwark, Causeway Raider and Oathbound Echo, all level 20), `leech-swarm`.
- Fracture Wisp widens from levels 10-14 to 10-22 and Oathbound Echo from 13-16 to 13-22, so they can appear here. They drop nothing.

Regular enemies (stats from the Enemy balance framework; a Standard enemy at level 18 has 440 HP and 26 Power):

| Enemy | Levels | Archetype | Skills | Drop |
| --- | --- | --- | --- | --- |
| Mire Leech | 17-20 | Swarm, groups of 3 | Regenerates 2% max HP per second (Burn pauses it, Expose halves it). Bite: 80% Physical Power, 50% base chance to apply Bleed | 2 hide |
| Causeway Raider | 17-21 | Standard | Pilfer: 90% Physical Power, 35% chance to steal the last carried supply, once per fight (like the Deserter's snatch). Guard as the Deserter's (30% reduction, 7 s cooldown, 0.75x action time) | 4 scrap |
| Drowned Bulwark | 18-22 | Tank with 1.75x Armor (as the Sentry) | Undertow: 2.2 s telegraph, 200% Physical Power, applies 2 Chill (two independent applications), interruptible at 25% of max HP, 9 s cooldown. Shield Wall on an ally (35% reduction, 7 s cooldown) | 4 riftglass |

The Leech's regeneration is the `REGENERATION_TRAIT` with a per-enemy multiplier of 2 (the trait's 1% per second becomes 2%; every other regenerating enemy is unchanged). The Raider's steal is the existing `stealSupply` effect at 35%. The proposal gave no cooldowns for Undertow and Pilfer or the Leech's Bite; they use 9 s (like Bramble Slam), 5 s (like Rusted Cut) and 4 s (like Venom Bite). Shield Wall on an ally follows the Sentry (affects the Bulwark itself and one ally).

Elite Tidebound Colossus:

- Level 22 Tank elite. Stats: 4,000 HP (Step 13.5 part 5B; was 3,600, about the Echo Knight x 1.12), 35 Power (31 in the proposal, raised in tuning, Step 13.1 part 8); Armor, Resistance, Accuracy and Evasion come from the elite Tank line. Consistency 25. Step 13.5 part 8a (final values): action time 2.2 s (from the Tank line's 2.64 s) and a `timePressure` enrage from 140 s (§7 "Elite pressure").
- Tide cycle uses the existing stance trait (10-second switch, the same constants as the Echo Knight): Ebb is the Guard stance (+30% Armor and Resistance), Flood is the Assault stance (+25% Power, -40% Armor and Resistance). It starts in Ebb. The sim keeps the names guard and assault; the Tide names are display text for later.
- Breaker Wave: 2.5 s telegraph, 300% Physical Power (Step 13.5 part 5B; was 230%), can critically hit, interruptible at 5% of max HP (8% until Step 13.5 part 8a), 10 s cooldown.
- At 35% HP (50% in the proposal, lowered in tuning, Step 13.1 part 8) it uses a 2-second telegraph to summon 2 Mire Leeches (level 18), through the HP summon trait. Summons award no XP.
- Drops 10 riftglass. Gold is the elite rate, level x 3.
- Its first defeat by any hero unlocks the Siphoning modifier recipe (account-wide).

Riftglass (new material, documented here; code follows in Step 13.1 parts 5 on):

- Sells for 5 gold. A craft with riftglass rolls quality 102% to 112% (the average of two rolls, plus the proficiency bonus as for the other materials, never above the range maximum).
- As an upgrade material it adds +3 quality points, up to 112%. Other materials keep their 110% cap, and an item above 110% keeps its quality when upgraded with another material.
- It is the rarest material in `MATERIAL_RARITY`, so the safe pouch keeps it first.

Modifiers (documented now; built in part 6):

| Modifier | Effect | Min level | Slots | Recipe | Unlock |
| --- | --- | --- | --- | --- | --- |
| Hallowed | +10 Healing Power | 16 | off-hand, accessory | 400 gold | Causeway discovered |
| Rending | +6 points Armor and magical penetration | 18 | weapon | 450 gold | Causeway discovered |
| Siphoning | Heals 3% of damage dealt after mitigation (new `lifestealFraction` stat, one new sim hook) | 20 | weapon | 500 gold | Colossus defeated by any hero |

The same modifier still counts at most twice across worn gear (`MODIFIER_STACK_CAP`). Siphoning heals only from the hero's own direct damaging hits (not damage over time), is capped by missing HP, and is logged as a heal.

Built in Step 13.1 part 6: the heal is `round(HP the hit removed x 3%)`, limited to missing HP, drawn from no random numbers, and logged as a `lifesteal` event under the Healing filter. Overkill damage does not count. Recipes with an unlock requirement stay on sale in the Enchanter but show a Locked tag with the reason and cannot be learned until it is met; crafting and wearing are unaffected once the recipe is known. The Colossus defeat is also stored on the account as the discovery entry `defeated:tidebound-colossus` (every elite and boss gets one), so Siphoning stays unlocked after the hero who beat it reincarnates. The equipment screen gains Armor penetration, Magical penetration and Life steal lines.

Contracts and Legacy (documented now; built in part 7):

- New contract kind Salvage: "bring home N riftglass", N from 6 to 12. It counts riftglass secured at settlement. The reward is `rewardFor(ceil(N / 3), 20, 'scrap')`, then the usual 80-130% roll. The board pool (`boardPool`) offers it once the Causeway is discovered.
- The first-ever defeat of the Tidebound Colossus gives 3 Legacy once (a milestone in the reincarnation list).

Built in Step 13.1 part 7: Salvage is offered only for a zone whose resource is riftglass, at about 1 offer in 6 (after the elite and patrol shares, so boards without the Causeway roll exactly as before), counts the riftglass in the run's secured loot at settlement (safe return, retreat, or what the defeat pouch kept; unsecured loot is lost and does not count), and pays scrap at level 20. The board now offers Causeway contracts (bounties, patrol, Colossus elite, Salvage) only to a hero who can enter the Causeway, using the same gate as the route start (both elites defeated). A contract the hero already holds stays valid, and offers left over on a board refresh away on the next return. The Colossus Legacy bonus is per hero, like the other elite bonuses (`elite:tidebound-colossus`).

XP intent: a Causeway-mixed win gives a level-18 hero about 97 XP, about 39 fights per level (measured in part 8; the first estimate was 87 and 44). The zone is the XP source for levels 16-24.

Compatibility: no save version bump. Older saves load unchanged: the new node is undiscovered and the new material counts as 0.

Measurement targets (for the later tuning step; part 3 records the first numbers and changes nothing). Tiers, as in the Warden measurement: Just arrived (level 17, 6 nodes, quality 100%, starter modifiers, 2 Draughts), Well prepared (level 19, 6 nodes, quality 105%, a prepared modifier set, 3 Draughts and a Ward Charm), Over-levelled (level 22, 8 nodes, quality 110%).

- Regular fights, prepared tier: at least 95% wins, and the mixed fights lose 15-35% of maximum HP on average.
- Colossus: prepared tier 40-85% wins (Warrior and Cleric at least 30%), over-levelled at least 85%.
- Interrupt rules against blind (the same hero with its telegraph and interrupt rows removed) differ by at least 8 HP points lost for Ranger, Mage and Cleric.

First measurements (2026-11-08, Step 13.1 part 3; measurement only, no number changed). Command `npm run sim -- --matrix causeway --seed N --runs 100`; seeds 1 and 2 agree within about 5 points. Heroes are built like the Warden heroes (`src/harness/causeway.ts`): reference attributes, a 4-slot backpack, the class reference rules behind the default supply rows, gear crafted at item level equal to hero level, one modifier per piece. Tiers: Just arrived = level 17, 6 nodes, quality 100%, starter modifiers (Keen, Precise), 2 Draughts. Well prepared = level 19, 6 nodes, quality 105%, Piercing weapon, Precise off-hand, Sturdy head and chest, Nimble hands and feet, Keen and Vicious accessories, 3 Draughts + 1 Ward Charm. Over-levelled = level 22, 8 nodes, quality 110%, as prepared but Vicious and Quick accessories. Fights: each new enemy alone at level 18 (`leech`, `raider`, `bulwark`), `leech-swarm` (3 x level 17), `causeway-mixed`, `causeway-deep`, and the Colossus at level 22. "Blind" removes the hero's telegraph and interruptible rows (run for the fights with a wind-up).

Seed 1, 100 runs. Win % (mean share of maximum HP lost %), arrived / prepared / over-levelled:

| Fight | Warrior | Assassin | Ranger | Mage | Cleric |
| --- | --- | --- | --- | --- | --- |
| leech | 100 (6) / 100 (4) / 100 (3) | 100 (6) / 100 (4) / 100 (3) | 100 (3) / 100 (2) / 100 (2) | 100 (7) / 100 (5) / 100 (5) | 100 (10) / 100 (7) / 100 (5) |
| raider | 100 (12) / 100 (9) / 100 (7) | 100 (9) / 100 (7) / 100 (5) | 100 (7) / 100 (5) / 100 (3) | 100 (15) / 100 (11) / 100 (7) | 100 (19) / 100 (14) / 100 (10) |
| bulwark | 100 (14) / 100 (10) / 100 (7) | 100 (14) / 100 (10) / 100 (6) | 100 (4) / 100 (2) / 100 (0) | 100 (14) / 100 (10) / 100 (6) | 100 (6) / 100 (11) / 100 (9) |
| leech-swarm | 100 (33) / 100 (26) / 100 (19) | 100 (36) / 100 (25) / 100 (19) | 100 (21) / 100 (15) / 100 (12) | 100 (29) / 100 (22) / 100 (19) | 100 (42) / 100 (36) / 100 (27) |
| causeway-mixed | 100 (46) / 100 (47) / 100 (37) | 100 (41) / 100 (29) / 100 (24) | 100 (12) / 100 (9) / 100 (6) | 100 (23) / 100 (14) / 100 (4) | 100 (42) / 100 (42) / 100 (38) |
| causeway-deep | 100 (50) / 100 (46) / 100 (45) | 100 (52) / 100 (47) / 100 (40) | 100 (42) / 100 (33) / 100 (18) | 100 (45) / 100 (29) / 100 (14) | 100 (43) / 100 (42) / 100 (43) |
| Colossus | 0 (100) / 39 (93) / 100 (52) | 1 (100) / 100 (52) / 100 (44) | 16 (98) / 100 (47) / 100 (45) | 97 (53) / 100 (47) / 100 (41) | 0 (100) / 60 (69) / 100 (43) |

Blind (no telegraph or interrupt rows), mean HP lost % and Colossus wins %, prepared tier, against the same cell with rules: Ranger causeway-mixed 20 against 9, causeway-deep 41 against 33, bulwark 2 against 2, Colossus 90% wins and 73 lost against 100% and 47; Mage mixed 30 against 14, deep 51 against 29, bulwark 10 against 10, Colossus 100% and 52 against 100% and 47; Cleric mixed 44 against 42, deep 43 against 42, bulwark 14 against 11, Colossus 32% and 85 against 60% and 69; Warrior Colossus 10% against 39%; Assassin changes by 0-1 points except the arrived Colossus (6% against 1%).

Against the targets:

- Regular fights, prepared tier, at least 95% wins: met everywhere (every regular and mixed cell is 100%, including the 3-Leech swarm).
- Mixed fights, prepared tier, 15-35% HP lost: only the Assassin is inside the band (causeway-mixed 29, deep 47 is above). Warrior (47, 46) and Cleric (42, 42) lose too much HP. Ranger (9, 33) and Mage (14, 29) lose too little in causeway-mixed (Mage deep is inside the band).
- Colossus, prepared tier, 40-85% wins: only the Cleric (60) is inside; the Warrior is just below at 39 (38 at seed 2), above the floor of 30 that Warrior and Cleric need. Assassin, Ranger and Mage win 100%, above the band. Over-levelled, at least 85%: met by every class. Just arrived: Warrior 0, Assassin 1, Ranger 16, Mage 97, Cleric 0.
- Interrupt rules against blind, a difference of at least 8 HP points for Ranger, Mage and Cleric: met in causeway-mixed for Ranger (+11) and Mage (+16), in causeway-deep for Mage (+22), and in the Colossus for Ranger (+26) and Cleric (+16). Ranger causeway-deep sits on the edge (+8). Not met: Cleric in every regular fight (+1 to +3), Ranger and Mage against the Bulwark alone (0).
- Reading for the tuning step: the Colossus is a wall for the Warrior and Cleric at the arrived tier and a soft target for Assassin, Ranger and Mage once prepared; the regulars are easy for ranged heroes and heavy on HP for Warrior and Cleric. The Bulwark's Undertow barely matters on its own (the hero's ordinary hits already clear most of the 25% interrupt over the wind-up).

Tuning (2026-11-08, Step 13.1 part 8). Two numbers changed, both on the Tidebound Colossus: Power 31 to 35, and the Leech summon at 35% HP instead of 50% (the 2-second telegraph and the two level-18 Leeches stay). Nothing else moved: Colossus HP 3,600, Breaker Wave (230%, 2.5 s, interrupt 8%, cooldown 10 s), the Tide cycle, and the Bulwark, Raider and Leech numbers are as proposed. The golden duel-basic snapshot is unchanged.

- What was tried (prepared tier, 60 runs, seed 1, win % per class Warrior/Assassin/Ranger/Mage/Cleric). Before: 38/100/100/100/63. HP 4,200: 0/93/100/100/18. Power 36: 2/90/97/100/7. HP 4,200 and Power 28: 13/100/100/100/70. Breaker Wave interrupt 12%, 20% or 30%, or cooldown 8 s: no change for any class (the wave is not what beats the Warrior and Cleric). Summon at 70% HP: Warrior 0, Cleric 2 (the Leeches are what beats them). Summon at 35%: 83/98/100/100/97; with Power 33: 65/98/98/100/95; Power 34: 45/95/98/100/85; Power 35: 37/92/100/100/77; Power 40: 5/60/87/100/47. The Mage stays at 100% with about 48% HP lost even at Power 40 (the Ranger at 87%): no allowed lever lowers the Mage without walling the Warrior and Cleric.
- Mixed fights: Bulwark HP x0.75-0.8 lowers the Warrior's causeway-mixed loss from 46 to 40-41 and the Mage's from 13 to 10; Bulwark Power x0.8-1.25, Raider Power x1.25, Leech HP and Power x1.25 and Undertow interrupt 15% or 30% move every class by 0-3 points. The Warrior and Cleric loss and the Ranger and Mage loss are driven by how fast each kills a high-Armor Bulwark, so no lever closes both gaps; the Bulwark, Raider and Leech numbers were left as proposed.

Final measurements (seeds 1, 2, 3 at 100 runs, `npm run sim -- --matrix causeway`; the three seeds agree within about 8 points). Prepared tier, Colossus win % (HP lost %), mean of 3 seeds, before (seeds 1-2) / after:

| Class | Before | After | Band |
| --- | --- | --- | --- |
| Warrior | 39 (93) | 37 (92) | at least 30: met |
| Assassin | 100 (52) | 94 (69) | 40-85: above |
| Ranger | 100 (47) | 98 (54) | 40-85: above |
| Mage | 100 (47) | 100 (48) | 40-85: above |
| Cleric | 60 (69) | 83 (56) | 40-85: met |

- Colossus over-levelled: 100% for every class (met, at least 85%). Just arrived: Warrior 0, Assassin 0-1, Ranger 2-3, Mage 99-100, Cleric 0.
- Regular fights, prepared tier: 100% wins in every cell for every class and seed (met, at least 95%).
- Mixed fights, prepared tier, HP lost causeway-mixed / causeway-deep (unchanged by this tuning): Warrior 47 / 46, Assassin 29 / 46, Ranger 9 / 31, Mage 14 / 30, Cleric 42 / 42. In the 15-35% band: Assassin mixed, Ranger and Mage deep. Not met: Warrior and Cleric (too much), Ranger and Mage mixed (too little), Assassin deep (47).
- Interrupt rules against blind (HP points lost, prepared): Ranger causeway-mixed +8 to +11, deep +8 to +9, Colossus +33 to +35; Mage mixed +16, deep +19 to +22; Cleric Colossus +12 to +17 and wins 83 against 59 (the Cleric's mixed and deep fights differ by only 1 to 2 points: not met there). Not met: Ranger and Mage against the Bulwark alone (0).
- Not met after tuning, reported honestly: Assassin (94), Ranger (98) and Mage (100) Colossus prepared stay above 85%; Warrior and Cleric mixed-fight HP loss stays above 35%; Ranger and Mage causeway-mixed stay below 15%. No class-specific lever exists in the allowed set, and raising Power or HP further walls the Warrior (4,200 HP gives 0%, and Power 40 gives 5%).
- Warden with a fourth tier `causeway` (Causeway-geared: level 22, 8 nodes, quality 112%, Siphoning on the weapon, Vicious and Quick accessories, a healer also wears Hallowed on the off-hand and one accessory; an item carries one modifier, so Rending cannot share the weapon with Siphoning), `npm run sim -- --matrix warden --seed 1 --runs 100`: Warrior 0% (lost 100), Assassin 100% (47), Ranger 100% (46), Mage 100% (41), Cleric 0% (100, Warden left 62%). The first three tiers' rows are produced by the unchanged code. Compared with the over-levelled tier (level 24): Assassin 100% (53), Ranger 99% (49), Mage 100% (49), Warrior and Cleric 0%. So Causeway gear at level 22 does what level-24 gear did for the three damage classes; the Warrior and Cleric wall stays.
- Reference matrix (`--matrix reference`, seed 1, 100 runs): the tracked CSV is byte-identical. Telegraph and built matrices run and match the earlier numbers within seed noise (telegraph seed 1, 40 runs: Cleric Thornbeast 18 / 34; built: Rootmaw, Echo Knight rows as before). Note: the Warden numbers recorded earlier for the prepared tier (Ranger 26, Mage 77) are older than the rows now measured (Ranger 35, Mage 98) and are not caused by this part (no Warden code path changed); they were not re-investigated.
- Offline-style expeditions (reference heroes, level 19, 40 seeds, defeat % of runs with at least one defeat), `sunken-causeway`: Warrior 0, Assassin 5, Ranger 10, Mage 5, Cleric 0 (before tuning 0 / 3 / 13 / 5 / 0). Same method for the baselines: Grove 8 / 38 / 28 / 8 / 0, Bastion 0 / 18 / 15 / 5 / 0. The Causeway is no harsher than the Grove or Bastion. `npm run sim -- --expedition sunken-causeway --seed 1..5` (Warrior only): all five seeds win five fights and retreat in `causeway-mixed` with no defeat.
- XP: from the real formula (`xpFromEnemies`, enemy XP from the combat state, level-18 hero, Spirit 9-21), a causeway-mixed win gives 96-98 XP and a level costs 3,818 XP at level 18, so 39 to 40 fights per level (the design estimated 87 XP and 44). causeway-deep gives 147-149 XP (26 per level), a raider 42 (91), a leech-swarm 33 (116). The estimate in "XP intent" is updated below.

### Grove and Bastion materials

Decided 2026-11-08 (user approved), Step 13.2. Today no enemy in the Withered Grove or the Fallen Bastion drops a material. Each zone gets its own material in the middle tier, copying the riftglass pattern (Step 13.1). Resource nodes, brewing, modifier recipes and Salvage are unchanged.

| Material | Sell | Craft quality | Upgrade | Upgrade cost | Safe-pouch rank (rarest last) |
| --- | --- | --- | --- | --- | --- |
| witherbark (Grove) | 4 | 99% to 109% | +2 points, cap 110% | 2 units (other materials 3) | after shard |
| oathsteel (Bastion) | 4 | 101% to 111% | +2 points, cap 111% | 3 | after witherbark, before riftglass |

`MATERIAL_RARITY` becomes scrap, hide, shard, witherbark, oathsteel, riftglass. Material ids stay raw ids, as riftglass does. They are not brewing inputs. The craft quality roll, proficiency bonus and range maximum work as for the other materials.

Drops (the quantity rules of §9 apply, momentum bonus included):

| Enemy | Zone | Drop |
| --- | --- | --- |
| Thornbeast | Grove | 4 hide |
| Blight Spider | Grove | 2 witherbark |
| Rootmaw Stalker | Grove elite | 8 witherbark |
| Hollow Sentry | Bastion | 4 shard |
| Fallen Arbalist | Bastion | 2 oathsteel |
| Echo Knight | Bastion elite | 8 oathsteel |

None of these six drops anything today. Fracture Wisp, Oathbound Echo, summons and the Fractured Warden still drop nothing.

Pass-through rule (Q1, option A): every route plays the Road's 3 fixed fights first, and they drop 20 units, which fills the bag (20, 22 from level 10) so the zone's own loot would be lost. Fights at a node that is not the route's last node therefore drop gold but no materials. A Road-only run (the Road is the last node) is unchanged. On the Fracture Gate routes, the Grove or Bastion fights and the Road fights are all pass-through; only the Gate's own fights are the last node.

Measured 2026-11-08 (Step 13.2 part 5). Reference Warrior at level 22, no retreat threshold, seed 1 (the loot is the same for seeds 1-3 and for Ranger, because drops do not depend on the fight's result). Cumulative units held after fight N (hide h, shard s, witherbark w, oathsteel o, riftglass r):

| Route | Fight 3 (end of Road) | 4 | 5 | 6 | Bag (20) full |
| --- | --- | --- | --- | --- | --- |
| withered-grove | 0 | 7 (h5 w2) | 17 (h5 w12) | 20 (h8 w12) | after fight 6, the 3rd fight in the Grove (Rootmaw Stalker is fight 5) |
| fallen-bastion | 0 | 7 (s5 o2) | 17 (s5 o12) | 20 (s8 o12) | after fight 6 |
| sunken-causeway | 0 | 6 (h6) | 11 (h6 s5) | 16 (h6 s5 r5) | not reached before the Colossus (fight 7, the reference Warrior is defeated and the pouch keeps 5 riftglass) |

Before this step the Road's three fights alone put 20 units in the bag (the intro rule above), so on every longer route the zone's own loot was lost. A Causeway run holds 5 riftglass at fight 6 and a Grove or Bastion run about 12 units of the zone material by the elite. No earlier Causeway loot number was recorded in this document, so none needed re-measuring. `npm run sim -- --expedition <route> --seed 1..3` (the level-5-style reference hero with a 40% retreat) stops at the first retreat and secured `hide 5 witherbark 2` (Grove seeds 3), `shard 5 oathsteel 2` (Bastion seeds 1-3), `hide 6 scrap 5` (Causeway seeds 1-3, retreat before riftglass); the Grove seeds 1-2 retreated in the first Grove fight and secured nothing.

### Third zone: Rift Hollows

Decided 2026-11-08 (user approved), Step 13.4. One new zone and one elite, no boss, copying the Causeway pattern (Step 13.1) with one new material (duskiron). Content only: it reuses the telegraph skills, the Ward Echo heal, Bleed, `maxHpBonus`, equipment Healing Power and `lifestealFraction`; no sim change. Warrior and Cleric must not be walled, so there is no Tank archetype, no regeneration and no HP-summon adds; the danger is burst.

World:

- Node Rift Hollows, levels 22-28, reached by a leg from the Splintered Road (20 seconds), not through the Causeway. Resource node Dusk Vein gives 3 duskiron per visit (display only, like the other resource nodes).
- Gate: the Tidebound Colossus defeated (personal to the hero; the Warden is not required). The gate message reads "Defeat Tidebound Colossus first."
- Route `rift-hollows`: Greyhaven, Splintered Road, Rift Hollows. Fixed fights in order: `shade-pair` (2 Rift Shades, level 22), `brute` (one Riftborn Brute, level 23), `hollows-mixed` (Brute and Hollow Channeler, level 23), then the elite fight. Drawn fights after the fixed ones: `hollows-mixed`, `hollows-deep` (Rift Shade level 25, Riftborn Brute level 25, Hollow Channeler level 25), `shade-pair`.
- Pass-through rule (Step 13.2): only the Hollows' own fights drop materials; the Road's fights drop gold only.

Regular enemies (a Standard enemy at level 24 has 560 HP and 32 Power):

| Enemy | Levels | Archetype | Skills | Drop |
| --- | --- | --- | --- | --- |
| Rift Shade | 22-26 | Skirmisher | Shade Cut: 100% Physical Power, 40% base chance to apply Bleed, 4 s cooldown | 3 shard |
| Hollow Channeler | 22-27 | Support | Heals an ally for 6% of its max HP, 10 s cooldown (like the Ward Echo's Mend). Rift Bolt: 90% Magical Power | 3 riftglass |
| Riftborn Brute | 23-28 | Burst | Rift Cleave: 1.8 s telegraph, 240% Physical Power, interruptible at 25% of max HP, 10 s cooldown | 3 duskiron |

Elite Hollowmaw Reaver:

- Level 26 Burst elite. 4,400 HP, 65 Power (Step 13.5 parts 5B and 8a; were 3,400 and 40, then 44), Consistency 25; the other stats come from the elite Burst line. Step 13.5 part 8a (final values): Power 65 (was 44) and a `timePressure` enrage from 90 s (§7 "Elite pressure").
- Rift Surge: 2.5 s telegraph, 400% Magical Power (Step 13.5 part 5B; was 300%), can critically hit, NOT interruptible, 9 s cooldown (12 s until Step 13.5 part 8a). A readied dodge (Fade Back) takes only 40% of it: 60% of the damage still lands, no statuses (2026-11-09, "Ranger Reaver half-dodge" in §7). Reaver Strike fills ordinary actions at 100% Physical Power.
- Uses the stance trait (10 seconds, guard and assault, as the Echo Knight and the Colossus). No summons.
- Drops 10 duskiron. Gold is the elite rate. Its first defeat by any hero records `defeated:hollowmaw-reaver` and unlocks Bloodbound.

Duskiron (new material): sells for 8 gold. A craft rolls quality 106% to 116% (average of two rolls, plus proficiency bonus, never above the range maximum). As an upgrade material it adds +4 points, up to 116%. It is last in `MATERIAL_RARITY` (the safe pouch keeps it first), after riftglass.

Modifiers (one modifier per item, two with a socket since Step 13.10; the stack cap is 2 across worn gear). A recipe costs 25 gold per level the modifier needs, except Bloodbound, whose 650 gold is set on the modifier (a level-24 recipe would be 600). Stalwart fits any armor piece, as Sturdy does:

| Modifier | Effect | Min level | Slots | Recipe | Unlock |
| --- | --- | --- | --- | --- | --- |
| Stalwart | +6% max HP | 22 | armor | 550 gold | Rift Hollows discovered |
| Devout | +12 Healing Power | 22 | off-hand, accessory | 550 gold | Rift Hollows discovered |
| Bloodbound | Heals 5% of damage dealt after mitigation (`lifestealFraction`) | 24 | weapon | 650 gold | Hollowmaw Reaver defeated by any hero |

Contracts and Legacy: the Salvage contract becomes zone-aware. A duskiron Salvage is "bring home N duskiron", N from 5 to 10, reward `rewardFor(ceil(N / 3), 25, 'riftglass')`, then the usual roll; it is offered once the Hollows are discovered. Existing riftglass Salvage boards roll as before. The first defeat of the Hollowmaw Reaver gives 3 Legacy once (`elite:hollowmaw-reaver`).

Built in Step 13.4 part 7: Salvage is table-driven by the zone's resource material (`SALVAGE_BY_MATERIAL`): riftglass 6-12 at level 20 paying scrap, duskiron 5-10 at level 25 paying riftglass. A board offers a zone's Salvage only to a hero who can enter that zone, so a hero who has not beaten the Colossus never sees duskiron Salvage. Boards with only the Causeway discovered roll exactly as before.

Compatibility: no save version bump. Older saves load unchanged: the node is undiscovered and the material counts as 0.

Measurement targets (for the later tuning step; part 3 records numbers and changes nothing). Tiers: Arrived (level 22, 8 nodes, quality 112%, Siphoning, 3 Draughts), Prepared (level 24, quality 116%, plus Stalwart and Devout), Over-levelled (level 27).

- Regular fights, prepared tier: at least 95% wins for every class; the mixed fights lose 15-40% of maximum HP.
- Hollowmaw Reaver: prepared 40-85% wins (Warrior and Cleric at least 30%), over-levelled at least 85%.
- About 35-45 fights per level at level 24.

Measured 2026-11-08 (Step 13.4 part 3, `npm run sim -- --matrix hollows`, seeds 1-3 x 100 runs, mean over the three seeds, wins % / mean HP lost %; nothing tuned). Tiers: Arrived (level 22, 8 nodes, quality 112%, Siphoning on the weapon, 3 Draughts), Prepared (level 24, 8 nodes, 116%, Stalwart on head and chest, a Cleric adds Devout on the off-hand and one accessory, 3 Draughts and a Ward Charm), Over-levelled (level 27, 9 nodes, same gear). Stalwart and Devout were applied by the harness itself until part 6 defined them (same numbers; seed 1 re-run identical). Every cell is a 100% win, so only the HP lost differs:

| Class | Tier | shade | brute | channeler | shade-pair | hollows-mixed | hollows-deep | Reaver |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Warrior | Arrived | 12 | 10 | 6 | 28 | 24 | 44 | 46 |
| Warrior | Prepared | 8 | 6 | 5 | 22 | 17 | 45 | 47 |
| Warrior | Over | 6 | 2 | 4 | 15 | 10 | 34 | 46 |
| Assassin | Arrived | 8 | 12 | 4 | 24 | 23 | 43 | 43 |
| Assassin | Prepared | 7 | 9 | 3 | 19 | 18 | 43 | 41 |
| Assassin | Over | 5 | 4 | 2 | 14 | 14 | 39 | 35 |
| Ranger | Arrived | 8 | 0 | 1 | 19 | 15 | 40 | 31 |
| Ranger | Prepared | 5 | 0 | 1 | 14 | 11 | 33 | 20 |
| Ranger | Over | 4 | 0 | 1 | 11 | 10 | 28 | 15 |
| Mage | Arrived | 13 | 12 | 4 | 31 | 1 | 23 | 37 |
| Mage | Prepared | 10 | 7 | 3 | 25 | 0 | 15 | 32 |
| Mage | Over | 9 | 3 | 2 | 22 | 0 | 7 | 22 |
| Cleric | Arrived | 19 | 17 | 11 | 40 | 34 | 43 | 42 |
| Cleric | Prepared | 15 | 14 | 8 | 34 | 27 | 39 | 39 |
| Cleric | Over | 11 | 11 | 6 | 27 | 21 | 39 | 39 |

Blind runs (the same hero with its telegraph and interrupt rows removed) were also 100% wins in every cell of the Brute and the Reaver, and the HP lost is within a few points of the rules run (for example Ranger Reaver Arrived 45 blind against 31, Assassin Over 36 against 35, Warrior Brute Arrived 10 against 10).

Reading against the targets: regular fights meet the 95% win band at every tier. The mixed fights lose 15-40% only for some classes (Mage loses 0-1% in `hollows-mixed`, Ranger Brute 0%, below band; Warrior and Cleric lose 10-34%). The Reaver is far above its 40-85% band: every class wins 100% at every tier, losing 15-47% of its HP, so it needs hardening in part 8. The Brute's Rift Cleave is not dangerous enough to make interrupts matter (blind equals rules). No number was changed.

### Fourth zone: Cinder Scar

Decided 2026-11-09 (user approved), Step 13.6. One new zone and one elite, copying the Rift Hollows pattern (Step 13.4), with one new material (cinderite), the first Burn applications by enemies against heroes, and one new stat (magical status resistance from gear). Warrior and Cleric must not be walled.

World:

- Node Cinder Scar, levels 28-34, reached by a leg from the Splintered Road (20 seconds). Resource node Ember Seam gives 3 cinderite per visit (display only).
- Gate: the Hollowmaw Reaver defeated (personal to the hero). The gate message reads "Defeat Hollowmaw Reaver first."
- Route `cinder-scar`: Greyhaven, Splintered Road, Cinder Scar. Fixed fights in order: `imp-swarm` (3 Cinder Imps, level 28), `golem` (one Slag Golem, level 29), `cinder-mixed` (Golem and Pyre Acolyte, level 29), then the elite fight `emberwrought-tyrant`. Drawn fights after the fixed ones: `cinder-mixed`, `cinder-deep` (Imp, Golem and Acolyte, all level 31), `imp-swarm`.
- Map position {470, 290}; the map height grows from 300 to 330. The leg must not cross the Bastion or Hollows markers (checked in the browser).
- Pass-through rule (Step 13.2): only the Cinder Scar's own fights drop materials.

Regular enemies (framework stats: a Standard enemy at level 31 has 700 HP and 39 Power):

| Enemy | Levels | Archetype | Skills | Drop |
| --- | --- | --- | --- | --- |
| Cinder Imp | 28-32 | Swarm (groups of 3) | Ember Spit: 80% Magical Power, 60% base chance to apply Burn (coefficient 0.12, magical), 4 s cooldown | 2 duskiron |
| Slag Golem | 29-34 | Standard (not Tank) | Magma Slam: 2.0 s telegraph, 220% Physical Power, two Burn applications at 100% chance (coefficient 0.12), interruptible at 25% of max HP, 10 s cooldown | 4 cinderite |
| Pyre Acolyte | 28-33 | Support (0.5x Armor, 1.5x Resistance) | Kindle: ally barrier worth 100% of its Magical Power, 8 s cooldown (as the Echo Ward). Fire Bolt: 90% Magical Power and a 50% base chance to apply Burn | 3 cinderite |

Elite Emberwrought Tyrant (starting values; ranges are the tuning space):

- Level 32 Standard elite. 5,000 HP (range 4,600-5,400; tuned to 5,200 in part 9, then 5,400 on 2026-11-10), Power 55 (50-62; tuned to 50, then 68 on 2026-11-10, a user-approved deviation outside the planned range, see "Option A" below), Consistency 25, action time 2.2 s. No stance.
- Searing Brand: 110% Physical Power, 75% base chance to apply Burn (coefficient 0.15), 6 s cooldown. Pyre Wave: 2.5 s telegraph, 260% Magical Power, can critically hit, two Burn applications, interruptible at 5% of max HP (4-8%), 10 s cooldown.
- At 40% HP a 2 s telegraph summons 2 Cinder Imps (level 28) through the HP summon trait (as the Mire Leech summon).
- Late enrage `timePressure: eliteEnrage(120_000)` (start range 100-140 s; tuned to 100 s in part 9, unchanged since): the Warden per-stack numbers from Step 13.5 part 8a.
- Drops 10 cinderite. Gold is the elite rate. Its first defeat by any hero records `defeated:emberwrought-tyrant` and unlocks Kindled.

Cinderite (new material): sells for 10 gold. A craft rolls quality 110% to 120%. As an upgrade material it adds +5 points, up to 120%, cost 3. It is last in `MATERIAL_RARITY`, after duskiron.

Modifiers (one per item; the stack cap is 2 across worn gear):

| Modifier | Effect | Min level | Slots | Recipe | Unlock |
| --- | --- | --- | --- | --- | --- |
| Emberward | +10 magical status resistance (new field `magicalStatusResistanceBonus`; lowers the chance a magical status lands on the hero by 10 points) | 28 | armor, accessory | 700 gold | Cinder Scar discovered |
| Tempered | +6 points Armor and magical penetration (4 until Step 14.3), +2 points crit chance | 28 | weapon, accessory (weapon only until Step 14.3) | 700 gold | Cinder Scar discovered |
| Kindled | +5% max HP, +8 Healing Power | 30 | off-hand, accessory | 800 gold (`recipeGold`) | Emberwrought Tyrant defeated by any hero |

Supplies: a new default rule row `WARMING_TONIC_BURN_ROW` (use Warming Tonic when the hero has 3 or more Burn stacks) is placed after the Warming Tonic row in `DEFAULT_SUPPLY_ROWS`. Existing heroes receive it once through the hero update `warming-tonic-burn-rule`. No new supply.

Contracts and Legacy: the Salvage contract gains a cinderite entry: "bring home N cinderite", N from 5 to 10, contract level 31, reward paid in duskiron (`SALVAGE_BY_MATERIAL`), offered once the Cinder Scar is discovered. The first Tyrant defeat gives 3 Legacy once (`elite:emberwrought-tyrant`). No save version bump; older saves load with the node undiscovered and the material at 0.

Harness tiers (`--matrix cinder`; Prepared revised 2026-11-10, see "Option A" below): Arrived (level 28, 9 nodes, quality 116%, the Hollows prepared set plus Bloodbound on the weapon, so Bloodbound, Stalwart, Vicious and Quick with Nimble on hands and feet, 3 Draughts), Prepared (level 30, 10 nodes, 120%, the Arrived set with Emberward replacing Nimble on hands and feet, so Prepared is never weaker than Arrived; a Cleric adds Kindled on the off-hand and Devout on one accessory; 2 Draughts, 1 Warming Tonic and 1 Ward Charm), Over-levelled (level 33, 11 nodes, 120%, as Prepared). Tempered is in no tier. `BUILD_ORDER` gains two non-keystone nodes per class, appended so existing prefixes do not change: Warrior Shield Impact, Reckless Strike; Assassin Ambush, Fan of Knives; Ranger Efficient Quiver, Volley; Mage Quick Study, Defensive Preparation; Cleric Safeguard, Reciprocal Purpose. A `-notonic` variant of the Prepared tier swaps the Tonic for a Draught, and a `-noember` variant puts Nimble back on hands and feet (the Emberward check). Only the Cinder Scar tiers carry the Burn Tonic row (`burnRow`), so every earlier matrix keeps the rules it was measured with; a hero is limited to 12 rules, so the Assassin (Smoke Step is a sixth class row) gives up the Chill Tonic row, which never fires in the Cinder Scar.

Acceptance bands (mean of seeds 1-3 x 100 runs, rules mode):

- Regular fights, prepared: at least 95% wins for every class; `cinder-mixed` and `cinder-deep` lose 15-40% of maximum HP.
- Emberwrought Tyrant: prepared 40-85% (Warrior and Cleric at least 30%), over-levelled at least 85%, arrived at most 20%, crafted minus plain at most +30 points.
- Emberward check (replaces the Tonic-based Burn check on 2026-11-10; no allowed lever could meet that one): Prepared minus `prepared-noember` is at least +10 Tyrant win points for at least 3 classes.
- Telegraph check as in Step 13.5: rules minus blind at least +10 for classes that have an answer (the Cleric exception stands).
- About 35-45 fights per level at level 30. `--expedition cinder-scar` seeds 1-5 run cleanly; the defeat rate is recorded.
- Guards: the reference CSV and the earlier matrices stay byte-identical apart from new rows.
Tuning knobs: the Tyrant ranges above; only if needed the Golem and Imp Burn coefficients (0.10-0.15). If the bands cannot be reached, stop and report; do not loosen them.

Measured 2026-11-09 (Step 13.6 part 3, `npm run sim -- --matrix cinder` and `--matrix elites --elites tyrant`, seeds 1-3 x 100 runs, mean over the three seeds; nothing tuned). Tiers as decided above, with these harness notes: Tempered and Kindled were applied by the harness itself until part 6 defined them (same numbers); Emberward had no stat yet, so it counted as nothing and the Burn resistance is not in these numbers; the default supply rules have no Burn row yet (part 7), so the Warming Tonic fires only on its existing rule. The Prepared tier replaces the Arrived tier's Bloodbound and Stalwart with Tempered and Emberward, so it carries less life steal and max HP than Arrived. Tyrant wins % (rules / blind):

| Class | Arrived | Prepared | Over | Prepared no Tonic |
| --- | --- | --- | --- | --- |
| Warrior | 7 / 11 | 1 / 3 | 15 / 34 | 1 / 8 |
| Assassin | 55 / 55 | 23 / 19 | 62 / 69 | 38 / 41 |
| Ranger | 53 / 4 | 7 / 0 | 47 / 28 | 21 / 3 |
| Mage | 78 / 72 | 19 / 20 | 59 / 64 | 44 / 47 |
| Cleric | 70 / 94 | 63 / 62 | 100 / 98 | 79 / 85 |

Regular fights, prepared tier (wins % / mean HP lost %):

| Class | imp | golem | acolyte | imp-swarm | cinder-mixed | cinder-deep |
| --- | --- | --- | --- | --- | --- | --- |
| Warrior | 100 / 6 | 100 / 13 | 100 / 8 | 100 / 35 | 100 / 25 | 100 / 46 |
| Assassin | 100 / 5 | 100 / 3 | 100 / 6 | 100 / 29 | 100 / 30 | 100 / 45 |
| Ranger | 100 / 0 | 100 / 2 | 100 / 2 | 100 / 17 | 100 / 11 | 100 / 29 |
| Mage | 100 / 5 | 100 / 4 | 100 / 7 | 100 / 21 | 100 / 11 | 100 / 29 |
| Cleric | 100 / 7 | 100 / 23 | 100 / 11 | 100 / 35 | 100 / 39 | 100 / 41 |


Reading against the bands: regular fights meet the 95% win band for every class and tier (all 100%). The mixed fights lose 15-40% of maximum HP only for some classes at prepared (Assassin 30 and 45, Warrior 25 and 46, Cleric 39 and 41; Ranger 11 and 29 and Mage 11 and 29 are low in cinder-mixed, and cinder-deep is above 40 for Warrior and Assassin). The Tyrant is far from the bands in the other direction for several classes: the Warrior is at 1-15% (prepared band 40-85, Warrior at least 30), the Cleric is at or above band at over (100) and prepared 63, and arrived is far above 20 for Assassin, Ranger, Mage and Cleric (55, 53, 78 and 70). The Prepared tier is weaker than Arrived against the Tyrant for every class but the Cleric, because it carries no Bloodbound or Stalwart. The no-Tonic variant wins more than Prepared at the Tyrant (Assassin 38 against 23, Mage 44 against 19, Cleric 79 against 63), because the Tonic takes the place of a Draught and the existing rule rarely uses it well; the Burn check (prepared minus no-Tonic of at least +10) is not met by any class, and needs the Burn row (part 7) and Emberward (part 6) first. Blind equals rules within seed noise except Ranger (arrived 53 against 4) and Warrior over (15 against 34). Part 9 tunes.

Tuned and re-measured 2026-11-09 (Step 13.6 part 9; `--matrix cinder` and `--matrix elites --elites tyrant`, seeds 1-3 x 100 runs, rules mode unless stated, mean of the three seeds). Tyrant values after the sweep (all inside the decided ranges): 5,200 HP (from 5,000), Power 50 (from 55), enrage start 100 s (from 120 s), Pyre Wave interrupt 5% (unchanged, 4% and 8% were swept), Burn coefficients unchanged (Imp and Golem 0.12 were swept at 0.10 and 0.15). The sweep (seed 1, 100 runs, prepared wins % for Warrior / Assassin / Ranger / Mage / Cleric):

| HP / Power / enrage / interrupt | Prepared W / A / R / M / C | Arrived W / A / R / M / C |
| --- | --- | --- |
| 4,600 / 50 / 120 s / 5% | 73 / 90 / 70 / 95 / 100 | 46 / 91 / 76 / 99 / 99 |
| 4,600 / 55 / 120 s / 5% | 41 / 77 / 45 / 91 / 99 | 15 / 74 / 50 / 92 / 93 |
| 5,000 / 55 / 120 s / 5% (start) | 24 / 57 / 34 / 70 / 99 | 8 / 55 / 55 / 83 / 73 |
| 5,400 / 50 / 120 s / 5% | 35 / 64 / 41 / 79 / 97 | 11 / 63 / 61 / 86 / 65 |
| 5,400 / 62 / 120 s / 5% | 2 / 18 / 6 / 15 / 48 | 1 / 18 / 11 / 17 / 9 |
| 5,000 / 55 / 120 s / interrupt 4% | 32 / 74 / 40 / 80 / 99 | 12 / 74 / 58 / 92 / 73 |
| 5,000 / 55 / 120 s / interrupt 8% | 18 / 28 / 26 / 37 / 98 | 7 / 21 / 40 / 54 / 72 |
| 5,400 / 50 / 100 s / 5% | 35 / 64 / 41 / 79 / 54 | 11 / 63 / 61 / 86 / 15 |
| 5,200 / 50 / 100 s / 5% (chosen, seeds 1-3) | 44 / 66 / 41 / 86 / 75 | 18 / 66 / 66 / 93 / 22 |

The enrage start is the only lever that separates the Cleric (its fights run 100-140 s) from the other classes: at 120 s the Cleric wins 84-100% prepared unless HP and Power are both near the top (5,400 / 62: 48), and at 100 s it falls to 54-89%. Power 62 walls the Warrior and Ranger (2-20% prepared) at every HP; Power 50 with HP 4,600 is too easy (Warrior 73, Mage 95, Cleric 100). The Burn coefficients barely move anything: a Burn tick is about 3-8 HP against 4,000-5,000 maximum, and the Emberward (+20 magical status resistance counted) plus Spirit cut the Burn chance on a prepared hero to about 0.3-0.5 (Imp 60% base), so a prepared hero takes 8-29 Burn HP per cinder-deep fight and 110-360 per Tyrant fight (an arrived hero 15-81 and 280-920).

Final numbers (seeds 1-3 x 100, Tyrant wins %, rules / blind; the seed spread is the largest difference between the three seeds, rules):

| Class | Arrived | Prepared | Over | Prepared crafted | Spread (prepared) |
| --- | --- | --- | --- | --- | --- |
| Warrior | 18 / 26 | 44 / 29 | 93 / 90 | 80 / 66 | 15 |
| Assassin | 66 / 66 | 66 / 56 | 97 / 97 | 92 / 85 | 10 |
| Ranger | 66 / 5 | 41 / 9 | 96 / 79 | 71 / 47 | 13 |
| Mage | 93 / 92 | 86 / 83 | 98 / 98 | 96 / 97 | 8 |
| Cleric | 22 / 75 | 75 / 97 | 100 / 100 | 90 / 98 | 13 |

Regular fights, prepared tier (wins % / mean HP lost %): all 100% for every class.

| Class | imp | golem | acolyte | imp-swarm | cinder-mixed | cinder-deep |
| --- | --- | --- | --- | --- | --- | --- |
| Warrior | 100 / 6 | 100 / 12 | 100 / 7 | 100 / 31 | 100 / 22 | 100 / 42 |
| Assassin | 100 / 4 | 100 / 3 | 100 / 6 | 100 / 25 | 100 / 26 | 100 / 40 |
| Ranger | 100 / 0 | 100 / 2 | 100 / 2 | 100 / 16 | 100 / 10 | 100 / 27 |
| Mage | 100 / 5 | 100 / 4 | 100 / 6 | 100 / 19 | 100 / 6 | 100 / 20 |
| Cleric | 100 / 7 | 100 / 22 | 100 / 10 | 100 / 33 | 100 / 35 | 100 / 41 |

Checks (prepared tier):

| Class | Crafted minus plain (Tyrant wins) | Prepared minus no-Tonic, Tyrant wins | Prepared minus no-Tonic, cinder-deep HP lost saved | Rules minus blind, Tyrant wins | Rules minus blind, Golem HP lost saved |
| --- | --- | --- | --- | --- | --- |
| Warrior | +36 | -9 | +3 | +15 | +1 |
| Assassin | +26 | -16 | +4 | +10 | 0 |
| Ranger | +30 | -13 | 0 | +32 | 0 |
| Mage | +10 | -7 | +4 | +3 | +15 |
| Cleric | +15 | -2 | 0 | -22 | 0 |

Against the bands:

- Met: regular fights 100% wins for every class (band 95%); Tyrant over-levelled 93-100% (band 85% or more); Tyrant prepared in 40-85% for the Warrior (44, at least 30), Assassin (66), Ranger (41) and Cleric (75, at least 30); crafted minus plain at most +30 for the Assassin, Ranger (+30), Mage and Cleric; rules minus blind at least +10 at the Tyrant for the Warrior (+15), Assassin (+10) and Ranger (+32); the Cleric exception stands (-22: the Cleric does better blind, as at the Colossus and Reaver); `--expedition cinder-scar` seeds 1-5 (level-5 reference Warrior, 40% retreat): 0 defeats, every run retreats in the Imp swarm or the Golem, nothing to compare for the Tyrant.
- Not met, and not reachable inside the decided ranges: (1) Tyrant arrived at most 20%: Assassin 66, Ranger 66 and Mage 93 (Warrior 18 met, Cleric 22 misses by 2). The Arrived tier is not weaker than the Prepared tier for these three classes (Bloodbound life steal and Stalwart HP against Tempered and Emberward), so any change that lowers Arrived lowers Prepared by the same amount; the 8% interrupt sweep separates them for the Assassin (arrived 21, prepared 28) only by dropping every Prepared cell except the Cleric's to 26-37. (2) Tyrant prepared Mage 86 (1 over; Ranger 41 sits at the bottom of its band at the same setting, so the two trade off). (3) Crafted minus plain for the Warrior +36 (the Greater Draught raises a class that is a few hits short). (4) Burn check: prepared minus no-Tonic is negative at the Tyrant for every class (-2 to -16) and saves 0 to 4 HP points in cinder-deep (band 8 points): the Tonic takes the place of a Healing Draught and Burn is too weak to repay it. Only the Imp and Golem Burn coefficients (0.10-0.15) were allowed; they change cinder-deep HP by at most 2 points. (5) Telegraph check at the Tyrant for the Mage (+3), and the Golem is a 100% win for every class with and without telegraph rules (the Mage saves 15 HP points with them, the other classes 0 to 1). (6) Mixed-fight HP lost outside 15-40%: cinder-mixed Ranger 10 and Mage 6 (too little); cinder-deep Warrior 42 and Cleric 41 (just over; Assassin 40 on the edge). (7) XP: the framework enemy XP gives a level-30 hero 92 XP for cinder-mixed (89 fights per level; a level costs 8,216 XP), 156 for cinder-deep (53 per level), 37 for imp-swarm (222), 72 for a Golem (114), 234 for the Tyrant (35); the 35-45 fights per level band is met only by the Tyrant, and no lever was allowed. (8) Seed spread up to 15 points in the mid-band cells. No band was loosened.
- Guards: `--matrix reference` (seed 1, 100 runs; the tracked CSV is byte-identical), `--matrix warden`, `causeway`, `hollows`, `built` and `telegraph` (seed 1, 100 runs) are byte-identical to the baseline captured before the first sim edit (the timing line aside); `--matrix elites` is identical apart from the new Tyrant rows.

Option A, decided 2026-11-10 (user approved all defaults; Step 13.6 part 10). Root cause of the band misses: the part-3 Prepared tier swapped Bloodbound and Stalwart for Tempered and Emberward, which made Prepared weaker than Arrived, so nothing could lower Arrived without also lowering Prepared. The part-9 tables above are superseded by the numbers below. Changes:

- Tiers: Arrived unchanged. Prepared and Over-levelled are the Arrived set with Emberward on hands and feet in place of Nimble (Bloodbound, Stalwart, Vicious and Quick kept). The Cleric adds Kindled on the off-hand and Devout on one accessory. Levels, nodes, quality and supplies unchanged. Tempered is in no tier. New variant `prepared-noember` (Nimble back on hands and feet).
- Emberwrought Tyrant: 5,400 HP (from 5,200; top of the 4,600-5,400 range), Power 68 (from 50). Power 68 is outside the planned 50-62 range: a user-approved deviation, with the Hollowmaw Reaver (Power 65) as precedent. It is needed because Prepared now carries Bloodbound and Stalwart. Enrage start 100 s and the 5% Pyre Wave interrupt unchanged.
- XP (enemy `xpMultiplier` overrides): Cinder Imp 0.88 (0.4 swarm x 2.2; an override replaces the swarm's 0.4), Slag Golem 2.2, Pyre Acolyte 2.2, Tyrant 1 (unchanged). A level-30 hero needs about 40-41 `cinder-mixed` fights per level (band 35-45) and about 35 Tyrant fights.

Measured 2026-11-10 (Option A; `--matrix cinder` and `--matrix elites --elites tyrant`, seeds 1-3 x 100 runs, mean of the three seeds, rules mode unless stated). Tyrant wins % (rules / blind):

| Class | Arrived | Prepared | Over | Prepared crafted | Prepared no Emberward | Prepared no Tonic | Spread (prepared) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Warrior | 0 / 0 | 35 / 19 | 89 / 80 | 61 / 52 | 5 / 6 | 38 / 30 | 13 |
| Assassin | 6 / 6 | 75 / 69 | 95 / 98 | 85 / 86 | 42 / 41 | 80 / 77 | 11 |
| Ranger | 4 / 0 | 59 / 23 | 96 / 79 | 83 / 47 | 44 / 15 | 68 / 34 | 2 |
| Mage | 3 / 4 | 74 / 74 | 97 / 99 | 88 / 89 | 31 / 33 | 78 / 81 | 4 |
| Cleric | 0 / 3 | 43 / 85 | 100 / 100 | 58 / 90 | 16 / 47 | 50 / 91 | 20 |

Regular fights, prepared tier (wins % / mean HP lost %): all 100% wins for every class, tier and fight.

| Class | imp | golem | acolyte | imp-swarm | cinder-mixed | cinder-deep |
| --- | --- | --- | --- | --- | --- | --- |
| Warrior | 100 / 3 | 100 / 6 | 100 / 3 | 100 / 22 | 100 / 11 | 100 / 28 |
| Assassin | 100 / 2 | 100 / 2 | 100 / 2 | 100 / 14 | 100 / 16 | 100 / 23 |
| Ranger | 100 / 0 | 100 / 2 | 100 / 1 | 100 / 9 | 100 / 4 | 100 / 14 |
| Mage | 100 / 1 | 100 / 0 | 100 / 2 | 100 / 10 | 100 / 3 | 100 / 9 |
| Cleric | 100 / 3 | 100 / 15 | 100 / 6 | 100 / 23 | 100 / 24 | 100 / 34 |

Checks (prepared tier):

| Class | Emberward check: prepared minus no-Emberward, Tyrant wins | Crafted minus plain, Tyrant wins | Rules minus blind, Tyrant wins | Prepared minus no-Tonic, Tyrant wins |
| --- | --- | --- | --- | --- |
| Warrior | +30 | +26 | +16 | -3 |
| Assassin | +33 | +10 | +6 | -5 |
| Ranger | +15 | +24 | +37 | -8 |
| Mage | +43 | +14 | 0 | -4 |
| Cleric | +27 | +15 | -42 | -8 |

Against the bands: met are regular fights 100% wins (band 95%); Tyrant arrived at most 20% (0-6 for every class); prepared 40-85% for Assassin 75, Ranger 59, Mage 74 and Cleric 43, and the Warrior at 35 (the Warrior and Cleric band is at least 30); over-levelled at least 85% (89-100); crafted minus plain at most +30 (+10 to +26); the Emberward check (5 of 5 classes at +15 or more, band 3 of 5 at +10); XP about 40-41 `cinder-mixed` fights per level at level 30 (band 35-45).

Accepted deviations (no lever left, no band loosened further): (1) The Mage telegraph difference at the Tyrant is 0 (rules 74, blind 74) and the Assassin's is +6 (band +10): the Mage is an exception like the Cleric (the Cleric does better blind, -42, as at the Colossus and Reaver). The Warrior (+16) and Ranger (+37) meet it. (2) Mixed-fight HP lost: 5 of 10 cells are inside 15-40% (cinder-mixed Assassin 16 and Cleric 24; cinder-deep Warrior 28, Assassin 23 and Cleric 34); Warrior 11, Ranger 4 and Mage 3 in `cinder-mixed`, and Ranger 14 and Mage 9 in `cinder-deep`, are under. (3) The Warming Tonic is close to obsolete in the Scar: prepared minus no-Tonic is -3 to -8 Tyrant wins, because the Tonic takes the place of a Healing Draught and Burn is cheap once Emberward is worn. A Burn immunity on the Tonic needs a new sim effect and is a follow-up (resolved in Step 14.3). (4) Tempered looks like a trap pick against Bloodbound on the weapon slot (it is now in no tier); flagged for later (resolved in Step 14.3). (5) Seed spread up to 20 points (Cleric prepared).

Guards: `--matrix reference` (the tracked CSV), `warden`, `causeway`, `hollows`, `built` and `telegraph` (seed 1, 100 runs) are byte-identical to the baseline captured before the edits (the timing line aside); `--matrix elites` is identical apart from the Tyrant rows.

### Fifth zone: Bloodthorn Barrens

Decided 2026-11-24 (user approved: one more Frontier zone first), Step 14.5. One zone, one elite (the Briar Matriarch), enemies that put Bleed and Poison on heroes so Staunch (physical status resistance, Step 14.3) matters, and one new material (bloodstone). No sim mechanic changes: it reuses `applyStatus` with `power: 'physical'`, telegraphs, the HP summon trait, `eliteEnrage` and the ally barrier skill. All numbers below are proposals; the measurement gates decide them.

World:

- Node Bloodthorn Barrens, levels 34-40, reached by a leg from the Splintered Road (same travel time as the other legs). Resource node Bloodstone Outcrop gives 3 bloodstone per visit (display only). Map position {430, 205}; the map height stays 330.
- Gate: the Emberwrought Tyrant defeated (personal to the hero, Remembered Paths apply). The gate message reads "Defeat Emberwrought Tyrant first."
- Route `bloodthorn-barrens` "Road to the Bloodthorn Barrens": Greyhaven, Splintered Road, Bloodthorn Barrens. Fixed fights in order: `stalker-pair` (2 Barbed Stalkers, level 34), `crawler` (one Venomhide Crawler, level 35), `barrens-mixed` (Crawler and Thornwitch, level 35), then the elite fight `briar-matriarch`. Drawn fights after the fixed ones: `barrens-mixed`, `barrens-deep` (Stalker, Crawler and Thornwitch, all level 37), `stalker-pair`.
- Pass-through rule (Step 13.2): only the Barrens' own fights drop materials.

Regular enemies (framework: a Standard level-37 enemy has 820 HP, 45 Power and 79 Armor and Resistance; Bleed and Poison coefficient 0.12 for regulars, 0.15 for the elite, range 0.10-0.18):

| Enemy | Levels | Archetype | Skills | Drop |
| --- | --- | --- | --- | --- |
| Barbed Stalker | 34-38 | Skirmisher (pairs) | Serrated Rake: 90% Physical Power, 60% base chance to apply Bleed (physical), 4 s cooldown | 2 cinderite |
| Venomhide Crawler | 35-40 | Standard | Caustic Spray: 2.0 s telegraph, 200% Physical Power, two Poison applications at 100% chance (physical), interruptible at 25% of max HP, 10 s cooldown | 4 bloodstone |
| Thornwitch | 34-39 | Support (1.5x Armor, 0.5x Resistance: the Pyre Acolyte inverted) | Bramble Ward: ally barrier worth 100% of its Magical Power, 8 s cooldown, targets the ally with the lowest barrier (a copy of Kindle). Thorn Lash: 90% Physical Power, 50% base chance to apply Bleed, no cooldown | 3 bloodstone |

Elite Briar Matriarch (starting values; ranges are the tuning space):

- Level 38 Standard elite. 6,300 HP (range 5,800-6,800), Power 78 (72-84), Consistency 25, action time 2.2 s. No stance.
- Hemorrhage Lash: 110% Physical Power, 75% base chance to apply Bleed (coefficient 0.15), 6 s cooldown. Venom Burst: 2.5 s telegraph, 260% Physical Power, can critically hit, two Poison applications at 100% (0.15), interruptible at 5% of max HP (4-8%), 10 s cooldown.
- At 40% HP a 2 s telegraph summons 2 Barbed Stalkers (level 34) through the HP summon trait (fallback 50% if over-levelled is under 85%).
- Late enrage `eliteEnrage(100_000)` (start range 90-120 s): the Warden per-stack numbers from Step 13.5 part 8a.
- Drops 10 bloodstone. Gold is the elite rate. Its first defeat records `defeated:briar-matriarch` and unlocks Swift. XP multiplier 1.

Bloodstone (new material): sells for 12 gold, not buyable. A craft rolls quality 114% to 124%. As an upgrade material it adds +6 points, up to 124%, cost 3. It is last in `MATERIAL_RARITY` and in the socket materials. Tempering with bloodstone is capped at 5 (the modifier temper maximum), not 6.

Modifier unlock change: Swift now unlocks on the first Briar Matriarch defeat by any hero (it was the Tyrant, Step 14.3). Staunch, Ruthless and Ironbound stay on the Tyrant. Learned recipes stay learned. Accounts that beat the Tyrant but not the Matriarch and have not learned Swift lose access until the Matriarch falls (accepted).

Contracts, first clear and Legacy: the Salvage contract gains a bloodstone entry, N from 5 to 10, contract level 37, reward paid in cinderite. The first clear reward is automatic (the first-clear table: 1,200 gold, 15 bloodstone, 1 free upgrade). The first Matriarch defeat gives 3 Legacy once (`elite:briar-matriarch`), and a hero who has entered the Barrens counts as a fifth late zone for the Legacy zone bonus (+2). The Matriarch joins the Remembered Paths list. No save version bump.

Harness (`--matrix barrens`): tiers are built on the Cinder prepared set with the Cleric on Kindled and Devout. Arrived (level 34, 11 nodes, quality 1.20, the Cinder prepared set with Emberward on hands and feet, 3 Healing Draughts), Prepared (level 36, 12 nodes, 1.24, the Arrived set with Staunch on hands and feet, 2 Draughts, 1 Antidote and 1 Ward Charm), Over-levelled (level 39, 12 nodes, 1.24, as Prepared). Variants `prepared-nostaunch` (Nimble on hands and feet) and `prepared-noantidote` (record only). `BUILD_ORDER` gains the 12th non-keystone node per class (Warrior Heavy Follow-Through, Assassin Toxic Opportunity, Ranger Press the Trail, Mage Rehearsed Casting, Cleric Final Mercy); existing prefixes do not change. `--matrix elites` gains `matriarch` cells.

Acceptance bands (mean of seeds 1-3 x 100 runs, rules mode):

- (a) Matriarch prepared: median of the five classes 50-75%, every class at least 30%, at most 2 classes above 85%, and each class at most its own Tyrant prepared +5 (the Tyrant is re-measured on the same tree; the Tyrant cells are stale, about 52 / 96 / 61 / 93 / 45).
- (b) Arrived at most 25% for at least 4 classes; over-levelled at least 85% for all; crafted minus plain at most +30 points.
- (c) Staunch check: prepared minus `prepared-nostaunch` at least +8 Matriarch win points for at least 3 classes.
- (d) Telegraph check: rules minus blind at least +10 for the Warrior and Ranger.
- (e) Regular fights, prepared: at least 95% wins for every class; `barrens-mixed` and `barrens-deep` lose 15-40% of maximum HP (recorded; at least 5 of 10 cells, the Cinder precedent).
- (f) About 35-45 `barrens-mixed` fights per level at level 37.
- (g) `--expedition bloodthorn-barrens` seeds 1-5 run cleanly.
- (h) Guards: the reference CSV, warden, causeway, hollows, cinder, built, telegraph and late matrices byte-identical; elites identical apart from the new rows.

Tuning order: seed-1 grid of HP {5,800; 6,300; 6,800} x Power {72; 78; 84}, then enrage, then the interrupt; the status coefficients are the lever for (c). One-time fallbacks, then stop and report (never loosen a band): Power above 84 needs a user decision; status coefficient to 0.18 for (c) (if still failing, record as accepted); scale the XP of all three regulars by one factor to reach 40 fights per level; summon trigger 40% to 50% if over-levelled is under 85%.

Risks: barriers (the Mage Mana Ward, the Cleric Ward) and high VIT shrug off Bleed and Poison, so (c) may pass for only 2 or 3 classes; the Antidote only has a Poison row (a Bleed row is a later follow-up).

**Measured 2026-11-24, Step 14.5 part 9 (BLOCKED: the Matriarch cannot meet the bands inside the allowed ranges).** Seeds 1 to 3 x 100 runs, rules, mean, at the proposed numbers (6,300 HP, Power 78, enrage 100 s, status 0.15, interrupt 5%); W/A/R/M/C = Warrior, Assassin, Ranger, Mage, Cleric. XP was scaled by one factor in part 2 (the proposed 2.2 and 1.87 multipliers gave about 62 `barrens-mixed` fights per level at level 37; Crawler and Thornwitch are now 3.4 and the Stalker 2.9, about 40 fights).

| Matriarch / Tyrant prepared (win %) | W | A | R | M | C |
| --- | --- | --- | --- | --- | --- |
| Tyrant prepared, same tree (re-measured; band (a) ceiling is this +5) | 52 | 96 | 61 | 93 | 45 |
| Matriarch prepared | 98 | 95 | 31 | 57 | 96 |
| Matriarch arrived (seed 1) | 68 | 78 | 16 | 5 | 4 |
| Matriarch over-levelled (seed 1) | 100 | 100 | 94 | 93 | 100 |
| Matriarch prepared-crafted (seed 1) | 100 | 100 | 98 | 99 | 100 |
| Matriarch prepared, blind (seed 1) | 80 | 95 | 25 | 23 | 99 |
| Prepared-nostaunch (seed 1; prepared 98 / 97 / 28 / 56 / 96) | 89 | 92 | 22 | 49 | 91 |
| Prepared-noantidote (seed 1, record only) | 100 | 100 | 69 | 85 | 97 |

Gate status at the proposed numbers: (a) fails (median 96 against 50-75; three classes above 85 (W 98, A 95, C 96) against at most 2; Ranger 31 passes the floor of 30 only just; W and C are more than 40 points above their Tyrant ceilings); (b) arrived at most 25 passes for only R, M and C (3 of 4 needed), over-levelled passes, crafted minus plain fails for R (+70) and M (+43); (c) Staunch check +9 / +5 / +6 / +7 / +5, passes for 1 class (3 needed); (d) rules minus blind +18 Warrior passes, Ranger +3 fails; (e) passes (every regular fight 100%, HP lost in the 15-40% band in 6 of 10 cells: barrens-deep for all five classes and barrens-mixed for the Cleric only, barrens-mixed 2-8% for the others); (f) passes; (g) and (h) not completed (see below).

Seed-1 grid, Matriarch prepared rules (wins % W/A/R/M/C):

| HP \ Power | 72 | 78 | 84 |
| --- | --- | --- | --- |
| 5,800 | 100/100/66/88/100 | 100/97/42/66/99 | 96/90/26/36/99 |
| 6,300 | 100/98/43/85/98 | 98/97/28/56/96 | 94/87/17/22/93 |
| 6,800 | 100/96/35/69/97 | 96/91/19/43/78 | 82/81/11/18/64 |

Then enrage 90 s (the lower end), interrupt 4% and 8%, and the 0.18 status fallback (HP 6,800 unless noted; W/A/R/M/C):

| Power, coefficient, interrupt | Result |
| --- | --- |
| 72, 0.15, 5% | 100/96/35/69/74 |
| 72, 0.18, 5% | 99/95/32/61/65 |
| 72, 0.18, 8% | 99/67/26/55/65 |
| 72, 0.18, 4% | 99/99/35/73/72 |
| 78, 0.18, 8% | 91/42/12/20/40 |
| 78, 0.18, 4% | 93/97/20/48/48 |
| 84, 0.18, 4% | 67/86/11/23/35 |
| 84, 0.18, 8% | 60/20/6/1/24 |
| HP 6,300, 72, 0.18, 8% | 100/73/37/69/94 |

Exploratory, outside the allowed ranges (HP above 6,800; 90 s, 0.18, 5%): HP 8,500 with Power 66 gives 74/95/19/28/8; HP 8,500 with Power 72 gives 36/73/8/9/3; HP 10,000 with Power 66 gives 4/58/3/0/0.

Finding: the classes split into two groups against one elite. The Warrior, Assassin and Cleric (sustain, life steal, barrier) win 95% or more until Power and HP are far past the planned ranges, while the Ranger and Mage drop under 30% well before the Warrior reaches 60%. No point in the grid, the enrage, interrupt and 0.18 levers puts the median in 50-75 with every class at least 30 and each class under its Tyrant ceiling (W 57, A 101, R 66, M 98, C 50). The Ranger and Mage floor needs Power 72 or lower, the Warrior ceiling needs Power 84 or more. Per the plan the work stops here: Power above 84 needs a user decision, and no band was loosened. Fallbacks used: the XP scale (part 2) and the 0.18 status coefficient (exploration only, not committed). The Matriarch in the code keeps the proposed numbers.

Also noted: the Antidote is worse than a Healing Draught at the Matriarch (prepared minus noantidote: W -2, A -3, R -41, M -29, C -1), so the proposed prepared supply set is a handicap and the Antidote needs a Bleed row (or a better effect) before it is worth the slot.

**Decision 2026-11-24 (user, option 1) and second tuning round.** Allowed beyond the original ranges: Matriarch Power 72 or lower (floor 66), HP 5,800-6,800, status coefficients up to 0.30, stack counts within the status definitions (Poison and Bleed cap at 5 stacks), the Stalker, Crawler and Thornwitch coefficients, and an Antidote Bleed rule. The Antidote already removed Poison and Bleed; the missing piece was a rule row, so `ANTIDOTE_BLEED_ROW` (drink at 3 Bleed stacks) goes right after the Poison row for new heroes when the 12-rule limit has room (a Mage has none), existing heroes get it once after their own Antidote row (hero update `antidote-bleed-rule`; heroes with no Antidote row get nothing), and the Barrens harness tiers carry it (`bleedRow`; every earlier matrix leaves it out so it stays byte-identical).

Chosen numbers (best point found; see the gates below): HP 6,800, Power 72, enrage 90 s, interrupt 4%. Hemorrhage Lash: one Bleed application at 75% base chance, coefficient 0.10. Venom Burst: five Poison applications at 100% (the stack cap), coefficient 0.30. The Barbed Stalker's Serrated Rake Bleed coefficient is 0.30 (it follows the elite; the Crawler and Thornwitch are unchanged). The summon triggers at 50% HP (the planned summon fallback) and the summoned Stalkers are level 35.

Measured (seeds 1 to 3 x 100, rules, mean; seed-1 values where noted; W/A/R/M/C):

| Cell | W | A | R | M | C |
| --- | --- | --- | --- | --- | --- |
| Tyrant prepared (ceiling is this +5) | 52 | 96 | 61 | 93 | 45 |
| Matriarch prepared, chosen numbers | 55 | 96 | 34 | 52 | 51 |
| Matriarch arrived (seed 1) | 0 | 76 | 1 | 5 | 0 |
| Matriarch over-levelled (seed 1) | 100 | 100 | 84 | 84 | 99 |
| Matriarch prepared-crafted (seed 1) | 95 | 100 | 84 | 75 | 83 |
| Prepared, seed 1 (reference for the rows below) | 54 | 98 | 32 | 49 | 48 |
| Prepared minus nostaunch (seed 1) | +31 | +3 | +4 | +19 | +14 |
| Prepared minus blind (seed 1) | +12 | +2 | -3 | +19 | -41 |
| Prepared minus noantidote (seed 1, record only) | -9 | 0 | -9 | -1 | -24 |

Gate status: (a) median 52, floor 30 met (Ranger 34), one class above 85 (A), ceilings W 55 (57), R 34 (66), M 52 (98), A 96 (101) met, but the Cleric is 51 against a ceiling of 50.3: failed by under one point. (b) arrived at most 25 holds for W, R, M, C (4 of 5); over-levelled is at least 85 for W, A, C but R and M are 84 (one point short); crafted minus plain is +41 / +2 / +52 / +26 / +35, so W, R and C fail the +30 limit. (c) passes for W, M and C (3 needed). (d) fails for the Ranger (-3; the Warrior +12 passes). (e) passes (regular fights 100%; HP lost 15-40% in 6 of 10 cells). (f) passes. The crafted-minus-plain band cannot hold together with the ceilings of (a): the crafted supplies are worth about +30 to +50 on a fight the prepared tier wins half the time, and a harder Matriarch drops the Ranger and Mage under 30. Antidote: still worse than a Draught for the Warrior, Ranger and above all the Cleric (-24), because three Poison stacks come back at once from a five-stack Venom Burst; the rule threshold or the supply itself needs a later look.

How the choice was made (seed-1 prepared rules, wins W/A/R/M/C): Poison and Bleed applications were the strongest lever on the Warrior and Cleric, but Bleed (it ticks on hero actions) hurts the Ranger most, so Bleed was kept at one weak application and Poison went to the cap. Coefficient 0.30 on two applications each gave 85/93/15/42/59 (Ranger far under 30); a third Poison and second Bleed gave 47/66/7/17/37; poison-only extras 76/89/26/25/51; five Poison at 0.30 with a weak Bleed gave 65/89/29/42/44 at interrupt 5%, 67/95/32/61/53 at 4% and 63/58/24/32/42 at 8%. Summon at 50% with level 34 / 35 / 36 / 38 Stalkers gave, roughly (seed 1), W 61 / 56 / 54 / 46 (Ranger 36 / 34 / 30 / 27, Cleric 47 / 53 / 45 / 47); the summon at 45% and a Power of 70 or 71 moved the Warrior up by 8 to 10 points, so Power 72 is the ceiling that keeps the Warrior near its ceiling.

Guards (final, 2026-11-24): against a fresh baseline taken on the tree before the Antidote and Matriarch changes, seed 1 x 100, stdout minus the timing line, `--matrix reference`, `warden`, `causeway`, `hollows`, `cinder`, `built`, `telegraph` and `late` are byte-identical, and `--matrix elites` differs only in the `matriarch` rows. `--expedition bloodthorn-barrens` seeds 1 to 5 run cleanly (checked earlier in the step).

### Events

- An event must be completed manually at least once before automation can be enabled for it.
- After manual completion, the player may configure a policy for future occurrences.
- Important special events may remain manual.
- Manual events can queue for the player's return without blocking ordinary offline progress.

## 7. Combat

### Simulation

- Real-time automated combat with cooldowns and unlockable speed controls.
- Encounter types include single enemies, groups, elites, and bosses.
- Health and class resources persist between encounters during an expedition.
- Combat uses one action timeline. When the hero is ready to act, it uses the highest-priority eligible skill or performs a weapon-based basic attack.
- Basic attacks roll Accuracy against Evasion, normally bounded to a 5%-95% hit chance.
- Active skills do not make hit rolls; status application can still be resisted.
- Early damage rolls range from approximately 60%-100% of calculated base damage.
- A visible 0-100 Consistency stat raises the minimum toward 85%.
- Calculated base damage is the normal non-critical ceiling. Critical damage is applied separately.
- Critical hits initially deal 150% damage before Strength, equipment, and skill modifiers.
- Armor and Resistance use diminishing percentage reduction relative to attacker or zone level.
- Enemies use visible strengths and soft counters; multiple builds should remain viable.
- Bosses use telegraphed phases that test preparation, sustain, and priority rules.
- Enemies gain stacking pressure after an encounter-specific expected duration, preventing renewable healing builds from stalling combat forever without imposing an immediate hard timer.

### Simulation clock and action timing

Accepted for implementation on 2026-10-21. Active play, the balance harness, and later offline simulation all use the same clock.

- Simulation time is counted in whole milliseconds and advances in fixed, deterministic 10 ms steps.
- Computed durations, such as action times, are rounded to the nearest millisecond when scheduled.
- Within one step, everything due is processed in this order:
  1. Expiries
  2. Periodic ticks
  3. Telegraph resolutions
  4. Actions, ordered by scheduled time, with the hero before enemies and enemies in slot order
- An action resolves at the moment its actor becomes ready.
- Action time is the recovery after that action, before the actor's next ready time.
- The next ready time is counted from the previous scheduled ready time, not from the step that processed it, so step size does not accumulate drift.
- Each actor's first ready time is one base action time after the encounter starts (skill time coefficient 1.0, after Agility and speed modifiers). No actor acts at t=0.
- Telegraphed enemy skills are the only wind-ups. Ordinary actions have no wind-up.

### Combat mathematics: initial test model

These formulas are starting hypotheses for simulation, not final balance. Main UI values are rounded for readability; detailed views and logs expose full precision, inputs, rolls, and intermediate results.

Notation:

- `L`: attacker level
- `STR`: Strength
- `VIT`: Vitality
- `AGI`: Agility
- `INT`: Intellect
- `SPI`: Spirit
- Percentages in formulas use decimal form, so 40% is `0.40`.

#### Progression scale

- A typical first-life hero reaches the first serious Warden attempt around level 20.
- Levels have no immediate hard cap; increasing XP requirements create a practical soft cap.
- Each level grants two manually allocated attribute points.
- One skill point is granted every three levels.
- Level automatically grants only a small amount of health; most power comes from attributes, skills, and equipment.
- The ordinary action-time target before Agility is approximately two seconds.

XP progression:

- `XP to next level = round(50 × current level^1.5)`
- Reaching level 20 requires approximately 33,600 cumulative XP.
- A typical first-life build should require approximately 12-18 simulated combat hours to reach level 20.
- Each enemy/encounter has an authored base XP reward based on its threat and role.
- If the enemy is below the hero's level, multiply XP by `max(10%, 0.75^(hero level − enemy level))`.
- If the enemy is above the hero's level, multiply XP by `min(125%, 100% + (5% × level difference))`.
- Summoned enemies do not grant separate XP; their threat is included in the parent encounter reward.
- Defeat does not remove XP or completed levels.
- Repeatable contracts target approximately 55%-65% of level-appropriate combat XP efficiency and also provide other rewards such as gold, materials, or reputation.
- Apply the Spirit ordinary-XP bonus after the level-difference modifier.

#### Health and power

- `Max HP = 50 + (5 × L) + (10 × VIT)`
- `Physical Power = weapon physical power + (2 × STR)`
- `Magical Power = focus/spell power + (2 × INT)`
- `Healing Power = equipment healing power + (2 × SPI)`
- Pre-modifier skill output uses a readable skill coefficient:
  - `Raw physical damage = Physical Power × skill coefficient`
  - `Raw magical damage = Magical Power × skill coefficient`
  - `Raw healing = Healing Power × healing coefficient`

Most skills use one primary Power value. Explicit hybrid skills may define multiple coefficients later.

#### Accuracy and Evasion

- `Accuracy = AGI + equipment/skill Accuracy`
- `Evasion = AGI + equipment/skill Evasion`
- `Basic hit chance = clamp(5%, 95%, 75% + Accuracy − Evasion)`
- Basic attacks roll to hit.
- Active skills do not roll to hit, though their statuses can still be resisted.

#### Criticals

- `Critical chance = clamp(0%, 75%, 5% + (0.4% × AGI) + equipment/skill bonuses)`
- `Critical damage = 150% + (0.5% × STR) + equipment/skill bonuses`
- Basic attacks and direct-damage skills can critically hit by default.
- Damage-over-time ticks and healing cannot critically hit unless a specific node or effect permits it.

#### Action speed and cooldown reduction

- `Action time = base action time × skill time coefficient ÷ (1 + AGI/100)`
- Each skill defines an action-time coefficient.
- Final action time cannot be lower than 0.5 seconds.
- Provisional weapon base action times:
  - Dagger/light weapon: 1.5 seconds
  - One-handed weapon: 2.0 seconds
  - Bow: 2.2 seconds
  - Caster weapon/spell baseline: 2.0 seconds
  - Two-handed weapon: 2.6 seconds
- Agility modifies physical, magical, and healing action times consistently.
- A skill's cooldown starts when its action resolves and advances continuously in real time.
- Cooldowns continue advancing while Stun delays the actor's next action.
- `Cooldown reduction = 30% × INT ÷ (INT + 50)`
- `Final cooldown = base cooldown × (1 − cooldown reduction)`
- Total cooldown reduction from Intellect, equipment, and skills is capped at 50%.

Basic-attack resource gains are normalized around the 2.0-second baseline:

- `Normalized gain = listed base gain × weapon base action time ÷ 2.0`
- Apply Spirit and other resource-gain modifiers after normalization.
- The rule applies to fractional stack progress as well as numeric meters.
- Resource gains caused by skills, Evasion, damage taken, travel, or other non-basic triggers are not weapon-speed normalized.

#### Penetration and Defense

- `Innate Armor penetration = 40% × STR ÷ (STR + 50)`
- `Innate magical penetration = 40% × INT ÷ (INT + 50)`
- Innate, equipment, and skill penetration add together, capped at 80%.
- `Effective Defense = relevant Defense × (1 − total penetration)`
- `Reduction = min(80%, Effective Defense ÷ (Effective Defense + 50 + (5 × L)))`
- Physical damage uses Armor; magical damage uses Resistance.

#### Consistency and output variance

- Consistency is visible and clamped from 0 to 100.
- `Damage floor = 60% + (0.25% × Consistency)`
- At 0 Consistency, damage ranges from 60%-100% of calculated damage.
- At 100 Consistency, damage ranges from 85%-100%.
- Draw two independent uniform random values from the current range and average them. This creates a centered triangular distribution: middle outcomes are common and extremes remain possible but rare.
- Healing uses a narrower 90%-100% range. Its exact roll distribution remains open.

Elf Focus, Weapon Master, and other explicit effects can further modify a minimum roll, subject to effect-specific caps.

#### Final damage pipeline

Pre-mitigation barriers require variance and criticals to occur before Defense:

1. Select Physical or Magical Power.
2. Multiply by the skill coefficient.
3. Apply outgoing damage modifiers.
4. Apply the centered Consistency roll.
5. Apply the critical multiplier when the critical roll succeeds.
6. A pre-mitigation barrier absorbs this rolled/critical damage.
7. Apply penetration and Armor/Resistance reduction to any overflow.
8. Apply final incoming-damage modifiers.
9. Round to the nearest integer.

A successful unshielded hit deals at least 1 HP. A barrier can absorb the entire hit and reduce HP damage to zero. Full-precision intermediate values are retained until final rounding.

#### Barriers

- Barriers and wards are external, pre-mitigation protection.
- They absorb rolled and critical damage before Armor or Resistance.
- Only overflow reaches the hero's Defense calculation.
- Shield Brace is a damage-reduction effect rather than an absorb barrier unless a node explicitly changes it.

#### Natural regeneration and healing received

- `Out-of-combat HP regeneration per second = 0.05 × VIT`
- Natural regeneration works during travel and between encounters, not during combat.
- Fractional regeneration, decided 2026-11-13 (playtest fix): the rate is exactly `0.05 × VIT` HP per second, times the Thick Hide and Long Hunt factors, and it is not rounded each second. The sim keeps the fraction left over in whole thousandths of an HP and adds it to the next second, so a hero at VIT 9 (Elf, Undead) heals 0.45 HP per second: 9 HP every 20 seconds. Full HP clears the leftover. The run panel shows the rate as "+N HP/s".
- `Vitality healing-received bonus = min(50%, 0.5% × VIT)`
- Final direct healing applies its 90%-100% roll, outgoing healing modifiers, and the target's healing-received modifier.

#### Spirit resource and mastery bonuses

- `Resource-generation bonus = 50% × SPI ÷ (SPI + 50)`
- The bonus modifies each class's defined resource gains rather than inventing a shared resource rule.
- Numeric meters multiply gains directly.
- Discrete resources such as Advantage retain visible fractional progress toward a future bonus stack.
- `Ordinary XP/mastery bonus = 10% × SPI ÷ (SPI + 50)`
- Spirit never multiplies one-time boss, zone, or difficulty milestone rewards.

#### Status application

- `Status Potency = INT + equipment/skill Potency`
- `Physical Status Resistance = VIT + equipment/skill physical resistance`
- `Magical Status Resistance = SPI + equipment/skill magical resistance`
- `Application chance = clamp(5%, 95%, base skill chance + Potency − relevant Resistance)`
- Potency affects application chance only. Skills and nodes control duration, stack caps, and damage.
- Bleed and Poison are physical.
- Burn and Chill are magical.
- Stun and Expose use the applying skill's physical or magical tag.
- Mark is a guaranteed designation and does not roll against Status Resistance.
- Bleed and Poison require the applying attack to deal HP damage; an external barrier that absorbs the full hit prevents those contact statuses.
- Magical statuses and non-contact debuffs can apply through barriers.

Damage-over-time calculation:

- On application, snapshot the source's relevant Power, penetration, and status coefficient.
- Each tick uses the target's current Defense.
- DoT ticks use fixed damage without a variance roll and cannot critically hit by default.
- Once a DoT is active, its ticks bypass newly created barriers and resolve against HP/Defense.

Standard cleansing removes one selected or highest-priority cleansable negative status and all of its stacks.

Boss status rules:

- Bosses use approximately 60% of normal stack caps: 3 Bleed, 3 Poison, 3 Burn intensity, and 2 Chill.
- Boss status durations are 50% of their normal values.
- Stun becomes 35% of its normal action delay.
- Complete immunity is reserved for clearly telegraphed enemy traits or boss phases.

### Initial status set

#### Bleed

- Maximum 5 stacks against ordinary enemies.
- Each stack lasts for 3 target actions and triggers when that target acts.
- Fast enemies therefore suffer more frequent Bleed damage.

#### Poison

- Base maximum 5 stacks, expandable through Venom nodes and equipment.
- All stacks share an 8-second duration.
- New applications refresh the shared duration.
- Combined Poison damage ticks every 2 seconds.

#### Burn

- One Burn status with intensity from 1-5.
- Reapplication raises intensity and refreshes the shared 5-second duration.
- Burn ticks every second.

#### Chill

- Maximum 3 stacks against ordinary enemies.
- The stacks reduce action speed by 10%, then an additional 7%, then an additional 5%.
- Reapplication refreshes the shared 6-second duration.

#### Stun

- Stun pushes the target's next action 1.5 seconds later instead of applying a separate frozen state.

#### Mark

- Mark is a guaranteed target designation.
- Class-specific rules define what the designation reveals or enables.

#### Expose

- Expose reduces Armor and/or Resistance according to the applying skill.
- Only the strongest applicable Expose takes effect.
- New applications refresh its 8-second duration.

Elemental identities:

- Fire applies or interacts with Burn.
- Frost applies or interacts with Chill.
- Lightning chains between targets and disrupts action timing or resources without requiring a persistent status.
- Arcane interacts with Resistance penetration, Mana, and cooldowns.

Exact DoT coefficients, Expose magnitude, cleanse availability, and status-specific skill interactions remain part of skill and enemy tuning.

### Enemy balance framework

Enemies use direct combat stats rather than player attributes. Formula-generated values are rounded to the nearest integer after all archetype multipliers.

For a standard level-`L` enemy:

- `Max HP = 80 + (20 × L)`
- `Physical or Magical Power = 8 + L`
- `Armor = 5 + (2 × L)`
- `Resistance = 5 + (2 × L)`
- `Accuracy = 10 + L`
- `Evasion = 5 + (0.75 × L)`
- Base action time is 2.2 seconds.
- Consistency is 0, using the same centered 60%-100% damage range as a new hero.
- Ordinary enemies cannot critically hit unless an explicit telegraphed skill or trait permits it.
- Baseline XP before threat and level-difference modifiers is `5 + (2 × L)`.

Equal-level standard encounters target:

- Approximately 8-12 simulated seconds to defeat for a reasonable build.
- Approximately 10%-20% average hero HP attrition before out-of-combat regeneration.

The 2026-10-23 reference matrix ran each level-20 floor build 300 times from seed 1. Those builds use the Q4 loadouts and have no passives, accessories, or consumables. Ranger and Warrior fights against a level-6 Deserter landed inside both bands. These misses are accepted, and no coefficients change because of them:

- Assassin: 100% wins, median 7.6 seconds, 9.3% HP lost.
- Cleric: 100% wins, median 14.7 seconds, 16.1% HP lost.
- Mage: 100% wins, median 8.3 seconds, 9.8% HP lost.

The bands remain the target for a reasonable build. They are not a requirement that the floor build hit them.

Initial archetype multipliers:

- Swarm: 0.45× HP, 0.65× Power, 0.6× Defense, 0.75× action time, 0.4× XP.
- Skirmisher: 0.8× HP, 0.9× Power, 0.75× Defense, 0.8× action time, +10 Evasion, 0.85× XP.
- Standard: 1.0× all baseline stats and XP.
- Tank: 1.6× HP, 0.8× Power, 1.5× Defense, 1.2× action time, 1.25× XP.
- Burst: 0.8× HP, 1.25× Power, 0.8× Defense, 1.25× action time, 1.2× XP; dangerous output comes through telegraphed attacks.
- Support: 0.75× HP, 0.7× Power, 0.8× Defense, 1.0× action time, 1.0× XP; value comes through authored utility skills.

Multi-enemy encounter XP:

1. Sum member XP after individual threat multipliers.
2. Apply a 5% discount for each enemy beyond the first.
3. Cap the group discount at 20%.
4. Summoned enemies award no separate XP.

Elites begin around 3× HP, 1.3× Power, and 1.25× Defense relative to their underlying archetype, then add authored mechanics. Their repeatable base XP is 3× the underlying enemy XP before first-clear rewards.

First-region level bands:

- Splintered Road: levels 1-7
- Withered Grove: levels 6-14
- Fallen Bastion: levels 8-16
- Fractured Warden: level 20 at Echo rank 0

These formulas are calibration targets. Individual enemies can override any value when their role requires it.

### Frontier fill (Step 14.1)

Decided 2026-11-24 (user: section 7 is the truth for level bands). Two changes, content only; the sim, skills and every other zone are untouched.

**Level bands.** `levels` on the three first nodes now match the bands above: Splintered Road 1-7 (was 1-6), Withered Grove 6-14 (was 8-14), Fallen Bastion 8-16 (was 10-16). Readers: the map's level band, the harness reference hero (route's last node `levels.min` plus 2, so a Grove run now measures a level-8 hero, a Bastion run a level-10 hero), and the first-clear reward (`30 x levels.max`), so the Splintered Road first clear pays 210 gold (was 180); the Grove and Bastion maxima are unchanged. The Fracture Gate routes still end at the Gate (18-20).

**Second drawn fight for the Grove and the Bastion.** Each zone drew one fight (`grove-mixed`, `bastion-mixed`), so a long run repeated it. Each gets one more, drawn from the fourth fight on with equal chance. Existing enemies only (no new bounty targets, drops or material sources):

| Encounter | Members | Draw table after |
|---|---|---|
| `grove-deep` | Thornbeast level 12, Blight Spider level 10, Blight Spider level 10 | `grove-mixed`, `grove-deep` |
| `bastion-deep` | Hollow Sentry level 12, Hollow Sentry level 12, Fallen Arbalist level 13 | `bastion-mixed`, `bastion-deep` |

Measured with the reference hero of each class (nodes = level / 3, starter modifiers, 2 Healing Draughts, 30 runs, seed 1; win % / mean share of max HP lost, Warrior, Assassin, Ranger, Mage, Cleric): `grove-deep` at level 8 100/44, 100/57, 100/48, 97/54, 100/43; level 10 100/43, 100/51, 100/44, 100/44, 100/40; level 14 100/42, 100/44, 100/33, 100/49, 100/41; `bastion-deep` at level 10 100/45, 100/44, 100/45, 100/48, 100/40; level 12 100/43, 100/41, 100/39, 100/43, 100/40; level 16 100/36, 100/46, 100/23, 100/27, 100/41. The mixed fights at the same levels cost 11-47%; the deep fights cost 23-57%, a few points to 20 points more at band level, and an under-levelled Mage at level 8 in the Bastion wins 83% with 70% lost. Both stay a step below the elite fights (one-enemy boss-tier fights with their own mechanics). Rejected compositions: with a Fracture Wisp or an Oathbound Echo as the third member (new bounty targets), and two Arbalists (the level-8 Mage wins 60%).

### Late modifiers and Cinder fixes (Step 14.3)

Decided 2026-11-24 (user approved the plan; numbers are proposed and the measurement gates below decide). Ranks I to III use the shared multiplier (1, 1.5, 2.0) and temper; the stack cap of 2 across worn gear applies. Four new modifiers, all unlocked by the first Emberwrought Tyrant defeat by any hero (Zone 5, Step 14.5, moves the Swift unlock to its own elite, the Briar Matriarch; learned recipes are kept):

| Modifier | Effect | Min level | Slots | Recipe | Unlock |
| --- | --- | --- | --- | --- | --- |
| Staunch | +10 physical status resistance (new field `physicalStatusResistanceBonus`; lowers the chance Bleed, Poison and physical-tagged statuses land on the hero by 10 points) | 32 | armor, accessory | 850 gold (`recipeGold`) | Emberwrought Tyrant defeated by any hero |
| Ruthless | +3 points crit chance, +10 points crit damage | 34 | weapon, accessory | 900 gold | same |
| Ironbound | +7% max HP (8% until the Step 14.3 measurement) | 36 | armor | 950 gold | same |
| Swift | +3 points cooldown reduction, +3 Accuracy | 38 | weapon, accessory | 1,000 gold | same |

Staunch has little use until a level 32 or higher enemy applies Bleed or Poison: no current Cinder Scar enemy does, so it is a modifier for later zones.

**Tempered** was a trap pick against Bloodbound. It now gives +6 points Armor and magical penetration (was 4) and +2 points crit chance, on weapons and on accessories (was weapon only).

**Warming Tonic** removes all Chill and Burn, restores 10% of maximum HP, and makes the hero immune to new Burn for 10 seconds (`statusImmunity` effect, supplies only). While immune, a Burn application still draws its roll (the RNG draw order does not change) and is logged `immune`; nothing is applied. A second Tonic sets the end to the later of the two; cleansing does not end it. Price 15 gold (was 12); brew 2 hide + 5 gold (was 4).

Acceptance (seeds 1 to 3 x 100 runs, rules, mean over the seeds): (a) Tyrant prepared stays inside the bands (40 to 85; Warrior and Cleric at least 30) and within +/-8 of the 2026-11-10 numbers (Warrior 35, Assassin 75, Ranger 59, Mage 74, Cleric 43); prepared minus no-Tonic improves on (-3, -5, -8, -4, -8) for at least 3 classes (0 is not required). (b) `--matrix late`: each swapped modifier minus its baseline is at most +8 Tyrant win points for every class; Tempered on an accessory minus prepared is at least -3 averaged over the classes. (c) Guards: reference CSV, warden, causeway, hollows, built and telegraph byte-identical; elites identical apart from Tyrant rows. Fallbacks, each used once and then stop and report: immunity 10 s to 6 s; Ironbound 8% to 7%; Ruthless crit 3 to 2; Swift cooldown reduction 3 to 2.5; Tempered penetration 6 to 5 if over +8, crit 2 to 3 if under -3.

**Measured 2026-11-24** (Step 14.3, seeds 1 to 3 x 100 runs, rules, mean; W/A/R/M/C = Warrior, Assassin, Ranger, Mage, Cleric). Immunity 10 s, nothing else tuned except Ironbound.

- Tyrant prepared (Cinder prepared tier), before Step 14.3 on the same tree: 46 / 93 / 59 / 93 / 41; after (Tonic immunity): 52 / 96 / 61 / 93 / 45, a change of +6 / +3 / +2 / +1 / +4, inside +/-8. The 2026-11-10 reference numbers (35 / 75 / 59 / 74 / 43) and the 40 to 85 bands were already out of reach before this step (Assassin 93, Mage 93 on the pre-step tree; earlier Steps moved the Tyrant cells), so the "stays in bands" half of acceptance (a) cannot be met by this step; the change is judged against the measured pre-step numbers.
- Prepared minus no-Tonic (the Burn check): -1 / +2 / -7 / +1 / -4 against -3 / -5 / -8 / -4 / -8 before; improved for all 5 classes (3 needed). The Tonic is still slightly worse than a Draught for the Warrior, Ranger and Cleric.
- `--matrix late`, variant minus baseline in win points (W/A/R/M/C): Ironbound 8% first measured +8.7 / +1.3 / -2.3 / +0.3 / +4.7 (Warrior over +8), so the fallback 7% was used: +1.3 / -0.7 / +1.0 / 0.0 / +3.0. Ruthless +4.0 / +0.7 / +1.0 / +2.3 / +7.3. Swift +0.7 / +1.3 / +2.3 / +0.3 / 0.0. Tempered on an accessory +1.0 / +0.7 / +1.3 / -2.3 / 0.0 (mean +0.1, needs at least -3). Tempered on the weapon instead of Bloodbound (record only) -48 / -17 / -55 / -55 / -21: against the life steal on the weapon, Tempered still loses, the pick is the accessory slot. Staunch on hands and feet instead of Nimble at the Warden -6 / -13 / -15 / -11 / -3 (it only gives up Evasion there; the Warden applies no physical status).
- Guards at seed 1 x 100: reference CSV, warden, causeway, hollows, built and telegraph are byte-identical to the pre-step run; elites differ only in Tyrant rows. `--expedition cinder-scar` seeds 1 to 5 run cleanly: 0 defeats, 1 retreat per run.

`--matrix late` swaps one modifier into the Prepared tier of the Cinder Scar and of the Warden harness (the harness skips the level gate): Ironbound on head and chest instead of Stalwart; Ruthless on accessory 0 instead of Vicious; Swift on accessory 1 instead of Quick; Tempered on accessory 1 instead of Quick (`tempered-acc`) and on the weapon instead of Bloodbound (`tempered-weapon`, recorded only); Staunch on hands and feet instead of Nimble (Warden prepared). They are not added to the existing Warden or Cinder variant lists.

### Class balance pass (Step 13.5)

Decided 2026-11-08 (user accepted all recommendations). Warrior and Cleric cannot beat the Warden and trail the other classes at the elites; the Mage's Mana Ward is the outlier. Order: lift Warrior and Cleric, trim Mage, then harden the elites (Colossus, Reaver). Skill and node text in §4 and §7 changes only in the part that changes the number.

Diagnosis (Step 12.4, 13.1 and 13.4 measurements):

- Warrior against the Warden, prepared: dies at about 86 s with the Warden at 52%. Damage is about 21 per second; sustain is only Second Wind (15% max HP per 12 s) and Shield Brace (30% reduction).
- Cleric against the Warden: about 11 damage per second, the Warden at 58-73% after 100-209 s.
- Mage: Mana Ward with its node absorbs 125% of Magical Power (about 175 HP every 8.8 s), about 2.5 times the Cleric's Ward. It is the outlier.
- Assassin: Warden prepared 0-4% yet Colossus 94%. That is an enemy-side issue and is accepted for now (parts 5-6).

Bands (prepared = the Warden "prepared" tier, over = over-levelled):

- Warden prepared (level 20): 30-70% wins for every class. Over-levelled (level 24): at least 85%. Causeway-geared tier: at least 85%. Just arrived: at most 20%.
- Tidebound Colossus and Hollowmaw Reaver, prepared: 40-85% for all five classes; over-levelled at least 85%.
- Mixed fights: 15-40% of maximum HP lost.
- Telegraphs: in elite fights the rules hero beats the blind hero by at least 8 HP points and at least 10 win points, for every class with an answer skill.
- Crafted supplies: the crafted prepared tier wins at most 30 points more than the plain prepared tier.

Levers. Skill-definition and class constants only, no sim change. Start value, then the sweep range; a chosen value outside the range is reported, not forced. Starter-node constants are absolute values, so a base change needs its node constant changed too. Do not touch Fury generation, `FURY_PHYSICAL_BONUS_AT_FULL`, basic attacks, reference hero stats or damage formulas (`duel-basic` is a Warrior on basic attacks and its golden snapshot must not change).

| Id | Class | Lever | Now | Start | Range |
| --- | --- | --- | --- | --- | --- |
| W1 | Warrior | Driving Blow damage | 110% | 130% (chosen 130%) | 120-140% |
| W2 | Warrior | Sundering Blow damage, Expose Armor reduction | 125%, 20% | 150%, 30% (chosen 150%, 30%) | 25-35% Armor |
| W3 | Warrior | Second Wind heal | 15% max HP | 25% (chosen 30%) | 20-30% |
| W4 | Warrior | Shield Brace reduction | 30% | 50% (chosen 40%) | 40-60% |
| C1 | Cleric | Smite damage; `SMITE_NODE_COEFFICIENT` | 100%; 1.2 | 130%; 1.5 (chosen 130%; 1.5) | sweep 130-160% |
| C2 | Cleric | Judgment damage and cost; `JUDGMENT_NODE_COEFFICIENT` | 200%, 50; 2.3 | 250%, 40; 2.8 (chosen 250%, 40; 2.8) | sweep 250-300% |
| C3 | Cleric | `ZEAL_BASE`, only if C1 and C2 are not enough | 7 | 9 (chosen 9) | |
| M1 | Mage | Mana Ward barrier; `MANA_WARD_NODE_COEFFICIENT` | 100%; 1.25 | 70%; 0.9 (chosen 65%; 0.85) | 60-90%; 0.8-1.0 |

If Echo-first targeting (Q5) explains most of the Warrior and Cleric Warden gap (the `lowestHpPercent` diagnostic row of `--matrix elites`), their reference rules change for multi-enemy rows only, which moves the reference CSV; that is recorded here when done.

Guards after each class part: the built matrix (Rootmaw and Echo Knight at 6 nodes) is not trivialised (Warrior and Cleric HP lost not down more than 15 points); reference regular fights at least 95% wins; Causeway and Hollows regular fights at least 95%; Mage over-levelled Warden at least 85%. Acceptance: seeds 1, 2 and 3 at 100 runs, mean of the seeds, seeds within 8 points of each other.

Later parts: 5 elite retune (Colossus HP 3,600 to 4,200 and Breaker Wave 230% to 320%; Reaver HP 3,400 to 4,400, Power 40 to 44, Rift Surge 300% to 400%; Warden unchanged unless Warrior or Cleric is below 30% prepared, then the HP multiplier 8 to 7); 6 telegraph check (done 2026-11-09, see "Elite pressure"; the single-action interrupt was not built); 7 crafted supplies (planned Greater Draught 50% to 40%, Riftglass Ward 30% to 25%; the sweep chose 35% and 25%, see "Crafted supplies trim"); 8 full re-measure and close.

Baselines and results are recorded below as each part is measured.

Final measurement (Step 13.5 part 8, 2026-11-09; replaces the part 1 baseline, which is superseded by every part below). Code and content as of commit d9c4ccf plus the part 8a record; nothing tuned in part 8. Seeds 1-3 x 100 runs, rules mode, mean of the three seeds. Cells are wins % (mean HP lost % / elite HP left %). Tiers: Warden, Colossus and Reaver prepared / over come from `--matrix elites`; Warden arrived from `--matrix warden`; Reaver arrived from `--matrix hollows` (Colossus arrived from `--matrix elites`).

| Class | Warden arrived | Warden prepared (30-70) | Warden over (85+) | Warden causeway (85+) | Colossus arrived | Colossus prepared (40-85) | Colossus over (85+) | Reaver arrived | Reaver prepared (40-85) | Reaver over (85+) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Warrior | 0 | 52 (94 / 2) | 100 (47 / 0) | 100 (47 / 0) | 0 (100 / 34) | 74 (88 / 2) | 100 (56 / 0) | 0 | 42 (91 / 5) | 100 (52 / 0) |
| Assassin | 0 | 42 (94 / 6) | 100 (46 / 0) | 100 (44 / 0) | 0 (100 / 33) | 57 (86 / 5) | 100 (46 / 0) | 15 | 76 (72 / 5) | 94 (50 / 2) |
| Ranger | 0 | 54 (88 / 4) | 100 (47 / 0) | 100 (46 / 0) | 0 (100 / 31) | 65 (83 / 5) | 100 (48 / 0) | 8 | 76 (79 / 2) | 99 (50 / 0) |
| Mage | 0 | 48 (93 / 2) | 100 (51 / 0) | 100 (57 / 0) | 0 (100 / 35) | 67 (87 / 5) | 100 (54 / 0) | 1 | 45 (92 / 6) | 96 (65 / 0) |
| Cleric | 0 | 45 (89 / 2) | 100 (43 / 0) | 100 (41 / 0) | 0 (100 / 30) | 59 (79 / 2) | 100 (43 / 0) | 0 | 57 (74 / 3) | 100 (41 / 0) |

Seeds (wins % per seed, prepared tier): Warrior Warden 47,51,58, Colossus 80,74,69, Reaver 48,38,40; Assassin Warden 42,40,45, Colossus 50,63,59, Reaver 76,79,72; Ranger Warden 59,54,49, Colossus 58,69,67, Reaver 75,78,75 (99,100,98 before the half-dodge); Mage Warden 45,45,53, Colossus 75,68,59, Reaver 49,40,46; Cleric Warden 47,42,45, Colossus 62,56,59, Reaver 62,53,57.

Crafted supplies (3 Greater Draughts and a Riftglass Ward), wins % plain prepared / crafted prepared / difference (band: at most +30):

| Class | Warden | Colossus | Reaver |
| --- | --- | --- | --- |
| Warrior | 52 / 77 / +25 | 74 / 97 / +23 | 42 / 68 / +26 |
| Assassin | 42 / 79 / +37 | 57 / 76 / +19 | 76 / 85 / +9 |
| Ranger | 54 / 81 / +27 | 65 / 85 / +21 | 76 / 93 / +17 |
| Mage | 48 / 69 / +21 | 67 / 85 / +17 | 45 / 73 / +28 |
| Cleric | 45 / 64 / +19 | 59 / 73 / +14 | 57 / 70 / +12 |

Telegraph check, rules minus blind at the prepared tier (win points / HP-lost points saved; band: at least +10 wins and 8 HP points for every class with an answer skill):

| Class | Warden | Colossus | Reaver |
| --- | --- | --- | --- |
| Warrior | +33 / +4 | +37 / +7 | +41 / +9 |
| Assassin | +26 / +4 | -7 / -2 | +25 / +14 |
| Ranger | +53 / +12 | +52 / +15 | +62 / +19 |
| Mage | +47 / +7 | +18 / +4 | +19 / +5 |
| Cleric | -3 / -1 | -30 / -16 | -33 / -17 |

Mixed fights (`--matrix telegraph`, rules, HP lost %, band 15-40): Warrior road 37 / grove 32 / bastion 33; Assassin road 46 / grove 39 / bastion 38; Ranger road 34 / grove 21 / bastion 14; Mage road 34 / grove 44 / bastion 48; Cleric road 41 / grove 41 / bastion 37.

Regular fights (`--matrix telegraph`, `causeway`, `hollows`, every tier and class, rules and blind, seeds 1-3): every non-elite fight is won 100% (band: at least 95%). Reference CSV (`--matrix reference --seed 1 --runs 100`): byte-identical to the committed `reports/2026-10-23-reference.csv`. Built matrix (seeds 1-3, wins %): Warrior 6 nodes Rootmaw 96 / Echo Knight 100, 0 nodes 86 / 100; Assassin 6 nodes 96 / 22; Ranger 94 / 38; Mage 100 / 100 (0 nodes 46 / 0); Cleric 100 / 100 (0 nodes 100 / 100); identical to the part 8a build matrix at seed 1. Offline and expedition (`--expedition`, seeds 1-5): Splintered Road 5 of 5 runs 4 victories, 0 defeats; Sunken Causeway 0 defeats in 5 runs (5-6 victories and one retreat each); Rift Hollows 0 defeats in 5 runs (3-6 victories and one retreat each).

Band misses and open items (all accepted unless marked open; no number was changed in part 8):

- Seed spread above 8 points in mid-band cells (up to 16: Mage Colossus prepared 75, 68, 59; also Assassin Colossus 13, Warrior Warden 11, Warrior Colossus 11, Warrior Reaver 10, Ranger Warden 10, Ranger Colossus 11, Mage Reaver 9, Cleric Reaver 9; blind cells up to 16). Accepted; the 100-run seeds are noisy at 40-70% wins.
- Assassin Warden crafted minus plain +37 (Warrior +25, Ranger +27, Mage +21, Cleric +19 are inside +30; Mage Reaver +28 inside). Assassin Warden prepared 42 sits in its band, but its crafted tier is 79. Accepted.
- Mixed fights HP lost mostly outside 15-40: Assassin road-mixed 46, Mage grove and bastion 44 and 48, Cleric road and grove 41, Ranger bastion 14. Accepted (the band predates the stat changes; the fights are won 100%).
- Telegraph check not met: Cleric (all three elites; the blind Cleric wins as often or more, Warden -3, Colossus -30, Reaver -33), Assassin at the Colossus (-7). Cleric rules were left unchanged by decision (part 8a). Accepted.
- Ranger Reaver prepared 76 (band 40-85): in band after the half-dodge (was 99, above the ceiling); blind Ranger 14.
- Cleric Colossus enrage start is a cliff (130 s: 20%, 140 s: 68%, 150 s: 90%); retune with care. Accepted.
- Warrior Reaver over 100, Assassin 94, Mage 96, all at least 85. Met.
- RESOLVED (2026-11-09, "Ranger Reaver half-dodge" below): Ranger arrived at the Reaver won 84% (band: at most 20%). Fade Back's full dodge cancelled about 60% of the Rift Surges. Rift Surge now sets `dodgedDamageFraction` 0.6; the Ranger arrived tier wins 8%.

Ranger Reaver half-dodge (2026-11-09). Fade Back's full dodge cancelled about 60% of the Reaver's Rift Surges, so the Ranger arrived tier won 84% (band: at most 20%) and the prepared tier 99% (band 40-85). A new optional enemy-skill field `dodgedDamageFraction` lets a readied dodge take a skill only in part: that share of each damage effect still lands (no statuses, no supply theft). Only Rift Surge sets it, at 0.6. Sweep of the fraction (Ranger, seeds 1-3 x 100 runs, mean wins %):

| `dodgedDamageFraction` | Arrived | Prepared | Prepared minus blind |
| --- | --- | --- | --- |
| omitted (full dodge) | 84 | 99 | +85 |
| 0.5 | 16 | 88 | +74 |
| 0.6 (chosen) | 8 | 76 | +62 |

The 0.5 and 0.6 rows are the planner's patched-copy measurement; a run of the final code agrees at 0.6 (arrived 9, 9, 6; prepared 75, 78, 75; over 99; crafted 93; blind prepared 14 unchanged). Other classes, other elites, regular fights and the reference CSV are byte-identical before and after. The Ranger telegraph check at the Reaver is now +62 wins / +19 HP points (still at least +10 / +8).

Echo-first diagnostic (Warrior and Cleric against the Warden, prepared, `targetPriority` `lowestHpPercent` on the whole hero): Warrior 0% wins, Warden 51% left (reference rules: 0%, 51%); Cleric 0% wins, Warden 71% left (reference rules: 0%, 71%). The targeting change moves nothing, so Echo-first targeting does not explain the gap and the reference rules are NOT changed. The gap is class damage and sustain, as diagnosed.

SUPERSEDED (2026-11-08, targeting fix): the Echo-first diagnostic above used `lowestHpPercent`, which picks the Warden itself (lowest-percent enemy is not the Echo), so it was an invalid test. The corrected diagnosis is below under "Targeting fix". The Warrior (part 2), Cleric (part 3) and Warden 5.75 (part 5A) results in this section were measured with the untargeted reference rules and are out of date; they are kept as history.

Seeds stay within 8 points except three blind cells: Warrior Colossus prepared (21, 8, 10), Ranger Colossus prepared (55, 65, 62) and Mage Colossus arrived (67, 62, 75).

Warrior result (Step 13.5 part 2, 2026-11-08). Chosen: Driving Blow 130%, Sundering Blow 150% with 30% Expose, Second Wind 30% max HP, Shield Brace 40%. Sweep (seed 1, 40-60 runs, Warden prepared / over / causeway Warden HP left, plus built 6-node Rootmaw and Echo Knight HP lost; baseline 49 / 21 / 28 left, 76 / 64 lost): W1 alone at 140% gave 45 / 15 / 22, 69 / 60; W2 alone at 150% and 35% gave 44 / 16 / 24, 69 / 62; W3 alone at 30% gave 39 / 80% wins / 15% wins, 44 / 42 (by far the strongest lever per guard point); W4 alone at 60% did nothing at the Warden (49 / 21 / 28) and cost 6 and 5 points on the guards, so it takes the range minimum 40%. Even the range maxima leave the Warden prepared tier at 0% wins (19% Warden HP left), so the 30-70% prepared band is NOT reached inside the allowed ranges; the Warden prepared tier needs about 45% more damage or sustain than the ranges allow (decision for the user, see the report). Ranges were not exceeded.

Warrior after (seeds 1-3 x 100 runs, mean; wins % with mean HP lost % / elite HP left % in rules mode): Warden prepared 0 (100 / 23), over 99 (45 / 0), causeway 90 (50 / 0), prepared-crafted 2; Colossus arrived 23 (93 / 3), prepared 100 (44 / 0), over 100; Reaver prepared 100 (44 / 0), over 100. Blind: Warden over 98, causeway 82, Colossus prepared 100, Reaver 100 (rules beat blind by only 1-8 win points: the telegraph band is for part 6). Bands met: Warden over, Warden causeway. Not met: Warden prepared (0, band 30-70), Colossus and Reaver prepared (100, band 40-85; retuned in part 5).

Guards (Warrior, seed 1, 100 runs): reference regulars 100% (the reference CSV Warrior rows above); Causeway and Hollows regular fights 100%. The built-matrix guard FAILS on HP lost: built 6-node Rootmaw 76 to 45% lost and Echo Knight 64 to 43% (down 31 and 21 points, limit 15), and the floor build now wins the Rootmaw and Echo Knight 100% (was 66% and 59%). W3 alone at 20% already costs more than 15 points on the Rootmaw (59), so no value that lifts the Warden also keeps this guard. Reported rather than forced.

Reference CSV changes (Warrior rows, seed 1, 100 runs; before / after): win % rootmaw 66 / 100, echo-knight 59 / 100, every other regular 100 / 100 (warden 0 / 0); median victory time ms arbalist 8770 / 7016, bastion-mixed 31417 / 26107, deserter 10812 / 9010, echo-knight 116077 / 96079, grove-mixed 29343 / 26280, oathbound-echo 8770 / 7016, road-mixed 21173 / 19371, rootmaw 63280 / 51852, sentry 22771 / 18610, shardling 3636 / 3636, spider 8930 / 8144, thornbeast 20797 / 19027, wisp 10177 / 8948, wolf 7272 / 5454; mean HP attrition % rootmaw 80.9 / 49.0, echo-knight 83.6 / 43.3, deserter 11.1 / 9.5, bastion-mixed 49.2 / 44.2. Other classes' rows are unchanged. The golden duel-basic snapshot is unchanged (basic attacks only).

Cleric result (Step 13.5 part 3, 2026-11-08). Chosen: Smite 130% (node 150%), Judgment 250% at 40 Faith (node 280%), Zeal 9 base Faith per damaging action (C3 applied because C1 and C2 were not enough). Sweep (seed 1, 40 runs, Warden prepared / over / causeway Warden HP left; baseline 71 / 59 / 62): the start values gave 66 / 43 / 34; with Zeal 9, 65 / 43 / 31; a doubled-damage probe (Smite 160% node 190%, Judgment 300% node 340%) gave only 56 / 23 / 13 with 5% causeway wins. Built 6-node Rootmaw and Echo Knight HP lost did not move (43 / 42 before, 42 / 41 after). The Cleric's damage per second is so low that no tested lever reaches the Warden bands: Warden prepared, over and causeway stay at 0% wins, and the 30-70% prepared and at-least-85% over bands are NOT met. The Cleric needs a different kind of lever (a new damage source or much less Warden pressure), which is a decision for the user.

Cleric after (seeds 1-3 x 100 runs, mean; wins % with HP lost % / elite HP left %, rules mode): Warden prepared 0 (100 / 66), over 0 (100 / 42), causeway 0 (100 / 30), prepared-crafted 0; Colossus arrived 1 (100 / 11), prepared 99 (45 / 0), over 100; Reaver prepared 100 (38 / 0), over 100. Blind: Colossus prepared 95 (rules beat blind by 4 win points), Warden 0, Reaver 100. Bands met: none of the Warden bands. Colossus prepared 99 (was 83) and Reaver 100 are above the 40-85% band and are retuned in part 5.

Guards (Cleric, seed 1, 100 runs): reference regulars 100% wins; Causeway and Hollows regular fights 100%; built 6-node Rootmaw 42% lost and Echo Knight 41% (before 43 and 42, not trivialised by more than 15 points). The floor (0-node) build now wins the Rootmaw 100% (was 3%) and the Echo Knight 100% (was 91%), HP lost 99 / 57 before, 50 / 44 after; this is the Cleric's floor build, not a guard.

Reference CSV changes (Cleric rows, seed 1, 100 runs; before / after): win % echo-knight 91 / 100, rootmaw 3 / 100, every other regular 100 / 100; median victory time ms arbalist 12502 / 10716, bastion-mixed 47489 / 38433, deserter 14680 / 12845, echo-knight 212665 / 172485, grove-mixed 62015 / 43855, oathbound-echo 14288 / 12502, road-mixed 32571 / 26057, rootmaw 201454 / 146313, sentry 29881 / 23335, shardling 5505 / 3670, spider 11908 / 10090, thornbeast 38742 / 26939, wisp 15278 / 13294, wolf 9175 / 9175; mean HP attrition % rootmaw 83.1 / 49.5, echo-knight 52.6 / 43.6, deserter 16.3 / 13.9, wisp 22.9 / 18.4, arbalist 17.4 / 15.3, spider 15.4 / 12.2. The Zeal change affects every Cleric using the Vow of Zeal. The golden duel-basic snapshot is unchanged.

Mage result (Step 13.5 part 4, 2026-11-08). Chosen: Mana Ward 65% Magical Power, node 85% (was 100% and 125%). Sweep (seed 1, 60 runs, Warden prepared wins / over / causeway; baseline 99 / 100 / 100): 70% with node 90% gave 68 / 100 / 100; 65% with node 85% gave 53 / 100 / 100; 60% with node 80% gave 40 / 100 / 100. The middle was chosen so the prepared tier sits inside 30-70% with room either side.

Mage after (seeds 1-3 x 100 runs, mean; wins % with HP lost % / elite HP left %, rules mode): Warden prepared 48 (93 / 8; seeds 51, 45, 49), over 100 (56 / 0), causeway 100 (50 / 0), prepared-crafted 100; Colossus arrived 82 (77 / 3), prepared 100 (49 / 0), over 100; Reaver prepared 100 (43 / 0), over 100 (30 / 0). Blind: Warden prepared 1 (rules beat blind by 47 win points), Colossus arrived 14 (rules +68), Colossus prepared 99, Reaver 100. Bands met: Warden prepared (30-70), Warden over and causeway (at least 85). Colossus and Reaver prepared 100 are above 40-85 (part 5). Crafted supplies lift the Warden prepared tier by 52 points, more than the 30-point ceiling (part 7 trims them).

Guards (Mage, seed 1, 100 runs): Mage over-levelled Warden 100% (at least 85); reference regulars 100% wins; Causeway and Hollows regular fights 100%; built 6-node Rootmaw 69 / 70% lost and Echo Knight 63 / 65% lost (unchanged, not a Warrior/Cleric guard but not trivialised). The floor builds are weaker: Rootmaw 69 / 52% wins, Echo Knight 54 / 1% wins.

Reference CSV changes (Mage rows, seed 1, 100 runs; before / after): win % rootmaw 69 / 52, echo-knight 54 / 1; median victory time ms rootmaw 53372 / 52416, echo-knight 119494 / 113616; mean HP attrition % arbalist 0 / 0.9, bastion-mixed 48.0 / 48.3, echo-knight 90.5 / 96.0, grove-mixed 41.8 / 44.3, rootmaw 86.1 / 87.2. Every other Mage row is unchanged. The golden duel-basic snapshot is unchanged.

Warden result (Step 13.5 part 5A, 2026-11-08, user decision: weaken the Warden instead of designing a new Cleric lever). Lever: Fractured Warden `hpMultiplier` (was 8). Chosen: 5.75 (Warden HP 2,760, was 3,840). Phase thresholds, Power, defences and skills are unchanged.

Sweep (seed 1, 60 runs, rules mode; wins % at Warden prepared / over / causeway, then Warden HP left % at prepared):

| Class | 8 | 7 | 6 | 5.75 | 5.5 | 5 |
| --- | --- | --- | --- | --- | --- | --- |
| Warrior | 0 / 100 / 87 (23) | 0 / 100 / 100 (14) | 20 / 100 / 100 (4) | 33 / 100 / 100 (2) | 55 / 100 / 100 (1) | 98 / 100 / 100 (0) |
| Cleric | 0 / 0 / 0 (66) | 0 / 0 / 0 (59) | 0 / 0 / 35 (47) | 0 / 8 / 68 (43) | 0 / 25 / 80 (40) | 0 / 70 / 98 (31) |
| Assassin | 2 / 100 / 100 | 27 / 100 / 100 | 80 / 100 / 100 | not run | not run | 97 / 100 / 100 |
| Ranger | 40 / 98 / 100 | 72 / 100 / 100 | 98 / 100 / 100 | not run | not run | 100 / 100 / 100 |
| Mage | 53 / 100 / 100 | 98 / 100 / 100 | 100 / 100 / 100 | not run | not run | 100 / 100 / 100 |

The bands cannot all be met with one HP multiplier. The Warrior needs about 5.75 or less to reach 30% prepared, the Mage is already above 70% at 7, and the Cleric stays at 0% prepared even at 5 (31% Warden HP left). Warrior (the user's priority class for this lever) takes precedence: 5.75 is the highest tested value that gives the Warrior at least 30% prepared on all three seeds. Fractional values were added to the sweep because the Warrior goes from 20% (6) to 98% (5).

Confirmation (seeds 1-3 x 100 runs, mean, seeds listed; wins % with HP lost % / Warden HP left %), 5.75 and 5.5:

| Class | Tier | 8 (part 4) | 5.75 | 5.5 |
| --- | --- | --- | --- | --- |
| Warrior | prepared | 0 (100 / 23) | 40 (78 / 2; 39, 43, 39) | 66 (63 / 1; 65, 68, 64) |
| Warrior | over | 99 | 100 | 100 |
| Warrior | causeway | 90 | 100 | 100 |
| Cleric | prepared | 0 (100 / 66) | 0 (100 / 43) | 0 (100 / 39) |
| Cleric | over | 0 | 8 | 21 |
| Cleric | causeway | 0 | 64 | 83 |
| Assassin | prepared | 3 | 86 (76 / 1; 88, 84, 87) | 91 (72 / 1) |
| Assassin | over / causeway | 100 / 100 | 100 / 100 | 100 / 100 |
| Ranger | prepared | 35 | 99 (52 / 0) | 100 |
| Mage | prepared | 48 | 100 (49 / 0) | 100 |
| Ranger, Mage | over / causeway | 100 / 100 | 100 / 100 | 100 / 100 |

Bands met: Warrior prepared (30-70), Warrior over and causeway (at least 85), Assassin, Ranger and Mage over and causeway. NOT met: Cleric prepared (0%, band 30-70), Cleric over (8%) and causeway (64%) at least 85; Assassin (86), Ranger (99) and Mage (100) prepared are above the 70% ceiling. Class nerfs were not applied, per the instruction. What else the Cleric would need: it removes about 57% of a 5.75-multiplier Warden (about 3.3 multiplier-units) before dying, so a multiplier of about 3 would be needed, which would make every other class win 100% at every tier; so the Warden number is not the right lever for the Cleric. A Cleric damage-source or sustain lever is. A smaller Warden Power or a longer-cooldown telegraph would not be a better single extra lever: the Cleric dies 100% of runs at the prepared tier with 39-43% of the Warden left, so it needs damage, not just survival.

Elite retune result (Step 13.5 part 5B, 2026-11-08). Chosen: Colossus HP 4,000 and Breaker Wave 300% (plan start 4,200 and 320%, range 3,800-4,600 and 280-360); Reaver HP 4,400, Power 44, Rift Surge 400% (the plan start values; nothing in range changes the result).

Colossus sweep (seed 1, 60 runs, rules mode, prepared tier wins % Warrior / Assassin / Ranger / Mage / Cleric; baseline 100 / 94 / 98 / 100 / 99): 3800 and 280% 100 / 62 / 92 / 100 / 73; 3900 and 290% 100 / 37 / 92 / 100 / 63; 4000 and 280% 100 / 37 / 92 / 100 / 60; 4000 and 300% 100 / 32 / 83 / 100 / 53; 4200 and 320% (plan start) 98 / 15 / 70 / 97 / 37; 4400 and 280% 98 / 20 / 87 / 98 / 45; 4600 and 280% 92 / 5 / 68 / 98 / 38; 4200 and 360% 88 / 8 / 60 / 68 / 2; 4600 and 320% 92 / 0 / 48 / 83 / 25; 4600 and 360% 70 / 0 / 43 / 53 / 3. Breaker Wave burst and fight length punish the Assassin and Cleric; the Warrior and Mage only come into the band where the Assassin and Cleric are walled at 0-8%. No point in the ranges puts all five classes in 40-85%. 4000 and 300% was chosen because it has the smallest total distance outside the band of the points that keep the Cleric and Ranger near it (Cleric 53 in band, Ranger 83-87, Assassin 33, Mage and Warrior 100).

Reaver sweep (seed 1, 60 runs, prepared tier): every point in the ranges (HP 4,000-4,800, Surge 350-450, Power 44) gives 100% wins for all five classes; the fight is not dangerous enough in range. Out-of-range probes (HP / Power / Surge, wins % Warrior / Assassin / Ranger / Mage / Cleric): 6,000 / 50 / 500 95 / 88 / 100 / 68 / 98; 7,000 / 50 / 500 95 / 52 / 100 / 32 / 98; 6,500 / 55 / 550 85 / 22 / 98 / 0 / 95; 8,000 / 60 / 600 28 / 0 / 88 / 0 / 58. The Reaver kills the Assassin and Mage (low HP, burst) long before it troubles the Warrior, Cleric and Ranger, so one HP/Power/Surge point cannot reach 40-85% for all five either.

After (seeds 1-3 x 100 runs, mean, rules mode; wins % with HP lost % / elite HP left %; before is part 4):

| Class | Colossus arrived | Colossus prepared | Colossus over | Reaver prepared | Reaver over |
| --- | --- | --- | --- | --- | --- |
| Warrior | 1 (99 / 9) | 100 (48 / 0); was 100 | 100 (43 / 0) | 100 (43 / 0) | 100 (42 / 0) |
| Assassin | 0 (100 / 38) | 33 (94 / 10; 31, 31, 37); was 94 | 100 (47 / 0) | 100 (43 / 0) | 100 (44 / 0) |
| Ranger | 0 (100 / 29) | 87 (74 / 1; 85, 91, 86); was 98 | 100 (47 / 0) | 100 (30 / 0) | 100 (22 / 0) |
| Mage | 5 (99 / 25) | 100 (58 / 0); was 100 | 100 (49 / 0) | 100 (45 / 0) | 100 (47 / 0) |
| Cleric | 0 (100 / 21) | 54 (74 / 3; 58, 50, 55); was 99 | 100 (43 / 0) | 100 (39 / 0) | 100 (39 / 0) |

Bands met: Colossus prepared Cleric (54); Colossus over-levelled for all five (at least 85). NOT met: Colossus prepared Warrior and Mage (100, band 40-85), Ranger (87, 2 points over), Assassin (33, 7 under); Reaver prepared 100 for all five (band 40-85). To reach the Reaver band the Assassin and Mage would be walled well before the other three, so the needed lever is class power or a new mechanic, not the Reaver numbers; this is reported, not forced.

Guards after the retune (Step 13.5 part 5, `--matrix causeway` and `--matrix hollows`, seed 1, 100 runs, rules mode): every regular (non-elite) fight is won at least 95% by every class at every tier (all 100%). The Colossus rows match the table above (seed 1: prepared Warrior 87, Assassin 31, Ranger 85, Mage 51 (this is the harness Mage tier), Cleric 58). The mixed fights do not contain an elite and were not changed by this part; their HP lost is mostly outside 15-40%, as recorded before (causeway-mixed arrived/prepared/over: Warrior 45/39/35, Assassin 41/29/24, Ranger 12/9/6, Mage 33/21/8, Cleric 43/40/31; hollows-mixed: Warrior 15/10/6, Assassin 24/19/14, Ranger 16/11/10, Mage 6/2/0, Cleric 28/22/17). Out of band (above 40): Warrior and Cleric causeway-mixed arrived, Assassin causeway-mixed arrived. Below 15: Ranger and Mage causeway-mixed, most hollows-mixed rows. Not changed here; left for part 8.

#### Targeting fix (Step 13.5 parts 1-4, 2026-11-08, user accepted all recommendations)

Corrected diagnosis: Warrior and Cleric lose the Warden because their reference rules never target the Warden's Echoes while the Ward Echo keeps healing and shielding the Warden. The earlier Echo-first check used `lowestHpPercent`, which picks the Warden itself, so it was invalid. Planner scratch measurements (seed 1, 20-40 runs, indicative): Cleric with Smite and Judgment on `lowestResistance` wins the Warden 100% (prepared, over, causeway at multiplier 5.75) and the Colossus prepared 100%; Warrior with Driving Blow and Sundering Blow on `lowestArmor` wins 100% at multipliers 5.75, 7 and 8 (0% untargeted at 7). Parts 2 (Warrior levers), 3 (Cleric levers) and 5A (Warden 5.75) of the original pass were tuned against the wrong cause and are superseded. Parts 6-8 (telegraph check, crafted supplies trim, full re-measure) stay pending; a time-pressure ramp for the Colossus and Reaver is a separate later step.

Part 1 (rules fix): the Cleric `smite` and `judgment` rows get `targetPriority: 'lowestResistance'` and the Warrior `driving-blow` and `sundering-blow` rows get `lowestArmor` in `referenceLoadouts` (the Assassin and Ranger rows already did). New heroes get these rows (`referenceLoadoutFor`); existing saves keep their own rows. The `--matrix elites` diagnostic row is now an untargeted one (every row's target priority removed, hero priority `current`), to show the old behaviour.

Part 1 result (seed 1, 60 runs, rules mode, Warden multiplier still 5.75, Warrior levers W1-W4 and Cleric C1-C3 still applied; wins % with HP lost %): Warrior wins 100% at every cell (Warden prepared 44, over 45, causeway 45; Colossus arrived 45, prepared 43, over 47; Reaver prepared 43, over 42); Cleric wins 100% except Colossus arrived 90% (Warden prepared 46, over 44, causeway 39 HP lost; Colossus prepared 43; Reaver prepared 38). Seed 1, 100 runs: Causeway and Hollows regular fights 100% for every class and tier; Warrior now wins Colossus arrived 100% and Cleric 85%. Built matrix (seed 1, 100 runs) Warrior 0/6/9 nodes win Rootmaw, Echo Knight and Warden 100% (Warden 95 s), Cleric 6/9 nodes win the Warden 92%. These Warrior and Cleric numbers include the part 2/3 buffs and the Warden 5.75 that parts 2-3 below re-tune.

Reference CSV changes (Warrior and Cleric rows, seed 1, 100 runs; before / after; only these rows changed, every other class is unchanged): Warrior warden win % 0 / 100 (median victory 95302 ms, attrition 47.2%), bastion-mixed median ms 26107 / 27877 and attrition 44.2 / 32.6, grove-mixed 26280 / 24218 and 46.0 / 31.5, echo-knight 96079 / 93470 and 43.4 / 42.2; Cleric bastion-mixed 38433 / 35344 and attrition 42.9 / 36.5, echo-knight 172485 / 152882 (43.7 / 43.6), grove-mixed 43855 / 38751 (42.6 / 41.4). Single-target rows are unchanged. The `ref-warrior-warden` row now wins, so the report test uses `ref-assassin-warden` for its losing-Warden check. The golden duel-basic snapshot is unchanged.

Part 2 (Warden retune): `hpMultiplier` 5.75 to 7, `pressureIntervalMs` 8000 to 3000, `pressureMaxStacks` 5 to 10 as the start, sweep multiplier 6.5, 6.75, 7 by interval 3000, 4000 (seed 1, 60 runs, all five classes). Bands as above; arrived at most 20% (`--matrix warden`). If the Assassin stays under 30% prepared that is reported, not tuned.

Part 2 result (2026-11-08). Chosen: `hpMultiplier` 7 (Warden HP 3,360), `pressureIntervalMs` 3000, `pressureMaxStacks` 10 (the plan start values; the targeted reference rules from part 1 are in force). Sweep (seed 1, 60 runs, rules mode, Warden prepared wins % for Warrior / Assassin / Ranger / Mage / Cleric; over-levelled and Causeway-geared were 100% for every class in every cell, so only prepared is listed), with Second Wind still 30%:

| Multiplier / interval | Warrior | Assassin | Ranger | Mage | Cleric |
| --- | --- | --- | --- | --- | --- |
| 6.5 / 3000 | 100 | 42 | 78 | 87 | 68 |
| 6.5 / 4000 | 100 | 48 | 85 | 97 | 93 |
| 6.75 / 3000 | 100 | 37 | 63 | 73 | 55 |
| 6.75 / 4000 | 100 | 42 | 67 | 92 | 67 |
| 7 / 3000 | 100 | 18 | 53 | 47 | 40 |
| 7 / 4000 | 100 | 27 | 67 | 75 | 75 |

With Second Wind trimmed to 15% (part 3, same seed and runs): 7 / 3000 gives Warrior 75, Assassin 18, Ranger 53, Mage 47, Cleric 40; 6.85 / 3000 gives 90 / 38 / 62 / 70 / 48; 6.75 / 3000 gives 90 / 37 / 63 / 73 / 55; 7 / 4000 gives 98 / 27 / 67 / 75 / 75; 6.75 / 4000 gives 100 / 42 / 67 / 92 / 92. 7 / 3000 was chosen because it puts three classes (Ranger, Mage, Cleric) squarely in 30-70% and has the smallest total distance outside the band (Warrior 5 over, Assassin 12 under); 6.85 and 6.75 put the Warrior 20 over and the Mage at the ceiling. The Assassin stays below 30% prepared at the chosen value; it was not buffed or nerfed, as instructed.

Part 3 (Warrior trim): Second Wind `maxHpFraction` 0.30 to 0.15 (the part 2 value of 0.30 was a lever against the wrong cause); re-check the built guard (Rootmaw about 76 and Echo Knight about 64 HP lost within 15 points) and the Warden bands. Cleric Smite, Judgment and Zeal buffs stay unless the Cleric ends above 70% prepared (then Zeal 9 to 7 is suggested, not applied). Colossus and Reaver numbers are unchanged.

Part 3 result (2026-11-08). Chosen: Second Wind `maxHpFraction` 0.15 (was 0.30 after the superseded part 2; the original value too). Node text is unchanged (it only mentions the cooldown). Warden acceptance with Warden 7 / 3000 ms / 10 stacks and Second Wind 15% (seeds 1-3 x 100 runs, rules mode, mean with the seeds listed; wins % with HP lost % / Warden HP left %):

| Class | Arrived | Prepared (band 30-70) | Over (at least 85) | Causeway (at least 85) | Prepared-crafted |
| --- | --- | --- | --- | --- | --- |
| Warrior | 0 | 79 (87 / 1; 73, 82, 81) | 100 | 100 | 100 |
| Assassin | 0 | 18 (98 / 16; 18, 16, 20) | 100 | 100 | 98 |
| Ranger | 0 | 54 (88 / 4; 59, 54, 49) | 100 | 100 | 99 |
| Mage | 0 | 48 (93 / 2; 45, 45, 53) | 100 | 100 | 98 |
| Cleric | 0 | 45 (89 / 2; 47, 42, 45) | 100 | 100 | 97 |

Bands met: Ranger, Mage and Cleric prepared; every class over-levelled and Causeway-geared (100%); every class arrived at most 20% (0%). NOT met: Warrior prepared 79 (9 over 70; seeds 73-82), Assassin prepared 18 (12 under 30; reported, no class buff or nerf applied). An intermediate Second Wind of 10% (seed 1, 60 runs) gives the Warrior 55% prepared (100 / 100 over and Causeway), which would be in band; it was NOT applied because the plan fixed the trim at 15%, so it is for the user to decide. The Cleric ends at 45% prepared, below the 70% ceiling, so its Smite, Judgment and Zeal buffs stay (the Zeal 9 to 7 suggestion is not needed). Crafted supplies lift the prepared tier by 21 (Warrior), 80 (Assassin), 45 (Ranger), 50 (Mage) and 52 (Cleric) points, beyond the 30-point ceiling for four classes (part 7).

Guards (Warrior, seed 1, 100 runs): built 6-node Rootmaw HP lost 65% and Echo Knight 52% (pre-step values about 76 and 64, down 11 and 12, within the 15-point limit; before the trim, with Second Wind 30%, they were 45 and 43); Warrior 0-node Rootmaw 96% and Echo Knight 100% wins. Cleric built 6-node Rootmaw 42% and Echo Knight 42% lost (before 43 and 42). Reference regular fights (seed 1, 100 runs): every class at least 95% (Warrior Rootmaw 96, everything else 100; the Warrior floor reference build loses the Warden 0%). Causeway and Hollows regular fights 100% for every class at every tier.

Mixed fights (seed 1, 100 runs, rules mode, HP lost %; band 15-40): Warrior causeway-mixed arrived/prepared/over 33/24/17, hollows-mixed 22/17/13; the other classes' mixed fights are unchanged by this work apart from the Cleric and the Warrior being re-measured in part 1 (Cleric causeway-mixed 43/40/31, hollows-mixed 28/22/17). Out of band: Cleric causeway-mixed arrived (43), Warrior hollows-mixed over (13); the rest of the earlier out-of-band cells are unchanged and left for part 8.

Elites after the targeting fix (seeds 1-3 x 100 runs, mean, rules mode; wins % with HP lost % / elite HP left %): Warrior Colossus arrived 2 (100 / 25), prepared 100 (57 / 0), over 100; Reaver prepared 100 (43 / 0), over 100. Cleric Colossus arrived 85 (54 / 4; 85, 84, 87), prepared 100 (43 / 0), over 100; Reaver prepared 100 (39 / 0), over 100. Colossus and Reaver prepared 100 for Warrior and Cleric are above the 40-85 band (before the targeting fix: Warrior 100 and Cleric 54 for the Colossus); the Colossus Assassin (33), Ranger (87) and Mage (100) cells and the Reaver cells for those classes are unchanged from part 5B (their rules and levers did not change). The Colossus and Reaver numbers are unchanged, as instructed; a time-pressure ramp for them is a separate later step.

Before / after summary of this fix (Warden prepared, over, causeway wins %; part 5A values with the untargeted rules and Warden 5.75, then now): Warrior 40 / 100 / 100 to 79 / 100 / 100; Cleric 0 / 8 / 64 to 45 / 100 / 100; Assassin 86 / 100 / 100 to 18 / 100 / 100; Ranger 99 / 100 / 100 to 54 / 100 / 100; Mage 100 / 100 / 100 to 48 / 100 / 100. Colossus prepared Warrior 100 to 100, Cleric 54 to 100.

#### Crafted supplies trim (Step 13.5 part 7, 2026-11-09, user approved option (a))

Band: the crafted prepared tier wins at most 30 points more than the plain prepared tier. Constraints: the Greater Draught must heal more than the Healing Draught (30%), the Riftglass Ward must be at least the Ward Charm (20%; since Step 13.20 this means the Riftglass Ward's elite damage fraction must be at most the Charm's), plain tiers do not change (since Step 13.20 this no longer holds for tiers that carry a Charm: the Charm changed). Only the two skill definitions in `src/content/skills.ts` are levers. Warming Tonic is unchanged.

Sweep (seed 1, 60 runs, `--matrix elites` rules mode, Warden and Colossus prepared vs prepared-crafted; in-memory patches). Cells are plain > crafted wins % (gap). Plain: Warden Warrior 55, Assassin 42, Ranger 53, Mage 47, Cleric 40; Colossus 98, 53, 83, 100, 100.

| Heal / Ward | Warden W | A | R | M | C | Colossus W | A | R | M | C |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 50 / 30 (now) | +45 | +58 | +45 | +48 | +57 | +2 | +45 | +17 | -2 | 0 |
| 50 / 20 | +45 | +58 | +47 | +48 | +57 | +2 | +45 | +17 | -2 | 0 |
| 40 / 30 | +45 | +50 | +44 | +38 | +45 | +2 | +29 | +15 | -3 | 0 |
| 40 / 25 | +45 | +51 | +42 | +41 | +47 | +2 | +30 | +15 | -3 | 0 |
| 40 / 20 | +45 | +43 | +42 | +35 | +47 | +2 | +19 | +15 | -7 | 0 |
| 35 / 30 | +45 | +26 | +40 | +26 | +43 | +2 | +22 | +9 | -3 | 0 |
| 35 / 25 | +43 | +26 | +32 | +28 | +45 | +2 | +17 | +9 | -5 | 0 |
| 35 / 20 | +45 | +18 | +20 | +16 | +43 | +2 | +20 | +9 | -5 | 0 |
| 30 / 30 | +45 | +11 | +9 | +5 | +17 | +2 | +9 | +4 | -3 | 0 |
| 30 / 25 | +43 | +5 | +9 | +3 | +17 | +2 | -5 | +4 | -3 | 0 |
| 30 / 20 | +42 | -2 | +2 | +1 | +18 | +2 | -10 | +4 | -3 | 0 |

Chosen: Greater Draught 35%, Riftglass Ward 25%. 30% equals the Healing Draught (not allowed), 35 is the lowest heal that is still better; 20% for the Ward equals the Ward Charm and would make the Riftglass Ward pointless. 35 / 25 puts the Colossus inside the band for every class and the Warden for Assassin and Mage; Ranger is +32 (2 over, inside seed noise of about 6). Warrior (+43) and Cleric (+45) stay over at the Warden whatever heal and Ward are used.

Finding: the Warrior and Cleric excess is NOT the heal or Ward number. At Greater Draught 30% and Ward 20% (the same values as the Healing Draught and Ward Charm) the crafted Warrior still wins 97 against 55 plain. The cause is the Greater Draught default rule: it drinks at hero HP at most 30%, the Healing Draught rule at 40%. With the Greater Draught rule also at 40% the 30 / 20 gap is exactly 0 for every class and elite. So the later, riskier trigger is worth about +40 points to Warrior and about +20 to Cleric. Option for the user, NOT applied (rule thresholds are outside the approved levers): raise the Greater Draught rule to hero HP at most 40%. Measured with that rule (seed 1, 60 runs, Warden gap W / A / R / M / C, Colossus A): 35 / 25 at 40% gives +22 / +36 / +29 / +20 / +23, Colossus Assassin +24; at 35% rule gives +45 / +28 / +27 / +23 / +35.

Part 7b (user decision 2026-11-09): the Greater Draught default rule now fires at hero HP at most 40% (was 30%), matching the Healing Draught row. Only new heroes get it; heroes who already received the row at 30% keep it. Measured by the implementer (seed 1, 60 runs) before applying: Warden gap W +22 / A +36 / R +29 / M +20 / C +23, Colossus Assassin +24. The Assassin is expected over the +30 ceiling (+36) and is accepted for now; acceptance (seeds 1-3 x 100, crafted prepared wins, mean; gap over plain prepared 52 / 42 / 54 / 48 / 45): Warden Warrior 77 (+25), Assassin 79 (+37), Ranger 81 (+27), Mage 69 (+21), Cleric 64 (+19); Colossus Warrior 100 (0), Assassin 76 (+23), Ranger 96 (+9), Mage 100 (0), Cleric 100 (0). Every cell is inside the +30 band except the Assassin at the Warden (+37), accepted for now.

Applied 2026-11-09: Greater Draught 35%, Riftglass Ward 25% (`src/content/skills.ts`, `src/content/supplies.ts` text, `supplies.test.ts`). Measured after (seeds 1-3 x 100 runs, mean; plain prepared > crafted prepared wins %, gap; before-gaps from the baseline and the Assassin fix: Warden W +21 (older), A +58, R +45, M +50, C +52; Colossus A +45):

| Elite | Warrior | Assassin | Ranger | Mage | Cleric |
| --- | --- | --- | --- | --- | --- |
| Warden | 52 > 99 (+47) | 42 > 72 (+30) | 54 > 85 (+31) | 48 > 72 (+24) | 45 > 83 (+38) |
| Colossus | 100 > 100 (0) | 53 > 73 (+20) | 87 > 95 (+8) | 100 > 97 (-3) | 100 > 100 (0) |
| Reaver | 100 > 100 | 100 > 99 | 100 > 100 | 100 > 100 | 100 > 100 |

Causeway-geared crafted tier (`--matrix warden`, seeds 1-3, wins): every class 100 except Mage 99 in two seeds (plain causeway tier 100). Band met for Colossus (all classes), Warden Assassin (+30, at the limit), Mage (+24); Ranger +31 is at the limit within noise. NOT met: Warden Warrior (+47) and Cleric (+38), caused by the Greater Draught rule threshold (30 against the Healing Draught 40), not by the heal or Ward value; see the finding above. Plain prepared tiers did not change.

Brew cost option (economy only, no effect on win rates): Greater Draught and Riftglass Ward cost 2 riftglass each; 3 riftglass would make a full crafted pack (3 Greater Draughts and a Ward) cost 12 riftglass instead of 8. Not applied.

### Elite pressure (Step 13.5 part 8a)

Decided 2026-11-09 (user accepted the planner's four recommendations). After parts 5B and 7 the Assassin sits at 33-53% at the Colossus and the Ranger, Mage and Cleric at 87-100%; at the Reaver every class wins 100%.

Diagnosis. A plain ramp (higher Power, shorter cooldown, more HP) cannot reach the Assassin and the Ranger without walling the Cleric, Warrior and Mage: the Assassin and Ranger kill the elite fast with little damage taken, so any number large enough to hurt them in a 50-70 second fight kills the sustain classes in the same fight (Reaver Warrior 45% at Power 60 but 10% at Power 64). What separates the classes is fight length: Assassin and Ranger finish in 40-70 s, Warrior, Cleric and Mage in 90-160 s. A late enrage punishes only the slow fights, so it is the lever that lifts the fast classes' loss without moving the slow classes much.

Rule: `timePressure` (new optional field on an enemy definition, `{ startMs, intervalMs, maxStacks, power, defense, actionSpeed }`). It reuses the pressure stacks of boss phases (§7 Fractured Warden): the first stack lands at `startMs` after the enemy spawns, then one every `intervalMs` up to `maxStacks`. Each stack multiplies Power by `power`, Armor and Resistance by `defense` and the action-speed bonus by `actionSpeed`, on top of stances. An enemy with boss phases that define pressure cannot also have `timePressure`. Stances previously dropped pressure stacks on every switch (and a stack dropped the stance); the stance numbers now take the pressure scales, so Power during Assault is base x 1.25 x power^stacks. A scale of 1 multiplies exactly, so the Echo Knight, Warden and the other stance enemies are unchanged.

Enrage numbers for both elites are the Warden's per-stack numbers: every 3 s, up to 10 stacks, x1.1 Power, x0.95 Armor and Resistance, x1.05 action speed. Only the start differs.

Start numbers (planner scratch emulation, seed 1 x 40-60, prepared tier):

| Elite | Change | Prepared W / A / R / M / C (approx.) | Over-levelled |
| --- | --- | --- | --- |
| Colossus | action time 2.64 to 2.2 s, Breaker Wave interrupt 8% to 4% of max HP, enrage from 140 s | 57-85 | at least 85 |
| Reaver | Power 44 to 60-62, Rift Surge cooldown 12 to 8 s, enrage from 90 s | W 33-45, A 75-88, R about 100, M 65-90, C 65-75 | 93-100 |

The Ranger at the Reaver is accepted at about 100% (the blind Ranger there is about 10%, so Fade Back and the interrupt rules still matter). Cliffs are steep, so the sweeps below re-tune once if the acceptance misses.

Sweeps (seed 1 x 60) and results are recorded below as each part is measured.

Colossus sweep (2026-11-09, seed 1 x 60, rules mode, enrage from 140 s, `timePressure` patched in memory). Cells are prepared wins % for Warrior / Assassin / Ranger / Mage / Cleric. Over-levelled was 100 for every class in every row (band: at least 85).

| Action time | Interrupt | Prepared W / A / R / M / C |
| --- | --- | --- |
| 2.1 s | 4% | 65 / 57 / 88 / 55 / 47 |
| 2.1 s | 5% | 63 / 37 / 78 / 45 / 48 |
| 2.2 s | 4% | 82 / 57 / 65 / 85 / 67 |
| 2.2 s | 5% | 80 / 52 / 53 / 83 / 68 |
| 2.3 s | 4% | 92 / 82 / 82 / 80 / 68 |
| 2.3 s | 5% | 92 / 58 / 70 / 70 / 68 |

Enrage start at 2.2 s and 5% (prepared W / A / R / M / C): 130 s 80 / 52 / 53 / 83 / 20; 140 s 80 / 52 / 53 / 83 / 68; 150 s 80 / 52 / 53 / 83 / 90. Only the Cleric (fights of about 160 s) moves with the start, and steeply: 130 s is a wall, 150 s is above the band.

Chosen for the Colossus: action time 2.2 s, Breaker Wave interrupt 5% of max HP, enrage from 140 s. Every class is inside 40-85 prepared with the most margin (2.2 s and 4% leaves the Mage on the 85 edge; 2.1 s lets the Ranger reach 88). Applied 2026-11-09 (`src/content/enemies.ts`: `overrides.actionTime` 2.2, `interruptMaxHpFraction` 0.05, `timePressure` via `eliteEnrage(140_000)`).

Colossus acceptance (`--matrix elites`, seeds 1-3 x 100, rules mode; mean of the seeds, individual seeds in brackets):

| Class | Arrived | Prepared (band 40-85) | Over-levelled (at least 85) | Prepared crafted (gap) | Prepared blind |
| --- | --- | --- | --- | --- | --- |
| Warrior | 0 | 74 (80, 74, 69) | 100 | 97 (+23) | 37 |
| Assassin | 0 | 57 (50, 63, 59) | 100 | 76 (+19) | 64 |
| Ranger | 0 | 65 (58, 69, 67) | 100 | 85 (+20) | 12 |
| Mage | 0 | 67 (75, 68, 59) | 100 | 85 (+18) | 49 |
| Cleric | 0 | 59 (62, 56, 59) | 100 | 73 (+14) | 89 |

Bands met for every class: prepared inside 40-85, over-levelled 100, arrived 0, crafted minus plain at most +30. Seeds differ by up to 16 points in mid-band cells (Warrior 11, Assassin 13, Ranger 11, Mage 16, Cleric 6): with 100 runs and a win rate near 60% the binomial spread of three seeds is about 8-10 points, so the "within 8 points" check is met only for the Cleric; the mean of three seeds stays in band for all five. The blind Cleric (89) beats the rules Cleric (59) under the enrage; see the telegraph record.

Colossus guards (seed 1): `--matrix causeway` (60 runs) differs from before only in the Colossus column (every regular fight stays 100% and every mixed-fight HP-lost value is identical); `--matrix warden` (40 runs) and the reference CSV (100 runs) are byte-identical to before (apart from the runs/sec line); `--matrix elites` differs only in Colossus rows. Crafted minus plain stays at most +30 (see the table).

Reaver sweep (2026-11-09, seed 1 x 60, rules mode, `timePressure` patched in memory; the Reaver action time is unchanged). Cells are prepared wins % for Warrior / Assassin / Ranger / Mage / Cleric. Over-levelled was at least 93 for every class in every row. Band: 40-85 prepared (Ranger accepted at about 100), over-levelled at least 85.

| Power | Rift Surge cooldown | Enrage | Prepared W / A / R / M / C |
| --- | --- | --- | --- |
| 58 | 8 s | 90 s | 63 / 85 / 97 / 98 / 87 |
| 58 | 9 s | 90 s | 88 / 97 / 100 / 98 / 78 |
| 60 | 8 s | 90 s | 38 / 87 / 95 / 88 / 75 |
| 60 | 9 s | 90 s | 70 / 95 / 100 / 88 / 70 |
| 62 | 8 s | 90 s | 35 / 68 / 98 / 72 / 73 |
| 62 | 9 s | 90 s | 52 / 88 / 100 / 70 / 63 |
| 62 | 8 s | 85 / 95 / 100 s | 35 / 68 / 98 / 72 / 58, 80, 93 |
| 62 | 9 s | 85 / 80 s | 52 / 88 / 100 / 70 / 45, 18 |
| 63 | 9 s | 90 s | 55 / 87 / 100 / 68 / 67 |
| 64 | 9 s | 90 s | 47 / 85 / 100 / 63 / 73 |
| 65 | 9 s | 90 s | 47 / 72 / 100 / 50 / 63 |
| 64 | 10 s | 90 s | 47 / 85 / 100 / 67 / 73 |
| 66 | 10 s | 90 s | 30 / 78 / 100 / 52 / 48 |

Reading: the Assassin and Warrior fights end before the enrage (about 37 s and 70 s), so only Power and the cooldown move them; the enrage start moves only the Cleric (fights of about 105 s), steeply (80 s: 18, 90 s: 63-73, 100 s: 93). Inside the planned range (Power 58-62, cooldown 8-9 s) no row puts the Assassin and the Warrior in band together (62 / 8 s: Warrior 35; 62 / 9 s: Assassin 88). Power 65 with a 9 s cooldown and the enrage at 90 s does (outside the planned Power range, reported): Warrior 47, Assassin 72, Ranger 100, Mage 50, Cleric 63.

Chosen for the Reaver: Power 65, Rift Surge cooldown 9 s, enrage from 90 s. Applied 2026-11-09 (`src/content/enemies.ts`: `overrides.power` 65, Rift Surge `cooldownSeconds` 9, `timePressure` via `eliteEnrage(90_000)`). Power 65 is outside the planned 58-62; no point inside the range puts the Warrior and the Assassin in band together.

Reaver acceptance (`--matrix elites`, seeds 1-3 x 100, rules mode; mean of the seeds, individual seeds in brackets):

| Class | Prepared (band 40-85) | Over-levelled (at least 85) | Prepared crafted (gap) | Prepared blind |
| --- | --- | --- | --- | --- |
| Warrior | 42 (48, 38, 40) | 100 | 68 (+26) | 1 |
| Assassin | 76 (76, 79, 72) | 94 | 85 (+9) | 50 |
| Ranger | 99 (99, 100, 98) | 100 | 99 (0) | 14 |
| Mage | 45 (49, 40, 46) | 96 | 73 (+28) | 26 |
| Cleric | 57 (62, 53, 57) | 100 | 70 (+13) | 91 |

Bands met: prepared inside 40-85 for Warrior, Assassin, Mage and Cleric, the Ranger accepted at about 100 (blind Ranger 14, so Fade Back and the rules still decide the fight); over-levelled at least 94 for every class; crafted minus plain at most +30 (Mage +28 is close). The Warrior (seed 2: 38) and the Mage (seed 2: 40) are at the lower edge. Seeds differ by up to 10 points (Warrior 10, Mage 9, Cleric 9, Assassin 7, Ranger 2); the mean of three seeds is in band for all five.

Reaver guards (seed 1): `--matrix hollows` (60 runs) differs from before only in the Reaver column (every regular fight stays at 100% and every mixed-fight HP-lost value is identical); the reference CSV (100 runs) and `--matrix warden` (40 runs) are byte-identical to before apart from the runs/sec line, since neither fights the Reaver.

Telegraph check (Step 13.5 part 6, recorded 2026-11-09 from the same runs; prepared tier, rules minus blind wins in points, then HP lost points saved by the rules; positive means the rules hero does better):

| Elite | Warrior | Assassin | Ranger | Mage | Cleric |
| --- | --- | --- | --- | --- | --- |
| Colossus wins | +37 | -7 | +53 | +18 | -30 |
| Colossus HP lost | +7 | -2 | +15 | +4 | -16 |
| Reaver wins | +41 | +26 | +85 | +19 | -34 |
| Reaver HP lost | +9 | +14 | +51 | +5 | -17 |

Target (rules beat blind by at least 10 win points and at least 8 HP points for every class with an answer skill): met by the Warrior, Ranger and Mage on wins at both elites (HP only partly: Warrior Colossus +7, Mage +4 and +5), and by the Assassin at the Reaver. NOT met: the Assassin at the Colossus (-7), and the Cleric at both elites (-30 and -34 wins). Reading: under the late enrage the Cleric's telegraph rows (spend on a telegraph, hold Mend for it) make a slow fight slower, so the blind Cleric, who just attacks and heals, wins more; the Cleric rules are left unchanged by decision (the user accepted this). The single-action interrupt mechanic was not built (not approved). The planner's preview (Reaver W +40, A +17, R +92, M +27, C -20; Colossus W +45, A -18, R +38, M -3, C -30) matches within noise.


### Automation

Each loadout supports up to 12 ordered priority rows for its equipped active skills (four, or five with the Fifth Skill Slot, §10).

When the hero is ready to act:

1. Evaluate rows from top to bottom.
2. A row is eligible only when its skill is equipped, off cooldown, affordable, valid for the current equipment/state, and has a valid target.
3. All conditions inside the row must pass.
4. Use the first passing row.
5. The same skill may appear in multiple rows with different condition sets, providing simple OR behavior without a logic-expression editor.
6. If no row passes, use the class fallback: a weapon basic attack, or Arcane Bolt for Mage when affordable.
7. A Mage unable to afford Arcane Bolt waits until Mana regeneration or another configured rule makes an action eligible.
8. A rule kept from an earlier life whose skill the hero has not relearned is "waiting" (Step 13.37): it is left out of every fight, so it never shadows a later rule.

Supported hero conditions:

- HP percentage
- Class resource amount/stacks
- Barrier amount or active state
- Own status presence, absence, stacks, and remaining duration
- Equipped special-ammunition count

Supported enemy conditions:

- Enemy count
- Target HP percentage
- Target type or rank
- Target status presence, absence, stacks, and remaining duration
- Mark state
- Boss phase

Rules can inspect telegraphed enemy-action tags and time until resolution, enabling automated defensive, interrupt, and control responses.

A row with a `telegraph` condition ('present' or 'at most') or an `interruptible` 'present' condition watches every living enemy, not only the row's picked target. Its focus becomes the enemy whose visible telegraph matches, the soonest-resolving first and then the lowest slot, and that overrides the row's target priority. If no enemy matches, the row behaves as before (it is checked against the picked target only). Rows with 'absent' conditions are unchanged. Decided 2026-11-07 (Step 12.3): with two enemies in a fight, a heavy attack from the one in the back slot must still be answered by a Shield Brace, a Ward or an interrupt.

Conditions use contextual versions of:

- Below / at most
- Above / at least
- Equal / not equal
- Present / absent

Each row can override the global target priority. Initial priorities:

- Current target
- Lowest or highest HP percentage
- Lowest Armor
- Lowest Resistance
- Most dangerous
- Marked
- Acting soonest
- Random

Priorities that require unrevealed information are unavailable until that information is known. Exact threat scoring for `Most dangerous` remains open.

Combat remains automation-first, but the player may manually queue a currently ready skill for the next action. Manual override:

- Has no extra cost or timing bonus.
- Does not interrupt the current action.
- Bypasses configured priority-row conditions but not skill eligibility, resource, equipment, cooldown, or target requirements.
- Cancels with a clear log entry if it becomes ineligible before the next action.

Priority rules may be edited during combat. Changes take effect at the next action evaluation and are logged. Offline simulation uses the last saved rule set.

#### Rule stacks

Decided 2026-11-15 (Step 13.8). A stack is an extra named set of priority rows over the same equipped skills, with a "switch when" trigger. The hero's existing priority rows are the **Default stack**: no trigger, the fallback.

- Limits: up to 3 extra stacks (`MAX_RULE_STACKS`, 4 counting Default), each with 0 to 12 rows under today's row rules. A stack has an id (never `default`), a name of 1 to 20 characters, a `when` list and its rows.
- Stacks never swap equipped skills. Cooldowns are shared across stacks. Stacks use the hero's `targetPriority`. Rows may only name known skills; an unequipped skill is skipped as it is today.
- `when` uses the same condition vocabulary as rows; all must pass. An empty `when` means the stack can only be picked by hand.
- Evaluation: once per hero action evaluation, before the manual queue, a pure pick (never touches the RNG) chooses the stack whose rows are walked. Heroes without extra stacks skip it entirely and behave exactly as before. The wait check (`waitingCanAct`) runs the same pick without committing anything.
  1. Manual: if a manual pick names an existing stack (Default included) it wins, reason `manual`.
  2. Otherwise the candidate is the first extra stack, in list order, with a non-empty `when` that fully passes; if none, Default.
  3. Target-reading triggers check the stack focus: the enemy in `currentTargetId` if alive, else the lowest-slot living enemy (no target picking, no RNG). Watch conditions (telegraph present or at most, interruptible present) check every enemy.
  4. Hysteresis: a candidate higher in the list than the active stack switches at once. A lower one (Default included) switches only once 2 seconds (`STACK_HOLD_MS` = 2000 ms) have passed since the last switch; otherwise the active stack stays and nothing is logged. The first evaluation of a fight has no hold.
  5. A change of stack logs one `stackChanged` event: `trigger` (detail: the new stack's trigger, e.g. "enemy count at least 2"), `fallback` (detail: why the stack it leaves no longer passes, e.g. "enemy count 1 is below 2"), `manual` or `manualCleared`.
- Switching is free: no action time, cooldown or resource. It happens only at an action evaluation and never changes the action being resolved. A queued manual skill still goes first; the class fallback is unchanged.
- Manual override: a hand pick takes effect at the next action evaluation and lasts until Auto is chosen or the fight ends (each fight starts with no manual pick). Clearing it applies the automatic pick at once with no hold.
- Editing stacks in a fight (`setRuleStacks`) is logged like a rules change. If the active stack was deleted the hero falls back to Default; a deleted manual stack clears the manual pick; a stack list that fails to parse is rejected and the old stacks stay.
- A combat saved before stacks existed has none and loads as before. Saving, the editor, the fight controls come in later parts; reincarnation keeps stacks (Step 13.37).

#### Rule chain view and templates

Decided 2026-11-16 (Step 13.13, user approved the planner's defaults). Presentation and starter scaffolds only: the saved rows, stacks, validation and the sim are unchanged.

- **Chain view.** The editor shows one chain at a time (Default or one stack) as an ordered list of rule nodes joined by "else" connectors, ending in a non-interactive Fallback node. A node reads: the number and skill name (primary), the rule sentence and target override (secondary), and a "Used N×" slot (tertiary, always reserved, "—" with no data). A row with no conditions shows "Always when ready". When an earlier unconditional row names the same skill, the later row says it is shadowed (it can never be reached). Tapping a node opens it in place into the existing skill, target and condition controls with Move, Duplicate and Remove; one node is open at a time. Remove offers an inline Undo. Add rule sits before the Fallback and is off at 12 rules, with the reason.
- **Fallback node.** What the hero does when no row passes: a weapon basic attack, except the Mage, who casts Arcane Bolt when it is affordable and ready and otherwise waits for Mana.
- **Stack router.** When extra stacks exist, one row per stack in priority order shows its trigger sentence, an Auto or Manual only tag and the fire count, ending in "Otherwise: Default". Each row selects that chain. The stack card (name, Switch-when editor, Move, Duplicate, Delete with confirm) stays above the selected chain.
- **Fire counts.** "Used N×" counts `priority` events with decision `use` for that row in the fight currently running, attributing rows to a stack by walking `stackChanged` events. Without a log it reads "—". Nothing is saved.
- **Templates are scaffolds, never solutions.** Every template has at least one blank (an empty threshold that validation refuses to save, or an empty skill slot with a hint) and a one-line trade-off on its card. A template uses only the hero's own skills (`ruleSkillIds`); a row naming a skill the hero lacks becomes a blank slot with a generic hint that names no other skill. At most 4 rows and at most one condition per row. Applying a template writes into the draft only (a new stack for a stack template; the selected chain's rows for a rows template, with a confirm when those rows are not empty); nothing is saved until Save rules, and the result keeps no link to the template.
- **Unlocks** come from existing save fields only: the hero's `defeatedEnemyIds` and the account's defeat records read through the enemy definitions, never a new save field. Each class has 1 to 2 templates open from the start. "Top up Readiness" (Step 13.41) is the Ranger's second open template: row 1 uses Hunter's Mark when Readiness is at most 60 (the measured HM-R row, §10 "Hunter's Mark grants Readiness (Step 13.40)"), row 2 is a blank slot. A Ranger who has not learned Hunter's Mark gets a blank slot with the generic hint, like every other template. Locked cards are disabled and show the unlock hint.

| Template | Class | Kind | Blank | Trade-off | Unlock |
| --- | --- | --- | --- | --- | --- |
| Fury engine | Warrior | rows | Fury threshold | No guard and no heal. | open |
| Hold the line | Warrior | rows | telegraph time, HP threshold | Safe, but nothing deals damage until you add it. | defeat an enemy that telegraphs |
| Mark then cut | Assassin | rows | payoff skill slot | Steady damage with no finisher. | open |
| Many blades | Assassin | stack | enemy count | Wastes Mark and has no finisher. | defeat a swarm enemy (group fight) |
| Open strong | Ranger | rows | Readiness threshold, skill slot for when it runs dry | Strong opener, then nothing planned. | open |
| Top up Readiness | Ranger | rows | skill slot for when Readiness is high | Only refills Readiness: the damage rows are yours to add. | open |
| Don't get hit | Ranger | stack | telegraph time | Only dodges and traps, no damage. | defeat an enemy that telegraphs |
| Mana budget | Mage | rows | Mana thresholds | No area damage and no ward. | open |
| Crowd burn | Mage | stack | enemy count | Burns Mana with no recovery row. | defeat a swarm enemy |
| Patient vow | Cleric | rows | HP threshold | Lasts long, kills slowly, no Faith plan. | open |
| Boss turn | any | stack | skill slot | Starts empty: you decide the boss plan. | defeat a boss that has phases |

### Provisional MVP active skills

These are a first broad roster for mechanical review. Names and effects are not final.

#### Warrior

1. Driving Blow: 130% Physical Power (Step 13.5, was 110%); generates the ordinary 5 Fury plus 10 additional Fury; 3-second cooldown; 1.0× action time.
2. Cleave: costs 25 Fury; deals 80% Physical Power to every enemy; 5-second cooldown; 1.15× action time.
3. Reckless Strike: requires a two-handed weapon; costs 40 Fury; deals 220% Physical Power; 8-second cooldown; 1.35× action time; increases incoming damage by 20% until the Warrior's next action.
4. Shield Brace: requires a shield; no Fury cost; reduces incoming damage by 40% (Step 13.5, was 30%) until the Warrior's next action; being struck during the effect generates 5 base Fury; 8-second cooldown; 0.75× action time.
5. Second Wind: costs 50 Fury; heals 10% maximum HP (Step 13.5 targeting fix part 5; 15% in part 3 and briefly 30% in the superseded part 2) plus 50% Healing Power; 15-second cooldown; 1.0× action time.
6. Sundering Blow: costs 20 Fury; deals 150% Physical Power (Step 13.5, was 125%); applies 30% Armor Expose (was 20%) for 8 seconds; 6-second cooldown; 1.0× action time.

#### Assassin

1. Mark for Death: no damage or resource cost; apply Mark for 8 seconds; 6-second cooldown; 0.5× action time.
2. Shadow Cut: 110% Physical Power; gain one Advantage when the target is Marked, subject to the one-trigger-per-action cap; 3-second cooldown; 0.8× action time.
3. Venom Edge: 90% Physical Power; apply one Poison stack whose tick deals 12% of snapshotted Physical Power; 4-second cooldown; 0.9× action time. Retired in 13.39 (kept hidden for old saves): the Envenomed strikes passive replaced it.
4. Smoke Step: gain +30 Evasion until the next Assassin action; successful Evasion uses the normal Advantage trigger; 8-second cooldown; 0.5× action time.
5. Fan of Knives: 70% Physical Power to every enemy; 6-second cooldown; 1.1× action time. Venom-web nodes may add Poison interactions.
6. Execute: consume all Advantage; deal `100% + (40% × consumed stacks)` Physical Power, then multiply by `1 + (0.5 × target missing-health fraction)`; 8-second cooldown; 1.1× action time. A critical Execute may generate one new Advantage through the normal critical trigger.

#### Ranger

1. Hunter's Mark: no Readiness cost; reveal target defenses and traits for the encounter and gain 20 Readiness; 8-second cooldown (5 until Step 13.40); 0.5× action time.
2. Aimed Shot: costs 40 Readiness; deals 304% Physical Power (180% until 2026-11-03); 5-second cooldown; 1.2× action time.
3. Volley: costs 30 Readiness; deals 65% Physical Power to every enemy; 6-second cooldown; 1.2× action time.
4. Snare Trap: costs 25 Readiness; arm one trap that triggers on the target's next action with a 75% base Stun chance; 8-second cooldown; 1.0× action time. Only one Ranger trap can be armed at a time.
5. Piercing Arrow: costs 20 Readiness; deals 220% Physical Power (130% until 2026-11-03); adds 30 percentage points of Armor penetration, subject to the total penetration cap; 5-second cooldown; 1.0× action time.
6. Flame Arrow: costs 20 Readiness and one special arrow; deals magical damage equal to 100% Physical Power; applies one Burn intensity whose tick deals 10% of snapshotted Physical Power; 6-second cooldown; 1.0× action time.
7. Fade Back: no Readiness cost; gain +30 Evasion until the next Ranger action, and ready a dodge: the next enemy skill with a damage effect that would hit the Ranger within 3 seconds deals no damage and applies none of its statuses, then the dodge is spent (an enemy skill may set a dodged-damage share, so that part of the damage still lands; only the Hollowmaw Reaver's Rift Surge does, at 0.6); 16-second cooldown; 0.5× action time. The dodge was added and the cooldown raised from 8 seconds on 2026-11-03, because skills never roll to hit, so Evasion alone could not answer a telegraph. Measured at seed 1, 40 runs, nodes 0/6/9: Rootmaw at level 14 15/45/45% to 75/85/85%, Echo Knight at level 16 0/0/0% to 18/33/33%, Echo Knight at level 20 50% to 100%. Added 2026-11-03 so a Ranger can answer a telegraph; the Ranger's arrows were raised 30% in the same change. Measured at seed 1, 30 runs: a level-20 Ranger beats the Rootmaw 73% at 0 nodes and 87% at 9 nodes (33% and 60% before). The Echo Knight still beats it (0%).

#### Mage

1. Arcane Bolt: costs 5 Mana; deals 90% Magical Power as Arcane damage; no cooldown; 0.8× action time.
2. Fireball: costs 30 Mana; deals 100% Magical Power as Fire damage to every enemy; applies one Burn intensity whose tick deals 12% of snapshotted Magical Power; 6-second cooldown; 1.2× action time.
3. Frost Lance: costs 20 Mana; deals 110% Magical Power as Frost damage; applies one Chill; 4-second cooldown; 1.0× action time.
4. Chain Lightning: costs 25 Mana; deals 120% Magical Power to the first target and each jump deals 75% of the previous hit, up to four targets; each hit pushes that target's next action 0.25 seconds later; 6-second cooldown; 1.1× action time.
5. Mana Ward: costs 30 Mana; creates a pre-mitigation barrier equal to 65% Magical Power (Step 13.5, was 100%) for up to 8 seconds; 10-second cooldown; 0.75× action time.
6. Arcane Recovery: restores 30 base Mana before Spirit; 10-second cooldown; 1.0× action time; may use a configurable Mana threshold.

Elemental-charge and prepared-casting keystones modify how this base kit is paid for and sequenced.

#### Cleric

1. Smite: no Faith cost; deals 130% Magical Power (Step 13.5, was 100%); 3-second cooldown; 1.0× action time.
2. Mend: costs 25 Faith; heals 120% Healing Power; 5-second cooldown; 1.0× action time. Since 2026-11-04 it also removes one Poison or Bleed from the hero, every stack of it, Bleed first. Measured the same day (built Cleric, 40 runs, 0/3/6/9 nodes): Rootmaw 3/100/100/100% (was 0/0/93/93%), Echo Knight 90/100/100/100% (was 87/100/100/100%). The user kept it as is (2026-11-06): the Cleric's answer to Poison and Bleed is part of its identity.
3. Ward: costs 30 Faith; creates a pre-mitigation barrier equal to 150% Healing Power for up to 8 seconds; 10-second cooldown; 0.75× action time.
4. Consecration: costs 40 Faith; creates one 8-second field that ticks every 2 seconds for 35% Magical Power damage and 25% Healing Power recovery; 15-second cooldown; 1.2× action time. Recasting replaces and refreshes the existing field.
5. Judgment: costs 40 Faith (Step 13.5, was 50); deals 250% Magical Power (was 200%); 10-second cooldown; 1.2× action time.
6. Penance: directly consumes 10% maximum HP, bypassing barriers and Defense, to generate 25 base Faith; cannot be fatal; 10-second cooldown; 1.0× action time.

The Grace/Wrath keystone changes the costs and payoffs of this base kit.

The default interface should remain approachable while the detailed log provides deep analysis.

### Combat feedback

The filterable log should expose:

- Damage and healing calculations
- Accuracy, evasion, critical, and variance rolls
- Buffs, debuffs, and status changes
- Skill-priority rule evaluation and triggers
- Resource changes
- Retreat attempts
- The sequence of causes leading to defeat

Part 5 (user decision 2026-11-08): Second Wind `maxHpFraction` 0.15 to 0.10, because the Warrior's Warden prepared win rate was 79% (band 30-70%). The planner/implementer measured 10% at seed 1, 60 runs: Warden prepared 55%, over-levelled and Causeway-geared 100%. Result (seeds 1-3 x 100, rules mode, Warrior): Warden prepared 47 / 51 / 58 (mean 52, in the 30-70 band; seed span 11, over the 8-point limit), over-levelled 100 / 100 / 100, Causeway-geared 100 / 100 / 100. Built-matrix guard (seed 1, 100 runs, 6 nodes, HP lost %): Warrior Rootmaw 75 (wins 95) and Echo Knight 64 (wins 100), back to the pre-Step-13.5 values of about 76 and 64, so the guard holds; Cleric unchanged at 42 and 42. The Assassin (18% prepared) is not changed by this part.


## 8. Expedition Risk, Retreat, and Defeat

### Retreat

- The player configures automatic retreat thresholds.
- Reaching a threshold starts an escape attempt; escape is not guaranteed.
- Enemies continue acting while escape is attempted.
- A failed attempt can retry after a cooldown while its condition remains active.
- Escape chance depends on the hero, enemy, zone, and relevant supplies.
- On success, the return journey is safe.
- Offline simulation follows the same rules.

First-playable escape, decided 2026-10-24:

- The starting threshold is hero HP at most 40% of maximum HP. No threshold means no attempt.
- The check runs after each combat step. It does not spend the hero's action or move a scheduled action.
- If that step already ended the fight, no escape is rolled.
- Chance is 50% plus `floor(Agility / 5)` percentage points, capped at +20 points. A packed Smoke Bomb adds 15 points (see Inventory). Enemy, zone, and momentum add 0 until those modifiers exist. Press the Trail's escape bonus is a class node, not this base chance.
- The roll is one expedition `nextFloat`, compared with `<` against that chance. It does not use the combat RNG.
- A failure waits 8 seconds of that fight's clock. Another roll happens only while the threshold is still met. Leaving the threshold does not erase the remaining wait.
- Success abandons the fight with no loot and no momentum gain. The same 20-second safe walk as a chosen return starts at once. Loot stays unsecured until arrival, which then secures it and sets momentum to 0.
- The attempt is a combat log line with the roll, the chance, Agility, and each bonus.

### Risk and reward

Pushing farther is encouraged through:

- Expedition momentum that improves rewards across consecutive victories.
- More valuable resource nodes deeper along routes.
- Boss progress that can be lost or delayed by retreating early.

Expedition momentum:

- Momentum uses 0-5 visible stacks.
- Gain one stack after each completed regular encounter and two after an elite encounter, capped at 5.
- Each stack grants +5% unsecured enemy-material quantity and +2 percentage points to the chance of finding a rare route resource node.
- Momentum does not increase XP.
- Returning to town, successful retreat, defeat, or reincarnation resets momentum to 0.
- Class nodes such as Ranger Pathfinder can convert momentum into combat or escape benefits.

A retreat removes no boss progress in the first playable, because no boss-progress counter exists yet. How much a later counter loses remains open.

### Defeat

- A substantial rescue and recovery delay prevents defeat from becoming fast travel.
- Unsecured expedition loot is lost.
- Equipment suffers durability damage.
- Equipment at zero durability is disabled until repaired, never destroyed.
- Supplies actually consumed during the expedition remain consumed.
- Unused carried consumables are retained.
- Deposited gold is safe.
- Defeat incurs a rescue fee; if the hero cannot pay it, the hero enters debt.

First-playable defeat, decided 2026-10-24:

- Unsecured materials are destroyed. Secured materials stay. Overflow already lost stays recorded. Momentum and the stored rare-node chance become 0.
- Each equipped piece, including both accessories and an off-hand, starts at 100 durability and loses 10 on defeat. The loss stops at 0. A piece at 0 stays equipped and is marked disabled. Nothing is destroyed. This mark does not change the fight that was just lost.
- A slot that holds an item still holds it after defeat, and items already consumed stay consumed. Unused supplies go back to the hero's stash when the run is settled, after a return or a defeat.
- The rescue fee is 25 gold, paid from gold the hero is carrying. Unpaid gold is added to debt. Debt is only stored. Deposited gold is not spent. Soul Debt's extra 50% is a racial node, not this base fee.
- The hero must wait 30 seconds before the next expedition (it was 5 minutes until 2026-11-16; playtest: too punishing on top of the rescue fee, lost loot and durability loss). The wait is stored on the defeat. It does not tick inside the lost expedition.

Durability carry-through, decided 2026-11-13 (playtest fix):

- A run starts with each piece at the durability the saved item has, not at 100. Settling writes the end value back, so wear accumulates until the player repairs the piece. Reincarnation is the exception: every kept piece is restored to full durability. The harness has no saved items and still starts every piece at 100.
- A run cannot start while any equipped piece is disabled (durability 0), or while the 30-second recovery after a defeat has not passed. The refusal names the piece or the minutes left. This holds for a live start and for an away start.
- The recovery wait is stored on the hero as the time it ends, set when the defeated run is settled.

Gear wear in normal play, decided 2026-11-16 (user):

- Every equipped piece loses 1 durability for each 3 fights won in the run. A won elite or boss fight counts as 2 fights. Wear points are `victories + elite or boss victories`, and the loss is `floor(points / 3)` of the whole run, so there is no per-fight rounding drift: 2 wins = 0, 3 = 1, 2 wins + 1 elite = 1 (4 points), 25 wins = 8. Constants: `WEAR_FIGHTS_PER_POINT = 3`, `WEAR_ELITE_WEIGHT = 2` (persist, not sim).
- Wear is applied only when the run is settled (safe return, retreat, or defeat), never during the run, so a fight never changes mid-run and the harness (which starts every piece at 100 and never settles) is unaffected. Away and offline runs settle through the same code and wear the same way.
- On a defeat the flat 10 loss stays and wear stacks with it (wear counts the fights won before the defeat). Durability stops at 0, and a piece at 0 is disabled as before. A run with no victories wears nothing.
- Why: repair should be a routine gold cost of playing, not only a penalty for dying. Repair prices are unchanged (`repairCost`). The defeat penalty is unchanged.

### Batch C: loot safety, bag, rules, modifiers (decided 2026-11-07)

Safe pouch (replaces the "send loot home" idea; there is no courier):

- The pouch is not extra space. It marks the most valuable part of what the hero already carries as protected. Protected room is 5.
- Value order: rarer material first, then larger quantity. It re-sorts after every fight, so the player does nothing and offline runs work the same way.
- On defeat, the protected part is kept and goes to secured materials with the rest of the run settlement. Only the unprotected part is destroyed. Retreat and safe return keep everything, as before.
- The bag tooltip says what is lost: "Lost if you are defeated, except the safe pouch" (it used to wrongly say a retreat loses loot).

Bigger bag:

- Capacity is 20, +2 at hero level 10, 20 and 30, +3 with a Hauler's modifier on worn gear, +4 with the Legacy purchase Deep Pockets (15 Legacy). Maximum 36.

When the bag is nearly full:

- "Full" means fewer than 4 free room. Hero setting `bagFullOrder`: `home` (walk home, default), `ask` (hold and wait for the player) or `keep` (decided 2026-11-17, user: keep going with a full bag, for farming XP and gold on a route whose materials are not wanted). With `keep` the bag check at a hold is skipped, so the hero pushes on as usual; loot that does not fit is lost exactly as it is when a bag fills mid-fight (older materials stay, the newest quantity that does not fit is lost), while gold, XP and momentum are unaffected. The other stop rules still win first (the per-run fight limit, the push-on HP floor, the Auto run total limit). The same decision serves live, Auto run and away runs. No courier option.

Rule conditions (new): hero HP in points, target HP in points, missing HP, skill is ready, fight time. Enemy rank and boss phase are shown in the picker. AND/OR groups are unchanged. Each rule gets a plain-language summary and a Duplicate button.

Fight controls: carried supplies can be queued for the next action in a fight. An Escape now button starts an escape attempt at once (a packed Smoke Bomb still adds its +15 points).

Modifiers (new, one modifier per item stays for now; replaced by the second-socket rule of Step 13.10, see "Gold sinks" in §9): Vicious (+10 crit damage, level 3, 75 gold, weapons and accessories), Sturdy (+4% max HP, level 6, 150 gold, armor), Hauler's (+3 bag room, level 4, 100 gold, chest armor and accessories). The same modifier counts at most twice across equipped gear (`MODIFIER_STACK_CAP = 2`).

Starting-skill node bonuses (each node keeps its unlock and gains one small bonus):

- Warrior: Sundering Blow cooldown 6 to 5 s. Shield Brace Fury on hit 5 to 10. Second Wind cooldown 15 to 12 s.
- Assassin: Venom Edge poison tick 12% to 15% (13.39: the node raises the Envenomed strikes tick T0 to T1 instead). Mark for Death grants 1 Advantage when applied. Execute base damage 100% to 120%.
- Ranger: Piercing Arrow cost 20 to 15. Snare Trap cooldown 8 to 6 s.
- Mage: Fireball cost 30 to 25. Frost Lance damage 110% to 130%. Mana Ward barrier 65% to 85% (Step 13.5; was 100% to 125%).
- Cleric: Ward duration 8 to 10 s. Judgment damage 250% to 280% (Step 13.5, was 200% to 230%).
- Check with `npm run sim -- --matrix built --seed 1 --runs 40` before and after; report the change per class.
- `bossLossThisLife` is set only when a non-summon enemy in that fight is a boss. Splintered Road enemies are not bosses.

## 9. Towns, Crafting, and Economy

### Economy

- The economy supports adventuring rather than acting as a deep market simulation.
- Players gather, buy, sell, repair, and craft.
- Regional towns have specialties, services, recipes, and predictable price differences.
- Gold can be deposited to protect it from expedition risk.

Greyhaven's places, decided 2026-11-04 (user): the town is a set of places, each with its own trade, like a real RPG town. The Weaponsmith (weapons and off-hands), the Armorer (head, chest, hands, feet), and the Jeweler (rings and charms) each buy, sell, repair, craft, and upgrade only their own kind of item. The Potion Shop sells supplies, the Trading Post buys materials, the Enchanter teaches recipes, the Contract Board holds contracts, and the Bank takes debt payments. Prices and rules are unchanged.

**Trading Post: buying materials (Step 13.28).** Decided 2026-11-18 (user: "yes, and it should cost more since it is a shortcut"). The Trading Post also sells the common materials, as a shortcut for a hero who is short a few units.
- Buy price per unit is `MATERIAL_BUY_MULTIPLIER = 5` times the sell price (`MATERIAL_BUY_PRICE`, derived from `MATERIAL_SELL_PRICE` so they cannot drift): scrap 10, shard 15, hide 15, witherbark 20, oathsteel 20 gold.
- Only the common materials are for sale (`BUYABLE_MATERIALS`: scrap, hide, shard, witherbark, oathsteel). Riftglass, duskiron and cinderite are never for sale: they stay gated by exploring the Causeway, the Hollows and the Cinder Scar, so buying cannot skip the route progression.
- No gold loop: buy is five times sell, so buying and re-selling loses four fifths of the gold (a test asserts buy > sell for every buyable material).
- Sink arithmetic: a craft or a rank II costs 6 of one material (scrap 60 gold, shard or hide 90, witherbark or oathsteel 120), an upgrade 3 (witherbark 2). Gold is the shortcut price for time spent exploring.
- Buying is refused during an expedition, for a quantity under 1, for any other material, and when the selected hero's gold is short (same gold rules as the Potion Shop; debt is not touched). Materials have no capacity limit. The UI offers Buy 1, 10 and 100 with the gold each costs.

First-playable town numbers, decided 2026-10-31:

- Gold comes from enemies. Each regular enemy drops its level × 2 gold. An elite or the boss drops its level × 3. Gold is added to the gold the hero is carrying.
- Before an expedition the player chooses how much gold to carry, with a default of 25, the rescue fee. The rest of the account's gold stays deposited and safe. On a safe return the carried gold goes back to the account. After a defeat the carried gold that is left after the rescue fee is lost.
- Greyhaven buys materials at 3 gold each (scrap 2) and buys archive items for `item level × 5 × quality`, rounded half up. Gear that came from an earlier life (`pastLifeItemIds`) pays only the carried share of that price (Step 13.31, Section 10). It sells base items at 100% quality for `item level × 10` gold at the hero's level, and the shop supplies at the prices under Inventory.
- Repair restores an item to full durability. One item costs `ceil(missing durability × (1 + item level ÷ 2) ÷ 10)` gold. A disabled item is repaired the same way.
- Debt is kept on the account and added to by each defeat. It can be paid off in any amount from the account's gold, and it still blocks nothing.

### Safe selling (Step 13.44)

Decided 2026-11-21 (user approved). UI and one pure helper only; selling, prices and the carried share are unchanged. Nothing can be undone after a sale, so the Sell list now tells kept gear from new gear and asks twice before it sells something that is easy to regret. Selling an heirloom was refused outright until 2026-11-23 (see the bullet below).

- Representation: an heirloom is an item with `heirloom: { heroId, cap }`, worn or in the archive. At reincarnation every worn piece goes to the archive and the hero's `pastLifeItemIds` lists every archive id at that moment (heirlooms included); the new starter set has new ids and is in no list. The id is dropped from the list when the item is sold.
- Groups (the Sell list and the Equipment archive): Worn (equipped pieces, a badge says which of the others it is); Heirlooms and kept gear (heirlooms; the Sell button stays off until the hero's level reaches the heirloom's cap, and the reason names that level); Earlier lives (archive pieces in `pastLifeItemIds` that are not heirlooms, paying only the carried share); Current life (everything else). The riskiest groups come first after Worn, so the new starter set is never mixed with kept gear. Every row carries a badge for its group.
- Selling an heirloom (decided 2026-11-23): `sellItem` allows it when the selected hero's level is at least the heirloom's cap (the item level it had when it was kept). The shown item level already follows the hero up to that cap, so the check uses the cap. Until then the Sell button is disabled with "An heirloom can be sold once you reach level N." Once it can be sold it still asks twice. The price is unchanged: `sellPriceFor`, so an earlier-life heirloom pays only the carried share. Selling removes the item and frees its heirloom slot.
- Two-step sell, no undo: plain current-life gear (no modifier, no socket, quality below the threshold) sells with one click. Risky gear (earlier-life gear, an item with a modifier, a socket, or quality at or above the threshold; an heirloom, once it can be sold) needs a second click: the first click turns the same button into "Confirm sell +X g" (warning style, same place, no popup), a second click sells. It goes back to "Sell" after 4 seconds, when the button loses focus, or on Escape. The accessible name changes with it. Worn pieces follow the same rule.
- Threshold: quality 1.05 (105%). Starter and shop gear is exactly 100% and a craft or upgrade can reach 90% to 120%, so a piece at 105% or more has been improved on purpose and is worth a second look. The 80% suggested while planning would have flagged every piece, because quality never goes below 90%.
- Helper: `needsSellConfirm(item, earlierIds)` in `persist/sellSafety.ts`, with `sellGroup` and `RISKY_QUALITY`.

### Crafting

- NPC artisans produce standard base items.
- Heroes customize and improve those items.
- A craft selects a base recipe, material, and one controlled modifier or rune.
- Materials define a visible quality range.
- Crafting proficiency raises and narrows the quality range.
- An upgrade always succeeds (changed 2026-11-04; it used to fail often and cost more than crafting a new item).
- Crafting uses a short queue. Since 2026-11-04 it progresses whether the hero is in town or out on an expedition, and for every hero, not only the selected one.
- Recipes and crafting proficiency persist through reincarnation.
- Item tiers and modifiers have hero-level requirements.

First-playable crafting numbers, decided 2026-10-31:

- Recipes: every base item can be made from the start. The account also knows two modifier recipes at the start (Keen and Precise). Later recipes add more modifiers. Decided 2026-11-02: the other four are bought in Greyhaven's shop for 25 gold per level the modifier needs (Nimble 75, Piercing 150, Mending 150, Quick 225). A recipe is learned once for the whole account and kept through reincarnation. Modifiers are limited by item type (decided 2026-11-02): Keen on weapons and accessories, Precise on weapons, off-hand items, and accessories, Nimble on armor and accessories, Piercing on weapons, Mending on off-hand items and accessories, Quick on weapons and accessories. Items already made keep their modifier. Upgrades work on an archive item or on an item the selected hero wears; a worn item leaves its slot for the job and returns to the same slot when the job ends (to the archive if the slot was filled meanwhile).
- Materials set the visible quality range: scrap 90% to 100%, hide 95% to 105%, shard 100% to 110%, witherbark 99% to 109%, oathsteel 101% to 111% (Step 13.2), riftglass 102% to 112% (Step 13.1). The quality roll is the average of two uniform rolls in that range. The rolls are seeded, and the seed is saved.
- Proficiency is personal to the hero and survives reincarnation. Each craft or upgrade attempt adds 1 XP. Rank is `floor(√XP)`, up to 10, and each rank raises the range's minimum by 1 percentage point, never above its maximum.
- A craft costs 6 of the chosen material plus `item level × 5` gold. The item level is at most the hero's level. It takes 30 seconds, and the queue has no limit (changed 2026-11-14, Step 13.7 batch 6 part 4; it held 3 jobs). Costs are paid when a job is queued. Only the first job advances. Time passes in town and on expeditions alike, for every hero's queue (changed 2026-11-04; before, only the selected hero's queue moved and only while no expedition ran). Crafting counts real time, so it does not depend on the combat viewer's speed or pause, and a tab in the background catches up when it returns. A closed page does not craft (offline progress is deferred).
- One modifier per craft, from the recipes the account knows, and the hero's level must reach its minimum: Keen +2 points critical chance (level 1), Precise +3 Accuracy (level 1), Nimble +3 Evasion (level 3), Piercing +3 points Armor and magical penetration (level 6), Mending +5 Healing Power (level 6), Quick +2 points cooldown reduction (level 9). Modifiers on every equipped item add together, except that the same modifier counts at most twice (Batch C, §8). Batch C adds Vicious, Sturdy, and Hauler's (their numbers are under §8).
- Chained upgrades (decided 2026-11-14, user, Step 13.7 batch 6 part 4): an item may have several +1 upgrade jobs in a row. Each job takes the usual time and cost and is checked against the item level the item will have when its turn comes (the queued item level plus the jobs already queued for it), which may not pass the hero's level. A job followed by another job for the same item hands the item on to it and does not return it to the slot or archive; the last job returns it. Qualities follow the same rule, job by job, so two chained jobs give exactly what two upgrades in a row give. "Queue all" queues +1 jobs for every worn item below the hero's level, lowest item level first, then slot order, one level at a time, for as long as the chosen material and the gold allow. There is no cancelling a job.
- An upgrade raises the level of an item the hero owns (worn or in the archive) by 1, up to the hero's level, for 3 of a chosen material (2 of witherbark, Step 13.2) plus `item level × 3` gold, in the same queue. It takes 10 seconds (`UPGRADE_MS`); a craft, a socket, an infuse, a rank-up and a pack stay at 30 seconds (decided 2026-11-21: a worn set is many upgrades, so the +1 job is the short one). It always succeeds, and the item keeps its modifier, quality, and durability. Decided 2026-11-07 (user): the material spent on an upgrade adds quality: scrap +0, hide +1, shard +2 percentage points, never above 110% (the best a craft can roll). Step 13.1 added riftglass (+3, cap 112%). Step 13.2 adds witherbark (+2, cap 110%, costs 2 units per upgrade) and oathsteel (+2, cap 111%, costs 3). Quality only ever rises through an upgrade, and an item already at 110% gains nothing from the material. Decided 2026-11-04 (user): upgrading is the cheap, safe way to keep a good item current, while crafting is for a new item or a different modifier. Cost of one more level against crafting a new item at the next level (6 materials plus `5 × (L + 1)` gold): L = 1, 3 materials and 3 gold against 6 and 10; L = 10, 3 materials and 30 gold against 6 and 55. Before this change the cost was 4 materials plus `5 × L` gold with chance `85% − 5 × L`, and a failure lost the cost.

### Gold sinks: trainer, sockets, ranks (Step 13.10, decided 2026-11-16, user)

Why: a hero around level 17 who cannot beat the Drowned Causeway replays the same route for XP and ends up with more gold and materials than can be spent, because items, upgrades and recipes are all capped by hero level. These three rules turn gold and materials into power and cut the grind. They add no new item level, no new material and no new zone. All counts below are per hero or per item, and every price is paid when the job is queued or the drill is bought.

**Trainer drills** (part 2; made timed and queueable in Step 13.11, decided 2026-11-16, user). A drill gives the hero a fraction of `xpToNextLevel(level)` XP (rounded half up, at least 1): 10% below level 10 and 20% from level 10 (`DRILL_BOOST_LEVEL = 10`, decided in Step 13.17, 2026-11-17), through the normal level-up path, so a drill that fills the level grants attribute and skill points exactly as any other XP. The n-th drill within the current level costs `level × 40 × n` gold (n = 1, 2, 3), so a level takes at most three drills (at most 30% of a level below level 10, 60% from level 10) and the three together cost `level × 240`. The count `drillsThisLevel` is saved with the hero and returns to 0 on every level-up, however the level is reached; old saves load with 0. There is no maximum hero level today, so "refused at max level" is not reachable and is not built. At level 17 a drill is 701 XP (it was 351 before Step 13.17) for 680, 1,360 and 2,040 gold. Prices do not change.

Timing (Step 13.11). A drill takes `DRILL_MS = 45,000` (45 seconds). Drills run in their own per-hero training queue, not the craft queue, so they never wait behind craft jobs. One drill runs at a time, in order, and the player may queue more while one runs.

- Paid at queue time: the gold is paid and `drillsThisLevel` goes up when a drill is queued, and the n-th drill is priced with n counting the queued ones, so the cap of three drills per level covers the running drill plus the queued ones ("Three drills already queued this level").
- XP is fixed at queue time (10% or, from level 10, 20% of `xpToNextLevel` then, rounded half up) and lands when that drill finishes, through the normal level-up path. A level-up on completion resets `drillsThisLevel` to 0; drills still queued keep their fixed XP.
- The queue advances only while the hero is at home. It pauses while the hero is on an expedition or away run (the same test that refuses a new drill today) and resumes at home. Nothing can be cancelled, as for all jobs.
- Reincarnation is refused while a drill is queued or running.
- Saved as the optional `SavedHero.training` = `{ remainingMs, queue: [{ xp }] }`: `queue` holds 1 to 3 entries including the running one, each with `xp` a whole number of at least 1, and `remainingMs` is the time left on the first (a whole number above 0, at most `DRILL_MS`). A hero with no drills has no `training`. Queueing is refused while the hero is away (as before); a queue made at home pauses when the hero leaves. A fourth drill is refused while three are queued, even after a level-up reset the count. Absent means no drills. Old saves load without it, and there is no version bump.

**Second modifier socket** (part 3). The "one modifier per item stays" rule of Batch C (§8) is replaced by a socket rule: an item holds one modifier, or two once it has a socket. `MAX_ITEM_MODIFIERS = 2`, and the item carries `socketed: true` once its socket is open.

- Unlock: hero level 10 or more to queue either job below (the level of the hero whose job it is).
- Open socket: a queued craft job, 30 seconds. Cost `item level × 40` gold plus 8 of riftglass, duskiron or cinderite (the player picks). The item can have no modifier yet; the socket does not need one.
- Infuse: a queued craft job, 30 seconds. Adds a second modifier to an item that has a socket and exactly one modifier. Cost `item level × 10` gold plus 6 of any material. Needs the recipe, `modifierFits` for the item type, the modifier's `recipeLock` satisfied, the hero's level at least the modifier's minimum level, and a modifier that differs from the item's first one. Infusing an item that already has two modifiers replaces the second one for the same cost.
- An item that is held by a queued job cannot take another socket or Infuse job until it is back (no chaining). Item level is the item level the item has when the job starts. Both jobs use the same queue as crafts and upgrades: unlimited, paid when queued, 30 seconds each (the craft time, not the 10-second upgrade), and like the other jobs they cannot be cancelled (nothing in the game can be cancelled or refunded). They work on worn items and archive items as upgrades do (the item leaves its slot for the job and returns), and keep durability, quality and heirloom status. An heirloom keeps its socket. A socket stays when the item is upgraded.
- Both modifiers count: wearing, stat bonuses, the `equipBlock` level check and the stack cap (`MODIFIER_STACK_CAP = 2` counts pieces that carry the same modifier across worn gear, for each modifier separately). `modifierCapNotes` names a modifier that is over the cap.
- Cost check: a level-17 item costs 680 gold and 8 gem materials to socket and 170 gold and 6 materials to infuse.

**Modifier ranks** (part 4). Every modifier on an item has a rank, I (the default and today's effect), II or III. A queued 30-second "Rank up" job raises one modifier on one item by one rank, in the same queue, worn or archive, with the same rules as an upgrade.

- Cost to reach II: `modifier minLevel × 30` gold plus 6 of any material. To reach III: `modifier minLevel × 60` gold plus 10 of riftglass, duskiron or cinderite (decided in part 4: the content has eight material tiers, so the top rank asks for one of the three rare ones, as a socket does). The price counts the modifier's own minimum level, so a late modifier is dear. The hero's level must reach the modifier's minimum level, as for wearing it. A rank-up is refused at rank III and while the item is held by another queued job.
- Effect: all numeric bonuses of the modifier are multiplied by 1.0, 1.5 and 2.0 for ranks I, II and III (1.0, 1.2 and 1.4 before Step 13.17). Rounding (decided before part 4 code): flat point bonuses (Accuracy, Evasion, Healing Power, magical status resistance) are multiplied and rounded to one decimal, so Precise +3 Accuracy is +4.5 at II and +6.0 at III, Devout +12 Healing Power is +18 and +24; fractional bonuses (critical chance, penetration, critical damage, maximum HP, lifesteal) are multiplied and rounded to four decimals, so Keen +2 points critical chance is +3 and +4 points, Bloodbound 5% is 7.5% and 10%. Hauler's (bag room only, no numeric bonus) cannot be ranked up, because bag room is a whole number of slots.
- The stack cap counts modifiers, not ranks: two Keen pieces count twice at their own ranks, a third does not count.
- Rank I changes nothing in any number, so every guard run is byte-identical. Ranks are stored per modifier slot (`ItemInstance.modifierRanks`, an optional list of 1, 2 or 3 in the order of `modifiers`; absent means every rank I, and a list of only 1s is never written). Infusing a new second modifier puts that slot back to rank I. An upgrade, a socket job and an heirloom keep the ranks. The name of a ranked modifier shows its rank (`Keen II Bow`), and the compare notes name the rank and its scaled effect.

**Temper** (Step 13.11 parts 3 to 5, decided 2026-11-16, user). The material spent on a modifier now matters. Each modifier slot has a temper from 0 to 5, the material's grade, which is its `UPGRADE_QUALITY_POINTS` value: scrap 0, hide 1, shard 2, witherbark 2, oathsteel 2, riftglass 3, duskiron 4, cinderite 5.

- Effect: a temper point adds 15 points to the modifier's multiplier (`TEMPER_PER_POINT = 0.15`; 0.03 before Step 13.17). The factor is `MODIFIER_RANK_MULTIPLIER[rank] + temper × 0.15`, rounded to two decimals: rank I (1.0) with cinderite is 1.75, rank III (2.0) with cinderite is 2.75, the maximum, and rank III with riftglass is 2.45. Riftglass therefore gives +45% and cinderite +75%. Rounding is the existing rank rounding (flat point bonuses to one decimal, fractional bonuses to four decimals, text numbers to one decimal). When the rank is I and the temper is 0 or absent, the value is returned untouched, so old items and every guard run keep the old arithmetic exactly. Hauler's (no numeric bonus) takes no effect from temper.
- Storage: `ItemInstance.modifierTempers`, an optional list of whole numbers 0 to 5 in the order of `modifiers`, at most as long as `modifiers`; absent means every temper 0, and an all-zero list is never written.
- Binding (part 4): crafting with a modifier sets slot 0's temper to the craft material's grade; Infuse sets slot 1's temper from the infuse material and puts that slot back to rank I; Rank up sets that slot's temper to the larger of its old temper and the grade of the material spent; Open socket also applies the material's quality upgrade like an upgrade job would (riftglass +3 points up to 112%, duskiron +4 up to 116%, cinderite +5 up to 120%, `upgradedQuality`). Upgrades and heirlooms keep tempers. Repair and brewing stay outside the material system.
- Cost check: no new prices. At level 17, Keen (+2 points critical chance) is +3.5 points at rank I with cinderite and +5.5 points at rank III with cinderite (+2.9 and +4.9 with riftglass), against +2.0 and +4.0 with no temper.
- UI (part 5): the material pickers for Craft, Open socket, Infuse and Rank up show the effect of each material before it is spent, as key-value rows (`Temper +15%`, socket quality as the item's percent before and after, such as `100% → 103%` for riftglass, stopping at that material's cap); the compare notes name the temper.

**Retune (Step 13.17, 2026-11-17).** Reason: Step 13.16 showed the stack barely moves the Causeway, because base values of 2 to 10 make small multipliers invisible (Keen +2 points becomes +2.3). Changes: rank multipliers 1.0 / 1.5 / 2.0 (were 1.0 / 1.2 / 1.4), `TEMPER_PER_POINT = 0.15` (was 0.03), temper factor rounded to two decimals, and trainer drills give 20% of a level from level 10 (see "Trainer drills"). Notes:
- A level-17 hero on the Causeway holds riftglass (grade 3); cinderite (grade 5) only comes from level 28, so riftglass is the tested material.
- Guard runs are unaffected: they carry no ranks and no tempers, and rank I with temper 0 returns the value untouched.
- Items already crafted with a temper, and ranked items, get stronger in existing saves (the stored rank and temper are unchanged; only what they mean changed). No save change, no version bump.
- Targets for the harness (`--matrix modded`, seed 1, 100 runs): `plain` and `arrived` rows byte-identical to before; `stack-rift` wins the level-22 Colossus 40 to 70% for warrior, assassin, ranger and mage (cleric 85 to 100% accepted); mean HP left at `causeway-deep` up 5 points on average; `rank3` (riftglass) 10 to 35% on the Colossus; `infuse-rift` at least 5 points above `socket` on the Colossus.
- Results (`--matrix modded`, level-22 Colossus win rate, warrior / assassin / ranger / mage / cleric; seed 1 with 100 runs, seed 2 with 50 runs in brackets): `plain` and `arrived` rows are byte-identical to the 010bd59 output for both seeds. `stack-rift` 75 / 53 / 55 / 37 / 97% (70 / 58 / 56 / 28 / 96%): assassin and ranger hit the 40 to 70% band, warrior is 5 points above it on seed 1 and mage is 3 below it (12 below on seed 2), cleric is accepted. Mean HP left at `causeway-deep` is +6.1 points over `plain` (+4.9 on seed 2), target +5 met on seed 1 and missed by 0.1 on seed 2. `rank3` (riftglass) 27 / 26 / 19 / 10 / 16% (28 / 14 / 30 / 16 / 4%): inside 10 to 35% on seed 1 for every class. `infuse-rift` on the Colossus is only 0 to 4 points above `socket` (mean +2 on seed 1; cleric +4, ranger +3, mage +2, assassin +1, warrior 0), so the target of at least 5 points is MISSED: a second modifier at rank I is still a small effect. Old rows moved too (cinderite `stack` Colossus 88 / 78 / 71 / 60 / 99%, `rank3-top` 47 / 36 / 41 / 14 / 22%), as expected. Not tuned further; the decision is the user's.

Not decided and not built: any change to item level caps, a shared vault, selling or reforging modifiers.

### First-clear rewards (Step 13.24)

Why: the gold and material sinks above are fed by repeating routes, and the first time a hero finishes a zone is the one moment nothing marks it. A first clear now pays a small one-time reward, so reaching a new zone is a step forward in its own right. The sim, content numbers and every harness matrix are untouched.

**Rule.** The first time a hero clears a zone node and gets home safely, the hero earns all three rewards together (not a choice):

- Gold and material: `rewardFor(30, node.levels.max, resource)` from `src/content/contracts.ts` without its XP, so gold is `30 x node.levels.max` and the material is `ceil(30 / 2) = 15` of the node's resource. The Fracture Gate has no resource, so it pays gold only.
- One free upgrade token (`FIRST_CLEAR_TOKENS = 1`).
- At the Drowned Causeway, Rift Hollows and Cinder Scar only: +2 Legacy (`ZONE_CLEAR_BONUS`), claimed at the next reincarnation (section 10).

| Node | Max level | Gold | Material | Token | Legacy |
|---|---|---|---|---|---|
| Splintered Road | 7 | 210 | 15 scrap | 1 | none |
| Withered Grove | 14 | 420 | 15 hide | 1 | none |
| Fallen Bastion | 16 | 480 | 15 shard | 1 | none |
| Fracture Gate | 20 | 600 | none | 1 | none |
| Drowned Causeway | 22 | 660 | 15 riftglass | 1 | +2 |
| Rift Hollows | 28 | 840 | 15 duskiron | 1 | +2 |
| Cinder Scar | 34 | 1,020 | 15 cinderite | 1 | +2 |

- Once per hero per zone node, not per route. The Fracture Gate ends two routes and pays once. It is paid only when the run's outcome is `returned`: a node cleared on a run that ends in defeat stays due until a later safe return. Reincarnation never resets it, so a re-clear in a later life pays nothing.
- Paid when the run is settled, the same function for a live run and an away run, so both give the same purse. A run that clears several unpaid nodes pays all of them (for example a Grove run pays the Splintered Road's reward too if it was never paid).
- Old saves are paid retroactively: a hero whose `clearedNodeIds` already hold a node, with no `firstClearIds` field, is owed that node's reward at the next safe return. Absent field means nothing claimed.
- No hero-card title (a follow-up, not built).

**Free upgrade token.** A token is spent at the crafters, instantly (not a craft job), to do one of two things on one item:

- Open a socket: hero level 10 or more, as for the paid job; no quality lift, no gold and no material. The item must have no socket yet. Quality, ranks, tempers, heirloom status and durability stay as they were.
- Rank a modifier from I to II: the hero's level must reach the modifier's `minLevel`; no gold and no material; the temper stays as it was. Never from II to III (`FREE_RANK_MAX = 2`), and not for Hauler's.

Like all crafting it is refused during an expedition, and for an item held by a queued job. A token cannot be cancelled or refunded once spent. Crafting XP is unchanged.

**Save fields.** `SavedHero.firstClearIds?: string[]` (nodes already paid) and `SavedHero.freeUpgrades?: number` (whole number, 0 or more). Both are optional, absent means none, there is no version bump, and both carry through reincarnation.

**Sink arithmetic.** A hero can earn at most 7 tokens in all. Seven free sockets replace at most 7 x 880 gold (the dearest socket, level 22 x 40) and 56 of the rare material, once per hero. The gold and material of the rewards total 4,200 gold and 90 material once per hero, small beside a run's loot.


**Measurement: free upgrades against plain gear (Step 13.24 part 3b, 2026-11-18).** Question: are free sockets and rank-IIs at hero levels 10 to 17 too strong? Method: `--matrix free` (`src/harness/freeUpgrade.ts`, rules mode, seeds 1-3 x 100, pooled). The hero is the reference hero of that level (skill nodes = level / 3, 6 at level 17), item level = hero level, quality 100%, one modifier per piece (the Prepared set), 2 Healing Draughts. Gear is built with the game's own code (`spendFreeUpgrade`, `queueInfuse`, `advanceCrafting`). Rows: `plain`; `free-socket-3` / `free-socket-4`: 3 or 4 free sockets (no quality lift) with a scrap second modifier infused into each (an empty socket does nothing by itself, so the lift below is the infused modifier; armor cannot take a second modifier, so only weapon, off-hand and two accessories count; 7 tokens on all slots equal 4 here); `free-rank2-3` / `free-rank2-7`: 3 or 7 free rank II (no temper change); `free-mix-7`: 4 sockets plus 3 ranks; `paid-socket`: reference, riftglass socket plus scrap infuse on the same four pieces. Fights: levels 10, 13 and 16 meet the zone fights (Grove mixed, Bastion mixed, Rootmaw Stalker, Echo Knight); level 17 and the under-levelled `hard` run (levels 16 and 13 against the Causeway) meet the seven Causeway fights. Cells are class x fight (20 cells at levels 10 to 16, 35 at the Causeway). Numbers are mean win % per class, the lift over plain in brackets.

Level 10 (4 fights: bastion-mixed, echo-knight, grove-mixed, rootmaw-stalker)

| Row | Warrior | Assassin | Ranger | Mage | Cleric | Mean | Cells over +10 | Cells over +20 | Largest cell lift |
|---|---|---|---|---|---|---|---|---|---|
| plain | 77 | 71 | 64 | 70 | 100 | 76.5 | - | - | - |
| free-socket-3 | 83 (+6) | 72 (+1) | 65 (+1) | 71 (+0) | 100 (+0) | 78.2 | 1/20 | 0/20 | +20 |
| free-socket-4 | 85 (+8) | 73 (+2) | 66 (+2) | 72 (+1) | 100 (+0) | 79.3 | 1/20 | 1/20 | +29 |
| free-rank2-3 | 78 (+2) | 73 (+2) | 66 (+1) | 71 (+0) | 100 (+0) | 77.5 | 0/20 | 0/20 | +6 |
| free-rank2-7 | 86 (+9) | 74 (+3) | 70 (+5) | 72 (+1) | 100 (+0) | 80.2 | 3/20 | 1/20 | +26 |
| free-mix-7 | 88 (+11) | 74 (+2) | 69 (+5) | 73 (+2) | 100 (+0) | 80.6 | 2/20 | 1/20 | +37 |
| paid-socket | 87 (+10) | 74 (+2) | 68 (+4) | 73 (+2) | 100 (+0) | 80.3 | 2/20 | 1/20 | +35 |

Level 13 (4 fights: bastion-mixed, echo-knight, grove-mixed, rootmaw-stalker)

| Row | Warrior | Assassin | Ranger | Mage | Cleric | Mean | Cells over +10 | Cells over +20 | Largest cell lift |
|---|---|---|---|---|---|---|---|---|---|
| plain | 100 | 96 | 100 | 96 | 100 | 98.4 | - | - | - |
| free-socket-3 | 100 (+0) | 97 (+0) | 100 (+0) | 98 (+3) | 100 (+0) | 99.0 | 1/20 | 0/20 | +10 |
| free-socket-4 | 100 (+0) | 98 (+1) | 100 (+0) | 98 (+3) | 100 (+0) | 99.2 | 1/20 | 0/20 | +11 |
| free-rank2-3 | 100 (+0) | 97 (+0) | 100 (-0) | 96 (+0) | 100 (+0) | 98.5 | 0/20 | 0/20 | +2 |
| free-rank2-7 | 100 (+0) | 98 (+2) | 100 (+0) | 98 (+2) | 100 (+0) | 99.2 | 0/20 | 0/20 | +8 |
| free-mix-7 | 100 (+0) | 98 (+1) | 100 (+0) | 99 (+3) | 100 (+0) | 99.3 | 1/20 | 0/20 | +13 |
| paid-socket | 100 (+0) | 98 (+1) | 100 (+0) | 99 (+3) | 100 (+0) | 99.2 | 1/20 | 0/20 | +12 |

Level 16 (4 fights: bastion-mixed, echo-knight, grove-mixed, rootmaw-stalker)

| Row | Warrior | Assassin | Ranger | Mage | Cleric | Mean | Cells over +10 | Cells over +20 | Largest cell lift |
|---|---|---|---|---|---|---|---|---|---|
| plain | 100 | 100 | 100 | 100 | 100 | 100.0 | - | - | - |
| free-socket-3 | 100 (+0) | 100 (+0) | 100 (+0) | 100 (+0) | 100 (+0) | 100.0 | 0/20 | 0/20 | +0 |
| free-socket-4 | 100 (+0) | 100 (+0) | 100 (+0) | 100 (+0) | 100 (+0) | 100.0 | 0/20 | 0/20 | +0 |
| free-rank2-3 | 100 (+0) | 100 (+0) | 100 (+0) | 100 (+0) | 100 (+0) | 100.0 | 0/20 | 0/20 | +0 |
| free-rank2-7 | 100 (+0) | 100 (+0) | 100 (+0) | 100 (+0) | 100 (+0) | 100.0 | 0/20 | 0/20 | +0 |
| free-mix-7 | 100 (+0) | 100 (+0) | 100 (+0) | 100 (+0) | 100 (+0) | 100.0 | 0/20 | 0/20 | +0 |
| paid-socket | 100 (+0) | 100 (+0) | 100 (+0) | 100 (+0) | 100 (+0) | 100.0 | 0/20 | 0/20 | +0 |


Level 17 hero against the Causeway fights (the standard level of the modded matrix; six fights are won by every row and the Colossus is lost by every row, so nothing can move):

| Row | Warrior | Assassin | Ranger | Mage | Cleric | Mean | Cells over +10 | Cells over +20 | Largest cell lift |
|---|---|---|---|---|---|---|---|---|---|
| plain | 86 | 86 | 86 | 86 | 86 | 85.8 | - | - | - |
| free-socket-3 | 86 (+0) | 86 (+0) | 86 (+0) | 86 (+0) | 86 (+0) | 85.8 | 0/35 | 0/35 | +2 |
| free-socket-4 | 86 (+0) | 86 (+0) | 86 (+0) | 86 (+0) | 86 (+0) | 86.0 | 0/35 | 0/35 | +3 |
| free-rank2-3 | 86 (+0) | 86 (+0) | 86 (+0) | 86 (+0) | 86 (+0) | 85.8 | 0/35 | 0/35 | +0 |
| free-rank2-7 | 86 (+0) | 86 (+0) | 86 (+0) | 86 (+0) | 86 (+0) | 85.9 | 0/35 | 0/35 | +1 |
| free-mix-7 | 86 (+0) | 86 (+1) | 86 (+0) | 86 (+0) | 86 (+0) | 86.1 | 0/35 | 0/35 | +4 |
| paid-socket | 86 (+0) | 86 (+0) | 86 (+0) | 86 (+0) | 86 (+0) | 86.0 | 0/35 | 0/35 | +3 |


Level 16 hero against the Causeway fights (under-levelled):

| Row | Warrior | Assassin | Ranger | Mage | Cleric | Mean | Cells over +10 | Cells over +20 | Largest cell lift |
|---|---|---|---|---|---|---|---|---|---|
| plain | 86 | 86 | 86 | 86 | 86 | 85.7 | - | - | - |
| free-socket-3 | 86 (+0) | 86 (+0) | 86 (+0) | 86 (+0) | 86 (+0) | 85.7 | 0/35 | 0/35 | +0 |
| free-socket-4 | 86 (+0) | 86 (+0) | 86 (+0) | 86 (+0) | 86 (+0) | 85.7 | 0/35 | 0/35 | +0 |
| free-rank2-3 | 86 (+0) | 86 (+0) | 86 (+0) | 86 (+0) | 86 (+0) | 85.7 | 0/35 | 0/35 | +0 |
| free-rank2-7 | 86 (+0) | 86 (+0) | 86 (+0) | 86 (+0) | 86 (+0) | 85.7 | 0/35 | 0/35 | +0 |
| free-mix-7 | 86 (+0) | 86 (+0) | 86 (+0) | 86 (+0) | 86 (+0) | 85.7 | 0/35 | 0/35 | +0 |
| paid-socket | 86 (+0) | 86 (+0) | 86 (+0) | 86 (+0) | 86 (+0) | 85.7 | 0/35 | 0/35 | +0 |

Level 16 (7 fights: bulwark, causeway-deep, causeway-mixed, colossus, leech, leech-swarm, raider)

| Row | Warrior | Assassin | Ranger | Mage | Cleric | Mean | Cells over +10 | Cells over +20 | Largest cell lift |
|---|---|---|---|---|---|---|---|---|---|
| plain | 86 | 86 | 86 | 86 | 86 | 85.7 | - | - | - |
| free-socket-3 | 86 (+0) | 86 (+0) | 86 (+0) | 86 (+0) | 86 (+0) | 85.7 | 0/35 | 0/35 | +0 |
| free-socket-4 | 86 (+0) | 86 (+0) | 86 (+0) | 86 (+0) | 86 (+0) | 85.7 | 0/35 | 0/35 | +0 |
| free-rank2-3 | 86 (+0) | 86 (+0) | 86 (+0) | 86 (+0) | 86 (+0) | 85.7 | 0/35 | 0/35 | +0 |
| free-rank2-7 | 86 (+0) | 86 (+0) | 86 (+0) | 86 (+0) | 86 (+0) | 85.7 | 0/35 | 0/35 | +0 |
| free-mix-7 | 86 (+0) | 86 (-0) | 86 (+0) | 86 (+0) | 86 (+0) | 85.7 | 0/35 | 0/35 | +0 |
| paid-socket | 86 (+0) | 86 (-0) | 86 (+0) | 86 (+0) | 86 (+0) | 85.7 | 0/35 | 0/35 | +0 |


Reading: the reference hero at levels 13, 16 and 17 already wins or loses every fight outright, so free upgrades cannot move them. At level 10 the lift is small and about the same as the paid socket: mean +2.8 (3 sockets: +1.7) points for four free sockets, against +3.8 for the paid riftglass socket on the same pieces, and +3.7 for seven free rank IIs. The largest single cell is the Warrior against the level-16 Echo Knight at hero level 10: 21% plain, 41% with 3 free sockets, 50% with 4, 56% with the paid socket, 58% for sockets plus ranks. Only 1 of 20 cells rises by more than +10 for the socket rows (3 of 20 for seven rank IIs: that Warrior cell and the Ranger against the Rootmaw Stalker, +15). Conclusion: no spike. The decision for the fallback (earlier tokens may rank up only) is left to the user because a hero that fights an elite 6 levels above its own level is where free sockets matter most. Caveat: the reference hero is a tuned build, so a real hero is weaker and the cells that matter sit lower; the measurement covers only the cells that are not already at 0% or 100%.

### Equipment math

MVP combat slots:

- Main hand
- Off hand
- Head
- Chest
- Hands
- Feet
- Two accessories

Items have an explicit item level. A hero's level must equal or exceed item level to equip the item.

Weapon Power:

- `Neutral weapon Power = 8 + (2 × item level)`
- Dagger/light weapon: 0.85× neutral Power, 1.5-second base action time.
- One-handed weapon or caster weapon: 1.0× Power, 2.0-second action time.
- Bow: 1.1× Power, 2.2-second action time.
- Two-handed melee weapon: 1.35× Power, 2.6-second action time.
- A two-handed melee weapon disables the off-hand slot.
- Bow permits a bow-specific quiver in off hand.

Off hands:

- Shield Armor and Resistance each equal `3 + (0.75 × item level)`.
- Caster focus contributes 30% of neutral weapon Power.
- Off-hand dagger contributes 30% of its normal dagger Power and modifier access; it does not create separate basic attacks.
- Quiver stores the Ranger's limited special ammunition and can provide bow/ammunition modifiers.

Neutral full-set Defense at one item level:

- `Armor budget = 10 + (3 × item level)`
- `Resistance budget = 10 + (3 × item level)`
- Chest receives 40% of the budget.
- Head receives 25%.
- Hands receive 15%.
- Feet receive 20%.

Armor categories multiply each piece's neutral budget:

- Heavy: 1.4× Armor and 0.6× Resistance.
- Medium: 1.0× Armor and 1.0× Resistance.
- Light: 0.7× Armor and 0.8× Resistance, plus Evasion.
- Cloth: 0.5× Armor and 1.4× Resistance.
- A full level-appropriate light set grants `1 + (0.25 × item level)` Evasion, divided using the same slot shares.

Accessories do not provide base Armor or Resistance. They provide attributes, status/resource adjustments, and special modifiers.

Accessory bases (Step 14.4, decided 2026-11-24). An accessory base may carry one implicit stat that grows with item level and ignores quality. Implicits are not modifiers: no stack cap, rank or temper. They add to the hero's gear bonuses through `gearBonusesFor` (modifier bonuses plus the implicits of both accessories). Values are rounded to 4 decimals of the fraction.

| Base | Implicit | At item level 10 / 20 / 30 / 40 |
|---|---|---|
| Ring, Charm (starter only) | none | none |
| Amulet | +0.025% max HP per item level (0.05% until the 14.4 measurement) | 0.25% / 0.5% / 0.75% / 1% |
| Talisman | +0.1 points crit damage per item level (0.2 until the 14.4 measurement) | +1 / +2 / +3 / +4 points |

Every modifier that fits an accessory fits both new bases. Greyhaven's shop and the Craft screen sell and craft the Amulet and the Talisman at the usual base price (item level x 10 gold) and craft cost; the Ring and the Charm are starter-only, no longer sold or craftable (owned ones keep working). Reference and harness heroes keep zero-stat accessories, so every earlier matrix is unchanged. Power bound (seeds 1 to 3 x 100 runs, rules, mean): Warden prepared and Cinder Tyrant prepared with an Amulet and a Talisman at the tier's level, minus the plain tier, at most +8 win points per class; if not, halve the per-level numbers once, re-measure, then stop and report. Measured with `--matrix late` (`warden-trinkets`, `cinder-trinkets`).

**Measured 2026-11-24** (Step 14.4, seeds 1 to 3 x 100 runs, rules, mean; trinkets minus plain tier, win points W/A/R/M/C). At the proposed numbers (0.05% and 0.2 per level): Cinder Tyrant prepared +0.3 / 0.0 / -0.3 / +0.3 / +2.0, Warden prepared +11.0 / +1.3 / +3.7 / +7.3 / +2.0 (Warrior over +8). Halved once as the rule says: Cinder -1.0 / -0.7 / -0.7 / +0.3 / +6.3, Warden +4.0 / -0.3 / 0.0 / +6.0 / +2.3, inside the bound. Guards (reference CSV, warden, causeway, hollows, built, telegraph, elites) are byte-identical to the pre-14.3 run apart from the Tyrant rows 14.3 moved on purpose.

Quality:

- Primary Power and Defense vary from 90%-110% quality.
- Average two uniform rolls in that range, making values near 100% common.
- Materials and crafting proficiency can raise/narrow the visible range later.
- Basic level-1 starter gear uses exactly 100% quality and has no modifiers.

Reference loadouts:

- Warrior: heavy armor, one-handed weapon, and shield.
- Assassin: light armor and dual daggers.
- Ranger: medium armor, bow, and quiver.
- Mage: cloth armor, caster weapon, and focus.
- Cleric: medium armor, caster weapon, and shield.

Preferred equipment operates at 100% primary-stat effectiveness. Equipment outside class preferences operates at 90% Power/Defense effectiveness until a relevant skill-web node removes the penalty. Active skills still enforce explicit requirements such as Shield Brace requiring a shield. Unconventional equipment remains possible through skill-web investment. These reference sets exist for balance simulation.

Class gear rule, decided 2026-11-02 (changes the earlier "not hard class locks"): a hero can equip only the weapon kinds, off-hand kinds, and armor category their class prefers, listed above. Accessories are open to every class. Human Cross-Training lifts the rule (it already counts every item as preferred). The shop sells only gear the selected hero can use, and buying anything else is refused. Gear already worn by a hero is not removed by the rule. The 90% off-preference effectiveness stays in the simulation and now applies only if a later change allows off-class gear. The Warrior may also use the two-handed weapon, because Reckless Strike requires one (preferred at 100%; the reference loadout stays one-handed and shield). Other skill-web nodes that unlock off-class gear are not yet defined.

### Level-20 reference heroes

Base combat simulations use Human heroes with full item-level 20 gear at 100% quality, no item modifiers, empty accessory modifiers, no passive web nodes, and no consumables. Active-skill unlocks are included as required by the tested loadout.

Warrior:

- Attributes (STR/VIT/AGI/INT/SPI): 24/22/16/10/16
- 370 HP, 96 Physical Power, 116 Armor, 60 Resistance
- 16 Accuracy, 16 Evasion
- 11.4% critical chance, 162% critical damage
- 12.97% innate Armor penetration
- 12.12% resource-generation bonus
- 1.72-second one-handed base action after Agility

Assassin:

- Attributes: 18/16/30/14/10
- 310 HP, 89.04 Physical Power, 49 Armor, 56 Resistance
- 30 Accuracy, 36 Evasion including the light-set bonus
- 17% critical chance, 159% critical damage
- 10.59% innate Armor penetration
- 8.33% resource-generation bonus
- 1.15-second dagger base action after Agility

Ranger:

- Attributes: 22/18/28/10/10
- 330 HP, 96.8 Physical Power, 70 Armor, 70 Resistance
- 28 Accuracy, 28 Evasion
- 16.2% critical chance, 161% critical damage
- 12.22% innate Armor penetration
- 8.33% resource-generation bonus
- 1.72-second bow base action after Agility

Mage:

- Attributes: 10/16/16/34/12
- 310 HP, 130.4 Magical Power, 35 Armor, 98 Resistance
- 16 Accuracy, 16 Evasion
- 11.4% critical chance, 155% critical damage
- 16.19% innate magical penetration
- 12.14% Intellect cooldown reduction
- 9.68% resource-generation bonus
- 1.72-second caster base action after Agility

Cleric:

- Attributes: 10/22/14/20/22
- 370 HP, 88 Magical Power, 44 Healing Power, 88 Armor, 88 Resistance
- 14 Accuracy, 14 Evasion
- 10.6% critical chance, 155% critical damage
- 11.43% innate magical penetration
- 8.57% Intellect cooldown reduction
- 15.28% resource-generation bonus
- 1.75-second caster base action after Agility

These are neutral calibration builds, not recommended player builds. Race bonuses, quality, accessories, modifiers, consumables, passive nodes, and keystones should create meaningful upside beyond this floor.

### Inventory

- Expeditions use limited supply slots and loot capacity. The design avoids detailed per-item weight. Capacity counts total material quantity.
- The first playable has 4 supply slots. A crafted backpack raises this to 5 or 6 (Step 13.22, below).

**Crafted backpack (Step 13.22).** Decided 2026-11-17 (user approved all four decisions). The 4 slots are the default; a crafted pack raises them.

- Two packs. Satchel: 5 slots, hero level 10, craft material of grade 2 or higher (grade is the `UPGRADE_QUALITY_POINTS` value used for temper: shard, witherbark and oathsteel 2, riftglass 3, duskiron 4, cinderite 5), 8 units of it and 400 gold. Field Pack: 6 slots, hero level 17, grade 3 or higher (riftglass, duskiron, cinderite), 10 units and 1,200 gold, and the hero must already own the Satchel. The hard cap is 6 slots. The units (8 and 10) are an implementation choice, small beside the gold (a socket also costs 8).
- The material grade only sets what a pack needs (tier and units); a better grade does not add slots.
- A pack is a queued 30 second job in the crafting queue (kind `pack`), paid when queued, never cancelled, like every other job. It is crafted at the Armorer ("Backpack" panel). The slots change when the job ends. A hero holds one pack: none, Satchel or Field Pack (the Field Pack replaces the Satchel). The Field Pack needs the Satchel finished, not queued. The same pack cannot be queued twice, nor one the hero already owns or has outgrown (a Satchel when a Field Pack is owned).
- Stored per hero as `SavedHero.pack` (`satchel` or `fieldPack`; absent means none, so old saves load unchanged). Slots: none 4, Satchel 5, Field Pack 6. The pack carries over through reincarnation (section 10) and is not lost to defeat.
- Sim: `ExpeditionBlueprint.supplySlotCount` (optional, 4 to 6, default 4 = `SUPPLY_SLOT_COUNT`). `supplySlots` is already a list and its length is the count, so no new state key is written and every run at the default count is byte-identical. The supply rows and conditions do not change; the extra slots hold more of the same supplies. `assertExpedition` accepts 4 to 6 slots.
- Stack limit, decided 2026-11-18 (user chose this after the first measurement below): when a run has more than 4 slots (a hero with a pack), it may carry at most 2 of any one supply id, counted across slots (`SUPPLY_STACK_LIMIT = 2`). At exactly 4 slots nothing changes (a plain hero may still pack 4 Healing Draughts), so every guard and old save is identical. It is enforced where slots are made and checked: `createExpedition` and `assertExpedition` throw when a run above 4 slots holds a third copy; the preparation draft (`stepPacked`, `checkPreparation`) refuses it and the picker shows "At most 2 of each supply with a backpack."; a saved hero's `packedSupplies` is checked the same way. The stash may hold more than 2; the limit is on what one run carries. When a hero gets a pack, a draft that already packs 3 of one supply is cut to 2 on load.
- The UI reads the hero's slot count: preparation slots, the town text, and the Potion Shop "Buy N" and "Brew N" batches (the batch was a full backpack of one supply, 4; with a pack it is the stack limit, 2, since a run cannot use more of one). Saved `packedSupplies` is limited to the hero's slots.
- Why: Step 13.21 accepted that crafted supplies sit well above the old +30 band and said this step holds the number of crafted supplies per run. A slot is that lever, and it is also a gold and material sink.
- Measurement and go/no-go (part 2): `--matrix pack` compares 4, 5 and 6 slots with the default supply rows. Extra slots hold the tier's main healing supply (Healing Draught at the prepared tier, Greater Draught at the crafted tier), so 5 slots is one more of it and 6 is two more. Rules mode, five classes, the Warden, Tidebound Colossus, Hollowmaw Reaver and Emberwrought Tyrant, seeds 1 to 3 x 100. If 6 slots lifts crafted wins to 95% or more in most elite cells, or by more than 10 points over 5 slots, the cap of 6 is reconsidered before any UI is built.
- Measured 2026-11-17 (Step 13.22 part 2; `--matrix pack`, seeds 1-3 x 100, mean wins %, W/A/R/M/C = Warrior/Assassin/Ranger/Mage/Cleric; seed noise about 6 points; HP lost is the mean share of maximum HP lost). The 4-slot rows are the Step 13.21 values (plain prepared and crafted prepared) re-measured on the same code. Each cell is 4 / 5 / 6 slots.
  - Plain prepared (extra slots are Healing Draughts). Warden 41/31/48/37/46 > 89/82/84/78/80 > 100/98/98/94/94; Colossus 69/54/56/58/55 > 98/84/88/89/72 > 100/98/99/97/78; Reaver 41/81/81/80/60 > 81/83/95/96/67 > 95/83/98/98/69; Tyrant 46/76/59/93/41 > 76/95/87/99/52 > 93/100/98/100/66. Mean over the 20 cells 57.8 > 83.8 > 92.8; cells at 95 or more: 0 > 4 > 13 of 20.
  - Crafted prepared (extra slots are Greater Draughts, so 3 Greater Draughts + the Riftglass Ward become 4 and 5 Greater Draughts + the Ward). Warden 94/86/90/86/76 > 100/100/100/98/96 > 100/100/100/100/100; Colossus 99/84/94/93/81 > 100/100/100/100/93 > 100/100/100/100/98; Reaver 84/88/98/97/78 > 98/88/99/99/83 > 98/88/99/99/86; Tyrant 86/96/88/99/67 > 97/99/99/100/79 > 100/100/100/100/89. Mean 88.3 > 96.4 > 97.8; cells at 95 or more: 5 > 16 > 17 of 20. HP lost at the Warden falls from 70-78% to 46-52% to 40-42%.
  - Gain from the extra slots (points). Plain: 5 over 4 is more than +10 in 17 of 20 cells (+48/+51/+36/+41/+34 at the Warden), 6 over 5 in 11 of 20 (+11 to +17 at the Warden). Crafted: 5 over 4 in 9 of 20 (+6 to +20 at the Warden, +1 to +16 at the Colossus), 6 over 5 in 0 of 20 (at most +5); the crafted tier is at its ceiling at 5 slots.
  - GO/NO-GO result: NO-GO for building the UI as designed, on the stated trigger (crafted prepared wins 95% or more in most elite cells: 17 of 20 at 6 slots, 16 of 20 already at 5). The second trigger (crafted 6 over 5 above +10) is not hit in any cell. Two readings are reported to the user: (1) the Field Pack adds almost nothing for the crafted tier (the Satchel does the work, +6 to +20 at the Warden), so 6 slots is only worth the gold for plain Draughts (+9 mean over 5); (2) the Satchel alone (400 gold, hero level 10, a grade 2 material) lifts a plain prepared hero from 58% to 84% mean, and a crafted one to 96%, so slots are far stronger than any other lever measured in 13.20/13.21. Options that keep the step: cap the pack at 5 slots, limit the stacks (for example at most 2 of any one supply), raise the elites, or accept the ceiling. Nothing is decided; parts 3 and 4 wait for the user.
  - Measured again 2026-11-18 with the stack limit (Step 13.22 part 2b; same method, seeds 1-3 x 100; `--matrix pack`). Four slots are the tier's own list and are the values above. At 5 and 6 slots at most 2 of any supply, the cut-down list is filled with variety (`packSupplies` in `src/harness/pack.ts`): plain 5 slots = Healing Draught x2, Ward Charm, Antidote, Smoke Bomb, 6 slots adds a second Ward Charm; crafted 5 slots = Greater Draught x2, Riftglass Ward, Ward Charm, Healing Draught, 6 slots adds a second Healing Draught. The Tyrant's plain list (2 Draughts, Warming Tonic, Ward Charm) is already within the limit, so its rows equal the 4-slot row (the extras never fire). Each cell is 4 / 5 / 6 slots, W/A/R/M/C.
  - Plain prepared: Warden 41/31/48/37/46 > 14/2/10/12/17 > 12/3/12/11/14; Colossus 69/54/56/58/55 > 28/14/20/21/36 > 18/19/21/23/36; Reaver 41/81/81/80/60 > 12/54/34/30/46 > 17/87/36/52/59; Tyrant 46/76/59/93/41 at all three. Mean 57.8 > 33.4 > 36.7.
  - Crafted prepared: Warden 94/86/90/86/76 > 85/80/85/75/66 > 100/97/98/95/87; Colossus 99/84/94/93/81 > 99/83/91/93/77 > 100/98/98/99/85; Reaver 84/88/98/97/78 > 79/98/91/98/77 > 98/98/99/100/81; Tyrant 86/96/88/99/67 > 84/94/89/99/71 > 97/100/96/100/79. Mean 88.3 > 85.8 > 95.3. Cells at 95 or more: 5 > 4 > 16 of 20. Gain of 6 over 5: more than +10 in 8 of 20 cells, up to +20.
  - Finding: with the limit, the Satchel is no longer a power spike, and at the default rows it is a loss for a plain hero (33 against 58) because the third Healing Draught goes and the added slots hold supplies the default rows do not use against elites. The crafted Satchel is about even with 4 slots (86 against 88). Only the Field Pack lifts anything: crafted wins reach 95 or more in 16 of 20 cells, so the 95% trigger is still met at 6 slots. Decided by the user on 2026-11-18: do not stop again, build the step and report. Reported to the user: with the limit a hero has to rebuild the rules (for example more Ward Charm or Riftglass Ward rows) to use 5 slots well, and a limit of 3 per supply is the obvious next lever if the Satchel should not cost power at the default rows.
  - Guards at the default 4 slots (seed 1 x 5, compared with origin/main): telegraph, built, modded, cinder, hollows, warden, causeway, elites and reference are identical; no run is changed because `supplySlotCount` is omitted everywhere.
- Changed 2026-11-18 (user chose option 1 after the playtest question): the stack limit is 3, not 2 (`SUPPLY_STACK_LIMIT = 3`). Above 4 slots a run carries at most 3 of any one supply; at 4 slots nothing changes. Reason: with a limit of 2 the Satchel cost a plain hero power at the default rows (33% against 58%) because the third Healing Draught was cut. At 3, the default rows (3 Draughts) fit again. Everything the limit touches follows the constant: the preparation refusal text ("At most 3 of each supply with a backpack."), the load-time cut of a draft that packs more, and the Potion Shop Buy and Brew batches with a pack (now 3). `--matrix pack` cuts its base lists to 3 of each and keeps the same filler logic; nothing else is tuned. Measurement below.
  - Measured 2026-11-18 with the limit of 3 (Step 13.22 part 2c; same method, seeds 1-3 x 100, `--matrix pack`, rules mode, 4 / 5 / 6 slots, W/A/R/M/C). Fillers (`packSupplies`): plain 5 slots = Healing Draught x3, Ward Charm, Antidote; 6 slots adds a Smoke Bomb. Crafted 5 slots = Greater Draught x3, Riftglass Ward, Ward Charm; 6 slots adds a Healing Draught. The 4-slot rows are the tier's own lists and equal the earlier tables; the Tyrant's plain list fits as before.
  - Plain prepared: Warden 41/31/48/37/46 at all three slot counts; Colossus 69/54/56/58/55 at all three; Reaver 41/81/81/80/60 at all three; Tyrant 46/76/59/93/41 at all three. Mean 57.6 > 57.6 > 57.6; cells at 95 or more 0 > 0 > 0. The extra slots hold an Antidote and a Smoke Bomb, which the default rows never use against these elites (no Poison or Bleed rule fires, no escape roll), so the plain rows are bit-for-bit the 4-slot rows.
  - Crafted prepared: Warden 94/86/90/86/76 > 94/91/92/87/76 > 100/100/99/99/91; Colossus 99/84/94/93/81 > 99/89/95/97/81 > 100/99/99/99/88; Reaver 84/88/98/97/78 > 88/98/97/100/79 > 98/98/100/100/83; Tyrant 86/96/88/99/67 > 89/98/91/100/77 > 98/100/98/100/82. Mean 88.2 > 90.9 > 96.5; cells at 95 or more 5 > 8 > 16 of 20. The extra Ward Charm lifts 5 slots over 4 by +1 to +10 in 15 of 20 cells, equal in 4 (Warden and Colossus Warrior and Cleric) and 1 point lower in one (Reaver Ranger, noise); 6 over 5 is more than +10 in 2 of 20 cells (Warden Mage +12 and Cleric +15), and the 95% trigger is still met at 6 slots (16 of 20).
  - What the Satchel now does for the default rows: plain, nothing (equal to 4 slots, no longer a loss of 33 against 58 as with the limit of 2); crafted, a small gain (+2.7 mean). Target met: 5 slots are no worse than 4 for plain and crafted, within noise. The Field Pack is the only large step (crafted +5.6 mean over the Satchel). A hero who wants the Satchel to matter has to add rules that use the extra slot (for example another Ward Charm row). Nothing else is tuned.
  - Guards at the default 4 slots (seed 1 x 5, compared with origin/main): telegraph, built, modded, cinder, hollows, warden, causeway, elites and reference are identical.

First-playable supplies, decided 2026-11-03:

| Supply | Effect | Price | Default rule for a new hero |
|---|---|---|---|
| Healing Draught | Restores 30% of maximum HP. No roll, no Healing Power, no healing-received change. | 15 gold | Hero HP at most 40% |
| Antidote | Removes every Poison and Bleed stack from the hero. | 10 gold | Hero Poison at least 3 stacks |
| Smoke Bomb | +15 percentage points on the next escape roll, then used up, whether the roll succeeds or fails. | 20 gold | None: it is used by the escape roll |
| Ward Charm (added 2026-11-04) | Wards off the next telegraphed enemy attack with a damage effect that lands within 5 seconds: no damage and no statuses; an elite or boss still deals 50% of each damage effect, with no statuses. Changed 2026-11-17 (Step 13.20); it was a barrier of 20% of maximum HP for 8 seconds. | 20 gold | When an enemy telegraph is present and hero HP is at most 70% (changed 2026-11-08) |

- Supplies are bought in Greyhaven with the hero's own gold and kept in the hero's stash. They are not shared between heroes.
- Before a run the player picks what goes in each of the 4 slots. The run takes the picked items out of the stash. A pick the stash cannot cover leaves that slot empty.
- Healing Draught and Antidote are used by priority rules. A rule can name a supply instead of a skill. The row is usable only while a slot holds that supply, and otherwise skips with `none left`. Using one is a hero action at 0.5× action time with no cost and no cooldown. It needs no target, is not a skill for class or race effects, and is not part of the skill loadout (four skills, five with the Fifth Skill Slot, §10).
- An Antidote with no Poison or Bleed on the hero still uses the action and the item, so its rule should say when.
- New heroes start with the two default rules at the top of their rules. A hero made before supplies gets them once when the save loads, unless a rule already names a supply; one the player removes later does not come back.
- Added 2026-11-04 (user approved):
  - Ward Charm: a barrier of 20% of maximum HP for 8 seconds, used by a rule at the same 0.5× action time. 20 gold. Default rule for a new hero: when an enemy telegraph is present. Existing heroes get the rule once, unless a rule already names it.
  - Brewing at the Potion Shop: any supply can be made at once from the hero's own materials instead of bought: Healing Draught 3 hide + 5 gold, Antidote 2 shard + 3 gold, Smoke Bomb 3 scrap + 8 gold, Ward Charm 3 shard + 8 gold. No queue and no time.
- Changed 2026-11-08 (user approved, Step 12.5): the Ward Charm default rule is "an enemy telegraph is present AND hero HP at most 70%". The old rule (telegraph only) spent the Charm on the first telegraph, usually a weak hit, in almost every Warden run. The Charm's own numbers (barrier 20% of maximum HP, 8 s) do not change. Measured against the Fractured Warden (seeds 1-2, 60 runs each, reference rules plus default supply rows, wins / mean HP lost): Mage well prepared 70% to 98%, Ranger well prepared 25% to 34%, Assassin well prepared 5% to 3% (noise, still walled), over-levelled tiers 99-100% either way, Warrior and Cleric 0% either way. Other candidates (HP at most 60, 50, 80; telegraph at most 1 s plus HP; HP alone; no barrier up) are in doc/IMPLEMENTATION_PLAN.md Step 12.5. Rootmaw and Echo Knight stay at 100% wins with the Charm packed. Reference-matrix rows carry no supplies and are unchanged. Heroes who already have a Ward Charm rule keep it; only new heroes, reincarnated heroes, the harness, and legacy heroes that get the rule for the first time use the new row.
- Changed 2026-11-17 (user approved, Step 13.20): the Ward Charm and the Riftglass Ward stop being barriers and answer a telegraph instead. Price, brew cost, unlocks and default rows are unchanged; the two supplies change in place (no new supply id).
  - Rule: using the supply starts a 5 second ward on the hero. The next telegraphed enemy attack (a telegraph or a reaction skill) with a damage effect that resolves while the ward is up is warded off: no damage and no statuses from that skill. A skill that is not telegraphed does not spend it. Telegraphs that deal no damage (roots, summons) do not spend it. An interrupted telegraph never resolves, so the ward stays up for the rest of its 5 seconds. There is no once-per-fight cap: each use of a supply is one ward. Using a supply while a ward is up is skipped with the reason `ward already up`.
  - Elites and bosses: a share of each damage effect still lands, with no statuses. Ward Charm 50%, Riftglass Ward 25% (Rift Surge style skills have `dodgedDamageFraction` 60%; the share is the larger of the two, so Rift Surge lands at 60% for both). Regular enemies deal nothing.
  - A ready Fade Back dodge is used first and the ward stays. There is no barrier any more; the Healing Draught and the Greater Draught are the HP answer.
  - Why not reuse `damageReduction`: it ends at the hero's next action (using a supply counts as one), and it cuts every hit instead of one. The skill info text "Cuts the next hit by N%" was wrong and now says "until your next action".
  - Default rows unchanged (telegraph present AND HP at most 70%; the Riftglass Ward row copies it). The rule template "Ward with supplies" now puts both wards on a telegraph, the stronger one first.
  - Measured 2026-11-17 (Step 13.20 part 5; `--matrix elites --modes rules`, seeds 1-3 x 100, mean wins %, W/A/R/M/C = Warrior/Assassin/Ranger/Mage/Cleric; seed noise about 6 points). The Charm and Riftglass Ward fractions are 0.5 and 0.25. Guards `telegraph`, `built`, `modded`, `reference` (seed 1 x 50) and the scenarios snapshot are identical before and after.
    - Plain prepared, before (barrier) / after: Warden 52/42/54/48/45 / 39/26/49/40/46; Colossus 74/57/65/67/59 / 70/54/57/60/54; Reaver 42/76/76/45/57 / 40/84/82/78/60; Tyrant 35/75/59/74/43 / 44/76/58/94/41. Over-levelled plain after: 100 everywhere except Reaver Assassin 92, Tyrant Warrior 92 (before 94 and 89). Crafted prepared before / after: Warden 77/79/81/69/64 / 68/61/71/64/58; Colossus 97/76/85/85/73 / 96/70/80/92/78; Reaver 68/85/93/73/70 / 69/86/94/92/74; Tyrant 61/85/83/88/58 / 76/86/78/98/70.
    - Band check (Step 13.5): plain prepared outside 40-85 after: Warden Warrior 39, Assassin 26, Mage 39.5; Tyrant Mage 93.5 (all were inside before; Tyrant Warrior 35 was already outside). Over-levelled below 94: Reaver Assassin 92.5, Tyrant Warrior 91.5 (Reaver Assassin was 94 before; Tyrant Warrior 88.7 before). Crafted minus plain above +30: Warden Assassin +35 (+37 before), Colossus Mage +32, Tyrant Warrior +32. Crafted below plain: none.
    - Sweep (elites matrix, rules mode; Charm fraction C and Riftglass fraction R set together: A = C 0.4 + R 0.15, default = C 0.5 + R 0.25, B = C 0.6 + R 0.35). Plain prepared W/A/R/M/C: Warden A 41/32/51/37/46, default 39/26/49/40/46, B 39/29/46/37/47; Colossus A 73/54/58/68/62, default 70/54/57/60/54, B 68/54/57/52/56; Reaver A 41/81/81/80/60, default 40/84/82/78/60, B 41/81/81/80/60; Tyrant A 46/76/59/92/40, default 44/76/58/94/41, B 45/74/56/89/45. Crafted prepared: Warden A 71/68/71/66/58, default 68/61/71/64/58, B 70/64/71/65/58; Colossus A 95/75/79/90/70, default 96/70/80/92/78, B 95/71/78/86/75; Reaver A 69/86/93/91/76, default 69/86/94/92/74, B 69/86/93/91/76; Tyrant A 78/87/81/97/65, default 76/86/78/98/70, B 72/87/80/97/63.
    - Finding: the fractions are not the lever. 0.4 / 0.5 / 0.6 move wins by at most the seed noise and not in one direction; no point of the sweep brings Warden Assassin to 40, or Tyrant Mage under 85. The shifts come from the rule itself: the ward now also takes the statuses and the whole hit of every regular telegrapher, the Mage gains most at the Reaver (45 to 78-80) and the Tyrant (74 to 89-94), and the Assassin loses most at the Warden (42 to 26-32). Numbers stay 0.5 and 0.25 (not changed on the evidence); the band misses above are recorded for the user.
    - Reported without a band, Charm against a fourth Draught instead of the Charm (`-nocharm`; seeds 1-3 x 100, wins %, Charm after vs nocharm): Warden prepared Warrior 41 vs 85, Assassin 31 vs 71, Ranger 48 vs 81, Mage 37 vs 64, Cleric 46 vs 70 (Charm before 52/42/54/48/45); Colossus prepared 69/54/56/58/55 vs 99/88/90/85/70. The Draught still beats the Charm at the Warden and Colossus. At the regular Causeway fights (raider, bulwark, causeway-mixed, causeway-deep) the Charm and the fourth Draught give the same wins and the same HP lost to within 1 point, so the Charm matches a Draught there.
    - Diagnostic, Charm row with the telegraph condition only (no HP gate; plain prepared W/A/R/M/C): Warden 41/32/47/3/44, Colossus 66/59/73/71/60, Reaver 46/74/69/67/74, Tyrant 21/88/43/72/43 (default row: 39/26/49/40/46, 70/54/57/60/54, 40/84/82/78/60, 44/76/58/94/41). The rows are not changed.
- Changed 2026-11-17 (user approved, Step 13.21): wider tiers. The Greater Draught heals more (proposal 50% of maximum HP, was 35%; sweep 40/45/50 decides). The `telegraphWard` effect gets an optional `charges` (default 1, the Charm unchanged): the ward absorbs up to `charges` telegraphed damaging skills, each by the rule above (regular telegraphers nothing, elites and bosses `eliteDamageFraction`), and ends when the charges run out or its time ends. The Riftglass Ward gets 2 charges over 8 s (the Charm stays 1 hit, 5 s) and an elite fraction chosen by sweep (0.25/0.35/0.5). `ward already up` still skips a second ward while charges and time remain. Chosen numbers: Greater Draught 40% (rule row stays at HP at most 40%, so a drink takes the hero from 40% to 80%), Riftglass Ward 2 charges, 8 s, elite fraction 0.35. Ward Charm unchanged (1 hit, 5 s, 0.5).
  - Measured 2026-11-17 (Step 13.21 part 2; `--matrix elites --modes rules --tiers prepared-crafted`, seeds 1-3 x 100, mean wins %, W/A/R/M/C; seed noise about 6 points). Only the crafted tier uses these two supplies, so plain tiers are the 13.20 values. Plain prepared: Warden 39/26/49/40/46, Colossus 70/54/57/60/54, Reaver 40/84/82/78/60, Tyrant 44/76/58/94/41.
  - AFTER, final numbers (Step 13.21 part 4; same method, 13.20 state re-measured on the same code base so before/after are paired; plain prepared W/A/R/M/C: Warden 41/31/48/37/46, Colossus 69/54/56/58/55, Reaver 41/81/81/80/60, Tyrant 46/76/59/93/41). Crafted prepared before > after: Warden 69/66/71/65/57 > 94/86/90/86/76, Colossus 96/73/79/92/77 > 99/84/94/93/81, Reaver 69/86/93/91/76 > 84/88/98/97/78, Tyrant 74/87/80/97/69 > 86/96/88/99/67. Crafted minus plain before > after: Warden +29/+35/+22/+28/+11 > +53/+55/+41/+49/+30, Colossus +26/+19/+23/+34/+21 > +30/+30/+38/+36/+25, Reaver +28/+5/+13/+11/+16 > +43/+6/+17/+17/+18, Tyrant +28/+11/+21/+4/+28 > +40/+20/+29/+7/+26. Cells above +30: 2 before (Warden Assassin, Colossus Mage), 8 after (Warden Warrior, Assassin, Ranger, Mage; Colossus Ranger, Mage; Reaver Warrior; Tyrant Warrior). The two earlier sweep tables use the 13.20 plain figures (Warden Assassin 26, not the 31 measured here), so their gaps for a few cells differ by up to 5 from this table; the wins are not affected.
  - Plain prepared and over-levelled tiers are unchanged (the two supplies are crafted only): over-levelled 91 to 100 everywhere (Reaver Assassin 93.7, Tyrant Warrior 91.3 as in 13.20). `--matrix warden` seed 1 x 100: only the crafted rows change (prepared-crafted wins before > after: Warrior 71 > 95, Assassin 66 > 90, Ranger 73 > 93, Mage 68 > 89, Cleric 66 > 82; causeway-crafted stay 100). `--matrix causeway`: only the prepared-crafted rows change (all 100% before and after). Guards `telegraph`, `built`, `modded`, `cinder`, `hollows`, `reference` (seed 1), the reference CSV and the golden duel snapshot are identical before and after.
  - Greater Draught sweep (Riftglass Ward still 1 hit, 5 s, 0.25). Crafted prepared wins: 35% (13.20 state): Warden 68/61/71/64/58, Colossus 96/70/80/92/78, Reaver 69/86/94/92/74, Tyrant 76/86/78/98/70. 40%: Warden 92/84/88/75/73, Colossus 100/85/94/94/84, Reaver 84/88/98/97/78, Tyrant 86/94/87/99/74. 45%: Warden 99/94/95/91/82, Colossus 100/93/97/98/90, Reaver 94/89/100/97/81, Tyrant 93/98/95/99/81. 50%: Warden 99/98/99/94/87, Colossus 100/99/99/100/94, Reaver 97/91/100/100/89, Tyrant 97/99/99/100/83.
  - Crafted minus plain (band: at most +30). 35%: Warden +29/+35/+22/+24/+12, Colossus +26/+16/+23/+32/+24, Reaver +29/+2/+12/+14/+14, Tyrant +32/+10/+20/+4/+29. 40%: Warden +53/+58/+39/+35/+27, Colossus +30/+31/+37/+34/+30, Reaver +44/+4/+16/+19/+18, Tyrant +42/+18/+29/+5/+33. 45%: Warden +60/+68/+46/+51/+36, Colossus +30/+39/+40/+38/+36, Reaver +54/+5/+18/+19/+21, Tyrant +49/+22/+37/+5/+40. 50%: Warden +60/+72/+50/+54/+41, Colossus +30/+45/+42/+40/+40, Reaver +57/+7/+18/+22/+29, Tyrant +53/+23/+41/+6/+42.
  - Finding: the Draught is the lever and every swept value breaks the +30 band in more cells than 13.20 did (at 40%, 10 of 20 cells exceed +30 against 3 before; many crafted cells reach 85-100%). 45% and 50% are worse everywhere, so the smallest swept value, 40%, is chosen. The band cannot be kept while the Draught gap widens; reported for the user.
  - Riftglass Ward sweep (Greater Draught 40%; 2 charges, 8 s; elite fraction 0.25 / 0.35 / 0.5). Crafted prepared wins: 0.25: Warden 94/88/90/84/79, Colossus 100/85/94/94/84, Reaver 84/88/98/97/78, Tyrant 86/96/88/99/74. 0.35: Warden 94/86/90/86/76, Colossus 99/84/94/93/81, Reaver 84/88/98/97/78, Tyrant 86/96/88/99/67. 0.5: Warden 94/86/89/83/75, Colossus 98/84/93/85/77, Reaver 84/88/98/97/78, Tyrant 84/96/87/98/66. Against the same Draught with the old ward (rows 40% above), the two charges add 0 to +9 points, mostly at the Warden and for Mage and Cleric. 0.35 is chosen: it keeps the Riftglass Ward's elite share clearly below the Charm's 0.5, and 0.25 wins no more than it except at the Tyrant Cleric (+7) and Colossus Cleric (+3); 0.5 would equal the Charm. Crafted minus plain at 0.35: Warden +55/+60/+41/+46/+30, Colossus +29/+30/+37/+33/+27, Reaver +44/+4/+16/+19/+18, Tyrant +42/+20/+30/+5/+26.
- Crafted supplies, decided 2026-11-08 (user approved, Step 13.3). New supplies that Greyhaven does not sell, brewed at the Potion Shop like any other, plus one shop supply. All are used by rules at 0.5x action time with no cost and no cooldown.

| Supply | Effect | Shop price | Brew | Unlock | Default rule |
|---|---|---|---|---|---|
| Warming Tonic | Removes all Chill and Burn from the hero, restores 10% of maximum HP and makes the hero immune to new Burn for 10 seconds (Step 14.3). | 15 gold (12 until Step 14.3) | 2 hide + 5 gold (4 until Step 14.3) | none | Hero Chill at least 2 stacks |
| Greater Draught | Restores 40% of maximum HP (35% until Step 13.21; 50% until Step 13.5 part 7). | not sold | 2 riftglass + 10 gold | Drowned Causeway discovered | Hero HP at most 40% (30% until Step 13.5 part 7b), placed above the Healing Draught row |
| Riftglass Ward | Same as the Ward Charm but it lasts 8 seconds, absorbs up to 2 telegraphed attacks (Step 13.21) and an elite or boss still deals 35% of each damage effect (25% for one hit, 5 seconds, until Step 13.21). Changed 2026-11-17 (Step 13.20); it was a barrier of 25% of maximum HP for 8 seconds (30% until Step 13.5 part 7). | not sold | 2 riftglass + 12 gold | Any hero has beaten the Tidebound Colossus | Same conditions as the Ward Charm row, placed above it |

  - A locked supply cannot be brewed and shows its lock reason, the same way a locked recipe does. A supply with no shop price cannot be bought.
  - Existing heroes get each new default row once, unless a rule already names that supply; one the player removes later does not come back.
  - Stun cleanse dropped: Stun has nothing to remove (it ends by timer), so a cleanse would do nothing. A Steadfast Tonic would need a new timed-buff effect and is left for a later step.
  - A supply shortcut during a fight is done (Queue and Escape now).
  - Measured 2026-11-08 (Step 13.3 part 5, seeds 1-2, 60 runs each, wins % / mean HP lost %, seed 1 / seed 2; no win bands, numbers only). Packing 3 Greater Draughts and 1 Riftglass Ward instead of 3 Healing Draughts and 1 Ward Charm:
    - Tidebound Colossus, prepared tier (Causeway level 19): Warrior 37 to 100 (HP lost 93 to 48; seed 2: 30 to 100), Assassin 92 to 100 (67 to 46), Ranger 100 to 100 (53 to 45), Mage 100 to 100 (48 to 47), Cleric 77 to 100 (61 to 42). Crafted supplies make the Colossus a win for every class, so they are a strong lever for Warrior and Cleric.
    - Fractured Warden, prepared tier (level 20): Assassin 2/5 to 90/83 (HP lost 100 to 72), Ranger 40/28 to 100/100 (95 to 47), Mage 97/100 to 100/100 (67 to 53), Warrior and Cleric stay 0. Causeway-geared tier (level 22): Assassin, Ranger and Mage already win 100% and stay 100% (HP lost 46 to 42, 46 to 50, 40 to 43); Warrior and Cleric stay 0 (Warden left 32% to 21% for Warrior; Cleric 62% to 58%).
    - Warming Tonic swapped for one Healing Draught (Warden, prepared): worse for every class (Assassin 2/5 to 0/2, Ranger 40/28 to 7/3, Mage 97/100 to 67/63). The Warden applies no Chill or Burn, so the Tonic is never used and the run carries one fewer heal; this measures a wasted slot, not the Tonic's value. Chill and Burn fights were not measured.
    - Baseline rows (arrived, prepared, over, causeway; Causeway arrived, prepared, over) are identical to the run before Step 13.3, and the reference matrix carries no supplies.
- Kept after measurement, 2026-11-03: two Draughts lift the floor Assassin against the level-16 Echo Knight from 7% to 97% wins, and four let every class win. Buying supplies is the intended way past an elite early, paid for in gold.
- Loot capacity is 20. Each Splintered Road enemy drops 4 of its own material: a Fracture Shardling drops a shard, a Starved Wolf drops a hide, and a Deserter drops a scrap.
- The drop uses the momentum already held when the fight is won. The victory then adds its stack. Quantity is `4 × (1 + 5% × stacks)`, rounded half-up. Three stacks turn 4 into 5. One stack does not change a drop of 4, because 4.2 rounds to 4.
- Drops are added in slot order. When the bag is full, older materials stay and the newest quantity that does not fit is lost.
- The scripted intro fills the bag exactly: Shardling pair 8, wolf pair 8, Deserter 4. The next fight is where extra loot is lost.
- Changed 2026-11-08 (user approved, Step 13.2): on a route whose last node is not the Road, the fights at earlier nodes (the Road's 3 fixed fights) drop gold but no materials, so they no longer fill the bag before the zone's own loot. A Road-only run is unchanged. See "Grove and Bastion materials" in §6.

### Elite uniques (Step 14.6)

Decided 2026-11-24 (user approved; numbers are proposals and the measurement gates decide). The first time a hero defeats each of the six elites and then gets home safely, that hero receives one named unique item: a normal crafted-style item with one fixed modifier plus one signature bonus. There are no general drops and no repeat drops (a chance roll would shift existing seeds), no RNG change and no save version bump. The sim only changes in `gearBonusesFor`, which adds each worn unique's signature (the same pattern as the accessory implicits).

| Elite (zone) | Unique | Slot | Item level | Fixed modifier | Signature |
|---|---|---|---|---|---|
| Rootmaw Stalker (Withered Grove) | Rootmaw Treads | feet | 14 | Nimble | Stalker's Step: +3 Evasion, +3 Accuracy |
| Echo Knight (Fallen Bastion) | Echoing Visor | head | 16 | Sturdy | Echo: +2 points cooldown reduction, +5 magical status resistance |
| Tidebound Colossus (Drowned Causeway) | Tidebound Carapace | chest | 22 | Stalwart | Undertow: +4% maximum HP, +3 physical status resistance (decision 2026-11-25; first proposal: heals 2% of damage dealt) |
| Hollowmaw Reaver (Rift Hollows) | Hollowmaw Fang | main hand | 26 | Bloodbound | Gorge: +2 points critical chance, +15 points critical damage |
| Emberwrought Tyrant (Cinder Scar) | Emberwrought Heart | off hand | 32 | Kindled | Banked Fire: +10 magical status resistance, +4 points armor and magical penetration |
| Briar Matriarch (Bloodthorn Barrens) | Briarheart Talisman | accessory (Talisman base, its implicit applies too) | 38 | Staunch | Thornblood: +10 physical status resistance, +3% maximum HP |

Every stat above already exists in `StatBonuses` (evasion, accuracy, cooldown reduction, critical chance and damage, armor and magical penetration, lifesteal, maximum HP, both status resistances), so there is no substitution. The six slots differ and each fixed modifier's level is at or below the item level.

Rules:
- The item is `{ baseId, itemLevel, quality 1.10, durability 100/100, modifiers: [the fixed one], uniqueId }` with no socket, ranks or tempers. The base follows the hero's class (armor category, weapon kind and off-hand kind from the starter table); a Cross-Trained Human uses the class default. The Talisman is the same base for every class.
- The signature scales by min(1, item level / table item level), with the usual rounding (flat points one decimal, fractions four). Rank, temper and quality never touch it, and upgrading past the base level does not raise it. An item below its base level keeps a fraction of it until upgraded.
- The signature is not a modifier: no stack cap, no rank, no temper. The fixed modifier is an ordinary modifier (counts toward the stack cap, can be ranked and tempered) and cannot be replaced.
- Upgrade, free tokens, open socket, infuse (slot 1 only), rank up, temper and repair all work. Craft never makes a unique. An heirloom keeps its `uniqueId`. Reincarnation sends it to the archive with other gear. Selling is allowed at a fixed price of item level x 20 gold (quality ignored), and always asks for a second click that says it cannot be earned again.
- Award: a hero's defeated elites of this life (not the remembered ones from earlier lives) that are not in its first-clear ledger as `unique:<id>` are paid when an expedition settles with the outcome returned. The item goes to the archive and the ledger id is recorded. An elite beaten on a run that ends in defeat stays due. If the hero already holds an item with that unique id, only the ledger id is recorded. Each unique is paid once per hero ever; a sold or lost one is gone. Old saves are paid retroactively at the next safe return.
- An unknown unique id loads as a plain item with the base name and no signature.

Bands as first proposed (superseded for the gates by the decision below; measured with `--matrix uniques`, rules mode, seeds 1 to 3 x 100, mean): every non-record single-unique cell minus its prepared baseline is at most +8 win points for every class (the Warden prepared bound), and the all-six row minus prepared is at most +30 for every class. Cells: Warden prepared (level 20): each of the Colossus, Reaver, Tyrant and Matriarch uniques alone (heirloom-scaled at level 20 over item level) and all six together; Reaver prepared: Colossus; Tyrant prepared: Reaver, plus all six as a record; Matriarch prepared: Tyrant and all six, record only (its gates are accepted exceptions). One-time fallback: halve the failing unique's signature, re-measure, then stop and report. The Warden Warrior is the likely trip.

**Measured 2026-11-25** (`--matrix uniques`, seeds 1 to 3 x 100 runs, rules, mean; unique cell minus its prepared baseline in win points, W/A/R/M/C). Prepared baselines: Warden 40.7 / 24.0 / 48.3 / 37.3 / 46.3, Reaver 41.3 / 80.3 / 80.7 / 80.0 / 59.7, Tyrant 52.0 / 96.0 / 61.0 / 93.3 / 45.3, Matriarch 55.3 / 96.0 / 33.7 / 52.3 / 51.3. A `*` marks a gate that fails.

| Cell | At the proposed signatures | After the one-time fallback (Colossus, Reaver and Tyrant signatures halved) | Bound |
|---|---|---|---|
| Warden + Colossus | +50.0 / +36.7 / +30.7 / +32.3 / +21.0 \* | +29.3 / +29.3 / +19.7 / +23.7 / +11.0 \* | +8 |
| Warden + Reaver | +59.0 / +72.3 / +49.0 / +53.3 / +42.7 \* | +58.7 / +70.3 / +49.7 / +52.0 / +43.7 \* | +8 |
| Warden + Tyrant | +28.0 / +19.0 / +9.0 / +23.0 / +47.0 \* | +27.7 / +14.7 / +7.7 / +20.3 / +43.0 \* | +8 |
| Warden + Matriarch | +4.3 / +4.0 / -2.0 / -1.0 / -4.7 | +4.3 / +4.0 / -2.0 / -1.0 / -4.7 | +8 |
| Warden + all six | +59.3 / +76.0 / +51.7 / +62.7 / +53.7 \* | +59.3 / +76.0 / +51.7 / +61.7 / +53.7 \* | +30 |
| Reaver + Colossus | +32.7 / +6.3 / +11.3 / +14.0 / +11.7 \* | +18.0 / +4.7 / +7.0 / +5.7 / +3.0 \* | +8 |
| Tyrant + Reaver | +8.3 / +0.3 / +4.7 / +1.7 / +12.7 \* | +3.7 / +0.3 / +0.7 / +0.7 / +4.3 | +8 |

Record only, at the proposed signatures: Warden + Rootmaw +9.7 / +11.7 / +13.3 / +7.7 / +5.3, Warden + Echo +0.7 / +9.7 / -1.3 / -4.3 / -7.3, Tyrant + all six +43.7 / +3.7 / +35.0 / +6.3 / +40.0, Matriarch + Tyrant +20.0 / +0.7 / +7.7 / +4.7 / +3.7, Matriarch + all six +44.3 / +4.0 / +59.0 / +32.3 / +37.0.

Split of the gated cells after the fallback (signature only, then fixed modifier only, same cells):

| Cell | Signature only | Fixed modifier only |
|---|---|---|
| Warden + Colossus | +27.0 / +20.0 / +13.7 / +20.0 / +10.7 | +11.3 / +4.3 / +4.3 / +6.0 / -3.0 |
| Warden + Reaver | +5.7 / +4.0 / +6.3 / +4.0 / +4.7 | +59.0 / +69.3 / +48.7 / +50.0 / +40.3 |
| Warden + Tyrant | +5.3 / -1.7 / -0.3 / +1.3 / -2.3 | +23.7 / +15.3 / +5.7 / +20.3 / +45.3 |
| Warden + Matriarch | +11.0 / +2.3 / +2.3 / +7.0 / -2.7 | -2.7 / -3.0 / -6.3 / -4.7 / -4.3 |
| Warden + all six | +43.7 / +55.0 / +33.7 / +37.3 / +27.3 | +59.3 / +73.7 / +51.0 / +56.0 / +52.7 |
| Reaver + Colossus | +18.0 / +4.7 / +7.0 / +5.7 / +3.0 | none (the tier already wears Stalwart) |
| Tyrant + Reaver | +3.7 / +0.3 / +0.7 / +0.7 / +4.3 | none (the tier already wears Bloodbound) |

Result: the gates fail after the fallback. The Warden cells fail mainly because of the fixed modifiers (Bloodbound and Kindled on a level 20 tier that never wears them; halving signatures cannot move them), and the Colossus lifesteal still moves the Warden and the Reaver Warrior above the bound at 1%. The halved values are the ones now in the code; the six-unique table above shows the proposed ones. A design decision is needed before the step can close.

**Decision 2026-11-25** (user, option 1, after the failed gates above):

- Each unique's +8 and all-six +30 gates apply only at its own zone tier and later tiers, where a hero can earn and wear it.
- At the level 20 Warden tier, a unique from a later zone (Colossus, Reaver, Tyrant, Matriarch) is gated on its signature-only cell (+8). Every Warden cell that includes a later-zone fixed modifier is record only, and so is the all-six Warden row (a hero keeps at most three heirlooms).
- Rootmaw Treads and Echoing Visor (zones at or below the Warden) keep the original Warden gate (+8 on the full cell).
- Reaver + Colossus and Tyrant + Reaver stay gated at +8. The Matriarch tier cells stay record only.
- Tidebound Carapace's signature changes from lifesteal to +4% maximum HP and +3 physical status resistance. The name Undertow is kept.
- The halved Reaver and Tyrant signatures return to the proposed values only if their gated cells pass at those values; otherwise they stay halved.
- A gated cell that still fails after one halving of its signature stops the step.

**Measured 2026-11-25 under the decision** (seeds 1 to 3 x 100 runs, rules, mean; win points over the prepared baseline, W/A/R/M/C; a `*` marks a failing gate). "First run" has the proposed Rootmaw, Echo, new Undertow and Matriarch signatures with Reaver and Tyrant still halved. "After one halving" halves Rootmaw, Echo, Undertow and Thornblood and returns the Tyrant to its proposed values (its only gated cell passed at them: +5.0 / +0.3 / -0.3 / +2.7 / -1.3). The Reaver stays halved (Tyrant + Reaver failed at the proposed values).

| Gated cell (+8) | First run | After one halving |
|---|---|---|
| Warden + Rootmaw | +9.7 / +11.7 / +13.3 / +7.7 / +5.3 \* | +1.3 / +2.7 / +3.7 / +3.3 / +3.3 |
| Warden + Echo | +0.7 / +9.7 / -1.3 / -4.3 / -7.3 \* | +0.7 / 0.0 / +0.3 / +0.3 / -8.0 |
| Reaver + Colossus | +16.3 / +6.3 / +5.0 / +6.3 / +2.7 \* | +6.3 / +2.3 / +4.0 / +5.7 / +1.0 |
| Tyrant + Reaver | +3.7 / +0.3 / +0.7 / +0.7 / +4.3 | +3.7 / +0.3 / +0.7 / +0.7 / +4.3 |
| Warden + Colossus, signature only | +13.0 / +11.3 / +7.7 / +12.3 / +8.0 \* | +10.3 / +4.3 / +3.7 / +6.0 / -4.7 \* |
| Warden + Reaver, signature only | +5.7 / +4.0 / +6.3 / +4.0 / +4.7 | +5.7 / +4.0 / +6.3 / +4.0 / +4.7 |
| Warden + Tyrant, signature only | +5.3 / -1.7 / -0.3 / +1.3 / -2.3 | +5.0 / +0.3 / -0.3 / +2.7 / -1.3 |
| Warden + Matriarch, signature only | +11.0 / +2.3 / +2.3 / +7.0 / -2.7 \* | +9.3 / -0.3 / +2.0 / +7.0 / +1.0 \* |

Signatures now in the code: Stalker's Step +1.5 Evasion and +1.5 Accuracy; Echo +1 point cooldown reduction and +2.5 magical status resistance; Undertow +2% maximum HP and +1.5 physical status resistance; Gorge +1 point critical chance and +7.5 points critical damage; Banked Fire as proposed; Thornblood +5 physical status resistance and +1.5% maximum HP. Record-only cells were not measured again after these values.

Result: two gated cells still fail after one halving (Warden + Colossus signature Warrior +10.3, Warden + Matriarch signature Warrior +9.3, bound +8), so the step is stopped again. Two notes for the decision, neither used to pass a gate. The Matriarch "signature only" cell also adds the Talisman base's built-in critical damage; with the signature alone the Warrior reads +6.0 on the gate seeds. On nine other seeds (4 to 12, Warrior only) the two failing cells read +8.6 (Colossus) and +4.7 (Matriarch, +1.8 without the built-in stat).

## 10. Reincarnation and Long-Term Progression

### Trigger

- During every life, the hero must face a boss before reincarnation becomes available: a loss or a victory both unlock it (changed 2026-11-18, Step 13.27; it needed a loss, which locked out strong heroes).
- The Fractured Warden is the only boss. A victory at any Echo rank counts. It is read from the hero's `echoRank`, which a Warden victory raises and reincarnation resets to 0, so no new save field is needed and a hero who already beat the Warden this life is unlocked at once. A loss still sets `bossLossThisLife`.
- Reincarnation is optional after that.
- Facing the boss does not itself grant a reward: Legacy stays level-based plus one-time bonuses, so losing on purpose pays nothing extra.
- All normal defeat costs apply before reincarnation.

### Rewards

- Current level and XP convert into repeatable hero-bound reincarnation currency.
- Boss, zone, and difficulty milestones grant a bonus only the first time that hero reaches them.
- Currency can purchase a mixture of:
  - Small permanent stat gains
  - New racial and class nodes
  - Starting options
  - Utility improvements

Raw permanent power must be controlled to avoid making build decisions irrelevant.

### Reset

Reincarnation resets:

- Level and current XP
- The part of the hero's gold, materials and supplies above the carried share (lost, not converted)
- Allocated attributes
- Allocated skill web
- Current contracts
- Personal world gates and boss access

Reincarnation preserves:

- Individual mastery and purchased legacy upgrades
- Known map locations
- Route returns (`routeReturns`)
- First-clear records and unspent free upgrades (`firstClearIds`, `freeUpgrades`, Step 13.24)
- The crafted backpack (`pack`, Step 13.22)
- Recipes and crafting proficiency
- A share of the hero's gold, materials, supplies and debt (Step 13.31; see "Carry-over and Stockpile" below). The rest is lost
- The hero's archived equipment (all gear, whole)
- The combat setup (Step 13.37): the Default rules, every rule stack, prepared spells and run preparation

### Equipment across lives

- All equipment is archived and retains its normal level/tier requirements.
- One chosen heirloom scales down to the new hero level and grows with the hero.
- Heirloom, decided 2026-11-01: the hero picks one item at reincarnation. Its item level follows the hero's level, up to the level it had when chosen. Quality and modifiers are kept. It can only be changed at the next reincarnation. The Second Heirloom purchase lets a hero keep one more.
- Claim an heirloom now (Step 13.32, decided 2026-11-19): a free heirloom slot (allowance minus items already flagged for the hero, worn or archived) can be used at once on any worn or archived item that is not already an heirloom, with `claimHeirloom`. The item gets `heirloom { heroId, cap: itemLevel }` and is scaled to the hero's level immediately, with the same full-strength modifiers as any heirloom. It costs no gold or materials and is refused during an expedition. An item that is another hero's heirloom, or already an heirloom, is refused. The earlier-life carried-share guards are unchanged (`pastLifeItemIds` is not touched). An heirloom can be sold once the hero's level reaches its cap (2026-11-23). At reincarnation the screen offers one picker per slot (decided 2026-11-19). Items already flagged for this hero start selected. Only the items left selected stay heirlooms; an empty slot keeps nothing extra. A single id passed to `reincarnate` still fills leftover slots with older heirlooms. Sim and harness untouched.
- Always visible (Step 13.45, decided 2026-11-21): the Legacy screen always shows the claim block, headed "Heirloom slot free" when it can be used and "Make an heirloom now" otherwise. It lists slots owned, in use and free as key-values, and while it cannot be used it names the first reason, with the item list and button disabled: an expedition is running ("Finish the expedition first."), no slot is free ("you own N slots and M are used"), or nothing owned could become an heirloom. Behaviour when it is available is unchanged. UI only; `heirloomClaimBlock` in `persist/reincarnation.ts` holds the rule.
- Claim list only when usable (Step 13.46, 2026-11-22): the item list and button appear only when a slot is free and something is claimable; otherwise the block shows only the slot key-values and the reason (no list, no disabled select). When usable, the list is sorted best first (item level, then quality, then id) and a worn piece is marked "(worn)". `claimOptions` in `persist/reincarnation.ts`.
- Heirloom equip rule (Step 13.29, decided 2026-11-18): the heirloom keeps its quality and all its modifiers at full strength; it can be worn at any hero level its scaled item level allows, even when a modifier's own level is higher. Other items keep the strict check: a modifier above the hero's level blocks wearing. An heirloom is bound to its own hero, and a hero keeps one (two with Second Heirloom). Scaling never changes modifiers, ranks or tempers. This allows an early power spike (for example a rank III Siphoning weapon at level 1); the 13.18 Later-lives numbers were not re-measured with it and nothing was tuned. Harness runs use no heirloom, so every guard is unchanged.

First-playable reincarnation numbers, decided 2026-11-01:

- Currency is Legacy: `2 × (level − 1) + floor(5 × XP into the level ÷ XP to the next level)`, so a level 20 hero gets about 38.
- One-time bonuses per hero, claimed at the next reincarnation after the hero first reaches them: +3 for each elite first defeated (Rootmaw Stalker, Echo Knight), +20 for the first Warden defeat, and +5 for each Echo rank first unlocked (+15 for a milestone rank, Step 13.53).
- First clear of a late zone (Step 13.24): +2 for each of the Drowned Causeway, Rift Hollows and Cinder Scar (`ZONE_CLEAR_BONUS = 2`), once that zone's first-clear reward has been paid. It reads `firstClearIds`, not `clearedNodeIds`, so a zone cleared on a run that ended in defeat does not count yet. Claimed at the next reincarnation like the others.
- Legacy buys hero-bound purchases that last across lives. Attribute Seed adds 1 to a starting attribute of the hero's choice and costs 3, up to 10 in total. Skill Point Seed gives 1 unallocated skill point at the start of each life and costs 8, then 12, then 16, up to 3. Second Heirloom lets the hero keep one more heirloom and costs 25, once. Fifth Skill Slot adds a fifth loadout slot and costs 90, once (Step 13.34, below).
- Purchases apply now (Step 13.30, decided 2026-11-18): a purchase also applies to the hero's current life at once, except Second Heirloom (the heirloom is chosen at reincarnation, so it takes effect then). Attribute Seed adds 1 to that attribute on the current life now; Skill Point Seed adds 1 unspent skill point now; Head Start raises the hero to its level now (see Head Start below); Deep Pockets already applied at once. Each later life still starts from the fresh racial base plus every seed, so nothing is counted twice. Purchases planned at reincarnation (Step 13.36) apply from the new life only. Purchases bought before this change are not applied retroactively: the game cannot tell what the current life already has, so those seeds and Head Starts take effect from the next reincarnation as before.
- Mastery is the hero's completed lives, up to 10. Each rank adds 2% ordinary XP, up to +20%, and nothing else.
- The reset and preserve lists above apply. The hero's current contracts are cleared. All equipped gear goes to the archive, and the hero starts the new life with fresh starter gear. Every piece that carries over, worn or archived, is restored to full durability. Wear belonged to the life that ended (decided 2026-11-20). Each heirloom of this hero is then equipped into a slot it can use, in place of the starter piece. A piece that was worn keeps that slot when it still fits. A piece that does not fit, or a second heirloom for a slot that already holds one, stays in the archive.

### Carry-over and Stockpile (Step 13.31)

Decided 2026-11-18 (user: "go with all my picks"). Persist and UI only; `src/sim`, content numbers and every harness matrix stay as they are. Reason: a hero kept every coin, material and supply across lives, so early lives paid for later ones and Legacy was the only brake on growth. Now wealth is mostly lost at reincarnation, gear stays, and long-run growth comes from Legacy purchases.

- Carried share: one integer percent applies to gold, every material id and every supply id. Base 20. Stockpile I, II and III make it 30, 40 and 50 (cost 20, 35 and 50 Legacy, each needs the one before).
- Rounding: for each material id and each supply id, `kept = floor(n * pct / 100)`. A stack that rounds to 0 is removed (4 units at 20% keep 0, 7 keep 1).
- Debt is settled first from gold: `paid = min(gold, debt)`, `gold' = floor((gold - paid) * pct / 100)`, `debt' = ceil((debt - paid) * pct / 100)`. The rest is lost.
- Leftover wealth is lost, not converted to Legacy, so spending it on gear, upgrades and potions before reincarnating is the intended play.
- Kept whole, as before: the archive (all gear, worn gear goes to the archive, heirlooms), free upgrade tokens (`freeUpgrades`), the crafted pack, recipes, crafting XP, route returns, first clears, mastery and purchases. Contracts are still cleared.
- Guard A (earlier-life gear): the shop sells for `item level * 10` and buys back at `item level * 5 * quality`, so without a guard a hero could turn gold into shop gear, reincarnate (all gear is kept) and sell it back, laundering gold past the share. At reincarnation the hero's `pastLifeItemIds` (optional on the save) is set to the id of every archive item; selling such an item pays `floor(itemSellPrice * pct / 100)` at the current carried share (`sellPriceFor`). `sellItem` removes the id from the list when the item is sold, because shop ids can be reused. Items bought or found this life sell at the full price.
- Guard B (craft queue): crafting keeps about all of its gold, so queued jobs could hold wealth through the reset. `reincarnationBlock` refuses while the hero's craft queue is not empty ("Wait for the crafters: jobs are queued or running. They finish first."), like the Trainer drill rule.
- No path moves gold, materials, supplies or items between heroes (`Purse`: "Nothing in it moves between heroes"), so the share cannot be laundered through a second hero.
- Legacy income, for the purchases below: income per life is `legacyFromProgress`, about `2 * (L - 1) + 0..4` (level 20 about 38 to 42, level 25 about 48 to 52, level 30 about 58 to 62). One-time bonuses: 5 elites x 3 = 15, the Warden +20, 3 late zones x 2 = 6, and +5 per new Echo rank (+15 at a milestone rank: 3, 5, 10, 15, ...).
- Purchases (all hero-bound; "applies now" as in Step 13.30 where it makes sense):

| Purchase | Tiers and cost (Legacy) | Effect |
| --- | --- | --- |
| Stockpile I / II / III | 20 / 35 / 50 | Carried share 30 / 40 / 50%; also the share an earlier-life item sells for. Applies at once to the preview and to sales. |
| Artisan's Favor I / II | 30 / 45 | Each new life starts with +1 / +2 free upgrade tokens (they stack with unspent ones). Buying adds +1 token now. |
| Long Memory I / II | 25 / 40 | Recall doubles run XP up to peak level + 3 / + 6 (needs a peak; applies now when the hero has one). |
| Head Start III | 55 (needs II) | Start at level 15 (levels 5 / 10 / 15 cost 20 / 35 / 55). Raises a lower hero to 15 now, as I and II do. |
| Third Heirloom | 50 (needs Second Heirloom) | Keep a third heirloom (allowance 1 + second + third). The free slot can be used at once on an item you own (Step 13.32), or chosen at reincarnation. |

  The nine new buys cost 335 Legacy in total.
- Long Memory deliberately widens the earlier exploit guard line in "Later lives" ("Recall only speeds levels the hero already earned once, and only up to the old peak"): with Long Memory it runs up to 3 or 6 levels above the old peak. It still pays nothing for losing on purpose.
- Gear economy (Section 9): gear from an earlier life sells at the carried share of its normal sell price (see Guard A); gear bought or found this life is unchanged.
- Risk accepted: the first reincarnation after this change cuts an existing hoard (10,000 gold keeps 2,000 at the base share), and Guard B blocks reincarnating while craft jobs run.

### Planning the next life (Step 13.36)

Decided 2026-11-20 (user approved, option B: a planner that commits in one atomic step). Persist and UI only; `src/sim`, content numbers and the harness stay as they are. Nothing about the planner is saved.

- Why: Legacy is paid only inside `reincarnate()`, which also resets the hero, so a player could not spend this life's Legacy on Stockpile, heirloom slots or Head Start before the reset took its toll.
- Flow: "Reincarnate..." on the Legacy screen opens a planner that changes nothing by itself. It shows this life's Legacy (`legacyPreview`) as already available, added to the banked Legacy. The player can stage any Legacy purchase under the usual order and tier rules. Each row has + and −: + adds the next tier of that purchase, and − removes the latest staged one of that same purchase (an attribute seed removes the latest of that attribute). Undo last, Clear and Reset plan stay. Nothing is spent until Begin new life. The preview of the carried share, free upgrade tokens, start level, Recall target and heirloom slots uses the staged purchases.
- Commit: "Begin new life" (after a confirm) is one atomic `reincarnate(save, heroId, heirlooms, plan)`. It checks the usual blocks (expedition, Trainer queue, craft queue Guard B, boss faced), banks this life's Legacy and claims its bonuses, buys the plan in order (each purchase must be affordable at that point, else nothing happens and the reason shows), then resets the hero with the new purchases: the carried share is taken from the purse at that moment, Guard A (`pastLifeItemIds`), the heirloom allowance, `startingProgress` and the Artisan's Favor tokens all read the planned purchases.
- Planned purchases are not applied to the ending life: no seed lands on the old progress, and Head Start does not raise the old level, so it adds no Legacy and does not change the peak. Artisan's Favor still gives its +1 token, as if bought just before reincarnating.
- "Back to this life" leaves the plan as it is, and nothing is spent (the plan is kept from Step 13.43; before that it was discarded and a reload dropped it). The Legacy tab keeps the normal purchase table (purchases apply now) and the heirloom claim for mid-life.

### Saved between-lives plan (Step 13.43)

Decided 2026-11-21 (user approved). Persist and UI only; `src/sim`, content numbers and the harness stay as they are. This replaces the Step 13.36 rule that "Back to this life" discards the plan and a reload drops it.

- What is saved: the planner's staged purchases and heirloom picks, in an optional `nextLifePlan` on the hero (`purchases`: kind and attribute; `picks`: item ids, an empty text is an empty slot). Absent means no plan; no save version bump; old saves load. The planner saves after every change. A plan equal to the starting state (no purchases, picks equal to the hero's current heirlooms) removes the field.
- Restore: opening the planner reads the saved plan and checks it against the hero as they are now. Purchases are replayed in order and each must still be buyable at its point (affordable, not already bought, kind still offered); a pick must still name an owned item and still have a slot (a plan that lost its Second Heirloom purchase loses the pick that needed it). Every entry that fails is dropped and named in a short notice ("... was dropped from your plan. <reason>"), and the cleaned plan is saved so the notice shows once. Nothing stale is applied silently.
- Cleared by: a reincarnation (the plan was spent) and the planner's "Reset plan" button (purchases cleared, picks back to the current heirlooms). "Back to this life" and a reload keep the plan; "Clear" and "Undo last" change it as before. Reading the field changes no price, no Legacy gain and no reincarnation result.

### Combat setup across lives (Step 13.37)

Decided 2026-11-20 (user: go with my picks). Persist and UI only; `src/sim`, content numbers and the harness stay as they are, and a hero with no waiting rules gets an identical combat blueprint.

- Why: reincarnation reset the Default rules to the class starter and cleared every stack, so a player rebuilt a tuned setup every life.
- Kept at reincarnation: the Default rules, every rule stack with its trigger, prepared spells, and run preparation (packed supplies, carried gold, retreat threshold, vow, curse, special arrows, standing orders). Supplies still follow the carried share: a packed supply the stash cannot cover leaves its slot empty, and a supply rule with none packed is skipped as before. Special arrows are cut to the new quiver limit. A kept curse does nothing and does not block town preparation while Cursebound is unlearned; it is still the chosen curse when that node is taken again. A new curse cannot be chosen until then.
- Waiting rules: a rule whose skill (or "skill is ready" condition) names a skill the new life cannot use yet is kept but waiting. The hero lists them in an optional `waitingSkillIds`. A waiting rule is left out of every fight. A stack whose trigger names a waiting skill, or whose rules all wait, is left out too (a stack with no rules at all is kept). The rule editor shows "Waiting for <skill>"; waiting rules can be edited, moved and removed. When the skill becomes usable (learned and back in the loadout, or its Convergence or Release node taken) it leaves the list and its rules work again. A loadout change never deletes a waiting rule.
- Loadout return: the new life starts with the four starting skills and the fifth slot empty. `pastLoadout` remembers the old loadout. When a skill web node teaches a skill that was in it, that skill returns to the loadout: into a free slot, else in place of a starting skill that was not in the old loadout, else in place of another skill not in the old loadout (this replaces a skill the player added this life when no placeholder is left; the notice names it, and it can be reversed by hand). Rules for the replaced skill are removed as a loadout change does today. A skill the player later unequips by hand is not put back.
- Stand-in rules: for each starting skill the new life equips that was not in the old loadout, the class's reference rows for it (only rows whose skill is that starting skill and whose "skill is ready" skills are all available) are appended to the Default rules while there is room (12). They are pruned when that skill is replaced.
- The Legacy screen and the planner show "Combat setup: kept" with counts.
- Saves: `pastLoadout` and `waitingSkillIds` are optional (absent means none); no version bump. Waiting is derived, not stored on a row, because the sim's `PriorityRow` has no such field.
- Three past loadouts (Step 13.42): reincarnating twice quickly used to forget the older loadout. The hero now keeps the loadouts of the last 3 lives in an optional `pastLoadouts` (a list of lists, newest first; the oldest is dropped past 3). An old save's single `pastLoadout` reads as the first entry and is replaced by `pastLoadouts` at the next reincarnation; no version bump. When a node teaches a skill, it returns from the newest kept setup that held it, and the "not in the old loadout" test for what makes room uses that same setup. Waiting rules are unchanged: they depend only on which skills the kept rules name and the new life cannot use, so they hold across any number of lives. The Loadout line names skills from every kept setup.

### Fifth skill slot (Step 13.34)

Decided 2026-11-19 (user approved). A Legacy purchase that lets the hero equip a fifth active skill. Persist and UI only; `src/sim` combat, content and the default harness stay as they are, so every guard stays identical. The only sim change is a pair of exported loadout constants and a `slotCount` argument on `setLoadout` (Part 2).

| Purchase | Cost (Legacy) | Prerequisite | Group | Effect |
| --- | --- | --- | --- | --- |
| Fifth Skill Slot | 90, once | none | Each new life, after Skill Point Seed | Loadout holds 1 to 5 skills instead of 1 to 4. Hero-bound. |

- Rule: the loadout holds 1 to 5 skills with the purchase, otherwise 1 to 4. The slot count is read from the hero's purchases when the loadout is set.
- Applies now: the slot is usable on the current life at once. Nothing is auto-equipped; the player picks the fifth skill in Loadout. Priority rows may name it like any equipped skill.
- Reincarnation keeps the purchase. A new life starts with the four starting skills and the fifth slot empty (the old loadout comes back as its skills are relearned, Step 13.37).
- Sim, content and the default harness are untouched, so the golden duel, the reference CSV and every matrix stay byte-identical.
- Mage note: the Mage has only five loadout skills, so the fifth slot means equipping everything.
- Assassin harness note: the harness `builtSetup` already equips Smoke Step as a fifth skill; it is left alone.
- Measurement (Part 2, 2026-11-19): `npm run sim -- --matrix slots --seed N --runs 100`, seeds 1, 2 and 3, elite fights (Warden, Tidebound Colossus, Hollowmaw Reaver, Cinder Tyrant) in rules mode. The baseline `four` is the class's reference four skills with the tier's supply rows (any extra skill and its rows stripped, every variant holds the same skill-web nodes). A five variant adds one candidate skill with an unconditional row, either `five-last` (after every reference row) or `five-first` (before the first reference row, after the supply rows). Candidates: Warrior Cleave, Reckless Strike; Assassin Smoke Step, Fan of Knives; Ranger Hunter's Mark, Flame Arrow, Volley; Mage Chain Lightning; Cleric Penance, Consecration. The Mage at the Tyrant (12 rows already) cannot take a thirteenth row, so those cells are recorded as `row cap` and the Mage is compared over its other three elites. Means over the three seeds, win rate in points of the class's mean over the elites, plain `prepared` tier (best five variant per class, with the win change and the change in median win time):

| Class | Four (mean win) | Best five | Win change | Median win time | Cells below 95 to 95 or more |
| --- | --- | --- | --- | --- | --- |
| Warrior | 49.4 | Reckless Strike, last (no effect) | +0.0 | +0.0% | 0 of 4 |
| Assassin | 64.6 | Fan of Knives, last | +2.6 | +0.5% | 0 of 4 |
| Ranger | 61.1 | Flame Arrow, last | -32.7 | +6.5% | 0 of 4 |
| Mage (3 elites) | 58.3 | Chain Lightning, last | -46.2 | +7.9% | 0 of 3 |
| Cleric | 50.7 | Consecration, last | +9.2 | -2.1% | 0 of 4 |

  The best candidate per class is the same in the crafted prepared tier except Warrior (Cleave, last, +1.1) and Ranger (Hunter's Mark, last, -19.7). Crafted prepared tier: four means Warrior 90.8, Assassin 92.4, Ranger 92.6, Mage 94.1 (92.3 over three elites), Cleric 75.6; best five changes +1.1, +0.2, -19.7, -43.6 and +7.6 (Cleric Consecration, last); 2 of 20 cells cross to 95 or more (Warrior Cleave at one elite, Cleric Consecration at the Colossus, 79 to 96 in seed 1), 5 of 20 were already there; median win time at most -3.1%. Most other variants are worse than four: an unconditional fifth row spends Ranger Readiness, Mage mana, Cleric HP or Fury ahead of the reference rows (`five-first`) or in place of the basic attack (`five-last`), and Penance and Volley drop the win rate by 40 to 90 points. The Cleric's Consecration is the only candidate that helps clearly (+9.2 plain, per seed +9.8, +8.5, +9.3; Colossus 55 to 77). Warrior Reckless Strike changes nothing in these fights (results identical to four). This measures a naive unconditional row, not a tuned rotation.
- Go/no-go (Part 2): GO. At the prepared tier no class gains more than 10 points (best +9.2, Cleric, close to the line), 0 of the 20 class x elite cells move from below 95% to 95% or more, and no variant cuts median win time (best -3.7%, `five-first` Consecration, which loses 4.5 points). Parts 3 and 4 wait for the user's decision.

#### Tuned fifth skill rows (Step 13.34 follow-up, 2026-11-19)

The Part 2 measurement above used one unconditional row per fifth skill, which spends Readiness, mana, HP or Fury ahead of the reference rows, so the Ranger, Mage and Cleric (Penance) results were far too pessimistic. This follow-up gives each candidate a conditional row built only from the existing rule vocabulary. Harness only (`src/harness/slots.ts`, `TUNED_ROWS`; shard runner `src/harness/slotsTuned.ts`); `src/sim`, content, the default `--matrix slots` and every guard are unchanged. Nothing player-visible changes, whatever the verdict.

Two placements per skill, both measured against the same `four`: `tuned-first` puts the rows ahead of the first reference skill row (after the supply rows); `tuned-last` puts them after every conditional reference row but before the unconditional fallback attack, because a row after that attack could never fire. Resource thresholds are on the 0 to 100 meter (Fury, Readiness, mana, Faith). One attempt per skill, written before measuring, not fitted to the results, with the two refinements listed below.

| Skill | Row condition (all must pass) |
| --- | --- |
| Cleave | 2 or more enemies; Fury at least 50 |
| Reckless Strike | hero HP at least 70%; Fury at least 60 |
| Smoke Step | hero HP at most 50% |
| Fan of Knives | 2 or more enemies |
| Hunter's Mark | fight time at most 1 second (opener) |
| Flame Arrow | Readiness at least 60; target not burning; special ammo at least 1 |
| Volley | Readiness at least 80 |
| Chain Lightning | 2 or more enemies; mana at least 60 |
| Penance | hero HP at least 70%; Faith at most 50 |
| Consecration | row 1: 2 or more enemies; Faith at least 50. Row 2 (the OR): target HP at least 50%; Faith at least 60 |

- "The target is an elite" cannot be read by a rule, so Consecration row 2 uses a healthy target (50% or more HP) as the stand-in: cast it early in a long fight.
- Refinement 1 (Hunter's Mark): the first gate was "target not marked" (`mark` absent). Hunter's Mark only reveals the target and sets no status the rule can read, and the `mark` condition reads the Assassin's Mark for Death, so the gate never closed and the skill was recast every cooldown (Ranger -36.4 at best). It is now an opener. Result: no effect (+0.0 in every cell; the skill has no damage).
- Refinement 2 (Smoke Step): the first draft had two rows (opener, or HP at most 50%), which passes the 12-row cap for the Assassin (11 rows with supplies), so it was never run. It is now the HP row only.
- Consecration was also run as a single row (healthy target and Faith 60 only) so it fits the Cinder Tyrant under the 12-row cap. It measured worse (best -4.5 over four elites), so the two-row version stays, and the Tyrant is recorded as `row cap` for it, like the Mage. The Mage and Cleric rows below are therefore over three elites (Warden, Colossus, Reaver), each with its own `four` mean.

Method: the full set is 10 candidates x 4 elites x 2 tiers x 3 variants (`four` and the two tuned placements) x 300 runs. It ran as 15 parallel Node processes (`npx tsx src/harness/slotsTuned.ts <class> <seed> <runs> <out.json> [skills]`, one per class and seed, seeds 1 to 3, 100 runs per cell), and the JSON was merged by a throwaway script that averages the win rate over the three seeds per cell. The refinements were re-run as extra shards (Hunter's Mark, Smoke Step, the one-row Consecration) and replace the first draft. The naive variants were not re-run; they are quoted from Part 2. Median win time is the mean over cells of each cell's change in the seed-averaged median.

Results at the plain `prepared` tier (best tuned variant per class by mean win change; "cells crossing" counts cells that move from below 95% to 95% or more):

| Class | Four (mean win) | Best tuned five | Win change | Median win time | Cells crossing |
| --- | --- | --- | --- | --- | --- |
| Warrior | 49.4 | Cleave, tuned-first | +7.6 | -3.1% | 0 of 4 |
| Assassin | 64.6 | Fan of Knives, tuned-last | +7.1 | -1.6% | 0 of 4 |
| Ranger | 61.1 | none helps (Hunter's Mark and Volley-last +0.0) | +0.0 | 0.0% | 0 of 4 |
| Mage (3 elites) | 58.3 | Chain Lightning, tuned-first | +7.4 | -0.1% | 0 of 3 |
| Cleric (3 elites) | 53.8 | Consecration, tuned-last | +5.4 | -2.5% | 0 of 3 |

- Other tuned candidates at `prepared`: Warrior Cleave last +7.0, Reckless Strike +0.0 (never fires in these fights); Assassin Fan of Knives first +5.3 (one cell crosses, Tyrant 95 to 96), Smoke Step last +1.3 and first -2.2; Ranger Volley first -6.9, Flame Arrow last -7.3 and first -14.2; Mage Chain Lightning last +5.7; Cleric Consecration first +2.9, Penance -13.1 in both placements.
- Naive row (Part 2) against tuned, best per class: Warrior +0.0 to +7.6, Assassin +2.6 to +7.1, Mage -46.2 to +7.4, Ranger -32.7 to +0.0. The Cleric went the other way: naive Consecration +9.2 (four elites, Tyrant included) against +5.4 tuned (three elites) and -4.5 for the one-row version over four. The unconditional Consecration cast more often than the gated one.
- `prepared-crafted` tier: best change +0.9 Warrior (Cleave first, Warden 94 to 97), +1.4 Assassin (Fan last), +0.0 Ranger, +2.9 Mage (Chain Lightning first, 92.3 to 95.2), +5.1 Cleric (Consecration first, 78.3 to 83.4). At most one cell per class crosses to 95 or more. Median win time never improves by more than 3.9% (Cleric Consecration first).
- Reading the losses: Penance (-13 to -19) and Flame Arrow (-7 to -14) lose even when gated, because the HP and Readiness they spend are what the reference rows live on. Volley fires only at Readiness 80, so behind Aimed Shot it almost never fires. These fights are mostly single-target, so Cleave, Fan of Knives and Chain Lightning gain only where adds appear (the Warden and the Colossus).

Go/no-go on the same thresholds (best class gain over 10 points; more than half of the 20 prepared cells crossing to 95 or more; median win time cut by more than 20%): GO. The best class gain is +7.6 (Warrior), 0 of the 18 measured prepared cells cross, and the best median win time change is -3.9%. A well-played fifth skill is a modest edge (about 5 to 8 points of win rate at the elites for four of the five classes, none for the Ranger), not a new tier of power.

Price: the 90 Legacy price still looks right. The slot is worth at most about 8 points of win rate in the hardest fights, mostly for the Warrior, Mage and Assassin (and the Cleric with an unconditional Consecration), and the Ranger has no useful fifth skill in the current kit. No change is proposed. This measures a hand-built rotation at the four elites, not a player's skill web, so it is a floor for a thoughtful player rather than a ceiling.

#### Ranger fifth skill (Step 13.35, 2026-11-20)

Why the Ranger gains nothing from the slot: Readiness has no regeneration in combat (`regenPerSecond` 0) and only hit basic attacks give it (about 22 per hit). The reference rows (Fade Back on a telegraph, Aimed Shot at 40 or more, an unconditional Piercing Arrow) already spend all of it, so any extra skill costs a basic attack, which is the income. Hunter's Mark only reveals, and every enemy starts revealed, so it does nothing. The reference loadout also has Snare Trap equipped with no row.

Harness only. The content variants are patched copies of the skill definition (`{ ...defs, skills: { ...defs.skills, [id]: patched } }`, `gameDefs()` is never mutated) and the player-visible game does not change. Tools: `slotSetup` and `runSlotsMatrix` in `src/harness/slots.ts` take optional rows and defs overrides and a `swap` variant (the candidate replaces Snare Trap, four skills); the variants and the shard runner are in `src/harness/slotsRanger.ts`. Hunter's Mark keeps cost 0 Readiness and action time 0.5x in every variant.

| Variant | Skill change | Row (all conditions) |
| --- | --- | --- |
| HM-X | Hunter's Mark tags mark and physical, cooldown 8, effects: reveal, Expose (chance 1, armor 30%, resistance 30%) | target Expose absent |
| HM-XR | HM-X plus 10 Readiness | target Expose absent |
| HM-R | Hunter's Mark cooldown 8, effects: reveal, 20 Readiness | Readiness at most 60 |
| FA-0 | Flame Arrow cost 0 Readiness (still 1 special arrow) | target Burn absent; special ammo at least 1 |
| P-snare | none (Snare Trap is already equipped) | opener: fight time at most 1 second |
| P-volley | none (Volley as fifth skill) | 2 or more enemies; Readiness at least 55 |
| P-flame | none (Flame Arrow as fifth skill) | Readiness at least 90; target Burn absent; special ammo at least 1 |

Placements: `tuned-first` (ahead of the first reference skill row) and `tuned-last` (before the unconditional Piercing Arrow); a variant that gains is also run as `swap` (four skills, Snare Trap out). Runs: Ranger, four elites x prepared and prepared-crafted, seeds 1 to 3 x 100, sharded by variant, placement, seed and tier (`npx tsx src/harness/slotsRanger.ts`). Side check: a four-skill Ranger with the winning Hunter's Mark swapped in at the built fights (nine-point build: Rootmaw Stalker, Echo Knight, Warden); flag if it gains more than 10 points.

Verdict rule: pick a variant if the Ranger prepared mean gains +4 or more in every seed, at most +10, with at most half of the 4 prepared cells crossing from below 95% to 95% or more and the median win time cut by at most 20%. Preference order HM-X, HM-XR, HM-R, FA-0. If none qualifies, the recommendation is the stopgap label (the Ranger's fifth slot is documented as no use yet).

Results (seeds 1 to 3 x 100, Ranger, four elites; prepared four mean 61.1, prepared-crafted four mean 92.6; win change in points, per seed in brackets, cells crossing to 95 or more, median win time change):

| Variant, placement | Prepared change | Per seed | Crossing | Median win time | Crafted change |
| --- | --- | --- | --- | --- | --- |
| HM-X, first | -13.7 | -11.8, -17.5, -11.8 | 0 of 4 | +3.7% | -7.2 |
| HM-X, last | -6.7 | -4.7, -9.8, -5.5 | 0 of 4 | +4.5% | -4.3 |
| HM-XR, first | -3.6 | +1.7, -9.3, -3.3 | 0 of 4 | +0.9% | -1.5 |
| HM-XR, last | +7.1 | +8.0, +3.2, +10.0 | 0 of 4 | +1.2% | +2.6 (1 cell crosses) |
| HM-R, first | +2.9 | +4.7, +3.2, +0.7 | 0 of 4 | +0.6% | +1.7 |
| HM-R, last | +7.3 | +8.8, +6.2, +7.0 | 0 of 4 | +2.6% | +2.2 (1 cell crosses) |
| FA-0, first | -15.3 | -13.5, -16.0, -16.5 | 0 of 4 | +1.9% | -5.6 |
| FA-0, last | -17.4 | -14.5, -21.5, -16.3 | 0 of 4 | 0.0% | -8.0 |
| P-snare opener (either) | +0.0 | 0, 0, 0 | 0 of 4 | 0.0% | +0.0 |
| P-volley, first / last | -6.9 / +0.0 | -7.5, -7.3, -6.0 / 0, 0, 0 | 0 of 4 | +0.2% / 0.0% | -4.0 / +0.0 |
| P-flame, first / last | -5.8 / +0.0 | -5.0, -7.0, -5.5 / 0, 0, 0 | 0 of 4 | +3.0% / 0.0% | -1.7 / +0.0 |

- Why: the gain is the Readiness, not the Expose. HM-X (Expose only) loses 7 to 14 points because casting it costs a basic attack and the Expose does not repay it; adding 10 Readiness (HM-XR) turns it positive when the row runs late, and 20 Readiness at cooldown 8 (HM-R, Readiness at most 60) gives about the same +7. Flame Arrow at cost 0 still burns the special arrows and a turn, and loses 15 to 17. The three probes with unchanged content are inert or negative: the Snare Trap opener and the `last` placements of Volley and Flame Arrow changed no result at all (+0.0 in every cell; why was not investigated), and the `first` placements lose 6 to 7 points.
- `swap` (candidate replaces Snare Trap, four skills) is identical to five skills for both HM-R and HM-XR (+7.3 and +7.1 with the same per-seed values): Snare Trap has no row in the reference rules, so it never fires and the slot it holds is free. The Ranger's gain does not need the fifth slot at all.
- Side check (nine-point Ranger, four skills with the variant swapped in for Snare Trap, seeds 1 to 3 x 100): HM-R last Rootmaw Stalker 94.0 to 89.7, Echo Knight 38.3 to 35.3, Warden 0 to 0; HM-XR last Rootmaw 94.0 to 98.3, Echo Knight 38.3 to 45.7, Warden 0 to 0. Nothing gains more than 10 points, so no flag.
- Verdict (rule read strictly: at least +4 in every seed): HM-X fails (negative), HM-XR fails on seed 2 (+3.2; its mean +7.1 passes), HM-R last QUALIFIES (+7.3 mean, +6.2 to +8.8 per seed, 0 of 4 cells crossing, median win time +2.6%, i.e. not cut). If the rule is read as the mean only, HM-XR last also qualifies but HM-R is the better-behaved variant, and by the preference order HM-XR would come first. Recommendation to the user: this is a content change (Hunter's Mark would grant Readiness), so it needs a decision; the measurement shows a Ranger fifth skill worth about +7 only because Hunter's Mark becomes a Readiness battery, and that same +7 is available with four skills (swap), so the slot itself is not what pays. The alternative is the stopgap label (the slot has no Ranger skill that helps). Nothing in the game changed in this step.

### Hunter's Mark grants Readiness (Step 13.40)

Decision (2026-11-21, user approved the measurement above). Hunter's Mark becomes a real skill for the Ranger: it still reveals the target, and now also gains 20 Readiness, with an 8-second cooldown (was 5). Cost stays 0 Readiness and action time 0.5x. This is exactly the measured HM-R definition (`src/harness/slotsRanger.ts`: `cooldownSeconds` 8, effects reveal and resource 20); no new numbers.

The measured row is "Readiness at most 60", placed last (before the unconditional Piercing Arrow): +7.3 on the Ranger elites (seeds +8.8, +6.2, +7.0), 0 of 4 cells cross to 95, median win time +2.6%. The row is not added to the reference rows: Hunter's Mark is learnable through the skill web (Pathfinder cluster) and is not in the reference loadout, so reference fights and all guards stay unchanged and only a Ranger who learns and equips it, with a row like that, feels the change. Old saves keep the id `hunters-mark`; any rule that uses it starts granting Readiness. The skill count and loadout slots are unchanged.

### Venom passive (Step 13.39)

Planned 2026-11-20. The Assassin's Venom Edge stops being an equipped skill and becomes the passive "Envenomed strikes" (trait text in section 4, "Assassin: Advantage"). Parts 1 and 2 change nothing the player sees: the hook is `GameDefs.envenom` (`baseChance`, `coefficient`, `nodeCoefficient`, optional `basicOnly`), absent in `gameDefs()`, so every guard stays byte-identical. Only the harness sets it, on patched copies of the definitions.

Rules: after a direct-damage action resolves, each enemy it damaged (hit, HP lost greater than 0, still alive) gets one Poison application (`baseChance`, tick `coefficient`, or `nodeCoefficient` with the Venom Edge node; physical Power; Potent Toxins' potency applies as for any Poison). Once per action per target, in first-strike order, before Toxic Opportunity's check, so Toxic Opportunity sees the new stacks. A killing blow applies nothing.

Steady-state math (Poison ticks every 2 s, so the figures are Physical Power per second): today at the cap, 5 stacks x 0.15 / 2 = 0.375 per second, and 7 x 0.15 / 2 = 0.525 with Potent Toxins. A passive tick of 0.10 gives 0.25 and 0.35. The passive reaches the cap in about 5 actions instead of 16 to 20 s of Venom Edge casts, and it spreads to every enemy a skill damages, so a lower tick loses at the cap in long boss fights and wins in multi-target trash.

Decisions awaiting the user (recommendations, see IMPLEMENTATION_PLAN Step 13.39): Q1 innate at T0, the Venom Edge node raises it to T1; Q2 Venom Edge kept as a retired hidden skill plus a `HERO_UPDATES` migration; Q3 `startingSkillIds` 3 to 4 so the Assassin has a free slot; Q4 final values decided after the measurement.

Decision (2026-11-20, user approved after the measurements below): the Assassin gets Envenomed strikes innately with a 10% tick (the measured configuration; every measured cell had the Venom Edge node), a basic attack coefficient of 1.1 instead of 1 (`basicBonus` 0.1), base chance 100%, and the freed slot left empty. `gameDefs()` sets `envenom = { baseChance: 1, coefficient: 0.08, nodeCoefficient: 0.10, basicBonus: 0.1 }`. The Venom Edge node keeps its purpose by raising the tick from 0.08 to 0.10 (the 0.08 floor tick is below the measured band and was not measured on its own; the measured passive-08 variants had the node). The arrived tier is excluded from the GO rule: the Assassin wins about 2% there before the change (up to 10.6% with basic +10%), so a gain of 8.6 points is a hopeless fight becoming winnable now and then, not an elite breaking. `shadowCutBonus` and `bossCoefficient` stay in the hook, dormant (`gameDefs()` does not set them; the harness variants use them). The Venom Edge skill is kept as a retired hidden skill so old saves, away runs and saved rules still parse; the Assassin has three starting skills (Mark for Death, Shadow Cut, Execute), and `startingSkillIds` is 3 to 4 long.

Measurement variants (harness only, `src/harness/venom.ts`; Assassin, rules mode, every elite cell plus the Warden arrived/prepared/over/causeway tiers, seeds 1 to 3 x 100): `current` (no envenom, today's loadout); `passive-06/-08/-10/-12/-15` (tick = node tick, Venom Edge removed from skills and rows) each with the freed slot `-empty`, `-smoke` (Smoke Step) or `-fan` (Fan of Knives on `enemyCount >= 2`); `proc50` (tick 0.10, base chance 0.5); `basic-10` (basic attacks only); `fan-only-10` (Poison only from Fan of Knives); and the `+to` / `+ts` modifiers (Toxic Opportunity, then Toxic Sovereign allocated) on the best two ticks and on `current`.

GO/NO-GO rule: a variant is GO if, against `current` at the same tier, the Assassin mean elite win rate changes by no more than 8 points either way per tier; no more than half the cells cross from below 95 to 95 or more; the median win time does not fall by more than 20%; the Warden prepared tier stays within 8 points; and the `+to` / `+ts` variants do not exceed +12 points over the same nodes on `current`. The pick is the lowest tick that is GO with the `-empty` slot (the passive must not need the freed slot to break even). If none is GO, report the nearest variant and the alternatives.

Measurement (2026-11-20, `src/harness/venom.ts`, Assassin rules mode, 16 cells, seeds 1 to 3 x 100, CSV `reports/2026-11-venom.csv`). Baseline `current` mean 68.3 (Warden prepared 31.3, prepared tier 60.7). The elite builds already carry Smoke Step, so `-smoke` is the same loadout as `-empty` and was not run separately; `-empty` is four skills (Mark, Shadow Cut, Execute, Smoke Step). Every variant had the Venom Edge node, so the tick measured is always the node tick (T0 alone was not measured).

| Variant | All cells | Prepared tier | Warden prepared | Verdict |
| --- | --- | --- | --- | --- |
| passive-06-empty | -- | -- | -17.3 | NO-GO |
| passive-06-fan | +2.2 | +4.3 | -7.7 | GO |
| passive-08-empty | +2.0 | +4.2 | -8.7 | NO-GO (Warden prepared) |
| passive-09-empty (extra) | +3.2 | +5.9 | -10.7 | NO-GO (Warden prepared) |
| passive-10-empty | +4.7 | +8.7 | -7.3 | NO-GO (prepared tier by 0.7) |
| passive-12-empty | -- | +16.0 | +10.7 | NO-GO |
| passive-15-empty | -- | +23.0 | +26.3 | NO-GO |
| passive-08-fan / -10-fan / -12-fan / -15-fan | -- | +10.5 / +16.8 / +23.0 / +28.7 | -- / +13.7 / +31.0 / +46.3 | NO-GO |
| proc50, basic-10, fan-only-10 | -- | -- | -15.7 / -19.0 / -23.0 | NO-GO |

Modifiers (delta against `current` with the same nodes): `+to` 08 / 09 / 10 empty: Warden prepared -26.0 / -19.3 / -14.7, all cells -0.3 / +1.7 / +3.0; `+ts`: Warden prepared -36.0 / -30.0 / -23.0, all cells -2.6 / -0.6 / +0.7. Nothing exceeds +12 anywhere. Poison uptime is 96% for every passive against 93% for `current`; peak stacks 6.1 to 6.4 against 4.6 (cap 7 with Potent Toxins).

Reading: the only cell the passive breaks is the Warden at the prepared tier (a boss, Poison cap 3 to 4): each Venom Edge cast is replaced by nothing, so the boss fight loses direct damage and the passive's stacks cap early; Toxic Opportunity and Toxic Sovereign make it worse because `current` gains more from them there. Elsewhere the passive is a small gain at 0.08 to 0.10 and runs away above 0.12. No `-empty` variant is GO. Nearest: passive-10-empty (fails the prepared tier by 0.7 points, Warden prepared within the band) and passive-08-empty (Warden prepared 0.7 over). Proposed choice for the user: tick 0.10 with the slot empty, accepting the 0.7 miss, plus a boss-side fix (for example the Warden prepared fight is where Venom Edge's own 90% hit mattered) before Part 3; alternative: passive-06-fan is the only GO but needs the freed slot for Fan of Knives.

Boss compensation round (2026-11-20, user decision: Venom Edge becomes a true passive at a 10% tick). The Warden prepared cell loses the Venom Edge hit, so three compensations are measured with the freed slot empty and no Toxic Opportunity or Sovereign: A) basic attack coefficient +10, +20, +30%; B) Shadow Cut coefficient +10, +20, +30% (the Marked 135% and the unmarked 110% alike); C) only if A and B both fail, a boss-only tick of 12%. Same GO/NO-GO rule and seeds (results follow below once measured).

Results of the boss compensation round (tick 0.10, slot empty, seeds 1 to 3 x 100, deltas in points vs `current`, "cross" is cells moving from below 95 to 95+ out of 16, median is the mean per-cell change in median win time):

| Variant | arrived | prepared | over | prepared-crafted | Warden prepared | all | cross | median | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| passive-10-empty (reference) | +6.8 | +8.7 | +1.5 | +3.6 | -7.3 | +4.7 | 2 | -7.1% | NO-GO (prepared by 0.7) |
| A basic +10% | +8.6 | +1.2 | +0.9 | +1.6 | -7.3 | +2.5 | 0 | -6.4% | NO-GO (arrived by 0.6) |
| A basic +20% | +11.7 | +9.8 | +1.4 | +4.3 | +0.7 | +6.1 | 2 | -7.2% | NO-GO (arrived, prepared) |
| A basic +30% | +13.7 | +7.0 | +1.7 | +1.3 | -8.0 | +5.1 | 2 | -6.6% | NO-GO (arrived; Warden prepared at the edge) |
| B Shadow Cut +10% | +11.1 | +15.8 | +1.8 | +5.2 | +8.3 | +7.8 | 3 | -9.5% | NO-GO |
| B Shadow Cut +20% | +14.8 | +20.5 | +2.3 | +6.9 | +21.7 | +10.2 | 4 | -11.5% | NO-GO |
| B Shadow Cut +30% | +20.1 | +24.2 | +2.3 | +8.0 | +28.3 | +12.4 | 5 | -13.4% | NO-GO |
| C boss tick 0.12 | +6.8 | +11.3 | +1.5 | +4.9 | +3.3 | +5.7 | 2 | -7.8% | NO-GO (prepared) |

Reading: Shadow Cut is far too strong a lever (Marked 135% hits are most of the damage) and basic attacks are weak but noisy. The Warden prepared cell is one cell with a seed spread of about 10 to 20 points (basic +30% reads -8.0 yet +20% reads +0.7), so it cannot rank the basic variants. A basic +10% is the nearest to GO: only the arrived tier fails, by 0.6 points, and that tier starts at 2% (2.0 to 10.6), so the failure is a weak-hero fight becoming winnable sometimes rather than an elite breaking. No variant is strictly GO. The hook options (`basicBonus`, `shadowCutBonus`, `bossCoefficient`) are measurement-only and absent from `gameDefs()`.

Part 3 switch (2026-11-20): `gameDefs()` now carries `ENVENOM` and the Assassin reference loadout is Mark for Death, Shadow Cut, Execute (no Venom Edge row; the `venom-edge` scenario still equips the retired skill). Re-measured the shipped configuration (`live`, seeds 1 to 3 x 100, the harness `live` variant equals `passive-10-basic10` exactly): all cells +2.5, prepared +1.2, Warden prepared -7.3, arrived +8.6 (excluded). With the Toxic nodes: `live+to` vs `current+to`: Warden prepared -21.7 (seeds -9, -34, -22), prepared tier -3.1, all cells +0.8; `live+ts` vs `current+ts`: Warden prepared -33.7, prepared tier -9.5, all cells -1.5. The Warden prepared cell with a Toxic node is outside the +/-8 band, so Parts 4 and 5 wait for the user. Cause: against the Warden (Poison cap 3 to 4) the two Toxic nodes make the old Venom Edge cast worth more than the passive's stacks (Toxic Opportunity paid for a Poison hit on the Marked target every Venom Edge cast, and Toxic Sovereign keeps a longer-lived stack on it).

Toxic nodes round (2026-11-20, user approved option 1, measurement only): with the passive on, Toxic Opportunity also triggers on any direct-damage action that hits the Marked target (the normal one-trigger-per-action cap still applies, and a Mark exploit already counts as the trigger), not only on a fresh Poison stack. Toxic Sovereign has no application trigger (its Poison does not lose duration and spreads on death), so it benefits through the Toxic Opportunity node it requires; both rows are measured. Hook fields on `GameDefs.envenom` (absent in `gameDefs()`, harness only): `toxicAnyHit`, and the damped forms `toxicEvery` (only every nth qualifying action) and `toxicCooldownMs` (a short internal cooldown on the trigger). Variants: `live-any`, `live-every2`, `live-cd2` (2 s), each with `+to` and `+ts`, against `current` with the same nodes, seeds 1 to 3 x 100, same cells, arrived tier excluded. Rule: Warden prepared and the prepared tier within +/-8, at most half the cells crossing to 95+, median win time not down more than 20%. If option 1 undershoots (below -8), option 2 (a higher boss Poison cap for the Toxic nodes) is measured next.

Toxic nodes results (seeds 1 to 3 x 100, deltas in points vs `current` with the same nodes; W = Warden prepared, P = prepared tier, all = all 16 cells, cross = cells moving from below 95 to 95+, median = mean change in median win time; arrived excluded, it is +10 to +11 everywhere):

| Variant | W (+to / +ts) | P (+to / +ts) | all | cross (+to / +ts) | median | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| live (shipped, Part 3) | -21.7 / -33.7 | -3.1 / -9.5 | +0.8 / -1.5 | 3 / 1 | -4.3% / -0.5% | NO-GO |
| live-any (option 1) | -11.3 / -22.7 | +4.2 / -0.7 | +4.0 / +2.0 | 4 / 1 | -6.0% / -2.3% | NO-GO (undershoots) |
| live-every2 | -16.3 / -22.7 | +2.5 / -1.0 | +3.1 / +1.5 | 4 / 1 | -5.3% / -1.5% | NO-GO |
| live-cd2 (2 s) | -12.3 / -23.7 | +3.5 / -1.4 | +3.5 / +1.5 | 4 / 1 | -5.4% / -1.7% | NO-GO |
| live-cap80 (option 2, boss cap 80%) | -5.0 / -7.7 | +1.1 / -3.0 | +2.5 / +0.6 | 3 / 1 | -5.5% / -2.0% | GO (W -7.7 close to the edge) |
| **live-cap100 (option 2, boss cap 100%)** | **+3.3 / +1.0** | **+3.2 / -0.8** | **+3.1 / +1.2** | **3 / 1** | **-5.8% / -2.6%** | **GO** |
| live-any-cap80 | +6.3 / +3.0 | +8.6 / +5.7 | +5.6 / +3.9 | 5 / 1 | -6.8% / -3.7% | NO-GO (P +8.6 by 0.6) |
| live-any-cap100 | +15.0 / +9.3 | +10.8 / +7.3 | +6.2 / +4.3 | 5 / 1 | -7.1% / -4.8% | NO-GO (overshoots) |

Reading: the any-hit trigger alone undershoots (the damped forms are worse, as they trigger less). The gap at the Warden is the boss Poison cap (0.6 of 7 is 4): `current` kept stacks capped with Venom Edge casts that paid the Toxic nodes every time. A boss Poison cap of 100% of the normal cap when Toxic Opportunity is allocated (`toxicBossCapFactor` 1, option 2 alone, no any-hit change) lands every tier within the band (other tiers: over +1.2 / +0.3, prepared-crafted +0.3 / -1.8) and is the recommended winner. Option 2 takes effect in `poisonApplicationAdjust` (an optional `bossCapFactor`, used by `applyPoison` through `statusStackCap`) and in the Toxic Sovereign spread; it is still measurement only and `gameDefs()` does not set it. Guards stay byte-identical.

Decision (2026-11-21, user approved the Toxic nodes result): the boss Poison cap fix ships. `ENVENOM.toxicBossCapFactor` is 1, so a boss takes the hero's full Poison cap while Toxic Opportunity is allocated (without the node it stays 60%). Measured as `live-cap100`: Warden prepared +3.3 with Toxic Opportunity and +1.0 with Toxic Sovereign vs `current` with the same nodes, prepared tier +3.2 / -0.8, crossings 3 / 1, median win time -5.8% / -2.6%. The any-hit trigger, `toxicEvery` and `toxicCooldownMs` stay measurement-only and dormant.

Base tick on its own (Step 13.47, measured 2026-11-22, measurement only, no content change): every earlier cell had the Venom Edge node, so the 8% base tick was never measured alone. Variants: `live-nonode` (shipped passive, `assassin-venom-edge` not allocated, so the tick is 8%) and `live` (node, 10%), each against `current` (the old Venom Edge skill with its node), plus references `current-nonode`, and `live-base09-nonode` / `live-base10-nonode` (shipped passive, no node, base tick 9% or 10%). Same cells (16, seeds 1 to 3 x 100), rule as above (arrived excluded from the +/-8 check). The Tyrant builds now carry 12 priority rows (the Burn Warming Tonic row), so restoring the Venom Edge row for `current` would make 13 and the sim refuses that; `current` therefore drops the Burn Tonic row on the four Tyrant cells, which is not like-for-like with `live`. The table gives all 16 cells and the 12 cells without the Tyrant (`VENOM_EXCLUDE=tyrant`, the clean comparison; Part 3 of 13.39 had the same Warden prepared figure of -7.3 for `live`, a check that the harness still reproduces it).

| Variant (vs `current`) | Cells | arrived | prepared | over | prepared-crafted | Warden prepared | crossing | median win time | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| live-nonode (8%) | 16 | +4.3 | +3.0 | +3.2 | -2.5 | -16.0 | 1 of 16 | -2.7% | NO-GO (Warden prepared) |
| live-nonode (8%) | 12, no Tyrant | 0.0 | -12.3 | +0.1 | -4.4 | -16.0 | 0 of 12 | -1.9% | NO-GO (prepared, Warden prepared) |
| live-base09-nonode (9%) | 16 | +6.7 | +5.9 | +3.2 | +0.3 | -9.7 | 1 of 16 | -4.5% | NO-GO (Warden prepared by 1.7) |
| live-base09-nonode (9%) | 12, no Tyrant | 0.0 | -8.2 | +0.2 | -0.6 | -9.7 | 0 of 12 | -3.7% | NO-GO (prepared by 0.2, Warden prepared) |
| live (10%, node) | 16 | +8.6 | +8.9 | +3.3 | +1.6 | -7.3 | 1 of 16 | -6.1% | NO-GO on arrived (excluded) and prepared (Tyrant baseline) |
| live (10%, node) | 12, no Tyrant | 0.0 | -4.1 | +0.2 | +1.3 | -7.3 | 0 of 12 | -5.4% | GO |

Per seed, Warden prepared: `live-nonode` -9, -16, -23; `live-base09-nonode` -5, -3, -21; `live` -7, -1, -14. `current` mean 65.8 over 16 cells (68.2 over 12); `current-nonode` (the old skill without the node, for reference) 62.8 (64.9). Poison uptime 96% for every passive, 93% for `current`; peak stacks 6.1 against 4.6.

Verdict: the 8% base tick fails the rule. Warden prepared is 16.0 points below `current` (limit 8, so 8.0 over), and on the clean 12 cells the prepared tier is 12.3 below (4.3 over); the other tiers, the crossings (1 of 16) and the median win time (-2.7%) pass. It is the boss cell again, the same cause as before (a passive stacks Poison without the old Venom Edge's direct hit, and the 8% tick is too weak to make that up at the Poison boss cap), not a runaway. A passing base tick is 10% (Warden prepared -7.3, prepared tier -4.1 on the 12 cells, every other check inside the band); 9% still fails (Warden prepared -9.7, prepared tier -8.2 on the 12 cells). Nothing is applied: with a 10% base the Venom Edge node would have no tick left to raise, so shipping it needs a decision on what that node does instead, or on keeping 8% and a different compensation (the node is the only thing that makes the shipped Assassin pass at the Warden). Decision on this is the user's.

Toxic guard matrix (Step 13.48, 2026-11-22): `npm run sim -- --matrix toxic --seed 1 --runs 5` (`src/harness/toxic.ts`). No other guard carries Toxic Opportunity or Toxic Sovereign, so the boss Poison cap fix (`ENVENOM.toxicBossCapFactor`) had none. The matrix runs the shipped Assassin (rules mode, real `gameDefs()`) against every elite cell in three builds: `plain` (reference build), `toxic-opportunity` and `toxic-sovereign` (Toxic Opportunity then Toxic Sovereign allocated through the node chain). One line per row: wins, median win time, Poison uptime, mean peak Poison stacks. Deterministic, no CSV, existing matrices unchanged (all nine at `--seed 1 --runs 5` are byte-identical before and after). The signature to watch is the Warden: `plain` peaks at 4 stacks (the boss cap is 60% of 7, rounded) and both Toxic builds reach 7; if a change drops the Toxic peak at the Warden to 4, the cap fix broke. Baseline (seed 1, 5 runs, 2026-11-22; diff future output against it):

```
[sim] matrix toxic seed 1 runs 5
assassin warden prepared plain: wins 20% | median 64.0s | poison uptime 97% | peak stacks 4.0
assassin warden prepared toxic-opportunity: wins 60% | median 59.4s | poison uptime 96% | peak stacks 7.0
assassin warden prepared toxic-sovereign: wins 60% | median 56.2s | poison uptime 96% | peak stacks 7.0
assassin warden over plain: wins 100% | median 45.7s | poison uptime 96% | peak stacks 4.0
assassin warden over toxic-opportunity: wins 100% | median 47.6s | poison uptime 96% | peak stacks 7.0
assassin warden over toxic-sovereign: wins 100% | median 46.3s | poison uptime 96% | peak stacks 7.0
assassin warden causeway plain: wins 100% | median 49.7s | poison uptime 96% | peak stacks 4.0
assassin warden causeway toxic-opportunity: wins 100% | median 48.8s | poison uptime 96% | peak stacks 7.0
assassin warden causeway toxic-sovereign: wins 100% | median 45.8s | poison uptime 96% | peak stacks 7.0
assassin warden prepared-crafted plain: wins 100% | median 67.0s | poison uptime 97% | peak stacks 4.0
assassin warden prepared-crafted toxic-opportunity: wins 80% | median 60.4s | poison uptime 96% | peak stacks 7.0
assassin warden prepared-crafted toxic-sovereign: wins 80% | median 57.9s | poison uptime 96% | peak stacks 7.0
assassin colossus arrived plain: wins 0% | median n/a | poison uptime 96% | peak stacks 7.0
assassin colossus arrived toxic-opportunity: wins 0% | median n/a | poison uptime 96% | peak stacks 7.0
assassin colossus arrived toxic-sovereign: wins 0% | median n/a | poison uptime 96% | peak stacks 7.0
assassin colossus prepared plain: wins 20% | median 63.7s | poison uptime 97% | peak stacks 7.0
assassin colossus prepared toxic-opportunity: wins 60% | median 62.8s | poison uptime 97% | peak stacks 7.0
assassin colossus prepared toxic-sovereign: wins 60% | median 62.8s | poison uptime 97% | peak stacks 7.0
assassin colossus over plain: wins 100% | median 47.7s | poison uptime 96% | peak stacks 7.0
assassin colossus over toxic-opportunity: wins 100% | median 48.2s | poison uptime 96% | peak stacks 7.0
assassin colossus over toxic-sovereign: wins 100% | median 48.2s | poison uptime 96% | peak stacks 7.0
assassin colossus prepared-crafted plain: wins 80% | median 66.3s | poison uptime 97% | peak stacks 7.0
assassin colossus prepared-crafted toxic-opportunity: wins 80% | median 62.8s | poison uptime 97% | peak stacks 7.0
assassin colossus prepared-crafted toxic-sovereign: wins 80% | median 62.8s | poison uptime 97% | peak stacks 7.0
assassin reaver prepared plain: wins 80% | median 36.9s | poison uptime 95% | peak stacks 7.0
assassin reaver prepared toxic-opportunity: wins 100% | median 35.6s | poison uptime 95% | peak stacks 7.0
assassin reaver prepared toxic-sovereign: wins 100% | median 35.6s | poison uptime 95% | peak stacks 7.0
assassin reaver over plain: wins 100% | median 32.2s | poison uptime 95% | peak stacks 7.0
assassin reaver over toxic-opportunity: wins 100% | median 31.9s | poison uptime 95% | peak stacks 7.0
assassin reaver over toxic-sovereign: wins 100% | median 31.9s | poison uptime 95% | peak stacks 7.0
assassin reaver prepared-crafted plain: wins 80% | median 36.3s | poison uptime 95% | peak stacks 7.0
assassin reaver prepared-crafted toxic-opportunity: wins 80% | median 36.9s | poison uptime 95% | peak stacks 7.0
assassin reaver prepared-crafted toxic-sovereign: wins 80% | median 36.9s | poison uptime 95% | peak stacks 7.0
assassin tyrant arrived plain: wins 40% | median 47.7s | poison uptime 96% | peak stacks 7.0
assassin tyrant arrived toxic-opportunity: wins 40% | median 49.1s | poison uptime 96% | peak stacks 7.0
assassin tyrant arrived toxic-sovereign: wins 40% | median 48.3s | poison uptime 96% | peak stacks 7.0
assassin tyrant prepared plain: wins 80% | median 42.3s | poison uptime 96% | peak stacks 7.0
assassin tyrant prepared toxic-opportunity: wins 100% | median 40.0s | poison uptime 96% | peak stacks 7.0
assassin tyrant prepared toxic-sovereign: wins 100% | median 40.0s | poison uptime 96% | peak stacks 7.0
assassin tyrant over plain: wins 100% | median 37.6s | poison uptime 96% | peak stacks 7.0
assassin tyrant over toxic-opportunity: wins 100% | median 38.5s | poison uptime 95% | peak stacks 7.0
assassin tyrant over toxic-sovereign: wins 100% | median 38.5s | poison uptime 95% | peak stacks 7.0
assassin tyrant prepared-crafted plain: wins 100% | median 42.3s | poison uptime 96% | peak stacks 7.0
assassin tyrant prepared-crafted toxic-opportunity: wins 100% | median 40.0s | poison uptime 96% | peak stacks 7.0
assassin tyrant prepared-crafted toxic-sovereign: wins 100% | median 40.0s | poison uptime 96% | peak stacks 7.0
```

Saves (Step 13.39 part 4): the one-time hero update `assassin-venom-passive` runs after validation for every Assassin that does not have it. It removes Venom Edge from the loadout and the learned list, drops every rule naming it, removes "skill is ready" conditions that name it (a rule stack whose only trigger was such a condition is dropped), and removes it from the kept setup of earlier lives (`pastLoadout`, `waitingSkillIds`). The Venom Edge node stays allocated (it raised the passive tick until Step 13.50, which made the tick 10% for everyone). A loadout that shrinks keeps its free slot. No save version change; new heroes start with the update recorded.

### Venom Edge node after the 10% base (Step 13.50)

Decision (2026-11-22, user): the Envenomed strikes base tick becomes 10%, so an Assassin without the Venom Edge node passes the Warden rule (Step 13.47 measured base 10% without the node: Warden prepared -7.3, prepared tier -4.1 on the 12 clean cells). The node no longer raises the tick, so it needs a different job. Candidates, all with the node allocated and the 10% base (measurement only, harness variants `n10-cap`, `n10-tick11`, `n10-basic15`, `n10-none`; `gameDefs()` unchanged until the decision): (a) +1 Poison stack cap (every enemy; a boss's cap is scaled from the raised cap); (b) +1% tick (11% with the node); (c) +5% basic attack bonus (a total of 15% instead of 10%); (d) no numbers: the node stays only as a web prerequisite (the floor). Same 16 cells, seeds 1 to 3 x 100, rule as in "Venom passive" (Assassin mean within +/-8 per tier vs `current`, arrived excluded, at most half the cells crossing below 95 to 95+, median win time not down more than 20%, Warden prepared within +/-8), the Toxic builds (`+to`, `+ts`) at the Warden prepared within +/-8 vs `current` with the same nodes, and no runaway: the candidate must not exceed the shipped `live` build (8% base, 10% with the node) by more than +8 at any tier. Pick: the weakest candidate that passes everything and reads in one sentence. If none passes, nothing is applied. Measured 2026-11-22 (`src/harness/venom.ts`, seeds 1 to 3 x 100, 16 cells, 12 cells = `VENOM_EXCLUDE=tyrant`, CSVs `reports/2026-11-venom-node-job*.csv`; 18 variants in 3 waves of 18 processes, about 27 minutes in all). Deltas in win-rate points vs `current` (the old Venom Edge skill with its node). The Tyrant cells' `current` baseline is the same confound as in Step 13.47 (the Burn Tonic row is dropped there), so the 12-cell rows decide. Measurement hooks added to the sim, off in `gameDefs()`: `envenom.nodeBasicBonus` (the basic attack bonus with the node) and `envenom.nodeCapBonus` (extra Poison stacks with the node).

| Candidate (vs `current`) | Cells | arrived | prepared | over | prepared-crafted | Warden prepared | crossing | median win time | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| (a) cap +1 | 16 | +10.2 | +13.3 | +3.3 | +3.4 | -6.7 | 1 of 16 | -8.3% | see 12 |
| (a) cap +1 | 12 | 0.0 | +1.3 | +0.3 | +3.7 | -6.7 | 0 of 12 | -7.6% | plain GO |
| (b) tick 11% | 16 | +9.7 | +13.6 | +3.3 | +3.2 | -3.0 | 1 of 16 | -8.0% | see 12 |
| (b) tick 11% | 12 | 0.0 | +1.7 | +0.3 | +3.3 | -3.0 | 0 of 12 | -7.3% | plain GO |
| (c) basic +15% | 16 | +6.3 | +19.0 | +4.1 | +5.7 | +3.7 | 4 of 16 | -7.0% | see 12 |
| (c) basic +15% | 12 | 0.0 | +8.1 | +1.3 | +6.4 | +3.7 | 2 of 12 | -6.5% | plain NO-GO (prepared by 0.1) |
| (d) no numbers | 16 | +8.6 | +8.9 | +3.3 | +1.6 | -7.3 | 1 of 16 | -6.1% | see 12 |
| (d) no numbers | 12 | 0.0 | -4.1 | +0.2 | +1.3 | -7.3 | 0 of 12 | -5.4% | GO |

Toxic builds, Warden prepared vs `current` with the same nodes (limit +/-8), crossings of the 16 cells, median win time, and the runaway check (largest tier delta vs the shipped `live` build with the same nodes, limit +8, from `VENOM_BASELINE=live`):

| Candidate | Warden prepared +to | Warden prepared +ts | crossing +to / +ts | median +to / +ts | runaway: largest tier delta vs `live` (plain / +to / +ts) | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| (a) cap +1 | +11.3 | +10.0 | 5 / 1 | -7.4% / -4.4% | prepared +4.4 / +4.8 / +5.4; Warden prepared +0.7 / +8.0 / +9.0 | NO-GO (Warden prepared with both Toxic nodes) |
| (b) tick 11% | +12.7 | +12.7 | 4 / 1 | -7.3% / -4.1% | prepared +4.7 / +4.4 / +5.4; Warden prepared +4.3 / +9.3 / +11.7 | NO-GO (Warden prepared with both Toxic nodes) |
| (c) basic +15% | +21.7 | +18.0 | 6 / 1 | -6.9% / -3.7% | prepared +10.1 / +10.2 / +10.3; Warden prepared +11.0 / +18.3 / +17.0 | NO-GO (Warden prepared, runaway) |
| (d) no numbers | +3.3 | +1.0 | 4 / 1 | -5.7% / -2.5% | 0.0 everywhere | GO |

Reading: (d) is numerically identical to the shipped `live` build for any hero that has the node (the shipped node tick of 10% is the new base), so every cell, tier, crossing and median is the same as the Step 13.39 Part 3 and Toxic results; the only change anywhere is for an Assassin without the node, which rises from an 8% to a 10% tick. Every candidate that adds strength to the node-allocated build pushes the Warden prepared cell above +8 once a Toxic node is allocated (the boss Poison cap fix already lands those builds at +3.3 / +1.0), so the node has no numeric headroom at the boss. Winner: (d), the weakest candidate and the only one that passes. The Venom Edge node becomes a pure connector: it has no effect of its own and stays as the prerequisite of Potent Toxins and the rest of the Venom branch (the Assassin's Poison on every hit already ticks for 10% without it).

Applied (2026-11-22, Step 13.50): `ENVENOM = { baseChance: 1, coefficient: 0.1, nodeCoefficient: 0.1, basicBonus: 0.1, toxicBossCapFactor: 1 }` (`nodeCoefficient` stays in the hook, equal to the base). The Venom Edge node has no effect of its own; its id and place in the web are unchanged, so no save migration is needed (a saved Assassin keeps the node and fights exactly as before; one without it gains the 10% tick). Guard re-baseline, `--seed 1 --runs 5`: only Assassin rows without the node changed. Reference (also `reports/2026-10-23-reference.csv`; mean time to win, mean share of HP lost): bastion-mixed 18.4 s to 18.9 s, lost 38.3% to 37.7%; echo-knight 0 wins to 20% of runs (mean 53.9 s); grove-mixed lost 37.3% to 39.9%; oathbound-echo median 6.3 s to 5.8 s; road-mixed 14.3 s to 13.4 s; rootmaw 23.4 s to 21.9 s, lost 73.8% to 70.0%; sentry lost 9.2% to 7.5%; shardling median 4.3 s to 3.9 s; thornbeast 10.8 s to 10.2 s; wolf 6.2 s to 6.1 s. Telegraph, Assassin rules and blind: road-mixed 16 s to 15 s, thornbeast 13 s to 12 s, sentry lost 9% to 8%, grove-mixed lost 37% to 40%. Built: Assassin 0 nodes echo-knight 0% (left 18%) to 20% (left 15%, 54 s), rootmaw 24 s to 23 s. The modded, cinder, hollows, warden, causeway, elites and toxic matrices (and the modded CSV) are byte-identical, so the Toxic baseline above does not move. No non-Assassin line changed.

### Later lives (Step 13.18)

Decided 2026-11-17 (user approved, design A, "Echoes of past lives"). Persist and UI only; `src/sim`, content numbers and every harness matrix stay as they are.

- Recall: while a hero is below their peak level, ordinary run XP counts double. `peakLevel` is the highest level the hero reached in any finished life, set at reincarnation to max(old peak, level reached). With `need` = XP from the hero's current total to reach `peakLevel`: `need <= 0` gives the XP as earned; `2 * xp <= need` gives `2 * xp`; otherwise `need + (xp - ceil(need / 2))` (the part that reaches the peak is doubled, the rest counts once). Recall applies to run XP (settlement, the outcome stats, the "Experience earned" line with "(Recall +N)", and the offline summary). Trainer drills are not boosted. A hero that already reincarnated before this step has no `peakLevel` until their next reincarnation (accepted).
- Remembered Paths: from life 2 on, the elite defeats of earlier lives (Rootmaw Stalker, Echo Knight, Tidebound Colossus, Hollowmaw Reaver, Emberwrought Tyrant) keep the zone gates open. They are stored per hero in `rememberedEnemyIds`, filled at reincarnation from the elites in `defeatedEnemyIds`, and backfilled from the `elite:*` entries in `claimedBonuses` for heroes with `lives > 0`. Only zone gates read them (the route start, the map, and the contract board, which offers a zone's contracts to a hero who can enter it). The Fracture Gate (the Warden route) never reads them, and neither do templates or the one-time Legacy bonuses (the bonus is still paid once, from `claimedBonuses`).
- Exploit guard: nothing here pays for losing to the Warden on purpose. Reincarnation still requires facing the Warden this life (a loss or a victory, Step 13.27), Legacy is still level-based plus one-time bonuses, and the Fracture Gate still needs the elites beaten this life. Recall only speeds levels the hero already earned once, and only up to the old peak.
- Head Start: a Legacy purchase. Head Start I starts each life at level 5 for 20 Legacy. Head Start II starts at level 10 for 35 Legacy and needs I. The hero gets the XP of that level, the attribute points and skill points of those levels unspent (nothing is placed for them), and heirloom scaling runs after. Bought mid-life (Step 13.30), it raises a hero below its level up to that level at once with the same effect (the XP up to that level, the points of the levels crossed unspent); a hero already at or above that level changes nothing now, and keeps their higher XP. Head Start II after I needs only the difference. Levels from Head Start still count toward Legacy-from-level, so a hero who dies at level 20 gets the same Legacy either way.
- Elite Legacy Skill Points (the old Section 9 line) are dropped, not built. Elites pay the one-time +3 Legacy bonus instead.
- Screen: the Legacy screen shows Legacy, lives, mastery and peak level as key-values, a purchases table (cost, bought of max, Buy with the reason when disabled) and a "Next life" block (zones remembered, Recall up to level N, start level). Reincarnation itself starts from "Plan your next life..." on that screen, which opens the planner (Step 13.36).

### Campaign and endgame

- An early successful reincarnation cycle should take roughly one to two days of mixed active and offline progress.
- A hero should generally reach the base final boss after several reincarnations over approximately one to three weeks.
- Actual timing may vary significantly by build and luck.
- Defeating the final boss advances only that hero into a harder world tier.
- Higher tiers add stronger enemies, new modifiers, upgraded materials, and selected new encounters.

## 11. Offline and Session Design

- Target rhythm: 5-15 minute strategic check-ins around longer automated expeditions.
- Initial full-vision offline-combat cap: eight hours.
- The selected hero plays live. Other heroes progress only on their away route (see "Offline extras" below); heroes without an away route rest.
- Offline retreat and defeat use the same simulation rules as active play.
- Previously proven zones can be run offline; exact proof requirements remain open.
- Mastered zones unlock faster simulation speeds.

Offline progress is part of the full vision but is deferred from the first combat-focused playable version unless needed for basic loop validation.

Offline catch-up, decided 2026-11-04 (user approved; not built yet):

- Time passes for heroes whenever the game is not running: the page is closed or the tab is hidden. On return the game replays that time. A hidden tab uses the same catch-up, so a background tab no longer freezes an expedition.
- At most 8 hours are replayed. Time beyond that is lost.
- Every hero's crafting queue counts down. The one running expedition, which is always the selected hero's, continues. Other heroes rest.
- Standing orders replace the push-on-or-return choice while away. They are set in the expedition preparation:
  - Push on while hero HP is at least 50% of maximum and the loot bag has room; otherwise walk home. The retreat threshold still applies in fights.
  - Repeat the route after arriving home, only on a route the hero has cleared (every node of it in the hero's cleared nodes), and only until a defeat. Each repeat repacks the hero's chosen supplies from the stash until it runs out, and carries gold as the preparation says.
  - Defaults: push on at 50%, repeat on. The player can turn repeat off.
  - Stop after N fights (decided 2026-11-16, user, Step 13.9 part 2): each hero has an optional fight limit, a whole number from 1 to 99, or none (the default, blank in the preparation). It is set next to the push-on percent. When the run has fought N fights (every fight of this run in its history, retreats included) and the hold after a won fight arrives, the hero does not push on: it walks home and secures the loot exactly like the push-on HP floor, checked before it. It also applies to a live run, where the hold would otherwise wait for the player: the run walks home on its own, and the run bar shows "Fight 3 / 10". The count is per run. A repeat after a safe return is a new run and counts from 0 again, so a hero with repeat on and a limit of 10 runs 10 fights, goes home, and starts the next run; the run limit above still ends the repeats. A repeat still needs every node of the route cleared, so a limit shorter than the route on a route the hero has not cleared yet ends the repeats after the first run (the summary says so). With no limit set nothing changes. The away summary says how many times the limit sent the hero home.
- Replays use seeds kept in the save, so reloading during or after a catch-up gives the same result. The save records a last-seen time whenever it saves and when the page closes. A clock that went backwards counts as no time.
- A defeat while away uses the normal defeat rules (unsecured loot lost, rescue fee, durability), then offline running stops.
- On return the player sees a summary: time away (capped), runs, fights won, retreats, any defeat, gold, materials, XP and level-ups, crafts finished, contract progress, and places discovered. Only the last fight keeps its full log.
- The replay runs in chunks with a progress bar so the page does not freeze. Measured 2026-11-04: the headless sim plays a 4-fight Road run 53 times a second in Node, about 6,600 times real time, so 8 hours is about 5 seconds there.
- Built 2026-11-04. Details settled while building: the game stamps the save every 10 seconds and when the tab hides or the page closes, so a reload replays at most a few seconds. A catch-up under 5 seconds does nothing, and under 30 seconds it is applied without a summary. While a tab is hidden the live expedition clock is off (the catch-up counts that time on return); the craft clock keeps counting real time in either case. Repeating needs every node of the route in the hero's cleared nodes and the packed supplies in the stash. A run left at `returned` or `defeat` is not settled for the player.
- Measured 2026-11-04 (headless, level 40 Warrior on the Splintered Road, 8 hours): 338 runs and 1,017 fights in 2.2 seconds. The same hero returned about 2,500 materials from 3 hours, which would swamp the economy.
- Decided 2026-11-04 (user): fights won while away drop half the loot and gold of a live fight. For each won fight the material quantity and the gold gained are halved, rounded half up, so a drop of 1 stays 1. XP, contracts, and discoveries are not reduced. Live play is unchanged.
- Decided 2026-11-07 (user): away runs can start on their own. In the expedition preparation the player picks an away route, or none (the default). If the hero has no run when the player leaves (page closed or tab hidden for at least 5 seconds), the catch-up starts that route first, using the packed supplies and the carried gold from the preparation, and then follows the push-on and repeat orders. It does not start when the route is not cleared by the hero, when the packed supplies are not in the stash, or when a run already exists; the summary says why. (Revised 2026-11-16: a run that was already out continues while away only with Auto run on; see "Away rules for a run".)

Auto run, decided 2026-11-16 (user, Step 13.14): in a live run the hero stops after every fight and waits for Push on, so farming a route the hero cannot finish (the boss is too hard) means a click per fight. Auto run lets the live loop use the standing orders while the player watches.

- Switch: `autoRun`, a per-hero setting, optional on the save (absent means off, no version bump), saved so a reload keeps it. Default off. It is in the preparation panel, the Map run bar and the run dock, and can be turned off at any moment mid-run to take manual control. Manual Push on and Return keep working.
- Decision at each hold: the same rule as away, one shared function used by both so live and away cannot drift. Order: (1) the per-run "Stop after fights" limit is reached, walk home; (2) HP is below the push-on percent, walk home; (3) the bag is nearly full: walk home, or with the "Hold and wait for me" order, stop and wait for the player (Auto run stays on); (4) otherwise push on.
- Rerun (revised 2026-11-16, user: the hero farms a route whose boss it cannot beat yet): when Auto run is on and a run ends with a safe return, the next run on the same route starts on its own, on any route the hero can start. The finished run is settled (loot banked) and the normal start path runs with its checks (`canStartRoute`: gear, durability, defeat rest, locked nodes; the packed supplies repacked from the stash; carried gold as the preparation says). If a start is refused, or the packed supplies are not in the stash, Auto run switches itself off and the Map shows the reason. The rerun does not depend on "Run a cleared route again" or on the cleared-route rule; those settings and rules are unchanged for away runs and for play without Auto run. The away run limit does not apply live.
- A defeat ends Auto run: no run starts and Auto run switches itself off, so the hero does not keep losing gold and gear. The per-run "Stop after fights" limit still ends each run early (walk home and bank) and the next rerun begins a new run.
- Session limit: `autoRunMaxFights`, optional whole number 1 to 9999, or null (no limit), saved on the hero. The session count is total fights fought since Auto run was switched on, across repeated runs. It is kept in memory only; it restarts at 0 whenever Auto run is switched on or off, and a reload restarts it too. When the count reaches the limit the hero walks home and banks the loot, Auto run switches itself off, and no rerun starts. The run bar shows "Auto run: fight 37 / 100", or "Auto run on" with no limit.
- Auto run modes (Step 13.26, decided 2026-11-18, user: "either repeat the route, or just continue unlimited until a retreat condition is met or the hero is defeated"). Hero setting `autoRunMode`, `'repeat'`, `'endless'` or `'echo'`, optional on the save (absent means `repeat`, no version bump), kept through reincarnation, part of the preparation draft. It only matters while Auto run is on.
  - `repeat` is the behaviour above, unchanged: the standing orders (Stop after fights, push-on HP floor, bag order) walk the hero home, the loot is banked and the route is rerun.
  - `endless`: the hero keeps pushing on past the route's last node (fights past the fixed ones are drawn at the route's last zone, as for any long run). At a hold `decideHold` gives `push` whatever the Stop after fights order, the push-on HP floor or the bag order say. The run ends only by (a) an auto-escape retreat condition (the hero's retreat thresholds and auto-escape setting): the retreat ends the run with outcome `returned`, and Auto run then follows its normal path (settle, rerun the route); (b) a defeat: Auto run stops, as in `repeat`; (c) the Auto run total fight limit `autoRunMaxFights`, which applies in both modes (walk home, bank, Auto run off). A refused rerun still switches Auto run off.
  - `echo` (decided 2026-11-18, user: on Fallen Bastion, raise the Echo rank after a win and stop Auto run if the boss challenge fails. Revised 2026-11-24: while this mode is on, Start and the rerun use `fracture-via-bastion` even if another route is selected, and the Warden is fought at the highest unlocked Echo rank). Hold decisions match `repeat`. When the Warden is defeated at rank R, the next unfought Warden becomes R + 1 immediately, including the next fight of that same run, capped at the unlocked Echo rank (a new high still unlocks R + 1 as usual). A later loop of the same run counts: the rank is the one that fight was won at, not the rank stamped onto a later draw. A return that did not defeat the Warden leaves the fight rank unchanged and the route reruns. A defeat still stops Auto run, as in `repeat`. When that defeat is the Warden (`bossLossThisLife`), the notice says the Warden won.
  - Bag in `endless`: it behaves like the `keep` bag order. Loot that does not fit is lost (older materials stay, the newest quantity that does not fit is lost); gold, XP and momentum are unaffected. The preparation screen says "Loot that does not fit the bag is lost." where the mode is chosen. With no retreat thresholds set it warns that the run can only end by defeat or the fight limit.
  - Live, away and background lanes use the same `decideHold`, given the Auto run flag and the mode, so they cannot drift. The away report says when an endless run ended (retreat, defeat or limit). The sim, harness and every matrix are unchanged.
- Auto run contracts (Step 13.26, decided 2026-11-18, user: when Auto run gets back to town, collect finished contracts and take contracts related to the route, with a toggle). Hero setting `autoContracts`, optional boolean on the save (absent means off, no version bump), kept through reincarnation, part of the preparation draft, a checkbox under the Auto run controls (disabled with a reason while Auto run is off). When on, on a safe return (never after a defeat), right after the finished run is settled and before the next run starts, one shared function does: (1) collects every finished contract on the hero's active list exactly as a manual collect (gold, XP and material; the board replaces the slot); (2) fills the free active slots (`MAX_ACTIVE_CONTRACTS`, 3) with offers from the hero's board, in board order, that relate to the route being rerun, using the normal accept (its rules apply, and the offer's slot is not replaced until it is collected). Related: a bounty (`kill`) whose enemy is in any encounter at a route node; a patrol (`fights`) whose node is on the route; an `encounters` contract (elite) with an encounter at a route node; a salvage (`secure`) whose material is a route node's resource. Contracts already active are skipped. The live loop and the away replay call the same function, so they give the same save. The away report says "Contracts handed in: N, taken: N". The sim is untouched.
- Auto run repair (Step 13.49, decided 2026-11-22, user: "repair should act as normal, only trigger when in town and cost money, which could trigger between auto run if repeat route is available, since we went back before we repeat"). Hero setting `autoRepair`, optional boolean on the save (absent means off, no version bump), kept through reincarnation, part of the preparation draft, a checkbox "Repair at home" beside Auto run contracts. When on, on a safe return (never after a defeat), after the finished run is settled and after the contract step, before the refusal check and the rerun, one shared function (`autoRepairStep`, like `decideHold`, used by the live loop and the away replay) repairs the hero's worn pieces: only when the setting is on and no expedition is running; every equipped piece with missing durability, most worn first (by missing durability), each at the normal shop price (`repairCost`, the same gold source as the manual Repair, `purse.gold`). A piece the gold does not cover is skipped and the rest are still tried. No gold reserve. Archive pieces are never repaired. If a worn piece is still at 0 durability afterwards, the normal refusal fires unchanged ("Auto run stopped: <item> is at 0 durability. Repair it."). Live: a toast "Repaired N pieces for G g." only when something was repaired. Away: the report says "Repaired N pieces for G g." beside the contracts line. The sim, content numbers and harness are untouched.
- Not changed: the sim and the harness. Away behaviour is revised in "Away rules for a run" below.
- Gold display on a run: the sidebar shows the total the hero owns (carried + banked + purse) with a second line "61 carried · 17,690 banked", instead of a purse of 0.

Away rules for a run, revised 2026-11-16 (user: "go with the Auto run switch, and also don't start an auto run when the player is still within a run"; Step 13.15). This replaces the 2026-11-07 rule that a run kept following the standing orders while the player was away. Reason: a manual run became an auto run when the player went AFK, and on return the live panel showed a different fight or run.

- Auto run (`autoRun`) is the one switch for continuing a run while away. With Auto run ON the existing run continues under the standing orders, decided by the same `decideHold` the live loop uses. When a run ends with a safe return, the same route is rerun on any route the hero can start (the live Auto run rerun rules, independent of "Run a cleared route again" and of the cleared-route rule). The stops are the live ones: a defeat (Auto run switches itself off); a refused start (a worn piece at 0 durability, a defeat's rest, a locked node) or packed supplies missing from the stash (Auto run switches itself off and the summary says why); the per-run "Stop after fights" limit (walk home and bank, the next rerun is a new run); the session limit `autoRunMaxFights` (total fights across reruns, away fights count, the count continues from the live session count when the replay begins; at the limit the hero walks home and banks, Auto run switches itself off and no rerun starts); and the 8 hour cap. The away run limit (`repeatLimit`) does not apply to Auto run, as live. The rerun decision (settle, packed supplies, start check) is one function used by the live loop and the replay.
- With Auto run OFF the replay never continues a run by itself. When the player leaves, the fight in progress finishes and the run then holds at the next hold, exactly waiting at Push on, so on return the player sees the same run. The replay never pushes on, never settles, never repeats and starts nothing. The only order that still acts is the per-run "Stop after fights" limit (it already acts live without Auto run): the hero walks home and the run waits on the outcome card. A run that ends by itself during the fight in progress (a defeat, a retreat or escape that ends the run) ends as before and waits on the outcome card.
- "Start a run when I leave" (`awayRouteId`) stays the explicit opt-in. It starts its route only when the hero has no run at all: strictly no expedition, neither an ongoing one nor an ended one waiting on the outcome card, and only on a route the hero has cleared with the packed supplies in the stash, as before. A run started that way continues under the standing orders and the old `repeatRoute`, cleared-route and run-limit rules, as before. No new run is ever started, by an away route, by Repeat or by Auto run, while the hero still has a run the player has not settled, except that Auto run reruns after a safe return (settling it).
- Heroes that are not selected and run in background lanes follow the same rule: a background hero continues an existing run only if its Auto run is on, or the run is on its own away route (`awayRouteId` equals the run's route); otherwise it holds at the next hold. The same applies while the page is open.
- Return screen: the away summary gets one banner line per hero. "Auto run kept going while you were away: N fights, N runs." with the reason it stopped when it did stop (for example "Stopped: Warhelm is at 0 durability. Repair it."); or "Paused at Push on while you were away (Auto run is off)."; or "Away route started: <route>." Fights played away stay labelled "AFK run". Nothing changes when the absence is shorter than the replay minimum.
- Preparation text: the Auto run group is "Auto run (while you watch and while you are away)"; it says that with Auto run off the hero waits at Push on when you leave, and that "Start a run when I leave" only starts a run when you have none.
- No save format change. Sim and harness unchanged.

- Later: notifications while the page is closed (deferred, not planned).

Offline extras, decided 2026-11-08 (user approved; Step 12.6):

- Run limit: each hero has a repeat limit of 0 (no limit, the default), 1, 3, 5, 10 or 25 runs, set next to Repeat in the preparation. Offline, once that many runs have ended in one catch-up, no new run starts and the summary says "Run limit reached". 0 behaves as before.
- Other heroes: every hero that has an away route (not only the selected one) runs it while the player is away, with the same rules as the selected hero (push-on HP, bag-full order, repeat, run limit, half loot, defeat costs). Heroes without an away route rest. The same applies while the page is open: heroes that are not selected keep running their away route in the background, with no summary; their state shows as a badge on the Roster. Crafting counts once per catch-up for every hero, as before.
- Selecting a hero who has a background run brings that run onto the live screen. A run that has ended (returned or defeated) waits for the player on the Map. A hero with a background run cannot be deleted.
- The away summary is one row per hero (runs, fights won, gold, XP and levels, why it stopped), with the shared crafts and discoveries below.
- Mastered routes: each hero counts safe returns per route. At 10 safe returns the route is mastered for that hero and the live screen offers x8 playback speed on it. Live only: offline loot and the 0.5 rate do not change.
- Walking playback, decided 2026-11-13 (Step 13.7 batch 6): the walk between fights plays at x8 the chosen speed, and x16 on a mastered route. Playback only; the simulation, regeneration, Readiness and Fury drain are unchanged.
- Unchanged: the 8-hour cap, the 0.5 loot rate, the 5-slot roster, no shared vault. The first run of each other hero's catch-up uses its own seed, so heroes do not replay identical fights.

## 12. Presentation

- Browser-local application first.
- Pixel-art characters and combat presentation.
- Illustrated node-based world map.
- Dashboard-style panels for character, route, combat, log, crafting, and town services.
- Placeholder/simple pixel art is acceptable during the first playable version.
- Business model is undecided; the likely direction is a premium single-player game without microtransactions.

### UI conventions (2026-11-07)

Building blocks live in `src/ui/Kit.tsx` and `src/ui/kit.css`. Use the existing theme tokens; do not add new colours, fonts, or styling libraries.

- Explanations and help text go in `?` tooltips (`Help`), not in screen text. The screen shows state, numbers, and actions.
- Shop-like lists use four-part rows (`ShopRow`): name with an owned count, a muted effect, cost Tags, and buttons. Costs are Tags: amber for gold, slate for materials.
- Numbers and statuses are stat cards (`Kpi`, `KpiRow`) or key-value rows, never bullet lists or sentences. Use tabular figures and show direction (▲/▼) where it matters.
- `Pill` badges are for counts, unspent points, and finished jobs only. Prices, loot, lists, and inline status use `Tag` (coloured text, no box). Colour is always paired with a sign, icon, or label.
- Identical items show once with `×N` (`groupItems`).
- Long lists fold into `Collapsible` sections with a count in the summary. Enchanter recipes group by the first kind of item they fit (weapons, off-hands, armor, accessories), sorted by minimum level, price, then name; the group with the newest learnable recipe opens first. The Trading Post lists every material with where it drops (`materialSources`: routes whose last node yields it, then enemies and resource nodes). Which recipes the player has seen is local UI state (`rpg.enchanterSeen`), not part of the save.
- Avoid extra section cards and boxes; group with spacing first.

### Guide page (2026-11-18)

An in-game Guide explains the game in one searchable place. It is a main tab after "What's new" and is also reachable from the Welcome (no-hero) screen with a "Read the guide" button.

- Sections: Basics (the loop, getting started), Classes (one entry per class, plus the three Cleric vows as a "Cleric vows" group), Races (plus the three Undead curses as an "Undead curses" group, the same shape as vows), Skills (one entry per class-owned skill, grouped by class; skills that a class web does not grant directly are listed with how they unlock, hidden helper skills have no entry), Statuses, Supplies (every supply, gated ones labelled "Unlocks after ..."), Expeditions (including Rules, mastery, the safe pouch and Echo rank) and Reincarnation.
- Generated numbers: every number shown comes from the content and sim definitions (skill costs, cooldowns, supply prices, status fields, vow constants). Changing a number in code changes the Guide with no extra edit.
- No digits in hand-written prose: the prose lives only in `src/content/guide.ts` and must contain no digits, so it can never go stale against the numbers. A test enforces this. Prose explains how things work; the generated facts carry the values.
- Class entries show the cluster introductions and keystone names only; node details stay on the Skills screen (the entry links there). Skill-web nodes can change base values, so the Guide shows base values and says so.
- Vow conditions mirror section 4 (Cleric: Faith): Zeal generates Faith when a hero action deals direct HP damage, at most once per hero action; Endurance generates Faith for HP lost or barrier damage absorbed, capped per enemy action; Temperance generates Faith after an action ends in a middle band of HP without overhealing or resource overcap. Failing an ordinary vow condition only stops generation.
- Deep links: small "Guide" links sit next to the existing Help on hero creation (race and class), the vow picker, the Undead curse picker, Combat setup (Rules), the skill web and Legacy. A link switches to the Guide tab, clears search and filter, opens the section, scrolls to the entry, focuses its heading and highlights it briefly.
- First-clear rewards (Step 13.24) get a line in the Expeditions entry (prose, no digits) and generated facts per zone (gold, material, free upgrade, Legacy) read from the first-clear table in code.
- Gear and Greyhaven (Step 13.25): a Gear section (a Gear topic, one generated entry per modifier with its effect, level, recipe price, kinds it fits, recipe requirement and "Counts at most N times across worn gear" read from `MODIFIER_STACK_CAP`, and one entry per base item with its slot and the classes that prefer it) and a Greyhaven section (a topic on what each place does, with generated sell prices, pack slots and contract limits). The stack cap applies to every modifier; Hauler's bag room counts for at most that many pieces, and only on chest armor or an accessory. Prose has no digits.
- Search is case-insensitive over title, summary, facts, effect lines and prose. A search with no result shows an empty state with a Clear button.

### First-run coach (2026-11-20)

A new account gets a coach that lights one control at a time. It is not a page of text. The chip beside the control is a few words. The player moves on by using that control. Skip, in the corner the whole time, dismisses the coach for the account. An older save with no coach field is already finished, so existing players are not walked through it.

The coach never sits on screen during a fight or the walk home, and it never pauses a run. The Next line hides while a mark is showing. The Guide stays the reference; its loop entry says the coach can be skipped.

Order, for the first hero:

1. Name, race, class, then Create hero.
2. Start expedition on the Map.
3. After fight 1, Return. That banks the loot.
4. On the outcome, Return to town, then Start expedition again.
5. After fight 1 of that run, Push on once.
6. The next fight usually ends in defeat. The coach then lights the rescue fee ("You pay this"), the kept loot ("The pouch kept this"), and Return to town ("Back to town"). The fee and the pouch move on when the chip is pressed. Return to town is the real button.

A defeat before the first Return jumps straight to those three marks and skips the rest. A win on the fight after Push on waits, with no mark, until the first defeat, then shows the same three marks. After Return to town from that defeat, the coach is finished.

## 13. Technical Direction

- TypeScript and React are the preferred starting stack.
- Keep the game simulation independent from React rendering.
- The simulation should be deterministic when supplied with an explicit random seed, even though outcomes use high variance.
- UI, map, logs, and pixel presentation can be implemented without a GUI-heavy game engine.
- Desktop packaging can be considered later.
- A dedicated engine such as Unity is not currently required.
- Accepted stack (2026-10-21): TypeScript + React + Vite, with the simulation in plain TypeScript and Vitest for tests. No game engine.
- Accepted simulation clock and action timing: see section 7, "Simulation clock and action timing".
- Implementation plan: [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

The save format, state-management approach, random-number model, and offline catch-up implementation remain technical design tasks.

## 14. First Playable Scope

### Primary question

Is configuring and watching automated combat satisfying?

### Content

- One town in the Fractured Frontier
- Three connected zones
- Several regular enemies
- At least one elite encounter
- One boss
- Basic contracts
- Basic crafting and equipment customization
- Boss-loss reincarnation and personal mastery
- Detailed combat and data-flow log

### Character framework

- All four race modules are created as a framework.
- All five class modules are created as a framework.
- All 20 race/class combinations are selectable.
- Each class has a compact skill web of roughly 12-15 nodes and 2-3 keystones.
- Race and class systems should compose rather than relying on 20 bespoke implementations.
- Balance is preliminary, but each combination must function.

### Development choice

Build the four-race and five-class framework together before using a single pairing as the primary implementation path. Shared contracts between race modules, class modules, combat resources, skills, and logs must be defined before pairing-specific testing.

### Included systems

- Character creation and unlockable roster slots
- Five attributes and manual allocation
- Four active skills and simple conditional priorities
- Real-time cooldown combat
- Persistent expedition health/resources
- Route selection and three-zone progression
- Retreat, escape retries, defeat, durability, and rescue debt
- Materials, basic equipment, and crafting
- Contracts
- Compact skill webs
- Reincarnation and one heirloom
- Detailed combat log

### Deferred from the first playable

- Full five-region campaign
- Polished pixel art
- Full lore quest lines
- Complete event-policy system
- Full offline progression
- Post-final-boss world tiers
- Final balance for all 20 combinations
- Final business model and release packaging

## 15. First Playable Success Criteria

The first playable is successful when a player can:

1. Create any of the 20 race/class combinations.
2. Understand the mechanical identity contributed by both race and class.
3. Allocate attributes and make irreversible choices in a compact skill web.
4. Equip four active skills and configure useful priority conditions.
5. Select a route and watch clear, real-time combat.
6. Use the log to explain a victory, failed escape, or defeat.
7. Make a meaningful decision between returning safely and pushing for momentum, resources, or boss progress.
8. Gather materials, craft or upgrade an item, and observe its effect.
9. Lose to the boss, pay the normal defeat costs, reincarnate, and make a measurably stronger second attempt.
10. Report that build configuration and automated combat are interesting enough to repeat.

## 16. Major Design Risks

### Twenty-combination MVP scope

Four races and five classes require substantial skill, UI, content, and balance work even when implemented compositionally. The framework should prevent bespoke combination code, and preliminary balance should not block early combat testing.

### Permanent choices

No respec can make experimentation meaningful, but accidental choices may ruin a one-to-two-day life. Strong previews, confirmations, and clear formulas are required.

### High variance plus severe defeat

Broad combat swings combined with stacked losses can feel unfair, especially offline. Logs, retreat configuration, risk previews, mastery-based variance narrowing, and careful loss tuning are essential.

### Incentivized boss loss

Since Step 13.27 a boss victory unlocks reincarnation as well as a loss, so throwing a fight is no longer needed or rewarded. Legacy stays level-based plus one-time bonuses.

### Permanent power growth

Raw mastery bonuses can eventually overwhelm buildcraft and world difficulty. Most mastery value should come from options, consistency, and new interactions rather than unrestricted multipliers.

### Shared resources

Account-wide materials could accelerate new heroes too aggressively. Since 2026-11-03 only recipes and discoveries are shared, so a new hero earns its own gold, materials, and items. Personal crafting-tier and hero-level requirements remain gates.

### Information overload

Skill webs, priority rules, logs, crafting, routes, and risk systems can overwhelm new players. Features should unlock gradually even if all race/class modules exist in the framework.

## 17. Open Questions

- Validate the initial attribute and combat coefficients through simulation
- Validate and revise class passive nodes, major keystones, and the provisional thirty-skill MVP roster
- Validate and revise racial mechanics, branches, capstones, and curses
- Exact mastery pacing for racial traits. The first playable turns the core on at creation, saves branch nodes for skill points, and leaves mastery layers off.
- Which race/class pairings count as difficult combinations
- Hybrid-node requirements and reward ceilings
- Exact first-region node map, resources, contracts, and unlock requirements
- Authored Fracture Echo rank modifiers and rewards
- Healing-roll distribution
- Exact DoT coefficients and Expose magnitude (cleanse supplies: Antidote, Warming Tonic)
- How much boss progress a retreat removes once a boss-progress counter exists. The first playable removes none.
- What stored debt blocks, and how a disabled item is repaired. The first-playable fee is 25 gold from carried gold. Unpaid gold is stored as debt with no other effect. Deposited gold is untouched. The next expedition waits 5 minutes.
- What Deserter supply pressure takes. Crafted supplies are decided in §9 Inventory (2026-11-08).
- Crafting quality, proficiency, and upgrade formulas
- Save format and local persistence
- Accessibility options
- UI wireframes
- Audio direction
- Final title
- Final business model

## 18. Next Design Step

Validate the first playable's combat model:

1. Implement a deterministic simulation harness
2. Run reference simulations for regular, elite, and Warden encounters
3. Revise coefficients, skill values, and enemy benchmarks from evidence. The 2026-10-24 review kept the current coefficients and recorded the floor-build deviations above.
4. Return to unresolved world, economy, and presentation questions

Balance values should be treated as testable starting hypotheses rather than final numbers.

## 19. Changelog

- 2026-11-23: An heirloom can be sold once the hero's level reaches the level it was kept at (its cap). Until then the Sell button stays off and names that level. The price is still the normal sell price, and an earlier-life piece still pays only the carried share.
- 2026-11-09: Designed the fourth zone, Cinder Scar (levels 28-34): three new enemies, the Emberwrought Tyrant elite, cinderite, the first enemy Burn on heroes, magical status resistance gear, three gated modifiers (Emberward, Tempered, Kindled), a Warming Tonic Burn default row, a cinderite Salvage contract and Legacy +3 for the first Tyrant defeat (Step 13.6).
- 2026-11-08: Designed the third zone, Rift Hollows (levels 22-28): three new enemies, the Hollowmaw Reaver elite, duskiron, three gated modifiers (Stalwart, Devout, Bloodbound), a duskiron Salvage contract and Legacy +3 for the first Reaver defeat (Step 13.4).
- 2026-11-08: Designed Grove and Bastion material drops (witherbark, oathsteel) and the pass-through rule: fights before a route's last node drop no materials (Step 13.2).
- 2026-11-08: Designed the second zone, Drowned Causeway (levels 17-22): three new enemies, the Tidebound Colossus elite, riftglass, three gated modifiers (Hallowed, Rending, Siphoning), a Salvage contract and Legacy +3 for the first Colossus defeat (Step 13.1).
- 2026-11-08: Thornbeast Bramble Slam and Hollow Sentry Shield Bash interrupt requirement raised from 10% to 25% of the enemy's maximum HP, so an ordinary hit no longer cancels the wind-up by accident. Other numbers unchanged.
- 2026-11-07: Mid-game heavy telegraphs: Thornbeast Bramble Slam (1.8 s wind-up, 220%, 9 s cooldown, interrupt at 10% max HP) and Hollow Sentry Shield Bash (1.8 s wind-up, 220%, 10 s cooldown, interrupt at 10% max HP). Telegraph and interruptible rule conditions now look at every enemy.
- 2026-11-04: Mend cleanses one Poison or Bleed; the Ward Charm supply; brewing supplies from materials; Deserters can snatch a supply.
- 2026-11-04: The Roster tab gets a Save file panel: export a backup file, load one, or start over, each with a confirmation where it deletes data.
- 2026-11-04: Decided and built offline catch-up: an 8-hour cap, standing orders (push on at 50% HP, repeat a cleared route until a defeat), deterministic replays, a return summary, and half loot and gold from fights won while away.
- 2026-11-04: Upgrades always succeed and cost 3 materials plus `item level × 3` gold. A discovered location is announced on the expedition outcome and badges the Map tab.
- 2026-11-04: The contract board is rolled per hero: 4 offers of Bounties, Patrols, and Elite contracts with random targets, counts, and an 80-130% reward roll.
- 2026-11-04: Greyhaven is split into eight places; each gear shop deals in one kind of item.
- 2026-11-04: Crafting no longer waits in town: every hero's queue advances, during expeditions too.
- 2026-11-03: Vow of Zeal 5 to 7 base Faith per damaging action, so Zeal matches the other vows.
- 2026-11-03: Heroes made before supplies and Fade Back are updated once on load: the two supply rules, and for a Ranger, Fade Back learned and swapped in for a starting-kit Volley.
- 2026-11-03: Fade Back also dodges the next enemy skill hit within 3 seconds, and its cooldown rises from 8 to 16 seconds.
- 2026-11-03: Decided the first-playable supplies: Healing Draught (30% HP, 15 gold), Antidote (clears Poison and Bleed, 10 gold), and Smoke Bomb (+15 escape points, 20 gold). Rules use the first two. Each hero buys and keeps its own.
- 2026-11-01: Decided the first-playable reincarnation rules: Legacy currency, one-time bonuses, three purchases, mastery as +2% ordinary XP per completed life, and the heirloom's scaling.
- 2026-10-31: Decided how expeditions award hero XP, and the six first-playable contracts with their tracking rules and rewards.
- 2026-10-31: Decided the first-playable crafting rules: material quality ranges, seeded averaged rolls, personal proficiency, costs and time, a queue of 3, six modifiers with level requirements, and upgrades with a falling chance.
- 2026-10-31: Decided the first-playable town numbers: gold drops of level × 2 (level × 3 for elites and the boss), a chosen carry amount, fixed buy and sell prices, a repair formula, and debt kept on the account with no effect. No consumables yet.
- 2026-10-31: Decided G6. The account starts with 2 character slots and reaches 5 through three one-time milestones: the first safe return to town, the first reincarnating boss defeat, and the first Warden defeat. Duplicate race/class heroes are allowed, and hero names must be unique ignoring case. No hero can be deleted in the first playable.
- 2026-10-21: Accepted the technical direction: TypeScript + React + Vite with no engine, a fixed 10 ms simulation clock with a fixed tie order, and actions that resolve when ready, with action time as recovery and the first action after one base action time. Linked the implementation plan.
- 2026-10-21: Accepted the provisional combat baseline: hero/enemy formulas, resources, active skills, automation, equipment curves, class/racial passives, keystones, first-region enemies, elites, and Warden phases. Next step is deterministic simulation.
- 2026-10-24: Accepted the first reference-matrix deviations without coefficient changes. Assassin, Cleric, and Mage floor builds miss the equal-level Deserter bands, and every floor build loses to the rank-0 Warden. Stacking pressure stays undesigned.
- 2026-10-24: The Splintered Road opens with a fixed Shardling pair, wolf pair, and Deserter, then draws those three or the level-5 mixed group with equal odds. Each gap is the ordinary 20-second journey.
- 2026-10-24: First-playable inventory is 4 empty supply slots and loot capacity 20. Each Splintered Road enemy drops 4 shard, hide, or scrap. Momentum uses the stacks already held, and half-up rounding turns 4 into 5 at 3 stacks. Overflow keeps older materials.
- 2026-10-24: First-playable escape rolls after the combat step when hero HP is at most 40%. Chance is 50% plus `floor(Agility / 5)` points, capped at +20. The attempt does not spend the hero's action. A failure waits 8 seconds. Success walks home for 20 seconds and clears momentum on arrival. Boss progress does not change.
- 2026-10-24: First-playable defeat destroys unsecured loot, clears momentum, and takes 10 durability from each equipped piece (maximum 100). A piece at 0 is disabled and kept. The rescue fee is 25 carried gold, and the unpaid part is stored as debt. Deposited gold is safe. The next expedition waits 5 minutes. A boss defeat sets `bossLossThisLife`.
- 2026-10-24: First-playable races turn the core on at creation: Human +5% ordinary XP, Elf Focus, Beastfolk Ferocity, and Undead Stillness. Branch nodes wait for skill points. Mastery layers stay off.
- 2026-10-24: First-playable skill webs are three clusters of five. Node 1 of a cluster is a start. Each later node costs 1 skill point and requires the previous node in that cluster. Node 5 is the major keystone, and a hero can hold one. There is no respec. Two racial attachment slots stay empty.
