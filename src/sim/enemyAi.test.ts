import { describe, expect, it } from 'vitest'

import { chooseHeroAction } from './automation.ts'
import { createCombat, runCombat, stepCombat } from './combat.ts'
import {
  BLEED_ACTIONS_PER_STACK,
  BLEED_MAX_STACKS,
  CRIT_CHANCE_BASE,
  STUN_DELAY_SECONDS,
} from './constants.ts'
import {
  encounterXpAward,
  enemyRecoveryMs,
  packHunterSpeed,
} from './enemyAi.ts'
import { createRng, nextFloat, type RngState } from './rng.ts'
import { deriveEnemyStats, type HeroStatInput } from './stats.ts'
import { stunDelayMs, tryApplyStatus } from './statuses.ts'
import type {
  CombatActor,
  CombatSetup,
  CombatState,
  EnemyDef,
  EnemySkillDef,
  GameDefs,
  SkillDef,
} from './types.ts'

const ITEM_LEVEL = 20
const QUALITY = 1

function warriorSetup(
  enemies: CombatSetup['enemies'],
  skills: readonly SkillDef[] = [],
): CombatSetup {
  const armor = (slot: 'head' | 'chest' | 'hands' | 'feet') => ({
    id: `ref-heavy-${slot}`,
    slot,
    category: 'heavy' as const,
    itemLevel: ITEM_LEVEL,
    quality: QUALITY,
  })
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
    ...(skills.length > 0
      ? {
          equippedSkillIds: skills.map((skill) => skill.id),
          priorityRows: skills.map((skill) => ({ skillId: skill.id })),
        }
      : {}),
  }
  return { hero, enemies }
}

function statuses(): GameDefs['statuses'] {
  return {
    bleed: {
      id: 'bleed',
      name: 'Bleed',
      kind: 'bleed',
      maxStacks: BLEED_MAX_STACKS,
      actionsPerStack: BLEED_ACTIONS_PER_STACK,
    },
    stun: { id: 'stun', name: 'Stun', kind: 'stun', delaySeconds: STUN_DELAY_SECONDS },
  }
}

function defsFor(enemies: readonly EnemyDef[], skills: readonly SkillDef[] = []): GameDefs {
  const book: GameDefs['enemies'] = {}
  for (const enemy of enemies) book[enemy.id] = enemy
  const skillBook: GameDefs['skills'] = {}
  for (const skill of skills) skillBook[skill.id] = skill
  return { enemies: book, skills: skillBook, statuses: statuses() }
}

function open(
  enemies: readonly EnemyDef[],
  slots: CombatSetup['enemies'],
  seed = 1,
  skills: readonly SkillDef[] = [],
): { state: CombatState; defs: GameDefs } {
  const defs = defsFor(enemies, skills)
  return { state: createCombat(warriorSetup(slots, skills), defs, seed), defs }
}

function burst(): EnemySkillDef {
  return {
    id: 'fracture-burst',
    name: 'Fracture Burst',
    coefficient: 0.4,
    school: 'magical',
    cooldownSeconds: 0,
    telegraphMs: 1000,
    tag: 'fracture-burst',
    tags: ['fracture-burst', 'magical'],
    canCrit: false,
    trigger: 'death',
    effects: [{ kind: 'damage', school: 'magical', coefficient: 0.4 }],
  }
}

function shardling(): EnemyDef {
  return {
    id: 'fracture-shardling',
    name: 'Fracture Shardling',
    level: 1,
    levelMin: 1,
    levelMax: 5,
    archetype: 'swarm',
    school: 'physical',
    filler: { school: 'physical' },
    traitIds: ['fracture-burst'],
    skills: [burst()],
  }
}

function pounce(): EnemySkillDef {
  return {
    id: 'pounce',
    name: 'Pounce',
    coefficient: 1.6,
    school: 'physical',
    cooldownSeconds: 7,
    telegraphMs: 1500,
    tag: 'pounce',
    tags: ['pounce', 'physical'],
    canCrit: true,
    effects: [{ kind: 'damage', school: 'physical', coefficient: 1.6 }],
  }
}

function wolf(): EnemyDef {
  return {
    id: 'starved-wolf',
    name: 'Starved Wolf',
    level: 2,
    levelMin: 2,
    levelMax: 6,
    archetype: 'skirmisher',
    school: 'physical',
    filler: { school: 'physical' },
    traitIds: ['pack-hunter'],
    skills: [pounce()],
  }
}

function deserter(): EnemyDef {
  return {
    id: 'deserter',
    name: 'Deserter',
    level: 4,
    levelMin: 4,
    levelMax: 7,
    archetype: 'standard',
    school: 'physical',
    filler: { school: 'physical' },
    skills: [
      {
        id: 'rusted-cut',
        name: 'Rusted Cut',
        coefficient: 0.9,
        school: 'physical',
        cooldownSeconds: 5,
        tag: 'rusted-cut',
        tags: ['physical', 'attack'],
        canCrit: false,
        effects: [
          { kind: 'damage', school: 'physical', coefficient: 0.9 },
          { kind: 'applyStatus', statusId: 'bleed', baseChance: 0.75, coefficient: 0.1, power: 'physical' },
        ],
      },
      {
        id: 'guard',
        name: 'Guard',
        coefficient: 0,
        school: 'physical',
        cooldownSeconds: 7,
        tag: 'guard',
        tags: ['defense'],
        canCrit: false,
        actionTimeCoefficient: 0.75,
        effects: [{ kind: 'damageReduction', fraction: 0.3 }],
      },
    ],
  }
}

function dummy(): EnemyDef {
  return { id: 'dummy', name: 'Dummy', level: 20, archetype: 'standard', school: 'physical' }
}

function wolfSlots(count: number, level = 6): CombatSetup['enemies'] {
  const slots: { defId: string; slot: number; level: number }[] = []
  for (let slot = 0; slot < count; slot += 1) slots.push({ defId: 'starved-wolf', slot, level })
  return slots
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

function stepUntil(state: CombatState, defs: GameDefs, done: () => boolean, limitMs = 30_000): void {
  const start = state.timeMs
  while (!done() && state.outcome === 'ongoing' && state.timeMs < start + limitMs) {
    stepCombat(state, defs)
  }
}

describe('encounter XP', () => {
  it('discounts 5% per extra enemy and caps at 20%', () => {
    const one = { xp: 10, summon: false }
    const two = encounterXpAward([one, one])
    const five = encounterXpAward([one, one, one, one, one])
    const six = encounterXpAward([one, one, one, one, one, one])
    const summon = encounterXpAward([one, { xp: 99, summon: true }])
    const between = encounterXpAward([one, { xp: 99, summon: true }, one])
    const half = encounterXpAward([
      { xp: 10, summon: false },
      { xp: 0, summon: false },
    ])
    const trio = encounterXpAward([one, one, one])
    console.log('[enemy] xp discount', { two, five, six, summon, between, half, trio })
    expect(two).toEqual({ sum: 20, count: 2, discount: 0.05, amount: 19 })
    expect(five).toEqual({ sum: 50, count: 5, discount: 0.2, amount: 40 })
    expect(six).toEqual({ sum: 60, count: 6, discount: 0.2, amount: 48 })
    expect(summon).toEqual({ sum: 10, count: 1, discount: 0, amount: 10 })
    expect(between).toEqual({ sum: 20, count: 2, discount: 0.05, amount: 19 })
    expect(half).toEqual({ sum: 10, count: 2, discount: 0.05, amount: 10 })
    expect(trio).toEqual({ sum: 30, count: 3, discount: 0.1, amount: 27 })
  })

  it('logs the discounted total at victory and gives summons nothing', () => {
    const real = open([dummy()], [
      { defId: 'dummy', slot: 0 },
      { defId: 'dummy', slot: 1, summon: true },
    ])
    for (const enemy of real.state.enemies) enemy.hp = 1
    runCombat(real.state, real.defs, 60_000)
    const paired = open([dummy()], [
      { defId: 'dummy', slot: 0 },
      { defId: 'dummy', slot: 1 },
    ])
    for (const enemy of paired.state.enemies) enemy.hp = 1
    runCombat(paired.state, paired.defs, 60_000)
    const solo = real.state.log.find((event) => event.type === 'encounterXp')
    const pair = paired.state.log.find((event) => event.type === 'encounterXp')
    console.log('[enemy] logged xp', { solo, pair })
    expect(real.state.outcome).toBe('victory')
    expect(solo).toMatchObject({ sum: 45, members: 1, discount: 0, amount: 45 })
    expect(pair).toMatchObject({ sum: 90, members: 2, discount: 0.05, amount: 86 })
  })
})

describe('Pack Hunter', () => {
  it('grants 10% per other living wolf and caps at 20% without moving a scheduled action', () => {
    const pair = open([wolf()], wolfSlots(2))
    const trio = open([wolf()], wolfSlots(3))
    const pack = open([wolf()], wolfSlots(4))
    const first = actorAt(pair.state, 0)
    const other = actorAt(pair.state, 1)
    const actionMs = first.actionTimeMs
    const sped = enemyRecoveryMs(actionMs, 1, 0, 0.1)
    const capped = enemyRecoveryMs(actionMs, 1, 0, 0.2)
    const full = enemyRecoveryMs(actionMs, 1, 0, 0)
    console.log('[enemy] pack speed', {
      actionMs,
      pairReady: first.nextReadyMs,
      trioReady: actorAt(trio.state, 0).nextReadyMs,
      packReady: actorAt(pack.state, 0).nextReadyMs,
      bonusPair: packHunterSpeed(pair.state.enemies, first),
      bonusTrio: packHunterSpeed(trio.state.enemies, actorAt(trio.state, 0)),
      bonusPack: packHunterSpeed(pack.state.enemies, actorAt(pack.state, 0)),
    })
    expect(packHunterSpeed(pair.state.enemies, first)).toBe(0.1)
    expect(packHunterSpeed(trio.state.enemies, actorAt(trio.state, 0))).toBe(0.2)
    expect(packHunterSpeed(pack.state.enemies, actorAt(pack.state, 0))).toBe(0.2)
    expect(first.nextReadyMs).toBe(sped)
    expect(actorAt(trio.state, 0).nextReadyMs).toBe(capped)
    expect(actorAt(pack.state, 0).nextReadyMs).toBe(capped)
    expect(sped).toBe(1600)
    expect(capped).toBe(1467)

    const scheduled = first.nextReadyMs
    other.alive = false
    expect(first.nextReadyMs).toBe(scheduled)
    expect(first.telegraph).toBeNull()
    stepUntil(pair.state, pair.defs, () => first.telegraph !== null)
    const telegraph = first.telegraph
    expect(telegraph).not.toBeNull()
    if (telegraph === null) return
    console.log('[enemy] scheduled pounce after a death', {
      scheduled,
      resolvesAtMs: telegraph.resolvesAtMs,
      nextReadyMs: first.nextReadyMs,
      full,
      sped,
    })
    expect(first.nextReadyMs - telegraph.resolvesAtMs).toBe(full)
    expect(first.nextReadyMs - telegraph.resolvesAtMs).not.toBe(sped)
  })

  it('leaves an in-progress telegraph and its ready time where they were scheduled', () => {
    const { state, defs } = open([wolf()], wolfSlots(2))
    const first = actorAt(state, 0)
    const other = actorAt(state, 1)
    hold(state.hero)
    stepUntil(state, defs, () => first.telegraph !== null)
    const telegraph = first.telegraph
    expect(telegraph).not.toBeNull()
    if (telegraph === null) return
    const started = state.log.find((event) => event.type === 'telegraph' && event.actorId === first.id)
    const resolvesAt = telegraph.resolvesAtMs
    const ready = first.nextReadyMs
    console.log('[enemy] pack telegraph held', {
      started,
      resolvesAt,
      ready,
      gap: ready - resolvesAt,
    })
    expect(started).toMatchObject({ phase: 'start', timeMs: 1600, resolvesAtMs: 3100, tag: 'pounce' })
    expect(resolvesAt).toBe(3100)
    expect(ready - resolvesAt).toBe(1600)
    other.alive = false
    for (let step = 0; step < 5; step += 1) stepCombat(state, defs)
    expect(first.telegraph?.resolvesAtMs).toBe(resolvesAt)
    expect(first.nextReadyMs).toBe(ready)
    expect(first.telegraph?.tag).toBe('pounce')
  })
})

describe('Pounce', () => {
  it('telegraphs, uses 160% power, can crit, and starts its cooldown at resolution', () => {
    const { state, defs } = open([wolf()], wolfSlots(1))
    const enemy = actorAt(state, 0)
    hold(state.hero)
    stepUntil(state, defs, () => enemy.telegraph !== null)
    const telegraph = enemy.telegraph
    expect(telegraph).not.toBeNull()
    if (telegraph === null) return
    const started = state.log.find((event) => event.type === 'telegraph' && event.phase === 'start')
    console.log('[enemy] pounce start', { telegraph, started, actionMs: enemy.actionTimeMs })
    expect(started).toMatchObject({
      tag: 'pounce',
      skillId: 'pounce',
      resolvesAtMs: telegraph.resolvesAtMs,
    })
    expect(telegraph.resolvesAtMs - (started?.type === 'telegraph' ? started.timeMs : 0)).toBe(1500)
    expect(enemy.nextReadyMs - telegraph.resolvesAtMs).toBe(enemy.actionTimeMs)
    expect(state.log.some((event) => event.type === 'hitRoll' && event.actorId === enemy.id)).toBe(false)

    const resolvesAt = telegraph.resolvesAtMs
    while (state.timeMs + 10 < resolvesAt) stepCombat(state, defs)
    state.rng = rngBeforeDraw(0.05, 2)
    stepCombat(state, defs)
    const hit = state.log.find(
      (event) => event.type === 'damage' && event.actorId === enemy.id && event.coefficient === 1.6,
    )
    const resolved = state.log.find((event) => event.type === 'telegraph' && event.phase === 'resolve')
    console.log('[enemy] pounce resolve', { hit, resolved, cooldown: enemy.cooldowns.pounce })
    expect(hit).toMatchObject({
      type: 'damage',
      school: 'physical',
      coefficient: 1.6,
      critChance: CRIT_CHANCE_BASE,
      crit: true,
      power: enemy.power,
    })
    expect(resolved).toMatchObject({ tag: 'pounce', timeMs: resolvesAt, cooldownReadyMs: resolvesAt + 7000 })
    expect(enemy.cooldowns.pounce).toBe(resolvesAt + 7000)
    expect(enemy.telegraph).toBeNull()

    stepUntil(state, defs, () =>
      state.log.some(
        (event) => event.type === 'action' && event.actorId === enemy.id && event.timeMs > resolvesAt,
      ),
    )
    const follow = state.log.find(
      (event) => event.type === 'action' && event.actorId === enemy.id && event.timeMs > resolvesAt,
    )
    console.log('[enemy] action after pounce', follow)
    expect(follow).toMatchObject({ action: 'basicAttack', skillId: null })
    expect(state.log.some((event) => event.type === 'hitRoll' && event.actorId === enemy.id)).toBe(true)
  })

  it('lets Stun postpone the telegraph and leaves it in place when a hit lands', () => {
    const stunned = open([wolf()], wolfSlots(1))
    const enemy = actorAt(stunned.state, 0)
    hold(stunned.state.hero)
    enemy.hp = 50_000
    enemy.maxHp = 50_000
    stepUntil(stunned.state, stunned.defs, () => enemy.telegraph !== null)
    const beforeResolve = enemy.telegraph?.resolvesAtMs
    const beforeReady = enemy.nextReadyMs
    tryApplyStatus({
      state: stunned.state,
      defs: stunned.defs,
      source: stunned.state.hero,
      target: enemy,
      skill: {
        id: 'test-stun',
        name: 'Test Stun',
        cost: 0,
        cooldownSeconds: 0,
        actionTimeCoefficient: 1,
        tags: ['physical'],
        target: 'single',
        effects: [{ kind: 'applyStatus', statusId: 'stun', baseChance: 1 }],
      },
      effect: { kind: 'applyStatus', statusId: 'stun', baseChance: 1 },
      timeMs: stunned.state.timeMs,
      applyingHit: false,
      hpDamageDealt: 0,
      roll: 0,
    })
    const delay = stunDelayMs(1.5, false)
    console.log('[enemy] stun pounce', {
      delay,
      beforeResolve,
      afterResolve: enemy.telegraph?.resolvesAtMs,
      beforeReady,
      afterReady: enemy.nextReadyMs,
    })
    expect(delay).toBe(1500)
    expect(enemy.telegraph?.resolvesAtMs).toBe((beforeResolve ?? 0) + delay)
    expect(enemy.nextReadyMs).toBe(beforeReady + delay)

    const shove: SkillDef = {
      id: 'shove',
      name: 'Shove',
      cost: 0,
      cooldownSeconds: 0,
      actionTimeCoefficient: 1,
      tags: ['physical'],
      target: 'single',
      effects: [{ kind: 'actionDelay', delaySeconds: 0.5 }],
    }
    const delayed = open([wolf()], wolfSlots(1), 1, [shove])
    const wolfActor = actorAt(delayed.state, 0)
    hold(delayed.state.hero)
    wolfActor.hp = 50_000
    stepUntil(delayed.state, delayed.defs, () => wolfActor.telegraph !== null)
    const delayBefore = wolfActor.telegraph?.resolvesAtMs ?? 0
    const readyBefore = wolfActor.nextReadyMs
    delayed.state.hero.nextReadyMs = delayed.state.timeMs + 10
    stepUntil(
      delayed.state,
      delayed.defs,
      () => delayed.state.log.some((event) => event.type === 'actionDelay'),
    )
    console.log('[enemy] delay pounce', {
      delayBefore,
      resolvesAtMs: wolfActor.telegraph?.resolvesAtMs,
      readyBefore,
      nextReadyMs: wolfActor.nextReadyMs,
    })
    expect(wolfActor.telegraph?.resolvesAtMs).toBe(delayBefore + 500)
    expect(wolfActor.nextReadyMs).toBe(readyBefore + 500)

    const struck = open([wolf()], wolfSlots(1))
    const target = actorAt(struck.state, 0)
    hold(struck.state.hero)
    target.hp = 50_000
    target.maxHp = 50_000
    stepUntil(struck.state, struck.defs, () => target.telegraph !== null)
    const resolvesAt = target.telegraph?.resolvesAtMs
    const nextReady = target.nextReadyMs
    struck.state.hero.nextReadyMs = struck.state.timeMs + 10
    struck.state.rng = rngBeforeDraw(0.05, 0)
    stepCombat(struck.state, struck.defs)
    const damage = struck.state.log.find((event) => event.type === 'damage' && event.actorId === struck.state.hero.id)
    console.log('[enemy] damage during pounce', {
      damage: damage?.type === 'damage' ? damage.hpDamage : null,
      resolvesAt,
      still: target.telegraph?.resolvesAtMs,
      nextReady,
      ready: target.nextReadyMs,
    })
    expect(damage).toMatchObject({ type: 'damage', hpDamage: expect.any(Number) as number })
    if (damage?.type === 'damage') expect(damage.hpDamage).toBeGreaterThan(0)
    expect(target.hp).toBeLessThan(50_000)
    expect(target.telegraph).toMatchObject({ tag: 'pounce', resolvesAtMs: resolvesAt })
    expect(target.nextReadyMs).toBe(nextReady)
  })
})

describe('Deserter', () => {
  it('applies Rusted Cut Bleed from snapshotted Physical Power', () => {
    const { state, defs } = open([deserter()], [{ defId: 'deserter', slot: 0, level: 6 }])
    const enemy = actorAt(state, 0)
    enemy.cooldowns.guard = 1_000_000
    enemy.nextReadyMs = 10
    hold(state.hero)
    state.hero.vitality = 0
    state.hero.physicalStatusResistance = 0
    state.rng = rngBeforeDraw(0.75, 3)
    stepUntil(state, defs, () => state.log.some((event) => event.type === 'action' && event.skillId === 'rusted-cut'))
    const attempt = state.log.find((event) => event.type === 'statusAttempt' && event.statusId === 'bleed')
    const hit = state.log.find((event) => event.type === 'damage' && event.actorId === enemy.id)
    const stack = state.hero.statuses.bleed?.stacks[0]
    console.log('[enemy] rusted cut', { attempt, hit, stack, power: enemy.power })
    expect(state.log.some((event) => event.type === 'hitRoll' && event.actorId === enemy.id)).toBe(false)
    expect(hit).toMatchObject({ coefficient: 0.9, school: 'physical', critChance: 0, crit: false })
    expect(attempt).toMatchObject({ result: 'applied', baseChance: 0.75 })
    expect(stack).toMatchObject({ coefficient: 0.1, power: enemy.power })
    const cut = state.log.find((event) => event.type === 'action' && event.skillId === 'rusted-cut')
    if (cut?.type === 'action') expect(enemy.cooldowns['rusted-cut']).toBe(cut.timeMs + 5000)
    const snapshotted = stack?.power ?? 0
    enemy.power += 50
    state.hero.nextReadyMs = state.timeMs + 10
    stepUntil(state, defs, () =>
      state.log.some((event) => event.type === 'statusTick' && event.statusId === 'bleed'),
    )
    const tick = state.log.find((event) => event.type === 'statusTick' && event.statusId === 'bleed')
    console.log('[enemy] bleed tick', { tick, snapshotted, powerNow: enemy.power })
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

  it('guards for 30% until the next action and spends 0.75× action time', () => {
    const { state, defs } = open([deserter()], [{ defId: 'deserter', slot: 0, level: 5 }])
    const enemy = actorAt(state, 0)
    enemy.cooldowns['rusted-cut'] = 1_000_000
    enemy.nextReadyMs = 10
    hold(state.hero)
    stepUntil(state, defs, () => enemy.damageReduction > 0)
    const recovery = enemyRecoveryMs(enemy.actionTimeMs, 0.75, 0, 0)
    console.log('[enemy] guard', {
      reduction: enemy.damageReduction,
      nextReadyMs: enemy.nextReadyMs,
      recovery,
      actionMs: enemy.actionTimeMs,
    })
    expect(enemy.damageReduction).toBeCloseTo(0.3, 10)
    expect(enemy.nextReadyMs).toBe(10 + recovery)
    expect(recovery).toBe(1650)
    const guardAction = state.log.find((event) => event.type === 'action' && event.skillId === 'guard')
    expect(guardAction).toMatchObject({ timeMs: 10, nextReadyMs: 10 + recovery })
    expect(enemy.cooldowns.guard).toBe(7010)

    enemy.hp = 50_000
    enemy.maxHp = 50_000
    state.hero.nextReadyMs = state.timeMs + 10
    state.rng = rngBeforeDraw(0.05, 0)
    stepCombat(state, defs)
    const hit = state.log.find((event) => event.type === 'damage' && event.targetId === enemy.id)
    console.log('[enemy] guarded hit', hit?.type === 'damage' ? hit.incomingModifier : null)
    expect(hit).toMatchObject({ incomingModifier: 0.7 })

    stepUntil(state, defs, () => state.log.some((event) => event.type === 'buffEnded' && event.actorId === enemy.id))
    console.log('[enemy] guard ended', { reduction: enemy.damageReduction })
    expect(enemy.damageReduction).toBe(0)
  })

  it('uses Rusted Cut before Guard when both are ready', () => {
    const { state, defs } = open([deserter()], [{ defId: 'deserter', slot: 0, level: 7 }])
    const enemy = actorAt(state, 0)
    enemy.hp = 50_000
    enemy.maxHp = 50_000
    enemy.nextReadyMs = 10
    hold(state.hero)
    stepUntil(state, defs, () => state.log.some((event) => event.type === 'action' && event.actorId === enemy.id))
    const first = state.log.find((event) => event.type === 'action' && event.actorId === enemy.id)
    console.log('[enemy] first deserter skill', first)
    expect(first).toMatchObject({ skillId: 'rusted-cut', action: 'skill' })
    if (first?.type !== 'action') return
    expect(enemy.cooldowns['rusted-cut']).toBe(first.timeMs + 5000)
    stepUntil(
      state,
      defs,
      () => state.log.filter((event) => event.type === 'action' && event.actorId === enemy.id).length >= 2,
    )
    const actions = state.log.filter((event) => event.type === 'action' && event.actorId === enemy.id)
    const second = actions[1]
    console.log('[enemy] second deserter skill', second)
    expect(second).toMatchObject({ skillId: 'guard', action: 'skill', timeMs: first.nextReadyMs })
    if (second?.type === 'action') {
      expect(second.nextReadyMs - second.timeMs).toBe(1650)
      expect(enemy.cooldowns.guard).toBe(second.timeMs + 7000)
    }
  })

  it('uses the filler basic attack when both skills are on cooldown', () => {
    const { state, defs } = open([deserter()], [{ defId: 'deserter', slot: 0, level: 4 }])
    const enemy = actorAt(state, 0)
    enemy.cooldowns['rusted-cut'] = 1_000_000
    enemy.cooldowns.guard = 1_000_000
    enemy.nextReadyMs = 10
    hold(state.hero)
    state.rng = rngBeforeDraw(0.05, 0)
    stepUntil(state, defs, () => state.log.some((event) => event.type === 'action' && event.actorId === enemy.id))
    const action = state.log.find((event) => event.type === 'action' && event.actorId === enemy.id)
    const roll = state.log.find((event) => event.type === 'hitRoll' && event.actorId === enemy.id)
    const hit = state.log.find((event) => event.type === 'damage' && event.actorId === enemy.id)
    console.log('[enemy] filler', { action, roll, crit: hit?.type === 'damage' ? hit.crit : null })
    expect(action).toMatchObject({ action: 'basicAttack', skillId: null })
    expect(roll).toMatchObject({ type: 'hitRoll' })
    expect(hit).toMatchObject({ coefficient: 1, critChance: 0, crit: false })
  })
})

describe('Fracture Shardling', () => {
  it('spawns inside its level range and reuses archetype stats', () => {
    const spawned = open([shardling()], [{ defId: 'fracture-shardling', slot: 0, level: 5 }])
    const actor = actorAt(spawned.state, 0)
    const stats = deriveEnemyStats({ level: 5, archetype: 'swarm' })
    console.log('[enemy] shardling level 5', { hp: actor.maxHp, power: actor.power, stats })
    expect(actor.level).toBe(5)
    expect(actor.maxHp).toBe(stats.maxHp)
    expect(actor.power).toBe(stats.power)
    expect(actor.armor).toBe(stats.armor)
    expect(actor.xp).toBe(stats.xp)
    expect(() =>
      open([shardling()], [{ defId: 'fracture-shardling', slot: 0, level: 6 }]),
    ).toThrow(/level must be an integer from 1 through 5/)
    expect(() => open([shardling()], [{ defId: 'fracture-shardling', slot: 0 }])).toThrow(
      /requires an encounter level from 1 through 5/,
    )
    expect(() => open([wolf()], [{ defId: 'starved-wolf', slot: 0, level: 1 }])).toThrow(/from 2 through 6/)
    expect(() => open([deserter()], [{ defId: 'deserter', slot: 0, level: 3 }])).toThrow(/from 4 through 7/)
    expect(() => open([deserter()], [{ defId: 'deserter', slot: 0, level: 8 }])).toThrow(/from 4 through 7/)
    expect(actorAt(open([shardling()], [{ defId: 'fracture-shardling', slot: 0, level: 1 }]).state, 0).level).toBe(1)
    expect(actorAt(open([wolf()], [{ defId: 'starved-wolf', slot: 0, level: 2 }]).state, 0).level).toBe(2)
    expect(actorAt(open([wolf()], [{ defId: 'starved-wolf', slot: 0, level: 6 }]).state, 0).level).toBe(6)
    expect(actorAt(open([deserter()], [{ defId: 'deserter', slot: 0, level: 4 }]).state, 0).level).toBe(4)
    expect(actorAt(open([deserter()], [{ defId: 'deserter', slot: 0, level: 7 }]).state, 0).level).toBe(7)
  })

  it('uses the filler while alive and does not cast Fracture Burst as an action', () => {
    const { state, defs } = open([shardling()], [{ defId: 'fracture-shardling', slot: 0, level: 1 }])
    const enemy = actorAt(state, 0)
    enemy.hp = 50_000
    hold(state.hero)
    stepUntil(state, defs, () => state.log.some((event) => event.type === 'action' && event.actorId === enemy.id))
    const action = state.log.find((event) => event.type === 'action' && event.actorId === enemy.id)
    console.log('[enemy] shardling filler', action)
    expect(action).toMatchObject({ action: 'basicAttack', skillId: null })
    expect(state.log.some((event) => event.type === 'telegraph' && event.tag === 'fracture-burst')).toBe(false)
    expect(enemy.alive).toBe(true)
  })

  it('deals 40% magical power when the burst resolves, with variance and no crit', () => {
    const { state, defs } = open([shardling()], [
      { defId: 'fracture-shardling', slot: 0, level: 1 },
      { defId: 'fracture-shardling', slot: 1, level: 1 },
    ])
    const dying = actorAt(state, 0)
    const living = actorAt(state, 1)
    dying.hp = 1
    hold(dying)
    hold(living)
    state.hero.nextReadyMs = 10
    state.rng = rngBeforeDraw(0.05, 0)
    stepUntil(state, defs, () => dying.telegraph !== null)
    const power = dying.power
    const resolvesAt = dying.telegraph?.resolvesAtMs ?? 0
    console.log('[enemy] burst armed', { power, resolvesAt, alive: dying.alive, other: living.alive })
    expect(dying.alive).toBe(false)
    expect(living.alive).toBe(true)
    expect(state.outcome).toBe('ongoing')
    expect(state.log.some((event) => event.type === 'action' && event.skillId === 'fracture-burst')).toBe(false)
    stepUntil(state, defs, () => state.log.some((event) => event.type === 'telegraph' && event.phase === 'resolve'))
    const hit = state.log.find((event) => event.type === 'damage' && event.actorId === dying.id)
    console.log('[enemy] burst damage', hit)
    expect(hit).toMatchObject({
      school: 'magical',
      coefficient: 0.4,
      power,
      crit: false,
      critChance: 0,
      defense: state.hero.resistance,
      attackerLevel: 1,
    })
    if (hit?.type === 'damage') {
      expect(hit.consistencyRoll).toBeGreaterThanOrEqual(0.6)
      expect(hit.consistencyRoll).toBeLessThan(1)
    }
    expect(state.outcome).toBe('ongoing')
  })

  it('cancels an unresolved burst when the encounter ends', () => {
    const { state, defs } = open([shardling()], [{ defId: 'fracture-shardling', slot: 0, level: 3 }])
    const dying = actorAt(state, 0)
    dying.hp = 1
    hold(dying)
    state.hero.nextReadyMs = 10
    state.rng = rngBeforeDraw(0.05, 0)
    stepUntil(state, defs, () => state.outcome === 'victory')
    const phases = state.log.filter((event) => event.type === 'telegraph').map((event) => event.phase)
    const burstDamage = state.log.filter(
      (event) => event.type === 'damage' && event.actorId === dying.id && event.coefficient === 0.4,
    )
    console.log('[enemy] burst cancel', { phases, burstDamage: burstDamage.length, outcome: state.outcome })
    expect(phases).toEqual(['start', 'cancel'])
    expect(burstDamage).toHaveLength(0)
    expect(state.outcome).toBe('victory')
    expect(dying.telegraph).toBeNull()
  })

  it('uses that Shardling\'s Power on a 1-second burst', () => {
    const { state, defs } = open([shardling()], [
      { defId: 'fracture-shardling', slot: 0, level: 5 },
      { defId: 'fracture-shardling', slot: 1, level: 1 },
    ])
    const dying = actorAt(state, 0)
    const living = actorAt(state, 1)
    dying.hp = 1
    hold(dying)
    hold(living)
    state.hero.nextReadyMs = 10
    state.rng = rngBeforeDraw(0.05, 0)
    stepUntil(state, defs, () => dying.telegraph !== null)
    const death = state.log.find((event) => event.type === 'death' && event.actorId === dying.id)
    const resolvesAt = dying.telegraph?.resolvesAtMs ?? 0
    console.log('[enemy] burst owner', {
      dyingPower: dying.power,
      livingPower: living.power,
      death,
      resolvesAt,
    })
    expect(dying.power).not.toBe(living.power)
    expect(death).toMatchObject({ type: 'death' })
    if (death?.type === 'death') expect(resolvesAt - death.timeMs).toBe(1000)
    stepUntil(state, defs, () => state.log.some((event) => event.type === 'telegraph' && event.phase === 'resolve'))
    const hit = state.log.find((event) => event.type === 'damage' && event.actorId === dying.id)
    expect(hit).toMatchObject({
      school: 'magical',
      coefficient: 0.4,
      power: dying.power,
      crit: false,
      critChance: 0,
    })
    if (hit?.type === 'damage') expect(hit.raw).toBeCloseTo(dying.power * 0.4, 10)
    expect(state.log.some((event) => event.type === 'hitRoll' && event.actorId === dying.id)).toBe(false)
  })

  it('cancels a burst that is already counting when the last enemy dies', () => {
    const { state, defs } = open([shardling()], [
      { defId: 'fracture-shardling', slot: 0, level: 2 },
      { defId: 'fracture-shardling', slot: 1, level: 2 },
    ])
    const dying = actorAt(state, 0)
    const living = actorAt(state, 1)
    dying.hp = 1
    hold(dying)
    hold(living)
    state.hero.nextReadyMs = 10
    state.rng = rngBeforeDraw(0.05, 0)
    stepUntil(state, defs, () => dying.telegraph !== null)
    const resolvesAt = dying.telegraph?.resolvesAtMs ?? 0
    living.hp = 1
    state.hero.nextReadyMs = state.timeMs + 10
    state.rng = rngBeforeDraw(0.05, 0)
    expect(state.hero.nextReadyMs).toBeLessThan(resolvesAt)
    stepUntil(state, defs, () => state.outcome === 'victory')
    const burstDamage = state.log.filter(
      (event) => event.type === 'damage' && event.coefficient === 0.4,
    )
    console.log('[enemy] burst cleanup', {
      resolvesAt,
      timeMs: state.timeMs,
      phases: state.log.filter((event) => event.type === 'telegraph').map((event) => event.phase),
      burstDamage: burstDamage.length,
    })
    expect(state.outcome).toBe('victory')
    expect(state.timeMs).toBeLessThanOrEqual(resolvesAt)
    expect(burstDamage).toHaveLength(0)
    expect(dying.telegraph).toBeNull()
    expect(living.telegraph).toBeNull()
    expect(state.log.some((event) => event.type === 'telegraph' && event.phase === 'cancel')).toBe(true)
  })

  it('cancels a pending burst when the fight times out', () => {
    const { state, defs } = open([shardling()], [
      { defId: 'fracture-shardling', slot: 0, level: 2 },
      { defId: 'fracture-shardling', slot: 1, level: 2 },
    ])
    const dying = actorAt(state, 0)
    dying.hp = 1
    hold(dying)
    hold(actorAt(state, 1))
    state.hero.nextReadyMs = 10
    state.rng = rngBeforeDraw(0.05, 0)
    stepUntil(state, defs, () => dying.telegraph !== null)
    const resolvesAt = dying.telegraph?.resolvesAtMs ?? 0
    runCombat(state, defs, state.timeMs)
    console.log('[enemy] burst timeout', { outcome: state.outcome, resolvesAt, timeMs: state.timeMs })
    expect(state.outcome).toBe('timeout')
    expect(state.timeMs).toBeLessThan(resolvesAt)
    expect(dying.telegraph).toBeNull()
    expect(state.log.some((event) => event.type === 'telegraph' && event.phase === 'cancel')).toBe(true)
    expect(state.log.some((event) => event.type === 'damage' && event.coefficient === 0.4)).toBe(false)
  })
})

describe('telegraph automation', () => {
  it('shows a combat telegraph tag and the time until it resolves', () => {
    const watch: SkillDef = {
      id: 'watch',
      name: 'Watch',
      cost: 0,
      cooldownSeconds: 0,
      actionTimeCoefficient: 1,
      tags: ['physical'],
      target: 'single',
      effects: [{ kind: 'damage', school: 'physical', coefficient: 1 }],
    }
    const { state, defs } = open([wolf()], wolfSlots(1), 1, [watch])
    const enemy = actorAt(state, 0)
    hold(state.hero)
    stepUntil(state, defs, () => enemy.telegraph !== null)
    const telegraph = enemy.telegraph
    expect(telegraph).not.toBeNull()
    if (telegraph === null) return
    const started = state.log.find((event) => event.type === 'telegraph' && event.phase === 'start')
    expect(started).toMatchObject({ type: 'telegraph', timeMs: expect.any(Number) as number })
    if (started?.type !== 'telegraph') return
    const remaining = telegraph.resolvesAtMs - started.timeMs
    state.hero.priorityRows = [
      { skillId: 'watch', conditions: [{ kind: 'telegraph', tag: 'pounce', operator: 'atMost', value: remaining }] },
    ]
    const seen = chooseHeroAction(state, defs, state.hero, started.timeMs)
    state.hero.priorityRows = [
      {
        skillId: 'watch',
        conditions: [{ kind: 'telegraph', tag: 'pounce', operator: 'atMost', value: remaining - 1 }],
      },
    ]
    const early = chooseHeroAction(state, defs, state.hero, started.timeMs)
    state.hero.priorityRows = [
      { skillId: 'watch', conditions: [{ kind: 'telegraph', tag: 'fracture-burst', operator: 'present' }] },
    ]
    const otherTag = chooseHeroAction(state, defs, state.hero, started.timeMs)
    console.log('[enemy] telegraph visible', {
      tag: telegraph.tag,
      remaining,
      seen: seen.kind,
      early: early.events.map((event) => event.reason),
      otherTag: otherTag.events.map((event) => event.reason),
    })
    expect(remaining).toBe(1500)
    expect(seen).toMatchObject({ kind: 'skill', skill: { id: 'watch' } })
    expect(early.kind).toBe('basicAttack')
    expect(early.events.some((event) => event.reason === 'telegraph pounce 1500ms is above 1499ms')).toBe(true)
    expect(otherTag.kind).toBe('basicAttack')
    expect(otherTag.events.some((event) => event.reason === 'telegraph fracture-burst is absent')).toBe(true)
  })
})
