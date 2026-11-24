import { describe, expect, it } from 'vitest'

import { EXTRA_CLASS_SKILLS, HIDDEN_SKILL_IDS } from '../../content/guide.ts'
import { itemBases } from '../../content/items.ts'
import { SUPPLIES } from '../../content/supplies.ts'
import { statuses } from '../../content/statuses.ts'
import { classWebs } from '../../content/webs/index.ts'
import { CLERIC_VOWS, ZEAL_BASE } from '../../sim/classes/cleric.ts'
import { CURSES, HOLLOW_POWER } from '../../sim/races/racialNodes.ts'
import { ITEM_MODIFIERS, MODIFIER_STACK_CAP } from '../../sim/economy.ts'
import { HERO_CLASSES } from '../../sim/constants.ts'
import { HERO_RACES } from '../../sim/progression.ts'
import { UNIQUE_ITEMS } from '../../sim/uniques.ts'

import { buildGuide, searchGuide } from './guideIndex.ts'

const entries = buildGuide()
const ids = new Set<string>(entries.map((entry) => entry.id))

describe('buildGuide', () => {
  it('has unique ids', () => {
    expect(ids.size).toBe(entries.length)
  })

  it('has an entry for every class, race, vow, curse, status and supply', () => {
    for (const id of HERO_CLASSES) expect(ids.has(`class-${id}`), id).toBe(true)
    for (const id of HERO_RACES) expect(ids.has(`race-${id}`), id).toBe(true)
    for (const id of CLERIC_VOWS) expect(ids.has(`vow-${id}`), id).toBe(true)
    for (const id of CURSES) expect(ids.has(`curse-${id}`), id).toBe(true)
    for (const id of Object.keys(statuses)) expect(ids.has(`status-${id}`), id).toBe(true)
    for (const supply of SUPPLIES) expect(ids.has(`supply-${supply.id}`), supply.id).toBe(true)
  })

  it('has an entry for every class-owned skill and none for hidden ones', () => {
    const owned = new Set<string>(Object.keys(EXTRA_CLASS_SKILLS))
    for (const web of Object.values(classWebs)) {
      for (const id of web.startingSkillIds) owned.add(id)
      for (const node of web.nodes) if (node.unlocksSkillId !== null) owned.add(node.unlocksSkillId)
    }
    for (const id of owned) expect(ids.has(`skill-${id}`), id).toBe(true)
    for (const id of HIDDEN_SKILL_IDS) expect(ids.has(`skill-${id}`), id).toBe(false)
  })

  it('has an entry for every modifier and base item, and the Gear and Greyhaven topics', () => {
    for (const id of Object.keys(ITEM_MODIFIERS)) expect(ids.has(`modifier-${id}`), id).toBe(true)
    for (const id of Object.keys(itemBases)) expect(ids.has(`item-${id}`), id).toBe(true)
    expect(ids.has('topic-gear')).toBe(true)
    expect(ids.has('topic-greyhaven')).toBe(true)
  })

  it('has a Unique items entry for every unique, with the facts a player needs and no numbers in its prose', () => {
    for (const def of UNIQUE_ITEMS) {
      const entry = entries.find((candidate) => candidate.id === `unique-${def.id}`)
      expect(entry, def.id).toBeDefined()
      expect(entry?.group).toBe('Unique items')
      expect(entry?.facts.map((fact) => fact.label)).toEqual(['Source', 'Slot', 'Item level', 'Fixed modifier', 'Signature', 'Earned', 'Sell price'])
      expect(entry?.facts.find((fact) => fact.label === 'Item level')?.value).toBe(String(def.itemLevel))
      expect(entry?.facts.find((fact) => fact.label === 'Sell price')?.value).toBe(`${def.itemLevel * 20} gold`)
      expect(entry?.facts.find((fact) => fact.label === 'Earned')?.value).toBe('First defeat, paid on a safe return, once per hero')
      expect(entry?.facts.find((fact) => fact.label === 'Source')?.value).toContain(',')
      expect(/\d/.test([entry?.summary ?? '', ...(entry?.lines ?? []), ...(entry?.prose ?? [])].join(' ')), def.id).toBe(false)
    }
    expect(entries.filter((entry) => entry.group === 'Unique items')).toHaveLength(UNIQUE_ITEMS.length)
    expect(searchGuide(entries, 'Rootmaw Treads', null).some((entry) => entry.id === 'unique-rootmaw-treads')).toBe(true)
  })

  it('says every modifier counts at most the stack cap, read from the sim constant', () => {
    for (const id of Object.keys(ITEM_MODIFIERS)) {
      const entry = entries.find((candidate) => candidate.id === `modifier-${id}`)
      expect(entry?.facts.find((fact) => fact.label === 'Stacking')?.value, id).toBe(`Counts at most ${MODIFIER_STACK_CAP} times across worn gear`)
    }
  })

  it("explains Hauler's bag room under the cap", () => {
    const hauler = entries.find((entry) => entry.id === 'modifier-hauler')
    expect(hauler?.facts.find((fact) => fact.label === 'Fits')?.value).toContain('chest only')
    expect(hauler?.lines.join(' ')).toContain(`at most ${3 * MODIFIER_STACK_CAP} in all`)
  })

  it('only links to entries that exist', () => {
    for (const entry of entries) for (const link of entry.links) expect(ids.has(link.id), `${entry.id} -> ${link.id}`).toBe(true)
  })

  it('generates the Zeal number from the sim constant and labels gated supplies', () => {
    const zeal = entries.find((entry) => entry.id === 'vow-zeal')
    expect(zeal?.facts.some((fact) => fact.value.includes(String(ZEAL_BASE)))).toBe(true)
    const greater = entries.find((entry) => entry.id === 'supply-greater-draught')
    expect(greater?.facts.find((fact) => fact.label === 'Price')?.value).toBe('Brew only')
    expect(greater?.facts.find((fact) => fact.label === 'Needs')?.value).toMatch(/^Unlocks after/)
  })
})

describe('searchGuide', () => {
  it('generates Hollow Hunger from the curse constants', () => {
    const hunger = entries.find((entry) => entry.id === 'curse-hollow-hunger')
    expect(hunger?.facts.some((fact) => fact.value.includes(String(Math.round((HOLLOW_POWER - 1) * 100))))).toBe(true)
    expect(entries.find((entry) => entry.id === 'race-undead')?.links.map((link) => link.id)).toEqual(CURSES.map((id) => `curse-${id}`))
  })

  it('finds the vows and the Cleric for "vow", case-insensitively', () => {
    const found = searchGuide(entries, 'VOW', null).map((entry) => entry.id)
    for (const vow of CLERIC_VOWS) expect(found).toContain(`vow-${vow}`)
    expect(found).toContain('class-cleric')
  })

  it('narrows by section and returns everything for an empty query', () => {
    expect(searchGuide(entries, '', null).length).toBe(entries.length)
    expect(searchGuide(entries, 'vow', 'races')).toEqual([])
    const curses = searchGuide(entries, 'curse', 'races').map((entry) => entry.id)
    for (const id of CURSES) expect(curses).toContain(`curse-${id}`)
    expect(curses).toContain('race-undead')
    expect(searchGuide(entries, 'zzzz-nothing', null)).toEqual([])
  })

  it('says the Swift recipe unlocks after the Briar Matriarch and Staunch after the Tyrant', () => {
    const needs = (id: string): string | undefined => entries.find((entry) => entry.id === `modifier-${id}`)?.facts.find((item) => item.label === 'Needs')?.value
    expect(needs('swift')).toBe('Recipe unlocks after any hero defeats Briar Matriarch')
    expect(needs('staunch')).toBe('Recipe unlocks after any hero defeats Emberwrought Tyrant')
  })

  it('lists first-clear facts per zone from the content table', () => {
    const topic = entries.find((entry) => entry.id === 'topic-expeditions')!
    const fact = (label: string) => topic.facts.find((item) => item.label === label)?.value
    expect(fact('First clear: Drowned Causeway')).toBe('660 g · 15 riftglass · 1 free upgrade · +2 Legacy')
    expect(fact('First clear: Bloodthorn Barrens')).toBe('1200 g · 15 bloodstone · 1 free upgrade · +2 Legacy')
    expect(fact('First clear: Splintered Road')).toBe('210 g · 15 scrap · 1 free upgrade')
    expect(fact('First clear: Fracture Gate')).toBe('600 g · 1 free upgrade')
    expect(topic.facts).toHaveLength(10)
    expect(fact('Safe pouch')).toMatch(/kept on defeat/)
    expect(fact('Echo rank')).toMatch(/Fractured Warden/)
  })

  it('reads the reincarnation numbers from the constants (Step 13.31)', () => {
    const topic = entries.find((entry) => entry.id === 'topic-reincarnation')!
    const fact = (label: string) => topic.facts.find((item) => item.label === label)?.value
    expect(fact('Carried share')).toBe('20% of gold, materials and supplies; Stockpile I to III: 30% / 40% / 50%')
    expect(fact('Head Start')).toBe('Start at level 5 / 10 / 15')
    expect(fact('Long Memory')).toBe('Recall reaches +3 / +6 levels above your peak')
    expect(fact('Artisan’s Favor')).toBe('+1 / +2 free upgrade tokens each new life')
    const prose = topic.prose.join(' ')
    expect(prose).toContain('Stockpile')
    expect(prose).toContain('The rest is lost')
    expect(prose).not.toContain('gold, materials, and the archive stay')
  })
})
