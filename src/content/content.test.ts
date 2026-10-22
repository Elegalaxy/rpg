import { describe, expect, it } from 'vitest'

import { assertSkillDef, SKILL_EFFECT_KINDS } from '../sim/skills.ts'
import type { SkillDef } from '../sim/types.ts'

import { enemies } from './enemies.ts'
import { referenceHeroes } from './heroes.ts'
import { scenarios } from './scenarios.ts'
import { skills } from './skills.ts'

function unique(ids: readonly string[], label: string): void {
  const seen: { [id: string]: boolean } = {}
  for (const id of ids) {
    if (seen[id] === true) throw new Error(`duplicate ${label} id '${id}'`)
    seen[id] = true
  }
}

describe('content integrity', () => {
  it('keeps unique ids and resolves every reference', () => {
    const skillIds = Object.keys(skills)
    const enemyIds = Object.keys(enemies)
    const scenarioIds = Object.keys(scenarios)
    console.log('[skills] content ids', { skills: skillIds, enemies: enemyIds, scenarios: scenarioIds })
    unique(skillIds, 'skill')
    unique(enemyIds, 'enemy')
    unique(scenarioIds, 'scenario')

    for (const id of skillIds) {
      const skill = skills[id]
      expect(skill).toBeDefined()
      if (skill === undefined) continue
      assertSkillDef(skill)
      expect(skill.id).toBe(id)
      for (const effect of skill.effects) {
        expect(SKILL_EFFECT_KINDS).toContain(effect.kind)
      }
    }

    const heroIds = Object.values(referenceHeroes).map((hero) => hero.id)
    for (const scenario of Object.values(scenarios)) {
      expect(heroIds).toContain(scenario.heroId)
      for (const enemy of scenario.enemies) {
        expect(enemies[enemy.defId], `${scenario.id} enemy ${enemy.defId}`).toBeDefined()
      }
      for (const skillId of scenario.equippedSkillIds ?? []) {
        expect(skills[skillId], `${scenario.id} equipped ${skillId}`).toBeDefined()
      }
      for (const row of scenario.priorityRows ?? []) {
        expect(skills[row.skillId], `${scenario.id} row ${row.skillId}`).toBeDefined()
      }
    }
  })

  it('rejects an unknown effect kind instead of ignoring it', () => {
    const bad = {
      id: 'bad-skill',
      name: 'Bad Skill',
      cost: 0,
      cooldownSeconds: 0,
      actionTimeCoefficient: 1,
      tags: ['test'],
      target: 'single',
      effects: [{ kind: 'poison', stacks: 1 }],
    } as unknown as SkillDef
    console.log('[skills] unknown effect input', bad.effects)
    expect(() => assertSkillDef(bad)).toThrow(/unknown effect kind 'poison'/)
  })
})
