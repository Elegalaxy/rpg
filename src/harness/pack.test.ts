import { describe, expect, it } from 'vitest'

import { HERO_CLASSES } from '../sim/constants.ts'

import { ELITE_CELLS } from './elites.ts'
import { PACK_SLOT_COUNTS, formatPackTable, packSetup, runPackMatrix } from './pack.ts'

const cell = (elite: string, tier: string) => ELITE_CELLS.find((entry) => entry.elite === elite && entry.tier === tier)!

describe('pack matrix', () => {
  it('measures 4, 5 and 6 slots', () => {
    expect(PACK_SLOT_COUNTS).toEqual([4, 5, 6])
  })

  it('tops the tier supplies up with its main healing supply and leaves 4 slots as they were', () => {
    for (const classId of HERO_CLASSES) {
      const prepared = cell('warden', 'prepared')
      const four = packSetup(classId, prepared, 4)
      expect(four.hero.supplies).toEqual(['healing-draught', 'healing-draught', 'healing-draught', 'ward-charm'])
      expect(packSetup(classId, prepared, 6).hero.supplies).toEqual([...four.hero.supplies!, 'healing-draught', 'healing-draught'])
      const crafted = packSetup(classId, cell('colossus', 'prepared-crafted'), 5)
      expect(crafted.hero.supplies).toEqual(['greater-draught', 'greater-draught', 'greater-draught', 'riftglass-ward', 'greater-draught'])
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
