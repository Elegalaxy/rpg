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

Mastery and reincarnation currency belong to the individual hero. Account-level benefits focus on shared knowledge, materials, recipes, and unlocking character slots rather than granting unearned combat power.

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
- Only one selected hero makes active or offline progress at a time.
- World-map discoveries are shared, but each hero must clear personal combat gates.
- Materials and recipes are shared.
- Equipped gear is bound to its hero.
- A hero must personally unlock the crafting tier required to use shared materials.
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
- Successful basic attacks generate 10 base Readiness.
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
- Vow of Zeal generates 5 base Faith when a hero action deals direct HP damage, at most once per hero action.
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

1. Sundering Blow: unlock the Expose-applying active skill.
2. Weapon Discipline: weapon skills cost 10% less Fury and have 10% shorter base cooldowns.
3. Reckless Strike: unlock the high-risk two-handed active skill.
4. Heavy Follow-Through: after an action with a time coefficient of at least 1.2×, the next weapon action is 25% faster, subject to the global action-time floor.
5. Weapon Master, major keystone: using three different weapon skills in sequence completes Perfect Form. The next weapon skill costs no Fury and rolls from 95%-100%. Repeating a skill resets progress. The chain also resets at encounter end, when the relevant skills are unequipped, or on reincarnation.

#### Bulwark cluster

1. Shield Brace: unlock the shield-based defensive active skill.
2. Second Wind: unlock the Fury-spending recovery active skill.
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

1. Venom Edge: unlock the Poison-applying active skill.
2. Potent Toxins: increase Poison's stack cap from 5 to 7, shared duration from 8 to 10 seconds, and Poison application Potency by 10.
3. Fan of Knives: unlock the multi-target active skill.
4. Toxic Opportunity: applying at least one Poison stack to the Marked target grants one Advantage, subject to the normal one-trigger-per-action cap. Poison ticks do not generate Advantage.
5. Toxic Sovereign, major keystone: Poison on the Marked target no longer loses duration. When that target dies, apply half its Poison stacks, rounded down, to every surviving enemy, subject to each target's cap.

#### Execution cluster

1. Mark for Death: unlock the single-target Mark active skill.
2. Exploit Weakness: direct damage against the Marked target gains +15%, and Mark exploitation stores 25% additional fractional Advantage progress.
3. Execute: unlock the all-Advantage finisher.
4. Relentless: killing the Marked target resets Mark for Death's cooldown and leaves the Assassin with at least 2 Advantage after the killing action resolves, capped normally at 5.
5. Death Sentence, major keystone: Mark persists until its target dies or is moved. Against ordinary enemies, Execute is fatal below 4% HP per consumed Advantage stack, up to 20%. Bosses cannot be executed; Execute instead gains +10% final damage per consumed stack against them.

Only one of Ghost, Toxic Sovereign, or Death Sentence can be active during a life.
The chosen major keystone cannot change until reincarnation.

### Provisional Ranger web

The MVP Ranger web has fifteen nodes: five per cluster. Each node costs 1 skill point, and connections follow the first-playable rule above. Ammunition capacity remains open.

#### Marksmanship cluster

1. Aimed Shot: improve the starting skill to 200% Physical Power when used at 80 or more Readiness.
2. Steady Hands: at 75 or more Readiness, aimed skills gain +10 percentage points to their minimum damage roll and critical chance.
3. Piercing Arrow: unlock the Armor-penetrating active skill.
4. Patient Shot: after spending at least 4 seconds without using a Readiness-spending attack, the next aimed skill gains +20% damage. The effect is consumed on use and cannot stack.
5. Deadeye, major keystone: at 100 Readiness, Aimed Shot or Piercing Arrow consumes all Readiness, rolls from 95%-100%, and gains +25 percentage points of critical chance.

#### Traps cluster

1. Snare Trap: unlock the active skill that spends an action placing a trap; it triggers on a later enemy action and attempts Stun.
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

1. Fireball: unlock the group Fire/Burn active skill.
2. Frost Lance: unlock the single-target Frost/Chill active skill.
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
2. Mana Ward: unlock the Mana-spending defensive active skill.
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

1. Smite: increase damage from 100% to 120% Magical Power and add 5 Status Potency to vow-related effects.
2. Vowkeeper: increase base Faith generation from Zeal, Endurance, and Temperance by 20%.
3. Penance: unlock the health-for-Faith active skill.
4. Steadfast Spirit: fulfilling a vow condition below 50% HP or while an enemy heavy action is telegraphed generates 5 additional base Faith, at most once per hero action.
5. Exalted Vow, major keystone: increase the equipped vow's generation by another 50%. Breaking its condition removes 50 Faith and prevents Faith generation for 5 seconds. The lockout cannot retrigger while active.

#### Sanctuary cluster

1. Mend: increase healing from 120% to 140% Healing Power.
2. Ward: unlock the Faith-spending absorption active skill.
3. Consecration: unlock the temporary damage-and-recovery field.
4. Safeguard: each 5% of maximum HP effectively healed or prevented by a Cleric skill refunds 1 Faith, capped at 5 Faith per action or tick. Overhealing grants nothing.
5. Living Sanctuary, major keystone: while Consecration is active, store 30% of effective healing and barrier damage absorbed, capped at 50% of maximum HP. When the field ends, create a temporary Sanctuary Release skill for 8 seconds. A priority rule may release the stored value as direct healing or magical damage; release consumes a 1.0× action and the stored value.

#### Judgment cluster

1. Judgment: unlock the high-cost magical damage active skill.
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
- Every leg takes 20 seconds, the same as the road's ordinary journey, and a return walk takes the same.
- Each zone has one resource node that gives the hero 4 of a material on a visit, using the existing materials: a Scrap Heap on the Road (scrap), a Hollow Thicket in the Grove (hide), and a Shard Seam in the Bastion (shard). New materials wait for crafting (G8).
- Each branch ends in its elite: the Rootmaw Stalker in the Grove and the Echo Knight in the Bastion.
- The Fracture Gate is a personal gate. It opens for a hero once that hero has defeated both elites at least once. The boss is revealed to the hero on arrival at the gate, not before.
- Discovering a node is shared across the account. Defeating the elites is personal to each hero.
- The exact reward for a visit and the contract list remain open.

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
- Bramble Slam has a 1-second telegraph, deals 140% Physical Power, and has a 6-second cooldown.

Fracture Wisp:

- Levels 10-14; Burst archetype.
- Uses 0.5× baseline Armor and 1.5× baseline Resistance.
- Cold Spark deals 100% Magical Power, applies one Chill on a successful status roll, and has a 4-second cooldown.
- Fracture Ray has a 2-second telegraph, deals 180% Magical Power, can critically hit, and has a 9-second cooldown.

Rootmaw Stalker:

- Level 14 elite; Skirmisher/Tank hybrid.
- Stats: 1,350 HP, 29 Power, 51 Armor/Resistance, 24 Accuracy, 26 Evasion, 2.0-second base action time, and 25 Consistency.
- Regenerates 1% maximum HP per second; Burn pauses it and Expose halves it.
- Venomous Rend deals 120% Physical Power and makes two independent Poison applications at 75% base chance. Each stack ticks for 10% snapshotted Power. Cooldown: 6 seconds.
- Grasping Roots has a 2-second telegraph and a 10-second cooldown.
- Grasping Roots is interrupted if the hero deals 10% of Rootmaw's maximum HP during its telegraph.
- If not interrupted, it pushes the hero's next action 2 seconds later and reduces Evasion by 20 for 6 seconds.

#### Fallen Bastion enemies

Mixed Bastion encounters use Sentries to protect Arbalist or Echo backlines, making per-rule target selection important.

Hollow Sentry:

- Levels 8-12; Tank archetype.
- Uses 1.75× baseline Armor and 1.0× baseline Resistance instead of the normal Tank Defense multiplier.
- Shield Wall grants 35% incoming-damage reduction to the Sentry and one ally until the Sentry's next action. Cooldown: 7 seconds.
- Shield Bash deals 90% Physical Power and has a 60% base Stun chance. Cooldown: 8 seconds.

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
- Stats: approximately 1,920 HP, 25 Power, 69 Armor/Resistance, 26 Accuracy, 17 Evasion, 2.64-second base action time, and 25 Consistency.
- Alternates stances every 10 seconds.
- Guard stance grants +30% Armor and Resistance.
- Assault stance grants +25% Power and reduces Armor and Resistance by 20%.
- Once at 60% HP, uses a 2-second telegraph to summon one Oathbound Echo.
- The summoned Echo uses the normal level-16 Support stat block.
- Fractured Charge has a 1.5-second telegraph, deals 180% Physical Power, can critically hit, and has an 8-second cooldown.

### First boss: The Fractured Warden

- A former protector fused with the spreading fracture.
- Rank-0 level: 20.
- Rank-0 stats from the Standard baseline:
  - 8× HP: 3,840
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
     - Every 8 seconds, gain one stack granting +10% Power and +5% action speed while reducing Armor and Resistance by 5%; maximum 5 stacks.
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

1. Driving Blow: 110% Physical Power; generates the ordinary 5 Fury plus 10 additional Fury; 3-second cooldown; 1.0× action time.
2. Cleave: costs 25 Fury; deals 80% Physical Power to every enemy; 5-second cooldown; 1.15× action time.
3. Reckless Strike: requires a two-handed weapon; costs 40 Fury; deals 220% Physical Power; 8-second cooldown; 1.35× action time; increases incoming damage by 20% until the Warrior's next action.
4. Shield Brace: requires a shield; no Fury cost; reduces incoming damage by 30% until the Warrior's next action; being struck during the effect generates 5 base Fury; 8-second cooldown; 0.75× action time.
5. Second Wind: costs 50 Fury; heals 15% maximum HP plus 50% Healing Power; 15-second cooldown; 1.0× action time.
6. Sundering Blow: costs 20 Fury; deals 125% Physical Power; applies 20% Armor Expose for 8 seconds; 6-second cooldown; 1.0× action time.

#### Assassin

1. Mark for Death: no damage or resource cost; apply Mark for 8 seconds; 6-second cooldown; 0.5× action time.
2. Shadow Cut: 110% Physical Power; gain one Advantage when the target is Marked, subject to the one-trigger-per-action cap; 3-second cooldown; 0.8× action time.
3. Venom Edge: 90% Physical Power; apply one Poison stack whose tick deals 12% of snapshotted Physical Power; 4-second cooldown; 0.9× action time.
4. Smoke Step: gain +30 Evasion until the next Assassin action; successful Evasion uses the normal Advantage trigger; 8-second cooldown; 0.5× action time.
5. Fan of Knives: 70% Physical Power to every enemy; 6-second cooldown; 1.1× action time. Venom-web nodes may add Poison interactions.
6. Execute: consume all Advantage; deal `100% + (40% × consumed stacks)` Physical Power, then multiply by `1 + (0.5 × target missing-health fraction)`; 8-second cooldown; 1.1× action time. A critical Execute may generate one new Advantage through the normal critical trigger.

#### Ranger

1. Hunter's Mark: no Readiness cost; reveal target defenses and traits for the encounter; 5-second cooldown; 0.5× action time.
2. Aimed Shot: costs 40 Readiness; deals 180% Physical Power; 5-second cooldown; 1.2× action time.
3. Volley: costs 30 Readiness; deals 65% Physical Power to every enemy; 6-second cooldown; 1.2× action time.
4. Snare Trap: costs 25 Readiness; arm one trap that triggers on the target's next action with a 75% base Stun chance; 8-second cooldown; 1.0× action time. Only one Ranger trap can be armed at a time.
5. Piercing Arrow: costs 20 Readiness; deals 130% Physical Power; adds 30 percentage points of Armor penetration, subject to the total penetration cap; 5-second cooldown; 1.0× action time.
6. Flame Arrow: costs 20 Readiness and one special arrow; deals magical damage equal to 100% Physical Power; applies one Burn intensity whose tick deals 10% of snapshotted Physical Power; 6-second cooldown; 1.0× action time.

#### Mage

1. Arcane Bolt: costs 5 Mana; deals 90% Magical Power as Arcane damage; no cooldown; 0.8× action time.
2. Fireball: costs 30 Mana; deals 100% Magical Power as Fire damage to every enemy; applies one Burn intensity whose tick deals 12% of snapshotted Magical Power; 6-second cooldown; 1.2× action time.
3. Frost Lance: costs 20 Mana; deals 110% Magical Power as Frost damage; applies one Chill; 4-second cooldown; 1.0× action time.
4. Chain Lightning: costs 25 Mana; deals 120% Magical Power to the first target and each jump deals 75% of the previous hit, up to four targets; each hit pushes that target's next action 0.25 seconds later; 6-second cooldown; 1.1× action time.
5. Mana Ward: costs 30 Mana; creates a pre-mitigation barrier equal to 100% Magical Power for up to 8 seconds; 10-second cooldown; 0.75× action time.
6. Arcane Recovery: restores 30 base Mana before Spirit; 10-second cooldown; 1.0× action time; may use a configurable Mana threshold.

Elemental-charge and prepared-casting keystones modify how this base kit is paid for and sequenced.

#### Cleric

1. Smite: no Faith cost; deals 100% Magical Power; 3-second cooldown; 1.0× action time.
2. Mend: costs 25 Faith; heals 120% Healing Power; 5-second cooldown; 1.0× action time.
3. Ward: costs 30 Faith; creates a pre-mitigation barrier equal to 150% Healing Power for up to 8 seconds; 10-second cooldown; 0.75× action time.
4. Consecration: costs 40 Faith; creates one 8-second field that ticks every 2 seconds for 35% Magical Power damage and 25% Healing Power recovery; 15-second cooldown; 1.2× action time. Recasting replaces and refreshes the existing field.
5. Judgment: costs 50 Faith; deals 200% Magical Power; 10-second cooldown; 1.2× action time.
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
- Chance is 50% plus `floor(Agility / 5)` percentage points, capped at +20 points. Enemy, zone, supplies, and momentum add 0 until those modifiers exist. Press the Trail's escape bonus is a class node, not this base chance.
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
- The four supply slots start empty. A slot that holds an item still holds it after defeat, and items already consumed stay consumed. No consumable is defined yet.
- The rescue fee is 25 gold, paid from gold the hero is carrying. Unpaid gold is added to debt. Debt is only stored. Deposited gold is not spent. Soul Debt's extra 50% is a racial node, not this base fee.
- The hero must wait 5 minutes before the next expedition. The wait is stored on the defeat. It does not tick inside the lost expedition.
- `bossLossThisLife` is set only when a non-summon enemy in that fight is a boss. Splintered Road enemies are not bosses.

## 9. Towns, Crafting, and Economy

### Economy

- The economy supports adventuring rather than acting as a deep market simulation.
- Players gather, buy, sell, repair, and craft.
- Regional towns have specialties, services, recipes, and predictable price differences.
- Gold can be deposited to protect it from expedition risk.

First-playable town numbers, decided 2026-10-31:

- Gold comes from enemies. Each regular enemy drops its level × 2 gold. An elite or the boss drops its level × 3. Gold is added to the gold the hero is carrying.
- Before an expedition the player chooses how much gold to carry, with a default of 25, the rescue fee. The rest of the account's gold stays deposited and safe. On a safe return the carried gold goes back to the account. After a defeat the carried gold that is left after the rescue fee is lost.
- Greyhaven buys materials at 3 gold each (scrap 2) and buys archive items for `item level × 5 × quality`, rounded half up. It sells base items at 100% quality for `item level × 10` gold at the hero's level, and sells no supplies, because no consumable exists yet. The four supply slots stay empty.
- Repair restores an item to full durability. One item costs `ceil(missing durability × (1 + item level ÷ 2) ÷ 10)` gold. A disabled item is repaired the same way.
- Debt is kept on the account and added to by each defeat. It can be paid off in any amount from the account's gold, and it still blocks nothing.

### Crafting

- NPC artisans produce standard base items.
- Heroes customize and improve those items.
- A craft selects a base recipe, material, and one controlled modifier or rune.
- Materials define a visible quality range.
- Crafting proficiency raises and narrows the quality range.
- A failed upgrade consumes the upgrade materials but leaves the item unchanged.
- Crafting uses a short queue and progresses while the hero remains in town.
- Recipes and crafting proficiency persist through reincarnation.
- Item tiers and modifiers have hero-level requirements.

First-playable crafting numbers, decided 2026-10-31:

- Recipes: every base item can be made from the start. The account also knows two modifier recipes at the start (Keen and Precise). Later recipes add more modifiers.
- Materials set the visible quality range: scrap 90% to 100%, hide 95% to 105%, shard 100% to 110%. The quality roll is the average of two uniform rolls in that range. The rolls are seeded, and the seed is saved.
- Proficiency is personal to the hero and survives reincarnation. Each craft or upgrade attempt adds 1 XP. Rank is `floor(√XP)`, up to 10, and each rank raises the range's minimum by 1 percentage point, never above its maximum.
- A craft costs 6 of the chosen material plus `item level × 5` gold. The item level is at most the hero's level. It takes 30 seconds of town time, and the queue holds 3 jobs. Only the first job advances, and time passes only while no expedition is running.
- One modifier per craft, from the recipes the account knows, and the hero's level must reach its minimum: Keen +2 points critical chance (level 1), Precise +3 Accuracy (level 1), Nimble +3 Evasion (level 3), Piercing +3 points Armor and magical penetration (level 6), Mending +5 Healing Power (level 6), Quick +2 points cooldown reduction (level 9). Modifiers on every equipped item add together.
- An upgrade raises an archive item's level by 1, up to the hero's level, for 4 of a chosen material plus `item level × 5` gold, in the same queue and time. The chance is `85% − 5 × item level`. A failure uses the materials and returns the item unchanged.

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

Preferred equipment operates at 100% primary-stat effectiveness. Equipment outside class preferences operates at 90% Power/Defense effectiveness until a relevant skill-web node removes the penalty. Active skills still enforce explicit requirements such as Shield Brace requiring a shield. Unconventional equipment remains possible through skill-web investment. These reference sets exist for balance simulation, not as hard class locks.

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
- The first playable has 4 supply slots. They start empty. Which consumables fill them remains open, so Deserter supply pressure has nothing to spend yet.
- Loot capacity is 20. Each Splintered Road enemy drops 4 of its own material: a Fracture Shardling drops a shard, a Starved Wolf drops a hide, and a Deserter drops a scrap.
- The drop uses the momentum already held when the fight is won. The victory then adds its stack. Quantity is `4 × (1 + 5% × stacks)`, rounded half-up. Three stacks turn 4 into 5. One stack does not change a drop of 4, because 4.2 rounds to 4.
- Drops are added in slot order. When the bag is full, older materials stay and the newest quantity that does not fit is lost.
- The scripted intro fills the bag exactly: Shardling pair 8, wolf pair 8, Deserter 4. The next fight is where extra loot is lost.

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
- Shared materials
- Archived equipment

### Equipment across lives

- All equipment is archived and retains its normal level/tier requirements.
- One chosen heirloom scales down to the new hero level and grows with the hero.
- Exact heirloom scaling and whether the chosen heirloom can change during a life remain open.

### Campaign and endgame

- An early successful reincarnation cycle should take roughly one to two days of mixed active and offline progress.
- A hero should generally reach the base final boss after several reincarnations over approximately one to three weeks.
- Actual timing may vary significantly by build and luck.
- Defeating the final boss advances only that hero into a harder world tier.
- Higher tiers add stronger enemies, new modifiers, upgraded materials, and selected new encounters.

## 11. Offline and Session Design

- Target rhythm: 5-15 minute strategic check-ins around longer automated expeditions.
- Initial full-vision offline-combat cap: eight hours.
- Only the selected hero progresses.
- Offline retreat and defeat use the same simulation rules as active play.
- Previously proven zones can be run offline; exact proof requirements remain open.
- Mastered zones unlock faster simulation speeds.

Offline progress is part of the full vision but is deferred from the first combat-focused playable version unless needed for basic loop validation.

## 12. Presentation

- Browser-local application first.
- Pixel-art characters and combat presentation.
- Illustrated node-based world map.
- Dashboard-style panels for character, route, combat, log, crafting, and town services.
- Placeholder/simple pixel art is acceptable during the first playable version.
- Business model is undecided; the likely direction is a premium single-player game without microtransactions.

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

Account-wide materials can accelerate new heroes too aggressively. Personal crafting-tier and hero-level requirements must remain effective gates.

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
- Exact DoT coefficients, Expose magnitude, and cleanse availability
- How much boss progress a retreat removes once a boss-progress counter exists. The first playable removes none.
- What stored debt blocks, and how a disabled item is repaired. The first-playable fee is 25 gold from carried gold. Unpaid gold is stored as debt with no other effect. Deposited gold is untouched. The next expedition waits 5 minutes.
- Which consumables fill the four supply slots (the first playable has none)
- Crafting quality, proficiency, and upgrade formulas
- Heirloom scaling
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
