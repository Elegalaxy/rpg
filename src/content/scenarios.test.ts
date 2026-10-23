import { describe, expect, it } from 'vitest'

import { createCombat, runCombat, stepCombat } from '../sim/combat.ts'
import { formatEvent } from '../sim/log.ts'
import { deriveHeroStats } from '../sim/stats.ts'
import type { CombatState, DamageEvent } from '../sim/types.ts'

import {
  DRIVING_BLOW_ID,
  DUEL_BASIC_ID,
  ASSASSIN_VS_STANDARD_ID,
  MAGE_VS_STANDARD_ID,
  PRIORITY_FOCUS_ID,
  CLERIC_VS_STANDARD_ID,
  RANGER_VS_STANDARD_ID,
  VENOM_EDGE_ID,
  WARRIOR_VS_STANDARD_ID,
  gameDefs,
  scenarios,
  setupForScenario,
} from './scenarios.ts'

const FIGHT_MS = 180_000

function logRun(label: string, state: CombatState): void {
  const lines = state.log.map(formatEvent)
  console.log('[combat]', {
    label,
    seed: state.seed,
    outcome: state.outcome,
    durationMs: state.timeMs,
    events: state.log.length,
    sample: [...lines.slice(0, 4), ...lines.slice(-2)],
  })
}

/** Same pipeline as resolveDamage, with the held-Fury outgoing multiplier removed. */
function hpWithoutOutgoingBonus(event: DamageEvent): number {
  const afterCrit = event.raw * event.consistencyRoll * (event.crit ? event.critDamage : 1)
  const absorbed = Math.min(event.barrier, afterCrit)
  const afterIncoming = (afterCrit - absorbed) * (1 - event.reduction) * event.incomingModifier
  let hp = Math.round(afterIncoming)
  if (event.barrier <= 0 && hp < 1) hp = 1
  if (hp < 0) hp = 0
  return hp
}

function killingSwing(hits: readonly DamageEvent[], maxHp: number, actual: boolean): number {
  let hp = maxHp
  for (let index = 0; index < hits.length; index += 1) {
    const hit = hits[index]
    if (hit === undefined) continue
    const dealt = actual ? hit.hpDamage : hpWithoutOutgoingBonus(hit)
    hp -= dealt
    if (hp <= 0) return index
  }
  return -1
}

function heroDamage(state: CombatState): DamageEvent | undefined {
  for (const event of state.log) {
    if (event.type === 'damage' && event.actorId === state.hero.id) return event
  }
  return undefined
}

describe('duel-basic', () => {
  it('runs the level-20 Warrior against one level-20 Standard dummy', () => {
    const setup = setupForScenario(DUEL_BASIC_ID)
    const defs = gameDefs()
    const stats = deriveHeroStats(setup.hero)
    const state = createCombat(setup, defs, 42)
    expect(state.hero.maxHp).toBe(370)
    expect(state.hero.power).toBe(96)
    expect(state.hero.accuracy).toBe(16)
    expect(state.hero.evasion).toBe(16)
    expect(state.hero.armor).toBe(116)
    expect(state.hero.critChance).toBe(stats.critChance)
    expect(state.hero.critDamage).toBe(stats.critDamage)
    expect(state.hero.penetration).toBe(stats.armorPenetration)
    expect(state.hero.nextReadyMs).toBe(1724)
    const enemy = state.enemies[0]
    expect(enemy?.name).toBe('Standard Dummy')
    expect(enemy?.maxHp).toBe(480)
    expect(enemy?.power).toBe(28)
    expect(enemy?.armor).toBe(45)
    expect(enemy?.accuracy).toBe(30)
    expect(enemy?.evasion).toBe(20)
    expect(enemy?.nextReadyMs).toBe(2200)
    expect(enemy?.critChance).toBe(0)
    expect(enemy?.consistency).toBe(0)

    runCombat(state, defs, FIGHT_MS)
    logRun('duel-basic seed 42', state)
    expect(state.outcome).toBe('victory')
    const end = state.log[state.log.length - 1]
    expect(end).toMatchObject({ type: 'encounterEnd', outcome: 'victory', timeMs: 20_688 })
    expect(state.timeMs).toBe(20_690)
    const sample = heroDamage(state)
    expect(sample).toBeDefined()
    if (sample === undefined) return
    expect(sample.coefficient).toBe(1)
    expect(sample.outgoingModifier).toBeGreaterThanOrEqual(1)
    expect(sample.incomingModifier).toBe(1)
    expect(sample.barrier).toBe(0)
    expect(sample.consistency).toBe(0)
    expect(sample.damageFloor).toBeCloseTo(0.6, 10)
    expect(sample.damageCeiling).toBe(1)
    expect(sample.consistencyRoll).toBeGreaterThanOrEqual(0.6)
    expect(sample.consistencyRoll).toBeLessThan(1)
    expect(sample.power).toBe(96)
    expect(sample.defense).toBe(45)
    expect(sample.attackerLevel).toBe(20)
    expect(sample.hpDamage).toBeGreaterThanOrEqual(1)
    expect(state.log.some((event) => event.type === 'damage' && event.actorId === enemy?.id && event.crit)).toBe(
      false,
    )

    const lines = state.log.map(formatEvent)
    expect(lines.join('\n')).toMatchSnapshot()
  })

  it('deep-equals two runs and a resume from t=5000', () => {
    const setup = setupForScenario(DUEL_BASIC_ID)
    const defs = gameDefs()
    const uninterrupted = runCombat(createCombat(setup, defs, 42), defs, FIGHT_MS)
    const repeated = runCombat(createCombat(setup, defs, 42), defs, FIGHT_MS)
    expect(repeated).toEqual(uninterrupted)
    expect(repeated.log).toEqual(uninterrupted.log)

    const paused = createCombat(setup, defs, 42)
    while (paused.outcome === 'ongoing' && paused.timeMs < 5000) stepCombat(paused, defs)
    expect(paused.timeMs).toBe(5000)
    expect(paused.outcome).toBe('ongoing')
    const serialized: unknown = JSON.parse(JSON.stringify(paused))
    const resumed = runCombat(serialized as CombatState, defs, FIGHT_MS)
    logRun('resumed from 5000', resumed)
    expect(resumed.log).toEqual(uninterrupted.log)
    expect(resumed).toEqual(uninterrupted)
  })
})

describe('driving-blow', () => {
  it('uses Driving Blow without a hit roll and still rolls basic attacks', () => {
    const setup = setupForScenario(DRIVING_BLOW_ID)
    const defs = gameDefs()
    const state = runCombat(createCombat(setup, defs, 42), defs, FIGHT_MS)
    const firstAction = state.log.find((event) => event.type === 'action')
    const skillAction = state.log.find((event) => event.type === 'action' && event.skillId === 'driving-blow')
    const heroBasic = state.log.find(
      (event) => event.type === 'action' && event.actorId === state.hero.id && event.action === 'basicAttack',
    )
    const heroHitOnSkill =
      firstAction?.type === 'action'
        ? state.log.find(
            (event) =>
              event.type === 'hitRoll' && event.actorId === state.hero.id && event.timeMs === firstAction.timeMs,
          )
        : undefined
    const heroHitOnBasic =
      heroBasic?.type === 'action'
        ? state.log.find(
            (event) =>
              event.type === 'hitRoll' && event.actorId === state.hero.id && event.timeMs === heroBasic.timeMs,
          )
        : undefined
    const enemyHit = state.log.find((event) => event.type === 'hitRoll' && event.actorId !== state.hero.id)
    const end = state.log[state.log.length - 1]
    console.log('[skills] driving-blow seed 42', {
      outcome: state.outcome,
      durationMs: end?.type === 'encounterEnd' ? end.timeMs : state.timeMs,
      events: state.log.length,
    })
    expect(firstAction).toBe(skillAction)
    expect(firstAction).toMatchObject({
      action: 'skill',
      skillName: 'Driving Blow',
      skillId: 'driving-blow',
      timeMs: 1724,
    })
    expect(heroHitOnSkill).toBeUndefined()
    expect(heroHitOnBasic).toMatchObject({ type: 'hitRoll' })
    expect(enemyHit).toBeDefined()
    expect(state.outcome).toBe('victory')
    expect(end).toMatchObject({ type: 'encounterEnd', outcome: 'victory', timeMs: 17_240 })
  })
})

describe('venom-edge', () => {
  it('applies Poison and reaches an outcome', () => {
    const setup = setupForScenario(VENOM_EDGE_ID)
    const defs = gameDefs()
    const state = runCombat(createCombat(setup, defs, 42), defs, FIGHT_MS)
    const applied = state.log.filter(
      (event) => event.type === 'statusAttempt' && event.statusId === 'poison' && event.result === 'applied',
    )
    const end = state.log[state.log.length - 1]
    console.log('[status] venom-edge seed 42', {
      outcome: state.outcome,
      durationMs: end?.type === 'encounterEnd' ? end.timeMs : state.timeMs,
      applied: applied.length,
      ticks: state.log.filter((event) => event.type === 'statusTick').length,
    })
    expect(applied.length).toBeGreaterThan(0)
    expect(state.outcome).toBe('victory')
    expect(end).toMatchObject({ type: 'encounterEnd', outcome: 'victory', timeMs: 12_346 })
  })
})

describe('priority-focus', () => {
  it('falls through a failing HP condition and still uses Driving Blow', () => {
    const setup = setupForScenario(PRIORITY_FOCUS_ID)
    const defs = gameDefs()
    const state = createCombat(setup, defs, 42)
    console.log('[priority] scenario setup', {
      id: PRIORITY_FOCUS_ID,
      targetPriority: state.hero.targetPriority,
      revealed: state.enemies.map((enemy) => enemy.revealed),
      rows: state.hero.priorityRows,
    })
    expect(state.hero.targetPriority).toBe('lowestHpPercent')
    expect(state.enemies[0]?.revealed).toBe(true)
    runCombat(state, defs, FIGHT_MS)
    const lines = state.log.map(formatEvent)
    const end = state.log[state.log.length - 1]
    console.log('[priority] priority-focus seed 42', {
      outcome: state.outcome,
      durationMs: end?.type === 'encounterEnd' ? end.timeMs : state.timeMs,
      firstSkips: lines.filter((line) => line.includes('skips row') || line.includes('selects row')).slice(0, 4),
    })
    const priority = state.log.filter((event) => event.type === 'priority')
    const firstAction = state.log.find((event) => event.type === 'action' && event.actorId === state.hero.id)
    console.log('[priority] first decision', {
      first: priority[0],
      second: priority[1],
      action: firstAction,
    })
    expect(priority[0]).toMatchObject({
      decision: 'skip',
      rowIndex: 0,
      skillId: 'driving-blow',
      reason: 'hero HP% 100 is above 0',
    })
    expect(priority[1]).toMatchObject({ decision: 'use', rowIndex: 1, skillId: 'driving-blow' })
    expect(firstAction).toMatchObject({ action: 'skill', skillId: 'driving-blow', timeMs: 1724 })
    expect(lines.some((line) => line.includes('skips row 1 Driving Blow (driving-blow): hero HP% 100 is above 0'))).toBe(
      true,
    )
    expect(lines.some((line) => line.includes('selects row 2 Driving Blow (driving-blow)'))).toBe(true)
    expect(state.outcome).toBe('victory')
    expect(end).toMatchObject({ type: 'encounterEnd', outcome: 'victory', timeMs: 17_240 })
  })
})

describe('class reference fights', () => {
  it('runs warrior-vs-standard and mage-vs-standard to an outcome inside 10 minutes', () => {
    const defs = gameDefs()
    const limit = 600_000
    const durationMs: { [id: string]: { [seed: number]: number } } = {
      [WARRIOR_VS_STANDARD_ID]: { 1: 13_792, 42: 15_516 },
      [MAGE_VS_STANDARD_ID]: { 1: 9_309, 42: 9_309 },
    }
    for (const id of [WARRIOR_VS_STANDARD_ID, MAGE_VS_STANDARD_ID]) {
      for (const seed of [1, 42]) {
        const state = runCombat(createCombat(setupForScenario(id), defs, seed), defs, limit)
        const end = state.log[state.log.length - 1]
        const tag = id.startsWith('mage') ? '[mage]' : '[warrior]'
        console.log(tag, {
          scenario: id,
          seed,
          outcome: state.outcome,
          durationMs: end?.type === 'encounterEnd' ? end.timeMs : state.timeMs,
          resource: state.hero.classResource,
          scope: state.hero.classResourceScope,
        })
        expect(state.outcome).toBe('victory')
        expect(end).toMatchObject({ type: 'encounterEnd', outcome: 'victory', timeMs: durationMs[id]?.[seed] })
        if (id === MAGE_VS_STANDARD_ID) {
          const heroActions = state.log.filter((event) => event.type === 'action' && event.actorId === state.hero.id)
          expect(heroActions.some((event) => event.type === 'action' && event.action === 'basicAttack')).toBe(false)
          expect(heroActions.some((event) => event.type === 'action' && event.skillId === 'arcane-bolt')).toBe(true)
          expect(state.hero.equippedSkillIds).not.toContain('arcane-bolt')
          const regenTimes = state.log.flatMap((event) =>
            event.type === 'resource' && event.reason === 'regen' ? [event.timeMs] : [],
          )
          expect(regenTimes.length).toBeGreaterThan(0)
          expect(regenTimes.every((timeMs) => timeMs % 1000 === 0)).toBe(true)
          expect(new Set(regenTimes).size).toBe(regenTimes.length)
        }
      }
    }
    const warrior = scenarios[WARRIOR_VS_STANDARD_ID]
    const mage = scenarios[MAGE_VS_STANDARD_ID]
    expect(warrior?.equippedSkillIds).toEqual(['driving-blow', 'sundering-blow', 'shield-brace', 'second-wind'])
    expect(mage?.equippedSkillIds).toEqual(['fireball', 'frost-lance', 'mana-ward', 'arcane-recovery'])
    expect(mage?.equippedSkillIds).not.toContain('arcane-bolt')
  })

  it('runs assassin-vs-standard and ranger-vs-standard to an outcome inside 10 minutes', () => {
    const defs = gameDefs()
    const limit = 600_000
    const durationMs: { [id: string]: { [seed: number]: number } } = {
      [ASSASSIN_VS_STANDARD_ID]: { 1: 7_961, 42: 7_153 },
      [RANGER_VS_STANDARD_ID]: { 1: 12_377, 42: 10_658 },
    }
    for (const id of [ASSASSIN_VS_STANDARD_ID, RANGER_VS_STANDARD_ID]) {
      for (const seed of [1, 42]) {
        const state = runCombat(createCombat(setupForScenario(id), defs, seed), defs, limit)
        const end = state.log[state.log.length - 1]
        const tag = id.startsWith('assassin') ? '[assassin]' : '[ranger]'
        console.log(tag, {
          scenario: id,
          seed,
          outcome: state.outcome,
          durationMs: end?.type === 'encounterEnd' ? end.timeMs : state.timeMs,
          resource: state.hero.classResource,
          fraction: state.hero.resourceFraction,
          ammo: state.hero.specialAmmo,
        })
        expect(state.outcome).toBe('victory')
        expect(end).toMatchObject({ type: 'encounterEnd', outcome: 'victory', timeMs: durationMs[id]?.[seed] })
      }
    }
    const assassin = scenarios[ASSASSIN_VS_STANDARD_ID]
    const ranger = scenarios[RANGER_VS_STANDARD_ID]
    expect(assassin?.equippedSkillIds).toEqual(['mark-for-death', 'shadow-cut', 'venom-edge', 'execute'])
    expect(assassin?.priorityRows?.map((row) => row.skillId)).toEqual([
      'mark-for-death',
      'execute',
      'execute',
      'venom-edge',
      'shadow-cut',
    ])
    expect(ranger?.equippedSkillIds).toEqual(['aimed-shot', 'piercing-arrow', 'volley', 'snare-trap'])
    expect(ranger?.startingResource).toBe(100)
    expect(ranger?.specialAmmo).toBe(6)
    const rangerState = createCombat(setupForScenario(RANGER_VS_STANDARD_ID), defs, 1)
    expect(rangerState.hero.classResource).toBe(100)
    expect(rangerState.hero.specialAmmo).toBe(6)
    expect(rangerState.hero.classResourceScope).toBe('expedition')
  })

  it('runs cleric-vs-standard to a victory inside 10 minutes', () => {
    const defs = gameDefs()
    const limit = 600_000
    const durationMs: { [seed: number]: number } = { 1: 14_032, 42: 21_048 }
    const scenario = scenarios[CLERIC_VS_STANDARD_ID]
    expect(scenario?.equippedSkillIds).toEqual(['smite', 'mend', 'ward', 'judgment'])
    expect(scenario?.vow).toBe('zeal')
    expect(scenario?.priorityRows?.map((row) => row.skillId)).toEqual(['mend', 'ward', 'judgment', 'smite'])
    for (const seed of [1, 42]) {
      const setup = setupForScenario(CLERIC_VS_STANDARD_ID)
      const started = createCombat(setup, defs, seed)
      expect(started.hero.classResource).toBe(0)
      expect(started.hero.classResourceId).toBe('faith')
      expect(started.hero.classResourceMax).toBe(100)
      expect(started.hero.classResourceScope).toBe('expedition')
      expect(started.hero.classState.vow).toBe('zeal')
      const state = runCombat(started, defs, limit)
      const end = state.log[state.log.length - 1]
      console.log('[cleric]', {
        scenario: CLERIC_VS_STANDARD_ID,
        seed,
        outcome: state.outcome,
        durationMs: end?.type === 'encounterEnd' ? end.timeMs : state.timeMs,
        resource: state.hero.classResource,
        scope: state.hero.classResourceScope,
        vow: state.hero.classState.vow,
      })
      expect(state.outcome).toBe('victory')
      expect(end).toMatchObject({ type: 'encounterEnd', outcome: 'victory', timeMs: durationMs[seed] })
      expect(end?.type === 'encounterEnd' ? end.timeMs : limit).toBeLessThanOrEqual(limit)
      expect(state.hero.classResourceScope).toBe('expedition')
      expect(state.hero.classState.vow).toBe('zeal')
      expect(state.log.some((event) => event.type === 'resource' && event.reason === 'encounterEnd')).toBe(false)
    }
  })
})

describe('held fury seed 42', () => {
  it('keeps the killing swing while later hits are larger than the same rolls at ×1', () => {
    const defs = gameDefs()
    const cases = [
      { id: DUEL_BASIC_ID, durationMs: 20_688 },
      { id: DRIVING_BLOW_ID, durationMs: 17_240 },
      { id: PRIORITY_FOCUS_ID, durationMs: 17_240 },
    ]
    for (const entry of cases) {
      const state = runCombat(createCombat(setupForScenario(entry.id), defs, 42), defs, FIGHT_MS)
      const end = state.log[state.log.length - 1]
      const enemy = state.enemies[0]
      const hits = state.log.filter(
        (event): event is DamageEvent => event.type === 'damage' && event.actorId === state.hero.id,
      )
      const first = hits[0]
      const last = hits[hits.length - 1]
      const boosted = hits.filter((hit) => hit.hpDamage > hpWithoutOutgoingBonus(hit))
      const actualSwing = killingSwing(hits, enemy?.maxHp ?? 0, true)
      const plainSwing = killingSwing(hits, enemy?.maxHp ?? 0, false)
      console.log('[warrior] held fury', {
        id: entry.id,
        outcome: state.outcome,
        durationMs: end?.type === 'encounterEnd' ? end.timeMs : state.timeMs,
        hits: hits.length,
        firstOutgoing: first?.outgoingModifier,
        lastOutgoing: last?.outgoingModifier,
        boostedHits: boosted.length,
        actualSwing,
        plainSwing,
        killingTimeMs: hits[actualSwing]?.timeMs,
      })
      expect(state.outcome).toBe('victory')
      expect(end).toMatchObject({ type: 'encounterEnd', outcome: 'victory', timeMs: entry.durationMs })
      expect(first).toBeDefined()
      expect(last).toBeDefined()
      if (first === undefined || last === undefined) continue
      expect(last.outgoingModifier).toBeGreaterThan(first.outgoingModifier)
      expect(last.outgoingModifier).toBeGreaterThan(1)
      expect(boosted.length).toBeGreaterThan(0)
      expect(actualSwing).toBe(plainSwing)
      expect(hits[actualSwing]?.timeMs).toBe(entry.durationMs)
    }
  })
})

describe('mage spell details', () => {
  it('ticks Fireball Burn for 0.12 of the snapshotted magical power', () => {
    const base = setupForScenario(MAGE_VS_STANDARD_ID)
    const setup = {
      ...base,
      hero: {
        ...base.hero,
        equippedSkillIds: ['fireball'],
        priorityRows: [{ skillId: 'fireball' }],
      },
    }
    const defs = gameDefs()
    const state = createCombat(setup, defs, 1)
    let steps = 0
    while (
      state.outcome === 'ongoing' &&
      !state.log.some((event) => event.type === 'statusTick' && event.statusId === 'burn')
    ) {
      stepCombat(state, defs)
      steps += 1
      if (steps > 20_000) throw new Error('Fireball did not tick Burn')
    }
    const tick = state.log.find((event) => event.type === 'statusTick' && event.statusId === 'burn')
    console.log('[mage] fireball burn', {
      power: state.hero.magicalPower,
      tick,
    })
    expect(tick).toMatchObject({
      type: 'statusTick',
      coefficient: 0.12,
      intensity: 1,
      power: state.hero.magicalPower,
      crit: false,
      varianceRoll: false,
    })
    if (tick?.type !== 'statusTick') return
    expect(tick.raw).toBeCloseTo(state.hero.magicalPower * 0.12, 10)
  })

  it('applies one Chill stack from Frost Lance', () => {
    const base = setupForScenario(MAGE_VS_STANDARD_ID)
    const setup = {
      ...base,
      hero: {
        ...base.hero,
        equippedSkillIds: ['frost-lance'],
        priorityRows: [{ skillId: 'frost-lance' }],
      },
    }
    const defs = gameDefs()
    const state = createCombat(setup, defs, 1)
    let steps = 0
    while (
      state.outcome === 'ongoing' &&
      !state.log.some((event) => event.type === 'statusAttempt' && event.statusId === 'chill')
    ) {
      stepCombat(state, defs)
      steps += 1
      if (steps > 20_000) throw new Error('Frost Lance did not apply Chill')
    }
    const attempt = state.log.find((event) => event.type === 'statusAttempt' && event.statusId === 'chill')
    console.log('[mage] frost chill', attempt)
    expect(attempt).toMatchObject({ result: 'applied', stacks: 1 })
  })
})

describe('harness enemies', () => {
  it('starts every scenario enemy revealed', () => {
    const defs = gameDefs()
    for (const id of [
      DUEL_BASIC_ID,
      DRIVING_BLOW_ID,
      VENOM_EDGE_ID,
      PRIORITY_FOCUS_ID,
      WARRIOR_VS_STANDARD_ID,
      MAGE_VS_STANDARD_ID,
    ]) {
      const state = createCombat(setupForScenario(id), defs, 42)
      console.log('[priority] harness revealed', {
        id,
        revealed: state.enemies.map((enemy) => enemy.revealed),
      })
      expect(state.enemies.length).toBeGreaterThan(0)
      expect(state.enemies.every((enemy) => enemy.revealed)).toBe(true)
    }
  })
})
