import { describe, expect, it } from 'vitest'

import { assertStatusDef } from '../sim/statuses.ts'
import { assertSkillDef, SKILL_EFFECT_KINDS } from '../sim/skills.ts'
import type { SkillDef } from '../sim/types.ts'

import { enemies } from './enemies.ts'
import { referenceHeroes } from './heroes.ts'
import { scenarios } from './scenarios.ts'
import { skills } from './skills.ts'
import { statuses } from './statuses.ts'

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
    const statusIds = Object.keys(statuses)
    console.log('[skills] content ids', {
      skills: skillIds,
      enemies: enemyIds,
      scenarios: scenarioIds,
      statuses: statusIds,
    })
    unique(skillIds, 'skill')
    unique(enemyIds, 'enemy')
    unique(scenarioIds, 'scenario')
    unique(statusIds, 'status')

    expect(statuses.bleed).toMatchObject({ maxStacks: 5, actionsPerStack: 3 })
    expect(statuses.poison).toMatchObject({ maxStacks: 5, durationSeconds: 8, tickSeconds: 2 })
    expect(statuses.burn).toMatchObject({ maxIntensity: 5, durationSeconds: 5, tickSeconds: 1 })
    expect(statuses.chill).toMatchObject({ maxStacks: 3, durationSeconds: 6, slowByStack: [0.1, 0.07, 0.05] })
    expect(statuses.stun).toMatchObject({ delaySeconds: 1.5 })
    expect(statuses.expose).toMatchObject({ durationSeconds: 8 })
    expect(statuses.mark).toMatchObject({ kind: 'mark' })
    for (const status of Object.values(statuses)) assertStatusDef(status)

    for (const id of skillIds) {
      const skill = skills[id]
      expect(skill).toBeDefined()
      if (skill === undefined) continue
      assertSkillDef(skill)
      expect(skill.id).toBe(id)
      for (const effect of skill.effects) {
        expect(SKILL_EFFECT_KINDS).toContain(effect.kind)
        if (effect.kind === 'applyStatus') {
          expect(statuses[effect.statusId], `${id} status ${effect.statusId}`).toBeDefined()
        }
      }
    }
    const venom = skills['venom-edge']
    expect(venom?.effects[1]).toMatchObject({
      kind: 'applyStatus',
      statusId: 'poison',
      baseChance: 1,
      coefficient: 0.12,
      power: 'physical',
    })

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
