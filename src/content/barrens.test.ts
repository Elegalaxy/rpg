import { describe, expect, it } from 'vitest'

import { createCombat, stepCombat } from '../sim/combat.ts'
import { onEnemyHpChanged } from '../sim/enemyAi.ts'
import { xpFromEnemies } from '../sim/progression.ts'
import { deriveEnemyStats } from '../sim/stats.ts'
import type { CombatActor, CombatSetup, CombatState, GameDefs } from '../sim/types.ts'

import {
  barrensDeep,
  barrensMixed,
  crawlerEncounter,
  encounters,
  matriarchEncounter,
  stalkerPair,
  toExpeditionEncounter,
} from './encounters.ts'
import { barbedStalker, briarMatriarch, enemies, thornwitch, venomhideCrawler } from './enemies.ts'
import { referenceHeroAtLevel, referenceHeroes } from './heroes.ts'
import { gameDefs } from './scenarios.ts'

function open(members: CombatSetup['enemies'], statBonuses: NonNullable<CombatSetup['hero']['statBonuses']> = {}, seed = 1): { state: CombatState; defs: GameDefs } {
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
          statBonuses,
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

describe('Bloodthorn Barrens enemies', () => {
  it('registers the four enemies', () => {
    expect(enemies['barbed-stalker']).toBe(barbedStalker)
    expect(enemies['venomhide-crawler']).toBe(venomhideCrawler)
    expect(enemies['thornwitch']).toBe(thornwitch)
    expect(enemies['briar-matriarch']).toBe(briarMatriarch)
  })

  it('gives the Stalker a bleeding Serrated Rake and a cinderite drop', () => {
    expect(barbedStalker).toMatchObject({ archetype: 'skirmisher', levelMin: 34, levelMax: 38 })
    expect(barbedStalker.drop).toEqual({ materialId: 'cinderite', baseQuantity: 2 })
    const rake = barbedStalker.skills?.[0]
    expect(rake).toMatchObject({ id: 'serrated-rake', coefficient: 0.9, school: 'physical', cooldownSeconds: 4 })
    expect(rake?.effects[1]).toMatchObject({ kind: 'applyStatus', statusId: 'bleed', baseChance: 0.6, coefficient: 0.3, power: 'physical' })
  })

  it('gives the Crawler a 2.0 s Caustic Spray that poisons twice and can be interrupted at 25%', () => {
    expect(venomhideCrawler).toMatchObject({ archetype: 'standard', levelMin: 35, levelMax: 40 })
    expect(venomhideCrawler.drop).toEqual({ materialId: 'bloodstone', baseQuantity: 4 })
    const spray = venomhideCrawler.skills?.[0]
    expect(spray).toMatchObject({ id: 'caustic-spray', coefficient: 2, school: 'physical', telegraphMs: 2000, interruptMaxHpFraction: 0.25, cooldownSeconds: 10 })
    const poisons = spray?.effects.filter((effect) => effect.kind === 'applyStatus') ?? []
    expect(poisons).toHaveLength(2)
    expect(poisons[0]).toMatchObject({ statusId: 'poison', baseChance: 1, coefficient: 0.12, power: 'physical' })
  })

  it('gives the Thornwitch a Bramble Ward barrier, a bleeding Thorn Lash and a bloodstone drop', () => {
    expect(thornwitch).toMatchObject({ archetype: 'support', levelMin: 34, levelMax: 39 })
    expect(thornwitch.overrides).toMatchObject({ armorMultiplier: 1.5, resistanceMultiplier: 0.5 })
    expect(thornwitch.drop).toEqual({ materialId: 'bloodstone', baseQuantity: 3 })
    const [ward, lash] = thornwitch.skills ?? []
    expect(ward).toMatchObject({ id: 'bramble-ward', cooldownSeconds: 8, allyTarget: 'lowestBarrier' })
    expect(ward?.effects).toEqual([{ kind: 'barrier', source: 'magical', coefficient: 1, durationSeconds: 8 }])
    expect(lash).toMatchObject({ id: 'thorn-lash', coefficient: 0.9, school: 'physical', cooldownSeconds: 0 })
    expect(lash?.effects[1]).toMatchObject({ statusId: 'bleed', baseChance: 0.5, coefficient: 0.12, power: 'physical' })
  })

  it('follows the Standard framework: 820 HP and 45 Power at level 37', () => {
    const stats = deriveEnemyStats({ level: 37, archetype: 'standard' })
    expect(stats.maxHp).toBe(820)
    expect(stats.power).toBe(45)
  })

  it('spawns the Matriarch as a level-38 standard elite with no stance', () => {
    const { state } = open([{ defId: 'briar-matriarch', slot: 0 }])
    const matriarch = actorAt(state, 0)
    expect(matriarch.level).toBe(38)
    expect(matriarch.elite).toBe(true)
    expect(matriarch.stance).toBeNull()
    expect(briarMatriarch.overrides).toMatchObject({ maxHp: 6800, power: 72, consistency: 25, actionTime: 2.2 })
    expect(matriarch.maxHp).toBe(6800)
    expect(briarMatriarch.timePressure).toMatchObject({ startMs: 90_000, intervalMs: 3000, maxStacks: 10, power: 1.1, defense: 0.95, actionSpeed: 1.05 })
    expect(briarMatriarch.drop).toEqual({ materialId: 'bloodstone', baseQuantity: 10 })
  })

  it('defines Hemorrhage Lash, Venom Burst and the 40% Stalker summon', () => {
    const [lash, burst, summon] = briarMatriarch.skills ?? []
    expect(lash).toMatchObject({ id: 'hemorrhage-lash', coefficient: 1.1, school: 'physical', cooldownSeconds: 6 })
    expect(lash?.effects[1]).toMatchObject({ statusId: 'bleed', baseChance: 0.75, coefficient: 0.1, power: 'physical' })
    expect(burst).toMatchObject({ id: 'venom-burst', coefficient: 2.6, school: 'physical', telegraphMs: 2500, canCrit: true, cooldownSeconds: 10, interruptMaxHpFraction: 0.04 })
    const poisons = burst?.effects.filter((effect) => effect.kind === 'applyStatus') ?? []
    expect(poisons).toHaveLength(5)
    expect(poisons[0]).toMatchObject({ statusId: 'poison', baseChance: 1, coefficient: 0.3, power: 'physical' })
    expect(summon).toMatchObject({ trigger: 'hp', hpFraction: 0.5, telegraphMs: 2000 })
    expect(summon?.effects).toEqual([
      { kind: 'summon', enemyId: 'barbed-stalker', level: 35 },
      { kind: 'summon', enemyId: 'barbed-stalker', level: 35 },
    ])
  })

  it('summons two Barbed Stalkers when the Matriarch falls below the summon line', () => {
    const { state, defs } = open([{ defId: 'briar-matriarch', slot: 0 }])
    const matriarch = actorAt(state, 0)
    state.hero.hp = 1_000_000
    state.hero.maxHp = 1_000_000
    state.hero.nextReadyMs = 1_000_000
    matriarch.cooldowns['venom-burst'] = 1_000_000
    matriarch.nextReadyMs = 10
    matriarch.hp = matriarch.maxHp * 0.3
    onEnemyHpChanged(state, matriarch, state.timeMs)
    stepUntil(state, defs, () => state.enemies.filter((enemy) => enemy.defId === 'barbed-stalker').length >= 2, 10_000)
    const stalkers = state.enemies.filter((enemy) => enemy.defId === 'barbed-stalker')
    expect(stalkers).toHaveLength(2)
    expect(stalkers.every((stalker) => stalker.summon && stalker.xp === 0 && stalker.level === 35)).toBe(true)
  })

  it('lays out the encounters and their drops and gold', () => {
    expect(stalkerPair.members.map((member) => [member.enemyId, member.level])).toEqual([
      ['barbed-stalker', 34],
      ['barbed-stalker', 34],
    ])
    expect(crawlerEncounter.members).toEqual([{ enemyId: 'venomhide-crawler', slot: 0, level: 35 }])
    expect(barrensMixed.members).toEqual([
      { enemyId: 'venomhide-crawler', slot: 0, level: 35 },
      { enemyId: 'thornwitch', slot: 1, level: 35 },
    ])
    expect(barrensDeep.members.map((member) => [member.enemyId, member.level])).toEqual([
      ['barbed-stalker', 37],
      ['venomhide-crawler', 37],
      ['thornwitch', 37],
    ])
    expect(matriarchEncounter.members).toEqual([{ enemyId: 'briar-matriarch', slot: 0, level: 38 }])
    for (const id of ['stalker-pair', 'crawler', 'barrens-mixed', 'barrens-deep', 'briar-matriarch']) {
      expect(encounters[id], id).toBeDefined()
    }
    const mixed = toExpeditionEncounter(barrensMixed)
    expect(mixed.enemies[0]).toMatchObject({ materialId: 'bloodstone', baseQuantity: 4, gold: 70 })
    expect(mixed.enemies[1]).toMatchObject({ materialId: 'bloodstone', baseQuantity: 3 })
    const elite = toExpeditionEncounter(matriarchEncounter)
    expect(elite.enemies[0]).toMatchObject({ materialId: 'bloodstone', baseQuantity: 10, gold: 114 })
  })

  it('pays about 35-45 barrens-mixed fights per level at level 37', () => {
    const level = 37
    const hero = referenceHeroAtLevel('warrior', level)
    const perLevel = Math.round(50 * level ** 1.5)
    const xp = (members: readonly (readonly [string, number])[]): number =>
      xpFromEnemies(
        level,
        hero.attributes.spirit,
        members.map(([id, enemyLevel]) => {
          const def = enemies[id]!
          return { xp: deriveEnemyStats({ level: enemyLevel, archetype: def.archetype, elite: def.elite, overrides: def.overrides }).xp, level: enemyLevel, summon: false }
        }),
      )
    const mixed = perLevel / xp([['venomhide-crawler', 35], ['thornwitch', 35]])
    expect(mixed).toBeGreaterThanOrEqual(35)
    expect(mixed).toBeLessThanOrEqual(45)
  })
})

describe('Enemy Bleed and Poison on the hero', () => {
  it('applies Bleed to the hero from a Stalker and the bleed hurts when the hero acts', () => {
    const { state, defs } = open([{ defId: 'barbed-stalker', slot: 0, level: 34 }])
    const stalker = actorAt(state, 0)
    state.hero.hp = 1_000_000
    state.hero.maxHp = 1_000_000
    state.hero.nextReadyMs = 1_000_000
    stalker.nextReadyMs = 10
    stepUntil(state, defs, () => state.hero.statuses.bleed !== null, 60_000)
    expect(state.hero.statuses.bleed).not.toBeNull()
    stalker.nextReadyMs = 10_000_000
    state.hero.nextReadyMs = state.timeMs + 10
    const hpBefore = state.hero.hp
    const isTick = (event: CombatState['log'][number]): boolean =>
      event.type === 'statusTick' && event.statusId === 'bleed' && event.targetName === 'Warrior'
    stepUntil(state, defs, () => state.log.some(isTick), 5_000)
    expect(state.log.some(isTick)).toBe(true)
    expect(state.hero.hp).toBeLessThan(hpBefore)
  })

  it('applies Poison to the hero from a Crawler spray', () => {
    const { state, defs } = open([{ defId: 'venomhide-crawler', slot: 0, level: 35 }])
    const crawler = actorAt(state, 0)
    state.hero.hp = 1_000_000
    state.hero.maxHp = 1_000_000
    state.hero.nextReadyMs = 1_000_000
    crawler.nextReadyMs = 10
    stepUntil(state, defs, () => state.hero.statuses.poison !== null, 60_000)
    expect(state.hero.statuses.poison).not.toBeNull()
  })
})

describe('Physical status resistance against the Barrens', () => {
  function firstAttempt(defId: string, statusId: string, bonus: number): { resistance: number; chance: number } {
    const { state, defs } = open([{ defId, slot: 0, level: 35 }], { physicalStatusResistanceBonus: bonus })
    state.hero.hp = 1_000_000
    state.hero.maxHp = 1_000_000
    state.hero.nextReadyMs = 1_000_000
    actorAt(state, 0).nextReadyMs = 10
    stepUntil(state, defs, () => state.log.some((event) => event.type === 'statusAttempt' && event.statusId === statusId), 20_000)
    const attempt = state.log.find((event) => event.type === 'statusAttempt' && event.statusId === statusId)
    if (attempt === undefined || attempt.type !== 'statusAttempt') throw new Error('no attempt')
    return { resistance: attempt.resistance, chance: attempt.chance }
  }

  it('lowers the chance Poison lands by exactly 10 points', () => {
    const plain = firstAttempt('venomhide-crawler', 'poison', 0)
    const staunch = firstAttempt('venomhide-crawler', 'poison', 10)
    expect(staunch.resistance - plain.resistance).toBe(10)
    expect(plain.chance - staunch.chance).toBeCloseTo(0.1, 10)
  })

  it('lowers the chance Bleed lands by exactly 10 points', () => {
    const plain = firstAttempt('barbed-stalker', 'bleed', 0)
    const staunch = firstAttempt('barbed-stalker', 'bleed', 10)
    expect(plain.chance - staunch.chance).toBeCloseTo(0.1, 10)
  })
})
