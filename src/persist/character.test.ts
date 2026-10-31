import { describe, expect, it } from 'vitest'

import { classWebs } from '../content/webs/index.ts'
import { racialWebs } from '../content/webs/racial.ts'
import { HERO_CLASSES } from '../sim/constants.ts'
import { HERO_RACES } from '../sim/progression.ts'

import {
  ATTRIBUTE_KEYS,
  confirmationText,
  grantPoints,
  nodeViews,
  selectedHero,
  spendAttributes,
  takeNode,
} from './character.ts'
import { createHero } from './roster.ts'
import { assertSaveData, newSave, type SaveData } from './save.ts'

function heroSave(classId: (typeof HERO_CLASSES)[number] = 'warrior', race: (typeof HERO_RACES)[number] = 'human'): SaveData {
  const made = createHero(newSave(), { name: 'Ash', race, classId })
  if (!made.ok) throw new Error(made.reason)
  return grantPoints(made.save, 'hero-1', 6, 12)
}

function progressOf(save: SaveData) {
  const hero = selectedHero(save)
  if (hero === null) throw new Error('no hero')
  return hero.progress
}

function take(save: SaveData, nodeId: string): SaveData {
  const result = takeNode(save, 'hero-1', nodeId)
  if (!result.ok) throw new Error(result.reason)
  return result.save
}

describe('node allocation', () => {
  it('only offers what the simulation accepts, for every node, at every step', () => {
    for (const classId of HERO_CLASSES) {
      for (const race of HERO_RACES) {
        let save = heroSave(classId, race)
        for (let round = 0; round < 40; round += 1) {
          const hero = selectedHero(save)
          if (hero === null) throw new Error('no hero')
          const views = nodeViews(hero)
          const open = views.filter((view) => view.preview.canTake)
          for (const view of views) {
            const result = takeNode(save, 'hero-1', view.node.id)
            expect(result.ok, `${classId} ${race} ${view.node.id}`).toBe(view.preview.canTake)
            if (view.allocated) expect(view.preview.reasons).toContain('already allocated')
          }
          const next = open[(round * 7) % Math.max(open.length, 1)]
          if (next === undefined) break
          save = take(save, next.node.id)
        }
        expect(() => assertSaveData(save)).not.toThrow()
      }
    }
  })

  it('closes the other keystones and says so in the confirmation', () => {
    const web = classWebs.warrior
    const cluster = web.nodes.filter((node) => node.cluster === web.nodes[0]?.cluster)
    let save = heroSave()
    for (const node of cluster.slice(0, 4)) save = take(save, node.id)
    const keystone = cluster[4]
    const others = web.nodes.filter((node) => node.keystone && node.id !== keystone?.id)
    if (keystone === undefined) throw new Error('no keystone')
    const before = nodeViews(selectedHero(save)!).find((view) => view.node.id === keystone.id)!
    expect(before.preview.canTake).toBe(true)
    expect(before.preview.blockedKeystoneIds.sort()).toEqual(others.map((node) => node.id).sort())
    const text = confirmationText(before, selectedHero(save)!)
    expect(text).toContain(keystone.name)
    expect(text).toMatch(/Only one keystone can be active during a life/)
    for (const node of others) expect(text).toContain(node.name)
    save = take(save, keystone.id)
    const after = nodeViews(selectedHero(save)!)
    for (const node of others) {
      const view = after.find((entry) => entry.node.id === node.id)!
      expect(view.preview.canTake).toBe(false)
      expect(view.preview.reasons).toContain('another keystone is allocated')
      expect(takeNode(save, 'hero-1', node.id).ok).toBe(false)
    }
  })

  it('confirmation for a plain node is short and mentions the skill it unlocks', () => {
    const save = heroSave('ranger')
    const views = nodeViews(selectedHero(save)!)
    const unlock = views.find((view) => view.preview.unlocksSkillId !== null && view.preview.canTake)
    if (unlock === undefined) throw new Error('no unlock node ready')
    const text = confirmationText(unlock, selectedHero(save)!)
    expect(text).toContain('no respec')
    expect(text).toContain(String(unlock.preview.unlocksSkillId))
    expect(text).not.toContain('keystone')
  })

  it('takes racial nodes in order and refuses skipping or another race', () => {
    let save = heroSave('mage', 'elf')
    const [first, second] = racialWebs.elf.nodes
    if (first === undefined || second === undefined) throw new Error('no racial nodes')
    expect(takeNode(save, 'hero-1', second.id).ok).toBe(false)
    save = take(save, first.id)
    save = take(save, second.id)
    expect(progressOf(save).allocatedNodeIds).toEqual([first.id, second.id])
    const views = nodeViews(selectedHero(save)!)
    expect(views.filter((view) => view.kind === 'racial')).toHaveLength(4)
    expect(views.filter((view) => view.kind === 'class')).toHaveLength(15)
    const other = racialWebs.human.nodes[0]!
    expect(takeNode(save, 'hero-1', other.id).ok).toBe(false)
  })

  it('runs out of points and keeps the save unchanged on a refusal', () => {
    let save = heroSave()
    save = { ...save, heroes: save.heroes.map((hero) => ({ ...hero, progress: { ...hero.progress, unspentSkillPoints: 0 } })) }
    const first = classWebs.warrior.nodes[0]!
    const result = takeNode(save, 'hero-1', first.id)
    expect(result).toEqual({ ok: false, reason: expect.stringMatching(/not enough skill points/) })
    expect(takeNode(save, 'nobody', first.id)).toEqual({ ok: false, reason: 'That hero is not on the roster.' })
    expect(progressOf(save).allocatedNodeIds).toEqual([])
  })
})

describe('attribute allocation', () => {
  it('spends a plan in one step', () => {
    const save = heroSave()
    const before = progressOf(save)
    const result = spendAttributes(save, 'hero-1', { strength: 2, spirit: 3 })
    if (!result.ok) throw new Error(result.reason)
    const after = progressOf(result.save)
    expect(after.attributes.strength).toBe(before.attributes.strength + 2)
    expect(after.attributes.spirit).toBe(before.attributes.spirit + 3)
    expect(after.attributes.vitality).toBe(before.attributes.vitality)
    expect(after.unspentAttributePoints).toBe(before.unspentAttributePoints - 5)
    expect(() => assertSaveData(result.save)).not.toThrow()
  })

  it('refuses an overspend, an empty plan, and a fraction, and changes nothing', () => {
    const save = heroSave()
    const unspent = progressOf(save).unspentAttributePoints
    const over = spendAttributes(save, 'hero-1', { strength: unspent, agility: 1 })
    expect(over).toEqual({ ok: false, reason: expect.stringMatching(/exceeds unspent attribute points/) })
    expect(spendAttributes(save, 'hero-1', {})).toEqual({
      ok: false,
      reason: 'Choose at least one attribute point to spend.',
    })
    expect(spendAttributes(save, 'hero-1', { strength: 1.5 }).ok).toBe(false)
    expect(spendAttributes(save, 'hero-1', { strength: -1 }).ok).toBe(false)
    expect(spendAttributes(save, 'nobody', { strength: 1 }).ok).toBe(false)
    expect(progressOf(save).unspentAttributePoints).toBe(unspent)
    expect(ATTRIBUTE_KEYS).toHaveLength(5)
  })
})
