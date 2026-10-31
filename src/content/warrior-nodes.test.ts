import { describe, expect, it } from 'vitest'

import { createCombat, roundDurationMs, stepCombat } from '../sim/combat.ts'
import {
  BLEEDING_TARGET_FURY,
  CLEAVE_ID,
  DRIVING_BLOW_COOLDOWN_SECONDS,
  DRIVING_BLOW_FURY_BONUS,
  DRIVING_BLOW_ID,
  HEAVY_SPEED_FACTOR,
  NODE_BERSERKER,
  NODE_BLOODLETTING,
  NODE_CLEAVE,
  NODE_DEFIANCE,
  NODE_DRIVING_BLOW,
  NODE_HEAVY_FOLLOW_THROUGH,
  NODE_RECKLESS_STRIKE,
  NODE_RISING_HEAT,
  NODE_SECOND_WIND,
  NODE_SHIELD_BRACE,
  NODE_SHIELD_IMPACT,
  NODE_SUNDERING_BLOW,
  NODE_UNBROKEN,
  NODE_WEAPON_DISCIPLINE,
  NODE_WEAPON_MASTER,
  SHIELD_IMPACT_STUN_CHANCE,
  SHIELD_IMPACT_WINDOW_MS,
  STATE_SHIELD_IMPACT_UNTIL,
  SUNDERING_BLOW_ID,
  WEAPON_DISCIPLINE_FACTOR,
  adjustedHealingReceived,
  furyGenerationMultiplier,
} from '../sim/classes/warriorAdjust.ts'
import { warriorClass } from '../sim/classes/warrior.ts'
import { spiritResourceFactor } from '../sim/classes/resources.ts'
import { finalCooldownSeconds, incomingDamageFactor } from '../sim/skills.ts'
import { actionTime } from '../sim/stats.ts'
import {
  allocateNode,
  createProgress,
  grantLegacySkillPoint,
  setLoadout,
} from '../sim/progression.ts'
import type { CombatSetup, CombatState, EnemyDef, GameDefs, SkillDef } from '../sim/types.ts'

import { skills } from './skills.ts'
import { statuses } from './statuses.ts'
import { warriorWeb } from './webs/warrior.ts'

const ITEM_LEVEL = 20
const QUALITY = 1
const HUMAN = { strength: 10, vitality: 10, agility: 10, intellect: 10, spirit: 10 }

function piece(kind: 'oneHanded' | 'twoHanded') {
  return { id: `weapon-${kind}`, kind, itemLevel: ITEM_LEVEL, quality: QUALITY }
}

function warriorSetup(options?: {
  nodes?: readonly string[]
  spirit?: number
  agility?: number
  weapon?: 'oneHanded' | 'twoHanded'
  equipped?: readonly string[]
  rows?: readonly { skillId: string }[]
  enemies?: CombatSetup['enemies']
}): CombatSetup {
  const weapon = options?.weapon ?? 'oneHanded'
  const armor = (slot: 'head' | 'chest' | 'hands' | 'feet') => ({
    id: `ref-heavy-${slot}`,
    slot,
    category: 'heavy' as const,
    itemLevel: ITEM_LEVEL,
    quality: QUALITY,
  })
  return {
    hero: {
      id: 'ref-human-warrior',
      name: 'Warrior',
      level: 20,
      classId: 'warrior',
      attributes: {
        strength: 24,
        vitality: 22,
        agility: options?.agility ?? 16,
        intellect: 10,
        spirit: options?.spirit ?? 16,
      },
      gear: {
        mainHand: piece(weapon),
        offHand: weapon === 'twoHanded' ? null : { id: 'ref-shield', kind: 'shield' as const, itemLevel: ITEM_LEVEL, quality: QUALITY },
        head: armor('head'),
        chest: armor('chest'),
        hands: armor('hands'),
        feet: armor('feet'),
        accessories: [
          { id: 'ref-accessory-a', itemLevel: ITEM_LEVEL, quality: QUALITY },
          { id: 'ref-accessory-b', itemLevel: ITEM_LEVEL, quality: QUALITY },
        ] as const,
      },
      equippedSkillIds: options?.equipped,
      priorityRows: options?.rows,
      allocatedNodeIds: options?.nodes,
    },
    enemies: options?.enemies ?? [{ defId: 'dummy', slot: 0 }],
  }
}

function dummy(overrides: EnemyDef['overrides'] = {}): EnemyDef {
  return { id: 'dummy', name: 'Dummy', level: 20, archetype: 'standard', school: 'physical', overrides }
}

function defsFor(enemy: EnemyDef = dummy()): GameDefs {
  return { enemies: { [enemy.id]: enemy }, skills, statuses }
}

function until(state: CombatState, defs: GameDefs, seen: (state: CombatState) => boolean): void {
  let steps = 0
  while (state.outcome === 'ongoing' && !seen(state)) {
    stepCombat(state, defs)
    steps += 1
    if (steps > 20_000) throw new Error('combat did not reach the expected event')
  }
}

function resources(state: CombatState, reason: string) {
  return state.log.filter((event) => event.type === 'resource' && event.reason === reason)
}

function skillActions(state: CombatState, skillId: string) {
  return state.log.filter((event) => event.type === 'action' && event.skillId === skillId)
}

function authored(id: string): SkillDef {
  const skill = skills[id]
  if (skill === undefined) throw new Error(`missing skill ${id}`)
  return skill
}

function learned(nodeIds: readonly string[]) {
  let progress = createProgress('human', HUMAN)
  for (let index = 0; index < nodeIds.length; index += 1) progress = grantLegacySkillPoint(progress)
  for (const id of nodeIds) progress = allocateNode(progress, warriorWeb, id)
  return progress
}

function open(options: {
  nodes?: readonly string[]
  spirit?: number
  agility?: number
  weapon?: 'oneHanded' | 'twoHanded'
  equipped?: readonly string[]
  rows?: readonly { skillId: string }[]
  enemy?: EnemyDef['overrides']
  seed?: number
}) {
  const enemy = dummy({ maxHp: 1_000_000, armor: 0, evasion: 0, actionTime: 30, power: 20, ...options.enemy })
  const defs = defsFor(enemy)
  const state = createCombat(warriorSetup({ ...options, enemies: [{ defId: enemy.id, slot: 0 }] }), defs, options.seed ?? 1)
  return { state, defs }
}

function useSkill(state: CombatState, defs: GameDefs, skillId: string, fury = 100): void {
  const before = skillActions(state, skillId).length
  state.hero.priorityRows = [{ skillId }]
  delete state.hero.cooldowns[skillId]
  state.hero.classResource = fury
  state.hero.nextReadyMs = state.timeMs + 10
  let steps = 0
  while (state.outcome === 'ongoing' && skillActions(state, skillId).length <= before) {
    stepCombat(state, defs)
    steps += 1
    if (steps > 500) throw new Error(`did not use ${skillId}`)
  }
}

describe('warrior nodes', () => {
  it('gives Driving Blow 20 base Fury and a 2.5 second cooldown', () => {
    const plain = open({ equipped: [DRIVING_BLOW_ID], rows: [{ skillId: DRIVING_BLOW_ID }] })
    until(plain.state, plain.defs, (state) => resources(state, DRIVING_BLOW_ID).length > 0)
    const plainGains = resources(plain.state, DRIVING_BLOW_ID)
    const plainBases = plainGains.reduce((sum, event) => (event.type === 'resource' ? sum + event.base : sum), 0)
    const plainAction = skillActions(plain.state, DRIVING_BLOW_ID)[0]
    if (plainAction?.type !== 'action' || plainAction.cooldownReadyMs === null) throw new Error('missing driving blow')
    const plainCooldown = roundDurationMs(
      finalCooldownSeconds(authored(DRIVING_BLOW_ID).cooldownSeconds, plain.state.hero.cooldownReduction),
      'plain cooldown',
    )

    const boosted = open({
      nodes: [NODE_DRIVING_BLOW],
      equipped: [DRIVING_BLOW_ID],
      rows: [{ skillId: DRIVING_BLOW_ID }],
    })
    until(boosted.state, boosted.defs, (state) => resources(state, DRIVING_BLOW_ID).length > 1)
    const gains = resources(boosted.state, DRIVING_BLOW_ID)
    const bases = gains.reduce((sum, event) => (event.type === 'resource' ? sum + event.base : sum), 0)
    const generated = gains.reduce((sum, event) => (event.type === 'resource' ? sum + event.generated : sum), 0)
    const action = skillActions(boosted.state, DRIVING_BLOW_ID)[0]
    if (action?.type !== 'action' || action.cooldownReadyMs === null) throw new Error('missing boosted driving blow')
    const factor = spiritResourceFactor(boosted.state.hero.spirit)
    const cooldown = roundDurationMs(
      finalCooldownSeconds(DRIVING_BLOW_COOLDOWN_SECONDS, boosted.state.hero.cooldownReduction),
      'node cooldown',
    )
    console.log('[sim]', 'driving blow node', { bases, generated, factor, cooldownMs: action.cooldownReadyMs - action.timeMs })
    expect(plain.state.hero.allocatedNodeIds).toEqual([])
    expect(plainBases).toBe(15)
    expect(plainAction.cooldownReadyMs - plainAction.timeMs).toBe(plainCooldown)
    expect(bases).toBe(15 + DRIVING_BLOW_FURY_BONUS)
    expect(generated).toBeCloseTo(20 * factor, 8)
    expect(action.cooldownReadyMs - action.timeMs).toBe(cooldown)
    expect(authored(DRIVING_BLOW_ID).cooldownSeconds).toBe(3)
    expect(authored(DRIVING_BLOW_ID).effects).toContainEqual({ kind: 'resource', base: 15 })
  })

  it('raises all Fury generation by 20%, multiplicative with Spirit', () => {
    const factor = spiritResourceFactor(16)
    const plain = open({ spirit: 16 })
    until(plain.state, plain.defs, (state) => resources(state, 'basicAttack').length > 0)
    const plainGain = resources(plain.state, 'basicAttack')[0]
    const heated = open({ nodes: [NODE_RISING_HEAT], spirit: 16 })
    until(heated.state, heated.defs, (state) => resources(state, 'basicAttack').length > 0)
    const gain = resources(heated.state, 'basicAttack')[0]
    if (plainGain?.type !== 'resource' || gain?.type !== 'resource') throw new Error('missing basic fury')
    console.log('[sim]', 'rising heat', { base: gain.base, multiplier: gain.multiplier, generated: gain.generated })
    expect(plainGain.multiplier).toBe(factor)
    expect(gain.base).toBe(plainGain.base)
    expect(gain.multiplier).toBeCloseTo(factor * 1.2, 10)
    expect(gain.generated).toBeCloseTo(gain.base * factor * 1.2, 8)
    const both = open({ nodes: [NODE_RISING_HEAT, NODE_DEFIANCE], spirit: 16 })
    both.state.hero.hp = Math.floor((both.state.hero.maxHp * 350 - 1) / 1000)
    expect(furyGenerationMultiplier(both.state.hero)).toBeCloseTo(1.2 * 1.25, 10)
  })

  it('unlocks Cleave without changing its skill numbers', () => {
    const fresh = createProgress('human', HUMAN)
    expect(fresh.learnedSkillIds).not.toContain(CLEAVE_ID)
    expect(() => setLoadout(fresh, [CLEAVE_ID])).toThrow(/unlearned/)
    const progress = learned([NODE_DRIVING_BLOW, NODE_RISING_HEAT, NODE_CLEAVE])
    const equipped = setLoadout(progress, [CLEAVE_ID])
    const cleave = authored(CLEAVE_ID)
    expect(progress.learnedSkillIds).toContain(CLEAVE_ID)
    expect(equipped.loadout).toEqual([CLEAVE_ID])
    expect(cleave).toMatchObject({ cost: 25, cooldownSeconds: 5, actionTimeCoefficient: 1.15, target: 'all' })
    expect(cleave.effects[0]).toMatchObject({ kind: 'damage', coefficient: 0.8 })

    const bare = open({ nodes: [], equipped: [CLEAVE_ID], rows: [{ skillId: CLEAVE_ID }] })
    bare.state.hero.classResource = 25
    until(bare.state, bare.defs, (state) => resources(state, 'payment').length > 0)
    const payment = resources(bare.state, 'payment')[0]
    expect(payment).toMatchObject({ base: 25 })
  })

  it('adds Bleed to Driving Blow and Cleave and Fury for hitting a Bleeding target', () => {
    const bleeding = open({ nodes: [NODE_BLOODLETTING] })
    const enemy = bleeding.state.enemies[0]
    if (enemy === undefined) throw new Error('missing enemy')
    enemy.statuses.bleed = {
      name: 'Bleed',
      stacks: [
        {
          power: 10,
          penetration: 0,
          coefficient: 0.1,
          attackerLevel: 20,
          sourceId: bleeding.state.hero.id,
          sourceName: bleeding.state.hero.name,
          actionsRemaining: 3,
        },
      ],
    }
    until(bleeding.state, bleeding.defs, (state) => resources(state, 'bleedingTarget').length > 0)
    const bonus = resources(bleeding.state, 'bleedingTarget')[0]
    const quiet = open({})
    const quietEnemy = quiet.state.enemies[0]
    if (quietEnemy === undefined) throw new Error('missing quiet enemy')
    quietEnemy.statuses.bleed = enemy.statuses.bleed
    until(quiet.state, quiet.defs, (state) =>
      state.log.some((event) => event.type === 'damage' && event.actorId === state.hero.id),
    )
    expect(resources(quiet.state, 'bleedingTarget')).toHaveLength(0)

    let applied: CombatState | null = null
    let attemptBase = 0
    for (let seed = 1; seed <= 40; seed += 1) {
      const fight = open({
        nodes: [NODE_BLOODLETTING],
        equipped: [DRIVING_BLOW_ID],
        rows: [{ skillId: DRIVING_BLOW_ID }],
        seed,
        enemy: { maxHp: 1_000_000, armor: 0, evasion: 0, actionTime: 2, power: 1 },
      })
      until(fight.state, fight.defs, (state) =>
        state.log.some((event) => event.type === 'statusAttempt' && event.statusId === 'bleed'),
      )
      const attempt = fight.state.log.find((event) => event.type === 'statusAttempt' && event.statusId === 'bleed')
      if (attempt?.type !== 'statusAttempt') throw new Error('missing bleed attempt')
      attemptBase = attempt.baseChance
      if (attempt.result === 'applied') {
        applied = fight.state
        break
      }
    }
    if (applied === null) throw new Error('bleed did not apply in 40 seeds')
    until(applied, defsFor(dummy({ maxHp: 1_000_000, armor: 0, evasion: 0, actionTime: 2, power: 1 })), (state) =>
      state.log.some((event) => event.type === 'statusTick' && event.statusId === 'bleed'),
    )
    const tick = applied.log.find((event) => event.type === 'statusTick' && event.statusId === 'bleed')
    const stack = applied.enemies[0]?.statuses.bleed?.stacks[0]
    console.log('[sim]', 'bloodletting', { bonus, attemptBase, tick, stackPower: stack?.power })
    expect(bonus).toMatchObject({ base: BLEEDING_TARGET_FURY })
    expect(attemptBase).toBe(0.75)
    if (tick?.type !== 'statusTick') throw new Error('missing bleed tick')
    expect(tick.coefficient).toBeCloseTo(0.1, 10)
    expect(tick.power).toBe(applied.hero.physicalPower)
    expect(tick.raw).toBeCloseTo(tick.power * 0.1, 8)

    const cleave = open({
      nodes: [NODE_BLOODLETTING],
      equipped: [CLEAVE_ID],
      rows: [{ skillId: CLEAVE_ID }],
      enemy: { maxHp: 1_000_000, armor: 0, evasion: 0, actionTime: 30, power: 1 },
    })
    cleave.state.hero.classResource = 25
    until(cleave.state, cleave.defs, (state) =>
      state.log.some((event) => event.type === 'statusAttempt' && event.statusId === 'bleed'),
    )
    const cleaveAttempt = cleave.state.log.find((event) => event.type === 'statusAttempt' && event.statusId === 'bleed')
    expect(cleaveAttempt).toMatchObject({ baseChance: 0.75, statusId: 'bleed' })
  })

  it('scales physical damage to +50% at 100 Fury and multiplies incoming damage by 1.25', () => {
    const state = open({ nodes: [NODE_BERSERKER] }).state
    const outgoing = warriorClass.outgoingModifiers
    const incoming = warriorClass.incomingModifiers
    if (outgoing === undefined || incoming === undefined) throw new Error('missing warrior hooks')
    const query = { school: 'physical' as const, skill: null }
    state.hero.classResource = 0
    expect(outgoing(state, query)).toBe(1)
    state.hero.classResource = 50
    expect(outgoing(state, query)).toBeCloseTo(1.25, 10)
    state.hero.classResource = 100
    const full = outgoing(state, query)
    expect(full).toBeCloseTo(1.5, 10)
    expect(outgoing(state, { school: 'magical', skill: null })).toBe(1)
    expect(incoming(state, query)).toBeCloseTo(1.25, 10)
    state.hero.incomingMultipliers = [1.2]
    const withReckless = incomingDamageFactor(state.hero) * incoming(state, query)
    expect(withReckless).toBeCloseTo(1.5, 10)
    state.hero.allocatedNodeIds = [NODE_BERSERKER, NODE_UNBROKEN]
    state.hero.incomingMultipliers = []
    state.hero.classResource = 100
    expect(outgoing(state, query)).toBeCloseTo(1.25, 10)
    const both = incoming(state, query)
    console.log('[sim]', 'berserker', { full, withReckless, both })
    expect(both).toBeCloseTo(1.25 * 0.85, 10)

    const hit = open({ nodes: [NODE_BERSERKER], enemy: { power: 40, actionTime: 1, maxHp: 1_000_000, armor: 0, evasion: 0 } })
    until(hit.state, hit.defs, (combat) =>
      combat.log.some((event) => event.type === 'damage' && event.targetId === combat.hero.id),
    )
    const damage = hit.state.log.find((event) => event.type === 'damage' && event.targetId === hit.state.hero.id)
    const plain = open({ enemy: { power: 40, actionTime: 1, maxHp: 1_000_000, armor: 0, evasion: 0 } })
    until(plain.state, plain.defs, (combat) =>
      combat.log.some((event) => event.type === 'damage' && event.targetId === combat.hero.id),
    )
    const plainDamage = plain.state.log.find((event) => event.type === 'damage' && event.targetId === plain.state.hero.id)
    if (damage?.type !== 'damage' || plainDamage?.type !== 'damage') throw new Error('missing incoming hit')
    expect(plainDamage.incomingModifier).toBe(1)
    expect(damage.incomingModifier).toBeCloseTo(1.25, 10)
  })

  it('unlocks Sundering Blow without changing the skill', () => {
    const fresh = createProgress('human', HUMAN)
    expect(fresh.learnedSkillIds).not.toContain(SUNDERING_BLOW_ID)
    expect(() => setLoadout(fresh, [SUNDERING_BLOW_ID])).toThrow(/unlearned/)
    const progress = learned([NODE_SUNDERING_BLOW])
    expect(progress.learnedSkillIds).toEqual([SUNDERING_BLOW_ID])
    expect(setLoadout(progress, [SUNDERING_BLOW_ID]).loadout).toEqual([SUNDERING_BLOW_ID])
    expect(authored(SUNDERING_BLOW_ID)).toMatchObject({ cost: 20, cooldownSeconds: 6, actionTimeCoefficient: 1 })
    expect(authored(SUNDERING_BLOW_ID).effects[0]).toMatchObject({ kind: 'damage', coefficient: 1.25 })

    const bare = open({ equipped: [SUNDERING_BLOW_ID], rows: [{ skillId: SUNDERING_BLOW_ID }] })
    bare.state.hero.classResource = 20
    until(bare.state, bare.defs, (state) => resources(state, 'payment').length > 0)
    expect(resources(bare.state, 'payment')[0]).toMatchObject({ base: 20 })
  })

  it('cuts weapon-skill Fury costs and base cooldowns by 10%', () => {
    const skill = authored(SUNDERING_BLOW_ID)
    const plain = open({ equipped: [skill.id], rows: [{ skillId: skill.id }] })
    plain.state.hero.classResource = skill.cost
    until(plain.state, plain.defs, (state) => skillActions(state, skill.id).length > 0)
    const plainAction = skillActions(plain.state, skill.id)[0]
    const node = open({ nodes: [NODE_WEAPON_DISCIPLINE], equipped: [skill.id], rows: [{ skillId: skill.id }] })
    node.state.hero.classResource = skill.cost * WEAPON_DISCIPLINE_FACTOR
    until(node.state, node.defs, (state) => skillActions(state, skill.id).length > 0)
    const action = skillActions(node.state, skill.id)[0]
    const payment = resources(node.state, 'payment')[0]
    if (plainAction?.type !== 'action' || plainAction.cooldownReadyMs === null) throw new Error('missing plain sundering')
    if (action?.type !== 'action' || action.cooldownReadyMs === null) throw new Error('missing discounted sundering')
    const plainCooldown = roundDurationMs(
      finalCooldownSeconds(skill.cooldownSeconds, plain.state.hero.cooldownReduction),
      'plain sundering',
    )
    const nodeCooldown = roundDurationMs(
      finalCooldownSeconds(skill.cooldownSeconds * WEAPON_DISCIPLINE_FACTOR, node.state.hero.cooldownReduction),
      'discounted sundering',
    )
    console.log('[sim]', 'weapon discipline', { payment, cooldownMs: action.cooldownReadyMs - action.timeMs })
    expect(resources(plain.state, 'payment')[0]).toMatchObject({ base: skill.cost })
    expect(payment).toMatchObject({ type: 'resource' })
    if (payment?.type !== 'resource') return
    expect(payment.base).toBeCloseTo(skill.cost * WEAPON_DISCIPLINE_FACTOR, 10)
    expect(plainAction.cooldownReadyMs - plainAction.timeMs).toBe(plainCooldown)
    expect(action.cooldownReadyMs - action.timeMs).toBe(nodeCooldown)
    expect(node.state.hero.classResource).toBeCloseTo(0, 8)

    const driving = open({
      nodes: [NODE_DRIVING_BLOW, NODE_WEAPON_DISCIPLINE],
      equipped: [DRIVING_BLOW_ID],
      rows: [{ skillId: DRIVING_BLOW_ID }],
    })
    until(driving.state, driving.defs, (state) => skillActions(state, DRIVING_BLOW_ID).length > 0)
    const drivingAction = skillActions(driving.state, DRIVING_BLOW_ID)[0]
    if (drivingAction?.type !== 'action' || drivingAction.cooldownReadyMs === null) {
      throw new Error('missing disciplined driving blow')
    }
    const combinedBase = DRIVING_BLOW_COOLDOWN_SECONDS * WEAPON_DISCIPLINE_FACTOR
    const combined = roundDurationMs(
      finalCooldownSeconds(combinedBase, driving.state.hero.cooldownReduction),
      'driving blow discipline',
    )
    console.log('[sim]', 'driving blow discipline', {
      baseSeconds: combinedBase,
      cooldownMs: drivingAction.cooldownReadyMs - drivingAction.timeMs,
    })
    expect(combinedBase).toBeCloseTo(2.25, 10)
    expect(drivingAction.cooldownReadyMs - drivingAction.timeMs).toBe(combined)
  })

  it('unlocks Reckless Strike', () => {
    const fresh = createProgress('human', HUMAN)
    expect(fresh.learnedSkillIds).not.toContain('reckless-strike')
    expect(() => setLoadout(fresh, ['reckless-strike'])).toThrow(/unlearned/)
    const progress = learned([NODE_SUNDERING_BLOW, NODE_WEAPON_DISCIPLINE, NODE_RECKLESS_STRIKE])
    expect(progress.learnedSkillIds).toContain('reckless-strike')
    expect(setLoadout(progress, ['reckless-strike']).loadout).toEqual(['reckless-strike'])
    expect(authored('reckless-strike')).toMatchObject({
      cost: 40,
      cooldownSeconds: 8,
      actionTimeCoefficient: 1.35,
    })
    expect(authored('reckless-strike').effects).toContainEqual({ kind: 'incomingDamage', multiplier: 1.2 })
  })

  it('makes the next weapon action 25% faster after a 1.2 coefficient, down to the action-time floor', () => {
    const reckless = 'reckless-strike'
    const follow = (agility: number) => {
      const fight = open({
        nodes: [NODE_HEAVY_FOLLOW_THROUGH],
        agility,
        weapon: 'twoHanded',
        equipped: [reckless, DRIVING_BLOW_ID],
        rows: [{ skillId: reckless }, { skillId: DRIVING_BLOW_ID }],
      })
      fight.state.hero.classResource = 40
      until(fight.state, fight.defs, (state) => skillActions(state, DRIVING_BLOW_ID).length > 0)
      const action = skillActions(fight.state, DRIVING_BLOW_ID)[0]
      if (action?.type !== 'action') throw new Error('missing follow-through attack')
      return { hero: fight.state.hero, elapsed: action.nextReadyMs - action.timeMs }
    }
    const normal = follow(16)
    const floored = follow(350)
    const expected = roundDurationMs(
      actionTime(normal.hero.baseActionSeconds, 16, authored(DRIVING_BLOW_ID).actionTimeCoefficient * HEAVY_SPEED_FACTOR),
      'follow-through',
    )
    const floorExpected = roundDurationMs(
      actionTime(floored.hero.baseActionSeconds, 350, authored(DRIVING_BLOW_ID).actionTimeCoefficient * HEAVY_SPEED_FACTOR),
      'follow-through floor',
    )
    const unsped = roundDurationMs(actionTime(floored.hero.baseActionSeconds, 350, 1), 'unsped floor case')
    console.log('[sim]', 'heavy follow-through', { normal: normal.elapsed, floored: floored.elapsed, floorExpected })
    expect(normal.elapsed).toBe(expected)
    expect(floorExpected).toBe(500)
    expect(floored.elapsed).toBe(floorExpected)
    expect(unsped).toBeGreaterThan(floorExpected)

    const consumed = open({
      nodes: [NODE_HEAVY_FOLLOW_THROUGH],
      weapon: 'twoHanded',
      equipped: [reckless, DRIVING_BLOW_ID],
      rows: [{ skillId: reckless }, { skillId: DRIVING_BLOW_ID }],
      enemy: { maxHp: 1_000_000, armor: 0, evasion: 0, actionTime: 30, power: 1 },
    })
    consumed.state.hero.classResource = 40
    until(consumed.state, consumed.defs, (state) => skillActions(state, DRIVING_BLOW_ID).length > 0)
    const sped = skillActions(consumed.state, DRIVING_BLOW_ID)[0]
    if (sped?.type !== 'action') throw new Error('missing sped driving blow')
    expect(consumed.state.hero.classState.followThrough).toBeUndefined()
    delete consumed.state.hero.cooldowns[DRIVING_BLOW_ID]
    consumed.state.hero.priorityRows = [{ skillId: DRIVING_BLOW_ID }]
    consumed.state.hero.nextReadyMs = consumed.state.timeMs + 10
    const waiting = consumed.state.enemies[0]
    if (waiting === undefined) throw new Error('missing enemy')
    waiting.nextReadyMs = consumed.state.timeMs + 60_000
    until(consumed.state, consumed.defs, (state) => skillActions(state, DRIVING_BLOW_ID).length > 1)
    const followUp = skillActions(consumed.state, DRIVING_BLOW_ID)[1]
    if (followUp?.type !== 'action') throw new Error('missing follow-up driving blow')
    const spent = roundDurationMs(
      actionTime(
        consumed.state.hero.baseActionSeconds,
        consumed.state.hero.agility,
        authored(DRIVING_BLOW_ID).actionTimeCoefficient,
      ),
      'follow-through spent',
    )
    console.log('[sim]', 'heavy follow-through spent', {
      sped: sped.nextReadyMs - sped.timeMs,
      followUp: followUp.nextReadyMs - followUp.timeMs,
    })
    expect(sped.nextReadyMs - sped.timeMs).toBe(expected)
    expect(followUp.nextReadyMs - followUp.timeMs).toBe(spent)
    expect(spent).toBeGreaterThan(sped.nextReadyMs - sped.timeMs)
  })

  it('completes Perfect Form after three different weapon skills', () => {
    const loadout = [DRIVING_BLOW_ID, SUNDERING_BLOW_ID, CLEAVE_ID]
    const chain = () =>
      open({
        nodes: [NODE_WEAPON_MASTER],
        equipped: loadout,
        rows: [{ skillId: DRIVING_BLOW_ID }],
        enemy: { maxHp: 1_000_000, armor: 0, evasion: 0, actionTime: 60, power: 1 },
      })

    const formed = chain()
    useSkill(formed.state, formed.defs, DRIVING_BLOW_ID)
    useSkill(formed.state, formed.defs, SUNDERING_BLOW_ID)
    useSkill(formed.state, formed.defs, CLEAVE_ID)
    expect(formed.state.hero.classState.perfectForm).toBe(true)
    const before = formed.state.log.length
    useSkill(formed.state, formed.defs, SUNDERING_BLOW_ID, 5)
    const paid = formed.state.log.slice(before).some((event) => event.type === 'resource' && event.reason === 'payment')
    const hit = formed.state.log.slice(before).find((event) => event.type === 'damage' && event.actorId === formed.state.hero.id)
    console.log('[sim]', 'weapon master', { paid, damageFloor: hit?.type === 'damage' ? hit.damageFloor : null })
    expect(paid).toBe(false)
    if (hit?.type !== 'damage') throw new Error('missing perfect form hit')
    expect(hit.damageFloor).toBeCloseTo(0.95, 10)
    expect(hit.consistencyRoll).toBeGreaterThanOrEqual(0.95)
    expect(hit.consistencyRoll).toBeLessThan(1)

    const repeated = chain()
    useSkill(repeated.state, repeated.defs, DRIVING_BLOW_ID)
    useSkill(repeated.state, repeated.defs, SUNDERING_BLOW_ID)
    useSkill(repeated.state, repeated.defs, DRIVING_BLOW_ID)
    const repeatMark = repeated.state.log.length
    useSkill(repeated.state, repeated.defs, SUNDERING_BLOW_ID, 20)
    const repeatPay = repeated.state.log.slice(repeatMark).find((event) => event.type === 'resource' && event.reason === 'payment')
    expect(repeatPay).toMatchObject({ base: 20 })

    const dropped = chain()
    useSkill(dropped.state, dropped.defs, DRIVING_BLOW_ID)
    useSkill(dropped.state, dropped.defs, SUNDERING_BLOW_ID)
    useSkill(dropped.state, dropped.defs, CLEAVE_ID)
    dropped.state.hero.equippedSkillIds = dropped.state.hero.equippedSkillIds.filter((id) => id !== CLEAVE_ID)
    const dropMark = dropped.state.log.length
    useSkill(dropped.state, dropped.defs, SUNDERING_BLOW_ID, 20)
    const dropPay = dropped.state.log.slice(dropMark).find((event) => event.type === 'resource' && event.reason === 'payment')
    expect(dropPay).toMatchObject({ base: 20 })

    const ended = chain()
    useSkill(ended.state, ended.defs, DRIVING_BLOW_ID)
    useSkill(ended.state, ended.defs, SUNDERING_BLOW_ID)
    useSkill(ended.state, ended.defs, CLEAVE_ID)
    expect(ended.state.hero.classState.perfectForm).toBe(true)
    warriorClass.encounterEnd?.(ended.state, ended.state.timeMs)
    expect(ended.state.hero.classState.perfectForm).toBeUndefined()
    const endMark = ended.state.log.length
    useSkill(ended.state, ended.defs, SUNDERING_BLOW_ID, 20)
    const endPay = ended.state.log.slice(endMark).find((event) => event.type === 'resource' && event.reason === 'payment')
    expect(endPay).toMatchObject({ base: 20 })
  })

  it('unlocks Shield Brace', () => {
    const fresh = createProgress('human', HUMAN)
    expect(fresh.learnedSkillIds).not.toContain('shield-brace')
    expect(() => setLoadout(fresh, ['shield-brace'])).toThrow(/unlearned/)
    const progress = learned([NODE_SHIELD_BRACE])
    expect(progress.learnedSkillIds).toEqual(['shield-brace'])
    expect(setLoadout(progress, ['shield-brace']).loadout).toEqual(['shield-brace'])
    expect(authored('shield-brace').effects).toEqual([{ kind: 'damageReduction', fraction: 0.3 }])
  })

  it('unlocks Second Wind', () => {
    const fresh = createProgress('human', HUMAN)
    expect(fresh.learnedSkillIds).not.toContain('second-wind')
    expect(() => setLoadout(fresh, ['second-wind'])).toThrow(/unlearned/)
    const progress = learned([NODE_SHIELD_BRACE, NODE_SECOND_WIND])
    expect(progress.learnedSkillIds).toContain('second-wind')
    expect(setLoadout(progress, ['second-wind']).loadout).toEqual(['second-wind'])
    expect(authored('second-wind')).toMatchObject({ cost: 50, cooldownSeconds: 15 })
  })

  it('raises Fury generation and healing received by 25% below 35% HP', () => {
    const factor = spiritResourceFactor(16)
    const low = open({ nodes: [NODE_DEFIANCE], spirit: 16 })
    low.state.hero.hp = Math.floor((low.state.hero.maxHp * 350 - 1) / 1000)
    until(low.state, low.defs, (state) => resources(state, 'basicAttack').length > 0)
    const gain = resources(low.state, 'basicAttack')[0]
    const atLine = open({ nodes: [NODE_DEFIANCE], spirit: 16 })
    atLine.state.hero.hp = Math.ceil((atLine.state.hero.maxHp * 350) / 1000)
    until(atLine.state, atLine.defs, (state) => resources(state, 'basicAttack').length > 0)
    const atGain = resources(atLine.state, 'basicAttack')[0]

    const healed = open({
      nodes: [NODE_DEFIANCE],
      equipped: ['second-wind'],
      rows: [{ skillId: 'second-wind' }],
      seed: 3,
    })
    const calm = open({ equipped: ['second-wind'], rows: [{ skillId: 'second-wind' }], seed: 3 })
    const hp = Math.floor((healed.state.hero.maxHp * 350 - 1) / 1000)
    healed.state.hero.hp = hp
    calm.state.hero.hp = hp
    healed.state.hero.classResource = 50
    calm.state.hero.classResource = 50
    until(healed.state, healed.defs, (state) => state.log.some((event) => event.type === 'heal'))
    until(calm.state, calm.defs, (state) => state.log.some((event) => event.type === 'heal'))
    const hot = healed.state.log.find((event) => event.type === 'heal')
    const cold = calm.state.log.find((event) => event.type === 'heal')
    console.log('[sim]', 'defiance', { gain, hot, cold })
    if (gain?.type !== 'resource' || atGain?.type !== 'resource') throw new Error('missing defiance fury')
    if (hot?.type !== 'heal' || cold?.type !== 'heal') throw new Error('missing second wind')
    expect(gain.multiplier).toBeCloseTo(factor * 1.25, 10)
    expect(atGain.multiplier).toBe(factor)
    expect(hot.afterReceived).toBeCloseTo(cold.afterReceived * 1.25, 8)
    expect(hot.healingReceived).toBeCloseTo(cold.healingReceived * 1.25, 10)

    const exact = open({ nodes: [NODE_RISING_HEAT, NODE_DEFIANCE], spirit: 16 })
    exact.state.hero.maxHp = 200
    exact.state.hero.hp = 70
    console.log('[sim]', 'defiance exact', {
      hp: exact.state.hero.hp,
      maxHp: exact.state.hero.maxHp,
      generation: furyGenerationMultiplier(exact.state.hero),
      healing: adjustedHealingReceived(exact.state.hero),
    })
    expect(exact.state.hero.hp * 1000).toBe(exact.state.hero.maxHp * 350)
    expect(furyGenerationMultiplier(exact.state.hero)).toBeCloseTo(1.2, 10)
    expect(adjustedHealingReceived(exact.state.hero)).toBe(exact.state.hero.healingReceived)
    exact.state.hero.hp = 69
    expect(furyGenerationMultiplier(exact.state.hero)).toBeCloseTo(1.2 * 1.25, 10)
    expect(adjustedHealingReceived(exact.state.hero)).toBeCloseTo(exact.state.hero.healingReceived * 1.25, 10)
  })

  it('gives the next Driving Blow or Sundering Blow a 75% Stun chance after Shield Brace reduces damage', () => {
    const rows = [{ skillId: 'shield-brace' }, { skillId: DRIVING_BLOW_ID }]
    const equipped = ['shield-brace', DRIVING_BLOW_ID]
    const enemy = { maxHp: 50_000, armor: 0, evasion: 0, actionTime: 3, power: 30 }
    const armed = open({ nodes: [NODE_SHIELD_IMPACT], equipped, rows, enemy })
    until(armed.state, armed.defs, (state) =>
      state.log.some((event) => event.type === 'statusAttempt' && event.statusId === 'stun'),
    )
    const stun = armed.state.log.find((event) => event.type === 'statusAttempt' && event.statusId === 'stun')
    const quiet = open({ equipped, rows, enemy })
    until(quiet.state, quiet.defs, (state) => skillActions(state, DRIVING_BLOW_ID).length > 0)
    console.log('[sim]', 'shield impact', stun)
    if (stun?.type !== 'statusAttempt') throw new Error('missing stun attempt')
    expect(stun.baseChance).toBe(SHIELD_IMPACT_STUN_CHANCE)
    expect(quiet.state.log.some((event) => event.type === 'statusAttempt' && event.statusId === 'stun')).toBe(false)

    const sundering = open({
      nodes: [NODE_SHIELD_IMPACT],
      equipped: ['shield-brace', SUNDERING_BLOW_ID],
      rows: [{ skillId: 'shield-brace' }, { skillId: SUNDERING_BLOW_ID }],
      enemy,
    })
    sundering.state.hero.classResource = 100
    until(sundering.state, sundering.defs, (state) =>
      state.log.some((event) => event.type === 'statusAttempt' && event.statusId === 'stun'),
    )
    const sunderingStun = sundering.state.log.find((event) => event.type === 'statusAttempt' && event.statusId === 'stun')
    const sunderingBlow = skillActions(sundering.state, SUNDERING_BLOW_ID).find(
      (event) => event.type === 'action' && sunderingStun?.type === 'statusAttempt' && event.timeMs === sunderingStun.timeMs,
    )
    console.log('[sim]', 'shield impact sundering', sunderingStun)
    expect(sunderingStun).toMatchObject({ baseChance: SHIELD_IMPACT_STUN_CHANCE, statusId: 'stun' })
    expect(sunderingBlow?.type).toBe('action')

    const late = open({ nodes: [NODE_SHIELD_IMPACT], equipped, rows, enemy })
    until(late.state, late.defs, (state) => typeof state.hero.classState[STATE_SHIELD_IMPACT_UNTIL] === 'number')
    const untilMs = late.state.hero.classState[STATE_SHIELD_IMPACT_UNTIL]
    const reduced = late.state.log.filter((event) => event.type === 'damage' && event.targetId === late.state.hero.id)
    const hit = reduced[reduced.length - 1]
    if (typeof untilMs !== 'number' || hit?.type !== 'damage') throw new Error('missing shield impact window')
    expect(late.state.log.some((event) => event.type === 'statusAttempt' && event.statusId === 'stun')).toBe(false)
    expect(untilMs).toBe(hit.timeMs + SHIELD_IMPACT_WINDOW_MS)
    const foe = late.state.enemies[0]
    if (foe === undefined) throw new Error('missing enemy')
    late.state.hero.priorityRows = [{ skillId: DRIVING_BLOW_ID }]
    delete late.state.hero.cooldowns[DRIVING_BLOW_ID]
    foe.nextReadyMs = untilMs + 60_000
    late.state.hero.nextReadyMs = untilMs + 10
    until(
      late.state,
      late.defs,
      (state) => skillActions(state, DRIVING_BLOW_ID).some((event) => event.type === 'action' && event.timeMs > untilMs),
    )
    const lateBlow = skillActions(late.state, DRIVING_BLOW_ID).find((event) => event.type === 'action' && event.timeMs > untilMs)
    console.log('[sim]', 'shield impact expired', { untilMs, blowMs: lateBlow?.type === 'action' ? lateBlow.timeMs : null })
    expect(lateBlow?.type).toBe('action')
    expect(late.state.log.some((event) => event.type === 'statusAttempt' && event.statusId === 'stun')).toBe(false)
  })

  it('halves the Fury damage bonus, reduces damage with Fury, and cheats death once', () => {
    const state = open({ nodes: [NODE_UNBROKEN] }).state
    const outgoing = warriorClass.outgoingModifiers
    const incoming = warriorClass.incomingModifiers
    if (outgoing === undefined || incoming === undefined) throw new Error('missing warrior hooks')
    const query = { school: 'physical' as const, skill: null }
    state.hero.classResource = 0
    expect(outgoing(state, query)).toBe(1)
    expect(incoming(state, query)).toBe(1)
    state.hero.classResource = 100
    expect(outgoing(state, query)).toBeCloseTo(1.125, 10)
    expect(incoming(state, query)).toBeCloseTo(0.85, 10)
    state.hero.classResource = 50
    expect(outgoing(state, query)).toBeCloseTo(1.0625, 10)

    const saved = open({
      nodes: [NODE_UNBROKEN],
      enemy: { power: 5_000, actionTime: 1, maxHp: 1_000_000, armor: 0, evasion: 0 },
    })
    saved.state.hero.classResource = 75
    until(saved.state, saved.defs, (combat) => combat.log.some((event) => event.type === 'damage' && event.targetId === combat.hero.id))
    console.log('[sim]', 'unbroken', { hp: saved.state.hero.hp, fury: saved.state.hero.classResource, outcome: saved.state.outcome })
    expect(saved.state.hero.hp).toBe(1)
    expect(saved.state.hero.classResource).toBe(0)
    expect(saved.state.outcome).toBe('ongoing')
    saved.state.hero.classResource = 80
    saved.state.hero.hp = 10
    until(saved.state, saved.defs, (combat) => combat.outcome === 'defeat')
    expect(saved.state.outcome).toBe('defeat')

    const short = open({
      nodes: [NODE_UNBROKEN],
      enemy: { power: 5_000, actionTime: 1, maxHp: 1_000_000, armor: 0, evasion: 0 },
    })
    short.state.hero.classResource = 74
    until(short.state, short.defs, (combat) => combat.outcome !== 'ongoing')
    expect(short.state.outcome).toBe('defeat')
    expect(short.state.hero.hp).toBe(0)
  })
})
