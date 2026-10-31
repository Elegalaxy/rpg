import { describe, expect, it } from 'vitest'

import { createCombat, stepCombat } from '../sim/combat.ts'
import { ARCANE_BOLT_ID, MANA_REGEN_PER_SECOND, mageClass } from '../sim/classes/mage.ts'
import {
  AFFINITY_BURN_FACTOR,
  AFFINITY_CHAIN_DECAY,
  AFFINITY_CHILL_EXTRA_SECONDS,
  ARCANE_BOLT_NODE_COEFFICIENT,
  ARCANE_BOLT_NODE_COST,
  ARCANE_RECOVERY_NODE_BASE,
  CONVERGENCE_RECIPES,
  EFFICIENT_COST_FACTOR,
  EFFICIENT_REGEN_FACTOR,
  GRIMOIRE_CHARGES,
  NODE_ARCANE_BOLT,
  NODE_ARCANE_RECOVERY,
  NODE_CHAIN_LIGHTNING,
  NODE_DEFENSIVE_PREPARATION,
  NODE_EFFICIENT_CHANNELING,
  NODE_ELEMENTAL_AFFINITY,
  NODE_ELEMENTAL_CONVERGENCE,
  NODE_FIREBALL,
  NODE_FROST_LANCE,
  NODE_GRAND_GRIMOIRE,
  NODE_MANA_WARD,
  NODE_OVERCAST,
  NODE_QUICK_STUDY,
  NODE_REHEARSED_CASTING,
  NODE_SPELL_MEMORY,
  OVERCAST_DAMAGE_CAP,
  REHEARSAL_DAMAGE,
  manaRegenFactor,
  parseChargeMap,
  restoreChargeText,
} from '../sim/classes/mageAdjust.ts'
import {
  createExpedition,
  SPLINTERED_ROAD_ID,
  stepExpedition,
  type ExpeditionBlueprint,
  type ExpeditionState,
} from '../sim/expedition.ts'
import { allocateNode, awardXp, createProgress, grantLegacySkillPoint } from '../sim/progression.ts'
import { skillAffordable } from '../sim/skills.ts'
import type { CombatSetup, CombatState, EnemyDef, GameDefs, SkillDef } from '../sim/types.ts'

import { skills } from './skills.ts'
import { statuses } from './statuses.ts'
import { mageWeb } from './webs/mage.ts'

const ITEM_LEVEL = 20
const QUALITY = 1
const HUMAN = { strength: 10, vitality: 10, agility: 10, intellect: 10, spirit: 10 }
const FIREBALL = 'fireball'
const FROST = 'frost-lance'
const CHAIN = 'chain-lightning'
const WARD = 'mana-ward'
const RECOVERY = 'arcane-recovery'

function armor(slot: 'head' | 'chest' | 'hands' | 'feet') {
  return { id: `ref-cloth-${slot}`, slot, category: 'cloth' as const, itemLevel: ITEM_LEVEL, quality: QUALITY }
}

type Options = {
  nodes?: readonly string[]
  equipped?: readonly string[]
  rows?: CombatSetup['hero']['priorityRows']
  enemyCount?: number
  enemy?: EnemyDef['overrides']
  seed?: number
  mageCharges?: string
  preparedSpells?: string[]
  spirit?: number
}

function mageSetup(options: Options | undefined, enemies: CombatSetup['enemies']): CombatSetup {
  return {
    hero: {
      id: 'ref-mage',
      name: 'Mage',
      level: 20,
      classId: 'mage',
      attributes: { strength: 10, vitality: 16, agility: 16, intellect: 34, spirit: options?.spirit ?? 12 },
      gear: {
        mainHand: { id: 'ref-caster', kind: 'caster', itemLevel: ITEM_LEVEL, quality: QUALITY },
        offHand: { id: 'ref-focus', kind: 'focus', itemLevel: ITEM_LEVEL, quality: QUALITY },
        head: armor('head'),
        chest: armor('chest'),
        hands: armor('hands'),
        feet: armor('feet'),
        accessories: [
          { id: 'ref-accessory-a', itemLevel: ITEM_LEVEL, quality: QUALITY },
          { id: 'ref-accessory-b', itemLevel: ITEM_LEVEL, quality: QUALITY },
        ],
      },
      equippedSkillIds: options?.equipped ?? [FIREBALL, FROST, CHAIN, WARD],
      priorityRows: options?.rows,
      allocatedNodeIds: options?.nodes,
      mageCharges: options?.mageCharges,
      preparedSpells: options?.preparedSpells,
    },
    enemies,
  }
}

function dummy(overrides: EnemyDef['overrides'] = {}, id = 'dummy', name = 'Dummy'): EnemyDef {
  return { id, name, level: 20, archetype: 'standard', school: 'physical', overrides }
}

function open(options?: Options) {
  const count = options?.enemyCount ?? 1
  const enemyDefs: GameDefs['enemies'] = {}
  const placed: CombatSetup['enemies'][number][] = []
  for (let slot = 0; slot < count; slot += 1) {
    const enemy = dummy(
      { maxHp: 1_000_000, armor: 0, resistance: 0, evasion: 0, actionTime: 60, power: 1, ...options?.enemy },
      `dummy-${slot}`,
      `Dummy ${slot}`,
    )
    enemyDefs[enemy.id] = enemy
    placed.push({ defId: enemy.id, slot, revealed: false })
  }
  const defs: GameDefs = { enemies: enemyDefs, skills, statuses }
  const state = createCombat(mageSetup(options, placed), defs, options?.seed ?? 1)
  return { state, defs }
}

function actions(state: CombatState, skillId: string) {
  return state.log.filter((event) => event.type === 'action' && event.actorId === state.hero.id && event.skillId === skillId)
}

/** Force the next hero action to be this skill. Optionally set Mana first. */
function cast(state: CombatState, defs: GameDefs, skillId: string, mana?: number): void {
  const before = actions(state, skillId).length
  state.hero.priorityRows = [{ skillId }]
  delete state.hero.cooldowns[skillId]
  if (mana !== undefined) state.hero.classResource = mana
  state.hero.nextReadyMs = state.timeMs + 10
  let steps = 0
  while (state.outcome === 'ongoing' && actions(state, skillId).length <= before) {
    stepCombat(state, defs)
    steps += 1
    if (steps > 500) throw new Error(`did not use ${skillId}`)
  }
}

function lastHeroHits(state: CombatState) {
  const action = state.log.filter((event) => event.type === 'action' && event.actorId === state.hero.id).at(-1)
  if (action === undefined) throw new Error('missing hero action')
  const hits = state.log.filter((event) => event.type === 'damage' && event.actorId === state.hero.id && event.timeMs === action.timeMs)
  return hits.flatMap((event) => (event.type === 'damage' ? [event] : []))
}

function nodeId(name: string): string {
  const node = mageWeb.nodes.find((entry) => entry.name === name)
  if (node === undefined) throw new Error(`missing mage node ${name}`)
  return node.id
}

function skillOf(id: string): SkillDef {
  const skill = skills[id]
  if (skill === undefined) throw new Error(`missing skill ${id}`)
  return skill
}

function giveBurnAndChill(state: CombatState, enemyIndex = 0): void {
  const enemy = state.enemies[enemyIndex]
  if (enemy === undefined) throw new Error('missing enemy')
  enemy.statuses.burn = {
    name: 'Burn',
    power: 100,
    penetration: 0,
    coefficient: 0.12,
    attackerLevel: 20,
    sourceId: state.hero.id,
    sourceName: state.hero.name,
    intensity: 3,
    expiresMs: 60_000,
    tickMs: 1000,
    nextTickMs: 60_000,
  }
  enemy.statuses.chill = { name: 'Chill', stacks: 2, expiresMs: 60_000, slowByStack: [0.1, 0.07, 0.05] }
}

function statusOf(state: CombatState, index: number) {
  const statuses = state.enemies[index]?.statuses
  return { burn: statuses?.burn ?? null, chill: statuses?.chill ?? null }
}

function weave(state: CombatState, defs: GameDefs, order: readonly string[]): void {
  for (const id of order) cast(state, defs, id, 100)
}

const FIRE_FROST_LIGHTNING = [FIREBALL, FROST, CHAIN]

function expectUnlock(name: string, id: string, skillId: string): void {
  expect(nodeId(name)).toBe(id)
  const node = mageWeb.nodes.find((entry) => entry.id === id)
  expect(node?.unlocksSkillId).toBe(skillId)
  const line = mageWeb.nodes.filter((entry) => entry.cluster === node?.cluster && entry.index <= (node?.index ?? 0))
  let progress = createProgress('human', HUMAN)
  for (const entry of line) progress = allocateNode(grantLegacySkillPoint(progress), mageWeb, entry.id)
  expect(progress.learnedSkillIds).toContain(skillId)
}

describe('mage nodes', () => {
  it('unlocks Fireball without changing its damage', () => {
    expectUnlock('Fireball', NODE_FIREBALL, FIREBALL)
    const plain = open({ equipped: [FIREBALL] })
    cast(plain.state, plain.defs, FIREBALL, 100)
    const noded = open({ nodes: [NODE_FIREBALL], equipped: [FIREBALL] })
    cast(noded.state, noded.defs, FIREBALL, 100)
    expect(lastHeroHits(noded.state)[0]?.coefficient).toBe(1)
    expect(lastHeroHits(noded.state)[0]?.afterIncoming).toBe(lastHeroHits(plain.state)[0]?.afterIncoming)
  })

  it('unlocks Frost Lance without changing its damage', () => {
    expectUnlock('Frost Lance', NODE_FROST_LANCE, FROST)
    const noded = open({ nodes: [NODE_FROST_LANCE], equipped: [FROST] })
    cast(noded.state, noded.defs, FROST, 100)
    expect(lastHeroHits(noded.state)[0]?.coefficient).toBe(1.1)
    expect(noded.state.hero.classResource).toBeLessThan(100)
  })

  it('unlocks Chain Lightning without changing its decay', () => {
    expectUnlock('Chain Lightning', NODE_CHAIN_LIGHTNING, CHAIN)
    const noded = open({ nodes: [NODE_CHAIN_LIGHTNING], equipped: [CHAIN], enemyCount: 3 })
    cast(noded.state, noded.defs, CHAIN, 100)
    const coefficients = lastHeroHits(noded.state).map((hit) => hit.coefficient)
    expect(coefficients[0]).toBeCloseTo(1.2, 10)
    expect(coefficients[1]).toBeCloseTo(1.2 * 0.75, 10)
    expect(coefficients[2]).toBeCloseTo(1.2 * 0.75 * 0.75, 10)
  })

  it('Elemental Affinity: Burn +10%, Chill +2 seconds, Chain Lightning keeps 85%', () => {
    expect(nodeId('Elemental Affinity')).toBe(NODE_ELEMENTAL_AFFINITY)
    let burnPower = 0
    let plainBurnPower = 0
    let chillEnd = 0
    let plainChillEnd = 0
    for (let seed = 1; seed < 40 && (burnPower === 0 || chillEnd === 0); seed += 1) {
      const plain = open({ equipped: [FIREBALL, FROST], seed })
      const noded = open({ nodes: [NODE_ELEMENTAL_AFFINITY], equipped: [FIREBALL, FROST], seed })
      cast(plain.state, plain.defs, FIREBALL, 100)
      cast(noded.state, noded.defs, FIREBALL, 100)
      const burn = noded.state.enemies[0]?.statuses.burn
      if (burn !== null && burn !== undefined && burnPower === 0) {
        burnPower = burn.power
        plainBurnPower = plain.state.enemies[0]?.statuses.burn?.power ?? 0
      }
      cast(plain.state, plain.defs, FROST, 100)
      cast(noded.state, noded.defs, FROST, 100)
      const chill = noded.state.enemies[0]?.statuses.chill
      if (chill !== null && chill !== undefined && chillEnd === 0) {
        chillEnd = chill.expiresMs
        plainChillEnd = plain.state.enemies[0]?.statuses.chill?.expiresMs ?? 0
      }
    }
    expect(plainBurnPower).toBeGreaterThan(0)
    expect(burnPower / plainBurnPower).toBeCloseTo(AFFINITY_BURN_FACTOR, 10)
    expect(chillEnd - plainChillEnd).toBe(AFFINITY_CHILL_EXTRA_SECONDS * 1000)
    const chain = open({ nodes: [NODE_ELEMENTAL_AFFINITY], equipped: [CHAIN], enemyCount: 3 })
    cast(chain.state, chain.defs, CHAIN, 100)
    const coefficients = lastHeroHits(chain.state).map((hit) => hit.coefficient)
    expect(coefficients[1]).toBeCloseTo(1.2 * AFFINITY_CHAIN_DECAY, 10)
    expect(coefficients[2]).toBeCloseTo(1.2 * AFFINITY_CHAIN_DECAY * AFFINITY_CHAIN_DECAY, 10)
  })

  it('Elemental Convergence: a sequence persists, completes into one stored spell, and a new one replaces it', () => {
    expect(nodeId('Elemental Convergence')).toBe(NODE_ELEMENTAL_CONVERGENCE)
    const { state, defs } = open({ nodes: [NODE_ELEMENTAL_CONVERGENCE] })
    cast(state, defs, FIREBALL, 100)
    cast(state, defs, FROST, 100)
    expect(state.hero.classState.convergenceSequence).toBe('fire>frost')
    expect(state.hero.classState.convergenceInvoked).toBeUndefined()
    cast(state, defs, CHAIN, 100)
    expect(state.hero.classState.convergenceInvoked).toBe('thermal-rupture')
    expect(state.hero.classState.convergenceSequence).toBeUndefined()
    weave(state, defs, [CHAIN, FROST, FIREBALL])
    expect(state.hero.classState.convergenceInvoked).toBe('supercell')
    const plain = open()
    weave(plain.state, plain.defs, FIRE_FROST_LIGHTNING)
    expect(plain.state.hero.classState.convergenceInvoked).toBeUndefined()
  })

  it('Elemental Convergence: an invoked spell costs no Mana, is consumed, and cannot be cast unless stored', () => {
    const { state, defs } = open({ nodes: [NODE_ELEMENTAL_CONVERGENCE] })
    const rupture = skillOf('thermal-rupture')
    expect(skillAffordable(state.hero, rupture)).toBe(false)
    weave(state, defs, FIRE_FROST_LIGHTNING)
    expect(skillAffordable(state.hero, rupture)).toBe(true)
    const mana = state.hero.classResource
    cast(state, defs, 'thermal-rupture')
    expect(state.hero.classResource).toBeCloseTo(mana, 5)
    expect(state.hero.classState.convergenceInvoked).toBeUndefined()
    expect(skillAffordable(state.hero, rupture)).toBe(false)
    const action = actions(state, 'thermal-rupture')[0]
    if (action?.type !== 'action') throw new Error('missing invoked action')
    expect(action.nextReadyMs - action.timeMs).toBeGreaterThan(0)
  })

  it('Convergence recipes cover all six orderings exactly once', () => {
    expect(Object.keys(CONVERGENCE_RECIPES).sort()).toEqual([
      'fire>frost>lightning',
      'fire>lightning>frost',
      'frost>fire>lightning',
      'frost>lightning>fire',
      'lightning>fire>frost',
      'lightning>frost>fire',
    ])
    expect(new Set(Object.values(CONVERGENCE_RECIPES)).size).toBe(6)
    for (const id of Object.values(CONVERGENCE_RECIPES)) expect(skills[id]).toBeDefined()
  })

  it('Thermal Rupture: Fire, Frost, Lightning deals 220%, or 330% and a 1 second delay when it consumes Burn and Chill', () => {
    const bare = open({ nodes: [NODE_ELEMENTAL_CONVERGENCE], equipped: FIRE_FROST_LIGHTNING })
    weave(bare.state, bare.defs, FIRE_FROST_LIGHTNING)
    expect(bare.state.hero.classState.convergenceInvoked).toBe('thermal-rupture')
    bare.state.enemies[0]!.statuses.burn = null
    bare.state.enemies[0]!.statuses.chill = null
    cast(bare.state, bare.defs, 'thermal-rupture')
    expect(lastHeroHits(bare.state)[0]?.coefficient).toBeCloseTo(2.2, 10)

    const primed = open({ nodes: [NODE_ELEMENTAL_CONVERGENCE], equipped: FIRE_FROST_LIGHTNING })
    weave(primed.state, primed.defs, FIRE_FROST_LIGHTNING)
    giveBurnAndChill(primed.state)
    const readyBefore = primed.state.enemies[0]!.nextReadyMs
    cast(primed.state, primed.defs, 'thermal-rupture')
    const enemy = primed.state.enemies[0]!
    expect(lastHeroHits(primed.state)[0]?.coefficient).toBeCloseTo(3.3, 10)
    expect(enemy.statuses.burn?.intensity).toBe(2)
    expect(enemy.statuses.chill?.stacks).toBe(1)
    expect(enemy.nextReadyMs - readyBefore).toBeGreaterThanOrEqual(1000)
    const delay = primed.state.log.filter((event) => event.type === 'actionDelay' && event.delayMs === 1000)
    expect(delay).toHaveLength(1)
  })

  it('Stormglass Aegis: Fire, Lightning, Frost raises a 140% barrier and the enemy that breaks it gains Burn and Chill', () => {
    const order = [FIREBALL, CHAIN, FROST]
    let verified = false
    for (let seed = 1; seed < 30 && !verified; seed += 1) {
      const { state, defs } = open({ nodes: [NODE_ELEMENTAL_CONVERGENCE], equipped: order, seed })
      weave(state, defs, order)
      expect(state.hero.classState.convergenceInvoked).toBe('stormglass-aegis')
      const power = state.hero.magicalPower
      cast(state, defs, 'stormglass-aegis')
      expect(state.hero.barrier).toBeCloseTo(power * 1.4, 6)
      const enemy = state.enemies[0]!
      enemy.statuses.burn = null
      enemy.statuses.chill = null
      state.hero.barrier = 0
      mageClass.damageTaken?.(
        state,
        { kind: 'hit', sourceId: enemy.id, barrierAbsorbed: 10, hpLost: 0, hpBefore: state.hero.hp, timeMs: state.timeMs + 5, school: 'physical' },
        defs,
      )
      expect(state.hero.classState.aegisExpiresMs).toBeUndefined()
      const after = statusOf(state, 0)
      if (after.burn !== null && after.chill !== null) {
        expect(after.burn.intensity).toBe(1)
        expect(after.chill.stacks).toBe(1)
        verified = true
      }
    }
    expect(verified).toBe(true)
  })

  it('Steam Burst: Frost, Fire, Lightning hits every enemy for 120% and pushes each 0.75 seconds', () => {
    const order = [FROST, FIREBALL, CHAIN]
    const { state, defs } = open({ nodes: [NODE_ELEMENTAL_CONVERGENCE], equipped: order, enemyCount: 3 })
    weave(state, defs, order)
    expect(state.hero.classState.convergenceInvoked).toBe('steam-burst')
    const before = state.enemies.map((enemy) => enemy.nextReadyMs)
    cast(state, defs, 'steam-burst')
    const hits = lastHeroHits(state)
    expect(hits).toHaveLength(3)
    for (const hit of hits) expect(hit.coefficient).toBeCloseTo(1.2, 10)
    state.enemies.forEach((enemy, index) => expect(enemy.nextReadyMs - (before[index] ?? 0)).toBe(750))
  })

  it('Plasma Lance: Frost, Lightning, Fire deals 180% with +30 points of penetration and applies Burn', () => {
    const order = [FROST, CHAIN, FIREBALL]
    let burned = false
    for (let seed = 1; seed < 30 && !burned; seed += 1) {
      const { state, defs } = open({ nodes: [NODE_ELEMENTAL_CONVERGENCE], equipped: order, seed })
      weave(state, defs, order)
      expect(state.hero.classState.convergenceInvoked).toBe('plasma-lance')
      const basePenetration = state.hero.magicalPenetration
      state.enemies[0]!.statuses.burn = null
      cast(state, defs, 'plasma-lance')
      const hit = lastHeroHits(state)[0]
      expect(hit?.coefficient).toBeCloseTo(1.8, 10)
      expect(hit?.penetration).toBeCloseTo(Math.min(0.8, basePenetration + 0.3), 10)
      burned = statusOf(state, 0).burn?.intensity === 1
    }
    expect(burned).toBe(true)
  })

  it('Flash Freeze: Lightning, Fire, Frost hits every enemy for 100% and applies two Chill stacks', () => {
    const order = [CHAIN, FIREBALL, FROST]
    let frozen = false
    for (let seed = 1; seed < 40 && !frozen; seed += 1) {
      const { state, defs } = open({ nodes: [NODE_ELEMENTAL_CONVERGENCE], equipped: order, enemyCount: 2, seed })
      weave(state, defs, order)
      expect(state.hero.classState.convergenceInvoked).toBe('flash-freeze')
      for (const enemy of state.enemies) enemy.statuses.chill = null
      cast(state, defs, 'flash-freeze')
      const hits = lastHeroHits(state)
      expect(hits).toHaveLength(2)
      for (const hit of hits) expect(hit.coefficient).toBeCloseTo(1, 10)
      frozen = state.enemies.every((enemy) => enemy.statuses.chill?.stacks === 2)
    }
    expect(frozen).toBe(true)
  })

  it('Supercell: Lightning, Frost, Fire deals 160% then 100% to three more, Burn on the first and Chill on the rest', () => {
    const order = [CHAIN, FROST, FIREBALL]
    let applied = false
    for (let seed = 1; seed < 60 && !applied; seed += 1) {
      const { state, defs } = open({ nodes: [NODE_ELEMENTAL_CONVERGENCE], equipped: order, enemyCount: 5, seed })
      weave(state, defs, order)
      expect(state.hero.classState.convergenceInvoked).toBe('supercell')
      for (const enemy of state.enemies) {
        enemy.statuses.burn = null
        enemy.statuses.chill = null
      }
      const before = state.enemies.map((enemy) => enemy.nextReadyMs)
      cast(state, defs, 'supercell')
      const hits = lastHeroHits(state)
      expect(hits.map((hit) => hit.coefficient)).toEqual([1.6, 1, 1, 1])
      expect(state.enemies[4]!.nextReadyMs).toBe(before[4])
      applied =
        statusOf(state, 0).burn?.intensity === 1 &&
        statusOf(state, 0).chill === null &&
        [1, 2, 3].every((index) => statusOf(state, index).chill?.stacks === 1 && statusOf(state, index).burn === null) &&
        statusOf(state, 4).chill === null
    }
    expect(applied).toBe(true)
  })

  it('Elemental Convergence: an incomplete sequence ends with the encounter', () => {
    const { state } = open({ nodes: [NODE_ELEMENTAL_CONVERGENCE] })
    state.hero.classState = { ...state.hero.classState, convergenceSequence: 'fire>frost', convergenceInvoked: 'steam-burst' }
    mageClass.encounterEnd?.(state, 1000)
    expect(state.hero.classState.convergenceSequence).toBeUndefined()
    expect(state.hero.classState.convergenceInvoked).toBeUndefined()
  })

  it('Arcane Bolt: costs 3 Mana and deals 100% instead of 90%', () => {
    expect(nodeId('Arcane Bolt')).toBe(NODE_ARCANE_BOLT)
    const plain = open({ equipped: [] })
    cast(plain.state, plain.defs, ARCANE_BOLT_ID, 100)
    const noded = open({ nodes: [NODE_ARCANE_BOLT], equipped: [] })
    cast(noded.state, noded.defs, ARCANE_BOLT_ID, 100)
    expect(lastHeroHits(plain.state)[0]?.coefficient).toBe(0.9)
    expect(lastHeroHits(noded.state)[0]?.coefficient).toBe(ARCANE_BOLT_NODE_COEFFICIENT)
    const spent = (state: CombatState) => 100 - state.hero.classResource
    expect(spent(plain.state)).toBeGreaterThanOrEqual(5)
    expect(spent(noded.state)).toBeGreaterThanOrEqual(ARCANE_BOLT_NODE_COST)
    expect(spent(noded.state)).toBeLessThan(spent(plain.state))
    expect(noded.state.hero.pendingCoefficient).toBeNull()
  })

  it('Mana Ward: unlocks the defensive skill without changing its cost or barrier', () => {
    expectUnlock('Mana Ward', NODE_MANA_WARD, WARD)
    const { state, defs } = open({ nodes: [NODE_MANA_WARD], equipped: [WARD] })
    const power = state.hero.magicalPower
    cast(state, defs, WARD, 100)
    expect(state.hero.barrier).toBeCloseTo(power, 6)
    expect(100 - state.hero.classResource).toBeGreaterThanOrEqual(30)
  })

  it('Arcane Recovery: restores 40 base Mana and returns in 8 seconds', () => {
    expect(nodeId('Arcane Recovery')).toBe(NODE_ARCANE_RECOVERY)
    const plain = open({ equipped: [RECOVERY] })
    cast(plain.state, plain.defs, RECOVERY, 10)
    const noded = open({ nodes: [NODE_ARCANE_RECOVERY], equipped: [RECOVERY] })
    cast(noded.state, noded.defs, RECOVERY, 10)
    const gain = (state: CombatState) => state.log.find((event) => event.type === 'resource' && event.reason === RECOVERY)
    expect(gain(plain.state)).toMatchObject({ base: 30 })
    expect(gain(noded.state)).toMatchObject({ base: ARCANE_RECOVERY_NODE_BASE })
    const action = (state: CombatState) => state.log.find((event) => event.type === 'action' && event.skillId === RECOVERY)
    const plainAction = action(plain.state)
    const nodedAction = action(noded.state)
    if (plainAction?.type !== 'action' || nodedAction?.type !== 'action') throw new Error('missing action')
    const plainCooldown = (plainAction.cooldownReadyMs ?? 0) - plainAction.timeMs
    const nodedCooldown = (nodedAction.cooldownReadyMs ?? 0) - nodedAction.timeMs
    expect(nodedCooldown / plainCooldown).toBeCloseTo(0.8, 3)
  })

  it('Efficient Channeling: Mana costs fall 10% and passive regeneration rises 20%', () => {
    expect(nodeId('Efficient Channeling')).toBe(NODE_EFFICIENT_CHANNELING)
    const plain = open({ equipped: [FIREBALL] })
    const noded = open({ nodes: [NODE_EFFICIENT_CHANNELING], equipped: [FIREBALL] })
    expect(plain.state.hero.resourceRegenPerSecond).toBe(MANA_REGEN_PER_SECOND)
    expect(noded.state.hero.resourceRegenPerSecond).toBeCloseTo(MANA_REGEN_PER_SECOND * EFFICIENT_REGEN_FACTOR, 10)
    expect(manaRegenFactor([NODE_EFFICIENT_CHANNELING])).toBe(EFFICIENT_REGEN_FACTOR)
    expect(manaRegenFactor([])).toBe(1)
    cast(plain.state, plain.defs, FIREBALL, 100)
    cast(noded.state, noded.defs, FIREBALL, 100)
    const paid = (state: CombatState) => state.log.find((event) => event.type === 'resource' && event.reason === 'payment')
    expect(paid(plain.state)).toMatchObject({ generated: -30 })
    expect(paid(noded.state)).toMatchObject({ generated: -30 * EFFICIENT_COST_FACTOR })
  })

  it('Overcast: missing Mana costs 0.25% maximum HP each and adds 1% damage up to 30%', () => {
    expect(nodeId('Overcast')).toBe(NODE_OVERCAST)
    const plain = open({ equipped: [FIREBALL] })
    cast(plain.state, plain.defs, FIREBALL, 100)
    const base = lastHeroHits(plain.state)[0]
    const short = open({ nodes: [NODE_OVERCAST], equipped: [FIREBALL] })
    const maxHp = short.state.hero.maxHp
    cast(short.state, short.defs, FIREBALL, 10)
    expect(short.state.hero.hp).toBeCloseTo(maxHp - 20 * 0.0025 * maxHp, 6)
    expect(lastHeroHits(short.state)[0]?.outgoingModifier).toBeCloseTo((base?.outgoingModifier ?? 1) * 1.2, 10)
    expect(short.state.hero.classState.overcastBonus).toBeUndefined()
    const empty = open({ nodes: [NODE_OVERCAST], equipped: [FIREBALL] })
    cast(empty.state, empty.defs, FIREBALL, 0)
    expect(lastHeroHits(empty.state)[0]?.outgoingModifier).toBeCloseTo(1 + OVERCAST_DAMAGE_CAP, 10)
    const logged = empty.state.log.filter((event) => event.type === 'hpLoss')
    expect(logged).toHaveLength(1)
    const without = open({ equipped: [FIREBALL] })
    without.state.hero.classResource = 10
    expect(skillAffordable(without.state.hero, skillOf(FIREBALL))).toBe(false)
  })

  it('Overcast is ineligible when its health cost would be fatal', () => {
    const { state } = open({ nodes: [NODE_OVERCAST], equipped: [FIREBALL] })
    state.hero.classResource = 0
    state.hero.hp = state.hero.maxHp * 0.05
    expect(skillAffordable(state.hero, skillOf(FIREBALL))).toBe(false)
    state.hero.hp = state.hero.maxHp * 0.5
    expect(skillAffordable(state.hero, skillOf(FIREBALL))).toBe(true)
  })

  it('Spell Memory: the chosen spell gets one charge that makes one cast cost no Mana', () => {
    expect(nodeId('Spell Memory')).toBe(NODE_SPELL_MEMORY)
    const { state, defs } = open({ nodes: [NODE_SPELL_MEMORY], equipped: [FROST, FIREBALL] })
    expect(state.hero.classState.preparedSpells).toBe(JSON.stringify([FROST]))
    expect(parseChargeMap(state.hero.classState.mageCharges as string)).toEqual({ [FROST]: 1 })
    cast(state, defs, FROST, 100)
    expect(state.hero.classResource).toBeGreaterThanOrEqual(100 - 1e-9)
    expect(parseChargeMap(state.hero.classState.mageCharges as string)).toEqual({ [FROST]: 0 })
    cast(state, defs, FROST, 100)
    expect(state.hero.classResource).toBeLessThan(100)
    cast(state, defs, FIREBALL, 100)
    expect(state.hero.classResource).toBeLessThan(100)
  })

  it('Spell Memory: the player can choose which equipped spell to prepare', () => {
    const { state } = open({ nodes: [NODE_SPELL_MEMORY], equipped: [FROST, FIREBALL], preparedSpells: [FIREBALL] })
    expect(state.hero.classState.preparedSpells).toBe(JSON.stringify([FIREBALL]))
  })

  it('Quick Study: restores one expended charge after each encounter and leaves XP alone', () => {
    expect(nodeId('Quick Study')).toBe(NODE_QUICK_STUDY)
    expect(restoreChargeText('{"a":0,"b":0}', '{"a":1,"b":1}', 1)).toBe('{"a":1,"b":0}')
    const withNode = road([NODE_SPELL_MEMORY, NODE_QUICK_STUDY])
    const without = road([NODE_SPELL_MEMORY])
    finishFirstFight(withNode)
    finishFirstFight(without)
    expect(parseChargeMap(withNode.state.hero.mageCharges ?? null)).toEqual({ [FIREBALL]: 1 })
    expect(parseChargeMap(without.state.hero.mageCharges ?? null)).toEqual({ [FIREBALL]: 0 })
    let plain = createProgress('human', HUMAN)
    let noded = allocateNode(grantLegacySkillPoint(plain), mageWeb, NODE_FIREBALL)
    plain = awardXp(plain, 60)
    noded = awardXp(noded, 60)
    expect(noded.level).toBe(plain.level)
    expect(noded.xp).toBe(plain.xp)
  })

  it('Defensive Preparation: Mana Ward gets one emergency charge usable with no Mana', () => {
    expect(nodeId('Defensive Preparation')).toBe(NODE_DEFENSIVE_PREPARATION)
    const { state, defs } = open({ nodes: [NODE_DEFENSIVE_PREPARATION], equipped: [WARD, FIREBALL] })
    expect(parseChargeMap(state.hero.classState.mageCharges as string)).toEqual({ [`${WARD}#emergency`]: 1 })
    cast(state, defs, WARD, 100)
    expect(parseChargeMap(state.hero.classState.mageCharges as string)).toEqual({ [`${WARD}#emergency`]: 1 })
    cast(state, defs, WARD, 0)
    expect(state.hero.classResource).toBeGreaterThanOrEqual(0)
    expect(parseChargeMap(state.hero.classState.mageCharges as string)).toEqual({ [`${WARD}#emergency`]: 0 })
    state.hero.classResource = 0
    delete state.hero.cooldowns[WARD]
    expect(skillAffordable(state.hero, skillOf(WARD))).toBe(false)
  })

  it('Rehearsed Casting: three different prepared spells in a row give the third +20% and 2 seconds off its cooldown', () => {
    expect(nodeId('Rehearsed Casting')).toBe(NODE_REHEARSED_CASTING)
    const nodes = [NODE_REHEARSED_CASTING, NODE_GRAND_GRIMOIRE]
    const order = [FIREBALL, FROST, CHAIN]
    const { state, defs } = open({ nodes, equipped: [...order, WARD] })
    const plainThird = open({ nodes: [NODE_GRAND_GRIMOIRE], equipped: [...order, WARD] })
    cast(state, defs, FIREBALL)
    cast(state, defs, FROST)
    expect(state.hero.classState.rehearsalSequence).toBe(`${FIREBALL},${FROST}`)
    cast(state, defs, CHAIN)
    cast(plainThird.state, plainThird.defs, FIREBALL)
    cast(plainThird.state, plainThird.defs, FROST)
    cast(plainThird.state, plainThird.defs, CHAIN)
    const third = lastHeroHits(state)[0]
    const plain = lastHeroHits(plainThird.state)[0]
    expect(third?.outgoingModifier).toBeCloseTo((plain?.outgoingModifier ?? 1) * REHEARSAL_DAMAGE, 10)
    const action = (combat: CombatState) => actions(combat, CHAIN)[0]
    const rehearsed = action(state)
    const normal = action(plainThird.state)
    if (rehearsed?.type !== 'action' || normal?.type !== 'action') throw new Error('missing action')
    const remaining = (event: typeof rehearsed, combat: CombatState) => (combat.hero.cooldowns[CHAIN] ?? 0) - event.timeMs
    expect(remaining(normal, plainThird.state) - remaining(rehearsed, state)).toBe(2000)
    expect(state.hero.classState.rehearsalSequence).toBeUndefined()
  })

  it('Rehearsed Casting: repeating a spell restarts the sequence', () => {
    const { state, defs } = open({ nodes: [NODE_REHEARSED_CASTING, NODE_GRAND_GRIMOIRE], equipped: [FIREBALL, FROST, CHAIN, WARD] })
    cast(state, defs, FIREBALL)
    cast(state, defs, FIREBALL)
    expect(state.hero.classState.rehearsalSequence).toBe(FIREBALL)
    expect(state.hero.classState.rehearsalActive).toBeUndefined()
  })

  it('Grand Grimoire: three chosen spells start with two charges and need a charge instead of Mana', () => {
    expect(nodeId('Grand Grimoire')).toBe(NODE_GRAND_GRIMOIRE)
    const { state, defs } = open({ nodes: [NODE_GRAND_GRIMOIRE], equipped: [FIREBALL, FROST, CHAIN, WARD] })
    expect(parseChargeMap(state.hero.classState.mageCharges as string)).toEqual({
      [FIREBALL]: GRIMOIRE_CHARGES,
      [FROST]: GRIMOIRE_CHARGES,
      [CHAIN]: GRIMOIRE_CHARGES,
    })
    cast(state, defs, FIREBALL, 100)
    cast(state, defs, FIREBALL, 100)
    expect(state.hero.classResource).toBeGreaterThanOrEqual(100 - 1e-9)
    expect(skillAffordable(state.hero, skillOf(FIREBALL))).toBe(false)
    expect(skillAffordable(state.hero, skillOf(WARD))).toBe(true)
    expect(skillAffordable(state.hero, skillOf(ARCANE_BOLT_ID))).toBe(true)
  })

  it('Grand Grimoire: Arcane Recovery restores one expended charge instead of Mana', () => {
    const { state, defs } = open({ nodes: [NODE_GRAND_GRIMOIRE], equipped: [FIREBALL, FROST, CHAIN, RECOVERY] })
    cast(state, defs, FIREBALL, 100)
    cast(state, defs, FIREBALL, 100)
    expect(parseChargeMap(state.hero.classState.mageCharges as string)[FIREBALL]).toBe(0)
    cast(state, defs, RECOVERY, 40)
    expect(parseChargeMap(state.hero.classState.mageCharges as string)[FIREBALL]).toBe(1)
    expect(state.log.some((event) => event.type === 'resource' && event.reason === RECOVERY)).toBe(false)
    expect(state.hero.classResource).toBeCloseTo(40, 6)
    cast(state, defs, RECOVERY, 40)
    expect(parseChargeMap(state.hero.classState.mageCharges as string)[FIREBALL]).toBe(GRIMOIRE_CHARGES)
    expect(state.log.some((event) => event.type === 'resource' && event.reason === RECOVERY)).toBe(false)
    cast(state, defs, RECOVERY, 40)
    const gains = state.log.filter((event) => event.type === 'resource' && event.reason === RECOVERY)
    expect(gains).toHaveLength(1)
    expect(gains[0]).toMatchObject({ base: 30 })
  })

  it('Grand Grimoire: restores one total charge after each encounter and town restores all', () => {
    const grimoire = road([NODE_GRAND_GRIMOIRE])
    finishFirstFight(grimoire)
    const left = parseChargeMap(grimoire.state.hero.mageCharges ?? null)
    expect(left[FIREBALL]).toBe(GRIMOIRE_CHARGES)
    expect(restoreChargeText(null, null, 1)).toBeNull()
    expect(restoreChargeText('{"x":0}', '{"x":2}', 5)).toBe('{"x":1}')
  })

  it('fights without a Mage node are unchanged', () => {
    const { state, defs } = open({ equipped: [FIREBALL] })
    cast(state, defs, FIREBALL, 100)
    expect(state.hero.classState.mageCharges).toBeUndefined()
    expect(100 - state.hero.classResource).toBeGreaterThanOrEqual(30)
    expect(state.hero.hp).toBe(state.hero.maxHp)
  })
})

function road(nodes: readonly string[]): { state: ExpeditionState; defs: GameDefs } {
  const enemy = dummy({ maxHp: 1, armor: 0, resistance: 0, evasion: 0, actionTime: 30, power: 1 })
  enemy.level = 1
  enemy.levelMin = 1
  enemy.levelMax = 20
  const fight = (id: string) => ({ id, enemies: [{ defId: enemy.id, slot: 0, level: 1 }] })
  const hero = mageSetup(
    { nodes, equipped: [FIREBALL, FROST, CHAIN, WARD], rows: [{ skillId: FIREBALL }] },
    [{ defId: enemy.id, slot: 0 }],
  ).hero
  const blueprint: ExpeditionBlueprint = {
    id: SPLINTERED_ROAD_ID,
    opening: [fight('fight-1'), fight('fight-2')],
    draw: [fight('fight-1')],
    travelGapMs: 2_000,
    retreatThresholds: [],
    hero: { ...hero, level: 20 },
  }
  return {
    state: createExpedition(blueprint, 1),
    defs: { enemies: { [enemy.id]: enemy }, skills, statuses },
  }
}

function finishFirstFight(road: { state: ExpeditionState; defs: GameDefs }): void {
  let guard = 0
  while (road.state.outcome === 'ongoing' && road.state.history.length === 0) {
    stepExpedition(road.state, road.defs)
    guard += 1
    if (guard > 50_000) throw new Error('first fight did not finish')
  }
}
