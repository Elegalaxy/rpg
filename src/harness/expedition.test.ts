import { describe, expect, it } from 'vitest'

import { gameDefs, referenceLoadoutFor } from '../content/scenarios.ts'
import { referenceHeroAtLevel } from '../content/heroes.ts'
import { ARCANE_BOLT_ID } from '../sim/classes/mage.ts'
import { STEP_MS } from '../sim/constants.ts'
import { createExpedition, runExpedition, stepExpedition } from '../sim/expedition.ts'

import { HARNESS_LIMIT_MS } from './batch.ts'
import { splinteredRoadBlueprint } from './expedition.ts'

describe('splintered road blueprint', () => {
  it('uses the level-5 Q4 loadout and the real opening encounters', () => {
    const warrior = splinteredRoadBlueprint()
    const loadout = referenceLoadoutFor('warrior')
    const hero = referenceHeroAtLevel('warrior', 5)
    console.log('[expedition] blueprint', {
      opening: warrior.opening.map((entry) => entry.id),
      draw: warrior.draw.map((entry) => entry.id),
      level: warrior.hero.level,
      skills: warrior.hero.equippedSkillIds,
    })
    expect(warrior.opening.map((entry) => entry.id)).toEqual(['shardling-pair', 'wolf-pair', 'deserter'])
    expect(warrior.draw.map((entry) => entry.id)).toEqual(['shardling-pair', 'wolf-pair', 'deserter', 'road-mixed'])
    expect(warrior.opening[0]?.enemies).toEqual([
      { defId: 'fracture-shardling', slot: 0, level: 3, materialId: 'shard', baseQuantity: 4 },
      { defId: 'fracture-shardling', slot: 1, level: 3, materialId: 'shard', baseQuantity: 4 },
    ])
    expect(warrior.opening[1]?.enemies).toEqual([
      { defId: 'starved-wolf', slot: 0, level: 6, materialId: 'hide', baseQuantity: 4 },
      { defId: 'starved-wolf', slot: 1, level: 6, materialId: 'hide', baseQuantity: 4 },
    ])
    expect(warrior.opening[2]?.enemies).toEqual([
      { defId: 'deserter', slot: 0, level: 6, materialId: 'scrap', baseQuantity: 4 },
    ])
    expect(warrior.draw[3]?.enemies).toEqual([
      { defId: 'fracture-shardling', slot: 0, level: 5, materialId: 'shard', baseQuantity: 4 },
      { defId: 'starved-wolf', slot: 1, level: 5, materialId: 'hide', baseQuantity: 4 },
      { defId: 'deserter', slot: 2, level: 5, materialId: 'scrap', baseQuantity: 4 },
    ])
    expect(warrior.hero.id).toBe(hero.id)
    expect(warrior.hero.level).toBe(5)
    expect(warrior.hero.equippedSkillIds).toEqual([...loadout.equippedSkillIds])
    expect(warrior.hero.attributes).toEqual(hero.attributes)
    expect(warrior.retreatThresholds).toEqual([{ kind: 'hpFraction', atMost: 0.4 }])

    const mage = splinteredRoadBlueprint('mage')
    expect(mage.retreatThresholds).toEqual([{ kind: 'hpFraction', atMost: 0.4 }])
    expect(mage.hero.equippedSkillIds).toEqual([...referenceLoadoutFor('mage').equippedSkillIds])
    expect(mage.hero.equippedSkillIds).not.toContain(ARCANE_BOLT_ID)
    expect(splinteredRoadBlueprint('cleric').hero.vow).toBe('zeal')
    expect(splinteredRoadBlueprint('ranger').hero.specialAmmo).toBe(6)

    const state = createExpedition(warrior, 5)
    state.travelGapMs = STEP_MS
    stepExpedition(state, gameDefs())
    console.log('[expedition] first real fight', {
      id: state.current?.encounterId,
      enemies: state.combat?.enemies.map((enemy) => ({ defId: enemy.defId, level: enemy.level })),
    })
    expect(state.current?.encounterId).toBe('shardling-pair')
    expect(state.combat?.hero.level).toBe(5)
    expect(state.combat?.enemies.map((enemy) => ({ defId: enemy.defId, level: enemy.level, slot: enemy.slot }))).toEqual([
      { defId: 'fracture-shardling', level: 3, slot: 0 },
      { defId: 'fracture-shardling', level: 3, slot: 1 },
    ])
    expect(state.retreatThresholds).toEqual([{ kind: 'hpFraction', atMost: 0.4 }])
    expect(state.escapeRetryMs).toBeNull()
    expect(state.escapeLog).toEqual([])
  })

  it('finishes seed 5 fight 3 as a victory when the threshold list is empty', () => {
    const blueprint = splinteredRoadBlueprint()
    blueprint.retreatThresholds = []
    const state = runExpedition(createExpedition(blueprint, 5), gameDefs(), 4, HARNESS_LIMIT_MS)
    console.log('[sim]', 'empty threshold seed 5', {
      outcomes: state.history.map((entry) => ({ outcome: entry.outcome, durationMs: entry.durationMs })),
      momentum: state.momentum,
      unsecured: state.unsecured,
      overflow: state.overflow,
      escapes: state.escapeLog.length,
    })
    expect(state.history.map((entry) => entry.durationMs)).toEqual([7208, 15767, 10812, 19371])
    expect(state.history.map((entry) => entry.outcome)).toEqual(['victory', 'victory', 'victory', 'victory'])
    expect(state.momentum).toBe(4)
    expect(state.unsecured).toEqual([
      { materialId: 'shard', quantity: 8 },
      { materialId: 'hide', quantity: 8 },
      { materialId: 'scrap', quantity: 4 },
    ])
    expect(state.secured).toEqual([])
    expect(state.overflow).toBe(10)
    expect(state.escapeLog).toEqual([])
    expect(state.outcome).toBe('ongoing')
    expect(state.returning).toBe(false)
  })
})
