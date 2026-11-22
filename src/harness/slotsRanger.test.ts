import { describe, expect, it, vi } from 'vitest'

import { gameDefs } from '../content/scenarios.ts'
import { createCombat } from '../sim/combat.ts'

import { ELITE_IDS } from './elites.ts'
import { RANGER_FOUR_SKILLS, RANGER_VARIANTS, SIDE_ENEMIES, formatRangerReport, rangerDefs, rangerSetup, runRangerShard, runSideShard, sideSetup, summarize, verdictFor, type RangerShard } from './slotsRanger.ts'
import { MAX_PRIORITY_ROWS } from '../sim/automation.ts'

// These run many full fights; give them room when other work keeps the CPU busy.
vi.setConfig({ testTimeout: 120_000 })

describe('slotsRanger', () => {
  it('builds valid setups for every variant, elite, tier, placement and shape', () => {
    for (const variant of RANGER_VARIANTS) {
      const defs = rangerDefs(variant)
      for (const elite of ELITE_IDS) {
        for (const tier of ['prepared', 'prepared-crafted'] as const) {
          for (const placement of ['first', 'last'] as const) {
            for (const shape of variant.id === 'P-snare' ? (['five'] as const) : (['five', 'swap'] as const)) {
              const setup = rangerSetup(variant, elite, tier, placement, shape)
              expect(setup).not.toBeNull()
              expect(setup!.hero.priorityRows!.length).toBeLessThanOrEqual(MAX_PRIORITY_ROWS)
              expect(setup!.hero.priorityRows!.some((row) => row.skillId === variant.skillId)).toBe(true)
              const equipped = setup!.hero.equippedSkillIds ?? []
              expect(new Set(equipped).size).toBe(equipped.length)
              if (variant.id === 'P-snare') expect(equipped).toHaveLength(4)
              else expect(equipped).toHaveLength(shape === 'swap' ? 4 : 5)
              if (shape === 'swap') expect(equipped).not.toContain('snare-trap')
              expect(equipped).toContain(variant.skillId)
              expect(() => createCombat(setup!, defs, 1)).not.toThrow()
            }
          }
        }
      }
    }
  })

  it('gives each four baseline the reference skills and the same nodes as its variants', () => {
    for (const skillId of RANGER_FOUR_SKILLS) {
      const variant = RANGER_VARIANTS.find((entry) => entry.skillId === skillId)!
      const four = rangerSetup(variant, 'warden', 'prepared', 'last', 'four')!
      expect(four.hero.equippedSkillIds).toEqual(['aimed-shot', 'piercing-arrow', 'fade-back', 'snare-trap'])
      for (const entry of RANGER_VARIANTS.filter((other) => other.skillId === skillId)) {
        expect(rangerSetup(entry, 'warden', 'prepared', 'first', 'five')!.hero.allocatedNodeIds).toEqual(four.hero.allocatedNodeIds)
      }
    }
  })

  it('puts the rows ahead of the reference rows or before the fallback attack', () => {
    const variant = RANGER_VARIANTS.find((entry) => entry.id === 'HM-X')!
    const first = rangerSetup(variant, 'warden', 'prepared', 'first', 'five')!.hero.priorityRows!
    const at = first.findIndex((row) => row.skillId === 'hunters-mark')
    expect(first[at + 1]!.skillId).toBe('fade-back')
    const last = rangerSetup(variant, 'warden', 'prepared', 'last', 'five')!.hero.priorityRows!
    expect(last.at(-1)!.skillId).toBe('piercing-arrow')
    expect(last.at(-2)!.skillId).toBe('hunters-mark')
  })

  it('patches a copy of the definitions and never the real ones', () => {
    const before = JSON.stringify(gameDefs().skills)
    const originalHm = gameDefs().skills['hunters-mark']!
    for (const variant of RANGER_VARIANTS) rangerDefs(variant)
    expect(JSON.stringify(gameDefs().skills)).toBe(before)
    const hmx = rangerDefs(RANGER_VARIANTS.find((entry) => entry.id === 'HM-X')!)
    expect(hmx.skills['hunters-mark']).not.toEqual(originalHm)
    expect(hmx.skills['hunters-mark']).toMatchObject({ cost: 0, actionTimeCoefficient: 0.5, cooldownSeconds: 8, tags: ['mark', 'physical'] })
    expect(hmx.skills['aimed-shot']).toBe(gameDefs().skills['aimed-shot'])
    const fa = rangerDefs(RANGER_VARIANTS.find((entry) => entry.id === 'FA-0')!)
    expect(fa.skills['flame-arrow']).toMatchObject({ cost: 0, ammoCost: 1 })
    expect(gameDefs().skills['flame-arrow']!.cost).toBe(20)
    expect(gameDefs().skills['hunters-mark']).toEqual(originalHm)
  })

  it('swaps Snare Trap out and runs the side check setups', () => {
    const variant = RANGER_VARIANTS.find((entry) => entry.id === 'HM-X')!
    for (const enemy of SIDE_ENEMIES) {
      const four = sideSetup(variant, enemy, 'last', false)
      const swapped = sideSetup(variant, enemy, 'last', true)
      expect(four.hero.equippedSkillIds).toContain('snare-trap')
      expect(swapped.hero.equippedSkillIds).not.toContain('snare-trap')
      expect(swapped.hero.equippedSkillIds).toContain('hunters-mark')
      expect(swapped.hero.equippedSkillIds).toHaveLength(four.hero.equippedSkillIds!.length)
      expect(() => createCombat(swapped, rangerDefs(variant), 1)).not.toThrow()
    }
  })

  it('is deterministic on a small run, and a shard has one row per elite', () => {
    const a = runRangerShard('HM-X:last:five', 1, 2, 'prepared')
    expect(runRangerShard('HM-X:last:five', 1, 2, 'prepared')).toEqual(a)
    expect(a.rows.map((row) => row.elite)).toEqual([...ELITE_IDS])
    expect(runRangerShard('four:hunters-mark', 1, 2, 'prepared').rows).toHaveLength(ELITE_IDS.length)
    const side = runSideShard('HM-X', 'last', 1, 2)
    expect(side.rows).toHaveLength(SIDE_ENEMIES.length * 2)
    expect(runSideShard('HM-X', 'last', 1, 2)).toEqual(side)
  })

  it('summarizes and judges a config against its four baseline', () => {
    const shard = (config: string, seed: number, wins: number[], median: number): RangerShard => ({
      config,
      seed,
      runs: 100,
      tier: 'prepared',
      rows: ELITE_IDS.map((elite, index) => ({ config, elite, tier: 'prepared', winRate: wins[index]!, hpLost: 0.5, medianWinMs: median })),
    })
    const shards = [1, 2, 3].flatMap((seed) => [shard('four:hunters-mark', seed, [0.5, 0.6, 0.7, 0.96], 100_000), shard('HM-X:last:five', seed, [0.56, 0.66, 0.76, 0.99], 95_000)])
    const summary = summarize(shards, 'HM-X:last:five', 'hunters-mark', 'prepared')!
    expect(summary.change).toBeCloseTo(5.25)
    expect(summary.perSeed).toHaveLength(3)
    expect(summary.crossing).toBe(0)
    expect(summary.medianChange).toBeCloseTo(-0.05)
    expect(verdictFor(summary).qualifies).toBe(true)
    expect(verdictFor({ ...summary, change: 3 }).qualifies).toBe(false)
    expect(verdictFor({ ...summary, change: 11 }).qualifies).toBe(false)
    expect(verdictFor({ ...summary, perSeed: [8, 8, -1] }).qualifies).toBe(false)
    expect(verdictFor({ ...summary, perSeed: [8, 3.2, 8] }).qualifies).toBe(false)
    expect(verdictFor({ ...summary, crossing: 3 }).qualifies).toBe(false)
    expect(verdictFor({ ...summary, medianChange: -0.25 }).qualifies).toBe(false)
    expect(formatRangerReport(shards)).toContain('QUALIFIES')
  })
})
