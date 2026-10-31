import { describe, expect, it } from 'vitest'

import { HERO_CLASSES, type HeroClass } from '../sim/constants.ts'
import {
  allocateNode,
  createProgress,
  grantLegacySkillPoint,
  previewAllocation,
  type SkillNode,
} from '../sim/progression.ts'

import { skills } from './skills.ts'
import { classWebs } from './webs/index.ts'

const human = { strength: 10, vitality: 10, agility: 10, intellect: 10, spirit: 10 }

const clusters: { [id in HeroClass]: readonly string[] } = {
  warrior: ['Fury', 'Arms', 'Bulwark'],
  assassin: ['Shadow', 'Venom', 'Execution'],
  ranger: ['Marksmanship', 'Traps', 'Pathfinder'],
  mage: ['Elemental', 'Arcane', 'Prepared'],
  cleric: ['Devotion', 'Sanctuary', 'Judgment'],
}

const names: { [id in HeroClass]: readonly (readonly [string, string, string, string, string])[] } = {
  warrior: [
    ['Driving Blow', 'Rising Heat', 'Cleave', 'Bloodletting', 'Berserker'],
    ['Sundering Blow', 'Weapon Discipline', 'Reckless Strike', 'Heavy Follow-Through', 'Weapon Master'],
    ['Shield Brace', 'Second Wind', 'Defiance', 'Shield Impact', 'Unbroken'],
  ],
  assassin: [
    ['Shadow Cut', 'Smoke Step', 'Elusive Footwork', 'Ambush', 'Ghost'],
    ['Venom Edge', 'Potent Toxins', 'Fan of Knives', 'Toxic Opportunity', 'Toxic Sovereign'],
    ['Mark for Death', 'Exploit Weakness', 'Execute', 'Relentless', 'Death Sentence'],
  ],
  ranger: [
    ['Aimed Shot', 'Steady Hands', 'Piercing Arrow', 'Patient Shot', 'Deadeye'],
    ['Snare Trap', 'Reinforced Snare', 'Flame Arrow', 'Efficient Quiver', 'Trapper'],
    ["Hunter's Mark", 'Trail Sense', 'Volley', 'Press the Trail', 'Trailblazer'],
  ],
  mage: [
    ['Fireball', 'Frost Lance', 'Chain Lightning', 'Elemental Affinity', 'Elemental Convergence'],
    ['Arcane Bolt', 'Mana Ward', 'Arcane Recovery', 'Efficient Channeling', 'Overcast'],
    ['Spell Memory', 'Quick Study', 'Defensive Preparation', 'Rehearsed Casting', 'Grand Grimoire'],
  ],
  cleric: [
    ['Smite', 'Vowkeeper', 'Penance', 'Steadfast Spirit', 'Exalted Vow'],
    ['Mend', 'Ward', 'Consecration', 'Safeguard', 'Living Sanctuary'],
    ['Judgment', 'Righteous Force', 'Reciprocal Purpose', 'Final Mercy', 'Sacred Balance'],
  ],
}

const starting: { [id in HeroClass]: readonly [string, string, string, string] } = {
  warrior: ['driving-blow', 'sundering-blow', 'shield-brace', 'second-wind'],
  assassin: ['mark-for-death', 'shadow-cut', 'venom-edge', 'execute'],
  ranger: ['aimed-shot', 'piercing-arrow', 'volley', 'snare-trap'],
  mage: ['fireball', 'frost-lance', 'mana-ward', 'arcane-recovery'],
  cleric: ['smite', 'mend', 'ward', 'judgment'],
}

const unlocks: { [id: string]: string } = {
  'warrior-cleave': 'cleave',
  'warrior-sundering-blow': 'sundering-blow',
  'warrior-reckless-strike': 'reckless-strike',
  'warrior-shield-brace': 'shield-brace',
  'warrior-second-wind': 'second-wind',
  'assassin-smoke-step': 'smoke-step',
  'assassin-venom-edge': 'venom-edge',
  'assassin-fan-of-knives': 'fan-of-knives',
  'assassin-mark-for-death': 'mark-for-death',
  'assassin-execute': 'execute',
  'ranger-piercing-arrow': 'piercing-arrow',
  'ranger-snare-trap': 'snare-trap',
  'ranger-flame-arrow': 'flame-arrow',
  'ranger-volley': 'volley',
  'ranger-hunters-mark': 'hunters-mark',
  'mage-fireball': 'fireball',
  'mage-frost-lance': 'frost-lance',
  'mage-chain-lightning': 'chain-lightning',
  'mage-mana-ward': 'mana-ward',
  'cleric-penance': 'penance',
  'cleric-ward': 'ward',
  'cleric-consecration': 'consecration',
  'cleric-judgment': 'judgment',
}

function nodeId(classId: HeroClass, name: string): string {
  const lowered = name.toLowerCase().replaceAll("'", '').replaceAll('’', '')
  const dashed = lowered.replaceAll(/[^a-z0-9]+/g, '-')
  let start = 0
  let end = dashed.length
  while (start < end && dashed[start] === '-') start += 1
  while (end > start && dashed[end - 1] === '-') end -= 1
  return `${classId}-${dashed.slice(start, end)}`
}

describe('class skill webs', () => {
  it('locks fifteen nodes, three clusters, and the four starting skills', () => {
    const summary = HERO_CLASSES.map((classId) => ({
      classId,
      nodes: classWebs[classId].nodes.length,
      starting: classWebs[classId].startingSkillIds,
    }))
    console.log('[sim]', 'class webs', summary)
    const seenIds: { [id: string]: boolean } = {}
    for (const classId of HERO_CLASSES) {
      const web = classWebs[classId]
      const expectedNames = names[classId]
      expect(web.classId).toBe(classId)
      expect(web.nodes).toHaveLength(15)
      expect(web.startingSkillIds).toEqual(starting[classId])
      expect([...web.startingSkillIds]).not.toContain('arcane-bolt')
      const foundClusters: string[] = []
      for (const node of web.nodes) {
        if (!foundClusters.includes(node.cluster)) foundClusters.push(node.cluster)
        expect(seenIds[node.id], node.id).not.toBe(true)
        seenIds[node.id] = true
        expect(node.cost).toBe(1)
        expect(node.id.startsWith(`${classId}-`)).toBe(true)
        expect(node.unlocksSkillId).toBe(unlocks[node.id] ?? null)
        if (node.unlocksSkillId !== null) expect(skills[node.unlocksSkillId]).toBeDefined()
      }
      expect(foundClusters).toEqual(clusters[classId])
      expect(web.nodes.filter((node) => node.keystone)).toHaveLength(3)
      for (const skillId of web.startingSkillIds) expect(skills[skillId]).toBeDefined()
      for (let clusterIndex = 0; clusterIndex < foundClusters.length; clusterIndex += 1) {
        const cluster = foundClusters[clusterIndex]
        const expected = expectedNames[clusterIndex]
        if (cluster === undefined || expected === undefined) throw new Error(`missing ${classId} cluster`)
        const group = web.nodes.filter((node) => node.cluster === cluster)
        expect(group.map((node) => node.index)).toEqual([1, 2, 3, 4, 5])
        expect(group.map((node) => node.name)).toEqual([...expected])
        for (let index = 0; index < group.length; index += 1) {
          const node: SkillNode | undefined = group[index]
          const name = expected[index]
          if (node === undefined || name === undefined) throw new Error(`missing ${classId} ${cluster} node`)
          expect(node.id).toBe(nodeId(classId, name))
          expect(node.requires).toBe(index === 0 ? null : (group[index - 1]?.id ?? null))
          expect(node.keystone).toBe(index === 4)
        }
      }
    }
    const quick = classWebs.mage.nodes.find((node) => node.id === 'mage-quick-study')
    expect(quick).toMatchObject({ name: 'Quick Study', cluster: 'Prepared', index: 2, unlocksSkillId: null })
    const bolt = classWebs.mage.nodes.find((node) => node.id === 'mage-arcane-bolt')
    expect(bolt).toMatchObject({ unlocksSkillId: null, index: 1 })
  })

  it('allocates a warrior fury path and blocks the other keystones', () => {
    let progress = createProgress('human', human)
    for (let count = 0; count < 6; count += 1) progress = grantLegacySkillPoint(progress)
    const fury = classWebs.warrior.nodes.filter((node) => node.cluster === 'Fury')
    expect(fury.map((node) => node.id)).toEqual([
      'warrior-driving-blow',
      'warrior-rising-heat',
      'warrior-cleave',
      'warrior-bloodletting',
      'warrior-berserker',
    ])
    const beforeChain = progress
    expect(() => allocateNode(beforeChain, classWebs.warrior, 'warrior-rising-heat')).toThrow(/requires/)
    expect(beforeChain.allocatedNodeIds).toEqual([])
    for (const node of fury) progress = allocateNode(progress, classWebs.warrior, node.id)
    const preview = previewAllocation(progress, classWebs.warrior, 'warrior-weapon-master')
    console.log('[sim]', 'warrior weapon master preview', preview)
    expect(progress.allocatedNodeIds).toEqual(fury.map((node) => node.id))
    expect(progress.unspentSkillPoints).toBe(0)
    expect(progress.legacySkillPoints).toBe(1)
    expect(progress.learnedSkillIds).toEqual(['cleave'])
    expect(preview).toEqual({
      cost: 1,
      canTake: false,
      missingRequirementId: 'warrior-heavy-follow-through',
      unlocksSkillId: null,
      blockedKeystoneIds: ['warrior-berserker', 'warrior-unbroken'],
      reasons: ['missing requirement', 'another keystone is allocated'],
    })
    expect(() => allocateNode(progress, classWebs.warrior, 'warrior-weapon-master')).toThrow(/requires/)
  })
})
