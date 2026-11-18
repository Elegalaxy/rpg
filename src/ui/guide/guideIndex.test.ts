import { describe, expect, it } from 'vitest'

import { EXTRA_CLASS_SKILLS, HIDDEN_SKILL_IDS } from '../../content/guide.ts'
import { itemBases } from '../../content/items.ts'
import { SUPPLIES } from '../../content/supplies.ts'
import { statuses } from '../../content/statuses.ts'
import { classWebs } from '../../content/webs/index.ts'
import { CLERIC_VOWS, ZEAL_BASE } from '../../sim/classes/cleric.ts'
import { ITEM_MODIFIERS, MODIFIER_STACK_CAP } from '../../sim/economy.ts'
import { HERO_CLASSES } from '../../sim/constants.ts'
import { HERO_RACES } from '../../sim/progression.ts'
import { buildGuide, searchGuide } from './guideIndex.ts'

const entries = buildGuide()
const ids = new Set<string>(entries.map((entry) => entry.id))

describe('buildGuide', () => {
  it('has unique ids', () => {
    expect(ids.size).toBe(entries.length)
  })

  it('has an entry for every class, race, vow, status and supply', () => {
    for (const id of HERO_CLASSES) expect(ids.has(`class-${id}`), id).toBe(true)
    for (const id of HERO_RACES) expect(ids.has(`race-${id}`), id).toBe(true)
    for (const id of CLERIC_VOWS) expect(ids.has(`vow-${id}`), id).toBe(true)
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
  it('finds the vows and the Cleric for "vow", case-insensitively', () => {
    const found = searchGuide(entries, 'VOW', null).map((entry) => entry.id)
    for (const vow of CLERIC_VOWS) expect(found).toContain(`vow-${vow}`)
    expect(found).toContain('class-cleric')
  })

  it('narrows by section and returns everything for an empty query', () => {
    expect(searchGuide(entries, '', null).length).toBe(entries.length)
    expect(searchGuide(entries, 'vow', 'races')).toEqual([])
    expect(searchGuide(entries, 'zzzz-nothing', null)).toEqual([])
  })
})
