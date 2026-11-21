import { describe, expect, it } from 'vitest'

import { gameDefs } from '../content/scenarios.ts'

import { VENOM_CELLS, baselineOf, measureVenom, parseVariant, venomDefs, venomSetup, verdictFor, type VenomShard } from './venom.ts'

const cell = VENOM_CELLS.find((entry) => entry.elite === 'warden' && entry.tier === 'prepared')!

describe('venom passive harness (Step 13.39)', () => {
  it('patches only copies of the definitions, and `current` has no passive', () => {
    expect(gameDefs().envenom).toMatchObject({ coefficient: 0.08, nodeCoefficient: 0.1, basicBonus: 0.1 })
    expect(venomDefs(parseVariant('current')).envenom).toBeUndefined()
    const patched = venomDefs(parseVariant('passive-10-empty'))
    expect(patched.envenom).toMatchObject({ baseChance: 1, coefficient: 0.1, nodeCoefficient: 0.1 })
    expect(gameDefs().envenom).toMatchObject({ coefficient: 0.08 })
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

  it('the no-node variants leave the Venom Edge node out, and `live-baseNN-nonode` changes only the base tick (Step 13.47)', () => {
    expect(venomSetup(parseVariant('live'), cell).hero.allocatedNodeIds).toContain('assassin-venom-edge')
    expect(venomSetup(parseVariant('live-nonode'), cell).hero.allocatedNodeIds).not.toContain('assassin-venom-edge')
    expect(venomSetup(parseVariant('current-nonode'), cell).hero.allocatedNodeIds).not.toContain('assassin-venom-edge')
    expect(venomDefs(parseVariant('live-base10-nonode')).envenom).toMatchObject({ coefficient: 0.1, nodeCoefficient: 0.1 })
    expect(venomDefs(parseVariant('live-nonode')).envenom).toMatchObject({ coefficient: 0.08 })
    expect(gameDefs().envenom).toMatchObject({ coefficient: 0.08 })
    expect(baselineOf('live-nonode')).toBe('current')
  })

  it('the n10 variants keep the node and put a job on it with the 10% base (Step 13.50)', () => {
    for (const id of ['n10-cap', 'n10-tick11', 'n10-basic15', 'n10-none']) {
      expect(venomSetup(parseVariant(id), cell).hero.allocatedNodeIds).toContain('assassin-venom-edge')
      expect(venomDefs(parseVariant(id)).envenom).toMatchObject({ coefficient: 0.1 })
    }
    expect(venomDefs(parseVariant('n10-none')).envenom).toMatchObject({ nodeCoefficient: 0.1 })
    expect(venomDefs(parseVariant('n10-tick11')).envenom).toMatchObject({ nodeCoefficient: 0.11 })
    expect(venomDefs(parseVariant('n10-basic15')).envenom).toMatchObject({ nodeBasicBonus: 0.15 })
    expect(venomDefs(parseVariant('n10-cap')).envenom).toMatchObject({ nodeCapBonus: 1 })
    expect(baselineOf('n10-cap+to')).toBe('current+to')
  })

  it('`current` stays within the 12-row cap on every cell, dropping the Burn Tonic row on the Tyrant builds (Step 13.47)', () => {
    for (const entry of VENOM_CELLS) {
      const rows = venomSetup(parseVariant('current'), entry).hero.priorityRows ?? []
      expect(rows.length).toBeLessThanOrEqual(12)
      expect(rows.some((row) => row.skillId === 'venom-edge')).toBe(true)
    }
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
