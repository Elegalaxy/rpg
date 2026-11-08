import { describe, expect, it } from 'vitest'

import { heroSkill } from '../sim/classes/starterNodes.ts'
import type { CombatHero, SkillDef } from '../sim/types.ts'

import { skills } from './skills.ts'

function hero(...nodes: string[]): CombatHero {
  return { allocatedNodeIds: nodes } as unknown as CombatHero
}

function skill(id: string): SkillDef {
  const found = skills[id]
  if (found === undefined) throw new Error(`missing skill ${id}`)
  return found
}

function firstEffect(def: SkillDef, kind: string) {
  const found = def.effects.find((effect) => effect.kind === kind)
  if (found === undefined) throw new Error(`${def.id} has no ${kind} effect`)
  return found
}

describe('starting-skill node bonuses', () => {
  const cases: {
    node: string
    skillId: string
    check: (def: SkillDef) => unknown
    plain: unknown
    noded: unknown
  }[] = [
    { node: 'warrior-sundering-blow', skillId: 'sundering-blow', check: (d) => d.cooldownSeconds, plain: 6, noded: 5 },
    { node: 'warrior-second-wind', skillId: 'second-wind', check: (d) => d.cooldownSeconds, plain: 15, noded: 12 },
    {
      node: 'assassin-venom-edge',
      skillId: 'venom-edge',
      check: (d) => (firstEffect(d, 'applyStatus') as { coefficient: number }).coefficient,
      plain: 0.12,
      noded: 0.15,
    },
    { node: 'ranger-piercing-arrow', skillId: 'piercing-arrow', check: (d) => d.cost, plain: 20, noded: 15 },
    { node: 'ranger-snare-trap', skillId: 'snare-trap', check: (d) => d.cooldownSeconds, plain: 8, noded: 6 },
    { node: 'mage-fireball', skillId: 'fireball', check: (d) => d.cost, plain: 30, noded: 25 },
    {
      node: 'mage-frost-lance',
      skillId: 'frost-lance',
      check: (d) => (firstEffect(d, 'damage') as { coefficient: number }).coefficient,
      plain: 1.1,
      noded: 1.3,
    },
    {
      node: 'mage-mana-ward',
      skillId: 'mana-ward',
      check: (d) => (firstEffect(d, 'barrier') as { coefficient: number }).coefficient,
      plain: 0.65,
      noded: 0.85,
    },
    {
      node: 'cleric-ward',
      skillId: 'ward',
      check: (d) => (firstEffect(d, 'barrier') as { durationSeconds: number }).durationSeconds,
      plain: 8,
      noded: 10,
    },
    {
      node: 'cleric-judgment',
      skillId: 'judgment',
      check: (d) => (firstEffect(d, 'damage') as { coefficient: number }).coefficient,
      plain: 2.5,
      noded: 2.8,
    },
  ]

  for (const entry of cases) {
    it(`${entry.node} improves ${entry.skillId} only when allocated`, () => {
      const base = skill(entry.skillId)
      expect(entry.check(base)).toBe(entry.plain)
      expect(heroSkill(hero(), base)).toBe(base)
      expect(heroSkill(hero('some-other-node'), base)).toBe(base)
      const improved = heroSkill(hero(entry.node), base)
      expect(entry.check(improved)).toBe(entry.noded)
      expect(heroSkill(hero(entry.node), base)).toBe(improved)
      expect(entry.check(base)).toBe(entry.plain)
    })
  }

  it('leaves every other skill alone', () => {
    const base = skill('driving-blow')
    expect(heroSkill(hero('warrior-sundering-blow', 'mage-fireball'), base)).toBe(base)
  })
})
