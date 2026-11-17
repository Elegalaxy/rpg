import { describe, expect, it } from 'vitest'

import { WARD_UP_REASON, skipReason } from './automation.ts'
import { createCombat, stepCombat } from './combat.ts'
import { formatEvent } from './log.ts'
import { assertSkillBook } from './skills.ts'
import type { HeroStatInput } from './stats.ts'
import type {
  CombatSetup,
  CombatState,
  DamageEvent,
  EnemyDef,
  EnemySkillDef,
  GameDefs,
  LogEvent,
  SkillDef,
  TelegraphWardEffect,
} from './types.ts'

const ITEM_LEVEL = 20
const QUALITY = 1
const HERO_ID = 'ref-human-warrior'

function warriorSetup(supplies: string[] = [], rows: readonly { skillId: string }[] = []): CombatSetup {
  const armor = (slot: 'head' | 'chest' | 'hands' | 'feet') => ({
    id: `ref-heavy-${slot}`,
    slot,
    category: 'heavy' as const,
    itemLevel: ITEM_LEVEL,
    quality: QUALITY,
  })
  const hero: HeroStatInput & { id: string; name: string } = {
    id: HERO_ID,
    name: 'Warrior',
    level: 20,
    classId: 'warrior',
    attributes: { strength: 24, vitality: 22, agility: 16, intellect: 10, spirit: 16 },
    gear: {
      mainHand: { id: 'ref-one-handed', kind: 'oneHanded', itemLevel: ITEM_LEVEL, quality: QUALITY },
      offHand: { id: 'ref-shield', kind: 'shield', itemLevel: ITEM_LEVEL, quality: QUALITY },
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
    hero: { ...hero, supplies, ...(rows.length > 0 ? { priorityRows: rows } : {}) },
    enemies: [{ defId: 'foe', slot: 0 }],
  }
}

function wardSupply(id: string, eliteDamageFraction: number, charges?: number, durationSeconds = 5): SkillDef {
  return {
    id,
    name: id,
    cost: 0,
    cooldownSeconds: 0,
    actionTimeCoefficient: 0.5,
    tags: ['supply'],
    target: 'single',
    supply: true,
    effects: [{ kind: 'telegraphWard', durationSeconds, eliteDamageFraction, ...(charges === undefined ? {} : { charges }) }],
  }
}

function strike(overrides: Partial<EnemySkillDef> = {}): EnemySkillDef {
  return {
    id: 'smash',
    name: 'Smash',
    coefficient: 40,
    school: 'physical',
    cooldownSeconds: 20,
    telegraphMs: 1000,
    tag: 'smash',
    tags: ['smash', 'physical'],
    effects: [{ kind: 'damage', school: 'physical', coefficient: 40 }],
    ...overrides,
  }
}

function foe(skills: readonly EnemySkillDef[], extra: Partial<EnemyDef> = {}): EnemyDef {
  return { id: 'foe', name: 'Foe', level: 20, archetype: 'standard', school: 'physical', skills, ...extra }
}

function defsFor(enemy: EnemyDef, supplies: readonly SkillDef[] = []): GameDefs {
  const skills: GameDefs['skills'] = {}
  for (const skill of supplies) skills[skill.id] = skill
  return { enemies: { foe: enemy }, skills, statuses: {} }
}

function open(defs: GameDefs, supplies: string[] = [], rows: readonly { skillId: string }[] = []): CombatState {
  const state = createCombat(warriorSetup(supplies, rows), defs, 3)
  state.hero.maxHp = 1_000_000
  state.hero.hp = 1_000_000
  return state
}

function ready(state: CombatState, untilMs: number, eliteDamageFraction: number, charges = 1): void {
  state.hero.telegraphWard = { untilMs, eliteDamageFraction, name: 'Charm', charges }
}

function runUntil(state: CombatState, defs: GameDefs, done: (log: readonly LogEvent[]) => boolean, limitMs = 20_000): void {
  while (!done(state.log) && state.outcome === 'ongoing' && state.timeMs < limitMs) stepCombat(state, defs)
}

function resolved(log: readonly LogEvent[], skillId = 'smash'): boolean {
  return log.some((event) => event.type === 'telegraph' && event.phase === 'resolve' && event.skillId === skillId)
}

function resolveTime(log: readonly LogEvent[], skillId = 'smash'): number {
  const event = log.find((entry) => entry.type === 'telegraph' && entry.phase === 'resolve' && entry.skillId === skillId)
  if (event === undefined) throw new Error('the telegraph never resolved')
  return event.timeMs
}

/** The hits the foe landed at one instant. */
function hitsAt(log: readonly LogEvent[], timeMs: number): DamageEvent[] {
  return log.filter((event): event is DamageEvent => event.type === 'damage' && event.actorId !== HERO_ID && event.timeMs === timeMs)
}

function runSmash(extra: Partial<EnemyDef>, ward: number | null, skill = strike()) {
  const defs = defsFor(foe([skill], extra))
  const state = open(defs)
  if (ward !== null) ready(state, 60_000, ward)
  runUntil(state, defs, (log) => resolved(log, skill.id))
  const at = resolveTime(state.log, skill.id)
  return { state, at, hits: hitsAt(state.log, at) }
}

describe('telegraph ward', () => {
  it('wards off a regular telegraphed hit completely, whatever the elite fraction', () => {
    const base = runSmash({}, null)
    expect(base.hits).toHaveLength(1)
    const warded = runSmash({}, 0.5)
    expect(warded.hits).toHaveLength(0)
    const ward = warded.state.log.find((event) => event.type === 'ward')
    expect(ward).toMatchObject({ type: 'ward', wardName: 'Charm', skillId: 'smash', damageFraction: 0, timeMs: warded.at })
    expect(warded.state.hero.telegraphWard).toBeNull()
  })

  it('lets 50% and 25% of an elite or boss hit through', () => {
    for (const [fraction, extra] of [
      [0.5, { elite: true }],
      [0.25, { elite: true }],
      [0.25, { boss: true }],
    ] as const) {
      const base = runSmash(extra, null).hits[0]!
      const warded = runSmash(extra, fraction)
      const hit = warded.hits[0]
      expect(hit).toBeDefined()
      expect(Math.abs(hit!.hpDamage - base.hpDamage * fraction)).toBeLessThanOrEqual(1)
      expect(warded.state.log.find((event) => event.type === 'ward')).toMatchObject({ damageFraction: fraction })
    }
  })

  it("lets the skill's own dodged-damage fraction be a floor", () => {
    const skill = strike({ dodgedDamageFraction: 0.6 })
    const base = runSmash({ elite: true }, null, skill).hits[0]!
    for (const fraction of [0.5, 0.25]) {
      const run = runSmash({ elite: true }, fraction, skill)
      expect(run.state.log.find((event) => event.type === 'ward')).toMatchObject({ damageFraction: 0.6 })
      expect(Math.abs(run.hits[0]!.hpDamage - base.hpDamage * 0.6)).toBeLessThanOrEqual(1)
    }
    const regular = runSmash({}, 0.5, skill)
    expect(regular.state.log.find((event) => event.type === 'ward')).toMatchObject({ damageFraction: 0.6 })
  })

  it('stops statuses even when a share of the damage lands', () => {
    const skill = strike({
      effects: [
        { kind: 'damage', school: 'physical', coefficient: 40 },
        { kind: 'applyStatus', statusId: 'stun', baseChance: 1 },
      ],
    })
    const defs: GameDefs = {
      ...defsFor(foe([skill], { elite: true })),
      statuses: { stun: { id: 'stun', name: 'Stun', kind: 'stun', delaySeconds: 1 } },
    }
    const warded = open(defs)
    ready(warded, 60_000, 0.5)
    runUntil(warded, defs, resolved)
    expect(hitsAt(warded.log, resolveTime(warded.log))).toHaveLength(1)
    expect(warded.log.some((event) => event.type === 'statusAttempt')).toBe(false)
    const bare = open(defs)
    runUntil(bare, defs, resolved)
    expect(bare.log.some((event) => event.type === 'statusAttempt')).toBe(true)
  })

  it('is not spent by a skill that is not telegraphed', () => {
    const jab = strike({ id: 'jab', name: 'Jab', telegraphMs: undefined, cooldownSeconds: 3 })
    const defs = defsFor(foe([jab]))
    const state = open(defs)
    ready(state, 60_000, 0.5)
    runUntil(state, defs, (log) => log.some((event) => event.type === 'damage' && event.actorId !== HERO_ID), 8_000)
    expect(state.log.some((event) => event.type === 'damage' && event.actorId !== HERO_ID)).toBe(true)
    expect(state.log.some((event) => event.type === 'ward')).toBe(false)
    expect(state.hero.telegraphWard).not.toBeNull()
  })

  it('is not spent by a telegraph that deals no damage', () => {
    const root = strike({ id: 'root', name: 'Root', effects: [{ kind: 'applyStatus', statusId: 'stun', baseChance: 1 }] })
    const defs: GameDefs = {
      ...defsFor(foe([root])),
      statuses: { stun: { id: 'stun', name: 'Stun', kind: 'stun', delaySeconds: 1 } },
    }
    const state = open(defs)
    ready(state, 60_000, 0.5)
    runUntil(state, defs, (log) => resolved(log, 'root'))
    expect(resolved(state.log, 'root')).toBe(true)
    expect(state.log.some((event) => event.type === 'ward')).toBe(false)
    expect(state.hero.telegraphWard).not.toBeNull()
  })

  it('lapses when no telegraph resolves in time', () => {
    const defs = defsFor(foe([strike()]))
    const state = open(defs)
    ready(state, 100, 0.5)
    runUntil(state, defs, resolved)
    expect(hitsAt(state.log, resolveTime(state.log))).toHaveLength(1)
    expect(state.log.some((event) => event.type === 'ward')).toBe(false)
    expect(state.hero.telegraphWard).toBeNull()
  })

  it('lasts 5 seconds from the supply use', () => {
    const charm = wardSupply('charm', 0.5)
    const defs = defsFor(foe([strike({ telegraphMs: 9000 })]), [charm])
    const state = open(defs, ['charm'], [{ skillId: 'charm' }])
    runUntil(state, defs, (log) => log.some((event) => event.type === 'supplyUse'))
    const used = state.log.find((event) => event.type === 'supplyUse')!
    expect(state.hero.telegraphWard).toMatchObject({ untilMs: used.timeMs + 5000, eliteDamageFraction: 0.5, name: 'charm', charges: 1 })
  })

  it('leaves the ward up when a ready dodge takes the hit first', () => {
    const defs = defsFor(foe([strike()]))
    const state = open(defs)
    ready(state, 60_000, 0.5)
    state.hero.skillDodgeUntilMs = 60_000
    runUntil(state, defs, resolved)
    expect(state.log.some((event) => event.type === 'skillDodge')).toBe(true)
    expect(state.log.some((event) => event.type === 'ward')).toBe(false)
    expect(state.hero.telegraphWard).not.toBeNull()
    expect(state.hero.skillDodgeUntilMs).toBeNull()
  })

  it('skips a second ward row while one is up and logs why', () => {
    const charm = wardSupply('charm', 0.5)
    const defs = defsFor(foe([strike({ telegraphMs: 9000 })]), [charm])
    const state = open(defs, ['charm', 'charm'], [{ skillId: 'charm' }, { skillId: 'charm' }])
    runUntil(state, defs, (log) => log.some((event) => event.type === 'priority' && event.reason === WARD_UP_REASON), 6000)
    expect(state.log.filter((event) => event.type === 'supplyUse')).toHaveLength(1)
    expect(state.log.find((event) => event.type === 'priority' && event.reason === WARD_UP_REASON)).toMatchObject({
      decision: 'skip',
      skillId: 'charm',
    })
    expect(WARD_UP_REASON).toBe('ward already up')
  })

  it('rejects an elite fraction of 1 or below 0, and a duration of 0', () => {
    const book = (effect: Record<string, unknown>) => ({ w: { ...wardSupply('w', 0.5), effects: [effect] } })
    const ok: TelegraphWardEffect = { kind: 'telegraphWard', durationSeconds: 5, eliteDamageFraction: 0 }
    expect(() => assertSkillBook(book(ok))).not.toThrow()
    expect(() => assertSkillBook(book({ ...ok, eliteDamageFraction: 1 }))).toThrow(/elite damage fraction/)
    expect(() => assertSkillBook(book({ ...ok, eliteDamageFraction: -0.1 }))).toThrow(/elite damage fraction/)
    expect(() => assertSkillBook(book({ ...ok, durationSeconds: 0 }))).toThrow()
  })

  it('rejects charges that are not a whole number of at least 1', () => {
    const book = (effect: Record<string, unknown>) => ({ w: { ...wardSupply('w', 0.5), effects: [effect] } })
    const ok: TelegraphWardEffect = { kind: 'telegraphWard', durationSeconds: 8, eliteDamageFraction: 0.35, charges: 2 }
    expect(() => assertSkillBook(book(ok))).not.toThrow()
    for (const charges of [0, 1.5, -1, '2']) expect(() => assertSkillBook(book({ ...ok, charges }))).toThrow(/charges/)
  })

  it('starts with 1 charge, or the effect charges, and lasts its own duration', () => {
    const twin = wardSupply('twin', 0.35, 2, 8)
    const defs = defsFor(foe([strike({ telegraphMs: 9000 })]), [twin])
    const state = open(defs, ['twin'], [{ skillId: 'twin' }])
    runUntil(state, defs, (log) => log.some((event) => event.type === 'supplyUse'))
    const used = state.log.find((event) => event.type === 'supplyUse')!
    expect(state.hero.telegraphWard).toMatchObject({ untilMs: used.timeMs + 8000, eliteDamageFraction: 0.35, charges: 2 })
  })

  it('a two-charge ward takes two telegraphed hits, then ends', () => {
    const quick = strike({ cooldownSeconds: 2, telegraphMs: 500 })
    const defs = defsFor(foe([quick], { elite: true }))
    const state = open(defs)
    ready(state, 60_000, 0.35, 2)
    const hits = (log: readonly LogEvent[]) => log.filter((event) => event.type === 'telegraph' && event.phase === 'resolve' && event.skillId === 'smash').length
    runUntil(state, defs, (log) => hits(log) >= 1)
    expect(state.log.filter((event) => event.type === 'ward')).toHaveLength(1)
    expect(state.hero.telegraphWard).toMatchObject({ charges: 1 })
    runUntil(state, defs, (log) => hits(log) >= 2)
    expect(state.log.filter((event) => event.type === 'ward')).toHaveLength(2)
    expect(state.hero.telegraphWard).toBeNull()
    runUntil(state, defs, (log) => hits(log) >= 3)
    expect(state.log.filter((event) => event.type === 'ward')).toHaveLength(2)
  })

  it('skips a second ward while charges remain, and allows one when they are spent', () => {
    const state = open(defsFor(foe([strike()])))
    ready(state, 60_000, 0.35, 2)
    state.hero.telegraphWard!.charges = 1
    const twin = wardSupply('twin', 0.35, 2, 8)
    state.hero.supplies = ['twin']
    expect(skipReason(state, state.hero, twin, 0)).toBe(WARD_UP_REASON)
    state.hero.telegraphWard = null
    expect(skipReason(state, state.hero, twin, 0)).toBeNull()
  })

  it('reads as a plain line, with the share when some lands', () => {
    const none = runSmash({}, 0.5)
    const line = formatEvent(none.state.log.find((event) => event.type === 'ward')!)
    expect(line).toBe(`At ${(none.at / 1000).toFixed(3)}s, Warrior's Charm wards off Foe's Smash: no damage and no statuses.`)
    const share = runSmash({ elite: true }, 0.5)
    expect(formatEvent(share.state.log.find((event) => event.type === 'ward')!)).toContain('50% of the damage lands, no statuses.')
  })
})
