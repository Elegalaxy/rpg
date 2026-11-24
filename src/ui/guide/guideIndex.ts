import { classIdentity, racialStartingAttributes, raceIdentity } from '../../content/heroes.ts'
import {
  EXTRA_CLASS_SKILLS,
  GUIDE_TOPICS,
  HIDDEN_SKILL_IDS,
  CURSE_GENERAL_NOTE,
  VOW_GENERAL_NOTE,
  classGuide,
  curseGuide,
  raceGuide,
  statusGuide,
  vowGuide,
  type GuideTopicId,
} from '../../content/guide.ts'
import { enemies } from '../../content/enemies.ts'
import { FIRST_CLEAR_NODE_IDS, firstClearReward, firstClearRewardText } from '../../content/firstClear.ts'
import { CARRY_PERCENT_BASE, STOCKPILE_PERCENTS } from '../../persist/carryOver.ts'
import { LOADOUT_SLOT_COUNT, MAX_LOADOUT_SLOTS } from '../../sim/progression.ts'
import { ARTISAN_TOKENS, HEAD_START_LEVELS, LEGACY_ZONES, LONG_MEMORY_LEVELS, ZONE_CLEAR_BONUS } from '../../persist/reincarnation.ts'
import { BOARD_SIZE, MAX_ACTIVE_CONTRACTS } from '../../content/contracts.ts'
import { itemBases } from '../../content/items.ts'
import { BUYABLE_MATERIALS, MATERIAL_BUY_PRICE, MATERIAL_SELL_PRICE } from '../../content/shop.ts'
import { statuses } from '../../content/statuses.ts'
import { SUPPLIES, type SupplyDef } from '../../content/supplies.ts'
import { skills } from '../../content/skills.ts'
import { classWebs } from '../../content/webs/index.ts'
import { classWebIntro, clusterIntro, racialIntro } from '../../content/webs/intro.ts'
import { racialWebs } from '../../content/webs/racial.ts'
import { nodes as worldNodes } from '../../content/world.ts'
import {
  CLERIC_VOWS,
  ENDURANCE_BASE_CAP,
  ENDURANCE_BASE_PER_PERCENT,
  FAITH_MAXIMUM,
  TEMPERANCE_BASE,
  TEMPERANCE_HP_MAX,
  TEMPERANCE_HP_MIN,
  ZEAL_BASE,
  type ClericVow,
} from '../../sim/classes/cleric.ts'
import { CRAFT_MS, SOCKET_MIN_HERO_LEVEL, UPGRADE_MS, recipePrice } from '../../persist/crafting.ts'
import { SAFE_POUCH_ROOM } from '../../sim/expedition.ts'
import { ECHO_RANK_GROWTH } from '../../sim/constants.ts'
import { STILLNESS_READY } from '../../sim/races/undead.ts'
import {
  CURSES,
  GRAVE_READY,
  GRAVE_SPEED,
  HOLLOW_HEAL_FRACTION,
  HOLLOW_HEALING_RECEIVED,
  HOLLOW_HP_FRACTION,
  HOLLOW_POWER,
  SOUL_CAP,
  SOUL_DEBT_FEE,
  SOUL_DEBT_PER_SOUL,
  type Curse,
} from '../../sim/races/racialNodes.ts'
import { PACKS } from '../../persist/pack.ts'
import { CLASS_PREFERENCE, HERO_CLASSES, type HeroClass } from '../../sim/constants.ts'
import {
  ITEM_MAX_DURABILITY,
  ITEM_MODIFIERS,
  MODIFIER_RANK_MAX,
  MODIFIER_STACK_CAP,
  MODIFIER_TEMPER_MAX,
  rankName,
  rankable,
  type ItemBase,
  type ItemModifier,
} from '../../sim/economy.ts'
import { HERO_RACES, type HeroRace } from '../../sim/progression.ts'
import { MASTERY_HELP } from '../masteryHelp.ts'
import { skillFacts } from '../skillInfo.ts'

export type GuideSection = 'basics' | 'classes' | 'races' | 'skills' | 'statuses' | 'supplies' | 'gear' | 'town' | 'expeditions' | 'reincarnation'

export const GUIDE_SECTIONS: readonly { id: GuideSection; label: string }[] = [
  { id: 'basics', label: 'Basics' },
  { id: 'classes', label: 'Classes' },
  { id: 'races', label: 'Races' },
  { id: 'skills', label: 'Skills' },
  { id: 'statuses', label: 'Statuses' },
  { id: 'supplies', label: 'Supplies' },
  { id: 'gear', label: 'Gear' },
  { id: 'town', label: 'Greyhaven' },
  { id: 'expeditions', label: 'Expeditions' },
  { id: 'reincarnation', label: 'Reincarnation' },
]

export type GuideEntryId =
  | `class-${string}`
  | `race-${string}`
  | `vow-${string}`
  | `curse-${string}`
  | `skill-${string}`
  | `status-${string}`
  | `supply-${string}`
  | `modifier-${string}`
  | `item-${string}`
  | `topic-${string}`

export type GuideFact = { label: string; value: string }
export type GuideLinkRef = { id: GuideEntryId; label: string }

export type GuideEntry = {
  id: GuideEntryId
  section: GuideSection
  title: string
  summary: string
  /** Sub-heading inside a section, such as a class name or "Cleric vows". */
  group?: string
  facts: GuideFact[]
  /** Short effect or detail lines shown under the facts. */
  lines: string[]
  /** Longer how-it-plays text, shown folded. */
  prose: string[]
  links: GuideLinkRef[]
}

const TOPIC_SECTION: Record<GuideTopicId, GuideSection> = {
  'getting-started': 'basics',
  rules: 'basics',
  expeditions: 'expeditions',
  'supplies-crafting': 'supplies',
  reincarnation: 'reincarnation',
  gear: 'gear',
  greyhaven: 'town',
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function percent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`
}

function skillEntryId(skillId: string): GuideEntryId {
  return `skill-${skillId}`
}

function skillName(skillId: string): string {
  return skills[skillId]?.name ?? skillId
}

/** Split the plain stat strings from `skillFacts` into labelled facts. */
function statFact(stat: string): GuideFact {
  if (stat === 'No cost') return { label: 'Cost', value: 'None' }
  if (stat.startsWith('Cost ')) return { label: 'Cost', value: stat.slice(5) }
  if (stat.startsWith('Cooldown ')) return { label: 'Cooldown', value: stat.slice(9) }
  if (stat === 'Hits all enemies') return { label: 'Target', value: 'All enemies' }
  if (stat === 'One target') return { label: 'Target', value: 'One' }
  if (stat.startsWith('Needs ')) return { label: 'Needs', value: stat.slice(6) }
  return { label: 'Uses', value: stat }
}

type OwnedSkill = { classId: HeroClass; unlockedBy: string }

function classOwnedSkills(): Map<string, OwnedSkill> {
  const owned = new Map<string, OwnedSkill>()
  for (const classId of HERO_CLASSES) {
    const web = classWebs[classId]
    for (const id of web.startingSkillIds) owned.set(id, { classId, unlockedBy: 'Starting skill' })
    for (const node of web.nodes) {
      if (node.unlocksSkillId !== null) owned.set(node.unlocksSkillId, { classId, unlockedBy: `${node.cluster} node: ${node.name}` })
    }
  }
  for (const [id, extra] of Object.entries(EXTRA_CLASS_SKILLS)) owned.set(id, { classId: extra.classId, unlockedBy: extra.unlockedBy })
  for (const id of HIDDEN_SKILL_IDS) owned.delete(id)
  return owned
}

function classEntry(classId: HeroClass): GuideEntry {
  const identity = classIdentity[classId]
  const web = classWebs[classId]
  const clusters = [...new Set(web.nodes.map((node) => node.cluster))]
  const facts: GuideFact[] = [{ label: 'Core', value: identity.core }]
  for (const cluster of clusters) {
    const keystone = web.nodes.find((node) => node.cluster === cluster && node.keystone)
    facts.push({ label: `${cluster} cluster`, value: keystone === undefined ? '' : `Keystone: ${keystone.name}` })
  }
  const lines = [classWebIntro[classId], ...clusters.map((cluster) => `${cluster}: ${clusterIntro[classId][cluster] ?? ''}`)]
  const links: GuideLinkRef[] = web.startingSkillIds.map((id) => ({ id: skillEntryId(id), label: skillName(id) }))
  if (classId === 'cleric') for (const vow of CLERIC_VOWS) links.push({ id: `vow-${vow}`, label: vowGuide[vow].name })
  links.push({ id: 'topic-rules', label: 'Rules (automation)' })
  return {
    id: `class-${classId}`,
    section: 'classes',
    title: identity.name,
    summary: identity.summary,
    facts,
    lines,
    prose: classGuide[classId].tips,
    links,
  }
}

function vowFacts(vow: ClericVow): GuideFact[] {
  const meter: GuideFact = { label: 'Faith meter', value: `0-${FAITH_MAXIMUM}` }
  switch (vow) {
    case 'zeal':
      return [{ label: 'Faith', value: `${ZEAL_BASE} base Faith per action that deals direct HP damage (once per action)` }, meter]
    case 'endurance':
      return [
        { label: 'Faith', value: `${ENDURANCE_BASE_PER_PERCENT} base Faith per 1% of max HP lost or absorbed, at most ${ENDURANCE_BASE_CAP} per enemy action` },
        meter,
      ]
    case 'temperance':
      return [{ label: 'Faith', value: `${TEMPERANCE_BASE} base Faith after an action that ends at ${percent(TEMPERANCE_HP_MIN)}-${percent(TEMPERANCE_HP_MAX)} HP` }, meter]
  }
}

function vowEntry(vow: ClericVow): GuideEntry {
  const info = vowGuide[vow]
  return {
    id: `vow-${vow}`,
    section: 'classes',
    group: 'Cleric vows',
    title: info.name,
    summary: info.note,
    facts: vowFacts(vow),
    lines: [info.when],
    prose: [VOW_GENERAL_NOTE],
    links: [{ id: 'class-cleric', label: 'Cleric' }],
  }
}

function raceEntry(race: HeroRace): GuideEntry {
  const identity = raceIdentity[race]
  const attributes = racialStartingAttributes[race]
  return {
    id: `race-${race}`,
    section: 'races',
    title: identity.name,
    summary: identity.summary,
    facts: [
      { label: 'Core', value: identity.core },
      {
        label: 'Starting attributes',
        value: `Strength ${attributes.strength} · Vitality ${attributes.vitality} · Agility ${attributes.agility} · Intellect ${attributes.intellect} · Spirit ${attributes.spirit}`,
      },
      { label: 'Racial nodes', value: racialWebs[race].nodes.map((node) => node.name).join(' → ') },
    ],
    lines: [racialIntro[race]],
    prose: raceGuide[race].tips,
    links: race === 'undead' ? CURSES.map((curse) => ({ id: `curse-${curse}` as const, label: curseGuide[curse].name })) : [],
  }
}

function curseFacts(curse: Curse): GuideFact[] {
  switch (curse) {
    case 'hollow-hunger':
      return [
        { label: 'Power', value: `+${percent(HOLLOW_POWER - 1)} all Power` },
        { label: 'Healing received', value: percent(HOLLOW_HEALING_RECEIVED) },
        {
          label: 'Soul heal',
          value: `Below ${percent(HOLLOW_HP_FRACTION)} HP, spend 1 Soul to heal ${percent(HOLLOW_HEAL_FRACTION)} of maximum HP, once per fight`,
        },
      ]
    case 'grave-patience':
      return [
        { label: 'Action speed', value: percent(GRAVE_SPEED) },
        { label: 'Stillness', value: `Ready after ${GRAVE_READY} undamaged actions, instead of ${STILLNESS_READY}` },
        { label: 'Soul', value: 'Spending 1 Soul when Stillness fires keeps 1 progress' },
      ]
    case 'soul-debt':
      return [
        { label: 'Rescue fee', value: `×${SOUL_DEBT_FEE}, and the unpaid part becomes that much debt` },
        { label: 'Power', value: `+${percent(SOUL_DEBT_PER_SOUL)} all Power per Soul Fragment, up to ${SOUL_CAP}` },
      ]
  }
}

function curseEntry(curse: Curse): GuideEntry {
  const info = curseGuide[curse]
  return {
    id: `curse-${curse}`,
    section: 'races',
    group: 'Undead curses',
    title: info.name,
    summary: info.note,
    facts: curseFacts(curse),
    lines: [info.when],
    prose: [CURSE_GENERAL_NOTE],
    links: [{ id: 'race-undead', label: 'Undead' }],
  }
}

function skillEntry(skillId: string, owner: OwnedSkill): GuideEntry | null {
  const facts = skillFacts(skillId)
  if (facts === null) return null
  return {
    id: skillEntryId(skillId),
    section: 'skills',
    group: classIdentity[owner.classId].name,
    title: facts.name,
    summary: facts.effects[0] ?? '',
    facts: [...facts.stats.map(statFact), { label: 'Unlocked by', value: owner.unlockedBy }],
    lines: [...new Set(facts.effects)],
    prose: ['These are the base values. Skill-web nodes can change a skill’s cost, cooldown, or effects.'],
    links: [{ id: `class-${owner.classId}`, label: classIdentity[owner.classId].name }],
  }
}

function humanizeKey(key: string): string {
  return capitalize(key.replace(/([A-Z])/g, ' $1').toLowerCase())
}

function statusFactValue(key: string, value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => (typeof item === 'number' && item <= 1 ? percent(item) : String(item))).join(' / ')
  if (typeof value === 'number' && key.endsWith('Seconds')) return `${value} s`
  return String(value)
}

function statusEntry(statusId: string): GuideEntry {
  const def = statuses[statusId] as unknown as Record<string, unknown>
  const facts: GuideFact[] = []
  for (const [key, value] of Object.entries(def)) {
    if (key === 'id' || key === 'name' || key === 'kind') continue
    facts.push({ label: humanizeKey(key.replace(/Seconds$/, '')), value: statusFactValue(key, value) })
  }
  return {
    id: `status-${statusId}`,
    section: 'statuses',
    title: String(def['name']),
    summary: statusGuide[statusId]?.summary ?? '',
    facts,
    lines: [],
    prose: [],
    links: [],
  }
}

function requirementText(supply: SupplyDef): string | null {
  const requires = supply.requires
  if (requires === undefined) return null
  if ('discoveryId' in requires) {
    const place = Object.values(worldNodes).find((node) => node.discoveryId === requires.discoveryId)
    return `Unlocks after you discover ${place?.name ?? requires.discoveryId}`
  }
  return `Unlocks after any hero defeats ${enemies[requires.enemyId]?.name ?? requires.enemyId}`
}

function supplyEntry(supply: SupplyDef): GuideEntry {
  const facts: GuideFact[] = [
    { label: 'Price', value: supply.price === null ? 'Brew only' : `${supply.price} gold` },
    { label: 'Brew cost', value: `${supply.brew.quantity} ${capitalize(supply.brew.materialId)} + ${supply.brew.gold} gold` },
    { label: 'Used by', value: supply.ruleUsed ? 'Rules' : 'Automatically' },
  ]
  const needs = requirementText(supply)
  if (needs !== null) facts.push({ label: 'Needs', value: needs })
  return {
    id: `supply-${supply.id}`,
    section: 'supplies',
    title: supply.name,
    summary: supply.effect,
    facts,
    lines: [],
    prose: [],
    links: [{ id: 'topic-supplies-crafting', label: 'Supplies and crafting' }],
  }
}

const TYPE_NAMES: { [type in ItemBase['type']]: string } = { weapon: 'Weapons', offHand: 'Off-hands', armor: 'Armor', accessory: 'Accessories' }

function modifierFits(modifier: ItemModifier): string {
  return modifier.appliesTo
    .map((type) => (type === 'armor' && modifier.armorSlots !== undefined ? `Armor (${modifier.armorSlots.join(', ')} only)` : TYPE_NAMES[type]))
    .join(', ')
}

function modifierNeeds(modifier: ItemModifier): string | null {
  const requires = modifier.requires
  if (requires === undefined) return null
  if ('discoveryId' in requires) {
    const place = Object.values(worldNodes).find((node) => node.discoveryId === requires.discoveryId)
    return `Recipe unlocks after you discover ${place?.name ?? requires.discoveryId}`
  }
  return `Recipe unlocks after any hero defeats ${enemies[requires.enemyId]?.name ?? requires.enemyId}`
}

/** Every modifier has an entry. The stack limit is read from `MODIFIER_STACK_CAP` and applies to all of them. */
function modifierEntry(modifier: ItemModifier): GuideEntry {
  const facts: GuideFact[] = [
    { label: 'Effect', value: modifier.text },
    { label: 'Hero level', value: String(modifier.minLevel) },
    { label: 'Recipe price', value: `${recipePrice(modifier.id)} gold` },
    { label: 'Fits', value: modifierFits(modifier) },
    { label: 'Stacking', value: `Counts at most ${MODIFIER_STACK_CAP} times across worn gear` },
    { label: 'Ranks', value: rankable(modifier) ? `Up to rank ${rankName(MODIFIER_RANK_MAX)}` : 'No numbers to raise' },
  ]
  const needs = modifierNeeds(modifier)
  if (needs !== null) facts.push({ label: 'Needs', value: needs })
  const lines: string[] = []
  if (modifier.bagRoom !== undefined) {
    lines.push(`Each counted piece adds ${modifier.bagRoom} bag room, so at most ${modifier.bagRoom * MODIFIER_STACK_CAP} in all. A piece beyond the limit adds none.`)
  }
  return {
    id: `modifier-${modifier.id}`,
    section: 'gear',
    group: 'Modifiers',
    title: modifier.name,
    summary: modifier.text,
    facts,
    lines,
    prose: [],
    links: [{ id: 'topic-gear', label: 'Gear' }],
  }
}

function wornIn(base: ItemBase): string {
  if (base.type === 'weapon') return 'Main hand'
  if (base.type === 'offHand') return 'Off hand'
  if (base.type === 'armor') return capitalize(base.slot)
  return 'Accessory (two slots)'
}

function preferredBy(base: ItemBase): string {
  if (base.type === 'accessory') return 'Every class'
  return HERO_CLASSES.filter((classId) => {
    const preference = CLASS_PREFERENCE[classId]
    if (base.type === 'weapon') return preference.weapons.includes(base.weaponKind)
    if (base.type === 'offHand') return preference.offHands.includes(base.offHandKind)
    return preference.armor === base.category
  })
    .map((classId) => classIdentity[classId].name)
    .join(', ')
}

function itemEntry(base: ItemBase): GuideEntry {
  return {
    id: `item-${base.id}`,
    section: 'gear',
    group: 'Base items',
    title: base.name,
    summary: `${TYPE_NAMES[base.type]}: worn in ${wornIn(base).toLowerCase()}.`,
    facts: [
      { label: 'Kind', value: TYPE_NAMES[base.type] },
      { label: 'Worn in', value: wornIn(base) },
      { label: 'Preferred by', value: preferredBy(base) },
      ...(base.type === 'accessory' && base.implicit !== undefined
        ? [{ label: 'Built-in stat', value: `${base.implicit.key === 'maxHpBonus' ? 'Maximum HP' : 'Critical damage'}, more at a higher item level` }]
        : []),
      ...(base.type === 'accessory' && base.starterOnly === true ? [{ label: 'Source', value: 'Starting gear only' }] : []),
    ],
    lines: base.type === 'weapon' && base.weaponKind === 'twoHanded' ? ['Leaves the off-hand slot empty.'] : [],
    prose: [],
    links: [{ id: 'topic-gear', label: 'Gear' }],
  }
}

function gearFacts(): GuideFact[] {
  return [
    { label: 'Equipment slots', value: 'Main hand, off hand, head, chest, hands, feet, two accessories' },
    { label: 'Full durability', value: String(ITEM_MAX_DURABILITY) },
    { label: 'Same modifier counts', value: `At most ${MODIFIER_STACK_CAP} times across worn gear` },
    { label: 'Sockets unlock at hero level', value: String(SOCKET_MIN_HERO_LEVEL) },
    { label: 'Top modifier rank', value: rankName(MODIFIER_RANK_MAX) },
    { label: 'Top temper', value: String(MODIFIER_TEMPER_MAX) },
    { label: 'Craft, socket, infuse, rank and pack', value: `${CRAFT_MS / 1000} s` },
    { label: 'Upgrade', value: `${UPGRADE_MS / 1000} s` },
  ]
}

function townFacts(): GuideFact[] {
  const prices = Object.entries(MATERIAL_SELL_PRICE)
    .map(([id, price]) => `${capitalize(id)} ${price}`)
    .join(' · ')
  const buyPrices = BUYABLE_MATERIALS.map((id) => `${capitalize(id)} ${MATERIAL_BUY_PRICE[id] ?? 0}`).join(' · ')
  return [
    { label: 'Material sell price (gold each)', value: prices },
    { label: 'Material buy price (gold each, common only)', value: buyPrices },
    { label: 'Satchel', value: `${PACKS.satchel.slots} supply slots, hero level ${PACKS.satchel.minHeroLevel}, ${PACKS.satchel.gold} gold` },
    { label: 'Field Pack', value: `${PACKS.fieldPack.slots} supply slots, hero level ${PACKS.fieldPack.minHeroLevel}, ${PACKS.fieldPack.gold} gold` },
    { label: 'Contracts held at once', value: String(MAX_ACTIVE_CONTRACTS) },
    { label: 'Offers on the board', value: String(BOARD_SIZE) },
  ]
}

/** One fact per zone that pays a first-clear reward, generated from the content table and the Legacy bonus. */
function runFacts(): GuideFact[] {
  return [
    { label: 'Safe pouch', value: `Up to ${SAFE_POUCH_ROOM} of the rarest materials you carry, kept on defeat` },
    { label: 'Echo rank', value: `Each rank multiplies the Fractured Warden's HP, Power, Armor and Resistance by ${ECHO_RANK_GROWTH}` },
  ]
}

function firstClearFacts(): GuideFact[] {
  return FIRST_CLEAR_NODE_IDS.flatMap((nodeId) => {
    const reward = firstClearReward(nodeId)
    if (reward === null) return []
    const legacy = LEGACY_ZONES.includes(nodeId) ? ` · +${ZONE_CLEAR_BONUS} Legacy` : ''
    return [{ label: `First clear: ${reward.name}`, value: `${firstClearRewardText(reward)}${legacy}` }]
  })
}

/** Numbers behind the reincarnation text, read from the constants so the Guide cannot drift. */
function reincarnationFacts(): GuideFact[] {
  return [
    { label: 'Carried share', value: `${CARRY_PERCENT_BASE}% of gold, materials and supplies; Stockpile I to III: ${STOCKPILE_PERCENTS.map((percent) => `${percent}%`).join(' / ')}` },
    { label: 'Earlier-life gear', value: 'Sells for the carried share of its normal price' },
    { label: 'Fifth Skill Slot', value: `${MAX_LOADOUT_SLOTS} skills in the loadout instead of ${LOADOUT_SLOT_COUNT}` },
    { label: 'Head Start', value: `Start at level ${HEAD_START_LEVELS.join(' / ')}` },
    { label: 'Artisan’s Favor', value: `+${ARTISAN_TOKENS.join(' / +')} free upgrade tokens each new life` },
    { label: 'Long Memory', value: `Recall reaches ${LONG_MEMORY_LEVELS.map((levels) => `+${levels}`).join(' / ')} levels above your peak` },
  ]
}

function topicEntry(id: GuideTopicId): GuideEntry {
  const found = GUIDE_TOPICS.find((candidate) => candidate.id === id)
  if (found === undefined) throw new Error(`guide topic ${id} is missing`)
  return {
    id: `topic-${found.id}`,
    section: TOPIC_SECTION[found.id],
    title: found.title,
    summary: found.summary,
    facts: found.id === 'gear' ? gearFacts() : found.id === 'greyhaven' ? townFacts() : found.id === 'expeditions' ? [...firstClearFacts(), ...runFacts()] : found.id === 'reincarnation' ? reincarnationFacts() : [],
    lines: found.id === 'expeditions' ? [MASTERY_HELP] : [],
    prose: found.body,
    links: found.id === 'greyhaven' ? [{ id: 'topic-gear', label: 'Gear' }] : found.id === 'gear' ? [{ id: 'topic-greyhaven', label: 'Greyhaven and its shops' }] : [],
  }
}

export function buildGuide(): GuideEntry[] {
  const entries: GuideEntry[] = [topicEntry('getting-started'), topicEntry('rules')]
  for (const classId of HERO_CLASSES) entries.push(classEntry(classId))
  for (const vow of CLERIC_VOWS) entries.push(vowEntry(vow))
  for (const race of HERO_RACES) entries.push(raceEntry(race))
  for (const curse of CURSES) entries.push(curseEntry(curse))
  const owned = classOwnedSkills()
  for (const classId of HERO_CLASSES) {
    for (const [skillId, owner] of owned) {
      if (owner.classId !== classId) continue
      const entry = skillEntry(skillId, owner)
      if (entry !== null) entries.push(entry)
    }
  }
  for (const statusId of Object.keys(statuses)) entries.push(statusEntry(statusId))
  entries.push(topicEntry('supplies-crafting'))
  for (const supply of SUPPLIES) entries.push(supplyEntry(supply))
  entries.push(topicEntry('gear'))
  for (const modifier of Object.values(ITEM_MODIFIERS)) entries.push(modifierEntry(modifier))
  for (const base of Object.values(itemBases)) entries.push(itemEntry(base))
  entries.push(topicEntry('greyhaven'))
  entries.push(topicEntry('expeditions'), topicEntry('reincarnation'))
  return entries
}

/** Entries whose text contains every word of the query, case-insensitively. A section filter narrows first. */
export function searchGuide(entries: readonly GuideEntry[], query: string, section: GuideSection | null): GuideEntry[] {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 0)
  return entries.filter((entry) => {
    if (section !== null && entry.section !== section) return false
    if (words.length === 0) return true
    const haystack = [entry.title, entry.summary, entry.group ?? '', ...entry.facts.flatMap((fact) => [fact.label, fact.value]), ...entry.lines, ...entry.prose]
      .join('\n')
      .toLowerCase()
    return words.every((word) => haystack.includes(word))
  })
}
