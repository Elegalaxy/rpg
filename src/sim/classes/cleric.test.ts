import { describe, expect, it } from 'vitest'

import { createCombat, runCombat, stepCombat } from '../combat.ts'
import { HEALING_ROLL_CEILING, HEALING_ROLL_FLOOR } from '../constants.ts'
import { centeredRoll, createRng, nextFloat, uniform, type RngState } from '../rng.ts'
import { FATAL_HP_LOSS_REASON } from '../skills.ts'
import { defenseReduction } from '../stats.ts'
import { CLASS_HOOK_NAMES, type CombatSetup, type CombatState, type EnemyDef, type GameDefs, type SkillDef } from '../types.ts'
import { normalizeBasicAttackResource, spiritResourceFactor } from './resources.ts'
import {
  CLERIC_VOWS,
  ENDURANCE_BASE_CAP,
  FAITH_MAXIMUM,
  FAITH_START,
  TEMPERANCE_BASE,
  VOW_ENDURANCE,
  VOW_STATE_KEY,
  VOW_TEMPERANCE,
  VOW_ZEAL,
  ZEAL_BASE,
  clericClass,
} from './cleric.ts'

const ITEM_LEVEL = 20
const QUALITY = 1

function armor(slot: 'head' | 'chest' | 'hands' | 'feet') {
  return { id: `ref-medium-${slot}`, slot, category: 'medium' as const, itemLevel: ITEM_LEVEL, quality: QUALITY }
}

function clericSetup(options?: {
  equipped?: readonly string[]
  rows?: CombatSetup['hero']['priorityRows']
  enemies?: CombatSetup['enemies']
  /** Null omits the vow. Omitted options use zeal. */
  vow?: string | null
  startingResource?: number
  classId?: CombatSetup['hero']['classId']
  weapon?: 'caster' | 'dagger' | 'oneHanded'
}): CombatSetup {
  const classId = options?.classId ?? 'cleric'
  const weapon = options?.weapon ?? (classId === 'warrior' ? 'oneHanded' : 'caster')
  const attributes =
    classId === 'warrior'
      ? { strength: 24, vitality: 22, agility: 16, intellect: 10, spirit: 16 }
      : classId === 'mage'
        ? { strength: 10, vitality: 16, agility: 16, intellect: 34, spirit: 12 }
        : { strength: 10, vitality: 22, agility: 14, intellect: 20, spirit: 22 }
  const hero: CombatSetup['hero'] = {
    id: `ref-${classId}`,
    name: classId,
    level: 20,
    classId,
    attributes,
    gear: {
      mainHand: { id: `weapon-${weapon}`, kind: weapon, itemLevel: ITEM_LEVEL, quality: QUALITY },
      offHand:
        classId === 'mage'
          ? { id: 'focus', kind: 'focus' as const, itemLevel: ITEM_LEVEL, quality: QUALITY }
          : { id: 'shield', kind: 'shield' as const, itemLevel: ITEM_LEVEL, quality: QUALITY },
      head: armor('head'),
      chest: armor('chest'),
      hands: armor('hands'),
      feet: armor('feet'),
      accessories: [
        { id: 'ref-accessory-a', itemLevel: ITEM_LEVEL, quality: QUALITY },
        { id: 'ref-accessory-b', itemLevel: ITEM_LEVEL, quality: QUALITY },
      ],
    },
    equippedSkillIds: options?.equipped,
    priorityRows: options?.rows,
    startingResource: options?.startingResource,
  }
  if (options?.vow !== null) hero.vow = options?.vow ?? VOW_ZEAL
  return {
    hero,
    enemies: options?.enemies ?? [{ defId: 'dummy', slot: 0 }],
  }
}

function dummy(overrides: EnemyDef['overrides'] = {}, id = 'dummy', name = 'Dummy'): EnemyDef {
  return { id, name, level: 20, archetype: 'standard', school: 'physical', overrides }
}

function skill(overrides: Partial<SkillDef> & Pick<SkillDef, 'id' | 'effects'>): SkillDef {
  return {
    name: overrides.id,
    cost: 0,
    cooldownSeconds: 0,
    actionTimeCoefficient: 1,
    tags: ['magical', 'attack'],
    target: 'single',
    ...overrides,
  }
}

function defsFor(skillList: readonly SkillDef[], enemies: readonly EnemyDef[] = [dummy({ actionTime: 30 })]): GameDefs {
  const skills: GameDefs['skills'] = {}
  for (const entry of skillList) skills[entry.id] = entry
  const book: GameDefs['enemies'] = {}
  for (const enemy of enemies) book[enemy.id] = enemy
  return { enemies: book, skills, statuses: {} }
}

function resources(state: CombatState, reason: string) {
  return state.log.filter((event) => event.type === 'resource' && event.reason === reason)
}

function until(state: CombatState, defs: GameDefs, seen: (state: CombatState) => boolean): void {
  let steps = 0
  while (state.outcome === 'ongoing' && !seen(state)) {
    stepCombat(state, defs)
    steps += 1
    if (steps > 20_000) throw new Error('combat did not reach the expected event')
  }
}

function rngFirstFloat(match: (value: number) => boolean): RngState {
  for (let seed = 1; seed < 200; seed += 1) {
    const rng = createRng(seed)
    const saved = { a: rng.a, b: rng.b, c: rng.c, d: rng.d }
    if (match(nextFloat(rng))) return saved
  }
  throw new Error('no rng state matched')
}

const smite = skill({
  id: 'smite',
  cooldownSeconds: 3,
  effects: [{ kind: 'damage', school: 'magical', coefficient: 1 }],
})

const mend = skill({
  id: 'mend',
  cost: 25,
  cooldownSeconds: 5,
  tags: ['heal'],
  effects: [{ kind: 'heal', maxHpFraction: 0, healingCoefficient: 1.2 }],
})

const ward = skill({
  id: 'ward',
  cost: 30,
  cooldownSeconds: 10,
  actionTimeCoefficient: 0.75,
  tags: ['defense'],
  effects: [{ kind: 'barrier', source: 'healing', coefficient: 1.5, durationSeconds: 8 }],
})

const penance = skill({
  id: 'penance',
  cooldownSeconds: 10,
  tags: ['faith'],
  effects: [
    { kind: 'loseHp', maxHpFraction: 0.1, preventFatal: true },
    { kind: 'resource', base: 25 },
  ],
})

const consecration = skill({
  id: 'consecration',
  cost: 40,
  cooldownSeconds: 15,
  actionTimeCoefficient: 1.2,
  tags: ['magical', 'heal'],
  target: 'all',
  effects: [
    {
      kind: 'field',
      durationSeconds: 8,
      tickSeconds: 2,
      damageSchool: 'magical',
      damageCoefficient: 0.35,
      healCoefficient: 0.25,
    },
  ],
})

describe('cleric faith', () => {
  it('starts Faith at 0 for the expedition and rejects a missing or unknown vow', () => {
    const defs = defsFor([])
    const state = createCombat(clericSetup({ startingResource: 40 }), defs, 1)
    const factor = spiritResourceFactor(22)
    console.log('[cleric] faith start', {
      resource: state.hero.classResource,
      id: state.hero.classResourceId,
      max: state.hero.classResourceMax,
      scope: state.hero.classResourceScope,
      vow: state.hero.classState[VOW_STATE_KEY],
      regen: state.hero.resourceRegenPerSecond,
      factor,
      vows: CLERIC_VOWS,
    })
    expect(state.hero.classResource).toBe(FAITH_START)
    expect(state.hero.classResourceId).toBe('faith')
    expect(state.hero.classResourceMax).toBe(FAITH_MAXIMUM)
    expect(state.hero.classResourceScope).toBe('expedition')
    expect(state.hero.resourceRegenPerSecond).toBe(0)
    expect(state.hero.suppliedResource).toBe(40)
    expect(state.hero.classState[VOW_STATE_KEY]).toBe(VOW_ZEAL)
    expect(factor).toBeCloseTo(1.1527777777777777, 10)

    const missing = clericSetup({ vow: null })
    expect(() => createCombat(missing, defs, 1)).toThrow(/cleric vow is missing; expected zeal, endurance, or temperance/)
    const unknown = clericSetup({ vow: 'wrath' })
    expect(() => createCombat(unknown, defs, 1)).toThrow(
      /cleric vow 'wrath' is unknown; expected zeal, endurance, or temperance/,
    )
    const malformed = clericSetup({ classId: 'warrior' })
    malformed.hero.vow = 1 as unknown as string
    expect(() => createCombat(malformed, defs, 1)).toThrow(/vow must be a string/)

    const warrior = createCombat(clericSetup({ classId: 'warrior', vow: 'nope' }), defs, 1)
    const mage = createCombat(clericSetup({ classId: 'mage', vow: VOW_ZEAL }), defs, 1)
    console.log('[cleric] other classes ignore vow', {
      warrior: warrior.hero.classResourceId,
      warriorVow: warrior.hero.suppliedVow,
      mage: mage.hero.classResource,
    })
    expect(warrior.hero.classResourceId).toBe('fury')
    expect(warrior.hero.classResource).toBe(0)
    expect(warrior.hero.suppliedVow).toBe('nope')
    expect(mage.hero.classResourceId).toBe('mana')
    expect(mage.hero.classResource).toBe(100)
  })

  it('grants Zeal once per damaging hero action, then Spirit, and ignores misses, absorbs, and later ticks', () => {
    const factor = spiritResourceFactor(22)
    const twin = skill({
      id: 'twin',
      effects: [
        { kind: 'damage', school: 'magical', coefficient: 1 },
        { kind: 'damage', school: 'magical', coefficient: 1 },
      ],
    })
    const defs = defsFor([twin], [dummy({ actionTime: 30, maxHp: 100_000, resistance: 0 })])
    const dagger = createCombat(
      clericSetup({ weapon: 'dagger', equipped: [twin.id], rows: [{ skillId: twin.id }] }),
      defs,
      1,
    )
    until(dagger, defs, (combat) => combat.log.some((event) => event.type === 'action' && event.skillId === twin.id))
    const firstAction = dagger.log.find((event) => event.type === 'action' && event.skillId === twin.id)
    const firstTime = firstAction?.type === 'action' ? firstAction.timeMs : -1
    const firstZeal = resources(dagger, VOW_ZEAL).filter((event) => event.type === 'resource' && event.timeMs === firstTime)
    const hits = dagger.log.filter((event) => event.type === 'damage' && event.timeMs === firstTime)
    console.log('[cleric] zeal once', {
      hits: hits.length,
      base: firstZeal[0]?.type === 'resource' ? firstZeal[0].base : null,
      generated: firstZeal[0]?.type === 'resource' ? firstZeal[0].generated : null,
      weaponSeconds: dagger.hero.baseActionSeconds,
      normalized: normalizeBasicAttackResource(ZEAL_BASE, dagger.hero.baseActionSeconds),
      factor,
    })
    expect(hits).toHaveLength(2)
    expect(firstZeal).toHaveLength(1)
    expect(firstZeal[0]).toMatchObject({ base: ZEAL_BASE, multiplier: factor })
    expect(firstZeal[0]?.type === 'resource' ? firstZeal[0].generated : 0).toBeCloseTo(ZEAL_BASE * factor, 10)
    expect(normalizeBasicAttackResource(ZEAL_BASE, dagger.hero.baseActionSeconds)).not.toBe(ZEAL_BASE)
    until(dagger, defs, (combat) => resources(combat, VOW_ZEAL).length >= 2)
    expect(resources(dagger, VOW_ZEAL)).toHaveLength(2)
    expect(dagger.hero.classState[VOW_STATE_KEY]).toBe(VOW_ZEAL)
    dagger.hero.suppliedVow = VOW_ENDURANCE
    expect(dagger.hero.classState[VOW_STATE_KEY]).toBe(VOW_ZEAL)

    const absorbed = createCombat(clericSetup({ equipped: [smite.id], rows: [{ skillId: smite.id }] }), defsFor([smite]), 1)
    const sponge = absorbed.enemies[0]
    if (sponge === undefined) throw new Error('missing enemy')
    sponge.barrier = 1_000_000
    sponge.barrierExpiresMs = 999_999
    const hpBefore = sponge.hp
    until(absorbed, defsFor([smite]), (combat) => combat.log.some((event) => event.type === 'action' && event.skillId === smite.id))
    console.log('[cleric] zeal absorb', { hp: sponge.hp, zeal: resources(absorbed, VOW_ZEAL).length })
    expect(sponge.hp).toBe(hpBefore)
    expect(resources(absorbed, VOW_ZEAL)).toHaveLength(0)

    const missed = createCombat(clericSetup({ equipped: [] }), defsFor([]), 1)
    missed.hero.accuracy = 0
    const missEnemy = missed.enemies[0]
    if (missEnemy === undefined) throw new Error('missing enemy')
    missEnemy.evasion = 100
    missed.rng = rngFirstFloat((value) => value >= 0.5)
    until(missed, defsFor([]), (combat) => combat.log.some((event) => event.type === 'hitRoll' && event.actorId === combat.hero.id))
    const roll = missed.log.find((event) => event.type === 'hitRoll' && event.actorId === missed.hero.id)
    console.log('[cleric] zeal miss', { hit: roll?.type === 'hitRoll' ? roll.hit : null, zeal: resources(missed, VOW_ZEAL).length })
    expect(roll).toMatchObject({ type: 'hitRoll', hit: false })
    expect(resources(missed, VOW_ZEAL)).toHaveLength(0)

    const ticked = createCombat(clericSetup({ equipped: [smite.id], rows: [{ skillId: smite.id }] }), defsFor([smite]), 1)
    const burned = ticked.enemies[0]
    if (burned === undefined) throw new Error('missing enemy')
    const beforeTick = burned.hp
    burned.statuses.burn = {
      name: 'Burn',
      intensity: 1,
      power: 80,
      penetration: 1,
      coefficient: 1,
      attackerLevel: 20,
      sourceId: ticked.hero.id,
      sourceName: ticked.hero.name,
      expiresMs: 8_000,
      tickMs: 1_000,
      nextTickMs: 500,
    }
    ticked.hero.nextReadyMs = 50_000
    until(ticked, defsFor([smite]), (combat) => combat.timeMs >= 500)
    console.log('[cleric] zeal tick', {
      hp: burned.hp,
      zeal: resources(ticked, VOW_ZEAL).length,
      ticks: ticked.log.filter((event) => event.type === 'statusTick').length,
    })
    expect(burned.hp).toBeLessThan(beforeTick)
    expect(resources(ticked, VOW_ZEAL)).toHaveLength(0)
  })

  it('grants Endurance once per enemy hit, caps the base at 10, and skips status ticks and Penance', () => {
    const factor = spiritResourceFactor(22)
    const defs = defsFor([])
    const state = createCombat(clericSetup({ vow: VOW_ENDURANCE }), defs, 1)
    const taken = clericClass.damageTaken
    if (taken === undefined) throw new Error('cleric damageTaken is missing')
    taken(state, { hpLost: 1, hpBefore: state.hero.hp, barrierAbsorbed: 0, kind: 'hit', timeMs: 1, school: 'physical' })
    const small = resources(state, VOW_ENDURANCE)[0]
    const smallBase = small?.type === 'resource' ? small.base : 0
    console.log('[cleric] endurance fraction', { base: smallBase, generated: small?.type === 'resource' ? small.generated : null })
    expect(smallBase).toBeCloseTo((1 / state.hero.maxHp) * 100, 10)
    expect(smallBase).not.toBe(Math.floor(smallBase))
    expect(small?.type === 'resource' ? small.generated : 0).toBeCloseTo(smallBase * factor, 10)

    const capped = createCombat(clericSetup({ vow: VOW_ENDURANCE }), defs, 1)
    taken(capped, {
      hpLost: 37,
      hpBefore: capped.hero.hp,
      barrierAbsorbed: 37,
      kind: 'hit',
      timeMs: 2,
      school: 'physical',
    })
    const cappedEvent = resources(capped, VOW_ENDURANCE)
    console.log('[cleric] endurance cap', {
      events: cappedEvent.length,
      base: cappedEvent[0]?.type === 'resource' ? cappedEvent[0].base : null,
      generated: cappedEvent[0]?.type === 'resource' ? cappedEvent[0].generated : null,
      gainCap: cappedEvent[0]?.type === 'resource' ? cappedEvent[0].gainCap : null,
    })
    expect(cappedEvent).toHaveLength(1)
    expect(cappedEvent[0]).toMatchObject({ base: ENDURANCE_BASE_CAP, gainCap: null })
    expect(cappedEvent[0]?.type === 'resource' ? cappedEvent[0].generated : 0).toBeCloseTo(ENDURANCE_BASE_CAP * factor, 10)

    const quiet = createCombat(clericSetup({ vow: VOW_ENDURANCE }), defs, 1)
    taken(quiet, { hpLost: 40, hpBefore: quiet.hero.hp, barrierAbsorbed: 20, kind: 'statusTick', timeMs: 3, school: 'physical' })
    taken(quiet, { hpLost: 0, hpBefore: quiet.hero.hp, barrierAbsorbed: 0, kind: 'miss', timeMs: 4, school: 'physical' })
    taken(quiet, { hpLost: 0, hpBefore: quiet.hero.hp, kind: 'hit', timeMs: 5, school: 'physical' })
    expect(resources(quiet, VOW_ENDURANCE)).toHaveLength(0)

    const poisoned = createCombat(clericSetup({ vow: VOW_ENDURANCE }), defs, 1)
    poisoned.hero.armor = 0
    poisoned.hero.nextReadyMs = 50_000
    const idle = poisoned.enemies[0]
    if (idle === undefined) throw new Error('missing enemy')
    idle.nextReadyMs = 50_000
    const hpBefore = poisoned.hero.hp
    poisoned.hero.statuses.poison = {
      name: 'Poison',
      stacks: [
        {
          power: 100,
          penetration: 1,
          coefficient: 1,
          attackerLevel: 20,
          sourceId: idle.id,
          sourceName: idle.name,
        },
      ],
      expiresMs: 8_000,
      tickMs: 2_000,
      nextTickMs: 500,
    }
    until(poisoned, defs, (combat) => combat.timeMs >= 500)
    console.log('[cleric] endurance tick', {
      hp: poisoned.hero.hp,
      faith: resources(poisoned, VOW_ENDURANCE).length,
    })
    expect(poisoned.hero.hp).toBeLessThan(hpBefore)
    expect(resources(poisoned, VOW_ENDURANCE)).toHaveLength(0)

    const struck = createCombat(clericSetup({ vow: VOW_ENDURANCE }), defs, 1)
    struck.hero.nextReadyMs = 1_000_000
    struck.hero.armor = 0
    struck.hero.evasion = 0
    struck.hero.damageReduction = 0
    struck.hero.incomingMultipliers = []
    struck.rng = rngFirstFloat((value) => value < 0.2)
    const striker = struck.enemies[0]
    if (striker === undefined) throw new Error('missing enemy')
    striker.nextReadyMs = 100
    striker.power = 5_000
    striker.accuracy = 100
    until(struck, defs, (combat) => combat.log.some((event) => event.type === 'damage' && event.targetId === combat.hero.id))
    const wired = resources(struck, VOW_ENDURANCE)
    console.log('[cleric] endurance action', {
      events: wired.length,
      base: wired[0]?.type === 'resource' ? wired[0].base : null,
    })
    expect(wired).toHaveLength(1)
    expect(wired[0]).toMatchObject({ base: ENDURANCE_BASE_CAP })

    const punished = createCombat(
      clericSetup({
        vow: VOW_ENDURANCE,
        equipped: [penance.id],
        rows: [{ skillId: penance.id }],
      }),
      defsFor([penance]),
      1,
    )
    punished.hero.barrier = 80
    punished.hero.barrierExpiresMs = 999_999
    const barrierBefore = punished.hero.barrier
    const healthBefore = punished.hero.hp
    until(punished, defsFor([penance]), (combat) => combat.log.some((event) => event.type === 'hpLoss'))
    const loss = punished.log.find((event) => event.type === 'hpLoss')
    console.log('[cleric] penance not endurance', {
      loss: loss?.type === 'hpLoss' ? loss.amount : null,
      hp: punished.hero.hp,
      barrier: punished.hero.barrier,
      endurance: resources(punished, VOW_ENDURANCE).length,
      penance: resources(punished, penance.id).length,
    })
    expect(loss).toMatchObject({
      type: 'hpLoss',
      amount: punished.hero.maxHp * 0.1,
      barrierBypassed: true,
      defenseBypassed: true,
    })
    expect(punished.hero.hp).toBeCloseTo(healthBefore - punished.hero.maxHp * 0.1, 10)
    expect(punished.hero.barrier).toBe(barrierBefore)
    expect(resources(punished, VOW_ENDURANCE)).toHaveLength(0)
    expect(resources(punished, penance.id)[0]).toMatchObject({ base: 25, multiplier: factor })
  })

  it('grants Temperance when only the pre-roll heal exceeds missing HP, and still logs overcap and the HP band', () => {
    const factor = spiritResourceFactor(22)
    const defs = defsFor([mend])
    const state = createCombat(clericSetup({ vow: VOW_TEMPERANCE, equipped: [mend.id], rows: [{ skillId: mend.id }] }), defs, 1)
    state.hero.maxHp = 1_000
    state.hero.hp = 500
    state.hero.healingPower = 10_000
    state.hero.healingReceived = 0.001
    state.hero.classResource = 25
    until(state, defs, (combat) => combat.log.some((event) => event.type === 'heal'))
    const heal = state.log.find((event) => event.type === 'heal')
    if (heal?.type !== 'heal') throw new Error('missing heal')
    const missing = state.hero.maxHp - heal.targetHpBefore
    const ratio = state.hero.hp / state.hero.maxHp
    console.log('[cleric] temperance pre-roll heal', {
      raw: heal.raw,
      amount: heal.amount,
      missing,
      ratio,
      overhealed: state.hero.overhealed,
      faith: state.hero.classResource,
    })
    expect(heal.raw).toBeGreaterThan(missing)
    expect(heal.amount).toBeLessThanOrEqual(missing)
    expect(ratio).toBeGreaterThanOrEqual(0.4)
    expect(ratio).toBeLessThanOrEqual(0.8)
    expect(state.hero.overhealed).toBe(false)
    expect(state.log.some((event) => event.type === 'vow')).toBe(false)
    expect(resources(state, VOW_TEMPERANCE)).toHaveLength(1)

    const full = createCombat(clericSetup({ vow: VOW_TEMPERANCE, equipped: [smite.id], rows: [{ skillId: smite.id }] }), defsFor([smite]), 1)
    until(full, defsFor([smite]), (combat) => combat.log.some((event) => event.type === 'vow'))
    expect(full.log.find((event) => event.type === 'vow')).toMatchObject({ reason: 'hp' })

    const resolved = clericClass.actionResolved
    if (resolved === undefined) throw new Error('cleric actionResolved is missing')
    const band = createCombat(clericSetup({ vow: VOW_TEMPERANCE }), defsFor([]), 1)
    for (const hp of [400, 800]) {
      band.hero.maxHp = 1_000
      band.hero.hp = hp
      band.hero.overhealed = false
      band.hero.classResource = 0
      resolved(band, { kind: 'basicAttack', hit: false, hpLost: 0 }, hp)
    }
    expect(resources(band, VOW_TEMPERANCE)).toHaveLength(2)
    expect(resources(band, VOW_TEMPERANCE)[0]).toMatchObject({ base: TEMPERANCE_BASE })
    band.hero.hp = 399
    band.hero.classResource = 0
    resolved(band, { kind: 'basicAttack', hit: false, hpLost: 0 }, 399)
    band.hero.hp = 801
    resolved(band, { kind: 'basicAttack', hit: false, hpLost: 0 }, 801)
    const outside = band.log.filter((event) => event.type === 'vow')
    console.log('[cleric] temperance band', { grants: resources(band, VOW_TEMPERANCE).length, outside: outside.map((event) => event.type === 'vow' ? event.reason : '') })
    expect(outside.map((event) => (event.type === 'vow' ? event.reason : ''))).toEqual(['hp', 'hp'])

    const ordered = createCombat(
      clericSetup({ vow: VOW_TEMPERANCE, equipped: [penance.id], rows: [{ skillId: penance.id }] }),
      defsFor([penance]),
      1,
    )
    ordered.hero.maxHp = 1_000
    ordered.hero.hp = 850
    ordered.hero.classResource = 0
    until(ordered, defsFor([penance]), (combat) => combat.log.some((event) => event.type === 'hpLoss'))
    console.log('[cleric] temperance after penance', {
      hp: ordered.hero.hp,
      faith: ordered.hero.classResource,
      temperance: resources(ordered, VOW_TEMPERANCE).length,
      vows: ordered.log.filter((event) => event.type === 'vow').length,
    })
    expect(ordered.hero.hp).toBeCloseTo(750, 10)
    expect(ordered.log.some((event) => event.type === 'vow')).toBe(false)
    expect(resources(ordered, penance.id)).toHaveLength(1)
    expect(resources(ordered, VOW_TEMPERANCE)).toHaveLength(1)
    expect(ordered.hero.classResource).toBeCloseTo(25 * factor + TEMPERANCE_BASE * factor, 8)

    const overcap = createCombat(
      clericSetup({ vow: VOW_TEMPERANCE, equipped: [penance.id], rows: [{ skillId: penance.id }] }),
      defsFor([penance]),
      1,
    )
    overcap.hero.maxHp = 1_000
    overcap.hero.hp = 600
    overcap.hero.classResource = 90
    until(overcap, defsFor([penance]), (combat) => combat.log.some((event) => event.type === 'vow'))
    const clamped = resources(overcap, penance.id)[0]
    console.log('[cleric] temperance overcap', {
      before: clamped?.type === 'resource' ? clamped.before : null,
      after: clamped?.type === 'resource' ? clamped.after : null,
      reason: overcap.log.find((event) => event.type === 'vow'),
      faith: overcap.hero.classResource,
    })
    expect(clamped).toMatchObject({ type: 'resource', before: 90, after: FAITH_MAXIMUM })
    expect(overcap.log.find((event) => event.type === 'vow')).toMatchObject({ reason: 'overcap' })
    expect(resources(overcap, VOW_TEMPERANCE)).toHaveLength(0)
    expect(overcap.hero.classResource).toBe(FAITH_MAXIMUM)
  })

  it('blocks a fatal Penance without spending HP, Faith, or the cooldown', () => {
    const defs = defsFor([penance])
    const state = createCombat(
      clericSetup({ vow: VOW_ENDURANCE, equipped: [penance.id], rows: [{ skillId: penance.id }] }),
      defs,
      1,
    )
    state.hero.hp = state.hero.maxHp * 0.1
    const hp = state.hero.hp
    until(state, defs, (combat) => combat.log.some((event) => event.type === 'action' && event.actorId === combat.hero.id))
    const skip = state.log.find((event) => event.type === 'priority' && event.decision === 'skip')
    const action = state.log.find((event) => event.type === 'action' && event.actorId === state.hero.id)
    console.log('[cleric] penance fatal', {
      reason: skip?.type === 'priority' ? skip.reason : null,
      action: action?.type === 'action' ? action.action : null,
      hp: state.hero.hp,
      faith: state.hero.classResource,
      cooldown: state.hero.cooldowns[penance.id],
    })
    expect(skip).toMatchObject({ reason: FATAL_HP_LOSS_REASON, skillId: penance.id })
    expect(action).toMatchObject({ action: 'basicAttack' })
    expect(state.hero.hp).toBe(hp)
    expect(state.hero.classResource).toBe(0)
    expect(state.hero.cooldowns[penance.id]).toBeUndefined()
    expect(state.log.some((event) => event.type === 'hpLoss')).toBe(false)
    expect(resources(state, penance.id)).toHaveLength(0)
  })

  it('replaces the Consecration field, ticks at 2, 4, and 6 seconds, and does not grant Zeal', () => {
    const foes = [
      dummy({ actionTime: 30, maxHp: 5_000, resistance: 0 }, 'dummy', 'Alpha'),
      dummy({ actionTime: 30, maxHp: 5_000, resistance: 0 }, 'dummy', 'Beta'),
    ]
    const defs = defsFor(
      [consecration],
      foes,
    )
    const state = createCombat(
      clericSetup({
        equipped: [consecration.id],
        rows: [{ skillId: consecration.id }],
        enemies: [
          { defId: 'dummy', slot: 0 },
          { defId: 'dummy', slot: 1 },
        ],
      }),
      defs,
      1,
    )
    state.hero.classResource = 40
    state.hero.magicalPower = 100
    state.hero.magicalPenetration = 0
    state.hero.healingPower = 40
    state.hero.healingReceived = 1
    state.hero.hp = state.hero.maxHp - 100
    for (const enemy of state.enemies) {
      enemy.resistance = 0
      enemy.barrier = 50
      enemy.barrierExpiresMs = 999_999
    }
    const hpBefore = state.hero.hp
    until(state, defs, (combat) => combat.log.some((event) => event.type === 'field'))
    const cast = state.log.find((event) => event.type === 'field')
    if (cast?.type !== 'field') throw new Error('missing field')
    const castAt = cast.timeMs
    state.hero.magicalPower = 1
    state.hero.healingPower = 0
    until(state, defs, (combat) => combat.log.some((event) => event.type === 'fieldTick'))
    const firstTicks = state.log.filter((event) => event.type === 'fieldTick')
    const firstHeal = state.log.find((event) => event.type === 'fieldHeal')
    console.log('[cleric] consecration tick', {
      castAt,
      ticks: firstTicks.map((event) => (event.type === 'fieldTick' ? event.timeMs : 0)),
      power: firstTicks[0]?.type === 'fieldTick' ? firstTicks[0].power : null,
      damage: firstTicks[0]?.type === 'fieldTick' ? firstTicks[0].hpDamage : null,
      barrier: state.enemies[0]?.barrier,
      heal: firstHeal?.type === 'fieldHeal' ? firstHeal.amount : null,
      zeal: resources(state, VOW_ZEAL).length,
      faith: state.hero.classResource,
    })
    expect(firstTicks).toHaveLength(2)
    expect(firstTicks.every((event) => event.type === 'fieldTick' && event.timeMs === castAt + 2_000)).toBe(true)
    expect(firstTicks[0]).toMatchObject({
      power: 100,
      coefficient: 0.35,
      hpDamage: 35,
      barrierBypassed: true,
      crit: false,
      varianceRoll: false,
    })
    expect(state.enemies.every((enemy) => enemy.barrier === 50)).toBe(true)
    expect(firstHeal).toMatchObject({ type: 'fieldHeal', amount: 10, raw: 10, healingPower: 40 })
    expect(state.hero.hp).toBe(hpBefore + 10)
    expect(resources(state, VOW_ZEAL)).toHaveLength(0)
    expect(state.hero.classResource).toBe(0)

    until(state, defs, (combat) => combat.timeMs > castAt + 8_000)
    const tickTimes = state.log.flatMap((event) => (event.type === 'fieldTick' ? [event.timeMs] : []))
    const uniqueTimes = [...new Set(tickTimes)]
    console.log('[cleric] consecration schedule', { uniqueTimes, expires: cast.expiresMs, field: state.hero.field })
    expect(uniqueTimes).toEqual([castAt + 2_000, castAt + 4_000, castAt + 6_000])
    expect(tickTimes).not.toContain(castAt + 8_000)
    expect(state.hero.field).toBeNull()
    expect(state.log.some((event) => event.type === 'fieldExpired' && event.timeMs === castAt + 8_000)).toBe(true)
    const zealTimes = resources(state, VOW_ZEAL).flatMap((event) => (event.type === 'resource' ? [event.timeMs] : []))
    for (const timeMs of uniqueTimes) expect(zealTimes).not.toContain(timeMs)

    const recast = createCombat(
      clericSetup({
        equipped: [consecration.id],
        rows: [{ skillId: consecration.id }],
      }),
      defsFor([consecration], [dummy({ actionTime: 30, maxHp: 5_000, resistance: 0 })]),
      1,
    )
    const recastDefs = defsFor([consecration], [dummy({ actionTime: 30, maxHp: 5_000, resistance: 0 })])
    recast.hero.classResource = 100
    recast.hero.magicalPower = 100
    until(recast, recastDefs, (combat) => combat.log.some((event) => event.type === 'field'))
    const original = recast.hero.field
    if (original === null) throw new Error('missing original field')
    const originalExpires = original.expiresMs
    until(recast, recastDefs, (combat) => combat.timeMs >= (combat.log.find((event) => event.type === 'field')?.timeMs ?? 0) + 500)
    expect(recast.log.some((event) => event.type === 'fieldTick')).toBe(false)
    recast.hero.magicalPower = 200
    recast.hero.classResource = 100
    delete recast.hero.cooldowns[consecration.id]
    recast.hero.nextReadyMs = recast.timeMs + 10
    until(recast, recastDefs, (combat) => combat.log.filter((event) => event.type === 'field').length >= 2)
    const replaced = recast.log.filter((event) => event.type === 'field')[1]
    console.log('[cleric] consecration recast', {
      replaced: replaced?.type === 'field' ? replaced.replaced : null,
      power: recast.hero.field?.power,
      expires: recast.hero.field?.expiresMs,
      previous: originalExpires,
    })
    expect(replaced).toMatchObject({ type: 'field', replaced: true, power: 200 })
    expect(recast.hero.field?.power).toBe(200)
    expect(recast.hero.field?.expiresMs).not.toBe(originalExpires)
    expect(recast.hero.field?.expiresMs).toBe((replaced?.type === 'field' ? replaced.timeMs : 0) + 8_000)
    until(recast, recastDefs, (combat) => combat.log.some((event) => event.type === 'fieldTick'))
    const replacedTick = recast.log.find((event) => event.type === 'fieldTick')
    expect(replacedTick).toMatchObject({ type: 'fieldTick', power: 200 })
    expect(recast.log.some((event) => event.type === 'fieldTick' && event.power === 100)).toBe(false)
    const recastZeal = resources(recast, VOW_ZEAL).flatMap((event) => (event.type === 'resource' ? [event.timeMs] : []))
    const recastTicks = recast.log.flatMap((event) => (event.type === 'fieldTick' ? [event.timeMs] : []))
    for (const timeMs of recastTicks) expect(recastZeal).not.toContain(timeMs)
  })

  it('keeps Faith after victory, falls back to a basic attack, and aims Mend and Ward at the caster', () => {
    const factor = spiritResourceFactor(22)
    const defs = defsFor([smite], [dummy({ maxHp: 1, resistance: 0, actionTime: 30 })])
    const state = createCombat(clericSetup({ equipped: [smite.id], rows: [{ skillId: smite.id }] }), defs, 1)
    runCombat(state, defs, 30_000)
    console.log('[cleric] after victory', {
      outcome: state.outcome,
      faith: state.hero.classResource,
      scope: state.hero.classResourceScope,
      vow: state.hero.classState[VOW_STATE_KEY],
    })
    expect(state.outcome).toBe('victory')
    expect(state.hero.classResource).toBeCloseTo(ZEAL_BASE * factor, 10)
    expect(state.hero.classResourceScope).toBe('expedition')
    expect(state.hero.classState[VOW_STATE_KEY]).toBe(VOW_ZEAL)
    expect(state.log.some((event) => event.type === 'resource' && event.reason === 'encounterEnd')).toBe(false)
    const again = createCombat(clericSetup({ equipped: [smite.id], rows: [{ skillId: smite.id }] }), defs, 1)
    expect(again.hero.classResource).toBe(0)

    const broke = createCombat(clericSetup({ equipped: [mend.id], rows: [{ skillId: mend.id }] }), defsFor([mend]), 1)
    until(broke, defsFor([mend]), (combat) => combat.log.some((event) => event.type === 'action' && event.actorId === combat.hero.id))
    const fallback = broke.log.find((event) => event.type === 'action' && event.actorId === broke.hero.id)
    console.log('[cleric] basic fallback', { action: fallback?.type === 'action' ? fallback.action : null })
    expect(broke.log.some((event) => event.type === 'priority' && event.reason === 'unaffordable')).toBe(true)
    expect(fallback).toMatchObject({ action: 'basicAttack' })

    const cared = createCombat(
      clericSetup({ equipped: [mend.id], rows: [{ skillId: mend.id }] }),
      defsFor([mend]),
      1,
    )
    cared.hero.classResource = 25
    cared.hero.hp = 100
    const enemyHp = cared.enemies[0]?.hp
    until(cared, defsFor([mend]), (combat) => combat.log.some((event) => event.type === 'heal'))
    const heal = cared.log.find((event) => event.type === 'heal')
    console.log('[cleric] mend caster', { target: heal?.type === 'heal' ? heal.targetId : null, hp: cared.hero.hp })
    expect(heal).toMatchObject({ targetId: cared.hero.id })
    expect(cared.hero.hp).toBeGreaterThan(100)
    expect(cared.enemies[0]?.hp).toBe(enemyHp)

    const warded = createCombat(
      clericSetup({ equipped: [ward.id], rows: [{ skillId: ward.id }] }),
      defsFor([ward]),
      1,
    )
    warded.hero.classResource = 100
    warded.hero.healingPower = 10
    until(warded, defsFor([ward]), (combat) => combat.log.some((event) => event.type === 'barrier'))
    const gained = warded.log.find((event) => event.type === 'barrier')
    expect(gained).toMatchObject({ type: 'barrier', amount: 15 })
    if (gained?.type === 'barrier') expect(gained.expiresMs - gained.timeMs).toBe(8_000)
    expect(warded.hero.barrier).toBe(15)
    expect(warded.enemies[0]?.barrier).toBe(0)
    warded.hero.healingPower = 20
    warded.hero.classResource = 100
    delete warded.hero.cooldowns[ward.id]
    warded.hero.nextReadyMs = warded.timeMs + 10
    until(warded, defsFor([ward]), (combat) => combat.log.filter((event) => event.type === 'barrier').length >= 2)
    const second = warded.log.filter((event) => event.type === 'barrier')[1]
    console.log('[cleric] ward replace', {
      amount: warded.hero.barrier,
      replaced: second?.type === 'barrier' ? second.replaced : null,
    })
    expect(second).toMatchObject({ type: 'barrier', amount: 30, replaced: 15 })
    expect(warded.hero.barrier).toBe(30)
  })

  it('grants Temperance for a modest heal that ends inside the band', () => {
    const defs = defsFor([mend])
    const modest = createCombat(
      clericSetup({ vow: VOW_TEMPERANCE, equipped: [mend.id], rows: [{ skillId: mend.id }] }),
      defs,
      1,
    )
    modest.hero.maxHp = 1_000
    modest.hero.hp = 500
    modest.hero.healingPower = 50
    modest.hero.healingReceived = 1
    modest.hero.classResource = 25
    until(modest, defs, (combat) => combat.log.some((event) => event.type === 'heal'))
    const smallHeal = modest.log.find((event) => event.type === 'heal')
    if (smallHeal?.type !== 'heal') throw new Error('missing modest heal')
    const smallMissing = modest.hero.maxHp - smallHeal.targetHpBefore
    console.log('[cleric] temperance modest heal', {
      raw: smallHeal.raw,
      amount: smallHeal.amount,
      missing: smallMissing,
      ratio: modest.hero.hp / modest.hero.maxHp,
    })
    expect(smallHeal.raw).toBeLessThanOrEqual(smallMissing)
    expect(smallHeal.amount).toBeLessThanOrEqual(smallMissing)
    expect(modest.hero.hp / modest.hero.maxHp).toBeGreaterThanOrEqual(0.4)
    expect(modest.hero.hp / modest.hero.maxHp).toBeLessThanOrEqual(0.8)
    expect(resources(modest, VOW_TEMPERANCE)).toHaveLength(1)
    expect(resources(modest, VOW_TEMPERANCE)[0]).toMatchObject({ base: TEMPERANCE_BASE })
  })

  it('grants Temperance when the applied heal stays inside the band and does not exceed missing HP', () => {
    const factor = spiritResourceFactor(22)
    const defs = defsFor([mend])
    const fitted = createCombat(
      clericSetup({ vow: VOW_TEMPERANCE, equipped: [mend.id], rows: [{ skillId: mend.id }] }),
      defs,
      1,
    )
    fitted.hero.maxHp = 1_000
    fitted.hero.hp = 500
    fitted.hero.healingPower = 10_000
    fitted.hero.healingReceived = 0.001
    fitted.hero.classResource = 25
    until(fitted, defs, (combat) => combat.log.some((event) => event.type === 'heal'))
    const heal = fitted.log.find((event) => event.type === 'heal')
    if (heal?.type !== 'heal') throw new Error('missing heal')
    const missing = fitted.hero.maxHp - heal.targetHpBefore
    const ratio = fitted.hero.hp / fitted.hero.maxHp
    console.log('[cleric] temperance fitted heal', {
      raw: heal.raw,
      amount: heal.amount,
      missing,
      ratio,
      overhealed: fitted.hero.overhealed,
      faith: fitted.hero.classResource,
    })
    expect(missing).toBe(500)
    expect(heal.amount).toBe(11)
    expect(ratio).toBeCloseTo(0.511, 10)
    expect(fitted.hero.hp).toBe(511)
    expect(fitted.hero.overhealed).toBe(false)
    expect(fitted.log.some((event) => event.type === 'vow')).toBe(false)
    expect(resources(fitted, VOW_TEMPERANCE)).toHaveLength(1)
    expect(resources(fitted, VOW_TEMPERANCE)[0]).toMatchObject({ base: TEMPERANCE_BASE, multiplier: factor })
  })

  it('logs overheal when the applied heal exceeds the HP that was missing', () => {
    const defs = defsFor([mend])
    const state = createCombat(
      clericSetup({ vow: VOW_TEMPERANCE, equipped: [mend.id], rows: [{ skillId: mend.id }] }),
      defs,
      1,
    )
    state.hero.maxHp = 1_000
    state.hero.hp = 700
    state.hero.healingPower = 400
    state.hero.healingReceived = 1
    state.hero.classResource = 25
    until(state, defs, (combat) => combat.log.some((event) => event.type === 'heal'))
    const heal = state.log.find((event) => event.type === 'heal')
    const failure = state.log.find((event) => event.type === 'vow')
    if (heal?.type !== 'heal') throw new Error('missing heal')
    const missing = state.hero.maxHp - heal.targetHpBefore
    console.log('[cleric] temperance real overheal', {
      raw: heal.raw,
      amount: heal.amount,
      missing,
      ratio: state.hero.hp / state.hero.maxHp,
      reason: failure?.type === 'vow' ? failure.reason : null,
    })
    expect(missing).toBe(300)
    expect(heal.amount).toBe(440)
    expect(state.hero.hp).toBe(1_000)
    expect(state.hero.hp / state.hero.maxHp).toBe(1)
    expect(failure).toMatchObject({ type: 'vow', vow: VOW_TEMPERANCE, reason: 'overheal' })
    expect(resources(state, VOW_TEMPERANCE)).toHaveLength(0)
  })

  it('uses current Resistance and healing received on Consecration ticks, which do not grant Temperance', () => {
    const defs = defsFor([consecration], [dummy({ actionTime: 30, maxHp: 5_000, resistance: 0 })])
    const state = createCombat(
      clericSetup({
        vow: VOW_TEMPERANCE,
        equipped: [consecration.id],
        rows: [{ skillId: consecration.id }],
      }),
      defs,
      1,
    )
    state.hero.maxHp = 1_000
    state.hero.hp = 600
    state.hero.classResource = 40
    state.hero.magicalPower = 100
    state.hero.magicalPenetration = 0
    state.hero.healingPower = 40
    state.hero.healingReceived = 1.5
    const enemy = state.enemies[0]
    if (enemy === undefined) throw new Error('missing enemy')
    enemy.resistance = 0
    until(state, defs, (combat) => combat.log.some((event) => event.type === 'field'))
    const cast = state.log.find((event) => event.type === 'field')
    if (cast?.type !== 'field') throw new Error('missing field')
    state.hero.nextReadyMs = state.timeMs + 100_000
    enemy.nextReadyMs = state.timeMs + 100_000
    enemy.resistance = 100
    until(state, defs, (combat) => combat.log.some((event) => event.type === 'fieldTick'))
    const tick = state.log.find((event) => event.type === 'fieldTick')
    const recovery = state.log.find((event) => event.type === 'fieldHeal')
    const reduction = defenseReduction(100, 0, state.hero.level)
    const expectedDamage = Math.round(35 * (1 - reduction))
    const temperanceTimes = resources(state, VOW_TEMPERANCE).flatMap((event) =>
      event.type === 'resource' ? [event.timeMs] : [],
    )
    console.log('[cleric] consecration current defense', {
      defense: tick?.type === 'fieldTick' ? tick.defense : null,
      damage: tick?.type === 'fieldTick' ? tick.hpDamage : null,
      expectedDamage,
      heal: recovery?.type === 'fieldHeal' ? recovery.amount : null,
      temperanceTimes,
      tickTime: tick?.type === 'fieldTick' ? tick.timeMs : null,
    })
    expect(tick).toMatchObject({
      type: 'fieldTick',
      power: 100,
      defense: 100,
      coefficient: 0.35,
      hpDamage: expectedDamage,
      barrierBypassed: true,
      crit: false,
      varianceRoll: false,
    })
    expect(expectedDamage).toBeLessThan(35)
    expect(recovery).toMatchObject({
      type: 'fieldHeal',
      healingPower: 40,
      coefficient: 0.25,
      raw: 10,
      healingReceived: 1.5,
      afterReceived: 15,
      amount: 15,
    })
    expect(temperanceTimes).toEqual([cast.timeMs])
    expect(temperanceTimes).not.toContain(cast.timeMs + 2_000)
    expect(resources(state, VOW_ZEAL)).toHaveLength(0)
  })

  it('keeps the locked vow, ignores a string vow on every other class, and does not decay Faith', () => {
    const defs = defsFor([smite])
    const locked = createCombat(clericSetup({ equipped: [smite.id], rows: [{ skillId: smite.id }] }), defs, 1)
    locked.hero.suppliedVow = VOW_ENDURANCE
    until(locked, defs, (combat) => resources(combat, VOW_ZEAL).length >= 1)
    console.log('[cleric] vow locked', {
      vow: locked.hero.classState[VOW_STATE_KEY],
      supplied: locked.hero.suppliedVow,
      zeal: resources(locked, VOW_ZEAL).length,
      endurance: resources(locked, VOW_ENDURANCE).length,
    })
    expect(locked.hero.classState[VOW_STATE_KEY]).toBe(VOW_ZEAL)
    expect(resources(locked, VOW_ZEAL)).toHaveLength(1)
    expect(resources(locked, VOW_ENDURANCE)).toHaveLength(0)

    const assassin = createCombat(clericSetup({ classId: 'assassin', vow: 'nope' }), defsFor([]), 1)
    const ranger = createCombat(clericSetup({ classId: 'ranger', vow: VOW_TEMPERANCE }), defsFor([]), 1)
    console.log('[cleric] remaining classes ignore vow', {
      assassin: assassin.hero.classResourceId,
      ranger: ranger.hero.classResourceId,
      rangerFaith: ranger.hero.classResource,
    })
    expect(assassin.hero.classResourceId).toBe('advantage')
    expect(assassin.hero.classResource).toBe(0)
    expect(assassin.hero.suppliedVow).toBe('nope')
    expect(ranger.hero.classResourceId).toBe('readiness')
    expect(ranger.hero.classResource).toBe(100)
    expect(ranger.hero.suppliedVow).toBe(VOW_TEMPERANCE)
    expect(() => createCombat(clericSetup({ vow: '' }), defsFor([]), 1)).toThrow(/cleric vow is missing/)

    const held = createCombat(clericSetup({ vow: VOW_ZEAL }), defsFor([]), 1)
    held.hero.classResource = 30
    held.hero.nextReadyMs = 100_000
    const idle = held.enemies[0]
    if (idle === undefined) throw new Error('missing enemy')
    idle.nextReadyMs = 100_000
    until(held, defsFor([]), (combat) => combat.timeMs >= 5_000)
    console.log('[cleric] no decay', { faith: held.hero.classResource, timeMs: held.timeMs })
    expect(held.hero.classResource).toBe(30)
    expect(held.log.some((event) => event.type === 'resource' && event.generated < 0)).toBe(false)

    const fatal = createCombat(
      clericSetup({ vow: VOW_ENDURANCE, equipped: [penance.id], rows: [{ skillId: penance.id }] }),
      defsFor([penance]),
      1,
    )
    fatal.hero.hp = 1
    const doomed = fatal.hero.hp
    until(fatal, defsFor([penance]), (combat) => combat.log.some((event) => event.type === 'action' && event.actorId === combat.hero.id))
    expect(fatal.log.find((event) => event.type === 'priority' && event.decision === 'skip')).toMatchObject({
      reason: FATAL_HP_LOSS_REASON,
      skillId: penance.id,
    })
    expect(fatal.hero.hp).toBe(doomed)
    expect(fatal.hero.classResource).toBe(0)
    expect(fatal.hero.cooldowns[penance.id]).toBeUndefined()
  })

  it('rolls Mend with the centered heal and keeps the fixed hook list', () => {
    const defs = defsFor([mend])
    const state = createCombat(
      clericSetup({ equipped: [mend.id], rows: [{ skillId: mend.id }] }),
      defs,
      4,
    )
    state.hero.classResource = 25
    state.hero.hp = 100
    const rngBeforeHeal = { ...state.rng }
    until(state, defs, (combat) => combat.log.some((event) => event.type === 'heal'))
    const heal = state.log.find((event) => event.type === 'heal')
    const centered = centeredRoll({ ...rngBeforeHeal }, HEALING_ROLL_FLOOR, HEALING_ROLL_CEILING)
    const singleUniform = uniform({ ...rngBeforeHeal }, HEALING_ROLL_FLOOR, HEALING_ROLL_CEILING)
    console.log('[cleric] mend roll', { roll: heal?.type === 'heal' ? heal.roll : null, centered, singleUniform })
    expect(heal?.type).toBe('heal')
    if (heal?.type !== 'heal') return
    expect(heal.healingCoefficient).toBe(1.2)
    expect(heal.roll).toBe(centered)
    expect(heal.roll).not.toBe(singleUniform)
    expect(heal.rollFloor).toBe(HEALING_ROLL_FLOOR)
    expect(heal.rollCeiling).toBe(HEALING_ROLL_CEILING)

    const hooks = Object.keys(clericClass)
    expect(hooks.every((name) => (CLASS_HOOK_NAMES as readonly string[]).includes(name))).toBe(true)
    expect(CLASS_HOOK_NAMES).toEqual([
      'encounterStart',
      'encounterEnd',
      'actionChosen',
      'actionResolved',
      'damageDealt',
      'damageTaken',
      'kill',
      'outgoingModifiers',
      'incomingModifiers',
      'fallbackAction',
    ])
  })
})
