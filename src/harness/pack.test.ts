import { describe, expect, it } from 'vitest'

import { HERO_CLASSES } from '../sim/constants.ts'

import { ELITE_CELLS } from './elites.ts'
import { PACK_SLOT_COUNTS, formatPackTable, packSetup, runPackMatrix } from './pack.ts'

const cell = (elite: string, tier: string) => ELITE_CELLS.find((entry) => entry.elite === elite && entry.tier === tier)!

describe('pack matrix', () => {
  it('measures 4, 5 and 6 slots', () => {
    expect(PACK_SLOT_COUNTS).toEqual([4, 5, 6])
  })

  it('keeps 4 slots as the tier had them and fills 5 and 6 under the stack limit with variety', () => {
    for (const classId of HERO_CLASSES) {
      const prepared = cell('warden', 'prepared')
      expect(packSetup(classId, prepared, 4).hero.supplies).toEqual(['healing-draught', 'healing-draught', 'healing-draught', 'ward-charm'])
      expect(packSetup(classId, prepared, 5).hero.supplies).toEqual(['healing-draught', 'healing-draught', 'healing-draught', 'ward-charm', 'antidote'])
      const crafted = cell('colossus', 'prepared-crafted')
      expect(packSetup(classId, crafted, 4).hero.supplies).toEqual(['greater-draught', 'greater-draught', 'greater-draught', 'riftglass-ward'])
      expect(packSetup(classId, crafted, 5).hero.supplies).toEqual(['greater-draught', 'greater-draught', 'greater-draught', 'riftglass-ward', 'ward-charm'])
      expect(packSetup(classId, crafted, 6).hero.supplies).toEqual(['greater-draught', 'greater-draught', 'greater-draught', 'riftglass-ward', 'ward-charm', 'healing-draught'])
      expect(packSetup(classId, prepared, 6).hero.supplies).toEqual(['healing-draught', 'healing-draught', 'healing-draught', 'ward-charm', 'antidote', 'smoke-bomb'])
    }
    expect(packSetup('ranger', cell('reaver', 'prepared'), 5).hero.carriedSupplyCount).toBe(5)
    expect(() => packSetup('warrior', cell('warden', 'prepared'), 7)).toThrow(/from 4 to 6/)
  })

  it('runs a filtered matrix and prints one line per row', () => {
    const rows = runPackMatrix(1, 1, { classes: ['warrior'], elites: ['warden'], tiers: ['prepared'] })
    expect(rows.map((row) => row.slots)).toEqual([4, 5, 6])
    expect(formatPackTable(rows).trim().split('\n')).toHaveLength(3)
  })
})
