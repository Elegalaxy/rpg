import { describe, expect, it } from 'vitest'

import { createCombat, runCombat, stepCombat } from '../sim/combat.ts'
import { formatEvent } from '../sim/log.ts'
import type { CombatSetup, EnemySkillDef, GameDefs, LogEvent } from '../sim/types.ts'

import { gameDefs, scenarios, setupForScenario } from './scenarios.ts'
import { skills } from './skills.ts'

/** A level-3 reference Ranger against the road's two level-6 wolves, whose Pounce is telegraphed. */
function rangerVsWolves(): CombatSetup {
  scenarios['test-ranger-wolves'] = {
    ...scenarios['ref-ranger-wolf']!,
    id: 'test-ranger-wolves',
    heroLevel: 3,
    enemies: [
      { defId: 'starved-wolf', slot: 0, level: 6 },
      { defId: 'starved-wolf', slot: 1, level: 6 },
    ],
  }
  return setupForScenario('test-ranger-wolves')
}

function heroHitBy(log: readonly LogEvent[], sourceId: string, timeMs: number): boolean {
  return log.some((event) => event.type === 'damage' && event.timeMs === timeMs && event.actorId === sourceId)
}

describe('Fade Back', () => {
  it('readies a 3-second skill dodge on a 16-second cooldown', () => {
    const fadeBack = skills['fade-back']!
    expect(fadeBack.cooldownSeconds).toBe(16)
    expect(fadeBack.effects).toEqual([
      { kind: 'evasion', amount: 30 },
      { kind: 'skillDodge', durationSeconds: 3 },
    ])
  })

  it('takes the next enemy skill with no damage and logs the dodge', () => {
    const defs = gameDefs()
    const state = runCombat(createCombat(rangerVsWolves(), defs, 11), defs, 300_000)
    const dodges = state.log.filter((event) => event.type === 'skillDodge')
    expect(dodges.length).toBeGreaterThan(0)
    for (const dodge of dodges) {
      expect(dodge.skillId).toBe('pounce')
      expect(heroHitBy(state.log, dodge.sourceId, dodge.timeMs)).toBe(false)
      expect(formatEvent(dodge)).toContain(`dodges ${dodge.sourceName}'s Pounce: no damage and no statuses.`)
    }
    const uses = state.log.filter((event) => event.type === 'action' && event.skillId === 'fade-back')
    expect(dodges.length).toBeLessThanOrEqual(uses.length)
  })

  it('lets a dodge lapse when no enemy skill comes in time', () => {
    const defs = gameDefs()
    const state = createCombat(rangerVsWolves(), defs, 11)
    state.hero.priorityRows = state.hero.priorityRows.filter((row) => row.skillId !== 'fade-back')
    state.hero.skillDodgeUntilMs = 0
    while (state.outcome === 'ongoing' && !state.log.some((event) => event.type === 'telegraph')) stepCombat(state, defs)
    runCombat(state, defs, 300_000)
    expect(state.log.some((event) => event.type === 'skillDodge')).toBe(false)
    expect(state.hero.skillDodgeUntilMs).toBeNull()
  })
})

/** Defs where the wolf's Pounce also chills and, optionally, lets a share of its damage through a dodge. */
function defsWithPounce(dodgedDamageFraction: number | undefined): GameDefs {
  const defs = gameDefs()
  const wolf = defs.enemies['starved-wolf']!
  const pounce = wolf.skills![0]!
  const custom: EnemySkillDef = {
    ...pounce,
    effects: [...pounce.effects, { kind: 'applyStatus', statusId: 'chill', baseChance: 1 }],
    ...(dodgedDamageFraction === undefined ? {} : { dodgedDamageFraction }),
  }
  return { ...defs, enemies: { ...defs.enemies, 'starved-wolf': { ...wolf, skills: [custom] } } }
}

describe('Fade Back with a dodged-damage share', () => {
  it('lets the share of damage land and still avoids statuses', () => {
    const defs = defsWithPounce(0.5)
    const state = runCombat(createCombat(rangerVsWolves(), defs, 11), defs, 300_000)
    const dodges = state.log.filter((event) => event.type === 'skillDodge')
    expect(dodges.length).toBeGreaterThan(0)
    for (const dodge of dodges) {
      expect(dodge.damageFraction).toBe(0.5)
      const hits = state.log.filter(
        (event) => event.type === 'damage' && event.timeMs === dodge.timeMs && event.actorId === dodge.sourceId,
      )
      expect(hits.length).toBeGreaterThan(0)
      expect(hits.some((event) => event.type === 'damage' && event.hpDamage > 0)).toBe(true)
      const statuses = state.log.filter(
        (event) => event.type === 'statusAttempt' && event.timeMs === dodge.timeMs && event.actorId === dodge.sourceId,
      )
      expect(statuses).toHaveLength(0)
      expect(formatEvent(dodge)).toContain('partly dodges')
    }
  })

  it('deals no damage when the share is omitted', () => {
    const defs = defsWithPounce(undefined)
    const state = runCombat(createCombat(rangerVsWolves(), defs, 11), defs, 300_000)
    const dodges = state.log.filter((event) => event.type === 'skillDodge')
    expect(dodges.length).toBeGreaterThan(0)
    for (const dodge of dodges) {
      expect(dodge.damageFraction).toBeUndefined()
      expect(heroHitBy(state.log, dodge.sourceId, dodge.timeMs)).toBe(false)
    }
  })
})
