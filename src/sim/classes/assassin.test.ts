import { describe, expect, it } from 'vitest'

import { createCombat, runCombat, stepCombat } from '../combat.ts'
import { normalizeBasicAttackResource, spiritResourceFactor } from './resources.ts'
import { tryApplyStatus } from '../statuses.ts'
import type { CombatSetup, CombatState, EnemyDef, GameDefs, SkillDef } from '../types.ts'
import { assassinClass } from './assassin.ts'
import {
  ADVANTAGE_GAIN_BASE,
  ADVANTAGE_MAXIMUM,
  EXECUTE_TAG,
  MARK_EXPLOIT_TAG,
  MARK_REFRESH_FLOOR_MS,
  MARK_REMAINING_CAP_MS,
  executeCoefficient,
} from './assassin.ts'

const ITEM_LEVEL = 20
const QUALITY = 1

function armor(slot: 'head' | 'chest' | 'hands' | 'feet') {
  return { id: `ref-light-${slot}`, slot, category: 'light' as const, itemLevel: ITEM_LEVEL, quality: QUALITY }
}

function assassinSetup(options?: {
  spirit?: number
  equipped?: readonly string[]
  rows?: CombatSetup['hero']['priorityRows']
  enemies?: CombatSetup['enemies']
}): CombatSetup {
  return {
    hero: {
      id: 'ref-human-assassin',
      name: 'Assassin',
      level: 20,
      classId: 'assassin',
      attributes: { strength: 18, vitality: 16, agility: 30, intellect: 14, spirit: options?.spirit ?? 10 },
      gear: {
        mainHand: { id: 'ref-dagger', kind: 'dagger', itemLevel: ITEM_LEVEL, quality: QUALITY },
        offHand: { id: 'ref-offhand-dagger', kind: 'dagger', itemLevel: ITEM_LEVEL, quality: QUALITY },
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
    },
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
    tags: ['physical', 'attack'],
    target: 'single',
    ...overrides,
  }
}

function defsFor(skillList: readonly SkillDef[], enemies: readonly EnemyDef[] = [dummy()]): GameDefs {
  const skills: GameDefs['skills'] = {}
  for (const entry of skillList) skills[entry.id] = entry
  const book: GameDefs['enemies'] = {}
  for (const enemy of enemies) book[enemy.id] = enemy
  return {
    enemies: book,
    skills,
    statuses: {
      mark: { id: 'mark', name: 'Mark', kind: 'mark' },
      poison: { id: 'poison', name: 'Poison', kind: 'poison', maxStacks: 5, durationSeconds: 8, tickSeconds: 2 },
    },
  }
}

function resources(state: CombatState, reason: string) {
  return state.log.filter((event) => event.type === 'resource' && event.reason === reason)
}

function resolvedHook() {
  const resolved = assassinClass.actionResolved
  if (resolved === undefined) throw new Error('assassin actionResolved is missing')
  return resolved
}

describe('assassin advantage', () => {
  it('starts at 0 stacks and 0 fraction, then clears both when the encounter ends', () => {
    const defs = defsFor([], [dummy({ maxHp: 1 })])
    const state = createCombat(assassinSetup(), defs, 1)
    console.log('[assassin] encounter start', {
      stacks: state.hero.classResource,
      fraction: state.hero.resourceFraction,
      scope: state.hero.classResourceScope,
    })
    expect(state.hero.classResource).toBe(0)
    expect(state.hero.resourceFraction).toBe(0)
    expect(state.hero.classResourceId).toBe('advantage')
    expect(state.hero.classResourceMax).toBe(ADVANTAGE_MAXIMUM)
    expect(state.hero.classResourceScope).toBe('encounter')
    runCombat(state, defs, 30_000)
    expect(state.outcome).toBe('victory')
    expect(state.hero.classResource).toBe(0)
    expect(state.hero.resourceFraction).toBe(0)
  })

  it('grants one Advantage credit when a critical hit and Mark exploitation happen together', () => {
    const defs = defsFor([
      skill({ id: 'shadow-cut', tags: ['physical', 'attack', MARK_EXPLOIT_TAG], effects: [{ kind: 'damage', school: 'physical', coefficient: 1.1 }] }),
      skill({ id: 'fan-of-knives', target: 'all', effects: [{ kind: 'damage', school: 'physical', coefficient: 0.7 }] }),
    ])
    const state = createCombat(assassinSetup(), defs, 1)
    const enemy = state.enemies[0]
    if (enemy === undefined) throw new Error('missing enemy')
    enemy.statuses.mark = { name: 'Mark', expiresMs: 20_000, sourceId: state.hero.id, sourceName: state.hero.name }
    const factor = spiritResourceFactor(10)
    const shadow = defs.skills['shadow-cut']
    if (shadow === undefined) throw new Error('missing shadow cut')
    resolvedHook()(
      state,
      {
        kind: 'skill',
        skill: shadow,
        targetId: enemy.id,
        crit: true,
        strikes: [{ targetId: enemy.id, hit: true, crit: true }],
      },
      1000,
    )
    const gains = state.log.filter(
      (event) =>
        event.type === 'resource' &&
        (event.reason === 'critical' || event.reason === 'mark' || event.reason === 'criticalAndMark'),
    )
    console.log('[assassin] one gain cap', { gains, stacks: state.hero.classResource, fraction: state.hero.resourceFraction })
    expect(gains).toHaveLength(1)
    expect(gains[0]).toMatchObject({ type: 'resource', reason: 'criticalAndMark', base: ADVANTAGE_GAIN_BASE })
    if (gains[0]?.type !== 'resource') return
    expect(gains[0].generated).toBeCloseTo(factor, 10)
    expect(gains[0].base).not.toBeCloseTo(normalizeBasicAttackResource(1, state.hero.baseActionSeconds), 5)
    expect(state.hero.classResource).toBe(1)

    const fan = defs.skills['fan-of-knives']
    if (fan === undefined) throw new Error('missing fan')
    const before = state.log.length
    resolvedHook()(
      state,
      {
        kind: 'skill',
        skill: fan,
        crit: true,
        strikes: [
          { targetId: enemy.id, hit: true, crit: true },
          { targetId: 'dummy#1', hit: true, crit: true },
        ],
      },
      2000,
    )
    const second = state.log.slice(before).filter((event) => event.type === 'resource')
    expect(second).toHaveLength(1)
    expect(state.hero.classResource).toBe(2)
  })

  it('keeps fractional Spirit progress, converts one banked stack later, and discards whole stacks at 5', () => {
    const defs = defsFor([])
    const state = createCombat(assassinSetup(), defs, 1)
    const factor = spiritResourceFactor(10)
    expect(factor - 1).toBeCloseTo(0.5 * 10 / 60, 10)
    const hook = resolvedHook()
    const crit = () =>
      hook(state, { kind: 'basicAttack', hit: true, crit: true, targetId: 'dummy#0' }, state.hero.classResource)
    crit()
    console.log('[assassin] first credit', {
      stacks: state.hero.classResource,
      fraction: state.hero.resourceFraction,
      factor,
    })
    expect(state.hero.classResource).toBe(1)
    expect(state.hero.resourceFraction).toBeCloseTo(factor - 1, 10)

    state.hero.classResource = 2
    state.hero.resourceFraction = 0.95
    crit()
    expect(state.hero.classResource).toBe(3)
    expect(state.hero.resourceFraction).toBeCloseTo(0.95 + factor - 1, 10)
    expect(state.hero.resourceFraction).toBeGreaterThanOrEqual(1)
    const banked = state.hero.resourceFraction
    crit()
    console.log('[assassin] banked conversion', { stacks: state.hero.classResource, fraction: state.hero.resourceFraction })
    expect(state.hero.classResource).toBe(4)
    expect(state.hero.resourceFraction).toBeCloseTo(banked + factor - 1, 10)

    state.hero.classResource = ADVANTAGE_MAXIMUM
    state.hero.resourceFraction = 0.2
    crit()
    expect(state.hero.classResource).toBe(ADVANTAGE_MAXIMUM)
    expect(state.hero.resourceFraction).toBeCloseTo(0.2 + factor - 1, 10)
    expect(state.hero.resourceFraction).toBeLessThan(1)
  })

  it('moves Mark to the new target and caps a refresh at 12 seconds', () => {
    const defs = defsFor([
      skill({
        id: 'mark-for-death',
        tags: ['mark'],
        effects: [{ kind: 'applyStatus', statusId: 'mark', baseChance: 1, durationSeconds: 8 }],
      }),
    ])
    const markSkill = defs.skills['mark-for-death']
    if (markSkill === undefined) throw new Error('missing mark skill')
    const state = createCombat(
      assassinSetup({ enemies: [{ defId: 'dummy', slot: 0 }, { defId: 'other', slot: 1 }] }),
      defsFor([markSkill], [dummy(), dummy({}, 'other', 'Other')]),
      1,
    )
    const first = state.enemies[0]
    const second = state.enemies[1]
    if (first === undefined || second === undefined) throw new Error('missing enemies')
    const effect = markSkill.effects[0]
    if (effect === undefined || effect.kind !== 'applyStatus') throw new Error('missing mark effect')
    tryApplyStatus({
      state,
      defs,
      source: state.hero,
      target: first,
      skill: markSkill,
      effect,
      timeMs: 1000,
      applyingHit: false,
      hpDamageDealt: 0,
    })
    tryApplyStatus({
      state,
      defs,
      source: state.hero,
      target: second,
      skill: markSkill,
      effect,
      timeMs: 2000,
      applyingHit: false,
      hpDamageDealt: 0,
    })
    console.log('[assassin] mark moved', {
      first: first.statuses.mark,
      second: second.statuses.mark?.expiresMs,
    })
    expect(first.statuses.mark).toBeNull()
    expect(second.statuses.mark?.expiresMs).toBe(2000 + 8000)
    expect(state.log.some((event) => event.type === 'statusCleared' && event.reason === 'moved' && event.actorId === first.id)).toBe(true)

    const hook = resolvedHook()
    const timeMs = 5000
    second.statuses.mark = { name: 'Mark', expiresMs: timeMs + 10_000, sourceId: state.hero.id, sourceName: state.hero.name }
    hook(state, { kind: 'basicAttack', hit: true, crit: false, targetId: second.id }, timeMs)
    expect(second.statuses.mark?.expiresMs).toBe(timeMs + 10_000)
    expect(state.hero.classResource).toBe(0)

    second.statuses.mark.expiresMs = timeMs + 3000
    hook(state, { kind: 'basicAttack', hit: true, crit: false, targetId: second.id }, timeMs)
    expect(second.statuses.mark.expiresMs).toBe(timeMs + MARK_REFRESH_FLOOR_MS)

    second.statuses.mark.expiresMs = timeMs + 13_000
    hook(state, { kind: 'basicAttack', hit: true, crit: false, targetId: second.id }, timeMs)
    expect(second.statuses.mark.expiresMs).toBe(timeMs + MARK_REMAINING_CAP_MS)

    const before = second.statuses.mark.expiresMs
    hook(state, { kind: 'basicAttack', hit: false, crit: false, targetId: second.id }, timeMs)
    expect(second.statuses.mark.expiresMs).toBe(before)
    expect(state.hero.classResource).toBe(0)
  })

  it('uses the Execute coefficient for fixed stacks and missing health, then clears a crit stack at encounter end', () => {
    const execute = skill({
      id: 'execute',
      tags: ['physical', 'attack', EXECUTE_TAG],
      cooldownSeconds: 8,
      actionTimeCoefficient: 1.1,
      effects: [{ kind: 'damage', school: 'physical', coefficient: 1 }],
    })
    const defs = defsFor([execute], [dummy({ maxHp: 10_000 })])
    const state = createCombat(assassinSetup({ equipped: ['execute'], rows: [{ skillId: 'execute' }] }), defs, 1)
    const enemy = state.enemies[0]
    if (enemy === undefined) throw new Error('missing enemy')
    enemy.hp = 4000
    state.hero.classResource = 2
    state.hero.resourceFraction = 0.25
    state.hero.critChance = 0
    const expected = executeCoefficient(2, (enemy.maxHp - enemy.hp) / enemy.maxHp)
    expect(expected).toBeCloseTo(1.8 * 1.3, 10)
    let steps = 0
    while (state.outcome === 'ongoing' && !state.log.some((event) => event.type === 'damage' && event.actorId === state.hero.id)) {
      stepCombat(state, defs)
      steps += 1
      if (steps > 5000) throw new Error('Execute did not land')
    }
    const hit = state.log.find((event) => event.type === 'damage' && event.actorId === state.hero.id)
    const spent = resources(state, 'execute')[0]
    console.log('[assassin] execute formula', { expected, coefficient: hit && hit.type === 'damage' ? hit.coefficient : null, spent })
    expect(hit).toMatchObject({ type: 'damage', coefficient: expected, school: 'physical' })
    expect(spent).toMatchObject({ type: 'resource', before: 2, after: 0, fractionBefore: 0.25, fractionAfter: 0.25 })
    expect(state.hero.resourceFraction).toBeCloseTo(0.25, 10)

    const finisher = createCombat(
      assassinSetup({ equipped: ['execute'], rows: [{ skillId: 'execute' }] }),
      defsFor([execute], [dummy({ maxHp: 1 })]),
      1,
    )
    finisher.hero.classResource = 4
    finisher.hero.resourceFraction = 0.2
    finisher.hero.critChance = 1
    runCombat(finisher, defsFor([execute], [dummy({ maxHp: 1 })]), 30_000)
    const resourceEvents = finisher.log.filter((event) => event.type === 'resource')
    const reasons = resourceEvents.map((event) => event.reason)
    const spentAt = reasons.lastIndexOf('execute')
    const gainAt = reasons.lastIndexOf('critical')
    const clearAt = reasons.lastIndexOf('encounterEnd')
    const spentStacks = resourceEvents[spentAt]
    const gained = resourceEvents[gainAt]
    console.log('[assassin] crit execute end', {
      outcome: finisher.outcome,
      reasons,
      spent: spentStacks,
      gained,
      stacks: finisher.hero.classResource,
      fraction: finisher.hero.resourceFraction,
    })
    expect(finisher.outcome).toBe('victory')
    expect(spentAt).toBeGreaterThan(-1)
    expect(gainAt).toBeGreaterThan(spentAt)
    expect(clearAt).toBeGreaterThan(gainAt)
    expect(spentStacks).toMatchObject({ reason: 'execute', after: 0 })
    if (spentStacks?.type === 'resource') expect(spentStacks.fractionAfter).toBe(spentStacks.fractionBefore)
    expect(gained).toMatchObject({ reason: 'critical', before: 0, after: 1 })
    expect(finisher.hero.classResource).toBe(0)
    expect(finisher.hero.resourceFraction).toBe(0)
  })

  it('does not change Venom Edge damage when Advantage is full, and a basic crit still uses the critical trigger', () => {
    const venom = skill({
      id: 'venom-edge',
      effects: [
        { kind: 'damage', school: 'physical', coefficient: 0.9 },
        { kind: 'applyStatus', statusId: 'poison', baseChance: 1, coefficient: 0.12, power: 'physical' },
      ],
    })
    const defs = defsFor([venom])
    const state = createCombat(assassinSetup({ equipped: ['venom-edge'], rows: [{ skillId: 'venom-edge' }] }), defs, 1)
    const enemy = state.enemies[0]
    if (enemy === undefined) throw new Error('missing enemy')
    enemy.statuses.mark = { name: 'Mark', expiresMs: 30_000, sourceId: state.hero.id, sourceName: state.hero.name }
    state.hero.classResource = 5
    state.hero.resourceFraction = 0.4
    state.hero.critChance = 0
    let steps = 0
    while (state.outcome === 'ongoing' && !state.log.some((event) => event.type === 'damage' && event.actorId === state.hero.id)) {
      stepCombat(state, defs)
      steps += 1
      if (steps > 5000) throw new Error('Venom Edge did not land')
    }
    const hit = state.log.find((event) => event.type === 'damage' && event.actorId === state.hero.id)
    console.log('[assassin] venom unchanged', {
      coefficient: hit && hit.type === 'damage' ? hit.coefficient : null,
      outgoing: hit && hit.type === 'damage' ? hit.outgoingModifier : null,
    })
    expect(hit).toMatchObject({ type: 'damage', coefficient: 0.9, outgoingModifier: 1 })
    expect(resources(state, 'mark')).toHaveLength(0)
    expect(resources(state, 'criticalAndMark')).toHaveLength(0)

    const critBasic = createCombat(assassinSetup(), defsFor([]), 1)
    const marked = critBasic.enemies[0]
    if (marked === undefined) throw new Error('missing enemy')
    marked.statuses.mark = { name: 'Mark', expiresMs: 20_000, sourceId: critBasic.hero.id, sourceName: critBasic.hero.name }
    resolvedHook()(critBasic, { kind: 'basicAttack', hit: true, crit: true, targetId: marked.id }, 1000)
    expect(resources(critBasic, 'critical')).toHaveLength(1)
    expect(resources(critBasic, 'mark')).toHaveLength(0)
    expect(resources(critBasic, 'criticalAndMark')).toHaveLength(0)
  })

  it('grants Advantage for a successful evasion and ignores a hit', () => {
    const state = createCombat(assassinSetup(), defsFor([]), 1)
    const taken = assassinClass.damageTaken
    if (taken === undefined) throw new Error('assassin damageTaken is missing')
    taken(state, { hpLost: 0, hpBefore: state.hero.hp, kind: 'miss', timeMs: 2200, school: 'physical' })
    console.log('[assassin] evasion', { stacks: state.hero.classResource, fraction: state.hero.resourceFraction })
    expect(resources(state, 'evasion')).toHaveLength(1)
    expect(state.hero.classResource).toBe(1)
    const before = state.hero.resourceFraction
    taken(state, { hpLost: 0, hpBefore: state.hero.hp, kind: 'hit', timeMs: 3000, school: 'physical' })
    expect(state.hero.resourceFraction).toBe(before)
  })
})
