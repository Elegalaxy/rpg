import { describe, expect, it } from 'vitest'

import { createCombat, stepCombat } from './combat.ts'
import { formatEvent } from './log.ts'
import { assertSkillBook } from './skills.ts'
import { statusResistance, tryApplyStatus } from './statuses.ts'
import type { HeroStatInput } from './stats.ts'
import type { CombatSetup, CombatState, EnemyDef, GameDefs, SkillDef, StatusAttemptEvent, SupplyUseEvent } from './types.ts'

const ITEM_LEVEL = 20

function warriorSetup(supplies: string[] = [], rows: readonly { skillId: string }[] = []): CombatSetup {
  const armor = (slot: 'head' | 'chest' | 'hands' | 'feet') => ({
    id: `ref-heavy-${slot}`,
    slot,
    category: 'heavy' as const,
    itemLevel: ITEM_LEVEL,
    quality: 1,
  })
  const hero: HeroStatInput & { id: string; name: string } = {
    id: 'ref-human-warrior',
    name: 'Warrior',
    level: 20,
    classId: 'warrior',
    attributes: { strength: 24, vitality: 22, agility: 16, intellect: 10, spirit: 16 },
    gear: {
      mainHand: { id: 'ref-one-handed', kind: 'oneHanded', itemLevel: ITEM_LEVEL, quality: 1 },
      offHand: { id: 'ref-shield', kind: 'shield', itemLevel: ITEM_LEVEL, quality: 1 },
      head: armor('head'),
      chest: armor('chest'),
      hands: armor('hands'),
      feet: armor('feet'),
      accessories: [
        { id: 'ref-accessory-a', itemLevel: ITEM_LEVEL, quality: 1 },
        { id: 'ref-accessory-b', itemLevel: ITEM_LEVEL, quality: 1 },
      ] as const,
    },
  }
  return { hero: { ...hero, supplies, ...(rows.length > 0 ? { priorityRows: rows } : {}) }, enemies: [{ defId: 'foe', slot: 0 }] }
}

function immunitySupply(id = 'tonic', durationSeconds = 10): SkillDef {
  return {
    id,
    name: 'Tonic',
    cost: 0,
    cooldownSeconds: 0,
    actionTimeCoefficient: 0.5,
    tags: ['supply'],
    target: 'single',
    supply: true,
    effects: [{ kind: 'statusImmunity', statusIds: ['burn'], durationSeconds }],
  }
}

const FOE: EnemyDef = { id: 'foe', name: 'Foe', level: 20, archetype: 'standard', school: 'magical', overrides: { maxHp: 1_000_000, power: 0 } }

function defsWith(...skills: SkillDef[]): GameDefs {
  const defs: GameDefs = {
    enemies: { foe: FOE },
    skills: {},
    statuses: { burn: { id: 'burn', name: 'Burn', kind: 'burn', maxIntensity: 5, durationSeconds: 5, tickSeconds: 1 } },
  }
  for (const skill of skills) defs.skills[skill.id] = skill
  return defs
}

const BURN_SKILL: SkillDef = {
  id: 'ember',
  name: 'Ember',
  cost: 0,
  cooldownSeconds: 0,
  actionTimeCoefficient: 1,
  tags: ['magical'],
  target: 'single',
  effects: [{ kind: 'damage', school: 'magical', coefficient: 1 }],
}

function burnHero(state: CombatState, defs: GameDefs, timeMs: number, roll?: number): void {
  const enemy = state.enemies[0]
  if (enemy === undefined) throw new Error('missing enemy')
  tryApplyStatus({
    state,
    defs,
    source: enemy,
    target: state.hero,
    skill: BURN_SKILL,
    effect: { kind: 'applyStatus', statusId: 'burn', baseChance: 1, coefficient: 0.1 },
    timeMs,
    applyingHit: true,
    hpDamageDealt: 1,
    roll,
  })
}

function attempts(state: CombatState): StatusAttemptEvent[] {
  return state.log.filter((event): event is StatusAttemptEvent => event.type === 'statusAttempt')
}

function uses(state: CombatState): SupplyUseEvent[] {
  return state.log.filter((event): event is SupplyUseEvent => event.type === 'supplyUse')
}

describe('status immunity', () => {
  it('applies no Burn to an immune hero, logs it as immune and draws the roll like any attempt', () => {
    const defs = defsWith()
    const open = createCombat(warriorSetup(), defs, 7)
    const shielded = createCombat(warriorSetup(), defs, 7)
    shielded.hero.statusImmunity = { statusIds: ['burn'], untilMs: 10_000, name: 'Tonic' }
    burnHero(open, defs, 500)
    burnHero(shielded, defs, 500)
    expect(open.hero.statuses.burn).not.toBeNull()
    expect(shielded.hero.statuses.burn).toBeNull()
    const [event] = attempts(shielded)
    expect(event).toMatchObject({ statusId: 'burn', result: 'immune', stacks: 0, expiresMs: 10_000 })
    expect(event?.roll).toBe(attempts(open)[0]?.roll)
    expect(JSON.stringify(shielded.rng)).toBe(JSON.stringify(open.rng))
    expect(formatEvent(attempts(shielded)[0]!)).toContain('immune until 10.000s')
  })

  it('ends at its time and lets Burn land again', () => {
    const defs = defsWith()
    const state = createCombat(warriorSetup(), defs, 7)
    state.hero.statusImmunity = { statusIds: ['burn'], untilMs: 1_000, name: 'Tonic' }
    burnHero(state, defs, 1_000, 0)
    expect(state.hero.statuses.burn).toBeNull()
    burnHero(state, defs, 1_010, 0)
    expect(state.hero.statuses.burn).not.toBeNull()
  })

  it('only covers the listed statuses', () => {
    const defs = defsWith()
    const state = createCombat(warriorSetup(), defs, 7)
    state.hero.statusImmunity = { statusIds: ['chill'], untilMs: 10_000, name: 'Tonic' }
    burnHero(state, defs, 500, 0)
    expect(state.hero.statuses.burn).not.toBeNull()
  })

  it('starts when the supply is used and a second supply moves the end to the later time', () => {
    const tonic = immunitySupply()
    const defs = defsWith(tonic)
    const state = createCombat(warriorSetup(['tonic', 'tonic'], [{ skillId: 'tonic' }]), defs, 3)
    state.hero.maxHp = 1_000_000
    state.hero.hp = 1_000_000
    while (uses(state).length < 2 && state.outcome === 'ongoing' && state.timeMs < 20_000) stepCombat(state, defs)
    const [first, second] = uses(state)
    expect(first).toBeDefined()
    expect(second).toBeDefined()
    expect(second!.timeMs).toBeGreaterThan(first!.timeMs)
    expect(state.hero.statusImmunity).toEqual({ statusIds: ['burn'], untilMs: second!.timeMs + 10_000, name: 'Tonic' })
  })

  it('keeps a later end when a shorter one is drunk afterwards', () => {
    const defs = defsWith(immunitySupply('tonic', 2))
    const state = createCombat(warriorSetup(['tonic'], [{ skillId: 'tonic' }]), defs, 3)
    state.hero.statusImmunity = { statusIds: ['burn'], untilMs: 60_000, name: 'Other' }
    while (uses(state).length < 1 && state.outcome === 'ongoing' && state.timeMs < 20_000) stepCombat(state, defs)
    expect(state.hero.statusImmunity?.untilMs).toBe(60_000)
  })

  it('validates its fields', () => {
    const effect = { kind: 'statusImmunity', statusIds: ['burn'], durationSeconds: 10 } as const
    const base = { id: 'x', name: 'X', cost: 0, cooldownSeconds: 0, actionTimeCoefficient: 1, tags: ['physical'], target: 'single' } as const
    expect(() => assertSkillBook({ x: { ...base, effects: [effect] } })).not.toThrow()
    expect(() => assertSkillBook({ x: { ...base, effects: [{ ...effect, durationSeconds: 0 }] } })).toThrow()
    expect(() => assertSkillBook({ x: { ...base, effects: [{ ...effect, statusIds: [] }] } })).toThrow()
    expect(() => assertSkillBook({ x: { ...base, supply: true, effects: [effect] } })).not.toThrow()
    expect(() => assertSkillBook({ x: { ...base, supply: true, effects: [{ kind: 'damage', school: 'physical', coefficient: 1 }] } })).toThrow()
  })
})

describe('physical status resistance from gear', () => {
  it('reaches the hero in combat and lowers physical status chances only', () => {
    const defs = defsWith()
    const plain = createCombat(warriorSetup(), defs, 7)
    const setup = warriorSetup()
    const staunch = createCombat({ ...setup, hero: { ...setup.hero, statBonuses: { physicalStatusResistanceBonus: 10 } } }, defs, 7)
    expect(staunch.hero.physicalStatusResistance).toBe(10)
    expect(statusResistance(staunch.hero, 'physical') - statusResistance(plain.hero, 'physical')).toBe(10)
    expect(statusResistance(staunch.hero, 'magical')).toBe(statusResistance(plain.hero, 'magical'))
  })
})
