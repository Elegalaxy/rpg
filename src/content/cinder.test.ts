import { describe, expect, it } from 'vitest'

import { createCombat, stepCombat } from '../sim/combat.ts'
import { onEnemyHpChanged } from '../sim/enemyAi.ts'
import { deriveEnemyStats } from '../sim/stats.ts'
import type { CombatActor, CombatSetup, CombatState, GameDefs } from '../sim/types.ts'

import {
  cinderDeep,
  cinderMixed,
  encounters,
  golemEncounter,
  impSwarm,
  toExpeditionEncounter,
  tyrantEncounter,
} from './encounters.ts'
import { cinderImp, emberwroughtTyrant, enemies, pyreAcolyte, slagGolem } from './enemies.ts'
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

describe('Cinder Scar enemies', () => {
  it('registers the four enemies', () => {
    expect(enemies['cinder-imp']).toBe(cinderImp)
    expect(enemies['slag-golem']).toBe(slagGolem)
    expect(enemies['pyre-acolyte']).toBe(pyreAcolyte)
    expect(enemies['emberwrought-tyrant']).toBe(emberwroughtTyrant)
  })

  it('gives the Imp a burning 80% Ember Spit and a duskiron drop', () => {
    expect(cinderImp).toMatchObject({ archetype: 'swarm', levelMin: 28, levelMax: 32 })
    expect(cinderImp.drop).toEqual({ materialId: 'duskiron', baseQuantity: 2 })
    const spit = cinderImp.skills?.[0]
    expect(spit).toMatchObject({ id: 'ember-spit', coefficient: 0.8, school: 'magical', cooldownSeconds: 4 })
    expect(spit?.effects[1]).toMatchObject({ kind: 'applyStatus', statusId: 'burn', baseChance: 0.6, coefficient: 0.12 })
  })

  it('gives the Golem a 2.0 s Magma Slam that burns twice and can be interrupted at 25%', () => {
    expect(slagGolem).toMatchObject({ archetype: 'standard', levelMin: 29, levelMax: 34 })
    expect(slagGolem.drop).toEqual({ materialId: 'cinderite', baseQuantity: 4 })
    const slam = slagGolem.skills?.[0]
    expect(slam).toMatchObject({
      id: 'magma-slam',
      coefficient: 2.2,
      school: 'physical',
      telegraphMs: 2000,
      interruptMaxHpFraction: 0.25,
      cooldownSeconds: 10,
    })
    const burns = slam?.effects.filter((effect) => effect.kind === 'applyStatus') ?? []
    expect(burns).toHaveLength(2)
    expect(burns[0]).toMatchObject({ statusId: 'burn', baseChance: 1, coefficient: 0.12 })
  })

  it('gives the Acolyte a Kindle barrier, a burning Fire Bolt and a cinderite drop', () => {
    expect(pyreAcolyte).toMatchObject({ archetype: 'support', levelMin: 28, levelMax: 33 })
    expect(pyreAcolyte.overrides).toEqual({ armorMultiplier: 0.5, resistanceMultiplier: 1.5 })
    expect(pyreAcolyte.drop).toEqual({ materialId: 'cinderite', baseQuantity: 3 })
    const [kindle, bolt] = pyreAcolyte.skills ?? []
    expect(kindle).toMatchObject({ id: 'kindle', cooldownSeconds: 8, allyTarget: 'lowestBarrier' })
    expect(kindle?.effects).toEqual([{ kind: 'barrier', source: 'magical', coefficient: 1, durationSeconds: 8 }])
    expect(bolt).toMatchObject({ id: 'fire-bolt', coefficient: 0.9, school: 'magical' })
    expect(bolt?.effects[1]).toMatchObject({ statusId: 'burn', baseChance: 0.5 })
  })

  it('follows the Standard framework: 700 HP and 39 Power at level 31', () => {
    const stats = deriveEnemyStats({ level: 31, archetype: 'standard' })
    expect(stats.maxHp).toBe(700)
    expect(stats.power).toBe(39)
  })

  it('spawns the Tyrant as a level-32 standard elite with 5,000 HP, 55 Power and no stance', () => {
    const { state } = open([{ defId: 'emberwrought-tyrant', slot: 0 }])
    const tyrant = actorAt(state, 0)
    expect(tyrant.level).toBe(32)
    expect(tyrant.maxHp).toBe(5000)
    expect(tyrant.elite).toBe(true)
    expect(tyrant.stance).toBeNull()
    expect(emberwroughtTyrant.overrides).toMatchObject({ maxHp: 5000, power: 55, consistency: 25, actionTime: 2.2 })
    expect(emberwroughtTyrant.timePressure).toEqual({
      startMs: 120_000,
      intervalMs: 3000,
      maxStacks: 10,
      power: 1.1,
      defense: 0.95,
      actionSpeed: 1.05,
    })
    expect(emberwroughtTyrant.drop).toEqual({ materialId: 'cinderite', baseQuantity: 10 })
  })

  it('defines Searing Brand, Pyre Wave and the 40% Imp summon', () => {
    const [brand, wave, summon] = emberwroughtTyrant.skills ?? []
    expect(brand).toMatchObject({ id: 'searing-brand', coefficient: 1.1, school: 'physical', cooldownSeconds: 6 })
    expect(brand?.effects[1]).toMatchObject({ statusId: 'burn', baseChance: 0.75, coefficient: 0.15 })
    expect(wave).toMatchObject({
      id: 'pyre-wave',
      coefficient: 2.6,
      school: 'magical',
      telegraphMs: 2500,
      canCrit: true,
      interruptMaxHpFraction: 0.05,
      cooldownSeconds: 10,
    })
    expect(wave?.effects.filter((effect) => effect.kind === 'applyStatus')).toHaveLength(2)
    expect(summon).toMatchObject({ trigger: 'hp', hpFraction: 0.4, telegraphMs: 2000 })
    expect(summon?.effects).toEqual([
      { kind: 'summon', enemyId: 'cinder-imp', level: 28 },
      { kind: 'summon', enemyId: 'cinder-imp', level: 28 },
    ])
  })

  it('summons two Cinder Imps when the Tyrant falls to 40% HP', () => {
    const { state, defs } = open([{ defId: 'emberwrought-tyrant', slot: 0 }])
    const tyrant = actorAt(state, 0)
    state.hero.hp = 1_000_000
    state.hero.maxHp = 1_000_000
    state.hero.nextReadyMs = 1_000_000
    tyrant.cooldowns['pyre-wave'] = 1_000_000
    tyrant.nextReadyMs = 10
    tyrant.hp = tyrant.maxHp * 0.39
    onEnemyHpChanged(state, tyrant, state.timeMs)
    stepUntil(state, defs, () => state.enemies.filter((enemy) => enemy.defId === 'cinder-imp').length >= 2, 10_000)
    const imps = state.enemies.filter((enemy) => enemy.defId === 'cinder-imp')
    expect(imps).toHaveLength(2)
    expect(imps.every((imp) => imp.summon && imp.xp === 0 && imp.level === 28)).toBe(true)
  })

  it('lays out the encounters and their drops and gold', () => {
    expect(impSwarm.members.map((member) => [member.enemyId, member.level])).toEqual([
      ['cinder-imp', 28],
      ['cinder-imp', 28],
      ['cinder-imp', 28],
    ])
    expect(golemEncounter.members).toEqual([{ enemyId: 'slag-golem', slot: 0, level: 29 }])
    expect(cinderMixed.members).toEqual([
      { enemyId: 'slag-golem', slot: 0, level: 29 },
      { enemyId: 'pyre-acolyte', slot: 1, level: 29 },
    ])
    expect(cinderDeep.members.map((member) => [member.enemyId, member.level])).toEqual([
      ['cinder-imp', 31],
      ['slag-golem', 31],
      ['pyre-acolyte', 31],
    ])
    expect(tyrantEncounter.members).toEqual([{ enemyId: 'emberwrought-tyrant', slot: 0, level: 32 }])
    for (const id of ['imp-swarm', 'golem', 'cinder-mixed', 'cinder-deep', 'emberwrought-tyrant']) {
      expect(encounters[id], id).toBeDefined()
    }
    const mixed = toExpeditionEncounter(cinderMixed)
    expect(mixed.enemies[0]).toMatchObject({ materialId: 'cinderite', baseQuantity: 4, gold: 58 })
    expect(mixed.enemies[1]).toMatchObject({ materialId: 'cinderite', baseQuantity: 3 })
    const elite = toExpeditionEncounter(tyrantEncounter)
    expect(elite.enemies[0]).toMatchObject({ materialId: 'cinderite', baseQuantity: 10, gold: 96 })
  })
})

describe('Enemy Burn on the hero', () => {
  it('applies Burn to the hero from an Imp and the burn ticks for damage', () => {
    const { state, defs } = open([{ defId: 'cinder-imp', slot: 0, level: 30 }])
    const imp = actorAt(state, 0)
    state.hero.hp = 1_000_000
    state.hero.maxHp = 1_000_000
    state.hero.nextReadyMs = 1_000_000
    imp.nextReadyMs = 10
    // Burn lands with a 60% base chance (before resistance), so give the Imp a few spits.
    stepUntil(state, defs, () => state.hero.statuses.burn !== null, 60_000)
    expect(state.hero.statuses.burn).not.toBeNull()
    const applied = state.log.some(
      (event) =>
        event.type === 'statusAttempt' && event.targetName === 'Warrior' && event.statusId === 'burn' && event.result === 'applied',
    )
    expect(applied).toBe(true)
    imp.nextReadyMs = 10_000_000
    const hpBefore = state.hero.hp
    const isHeroBurnTick = (event: CombatState['log'][number]): boolean =>
      event.type === 'statusTick' && event.statusId === 'burn' && event.targetName === 'Warrior'
    stepUntil(state, defs, () => state.log.some(isHeroBurnTick), 5_000)
    const tick = state.log.find(isHeroBurnTick)
    expect(tick).toBeDefined()
    expect(tick?.type === 'statusTick' ? tick.hpDamage : 0).toBeGreaterThan(0)
    expect(state.hero.hp).toBeLessThan(hpBefore)
  })
})
