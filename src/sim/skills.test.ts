import { describe, expect, it } from 'vitest'

import { HEALING_ROLL_CEILING, HEALING_ROLL_FLOOR } from './constants.ts'
import { createCombat, roundDurationMs, stepCombat } from './combat.ts'
import { resolveDamage } from './damage.ts'
import { formatEvent } from './log.ts'
import { centeredRoll, uniform } from './rng.ts'
import { actionTime, cooldownReduction, type HeroStatInput } from './stats.ts'
import {
  activeBarrier,
  finalCooldownSeconds,
  incomingDamageFactor,
  resolveHeal,
} from './skills.ts'
import type {
  CombatSetup,
  CombatState,
  DamageInput,
  DamageRolls,
  EnemyDef,
  GameDefs,
  SkillDef,
  SkillEffect,
} from './types.ts'

const ITEM_LEVEL = 20
const QUALITY = 1

function armor(slot: 'head' | 'chest' | 'hands' | 'feet') {
  return {
    id: `ref-heavy-${slot}`,
    slot,
    category: 'heavy' as const,
    itemLevel: ITEM_LEVEL,
    quality: QUALITY,
  }
}

function warriorSetup(loadout?: {
  equipped?: readonly string[]
  rows?: readonly { skillId: string }[]
}): CombatSetup {
  const hero: HeroStatInput & { id: string; name: string } = {
    id: 'ref-human-warrior',
    name: 'Warrior',
    level: 20,
    classId: 'warrior',
    attributes: { strength: 24, vitality: 22, agility: 16, intellect: 10, spirit: 16 },
    gear: {
      mainHand: { id: 'ref-one-handed', kind: 'oneHanded', itemLevel: ITEM_LEVEL, quality: QUALITY },
      offHand: { id: 'ref-shield', kind: 'shield', itemLevel: ITEM_LEVEL, quality: QUALITY },
      head: armor('head'),
      chest: armor('chest'),
      hands: armor('hands'),
      feet: armor('feet'),
      accessories: [
        { id: 'ref-accessory-a', itemLevel: ITEM_LEVEL, quality: QUALITY },
        { id: 'ref-accessory-b', itemLevel: ITEM_LEVEL, quality: QUALITY },
      ] as const,
    },
  }
  return {
    hero: {
      ...hero,
      equippedSkillIds: loadout?.equipped,
      priorityRows: loadout?.rows,
    },
    enemies: [{ defId: 'dummy', slot: 0 }],
  }
}

function dummy(overrides: EnemyDef['overrides'] = {}, id = 'dummy', name = 'Dummy'): EnemyDef {
  return { id, name, level: 20, archetype: 'standard', school: 'physical', overrides }
}

function makeSkill(overrides: Partial<SkillDef> & Pick<SkillDef, 'id' | 'effects'>): SkillDef {
  return {
    name: overrides.id,
    cost: 0,
    cooldownSeconds: 0,
    actionTimeCoefficient: 1,
    tags: ['test'],
    target: 'single',
    ...overrides,
  }
}

function defsFor(skillList: readonly SkillDef[], enemies: readonly EnemyDef[] = [dummy()]): GameDefs {
  const skills: GameDefs['skills'] = {}
  for (const skill of skillList) skills[skill.id] = skill
  const book: GameDefs['enemies'] = {}
  for (const enemy of enemies) book[enemy.id] = enemy
  return { enemies: book, skills }
}

function damageInput(
  overrides: Partial<Omit<DamageInput, 'rolls'>> & { rolls?: Partial<DamageRolls> } = {},
): DamageInput {
  const { rolls, ...rest } = overrides
  return {
    accuracy: 0,
    evasion: 0,
    power: 100,
    coefficient: 1,
    outgoingModifier: 1,
    consistency: 0,
    critChance: 0,
    critDamage: 1.5,
    barrier: 0,
    penetration: 0,
    defense: 0,
    attackerLevel: 1,
    incomingModifier: 1,
    school: 'physical',
    ...rest,
    rolls: { hitRoll: 0, consistencyRoll: 1, critRoll: 1, ...rolls },
  }
}

function untilAction(state: CombatState, defs: GameDefs): void {
  while (state.outcome === 'ongoing' && state.log.every((event) => event.type !== 'action')) {
    stepCombat(state, defs)
  }
}

describe('skill timing', () => {
  it('caps cooldown reduction at 50%', () => {
    const innatePlusBonus = cooldownReduction(34, 0.45)
    const capped = finalCooldownSeconds(8, innatePlusBonus)
    const overCap = finalCooldownSeconds(8, 0.9)
    const half = finalCooldownSeconds(8, 0.5)
    console.log('[skills] cooldown cap', { innatePlusBonus, capped, overCap, half })
    expect(innatePlusBonus).toBe(0.5)
    expect(capped).toBe(4)
    expect(overCap).toBe(4)
    expect(half).toBe(4)

    const skill = makeSkill({
      id: 'long-cooldown',
      cooldownSeconds: 8,
      effects: [{ kind: 'damage', school: 'physical', coefficient: 1 }],
    })
    const defs = defsFor([skill], [dummy({ maxHp: 1_000_000 })])
    const state = createCombat(
      warriorSetup({ equipped: [skill.id], rows: [{ skillId: skill.id }] }),
      defs,
      1,
    )
    state.hero.cooldownReduction = 0.9
    untilAction(state, defs)
    const action = state.log.find((event) => event.type === 'action')
    console.log('[skills] capped cooldown scheduled', {
      action,
      nextReadyMs: state.hero.nextReadyMs,
      cooldownReady: state.hero.cooldowns[skill.id],
      stepMs: state.timeMs,
    })
    expect(action).toMatchObject({ timeMs: 1724, cooldownReadyMs: 5724 })
    expect(state.hero.nextReadyMs).toBe(3448)
    expect(state.timeMs).toBe(1730)
    expect(state.hero.cooldowns[skill.id]).toBe(1724 + 4000)
  })

  it('floors skill action time at 0.5s and schedules from the previous ready time', () => {
    const unfloored = (2 * 0.1 * 100) / 116
    const floored = actionTime(2, 16, 0.1)
    console.log('[skills] action-time floor', { unfloored, floored })
    expect(unfloored).toBeLessThan(0.5)
    expect(floored).toBe(0.5)
    expect(roundDurationMs(floored, 'floored action')).toBe(500)

    const skill = makeSkill({
      id: 'fast-skill',
      actionTimeCoefficient: 0.1,
      effects: [{ kind: 'evasion', amount: 1 }],
    })
    const defs = defsFor([skill])
    const state = createCombat(
      warriorSetup({ equipped: [skill.id], rows: [{ skillId: skill.id }] }),
      defs,
      1,
    )
    expect(state.hero.nextReadyMs).toBe(1724)
    untilAction(state, defs)
    console.log('[skills] floored schedule', {
      nextReadyMs: state.hero.nextReadyMs,
      stepMs: state.timeMs,
    })
    expect(state.hero.nextReadyMs).toBe(1724 + 500)
    expect(state.timeMs).toBe(1730)
    expect(state.hero.nextReadyMs).not.toBe(state.timeMs + 500)
  })

  it('starts a cooldown when the action resolves and spends it in simulated time', () => {
    const skill = makeSkill({
      id: 'driving',
      cooldownSeconds: 3,
      effects: [{ kind: 'damage', school: 'physical', coefficient: 1.1 }],
    })
    const defs = defsFor([skill], [dummy({ maxHp: 1_000_000 })])
    const state = createCombat(
      warriorSetup({ equipped: [skill.id], rows: [{ skillId: skill.id }] }),
      defs,
      1,
    )
    const reduction = state.hero.cooldownReduction
    const cooldownMs = roundDurationMs(finalCooldownSeconds(3, reduction), 'driving cooldown')
    console.log('[skills] warrior cooldown', { reduction, cooldownMs })
    expect(reduction).toBeCloseTo(0.05, 12)
    expect(cooldownMs).toBe(2850)

    untilAction(state, defs)
    expect(state.hero.cooldowns[skill.id]).toBe(1724 + 2850)
    const heroActs = (): number =>
      state.log.filter((event) => event.type === 'action' && event.actorId === state.hero.id).length
    while (heroActs() < 2) stepCombat(state, defs)
    const lines = state.log.map(formatEvent)
    console.log('[skills] second action', lines.filter((line) => line.includes('row') || line.includes('basic attacks')))
    expect(lines.some((line) => line.includes('skips row 1 driving (driving): on cooldown'))).toBe(true)
    while (heroActs() < 3) stepCombat(state, defs)
    const heroActions = state.log.filter((event) => event.type === 'action' && event.actorId === state.hero.id)
    expect(heroActions[2]).toMatchObject({ action: 'skill', skillId: 'driving', timeMs: 5172 })
  })
})

describe('damage pipeline for skills', () => {
  it('mitigates only the overflow after a pre-mitigation barrier', () => {
    // afterCrit 100, barrier 40, overflow 60.
    // Defense 50 at level 10: 50 / (50 + 50 + 50) = 1/3.
    // 60 × (2/3) = 40. The full hit would have been 100 × (2/3).
    const result = resolveDamage(
      damageInput({
        power: 100,
        barrier: 40,
        defense: 50,
        attackerLevel: 10,
      }),
    )
    console.log('[skills] barrier overflow', {
      afterCrit: result.afterCrit,
      absorbed: result.barrierAbsorbed,
      overflow: result.overflow,
      reduction: result.reduction,
      afterDefense: result.afterDefense,
      hpDamage: result.hpDamage,
    })
    expect(result.afterCrit).toBe(100)
    expect(result.barrierAbsorbed).toBe(40)
    expect(result.overflow).toBe(60)
    expect(result.reduction).toBeCloseTo(1 / 3, 12)
    expect(result.afterDefense).toBeCloseTo(40, 12)
    expect(result.hpDamage).toBe(40)
    expect(result.afterDefense).toBeLessThan(100 * (2 / 3))
  })

  it('lets a barrier absorb a whole hit for 0 HP', () => {
    const absorbed = resolveDamage(
      damageInput({ power: 50, barrier: 50, defense: 100, attackerLevel: 10 }),
    )
    const unshielded = resolveDamage(
      damageInput({
        power: 1,
        defense: 1000,
        attackerLevel: 1,
        rolls: { consistencyRoll: 0.6 },
      }),
    )
    console.log('[skills] full absorb', {
      absorbed: absorbed.hpDamage,
      overflow: absorbed.overflow,
      unshielded: unshielded.hpDamage,
    })
    expect(absorbed.overflow).toBe(0)
    expect(absorbed.afterDefense).toBe(0)
    expect(absorbed.hpDamage).toBe(0)
    expect(unshielded.afterIncoming).toBeLessThan(0.5)
    expect(unshielded.hpDamage).toBe(1)
  })

  it('multiplies incoming-damage modifiers', () => {
    const factor = incomingDamageFactor({ incomingMultipliers: [1.25, 1.2], damageReduction: 0 })
    const result = resolveDamage(damageInput({ power: 80, incomingModifier: factor }))
    console.log('[skills] incoming multipliers', { factor, hpDamage: result.hpDamage })
    expect(factor).toBeCloseTo(1.5, 12)
    expect(factor).not.toBeCloseTo(1.25 + 1.2, 6)
    expect(result.afterIncoming).toBeCloseTo(120, 8)
    expect(result.hpDamage).toBe(120)
  })

  it('does not roll to hit for an active skill', () => {
    const missedBasic = resolveDamage(
      damageInput({ accuracy: 0, evasion: 100, guaranteedHit: false, rolls: { hitRoll: 0.99 } }),
    )
    const skillHit = resolveDamage(
      damageInput({
        accuracy: 0,
        evasion: 100,
        guaranteedHit: true,
        power: 40,
        rolls: { hitRoll: 0.99 },
      }),
    )
    console.log('[skills] guaranteed skill hit', { basic: missedBasic.hit, skill: skillHit.hit, hp: skillHit.hpDamage })
    expect(missedBasic.hit).toBe(false)
    expect(skillHit.hit).toBe(true)
    expect(skillHit.hitChance).toBe(1)
    expect(skillHit.hpDamage).toBe(40)

    const skill = makeSkill({
      id: 'strike',
      effects: [{ kind: 'damage', school: 'physical', coefficient: 1 }],
    })
    const defs = defsFor([skill], [dummy({ maxHp: 1_000_000, evasion: 100 })])
    const state = createCombat(
      warriorSetup({ equipped: [skill.id], rows: [{ skillId: skill.id }] }),
      defs,
      3,
    )
    untilAction(state, defs)
    const heroHits = state.log.filter((event) => event.type === 'hitRoll' && event.actorId === state.hero.id)
    const damage = state.log.find((event) => event.type === 'damage' && event.actorId === state.hero.id)
    console.log('[skills] skill action log', state.log.map(formatEvent))
    expect(heroHits).toEqual([])
    expect(damage).toMatchObject({ type: 'damage', hit: true, coefficient: 1 })
  })
})

describe('skill effects', () => {
  it('rolls direct healing on [0.90, 1.00)', () => {
    const healed = resolveHeal({
      maxHp: 370,
      maxHpFraction: 0.15,
      healingPower: 32,
      healingCoefficient: 0.5,
      outgoingModifier: 1,
      healingReceived: 1.11,
      roll: 0.9,
    })
    console.log('[skills] heal at floor', healed)
    expect(healed.raw).toBeCloseTo(71.5, 12)
    expect(healed.afterRoll).toBeCloseTo(64.35, 12)
    expect(healed.afterReceived).toBeCloseTo(71.4285, 8)
    expect(healed.amount).toBe(71)
    expect(healed.rollFloor).toBe(0.9)
    expect(healed.rollCeiling).toBe(1)

    const skill = makeSkill({
      id: 'mend-now',
      effects: [{ kind: 'heal', maxHpFraction: 0.15, healingCoefficient: 0.5 }],
    })
    const defs = defsFor([skill], [dummy({ maxHp: 1_000_000 })])
    const state = createCombat(
      warriorSetup({ equipped: [skill.id], rows: [{ skillId: skill.id }] }),
      defs,
      4,
    )
    const rngBeforeHeal = { ...state.rng }
    state.hero.hp = 100
    untilAction(state, defs)
    const heal = state.log.find((event) => event.type === 'heal')
    const centered = centeredRoll({ ...rngBeforeHeal }, HEALING_ROLL_FLOOR, HEALING_ROLL_CEILING)
    const singleUniform = uniform({ ...rngBeforeHeal }, HEALING_ROLL_FLOOR, HEALING_ROLL_CEILING)
    console.log('[skills] combat heal', { heal, centered, singleUniform })
    expect(heal?.type).toBe('heal')
    if (heal?.type !== 'heal') return
    expect(heal.roll).toBe(centered)
    expect(heal.roll).not.toBe(singleUniform)
    expect(heal.roll).toBeGreaterThanOrEqual(0.9)
    expect(heal.roll).toBeLessThan(1)
    expect(heal.healingReceived).toBeCloseTo(1.11, 12)
    expect(heal.amount).toBe(Math.round(heal.afterOutgoing * heal.roll * heal.healingReceived))
    expect(state.hero.hp).toBe(100 + heal.amount)
  })

  it('absorbs skill damage with a barrier before defense, including a full absorb', () => {
    const strike = makeSkill({
      id: 'strike',
      effects: [{ kind: 'damage', school: 'physical', coefficient: 1 }],
    })
    const bulky = dummy({ maxHp: 1_000_000 })
    const defs = defsFor([strike], [bulky])
    const partial = createCombat(
      warriorSetup({ equipped: [strike.id], rows: [{ skillId: strike.id }] }),
      defs,
      5,
    )
    const enemy = partial.enemies[0]
    expect(enemy).toBeDefined()
    if (enemy === undefined) return
    enemy.barrier = 10
    enemy.barrierExpiresMs = 99_999
    untilAction(partial, defs)
    const overflowHit = partial.log.find((event) => event.type === 'damage')
    console.log('[skills] combat barrier overflow', overflowHit)
    expect(overflowHit?.type).toBe('damage')
    if (overflowHit?.type !== 'damage') return
    expect(overflowHit.barrier).toBe(10)
    expect(overflowHit.afterCrit).toBeGreaterThan(10)
    expect(overflowHit.barrierAbsorbed).toBeCloseTo(10, 8)
    expect(overflowHit.overflow).toBeCloseTo(overflowHit.afterCrit - 10, 8)
    expect(overflowHit.afterDefense).toBeCloseTo(overflowHit.overflow * (1 - overflowHit.reduction), 8)
    expect(overflowHit.reduction).toBeGreaterThan(0)

    const soaked = createCombat(
      warriorSetup({ equipped: [strike.id], rows: [{ skillId: strike.id }] }),
      defs,
      5,
    )
    const soakedEnemy = soaked.enemies[0]
    if (soakedEnemy === undefined) return
    soakedEnemy.barrier = 1_000_000
    soakedEnemy.barrierExpiresMs = 99_999
    untilAction(soaked, defs)
    const absorbed = soaked.log.find((event) => event.type === 'damage')
    console.log('[skills] combat full absorb', absorbed)
    expect(absorbed?.type).toBe('damage')
    if (absorbed?.type !== 'damage') return
    expect(absorbed.hpDamage).toBe(0)
    expect(absorbed.overflow).toBe(0)
    expect(soakedEnemy.hp).toBe(soakedEnemy.maxHp)
    expect(soakedEnemy.alive).toBe(true)
  })

  it('applies both incoming multipliers to the next hit', () => {
    const effects: SkillEffect[] = [
      { kind: 'incomingDamage', multiplier: 1.25 },
      { kind: 'incomingDamage', multiplier: 1.2 },
    ]
    const skill = makeSkill({ id: 'exposed', actionTimeCoefficient: 8, effects })
    const defs = defsFor([skill], [dummy({ maxHp: 1_000_000, accuracy: 100 })])
    const state = createCombat(
      warriorSetup({ equipped: [skill.id], rows: [{ skillId: skill.id }] }),
      defs,
      8,
    )
    state.hero.evasion = 0
    untilAction(state, defs)
    expect(incomingDamageFactor(state.hero)).toBeCloseTo(1.5, 12)
    while (
      state.outcome === 'ongoing' &&
      state.timeMs < 10_000 &&
      !state.log.some((event) => event.type === 'damage' && event.actorId !== state.hero.id)
    ) {
      stepCombat(state, defs)
    }
    const hit = state.log.find((event) => event.type === 'damage' && event.actorId !== state.hero.id)
    console.log('[skills] multiplied incoming hit', hit)
    expect(hit?.type).toBe('damage')
    if (hit?.type !== 'damage') return
    expect(hit.incomingModifier).toBeCloseTo(1.5, 12)
    expect(hit.afterIncoming).toBeCloseTo(hit.afterDefense * 1.5, 8)
  })

  it('keeps a barrier until its duration, then expires it', () => {
    const skill = makeSkill({
      id: 'ward',
      cooldownSeconds: 30,
      effects: [{ kind: 'barrier', source: 'magical', coefficient: 1, durationSeconds: 8 }],
    })
    const defs = defsFor([skill], [dummy({ maxHp: 1_000_000, power: 1 })])
    const state = createCombat(
      warriorSetup({ equipped: [skill.id], rows: [{ skillId: skill.id }] }),
      defs,
      2,
    )
    const foe = state.enemies[0]
    if (foe !== undefined) foe.nextReadyMs = 999_999
    untilAction(state, defs)
    console.log('[skills] barrier gained', {
      amount: state.hero.barrier,
      expires: state.hero.barrierExpiresMs,
      magicalPower: state.hero.magicalPower,
    })
    expect(state.hero.magicalPower).toBe(20)
    expect(state.hero.barrier).toBe(20)
    expect(state.hero.barrierExpiresMs).toBe(1724 + 8000)
    expect(activeBarrier(state.hero, 9723)).toBe(20)
    expect(activeBarrier(state.hero, 9724)).toBe(0)
    while (state.timeMs < 9730 && state.outcome === 'ongoing') stepCombat(state, defs)
    const expired = state.log.find((event) => event.type === 'barrierExpired')
    console.log('[skills] barrier expired', expired)
    expect(expired).toMatchObject({ type: 'barrierExpired', timeMs: 9724, amount: 20 })
    expect(state.hero.barrier).toBe(0)
  })

  it('delays the target from its scheduled ready time', () => {
    const skill = makeSkill({
      id: 'push',
      effects: [{ kind: 'actionDelay', delaySeconds: 0.5 }],
    })
    const defs = defsFor([skill])
    const state = createCombat(
      warriorSetup({ equipped: [skill.id], rows: [{ skillId: skill.id }] }),
      defs,
      1,
    )
    const enemy = state.enemies[0]
    expect(enemy?.nextReadyMs).toBe(2200)
    untilAction(state, defs)
    console.log('[skills] action delay', { nextReadyMs: enemy?.nextReadyMs, stepMs: state.timeMs })
    expect(enemy?.nextReadyMs).toBe(2700)
    expect(state.timeMs).toBe(1730)
  })

  it('grants until-next-action Evasion and damage reduction', () => {
    const smoke = makeSkill({
      id: 'smoke',
      actionTimeCoefficient: 0.5,
      effects: [{ kind: 'evasion', amount: 30 }],
    })
    const brace = makeSkill({
      id: 'brace',
      requires: { offHand: 'shield' },
      effects: [{ kind: 'damageReduction', fraction: 0.3 }],
    })
    const smokeState = createCombat(
      warriorSetup({ equipped: [smoke.id], rows: [{ skillId: smoke.id }] }),
      defsFor([smoke]),
      1,
    )
    untilAction(smokeState, defsFor([smoke]))
    while (
      smokeState.outcome === 'ongoing' &&
      !smokeState.log.some((event) => event.type === 'hitRoll' && event.actorId !== smokeState.hero.id)
    ) {
      stepCombat(smokeState, defsFor([smoke]))
    }
    const glanced = smokeState.log.find((event) => event.type === 'hitRoll' && event.actorId !== smokeState.hero.id)
    console.log('[skills] evasion buff', { bonus: smokeState.hero.evasionBonus, glanced })
    expect(smokeState.hero.evasion).toBe(16)
    expect(glanced).toMatchObject({ type: 'hitRoll', evasion: 46 })

    const braceDefs = defsFor([brace], [dummy({ maxHp: 1_000_000, accuracy: 100 })])
    const braceState = createCombat(
      warriorSetup({ equipped: [brace.id], rows: [{ skillId: brace.id }] }),
      braceDefs,
      6,
    )
    braceState.hero.evasion = 0
    untilAction(braceState, braceDefs)
    console.log('[skills] damage reduction', {
      fraction: braceState.hero.damageReduction,
      factor: incomingDamageFactor(braceState.hero),
    })
    expect(braceState.hero.damageReduction).toBeCloseTo(0.3, 12)
    expect(incomingDamageFactor(braceState.hero)).toBeCloseTo(0.7, 12)
    expect(braceState.log.some((event) => event.type === 'hitRoll' && event.actorId === braceState.hero.id)).toBe(
      false,
    )
  })

  it('hits every living enemy with one all-target action', () => {
    const cleave = makeSkill({
      id: 'cleave',
      target: 'all',
      effects: [{ kind: 'damage', school: 'physical', coefficient: 0.8 }],
    })
    const foes = [dummy({ maxHp: 1_000_000 }, 'a', 'Alpha'), dummy({ maxHp: 1_000_000 }, 'b', 'Beta')]
    const defs = defsFor([cleave], foes)
    const setup = warriorSetup({ equipped: [cleave.id], rows: [{ skillId: cleave.id }] })
    setup.enemies = [
      { defId: 'a', slot: 0 },
      { defId: 'b', slot: 1 },
    ]
    const state = createCombat(setup, defs, 1)
    untilAction(state, defs)
    const damages = state.log.filter((event) => event.type === 'damage' && event.actorId === state.hero.id)
    console.log('[skills] cleave targets', damages.map((event) => (event.type === 'damage' ? event.targetName : '')))
    expect(damages.map((event) => (event.type === 'damage' ? event.targetName : ''))).toEqual(['Alpha', 'Beta'])
    expect(state.log.filter((event) => event.type === 'action' && event.actorId === state.hero.id)).toHaveLength(1)
    expect(state.log.some((event) => event.type === 'hitRoll' && event.actorId === state.hero.id)).toBe(false)
  })
})
