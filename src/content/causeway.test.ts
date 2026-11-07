import { describe, expect, it } from 'vitest'

import { createCombat, stepCombat } from '../sim/combat.ts'
import { enemySpawnLevel, onEnemyHpChanged } from '../sim/enemyAi.ts'
import { deriveEnemyStats } from '../sim/stats.ts'
import type { CombatActor, CombatSetup, CombatState, GameDefs } from '../sim/types.ts'

import {
  causewayDeep,
  causewayMixed,
  colossusEncounter,
  encounters,
  leechSwarm,
  raiderEncounter,
  toExpeditionEncounter,
} from './encounters.ts'
import {
  causewayRaider,
  drownedBulwark,
  enemies,
  fractureWisp,
  mireLeech,
  oathboundEcho,
  tideboundColossus,
} from './enemies.ts'
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

describe('Drowned Causeway enemies', () => {
  it('registers the new enemies and widens the Wisp and Echo bands', () => {
    expect(enemies['mire-leech']).toBe(mireLeech)
    expect(enemies['causeway-raider']).toBe(causewayRaider)
    expect(enemies['drowned-bulwark']).toBe(drownedBulwark)
    expect(enemies['tidebound-colossus']).toBe(tideboundColossus)
    expect([fractureWisp.levelMin, fractureWisp.levelMax]).toEqual([10, 22])
    expect([oathboundEcho.levelMin, oathboundEcho.levelMax]).toEqual([13, 22])
    expect(fractureWisp.drop).toBeUndefined()
    expect(oathboundEcho.drop).toBeUndefined()
    expect(enemySpawnLevel(fractureWisp, 18)).toBe(18)
    expect(enemySpawnLevel(oathboundEcho, 20)).toBe(20)
  })

  it('derives the Standard line for the Raider at level 18', () => {
    const stats = deriveEnemyStats({ level: 18, archetype: 'standard' })
    expect(stats).toMatchObject({ maxHp: 440, power: 26 })
    expect(causewayRaider).toMatchObject({ archetype: 'standard', levelMin: 17, levelMax: 21 })
    expect(causewayRaider.drop).toEqual({ materialId: 'scrap', baseQuantity: 4 })
  })

  it('gives the Raider Pilfer (90%, 35% steal) then Guard', () => {
    expect(causewayRaider.skills?.map((skill) => skill.id)).toEqual(['pilfer', 'guard'])
    const pilfer = causewayRaider.skills?.[0]
    expect(pilfer?.coefficient).toBe(0.9)
    expect(pilfer?.effects).toEqual([
      { kind: 'damage', school: 'physical', coefficient: 0.9 },
      { kind: 'stealSupply', chance: 0.35 },
    ])
    expect(causewayRaider.skills?.[1]).toMatchObject({ cooldownSeconds: 7, actionTimeCoefficient: 0.75 })
  })

  it('makes the Leech a Swarm with a 3-group, Bleed bite and hide drop', () => {
    expect(mireLeech).toMatchObject({ archetype: 'swarm', levelMin: 17, levelMax: 20, regenMultiplier: 2 })
    expect(mireLeech.drop).toEqual({ materialId: 'hide', baseQuantity: 2 })
    const bite = mireLeech.skills?.[0]
    expect(bite).toMatchObject({ id: 'leech-bite', coefficient: 0.8 })
    expect(bite?.effects[1]).toMatchObject({ kind: 'applyStatus', statusId: 'bleed', baseChance: 0.5 })
    expect(leechSwarm.members).toHaveLength(3)
    expect(leechSwarm.members.every((member) => member.enemyId === 'mire-leech' && member.level === 17)).toBe(true)
  })

  it('regenerates the Leech at 2%, pauses for Burn, halves for Expose, and leaves the Thornbeast at 1%', () => {
    const { state, defs } = open([
      { defId: 'mire-leech', slot: 0, level: 18 },
      { defId: 'thornbeast', slot: 1, level: 10 },
    ])
    const leech = actorAt(state, 0)
    const beast = actorAt(state, 1)
    leech.hp = leech.maxHp - 100
    beast.hp = beast.maxHp - 100
    leech.nextReadyMs = 1_000_000
    beast.nextReadyMs = 1_000_000
    state.hero.nextReadyMs = 1_000_000
    stepUntil(state, defs, () => state.timeMs >= 1000)
    const events = state.log.filter((event) => event.type === 'regen')
    const leechEvent = events.find((event) => event.type === 'regen' && event.actorId === leech.id)
    const beastEvent = events.find((event) => event.type === 'regen' && event.actorId === beast.id)
    expect(leechEvent).toMatchObject({ fraction: 0.02, amount: Math.round(leech.maxHp * 0.02), paused: false })
    expect(beastEvent).toMatchObject({ fraction: 0.01, amount: Math.round(beast.maxHp * 0.01) })

    leech.statuses.expose = { name: 'Expose', expiresMs: 60_000, armorMagnitude: 0.2, resistanceMagnitude: 0 }
    stepUntil(state, defs, () => state.timeMs >= 2000)
    const exposed = state.log.filter((event) => event.type === 'regen' && event.actorId === leech.id)
    expect(exposed[1]).toMatchObject({ timeMs: 2000, fraction: 0.01 })

    leech.statuses.burn = {
      name: 'Burn',
      intensity: 1,
      expiresMs: 60_000,
      tickMs: 1000,
      nextTickMs: 60_000,
      power: 1,
      penetration: 0,
      coefficient: 0.1,
      attackerLevel: 1,
      sourceId: 'test',
      sourceName: 'Test',
    }
    stepUntil(state, defs, () => state.timeMs >= 3000)
    const paused = state.log.filter((event) => event.type === 'regen' && event.actorId === leech.id)
    expect(paused[2]).toMatchObject({ timeMs: 3000, fraction: 0, paused: true, amount: 0 })
  })

  it('gives the Bulwark 1.75x Armor, Shield Wall, and an interruptible Undertow with 2 Chill', () => {
    const tank = deriveEnemyStats({ level: 18, archetype: 'tank', overrides: drownedBulwark.overrides })
    const plain = deriveEnemyStats({ level: 18, archetype: 'tank' })
    expect(tank.armor).toBeGreaterThan(plain.armor)
    expect(tank.resistance).toBeLessThan(tank.armor)
    expect(drownedBulwark.skills?.map((skill) => skill.id)).toEqual(['shield-wall', 'undertow'])
    const undertow = drownedBulwark.skills?.[1]
    expect(undertow).toMatchObject({
      coefficient: 2,
      telegraphMs: 2200,
      interruptMaxHpFraction: 0.25,
      canCrit: false,
    })
    expect(undertow?.effects.filter((effect) => effect.kind === 'applyStatus' && effect.statusId === 'chill')).toHaveLength(2)
    expect(drownedBulwark.drop).toEqual({ materialId: 'riftglass', baseQuantity: 4 })
  })

  it('spawns the Colossus as a level-22 elite tank in Ebb (Guard) with 3,600 HP and 35 Power', () => {
    const { state } = open([{ defId: 'tidebound-colossus', slot: 0 }])
    const colossus = actorAt(state, 0)
    const stats = deriveEnemyStats({
      level: 22,
      archetype: 'tank',
      elite: true,
      overrides: { maxHp: 3600, power: 35, consistency: 25 },
    })
    expect(stats).toMatchObject({ maxHp: 3600, power: 35, consistency: 25 })
    expect(colossus.level).toBe(22)
    expect(colossus.maxHp).toBe(3600)
    expect(colossus.elite).toBe(true)
    expect(colossus.stance).toBe('guard')
    expect(colossus.armor).toBeCloseTo(stats.armor * 1.3, 8)
    expect(colossus.power).toBeCloseTo(35, 8)
    console.log('[enemy] colossus stats', stats)
  })

  it('switches to Flood (Assault) at 10 seconds: +25% Power, -40% Armor and Resistance', () => {
    const { state, defs } = open([{ defId: 'tidebound-colossus', slot: 0 }])
    const colossus = actorAt(state, 0)
    state.hero.hp = 1_000_000
    state.hero.maxHp = 1_000_000
    state.hero.nextReadyMs = 1_000_000
    colossus.nextReadyMs = 1_000_000
    const baseArmor = colossus.stanceBaseArmor
    const basePower = colossus.stanceBasePower
    stepUntil(state, defs, () => state.timeMs >= 10_000)
    expect(colossus.stance).toBe('assault')
    expect(colossus.power).toBeCloseTo(basePower * 1.25, 8)
    expect(colossus.armor).toBeCloseTo(baseArmor * 0.6, 8)
    expect(colossus.resistance).toBeCloseTo(baseArmor * 0.6, 8)
  })

  it('defines Breaker Wave: 2.5 s, 230%, can crit, interrupt at 8%, 10 s cooldown', () => {
    expect(tideboundColossus.skills?.[0]).toMatchObject({
      id: 'breaker-wave',
      coefficient: 2.3,
      telegraphMs: 2500,
      canCrit: true,
      interruptMaxHpFraction: 0.08,
      cooldownSeconds: 10,
    })
    expect(tideboundColossus.drop).toEqual({ materialId: 'riftglass', baseQuantity: 10 })
  })

  it('summons two XP-less Mire Leeches at 35% HP', () => {
    const { state, defs } = open([{ defId: 'tidebound-colossus', slot: 0 }])
    const colossus = actorAt(state, 0)
    colossus.cooldowns['breaker-wave'] = 1_000_000
    colossus.nextReadyMs = 10
    state.hero.hp = 1_000_000
    state.hero.maxHp = 1_000_000
    state.hero.nextReadyMs = 1_000_000
    colossus.hp = colossus.maxHp * 0.35
    onEnemyHpChanged(state, colossus, state.timeMs)
    stepUntil(state, defs, () => state.enemies.filter((enemy) => enemy.defId === 'mire-leech').length >= 2, 10_000)
    const leeches = state.enemies.filter((enemy) => enemy.defId === 'mire-leech')
    expect(leeches).toHaveLength(2)
    expect(leeches.every((leech) => leech.summon && leech.xp === 0 && leech.level === 18)).toBe(true)
    expect(state.log.filter((event) => event.type === 'summon')).toHaveLength(2)
  })

  it('lays out the encounters and their drops and gold', () => {
    expect(raiderEncounter.members).toEqual([{ enemyId: 'causeway-raider', slot: 0, level: 18 }])
    expect(causewayMixed.members).toEqual([
      { enemyId: 'drowned-bulwark', slot: 0, level: 18 },
      { enemyId: 'fracture-wisp', slot: 1, level: 18 },
    ])
    expect(causewayDeep.members).toEqual([
      { enemyId: 'drowned-bulwark', slot: 0, level: 20 },
      { enemyId: 'causeway-raider', slot: 1, level: 20 },
      { enemyId: 'oathbound-echo', slot: 2, level: 20 },
    ])
    expect(colossusEncounter.members).toEqual([{ enemyId: 'tidebound-colossus', slot: 0, level: 22 }])
    for (const id of ['leech-swarm', 'raider', 'causeway-mixed', 'causeway-deep', 'tidebound-colossus']) {
      expect(encounters[id], id).toBeDefined()
    }
    const mixed = toExpeditionEncounter(causewayMixed)
    expect(mixed.enemies[0]).toMatchObject({ materialId: 'riftglass', baseQuantity: 4, gold: 36 })
    expect(mixed.enemies[1]?.materialId).toBeUndefined()
    const elite = toExpeditionEncounter(colossusEncounter)
    expect(elite.enemies[0]).toMatchObject({ materialId: 'riftglass', baseQuantity: 10, gold: 66 })
  })
})
