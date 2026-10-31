import { describe, expect, it } from 'vitest'

import { createCombat, stepCombat } from '../sim/combat.ts'
import {
  AIMED_SHOT_COEFFICIENT,
  AIMED_SHOT_ID,
  DEADEYE_CRIT,
  DEADEYE_ROLL_FLOOR,
  EFFICIENT_QUIVER_CAPACITY,
  NODE_AIMED_SHOT,
  NODE_DEADEYE,
  NODE_EFFICIENT_QUIVER,
  NODE_FLAME_ARROW,
  NODE_HUNTERS_MARK,
  NODE_PATIENT_SHOT,
  NODE_PIERCING_ARROW,
  NODE_PRESS_THE_TRAIL,
  NODE_REINFORCED_SNARE,
  NODE_SNARE_TRAP,
  NODE_STEADY_HANDS,
  NODE_TRAIL_SENSE,
  NODE_TRAILBLAZER,
  NODE_TRAPPER,
  NODE_VOLLEY,
  PATIENT_DAMAGE,
  PATIENT_QUIET_MS,
  PIERCING_ARROW_ID,
  PRESS_ESCAPE_PER_STACK,
  PRESS_READINESS_PER_STACK,
  QUIVER_CAPACITY,
  REINFORCED_DELAY_MS,
  REINFORCED_POTENCY,
  SNARE_TRAP_ID,
  STEADY_HANDS_CRIT,
  STEADY_HANDS_FLOOR,
  TRAIL_SENSE_FACTOR,
  TRAILBLAZER_DAMAGE_PER_STACK,
  TRAILBLAZER_TRAVEL_PER_STACK,
  READINESS_TRAVEL_PER_SECOND,
  travelReadinessFactor,
} from '../sim/classes/ranger.ts'
import {
  createExpedition,
  RARE_NODE_CHANCE_PER_STACK,
  resetFocus,
  resetMomentum,
  SPLINTERED_ROAD_ID,
  stepExpedition,
  type ExpeditionBlueprint,
  type ExpeditionState,
} from '../sim/expedition.ts'
import { createRng, nextFloat, type RngState } from '../sim/rng.ts'
import { allocateNode, createProgress, grantLegacySkillPoint, setLoadout } from '../sim/progression.ts'
import type { CombatSetup, CombatState, EnemyDef, GameDefs, SkillDef } from '../sim/types.ts'

import { skills } from './skills.ts'
import { statuses } from './statuses.ts'
import { rangerWeb } from './webs/ranger.ts'

const ITEM_LEVEL = 20
const QUALITY = 1
const HUMAN = { strength: 10, vitality: 10, agility: 10, intellect: 10, spirit: 10 }

function armor(slot: 'head' | 'chest' | 'hands' | 'feet') {
  return { id: `ref-medium-${slot}`, slot, category: 'medium' as const, itemLevel: ITEM_LEVEL, quality: QUALITY }
}

function rangerSetup(options?: {
  nodes?: readonly string[]
  equipped?: readonly string[]
  rows?: readonly { skillId: string }[]
  startingResource?: number
  specialAmmo?: number
  agility?: number
  spirit?: number
  intellect?: number
  expeditionMomentum?: number
  carriedSupplyCount?: number
  specialArrowCount?: number
  trapperCooldown?: number
  enemies?: CombatSetup['enemies']
}): CombatSetup {
  return {
    hero: {
      id: 'ref-ranger',
      name: 'Ranger',
      level: 20,
      classId: 'ranger',
      attributes: {
        strength: 22,
        vitality: 18,
        agility: options?.agility ?? 28,
        intellect: options?.intellect ?? 10,
        spirit: options?.spirit ?? 10,
      },
      gear: {
        mainHand: { id: 'weapon-bow', kind: 'bow', itemLevel: ITEM_LEVEL, quality: QUALITY },
        offHand: { id: 'quiver', kind: 'quiver', itemLevel: ITEM_LEVEL, quality: QUALITY },
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
      specialAmmo: options?.specialAmmo,
      allocatedNodeIds: options?.nodes,
      expeditionMomentum: options?.expeditionMomentum,
      carriedSupplyCount: options?.carriedSupplyCount,
      specialArrowCount: options?.specialArrowCount,
      trapperCooldown: options?.trapperCooldown,
    },
    enemies: options?.enemies ?? [{ defId: 'dummy', slot: 0 }],
  }
}

function dummy(overrides: EnemyDef['overrides'] = {}, id = 'dummy', name = 'Dummy'): EnemyDef {
  return { id, name, level: 20, archetype: 'standard', school: 'physical', overrides }
}

function defsFor(enemy: EnemyDef = dummy(), skillBook: GameDefs['skills'] = skills): GameDefs {
  return { enemies: { [enemy.id]: enemy }, skills: skillBook, statuses }
}

function open(options?: Parameters<typeof rangerSetup>[0] & { enemy?: EnemyDef['overrides']; seed?: number }) {
  const enemy = dummy({ maxHp: 1_000_000, armor: 0, evasion: 0, actionTime: 60, power: 1, ...options?.enemy })
  const defs = defsFor(enemy)
  const state = createCombat(
    rangerSetup({ ...options, enemies: [{ defId: enemy.id, slot: 0, revealed: false }] }),
    defs,
    options?.seed ?? 1,
  )
  return { state, defs, enemy }
}

function until(state: CombatState, defs: GameDefs, seen: (state: CombatState) => boolean): void {
  let steps = 0
  while (state.outcome === 'ongoing' && !seen(state)) {
    stepCombat(state, defs)
    steps += 1
    if (steps > 20_000) throw new Error('combat did not reach the expected event')
  }
}

function skillActions(state: CombatState, skillId: string) {
  return state.log.filter((event) => event.type === 'action' && event.skillId === skillId)
}

function damagesAt(state: CombatState, timeMs: number) {
  return state.log.filter((event) => event.type === 'damage' && event.timeMs === timeMs && event.actorId === state.hero.id)
}

function useSkill(state: CombatState, defs: GameDefs, skillId: string, readiness = 100): void {
  const before = skillActions(state, skillId).length
  state.hero.priorityRows = [{ skillId }]
  delete state.hero.cooldowns[skillId]
  state.hero.classResource = readiness
  state.hero.nextReadyMs = state.timeMs + 10
  let steps = 0
  while (state.outcome === 'ongoing' && skillActions(state, skillId).length <= before) {
    stepCombat(state, defs)
    steps += 1
    if (steps > 500) throw new Error(`did not use ${skillId}`)
  }
}

function authored(id: string): SkillDef {
  const skill = skills[id]
  if (skill === undefined) throw new Error(`missing skill ${id}`)
  return skill
}

function nodeId(name: string): string {
  const node = rangerWeb.nodes.find((entry) => entry.name === name)
  if (node === undefined) throw new Error(`missing ranger node ${name}`)
  return node.id
}

function learned(names: readonly string[]) {
  let progress = createProgress('human', HUMAN)
  for (let index = 0; index < names.length; index += 1) progress = grantLegacySkillPoint(progress)
  for (const name of names) progress = allocateNode(progress, rangerWeb, nodeId(name))
  return progress
}

function heroDamage(state: CombatState) {
  const action = state.log.filter((event) => event.type === 'action' && event.actorId === state.hero.id).at(-1)
  if (action === undefined || action.type !== 'action') throw new Error('missing hero action')
  const hit = damagesAt(state, action.timeMs)[0]
  if (hit === undefined || hit.type !== 'damage') throw new Error('missing hero damage')
  return hit
}

function rngBefore(match: (roll: number) => boolean): RngState {
  for (let seed = 1; seed < 5000; seed += 1) {
    const rng = createRng(seed)
    const saved = { a: rng.a, b: rng.b, c: rng.c, d: rng.d }
    if (match(nextFloat(rng))) return saved
  }
  throw new Error('no rng seed matched the roll')
}

function road(options?: {
  nodes?: readonly string[]
  spirit?: number
  agility?: number
  ammo?: number
  gap?: number
  equipped?: readonly string[]
  rows?: readonly { skillId: string }[]
  enemy?: EnemyDef['overrides']
  retreat?: boolean
}): { state: ExpeditionState; defs: GameDefs } {
  const enemy = dummy({ maxHp: 1, armor: 0, evasion: 0, actionTime: 30, power: 1, ...options?.enemy })
  enemy.level = 1
  enemy.levelMin = 1
  enemy.levelMax = 20
  const opening = [{ id: 'fight-1', enemies: [{ defId: enemy.id, slot: 0, level: 1 }] }]
  const blueprint: ExpeditionBlueprint = {
    id: SPLINTERED_ROAD_ID,
    opening: [...opening, { id: 'fight-2', enemies: [{ defId: enemy.id, slot: 0, level: 1 }] }, { id: 'fight-3', enemies: [{ defId: enemy.id, slot: 0, level: 1 }] }, { id: 'fight-4', enemies: [{ defId: enemy.id, slot: 0, level: 1 }] }],
    draw: opening,
    travelGapMs: options?.gap ?? 5_000,
    retreatThresholds: options?.retreat === true ? [{ kind: 'hpFraction', atMost: 0.4 }] : [],
    hero: {
      ...rangerSetup({
        nodes: options?.nodes,
        spirit: options?.spirit,
        agility: options?.agility,
        specialAmmo: options?.ammo,
        equipped: options?.equipped,
        rows: options?.rows,
      }).hero,
      level: 20,
    },
  }
  return { state: createExpedition(blueprint, 1), defs: defsFor(enemy) }
}

function stepTravel(state: ExpeditionState, defs: GameDefs, ms: number): void {
  const target = state.travelMs + ms
  let guard = 0
  while (state.phase === 'travel' && state.travelMs < target && state.outcome === 'ongoing') {
    stepExpedition(state, defs)
    guard += 1
    if (guard > 20_000) throw new Error('travel did not advance')
  }
}

describe('ranger nodes', () => {
  it('raises Aimed Shot to 200% Physical Power at 80 Readiness', () => {
    expect(nodeId('Aimed Shot')).toBe(NODE_AIMED_SHOT)
    expect(authored(AIMED_SHOT_ID).effects[0]).toMatchObject({ coefficient: 1.8 })
    const plain = open({ equipped: [AIMED_SHOT_ID], rows: [{ skillId: AIMED_SHOT_ID }], startingResource: 100 })
    useSkill(plain.state, plain.defs, AIMED_SHOT_ID, 100)
    const low = open({
      nodes: [NODE_AIMED_SHOT],
      equipped: [AIMED_SHOT_ID],
      rows: [{ skillId: AIMED_SHOT_ID }],
    })
    useSkill(low.state, low.defs, AIMED_SHOT_ID, 79)
    const high = open({
      nodes: [NODE_AIMED_SHOT],
      equipped: [AIMED_SHOT_ID],
      rows: [{ skillId: AIMED_SHOT_ID }],
    })
    useSkill(high.state, high.defs, AIMED_SHOT_ID, 80)
    const plainHit = heroDamage(plain.state)
    const lowHit = heroDamage(low.state)
    const highHit = heroDamage(high.state)
    console.log('[sim]', 'aimed shot', {
      plain: plainHit.coefficient,
      below: lowHit.coefficient,
      at80: highHit.coefficient,
    })
    expect(plainHit.coefficient).toBe(1.8)
    expect(lowHit.coefficient).toBe(1.8)
    expect(highHit.coefficient).toBe(AIMED_SHOT_COEFFICIENT)
    expect(high.state.hero.classResource).toBe(40)
  })

  it('adds 10 percentage points of minimum damage and critical chance to aimed skills at 75 Readiness', () => {
    expect(nodeId('Steady Hands')).toBe(NODE_STEADY_HANDS)
    const plain = open({ equipped: [AIMED_SHOT_ID], rows: [{ skillId: AIMED_SHOT_ID }] })
    useSkill(plain.state, plain.defs, AIMED_SHOT_ID, 100)
    const below = open({ nodes: [NODE_STEADY_HANDS], equipped: [AIMED_SHOT_ID], rows: [{ skillId: AIMED_SHOT_ID }] })
    useSkill(below.state, below.defs, AIMED_SHOT_ID, 74)
    const aimed = open({ nodes: [NODE_STEADY_HANDS], equipped: [AIMED_SHOT_ID], rows: [{ skillId: AIMED_SHOT_ID }] })
    useSkill(aimed.state, aimed.defs, AIMED_SHOT_ID, 75)
    const piercing = open({
      nodes: [NODE_STEADY_HANDS],
      equipped: [PIERCING_ARROW_ID],
      rows: [{ skillId: PIERCING_ARROW_ID }],
    })
    useSkill(piercing.state, piercing.defs, PIERCING_ARROW_ID, 75)
    const volley = open({ nodes: [NODE_STEADY_HANDS], equipped: ['volley'], rows: [{ skillId: 'volley' }] })
    useSkill(volley.state, volley.defs, 'volley', 100)
    const plainHit = heroDamage(plain.state)
    const belowHit = heroDamage(below.state)
    const aimedHit = heroDamage(aimed.state)
    const piercingHit = heroDamage(piercing.state)
    const volleyHit = heroDamage(volley.state)
    console.log('[sim]', 'steady hands', {
      plainFloor: plainHit.damageFloor,
      plainCrit: plainHit.critChance,
      at75Floor: aimedHit.damageFloor,
      at75Crit: aimedHit.critChance,
      piercingFloor: piercingHit.damageFloor,
      volleyFloor: volleyHit.damageFloor,
    })
    expect(belowHit.damageFloor).toBe(plainHit.damageFloor)
    expect(belowHit.critChance).toBe(plainHit.critChance)
    expect(aimedHit.damageFloor).toBeCloseTo(plainHit.damageFloor + STEADY_HANDS_FLOOR, 10)
    expect(aimedHit.critChance).toBeCloseTo(plainHit.critChance + STEADY_HANDS_CRIT, 10)
    expect(piercingHit.damageFloor).toBeCloseTo(plainHit.damageFloor + STEADY_HANDS_FLOOR, 10)
    expect(piercingHit.critChance).toBeCloseTo(plainHit.critChance + STEADY_HANDS_CRIT, 10)
    expect(volleyHit.damageFloor).toBe(plainHit.damageFloor)
    expect(volleyHit.critChance).toBe(plainHit.critChance)
    expect(aimed.state.hero.critChance).toBeCloseTo(plain.state.hero.critChance, 10)
  })

  it('unlocks Piercing Arrow without changing its damage or armor penetration', () => {
    expect(nodeId('Piercing Arrow')).toBe(NODE_PIERCING_ARROW)
    const fresh = createProgress('human', HUMAN)
    expect(fresh.learnedSkillIds).not.toContain(PIERCING_ARROW_ID)
    const progress = learned(['Aimed Shot', 'Steady Hands', 'Piercing Arrow'])
    expect(progress.learnedSkillIds).toContain(PIERCING_ARROW_ID)
    expect(authored(PIERCING_ARROW_ID).effects[0]).toMatchObject({ coefficient: 1.3, armorPenetrationBonus: 0.3 })
    const plain = open({ equipped: [PIERCING_ARROW_ID], rows: [{ skillId: PIERCING_ARROW_ID }] })
    useSkill(plain.state, plain.defs, PIERCING_ARROW_ID, 20)
    const fight = open({
      nodes: [NODE_PIERCING_ARROW],
      equipped: [PIERCING_ARROW_ID],
      rows: [{ skillId: PIERCING_ARROW_ID }],
    })
    useSkill(fight.state, fight.defs, PIERCING_ARROW_ID, 20)
    const plainHit = heroDamage(plain.state)
    const hit = heroDamage(fight.state)
    expect(hit.coefficient).toBe(plainHit.coefficient)
    expect(hit.coefficient).toBe(1.3)
    expect(hit.penetration).toBe(plainHit.penetration)
    expect(fight.state.hero.classResource).toBe(plain.state.hero.classResource)
  })

  it('gives the next aimed skill +20% damage after 4 quiet seconds and does not stack', () => {
    expect(nodeId('Patient Shot')).toBe(NODE_PATIENT_SHOT)
    const quiet = open({
      nodes: [NODE_PATIENT_SHOT],
      equipped: [AIMED_SHOT_ID],
      rows: [{ skillId: AIMED_SHOT_ID }],
      startingResource: 80,
    })
    quiet.state.hero.nextReadyMs = PATIENT_QUIET_MS
    until(quiet.state, quiet.defs, (state) => skillActions(state, AIMED_SHOT_ID).length > 0)
    const first = heroDamage(quiet.state)
    useSkill(quiet.state, quiet.defs, AIMED_SHOT_ID, 80)
    const second = heroDamage(quiet.state)
    const longer = open({
      nodes: [NODE_PATIENT_SHOT],
      equipped: [AIMED_SHOT_ID],
      rows: [{ skillId: AIMED_SHOT_ID }],
      startingResource: 80,
    })
    longer.state.hero.nextReadyMs = PATIENT_QUIET_MS * 2
    until(longer.state, longer.defs, (state) => skillActions(state, AIMED_SHOT_ID).length > 0)
    const held = heroDamage(longer.state)
    const reset = open({
      nodes: [NODE_PATIENT_SHOT],
      equipped: ['volley', AIMED_SHOT_ID],
      rows: [{ skillId: 'volley' }],
      startingResource: 100,
    })
    reset.state.hero.nextReadyMs = 1000
    until(reset.state, reset.defs, (state) => skillActions(state, 'volley').length > 0)
    reset.state.hero.priorityRows = [{ skillId: AIMED_SHOT_ID }]
    reset.state.hero.classResource = 80
    reset.state.hero.nextReadyMs = PATIENT_QUIET_MS
    until(reset.state, reset.defs, (state) => skillActions(state, AIMED_SHOT_ID).length > 0)
    const afterVolley = heroDamage(reset.state)
    const snare = open({
      nodes: [NODE_PATIENT_SHOT],
      equipped: [SNARE_TRAP_ID, AIMED_SHOT_ID],
      rows: [{ skillId: SNARE_TRAP_ID }],
      startingResource: 100,
    })
    snare.state.hero.nextReadyMs = 2000
    until(snare.state, snare.defs, (state) => skillActions(state, SNARE_TRAP_ID).length > 0)
    snare.state.hero.priorityRows = [{ skillId: AIMED_SHOT_ID }]
    snare.state.hero.classResource = 80
    snare.state.hero.nextReadyMs = PATIENT_QUIET_MS
    until(snare.state, snare.defs, (state) => skillActions(state, AIMED_SHOT_ID).length > 0)
    const afterSnare = heroDamage(snare.state)
    const plain = open({ equipped: [AIMED_SHOT_ID], rows: [{ skillId: AIMED_SHOT_ID }], startingResource: 80 })
    plain.state.hero.nextReadyMs = PATIENT_QUIET_MS
    until(plain.state, plain.defs, (state) => skillActions(state, AIMED_SHOT_ID).length > 0)
    const plainHit = heroDamage(plain.state)
    console.log('[sim]', 'patient shot', {
      quiet: first.outgoingModifier,
      consumed: second.outgoingModifier,
      eightSeconds: held.outgoingModifier,
      afterVolley: afterVolley.outgoingModifier,
      afterSnare: afterSnare.outgoingModifier,
      unallocated: plainHit.outgoingModifier,
    })
    expect(first.coefficient).toBe(1.8)
    expect(first.outgoingModifier).toBeCloseTo(PATIENT_DAMAGE, 10)
    expect(second.outgoingModifier).toBe(1)
    expect(held.outgoingModifier).toBeCloseTo(PATIENT_DAMAGE, 10)
    expect(afterVolley.outgoingModifier).toBe(1)
    expect(afterSnare.outgoingModifier).toBeCloseTo(PATIENT_DAMAGE, 10)
    expect(plainHit.outgoingModifier).toBe(1)
  })

  it('at 100 Readiness spends all of it, floors the roll at 95%, and adds 25 critical chance', () => {
    expect(nodeId('Deadeye')).toBe(NODE_DEADEYE)
    const plain = open({ equipped: [AIMED_SHOT_ID], rows: [{ skillId: AIMED_SHOT_ID }] })
    useSkill(plain.state, plain.defs, AIMED_SHOT_ID, 100)
    const short = open({ nodes: [NODE_DEADEYE], equipped: [AIMED_SHOT_ID], rows: [{ skillId: AIMED_SHOT_ID }] })
    useSkill(short.state, short.defs, AIMED_SHOT_ID, 99)
    const full = open({ nodes: [NODE_DEADEYE], equipped: [AIMED_SHOT_ID], rows: [{ skillId: AIMED_SHOT_ID }] })
    useSkill(full.state, full.defs, AIMED_SHOT_ID, 100)
    const piercing = open({
      nodes: [NODE_DEADEYE],
      equipped: [PIERCING_ARROW_ID],
      rows: [{ skillId: PIERCING_ARROW_ID }],
    })
    useSkill(piercing.state, piercing.defs, PIERCING_ARROW_ID, 100)
    const plainHit = heroDamage(plain.state)
    const shortHit = heroDamage(short.state)
    const fullHit = heroDamage(full.state)
    const piercingHit = heroDamage(piercing.state)
    const payment = full.state.log.filter((event) => event.type === 'resource' && event.reason === 'payment').at(-1)
    console.log('[sim]', 'deadeye', {
      plainFloor: plainHit.damageFloor,
      fullFloor: fullHit.damageFloor,
      ceiling: fullHit.damageCeiling,
      crit: fullHit.critChance,
      readiness: full.state.hero.classResource,
      piercingReadiness: piercing.state.hero.classResource,
    })
    expect(shortHit.damageFloor).toBe(plainHit.damageFloor)
    expect(shortHit.critChance).toBe(plainHit.critChance)
    expect(short.state.hero.classResource).toBe(59)
    expect(fullHit.coefficient).toBe(1.8)
    expect(fullHit.damageFloor).toBe(DEADEYE_ROLL_FLOOR)
    expect(fullHit.damageCeiling).toBe(1)
    expect(fullHit.consistencyRoll).toBeGreaterThanOrEqual(DEADEYE_ROLL_FLOOR)
    expect(fullHit.consistencyRoll).toBeLessThan(1)
    expect(fullHit.critChance).toBeCloseTo(plainHit.critChance + DEADEYE_CRIT, 10)
    expect(full.state.hero.classResource).toBe(0)
    expect(payment).toMatchObject({ type: 'resource', base: 100, after: 0 })
    expect(piercingHit.damageFloor).toBe(DEADEYE_ROLL_FLOOR)
    expect(piercing.state.hero.classResource).toBe(0)
    expect(full.state.hero.critChance).toBeCloseTo(plain.state.hero.critChance, 10)
  })

  it('keeps Deadeye at a 95% floor below 100% when Steady Hands is also allocated', () => {
    const fight = open({
      nodes: [NODE_STEADY_HANDS, NODE_DEADEYE],
      equipped: [AIMED_SHOT_ID],
      rows: [{ skillId: AIMED_SHOT_ID }],
    })
    useSkill(fight.state, fight.defs, AIMED_SHOT_ID, 100)
    const hit = heroDamage(fight.state)
    console.log('[sim]', 'deadeye with steady hands', {
      floor: hit.damageFloor,
      ceiling: hit.damageCeiling,
      roll: hit.consistencyRoll,
      crit: hit.critChance,
    })
    expect(hit.damageFloor).toBe(DEADEYE_ROLL_FLOOR)
    expect(hit.damageFloor).toBeLessThan(1)
    expect(hit.consistencyRoll).toBeGreaterThanOrEqual(DEADEYE_ROLL_FLOOR)
    expect(hit.consistencyRoll).toBeLessThan(1)
  })

  it('unlocks Snare Trap without adding potency or a resist delay', () => {
    expect(nodeId('Snare Trap')).toBe(NODE_SNARE_TRAP)
    const fresh = createProgress('human', HUMAN)
    expect(fresh.learnedSkillIds).not.toContain(SNARE_TRAP_ID)
    const progress = learned(['Snare Trap'])
    expect(progress.learnedSkillIds).toEqual([SNARE_TRAP_ID])
    expect(setLoadout(progress, [SNARE_TRAP_ID]).loadout).toEqual([SNARE_TRAP_ID])
    const skill = authored(SNARE_TRAP_ID)
    expect(skill.cost).toBe(25)
    expect(skill.supplyCost).toBeUndefined()
    expect(skill.effects).toEqual([{ kind: 'armTrap', baseChance: 0.75 }])
    const plain = open({ equipped: [SNARE_TRAP_ID], rows: [{ skillId: SNARE_TRAP_ID }], intellect: 0 })
    useSkill(plain.state, plain.defs, SNARE_TRAP_ID, 25)
    const fight = open({
      nodes: [NODE_SNARE_TRAP],
      equipped: [SNARE_TRAP_ID],
      rows: [{ skillId: SNARE_TRAP_ID }],
      intellect: 0,
    })
    useSkill(fight.state, fight.defs, SNARE_TRAP_ID, 25)
    const attempt = fight.state.log.find((event) => event.type === 'trap')
    expect(fight.state.enemies[0]?.armedTrap).toMatchObject({ baseChance: 0.75, skillId: SNARE_TRAP_ID })
    expect(fight.state.enemies[0]?.armedTrap?.potencyBonus).toBeUndefined()
    expect(fight.state.enemies[0]?.armedTrap?.resistDelayMs).toBeUndefined()
    expect(plain.state.enemies[0]?.armedTrap).toMatchObject({ baseChance: 0.75 })
    expect(attempt).toMatchObject({ type: 'trap' })
    expect(fight.state.hero.classResource).toBe(0)
  })

  it('adds 15 Status Potency to Snare Trap and pushes 0.75 seconds when Stun is resisted', () => {
    expect(nodeId('Reinforced Snare')).toBe(NODE_REINFORCED_SNARE)
    const fight = open({
      nodes: [NODE_REINFORCED_SNARE],
      equipped: [SNARE_TRAP_ID],
      rows: [{ skillId: SNARE_TRAP_ID }],
      intellect: 0,
    })
    useSkill(fight.state, fight.defs, SNARE_TRAP_ID, 25)
    const target = fight.state.enemies[0]
    if (target === undefined) throw new Error('missing target')
    expect(target.armedTrap?.potencyBonus).toBe(REINFORCED_POTENCY)
    const ready = fight.state.timeMs + 10
    fight.state.hero.nextReadyMs = fight.state.timeMs + 100_000
    fight.state.hero.intellect = 0
    fight.state.hero.statusPotency = 0
    target.vitality = 0
    target.physicalStatusResistance = 0
    target.nextReadyMs = ready
    target.actionTimeMs = 2000
    fight.state.rng = rngBefore((roll) => roll >= 0.9)
    stepCombat(fight.state, fight.defs)
    const attempt = fight.state.log.find((event) => event.type === 'statusAttempt' && event.statusId === 'stun')
    const delay = fight.state.log.find((event) => event.type === 'actionDelay')
    const plain = open({ equipped: [SNARE_TRAP_ID], rows: [{ skillId: SNARE_TRAP_ID }], intellect: 0 })
    useSkill(plain.state, plain.defs, SNARE_TRAP_ID, 25)
    const plainTarget = plain.state.enemies[0]
    if (plainTarget === undefined) throw new Error('missing plain target')
    const plainReady = plain.state.timeMs + 10
    plain.state.hero.nextReadyMs = plain.state.timeMs + 100_000
    plain.state.hero.intellect = 0
    plain.state.hero.statusPotency = 0
    plainTarget.vitality = 0
    plainTarget.physicalStatusResistance = 0
    plainTarget.nextReadyMs = plainReady
    plainTarget.actionTimeMs = 2000
    plain.state.rng = rngBefore((roll) => roll >= 0.9)
    stepCombat(plain.state, plain.defs)
    console.log('[sim]', 'reinforced snare', {
      potency: attempt && attempt.type === 'statusAttempt' ? attempt.potency : null,
      delayMs: delay && delay.type === 'actionDelay' ? delay.delayMs : null,
      nextReadyMs: target.nextReadyMs,
      plainReady: plainTarget.nextReadyMs,
    })
    expect(attempt).toMatchObject({ type: 'statusAttempt', potency: REINFORCED_POTENCY, result: 'resisted' })
    expect(delay).toMatchObject({ type: 'actionDelay', delayMs: REINFORCED_DELAY_MS, nextReadyMs: ready + REINFORCED_DELAY_MS })
    expect(target.nextReadyMs).toBe(ready + REINFORCED_DELAY_MS)
    expect(fight.state.log.some((event) => event.type === 'action' && event.actorId === target.id)).toBe(false)
    expect(plain.state.log.some((event) => event.type === 'actionDelay')).toBe(false)
    expect(plain.state.log.some((event) => event.type === 'action' && event.actorId === plainTarget.id)).toBe(true)
  })

  it('unlocks Flame Arrow without changing its damage, burn, or arrow cost', () => {
    expect(nodeId('Flame Arrow')).toBe(NODE_FLAME_ARROW)
    const fresh = createProgress('human', HUMAN)
    expect(fresh.learnedSkillIds).not.toContain('flame-arrow')
    const progress = learned(['Snare Trap', 'Reinforced Snare', 'Flame Arrow'])
    expect(progress.learnedSkillIds).toContain('flame-arrow')
    const skill = authored('flame-arrow')
    expect(skill.ammoCost).toBe(1)
    expect(skill.cost).toBe(20)
    expect(skill.effects[0]).toMatchObject({ coefficient: 1, school: 'magical' })
    const plain = open({
      equipped: ['flame-arrow'],
      rows: [{ skillId: 'flame-arrow' }],
      specialAmmo: 1,
    })
    useSkill(plain.state, plain.defs, 'flame-arrow', 20)
    const fight = open({
      nodes: [NODE_FLAME_ARROW],
      equipped: ['flame-arrow'],
      rows: [{ skillId: 'flame-arrow' }],
      specialAmmo: 1,
    })
    useSkill(fight.state, fight.defs, 'flame-arrow', 20)
    const plainHit = heroDamage(plain.state)
    const hit = heroDamage(fight.state)
    expect(hit.coefficient).toBe(1)
    expect(hit.coefficient).toBe(plainHit.coefficient)
    expect(fight.state.hero.specialAmmo).toBe(0)
    expect(plain.state.hero.specialAmmo).toBe(0)
    expect(fight.state.enemies[0]?.statuses.burn).not.toBeNull()
    expect(fight.state.enemies[0]?.statuses.mark).toBeNull()
    expect(fight.state.hero.specialAmmo).toBe(plain.state.hero.specialAmmo)
  })

  it('holds 8 special arrows and spends none on every third shot for the expedition', () => {
    expect(nodeId('Efficient Quiver')).toBe(NODE_EFFICIENT_QUIVER)
    const plain = open({ specialAmmo: 9 })
    const wide = open({ nodes: [NODE_EFFICIENT_QUIVER] })
    const capped = open({ nodes: [NODE_EFFICIENT_QUIVER], specialAmmo: 9 })
    const fight = open({
      nodes: [NODE_EFFICIENT_QUIVER],
      equipped: ['flame-arrow'],
      rows: [{ skillId: 'flame-arrow' }],
      specialAmmo: 2,
      startingResource: 100,
    })
    useSkill(fight.state, fight.defs, 'flame-arrow', 100)
    const afterFirst = fight.state.hero.specialAmmo
    useSkill(fight.state, fight.defs, 'flame-arrow', 100)
    const afterSecond = fight.state.hero.specialAmmo
    useSkill(fight.state, fight.defs, 'flame-arrow', 100)
    const afterThird = fight.state.hero.specialAmmo
    const unallocated = open({
      equipped: ['flame-arrow'],
      rows: [{ skillId: 'flame-arrow' }],
      specialAmmo: 3,
    })
    useSkill(unallocated.state, unallocated.defs, 'flame-arrow', 100)
    useSkill(unallocated.state, unallocated.defs, 'flame-arrow', 100)
    useSkill(unallocated.state, unallocated.defs, 'flame-arrow', 100)
    const carried = road({
      nodes: [NODE_EFFICIENT_QUIVER],
      ammo: 3,
      gap: 0,
      equipped: ['flame-arrow'],
      rows: [{ skillId: 'flame-arrow' }],
      enemy: { maxHp: 1_000_000, armor: 0, evasion: 0, actionTime: 60, power: 1 },
    })
    carried.state.hero.classResource = 100
    stepExpedition(carried.state, carried.defs)
    const combat = carried.state.combat
    if (combat === null) throw new Error('missing quiver fight')
    useSkill(combat, carried.defs, 'flame-arrow', 100)
    useSkill(combat, carried.defs, 'flame-arrow', 100)
    useSkill(combat, carried.defs, 'flame-arrow', 100)
    const enemy = combat.enemies[0]
    if (enemy === undefined) throw new Error('missing quiver enemy')
    enemy.hp = 1
    combat.hero.priorityRows = []
    let guard = 0
    while (carried.state.phase === 'combat' && carried.state.outcome === 'ongoing') {
      stepExpedition(carried.state, carried.defs)
      guard += 1
      if (guard > 20_000) throw new Error('quiver fight did not end')
    }
    console.log('[sim]', 'efficient quiver', {
      plainCap: plain.state.hero.specialAmmo,
      capacity: wide.state.hero.specialAmmo,
      capped: capped.state.hero.specialAmmo,
      afterFirst,
      afterSecond,
      afterThird,
      unallocated: unallocated.state.hero.specialAmmo,
      carried: carried.state.hero.specialArrowCount,
    })
    expect(plain.state.hero.specialAmmo).toBe(QUIVER_CAPACITY)
    expect(wide.state.hero.specialAmmo).toBe(EFFICIENT_QUIVER_CAPACITY)
    expect(capped.state.hero.specialAmmo).toBe(EFFICIENT_QUIVER_CAPACITY)
    expect(afterFirst).toBe(1)
    expect(afterSecond).toBe(0)
    expect(afterThird).toBe(0)
    expect(unallocated.state.hero.specialAmmo).toBe(0)
    expect(carried.state.hero.specialArrowCount).toBe(3)
    resetFocus(carried.state, 'reincarnation')
    expect(carried.state.hero.specialArrowCount).toBe(0)
    carried.state.hero.specialArrowCount = 4
    resetFocus(carried.state, 'return')
    expect(carried.state.hero.specialArrowCount).toBe(0)
    carried.state.hero.specialArrowCount = 4
    resetFocus(carried.state, 'retreat')
    expect(carried.state.hero.specialArrowCount).toBe(0)
    carried.state.hero.specialArrowCount = 4
    resetFocus(carried.state, 'defeat')
    expect(carried.state.hero.specialArrowCount).toBe(0)
  })

  it('deploys one Snare Trap before the first enemy action and recharges after three encounters', () => {
    expect(nodeId('Trapper')).toBe(NODE_TRAPPER)
    expect(authored(SNARE_TRAP_ID).supplyCost).toBeUndefined()
    const plain = open({ startingResource: 100 })
    const fight = open({ nodes: [NODE_TRAPPER], startingResource: 100 })
    const target = fight.state.enemies[0]
    console.log('[sim]', 'trapper', {
      readiness: fight.state.hero.classResource,
      trap: target?.armedTrap?.skillId ?? null,
      readyMs: fight.state.hero.nextReadyMs,
      plainReadyMs: plain.state.hero.nextReadyMs,
    })
    expect(fight.state.hero.classResource).toBe(75)
    expect(target?.armedTrap).toMatchObject({ skillId: SNARE_TRAP_ID, baseChance: 0.75 })
    expect(fight.state.hero.nextReadyMs).toBe(plain.state.hero.nextReadyMs)
    expect(fight.state.log.some((event) => event.type === 'action')).toBe(false)
    expect(fight.state.log.some((event) => event.type === 'resource' && event.reason === 'trapper')).toBe(true)
    expect(plain.state.enemies[0]?.armedTrap).toBeNull()
    expect(plain.state.hero.classResource).toBe(100)

    const blockedBook = { ...skills, [SNARE_TRAP_ID]: { ...authored(SNARE_TRAP_ID), supplyCost: 1 } }
    const blockedEnemy = dummy({ maxHp: 1_000_000, actionTime: 60 })
    const blocked = createCombat(
      rangerSetup({ nodes: [NODE_TRAPPER], startingResource: 100, enemies: [{ defId: blockedEnemy.id, slot: 0 }] }),
      defsFor(blockedEnemy, blockedBook),
      1,
    )
    expect(blocked.enemies[0]?.armedTrap).toBeNull()
    expect(blocked.hero.classResource).toBe(100)
    const supplied = createCombat(
      rangerSetup({
        nodes: [NODE_TRAPPER],
        startingResource: 100,
        carriedSupplyCount: 1,
        enemies: [{ defId: blockedEnemy.id, slot: 0 }],
      }),
      defsFor(blockedEnemy, blockedBook),
      1,
    )
    expect(supplied.enemies[0]?.armedTrap?.skillId).toBe(SNARE_TRAP_ID)
    expect(supplied.hero.carriedSupplyCount).toBe(0)
    expect(supplied.hero.classResource).toBe(75)

    const expedition = road({ nodes: [NODE_TRAPPER], gap: 0, ammo: 6 })
    const deployed: boolean[] = []
    for (let encounter = 0; encounter < 4; encounter += 1) {
      expedition.state.hero.classResource = 100
      stepExpedition(expedition.state, expedition.defs)
      const combat = expedition.state.combat
      if (combat === null) throw new Error(`missing trapper encounter ${encounter + 1}`)
      deployed.push(combat.enemies[0]?.armedTrap !== null)
      let steps = 0
      while (expedition.state.phase === 'combat' && expedition.state.outcome === 'ongoing') {
        stepExpedition(expedition.state, expedition.defs)
        steps += 1
        if (steps > 20_000) throw new Error('trapper fight did not end')
      }
    }
    console.log('[sim]', 'trapper recharge', { deployed, cooldown: expedition.state.trapperCooldown })
    expect(deployed).toEqual([true, false, false, true])
  })

  it("unlocks Hunter's Mark without Assassin Mark, Advantage, or Execute", () => {
    expect(nodeId("Hunter's Mark")).toBe(NODE_HUNTERS_MARK)
    const fresh = createProgress('human', HUMAN)
    expect(fresh.learnedSkillIds).not.toContain('hunters-mark')
    expect(() => setLoadout(fresh, ['hunters-mark'])).toThrow(/unlearned/)
    const progress = learned(["Hunter's Mark"])
    expect(progress.learnedSkillIds).toEqual(['hunters-mark'])
    expect(progress.learnedSkillIds).not.toContain('execute')
    expect(progress.learnedSkillIds).not.toContain('mark-for-death')
    expect(authored('hunters-mark').effects).toEqual([{ kind: 'reveal' }])
    expect(authored('hunters-mark').cost).toBe(0)
    const plain = open({ equipped: ['hunters-mark'], rows: [{ skillId: 'hunters-mark' }], startingResource: 40 })
    useSkill(plain.state, plain.defs, 'hunters-mark', 40)
    const fight = open({
      nodes: [NODE_HUNTERS_MARK],
      equipped: ['hunters-mark'],
      rows: [{ skillId: 'hunters-mark' }],
      startingResource: 40,
    })
    useSkill(fight.state, fight.defs, 'hunters-mark', 40)
    const target = fight.state.enemies[0]
    expect(target?.revealed).toBe(true)
    expect(target?.statuses.mark).toBeNull()
    expect(plain.state.enemies[0]?.revealed).toBe(true)
    expect(plain.state.enemies[0]?.statuses.mark).toBeNull()
    expect(fight.state.hero.classResourceId).toBe('readiness')
    expect(fight.state.hero.classResource).toBe(40)
    expect(plain.state.hero.classResource).toBe(40)
    expect(fight.state.log.some((event) => event.type === 'resource' && event.resourceId === 'advantage')).toBe(false)
    expect(fight.state.hero.classResource).toBe(plain.state.hero.classResource)
  })

  it('multiplies travel Readiness generation by 1.25', () => {
    expect(nodeId('Trail Sense')).toBe(NODE_TRAIL_SENSE)
    const plain = road({ spirit: 0, gap: 5_000, ammo: 6 })
    const sense = road({ nodes: [NODE_TRAIL_SENSE], spirit: 0, gap: 5_000, ammo: 6 })
    stepTravel(plain.state, plain.defs, 1000)
    stepTravel(sense.state, sense.defs, 1000)
    console.log('[sim]', 'trail sense', {
      plain: plain.state.hero.classResource,
      sensed: sense.state.hero.classResource,
      factor: travelReadinessFactor([NODE_TRAIL_SENSE], 0),
    })
    expect(travelReadinessFactor(undefined, 3)).toBe(1)
    expect(travelReadinessFactor([NODE_TRAIL_SENSE], 0)).toBe(TRAIL_SENSE_FACTOR)
    expect(plain.state.hero.classResource).toBe(READINESS_TRAVEL_PER_SECOND)
    expect(sense.state.hero.classResource).toBe(READINESS_TRAVEL_PER_SECOND * TRAIL_SENSE_FACTOR)
    expect(Object.keys(sense.state)).not.toContain('hiddenRoutes')
  })

  it('unlocks Volley without changing its damage', () => {
    expect(nodeId('Volley')).toBe(NODE_VOLLEY)
    const fresh = createProgress('human', HUMAN)
    expect(fresh.learnedSkillIds).not.toContain('volley')
    const progress = learned(["Hunter's Mark", 'Trail Sense', 'Volley'])
    expect(progress.learnedSkillIds).toContain('volley')
    expect(authored('volley').effects[0]).toMatchObject({ coefficient: 0.65 })
    expect(authored('volley').cost).toBe(30)
    const plain = open({ equipped: ['volley'], rows: [{ skillId: 'volley' }] })
    useSkill(plain.state, plain.defs, 'volley', 30)
    const fight = open({ nodes: [NODE_VOLLEY], equipped: ['volley'], rows: [{ skillId: 'volley' }] })
    useSkill(fight.state, fight.defs, 'volley', 30)
    const plainHit = heroDamage(plain.state)
    const hit = heroDamage(fight.state)
    expect(hit.coefficient).toBe(0.65)
    expect(hit.coefficient).toBe(plainHit.coefficient)
    expect(hit.outgoingModifier).toBe(plainHit.outgoingModifier)
    expect(fight.state.hero.classResource).toBe(plain.state.hero.classResource)
  })

  it('restores 5 Readiness per momentum stack after a victory and adds 2 escape points per stack', () => {
    expect(nodeId('Press the Trail')).toBe(NODE_PRESS_THE_TRAIL)
    const plain = road({ gap: 0, ammo: 6, agility: 11 })
    const trail = road({ nodes: [NODE_PRESS_THE_TRAIL], gap: 0, ammo: 6, agility: 11 })
    plain.state.hero.classResource = 10
    trail.state.hero.classResource = 10
    stepExpedition(plain.state, plain.defs)
    stepExpedition(trail.state, trail.defs)
    let plainGuard = 0
    while (plain.state.phase === 'combat') {
      stepExpedition(plain.state, plain.defs)
      plainGuard += 1
      if (plainGuard > 20_000) throw new Error('plain victory did not finish')
    }
    let trailGuard = 0
    while (trail.state.phase === 'combat') {
      stepExpedition(trail.state, trail.defs)
      trailGuard += 1
      if (trailGuard > 20_000) throw new Error('trail victory did not finish')
    }
    const escape = road({
      nodes: [NODE_PRESS_THE_TRAIL],
      gap: 0,
      ammo: 6,
      agility: 11,
      retreat: true,
      enemy: { maxHp: 1_000_000, armor: 0, evasion: 0, actionTime: 60, power: 1 },
    })
    escape.state.hero.classResource = 50
    stepExpedition(escape.state, escape.defs)
    const combat = escape.state.combat
    if (combat === null) throw new Error('missing escape fight')
    combat.hero.hp = 1
    escape.state.momentum = 2
    escape.state.rareNodeChance = 2 * RARE_NODE_CHANCE_PER_STACK
    stepExpedition(escape.state, escape.defs)
    const event = escape.state.escapeLog[0]
    const quiet = road({
      gap: 0,
      ammo: 6,
      agility: 11,
      retreat: true,
      enemy: { maxHp: 1_000_000, armor: 0, evasion: 0, actionTime: 60, power: 1 },
    })
    quiet.state.hero.classResource = 50
    stepExpedition(quiet.state, quiet.defs)
    const quietCombat = quiet.state.combat
    if (quietCombat === null) throw new Error('missing quiet escape')
    quietCombat.hero.hp = 1
    quiet.state.momentum = 2
    quiet.state.rareNodeChance = 2 * RARE_NODE_CHANCE_PER_STACK
    stepExpedition(quiet.state, quiet.defs)
    const quietEvent = quiet.state.escapeLog[0]
    console.log('[sim]', 'press the trail', {
      plain: plain.state.hero.classResource,
      restored: trail.state.hero.classResource,
      momentum: trail.state.momentum,
      chance: event?.chancePercent,
      agilityPoints: event?.agilityPoints,
      quietChance: quietEvent?.chancePercent,
    })
    expect(trail.state.momentum).toBe(1)
    expect(trail.state.hero.classResource).toBeCloseTo(plain.state.hero.classResource + PRESS_READINESS_PER_STACK, 8)
    expect(event).toMatchObject({
      agility: 11,
      agilityPoints: 2,
      chancePercent: 50 + 2 + PRESS_ESCAPE_PER_STACK * 2,
      momentumBonus: PRESS_ESCAPE_PER_STACK * 2,
    })
    expect(quietEvent).toMatchObject({ agility: 11, agilityPoints: 2, chancePercent: 52, momentumBonus: 0 })
  })

  it('grants 3% physical damage and 5% travel Readiness per momentum stack', () => {
    expect(nodeId('Trailblazer')).toBe(NODE_TRAILBLAZER)
    const quiet = open({
      nodes: [NODE_TRAILBLAZER],
      expeditionMomentum: 0,
      equipped: [AIMED_SHOT_ID],
      rows: [{ skillId: AIMED_SHOT_ID }],
    })
    useSkill(quiet.state, quiet.defs, AIMED_SHOT_ID, 40)
    const boosted = open({
      nodes: [NODE_TRAILBLAZER],
      expeditionMomentum: 2,
      equipped: [AIMED_SHOT_ID],
      rows: [{ skillId: AIMED_SHOT_ID }],
    })
    useSkill(boosted.state, boosted.defs, AIMED_SHOT_ID, 40)
    const unallocated = open({
      expeditionMomentum: 2,
      equipped: [AIMED_SHOT_ID],
      rows: [{ skillId: AIMED_SHOT_ID }],
    })
    useSkill(unallocated.state, unallocated.defs, AIMED_SHOT_ID, 40)
    const stacks = 2
    const both = [NODE_TRAIL_SENSE, NODE_TRAILBLAZER]
    const travel = road({ nodes: [NODE_TRAILBLAZER], spirit: 0, gap: 5_000, ammo: 6 })
    travel.state.momentum = stacks
    travel.state.rareNodeChance = stacks * RARE_NODE_CHANCE_PER_STACK
    stepTravel(travel.state, travel.defs, 1000)
    const withStacks = travel.state.hero.classResource
    resetMomentum(travel.state, 'return')
    stepTravel(travel.state, travel.defs, 1000)
    const afterReset = travel.state.hero.classResource
    console.log('[sim]', 'trailblazer', {
      zero: heroDamage(quiet.state).outgoingModifier,
      stacks: heroDamage(boosted.state).outgoingModifier,
      unallocated: heroDamage(unallocated.state).outgoingModifier,
      travel: withStacks,
      reset: afterReset,
      both: travelReadinessFactor(both, stacks),
    })
    expect(heroDamage(quiet.state).outgoingModifier).toBe(1)
    expect(heroDamage(boosted.state).outgoingModifier).toBeCloseTo(1 + TRAILBLAZER_DAMAGE_PER_STACK * stacks, 10)
    expect(heroDamage(unallocated.state).outgoingModifier).toBe(1)
    expect(withStacks).toBeCloseTo(READINESS_TRAVEL_PER_SECOND * (1 + TRAILBLAZER_TRAVEL_PER_STACK * stacks), 8)
    expect(afterReset).toBeCloseTo(withStacks + READINESS_TRAVEL_PER_SECOND, 8)
    expect(travel.state.momentum).toBe(0)
    expect(travelReadinessFactor(both, stacks)).toBeCloseTo(
      TRAIL_SENSE_FACTOR * (1 + TRAILBLAZER_TRAVEL_PER_STACK * stacks),
      10,
    )
    expect(travelReadinessFactor([NODE_TRAILBLAZER], 0)).toBe(1)
  })
})
