

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
- Four equipped active skills plus passive effects.
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
- Each MVP class offers six learnable active skills for a four-skill loadout.
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

1. Venom Edge: unlock the Poison-applying active skill. Its Poison tick deals 15% of snapshotted Physical Power instead of 12%.
2. Potent Toxins: increase Poison's stack cap from 5 to 7, shared duration from 8 to 10 seconds, and Poison application Potency by 10.
3. Fan of Knives: unlock the multi-target active skill.
4. Toxic Opportunity: applying at least one Poison stack to the Marked target grants one Advantage, subject to the normal one-trigger-per-action cap. Poison ticks do not generate Advantage.
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

1. Hunter's Mark: use a very short action to reveal target defenses and traits for the encounter and expose that information to target-priority rules; it does not duplicate Assassin execution mechanics.
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
2. Mana Ward: unlock the Mana-spending defensive active skill. Its barrier is 85% Magical Power instead of 65% (Step 13.5; was 125% instead of 100%).
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

1. Smite: increase damage from 130% to 150% Magical Power (Step 13.5; was 100% to 120%) and add 5 Status Potency to vow-related effects.
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

1. Judgment: unlock the high-cost magical damage active skill. Judgment deals 280% Magical Power instead of 250% (Step 13.5; was 230% instead of 200%).
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
3. Configure attributes, equipment, four skills, priority rules, consumables, and retreat conditions.
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
- Every leg takes 20 seconds, the same as the road's ordinary journey, and a return walk takes the same. These are simulated seconds. The UI plays the walk 4× faster than the chosen speed (about 5 real seconds at 1×), so regeneration, Readiness, and Fury drain keep their ratios to the walk. Fights are not sped up.
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
- The same floor builds lost every rank-0 fight in that matrix: 0% wins, about 50 seconds to defeat, and no timeouts. That loss is accepted. The duration band remains the target for a successful fight, not a requirement that the floor build win. Enemy stacking pressure after the expected duration stays undesigned, and the harness still ends a fight at 10 simulated minutes.
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
- Losing to any available Echo rank satisfies that life’s boss-loss requirement for optional reincarnation.
- Echo ranks prevent a strong hero from being locked out of reincarnation after defeating the only MVP boss.
- First-time Echo-rank milestones can contribute one-time personal reincarnation rewards.
- Echo rank `R` multiplies rank-0 HP, Power, Armor, and Resistance by `1.12^R`.
- Each rank also adds one visible authored modifier.
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

- Level 22 Tank elite. Stats: 4,000 HP (Step 13.5 part 5B; was 3,600, about the Echo Knight x 1.12), 35 Power (31 in the proposal, raised in tuning, Step 13.1 part 8); Armor, Resistance, Accuracy and Evasion come from the elite Tank line. Consistency 25.
- Tide cycle uses the existing stance trait (10-second switch, the same constants as the Echo Knight): Ebb is the Guard stance (+30% Armor and Resistance), Flood is the Assault stance (+25% Power, -40% Armor and Resistance). It starts in Ebb. The sim keeps the names guard and assault; the Tide names are display text for later.
- Breaker Wave: 2.5 s telegraph, 300% Physical Power (Step 13.5 part 5B; was 230%), can critically hit, interruptible at 8% of max HP, 10 s cooldown.
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

- Level 26 Burst elite. 4,400 HP, 44 Power (Step 13.5 part 5B; were 3,400 and 40), Consistency 25; the other stats come from the elite Burst line.
- Rift Surge: 2.5 s telegraph, 400% Magical Power (Step 13.5 part 5B; was 300%), can critically hit, NOT interruptible, 12 s cooldown. Reaver Strike fills ordinary actions at 100% Physical Power.
- Uses the stance trait (10 seconds, guard and assault, as the Echo Knight and the Colossus). No summons.
- Drops 10 duskiron. Gold is the elite rate. Its first defeat by any hero records `defeated:hollowmaw-reaver` and unlocks Bloodbound.

Duskiron (new material): sells for 8 gold. A craft rolls quality 106% to 116% (average of two rolls, plus proficiency bonus, never above the range maximum). As an upgrade material it adds +4 points, up to 116%. It is last in `MATERIAL_RARITY` (the safe pouch keeps it first), after riftglass.

Modifiers (one modifier per item; the stack cap is 2 across worn gear). A recipe costs 25 gold per level the modifier needs, except Bloodbound, whose 650 gold is set on the modifier (a level-24 recipe would be 600). Stalwart fits any armor piece, as Sturdy does:

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
- The first-ever defeat of Rootmaw Stalker and Echo Knight permanently unlocks one personal Legacy Skill Point each. These return as unallocated starting points after every reincarnation.
- Later defeats of those elites award normal XP, materials, and mastery rather than additional skill points.
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

Later parts: 5 elite retune (Colossus HP 3,600 to 4,200 and Breaker Wave 230% to 320%; Reaver HP 3,400 to 4,400, Power 40 to 44, Rift Surge 300% to 400%; Warden unchanged unless Warrior or Cleric is below 30% prepared, then the HP multiplier 8 to 7); 6 telegraph check (an optional single-action interrupt mechanic only with user approval); 7 crafted supplies (Greater Draught 50% to 40%, Riftglass Ward 30% to 25%); 8 full re-measure and close.

Baselines and results are recorded below as each part is measured.

Baseline measured 2026-11-08 (Step 13.5 part 1, `npm run sim -- --matrix elites`, seeds 1-3 x 100 runs, mean of the three seeds; nothing tuned). Cells are wins % (mean HP lost % / elite HP left %). Tiers come from `--matrix warden`, `causeway` and `hollows` (Colossus level 22, Reaver level 26). "rules" is the class reference rules; "blind" removes the telegraph and interrupt rows.

| Class | Mode | warden prepared | warden over | warden causeway | colossus arrived | colossus prepared | colossus over | reaver prepared | reaver over |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Warrior | rules | 0 (100 / 51) | 0 (100 / 25) | 0 (100 / 32) | 0 (100 / 22) | 37 (92 / 1) | 100 (52 / 0) | 100 (47 / 0) | 100 (46 / 0) |
| Warrior | blind | 0 (100 / 49) | 0 (100 / 23) | 0 (100 / 29) | 0 (100 / 23) | 13 (98 / 3) | 100 (52 / 0) | 100 (43 / 0) | 100 (42 / 0) |
| Assassin | rules | 3 (100 / 30) | 100 (54 / 0) | 100 (47 / 0) | 0 (100 / 28) | 94 (69 / 0) | 100 (45 / 0) | 100 (41 / 0) | 100 (35 / 0) |
| Assassin | blind | 1 (100 / 37) | 100 (61 / 0) | 100 (50 / 0) | 2 (100 / 26) | 87 (69 / 1) | 100 (46 / 0) | 100 (42 / 0) | 100 (36 / 0) |
| Ranger | rules | 35 (95 / 12) | 100 (48 / 0) | 100 (45 / 0) | 3 (100 / 21) | 98 (54 / 0) | 100 (47 / 0) | 100 (20 / 0) | 100 (15 / 0) |
| Ranger | blind | 0 (100 / 44) | 93 (76 / 0) | 92 (72 / 1) | 0 (100 / 30) | 61 (88 / 4) | 100 (49 / 0) | 100 (44 / 0) | 100 (40 / 0) |
| Mage | rules | 99 (66 / 0) | 100 (49 / 0) | 100 (42 / 0) | 99 (55 / 0) | 100 (48 / 0) | 100 (39 / 0) | 100 (32 / 0) | 100 (22 / 0) |
| Mage | blind | 52 (92 / 14) | 99 (60 / 0) | 100 (56 / 0) | 68 (84 / 6) | 100 (57 / 0) | 100 (50 / 0) | 100 (47 / 0) | 100 (48 / 0) |
| Cleric | rules | 0 (100 / 71) | 0 (100 / 59) | 0 (100 / 62) | 0 (100 / 18) | 83 (56 / 1) | 100 (43 / 0) | 100 (39 / 0) | 100 (39 / 0) |
| Cleric | blind | 0 (100 / 71) | 0 (100 / 60) | 0 (100 / 60) | 0 (100 / 20) | 59 (71 / 2) | 100 (43 / 0) | 100 (40 / 0) | 100 (40 / 0) |

Crafted supplies (3 Greater Draughts and a Riftglass Ward, rules mode), wins % plain prepared tier then crafted prepared tier: Warden Warrior 0 / 0, Assassin 3 / 86, Ranger 35 / 99, Mage 99 / 100, Cleric 0 / 0; Colossus Warrior 37 / 100, Assassin 94 / 100, Ranger 98 / 100, Mage 100 / 100, Cleric 83 / 100; Reaver 100 / 100 for every class.

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

### Automation

Each loadout supports up to 12 ordered priority rows for its four equipped active skills.

When the hero is ready to act:

1. Evaluate rows from top to bottom.
2. A row is eligible only when its skill is equipped, off cooldown, affordable, valid for the current equipment/state, and has a valid target.
3. All conditions inside the row must pass.
4. Use the first passing row.
5. The same skill may appear in multiple rows with different condition sets, providing simple OR behavior without a logic-expression editor.
6. If no row passes, use the class fallback: a weapon basic attack, or Arcane Bolt for Mage when affordable.
7. A Mage unable to afford Arcane Bolt waits until Mana regeneration or another configured rule makes an action eligible.

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
3. Venom Edge: 90% Physical Power; apply one Poison stack whose tick deals 12% of snapshotted Physical Power; 4-second cooldown; 0.9× action time.
4. Smoke Step: gain +30 Evasion until the next Assassin action; successful Evasion uses the normal Advantage trigger; 8-second cooldown; 0.5× action time.
5. Fan of Knives: 70% Physical Power to every enemy; 6-second cooldown; 1.1× action time. Venom-web nodes may add Poison interactions.
6. Execute: consume all Advantage; deal `100% + (40% × consumed stacks)` Physical Power, then multiply by `1 + (0.5 × target missing-health fraction)`; 8-second cooldown; 1.1× action time. A critical Execute may generate one new Advantage through the normal critical trigger.

#### Ranger

1. Hunter's Mark: no Readiness cost; reveal target defenses and traits for the encounter; 5-second cooldown; 0.5× action time.
2. Aimed Shot: costs 40 Readiness; deals 304% Physical Power (180% until 2026-11-03); 5-second cooldown; 1.2× action time.
3. Volley: costs 30 Readiness; deals 65% Physical Power to every enemy; 6-second cooldown; 1.2× action time.
4. Snare Trap: costs 25 Readiness; arm one trap that triggers on the target's next action with a 75% base Stun chance; 8-second cooldown; 1.0× action time. Only one Ranger trap can be armed at a time.
5. Piercing Arrow: costs 20 Readiness; deals 220% Physical Power (130% until 2026-11-03); adds 30 percentage points of Armor penetration, subject to the total penetration cap; 5-second cooldown; 1.0× action time.
6. Flame Arrow: costs 20 Readiness and one special arrow; deals magical damage equal to 100% Physical Power; applies one Burn intensity whose tick deals 10% of snapshotted Physical Power; 6-second cooldown; 1.0× action time.
7. Fade Back: no Readiness cost; gain +30 Evasion until the next Ranger action, and ready a dodge: the next enemy skill with a damage effect that would hit the Ranger within 3 seconds deals no damage and applies none of its statuses, then the dodge is spent; 16-second cooldown; 0.5× action time. The dodge was added and the cooldown raised from 8 seconds on 2026-11-03, because skills never roll to hit, so Evasion alone could not answer a telegraph. Measured at seed 1, 40 runs, nodes 0/6/9: Rootmaw at level 14 15/45/45% to 75/85/85%, Echo Knight at level 16 0/0/0% to 18/33/33%, Echo Knight at level 20 50% to 100%. Added 2026-11-03 so a Ranger can answer a telegraph; the Ranger's arrows were raised 30% in the same change. Measured at seed 1, 30 runs: a level-20 Ranger beats the Rootmaw 73% at 0 nodes and 87% at 9 nodes (33% and 60% before). The Echo Knight still beats it (0%).

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
- The hero must wait 5 minutes before the next expedition. The wait is stored on the defeat. It does not tick inside the lost expedition.

### Batch C: loot safety, bag, rules, modifiers (decided 2026-11-07)

Safe pouch (replaces the "send loot home" idea; there is no courier):

- The pouch is not extra space. It marks the most valuable part of what the hero already carries as protected. Protected room is 5.
- Value order: rarer material first, then larger quantity. It re-sorts after every fight, so the player does nothing and offline runs work the same way.
- On defeat, the protected part is kept and goes to secured materials with the rest of the run settlement. Only the unprotected part is destroyed. Retreat and safe return keep everything, as before.
- The bag tooltip says what is lost: "Lost if you are defeated, except the safe pouch" (it used to wrongly say a retreat loses loot).

Bigger bag:

- Capacity is 20, +2 at hero level 10, 20 and 30, +3 with a Hauler's modifier on worn gear, +4 with the Legacy purchase Deep Pockets (15 Legacy). Maximum 36.

When the bag is nearly full:

- "Full" means fewer than 4 free room. Hero setting `bagFullOrder`: `home` (walk home, default) or `ask` (hold and wait for the player). No courier option.

Rule conditions (new): hero HP in points, target HP in points, missing HP, skill is ready, fight time. Enemy rank and boss phase are shown in the picker. AND/OR groups are unchanged. Each rule gets a plain-language summary and a Duplicate button.

Fight controls: carried supplies can be queued for the next action in a fight. An Escape now button starts an escape attempt at once (a packed Smoke Bomb still adds its +15 points).

Modifiers (new, one modifier per item stays): Vicious (+10 crit damage, level 3, 75 gold, weapons and accessories), Sturdy (+4% max HP, level 6, 150 gold, armor), Hauler's (+3 bag room, level 4, 100 gold, chest armor and accessories). The same modifier counts at most twice across equipped gear (`MODIFIER_STACK_CAP = 2`).

Starting-skill node bonuses (each node keeps its unlock and gains one small bonus):

- Warrior: Sundering Blow cooldown 6 to 5 s. Shield Brace Fury on hit 5 to 10. Second Wind cooldown 15 to 12 s.
- Assassin: Venom Edge poison tick 12% to 15%. Mark for Death grants 1 Advantage when applied. Execute base damage 100% to 120%.
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

First-playable town numbers, decided 2026-10-31:

- Gold comes from enemies. Each regular enemy drops its level × 2 gold. An elite or the boss drops its level × 3. Gold is added to the gold the hero is carrying.
- Before an expedition the player chooses how much gold to carry, with a default of 25, the rescue fee. The rest of the account's gold stays deposited and safe. On a safe return the carried gold goes back to the account. After a defeat the carried gold that is left after the rescue fee is lost.
- Greyhaven buys materials at 3 gold each (scrap 2) and buys archive items for `item level × 5 × quality`, rounded half up. It sells base items at 100% quality for `item level × 10` gold at the hero's level, and the shop supplies at the prices under Inventory.
- Repair restores an item to full durability. One item costs `ceil(missing durability × (1 + item level ÷ 2) ÷ 10)` gold. A disabled item is repaired the same way.
- Debt is kept on the account and added to by each defeat. It can be paid off in any amount from the account's gold, and it still blocks nothing.

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
- A craft costs 6 of the chosen material plus `item level × 5` gold. The item level is at most the hero's level. It takes 30 seconds, and the queue holds 3 jobs. Only the first job advances. Time passes in town and on expeditions alike, for every hero's queue (changed 2026-11-04; before, only the selected hero's queue moved and only while no expedition ran). Crafting counts real time, so it does not depend on the combat viewer's speed or pause, and a tab in the background catches up when it returns. A closed page does not craft (offline progress is deferred).
- One modifier per craft, from the recipes the account knows, and the hero's level must reach its minimum: Keen +2 points critical chance (level 1), Precise +3 Accuracy (level 1), Nimble +3 Evasion (level 3), Piercing +3 points Armor and magical penetration (level 6), Mending +5 Healing Power (level 6), Quick +2 points cooldown reduction (level 9). Modifiers on every equipped item add together, except that the same modifier counts at most twice (Batch C, §8). Batch C adds Vicious, Sturdy, and Hauler's (their numbers are under §8).
- An upgrade raises the level of an item the hero owns (worn or in the archive) by 1, up to the hero's level, for 3 of a chosen material (2 of witherbark, Step 13.2) plus `item level × 3` gold, in the same queue and time. It always succeeds, and the item keeps its modifier, quality, and durability. Decided 2026-11-07 (user): the material spent on an upgrade adds quality: scrap +0, hide +1, shard +2 percentage points, never above 110% (the best a craft can roll). Step 13.1 added riftglass (+3, cap 112%). Step 13.2 adds witherbark (+2, cap 110%, costs 2 units per upgrade) and oathsteel (+2, cap 111%, costs 3). Quality only ever rises through an upgrade, and an item already at 110% gains nothing from the material. Decided 2026-11-04 (user): upgrading is the cheap, safe way to keep a good item current, while crafting is for a new item or a different modifier. Cost of one more level against crafting a new item at the next level (6 materials plus `5 × (L + 1)` gold): L = 1, 3 materials and 3 gold against 6 and 10; L = 10, 3 materials and 30 gold against 6 and 55. Before this change the cost was 4 materials plus `5 × L` gold with chance `85% − 5 × L`, and a failure lost the cost.

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
- The first playable has 4 supply slots.

First-playable supplies, decided 2026-11-03:

| Supply | Effect | Price | Default rule for a new hero |
|---|---|---|---|
| Healing Draught | Restores 30% of maximum HP. No roll, no Healing Power, no healing-received change. | 15 gold | Hero HP at most 40% |
| Antidote | Removes every Poison and Bleed stack from the hero. | 10 gold | Hero Poison at least 3 stacks |
| Smoke Bomb | +15 percentage points on the next escape roll, then used up, whether the roll succeeds or fails. | 20 gold | None: it is used by the escape roll |
| Ward Charm (added 2026-11-04) | A barrier of 20% of maximum HP for 8 seconds. | 20 gold | When an enemy telegraph is present and hero HP is at most 70% (changed 2026-11-08) |

- Supplies are bought in Greyhaven with the hero's own gold and kept in the hero's stash. They are not shared between heroes.
- Before a run the player picks what goes in each of the 4 slots. The run takes the picked items out of the stash. A pick the stash cannot cover leaves that slot empty.
- Healing Draught and Antidote are used by priority rules. A rule can name a supply instead of a skill. The row is usable only while a slot holds that supply, and otherwise skips with `none left`. Using one is a hero action at 0.5× action time with no cost and no cooldown. It needs no target, is not a skill for class or race effects, and is not part of the four-skill loadout.
- An Antidote with no Poison or Bleed on the hero still uses the action and the item, so its rule should say when.
- New heroes start with the two default rules at the top of their rules. A hero made before supplies gets them once when the save loads, unless a rule already names a supply; one the player removes later does not come back.
- Added 2026-11-04 (user approved):
  - Ward Charm: a barrier of 20% of maximum HP for 8 seconds, used by a rule at the same 0.5× action time. 20 gold. Default rule for a new hero: when an enemy telegraph is present. Existing heroes get the rule once, unless a rule already names it.
  - Brewing at the Potion Shop: any supply can be made at once from the hero's own materials instead of bought: Healing Draught 3 hide + 5 gold, Antidote 2 shard + 3 gold, Smoke Bomb 3 scrap + 8 gold, Ward Charm 3 shard + 8 gold. No queue and no time.
- Changed 2026-11-08 (user approved, Step 12.5): the Ward Charm default rule is "an enemy telegraph is present AND hero HP at most 70%". The old rule (telegraph only) spent the Charm on the first telegraph, usually a weak hit, in almost every Warden run. The Charm's own numbers (barrier 20% of maximum HP, 8 s) do not change. Measured against the Fractured Warden (seeds 1-2, 60 runs each, reference rules plus default supply rows, wins / mean HP lost): Mage well prepared 70% to 98%, Ranger well prepared 25% to 34%, Assassin well prepared 5% to 3% (noise, still walled), over-levelled tiers 99-100% either way, Warrior and Cleric 0% either way. Other candidates (HP at most 60, 50, 80; telegraph at most 1 s plus HP; HP alone; no barrier up) are in doc/IMPLEMENTATION_PLAN.md Step 12.5. Rootmaw and Echo Knight stay at 100% wins with the Charm packed. Reference-matrix rows carry no supplies and are unchanged. Heroes who already have a Ward Charm rule keep it; only new heroes, reincarnated heroes, the harness, and legacy heroes that get the rule for the first time use the new row.
- Crafted supplies, decided 2026-11-08 (user approved, Step 13.3). New supplies that Greyhaven does not sell, brewed at the Potion Shop like any other, plus one shop supply. All are used by rules at 0.5x action time with no cost and no cooldown.

| Supply | Effect | Shop price | Brew | Unlock | Default rule |
|---|---|---|---|---|---|
| Warming Tonic | Removes all Chill and Burn from the hero and restores 10% of maximum HP. | 12 gold | 2 hide + 4 gold | none | Hero Chill at least 2 stacks |
| Greater Draught | Restores 50% of maximum HP. | not sold | 2 riftglass + 10 gold | Drowned Causeway discovered | Hero HP at most 30%, placed above the Healing Draught row |
| Riftglass Ward | A barrier of 30% of maximum HP for 8 seconds. | not sold | 2 riftglass + 12 gold | Any hero has beaten the Tidebound Colossus | Same conditions as the Ward Charm row, placed above it |

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

## 10. Reincarnation and Long-Term Progression

### Trigger

- During every life, the hero must lose to a boss before reincarnation becomes available.
- Reincarnation is optional after that loss.
- Losing does not itself grant a reward.
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
- Allocated attributes
- Allocated skill web
- Current contracts
- Personal world gates and boss access

Reincarnation preserves:

- Individual mastery and purchased legacy upgrades
- Known map locations
- Recipes and crafting proficiency
- Deposited gold
- The hero's gold, materials, and debt
- The hero's archived equipment

### Equipment across lives

- All equipment is archived and retains its normal level/tier requirements.
- One chosen heirloom scales down to the new hero level and grows with the hero.
- Heirloom, decided 2026-11-01: the hero picks one item at reincarnation. Its item level follows the hero's level, up to the level it had when chosen. Quality and modifiers are kept. It can only be changed at the next reincarnation. The Second Heirloom purchase lets a hero keep one more.

First-playable reincarnation numbers, decided 2026-11-01:

- Currency is Legacy: `2 × (level − 1) + floor(5 × XP into the level ÷ XP to the next level)`, so a level 20 hero gets about 38.
- One-time bonuses per hero, claimed at the next reincarnation after the hero first reaches them: +3 for each elite first defeated (Rootmaw Stalker, Echo Knight), +20 for the first Warden defeat, and +5 for each Echo rank first unlocked.
- Legacy buys hero-bound purchases that last across lives. Attribute Seed adds 1 to a starting attribute of the hero's choice and costs 3, up to 10 in total. Skill Point Seed gives 1 unallocated skill point at the start of each life and costs 8, then 12, then 16, up to 3. Second Heirloom lets the hero keep one more heirloom and costs 25, once.
- Mastery is the hero's completed lives, up to 10. Each rank adds 2% ordinary XP, up to +20%, and nothing else.
- The reset and preserve lists above apply. The hero's current contracts are cleared. All equipped gear goes to the archive, and the hero starts the new life with fresh starter gear.

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
- Replays use seeds kept in the save, so reloading during or after a catch-up gives the same result. The save records a last-seen time whenever it saves and when the page closes. A clock that went backwards counts as no time.
- A defeat while away uses the normal defeat rules (unsecured loot lost, rescue fee, durability), then offline running stops.
- On return the player sees a summary: time away (capped), runs, fights won, retreats, any defeat, gold, materials, XP and level-ups, crafts finished, contract progress, and places discovered. Only the last fight keeps its full log.
- The replay runs in chunks with a progress bar so the page does not freeze. Measured 2026-11-04: the headless sim plays a 4-fight Road run 53 times a second in Node, about 6,600 times real time, so 8 hours is about 5 seconds there.
- Built 2026-11-04. Details settled while building: the game stamps the save every 10 seconds and when the tab hides or the page closes, so a reload replays at most a few seconds. A catch-up under 5 seconds does nothing, and under 30 seconds it is applied without a summary. While a tab is hidden the live expedition clock is off (the catch-up counts that time on return); the craft clock keeps counting real time in either case. Repeating needs every node of the route in the hero's cleared nodes and the packed supplies in the stash. A run left at `returned` or `defeat` is not settled for the player.
- Measured 2026-11-04 (headless, level 40 Warrior on the Splintered Road, 8 hours): 338 runs and 1,017 fights in 2.2 seconds. The same hero returned about 2,500 materials from 3 hours, which would swamp the economy.
- Decided 2026-11-04 (user): fights won while away drop half the loot and gold of a live fight. For each won fight the material quantity and the gold gained are halved, rounded half up, so a drop of 1 stays 1. XP, contracts, and discoveries are not reduced. Live play is unchanged.
- Decided 2026-11-07 (user): away runs can start on their own. In the expedition preparation the player picks an away route, or none (the default). If the hero has no run when the player leaves (page closed or tab hidden for at least 5 seconds), the catch-up starts that route first, using the packed supplies and the carried gold from the preparation, and then follows the push-on and repeat orders. It does not start when the route is not cleared by the hero, when the packed supplies are not in the stash, or when a run already exists; the summary says why.
- Later: notifications while the page is closed (deferred, not planned).

Offline extras, decided 2026-11-08 (user approved; Step 12.6):

- Run limit: each hero has a repeat limit of 0 (no limit, the default), 1, 3, 5, 10 or 25 runs, set next to Repeat in the preparation. Offline, once that many runs have ended in one catch-up, no new run starts and the summary says "Run limit reached". 0 behaves as before.
- Other heroes: every hero that has an away route (not only the selected one) runs it while the player is away, with the same rules as the selected hero (push-on HP, bag-full order, repeat, run limit, half loot, defeat costs). Heroes without an away route rest. The same applies while the page is open: heroes that are not selected keep running their away route in the background, with no summary; their state shows as a badge on the Roster. Crafting counts once per catch-up for every hero, as before.
- Selecting a hero who has a background run brings that run onto the live screen. A run that has ended (returned or defeated) waits for the player on the Map. A hero with a background run cannot be deleted.
- The away summary is one row per hero (runs, fights won, gold, XP and levels, why it stopped), with the shared crafts and discoveries below.
- Mastered routes: each hero counts safe returns per route. At 10 safe returns the route is mastered for that hero and the live screen offers x8 playback speed on it. Live only: offline loot and the 0.5 rate do not change.
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
- Avoid extra section cards and boxes; group with spacing first.

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

Boss loss is required for reincarnation. Players may intentionally throw a fight. Normal defeat costs and progress-based rewards reduce the incentive, but this behavior must be observed during testing.

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
