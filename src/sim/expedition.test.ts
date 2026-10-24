import { describe, expect, it } from 'vitest'

import { spiritResourceFactor } from './classes/resources.ts'
import { FURY_SCOPE, warriorClass } from './classes/warrior.ts'
import { REGEN_PER_VITALITY, STEP_MS, type HeroClass } from './constants.ts'
import {
  createExpedition,
  LOOT_CAPACITY,
  MOMENTUM_CAP,
  MOMENTUM_RESET_REASONS,
  RARE_NODE_CHANCE_PER_STACK,
  resetMomentum,
  returnToTown,
  runExpedition,
  SPLINTERED_ROAD_ID,
  stepExpedition,
  SUPPLY_SLOT_COUNT,
  TRAVEL_GAP_MS,
  type ExpeditionBlueprint,
  type ExpeditionEncounterDef,
  type ExpeditionState,
} from './expedition.ts'
import { formatEvent } from './log.ts'
import { createRng, deriveSeed, nextFloat, type RngState } from './rng.ts'
import {
  deriveHeroStats,
  type AccessoryPiece,
  type ArmorPiece,
  type OffHandPiece,
  type WeaponPiece,
} from './stats.ts'
import { emptyStatuses } from './statuses.ts'
import type { CombatHeroSetup, EnemyDef, GameDefs } from './types.ts'

type HasKey<T, K extends string> = K extends keyof T ? true : false
const weaponHasDurability: HasKey<WeaponPiece, 'durability'> = false
const offHandHasDurability: HasKey<OffHandPiece, 'durability'> = false
const armorHasDurability: HasKey<ArmorPiece, 'durability'> = false
const accessoryHasDurability: HasKey<AccessoryPiece, 'durability'> = false

const DRAW_ORDER = ['shardling-pair', 'wolf-pair', 'deserter', 'road-mixed'] as const

function encounter(id: string, level: number): ExpeditionEncounterDef {
  return { id, enemies: [{ defId: 'dummy', slot: 0, level }] }
}

function gearFor(classId: HeroClass): CombatHeroSetup['gear'] {
  const weapon =
    classId === 'assassin' ? 'dagger' : classId === 'ranger' ? 'bow' : classId === 'warrior' ? 'oneHanded' : 'caster'
  const armor: 'heavy' | 'medium' | 'light' | 'cloth' =
    classId === 'warrior' ? 'heavy' : classId === 'assassin' ? 'light' : classId === 'mage' ? 'cloth' : 'medium'
  const offHand =
    classId === 'assassin'
      ? { id: 'off-dagger', kind: 'dagger' as const, itemLevel: 5, quality: 1 }
      : classId === 'ranger'
        ? { id: 'quiver', kind: 'quiver' as const, itemLevel: 5, quality: 1 }
        : classId === 'mage'
          ? { id: 'focus', kind: 'focus' as const, itemLevel: 5, quality: 1 }
          : { id: 'shield', kind: 'shield' as const, itemLevel: 5, quality: 1 }
  const piece = (slot: 'head' | 'chest' | 'hands' | 'feet') => ({
    id: `${armor}-${slot}`,
    slot,
    category: armor,
    itemLevel: 5,
    quality: 1,
  })
  return {
    mainHand: { id: `weapon-${weapon}`, kind: weapon, itemLevel: 5, quality: 1 },
    offHand,
    head: piece('head'),
    chest: piece('chest'),
    hands: piece('hands'),
    feet: piece('feet'),
    accessories: [
      { id: 'accessory-a', itemLevel: 5, quality: 1 },
      { id: 'accessory-b', itemLevel: 5, quality: 1 },
    ],
  }
}

function fixtureBlueprint(classId: HeroClass = 'warrior'): ExpeditionBlueprint {
  const opening = [encounter('shardling-pair', 3), encounter('wolf-pair', 6), encounter('deserter', 6)]
  return {
    id: SPLINTERED_ROAD_ID,
    opening,
    draw: [...opening, encounter('road-mixed', 5)],
    travelGapMs: TRAVEL_GAP_MS,
    retreatThresholds: [],
    hero: {
      id: `hero-${classId}`,
      name: classId,
      level: 5,
      classId,
      attributes: { strength: 10, vitality: 14, agility: 10, intellect: 10, spirit: 10 },
      gear: gearFor(classId),
      equippedSkillIds: [],
      ...(classId === 'ranger' ? { specialAmmo: 6 } : {}),
      ...(classId === 'cleric' ? { vow: 'zeal' } : {}),
    },
  }
}

function fixtureDefs(): GameDefs {
  const dummy: EnemyDef = {
    id: 'dummy',
    name: 'Dummy',
    level: 1,
    levelMin: 1,
    levelMax: 20,
    archetype: 'standard',
    school: 'physical',
    filler: { school: 'physical' },
  }
  return { enemies: { dummy }, skills: {}, statuses: {} }
}

function start(classId: HeroClass = 'warrior', seed = 1): ExpeditionState {
  return createExpedition(fixtureBlueprint(classId), seed)
}

function stepFor(state: ExpeditionState, defs: GameDefs, ms: number): void {
  if (ms % STEP_MS !== 0) throw new Error(`ms must be a multiple of ${STEP_MS}`)
  const steps = ms / STEP_MS
  for (let index = 0; index < steps; index += 1) stepExpedition(state, defs)
}

function stepUntilCombat(state: ExpeditionState, defs: GameDefs): void {
  let steps = 0
  while (state.phase !== 'combat') {
    stepExpedition(state, defs)
    steps += 1
    if (steps > 10_000) throw new Error('travel did not reach a fight')
  }
  if (state.combat === null || state.current === null) throw new Error('expedition entered combat without a fight')
}

function skipCombat(state: ExpeditionState, defs: GameDefs): void {
  if (state.combat === null) throw new Error('no combat to skip')
  state.combat.outcome = 'victory'
  stepExpedition(state, defs)
}

function cloneExpedition(state: ExpeditionState): ExpeditionState {
  return JSON.parse(JSON.stringify(state)) as ExpeditionState
}

function setMomentum(state: ExpeditionState, stacks: number): void {
  state.momentum = stacks
  state.rareNodeChance = stacks * RARE_NODE_CHANCE_PER_STACK
}

function droppedBlueprint(opening: readonly ExpeditionEncounterDef[]): ExpeditionBlueprint {
  const blueprint = fixtureBlueprint()
  const first = opening[0]
  if (first === undefined) throw new Error('dropped blueprint needs an encounter')
  return { ...blueprint, opening: [...opening], draw: [first], travelGapMs: STEP_MS }
}

function droppedEnemy(slot: number, materialId: string, level = 3): ExpeditionEncounterDef['enemies'][number] {
  return { defId: 'dummy', slot, level, materialId, baseQuantity: 4 }
}

function win(state: ExpeditionState, defs: GameDefs): void {
  stepUntilCombat(state, defs)
  if (state.combat === null) throw new Error('fight is missing')
  state.combat.outcome = 'victory'
  stepExpedition(state, defs)
}

function eliteDefs(): GameDefs {
  const defs = fixtureDefs()
  const dummy = defs.enemies.dummy
  if (dummy === undefined) throw new Error('dummy is missing')
  defs.enemies.dummy = { ...dummy, elite: true }
  return defs
}

function bossDummyDefs(): GameDefs {
  const defs = fixtureDefs()
  const dummy = defs.enemies.dummy
  if (dummy === undefined) throw new Error('dummy is missing')
  defs.enemies.dummy = { ...dummy, boss: true }
  return defs
}

/** Empty retreat thresholds, then mark the fight defeated so escape cannot roll. */
function enterDefeatFight(
  defs: GameDefs,
  seed: number,
  blueprint: Partial<ExpeditionBlueprint> = {},
): ExpeditionState {
  const state = createExpedition(
    {
      ...fixtureBlueprint(),
      travelGapMs: STEP_MS,
      retreatThresholds: [],
      ...blueprint,
    },
    seed,
  )
  stepExpedition(state, defs)
  if (state.combat === null || state.phase !== 'combat') throw new Error('defeat fight is missing')
  if (state.retreatThresholds.length !== 0) throw new Error('this defeat can still escape')
  return state
}

function forceDefeat(state: ExpeditionState, defs: GameDefs): void {
  if (state.retreatThresholds.length !== 0) throw new Error('this defeat can still escape')
  if (state.combat === null) throw new Error('defeat fight is missing')
  state.combat.outcome = 'defeat'
  stepExpedition(state, defs)
}

describe('splintered road expedition', () => {
  const defs = fixtureDefs()

  it('regenerates HP at 0.05 × VIT, rounded half-up once per second, and caps at maximum HP', () => {
    expect(REGEN_PER_VITALITY).toBe(0.05)
    expect(TRAVEL_GAP_MS).toBe(20_000)
    const cases = [
      { vitality: 0, seconds: 1, each: 0 },
      { vitality: 9, seconds: 3, each: 0 },
      { vitality: 10, seconds: 1, each: 1 },
      { vitality: 14, seconds: 1, each: 1 },
      { vitality: 30, seconds: 1, each: 2 },
    ]
    for (const entry of cases) {
      const state = start()
      state.hero.vitality = entry.vitality
      state.hero.maxHp = 100
      state.hero.hp = 50
      stepFor(state, defs, entry.seconds * 1000)
      console.log('[expedition] hp regen', { ...entry, hp: state.hero.hp })
      expect(state.phase).toBe('travel')
      expect(state.hero.hp).toBe(50 + entry.each * entry.seconds)
    }

    const capped = start()
    capped.hero.vitality = 30
    capped.hero.maxHp = 100
    capped.hero.hp = 99
    stepFor(capped, defs, 1000)
    console.log('[expedition] hp cap', { hp: capped.hero.hp, maxHp: capped.hero.maxHp })
    expect(capped.hero.hp).toBe(100)

    const hero = start()
    const gain = Math.floor((hero.hero.vitality + 10) / 20)
    const before = hero.hero.maxHp - 30
    hero.hero.hp = before
    stepFor(hero, defs, 990)
    expect(hero.hero.hp).toBe(before)
    stepFor(hero, defs, 10)
    console.log('[expedition] hp one second', { vitality: hero.hero.vitality, gain, hp: hero.hero.hp })
    expect(gain).toBe(1)
    expect(hero.hero.hp).toBe(before + gain)
  })

  it('regenerates Mana at 5 per second times Spirit and caps at the meter maximum', () => {
    const state = start('mage')
    const factor = spiritResourceFactor(state.hero.spirit)
    state.hero.classResource = 0
    stepFor(state, defs, 990)
    expect(state.hero.classResource).toBe(0)
    stepFor(state, defs, 10)
    console.log('[expedition] mana regen', { spirit: state.hero.spirit, factor, mana: state.hero.classResource })
    expect(state.hero.classResource).toBeCloseTo(5 * factor, 8)
    expect(state.phase).toBe('travel')

    state.hero.classResource = state.hero.classResourceMax - 1
    stepFor(state, defs, 1000)
    console.log('[expedition] mana cap', { mana: state.hero.classResource, max: state.hero.classResourceMax })
    expect(state.hero.classResource).toBe(state.hero.classResourceMax)
  })

  it('regenerates Readiness from empty at 5 per second times Spirit and keeps 6 arrows', () => {
    const state = start('ranger')
    const factor = spiritResourceFactor(state.hero.spirit)
    console.log('[expedition] readiness start', {
      readiness: state.hero.classResource,
      ammo: state.hero.specialAmmo,
      spirit: state.hero.spirit,
    })
    expect(state.hero.classResource).toBe(0)
    expect(state.hero.specialAmmo).toBe(6)
    stepFor(state, defs, 990)
    expect(state.hero.classResource).toBe(0)
    stepFor(state, defs, 10)
    expect(state.hero.classResource).toBeCloseTo(5 * factor, 8)
    stepUntilCombat(state, defs)
    console.log('[expedition] readiness after 20s', {
      carried: state.hero.classResource,
      combat: state.combat?.hero.classResource,
      ammo: state.combat?.hero.specialAmmo,
    })
    expect(state.travelMs).toBe(TRAVEL_GAP_MS)
    expect(state.hero.classResource).toBe(100)
    expect(state.combat?.hero.classResource).toBe(100)
    expect(state.combat?.hero.specialAmmo).toBe(6)
  })

  it('leaves Faith unchanged across a 20-second gap and carries the vow', () => {
    const state = start('cleric')
    expect(state.hero.classResource).toBe(0)
    expect(state.hero.vow).toBe('zeal')
    state.hero.classResource = 37.5
    stepUntilCombat(state, defs)
    console.log('[expedition] faith after travel', {
      faith: state.hero.classResource,
      combat: state.combat?.hero.classResource,
      vow: state.combat?.hero.classState.vow,
    })
    expect(state.hero.classResource).toBe(37.5)
    expect(state.combat?.hero.classResource).toBe(37.5)
    expect(state.combat?.hero.classResourceScope).toBe('expedition')
    expect(state.combat?.hero.classState.vow).toBe('zeal')
    if (state.combat === null) throw new Error('cleric fight is missing')
    state.combat.hero.suppliedVow = 'endurance'
    state.combat.outcome = 'victory'
    stepExpedition(state, defs)
    expect(state.hero.vow).toBe('endurance')
    expect(state.hero.classResource).toBe(37.5)
    state.travelGapMs = STEP_MS
    stepExpedition(state, defs)
    expect(state.combat?.hero.classState.vow).toBe('endurance')
    expect(state.combat?.hero.classResource).toBe(37.5)
  })

  it('starts every encounter at 0 Advantage and 0 fraction', () => {
    const state = start('assassin')
    state.travelGapMs = 1000
    state.hero.classResource = 4
    state.hero.resourceFraction = 0.25
    stepFor(state, defs, 990)
    console.log('[expedition] advantage during travel', {
      stacks: state.hero.classResource,
      fraction: state.hero.resourceFraction,
      phase: state.phase,
    })
    expect(state.phase).toBe('travel')
    expect(state.hero.classResource).toBe(4)
    expect(state.hero.resourceFraction).toBe(0.25)
    stepFor(state, defs, 10)
    console.log('[expedition] advantage at encounter start', {
      stacks: state.combat?.hero.classResource,
      fraction: state.combat?.hero.resourceFraction,
    })
    expect(state.phase).toBe('combat')
    expect(state.combat?.hero.classResource).toBe(0)
    expect(state.combat?.hero.resourceFraction).toBe(0)
    expect(state.combat?.hero.classResourceId).toBe('advantage')
    expect(state.combat?.hero.classResourceScope).toBe('encounter')
  })

  it('waits 3 seconds, then drains Fury at 10 per second, and an expedition fight keeps what remains', () => {
    expect(FURY_SCOPE).toBe('encounter')
    const gaps = [
      { gapMs: 3_000, expected: 100 },
      { gapMs: 5_000, expected: 80 },
      { gapMs: 20_000, expected: 0 },
    ]
    for (const entry of gaps) {
      const state = start()
      state.travelGapMs = entry.gapMs
      state.hero.classResource = 100
      stepUntilCombat(state, defs)
      console.log('[expedition] fury gap', {
        gapMs: entry.gapMs,
        fury: state.combat?.hero.classResource,
        scope: state.combat?.hero.classResourceScope,
      })
      expect(state.combat?.hero.classResource).toBe(entry.expected)
      expect(state.combat?.hero.classResourceScope).toBe('encounter')
    }

    const kept = start()
    kept.travelGapMs = 5_000
    kept.hero.classResource = 100
    stepUntilCombat(kept, defs)
    const combat = kept.combat
    if (combat === null) throw new Error('fury fight is missing')
    const end = warriorClass.encounterEnd
    if (end === undefined) throw new Error('warrior encounterEnd is missing')
    end(combat, combat.timeMs)
    const cleared = combat.log.some((event) => event.type === 'resource' && event.reason === 'encounterEnd')
    console.log('[expedition] fury kept at encounter end', { fury: combat.hero.classResource, cleared })
    expect(combat.hero.classResource).toBe(80)
    expect(cleared).toBe(false)
  })

  it('uses the fixed opening, then one seeded equal draw, and does not roll the fixed fights', () => {
    const seed = 5
    const state = start('warrior', seed)
    expect(state.opening.map((entry) => entry.id)).toEqual(['shardling-pair', 'wolf-pair', 'deserter'])
    expect(state.draw.map((entry) => entry.id)).toEqual([...DRAW_ORDER])
    const seen: string[] = []
    for (let index = 0; index < 3; index += 1) {
      stepUntilCombat(state, defs)
      const current = state.current
      if (current === null || state.combat === null) throw new Error('opening fight is missing')
      seen.push(current.encounterId)
      expect(current.seed).toBe(deriveSeed(seed, index))
      expect(state.rng).toEqual(createRng(seed))
      expect(state.combat.enemies.map((enemy) => enemy.level)).toEqual([state.opening[index]?.enemies[0]?.level])
      skipCombat(state, defs)
    }
    expect(seen).toEqual(['shardling-pair', 'wolf-pair', 'deserter'])
    expect(state.rng).toEqual(createRng(seed))

    const probe = createRng(seed)
    const value = nextFloat(probe)
    const index = Math.floor(value * 4)
    const expectedId = DRAW_ORDER[index]
    stepUntilCombat(state, defs)
    console.log('[expedition] equal draw', { seed, value, index, encounterId: state.current?.encounterId })
    expect(expectedId).toBe('wolf-pair')
    expect(state.current?.encounterId).toBe(expectedId)
    expect(state.current?.seed).toBe(deriveSeed(seed, 3))
    expect(state.rng).toEqual(probe)
  })

  it('carries HP and Fury into the next fight, and starts cooldowns, statuses, and barriers fresh', () => {
    const warrior = start()
    warrior.travelGapMs = STEP_MS
    stepUntilCombat(warrior, defs)
    const first = warrior.combat
    if (first === null) throw new Error('first fight is missing')
    const wounded = first.hero.maxHp - 7
    first.hero.hp = wounded
    first.hero.classResource = 33
    first.hero.cooldowns['driving-blow'] = 4_000
    first.hero.barrier = 12
    first.hero.statuses.expose = {
      name: 'Expose',
      expiresMs: 8_000,
      armorMagnitude: 0.2,
      resistanceMagnitude: 0.2,
    }
    const end = warriorClass.encounterEnd
    if (end === undefined) throw new Error('warrior encounterEnd is missing')
    end(first, first.timeMs)
    expect(first.hero.classResource).toBe(33)
    first.outcome = 'victory'
    stepExpedition(warrior, defs)
    expect(warrior.phase).toBe('travel')
    expect(warrior.hero.hp).toBe(wounded)
    expect(warrior.hero.classResource).toBe(33)
    stepExpedition(warrior, defs)
    const second = warrior.combat
    console.log('[expedition] carry', {
      hp: second?.hero.hp,
      fury: second?.hero.classResource,
      cooldowns: second?.hero.cooldowns,
      barrier: second?.hero.barrier,
    })
    expect(second?.hero.hp).toBe(wounded)
    expect(second?.hero.classResource).toBe(33)
    expect(second?.hero.cooldowns).toEqual({})
    expect(second?.hero.barrier).toBe(0)
    expect(second?.hero.statuses).toEqual(emptyStatuses())

    const ranger = start('ranger')
    ranger.travelGapMs = STEP_MS
    stepUntilCombat(ranger, defs)
    if (ranger.combat === null) throw new Error('ranger fight is missing')
    ranger.combat.hero.specialAmmo = 2
    ranger.combat.hero.classResource = 15
    ranger.combat.outcome = 'victory'
    stepExpedition(ranger, defs)
    stepExpedition(ranger, defs)
    console.log('[expedition] ammo carry', {
      ammo: ranger.combat?.hero.specialAmmo,
      readiness: ranger.combat?.hero.classResource,
    })
    expect(ranger.combat?.hero.specialAmmo).toBe(2)
    expect(ranger.combat?.hero.classResource).toBe(15)
  })

  it('uses the supplied hero template for the next fight', () => {
    const state = start()
    state.travelGapMs = STEP_MS
    stepUntilCombat(state, defs)
    console.log('[expedition] template', {
      id: state.combat?.hero.id,
      level: state.combat?.hero.level,
      encounterId: state.current?.encounterId,
    })
    expect(state.classId).toBe('warrior')
    expect(state.combat?.hero.id).toBe('hero-warrior')
    expect(state.combat?.hero.level).toBe(5)
    expect(state.combat?.hero.equippedSkillIds).toEqual([])
    expect(state.current?.seed).toBe(deriveSeed(1, 0))
    expect(state.current?.encounterId).toBe('shardling-pair')
  })

  it('matches an uninterrupted run after serializing mid-travel and mid-combat', () => {
    const travelLive = start('warrior', 2)
    const travelPaused = start('warrior', 2)
    stepFor(travelLive, defs, 2_500)
    stepFor(travelPaused, defs, 2_500)
    const travelResumed = cloneExpedition(travelPaused)
    stepFor(travelLive, defs, 2_500)
    stepFor(travelResumed, defs, 2_500)
    console.log('[expedition] resume travel', {
      travelMs: travelResumed.travelMs,
      hp: travelResumed.hero.hp,
      phase: travelResumed.phase,
    })
    expect(travelResumed.phase).toBe('travel')
    expect(JSON.stringify(travelResumed)).toBe(JSON.stringify(travelLive))

    const combatLive = start('warrior', 2)
    const combatPaused = start('warrior', 2)
    stepUntilCombat(combatLive, defs)
    stepUntilCombat(combatPaused, defs)
    stepFor(combatLive, defs, 400)
    stepFor(combatPaused, defs, 400)
    const combatResumed = cloneExpedition(combatPaused)
    stepFor(combatLive, defs, 400)
    stepFor(combatResumed, defs, 400)
    console.log('[expedition] resume combat', {
      timeMs: combatResumed.combat?.timeMs,
      outcome: combatResumed.combat?.outcome,
      hp: combatResumed.combat?.hero.hp,
    })
    expect(combatResumed.phase).toBe('combat')
    expect(JSON.stringify(combatResumed)).toBe(JSON.stringify(combatLive))
  })

  it('rejects an unknown expedition, a bad seed, and a bad class', () => {
    const blueprint = fixtureBlueprint()
    expect(() => createExpedition({ ...blueprint, id: 'nope' }, 1)).toThrow(/unknown expedition/)
    expect(() => createExpedition(blueprint, 1.5)).toThrow(/seed/)
    expect(() =>
      createExpedition({ ...blueprint, hero: { ...blueprint.hero, classId: 'nope' as 'warrior' } }, 1),
    ).toThrow(/unknown hero class/)
  })

  it('adds 1 momentum after a regular victory and clears it when the next fight is lost', () => {
    const state = createExpedition(
      droppedBlueprint([
        { id: 'shardling-pair', enemies: [droppedEnemy(0, 'shard')] },
        { id: 'wolf-pair', enemies: [droppedEnemy(0, 'hide')] },
      ]),
      1,
    )
    expect(state.supplySlots).toEqual([null, null, null, null])
    expect(state.supplySlots).toHaveLength(SUPPLY_SLOT_COUNT)
    expect(state.momentum).toBe(0)
    expect(state.rareNodeChance).toBe(0)
    const rng = { ...state.rng }
    win(state, defs)
    console.log('[expedition] regular gain', {
      momentum: state.momentum,
      rareNodeChance: state.rareNodeChance,
      unsecured: state.unsecured,
      supplySlots: state.supplySlots,
    })
    expect(state.momentum).toBe(1)
    expect(state.rareNodeChance).toBe(RARE_NODE_CHANCE_PER_STACK)
    expect(state.unsecured).toEqual([{ materialId: 'shard', quantity: 4 }])
    expect(state.secured).toEqual([])
    expect(state.overflow).toBe(0)
    expect(state.rng).toEqual(rng)
    expect(state.supplySlots).toEqual([null, null, null, null])

    stepUntilCombat(state, defs)
    const combat = state.combat
    if (combat === null) throw new Error('defeat fight is missing')
    const xp = combat.enemies.map((enemy) => enemy.xp)
    combat.outcome = 'defeat'
    stepExpedition(state, defs)
    console.log('[expedition] defeat clears momentum and unsecured loot', {
      momentum: state.momentum,
      unsecured: state.unsecured,
      xp: state.combat?.enemies.map((enemy) => enemy.xp),
    })
    expect(state.outcome).toBe('defeat')
    expect(state.momentum).toBe(0)
    expect(state.rareNodeChance).toBe(0)
    expect(state.unsecured).toEqual([])
    expect(state.overflow).toBe(0)
    expect(state.combat?.enemies.map((enemy) => enemy.xp)).toEqual(xp)
  })

  it('adds 2 momentum after an elite victory and stops at 5', () => {
    const elite = eliteDefs()
    const state = start()
    state.travelGapMs = STEP_MS
    win(state, elite)
    console.log('[expedition] elite gain', { momentum: state.momentum, rareNodeChance: state.rareNodeChance })
    expect(state.momentum).toBe(2)
    expect(state.rareNodeChance).toBe(4)
    setMomentum(state, 4)
    win(state, elite)
    console.log('[expedition] elite cap', { momentum: state.momentum, rareNodeChance: state.rareNodeChance })
    expect(state.momentum).toBe(MOMENTUM_CAP)
    expect(state.rareNodeChance).toBe(MOMENTUM_CAP * RARE_NODE_CHANCE_PER_STACK)
    win(state, elite)
    expect(state.momentum).toBe(MOMENTUM_CAP)
    expect(state.rareNodeChance).toBe(10)
  })

  it('caps regular momentum at 5', () => {
    const state = start()
    state.travelGapMs = STEP_MS
    const gained: number[] = []
    for (let index = 0; index < 6; index += 1) {
      win(state, defs)
      gained.push(state.momentum)
    }
    console.log('[expedition] regular cap', { gained, rareNodeChance: state.rareNodeChance })
    expect(gained).toEqual([1, 2, 3, 4, 5, 5])
    expect(state.momentum).toBe(5)
    expect(state.rareNodeChance).toBe(10)
    expect(state.unsecured).toEqual([])
  })

  it('rounds a base of 4 half-up, so 3 stacks become 5 and fewer stacks stay 4', () => {
    for (const stacks of [0, 1, 2, 3]) {
      const state = createExpedition(
        droppedBlueprint([{ id: 'one', enemies: [droppedEnemy(0, 'shard')] }]),
        1,
      )
      setMomentum(state, stacks)
      win(state, defs)
      const quantity = stacks === 3 ? 5 : 4
      console.log('[expedition] half-up', {
        stacks,
        quantity: state.unsecured[0]?.quantity,
        momentum: state.momentum,
      })
      expect(state.unsecured).toEqual([{ materialId: 'shard', quantity }])
      expect(state.momentum).toBe(stacks + 1)
      expect(state.rareNodeChance).toBe((stacks + 1) * RARE_NODE_CHANCE_PER_STACK)
      expect(state.overflow).toBe(0)
    }
  })

  it('keeps older materials when the newest quantity does not fit', () => {
    const ordered = createExpedition(
      droppedBlueprint([
        {
          id: 'mixed',
          enemies: [
            { defId: 'dummy', slot: 1, level: 3, materialId: 'scrap', baseQuantity: 4 },
            { defId: 'dummy', slot: 0, level: 3, materialId: 'hide', baseQuantity: 4 },
          ],
        },
      ]),
      1,
    )
    ordered.unsecured = [{ materialId: 'shard', quantity: 16 }]
    win(ordered, defs)
    console.log('[expedition] slot order overflow', {
      unsecured: ordered.unsecured,
      overflow: ordered.overflow,
    })
    expect(ordered.unsecured).toEqual([
      { materialId: 'shard', quantity: 16 },
      { materialId: 'hide', quantity: 4 },
    ])
    expect(ordered.overflow).toBe(4)
    expect(ordered.secured).toEqual([])

    const partial = createExpedition(
      droppedBlueprint([{ id: 'one', enemies: [droppedEnemy(0, 'hide')] }]),
      1,
    )
    partial.unsecured = [{ materialId: 'shard', quantity: 18 }]
    win(partial, defs)
    console.log('[expedition] partial overflow', { unsecured: partial.unsecured, overflow: partial.overflow })
    expect(partial.unsecured).toEqual([
      { materialId: 'shard', quantity: 18 },
      { materialId: 'hide', quantity: 2 },
    ])
    expect(partial.overflow).toBe(2)

    const intro = createExpedition(
      droppedBlueprint([
        { id: 'shardling-pair', enemies: [droppedEnemy(0, 'shard'), droppedEnemy(1, 'shard')] },
        { id: 'wolf-pair', enemies: [droppedEnemy(0, 'hide'), droppedEnemy(1, 'hide')] },
        { id: 'deserter', enemies: [droppedEnemy(0, 'scrap')] },
        { id: 'wolf-pair', enemies: [droppedEnemy(0, 'hide'), droppedEnemy(1, 'hide')] },
      ]),
      5,
    )
    for (let index = 0; index < 4; index += 1) win(intro, defs)
    console.log('[expedition] intro bag', {
      momentum: intro.momentum,
      unsecured: intro.unsecured,
      overflow: intro.overflow,
      capacity: LOOT_CAPACITY,
    })
    expect(intro.momentum).toBe(4)
    expect(intro.rareNodeChance).toBe(8)
    expect(intro.unsecured).toEqual([
      { materialId: 'shard', quantity: 8 },
      { materialId: 'hide', quantity: 8 },
      { materialId: 'scrap', quantity: 4 },
    ])
    expect(lootTotal(intro.unsecured)).toBe(LOOT_CAPACITY)
    expect(intro.overflow).toBe(10)
    expect(intro.secured).toEqual([])
  })

  it('resets momentum for return, retreat, defeat, and reincarnation without securing loot', () => {
    for (const reason of MOMENTUM_RESET_REASONS) {
      const state = start()
      setMomentum(state, 3)
      state.unsecured = [{ materialId: 'shard', quantity: 8 }]
      state.secured = [{ materialId: 'hide', quantity: 2 }]
      state.overflow = 1
      resetMomentum(state, reason)
      console.log('[expedition] reset', {
        reason,
        momentum: state.momentum,
        rareNodeChance: state.rareNodeChance,
        unsecured: state.unsecured,
        secured: state.secured,
        overflow: state.overflow,
      })
      expect(state.momentum).toBe(0)
      expect(state.rareNodeChance).toBe(0)
      expect(state.unsecured).toEqual([{ materialId: 'shard', quantity: 8 }])
      expect(state.secured).toEqual([{ materialId: 'hide', quantity: 2 }])
      expect(state.overflow).toBe(1)
    }
    expect(() => resetMomentum(start(), 'nope' as 'return')).toThrow(/reason/)
  })

  it('keeps loot unsecured until the return walk arrives', () => {
    const fighting = start()
    stepUntilCombat(fighting, defs)
    expect(() => returnToTown(fighting)).toThrow(/between fights/)
    expect(fighting.phase).toBe('combat')
    expect(fighting.combat).not.toBeNull()

    const mid = start()
    mid.travelGapMs = 10_000
    stepFor(mid, defs, 4_000)
    returnToTown(mid)
    expect(mid.travelMs).toBe(0)
    expect(mid.returning).toBe(true)
    stepFor(mid, defs, 4_000)
    expect(mid.outcome).toBe('ongoing')
    expect(mid.phase).toBe('travel')
    expect(mid.returning).toBe(true)
    expect(mid.travelMs).toBe(4_000)

    const state = createExpedition(
      droppedBlueprint([{ id: 'shardling-pair', enemies: [droppedEnemy(0, 'shard')] }]),
      1,
    )
    win(state, defs)
    expect(state.momentum).toBe(1)
    expect(state.unsecured).toEqual([{ materialId: 'shard', quantity: 4 }])
    state.hero.hp = 50
    state.hero.maxHp = 100
    returnToTown(state)
    stepFor(state, defs, 1_000)
    const regen = Math.floor((state.hero.vitality + 10) / 20)
    console.log('[expedition] return before arrival', {
      hp: state.hero.hp,
      regen,
      momentum: state.momentum,
      unsecured: state.unsecured,
      secured: state.secured,
      travelMs: state.travelMs,
    })
    expect(regen).toBe(1)
    expect(state.hero.hp).toBe(51)
    expect(state.unsecured).toEqual([{ materialId: 'shard', quantity: 4 }])
    expect(state.secured).toEqual([])
    expect(state.momentum).toBe(1)
    expect(state.rareNodeChance).toBe(2)
    expect(state.outcome).toBe('ongoing')
    expect(state.returning).toBe(true)
    stepFor(state, defs, TRAVEL_GAP_MS - 1_000)
    console.log('[expedition] return arrival', {
      outcome: state.outcome,
      momentum: state.momentum,
      rareNodeChance: state.rareNodeChance,
      unsecured: state.unsecured,
      secured: state.secured,
    })
    expect(state.outcome).toBe('returned')
    expect(state.returning).toBe(false)
    expect(state.travelMs).toBe(TRAVEL_GAP_MS)
    expect(state.unsecured).toEqual([])
    expect(state.secured).toEqual([{ materialId: 'shard', quantity: 4 }])
    expect(state.momentum).toBe(0)
    expect(state.rareNodeChance).toBe(0)
    expect(state.supplySlots).toEqual([null, null, null, null])
    expect(() => returnToTown(state)).toThrow(/ongoing/)
  })

  it('secures loot at the same moment after a JSON resume mid-return', () => {
    function beginReturn(): ExpeditionState {
      const state = createExpedition(
        droppedBlueprint([
          { id: 'shardling-pair', enemies: [droppedEnemy(0, 'shard'), droppedEnemy(1, 'hide')] },
        ]),
        2,
      )
      win(state, defs)
      returnToTown(state)
      return state
    }
    const live = beginReturn()
    const paused = beginReturn()
    stepFor(live, defs, 10_000)
    stepFor(paused, defs, 10_000)
    const resumed = cloneExpedition(paused)
    stepFor(live, defs, 9_990)
    stepFor(resumed, defs, 9_990)
    console.log('[expedition] resume before arrival', {
      travelMs: resumed.travelMs,
      unsecured: resumed.unsecured,
      momentum: resumed.momentum,
      returning: resumed.returning,
    })
    expect(resumed.travelMs).toBe(19_990)
    expect(resumed.unsecured).toEqual([
      { materialId: 'shard', quantity: 4 },
      { materialId: 'hide', quantity: 4 },
    ])
    expect(resumed.secured).toEqual([])
    expect(resumed.momentum).toBe(1)
    expect(JSON.stringify(resumed)).toBe(JSON.stringify(live))
    stepFor(live, defs, STEP_MS)
    stepFor(resumed, defs, STEP_MS)
    console.log('[expedition] resume on arrival', {
      outcome: resumed.outcome,
      secured: resumed.secured,
      momentum: resumed.momentum,
      rareNodeChance: resumed.rareNodeChance,
    })
    expect(resumed.outcome).toBe('returned')
    expect(resumed.secured).toEqual([
      { materialId: 'shard', quantity: 4 },
      { materialId: 'hide', quantity: 4 },
    ])
    expect(resumed.unsecured).toEqual([])
    expect(resumed.momentum).toBe(0)
    expect(resumed.rareNodeChance).toBe(0)
    expect(JSON.stringify(resumed)).toBe(JSON.stringify(live))
  })

  it('rolls escape on a met threshold and never rolls for an empty list', () => {
    expect(() =>
      createExpedition(
        { ...fixtureBlueprint(), retreatThresholds: [{ kind: 'hpFraction', atMost: 0 }] },
        1,
      ),
    ).toThrow(/atMost/)
    expect(() =>
      createExpedition(
        { ...fixtureBlueprint(), retreatThresholds: [{ kind: 'hpFraction', atMost: -0.2 }] },
        1,
      ),
    ).toThrow(/atMost/)
    expect(() =>
      createExpedition(
        { ...fixtureBlueprint(), retreatThresholds: [{ kind: 'hpFraction', atMost: 1.01 }] },
        1,
      ),
    ).toThrow(/atMost/)
    expect(() =>
      createExpedition(
        { ...fixtureBlueprint(), retreatThresholds: [{ kind: 'missing' as 'hpFraction', atMost: 0.4 }] },
        1,
      ),
    ).toThrow(/kind/)

    const full = createExpedition(
      { ...fixtureBlueprint(), retreatThresholds: [{ kind: 'hpFraction', atMost: 1 }], travelGapMs: STEP_MS },
      3,
    )
    stepExpedition(full, defs)
    const fullCombat = full.combat
    if (fullCombat === null) throw new Error('full-HP fight is missing')
    expect(fullCombat.hero.hp).toBe(fullCombat.hero.maxHp)
    expect(full.escapeLog).toEqual([])
    stepExpedition(full, defs)
    const fullAttempt = full.escapeLog[0]
    if (fullAttempt === undefined) throw new Error('full-HP escape was not logged')
    console.log('[sim]', 'escape roll', {
      roll: fullAttempt.roll,
      chance: fullAttempt.chancePercent,
      result: fullAttempt.success,
      hp: fullAttempt.hp,
      maxHp: fullAttempt.maxHp,
    })
    expect(fullAttempt.timeMs).toBe(STEP_MS)
    expect(fullAttempt.hp).toBe(fullAttempt.maxHp)
    expect(fullAttempt.thresholdPercent).toBe(100)
    expect(fullAttempt.basePercent).toBe(50)
    expect(fullAttempt.suppliesBonus).toBe(0)
    expect(fullAttempt.zoneBonus).toBe(0)
    expect(fullAttempt.momentumBonus).toBe(0)
    expect(fullAttempt.chancePercent).toBe(50 + Math.min(20, Math.floor(fullAttempt.agility / 5)))

    const boundary = createExpedition(
      { ...fixtureBlueprint(), retreatThresholds: [{ kind: 'hpFraction', atMost: 0.4 }], travelGapMs: STEP_MS },
      4,
    )
    stepExpedition(boundary, defs)
    const boundaryCombat = boundary.combat
    if (boundaryCombat === null) throw new Error('boundary fight is missing')
    boundaryCombat.hero.nextReadyMs = 1_000_000
    const boundaryEnemy = boundaryCombat.enemies[0]
    if (boundaryEnemy === undefined) throw new Error('boundary enemy is missing')
    boundaryEnemy.nextReadyMs = 1_000_000
    boundaryCombat.hero.maxHp = 215
    boundaryCombat.hero.hp = 87
    const boundaryRng = { ...boundary.rng }
    stepExpedition(boundary, defs)
    expect(boundary.escapeLog).toEqual([])
    expect(boundary.rng).toEqual(boundaryRng)
    boundaryCombat.hero.hp = 86
    stepExpedition(boundary, defs)
    const boundaryAttempt = boundary.escapeLog[0]
    if (boundaryAttempt === undefined) throw new Error('40% escape was not logged')
    console.log('[sim]', 'escape roll', {
      roll: boundaryAttempt.roll,
      chance: boundaryAttempt.chancePercent,
      result: boundaryAttempt.success,
      hp: boundaryAttempt.hp,
      maxHp: boundaryAttempt.maxHp,
      thresholdPercent: boundaryAttempt.thresholdPercent,
    })
    expect(boundaryAttempt.hp).toBe(86)
    expect(boundaryAttempt.maxHp).toBe(215)
    expect(boundaryAttempt.thresholdPercent).toBe(40)

    const empty = createExpedition(
      { ...fixtureBlueprint(), retreatThresholds: [], travelGapMs: STEP_MS },
      3,
    )
    stepExpedition(empty, defs)
    const emptyCombat = empty.combat
    if (emptyCombat === null) throw new Error('empty-threshold fight is missing')
    emptyCombat.hero.hp = 1
    const emptyRng = { ...empty.rng }
    for (let index = 0; index < 20; index += 1) stepExpedition(empty, defs)
    console.log('[sim]', 'escape roll', { roll: null, chance: null, result: 'none', escapes: empty.escapeLog.length })
    expect(empty.escapeLog).toEqual([])
    expect(empty.rng).toEqual(emptyRng)
    expect(empty.phase).toBe('combat')
    expect(empty.returning).toBe(false)
  })

  it('secures earlier loot on arrival and adds nothing for an abandoned fight', () => {
    const state = createExpedition(
      {
        ...droppedBlueprint([
          { id: 'shardling-pair', enemies: [droppedEnemy(0, 'shard')] },
          { id: 'wolf-pair', enemies: [droppedEnemy(0, 'hide')] },
        ]),
        retreatThresholds: [{ kind: 'hpFraction', atMost: 1 }],
      },
      1,
    )
    win(state, defs)
    expect(state.unsecured).toEqual([{ materialId: 'shard', quantity: 4 }])
    expect(state.momentum).toBe(1)
    stepUntilCombat(state, defs)
    const combat = state.combat
    if (combat === null) throw new Error('escape fight is missing')
    const ready = combat.hero.nextReadyMs
    state.rng = rngWithFloats([(value) => value < 0.01])
    stepExpedition(state, defs)
    const attempt = state.escapeLog[0]
    if (attempt === undefined) throw new Error('successful escape was not logged')
    console.log('[sim]', 'escape roll', {
      roll: attempt.roll,
      chance: attempt.chancePercent,
      result: attempt.success,
      line: formatEvent(attempt),
    })
    expect(attempt.success).toBe(true)
    expect(formatEvent(attempt)).toContain(': success.')
    expect(combat.hero.nextReadyMs).toBe(ready)
    expect(state.combat).toBeNull()
    expect(state.current).toBeNull()
    expect(state.returning).toBe(true)
    expect(state.phase).toBe('travel')
    expect(state.travelMs).toBe(0)
    expect(state.outcome).toBe('ongoing')
    expect(state.escapeRetryMs).toBeNull()
    expect(state.history.at(-1)).toMatchObject({
      outcome: 'retreat',
      durationMs: attempt.timeMs,
      encounterId: 'wolf-pair',
    })
    expect(state.unsecured).toEqual([{ materialId: 'shard', quantity: 4 }])
    expect(state.secured).toEqual([])
    expect(state.overflow).toBe(0)
    expect(state.momentum).toBe(1)
    expect(state.rareNodeChance).toBe(RARE_NODE_CHANCE_PER_STACK)

    stepFor(state, defs, 10_000)
    expect(state.outcome).toBe('ongoing')
    expect(state.returning).toBe(true)
    expect(state.travelMs).toBe(10_000)
    expect(state.unsecured).toEqual([{ materialId: 'shard', quantity: 4 }])
    expect(state.secured).toEqual([])
    expect(state.momentum).toBe(1)
    const fights = state.history.length
    runExpedition(state, defs, fights, 60_000)
    console.log('[sim]', 'escape arrival', {
      outcome: state.outcome,
      momentum: state.momentum,
      unsecured: state.unsecured,
      secured: state.secured,
      fights: state.history.length,
    })
    expect(state.outcome).toBe('returned')
    expect(state.returning).toBe(false)
    expect(state.history).toHaveLength(fights)
    expect(state.history.every((entry) => entry.index < fights)).toBe(true)
    expect(state.momentum).toBe(0)
    expect(state.rareNodeChance).toBe(0)
    expect(state.unsecured).toEqual([])
    expect(state.secured).toEqual([{ materialId: 'shard', quantity: 4 }])
    expect(state.phase).toBe('travel')
    expect(state.combat).toBeNull()
  })

  it('retries a failed escape after 8 seconds and keeps that wait while HP recovers', () => {
    const state = createExpedition(
      {
        ...droppedBlueprint([{ id: 'shardling-pair', enemies: [droppedEnemy(0, 'shard')] }]),
        retreatThresholds: [{ kind: 'hpFraction', atMost: 0.5 }],
      },
      2,
    )
    stepUntilCombat(state, defs)
    const combat = state.combat
    if (combat === null) throw new Error('retry fight is missing')
    combat.hero.maxHp = 100_000
    combat.hero.hp = 40_000
    combat.hero.nextReadyMs = 123_456
    for (const enemy of combat.enemies) enemy.power = 0
    state.rng = rngWithFloats([
      (value) => value >= 0.99,
      (value) => value >= 0.99,
      (value) => value >= 0.99,
    ])
    stepExpedition(state, defs)
    const first = state.escapeLog[0]
    if (first === undefined) throw new Error('failed escape was not logged')
    console.log('[sim]', 'escape roll', { roll: first.roll, chance: first.chancePercent, result: first.success })
    expect(first.success).toBe(false)
    expect(formatEvent(first)).toContain(': failure.')
    expect(combat.hero.nextReadyMs).toBe(123_456)
    expect(state.escapeRetryMs).toBe(first.timeMs + 8_000)
    expect(state.phase).toBe('combat')
    expect(state.history).toEqual([])

    const retryAt = state.escapeRetryMs
    if (retryAt === null) throw new Error('retry time is missing')
    while (combat.timeMs + STEP_MS < retryAt) {
      stepExpedition(state, defs)
      if (state.combat !== combat) throw new Error('combat ended before the retry')
    }
    expect(state.escapeLog).toHaveLength(1)
    expect(combat.hero.nextReadyMs).toBe(123_456)
    expect(combat.log.some((event) => event.type === 'action' && event.timeMs > first.timeMs)).toBe(true)
    stepExpedition(state, defs)
    const second = state.escapeLog[1]
    if (second === undefined) throw new Error('retry escape was not logged')
    console.log('[sim]', 'escape roll', {
      roll: second.roll,
      chance: second.chancePercent,
      result: second.success,
      timeMs: second.timeMs,
      retryAt,
    })
    expect(second.success).toBe(false)
    expect(second.timeMs).toBe(retryAt)
    expect(state.escapeRetryMs).toBe(retryAt + 8_000)
    expect(combat.hero.nextReadyMs).toBe(123_456)

    const stored = state.escapeRetryMs
    if (stored === null) throw new Error('stored retry is missing')
    combat.hero.hp = combat.hero.maxHp
    const logged = state.escapeLog.length
    while (combat.timeMs < stored) stepExpedition(state, defs)
    stepExpedition(state, defs)
    expect(state.combat).toBe(combat)
    expect(state.escapeLog).toHaveLength(logged)
    expect(state.escapeRetryMs).toBe(stored)
    expect(combat.hero.hp * 1000).toBeGreaterThan(combat.hero.maxHp * 500)
    combat.hero.hp = 40_000
    stepExpedition(state, defs)
    const third = state.escapeLog[logged]
    if (third === undefined) throw new Error('escape did not roll again after HP fell')
    console.log('[sim]', 'escape roll', { roll: third.roll, chance: third.chancePercent, result: third.success })
    expect(third.success).toBe(false)
    expect(third.timeMs).toBeGreaterThanOrEqual(stored)
    expect(state.phase).toBe('combat')

    if (state.combat === null) throw new Error('fight ended before the next encounter')
    state.combat.outcome = 'victory'
    stepExpedition(state, defs)
    expect(state.phase).toBe('travel')
    expect(state.escapeRetryMs).toBe(third.timeMs + 8_000)
    stepExpedition(state, defs)
    expect(state.phase).toBe('combat')
    expect(state.escapeRetryMs).toBeNull()
  })

  it('does not escape on the step that defeats the hero', () => {
    const state = createExpedition(
      { ...fixtureBlueprint(), retreatThresholds: [{ kind: 'hpFraction', atMost: 1 }], travelGapMs: STEP_MS },
      6,
    )
    stepExpedition(state, defs)
    const combat = state.combat
    if (combat === null) throw new Error('lethal fight is missing')
    const enemy = combat.enemies[0]
    if (enemy === undefined) throw new Error('lethal enemy is missing')
    combat.hero.hp = 1
    combat.hero.nextReadyMs = 1_000_000
    combat.hero.evasion = 0
    combat.hero.barrier = 0
    enemy.nextReadyMs = STEP_MS
    enemy.accuracy = 1_000
    enemy.power = 10_000
    state.rng = rngWithFloats([(value) => value < 0.01])
    combat.rng = rngWithFloats([(value) => value < 0.05])
    const expeditionRng = { ...state.rng }
    stepExpedition(state, defs)
    console.log('[sim]', 'escape roll', {
      roll: null,
      chance: null,
      result: state.outcome,
      escapes: state.escapeLog.length,
      hp: combat.hero.hp,
    })
    expect(state.outcome).toBe('defeat')
    expect(state.escapeLog).toEqual([])
    expect(state.returning).toBe(false)
    expect(state.history.at(-1)?.outcome).toBe('defeat')
    expect(state.rng).toEqual(expeditionRng)
    expect(combat.log.some((event) => event.type === 'escape')).toBe(false)
  })

  it('keeps a threshold and a pending retry through JSON, and arrives on the same walk step', () => {
    function failedEscape(): ExpeditionState {
      const state = createExpedition(
        {
          ...droppedBlueprint([{ id: 'shardling-pair', enemies: [droppedEnemy(0, 'shard')] }]),
          retreatThresholds: [{ kind: 'hpFraction', atMost: 0.4 }],
        },
        7,
      )
      stepUntilCombat(state, defs)
      const combat = state.combat
      if (combat === null) throw new Error('resume fight is missing')
      combat.hero.maxHp = 215
      combat.hero.hp = 81
      combat.hero.nextReadyMs = 1_000_000
      for (const enemy of combat.enemies) {
        enemy.power = 0
        enemy.nextReadyMs = 1_000_000
      }
      state.rng = rngWithFloats([(value) => value >= 0.99])
      stepExpedition(state, defs)
      return state
    }
    const live = failedEscape()
    const resumed = cloneExpedition(failedEscape())
    const attempt = resumed.escapeLog[0]
    if (attempt === undefined) throw new Error('resumed escape was not logged')
    console.log('[sim]', 'escape roll', {
      roll: attempt.roll,
      chance: attempt.chancePercent,
      result: attempt.success,
      retry: resumed.escapeRetryMs,
      thresholds: resumed.retreatThresholds,
    })
    expect(resumed.retreatThresholds).toEqual([{ kind: 'hpFraction', atMost: 0.4 }])
    expect(resumed.escapeRetryMs).toBe(attempt.timeMs + 8_000)
    expect(resumed.escapeRetryMs).toBe(live.escapeRetryMs)
    expect(JSON.stringify(resumed)).toBe(JSON.stringify(live))
    stepFor(live, defs, 400)
    stepFor(resumed, defs, 400)
    expect(resumed.phase).toBe('combat')
    expect(resumed.escapeLog).toHaveLength(1)
    expect(resumed.escapeRetryMs).toBe(live.escapeRetryMs)
    expect(JSON.stringify(resumed)).toBe(JSON.stringify(live))

    function escapedWalk(): ExpeditionState {
      const state = createExpedition(
        {
          ...droppedBlueprint([
            { id: 'shardling-pair', enemies: [droppedEnemy(0, 'shard'), droppedEnemy(1, 'hide')] },
          ]),
          retreatThresholds: [{ kind: 'hpFraction', atMost: 1 }],
        },
        8,
      )
      stepUntilCombat(state, defs)
      state.rng = rngWithFloats([(value) => value < 0.01])
      stepExpedition(state, defs)
      if (!state.returning) throw new Error('escape walk did not start')
      return state
    }
    const walking = escapedWalk()
    const pausedWalk = escapedWalk()
    stepFor(walking, defs, 10_000)
    stepFor(pausedWalk, defs, 10_000)
    const resumedWalk = cloneExpedition(pausedWalk)
    stepFor(walking, defs, 9_990)
    stepFor(resumedWalk, defs, 9_990)
    console.log('[sim]', 'escape walk resume', {
      travelMs: resumedWalk.travelMs,
      outcome: resumedWalk.outcome,
      thresholds: resumedWalk.retreatThresholds,
      unsecured: resumedWalk.unsecured,
    })
    expect(resumedWalk.travelMs).toBe(19_990)
    expect(resumedWalk.outcome).toBe('ongoing')
    expect(resumedWalk.returning).toBe(true)
    expect(resumedWalk.retreatThresholds).toEqual([{ kind: 'hpFraction', atMost: 1 }])
    expect(resumedWalk.unsecured).toEqual([])
    expect(JSON.stringify(resumedWalk)).toBe(JSON.stringify(walking))
    stepFor(walking, defs, STEP_MS)
    stepFor(resumedWalk, defs, STEP_MS)
    expect(resumedWalk.outcome).toBe('returned')
    expect(walking.outcome).toBe('returned')
    expect(resumedWalk.momentum).toBe(0)
    expect(resumedWalk.secured).toEqual([])
    expect(JSON.stringify(resumedWalk)).toBe(JSON.stringify(walking))
  })

  it('destroys unsecured loot and clears momentum on defeat', () => {
    const state = enterDefeatFight(defs, 80)
    state.unsecured = [{ materialId: 'shard', quantity: 8 }]
    state.secured = [{ materialId: 'hide', quantity: 3 }]
    state.overflow = 10
    setMomentum(state, 4)
    forceDefeat(state, defs)
    console.log('[sim]', 'defeat loot', {
      unsecured: state.unsecured,
      secured: state.secured,
      overflow: state.overflow,
      momentum: state.momentum,
      rareNodeChance: state.rareNodeChance,
    })
    expect(state.outcome).toBe('defeat')
    expect(state.returning).toBe(false)
    expect(state.unsecured).toEqual([])
    expect(state.secured).toEqual([{ materialId: 'hide', quantity: 3 }])
    expect(state.overflow).toBe(10)
    expect(state.momentum).toBe(0)
    expect(state.rareNodeChance).toBe(0)
  })

  it('removes 10 durability on defeat and disables a piece that reaches 0', () => {
    const state = enterDefeatFight(defs, 81)
    expect(state.equipment.map((entry) => entry.slot)).toEqual([
      'mainHand',
      'offHand',
      'head',
      'chest',
      'hands',
      'feet',
      'accessory0',
      'accessory1',
    ])
    expect(
      state.equipment.every((entry) => entry.durability === 100 && entry.maxDurability === 100 && !entry.disabled),
    ).toBe(true)
    const feet = state.equipment.find((entry) => entry.slot === 'feet')
    if (feet === undefined) throw new Error('feet are missing')
    feet.durability = 10
    const slots = state.equipment.map((entry) => entry.slot)
    const itemIds = state.equipment.map((entry) => entry.itemId)
    forceDefeat(state, defs)
    console.log(
      '[sim]',
      'durability',
      state.equipment.map((entry) => ({
        slot: entry.slot,
        durability: entry.durability,
        maxDurability: entry.maxDurability,
        disabled: entry.disabled,
      })),
    )
    expect(state.equipment).toHaveLength(slots.length)
    expect(state.equipment.map((entry) => entry.slot)).toEqual(slots)
    expect(state.equipment.map((entry) => entry.itemId)).toEqual(itemIds)
    for (const entry of state.equipment) {
      expect(entry.maxDurability).toBe(100)
      if (entry.slot === 'feet') {
        expect(entry.durability).toBe(0)
        expect(entry.disabled).toBe(true)
      } else {
        expect(entry.durability).toBe(90)
        expect(entry.disabled).toBe(false)
      }
    }
    expect(state.equipment.some((entry) => entry.slot === 'feet')).toBe(true)

    const stillEnabled = enterDefeatFight(defs, 82)
    const mainHand = stillEnabled.equipment[0]
    if (mainHand === undefined) throw new Error('main hand is missing')
    mainHand.disabled = true
    expect(() => stepExpedition(stillEnabled, defs)).toThrow(/disabled/)

    const unmarked = enterDefeatFight(defs, 83)
    const head = unmarked.equipment.find((entry) => entry.slot === 'head')
    if (head === undefined) throw new Error('head is missing')
    head.durability = 0
    expect(() => stepExpedition(unmarked, defs)).toThrow(/disabled/)

    const over = enterDefeatFight(defs, 84)
    const chest = over.equipment.find((entry) => entry.slot === 'chest')
    if (chest === undefined) throw new Error('chest is missing')
    chest.durability = 101
    expect(() => stepExpedition(over, defs)).toThrow(/maximum/)
  })

  it('keeps a held supply and consumed ids through defeat', () => {
    const fresh = start()
    expect(fresh.supplySlots).toEqual([null, null, null, null])
    expect(fresh.consumedSupplyIds).toEqual([])

    const state = enterDefeatFight(defs, 70)
    state.supplySlots[0] = { id: 'held' }
    state.consumedSupplyIds = ['used']
    forceDefeat(state, defs)
    console.log('[sim]', 'supplies', {
      supplySlots: state.supplySlots,
      consumedSupplyIds: state.consumedSupplyIds,
    })
    expect(state.supplySlots).toEqual([{ id: 'held' }, null, null, null])
    expect(state.consumedSupplyIds).toEqual(['used'])

    const emptyId = start()
    emptyId.supplySlots[0] = { id: '' }
    expect(() => stepExpedition(emptyId, defs)).toThrow(/id/)

    const notAnItem = start()
    ;(notAnItem as { supplySlots: unknown[] }).supplySlots[0] = 'held'
    expect(() => stepExpedition(notAnItem, defs)).toThrow(/supply slot/)
  })

  it('pays the rescue fee from carried gold and adds the unpaid part to debt', () => {
    const fresh = start()
    expect(fresh.carriedGold).toBe(0)
    expect(fresh.depositedGold).toBe(0)
    expect(fresh.debt).toBe(0)
    expect(() => createExpedition({ ...fixtureBlueprint(), carriedGold: -1 }, 1)).toThrow(/carried gold/)
    expect(() => createExpedition({ ...fixtureBlueprint(), depositedGold: 1.5 }, 1)).toThrow(/deposited gold/)

    const cases = [
      { carried: 40, left: 15, debt: 0 },
      { carried: 10, left: 0, debt: 15 },
      { carried: 0, left: 0, debt: 25 },
    ]
    for (const [index, entry] of cases.entries()) {
      const state = enterDefeatFight(defs, 60 + index, { carriedGold: entry.carried, depositedGold: 100 })
      forceDefeat(state, defs)
      console.log('[sim]', 'rescue fee', {
        carriedBefore: entry.carried,
        carriedGold: state.carriedGold,
        depositedGold: state.depositedGold,
        debt: state.debt,
      })
      expect(state.carriedGold).toBe(entry.left)
      expect(state.debt).toBe(entry.debt)
      expect(state.depositedGold).toBe(100)
    }
  })

  it('stores a 5 minute recovery and does not tick it', () => {
    const state = enterDefeatFight(defs, 51)
    expect(state.recoveryMs).toBe(0)
    forceDefeat(state, defs)
    expect(state.outcome).toBe('defeat')
    expect(state.recoveryMs).toBe(300_000)
    stepExpedition(state, defs)
    stepExpedition(state, defs)
    console.log('[sim]', 'recovery', { recoveryMs: state.recoveryMs, outcome: state.outcome })
    expect(state.recoveryMs).toBe(300_000)
    expect(state.outcome).toBe('defeat')
  })

  it('sets bossLossThisLife only for a non-summon boss', () => {
    const normal = enterDefeatFight(defs, 41)
    const enemy = normal.combat?.enemies[0]
    if (enemy === undefined) throw new Error('normal enemy is missing')
    expect(enemy.boss).toBe(false)
    expect(enemy.summon).toBe(false)
    forceDefeat(normal, defs)

    const bossDefs = bossDummyDefs()
    const bossState = enterDefeatFight(bossDefs, 42)
    const boss = bossState.combat?.enemies[0]
    if (boss === undefined) throw new Error('boss enemy is missing')
    expect(boss.boss).toBe(true)
    expect(boss.summon).toBe(false)
    forceDefeat(bossState, bossDefs)

    const summonState = enterDefeatFight(bossDefs, 43)
    const summon = summonState.combat?.enemies[0]
    if (summon === undefined) throw new Error('summon enemy is missing')
    summon.summon = true
    expect(summon.boss).toBe(true)
    forceDefeat(summonState, bossDefs)
    console.log('[sim]', 'boss flag', {
      normal: normal.bossLossThisLife,
      boss: bossState.bossLossThisLife,
      summon: summonState.bossLossThisLife,
    })
    expect(normal.bossLossThisLife).toBe(false)
    expect(bossState.bossLossThisLife).toBe(true)
    expect(summonState.bossLossThisLife).toBe(false)
  })

  it('secures loot when a retreat arrives and does not charge defeat costs', () => {
    const state = createExpedition(
      {
        ...droppedBlueprint([{ id: 'shardling-pair', enemies: [droppedEnemy(0, 'shard')] }]),
        retreatThresholds: [{ kind: 'hpFraction', atMost: 1 }],
        carriedGold: 40,
        depositedGold: 100,
      },
      90,
    )
    state.unsecured = [{ materialId: 'shard', quantity: 4 }]
    state.secured = [{ materialId: 'hide', quantity: 2 }]
    state.overflow = 3
    setMomentum(state, 2)
    const feet = state.equipment.find((entry) => entry.slot === 'feet')
    if (feet === undefined) throw new Error('feet are missing')
    feet.durability = 80
    const equipment = state.equipment.map((entry) => ({ ...entry }))
    stepUntilCombat(state, defs)
    const combat = state.combat
    if (combat === null) throw new Error('retreat fight is missing')
    combat.hero.nextReadyMs = 1_000_000
    for (const enemy of combat.enemies) {
      enemy.power = 0
      enemy.nextReadyMs = 1_000_000
    }
    state.rng = rngWithFloats([(value) => value < 0.01])
    stepExpedition(state, defs)
    expect(state.history.at(-1)?.outcome).toBe('retreat')
    expect(state.returning).toBe(true)
    expect(state.outcome).toBe('ongoing')
    expect(state.unsecured).toEqual([{ materialId: 'shard', quantity: 4 }])
    expect(state.equipment).toEqual(equipment)
    expect(state.carriedGold).toBe(40)
    expect(state.depositedGold).toBe(100)
    expect(state.debt).toBe(0)
    expect(state.recoveryMs).toBe(0)
    const fights = state.history.length
    runExpedition(state, defs, fights, 60_000)
    console.log('[sim]', 'retreat arrival', {
      outcome: state.outcome,
      secured: state.secured,
      carriedGold: state.carriedGold,
      depositedGold: state.depositedGold,
      debt: state.debt,
      recoveryMs: state.recoveryMs,
      durability: state.equipment.map((entry) => `${entry.slot}:${entry.durability}/${entry.maxDurability}`),
    })
    expect(state.outcome).toBe('returned')
    expect(state.unsecured).toEqual([])
    expect(state.secured).toEqual([
      { materialId: 'hide', quantity: 2 },
      { materialId: 'shard', quantity: 4 },
    ])
    expect(state.overflow).toBe(3)
    expect(state.momentum).toBe(0)
    expect(state.equipment).toEqual(equipment)
    expect(state.carriedGold).toBe(40)
    expect(state.depositedGold).toBe(100)
    expect(state.debt).toBe(0)
    expect(state.recoveryMs).toBe(0)
    expect(state.bossLossThisLife).toBe(false)
    expect(feet.durability).toBe(80)
    expect(feet.disabled).toBe(false)
  })

  it('keeps debt, recovery, durability, and the boss flag through JSON', () => {
    const bossDefs = bossDummyDefs()
    const state = enterDefeatFight(bossDefs, 11, { carriedGold: 10, depositedGold: 100 })
    const feet = state.equipment.find((entry) => entry.slot === 'feet')
    if (feet === undefined) throw new Error('feet are missing')
    feet.durability = 10
    forceDefeat(state, bossDefs)
    const resumed = cloneExpedition(state)
    stepExpedition(resumed, bossDefs)
    const resumedFeet = resumed.equipment.find((entry) => entry.slot === 'feet')
    console.log('[sim]', 'defeat resume', {
      debt: resumed.debt,
      recoveryMs: resumed.recoveryMs,
      bossLoss: resumed.bossLossThisLife,
      feet: resumedFeet,
    })
    expect(resumed.carriedGold).toBe(0)
    expect(resumed.depositedGold).toBe(100)
    expect(resumed.debt).toBe(15)
    expect(resumed.recoveryMs).toBe(300_000)
    expect(resumed.bossLossThisLife).toBe(true)
    expect(resumedFeet).toEqual({
      slot: 'feet',
      itemId: feet.itemId,
      durability: 0,
      maxDurability: 100,
      disabled: true,
    })
    expect(resumed.equipment).toEqual(state.equipment)
    expect(JSON.stringify(resumed)).toBe(JSON.stringify(state))
  })

  it('does not charge defeat costs on victory or timeout', () => {
    function prepared(seed: number): ExpeditionState {
      const state = enterDefeatFight(defs, seed, { carriedGold: 40, depositedGold: 100 })
      state.unsecured = [{ materialId: 'shard', quantity: 4 }]
      state.secured = [{ materialId: 'hide', quantity: 2 }]
      state.overflow = 3
      setMomentum(state, 2)
      state.supplySlots[0] = { id: 'held' }
      state.consumedSupplyIds = ['used']
      return state
    }

    const victory = prepared(91)
    const victoryGear = victory.equipment.map((entry) => ({ ...entry }))
    const victoryCombat = victory.combat
    if (victoryCombat === null) throw new Error('victory fight is missing')
    victoryCombat.outcome = 'victory'
    stepExpedition(victory, defs)
    console.log('[sim]', 'victory costs', {
      outcome: victory.outcome,
      carriedGold: victory.carriedGold,
      debt: victory.debt,
      recoveryMs: victory.recoveryMs,
      momentum: victory.momentum,
    })
    expect(victory.outcome).toBe('ongoing')
    expect(victory.history.at(-1)?.outcome).toBe('victory')
    expect(victory.unsecured).toEqual([{ materialId: 'shard', quantity: 4 }])
    expect(victory.secured).toEqual([{ materialId: 'hide', quantity: 2 }])
    expect(victory.overflow).toBe(3)
    expect(victory.momentum).toBe(3)
    expect(victory.rareNodeChance).toBe(6)
    expect(victory.equipment).toEqual(victoryGear)
    expect(victory.supplySlots).toEqual([{ id: 'held' }, null, null, null])
    expect(victory.consumedSupplyIds).toEqual(['used'])
    expect(victory.carriedGold).toBe(40)
    expect(victory.depositedGold).toBe(100)
    expect(victory.debt).toBe(0)
    expect(victory.recoveryMs).toBe(0)
    expect(victory.bossLossThisLife).toBe(false)

    const timeout = prepared(92)
    const timeoutGear = timeout.equipment.map((entry) => ({ ...entry }))
    const timeoutCombat = timeout.combat
    if (timeoutCombat === null) throw new Error('timeout fight is missing')
    timeoutCombat.outcome = 'timeout'
    stepExpedition(timeout, defs)
    console.log('[sim]', 'timeout costs', {
      outcome: timeout.outcome,
      carriedGold: timeout.carriedGold,
      debt: timeout.debt,
      recoveryMs: timeout.recoveryMs,
      momentum: timeout.momentum,
      unsecured: timeout.unsecured,
    })
    expect(timeout.outcome).toBe('ongoing')
    expect(timeout.history.at(-1)?.outcome).toBe('timeout')
    expect(timeout.unsecured).toEqual([{ materialId: 'shard', quantity: 4 }])
    expect(timeout.secured).toEqual([{ materialId: 'hide', quantity: 2 }])
    expect(timeout.overflow).toBe(3)
    expect(timeout.momentum).toBe(2)
    expect(timeout.rareNodeChance).toBe(4)
    expect(timeout.equipment).toEqual(timeoutGear)
    expect(timeout.supplySlots).toEqual([{ id: 'held' }, null, null, null])
    expect(timeout.consumedSupplyIds).toEqual(['used'])
    expect(timeout.carriedGold).toBe(40)
    expect(timeout.depositedGold).toBe(100)
    expect(timeout.debt).toBe(0)
    expect(timeout.recoveryMs).toBe(0)
    expect(timeout.bossLossThisLife).toBe(false)
  })

  it('does not read durability when deriving combat stats', () => {
    expect(weaponHasDurability).toBe(false)
    expect(offHandHasDurability).toBe(false)
    expect(armorHasDurability).toBe(false)
    expect(accessoryHasDurability).toBe(false)

    const state = enterDefeatFight(defs, 93)
    const gear = state.heroTemplate.gear
    const pieces = [gear.mainHand, gear.offHand, gear.head, gear.chest, gear.hands, gear.feet, ...gear.accessories]
    for (const piece of pieces) {
      if (piece === null) continue
      expect(Object.hasOwn(piece, 'durability')).toBe(false)
      expect(Object.hasOwn(piece, 'maxDurability')).toBe(false)
      expect(Object.hasOwn(piece, 'disabled')).toBe(false)
    }
    const statInput = {
      level: state.heroTemplate.level,
      classId: state.classId,
      attributes: state.heroTemplate.attributes,
      gear,
    }
    const derived = deriveHeroStats(statInput)
    const combat = state.combat
    if (combat === null) throw new Error('stats fight is missing')
    const before = {
      power: combat.hero.power,
      armor: combat.hero.armor,
      resistance: combat.hero.resistance,
      accuracy: combat.hero.accuracy,
      evasion: combat.hero.evasion,
      actionTimeMs: combat.hero.actionTimeMs,
    }
    forceDefeat(state, defs)
    console.log('[sim]', 'durability stats', {
      derivedPower: derived.physicalPower,
      power: combat.hero.power,
      armor: combat.hero.armor,
      durability: state.equipment.map((entry) => entry.durability),
    })
    expect(deriveHeroStats(statInput)).toEqual(derived)
    expect({
      power: combat.hero.power,
      armor: combat.hero.armor,
      resistance: combat.hero.resistance,
      accuracy: combat.hero.accuracy,
      evasion: combat.hero.evasion,
      actionTimeMs: combat.hero.actionTimeMs,
    }).toEqual(before)
    expect(state.equipment.every((entry) => entry.durability === 90)).toBe(true)
  })
})

function rngWithFloats(checks: readonly ((value: number) => boolean)[]): RngState {
  for (let seed = 1; seed < 1_000_000; seed += 1) {
    const start = createRng(seed)
    const probe = { a: start.a, b: start.b, c: start.c, d: start.d }
    let matched = true
    for (const check of checks) {
      if (!check(nextFloat(probe))) {
        matched = false
        break
      }
    }
    if (matched) return start
  }
  throw new Error(`no rng seed matched ${checks.length} escape rolls`)
}

function lootTotal(stacks: readonly { quantity: number }[]): number {
  let total = 0
  for (const stack of stacks) total += stack.quantity
  return total
}
