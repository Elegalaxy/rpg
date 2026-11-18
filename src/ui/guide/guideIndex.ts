import { classIdentity, racialStartingAttributes, raceIdentity } from '../../content/heroes.ts'
import {
  EXTRA_CLASS_SKILLS,
  GUIDE_TOPICS,
  HIDDEN_SKILL_IDS,
  VOW_GENERAL_NOTE,
  classGuide,
  raceGuide,
  statusGuide,
  vowGuide,
  type GuideTopicId,
} from '../../content/guide.ts'
import { enemies } from '../../content/enemies.ts'
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
import { HERO_CLASSES, type HeroClass } from '../../sim/constants.ts'
import { HERO_RACES, type HeroRace } from '../../sim/progression.ts'
import { MASTERY_HELP } from '../masteryHelp.ts'
import { skillFacts } from '../skillInfo.ts'

export type GuideSection = 'basics' | 'classes' | 'races' | 'skills' | 'statuses' | 'supplies' | 'expeditions' | 'reincarnation'

export const GUIDE_SECTIONS: readonly { id: GuideSection; label: string }[] = [
  { id: 'basics', label: 'Basics' },
  { id: 'classes', label: 'Classes' },
  { id: 'races', label: 'Races' },
  { id: 'skills', label: 'Skills' },
  { id: 'statuses', label: 'Statuses' },
  { id: 'supplies', label: 'Supplies' },
  { id: 'expeditions', label: 'Expeditions' },
  { id: 'reincarnation', label: 'Reincarnation' },
]

export type GuideEntryId = `class-${string}` | `race-${string}` | `vow-${string}` | `skill-${string}` | `status-${string}` | `supply-${string}` | `topic-${string}`

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
    links: [],
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

function topicEntry(id: GuideTopicId): GuideEntry {
  const found = GUIDE_TOPICS.find((candidate) => candidate.id === id)
  if (found === undefined) throw new Error(`guide topic ${id} is missing`)
  return {
    id: `topic-${found.id}`,
    section: TOPIC_SECTION[found.id],
    title: found.title,
    summary: found.summary,
    facts: [],
    lines: found.id === 'expeditions' ? [MASTERY_HELP] : [],
    prose: found.body,
    links: [],
  }
}

export function buildGuide(): GuideEntry[] {
  const entries: GuideEntry[] = [topicEntry('getting-started'), topicEntry('rules')]
  for (const classId of HERO_CLASSES) entries.push(classEntry(classId))
  for (const vow of CLERIC_VOWS) entries.push(vowEntry(vow))
  for (const race of HERO_RACES) entries.push(raceEntry(race))
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
