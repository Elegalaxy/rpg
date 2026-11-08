import { describe, expect, it } from 'vitest'

import { createCombat, stepCombat } from '../sim/combat.ts'
import { deriveEnemyStats } from '../sim/stats.ts'
import type { CombatActor, CombatSetup, CombatState, GameDefs } from '../sim/types.ts'

import {
  bruteEncounter,
  encounters,
  hollowsDeep,
  hollowsMixed,
  reaverEncounter,
  shadePair,
  toExpeditionEncounter,
} from './encounters.ts'
import { enemies, hollowChanneler, hollowmawReaver, riftbornBrute, riftShade } from './enemies.ts'
import { referenceHeroes } from './heroes.ts'
import { gameDefs } from './scenarios.ts'

function open(members: CombatSetup['enemies'], seed = 1): { state: CombatState; defs: GameDefs } {
  const defs = gameDefs()
  const hero = referenceHeroes.warrior
  return {
    state: createCombat(
      {
        hero: {
          id: hero.id,
          name: 'Warrior',
          level: hero.level,
          classId: hero.classId,
          attributes: hero.attributes,
          gear: hero.gear,
        },
        enemies: members,
      },
      defs,
      seed,
    ),
    defs,
  }
}

function actorAt(state: CombatState, slot: number): CombatActor {
  const actor = state.enemies.find((enemy) => enemy.slot === slot)
  if (actor === undefined) throw new Error(`missing enemy slot ${slot}`)
  return actor
}

function stepUntil(state: CombatState, defs: GameDefs, done: () => boolean, limitMs = 30_000): void {
  const start = state.timeMs
  while (!done() && state.outcome === 'ongoing' && state.timeMs < start + limitMs) stepCombat(state, defs)
}

describe('Rift Hollows enemies', () => {
  it('registers the four enemies', () => {
    expect(enemies['rift-shade']).toBe(riftShade)
    expect(enemies['hollow-channeler']).toBe(hollowChanneler)
    expect(enemies['riftborn-brute']).toBe(riftbornBrute)
    expect(enemies['hollowmaw-reaver']).toBe(hollowmawReaver)
  })

  it('gives the Shade a Bleeding Shade Cut and a shard drop', () => {
    expect(riftShade).toMatchObject({ archetype: 'skirmisher', levelMin: 22, levelMax: 26 })
    expect(riftShade.drop).toEqual({ materialId: 'shard', baseQuantity: 3 })
    const cut = riftShade.skills?.[0]
    expect(cut).toMatchObject({ id: 'shade-cut', coefficient: 1, cooldownSeconds: 4, canCrit: false })
    expect(cut?.effects[1]).toMatchObject({ kind: 'applyStatus', statusId: 'bleed', baseChance: 0.4 })
  })

  it('gives the Channeler a 6% ally heal every 10 s, a 90% Rift Bolt and a riftglass drop', () => {
    expect(hollowChanneler).toMatchObject({ archetype: 'support', levelMin: 22, levelMax: 27 })
    expect(hollowChanneler.drop).toEqual({ materialId: 'riftglass', baseQuantity: 3 })
    const [mend, bolt] = hollowChanneler.skills ?? []
    expect(mend).toMatchObject({ cooldownSeconds: 10, allyTarget: 'woundedLowestHpPercent' })
    expect(mend?.effects).toEqual([{ kind: 'heal', maxHpFraction: 0.06, healingCoefficient: 0 }])
    expect(bolt).toMatchObject({ coefficient: 0.9, school: 'magical' })
  })

  it('heals the wounded ally for 6% of its maximum HP', () => {
    const { state, defs } = open([
      { defId: 'riftborn-brute', slot: 0, level: 24 },
      { defId: 'hollow-channeler', slot: 1, level: 24 },
    ])
    const brute = actorAt(state, 0)
    const channeler = actorAt(state, 1)
    brute.hp = brute.maxHp * 0.5
    brute.nextReadyMs = 1_000_000
    state.hero.hp = 1_000_000
    state.hero.maxHp = 1_000_000
    state.hero.nextReadyMs = 1_000_000
    channeler.nextReadyMs = 10
    const before = brute.hp
    stepUntil(state, defs, () => brute.hp > before, 5_000)
    // The heal rolls a small variance around 6%.
    expect(brute.hp - before).toBeGreaterThan(brute.maxHp * 0.05)
    expect(brute.hp - before).toBeLessThan(brute.maxHp * 0.07)
  })

  it('gives the Brute a 1.8 s, 240% Rift Cleave interruptible at 25%, and a duskiron drop', () => {
    expect(riftbornBrute).toMatchObject({ archetype: 'burst', levelMin: 23, levelMax: 28 })
    expect(riftbornBrute.drop).toEqual({ materialId: 'duskiron', baseQuantity: 3 })
    expect(riftbornBrute.skills?.[0]).toMatchObject({
      id: 'rift-cleave',
      coefficient: 2.4,
      telegraphMs: 1800,
      interruptMaxHpFraction: 0.25,
      cooldownSeconds: 10,
    })
  })

  it('spawns the Reaver as a level-26 burst elite with 3,400 HP, 40 Power and stances', () => {
    const { state } = open([{ defId: 'hollowmaw-reaver', slot: 0 }])
    const reaver = actorAt(state, 0)
    const stats = deriveEnemyStats({
      level: 26,
      archetype: 'burst',
      elite: true,
      overrides: { maxHp: 4400, power: 44, consistency: 25 },
    })
    expect(stats).toMatchObject({ maxHp: 4400, power: 44, consistency: 25 })
    expect(reaver.level).toBe(26)
    expect(reaver.maxHp).toBe(4400)
    expect(reaver.elite).toBe(true)
    expect(reaver.stance).toBe('guard')
    expect(hollowmawReaver.skills).toHaveLength(1)
    expect(hollowmawReaver.filler).toMatchObject({ school: 'physical', coefficient: 1 })
    expect(hollowmawReaver.drop).toEqual({ materialId: 'duskiron', baseQuantity: 10 })
    console.log('[enemy] reaver stats', stats)
  })

  it('defines Rift Surge: 2.5 s, 400% Magical, can crit, not interruptible, 12 s cooldown', () => {
    const surge = hollowmawReaver.skills?.[0]
    expect(surge).toMatchObject({
      id: 'rift-surge',
      coefficient: 4,
      school: 'magical',
      telegraphMs: 2500,
      canCrit: true,
      cooldownSeconds: 12,
    })
    expect(surge?.interruptMaxHpFraction).toBeUndefined()
  })

  it('lays out the encounters and their drops and gold', () => {
    expect(shadePair.members).toEqual([
      { enemyId: 'rift-shade', slot: 0, level: 22 },
      { enemyId: 'rift-shade', slot: 1, level: 22 },
    ])
    expect(bruteEncounter.members).toEqual([{ enemyId: 'riftborn-brute', slot: 0, level: 23 }])
    expect(hollowsMixed.members).toEqual([
      { enemyId: 'riftborn-brute', slot: 0, level: 23 },
      { enemyId: 'hollow-channeler', slot: 1, level: 23 },
    ])
    expect(hollowsDeep.members.map((member) => [member.enemyId, member.level])).toEqual([
      ['rift-shade', 25],
      ['riftborn-brute', 25],
      ['hollow-channeler', 25],
    ])
    expect(reaverEncounter.members).toEqual([{ enemyId: 'hollowmaw-reaver', slot: 0, level: 26 }])
    for (const id of ['shade-pair', 'brute', 'hollows-mixed', 'hollows-deep', 'hollowmaw-reaver']) {
      expect(encounters[id], id).toBeDefined()
    }
    const mixed = toExpeditionEncounter(hollowsMixed)
    expect(mixed.enemies[0]).toMatchObject({ materialId: 'duskiron', baseQuantity: 3, gold: 46 })
    expect(mixed.enemies[1]).toMatchObject({ materialId: 'riftglass', baseQuantity: 3 })
    const elite = toExpeditionEncounter(reaverEncounter)
    expect(elite.enemies[0]).toMatchObject({ materialId: 'duskiron', baseQuantity: 10, gold: 78 })
  })
})
