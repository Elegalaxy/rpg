import { describe, expect, it } from 'vitest'

import { gameDefs, referenceLoadoutFor } from '../content/scenarios.ts'
import { HERO_CLASSES } from '../sim/constants.ts'
import { createCombat } from '../sim/combat.ts'

import { ELITE_CELLS } from './elites.ts'
import { FIFTH_SKILL_CANDIDATES, SLOT_VARIANTS, formatSlotsTable, runSlotsMatrix, slotSetup } from './slots.ts'

const cell = (elite: string, tier: string) => ELITE_CELLS.find((entry) => entry.elite === elite && entry.tier === tier)!

describe('slots matrix', () => {
  it('keeps exactly the reference four in the baseline', () => {
    for (const classId of HERO_CLASSES) {
      for (const skillId of FIFTH_SKILL_CANDIDATES[classId]) {
        const setup = slotSetup(classId, cell('warden', 'prepared'), skillId, 'four')!
        expect(setup.hero.equippedSkillIds).toEqual(referenceLoadoutFor(classId).equippedSkillIds)
        const equipped = setup.hero.equippedSkillIds ?? []
        const rowSkills = (setup.hero.priorityRows ?? []).map((row) => row.skillId)
        for (const id of FIFTH_SKILL_CANDIDATES[classId]) if (!equipped.includes(id)) expect(rowSkills).not.toContain(id)
      }
    }
  })

  it('gives the five variants five unique skills and the same nodes as the baseline', () => {
    for (const classId of HERO_CLASSES) {
      for (const skillId of FIFTH_SKILL_CANDIDATES[classId]) {
        const four = slotSetup(classId, cell('colossus', 'prepared'), skillId, 'four')!
        for (const variant of ['five-last', 'five-first'] as const) {
          const five = slotSetup(classId, cell('colossus', 'prepared'), skillId, variant)
          if (five === null) continue
          const equipped = five.hero.equippedSkillIds ?? []
          expect(equipped).toHaveLength(5)
          expect(new Set(equipped).size).toBe(5)
          expect(equipped).toContain(skillId)
          expect(five.hero.allocatedNodeIds).toEqual(four.hero.allocatedNodeIds)
        }
      }
    }
  })

  it('places the extra row last or before the first reference row', () => {
    const last = slotSetup('warrior', cell('warden', 'prepared'), 'cleave', 'five-last')!
    expect(last.hero.priorityRows!.at(-1)).toEqual({ skillId: 'cleave' })
    const first = slotSetup('warrior', cell('warden', 'prepared'), 'cleave', 'five-first')!
    const rows = first.hero.priorityRows!
    const at = rows.findIndex((row) => row.skillId === 'cleave')
    expect(at).toBeGreaterThan(-1)
    expect(referenceLoadoutFor('warrior').equippedSkillIds).toContain(rows[at + 1]!.skillId)
  })

  it('builds a combat for every buildable setup', () => {
    const defs = gameDefs()
    for (const classId of HERO_CLASSES) {
      for (const skillId of FIFTH_SKILL_CANDIDATES[classId]) {
        for (const variant of SLOT_VARIANTS) {
          const setup = slotSetup(classId, cell('reaver', 'prepared-crafted'), skillId, variant)
          if (setup !== null) expect(() => createCombat(setup, defs, 1)).not.toThrow()
        }
      }
    }
  })

  it('is deterministic on a small run and prints one line per row', () => {
    const filter = { classes: ['warrior'] as const, elites: ['warden'] as const, tiers: ['prepared'] as const }
    const a = runSlotsMatrix(1, 2, filter)
    const b = runSlotsMatrix(1, 2, filter)
    expect(a).toEqual(b)
    expect(a.length).toBeGreaterThan(0)
    expect(formatSlotsTable(a).trim().split('\n')).toHaveLength(a.length)
  })

  it('records the row cap instead of running a variant that would pass it', () => {
    expect(slotSetup('mage', cell('tyrant', 'prepared'), 'chain-lightning', 'five-last')).toBeNull()
    const rows = runSlotsMatrix(1, 1, { classes: ['mage'], elites: ['tyrant'], tiers: ['prepared'] })
    expect(rows.map((row) => [row.variant, row.note])).toEqual([['four', null], ['five-last', 'row cap'], ['five-first', 'row cap']])
    expect(formatSlotsTable(rows)).toContain('five-last: row cap')
  })
})
