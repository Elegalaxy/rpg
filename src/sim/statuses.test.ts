import { describe, expect, it } from 'vitest'

import { createCombat, runCombat, stepCombat } from './combat.ts'
import { formatEvent } from './log.ts'
import { skillOffCooldown } from './skills.ts'
import {
  applicationChance,
  chillSlowForStacks,
  cleanseStatus,
  mitigateStatusDamage,
  slowedActionMs,
  statusStackCap,
  stunDelayMs,
  tryApplyStatus,
} from './statuses.ts'
import type {
  ApplyStatusEffect,
  CombatActor,
  CombatSetup,
  CombatState,
  EnemyDef,
  GameDefs,
  SkillDef,
  StatusTickEvent,
} from './types.ts'
import type { HeroStatInput } from './stats.ts'

const ITEM_LEVEL = 20
const QUALITY = 1
const SLOWS = [0.1, 0.07, 0.05] as const

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
    hero: { ...hero, equippedSkillIds: loadout?.equipped, priorityRows: loadout?.rows },
    enemies: [{ defId: 'dummy', slot: 0 }],
  }
}

function dummy(overrides: EnemyDef['overrides'] = {}, id = 'dummy', name = 'Dummy'): EnemyDef {
  return { id, name, level: 20, archetype: 'standard', school: 'physical', overrides }
}

function designStatuses(): GameDefs['statuses'] {
  return {
    bleed: { id: 'bleed', name: 'Bleed', kind: 'bleed', maxStacks: 5, actionsPerStack: 3 },
    poison: {
      id: 'poison',
      name: 'Poison',
      kind: 'poison',
      maxStacks: 5,
      durationSeconds: 8,
      tickSeconds: 2,
    },
    burn: { id: 'burn', name: 'Burn', kind: 'burn', maxIntensity: 5, durationSeconds: 5, tickSeconds: 1 },
    chill: {
      id: 'chill',
      name: 'Chill',
      kind: 'chill',
      maxStacks: 3,
      durationSeconds: 6,
      slowByStack: SLOWS,
    },
    stun: { id: 'stun', name: 'Stun', kind: 'stun', delaySeconds: 1.5 },
    mark: { id: 'mark', name: 'Mark', kind: 'mark' },
    expose: { id: 'expose', name: 'Expose', kind: 'expose', durationSeconds: 8 },
  }
}

function skill(tags: readonly string[], id = 'test-skill'): SkillDef {
  return {
    id,
    name: id,
    cost: 0,
    cooldownSeconds: 0,
    actionTimeCoefficient: 1,
    tags,
    target: 'single',
    effects: [{ kind: 'damage', school: 'physical', coefficient: 1 }],
  }
}

function effect(statusId: string, extra: Omit<ApplyStatusEffect, 'kind' | 'statusId'>): ApplyStatusEffect {
  return { kind: 'applyStatus', statusId, ...extra }
}

function start(options?: {
  seed?: number
  enemies?: EnemyDef[]
  slots?: { defId: string; slot: number }[]
  skills?: SkillDef[]
  equipped?: readonly string[]
  rows?: readonly { skillId: string }[]
}): { state: CombatState; defs: GameDefs; enemy: CombatActor } {
  const enemies = options?.enemies ?? [dummy({ maxHp: 1_000_000, power: 0 })]
  const defs: GameDefs = {
    enemies: {},
    skills: {},
    statuses: designStatuses(),
  }
  for (const entry of enemies) defs.enemies[entry.id] = entry
  for (const entry of options?.skills ?? []) defs.skills[entry.id] = entry
  const setup = warriorSetup({ equipped: options?.equipped, rows: options?.rows })
  const first = enemies[0]
  if (first === undefined) throw new Error('missing enemy')
  setup.enemies = options?.slots ?? [{ defId: first.id, slot: 0 }]
  const state = createCombat(setup, defs, options?.seed ?? 1)
  const enemy = state.enemies[0]
  if (enemy === undefined) throw new Error('missing enemy')
  return { state, defs, enemy }
}

function apply(
  state: CombatState,
  defs: GameDefs,
  target: CombatActor,
  statusId: string,
  extra: Omit<ApplyStatusEffect, 'kind' | 'statusId'>,
  options?: {
    roll?: number
    tags?: readonly string[]
    skill?: SkillDef
    timeMs?: number
    applyingHit?: boolean
    hpDamageDealt?: number
    potency?: number
  },
): void {
  tryApplyStatus({
    state,
    defs,
    source: state.hero,
    target,
    skill: options?.skill ?? skill(options?.tags ?? ['physical']),
    effect: effect(statusId, { ...extra, potency: options?.potency ?? extra.potency }),
    timeMs: options?.timeMs ?? state.timeMs,
    applyingHit: options?.applyingHit ?? true,
    hpDamageDealt: options?.hpDamageDealt ?? 1,
    roll: options?.roll,
  })
}

function tickEvents(state: CombatState, statusId: string, targetId?: string): StatusTickEvent[] {
  const ticks: StatusTickEvent[] = []
  for (const event of state.log) {
    if (event.type !== 'statusTick' || event.statusId !== statusId) continue
    if (targetId !== undefined && event.targetId !== targetId) continue
    ticks.push(event)
  }
  return ticks
}

function trace(label: string, detail: unknown): void {
  console.log('[status]', label, detail)
}

/** Step until `untilMs` without ending the fight as a timeout. */
function advance(state: CombatState, defs: GameDefs, untilMs: number): void {
  while (state.outcome === 'ongoing' && state.timeMs < untilMs) stepCombat(state, defs)
}

describe('status application chance', () => {
  it('clamps base chance plus Potency minus Resistance to 5%–95%', () => {
    const low = applicationChance(0, 0, 100)
    const high = applicationChance(1, 80, 0)
    const middle = applicationChance(0.75, 10, 22)
    trace('chance clamps', { low, high, middle })
    expect(low).toBeCloseTo(0.05, 10)
    expect(high).toBeCloseTo(0.95, 10)
    expect(middle).toBeCloseTo(0.63, 10)
    expect(statusStackCap(5, false)).toBe(5)
    expect(statusStackCap(5, true)).toBe(3)
    expect(statusStackCap(3, true)).toBe(2)
  })

  it('adds Intellect, equipment potency, and skill potency, and leaves the damage coefficient unchanged', () => {
    const { state, defs, enemy } = start()
    state.hero.statusPotency = 4
    const power = state.hero.physicalPower
    apply(state, defs, enemy, 'poison', { baseChance: 1, coefficient: 0.12 }, { roll: 0, potency: 5 })
    const attempt = state.log.find((event) => event.type === 'statusAttempt')
    const stack = enemy.statuses.poison?.stacks[0]
    trace('potency', {
      intellect: state.hero.intellect,
      equipment: state.hero.statusPotency,
      skill: 5,
      attempt,
      coefficient: stack?.coefficient,
      power: stack?.power,
    })
    expect(attempt).toMatchObject({
      type: 'statusAttempt',
      result: 'applied',
      potency: 19,
      chance: applicationChance(1, 19, 0),
    })
    expect(stack?.coefficient).toBe(0.12)
    expect(stack?.power).toBe(power)
  })

  it('uses Vitality for physical resistance and Spirit for magical resistance', () => {
    const { state, defs, enemy } = start()
    state.hero.intellect = 0
    enemy.vitality = 30
    enemy.physicalStatusResistance = 5
    enemy.spirit = 4
    enemy.magicalStatusResistance = 6
    apply(state, defs, enemy, 'bleed', { baseChance: 1, coefficient: 0.1 }, { roll: 0 })
    apply(
      state,
      defs,
      enemy,
      'burn',
      { baseChance: 1, coefficient: 0.1 },
      { roll: 0, tags: ['magical'] },
    )
    const attempts = state.log.filter((event) => event.type === 'statusAttempt')
    trace('resistance', attempts)
    expect(attempts[0]).toMatchObject({ statusId: 'bleed', school: 'physical', resistance: 35 })
    expect(attempts[1]).toMatchObject({ statusId: 'burn', school: 'magical', resistance: 10 })
    expect(attempts[0]).toMatchObject({ chance: applicationChance(1, 0, 35) })
    expect(attempts[1]).toMatchObject({ chance: applicationChance(1, 0, 10) })
  })

  it('treats Bleed and Poison as physical, Burn and Chill as magical, and Stun and Expose by the skill tag', () => {
    const { state, defs, enemy } = start()
    state.hero.intellect = 0
    enemy.vitality = 12
    enemy.spirit = 3
    apply(state, defs, enemy, 'poison', { baseChance: 1, coefficient: 0.1 }, { roll: 0 })
    apply(state, defs, enemy, 'chill', { baseChance: 1 }, { roll: 0, tags: ['magical'] })
    apply(state, defs, enemy, 'stun', { baseChance: 1 }, { roll: 0, tags: ['physical'] })
    apply(state, defs, enemy, 'expose', { baseChance: 1, resistanceMagnitude: 0.1 }, { roll: 0, tags: ['magical'] })
    const schools = state.log.filter((event) => event.type === 'statusAttempt')
    trace('schools', schools.map((event) => (event.type === 'statusAttempt' ? [event.statusId, event.school, event.resistance] : [])))
    expect(schools[0]).toMatchObject({ statusId: 'poison', school: 'physical', resistance: 12 })
    expect(schools[1]).toMatchObject({ statusId: 'chill', school: 'magical', resistance: 3 })
    expect(schools[2]).toMatchObject({ statusId: 'stun', school: 'physical', resistance: 12 })
    expect(schools[3]).toMatchObject({ statusId: 'expose', school: 'magical', resistance: 3 })
    expect(() => apply(state, defs, enemy, 'stun', { baseChance: 1 }, { roll: 0, tags: ['attack'] })).toThrow(
      /one physical or magical tag/,
    )
  })

  it('applies Mark without a roll', () => {
    const { state, defs, enemy } = start()
    enemy.vitality = 400
    enemy.spirit = 400
    const before = { ...state.rng }
    apply(state, defs, enemy, 'mark', { baseChance: 0, durationSeconds: 8 })
    const boss = start()
    boss.enemy.boss = true
    apply(boss.state, boss.defs, boss.enemy, 'mark', { baseChance: 0, durationSeconds: 8 })
    const attempt = state.log.find((event) => event.type === 'statusAttempt')
    trace('mark', { attempt, rng: state.rng, bossExpires: boss.enemy.statuses.mark?.expiresMs })
    expect(state.rng).toEqual(before)
    expect(attempt).toMatchObject({ result: 'guaranteed', roll: null, statusId: 'mark' })
    expect(enemy.statuses.mark?.expiresMs).toBe(8000)
    expect(boss.enemy.statuses.mark?.expiresMs).toBe(4000)
  })
})

describe('contact statuses', () => {
  it('blocks Bleed and Poison when a barrier absorbs the hit, and lets magical statuses through', () => {
    const cut: SkillDef = {
      id: 'cut',
      name: 'Cut',
      cost: 0,
      cooldownSeconds: 0,
      actionTimeCoefficient: 1,
      tags: ['physical'],
      target: 'single',
      effects: [
        { kind: 'damage', school: 'physical', coefficient: 0.2 },
        { kind: 'applyStatus', statusId: 'bleed', baseChance: 1, coefficient: 0.1 },
        { kind: 'applyStatus', statusId: 'poison', baseChance: 1, coefficient: 0.12 },
      ],
    }
    const blocked = start({ skills: [cut], equipped: ['cut'], rows: [{ skillId: 'cut' }] })
    blocked.enemy.barrier = 1_000_000
    blocked.enemy.barrierExpiresMs = 1_000_000
    while (blocked.state.log.every((event) => event.type !== 'action')) stepCombat(blocked.state, blocked.defs)
    const blockedAttempts = blocked.state.log.filter((event) => event.type === 'statusAttempt')
    trace('contact block', {
      bleed: blocked.enemy.statuses.bleed,
      poison: blocked.enemy.statuses.poison,
      hp: blocked.enemy.hp,
      attempts: blockedAttempts,
    })
    expect(blocked.enemy.hp).toBe(blocked.enemy.maxHp)
    expect(blocked.enemy.statuses.bleed).toBeNull()
    expect(blocked.enemy.statuses.poison).toBeNull()
    expect(blockedAttempts).toEqual([
      expect.objectContaining({ result: 'contact', roll: null, statusId: 'bleed' }),
      expect.objectContaining({ result: 'contact', roll: null, statusId: 'poison' }),
    ])

    const { state, defs, enemy } = start()
    enemy.barrier = 1_000_000
    enemy.barrierExpiresMs = 1_000_000
    const before = { ...state.rng }
    apply(state, defs, enemy, 'poison', { baseChance: 1, coefficient: 0.1 }, { applyingHit: true, hpDamageDealt: 0 })
    expect(state.rng).toEqual(before)
    expect(enemy.statuses.poison).toBeNull()
    apply(state, defs, enemy, 'burn', { baseChance: 1, coefficient: 0.1 }, {
      roll: 0,
      tags: ['magical'],
      applyingHit: true,
      hpDamageDealt: 0,
    })
    expect(enemy.statuses.burn?.intensity).toBe(1)
    expect(enemy.barrier).toBe(1_000_000)
    const ready = enemy.nextReadyMs
    apply(state, defs, enemy, 'chill', { baseChance: 1 }, { roll: 0, tags: ['magical'], applyingHit: true, hpDamageDealt: 0 })
    apply(state, defs, enemy, 'stun', { baseChance: 1 }, { roll: 0, tags: ['physical'], applyingHit: true, hpDamageDealt: 0 })
    apply(
      state,
      defs,
      enemy,
      'expose',
      { baseChance: 1, armorMagnitude: 0.2 },
      { roll: 0, tags: ['magical'], applyingHit: true, hpDamageDealt: 0 },
    )
    apply(state, defs, enemy, 'mark', { baseChance: 0, durationSeconds: 8 }, { applyingHit: true, hpDamageDealt: 0 })
    trace('through barrier', {
      chill: enemy.statuses.chill?.stacks,
      stunReady: enemy.nextReadyMs,
      expose: enemy.statuses.expose?.armorMagnitude,
      mark: enemy.statuses.mark?.expiresMs,
      barrier: enemy.barrier,
    })
    expect(enemy.statuses.chill?.stacks).toBe(1)
    expect(enemy.nextReadyMs).toBe(ready + 1500)
    expect(enemy.statuses.expose?.armorMagnitude).toBe(0.2)
    expect(enemy.statuses.mark?.expiresMs).toBe(8000)
    expect(enemy.barrier).toBe(1_000_000)

    const nick: SkillDef = {
      id: 'nick',
      name: 'Nick',
      cost: 0,
      cooldownSeconds: 0,
      actionTimeCoefficient: 1,
      tags: ['physical'],
      target: 'single',
      effects: [
        { kind: 'damage', school: 'physical', coefficient: 1 },
        { kind: 'applyStatus', statusId: 'bleed', baseChance: 1, coefficient: 0.1 },
      ],
    }
    const partial = start({ skills: [nick], equipped: ['nick'], rows: [{ skillId: 'nick' }] })
    partial.enemy.barrier = 1
    partial.enemy.barrierExpiresMs = 1_000_000
    while (partial.state.log.every((event) => event.type !== 'action')) stepCombat(partial.state, partial.defs)
    const nickAttempt = partial.state.log.find((event) => event.type === 'statusAttempt')
    const nickHit = partial.state.log.find((event) => event.type === 'damage')
    trace('partial barrier', { hp: partial.enemy.hp, barrier: partial.enemy.barrier, nickAttempt, nickHit })
    expect(nickHit && nickHit.type === 'damage' ? nickHit.hpDamage : 0).toBeGreaterThan(0)
    expect(partial.enemy.barrier).toBe(0)
    expect(nickAttempt).toMatchObject({ statusId: 'bleed', roll: expect.any(Number) })
    expect(nickAttempt && nickAttempt.type === 'statusAttempt' ? nickAttempt.result : '').not.toBe('contact')
  })
})

describe('bleed', () => {
  it('caps ordinary targets at 5 stacks and each stack lasts 3 target actions', () => {
    const { state, defs, enemy } = start({
      enemies: [dummy({ maxHp: 1_000_000, power: 0, actionTime: 1 })],
    })
    for (let index = 0; index < 6; index += 1) {
      apply(state, defs, enemy, 'bleed', { baseChance: 1, coefficient: 0.01 }, { roll: 0 })
    }
    const capped = enemy.statuses.bleed
    expect(capped?.stacks).toHaveLength(5)
    expect(state.log.filter((event) => event.type === 'statusAttempt' && event.result === 'cap')).toHaveLength(1)

    const duration = start({ enemies: [dummy({ maxHp: 1_000_000, power: 0, actionTime: 1 })] })
    apply(duration.state, duration.defs, duration.enemy, 'bleed', { baseChance: 1, coefficient: 0.01 }, { roll: 0 })
    advance(duration.state, duration.defs, 1000)
    const afterOne = duration.enemy.statuses.bleed
    trace('bleed one action', {
      remaining: afterOne?.stacks[0]?.actionsRemaining,
      ticks: tickEvents(duration.state, 'bleed').length,
    })
    expect(afterOne?.stacks[0]?.actionsRemaining).toBe(2)
    advance(duration.state, duration.defs, 4000)
    expect(tickEvents(duration.state, 'bleed')).toHaveLength(3)
    expect(duration.enemy.statuses.bleed).toBeNull()
  })

  it('caps bosses at 3 Bleed stacks', () => {
    const { state, defs, enemy } = start()
    enemy.boss = true
    for (let index = 0; index < 4; index += 1) {
      apply(state, defs, enemy, 'bleed', { baseChance: 1, coefficient: 0.1 }, { roll: 0 })
    }
    trace('bleed boss cap', { stacks: enemy.statuses.bleed?.stacks.length, actions: enemy.statuses.bleed?.stacks[0]?.actionsRemaining })
    expect(enemy.statuses.bleed?.stacks).toHaveLength(3)
    expect(enemy.statuses.bleed?.stacks[0]?.actionsRemaining).toBe(3)
  })

  it('ticks sooner on a faster target', () => {
    const fast = dummy({ maxHp: 1_000_000, power: 0, actionTime: 1 }, 'fast', 'Fast')
    const slow = dummy({ maxHp: 1_000_000, power: 0, actionTime: 3 }, 'slow', 'Slow')
    const { state, defs } = start({
      enemies: [fast, slow],
      slots: [
        { defId: 'fast', slot: 0 },
        { defId: 'slow', slot: 1 },
      ],
    })
    const quick = state.enemies[0]
    const late = state.enemies[1]
    if (quick === undefined || late === undefined) throw new Error('missing enemies')
    apply(state, defs, quick, 'bleed', { baseChance: 1, coefficient: 0.01 }, { roll: 0 })
    apply(state, defs, late, 'bleed', { baseChance: 1, coefficient: 0.01 }, { roll: 0 })
    runCombat(state, defs, 3000)
    const quickTicks = tickEvents(state, 'bleed', quick.id).length
    const lateTicks = tickEvents(state, 'bleed', late.id).length
    trace('bleed speed', { quick: quick.id, quickTicks, late: late.id, lateTicks, quickReady: quick.actionTimeMs, lateReady: late.actionTimeMs })
    expect(quick.actionTimeMs).toBeLessThan(late.actionTimeMs)
    expect(quickTicks).toBeGreaterThan(lateTicks)
    expect(quickTicks).toBe(3)
    expect(lateTicks).toBe(1)
  })
})

describe('poison', () => {
  it('shares an 8 second duration, refreshes it, and ticks the combined stacks every 2 seconds', () => {
    const { state, defs, enemy } = start()
    for (let index = 0; index < 6; index += 1) {
      apply(state, defs, enemy, 'poison', { baseChance: 1, coefficient: 0.12 }, { roll: 0, timeMs: index === 5 ? 500 : 0 })
    }
    const capped = enemy.statuses.poison
    trace('poison cap and refresh', { stacks: capped?.stacks.length, expires: capped?.expiresMs })
    expect(capped?.stacks).toHaveLength(5)
    expect(capped?.expiresMs).toBe(8500)

    const ticking = start()
    apply(ticking.state, ticking.defs, ticking.enemy, 'poison', { baseChance: 1, coefficient: 0.12 }, { roll: 0 })
    apply(ticking.state, ticking.defs, ticking.enemy, 'poison', { baseChance: 1, coefficient: 0.12 }, { roll: 0 })
    expect(ticking.enemy.statuses.poison?.nextTickMs).toBe(2000)
    runCombat(ticking.state, ticking.defs, 8000)
    const ticks = tickEvents(ticking.state, 'poison')
    trace('poison ticks', ticks.map((tick) => tick.timeMs))
    expect(ticks.map((tick) => tick.timeMs)).toEqual([2000, 4000, 6000])
    expect(ticks[0]?.stacks).toBe(2)
    expect(ticks[0]?.raw).toBeCloseTo(ticking.state.hero.physicalPower * 0.12 * 2, 8)
    expect(ticks.some((tick) => tick.timeMs === 8000)).toBe(false)
    expect(
      ticking.state.log.some((event) => event.type === 'statusExpired' && event.statusId === 'poison' && event.timeMs === 8000),
    ).toBe(true)
  })

  it('caps bosses at 3 Poison stacks and 4 seconds', () => {
    const { state, defs, enemy } = start()
    enemy.boss = true
    for (let index = 0; index < 4; index += 1) {
      apply(state, defs, enemy, 'poison', { baseChance: 1, coefficient: 0.12 }, { roll: 0 })
    }
    trace('poison boss', { stacks: enemy.statuses.poison?.stacks.length, expires: enemy.statuses.poison?.expiresMs })
    expect(enemy.statuses.poison?.stacks).toHaveLength(3)
    expect(enemy.statuses.poison?.expiresMs).toBe(4000)
    runCombat(state, defs, 4000)
    expect(tickEvents(state, 'poison').map((tick) => tick.timeMs)).toEqual([2000])
    expect(enemy.statuses.poison).toBeNull()
  })
})

describe('burn', () => {
  it('raises intensity up to 5, refreshes 5 seconds, and ticks every second', () => {
    const { state, defs, enemy } = start()
    for (let index = 0; index < 6; index += 1) {
      apply(state, defs, enemy, 'burn', { baseChance: 1, coefficient: 0.1 }, { roll: 0, timeMs: index === 5 ? 250 : 0 })
    }
    const raised = enemy.statuses.burn
    trace('burn', { intensity: raised?.intensity, expires: raised?.expiresMs })
    expect(raised?.intensity).toBe(5)
    expect(raised?.expiresMs).toBe(5250)
    const ticking = start()
    apply(ticking.state, ticking.defs, ticking.enemy, 'burn', { baseChance: 1, coefficient: 0.1 }, { roll: 0 })
    runCombat(ticking.state, ticking.defs, 5000)
    const burnTicks = tickEvents(ticking.state, 'burn')
    expect(burnTicks.map((tick) => tick.timeMs)).toEqual([1000, 2000, 3000, 4000])
    expect(burnTicks[0]?.intensity).toBe(1)
  })

  it('caps boss Burn intensity at 3 and duration at 2.5 seconds', () => {
    const { state, defs, enemy } = start()
    enemy.boss = true
    for (let index = 0; index < 4; index += 1) {
      apply(state, defs, enemy, 'burn', { baseChance: 1, coefficient: 0.1 }, { roll: 0 })
    }
    trace('burn boss', { intensity: enemy.statuses.burn?.intensity, expires: enemy.statuses.burn?.expiresMs })
    expect(enemy.statuses.burn?.intensity).toBe(3)
    expect(enemy.statuses.burn?.expiresMs).toBe(2500)
    runCombat(state, defs, 2500)
    const ticks = tickEvents(state, 'burn')
    expect(ticks.map((tick) => tick.timeMs)).toEqual([1000, 2000])
    expect(ticks[0]?.intensity).toBe(3)
    expect(enemy.statuses.burn).toBeNull()
  })
})

describe('chill', () => {
  it('slows by 10%, then 7%, then 5%, and refreshes a shared 6 second duration', () => {
    const { state, defs, enemy } = start()
    apply(state, defs, enemy, 'chill', { baseChance: 1 }, { roll: 0 })
    expect(chillSlowForStacks(enemy.statuses.chill?.slowByStack ?? [], enemy.statuses.chill?.stacks ?? 0)).toBeCloseTo(0.1, 10)
    apply(state, defs, enemy, 'chill', { baseChance: 1 }, { roll: 0 })
    expect(chillSlowForStacks(enemy.statuses.chill?.slowByStack ?? [], enemy.statuses.chill?.stacks ?? 0)).toBeCloseTo(0.17, 10)
    apply(state, defs, enemy, 'chill', { baseChance: 1 }, { roll: 0, timeMs: 400 })
    expect(enemy.statuses.chill?.stacks).toBe(3)
    expect(chillSlowForStacks(enemy.statuses.chill?.slowByStack ?? [], 3)).toBeCloseTo(0.22, 10)
    expect(slowedActionMs(2200, 0.1)).toBe(2444)
    expect(slowedActionMs(2200, 0.17)).toBe(2651)
    expect(slowedActionMs(2200, 0.22)).toBe(2821)
    expect(enemy.statuses.chill?.expiresMs).toBe(6400)
    const ready = enemy.nextReadyMs
    apply(state, defs, enemy, 'chill', { baseChance: 1 }, { roll: 0, timeMs: 400 })
    trace('chill cap', { stacks: enemy.statuses.chill?.stacks, ready, still: enemy.nextReadyMs })
    expect(enemy.statuses.chill?.stacks).toBe(3)
    expect(enemy.nextReadyMs).toBe(ready)
  })

  it('caps bosses at 2 Chill stacks and 3 seconds', () => {
    const { state, defs, enemy } = start()
    enemy.boss = true
    for (let index = 0; index < 3; index += 1) {
      apply(state, defs, enemy, 'chill', { baseChance: 1 }, { roll: 0 })
    }
    trace('chill boss', { stacks: enemy.statuses.chill?.stacks, expires: enemy.statuses.chill?.expiresMs })
    expect(enemy.statuses.chill?.stacks).toBe(2)
    expect(enemy.statuses.chill?.expiresMs).toBe(3000)
    expect(chillSlowForStacks(enemy.statuses.chill?.slowByStack ?? [], 2)).toBeCloseTo(0.17, 10)
  })

  it('does not move an action that is already scheduled', () => {
    const { state, defs, enemy } = start()
    const ready = enemy.nextReadyMs
    const actionMs = enemy.actionTimeMs
    apply(state, defs, enemy, 'chill', { baseChance: 1 }, { roll: 0 })
    expect(enemy.nextReadyMs).toBe(ready)
    while (state.outcome === 'ongoing' && state.log.every((event) => event.type !== 'action' || event.actorId !== enemy.id)) {
      stepCombat(state, defs)
    }
    const action = state.log.find((event) => event.type === 'action' && event.actorId === enemy.id)
    const slow = chillSlowForStacks(SLOWS, 1)
    trace('chill schedule', { ready, action, slow, actionMs })
    expect(action).toMatchObject({
      timeMs: ready,
      nextReadyMs: ready + slowedActionMs(actionMs, slow),
    })
    expect(action && action.type === 'action' ? action.nextReadyMs : 0).toBeGreaterThan(ready + actionMs)
  })
})

describe('stun', () => {
  it('pushes the next action 1.5 seconds later and does not freeze cooldowns', () => {
    const strike: SkillDef = {
      id: 'strike',
      name: 'Strike',
      cost: 0,
      cooldownSeconds: 3,
      actionTimeCoefficient: 1,
      tags: ['physical'],
      target: 'single',
      effects: [{ kind: 'damage', school: 'physical', coefficient: 0.1 }],
    }
    const { state, defs } = start({
      skills: [strike],
      equipped: ['strike'],
      rows: [{ skillId: 'strike' }],
    })
    while (state.log.every((event) => event.type !== 'action')) stepCombat(state, defs)
    const ready = state.hero.nextReadyMs
    const cooldown = state.hero.cooldowns[strike.id]
    apply(state, defs, state.hero, 'stun', { baseChance: 1 }, { roll: 0 })
    trace('stun', { ready, delayed: state.hero.nextReadyMs, cooldown, still: state.hero.cooldowns[strike.id] })
    expect(stunDelayMs(1.5, false)).toBe(1500)
    expect(state.hero.nextReadyMs).toBe(ready + 1500)
    expect(state.hero.cooldowns[strike.id]).toBe(cooldown)
    expect(skillOffCooldown(state.hero, strike, cooldown ?? 0)).toBe(true)
    expect(cleanseStatus(state, state.hero, state.timeMs)).toBeNull()
    expect(state.hero.nextReadyMs).toBe(ready + 1500)
    let guard = 0
    while (state.log.filter((event) => event.type === 'action' && event.actorId === state.hero.id).length < 2 && guard < 2000) {
      stepCombat(state, defs)
      guard += 1
    }
    const actions = state.log.filter((event) => event.type === 'action' && event.actorId === state.hero.id)
    expect(actions[1]).toMatchObject({ timeMs: ready + 1500 })
  })

  it('delays a boss by 0.525 seconds', () => {
    const { state, defs, enemy } = start()
    enemy.boss = true
    const ready = enemy.nextReadyMs
    apply(state, defs, enemy, 'stun', { baseChance: 1 }, { roll: 0 })
    trace('stun boss', { ready, delayed: enemy.nextReadyMs, delay: stunDelayMs(1.5, true) })
    expect(stunDelayMs(1.5, true)).toBe(525)
    expect(enemy.nextReadyMs).toBe(ready + 525)
  })
})

describe('expose', () => {
  it('keeps only the strongest Armor and Resistance reductions and refreshes 8 seconds', () => {
    const { state, defs, enemy } = start()
    enemy.armor = 100
    enemy.resistance = 80
    apply(state, defs, enemy, 'expose', { baseChance: 1, armorMagnitude: 0.2 }, { roll: 0 })
    apply(
      state,
      defs,
      enemy,
      'expose',
      { baseChance: 1, armorMagnitude: 0.1, resistanceMagnitude: 0.25 },
      { roll: 0, tags: ['magical'], timeMs: 1000 },
    )
    trace('expose', enemy.statuses.expose)
    expect(enemy.statuses.expose?.armorMagnitude).toBe(0.2)
    expect(enemy.statuses.expose?.resistanceMagnitude).toBe(0.25)
    expect(enemy.statuses.expose?.expiresMs).toBe(9000)
    apply(
      state,
      defs,
      enemy,
      'expose',
      { baseChance: 1, armorMagnitude: 0.05, resistanceMagnitude: 0.05 },
      { roll: 0, timeMs: 2000 },
    )
    expect(enemy.statuses.expose?.armorMagnitude).toBe(0.2)
    expect(enemy.statuses.expose?.resistanceMagnitude).toBe(0.25)
    expect(enemy.statuses.expose?.expiresMs).toBe(10000)
    while (state.log.every((event) => event.type !== 'damage')) stepCombat(state, defs)
    const damage = state.log.find((event) => event.type === 'damage')
    expect(damage).toMatchObject({ defense: 80 })
  })

  it('lasts 4 seconds on a boss', () => {
    const { state, defs, enemy } = start()
    enemy.boss = true
    apply(state, defs, enemy, 'expose', { baseChance: 1, armorMagnitude: 0.2 }, { roll: 0 })
    trace('expose boss', enemy.statuses.expose)
    expect(enemy.statuses.expose?.expiresMs).toBe(4000)
    expect(enemy.statuses.expose?.armorMagnitude).toBe(0.2)
  })
})

describe('damage over time', () => {
  it('snapshots power, penetration, and coefficient, then uses current Defense with no variance and no crit', () => {
    const { state, defs, enemy } = start()
    const power = state.hero.physicalPower
    const penetration = state.hero.armorPenetration
    apply(state, defs, enemy, 'poison', { baseChance: 1, coefficient: 0.12 }, { roll: 0, potency: 40 })
    state.hero.physicalPower = 1
    state.hero.armorPenetration = 0
    enemy.armor = 50
    advance(state, defs, 2000)
    const first = tickEvents(state, 'poison')[0]
    const expected = mitigateStatusDamage(power * 0.12, penetration, 50, state.hero.level)
    enemy.armor = 0
    advance(state, defs, 4000)
    const second = tickEvents(state, 'poison')[1]
    const open = mitigateStatusDamage(power * 0.12, penetration, 0, state.hero.level)
    trace('snapshot', { first, second, expected, open })
    expect(first).toMatchObject({
      power,
      penetration,
      coefficient: 0.12,
      defense: 50,
      crit: false,
      varianceRoll: false,
      hpDamage: expected.hpDamage,
      reduction: expected.reduction,
    })
    expect(second?.defense).toBe(0)
    expect(second?.power).toBe(power)
    expect(second?.hpDamage).toBe(open.hpDamage)
    expect(second?.hpDamage).toBeGreaterThan(first?.hpDamage ?? 0)
    if (first !== undefined) expect(formatEvent(first)).toContain('barrier bypassed')
    if (first !== undefined) expect(formatEvent(first)).toContain('no variance')
    if (first !== undefined) expect(formatEvent(first)).toContain('no critical')
  })

  it('bypasses a barrier that was already present when the DoT was applied', () => {
    const { state, defs, enemy } = start()
    enemy.barrier = 100_000
    enemy.barrierExpiresMs = 100_000
    apply(state, defs, enemy, 'poison', { baseChance: 1, coefficient: 0.12 }, { roll: 0, hpDamageDealt: 5 })
    expect(enemy.statuses.poison).not.toBeNull()
    while (state.timeMs < 1990 && state.outcome === 'ongoing') stepCombat(state, defs)
    const barrier = enemy.barrier
    const hp = enemy.hp
    stepCombat(state, defs)
    const tick = tickEvents(state, 'poison')[0]
    trace('barrier bypass', { barrierBefore: barrier, barrierAfter: enemy.barrier, hpBefore: hp, hpAfter: enemy.hp, tick })
    expect(enemy.barrier).toBe(barrier)
    expect(enemy.hp).toBe(hp - (tick?.hpDamage ?? 0))
    expect(tick?.barrierBypassed).toBe(true)
    expect(tick?.timeMs).toBe(2000)
  })
})

describe('cleanse', () => {
  it('removes the selected status and all of its stacks', () => {
    const { state, defs, enemy } = start()
    for (let index = 0; index < 4; index += 1) {
      apply(state, defs, enemy, 'poison', { baseChance: 1, coefficient: 0.1 }, { roll: 0 })
    }
    apply(state, defs, enemy, 'chill', { baseChance: 1 }, { roll: 0 })
    const removed = cleanseStatus(state, enemy, 50, 'poison')
    const cleared = state.log.find((event) => event.type === 'statusCleared')
    trace('cleanse selected', { removed, cleared, chill: enemy.statuses.chill?.stacks })
    expect(removed).toBe('poison')
    expect(enemy.statuses.poison).toBeNull()
    expect(enemy.statuses.chill?.stacks).toBe(1)
    expect(cleared).toMatchObject({ statusId: 'poison', stacks: 4, timeMs: 50 })
  })

  it('removes the highest-priority status and all of its stacks when none is selected', () => {
    const { state, defs, enemy } = start()
    apply(state, defs, enemy, 'poison', { baseChance: 1, coefficient: 0.1 }, { roll: 0 })
    apply(state, defs, enemy, 'bleed', { baseChance: 1, coefficient: 0.1 }, { roll: 0 })
    apply(state, defs, enemy, 'bleed', { baseChance: 1, coefficient: 0.1 }, { roll: 0 })
    const removed = cleanseStatus(state, enemy, 10)
    trace('cleanse priority', { removed, bleed: enemy.statuses.bleed, poison: enemy.statuses.poison?.stacks.length })
    expect(removed).toBe('bleed')
    expect(enemy.statuses.bleed).toBeNull()
    expect(enemy.statuses.poison?.stacks).toHaveLength(1)
    expect(state.log.find((event) => event.type === 'statusCleared')).toMatchObject({ statusId: 'bleed', stacks: 2 })
  })
})
