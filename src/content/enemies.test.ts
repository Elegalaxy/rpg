import { describe, expect, it } from 'vitest'

import { chooseHeroAction } from '../sim/automation.ts'
import { createCombat, runCombat, stepCombat } from '../sim/combat.ts'
import { CRIT_CHANCE_BASE, STUN_DELAY_SECONDS } from '../sim/constants.ts'
import { encounterXpAward, onEnemyHpChanged } from '../sim/enemyAi.ts'
import { createRng, nextFloat, type RngState } from '../sim/rng.ts'
import { effectiveEvasion, incomingDamageFactor } from '../sim/skills.ts'
import { deriveEnemyStats } from '../sim/stats.ts'
import { exposedDefense, stunDelayMs, tryApplyStatus } from '../sim/statuses.ts'
import type { CombatActor, CombatSetup, CombatState, GameDefs, SkillDef } from '../sim/types.ts'

import { referenceHeroes } from './heroes.ts'
import { gameDefs } from './scenarios.ts'

const STUN_SKILL: SkillDef = {
  id: 'test-stun',
  name: 'Test Stun',
  cost: 0,
  cooldownSeconds: 0,
  actionTimeCoefficient: 1,
  tags: ['physical'],
  target: 'single',
  effects: [{ kind: 'applyStatus', statusId: 'stun', baseChance: 1 }],
}

function open(enemies: CombatSetup['enemies'], seed = 1): { state: CombatState; defs: GameDefs } {
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
        enemies,
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

function hold(actor: CombatActor): void {
  actor.nextReadyMs = 1_000_000
}

function rngBeforeDraw(limit: number, skip: number): RngState {
  for (let seed = 1; seed < 200_000; seed += 1) {
    const probe = createRng(seed)
    for (let draw = 0; draw < skip; draw += 1) nextFloat(probe)
    const saved = { a: probe.a, b: probe.b, c: probe.c, d: probe.d }
    if (nextFloat(probe) < limit) return skip === 0 ? saved : createRng(seed)
  }
  throw new Error(`no roll below ${limit} after ${skip} draws`)
}

function rngHitThenCritRoll(): RngState {
  for (let seed = 1; seed < 200_000; seed += 1) {
    const probe = createRng(seed)
    const hit = nextFloat(probe)
    nextFloat(probe)
    nextFloat(probe)
    const crit = nextFloat(probe)
    if (hit < 0.5 && crit < CRIT_CHANCE_BASE) return createRng(seed)
  }
  throw new Error('no basic-attack roll that hits and would crit')
}

function rngCritThenStatus(): RngState {
  for (let seed = 1; seed < 200_000; seed += 1) {
    const probe = createRng(seed)
    nextFloat(probe)
    nextFloat(probe)
    const crit = nextFloat(probe)
    const status = nextFloat(probe)
    if (crit < CRIT_CHANCE_BASE && status < 0.95) return createRng(seed)
  }
  throw new Error('no crit roll below 0.05 followed by a status roll below 0.95')
}

function rngAtOrAbove(limit: number, skip: number): RngState {
  for (let seed = 1; seed < 200_000; seed += 1) {
    const probe = createRng(seed)
    for (let draw = 0; draw < skip; draw += 1) nextFloat(probe)
    const saved = { a: probe.a, b: probe.b, c: probe.c, d: probe.d }
    if (nextFloat(probe) >= limit) return skip === 0 ? saved : createRng(seed)
  }
  throw new Error(`no roll at or above ${limit} after ${skip} draws`)
}

function stepUntil(state: CombatState, defs: GameDefs, done: () => boolean, limitMs = 30_000): void {
  const start = state.timeMs
  while (!done() && state.outcome === 'ongoing' && state.timeMs < start + limitMs) {
    stepCombat(state, defs)
  }
}

describe('Blight Spider', () => {
  it('applies Venom Bite poison from snapshotted Physical Power', () => {
    const { state, defs } = open([{ defId: 'blight-spider', slot: 0, level: 8 }])
    const enemy = actorAt(state, 0)
    enemy.cooldowns['web-snare'] = 1_000_000
    enemy.nextReadyMs = 10
    hold(state.hero)
    state.hero.vitality = 0
    state.hero.physicalStatusResistance = 0
    state.hero.armor = 0
    state.rng = rngBeforeDraw(0.7, 3)
    stepUntil(state, defs, () => state.log.some((event) => event.type === 'action' && event.skillId === 'venom-bite'))
    const attempt = state.log.find((event) => event.type === 'statusAttempt' && event.statusId === 'poison')
    const hit = state.log.find((event) => event.type === 'damage' && event.actorId === enemy.id)
    const stack = state.hero.statuses.poison?.stacks[0]
    console.log('[enemy] venom bite', { attempt, hit, stack, power: enemy.power })
    expect(state.log.some((event) => event.type === 'hitRoll' && event.actorId === enemy.id)).toBe(false)
    expect(hit).toMatchObject({ coefficient: 0.85, school: 'physical', critChance: 0, crit: false })
    const bite = state.log.find((event) => event.type === 'action' && event.skillId === 'venom-bite')
    expect(bite?.type).toBe('action')
    if (bite?.type === 'action') expect(enemy.cooldowns['venom-bite']).toBe(bite.timeMs + 4000)
    if (hit?.type === 'damage') expect(hit.hpDamage).toBeGreaterThan(0)
    expect(attempt).toMatchObject({ result: 'applied', baseChance: 0.7, school: 'physical' })
    expect(stack).toMatchObject({ coefficient: 0.1, power: enemy.power })
    const snapshotted = stack?.power ?? 0
    enemy.power += 50
    enemy.nextReadyMs = 1_000_000
    stepUntil(state, defs, () => state.log.some((event) => event.type === 'statusTick' && event.statusId === 'poison'))
    const tick = state.log.find((event) => event.type === 'statusTick' && event.statusId === 'poison')
    console.log('[enemy] poison tick', { tick, snapshotted, powerNow: enemy.power })
    expect(tick).toMatchObject({
      school: 'physical',
      power: snapshotted,
      coefficient: 0.1,
      stacks: 1,
      crit: false,
      varianceRoll: false,
    })
    if (tick?.type === 'statusTick') expect(tick.raw).toBeCloseTo(snapshotted * 0.1, 10)
  })

  it('applies Web Snare only when the physical chance succeeds', () => {
    const success = open([{ defId: 'blight-spider', slot: 0, level: 8 }])
    const spider = actorAt(success.state, 0)
    spider.cooldowns['venom-bite'] = 1_000_000
    spider.nextReadyMs = 10
    hold(success.state.hero)
    success.state.hero.vitality = 0
    success.state.hero.physicalStatusResistance = 0
    const readyBefore = success.state.hero.nextReadyMs
    success.state.rng = rngBeforeDraw(0.5, 0)
    stepUntil(success.state, success.defs, () =>
      success.state.log.some((event) => event.type === 'statusAttempt' && event.statusId === 'web-snare'),
    )
    const applied = success.state.log.find((event) => event.type === 'statusAttempt' && event.statusId === 'web-snare')
    console.log('[enemy] web snare success', {
      applied,
      nextReadyMs: success.state.hero.nextReadyMs,
      timedEvasion: success.state.hero.timedEvasion,
      expiresMs: success.state.hero.timedEvasionExpiresMs,
    })
    expect(applied).toMatchObject({ result: 'applied', baseChance: 0.8, school: 'physical', chance: 0.8 })
    expect(success.state.hero.nextReadyMs).toBe(readyBefore + 1000)
    expect(success.state.hero.timedEvasion).toBe(-15)
    expect(success.state.hero.timedEvasionExpiresMs).toBe(10 + 4000)
    expect(effectiveEvasion(success.state.hero, 10)).toBe(success.state.hero.evasion - 15)

    const failure = open([{ defId: 'blight-spider', slot: 0, level: 8 }])
    const missed = actorAt(failure.state, 0)
    missed.cooldowns['venom-bite'] = 1_000_000
    missed.nextReadyMs = 10
    hold(failure.state.hero)
    failure.state.hero.vitality = 0
    failure.state.hero.physicalStatusResistance = 0
    const unchanged = failure.state.hero.nextReadyMs
    failure.state.rng = rngAtOrAbove(0.8, 0)
    stepUntil(failure.state, failure.defs, () =>
      failure.state.log.some((event) => event.type === 'statusAttempt' && event.statusId === 'web-snare'),
    )
    const resisted = failure.state.log.find((event) => event.type === 'statusAttempt' && event.statusId === 'web-snare')
    console.log('[enemy] web snare failure', { resisted, nextReadyMs: failure.state.hero.nextReadyMs })
    expect(resisted).toMatchObject({ result: 'resisted', baseChance: 0.8, chance: 0.8 })
    expect(failure.state.hero.nextReadyMs).toBe(unchanged)
    expect(failure.state.hero.timedEvasion).toBe(0)
    expect(failure.state.log.some((event) => event.type === 'actionDelay')).toBe(false)

    const clamped = open([{ defId: 'blight-spider', slot: 0, level: 8 }])
    const snared = actorAt(clamped.state, 0)
    snared.cooldowns['venom-bite'] = 1_000_000
    snared.nextReadyMs = 10
    hold(clamped.state.hero)
    clamped.state.hero.vitality = 0
    clamped.state.hero.physicalStatusResistance = 100
    clamped.state.rng = rngAtOrAbove(0.05, 0)
    stepUntil(clamped.state, clamped.defs, () =>
      clamped.state.log.some((event) => event.type === 'statusAttempt' && event.statusId === 'web-snare'),
    )
    const limited = clamped.state.log.find((event) => event.type === 'statusAttempt' && event.statusId === 'web-snare')
    console.log('[enemy] web snare clamp', limited)
    expect(limited).toMatchObject({ baseChance: 0.8, chance: 0.05, result: 'resisted' })
    expect(clamped.state.hero.timedEvasion).toBe(0)
  })
})

describe('Thornbeast', () => {
  it('regenerates 1% of maximum HP once per second', () => {
    const { state, defs } = open([{ defId: 'thornbeast', slot: 0, level: 10 }])
    const enemy = actorAt(state, 0)
    const missing = 50
    enemy.hp = enemy.maxHp - missing
    hold(enemy)
    hold(state.hero)
    stepCombat(state, defs)
    expect(state.log.some((event) => event.type === 'regen')).toBe(false)
    stepUntil(state, defs, () => state.timeMs >= 3000)
    const regens = state.log.filter((event) => event.type === 'regen')
    const gain = Math.min(missing, Math.round(enemy.maxHp * 0.01))
    console.log('[enemy] thornbeast regen', {
      maxHp: enemy.maxHp,
      times: regens.map((event) => (event.type === 'regen' ? event.timeMs : 0)),
      gain,
      hp: enemy.hp,
    })
    expect(regens.map((event) => (event.type === 'regen' ? event.timeMs : 0))).toEqual([1000, 2000, 3000])
    expect(regens[0]).toMatchObject({ fraction: 0.01, amount: gain, paused: false })
    expect(enemy.hp).toBe(enemy.maxHp - missing + gain * 3)
  })

  it('pauses regeneration while Burn is active, including when Expose is also present', () => {
    const { state, defs } = open([{ defId: 'thornbeast', slot: 0, level: 10 }])
    const enemy = actorAt(state, 0)
    enemy.hp = enemy.maxHp - 50
    hold(enemy)
    hold(state.hero)
    enemy.statuses.burn = {
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
    const before = enemy.hp
    stepUntil(state, defs, () => state.timeMs >= 1000)
    const paused = state.log.find((event) => event.type === 'regen')
    console.log('[enemy] burn pauses regen', { paused, hp: enemy.hp, before })
    expect(paused).toMatchObject({ timeMs: 1000, paused: true, amount: 0, fraction: 0 })
    expect(enemy.hp).toBe(before)

    enemy.statuses.expose = {
      name: 'Expose',
      expiresMs: 60_000,
      armorMagnitude: 0.2,
      resistanceMagnitude: 0,
    }
    stepUntil(state, defs, () => state.timeMs >= 2000)
    const both = state.log.filter((event) => event.type === 'regen')
    console.log('[enemy] burn wins over expose', both[1])
    expect(both[1]).toMatchObject({ timeMs: 2000, paused: true, amount: 0, fraction: 0 })
    expect(enemy.hp).toBe(before)
  })

  it('halves regeneration to 0.5% per second while Expose is active', () => {
    const { state, defs } = open([{ defId: 'thornbeast', slot: 0, level: 10 }])
    const enemy = actorAt(state, 0)
    enemy.hp = enemy.maxHp - 50
    hold(enemy)
    hold(state.hero)
    enemy.statuses.expose = {
      name: 'Expose',
      expiresMs: 60_000,
      armorMagnitude: 0.2,
      resistanceMagnitude: 0,
    }
    stepUntil(state, defs, () => state.timeMs >= 1000)
    const regen = state.log.find((event) => event.type === 'regen')
    const gain = Math.round(enemy.maxHp * 0.005)
    console.log('[enemy] expose halves regen', { regen, gain, maxHp: enemy.maxHp })
    expect(regen).toMatchObject({ fraction: 0.005, amount: gain, paused: false, hpAfter: enemy.maxHp - 50 + gain })
  })

  it('telegraphs Bramble Slam for 140% Physical Power without a crit', () => {
    const { state, defs } = open([{ defId: 'thornbeast', slot: 0, level: 10 }])
    const enemy = actorAt(state, 0)
    enemy.nextReadyMs = 10
    hold(state.hero)
    stepUntil(state, defs, () => enemy.telegraph !== null)
    const telegraph = enemy.telegraph
    expect(telegraph).not.toBeNull()
    if (telegraph === null) return
    console.log('[enemy] bramble slam', { telegraph, actionMs: enemy.actionTimeMs, nextReadyMs: enemy.nextReadyMs })
    expect(telegraph.resolvesAtMs - 10).toBe(1000)
    expect(enemy.nextReadyMs - telegraph.resolvesAtMs).toBe(enemy.actionTimeMs)
    const resolvesAt = telegraph.resolvesAtMs
    stepUntil(state, defs, () => state.log.some((event) => event.type === 'damage' && event.coefficient === 1.4))
    const hit = state.log.find((event) => event.type === 'damage' && event.actorId === enemy.id)
    console.log('[enemy] bramble hit', hit)
    expect(hit).toMatchObject({ coefficient: 1.4, school: 'physical', critChance: 0, crit: false })
    expect(state.log.some((event) => event.type === 'hitRoll' && event.actorId === enemy.id)).toBe(false)
    expect(enemy.cooldowns['bramble-slam']).toBe(resolvesAt + 6000)
    expect(enemy.telegraph).toBeNull()
  })
})

describe('Fracture Wisp', () => {
  it('uses 0.5× baseline Armor and 1.5× baseline Resistance', () => {
    const level = 12
    const { state } = open([{ defId: 'fracture-wisp', slot: 0, level }])
    const enemy = actorAt(state, 0)
    const baseline = 5 + 2 * level
    const replaced = deriveEnemyStats({
      level,
      archetype: 'burst',
      overrides: { armorMultiplier: 0.5, resistanceMultiplier: 1.5 },
    })
    const burst = deriveEnemyStats({ level, archetype: 'burst' })
    console.log('[enemy] wisp defense', {
      armor: enemy.armor,
      resistance: enemy.resistance,
      baseline,
      burstArmor: burst.armor,
      burstResistance: burst.resistance,
    })
    expect(enemy.school).toBe('magical')
    expect(enemy.armor).toBe(Math.round(baseline * 0.5))
    expect(enemy.resistance).toBe(Math.round(baseline * 1.5))
    expect(enemy.armor).toBe(replaced.armor)
    expect(enemy.resistance).toBe(replaced.resistance)
    expect(enemy.armor).not.toBe(burst.armor)
    expect(enemy.resistance).not.toBe(burst.resistance)
    expect(enemy.maxHp).toBe(burst.maxHp)
    expect(enemy.power).toBe(burst.power)
  })

  it('applies one Chill from Cold Spark at base chance 100 before the clamp', () => {
    const { state, defs } = open([{ defId: 'fracture-wisp', slot: 0, level: 12 }])
    const enemy = actorAt(state, 0)
    enemy.cooldowns['fracture-ray'] = 1_000_000
    enemy.nextReadyMs = 10
    hold(state.hero)
    state.hero.spirit = 0
    state.hero.magicalStatusResistance = 0
    state.hero.resistance = 0
    state.rng = rngBeforeDraw(0.5, 3)
    stepUntil(state, defs, () => state.log.some((event) => event.type === 'statusAttempt' && event.statusId === 'chill'))
    const attempt = state.log.find((event) => event.type === 'statusAttempt' && event.statusId === 'chill')
    const hit = state.log.find((event) => event.type === 'damage' && event.actorId === enemy.id)
    console.log('[enemy] cold spark', { attempt, chill: state.hero.statuses.chill, hit })
    expect(hit).toMatchObject({ coefficient: 1, school: 'magical', critChance: 0 })
    expect(attempt).toMatchObject({ result: 'applied', baseChance: 1, chance: 0.95, stacks: 1, school: 'magical' })
    expect(state.hero.statuses.chill).toMatchObject({ stacks: 1 })
  })

  it('telegraphs Fracture Ray for 180% Magical Power and can crit', () => {
    const { state, defs } = open([{ defId: 'fracture-wisp', slot: 0, level: 12 }])
    const enemy = actorAt(state, 0)
    enemy.cooldowns['cold-spark'] = 1_000_000
    enemy.nextReadyMs = 10
    hold(state.hero)
    stepUntil(state, defs, () => enemy.telegraph !== null)
    const telegraph = enemy.telegraph
    expect(telegraph).not.toBeNull()
    if (telegraph === null) return
    console.log('[enemy] fracture ray', { telegraph, nextReadyMs: enemy.nextReadyMs, actionMs: enemy.actionTimeMs })
    expect(telegraph.tag).toBe('fracture-ray')
    expect(telegraph.resolvesAtMs - 10).toBe(2000)
    expect(enemy.nextReadyMs - telegraph.resolvesAtMs).toBe(enemy.actionTimeMs)
    const resolvesAt = telegraph.resolvesAtMs
    stepUntil(state, defs, () => state.log.some((event) => event.type === 'damage' && event.coefficient === 1.8))
    const hit = state.log.find((event) => event.type === 'damage' && event.actorId === enemy.id)
    console.log('[enemy] fracture ray hit', hit)
    expect(hit).toMatchObject({
      coefficient: 1.8,
      school: 'magical',
      critChance: CRIT_CHANCE_BASE,
    })
    expect(state.log.some((event) => event.type === 'hitRoll' && event.actorId === enemy.id)).toBe(false)
    expect(enemy.cooldowns['fracture-ray']).toBe(resolvesAt + 9000)
  })
})

describe('Hollow Sentry', () => {
  it('uses 1.75× baseline Armor and 1.0× baseline Resistance', () => {
    const level = 10
    const { state } = open([{ defId: 'hollow-sentry', slot: 0, level }])
    const enemy = actorAt(state, 0)
    const baseline = 5 + 2 * level
    const tank = deriveEnemyStats({ level, archetype: 'tank' })
    console.log('[enemy] sentry defense', {
      armor: enemy.armor,
      resistance: enemy.resistance,
      baseline,
      tankArmor: tank.armor,
      tankResistance: tank.resistance,
    })
    expect(enemy.school).toBe('physical')
    expect(enemy.armor).toBe(Math.round(baseline * 1.75))
    expect(enemy.resistance).toBe(Math.round(baseline * 1))
    expect(enemy.armor).not.toBe(tank.armor)
    expect(enemy.resistance).not.toBe(tank.resistance)
    expect(enemy.maxHp).toBe(tank.maxHp)
    expect(enemy.power).toBe(tank.power)
  })

  it('puts Shield Wall on itself and the lowest-HP ally until its next action', () => {
    const mixed = open([
      { defId: 'hollow-sentry', slot: 0, level: 10 },
      { defId: 'dummy-standard-20', slot: 1 },
      { defId: 'dummy-standard-20', slot: 2 },
    ])
    const sentry = actorAt(mixed.state, 0)
    const higher = actorAt(mixed.state, 1)
    const lower = actorAt(mixed.state, 2)
    higher.hp = Math.floor(higher.maxHp * 0.8)
    lower.hp = Math.floor(lower.maxHp * 0.4)
    sentry.nextReadyMs = 10
    hold(higher)
    hold(lower)
    hold(mixed.state.hero)
    stepUntil(mixed.state, mixed.defs, () => sentry.damageReduction > 0)
    console.log('[enemy] shield wall', {
      sentry: sentry.damageReduction,
      higher: { slot: higher.slot, hp: higher.hp, reduction: higher.damageReduction },
      lower: { slot: lower.slot, hp: lower.hp, reduction: lower.damageReduction, source: lower.damageReductionSourceId },
    })
    expect(sentry.damageReduction).toBeCloseTo(0.35, 10)
    expect(sentry.damageReductionSourceId).toBeNull()
    expect(lower.damageReduction).toBeCloseTo(0.35, 10)
    expect(lower.damageReductionSourceId).toBe(sentry.id)
    expect(higher.damageReduction).toBe(0)
    expect(incomingDamageFactor(sentry)).toBeCloseTo(0.65, 10)
    expect(incomingDamageFactor(lower)).toBeCloseTo(0.65, 10)
    expect(incomingDamageFactor(higher)).toBeCloseTo(1, 10)
    sentry.hp = 50_000
    sentry.maxHp = 50_000
    mixed.state.hero.nextReadyMs = mixed.state.timeMs + 10
    mixed.state.rng = rngBeforeDraw(0.05, 0)
    stepCombat(mixed.state, mixed.defs)
    const guarded = mixed.state.log.find((event) => event.type === 'damage' && event.targetId === sentry.id)
    console.log('[enemy] shield wall hit', guarded?.type === 'damage' ? guarded.incomingModifier : null)
    expect(guarded).toMatchObject({ incomingModifier: 0.65 })
    hold(mixed.state.hero)
    const sentryReady = sentry.nextReadyMs
    lower.nextReadyMs = mixed.state.timeMs + 10
    stepUntil(mixed.state, mixed.defs, () =>
      mixed.state.log.some((event) => event.type === 'action' && event.actorId === lower.id),
    )
    expect(lower.damageReduction).toBeCloseTo(0.35, 10)
    expect(mixed.state.timeMs).toBeLessThan(sentryReady)
    stepUntil(mixed.state, mixed.defs, () => sentry.damageReduction === 0 && lower.damageReduction === 0)
    console.log('[enemy] shield wall ended', {
      timeMs: mixed.state.timeMs,
      sentryReady,
      sentry: sentry.damageReduction,
      lower: lower.damageReduction,
    })
    expect(sentry.damageReduction).toBe(0)
    expect(lower.damageReduction).toBe(0)
    const ownEnd = mixed.state.log.find((event) => event.type === 'buffEnded' && event.actorId === sentry.id)
    const allyEnd = mixed.state.log.find(
      (event) => event.type === 'buffEnded' && event.actorId === lower.id && event.reason === 'granted',
    )
    console.log('[enemy] shield wall end times', { ownEnd, allyEnd, sentryReady })
    expect(ownEnd?.type).toBe('buffEnded')
    expect(allyEnd?.type).toBe('buffEnded')
    if (ownEnd?.type === 'buffEnded') {
      expect(ownEnd.timeMs).toBe(sentryReady)
      expect(ownEnd.damageReduction).toBeCloseTo(0.35, 10)
    }
    if (allyEnd?.type === 'buffEnded') {
      expect(allyEnd.timeMs).toBe(sentryReady)
      expect(allyEnd.damageReduction).toBeCloseTo(0.35, 10)
    }

    const tied = open([
      { defId: 'hollow-sentry', slot: 0, level: 10 },
      { defId: 'dummy-standard-20', slot: 1 },
      { defId: 'dummy-standard-20', slot: 2 },
    ])
    const tiedSentry = actorAt(tied.state, 0)
    const first = actorAt(tied.state, 1)
    const second = actorAt(tied.state, 2)
    first.hp = Math.floor(first.maxHp * 0.5)
    second.hp = first.hp
    tiedSentry.nextReadyMs = 10
    hold(first)
    hold(second)
    hold(tied.state.hero)
    stepUntil(tied.state, tied.defs, () => tiedSentry.damageReduction > 0)
    console.log('[enemy] shield wall tie', {
      first: first.damageReduction,
      second: second.damageReduction,
    })
    expect(first.damageReduction).toBeCloseTo(0.35, 10)
    expect(second.damageReduction).toBe(0)

    const alone = open([{ defId: 'hollow-sentry', slot: 0, level: 10 }])
    const solo = actorAt(alone.state, 0)
    solo.nextReadyMs = 10
    hold(alone.state.hero)
    stepUntil(alone.state, alone.defs, () => solo.damageReduction > 0)
    console.log('[enemy] shield wall solo', { reduction: solo.damageReduction })
    expect(solo.damageReduction).toBeCloseTo(0.35, 10)
    expect(alone.state.log.some((event) => event.type === 'skillSkip')).toBe(false)

    const byPercent = open([
      { defId: 'hollow-sentry', slot: 0, level: 10 },
      { defId: 'dummy-standard-20', slot: 1 },
      { defId: 'dummy-standard-20', slot: 2 },
    ])
    const percentSentry = actorAt(byPercent.state, 0)
    const bulky = actorAt(byPercent.state, 1)
    const frail = actorAt(byPercent.state, 2)
    percentSentry.hp = Math.floor(percentSentry.maxHp * 0.1)
    bulky.maxHp = 1000
    bulky.hp = 400
    frail.maxHp = 200
    frail.hp = 100
    percentSentry.nextReadyMs = 10
    hold(bulky)
    hold(frail)
    hold(byPercent.state.hero)
    stepUntil(byPercent.state, byPercent.defs, () => percentSentry.damageReduction > 0)
    console.log('[enemy] shield wall percent', {
      sentryPercent: percentSentry.hp / percentSentry.maxHp,
      bulky: { hp: bulky.hp, maxHp: bulky.maxHp, reduction: bulky.damageReduction },
      frail: { hp: frail.hp, maxHp: frail.maxHp, reduction: frail.damageReduction },
    })
    expect(percentSentry.damageReduction).toBeCloseTo(0.35, 10)
    expect(bulky.damageReduction).toBeCloseTo(0.35, 10)
    expect(frail.damageReduction).toBe(0)
  })

  it('stuns with Shield Bash', () => {
    const { state, defs } = open([{ defId: 'hollow-sentry', slot: 0, level: 10 }])
    const enemy = actorAt(state, 0)
    enemy.cooldowns['shield-wall'] = 1_000_000
    enemy.nextReadyMs = 10
    hold(state.hero)
    state.hero.vitality = 0
    state.hero.physicalStatusResistance = 0
    const readyBefore = state.hero.nextReadyMs
    state.rng = rngBeforeDraw(0.6, 3)
    stepUntil(state, defs, () => state.log.some((event) => event.type === 'action' && event.skillId === 'shield-bash'))
    const attempt = state.log.find((event) => event.type === 'statusAttempt' && event.statusId === 'stun')
    const hit = state.log.find((event) => event.type === 'damage' && event.actorId === enemy.id)
    console.log('[enemy] shield bash', { attempt, hit, nextReadyMs: state.hero.nextReadyMs })
    expect(hit).toMatchObject({ coefficient: 0.9, school: 'physical', critChance: 0, crit: false })
    expect(state.log.some((event) => event.type === 'hitRoll' && event.actorId === enemy.id)).toBe(false)
    expect(attempt).toMatchObject({ result: 'applied', baseChance: 0.6, school: 'physical' })
    expect(state.hero.nextReadyMs).toBe(readyBefore + stunDelayMs(STUN_DELAY_SECONDS, false))
  })
})

describe('Fallen Arbalist', () => {
  it('resolves Aimed Bolt after a 2.5-second telegraph for 220% Physical Power', () => {
    const { state, defs } = open([{ defId: 'fallen-arbalist', slot: 0, level: 12 }])
    const enemy = actorAt(state, 0)
    enemy.nextReadyMs = 10
    hold(state.hero)
    stepUntil(state, defs, () => enemy.telegraph !== null)
    const telegraph = enemy.telegraph
    expect(telegraph).not.toBeNull()
    if (telegraph === null) return
    console.log('[enemy] aimed bolt', { telegraph, nextReadyMs: enemy.nextReadyMs })
    expect(telegraph.tag).toBe('aimed-bolt')
    expect(telegraph.resolvesAtMs - 10).toBe(2500)
    expect(enemy.evasionBonus).toBe(0)
    const resolvesAt = telegraph.resolvesAtMs
    stepUntil(state, defs, () => state.log.some((event) => event.type === 'damage' && event.coefficient === 2.2))
    const hit = state.log.find((event) => event.type === 'damage' && event.actorId === enemy.id)
    console.log('[enemy] aimed bolt hit', hit)
    expect(hit).toMatchObject({ coefficient: 2.2, school: 'physical', critChance: CRIT_CHANCE_BASE })
    expect(state.log.some((event) => event.type === 'hitRoll' && event.actorId === enemy.id)).toBe(false)
    expect(enemy.cooldowns['aimed-bolt']).toBe(resolvesAt + 10_000)
  })

  it('reloads for 2 seconds at −20 Evasion, and Stun postpones that Reload', () => {
    const { state, defs } = open([{ defId: 'fallen-arbalist', slot: 0, level: 12 }])
    const enemy = actorAt(state, 0)
    enemy.nextReadyMs = 10
    hold(state.hero)
    stepUntil(state, defs, () => enemy.telegraph?.tag === 'aimed-bolt')
    const resolvesAt = enemy.telegraph?.resolvesAtMs ?? 0
    expect(enemy.nextReadyMs - resolvesAt).toBe(2000)
    expect(enemy.nextReadyMs - resolvesAt).not.toBe(enemy.actionTimeMs)
    stepUntil(state, defs, () => state.log.some((event) => event.type === 'action' && event.skillId === 'reload'))
    const reload = state.log.find((event) => event.type === 'action' && event.skillId === 'reload')
    console.log('[enemy] reload', {
      reload,
      evasionBonus: enemy.evasionBonus,
      effective: effectiveEvasion(enemy, state.timeMs),
      base: enemy.evasion,
      nextReadyMs: enemy.nextReadyMs,
    })
    expect(reload).toMatchObject({ skillName: 'Reload', timeMs: resolvesAt, nextReadyMs: resolvesAt + 2000 })
    expect(enemy.evasionBonus).toBe(-20)
    expect(effectiveEvasion(enemy, resolvesAt)).toBe(enemy.evasion - 20)
    const readyBeforeStun = enemy.nextReadyMs
    state.rng = rngBeforeDraw(0.5, 0)
    tryApplyStatus({
      state,
      defs,
      source: state.hero,
      target: enemy,
      skill: STUN_SKILL,
      effect: { kind: 'applyStatus', statusId: 'stun', baseChance: 1 },
      timeMs: state.timeMs,
      applyingHit: false,
      hpDamageDealt: 0,
    })
    const delay = stunDelayMs(STUN_DELAY_SECONDS, false)
    console.log('[enemy] stun during reload', {
      delay,
      nextReadyMs: enemy.nextReadyMs,
      evasionBonus: enemy.evasionBonus,
    })
    expect(enemy.nextReadyMs).toBe(readyBeforeStun + delay)
    expect(enemy.evasionBonus).toBe(-20)
    stepUntil(state, defs, () => state.timeMs >= readyBeforeStun && state.timeMs < enemy.nextReadyMs)
    expect(enemy.evasionBonus).toBe(-20)
    stepUntil(state, defs, () => state.log.some((event) => event.type === 'buffEnded' && event.actorId === enemy.id))
    console.log('[enemy] reload complete', { evasionBonus: enemy.evasionBonus, timeMs: state.timeMs })
    expect(enemy.evasionBonus).toBe(0)
    expect(effectiveEvasion(enemy, state.timeMs)).toBe(enemy.evasion)
  })
})

describe('Oathbound Echo', () => {
  it('uses 0.5× baseline Armor and 1.5× baseline Resistance', () => {
    const level = 14
    const { state } = open([{ defId: 'oathbound-echo', slot: 0, level }])
    const enemy = actorAt(state, 0)
    const baseline = 5 + 2 * level
    const support = deriveEnemyStats({ level, archetype: 'support' })
    console.log('[enemy] echo defense', {
      armor: enemy.armor,
      resistance: enemy.resistance,
      baseline,
      supportArmor: support.armor,
      supportResistance: support.resistance,
    })
    expect(enemy.school).toBe('magical')
    expect(enemy.armor).toBe(Math.round(baseline * 0.5))
    expect(enemy.resistance).toBe(Math.round(baseline * 1.5))
    expect(enemy.armor).not.toBe(support.armor)
    expect(enemy.resistance).not.toBe(support.resistance)
    expect(enemy.maxHp).toBe(support.maxHp)
    expect(enemy.power).toBe(support.power)
  })

  it('wards the ally with the lowest current barrier', () => {
    const mixed = open([
      { defId: 'oathbound-echo', slot: 0, level: 14 },
      { defId: 'dummy-standard-20', slot: 1 },
      { defId: 'dummy-standard-20', slot: 2 },
    ])
    const echo = actorAt(mixed.state, 0)
    const shielded = actorAt(mixed.state, 1)
    const openAlly = actorAt(mixed.state, 2)
    shielded.barrier = 40
    shielded.barrierExpiresMs = 999_999
    openAlly.barrier = 0
    openAlly.barrierExpiresMs = 0
    echo.nextReadyMs = 10
    hold(shielded)
    hold(openAlly)
    hold(mixed.state.hero)
    stepUntil(mixed.state, mixed.defs, () => mixed.state.log.some((event) => event.type === 'barrier'))
    const gained = mixed.state.log.find((event) => event.type === 'barrier')
    console.log('[enemy] ward lowest barrier', {
      gained,
      openBarrier: openAlly.barrier,
      shieldedBarrier: shielded.barrier,
      power: echo.power,
    })
    expect(gained).toMatchObject({
      actorId: openAlly.id,
      sourceId: echo.id,
      amount: echo.power,
      expiresMs: 10 + 8000,
    })
    expect(openAlly.barrier).toBe(echo.power)
    expect(shielded.barrier).toBe(40)

    const tied = open([
      { defId: 'oathbound-echo', slot: 0, level: 14 },
      { defId: 'dummy-standard-20', slot: 1 },
      { defId: 'dummy-standard-20', slot: 2 },
    ])
    const tiedEcho = actorAt(tied.state, 0)
    const earlier = actorAt(tied.state, 1)
    const later = actorAt(tied.state, 2)
    earlier.barrier = 0
    later.barrier = 0
    tiedEcho.nextReadyMs = 10
    hold(earlier)
    hold(later)
    hold(tied.state.hero)
    stepUntil(tied.state, tied.defs, () => tied.state.log.some((event) => event.type === 'barrier'))
    const tie = tied.state.log.find((event) => event.type === 'barrier')
    console.log('[enemy] ward tie', { tie, earlier: earlier.barrier, later: later.barrier })
    expect(tie).toMatchObject({ actorId: earlier.id, amount: tiedEcho.power })
    expect(later.barrier).toBe(0)

    const expired = open([
      { defId: 'oathbound-echo', slot: 0, level: 14 },
      { defId: 'dummy-standard-20', slot: 1 },
      { defId: 'dummy-standard-20', slot: 2 },
    ])
    const caster = actorAt(expired.state, 0)
    const lapsed = actorAt(expired.state, 1)
    const current = actorAt(expired.state, 2)
    lapsed.barrier = 100
    lapsed.barrierExpiresMs = 0
    current.barrier = 10
    current.barrierExpiresMs = 999_999
    caster.nextReadyMs = 10
    hold(lapsed)
    hold(current)
    hold(expired.state.hero)
    stepUntil(expired.state, expired.defs, () => expired.state.log.some((event) => event.type === 'barrier'))
    const replaced = expired.state.log.find((event) => event.type === 'barrier')
    console.log('[enemy] ward missing barrier', { replaced, lapsed: lapsed.barrier, current: current.barrier })
    expect(replaced).toMatchObject({ actorId: lapsed.id, amount: caster.power })
    expect(current.barrier).toBe(10)
  })

  it('mends the wounded ally with the lowest HP and skips Mend when every ally is full', () => {
    const wounded = open([
      { defId: 'oathbound-echo', slot: 0, level: 14 },
      { defId: 'dummy-standard-20', slot: 1 },
      { defId: 'dummy-standard-20', slot: 2 },
    ])
    const echo = actorAt(wounded.state, 0)
    const full = actorAt(wounded.state, 1)
    const hurt = actorAt(wounded.state, 2)
    hurt.hp = Math.floor(hurt.maxHp * 0.5)
    hurt.healingReceived = 1.25
    echo.cooldowns['echo-ward'] = 1_000_000
    echo.nextReadyMs = 10
    hold(full)
    hold(hurt)
    hold(wounded.state.hero)
    stepUntil(wounded.state, wounded.defs, () => wounded.state.log.some((event) => event.type === 'heal'))
    const heal = wounded.state.log.find((event) => event.type === 'heal')
    console.log('[enemy] mend', { heal, hurtHp: hurt.hp, fullHp: full.hp })
    expect(heal).toMatchObject({
      targetId: hurt.id,
      healingPower: echo.power,
      healingCoefficient: 1.2,
      healingReceived: 1.25,
      maxHpFraction: 0,
      rollFloor: 0.9,
      rollCeiling: 1,
    })
    expect(full.hp).toBe(full.maxHp)
    if (heal?.type === 'heal') {
      expect(heal.raw).toBeCloseTo(echo.power * 1.2, 10)
      expect(heal.amount).toBe(Math.round(echo.power * 1.2 * heal.roll * 1.25))
      expect(hurt.hp).toBe(Math.min(hurt.maxHp, heal.targetHpBefore + heal.amount))
    }

    const ranked = open([
      { defId: 'oathbound-echo', slot: 0, level: 14 },
      { defId: 'dummy-standard-20', slot: 1 },
      { defId: 'dummy-standard-20', slot: 2 },
    ])
    const rankedEcho = actorAt(ranked.state, 0)
    const lowerPercent = actorAt(ranked.state, 1)
    const lowerAbsolute = actorAt(ranked.state, 2)
    lowerPercent.maxHp = 1000
    lowerPercent.hp = 200
    lowerAbsolute.maxHp = 500
    lowerAbsolute.hp = 150
    rankedEcho.cooldowns['echo-ward'] = 1_000_000
    rankedEcho.nextReadyMs = 10
    hold(lowerPercent)
    hold(lowerAbsolute)
    hold(ranked.state.hero)
    stepUntil(ranked.state, ranked.defs, () => ranked.state.log.some((event) => event.type === 'heal'))
    const rankedHeal = ranked.state.log.find((event) => event.type === 'heal')
    console.log('[enemy] mend percent', {
      targetId: rankedHeal?.type === 'heal' ? rankedHeal.targetId : null,
      lowerPercent: { id: lowerPercent.id, hp: lowerPercent.hp, maxHp: lowerPercent.maxHp },
      lowerAbsolute: { id: lowerAbsolute.id, hp: lowerAbsolute.hp, maxHp: lowerAbsolute.maxHp },
    })
    expect(rankedHeal).toMatchObject({ targetId: lowerPercent.id, healingCoefficient: 1.2, healingPower: rankedEcho.power })
    expect(lowerAbsolute.hp).toBe(150)

    const healthy = open([
      { defId: 'oathbound-echo', slot: 0, level: 14 },
      { defId: 'dummy-standard-20', slot: 1 },
      { defId: 'dummy-standard-20', slot: 2 },
    ])
    const caster = actorAt(healthy.state, 0)
    caster.cooldowns['echo-ward'] = 1_000_000
    caster.nextReadyMs = 10
    hold(actorAt(healthy.state, 1))
    hold(actorAt(healthy.state, 2))
    hold(healthy.state.hero)
    stepUntil(healthy.state, healthy.defs, () =>
      healthy.state.log.some((event) => event.type === 'action' && event.skillId === 'echo-bolt'),
    )
    const skip = healthy.state.log.find((event) => event.type === 'skillSkip' && event.skillId === 'echo-mend')
    const bolt = healthy.state.log.find((event) => event.type === 'action' && event.skillId === 'echo-bolt')
    console.log('[enemy] mend skipped', { skip, bolt })
    expect(skip).toMatchObject({ reason: 'every ally is at full HP' })
    expect(bolt).toMatchObject({ skillId: 'echo-bolt' })
    expect(healthy.state.log.some((event) => event.type === 'heal')).toBe(false)
  })

  it('uses Echo Bolt when Ward and Mend have no legal ally', () => {
    const { state, defs } = open([{ defId: 'oathbound-echo', slot: 0, level: 14 }])
    const echo = actorAt(state, 0)
    echo.nextReadyMs = 10
    hold(state.hero)
    stepUntil(state, defs, () => state.log.some((event) => event.type === 'action' && event.skillId === 'echo-bolt'))
    const skips = state.log.filter((event) => event.type === 'skillSkip')
    const bolt = state.log.find((event) => event.type === 'action' && event.skillId === 'echo-bolt')
    const hit = state.log.find((event) => event.type === 'damage' && event.actorId === echo.id)
    console.log('[enemy] echo bolt fallback', { skips, bolt, hit })
    expect(skips.map((event) => (event.type === 'skillSkip' ? event.skillId : ''))).toEqual(['echo-ward', 'echo-mend'])
    expect(skips.every((event) => event.type === 'skillSkip' && event.reason === 'no living ally')).toBe(true)
    expect(bolt).toMatchObject({ skillId: 'echo-bolt', skillName: 'Echo Bolt' })
    expect(state.log.some((event) => event.type === 'telegraph')).toBe(false)
    expect(hit).toMatchObject({ coefficient: 0.7, school: 'magical', critChance: 0, crit: false })
    expect(state.log.some((event) => event.type === 'hitRoll' && event.actorId === echo.id)).toBe(false)
  })
})

function poisonRollState(firstBelow: boolean, secondBelow: boolean, limit = 0.75): RngState {
  for (let seed = 1; seed < 400_000; seed += 1) {
    const probe = createRng(seed)
    for (let draw = 0; draw < 3; draw += 1) nextFloat(probe)
    const first = nextFloat(probe)
    const second = nextFloat(probe)
    const firstOk = firstBelow ? first < limit : first >= limit
    const secondOk = secondBelow ? second < limit : second >= limit
    if (firstOk && secondOk) return createRng(seed)
  }
  throw new Error(`no poison rolls firstBelow=${firstBelow} secondBelow=${secondBelow}`)
}

describe('Rootmaw Stalker', () => {
  it('spawns the published level-14 elite stat line', () => {
    const { state } = open([{ defId: 'rootmaw-stalker', slot: 0 }])
    const enemy = actorAt(state, 0)
    const generic = deriveEnemyStats({
      level: 14,
      archetype: 'skirmisher',
      elite: true,
      overrides: { consistency: 25 },
    })
    console.log('[enemy] rootmaw stats', {
      hp: enemy.maxHp,
      power: enemy.power,
      armor: enemy.armor,
      resistance: enemy.resistance,
      accuracy: enemy.accuracy,
      evasion: enemy.evasion,
      actionTimeMs: enemy.actionTimeMs,
      consistency: enemy.consistency,
      generic,
    })
    expect(enemy.level).toBe(14)
    expect(enemy.maxHp).toBe(1350)
    expect(enemy.power).toBe(29)
    expect(enemy.armor).toBe(51)
    expect(enemy.resistance).toBe(51)
    expect(enemy.accuracy).toBe(24)
    expect(enemy.evasion).toBe(26)
    expect(enemy.actionTimeMs).toBe(2000)
    expect(enemy.consistency).toBe(25)
    expect(generic.accuracy).toBe(24)
    expect(generic.evasion).toBe(26)
    expect(generic.maxHp).toBe(864)
    expect(generic.power).toBe(26)
    expect(generic.armor).toBe(31)
    expect(generic.resistance).toBe(31)
    expect(generic.actionTime).toBeCloseTo(1.76, 8)
    expect(generic.consistency).toBe(25)
    expect(generic.maxHp).not.toBe(1350)
    expect(generic.power).not.toBe(29)
    expect(generic.armor).not.toBe(51)
    expect(generic.actionTime).not.toBe(2)
  })

  it('regenerates 1% of maximum HP, pauses for Burn, and halves for Expose', () => {
    const { state, defs } = open([{ defId: 'rootmaw-stalker', slot: 0 }])
    const enemy = actorAt(state, 0)
    const missing = 50
    enemy.hp = enemy.maxHp - missing
    hold(enemy)
    hold(state.hero)
    stepUntil(state, defs, () => state.timeMs >= 1000)
    const full = state.log.find((event) => event.type === 'regen')
    const fullGain = Math.round(enemy.maxHp * 0.01)
    console.log('[enemy] rootmaw regen', { full, fullGain, maxHp: enemy.maxHp })
    expect(full).toMatchObject({ fraction: 0.01, amount: fullGain, paused: false })

    enemy.statuses.burn = {
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
    enemy.statuses.expose = {
      name: 'Expose',
      expiresMs: 60_000,
      armorMagnitude: 0.2,
      resistanceMagnitude: 0,
    }
    const beforeBurn = enemy.hp
    stepUntil(state, defs, () => state.timeMs >= 2000)
    const paused = state.log.filter((event) => event.type === 'regen')
    console.log('[enemy] rootmaw burn pauses regen', paused[1])
    expect(paused[1]).toMatchObject({ timeMs: 2000, paused: true, amount: 0, fraction: 0 })
    expect(enemy.hp).toBe(beforeBurn)

    enemy.statuses.burn = null
    stepUntil(state, defs, () => state.timeMs >= 3000)
    const exposed = state.log.filter((event) => event.type === 'regen')
    const halfGain = Math.round(enemy.maxHp * 0.005)
    console.log('[enemy] rootmaw expose halves regen', { exposed: exposed[2], halfGain })
    expect(exposed[2]).toMatchObject({ timeMs: 3000, fraction: 0.005, amount: halfGain, paused: false })
  })

  it('rolls Venomous Rend poison twice, independently, at 75% for 10% snapshotted Power', () => {
    const both = open([{ defId: 'rootmaw-stalker', slot: 0 }])
    const bothEnemy = actorAt(both.state, 0)
    bothEnemy.cooldowns['grasping-roots'] = 1_000_000
    bothEnemy.nextReadyMs = 10
    hold(both.state.hero)
    both.state.hero.armor = 0
    both.state.hero.vitality = 0
    both.state.hero.physicalStatusResistance = 0
    both.state.rng = poisonRollState(true, true)
    stepUntil(both.state, both.defs, () =>
      both.state.log.filter((event) => event.type === 'statusAttempt' && event.statusId === 'poison').length >= 2,
    )
    const bothAttempts = both.state.log.filter((event) => event.type === 'statusAttempt' && event.statusId === 'poison')
    console.log('[enemy] venomous rend both', {
      attempts: bothAttempts,
      stacks: both.state.hero.statuses.poison?.stacks,
      power: bothEnemy.power,
    })
    expect(bothAttempts).toHaveLength(2)
    expect(bothAttempts[0]).toMatchObject({ result: 'applied', baseChance: 0.75, chance: 0.75 })
    expect(bothAttempts[1]).toMatchObject({ result: 'applied', baseChance: 0.75, chance: 0.75 })
    expect(both.state.hero.statuses.poison?.stacks).toHaveLength(2)
    expect(both.state.hero.statuses.poison?.stacks[0]).toMatchObject({ coefficient: 0.1, power: 29 })
    expect(both.state.hero.statuses.poison?.stacks[1]).toMatchObject({ coefficient: 0.1, power: 29 })
    const rend = both.state.log.find((event) => event.type === 'damage' && event.actorId === bothEnemy.id)
    expect(rend).toMatchObject({ coefficient: 1.2, school: 'physical', critChance: 0, crit: false })
    expect(both.state.log.some((event) => event.type === 'hitRoll' && event.actorId === bothEnemy.id)).toBe(false)
    const snapshotted = 29
    bothEnemy.power = 1
    bothEnemy.nextReadyMs = 1_000_000
    stepUntil(both.state, both.defs, () =>
      both.state.log.some((event) => event.type === 'statusTick' && event.statusId === 'poison'),
    )
    const tick = both.state.log.find((event) => event.type === 'statusTick' && event.statusId === 'poison')
    console.log('[enemy] venomous rend tick', { tick, snapshotted, powerNow: bothEnemy.power })
    expect(tick).toMatchObject({
      school: 'physical',
      power: snapshotted,
      coefficient: 0.1,
      stacks: 2,
      crit: false,
      varianceRoll: false,
    })
    if (tick?.type === 'statusTick') expect(tick.raw).toBeCloseTo(snapshotted * 0.1 * 2, 10)

    const split = open([{ defId: 'rootmaw-stalker', slot: 0 }])
    const splitEnemy = actorAt(split.state, 0)
    splitEnemy.cooldowns['grasping-roots'] = 1_000_000
    splitEnemy.nextReadyMs = 10
    hold(split.state.hero)
    split.state.hero.armor = 0
    split.state.hero.vitality = 0
    split.state.hero.physicalStatusResistance = 0
    split.state.rng = poisonRollState(true, false)
    stepUntil(split.state, split.defs, () =>
      split.state.log.filter((event) => event.type === 'statusAttempt' && event.statusId === 'poison').length >= 2,
    )
    const splitAttempts = split.state.log.filter(
      (event) => event.type === 'statusAttempt' && event.statusId === 'poison',
    )
    console.log('[enemy] venomous rend split', splitAttempts)
    expect(splitAttempts[0]).toMatchObject({ result: 'applied', baseChance: 0.75 })
    expect(splitAttempts[1]).toMatchObject({ result: 'resisted', baseChance: 0.75 })
    expect(split.state.hero.statuses.poison?.stacks).toHaveLength(1)

    const reversed = open([{ defId: 'rootmaw-stalker', slot: 0 }])
    const reversedEnemy = actorAt(reversed.state, 0)
    reversedEnemy.cooldowns['grasping-roots'] = 1_000_000
    reversedEnemy.nextReadyMs = 10
    hold(reversed.state.hero)
    reversed.state.hero.armor = 0
    reversed.state.hero.vitality = 0
    reversed.state.hero.physicalStatusResistance = 0
    reversed.state.rng = poisonRollState(false, true)
    stepUntil(reversed.state, reversed.defs, () =>
      reversed.state.log.filter((event) => event.type === 'statusAttempt' && event.statusId === 'poison').length >= 2,
    )
    const reversedAttempts = reversed.state.log.filter(
      (event) => event.type === 'statusAttempt' && event.statusId === 'poison',
    )
    console.log('[enemy] venomous rend reversed', reversedAttempts)
    expect(reversedAttempts[0]).toMatchObject({ result: 'resisted' })
    expect(reversedAttempts[1]).toMatchObject({ result: 'applied' })
    expect(reversed.state.hero.statuses.poison?.stacks).toHaveLength(1)
  })

  it('resolves Grasping Roots into a 2-second push and Evasion -20 for 6 seconds', () => {
    const { state, defs } = open([{ defId: 'rootmaw-stalker', slot: 0 }])
    const enemy = actorAt(state, 0)
    enemy.cooldowns['venomous-rend'] = 1_000_000
    enemy.nextReadyMs = 10
    hold(state.hero)
    const readyBefore = state.hero.nextReadyMs
    stepUntil(state, defs, () => enemy.telegraph !== null)
    const telegraph = enemy.telegraph
    expect(telegraph).not.toBeNull()
    if (telegraph === null) return
    console.log('[enemy] grasping roots windup', { telegraph, readyBefore })
    expect(telegraph.tag).toBe('grasping-roots')
    expect(telegraph.resolvesAtMs - 10).toBe(2000)
    const resolvesAt = telegraph.resolvesAtMs
    stepUntil(state, defs, () => state.timeMs >= resolvesAt)
    const resolved = state.log.find((event) => event.type === 'telegraph' && event.phase === 'resolve')
    console.log('[enemy] grasping roots resolve', {
      resolved,
      nextReadyMs: state.hero.nextReadyMs,
      timedEvasion: state.hero.timedEvasion,
      expiresMs: state.hero.timedEvasionExpiresMs,
    })
    expect(resolved).toMatchObject({ tag: 'grasping-roots', timeMs: resolvesAt })
    expect(state.hero.nextReadyMs).toBe(readyBefore + 2000)
    expect(state.hero.timedEvasion).toBe(-20)
    expect(state.hero.timedEvasionExpiresMs).toBe(resolvesAt + 6000)
    expect(effectiveEvasion(state.hero, resolvesAt)).toBe(state.hero.evasion - 20)
    expect(
      state.log.some(
        (event) => event.type === 'damage' && event.actorId === enemy.id && event.timeMs === resolvesAt,
      ),
    ).toBe(false)
    expect(state.log.some((event) => event.type === 'telegraph' && event.reason === 'interrupt')).toBe(false)
    expect(enemy.cooldowns['grasping-roots']).toBe(resolvesAt + 10_000)
  })

  it('interrupts Grasping Roots at 10% of maximum HP and ignores barrier-only and foreign damage', () => {
    const { state, defs } = open([{ defId: 'rootmaw-stalker', slot: 0 }])
    const enemy = actorAt(state, 0)
    enemy.cooldowns['venomous-rend'] = 1_000_000
    enemy.nextReadyMs = 10
    hold(state.hero)
    stepUntil(state, defs, () => enemy.telegraph !== null)
    const resolvesAt = enemy.telegraph?.resolvesAtMs ?? 0
    expect(resolvesAt).toBe(2010)

    enemy.barrier = 1_000_000
    enemy.barrierExpiresMs = 60_000
    enemy.evasion = 0
    state.hero.power = 400
    state.hero.critChance = 0
    state.hero.accuracy = 100
    state.hero.nextReadyMs = 100
    state.rng = rngBeforeDraw(0.05, 0)
    const hpBeforeHit = enemy.hp
    stepUntil(state, defs, () => state.log.some((event) => event.type === 'damage' && event.actorId === state.hero.id))
    const absorbed = state.log.find((event) => event.type === 'damage' && event.actorId === state.hero.id)
    console.log('[enemy] grasping roots barrier', { absorbed, hpTaken: enemy.telegraph?.hpTaken, hp: enemy.hp })
    expect(absorbed).toMatchObject({ hpDamage: 0, targetHpAfter: hpBeforeHit })
    if (absorbed?.type === 'damage') expect(absorbed.barrierAbsorbed).toBeGreaterThan(0)
    expect(enemy.hp).toBe(hpBeforeHit)
    expect(enemy.telegraph?.hpTaken ?? 0).toBe(0)
    expect(enemy.telegraph).not.toBeNull()
    hold(state.hero)

    enemy.armor = 0
    enemy.resistance = 0
    enemy.statuses.poison = {
      name: 'Poison',
      stacks: [
        {
          power: 5000,
          penetration: 0,
          coefficient: 0.1,
          attackerLevel: 1,
          sourceId: 'stranger',
          sourceName: 'Stranger',
        },
      ],
      expiresMs: 60_000,
      tickMs: 30_000,
      nextTickMs: 500,
    }
    stepUntil(state, defs, () => state.timeMs >= 500)
    console.log('[enemy] grasping roots foreign tick', { hp: enemy.hp, hpTaken: enemy.telegraph?.hpTaken })
    expect(enemy.hp).toBeLessThan(hpBeforeHit)
    expect(enemy.telegraph?.hpTaken).toBe(0)
    expect(enemy.telegraph).not.toBeNull()

    enemy.statuses.burn = {
      name: 'Burn',
      intensity: 1,
      expiresMs: 60_000,
      tickMs: 1000,
      nextTickMs: 1000,
      power: 1340,
      penetration: 0,
      coefficient: 0.1,
      attackerLevel: state.hero.level,
      sourceId: state.hero.id,
      sourceName: state.hero.name,
    }
    stepUntil(state, defs, () => state.timeMs >= 1000)
    console.log('[enemy] grasping roots under threshold', { hpTaken: enemy.telegraph?.hpTaken, hp: enemy.hp })
    expect(enemy.telegraph?.hpTaken).toBe(134)
    expect(state.log.some((event) => event.type === 'telegraph' && event.reason === 'interrupt')).toBe(false)
    const burn = enemy.statuses.burn
    if (burn === null) throw new Error('missing burn')
    burn.power = 10
    burn.coefficient = 0.1
    stepUntil(
      state,
      defs,
      () => state.log.some((event) => event.type === 'telegraph' && event.reason === 'interrupt'),
      5_000,
    )
    const interrupted = state.log.find((event) => event.type === 'telegraph' && event.reason === 'interrupt')
    console.log('[enemy] grasping roots interrupt', {
      interrupted,
      telegraph: enemy.telegraph,
      delay: state.log.some((event) => event.type === 'actionDelay'),
      evasion: state.hero.timedEvasion,
    })
    expect(interrupted).toMatchObject({
      phase: 'cancel',
      reason: 'interrupt',
      tag: 'grasping-roots',
      hpTaken: 135,
      timeMs: 2000,
    })
    if (interrupted?.type === 'telegraph') expect(interrupted.hpNeeded).toBeCloseTo(135, 5)
    expect(enemy.telegraph).toBeNull()
    expect(state.hero.timedEvasion).toBe(0)
    expect(state.log.some((event) => event.type === 'actionDelay')).toBe(false)
    const started = state.log.find(
      (event) => event.type === 'telegraph' && event.phase === 'start' && event.tag === 'grasping-roots',
    )
    if (started?.type !== 'telegraph') throw new Error('missing Grasping Roots start')
    expect(enemy.cooldowns['grasping-roots']).toBe(started.timeMs + 10_000)
    expect(state.timeMs).toBeLessThan(resolvesAt)
  })

  it('does not cast Grasping Roots again before the cooldown measured from the telegraph start', () => {
    const { state, defs } = open([{ defId: 'rootmaw-stalker', slot: 0 }])
    const enemy = actorAt(state, 0)
    enemy.cooldowns['venomous-rend'] = 1_000_000
    enemy.nextReadyMs = 10
    hold(state.hero)
    stepUntil(state, defs, () => enemy.telegraph !== null)
    const started = state.log.find(
      (event) => event.type === 'telegraph' && event.phase === 'start' && event.tag === 'grasping-roots',
    )
    if (started?.type !== 'telegraph') throw new Error('missing Grasping Roots start')
    const startedAt = started.timeMs
    enemy.armor = 0
    enemy.evasion = 0
    enemy.barrier = 0
    state.hero.power = 400
    state.hero.penetration = 0
    state.hero.armorPenetration = 0
    state.hero.critChance = 0
    state.hero.accuracy = 100
    state.hero.nextReadyMs = startedAt + 100
    state.rng = rngBeforeDraw(0.05, 0)
    stepUntil(state, defs, () => state.log.some((event) => event.type === 'telegraph' && event.reason === 'interrupt'))
    const nextActionAt = enemy.nextReadyMs
    console.log('[enemy] grasping roots interrupted cooldown', {
      startedAt,
      cooldown: enemy.cooldowns['grasping-roots'],
      nextActionAt,
      hp: enemy.hp,
    })
    expect(enemy.alive).toBe(true)
    expect(enemy.telegraph).toBeNull()
    expect(state.hero.timedEvasion).toBe(0)
    expect(nextActionAt).toBeLessThan(startedAt + 10_000)
    hold(state.hero)
    stepUntil(state, defs, () => state.timeMs >= nextActionAt)
    const starts = state.log.filter(
      (event) => event.type === 'telegraph' && event.phase === 'start' && event.tag === 'grasping-roots',
    )
    const recast = starts.find((event) => event.timeMs === nextActionAt)
    console.log('[enemy] grasping roots recast', {
      starts: starts.map((event) => (event.type === 'telegraph' ? event.timeMs : 0)),
      recast,
      timeMs: state.timeMs,
      cooldown: enemy.cooldowns['grasping-roots'],
    })
    expect(starts).toHaveLength(1)
    expect(state.timeMs).toBeLessThan(startedAt + 10_000)
    expect(enemy.cooldowns['grasping-roots']).toBe(startedAt + 10_000)
  })
})

describe('Echo Knight', () => {
  it('spawns the published level-16 elite tank line and starts in Guard', () => {
    const { state } = open([{ defId: 'echo-knight', slot: 0 }])
    const knight = actorAt(state, 0)
    const stats = deriveEnemyStats({
      level: 16,
      archetype: 'tank',
      elite: true,
      overrides: { consistency: 25 },
    })
    const guard = state.log.find((event) => event.type === 'stance')
    console.log('[enemy] echo knight stats', {
      stats,
      live: {
        power: knight.power,
        armor: knight.armor,
        resistance: knight.resistance,
      },
      guard,
    })
    expect(stats).toMatchObject({
      maxHp: 1920,
      power: 25,
      armor: 69,
      resistance: 69,
      accuracy: 26,
      evasion: 17,
      consistency: 25,
    })
    expect(stats.actionTime).toBeCloseTo(2.64, 8)
    expect(knight.level).toBe(16)
    expect(knight.maxHp).toBe(1920)
    expect(knight.accuracy).toBe(26)
    expect(knight.evasion).toBe(17)
    expect(knight.actionTimeMs).toBe(2640)
    expect(knight.consistency).toBe(25)
    expect(knight.stanceBasePower).toBe(25)
    expect(knight.stanceBaseArmor).toBe(69)
    expect(knight.stanceBaseResistance).toBe(69)
    expect(knight.stance).toBe('guard')
    expect(knight.power).toBeCloseTo(25, 8)
    expect(knight.armor).toBeCloseTo(69 * 1.3, 8)
    expect(knight.resistance).toBeCloseTo(69 * 1.3, 8)
    expect(guard).toMatchObject({ timeMs: 0, stance: 'guard' })
  })

  it('replaces Guard with Assault every 10 seconds and leaves a scheduled action where it is', () => {
    const { state, defs } = open([{ defId: 'echo-knight', slot: 0 }])
    const knight = actorAt(state, 0)
    state.hero.hp = 1_000_000
    state.hero.maxHp = 1_000_000
    hold(state.hero)
    const baseArmor = knight.stanceBaseArmor
    const basePower = knight.stanceBasePower
    knight.nextReadyMs = 9000
    stepUntil(state, defs, () => knight.telegraph !== null)
    const resolvesAt = knight.telegraph?.resolvesAtMs ?? 0
    const readyAt = knight.nextReadyMs
    expect(resolvesAt).toBe(9000 + 1500)
    stepUntil(state, defs, () => state.timeMs >= 10_000)
    const assault = state.log.filter((event) => event.type === 'stance')
    console.log('[enemy] echo knight assault', {
      assault: assault[1],
      power: knight.power,
      armor: knight.armor,
      resolvesAt: knight.telegraph?.resolvesAtMs,
      readyAt: knight.nextReadyMs,
    })
    expect(assault.map((event) => (event.type === 'stance' ? event.timeMs : 0))).toEqual([0, 10_000])
    expect(assault[1]).toMatchObject({ stance: 'assault' })
    expect(knight.power).toBeCloseTo(basePower * 1.25, 8)
    expect(knight.armor).toBeCloseTo(baseArmor * 0.8, 8)
    expect(knight.resistance).toBeCloseTo(baseArmor * 0.8, 8)
    expect(knight.telegraph?.resolvesAtMs).toBe(resolvesAt)
    expect(knight.nextReadyMs).toBe(readyAt)
    stepUntil(state, defs, () => state.timeMs >= 20_000)
    const stances = state.log.filter((event) => event.type === 'stance')
    console.log('[enemy] echo knight stance cycle', stances.map((event) => (event.type === 'stance' ? [event.timeMs, event.stance, event.armor] : [])))
    expect(stances.map((event) => (event.type === 'stance' ? event.stance : ''))).toEqual(['guard', 'assault', 'guard'])
    expect(stances.map((event) => (event.type === 'stance' ? event.timeMs : 0))).toEqual([0, 10_000, 20_000])
    expect(knight.stance).toBe('guard')
    expect(knight.armor).toBeCloseTo(baseArmor * 1.3, 8)
    expect(knight.power).toBeCloseTo(basePower, 8)
    expect(knight.armor).not.toBeCloseTo(baseArmor * 1.3 * 0.8 * 1.3, 5)
  })

  it('resolves Fractured Charge for 180% physical damage, can crit, and spends 8 seconds', () => {
    const { state, defs } = open([{ defId: 'echo-knight', slot: 0 }])
    const knight = actorAt(state, 0)
    knight.nextReadyMs = 10
    hold(state.hero)
    state.rng = rngBeforeDraw(CRIT_CHANCE_BASE, 2)
    stepUntil(state, defs, () => knight.telegraph !== null)
    const telegraph = knight.telegraph
    expect(telegraph).not.toBeNull()
    if (telegraph === null) return
    console.log('[enemy] fractured charge', { telegraph, nextReadyMs: knight.nextReadyMs })
    expect(telegraph.tag).toBe('fractured-charge')
    expect(telegraph.resolvesAtMs - 10).toBe(1500)
    const resolvesAt = telegraph.resolvesAtMs
    stepUntil(state, defs, () => state.log.some((event) => event.type === 'damage' && event.actorId === knight.id))
    const hit = state.log.find((event) => event.type === 'damage' && event.actorId === knight.id)
    console.log('[enemy] fractured charge hit', { hit, cooldown: knight.cooldowns['fractured-charge'] })
    expect(hit).toMatchObject({
      coefficient: 1.8,
      school: 'physical',
      critChance: CRIT_CHANCE_BASE,
      crit: true,
    })
    expect(state.log.some((event) => event.type === 'hitRoll' && event.actorId === knight.id)).toBe(false)
    expect(knight.cooldowns['fractured-charge']).toBe(resolvesAt + 8000)
  })

  it('summons one XP-less level-16 Oathbound Echo after the 60% telegraph', () => {
    const { state, defs } = open([{ defId: 'echo-knight', slot: 0 }])
    const knight = actorAt(state, 0)
    knight.cooldowns['fractured-charge'] = 1_000_000
    knight.nextReadyMs = 1_000_000
    knight.armor = 0
    knight.resistance = 0
    knight.evasion = 0
    knight.hp = 1200
    state.hero.power = 200
    state.hero.critChance = 0
    state.hero.accuracy = 100
    state.hero.nextReadyMs = 10
    state.rng = rngBeforeDraw(0.05, 0)
    stepUntil(state, defs, () => knight.reaction !== null)
    const startedAt = knight.reaction?.resolvesAtMs ?? 0
    console.log('[enemy] echo summon start', { reaction: knight.reaction, hp: knight.hp, maxHp: knight.maxHp })
    expect(knight.hp).toBeLessThanOrEqual(knight.maxHp * 0.6 + 1e-6)
    expect(knight.hp).toBeGreaterThan(0)
    expect(knight.reaction).toMatchObject({ tag: 'summon-echo', resolvesAtMs: 10 + 2000 })
    expect(knight.telegraph).toBeNull()

    state.hero.power = 1
    state.hero.critChance = 0
    state.rng = rngBeforeDraw(0.05, 0)
    stepUntil(state, defs, () => state.log.filter((event) => event.type === 'damage' && event.actorId === state.hero.id).length >= 2)
    console.log('[enemy] echo summon damage', { resolvesAt: knight.reaction?.resolvesAtMs, hp: knight.hp })
    expect(knight.reaction?.resolvesAtMs).toBe(startedAt)
    expect(knight.alive).toBe(true)

    const readyBeforeStun = knight.nextReadyMs
    tryApplyStatus({
      state,
      defs,
      source: state.hero,
      target: knight,
      skill: STUN_SKILL,
      effect: { kind: 'applyStatus', statusId: 'stun', baseChance: 1 },
      timeMs: state.timeMs,
      applyingHit: false,
      hpDamageDealt: 0,
      roll: 0,
    })
    const delay = stunDelayMs(STUN_DELAY_SECONDS, false)
    console.log('[enemy] echo summon stun', {
      delay,
      resolvesAt: knight.reaction?.resolvesAtMs,
      nextReadyMs: knight.nextReadyMs,
    })
    expect(knight.reaction?.resolvesAtMs).toBe(startedAt + delay)
    expect(knight.nextReadyMs).toBe(readyBeforeStun + delay)
    hold(state.hero)
    const summonedAt = knight.reaction?.resolvesAtMs ?? 0
    stepUntil(state, defs, () => state.log.some((event) => event.type === 'summon'))
    const echoes = state.enemies.filter((enemy) => enemy.defId === 'oathbound-echo')
    const echo = echoes[0]
    if (echo === undefined) throw new Error('missing echo')
    const block = deriveEnemyStats({
      level: 16,
      archetype: 'support',
      overrides: defs.enemies['oathbound-echo']?.overrides,
    })
    const summon = state.log.find((event) => event.type === 'summon')
    console.log('[enemy] echo summon', { summon, echo: { hp: echo.maxHp, power: echo.power, xp: echo.xp, level: echo.level }, block })
    expect(echoes).toHaveLength(1)
    expect(summon).toMatchObject({
      summonName: 'Oathbound Echo',
      level: 16,
      slot: 1,
      xp: 0,
      summon: true,
      timeMs: summonedAt,
    })
    expect(echo.summon).toBe(true)
    expect(echo.xp).toBe(0)
    expect(echo.level).toBe(16)
    expect(echo.maxHp).toBe(block.maxHp)
    expect(echo.power).toBe(block.power)
    expect(echo.armor).toBe(block.armor)
    expect(echo.resistance).toBe(block.resistance)
    expect(echo.accuracy).toBe(block.accuracy)
    expect(echo.evasion).toBe(block.evasion)
    expect(echo.actionTimeMs).toBe(Math.round(block.actionTime * 1000))
    expect(echo.skills.map((skill) => skill.id)).toEqual(['echo-ward', 'echo-mend', 'echo-bolt'])
    const award = encounterXpAward(state.enemies)
    expect(award).toMatchObject({ count: 1, discount: 0, sum: knight.xp })
    expect(award.amount).toBe(knight.xp)

    const hitsBefore = state.log.filter((event) => event.type === 'damage' && event.actorId === state.hero.id).length
    state.hero.power = 50
    state.hero.critChance = 0
    state.hero.nextReadyMs = state.timeMs + 10
    state.rng = rngBeforeDraw(0.05, 0)
    stepUntil(
      state,
      defs,
      () => state.log.filter((event) => event.type === 'damage' && event.actorId === state.hero.id).length > hitsBefore,
    )
    expect(state.enemies.filter((enemy) => enemy.defId === 'oathbound-echo')).toHaveLength(1)

    knight.hp = 1
    echo.hp = 1
    knight.armor = 0
    echo.armor = 0
    knight.evasion = 0
    echo.evasion = 0
    state.hero.power = 100_000
    state.hero.critChance = 0
    state.hero.accuracy = 100
    state.hero.nextReadyMs = state.timeMs + 10
    runCombat(state, defs, state.timeMs + 20_000)
    const xp = state.log.find((event) => event.type === 'encounterXp')
    console.log('[enemy] echo summon xp', { outcome: state.outcome, xp, knightXp: knight.xp })
    expect(state.outcome).toBe('victory')
    expect(xp).toMatchObject({ members: 1, discount: 0, sum: knight.xp, amount: knight.xp })
  })

  it('cancels the summon telegraph when the Knight dies before it resolves', () => {
    const { state, defs } = open([{ defId: 'echo-knight', slot: 0 }])
    const knight = actorAt(state, 0)
    knight.cooldowns['fractured-charge'] = 1_000_000
    knight.nextReadyMs = 1_000_000
    knight.armor = 0
    knight.resistance = 0
    knight.evasion = 0
    knight.hp = 1200
    state.hero.power = 200
    state.hero.critChance = 0
    state.hero.accuracy = 100
    state.hero.nextReadyMs = 10
    state.rng = rngBeforeDraw(0.05, 0)
    stepUntil(state, defs, () => knight.reaction !== null)
    const resolvesAt = knight.reaction?.resolvesAtMs ?? 0
    expect(knight.alive).toBe(true)
    state.hero.power = 100_000
    state.hero.critChance = 0
    state.hero.nextReadyMs = 500
    state.rng = rngBeforeDraw(0.05, 0)
    stepUntil(state, defs, () => !knight.alive || state.timeMs >= resolvesAt)
    const cancelled = state.log.find(
      (event) => event.type === 'telegraph' && event.phase === 'cancel' && event.tag === 'summon-echo',
    )
    console.log('[enemy] echo summon cancelled', {
      cancelled,
      alive: knight.alive,
      summons: state.log.filter((event) => event.type === 'summon'),
      enemies: state.enemies.map((enemy) => enemy.name),
    })
    expect(knight.alive).toBe(false)
    expect(state.timeMs).toBeLessThan(resolvesAt)
    expect(cancelled).toMatchObject({ phase: 'cancel', tag: 'summon-echo' })
    expect(state.log.some((event) => event.type === 'summon')).toBe(false)
    expect(state.enemies.some((enemy) => enemy.defId === 'oathbound-echo')).toBe(false)
  })
})

const EXPOSE_SKILL: SkillDef = {
  id: 'expose-warden',
  name: 'Expose',
  cost: 0,
  cooldownSeconds: 0,
  actionTimeCoefficient: 1,
  tags: ['physical'],
  target: 'single',
  effects: [],
}

describe('Fractured Warden', () => {
  it('uses the rank-0 level-20 boss line and Standard XP', () => {
    const { state } = open([{ defId: 'fractured-warden', slot: 0 }])
    const warden = actorAt(state, 0)
    const standard = deriveEnemyStats({ level: 20, archetype: 'standard' })
    const phase = state.log.find((event) => event.type === 'phase')
    console.log('[enemy] warden rank 0', {
      hp: warden.maxHp,
      power: warden.power,
      armor: warden.armor,
      resistance: warden.resistance,
      accuracy: warden.accuracy,
      evasion: warden.evasion,
      consistency: warden.consistency,
      actionTimeMs: warden.actionTimeMs,
      xp: warden.xp,
      standardXp: standard.xp,
      boss: warden.boss,
      phase,
    })
    expect(warden.maxHp).toBe(3840)
    expect(warden.power).toBe(36)
    expect(warden.armor).toBe(68)
    expect(warden.resistance).toBe(68)
    expect(warden.accuracy).toBe(40)
    expect(warden.evasion).toBe(20)
    expect(warden.consistency).toBe(50)
    expect(warden.actionTimeMs).toBe(2200)
    expect(warden.boss).toBe(true)
    expect(warden.rank).toBe(0)
    expect(warden.bossPhase).toBe(1)
    expect(warden.xp).toBe(standard.xp)
    expect(warden.summon).toBe(false)
    expect(phase).toMatchObject({ phase: 1, name: "Warden's Guard", timeMs: 0 })
  })

  it('multiplies rank 2 HP, Power, Armor, and Resistance by 1.12^2', () => {
    const { state } = open([{ defId: 'fractured-warden', slot: 0, rank: 2 }])
    const warden = actorAt(state, 0)
    const standard = deriveEnemyStats({ level: 20, archetype: 'standard' })
    console.log('[enemy] warden rank 2', {
      hp: warden.maxHp,
      power: warden.power,
      armor: warden.armor,
      resistance: warden.resistance,
      accuracy: warden.accuracy,
      evasion: warden.evasion,
      consistency: warden.consistency,
      actionTimeMs: warden.actionTimeMs,
      xp: warden.xp,
    })
    expect(warden.maxHp).toBe(4817)
    expect(warden.power).toBe(45)
    expect(warden.armor).toBe(85)
    expect(warden.resistance).toBe(85)
    expect(warden.accuracy).toBe(40)
    expect(warden.evasion).toBe(20)
    expect(warden.consistency).toBe(50)
    expect(warden.actionTimeMs).toBe(2200)
    expect(warden.rank).toBe(2)
    expect(warden.xp).toBe(standard.xp)
  })

  it('enters phase 2 at 70% and phase 3 at 35%, summoning each echo once', () => {
    const { state, defs } = open([{ defId: 'fractured-warden', slot: 0 }])
    const warden = actorAt(state, 0)
    hold(state.hero)
    hold(warden)
    stepUntil(state, defs, () => state.timeMs >= 1000)
    warden.hp = 2689
    onEnemyHpChanged(state, warden, state.timeMs)
    expect(warden.bossPhase).toBe(1)
    warden.hp = 2688
    onEnemyHpChanged(state, warden, state.timeMs)
    stepCombat(state, defs)
    const blade = state.enemies.find((enemy) => enemy.defId === 'blade-echo')
    const ward = state.enemies.find((enemy) => enemy.defId === 'ward-echo')
    const summons = state.log.filter((event) => event.type === 'summon')
    console.log('[enemy] warden echoes', {
      phase: warden.bossPhase,
      blade: blade && { hp: blade.maxHp, power: blade.power, armor: blade.armor, resistance: blade.resistance, actionTimeMs: blade.actionTimeMs, xp: blade.xp, summon: blade.summon },
      ward: ward && { hp: ward.maxHp, power: ward.power, armor: ward.armor, resistance: ward.resistance, actionTimeMs: ward.actionTimeMs, xp: ward.xp, summon: ward.summon, anchor: ward.anchorMaxHp },
      summons,
      xp: encounterXpAward(state.enemies),
    })
    expect(warden.bossPhase).toBe(2)
    expect(state.log.filter((event) => event.type === 'phase').map((event) => (event.type === 'phase' ? event.name : ''))).toEqual([
      "Warden's Guard",
      "Warden's Echoes",
    ])
    expect(blade).toMatchObject({ maxHp: 576, power: 25, armor: 51, resistance: 51, actionTimeMs: 1650, xp: 0, summon: true })
    expect(ward).toMatchObject({
      maxHp: 576,
      power: 18,
      armor: 51,
      resistance: 51,
      actionTimeMs: 2200,
      xp: 0,
      summon: true,
      anchorMaxHp: 3840,
    })
    expect(summons).toHaveLength(2)
    expect(encounterXpAward(state.enemies)).toEqual({ sum: warden.xp, count: 1, discount: 0, amount: warden.xp })
    warden.hp = 1345
    onEnemyHpChanged(state, warden, state.timeMs)
    expect(warden.bossPhase).toBe(2)
    warden.hp = warden.maxHp
    onEnemyHpChanged(state, warden, state.timeMs)
    expect(warden.bossPhase).toBe(2)
    expect(state.log.filter((event) => event.type === 'phase')).toHaveLength(2)
    expect(state.enemies.filter((enemy) => enemy.defId === 'blade-echo')).toHaveLength(1)
    expect(state.enemies.filter((enemy) => enemy.defId === 'ward-echo')).toHaveLength(1)
    warden.hp = 1344
    onEnemyHpChanged(state, warden, state.timeMs)
    stepCombat(state, defs)
    onEnemyHpChanged(state, warden, state.timeMs)
    stepCombat(state, defs)
    console.log('[enemy] warden phase 3', {
      phase: warden.bossPhase,
      summons: state.log.filter((event) => event.type === 'summon').length,
    })
    expect(warden.bossPhase).toBe(3)
    expect(state.log.filter((event) => event.type === 'phase').map((event) => (event.type === 'phase' ? event.phase : 0))).toEqual([
      1, 2, 3,
    ])
    expect(state.enemies.filter((enemy) => enemy.defId === 'blade-echo')).toHaveLength(1)
    expect(state.enemies.filter((enemy) => enemy.defId === 'ward-echo')).toHaveLength(1)
  })

  it("does not cast Warden's Guard in phase 2, and Expose follows the Guard bonus", () => {
    const { state, defs } = open([{ defId: 'fractured-warden', slot: 0 }])
    const warden = actorAt(state, 0)
    hold(state.hero)
    state.hero.hp = 1_000_000
    state.hero.maxHp = 1_000_000
    warden.cooldowns['fracture-hammer'] = 1_000_000
    warden.nextReadyMs = 10
    stepUntil(state, defs, () => state.log.some((event) => event.type === 'action' && event.skillId === 'wardens-guard'))
    console.log('[enemy] warden guard', { armor: warden.armor, resistance: warden.resistance, expires: warden.defenseBonusExpiresMs })
    expect(warden.armor).toBeCloseTo(68 * 1.5, 8)
    expect(warden.resistance).toBeCloseTo(68 * 1.5, 8)
    const guardAction = state.log.find((event) => event.type === 'action' && event.skillId === 'wardens-guard')
    expect(guardAction?.type).toBe('action')
    if (guardAction?.type === 'action') expect(warden.defenseBonusExpiresMs).toBe(guardAction.timeMs + 4000)
    state.rng = rngBeforeDraw(0.04, 0)
    tryApplyStatus({
      state,
      defs,
      source: state.hero,
      target: warden,
      skill: EXPOSE_SKILL,
      effect: { kind: 'applyStatus', statusId: 'expose', baseChance: 1, armorMagnitude: 0.2, resistanceMagnitude: 0.2 },
      timeMs: state.timeMs,
      applyingHit: false,
      hpDamageDealt: 0,
    })
    const guarded = exposedDefense(warden, 'physical', state.timeMs)
    const guardedResistance = exposedDefense(warden, 'magical', state.timeMs)
    console.log('[enemy] warden expose', { guarded, guardedResistance, expose: warden.statuses.expose })
    expect(guarded).toBeCloseTo(68 * 1.5 * 0.8, 8)
    expect(guardedResistance).toBeCloseTo(68 * 1.5 * 0.8, 8)
    const phaseAt = state.timeMs
    warden.hp = 2688
    onEnemyHpChanged(state, warden, phaseAt)
    stepCombat(state, defs)
    expect(warden.bossPhase).toBe(2)
    expect(warden.armor).toBeCloseTo(68 * 1.5, 8)
    delete warden.cooldowns['wardens-guard']
    warden.cooldowns['fracture-hammer'] = 1_000_000
    warden.cooldowns['rift-pulse'] = 1_000_000
    const castAt = state.timeMs + 10
    warden.nextReadyMs = castAt
    stepUntil(state, defs, () => state.timeMs >= castAt)
    const action = state.log.find((event) => event.type === 'action' && event.actorId === warden.id && event.timeMs === castAt)
    console.log('[enemy] warden phase 2 action', action)
    expect(action).toMatchObject({ action: 'basicAttack' })
    expect(
      state.log.some((event) => event.type === 'action' && event.skillId === 'wardens-guard' && event.timeMs > phaseAt),
    ).toBe(false)
  })

  it('stops phase-3 stacks at 5 and does not move a scheduled action', () => {
    const { state, defs } = open([{ defId: 'fractured-warden', slot: 0 }])
    const warden = actorAt(state, 0)
    hold(state.hero)
    state.hero.hp = 1_000_000
    state.hero.maxHp = 1_000_000
    warden.nextReadyMs = 500_000
    warden.hp = 1344
    onEnemyHpChanged(state, warden, state.timeMs)
    stepCombat(state, defs)
    expect(warden.bossPhase).toBe(3)
    expect(warden.nextReadyMs).toBe(500_000)
    stepUntil(state, defs, () => warden.pressureStacks >= 5, 50_000)
    const stacks = state.log.filter((event) => event.type === 'stack')
    console.log('[enemy] warden stacks', {
      stacks: stacks.map((event) => (event.type === 'stack' ? { timeMs: event.timeMs, stacks: event.stacks, power: event.power, armor: event.armor } : null)),
      power: warden.power,
      armor: warden.armor,
      resistance: warden.resistance,
      ready: warden.nextReadyMs,
    })
    expect(warden.pressureStacks).toBe(5)
    expect(stacks).toHaveLength(5)
    const phase3 = state.log.find((event) => event.type === 'phase' && event.phase === 3)
    expect(phase3?.type).toBe('phase')
    if (phase3?.type === 'phase') {
      expect(stacks.map((event) => (event.type === 'stack' ? event.timeMs : 0))).toEqual([
        phase3.timeMs + 8000,
        phase3.timeMs + 16_000,
        phase3.timeMs + 24_000,
        phase3.timeMs + 32_000,
        phase3.timeMs + 40_000,
      ])
    }
    expect(warden.power).toBeCloseTo(36 * 1.1 ** 5, 8)
    expect(warden.armor).toBeCloseTo(68 * 0.95 ** 5, 8)
    expect(warden.resistance).toBeCloseTo(68 * 0.95 ** 5, 8)
    expect(warden.nextReadyMs).toBe(500_000)
    const afterCap = state.timeMs
    stepUntil(state, defs, () => state.timeMs >= afterCap + 8000)
    expect(warden.pressureStacks).toBe(5)
    expect(state.log.filter((event) => event.type === 'stack')).toHaveLength(5)
    expect(warden.nextReadyMs).toBe(500_000)
    warden.cooldowns['fracture-hammer'] = 1_000_000
    warden.cooldowns['wardens-guard'] = 1_000_000
    warden.cooldowns['rift-pulse'] = 1_000_000
    const scheduled = state.timeMs + 10
    warden.nextReadyMs = scheduled
    stepUntil(state, defs, () => state.timeMs >= scheduled)
    const recovery = Math.round(2200 / 1.05 ** 5)
    console.log('[enemy] warden stack speed', { scheduled, nextReadyMs: warden.nextReadyMs, recovery })
    expect(warden.nextReadyMs).toBe(scheduled + recovery)
  })

  it('does not phase on a killing blow, and one hit through both thresholds still summons', () => {
    const killed = open([{ defId: 'fractured-warden', slot: 0 }])
    const dying = actorAt(killed.state, 0)
    dying.hp = 0
    onEnemyHpChanged(killed.state, dying, killed.state.timeMs)
    expect(dying.bossPhase).toBe(1)
    expect(killed.state.enemies).toHaveLength(1)

    const { state, defs } = open([{ defId: 'fractured-warden', slot: 0 }])
    const warden = actorAt(state, 0)
    hold(state.hero)
    hold(warden)
    warden.hp = 1344
    onEnemyHpChanged(state, warden, state.timeMs)
    stepCombat(state, defs)
    console.log('[enemy] warden crossed both', {
      phase: warden.bossPhase,
      names: state.log.filter((event) => event.type === 'phase').map((event) => (event.type === 'phase' ? event.name : '')),
      summons: state.enemies.filter((enemy) => enemy.summon).map((enemy) => enemy.defId),
    })
    expect(warden.bossPhase).toBe(3)
    expect(state.log.filter((event) => event.type === 'phase').map((event) => (event.type === 'phase' ? event.phase : 0))).toEqual([
      1, 2, 3,
    ])
    expect(state.enemies.filter((enemy) => enemy.defId === 'blade-echo')).toHaveLength(1)
    expect(state.enemies.filter((enemy) => enemy.defId === 'ward-echo')).toHaveLength(1)
    expect(encounterXpAward(state.enemies)).toEqual({ sum: warden.xp, count: 1, discount: 0, amount: warden.xp })
  })

  it('scales summoned echoes from the rank-adjusted Warden', () => {
    const { state, defs } = open([{ defId: 'fractured-warden', slot: 0, rank: 2 }])
    const warden = actorAt(state, 0)
    hold(state.hero)
    hold(warden)
    warden.hp = 2408
    onEnemyHpChanged(state, warden, state.timeMs)
    stepCombat(state, defs)
    const blade = state.enemies.find((enemy) => enemy.defId === 'blade-echo')
    const ward = state.enemies.find((enemy) => enemy.defId === 'ward-echo')
    console.log('[enemy] warden rank 2 echoes', {
      warden: { hp: warden.maxHp, power: warden.power, armor: warden.armor, resistance: warden.resistance },
      blade: blade && { hp: blade.maxHp, power: blade.power, armor: blade.armor, resistance: blade.resistance, actionTimeMs: blade.actionTimeMs },
      ward: ward && { hp: ward.maxHp, power: ward.power, armor: ward.armor, resistance: ward.resistance, actionTimeMs: ward.actionTimeMs, anchor: ward.anchorMaxHp },
    })
    expect(warden.bossPhase).toBe(2)
    expect(blade).toMatchObject({ maxHp: 723, power: 32, armor: 64, resistance: 64, actionTimeMs: 1650, xp: 0, summon: true })
    expect(ward).toMatchObject({
      maxHp: 723,
      power: 23,
      armor: 64,
      resistance: 64,
      actionTimeMs: 2200,
      xp: 0,
      summon: true,
      anchorMaxHp: 4817,
    })
    expect(encounterXpAward(state.enemies)).toEqual({ sum: warden.xp, count: 1, discount: 0, amount: warden.xp })
  })

  it('shows the logged boss phase to the boss-phase automation condition', () => {
    const { state, defs } = open([{ defId: 'fractured-warden', slot: 0 }])
    const warden = actorAt(state, 0)
    state.hero.equippedSkillIds = ['driving-blow']
    state.hero.priorityRows = [
      { skillId: 'driving-blow', conditions: [{ kind: 'bossPhase', operator: 'equal', value: 2 }] },
    ]
    const before = chooseHeroAction(state, defs, state.hero, state.timeMs)
    console.log('[enemy] warden phase condition before', before.events.map((event) => event.reason))
    expect(before.kind).toBe('basicAttack')
    expect(before.events.some((event) => event.reason === 'boss phase 1 is not 2')).toBe(true)
    warden.hp = 2688
    onEnemyHpChanged(state, warden, state.timeMs)
    stepCombat(state, defs)
    const after = chooseHeroAction(state, defs, state.hero, state.timeMs)
    console.log('[enemy] warden phase condition after', {
      phase: warden.bossPhase,
      kind: after.kind,
      focus: after.kind === 'skill' ? after.focus?.id : null,
    })
    expect(state.log.some((event) => event.type === 'phase' && event.phase === 2 && event.name === "Warden's Echoes")).toBe(true)
    expect(after).toMatchObject({ kind: 'skill', skill: { id: 'driving-blow' }, focus: { id: warden.id } })
  })

  it('casts Fracture Hammer in every phase and fills with an uncritable physical strike', () => {
    const { state, defs } = open([{ defId: 'fractured-warden', slot: 0 }])
    const warden = actorAt(state, 0)
    hold(state.hero)
    state.hero.hp = 1_000_000
    state.hero.maxHp = 1_000_000
    warden.cooldowns['fracture-hammer'] = 1_000_000
    warden.cooldowns['wardens-guard'] = 1_000_000
    warden.nextReadyMs = 10
    state.rng = rngHitThenCritRoll()
    stepUntil(state, defs, () => state.log.some((event) => event.type === 'damage' && event.actorId === warden.id))
    const strike = state.log.find((event) => event.type === 'damage' && event.actorId === warden.id)
    console.log('[enemy] warden strike', strike)
    expect(strike).toMatchObject({ coefficient: 1, school: 'physical', critChance: 0, crit: false })
    if (strike?.type === 'damage') expect(strike.critRoll).toBeLessThan(CRIT_CHANCE_BASE)
    expect(state.log.some((event) => event.type === 'action' && event.skillId === 'wardens-guard')).toBe(false)

    delete warden.cooldowns['fracture-hammer']
    const hammerAt = state.timeMs + 10
    warden.nextReadyMs = hammerAt
    state.rng = rngBeforeDraw(CRIT_CHANCE_BASE, 2)
    stepUntil(state, defs, () => warden.telegraph?.tag === 'fracture-hammer')
    const started = warden.telegraph
    expect(started).toMatchObject({ tag: 'fracture-hammer', resolvesAtMs: hammerAt + 2000 })
    if (started === null) return
    const resolvesAt = started.resolvesAtMs
    stepUntil(state, defs, () => state.log.some((event) => event.type === 'damage' && event.timeMs === resolvesAt))
    const hammer = state.log.find((event) => event.type === 'damage' && event.timeMs === resolvesAt)
    console.log('[enemy] fracture hammer', { hammer, cooldown: warden.cooldowns['fracture-hammer'], resolvesAt })
    expect(hammer).toMatchObject({
      coefficient: 2,
      school: 'physical',
      critChance: CRIT_CHANCE_BASE,
      crit: true,
    })
    expect(warden.cooldowns['fracture-hammer']).toBe(resolvesAt + 8000)
    expect(state.log.some((event) => event.type === 'hitRoll' && event.actorId === warden.id && event.timeMs === resolvesAt)).toBe(false)

    warden.hp = 2688
    onEnemyHpChanged(state, warden, state.timeMs)
    stepCombat(state, defs)
    expect(warden.bossPhase).toBe(2)
    for (const enemy of state.enemies) {
      if (enemy.id !== warden.id) hold(enemy)
    }
    delete warden.cooldowns['fracture-hammer']
    warden.telegraph = null
    const phase2At = state.timeMs + 10
    warden.nextReadyMs = phase2At
    stepUntil(state, defs, () => warden.telegraph?.tag === 'fracture-hammer')
    expect(warden.telegraph).toMatchObject({ tag: 'fracture-hammer', resolvesAtMs: phase2At + 2000 })
    expect(state.log.some((event) => event.type === 'action' && event.skillId === 'wardens-guard' && event.timeMs >= phase2At)).toBe(false)

    warden.telegraph = null
    warden.hp = 1344
    onEnemyHpChanged(state, warden, state.timeMs)
    stepCombat(state, defs)
    expect(warden.bossPhase).toBe(3)
    delete warden.cooldowns['wardens-guard']
    warden.cooldowns['fracture-hammer'] = 1_000_000
    warden.cooldowns['rift-pulse'] = 1_000_000
    const fillerAt = state.timeMs + 10
    warden.nextReadyMs = fillerAt
    stepUntil(state, defs, () => state.timeMs >= fillerAt)
    const filler = state.log.find((event) => event.type === 'action' && event.actorId === warden.id && event.timeMs === fillerAt)
    expect(filler).toMatchObject({ action: 'basicAttack' })
    expect(state.log.some((event) => event.type === 'action' && event.skillId === 'wardens-guard' && event.timeMs >= fillerAt)).toBe(false)

    delete warden.cooldowns['fracture-hammer']
    const phase3At = state.timeMs + 10
    warden.nextReadyMs = phase3At
    stepUntil(state, defs, () => warden.telegraph?.tag === 'fracture-hammer')
    console.log('[enemy] fracture hammer phases', { phase: warden.bossPhase, telegraph: warden.telegraph })
    expect(warden.telegraph).toMatchObject({ tag: 'fracture-hammer', resolvesAtMs: phase3At + 2000 })
  })

  it("resolves Severing Dash for 160% physical damage and spends 6 seconds", () => {
    const { state, defs } = open([{ defId: 'fractured-warden', slot: 0 }])
    const warden = actorAt(state, 0)
    hold(state.hero)
    state.hero.hp = 1_000_000
    state.hero.maxHp = 1_000_000
    hold(warden)
    warden.hp = 2688
    onEnemyHpChanged(state, warden, state.timeMs)
    stepCombat(state, defs)
    const blade = state.enemies.find((enemy) => enemy.defId === 'blade-echo')
    const ward = state.enemies.find((enemy) => enemy.defId === 'ward-echo')
    if (blade === undefined || ward === undefined) throw new Error('echoes were not summoned')
    hold(ward)
    const dashAt = state.timeMs + 10
    blade.nextReadyMs = dashAt
    state.rng = rngBeforeDraw(CRIT_CHANCE_BASE, 2)
    stepUntil(state, defs, () => blade.telegraph?.tag === 'severing-dash')
    const telegraph = blade.telegraph
    expect(telegraph).toMatchObject({ tag: 'severing-dash', resolvesAtMs: dashAt + 1000 })
    if (telegraph === null) return
    const resolvesAt = telegraph.resolvesAtMs
    stepUntil(state, defs, () => state.log.some((event) => event.type === 'damage' && event.actorId === blade.id))
    const hit = state.log.find((event) => event.type === 'damage' && event.actorId === blade.id)
    console.log('[enemy] severing dash', { hit, cooldown: blade.cooldowns['severing-dash'], resolvesAt })
    expect(hit).toMatchObject({
      coefficient: 1.6,
      school: 'physical',
      critChance: CRIT_CHANCE_BASE,
      crit: true,
    })
    expect(blade.cooldowns['severing-dash']).toBe(resolvesAt + 6000)
  })

  it('wards and mends from the Warden maximum HP, and bolts when support skills are not eligible', () => {
    const { state, defs } = open([{ defId: 'fractured-warden', slot: 0, rank: 2 }])
    const warden = actorAt(state, 0)
    hold(state.hero)
    state.hero.hp = 1_000_000
    state.hero.maxHp = 1_000_000
    hold(warden)
    warden.hp = 2408
    onEnemyHpChanged(state, warden, state.timeMs)
    stepCombat(state, defs)
    const blade = state.enemies.find((enemy) => enemy.defId === 'blade-echo')
    const ward = state.enemies.find((enemy) => enemy.defId === 'ward-echo')
    if (blade === undefined || ward === undefined) throw new Error('echoes were not summoned')
    hold(blade)
    ward.nextReadyMs = state.timeMs + 10
    stepUntil(state, defs, () => state.log.some((event) => event.type === 'barrier' && event.sourceId === ward.id))
    const barrier = state.log.find((event) => event.type === 'barrier' && event.sourceId === ward.id)
    console.log('[enemy] ward echo barrier', { barrier, anchor: ward.anchorMaxHp, wardenHp: warden.maxHp })
    expect(barrier).toMatchObject({ actorId: warden.id, amount: warden.maxHp * 0.05 })

    ward.cooldowns['ward-echo-ward'] = 1_000_000
    const hurtBefore = warden.hp
    ward.nextReadyMs = state.timeMs + 10
    stepUntil(state, defs, () => state.log.some((event) => event.type === 'heal' && event.actorId === ward.id))
    const heal = state.log.find((event) => event.type === 'heal' && event.actorId === ward.id)
    console.log('[enemy] ward echo mend', heal)
    expect(heal).toMatchObject({
      targetId: warden.id,
      maxHpFraction: 0.03,
      healingCoefficient: 0,
      healingReceived: 1,
      rollFloor: 0.9,
      rollCeiling: 1,
    })
    if (heal?.type === 'heal') {
      expect(heal.raw).toBeCloseTo(warden.maxHp * 0.03, 8)
      expect(heal.roll).toBeGreaterThanOrEqual(0.9)
      expect(heal.roll).toBeLessThan(1)
      expect(heal.afterRoll).toBeCloseTo(heal.raw * heal.roll, 8)
      expect(heal.amount).toBe(Math.round(heal.raw * heal.roll * heal.healingReceived))
      expect(warden.hp).toBe(Math.min(warden.maxHp, hurtBefore + heal.amount))
    }

    delete ward.cooldowns['ward-echo-mend']
    warden.hp = warden.maxHp
    blade.hp = blade.maxHp
    state.rng = rngBeforeDraw(CRIT_CHANCE_BASE, 2)
    ward.nextReadyMs = state.timeMs + 10
    stepUntil(state, defs, () => state.log.some((event) => event.type === 'action' && event.skillId === 'rift-bolt'))
    const skip = state.log.find((event) => event.type === 'skillSkip' && event.skillId === 'ward-echo-mend')
    const bolt = state.log.find((event) => event.type === 'damage' && event.actorId === ward.id)
    console.log('[enemy] rift bolt', { skip, bolt, power: ward.power })
    expect(skip).toMatchObject({ reason: 'every ally is at full HP' })
    expect(bolt).toMatchObject({ coefficient: 0.7, school: 'magical', power: ward.power, critChance: 0, crit: false })
    if (bolt?.type === 'damage') expect(bolt.critRoll).toBeLessThan(CRIT_CHANCE_BASE)
    expect(ward.power).toBe(23)
  })

  it('resolves Rift Pulse for 120% magical damage and applies Chill', () => {
    const { state, defs } = open([{ defId: 'fractured-warden', slot: 0 }])
    const warden = actorAt(state, 0)
    hold(state.hero)
    state.hero.hp = 1_000_000
    state.hero.maxHp = 1_000_000
    state.hero.magicalStatusResistance = 0
    hold(warden)
    warden.hp = 1344
    onEnemyHpChanged(state, warden, state.timeMs)
    stepCombat(state, defs)
    for (const enemy of state.enemies) {
      if (enemy.id !== warden.id) hold(enemy)
    }
    warden.cooldowns['fracture-hammer'] = 1_000_000
    warden.statusPotency = 0
    state.rng = rngCritThenStatus()
    const castAt = state.timeMs + 10
    warden.nextReadyMs = castAt
    stepUntil(state, defs, () => warden.telegraph?.tag === 'rift-pulse')
    const telegraph = warden.telegraph
    expect(telegraph).toMatchObject({ tag: 'rift-pulse', resolvesAtMs: castAt + 1500 })
    if (telegraph === null) return
    const resolvesAt = telegraph.resolvesAtMs
    stepUntil(state, defs, () => state.log.some((event) => event.type === 'statusAttempt' && event.statusId === 'chill'))
    const hit = state.log.find((event) => event.type === 'damage' && event.actorId === warden.id && event.timeMs === resolvesAt)
    const attempt = state.log.find((event) => event.type === 'statusAttempt' && event.statusId === 'chill')
    console.log('[enemy] rift pulse', { hit, attempt, cooldown: warden.cooldowns['rift-pulse'], chill: state.hero.statuses.chill })
    expect(hit).toMatchObject({ coefficient: 1.2, school: 'magical', critChance: 0, crit: false })
    if (hit?.type === 'damage') expect(hit.critRoll).toBeLessThan(CRIT_CHANCE_BASE)
    expect(attempt).toMatchObject({ result: 'applied', baseChance: 1, stacks: 1 })
    expect(state.hero.statuses.chill?.stacks).toBe(1)
    expect(warden.cooldowns['rift-pulse']).toBe(resolvesAt + 6000)
  })
})
