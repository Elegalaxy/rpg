import { describe, expect, it } from 'vitest'

import { createCombat, runCombat, stepCombat } from '../combat.ts'
import { createRng, nextFloat, type RngState } from '../rng.ts'
import { applySkillEffects } from '../skills.ts'
import { stunDelayMs, tryApplyStatus } from '../statuses.ts'
import type { CombatActor, CombatSetup, CombatState, EnemyDef, GameDefs, SkillDef } from '../types.ts'
import { normalizeBasicAttackResource, spiritResourceFactor } from './resources.ts'
import { rangerClass } from './ranger.ts'
import {
  MISSING_SPECIAL_ARROW_REASON,
  QUIVER_CAPACITY,
  READINESS_BASIC_BASE,
  READINESS_HARNESS_START,
  READINESS_MAXIMUM,
} from './ranger.ts'

const ITEM_LEVEL = 20
const QUALITY = 1

function armor(slot: 'head' | 'chest' | 'hands' | 'feet') {
  return { id: `ref-medium-${slot}`, slot, category: 'medium' as const, itemLevel: ITEM_LEVEL, quality: QUALITY }
}

function rangerSetup(options?: {
  equipped?: readonly string[]
  rows?: CombatSetup['hero']['priorityRows']
  enemies?: CombatSetup['enemies']
  startingResource?: number
  specialAmmo?: number
  classId?: CombatSetup['hero']['classId']
  weapon?: 'bow' | 'oneHanded' | 'dagger' | 'caster'
}): CombatSetup {
  const classId = options?.classId ?? 'ranger'
  const weapon = options?.weapon ?? 'bow'
  return {
    hero: {
      id: `ref-${classId}`,
      name: classId,
      level: 20,
      classId,
      attributes:
        classId === 'mage'
          ? { strength: 10, vitality: 16, agility: 16, intellect: 34, spirit: 12 }
          : classId === 'warrior'
            ? { strength: 24, vitality: 22, agility: 16, intellect: 10, spirit: 16 }
            : classId === 'assassin'
              ? { strength: 18, vitality: 16, agility: 30, intellect: 14, spirit: 10 }
              : { strength: 22, vitality: 18, agility: 28, intellect: 10, spirit: 10 },
      gear: {
        mainHand: { id: `weapon-${weapon}`, kind: weapon, itemLevel: ITEM_LEVEL, quality: QUALITY },
        offHand:
          classId === 'mage'
            ? { id: 'focus', kind: 'focus' as const, itemLevel: ITEM_LEVEL, quality: QUALITY }
            : classId === 'warrior'
              ? { id: 'shield', kind: 'shield' as const, itemLevel: ITEM_LEVEL, quality: QUALITY }
              : classId === 'assassin'
                ? { id: 'off-dagger', kind: 'dagger' as const, itemLevel: ITEM_LEVEL, quality: QUALITY }
                : { id: 'quiver', kind: 'quiver' as const, itemLevel: ITEM_LEVEL, quality: QUALITY },
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
      stun: { id: 'stun', name: 'Stun', kind: 'stun', delaySeconds: 1.5 },
      burn: { id: 'burn', name: 'Burn', kind: 'burn', maxIntensity: 5, durationSeconds: 5, tickSeconds: 1 },
    },
  }
}

function resources(state: CombatState, reason: string) {
  return state.log.filter((event) => event.type === 'resource' && event.reason === reason)
}

function resolvedHook() {
  const resolved = rangerClass.actionResolved
  if (resolved === undefined) throw new Error('ranger actionResolved is missing')
  return resolved
}

function currentBurn(actor: CombatActor): CombatActor['statuses']['burn'] {
  return actor.statuses.burn
}

function until(state: CombatState, defs: GameDefs, seen: (state: CombatState) => boolean): void {
  let steps = 0
  while (state.outcome === 'ongoing' && !seen(state)) {
    stepCombat(state, defs)
    steps += 1
    if (steps > 20_000) throw new Error('combat did not reach the expected event')
  }
}

function rngBefore(match: (roll: number) => boolean): RngState {
  for (let seed = 1; seed < 5000; seed += 1) {
    const rng = createRng(seed)
    const saved = { a: rng.a, b: rng.b, c: rng.c, d: rng.d }
    if (match(nextFloat(rng))) return saved
  }
  throw new Error('no rng seed matched the stun roll')
}

describe('ranger readiness', () => {
  it('starts a harness Ranger at 100 Readiness and 6 arrows unless the setup supplies them', () => {
    const defs = defsFor([])
    const harness = createCombat(rangerSetup(), defs, 1)
    console.log('[ranger] harness start', {
      resource: harness.hero.classResource,
      ammo: harness.hero.specialAmmo,
      scope: harness.hero.classResourceScope,
    })
    expect(harness.hero.classResource).toBe(READINESS_HARNESS_START)
    expect(harness.hero.classResourceMax).toBe(READINESS_MAXIMUM)
    expect(harness.hero.classResourceScope).toBe('expedition')
    expect(harness.hero.resourceRegenPerSecond).toBe(0)
    expect(harness.hero.specialAmmo).toBe(QUIVER_CAPACITY)

    const supplied = createCombat(rangerSetup({ startingResource: 37, specialAmmo: 0 }), defs, 1)
    expect(supplied.hero.classResource).toBe(37)
    expect(supplied.hero.specialAmmo).toBe(0)
    const empty = createCombat(rangerSetup({ startingResource: 0, specialAmmo: 2 }), defs, 1)
    expect(empty.hero.classResource).toBe(0)
    expect(empty.hero.specialAmmo).toBe(2)
    const capped = createCombat(rangerSetup({ specialAmmo: 9 }), defs, 1)
    expect(capped.hero.specialAmmo).toBe(QUIVER_CAPACITY)

    const warrior = createCombat(rangerSetup({ classId: 'warrior', weapon: 'oneHanded' }), defs, 1)
    const mage = createCombat(rangerSetup({ classId: 'mage', weapon: 'caster' }), defs, 1)
    const assassin = createCombat(rangerSetup({ classId: 'assassin', weapon: 'dagger' }), defs, 1)
    expect(warrior.hero.classResource).toBe(0)
    expect(warrior.hero.classResourceId).toBe('fury')
    expect(mage.hero.classResource).toBe(100)
    expect(mage.hero.classResourceId).toBe('mana')
    expect(assassin.hero.classResource).toBe(0)
    expect(assassin.hero.resourceFraction).toBe(0)
    expect(assassin.hero.classResourceId).toBe('advantage')

    const suppliedWarrior = createCombat(
      rangerSetup({ classId: 'warrior', weapon: 'oneHanded', startingResource: 40 }),
      defs,
      1,
    )
    const suppliedMage = createCombat(
      rangerSetup({ classId: 'mage', weapon: 'caster', startingResource: 0 }),
      defs,
      1,
    )
    const suppliedAssassin = createCombat(
      rangerSetup({ classId: 'assassin', weapon: 'dagger', startingResource: 4 }),
      defs,
      1,
    )
    console.log('[ranger] other classes ignore a supplied start', {
      warrior: suppliedWarrior.hero.classResource,
      mage: suppliedMage.hero.classResource,
      assassin: suppliedAssassin.hero.classResource,
      fraction: suppliedAssassin.hero.resourceFraction,
    })
    expect(suppliedWarrior.hero.classResource).toBe(0)
    expect(suppliedWarrior.hero.classResourceId).toBe('fury')
    expect(suppliedMage.hero.classResource).toBe(100)
    expect(suppliedMage.hero.classResourceId).toBe('mana')
    expect(suppliedAssassin.hero.classResource).toBe(0)
    expect(suppliedAssassin.hero.resourceFraction).toBe(0)
    expect(suppliedAssassin.hero.classResourceId).toBe('advantage')
  })

  it('normalizes a successful bow basic attack to 11 Readiness before Spirit, and a miss gains nothing', () => {
    const defs = defsFor([])
    const state = createCombat(rangerSetup(), defs, 1)
    const factor = spiritResourceFactor(10)
    const hook = resolvedHook()
    hook(state, { kind: 'basicAttack', hit: false, crit: false, targetId: 'dummy#0' }, 0)
    expect(state.hero.classResource).toBe(READINESS_HARNESS_START)
    expect(state.hero.specialAmmo).toBe(QUIVER_CAPACITY)
    hook(state, { kind: 'basicAttack', hit: true, crit: false, targetId: 'dummy#0' }, 0)
    const base = normalizeBasicAttackResource(READINESS_BASIC_BASE, state.hero.baseActionSeconds)
    const gain = resources(state, 'basicAttack')[0]
    console.log('[ranger] basic readiness', { baseActionSeconds: state.hero.baseActionSeconds, base, gain, factor })
    expect(state.hero.baseActionSeconds).toBeCloseTo(2.2, 10)
    expect(base).toBeCloseTo(11, 10)
    expect(gain).toMatchObject({ type: 'resource', reason: 'basicAttack' })
    if (gain?.type !== 'resource') return
    expect(gain.base).toBeCloseTo(11, 10)
    expect(gain.multiplier).toBeCloseTo(factor, 10)
    expect(gain.generated).toBeCloseTo(11 * factor, 10)
    expect(state.hero.specialAmmo).toBe(QUIVER_CAPACITY)
  })

  it('pays Readiness the same way as other class costs and keeps it after the encounter', () => {
    const aimed = skill({
      id: 'aimed-shot',
      cost: 40,
      cooldownSeconds: 5,
      actionTimeCoefficient: 1.2,
      effects: [{ kind: 'damage', school: 'physical', coefficient: 1.8 }],
    })
    const defs = defsFor([aimed], [dummy({ maxHp: 1 })])
    const state = createCombat(
      rangerSetup({ startingResource: 100, equipped: ['aimed-shot'], rows: [{ skillId: 'aimed-shot' }] }),
      defs,
      1,
    )
    until(state, defs, (combat) => combat.log.some((event) => event.type === 'resource' && event.reason === 'payment'))
    const payment = resources(state, 'payment')[0]
    console.log('[ranger] payment', { resource: state.hero.classResource, payment })
    expect(payment).toMatchObject({ type: 'resource', base: 40, before: 100, after: 60 })
    expect(state.hero.classResource).toBe(60)
    runCombat(state, defs, 30_000)
    expect(state.outcome).toBe('victory')
    expect(resources(state, 'encounterEnd')).toHaveLength(0)
    expect(resources(state, 'regen')).toHaveLength(0)
    expect(state.hero.classResource).toBeGreaterThan(0)
    expect(state.hero.classResourceScope).toBe('expedition')
  })

  it('replaces an armed trap and stuns on the next action only when the roll succeeds', () => {
    const snare = skill({
      id: 'snare-trap',
      cost: 25,
      cooldownSeconds: 8,
      tags: ['physical', 'trap'],
      effects: [{ kind: 'armTrap', baseChance: 0.75 }],
    })
    const enemies = [dummy({}, 'dummy', 'Alpha'), dummy({}, 'other', 'Beta')]
    const defs = defsFor([snare], enemies)
    const state = createCombat(rangerSetup({ enemies: [{ defId: 'dummy', slot: 0 }, { defId: 'other', slot: 1 }] }), defs, 1)
    const alpha = state.enemies[0]
    const beta = state.enemies[1]
    if (alpha === undefined || beta === undefined) throw new Error('missing enemies')
    const noop = () => undefined
    applySkillEffects(state, defs, state.hero, snare, [alpha], 1000, () => 1, noop)
    expect(alpha.armedTrap?.skillId).toBe('snare-trap')
    applySkillEffects(state, defs, state.hero, snare, [beta], 2000, () => 1, noop)
    console.log('[ranger] trap replaced', { alpha: alpha.armedTrap, beta: beta.armedTrap })
    expect(alpha.armedTrap).toBeNull()
    expect(beta.armedTrap).toMatchObject({ baseChance: 0.75, skillId: 'snare-trap', sourceId: state.hero.id })
    expect(state.log.some((event) => event.type === 'trap' && event.replacedId === alpha.id && event.targetId === beta.id)).toBe(true)

    state.hero.intellect = 0
    state.hero.statusPotency = 0
    state.hero.nextReadyMs = 100_000
    beta.vitality = 0
    beta.physicalStatusResistance = 0
    beta.nextReadyMs = 10
    beta.actionTimeMs = 2000
    state.rng = rngBefore((roll) => roll < 0.75)
    stepCombat(state, defs)
    expect(beta.armedTrap).toBeNull()
    expect(beta.nextReadyMs).toBe(10 + stunDelayMs(1.5, false))
    expect(stunDelayMs(1.5, false)).toBe(1500)
    expect(state.log.some((event) => event.type === 'action' && event.actorId === beta.id)).toBe(false)

    const boss = createCombat(rangerSetup(), defsFor([snare]), 1)
    const bossEnemy = boss.enemies[0]
    if (bossEnemy === undefined) throw new Error('missing boss')
    applySkillEffects(boss, defsFor([snare]), boss.hero, snare, [bossEnemy], 1000, () => 1, noop)
    boss.hero.intellect = 0
    boss.hero.statusPotency = 0
    boss.hero.nextReadyMs = 100_000
    bossEnemy.boss = true
    bossEnemy.vitality = 0
    bossEnemy.nextReadyMs = 10
    boss.rng = rngBefore((roll) => roll < 0.75)
    stepCombat(boss, defsFor([snare]))
    expect(bossEnemy.nextReadyMs).toBe(10 + 525)
    expect(stunDelayMs(1.5, true)).toBe(525)

    const missed = createCombat(rangerSetup(), defsFor([snare]), 1)
    const target = missed.enemies[0]
    if (target === undefined) throw new Error('missing target')
    applySkillEffects(missed, defsFor([snare]), missed.hero, snare, [target], 1000, () => 1, noop)
    missed.hero.intellect = 0
    missed.hero.statusPotency = 0
    missed.hero.nextReadyMs = 100_000
    target.vitality = 0
    target.nextReadyMs = 10
    target.actionTimeMs = 2000
    missed.rng = rngBefore((roll) => roll >= 0.75)
    stepCombat(missed, defsFor([snare]))
    console.log('[ranger] trap resist', { nextReadyMs: target.nextReadyMs, trap: target.armedTrap })
    expect(target.armedTrap).toBeNull()
    expect(target.nextReadyMs).toBe(2010)
    expect(missed.log.some((event) => event.type === 'action' && event.actorId === target.id && event.timeMs === 10)).toBe(true)
    expect(missed.log.some((event) => event.type === 'statusAttempt' && event.statusId === 'stun' && event.result === 'resisted')).toBe(true)
  })

  it('makes Flame Arrow ineligible at 0 arrows and spends neither cost', () => {
    const flame = skill({
      id: 'flame-arrow',
      cost: 20,
      cooldownSeconds: 6,
      tags: ['magical', 'fire', 'attack'],
      ammoCost: 1,
      effects: [
        { kind: 'damage', school: 'magical', coefficient: 1, power: 'physical' },
        { kind: 'applyStatus', statusId: 'burn', baseChance: 1, coefficient: 0.1, power: 'physical' },
      ],
    })
    const defs = defsFor([flame])
    const broke = createCombat(
      rangerSetup({
        startingResource: 100,
        specialAmmo: 0,
        equipped: ['flame-arrow'],
        rows: [{ skillId: 'flame-arrow' }],
      }),
      defs,
      1,
    )
    until(broke, defs, (combat) => combat.log.some((event) => event.type === 'priority'))
    const skip = broke.log.find((event) => event.type === 'priority' && event.decision === 'skip')
    console.log('[ranger] missing arrow', { skip, resource: broke.hero.classResource, ammo: broke.hero.specialAmmo })
    expect(skip).toMatchObject({ type: 'priority', reason: MISSING_SPECIAL_ARROW_REASON })
    expect(broke.hero.specialAmmo).toBe(0)
    expect(resources(broke, 'payment')).toHaveLength(0)
    expect(broke.hero.classResource).toBeGreaterThanOrEqual(100)

    const short = createCombat(
      rangerSetup({
        startingResource: 10,
        specialAmmo: 1,
        equipped: ['flame-arrow'],
        rows: [{ skillId: 'flame-arrow' }],
      }),
      defs,
      1,
    )
    until(short, defs, (combat) => combat.log.some((event) => event.type === 'priority'))
    expect(short.log.some((event) => event.type === 'priority' && event.reason === 'unaffordable')).toBe(true)
    expect(short.hero.specialAmmo).toBe(1)
    expect(resources(short, 'payment')).toHaveLength(0)
    expect(short.hero.classResource).toBeGreaterThanOrEqual(10)

    const paid = createCombat(
      rangerSetup({
        startingResource: 20,
        specialAmmo: 1,
        equipped: ['flame-arrow'],
        rows: [{ skillId: 'flame-arrow' }],
      }),
      defs,
      1,
    )
    paid.hero.critChance = 0
    until(paid, defs, (combat) => combat.log.some((event) => event.type === 'damage' && event.actorId === combat.hero.id))
    const hit = paid.log.find((event) => event.type === 'damage' && event.actorId === paid.hero.id)
    const enemy = paid.enemies[0]
    console.log('[ranger] flame arrow', { hit, ammo: paid.hero.specialAmmo, burn: enemy?.statuses.burn })
    expect(paid.hero.classResource).toBe(0)
    expect(paid.hero.specialAmmo).toBe(0)
    expect(hit).toMatchObject({
      type: 'damage',
      school: 'magical',
      coefficient: 1,
      power: paid.hero.physicalPower,
    })
    expect(enemy?.statuses.mark).toBeNull()
    if (enemy === undefined) return
    const burn = flame.effects[1]
    if (burn === undefined || burn.kind !== 'applyStatus') throw new Error('missing burn effect')
    enemy.statuses.burn = null
    tryApplyStatus({
      state: paid,
      defs,
      source: paid.hero,
      target: enemy,
      skill: flame,
      effect: burn,
      timeMs: 1000,
      applyingHit: true,
      hpDamageDealt: 1,
      roll: 0,
    })
    const burned = currentBurn(enemy)
    if (burned === null) throw new Error('Flame Arrow burn was not applied')
    expect(burned.power).toBe(paid.hero.physicalPower)
    expect(burned.coefficient).toBe(0.1)
  })

  it("sets revealed with Hunter's Mark and does not apply Assassin Mark", () => {
    const hunters = skill({
      id: 'hunters-mark',
      tags: ['mark'],
      cooldownSeconds: 5,
      actionTimeCoefficient: 0.5,
      effects: [{ kind: 'reveal' }],
    })
    const defs = defsFor([hunters])
    const state = createCombat(
      rangerSetup({
        equipped: ['hunters-mark'],
        rows: [{ skillId: 'hunters-mark' }],
        enemies: [{ defId: 'dummy', slot: 0, revealed: false }],
      }),
      defs,
      1,
    )
    const enemy = state.enemies[0]
    expect(enemy?.revealed).toBe(false)
    until(state, defs, (combat) => combat.log.some((event) => event.type === 'reveal'))
    console.log('[ranger] revealed', { revealed: enemy?.revealed, mark: enemy?.statuses.mark })
    expect(enemy?.revealed).toBe(true)
    expect(enemy?.statuses.mark).toBeNull()
    expect(state.hero.classResource).toBe(READINESS_HARNESS_START)
  })

  it('adds 30 points of Armor penetration and then applies the 80% cap', () => {
    const piercing = skill({
      id: 'piercing-arrow',
      cost: 20,
      effects: [{ kind: 'damage', school: 'physical', coefficient: 1.3, armorPenetrationBonus: 0.3 }],
    })
    const defs = defsFor([piercing])
    const open = createCombat(
      rangerSetup({ startingResource: 20, equipped: ['piercing-arrow'], rows: [{ skillId: 'piercing-arrow' }] }),
      defs,
      1,
    )
    open.hero.armorPenetration = 0.12
    open.hero.critChance = 0
    until(open, defs, (combat) => combat.log.some((event) => event.type === 'damage'))
    const openHit = open.log.find((event) => event.type === 'damage')
    const capped = createCombat(
      rangerSetup({ startingResource: 20, equipped: ['piercing-arrow'], rows: [{ skillId: 'piercing-arrow' }] }),
      defs,
      1,
    )
    capped.hero.armorPenetration = 0.7
    capped.hero.critChance = 0
    until(capped, defs, (combat) => combat.log.some((event) => event.type === 'damage'))
    const cappedHit = capped.log.find((event) => event.type === 'damage')
    console.log('[ranger] penetration', {
      open: openHit && openHit.type === 'damage' ? openHit.penetration : null,
      capped: cappedHit && cappedHit.type === 'damage' ? cappedHit.penetration : null,
    })
    expect(openHit).toMatchObject({ type: 'damage', coefficient: 1.3 })
    if (openHit?.type === 'damage') expect(openHit.penetration).toBeCloseTo(0.42, 10)
    expect(cappedHit).toMatchObject({ type: 'damage', penetration: 0.8 })
  })
})
