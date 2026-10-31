import { describe, expect, it } from 'vitest'

import { grantClassResource, spiritResourceFactor } from '../classes/resources.ts'
import { createCombat, stepCombat } from '../combat.ts'
import { HEALING_ROLL_FLOOR, STEP_MS, type HeroClass } from '../constants.ts'
import { consistencyBounds } from '../damage.ts'
import {
  createExpedition,
  resetFerocity,
  resetFocus,
  returnToTown,
  SPLINTERED_ROAD_ID,
  stepExpedition,
  TRAVEL_GAP_MS,
  type ExpeditionBlueprint,
  type ExpeditionState,
} from '../expedition.ts'
import { formatEvent } from '../log.ts'
import { xpFromEnemies } from '../progression.ts'
import { createRng, nextFloat, type RngState } from '../rng.ts'
import { CLASS_HOOK_NAMES, type CombatSetup, type CombatState, type EnemyDef, type GameDefs, type SkillDef } from '../types.ts'
import { focusResourceMultiplier, focusRollFloorBonus } from './adjustments.ts'
import { beastfolkRace, ferocityTier } from './beastfolk.ts'
import { elfRace } from './elf.ts'
import { humanOrdinaryXp, humanRace } from './human.ts'
import { undeadRace } from './undead.ts'

const ITEM_LEVEL = 20
const QUALITY = 1

function armor(slot: 'head' | 'chest' | 'hands' | 'feet') {
  return { id: `ref-heavy-${slot}`, slot, category: 'heavy' as const, itemLevel: ITEM_LEVEL, quality: QUALITY }
}

function warriorGear(): CombatSetup['hero']['gear'] {
  return {
    mainHand: { id: 'ref-one-handed', kind: 'oneHanded', itemLevel: ITEM_LEVEL, quality: QUALITY },
    offHand: { id: 'ref-shield', kind: 'shield', itemLevel: ITEM_LEVEL, quality: QUALITY },
    head: armor('head'),
    chest: armor('chest'),
    hands: armor('hands'),
    feet: armor('feet'),
    accessories: [
      { id: 'ref-accessory-a', itemLevel: ITEM_LEVEL, quality: QUALITY },
      { id: 'ref-accessory-b', itemLevel: ITEM_LEVEL, quality: QUALITY },
    ],
  }
}

function setup(options?: {
  race?: CombatSetup['hero']['race']
  spirit?: number
  skill?: SkillDef
  ferocityProgress?: number
  startingFocus?: number
  enemyHp?: number
  enemyAction?: number
}): { setup: CombatSetup; defs: GameDefs } {
  const skill = options?.skill
  const enemy: EnemyDef = {
    id: 'dummy',
    name: 'Dummy',
    level: 20,
    archetype: 'standard',
    school: 'physical',
    overrides: {
      ...(options?.enemyHp !== undefined ? { maxHp: options.enemyHp } : {}),
      ...(options?.enemyAction !== undefined ? { actionTime: options.enemyAction } : {}),
    },
  }
  const hero: CombatSetup['hero'] = {
    id: 'hero',
    name: 'Hero',
    level: 20,
    classId: 'warrior',
    ...(options?.race !== undefined ? { race: options.race } : {}),
    attributes: { strength: 24, vitality: 22, agility: 16, intellect: 10, spirit: options?.spirit ?? 16 },
    gear: warriorGear(),
    ...(skill !== undefined ? { equippedSkillIds: [skill.id], priorityRows: [{ skillId: skill.id }] } : {}),
    ...(options?.ferocityProgress !== undefined ? { ferocityProgress: options.ferocityProgress } : {}),
    ...(options?.startingFocus !== undefined ? { startingFocus: options.startingFocus } : {}),
  }
  return {
    setup: { hero, enemies: [{ defId: 'dummy', slot: 0 }] },
    defs: {
      enemies: { dummy: enemy },
      skills: skill !== undefined ? { [skill.id]: skill } : {},
      statuses: {},
    },
  }
}

function open(options?: Parameters<typeof setup>[0], seed = 1): { state: CombatState; defs: GameDefs } {
  const built = setup(options)
  return { state: createCombat(built.setup, built.defs, seed), defs: built.defs }
}

const cut: SkillDef = {
  id: 'cut',
  name: 'Cut',
  cost: 0,
  cooldownSeconds: 0,
  actionTimeCoefficient: 1,
  tags: [],
  target: 'single',
  effects: [{ kind: 'damage', school: 'physical', coefficient: 1 }],
}

const mend: SkillDef = {
  id: 'mend',
  name: 'Mend',
  cost: 0,
  cooldownSeconds: 0,
  actionTimeCoefficient: 1,
  tags: [],
  target: 'single',
  effects: [{ kind: 'heal', maxHpFraction: 0, healingCoefficient: 1 }],
}

function raceLines(state: CombatState): string[] {
  return state.log.filter((event) => event.type === 'race').map((event) => formatEvent(event))
}

function stepUntil(state: CombatState, defs: GameDefs, seen: (state: CombatState) => boolean): void {
  let steps = 0
  while (!seen(state)) {
    stepCombat(state, defs)
    steps += 1
    if (steps > 5_000) throw new Error('combat step limit')
  }
}

function roadGear(classId: HeroClass): CombatSetup['hero']['gear'] {
  const weapon = classId === 'warrior' ? 'oneHanded' : 'caster'
  const piece = (slot: 'head' | 'chest' | 'hands' | 'feet') => ({
    id: `heavy-${slot}`,
    slot,
    category: 'heavy' as const,
    itemLevel: 5,
    quality: 1,
  })
  return {
    mainHand: { id: `weapon-${weapon}`, kind: weapon, itemLevel: 5, quality: 1 },
    offHand: { id: 'shield', kind: 'shield', itemLevel: 5, quality: 1 },
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

function roadBlueprint(race?: CombatSetup['hero']['race']): ExpeditionBlueprint {
  const encounter = { id: 'dummy', enemies: [{ defId: 'dummy', slot: 0, level: 3 }] }
  return {
    id: SPLINTERED_ROAD_ID,
    opening: [encounter, encounter],
    draw: [encounter],
    travelGapMs: STEP_MS,
    retreatThresholds: [],
    hero: {
      id: 'road-hero',
      name: 'Road Hero',
      level: 5,
      classId: 'warrior',
      ...(race !== undefined ? { race } : {}),
      attributes: { strength: 10, vitality: 14, agility: 10, intellect: 10, spirit: 10 },
      gear: roadGear('warrior'),
      equippedSkillIds: [],
    },
  }
}

function roadDefs(overrides?: EnemyDef['overrides'], elite = false): GameDefs {
  const dummy: EnemyDef = {
    id: 'dummy',
    name: 'Dummy',
    level: 1,
    levelMin: 1,
    levelMax: 20,
    archetype: 'standard',
    school: 'physical',
    ...(elite ? { elite: true } : {}),
    overrides,
  }
  return { enemies: { dummy }, skills: {}, statuses: {} }
}

function stepFor(state: ExpeditionState, defs: GameDefs, ms: number): void {
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
}

function runFight(state: ExpeditionState, defs: GameDefs): void {
  let steps = 0
  while (state.phase === 'combat' && state.outcome === 'ongoing') {
    stepExpedition(state, defs)
    steps += 1
    if (steps > 20_000) throw new Error('fight did not end')
  }
}

function lowRoll(): RngState {
  for (let seed = 1; seed < 100_000; seed += 1) {
    const start = createRng(seed)
    const probe = { a: start.a, b: start.b, c: start.c, d: start.d }
    if (nextFloat(probe) < 0.01) return start
  }
  throw new Error('no low escape roll')
}

describe('racial cores', () => {
  it('gives humans 5% ordinary XP and leaves the unscaled results and milestones alone', () => {
    const base = [{ xp: 100, level: 1, summon: false }]
    const ordinary = xpFromEnemies(1, 0, base)
    const human = humanOrdinaryXp(1, 0, base)
    const unchanged = [
      xpFromEnemies(4, 0, [{ xp: 15, level: 4, summon: false }]),
      xpFromEnemies(8, 0, [{ xp: 100, level: 3, summon: false }]),
      xpFromEnemies(2, 0, [{ xp: 100, level: 8, summon: false }]),
      xpFromEnemies(5, 50, [{ xp: 100, level: 5, summon: false }]),
      xpFromEnemies(1, 0, [
        { xp: 10, level: 1, summon: false },
        { xp: 10, level: 1, summon: false },
      ]),
      xpFromEnemies(3, 0, [0, 1, 2, 3, 4, 5].map(() => ({ xp: 10, level: 3, summon: false }))),
      xpFromEnemies(10, 0, [
        { xp: 100, level: 5, summon: false },
        { xp: 100, level: 5, summon: false },
      ]),
    ]
    const plain = open({ enemyHp: 1 }, 3)
    const raced = open({ race: 'human', enemyHp: 1 }, 3)
    let steps = 0
    while (plain.state.outcome === 'ongoing' || raced.state.outcome === 'ongoing') {
      if (plain.state.outcome === 'ongoing') stepCombat(plain.state, plain.defs)
      if (raced.state.outcome === 'ongoing') stepCombat(raced.state, raced.defs)
      steps += 1
      if (steps > 5_000) throw new Error('human comparison did not finish')
    }
    const plainEnd = plain.state.log.find((event) => event.type === 'encounterEnd')
    const racedEnd = raced.state.log.find((event) => event.type === 'encounterEnd')
    const plainXp = plain.state.log.find((event) => event.type === 'encounterXp')
    const racedXp = raced.state.log.find((event) => event.type === 'encounterXp')
    const humanLine = raceLines(raced.state)[0]
    console.log('[sim]', 'human xp', { ordinary, human, unchanged, humanLine, plainXp, racedXp })
    const fractional = [{ xp: 14.6, level: 1, summon: false }]
    const fractionalPlain = xpFromEnemies(1, 0, fractional)
    const fractionalHuman = humanOrdinaryXp(1, 0, fractional)
    expect(ordinary).toBe(100)
    expect(human).toBe(105)
    expect(unchanged).toEqual([15, 24, 125, 105, 19, 48, 45])
    expect(fractionalPlain).toBe(15)
    expect(fractionalHuman).toBe(15)
    expect(Math.round(fractionalPlain * 1.05)).toBe(16)
    expect(humanLine).toBe('At 0.000s, Human ordinary XP bonus is 5%.')
    expect(racedEnd).toEqual(plainEnd)
    expect(racedXp).toEqual(plainXp)
    expect(raceLines(plain.state)).toEqual([])
  })

  it('builds Elf Focus from hits, spends it on direct HP loss, and raises the floor and resource gain', () => {
    const gained = open({ race: 'elf' })
    const resolve = elfRace.actionResolved
    const hurt = elfRace.damageTaken
    if (resolve === undefined || hurt === undefined) throw new Error('elf hooks are missing')
    resolve(gained.state, { kind: 'basicAttack', hit: true }, 1720)
    const afterHit = gained.state.hero.raceState.focus
    const hitLine = raceLines(gained.state).at(-1)
    resolve(gained.state, { kind: 'basicAttack', hit: false }, 3000)
    const afterMiss = gained.state.hero.raceState.focus
    gained.state.hero.maxHp = 100
    gained.state.hero.raceState.focus = 10
    hurt(gained.state, { hpLost: 1, hpBefore: 100, kind: 'hit', timeMs: 4000, school: 'physical' })
    const afterLoss = gained.state.hero.raceState.focus
    const lossLine = raceLines(gained.state).at(-1)
    hurt(gained.state, { hpLost: 5, hpBefore: 90, kind: 'statusTick', timeMs: 5000, school: 'physical' })
    hurt(gained.state, { hpLost: 0, hpBefore: 90, kind: 'miss', timeMs: 6000, school: 'physical' })
    const afterIgnored = gained.state.hero.raceState.focus

    const quiet = open({ race: 'elf', skill: cut, spirit: 16 })
    stepUntil(quiet.state, quiet.defs, (state) => state.log.some((event) => event.type === 'damage' && event.actorId === state.hero.id))
    const quietHit = quiet.state.log.find((event) => event.type === 'damage' && event.actorId === quiet.state.hero.id)
    const quietFocus = quiet.state.hero.raceState.focus
    const factor = spiritResourceFactor(quiet.state.hero.spirit)
    quiet.state.hero.raceState.focus = 0
    grantClassResource(quiet.state, 1, 5, 'probe')
    const zeroFocus = quiet.state.log.filter((event) => event.type === 'resource').at(-1)
    quiet.state.hero.raceState.focus = 100
    grantClassResource(quiet.state, 2, 5, 'probe-full')
    const fullFocus = quiet.state.log.filter((event) => event.type === 'resource').at(-1)

    const healed = open({ race: 'elf', skill: mend, startingFocus: 100 })
    stepUntil(healed.state, healed.defs, (state) => state.log.some((event) => event.type === 'heal'))
    const heal = healed.state.log.find((event) => event.type === 'heal')
    const raised = open({ race: 'elf', skill: cut, startingFocus: 100 })
    stepUntil(raised.state, raised.defs, (state) => state.log.some((event) => event.type === 'damage' && event.actorId === state.hero.id))
    const raisedHit = raised.state.log.find((event) => event.type === 'damage' && event.actorId === raised.state.hero.id)

    const carried = createExpedition(roadBlueprint('elf'), 1)
    carried.hero.focus = 30
    const defs = roadDefs()
    stepUntilCombat(carried, defs)
    const carriedIn = carried.combat?.hero.raceState.focus
    if (carried.combat === null) throw new Error('elf fight is missing')
    carried.combat.outcome = 'victory'
    stepExpedition(carried, defs)
    const between = carried.hero.focus
    stepUntilCombat(carried, defs)
    const carriedAgain = carried.combat?.hero.raceState.focus

    const cleared = createExpedition(roadBlueprint('elf'), 2)
    cleared.hero.focus = 30
    returnToTown(cleared)
    stepFor(cleared, defs, 1_000)
    const duringWalk = cleared.hero.focus
    stepFor(cleared, defs, TRAVEL_GAP_MS - 1_000)

    const retreated = createExpedition(
      { ...roadBlueprint('elf'), retreatThresholds: [{ kind: 'hpFraction', atMost: 1 }] },
      3,
    )
    retreated.hero.focus = 30
    stepUntilCombat(retreated, defs)
    const retreatCombat = retreated.combat
    if (retreatCombat === null) throw new Error('elf retreat is missing')
    retreatCombat.hero.nextReadyMs = 1_000_000
    const retreatEnemy = retreatCombat.enemies[0]
    if (retreatEnemy !== undefined) retreatEnemy.nextReadyMs = 1_000_000
    const focusInFight = retreatCombat.hero.raceState.focus
    retreated.rng = lowRoll()
    stepExpedition(retreated, defs)

    const defeated = createExpedition({ ...roadBlueprint('elf'), retreatThresholds: [] }, 4)
    defeated.hero.focus = 30
    stepUntilCombat(defeated, defs)
    if (defeated.combat === null) throw new Error('elf defeat is missing')
    defeated.combat.outcome = 'defeat'
    stepExpedition(defeated, defs)

    const reborn = createExpedition(roadBlueprint('elf'), 5)
    reborn.hero.focus = 30
    resetFocus(reborn, 'reincarnation')

    console.log('[sim]', 'elf focus', {
      afterHit,
      hitLine,
      afterMiss,
      afterLoss,
      lossLine,
      afterIgnored,
      quietFloor: quietHit?.type === 'damage' ? quietHit.damageFloor : null,
      fullMultiplier: fullFocus?.type === 'resource' ? fullFocus.multiplier : null,
      factor,
      healFloor: heal?.type === 'heal' ? heal.rollFloor : null,
      raisedFloor: raisedHit?.type === 'damage' ? raisedHit.damageFloor : null,
      carriedIn,
      between,
      carriedAgain,
      duringWalk,
      focusInFight,
    })

    expect(afterHit).toBe(10)
    expect(hitLine).toBe('At 1.720s, Elf gains 10 Focus (10/100).')
    expect(afterMiss).toBe(10)
    expect(afterLoss).toBe(8)
    expect(lossLine).toBe('At 4.000s, Elf loses 2 Focus (8/100).')
    expect(afterIgnored).toBe(8)
    expect(focusRollFloorBonus(0)).toBe(0)
    expect(focusRollFloorBonus(100)).toBeCloseTo(0.1, 10)
    expect(focusResourceMultiplier(0)).toBe(1)
    expect(focusResourceMultiplier(100)).toBeCloseTo(1.1, 10)
    expect(quietHit?.type === 'damage' ? quietHit.damageFloor : null).toBe(consistencyBounds(0).floor)
    expect(zeroFocus?.type === 'resource' ? zeroFocus.multiplier : null).toBe(factor)
    expect(fullFocus?.type === 'resource' ? fullFocus.multiplier : null).toBeCloseTo(factor * 1.1, 10)
    expect(heal?.type === 'heal' ? heal.rollFloor : null).toBeCloseTo(HEALING_ROLL_FLOOR + 0.1, 10)
    expect(raisedHit?.type === 'damage' ? raisedHit.damageFloor : null).toBeCloseTo(consistencyBounds(0).floor + 0.1, 10)
    expect(quietFocus).toBe(10)
    expect(carriedIn).toBe(30)
    expect(between).toBe(30)
    expect(carriedAgain).toBe(30)
    expect(duringWalk).toBe(30)
    expect(cleared.hero.focus).toBe(0)
    expect(cleared.outcome).toBe('returned')
    expect(focusInFight).toBe(30)
    expect(retreated.hero.focus).toBe(0)
    expect(retreated.returning).toBe(true)
    expect(defeated.hero.focus).toBe(0)
    expect(defeated.outcome).toBe('defeat')
    expect(reborn.hero.focus).toBe(0)
    expect(() => resetFocus(reborn, 'nope' as 'return')).toThrow(/reason/)
  })

  it('gains Beastfolk Ferocity from victories and clears it when the expedition ends', () => {
    function finish(hp: number, elite: boolean, summon: boolean, progress = 0): CombatState {
      const built = open({ race: 'beastfolk', ferocityProgress: progress })
      const enemy = built.state.enemies[0]
      if (enemy === undefined) throw new Error('beastfolk enemy is missing')
      built.state.hero.maxHp = 100
      built.state.hero.hp = hp
      enemy.elite = elite
      enemy.summon = summon
      built.state.outcome = 'victory'
      const end = beastfolkRace.encounterEnd
      if (end === undefined) throw new Error('beastfolk encounterEnd is missing')
      end(built.state, 12_000)
      return built.state
    }

    const normal = finish(100, false, false)
    const elite = finish(100, true, false)
    const low = finish(40, false, false)
    const above = finish(41, false, false)
    const both = finish(40, true, false)
    const capped = finish(100, true, false, 6)
    const summon = finish(100, true, true)
    const normalLine = raceLines(normal).at(-1)

    const outgoing = beastfolkRace.outgoingModifiers
    if (outgoing === undefined) throw new Error('beastfolk outgoingModifiers is missing')
    const tier0 = open({ race: 'beastfolk', ferocityProgress: 0 })
    const tier2 = open({ race: 'beastfolk', ferocityProgress: 4, skill: mend })
    const furyId = tier2.state.hero.classResourceId
    const furyAtStart = tier2.state.hero.classResource
    const noRaceHeal = open({ skill: mend })
    stepUntil(tier0.state, tier0.defs, (state) => state.log.some((event) => event.type === 'heal') || state.log.some((event) => event.type === 'action'))
    const tier0WithHeal = open({ race: 'beastfolk', ferocityProgress: 0, skill: mend })
    stepUntil(tier0WithHeal.state, tier0WithHeal.defs, (state) => state.log.some((event) => event.type === 'heal'))
    stepUntil(tier2.state, tier2.defs, (state) => state.log.some((event) => event.type === 'heal'))
    stepUntil(noRaceHeal.state, noRaceHeal.defs, (state) => state.log.some((event) => event.type === 'heal'))
    const tier0Heal = tier0WithHeal.state.log.find((event) => event.type === 'heal')
    const tier2Heal = tier2.state.log.find((event) => event.type === 'heal')
    const plainHeal = noRaceHeal.state.log.find((event) => event.type === 'heal')

    const defs = roadDefs({ maxHp: 1, actionTime: 30 })
    const won = createExpedition(roadBlueprint('beastfolk'), 1)
    stepUntilCombat(won, defs)
    runFight(won, defs)
    const afterWin = won.ferocityProgress
    const winHp = won.hero.hp
    const winMax = won.hero.maxHp
    stepUntilCombat(won, defs)
    const nextProgress = won.combat?.hero.raceState.ferocity
    const nextLine = won.combat === null ? '' : raceLines(won.combat)[0]

    const arrived = createExpedition(roadBlueprint('beastfolk'), 2)
    arrived.ferocityProgress = 2
    returnToTown(arrived)
    stepFor(arrived, defs, 1_000)
    const duringWalk = arrived.ferocityProgress
    stepFor(arrived, defs, TRAVEL_GAP_MS - 1_000)

    const retreated = createExpedition(
      { ...roadBlueprint('beastfolk'), retreatThresholds: [{ kind: 'hpFraction', atMost: 1 }] },
      3,
    )
    retreated.ferocityProgress = 2
    stepUntilCombat(retreated, defs)
    const retreatCombat = retreated.combat
    if (retreatCombat === null) throw new Error('beastfolk retreat is missing')
    retreatCombat.hero.nextReadyMs = 1_000_000
    const retreatEnemy = retreatCombat.enemies[0]
    if (retreatEnemy !== undefined) retreatEnemy.nextReadyMs = 1_000_000
    const progressInFight = retreatCombat.hero.raceState.ferocity
    retreated.rng = lowRoll()
    stepExpedition(retreated, defs)

    const defeated = createExpedition({ ...roadBlueprint('beastfolk'), retreatThresholds: [] }, 4)
    defeated.ferocityProgress = 2
    stepUntilCombat(defeated, defs)
    if (defeated.combat === null) throw new Error('beastfolk defeat is missing')
    defeated.combat.outcome = 'defeat'
    stepExpedition(defeated, defs)

    const reborn = createExpedition(roadBlueprint('beastfolk'), 5)
    reborn.ferocityProgress = 4
    resetFerocity(reborn, 'reincarnation')

    console.log('[sim]', 'beastfolk ferocity', {
      normal: normal.hero.raceState.ferocity,
      normalLine,
      elite: elite.hero.raceState.ferocity,
      low: low.hero.raceState.ferocity,
      above: above.hero.raceState.ferocity,
      both: both.hero.raceState.ferocity,
      capped: capped.hero.raceState.ferocity,
      summon: summon.hero.raceState.ferocity,
      tier0Incoming: tier0.state.hero.incomingMultipliers,
      tier2Incoming: tier2.state.hero.incomingMultipliers,
      tier0Outgoing: outgoing(tier0.state, { school: 'physical', skill: null }),
      tier2Outgoing: outgoing(tier2.state, { school: 'healing', skill: null }),
      afterWin,
      winHp,
      winMax,
      nextProgress,
      nextLine,
      duringWalk,
      progressInFight,
    })

    expect(normal.hero.raceState.ferocity).toBe(1)
    expect(normalLine).toBe('At 12.000s, Beastfolk Ferocity progress becomes 1 (tier 0).')
    expect(elite.hero.raceState.ferocity).toBe(2)
    expect(low.hero.raceState.ferocity).toBe(2)
    expect(above.hero.raceState.ferocity).toBe(1)
    expect(both.hero.raceState.ferocity).toBe(3)
    expect(capped.hero.raceState.ferocity).toBe(6)
    expect(summon.hero.raceState.ferocity).toBe(1)
    expect(ferocityTier(0)).toBe(0)
    expect(ferocityTier(1)).toBe(0)
    expect(ferocityTier(2)).toBe(1)
    expect(ferocityTier(3)).toBe(1)
    expect(ferocityTier(4)).toBe(2)
    expect(ferocityTier(5)).toBe(2)
    expect(ferocityTier(6)).toBe(3)
    expect(furyId).toBe('fury')
    expect(furyAtStart).toBe(0)
    expect(tier2.state.hero.raceState.ferocity).toBe(4)
    expect(outgoing(tier0.state, { school: 'physical', skill: null })).toBe(1)
    expect(outgoing(tier0.state, { school: 'magical', skill: null })).toBe(1)
    expect(outgoing(tier0.state, { school: 'healing', skill: null })).toBe(1)
    expect(tier0.state.hero.incomingMultipliers).toEqual([])
    expect(outgoing(tier2.state, { school: 'physical', skill: null })).toBeCloseTo(1.1, 10)
    expect(outgoing(tier2.state, { school: 'magical', skill: null })).toBeCloseTo(1.1, 10)
    expect(outgoing(tier2.state, { school: 'healing', skill: null })).toBeCloseTo(1.1, 10)
    expect(tier2.state.hero.incomingMultipliers[0]).toBeCloseTo(1 - 0.03 * 2, 10)
    expect(tier0Heal?.type === 'heal' ? tier0Heal.outgoingModifier : null).toBe(1)
    expect(plainHeal?.type === 'heal' ? plainHeal.outgoingModifier : null).toBe(1)
    expect(tier2Heal?.type === 'heal' ? tier2Heal.outgoingModifier : null).toBeCloseTo(1.1, 10)
    expect(afterWin).toBe(1)
    expect(winHp * 1000 > winMax * 400).toBe(true)
    expect(nextProgress).toBe(1)
    expect(nextLine).toBe('At 0.000s, Beastfolk Ferocity progress is 1 (tier 0).')
    expect(duringWalk).toBe(2)
    expect(arrived.ferocityProgress).toBe(0)
    expect(arrived.outcome).toBe('returned')
    expect(progressInFight).toBe(2)
    expect(retreated.ferocityProgress).toBe(0)
    expect(retreated.returning).toBe(true)
    expect(defeated.ferocityProgress).toBe(0)
    expect(defeated.outcome).toBe('defeat')
    expect(reborn.ferocityProgress).toBe(0)
    expect(() => resetFerocity(reborn, 'nope' as 'return')).toThrow(/reason/)
  })

  it('readies Undead Stillness after three clean actions, resets on a hit, and spends it once', () => {
    const built = open({ race: 'undead', enemyAction: 100, enemyHp: 100_000 })
    const resolve = undeadRace.actionResolved
    const chosen = undeadRace.actionChosen
    const hurt = undeadRace.damageTaken
    if (resolve === undefined || chosen === undefined || hurt === undefined) throw new Error('undead hooks are missing')
    const startLine = raceLines(built.state)[0]
    resolve(built.state, { kind: 'basicAttack', hit: false }, 1)
    const afterMiss = built.state.hero.raceState.stillness
    resolve(built.state, { kind: 'basicAttack', hit: true }, 2)
    resolve(built.state, { kind: 'skill', skill: mend }, 3)
    resolve(built.state, { kind: 'basicAttack', hit: true }, 4)
    const ready = built.state.hero.raceState.stillness
    const readyLine = raceLines(built.state).some((line) => line.includes('Undead Stillness is ready.'))

    const reset = open({ race: 'undead' })
    resolve(reset.state, { kind: 'basicAttack', hit: true }, 1)
    resolve(reset.state, { kind: 'basicAttack', hit: true }, 2)
    resolve(reset.state, { kind: 'basicAttack', hit: true }, 3)
    hurt(reset.state, { hpLost: 4, hpBefore: 100, kind: 'statusTick', timeMs: 4, school: 'physical' })
    const afterTick = reset.state.hero.raceState.stillness
    hurt(reset.state, { hpLost: 4, hpBefore: 100, kind: 'hit', timeMs: 5, school: 'physical' })
    const afterHit = reset.state.hero.raceState.stillness

    const base = built.state.hero.accuracy
    chosen(built.state, { kind: 'skill', skill: mend }, 5)
    const healAccuracy = built.state.hero.accuracy
    stepUntil(
      built.state,
      built.defs,
      (state) => state.log.filter((event) => event.type === 'hitRoll' && event.actorId === state.hero.id).length >= 2,
    )
    const rolls = built.state.log.filter((event) => event.type === 'hitRoll' && event.actorId === built.state.hero.id)
    const first = rolls[0]
    const second = rolls[1]
    console.log('[sim]', 'undead stillness', {
      startLine,
      afterMiss,
      ready,
      readyLine,
      afterTick,
      afterHit,
      healAccuracy,
      first: first?.type === 'hitRoll' ? first.accuracy : null,
      second: second?.type === 'hitRoll' ? second.accuracy : null,
      accuracyNow: built.state.hero.accuracy,
    })
    expect(startLine).toBe('At 0.000s, Undead Stillness progress is 0 of 3.')
    expect(afterMiss).toBe(0)
    expect(ready).toBe(3)
    expect(readyLine).toBe(true)
    expect(afterTick).toBe(3)
    expect(afterHit).toBe(0)
    expect(healAccuracy).toBe(base)
    expect(first?.type === 'hitRoll' ? first.accuracy : null).toBe(base + 20)
    expect(second?.type === 'hitRoll' ? second.accuracy : null).toBe(base)
    expect(built.state.hero.accuracy).toBe(base)
    expect(raceLines(built.state).some((line) => line.includes('Undead spends Stillness.'))).toBe(true)
  })

  it('keeps Focus inside 0–100 when a combat basic attack or skill resolves', () => {
    const basic = open({ race: 'elf', enemyAction: 100, enemyHp: 100_000 })
    basic.state.rng = lowRoll()
    stepUntil(
      basic.state,
      basic.defs,
      (state) => state.log.some((event) => event.type === 'damage' && event.actorId === state.hero.id),
    )
    const capped = open({ race: 'elf', startingFocus: 95, enemyAction: 100, enemyHp: 100_000 })
    capped.state.rng = lowRoll()
    stepUntil(
      capped.state,
      capped.defs,
      (state) => state.log.some((event) => event.type === 'damage' && event.actorId === state.hero.id),
    )
    const emptied = open({ race: 'elf', startingFocus: 1 })
    emptied.state.hero.maxHp = 100
    const hurt = elfRace.damageTaken
    if (hurt === undefined) throw new Error('elf damageTaken is missing')
    hurt(emptied.state, { hpLost: 1, hpBefore: 100, kind: 'hit', timeMs: 1, school: 'physical' })
    console.log('[sim]', 'elf focus bounds', {
      basic: basic.state.hero.raceState.focus,
      capped: capped.state.hero.raceState.focus,
      emptied: emptied.state.hero.raceState.focus,
    })
    expect(basic.state.hero.raceState.focus).toBe(10)
    expect(capped.state.hero.raceState.focus).toBe(100)
    expect(emptied.state.hero.raceState.focus).toBe(0)
  })

  it('spends Stillness damage bonuses on one hit and does not carry Stillness', () => {
    let spent: CombatState | null = null
    let spentDefs: GameDefs | null = null
    for (let seed = 1; seed < 40; seed += 1) {
      const built = open({ race: 'undead', enemyAction: 100, enemyHp: 100_000 }, seed)
      const resolve = undeadRace.actionResolved
      if (resolve === undefined) throw new Error('undead actionResolved is missing')
      resolve(built.state, { kind: 'basicAttack', hit: true }, 1)
      resolve(built.state, { kind: 'basicAttack', hit: true }, 2)
      resolve(built.state, { kind: 'basicAttack', hit: true }, 3)
      stepUntil(built.state, built.defs, (state) =>
        state.log.some((event) => event.type === 'race' && event.text.includes('spends Stillness')),
      )
      const spend = built.state.log.find((event) => event.type === 'race' && event.text.includes('spends Stillness'))
      const damage = built.state.log.find(
        (event) => event.type === 'damage' && event.actorId === built.state.hero.id && event.timeMs === spend?.timeMs,
      )
      if (damage !== undefined) {
        spent = built.state
        spentDefs = built.defs
        break
      }
    }
    if (spent === null || spentDefs === null) throw new Error('no stillness hit')
    const baseFloor = consistencyBounds(0).floor
    const hit = spent.log.find((event) => event.type === 'damage' && event.actorId === spent.hero.id)
    if (hit?.type !== 'damage') throw new Error('stillness damage is missing')
    const laterStart = spent.log.filter((event) => event.type === 'damage' && event.actorId === spent.hero.id).length
    stepUntil(spent, spentDefs, (state) => {
      return state.log.filter((event) => event.type === 'damage' && event.actorId === state.hero.id).length > laterStart
    })
    const damages = spent.log.filter((event) => event.type === 'damage' && event.actorId === spent?.hero.id)
    const later = damages[1]
    console.log('[sim]', 'stillness damage', {
      floor: hit.damageFloor,
      afterDefense: hit.afterDefense,
      afterIncoming: hit.afterIncoming,
      laterFloor: later?.type === 'damage' ? later.damageFloor : null,
      stillness: spent.hero.raceState.stillness,
    })
    expect(hit.damageFloor).toBeCloseTo(baseFloor + 0.1, 10)
    expect(hit.afterIncoming).toBeCloseTo(hit.afterDefense * hit.incomingModifier * 1.1, 8)
    if (later?.type !== 'damage') throw new Error('later stillness hit is missing')
    expect(later.damageFloor).toBeCloseTo(baseFloor, 10)
    expect(later.afterIncoming).toBeCloseTo(later.afterDefense * later.incomingModifier, 8)

    const defs = roadDefs({ maxHp: 1, actionTime: 30 })
    const road = createExpedition(roadBlueprint('undead'), 1)
    stepUntilCombat(road, defs)
    if (road.combat === null) throw new Error('undead fight is missing')
    road.combat.hero.raceState.stillness = 3
    road.combat.outcome = 'victory'
    stepExpedition(road, defs)
    stepUntilCombat(road, defs)
    console.log('[sim]', 'stillness carry', { next: road.combat?.hero.raceState.stillness })
    expect(road.combat?.hero.raceState.stillness).toBe(0)
    expect(road.hero).not.toHaveProperty('stillness')
  })

  it('uses only class hooks and leaves branch systems off', () => {
    const modules = [humanRace, elfRace, beastfolkRace, undeadRace]
    for (const race of modules) {
      for (const key of Object.keys(race)) expect(CLASS_HOOK_NAMES).toContain(key)
    }
    const road = createExpedition(roadBlueprint('human'), 1)
    console.log('[sim]', 'race hooks', modules.map((race) => Object.keys(race)))
    expect(road.hero).not.toHaveProperty('mastery')
    expect(road).not.toHaveProperty('soulFragments')
  })
})
