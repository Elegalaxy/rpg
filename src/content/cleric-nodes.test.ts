import { describe, expect, it } from 'vitest'

import { createCombat, stepCombat } from '../sim/combat.ts'
import { syncCleric, VOW_ENDURANCE, VOW_TEMPERANCE, VOW_ZEAL, ZEAL_BASE } from '../sim/classes/cleric.ts'
import {
  BALANCE_BASIC_WRATH,
  EXALTED_FACTOR,
  EXALTED_LOCKOUT_MS,
  MEND_NODE_COEFFICIENT,
  MERCY_FACTOR,
  NODE_CONSECRATION,
  NODE_EXALTED_VOW,
  NODE_FINAL_MERCY,
  NODE_JUDGMENT,
  NODE_LIVING_SANCTUARY,
  NODE_MEND,
  NODE_PENANCE,
  NODE_RECIPROCAL_PURPOSE,
  NODE_RIGHTEOUS_FORCE,
  NODE_SACRED_BALANCE,
  NODE_SAFEGUARD,
  NODE_SMITE,
  NODE_STEADFAST_SPIRIT,
  NODE_VOWKEEPER,
  NODE_WARD,
  RECIPROCAL_FACTOR,
  RIGHTEOUS_DAMAGE,
  RIGHTEOUS_PENETRATION,
  SANCTUARY_STORE,
  SMITE_NODE_COEFFICIENT,
  VOWKEEPER_FACTOR,
  numberState,
} from '../sim/classes/clericAdjust.ts'
import { normalizeBasicAttackResource, spiritResourceFactor } from '../sim/classes/resources.ts'
import { allocateNode, createProgress, grantLegacySkillPoint } from '../sim/progression.ts'
import { classSkillBlock } from '../sim/skills.ts'
import type { CombatSetup, CombatState, EnemyDef, GameDefs, SkillDef } from '../sim/types.ts'

import { skills } from './skills.ts'
import { statuses } from './statuses.ts'
import { clericWeb } from './webs/cleric.ts'

const ITEM_LEVEL = 20
const QUALITY = 1
const HUMAN = { strength: 10, vitality: 10, agility: 10, intellect: 10, spirit: 10 }
const SPIRIT = 22

function armor(slot: 'head' | 'chest' | 'hands' | 'feet') {
  return { id: `ref-medium-${slot}`, slot, category: 'medium' as const, itemLevel: ITEM_LEVEL, quality: QUALITY }
}

type Options = {
  nodes?: readonly string[]
  equipped?: readonly string[]
  vow?: string
  enemies?: { overrides?: EnemyDef['overrides'] }[]
  faith?: number
  seed?: number
}

function open(options?: Options) {
  const enemyDefs: GameDefs['enemies'] = {}
  const placed: CombatSetup['enemies'][number][] = []
  const specs = options?.enemies ?? [{}]
  specs.forEach((spec, slot) => {
    const enemy: EnemyDef = {
      id: `dummy-${slot}`,
      name: `Dummy ${slot}`,
      level: 20,
      archetype: 'standard',
      school: 'physical',
      overrides: { maxHp: 1_000_000, armor: 0, resistance: 0, evasion: 0, actionTime: 600, power: 1, ...spec.overrides },
    }
    enemyDefs[enemy.id] = enemy
    placed.push({ defId: enemy.id, slot, revealed: false })
  })
  const defs: GameDefs = { enemies: enemyDefs, skills, statuses }
  const setup: CombatSetup = {
    hero: {
      id: 'ref-cleric',
      name: 'Cleric',
      level: 20,
      classId: 'cleric',
      attributes: { strength: 10, vitality: 22, agility: 14, intellect: 20, spirit: SPIRIT },
      gear: {
        mainHand: { id: 'weapon-caster', kind: 'caster', itemLevel: ITEM_LEVEL, quality: QUALITY },
        offHand: { id: 'shield', kind: 'shield', itemLevel: ITEM_LEVEL, quality: QUALITY },
        head: armor('head'),
        chest: armor('chest'),
        hands: armor('hands'),
        feet: armor('feet'),
        accessories: [
          { id: 'ref-accessory-a', itemLevel: ITEM_LEVEL, quality: QUALITY },
          { id: 'ref-accessory-b', itemLevel: ITEM_LEVEL, quality: QUALITY },
        ],
      },
      equippedSkillIds: options?.equipped ?? ['smite', 'mend', 'ward', 'judgment'],
      allocatedNodeIds: options?.nodes,
      startingResource: options?.faith,
      vow: options?.vow ?? VOW_ZEAL,
    },
    enemies: placed,
  }
  return { state: createCombat(setup, defs, options?.seed ?? 1), defs }
}

function actions(state: CombatState, skillId: string) {
  return state.log.filter((event) => event.type === 'action' && event.actorId === state.hero.id && event.skillId === skillId)
}

function cast(state: CombatState, defs: GameDefs, skillId: string, faith?: number): void {
  const before = actions(state, skillId).length
  state.hero.priorityRows = [{ skillId }]
  delete state.hero.cooldowns[skillId]
  if (faith !== undefined) state.hero.classResource = faith
  state.hero.nextReadyMs = state.timeMs + 10
  let steps = 0
  while (state.outcome === 'ongoing' && actions(state, skillId).length <= before) {
    stepCombat(state, defs)
    steps += 1
    if (steps > 500) throw new Error(`did not use ${skillId}`)
  }
}

function lastHit(state: CombatState) {
  const hit = state.log.filter((event) => event.type === 'damage' && event.actorId === state.hero.id).at(-1)
  if (hit?.type !== 'damage') throw new Error('missing hero hit')
  return hit
}

function lastHeal(state: CombatState) {
  const heal = state.log.filter((event) => event.type === 'heal').at(-1)
  if (heal?.type !== 'heal') throw new Error('missing heal')
  return heal
}

function resourceEvents(state: CombatState, reason: string) {
  return state.log.flatMap((event) => (event.type === 'resource' && event.reason === reason ? [event] : []))
}

function nodeId(name: string): string {
  const node = clericWeb.nodes.find((entry) => entry.name === name)
  if (node === undefined) throw new Error(`missing cleric node ${name}`)
  return node.id
}

function skillOf(id: string): SkillDef {
  const skill = skills[id]
  if (skill === undefined) throw new Error(`missing skill ${id}`)
  return skill
}

function expectUnlock(name: string, id: string, skillId: string): void {
  expect(nodeId(name)).toBe(id)
  const node = clericWeb.nodes.find((entry) => entry.id === id)
  expect(node?.unlocksSkillId).toBe(skillId)
  const line = clericWeb.nodes.filter((entry) => entry.cluster === node?.cluster && entry.index <= (node?.index ?? 0))
  let progress = createProgress('human', HUMAN)
  for (const entry of line) progress = allocateNode(grantLegacySkillPoint(progress), clericWeb, entry.id)
  expect(progress.learnedSkillIds).toContain(skillId)
}

function hurt(state: CombatState, fraction: number): void {
  state.hero.hp = state.hero.maxHp * fraction
}

/** Cast Ward, then let a strong enemy hit break into the barrier. */
function absorbWithWard(options: Options): { state: CombatState; defs: GameDefs } {
  const run = open({ ...options, enemies: [{ overrides: { actionTime: 2, power: 400 } }] })
  if (options.nodes?.includes(NODE_SACRED_BALANCE) === true) {
    run.state.hero.classState = { ...run.state.hero.classState, wrath: 100 }
  }
  cast(run.state, run.defs, 'ward', 100)
  let steps = 0
  while (
    run.state.outcome === 'ongoing' &&
    !run.state.log.some((event) => event.type === 'damage' && event.targetId === run.state.hero.id && event.barrierAbsorbed > 0)
  ) {
    stepCombat(run.state, run.defs)
    steps += 1
    if (steps > 2000) throw new Error('the barrier was never hit')
  }
  syncCleric(run.state)
  return run
}

describe('cleric nodes', () => {
  it('Smite: deals 120% instead of 100% and changes no status chance', () => {
    expect(nodeId('Smite')).toBe(NODE_SMITE)
    const plain = open()
    cast(plain.state, plain.defs, 'smite')
    const noded = open({ nodes: [NODE_SMITE] })
    cast(noded.state, noded.defs, 'smite')
    expect(lastHit(plain.state).coefficient).toBe(1)
    expect(lastHit(noded.state).coefficient).toBe(SMITE_NODE_COEFFICIENT)
    expect(noded.state.hero.statusPotency).toBe(plain.state.hero.statusPotency)
    expect(noded.state.hero.pendingCoefficient).toBeNull()
  })

  it('Vowkeeper: Zeal generates 20% more base Faith', () => {
    expect(nodeId('Vowkeeper')).toBe(NODE_VOWKEEPER)
    const plain = open()
    cast(plain.state, plain.defs, 'smite')
    const noded = open({ nodes: [NODE_VOWKEEPER] })
    cast(noded.state, noded.defs, 'smite')
    expect(resourceEvents(plain.state, VOW_ZEAL)[0]?.base).toBe(ZEAL_BASE)
    expect(resourceEvents(noded.state, VOW_ZEAL)[0]?.base).toBeCloseTo(ZEAL_BASE * VOWKEEPER_FACTOR, 10)
    const temperance = open({ nodes: [NODE_VOWKEEPER], vow: VOW_TEMPERANCE })
    hurt(temperance.state, 0.6)
    cast(temperance.state, temperance.defs, 'smite')
    expect(resourceEvents(temperance.state, VOW_TEMPERANCE)[0]?.base).toBeCloseTo(5 * VOWKEEPER_FACTOR, 10)
    const endurance = open({ nodes: [NODE_VOWKEEPER], vow: VOW_ENDURANCE, enemies: [{ overrides: { actionTime: 2, power: 50 } }] })
    cast(endurance.state, endurance.defs, 'smite')
    let steps = 0
    while (resourceEvents(endurance.state, VOW_ENDURANCE).length === 0 && steps < 2000) {
      stepCombat(endurance.state, endurance.defs)
      steps += 1
    }
    const hit = endurance.state.log.find((event) => event.type === 'damage' && event.targetId === endurance.state.hero.id)
    if (hit?.type !== 'damage') throw new Error('missing enemy hit')
    const percent = (hit.hpDamage / endurance.state.hero.maxHp) * 100
    expect(resourceEvents(endurance.state, VOW_ENDURANCE)[0]?.base).toBeCloseTo(Math.min(10, percent) * VOWKEEPER_FACTOR, 6)
  })

  it('Penance: unlocks the health-for-Faith skill without changing its output', () => {
    expectUnlock('Penance', NODE_PENANCE, 'penance')
    const { state, defs } = open({ nodes: [NODE_PENANCE], equipped: ['penance'] })
    cast(state, defs, 'penance', 0)
    expect(resourceEvents(state, 'penance')[0]?.base).toBe(25)
    expect(state.hero.hp).toBeCloseTo(state.hero.maxHp * 0.9, 6)
  })

  it('Steadfast Spirit: a vow gain below 50% HP adds 5 base Faith once per action', () => {
    expect(nodeId('Steadfast Spirit')).toBe(NODE_STEADFAST_SPIRIT)
    const healthy = open({ nodes: [NODE_STEADFAST_SPIRIT] })
    cast(healthy.state, healthy.defs, 'smite')
    expect(resourceEvents(healthy.state, 'steadfast')).toHaveLength(0)
    const low = open({ nodes: [NODE_STEADFAST_SPIRIT] })
    hurt(low.state, 0.4)
    cast(low.state, low.defs, 'smite')
    expect(resourceEvents(low.state, VOW_ZEAL)).toHaveLength(1)
    const extra = resourceEvents(low.state, 'steadfast')
    expect(extra).toHaveLength(1)
    expect(extra[0]?.base).toBe(5)
    expect(extra[0]?.multiplier).toBeCloseTo(spiritResourceFactor(SPIRIT), 10)
    cast(low.state, low.defs, 'smite')
    expect(resourceEvents(low.state, 'steadfast')).toHaveLength(2)
    const none = open({ nodes: [NODE_STEADFAST_SPIRIT] })
    hurt(none.state, 0.4)
    cast(none.state, none.defs, 'mend', 100)
    expect(resourceEvents(none.state, 'steadfast')).toHaveLength(0)
  })

  it('Exalted Vow: +50% generation, and a broken vow removes 50 Faith and locks generation for 5 seconds', () => {
    expect(nodeId('Exalted Vow')).toBe(NODE_EXALTED_VOW)
    const gain = open({ nodes: [NODE_EXALTED_VOW] })
    cast(gain.state, gain.defs, 'smite')
    expect(resourceEvents(gain.state, VOW_ZEAL)[0]?.base).toBeCloseTo(ZEAL_BASE * EXALTED_FACTOR, 10)

    const broken = open({ nodes: [NODE_EXALTED_VOW], equipped: ['smite'], enemies: [{ overrides: { evasion: 1_000_000 } }] })
    broken.state.hero.classResource = 80
    broken.state.hero.priorityRows = []
    let steps = 0
    while (!broken.state.log.some((event) => event.type === 'vow' && event.reason === 'broken') && steps < 500) {
      stepCombat(broken.state, broken.defs)
      steps += 1
    }
    const vow = broken.state.log.find((event) => event.type === 'vow' && event.reason === 'broken')
    if (vow?.type !== 'vow') throw new Error('the vow never broke')
    expect(resourceEvents(broken.state, 'vowBreak')[0]?.generated).toBe(-50)
    expect(broken.state.hero.classResource).toBe(30)
    expect(broken.state.hero.classState.vowLockoutUntilMs).toBe(vow.timeMs + EXALTED_LOCKOUT_MS)
    const locked = broken.state.hero.classResource
    cast(broken.state, broken.defs, 'smite')
    expect(broken.state.hero.classResource).toBe(locked)
    expect(resourceEvents(broken.state, VOW_ZEAL)).toHaveLength(0)
    broken.state.timeMs = vow.timeMs + EXALTED_LOCKOUT_MS
    cast(broken.state, broken.defs, 'smite')
    expect(resourceEvents(broken.state, VOW_ZEAL).length).toBeGreaterThan(0)
  })

  it('Exalted Vow: the lockout does not retrigger while active', () => {
    const { state, defs } = open({ nodes: [NODE_EXALTED_VOW], equipped: ['smite'], enemies: [{ overrides: { evasion: 1_000_000 } }] })
    state.hero.classResource = 90
    state.hero.priorityRows = []
    let steps = 0
    while (state.log.filter((event) => event.type === 'vow' && event.reason === 'broken').length < 1 && steps < 500) {
      stepCombat(state, defs)
      steps += 1
    }
    const after = state.hero.classResource
    const until = state.hero.classState.vowLockoutUntilMs as number
    while (state.timeMs < until - 100 && steps < 5000) {
      stepCombat(state, defs)
      steps += 1
    }
    expect(state.log.filter((event) => event.type === 'vow' && event.reason === 'broken')).toHaveLength(1)
    expect(state.hero.classResource).toBe(after)
  })

  it('Mend: heals 140% Healing Power instead of 120%', () => {
    expect(nodeId('Mend')).toBe(NODE_MEND)
    const plain = open()
    hurt(plain.state, 0.2)
    cast(plain.state, plain.defs, 'mend', 100)
    const noded = open({ nodes: [NODE_MEND] })
    hurt(noded.state, 0.2)
    cast(noded.state, noded.defs, 'mend', 100)
    expect(lastHeal(plain.state).healingCoefficient).toBe(1.2)
    expect(lastHeal(noded.state).healingCoefficient).toBe(MEND_NODE_COEFFICIENT)
  })

  it('Ward: unlocks the absorption skill without changing its barrier', () => {
    expectUnlock('Ward', NODE_WARD, 'ward')
    const { state, defs } = open({ nodes: [NODE_WARD] })
    const power = state.hero.healingPower
    cast(state, defs, 'ward', 100)
    expect(state.hero.barrier).toBeCloseTo(power * 1.5, 6)
  })

  it('Consecration: unlocks the field without changing its numbers', () => {
    expectUnlock('Consecration', NODE_CONSECRATION, 'consecration')
    const { state, defs } = open({ nodes: [NODE_CONSECRATION], equipped: ['consecration'] })
    cast(state, defs, 'consecration', 100)
    expect(state.hero.field).toMatchObject({ damageCoefficient: 0.35, healCoefficient: 0.25 })
  })

  it('Safeguard: each 5% of maximum HP healed or prevented refunds 1 Faith, at most 5, and overhealing gives nothing', () => {
    expect(nodeId('Safeguard')).toBe(NODE_SAFEGUARD)
    const big = open({ nodes: [NODE_SAFEGUARD] })
    hurt(big.state, 0.05)
    cast(big.state, big.defs, 'mend', 100)
    const heal = lastHeal(big.state)
    const effective = heal.targetHpAfter - heal.targetHpBefore
    const expected = Math.min(5, Math.floor(effective / (0.05 * big.state.hero.maxHp)))
    expect(expected).toBeGreaterThan(0)
    expect(resourceEvents(big.state, 'safeguard')[0]?.base).toBe(expected)
    const full = open({ nodes: [NODE_SAFEGUARD] })
    cast(full.state, full.defs, 'mend', 100)
    expect(resourceEvents(full.state, 'safeguard')).toHaveLength(0)
    const warded = absorbWithWard({ nodes: [NODE_SAFEGUARD] })
    const absorbed = warded.state.log.find((event) => event.type === 'damage' && event.barrierAbsorbed > 0)
    if (absorbed?.type !== 'damage') throw new Error('no absorption')
    const prevented = Math.min(5, Math.floor(absorbed.barrierAbsorbed / (0.05 * warded.state.hero.maxHp)))
    const refunds = resourceEvents(warded.state, 'safeguard')
    expect(prevented).toBeGreaterThan(0)
    expect(refunds[0]?.base).toBe(prevented)
    const plain = open()
    hurt(plain.state, 0.05)
    cast(plain.state, plain.defs, 'mend', 100)
    expect(resourceEvents(plain.state, 'safeguard')).toHaveLength(0)
  })

  it('Living Sanctuary: stores 30% of Consecration healing, then offers a release for 8 seconds', () => {
    expect(nodeId('Living Sanctuary')).toBe(NODE_LIVING_SANCTUARY)
    const { state, defs } = open({ nodes: [NODE_LIVING_SANCTUARY], equipped: ['consecration', 'mend'] })
    hurt(state, 0.3)
    const release = skillOf('sanctuary-release-heal')
    expect(classSkillBlock(state.hero, release, state.timeMs)).toBe('no stored Sanctuary')
    cast(state, defs, 'consecration', 100)
    const ends = state.hero.field?.expiresMs ?? 0
    let steps = 0
    while (state.timeMs <= ends && steps < 5000) {
      stepCombat(state, defs)
      steps += 1
    }
    syncCleric(state)
    const healed = state.log.flatMap((event) => (event.type === 'fieldHeal' ? [event.targetHpAfter - event.targetHpBefore] : []))
    const total = healed.reduce((sum, value) => sum + value, 0)
    expect(total).toBeGreaterThan(0)
    const stored = numberState(state.hero, 'sanctuaryStored')
    expect(stored).toBeCloseTo(Math.min(total * SANCTUARY_STORE, state.hero.maxHp * 0.5), 6)
    expect(classSkillBlock(state.hero, release, state.timeMs)).toBeNull()
    state.hero.hp = state.hero.maxHp * 0.2
    cast(state, defs, 'sanctuary-release-heal')
    const healedBy = lastHeal(state)
    expect(healedBy.healingCoefficient * state.hero.healingPower).toBeCloseTo(stored, 6)
    expect(numberState(state.hero, 'sanctuaryStored')).toBe(0)
    expect(classSkillBlock(state.hero, release, state.timeMs)).toBe('no stored Sanctuary')
    const action = actions(state, 'sanctuary-release-heal')[0]
    if (action?.type !== 'action') throw new Error('missing release action')
    expect(action.nextReadyMs - action.timeMs).toBeGreaterThan(0)
  })

  it('Living Sanctuary: the release can strike for magical damage, and the window closes after 8 seconds', () => {
    const { state, defs } = open({ nodes: [NODE_LIVING_SANCTUARY], equipped: ['consecration'] })
    hurt(state, 0.3)
    cast(state, defs, 'consecration', 100)
    const ends = state.hero.field?.expiresMs ?? 0
    let steps = 0
    while (state.timeMs <= ends && steps < 5000) {
      stepCombat(state, defs)
      steps += 1
    }
    syncCleric(state)
    const stored = numberState(state.hero, 'sanctuaryStored')
    expect(stored).toBeGreaterThan(0)
    const strike = skillOf('sanctuary-release-strike')
    cast(state, defs, 'sanctuary-release-strike')
    const hit = lastHit(state)
    expect(hit.school).toBe('magical')
    expect(hit.coefficient * state.hero.magicalPower).toBeCloseTo(stored, 6)
    expect(classSkillBlock(state.hero, strike, state.timeMs)).toBe('no stored Sanctuary')

    const late = open({ nodes: [NODE_LIVING_SANCTUARY], equipped: ['consecration'] })
    late.state.hero.classState = { ...late.state.hero.classState, sanctuaryStored: 100, sanctuaryEndsMs: 1000 }
    expect(classSkillBlock(late.state.hero, strike, 8999)).toBeNull()
    expect(classSkillBlock(late.state.hero, strike, 9000)).toBe('no stored Sanctuary')
  })

  it('Judgment: unlocks the high-cost skill without changing its damage', () => {
    expectUnlock('Judgment', NODE_JUDGMENT, 'judgment')
    const { state, defs } = open({ nodes: [NODE_JUDGMENT] })
    cast(state, defs, 'judgment', 100)
    expect(lastHit(state).coefficient).toBe(2)
    expect(lastHit(state).outgoingModifier).toBe(1)
  })

  it('Righteous Force: Faith-spending offense gains 15% damage and 10 points of penetration', () => {
    expect(nodeId('Righteous Force')).toBe(NODE_RIGHTEOUS_FORCE)
    const plain = open()
    cast(plain.state, plain.defs, 'judgment', 100)
    const noded = open({ nodes: [NODE_RIGHTEOUS_FORCE] })
    cast(noded.state, noded.defs, 'judgment', 100)
    expect(lastHit(noded.state).outgoingModifier).toBeCloseTo(lastHit(plain.state).outgoingModifier * RIGHTEOUS_DAMAGE, 10)
    expect(lastHit(noded.state).penetration).toBeCloseTo(lastHit(plain.state).penetration + RIGHTEOUS_PENETRATION, 10)
    const smite = open({ nodes: [NODE_RIGHTEOUS_FORCE] })
    cast(smite.state, smite.defs, 'smite')
    expect(lastHit(smite.state).outgoingModifier).toBe(1)
  })

  it('Reciprocal Purpose: alternating offense and defense cuts the second skill Faith cost by 20%', () => {
    expect(nodeId('Reciprocal Purpose')).toBe(NODE_RECIPROCAL_PURPOSE)
    const { state, defs } = open({ nodes: [NODE_RECIPROCAL_PURPOSE] })
    cast(state, defs, 'mend', 100)
    expect(resourceEvents(state, 'payment').at(-1)?.generated).toBe(-25)
    cast(state, defs, 'smite')
    cast(state, defs, 'mend', 100)
    expect(resourceEvents(state, 'payment').at(-1)?.generated).toBeCloseTo(-25 * RECIPROCAL_FACTOR, 10)
    cast(state, defs, 'mend', 100)
    expect(resourceEvents(state, 'payment').at(-1)?.generated).toBe(-25)
    cast(state, defs, 'mend', 100)
    cast(state, defs, 'judgment', 100)
    expect(resourceEvents(state, 'payment').at(-1)?.generated).toBeCloseTo(-50 * RECIPROCAL_FACTOR, 10)
    const plain = open()
    cast(plain.state, plain.defs, 'smite')
    cast(plain.state, plain.defs, 'mend', 100)
    expect(resourceEvents(plain.state, 'payment').at(-1)?.generated).toBe(-25)
  })

  it('Final Mercy: an effective Mend empowers the next Smite by 25%, and a kill empowers the next Mend', () => {
    expect(nodeId('Final Mercy')).toBe(NODE_FINAL_MERCY)
    const { state, defs } = open({
      nodes: [NODE_FINAL_MERCY],
      enemies: [{ overrides: { maxHp: 1 } }, {}],
    })
    hurt(state, 0.3)
    cast(state, defs, 'mend', 100)
    expect(state.hero.classState.mercyStrike).toBe(true)
    cast(state, defs, 'smite')
    expect(lastHit(state).outgoingModifier).toBeCloseTo(MERCY_FACTOR, 10)
    expect(state.hero.classState.mercyStrike).toBeUndefined()
    expect(state.enemies[0]?.alive).toBe(false)
    expect(state.hero.classState.mercyHeal).toBe(true)
    hurt(state, 0.3)
    cast(state, defs, 'mend', 100)
    expect(lastHeal(state).healingCoefficient).toBeCloseTo(1.2 * MERCY_FACTOR, 10)
    expect(state.hero.classState.mercyHeal).toBeUndefined()
    cast(state, defs, 'smite')
    expect(lastHit(state).outgoingModifier).toBeCloseTo(MERCY_FACTOR, 10)
    cast(state, defs, 'smite')
    expect(lastHit(state).outgoingModifier).toBe(1)
  })

  it('Final Mercy: a Ward that absorbs damage empowers the next Judgment and is kept as one charge', () => {
    const warded = absorbWithWard({ nodes: [NODE_FINAL_MERCY] })
    expect(warded.state.hero.classState.mercyStrike).toBe(true)
    warded.state.enemies[0]!.nextReadyMs = warded.state.timeMs + 600_000
    cast(warded.state, warded.defs, 'judgment', 100)
    expect(lastHit(warded.state).outgoingModifier).toBeCloseTo(MERCY_FACTOR, 10)
  })

  it('Sacred Balance: replaces Faith and vows with Grace and Wrath', () => {
    expect(nodeId('Sacred Balance')).toBe(NODE_SACRED_BALANCE)
    const { state } = open({ nodes: [NODE_SACRED_BALANCE], vow: 'zeal' })
    expect(state.hero.classState.vow).toBeUndefined()
    expect(numberState(state.hero, 'grace')).toBe(0)
    expect(numberState(state.hero, 'wrath')).toBe(0)
    expect(state.hero.classResource).toBe(0)
    const noVow = createCombat(
      { ...stateSetup(), hero: { ...stateSetup().hero, vow: undefined, allocatedNodeIds: [NODE_SACRED_BALANCE] } },
      defsOnly(),
      1,
    )
    expect(noVow.hero.classState.vow).toBeUndefined()
  })

  it('Sacred Balance: Smite and basic attacks give Wrath, Mend spends Wrath for Grace, Judgment spends Grace for Wrath', () => {
    const factor = spiritResourceFactor(SPIRIT)
    const { state, defs } = open({ nodes: [NODE_SACRED_BALANCE] })
    const mend = skillOf('mend')
    expect(classSkillBlock(state.hero, mend, 0)).toBe('unaffordable')
    cast(state, defs, 'smite')
    expect(numberState(state.hero, 'wrath')).toBeCloseTo(10 * factor, 6)
    expect(state.hero.classResource).toBe(0)
    state.hero.classState = { ...state.hero.classState, wrath: 60 }
    hurt(state, 0.3)
    cast(state, defs, 'mend')
    expect(numberState(state.hero, 'wrath')).toBeCloseTo(35, 6)
    expect(numberState(state.hero, 'grace')).toBeCloseTo(15 * factor, 6)
    state.hero.classState = { ...state.hero.classState, grace: 80, wrath: 0 }
    cast(state, defs, 'judgment')
    expect(numberState(state.hero, 'grace')).toBeCloseTo(30, 6)
    expect(numberState(state.hero, 'wrath')).toBeCloseTo(25 * factor, 6)
    state.hero.classState = { ...state.hero.classState, grace: 10 }
    expect(classSkillBlock(state.hero, skillOf('judgment'), state.timeMs)).toBe('unaffordable')
    const basic = open({ nodes: [NODE_SACRED_BALANCE], equipped: ['smite'] })
    basic.state.hero.priorityRows = []
    let steps = 0
    while (!basic.state.log.some((event) => event.type === 'action' && event.action === 'basicAttack') && steps < 500) {
      stepCombat(basic.state, basic.defs)
      steps += 1
    }
    const swing = basic.state.log.find((event) => event.type === 'action' && event.action === 'basicAttack')
    expect(swing).toBeDefined()
    const wrath = numberState(basic.state.hero, 'wrath')
    const gain = normalizeBasicAttackResource(BALANCE_BASIC_WRATH, basic.state.hero.baseActionSeconds) * factor
    expect(wrath === 0 || Math.abs(wrath - gain) < 1e-6).toBe(true)
  })

  it('Sacred Balance: Consecration spends 20 Grace and 20 Wrath, Penance gives 20 of each and no Faith, Ward gives Grace when it absorbs', () => {
    const factor = spiritResourceFactor(SPIRIT)
    const { state, defs } = open({ nodes: [NODE_SACRED_BALANCE], equipped: ['consecration', 'penance'] })
    state.hero.classState = { ...state.hero.classState, grace: 50, wrath: 50 }
    cast(state, defs, 'consecration')
    expect(numberState(state.hero, 'grace')).toBe(30)
    expect(numberState(state.hero, 'wrath')).toBe(30)
    cast(state, defs, 'penance')
    expect(numberState(state.hero, 'grace')).toBeCloseTo(30 + 20 * factor, 6)
    expect(numberState(state.hero, 'wrath')).toBeCloseTo(30 + 20 * factor, 6)
    expect(state.hero.classResource).toBe(0)
    expect(state.hero.hp).toBeCloseTo(state.hero.maxHp * 0.9, 6)
    const ward = absorbWithWard({ nodes: [NODE_SACRED_BALANCE] })
    expect(numberState(ward.state.hero, 'grace')).toBeCloseTo(20 * factor, 6)
  })
})

function defsOnly(): GameDefs {
  const enemy: EnemyDef = {
    id: 'dummy-0',
    name: 'Dummy',
    level: 20,
    archetype: 'standard',
    school: 'physical',
    overrides: { maxHp: 1_000_000, actionTime: 600, power: 1 },
  }
  return { enemies: { [enemy.id]: enemy }, skills, statuses }
}

function stateSetup(): CombatSetup {
  const { state } = open()
  return {
    hero: {
      id: state.hero.id,
      name: state.hero.name,
      level: 20,
      classId: 'cleric',
      attributes: { strength: 10, vitality: 22, agility: 14, intellect: 20, spirit: SPIRIT },
      gear: {
        mainHand: { id: 'weapon-caster', kind: 'caster', itemLevel: ITEM_LEVEL, quality: QUALITY },
        offHand: { id: 'shield', kind: 'shield', itemLevel: ITEM_LEVEL, quality: QUALITY },
        head: armor('head'),
        chest: armor('chest'),
        hands: armor('hands'),
        feet: armor('feet'),
        accessories: [
          { id: 'ref-accessory-a', itemLevel: ITEM_LEVEL, quality: QUALITY },
          { id: 'ref-accessory-b', itemLevel: ITEM_LEVEL, quality: QUALITY },
        ],
      },
    },
    enemies: [{ defId: 'dummy-0', slot: 0 }],
  }
}
