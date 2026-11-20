import { describe, expect, it } from 'vitest'

import { gameDefs } from '../content/scenarios.ts'

import { VENOM_CELLS, baselineOf, measureVenom, parseVariant, venomDefs, venomSetup, verdictFor, type VenomShard } from './venom.ts'

const cell = VENOM_CELLS.find((entry) => entry.elite === 'warden' && entry.tier === 'prepared')!

describe('venom passive harness (Step 13.39)', () => {
  it('never switches the passive on in the real definitions', () => {
    expect(gameDefs().envenom).toBeUndefined()
    const patched = venomDefs(parseVariant('passive-10-empty'))
    expect(patched.envenom).toMatchObject({ baseChance: 1, coefficient: 0.1, nodeCoefficient: 0.1 })
    expect(gameDefs().envenom).toBeUndefined()
  })

  it('current keeps Venom Edge; a passive variant drops it and the fan variant adds a row', () => {
    const current = venomSetup(parseVariant('current'), cell)
    expect(current.hero.equippedSkillIds).toContain('venom-edge')
    const empty = venomSetup(parseVariant('passive-10-empty'), cell)
    expect(empty.hero.equippedSkillIds).not.toContain('venom-edge')
    expect(empty.hero.priorityRows?.some((row) => row.skillId === 'venom-edge')).toBe(false)
    const fan = venomSetup(parseVariant('passive-10-fan'), cell)
    expect(fan.hero.equippedSkillIds).toContain('fan-of-knives')
    expect(fan.hero.allocatedNodeIds).toContain('assassin-fan-of-knives')
    const sovereign = venomSetup(parseVariant('current+ts'), cell)
    expect(sovereign.hero.allocatedNodeIds).toEqual(expect.arrayContaining(['assassin-toxic-opportunity', 'assassin-toxic-sovereign']))
  })

  it('the fan-only probe patches the Fan of Knives definition only on a copy', () => {
    const patched = venomDefs(parseVariant('fan-only-10'))
    expect(patched.skills['fan-of-knives']!.effects.some((effect) => effect.kind === 'applyStatus')).toBe(true)
    expect(gameDefs().skills['fan-of-knives']!.effects.some((effect) => effect.kind === 'applyStatus')).toBe(false)
  })

  it('measures a few runs and reports Poison uptime; the baseline of a modifier is current with it', () => {
    const variant = parseVariant('passive-10-empty')
    const result = measureVenom(venomSetup(variant, cell), venomDefs(variant), 1, 2)
    expect(result.winRate).toBeGreaterThanOrEqual(0)
    expect(result.uptime).toBeGreaterThan(0)
    expect(baselineOf('passive-10-empty+to')).toBe('current+to')
    expect(verdictFor([] as VenomShard[], 'passive-10-empty').go).toBe(false)
  })
})
