import { describe, expect, it } from 'vitest'

import { createCombat, runCombat, stepCombat } from '../combat.ts'
import { formatEvent } from '../log.ts'
import type { CombatSetup, CombatState, EnemyDef, GameDefs, SkillDef } from '../types.ts'
import type { HeroStatInput } from '../stats.ts'
import { CLASS_HOOK_NAMES } from '../types.ts'
import { warriorClass } from './warrior.ts'
import {
  FURY_BRACE_HIT_BASE,
  FURY_GENERATOR_BASE,
  FURY_HIT_GAIN_CAP,
  FURY_MAXIMUM,
  FURY_PHYSICAL_BONUS_AT_FULL,
  FURY_SNAPSHOT_KEY,
} from './warrior.ts'
import { normalizeBasicAttackResource, spiritResourceFactor } from './resources.ts'

const ITEM_LEVEL = 20
const QUALITY = 1

function piece(kind: 'oneHanded' | 'dagger' | 'twoHanded') {
  return { id: `weapon-${kind}`, kind, itemLevel: ITEM_LEVEL, quality: QUALITY }
}

function warriorSetup(options?: {
  weapon?: 'oneHanded' | 'dagger' | 'twoHanded'
  spirit?: number
  equipped?: readonly string[]
  rows?: readonly { skillId: string; conditions?: CombatSetup['hero']['priorityRows'] }[]
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
  const hero: HeroStatInput & { id: string; name: string } = {
    id: 'ref-human-warrior',
    name: 'Warrior',
    level: 20,
    classId: 'warrior',
    attributes: { strength: 24, vitality: 22, agility: 16, intellect: 10, spirit: options?.spirit ?? 16 },
    gear: {
      mainHand: piece(weapon),
      offHand: weapon === 'twoHanded' ? null : weapon === 'dagger'
        ? { id: 'off-dagger', kind: 'dagger' as const, itemLevel: ITEM_LEVEL, quality: QUALITY }
        : { id: 'ref-shield', kind: 'shield' as const, itemLevel: ITEM_LEVEL, quality: QUALITY },
      head: armor('head'),
      chest: armor('chest'),
      hands: armor('hands'),
      feet: armor('feet'),
      accessories: [
        { id: 'ref-accessory-a', itemLevel: ITEM_LEVEL, quality: QUALITY },
        { id: 'ref-accessory-b', itemLevel: ITEM_LEVEL, quality: QUALITY },
      ] as const,
    },
  }
  return {
    hero: {
      ...hero,
      equippedSkillIds: options?.equipped,
      priorityRows: options?.rows as CombatSetup['hero']['priorityRows'],
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
      expose: { id: 'expose', name: 'Expose', kind: 'expose', durationSeconds: 8 },
    },
  }
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

describe('warrior fury', () => {
  it('keeps the fixed hook names', () => {
    expect([...CLASS_HOOK_NAMES]).toEqual([
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

  it('starts at 0, caps at 100, and clears encounter Fury when the fight ends', () => {
    const fragile = defsFor([], [dummy({ maxHp: 1 })])
    const state = createCombat(warriorSetup(), fragile, 1)
    console.log('[warrior] encounter start', {
      resource: state.hero.classResource,
      id: state.hero.classResourceId,
      max: state.hero.classResourceMax,
      scope: state.hero.classResourceScope,
    })
    expect(state.hero.classResource).toBe(0)
    expect(state.hero.classResourceId).toBe('fury')
    expect(state.hero.classResourceMax).toBe(FURY_MAXIMUM)
    expect(state.hero.classResourceScope).toBe('encounter')
    expect(state.hero.resourceRegenPerSecond).toBe(0)
    runCombat(state, fragile, 30_000)
    const cleared = resources(state, 'encounterEnd')
    console.log('[warrior] encounter end', { resource: state.hero.classResource, cleared })
    expect(state.outcome).toBe('victory')
    expect(state.hero.classResource).toBe(0)
    expect(cleared.length).toBeGreaterThan(0)
  })

  it('ignores a miss so an enemy basic attack that fails to hit adds no Fury', () => {
    const state = createCombat(warriorSetup(), defsFor([]), 1)
    const taken = warriorClass.damageTaken
    if (taken === undefined) throw new Error('warrior damageTaken is missing')
    taken(state, { hpLost: 0, hpBefore: 370, kind: 'miss', timeMs: 2200, school: 'physical' })
    console.log('[warrior] miss ignored', { resource: state.hero.classResource, logs: resources(state, 'hpLoss').length })
    expect(state.hero.classResource).toBe(0)
    expect(resources(state, 'hpLoss')).toHaveLength(0)
    expect(resources(state, 'shieldBrace')).toHaveLength(0)
  })

  it('raises physical damage to +25% at 100 Fury and leaves magical damage unchanged', () => {
    const state = createCombat(warriorSetup(), defsFor([]), 1)
    const outgoing = warriorClass.outgoingModifiers
    if (outgoing === undefined) throw new Error('warrior outgoingModifiers is missing')
    state.hero.classResource = 0
    expect(outgoing(state, { school: 'physical', skill: null })).toBe(1)
    state.hero.classResource = 100
    expect(outgoing(state, { school: 'physical', skill: null })).toBe(1 + FURY_PHYSICAL_BONUS_AT_FULL)
    expect(outgoing(state, { school: 'magical', skill: null })).toBe(1)
    state.hero.classResource = 0
    state.hero.classState = { [FURY_SNAPSHOT_KEY]: 100 }
    console.log('[warrior] snapshot multiplier', outgoing(state, { school: 'physical', skill: null }))
    expect(outgoing(state, { school: 'physical', skill: null })).toBe(1.25)
  })

  it('gains normalized basic-attack Fury only on a hit, then Spirit', () => {
    const factor = spiritResourceFactor(16)
    const state = createCombat(warriorSetup(), defsFor([]), 1)
    const resolved = warriorClass.actionResolved
    if (resolved === undefined) throw new Error('warrior actionResolved is missing')
    resolved(state, { kind: 'basicAttack', hit: false }, 0)
    expect(state.hero.classResource).toBe(0)
    resolved(state, { kind: 'basicAttack', hit: true }, 0)
    const oneHanded = normalizeBasicAttackResource(FURY_GENERATOR_BASE, state.hero.baseActionSeconds)
    console.log('[warrior] one-handed basic', { base: oneHanded, resource: state.hero.classResource, factor })
    expect(oneHanded).toBe(5)
    expect(state.hero.classResource).toBeCloseTo(5 * factor, 10)

    const dagger = createCombat(warriorSetup({ weapon: 'dagger' }), defsFor([]), 42)
    until(dagger, defsFor([]), (combat) =>
      combat.log.some((event) => event.type === 'resource' && event.reason === 'basicAttack'),
    )
    const gain = resources(dagger, 'basicAttack')[0]
    console.log('[warrior] dagger basic', { baseActionSeconds: dagger.hero.baseActionSeconds, gain })
    expect(dagger.hero.baseActionSeconds).toBe(1.5)
    expect(gain).toMatchObject({ type: 'resource' })
    if (gain?.type !== 'resource') return
    expect(gain.base).toBeCloseTo(3.75, 10)
    expect(gain.multiplier).toBeCloseTo(factor, 10)
    expect(gain.generated).toBeCloseTo(3.75 * factor, 10)
    expect(gain.generated).not.toBe(Math.round(gain.generated))
  })

  it('lets Driving Blow gain 15 and a plain generator gain 5, both after the hit', () => {
    const factor = spiritResourceFactor(16)
    const driving = skill({
      id: 'driving-blow',
      name: 'Driving Blow',
      tags: ['physical', 'attack', 'generator'],
      effects: [
        { kind: 'damage', school: 'physical', coefficient: 1.1 },
        { kind: 'resource', base: 15 },
      ],
    })
    const plain = skill({
      id: 'plain-generator',
      name: 'Plain Generator',
      tags: ['physical', 'attack', 'generator'],
      effects: [{ kind: 'damage', school: 'physical', coefficient: 1 }],
    })
    const drivingState = createCombat(
      warriorSetup({ equipped: [driving.id], rows: [{ skillId: driving.id }] }),
      defsFor([driving]),
      1,
    )
    until(drivingState, defsFor([driving]), (combat) => combat.log.some((event) => event.type === 'damage'))
    const drivingGain = resources(drivingState, driving.id)[0]
    const drivingHit = drivingState.log.find((event) => event.type === 'damage' && event.actorId === drivingState.hero.id)
    console.log('[warrior] driving blow', { gain: drivingGain, outgoing: drivingHit?.type === 'damage' ? drivingHit.outgoingModifier : null })
    expect(drivingHit).toMatchObject({ type: 'damage', outgoingModifier: 1 })
    expect(drivingGain).toMatchObject({ type: 'resource', base: 15 })
    if (drivingGain?.type !== 'resource') return
    expect(drivingGain.generated).toBeCloseTo(15 * factor, 10)
    expect(drivingState.hero.classResource).toBeCloseTo(15 * factor, 10)
    expect(resources(drivingState, 'plain')).toHaveLength(0)

    const plainState = createCombat(
      warriorSetup({ equipped: [plain.id], rows: [{ skillId: plain.id }] }),
      defsFor([plain]),
      1,
    )
    until(plainState, defsFor([plain]), (combat) => resources(combat, plain.id).length > 0)
    const plainGain = resources(plainState, plain.id)[0]
    console.log('[warrior] plain generator', plainGain)
    expect(plainGain).toMatchObject({ type: 'resource', base: FURY_GENERATOR_BASE })
  })

  it('snapshots a spender, pays, then hits with the snapshot and does not refund 5', () => {
    const cleave = skill({
      id: 'cleave',
      name: 'Cleave',
      cost: 25,
      tags: ['physical', 'attack', 'spender'],
      target: 'all',
      effects: [{ kind: 'damage', school: 'physical', coefficient: 0.8 }],
    })
    const defs = defsFor([cleave], [dummy({}, 'dummy', 'Dummy'), dummy({}, 'other', 'Other')])
    const state = createCombat(
      warriorSetup({
        equipped: [cleave.id],
        rows: [{ skillId: cleave.id }],
        enemies: [
          { defId: 'dummy', slot: 0 },
          { defId: 'other', slot: 1 },
        ],
      }),
      defs,
      1,
    )
    state.hero.classResource = 80
    until(state, defs, (combat) => combat.log.some((event) => event.type === 'damage'))
    const snapshot = state.log.find((event) => event.type === 'resourceSnapshot')
    const payment = state.log.find((event) => event.type === 'resource' && event.reason === 'payment')
    const hits = state.log.filter((event) => event.type === 'damage' && event.actorId === state.hero.id)
    const order = state.log.map((event) => event.type)
    console.log('[warrior] snapshot then pay', {
      snapshot,
      payment,
      outgoing: hits.map((event) => (event.type === 'damage' ? event.outgoingModifier : 0)),
      resource: state.hero.classResource,
    })
    expect(snapshot).toMatchObject({ type: 'resourceSnapshot', amount: 80, multiplier: 1.2 })
    expect(payment).toMatchObject({ type: 'resource', before: 80, after: 55, base: 25 })
    expect(hits).toHaveLength(2)
    for (const hit of hits) {
      if (hit.type !== 'damage') continue
      expect(hit.outgoingModifier).toBeCloseTo(1.2, 10)
      expect(hit.coefficient).toBeCloseTo(0.8, 10)
    }
    expect(state.hero.classResource).toBe(55)
    const snapshotIndex = order.indexOf('resourceSnapshot')
    const paymentIndex = state.log.findIndex((event) => event.type === 'resource' && event.reason === 'payment')
    const damageIndex = order.indexOf('damage')
    expect(snapshotIndex).toBeGreaterThan(-1)
    expect(snapshotIndex).toBeLessThan(paymentIndex)
    expect(paymentIndex).toBeLessThan(damageIndex)
  })

  it('caps one hit at 20 Fury after Spirit and keeps fractional HP loss', () => {
    const state = createCombat(warriorSetup(), defsFor([]), 1)
    const taken = warriorClass.damageTaken
    if (taken === undefined) throw new Error('warrior damageTaken is missing')
    const factor = spiritResourceFactor(state.hero.spirit)
    taken(state, { hpLost: 10, hpBefore: 370, kind: 'hit', timeMs: 1, school: 'physical' })
    const small = resources(state, 'hpLoss')[0]
    console.log('[warrior] fractional hp loss', small)
    expect(small).toMatchObject({ type: 'resource', gainCap: FURY_HIT_GAIN_CAP })
    if (small?.type !== 'resource') return
    expect(small.base).toBeCloseTo((10 / 370) * 100, 10)
    expect(small.base).not.toBe(Math.floor((10 / 370) * 100))
    expect(small.generated).toBeCloseTo(small.base * factor, 10)
    expect(small.generated).toBeLessThan(FURY_HIT_GAIN_CAP)

    const heavy = createCombat(warriorSetup(), defsFor([]), 1)
    taken(heavy, { hpLost: 370, hpBefore: 370, kind: 'hit', timeMs: 2, school: 'physical' })
    const capped = resources(heavy, 'hpLoss')[0]
    console.log('[warrior] fury cap', capped)
    expect(capped).toMatchObject({ type: 'resource', base: 100, generated: FURY_HIT_GAIN_CAP, gainCap: FURY_HIT_GAIN_CAP })

    const braced = createCombat(warriorSetup(), defsFor([]), 1)
    braced.hero.damageReduction = 0.3
    const braceHook = warriorClass.damageTaken
    if (braceHook === undefined) throw new Error('warrior damageTaken is missing')
    braceHook(braced, { hpLost: 370, hpBefore: 370, kind: 'hit', timeMs: 3, school: 'physical' })
    const braceLoss = resources(braced, 'hpLoss')[0]
    const braceBonus = resources(braced, 'shieldBrace')[0]
    console.log('[warrior] brace separate from cap', { braceLoss, braceBonus, resource: braced.hero.classResource })
    expect(braceLoss).toMatchObject({ generated: FURY_HIT_GAIN_CAP })
    expect(braceBonus).toMatchObject({ type: 'resource', base: FURY_BRACE_HIT_BASE, gainCap: null })
    if (braceBonus?.type !== 'resource') return
    expect(braceBonus.generated).toBeCloseTo(FURY_BRACE_HIT_BASE * factor, 10)
    expect(braced.hero.classResource).toBeCloseTo(FURY_HIT_GAIN_CAP + braceBonus.generated, 10)

    const ticked = createCombat(warriorSetup(), defsFor([]), 1)
    ticked.hero.damageReduction = 0.3
    braceHook(ticked, { hpLost: 37, hpBefore: 370, kind: 'statusTick', timeMs: 4, school: 'physical' })
    expect(resources(ticked, 'shieldBrace')).toHaveLength(0)
    expect(resources(ticked, 'hpLoss')).toHaveLength(1)
  })

  it('wires a real hit through the 20 Fury cap and then clears encounter Fury', () => {
    const enemy = dummy({ power: 5_000, actionTime: 1 })
    const defs = defsFor([], [enemy])
    const state = runCombat(createCombat(warriorSetup(), defs, 1), defs, 30_000)
    const loss = resources(state, 'hpLoss')[0]
    console.log('[warrior] wired cap', { outcome: state.outcome, loss, resource: state.hero.classResource })
    expect(loss).toMatchObject({ type: 'resource', generated: FURY_HIT_GAIN_CAP, gainCap: FURY_HIT_GAIN_CAP })
    if (loss?.type !== 'resource') return
    expect(loss.base).toBeCloseTo(100, 8)
    expect(state.outcome).toBe('defeat')
    expect(state.hero.classResource).toBe(0)
  })

  it('grants Shield Brace Fury only while the reduction is active, not when the brace is cast', () => {
    const brace = skill({
      id: 'shield-brace',
      name: 'Shield Brace',
      tags: ['defense'],
      requires: { offHand: 'shield' },
      effects: [{ kind: 'damageReduction', fraction: 0.3 }],
    })
    const enemy = dummy({ power: 5_000 })
    const defs = defsFor([brace], [enemy])
    const state = createCombat(warriorSetup({ equipped: [brace.id], rows: [{ skillId: brace.id }] }), defs, 1)
    until(state, defs, (combat) => combat.log.some((event) => event.type === 'action' && event.actorId === combat.hero.id))
    console.log('[warrior] after brace', { resource: state.hero.classResource, reduction: state.hero.damageReduction })
    expect(state.hero.classResource).toBe(0)
    expect(state.hero.damageReduction).toBeCloseTo(0.3, 10)
    until(state, defs, (combat) => resources(combat, 'shieldBrace').length > 0)
    const loss = resources(state, 'hpLoss')[0]
    const bonus = resources(state, 'shieldBrace')[0]
    console.log('[warrior] struck during brace', { loss, bonus })
    expect(loss).toMatchObject({ generated: FURY_HIT_GAIN_CAP, gainCap: FURY_HIT_GAIN_CAP })
    expect(bonus).toMatchObject({ base: FURY_BRACE_HIT_BASE, gainCap: null })
    expect(state.log.findIndex((event) => event.type === 'resource' && event.reason === 'hpLoss')).toBeLessThan(
      state.log.findIndex((event) => event.type === 'resource' && event.reason === 'shieldBrace'),
    )
  })

  it('keeps Reckless Strike behind a two-handed weapon and opens incoming damage', () => {
    const reckless = skill({
      id: 'reckless-strike',
      name: 'Reckless Strike',
      cost: 40,
      tags: ['physical', 'attack', 'spender'],
      requires: { mainHand: 'twoHanded' },
      effects: [
        { kind: 'damage', school: 'physical', coefficient: 2.2 },
        { kind: 'incomingDamage', multiplier: 1.2 },
      ],
    })
    const defs = defsFor([reckless])
    const shielded = createCombat(
      warriorSetup({ equipped: [reckless.id], rows: [{ skillId: reckless.id }] }),
      defs,
      1,
    )
    shielded.hero.classResource = 40
    until(shielded, defs, (combat) => combat.log.some((event) => event.type === 'action' && event.actorId === combat.hero.id))
    console.log('[warrior] reckless shielded', formatEvent(shielded.log.find((event) => event.type === 'priority' && event.decision === 'skip') ?? shielded.log[0]!))
    expect(shielded.log.some((event) => event.type === 'priority' && event.reason === 'requires twoHanded')).toBe(true)
    expect(shielded.log.some((event) => event.type === 'action' && event.skillId === reckless.id)).toBe(false)

    const slow = defsFor([reckless], [dummy({ actionTime: 30 })])
    const armed = createCombat(
      warriorSetup({ weapon: 'twoHanded', equipped: [reckless.id], rows: [{ skillId: reckless.id }] }),
      slow,
      1,
    )
    armed.hero.classResource = 40
    until(armed, slow, (combat) => combat.log.some((event) => event.type === 'damage' && event.actorId === combat.hero.id))
    const hit = armed.log.find((event) => event.type === 'damage' && event.actorId === armed.hero.id)
    console.log('[warrior] reckless armed', { hit, resource: armed.hero.classResource, incoming: armed.hero.incomingMultipliers })
    expect(hit).toMatchObject({ coefficient: 2.2 })
    if (hit?.type === 'damage') expect(hit.outgoingModifier).toBeCloseTo(1.1, 10)
    expect(armed.hero.classResource).toBe(0)
    expect(armed.hero.incomingMultipliers).toEqual([1.2])
  })

  it('matches the published Spirit resource bonus', () => {
    const warrior = spiritResourceFactor(16) - 1
    const mage = spiritResourceFactor(12) - 1
    console.log('[warrior] spirit bonus', { warrior, mage })
    expect(warrior).toBeCloseTo((0.5 * 16) / 66, 12)
    expect(mage).toBeCloseTo((0.5 * 12) / 62, 12)
    expect(warrior * 100).toBeCloseTo(12.12, 2)
    expect(mage * 100).toBeCloseTo(9.68, 2)
  })

  it('refuses Shield Brace without a shield', () => {
    const brace = skill({
      id: 'shield-brace',
      name: 'Shield Brace',
      tags: ['defense'],
      requires: { offHand: 'shield' },
      effects: [{ kind: 'damageReduction', fraction: 0.3 }],
    })
    const defs = defsFor([brace], [dummy({ actionTime: 30 })])
    const state = createCombat(
      warriorSetup({ weapon: 'twoHanded', equipped: [brace.id], rows: [{ skillId: brace.id }] }),
      defs,
      1,
    )
    until(state, defs, (combat) =>
      combat.log.some((event) => event.type === 'action' && event.actorId === combat.hero.id),
    )
    const skip = state.log.find((event) => event.type === 'priority' && event.decision === 'skip')
    console.log('[warrior] brace without shield', { skip, offHand: state.hero.offHandKind })
    expect(state.hero.offHandKind).toBeNull()
    expect(skip).toMatchObject({ reason: 'requires shield', skillId: brace.id })
    expect(state.log.some((event) => event.type === 'action' && event.skillId === brace.id)).toBe(false)
    expect(
      state.log.some(
        (event) => event.type === 'action' && event.actorId === state.hero.id && event.action === 'basicAttack',
      ),
    ).toBe(true)
  })

  it('applies a lower Spirit bonus than the reference Warrior', () => {
    const calm = skill({
      id: 'driving-blow',
      tags: ['physical', 'attack', 'generator'],
      effects: [{ kind: 'resource', base: 15 }],
    })
    const defs = defsFor([calm])
    const state = createCombat(
      warriorSetup({ spirit: 0, equipped: [calm.id], rows: [{ skillId: calm.id }] }),
      defs,
      1,
    )
    until(state, defs, (combat) => resources(combat, calm.id).length > 0)
    const gain = resources(state, calm.id)[0]
    console.log('[warrior] zero spirit', gain)
    expect(gain).toMatchObject({ multiplier: 1, generated: 15 })
    expect(spiritResourceFactor(16)).toBeGreaterThan(1)
  })
})
