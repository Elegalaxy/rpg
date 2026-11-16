import { describe, expect, it } from 'vitest'

import { ITEM_MODIFIERS, MODIFIER_STACK_CAP, modifierRankAt, modifierTemperAt } from '../sim/economy.ts'
import { HERO_CLASSES } from '../sim/constants.ts'

import { CAUSEWAY_FIGHTS, CAUSEWAY_TIERS } from './causeway.ts'
import {
  MODDED_ROWS,
  SECOND_MODIFIERS,
  craftedEquipment,
  formatModdedCsv,
  formatModdedTable,
  moddedSetup,
  runModdedMatrix,
  summarizeModded,
} from './modded.ts'
import { wardenSetup } from './warden.ts'

const row = (id: string) => MODDED_ROWS.find((entry) => entry.id === id)!

describe('modded matrix', () => {
  it('lists the planned rows', () => {
    expect(MODDED_ROWS.map((entry) => entry.id)).toEqual(['arrived', 'plain', 'socket', 'rank2', 'rank3', 'temper', 'rank3-top', 'stack', 'infuse-rift', 'stack-rift'])
  })

  it('keeps every second modifier inside the stack cap on top of the first ones', () => {
    const counts: { [id: string]: number } = {}
    const crafted = craftedEquipment('warrior', row('socket'))
    for (const item of Object.values(crafted.equipment)) for (const id of item?.modifiers ?? []) counts[id] = (counts[id] ?? 0) + 1
    for (const id of Object.keys(counts)) expect(counts[id], id).toBeLessThanOrEqual(MODIFIER_STACK_CAP)
    for (const id of Object.values(SECOND_MODIFIERS)) expect(ITEM_MODIFIERS[id]).toBeDefined()
  })

  it('builds the gear with the game crafting jobs and prices it', () => {
    const plain = craftedEquipment('mage', row('plain'))
    expect(plain.gold).toBe(0)
    expect(plain.equipment.mainHand?.modifiers).toEqual(['piercing'])
    const socket = craftedEquipment('mage', row('socket'))
    expect(socket.equipment.mainHand).toMatchObject({ socketed: true, modifiers: ['piercing', 'vicious'], quality: 1.03 })
    expect(socket.equipment.head?.socketed).toBeUndefined()
    expect(socket.gold).toBe(4 * (17 * 40 + 17 * 10))
    const rank3 = craftedEquipment('mage', row('rank3'))
    expect(rank3.equipment.mainHand && modifierRankAt(rank3.equipment.mainHand, 0)).toBe(3)
    expect(rank3.equipment.mainHand && modifierTemperAt(rank3.equipment.mainHand, 0)).toBe(3)
    const top = craftedEquipment('mage', row('temper'))
    expect(top.equipment.mainHand && modifierRankAt(top.equipment.mainHand, 0)).toBe(2)
    expect(top.equipment.mainHand && modifierTemperAt(top.equipment.mainHand, 0)).toBe(5)
    const stack = craftedEquipment('mage', row('stack'))
    expect(stack.equipment.accessory1?.modifiers).toEqual(['vicious', 'keen'])
    expect(stack.equipment.accessory1 && modifierRankAt(stack.equipment.accessory1, 1)).toBe(3)
    const rift = craftedEquipment('mage', row('stack-rift'))
    expect(rift.equipment.accessory1?.modifiers).toEqual(['vicious', 'keen'])
    expect(rift.equipment.accessory1 && modifierRankAt(rift.equipment.accessory1, 1)).toBe(3)
    expect(rift.equipment.accessory1 && modifierTemperAt(rift.equipment.accessory1, 1)).toBe(3)
    expect(rift.materials).not.toHaveProperty('cinderite')
    expect(craftedEquipment('mage', row('infuse-rift')).materials).not.toHaveProperty('cinderite')
  })

  it('leaves the plain row equal to the Warden-style hero and the reference row to the arrived tier', () => {
    const fight = CAUSEWAY_FIGHTS[0]!
    for (const classId of HERO_CLASSES) {
      expect(moddedSetup(classId, row('arrived'), fight).hero).toEqual(wardenSetup(classId, CAUSEWAY_TIERS[0]!).hero)
      const plain = moddedSetup(classId, row('plain'), fight)
      const heavy = moddedSetup(classId, row('stack'), fight)
      expect(plain.hero.level).toBe(17)
      expect(heavy.hero.statBonuses).not.toEqual(plain.hero.statBonuses)
    }
  })

  it('runs every class, row and fight', () => {
    const report = runModdedMatrix(1, 1)
    expect(report.rows).toHaveLength(HERO_CLASSES.length * MODDED_ROWS.length * CAUSEWAY_FIGHTS.length)
    expect(summarizeModded(report.rows)).toHaveLength(HERO_CLASSES.length * MODDED_ROWS.length)
    expect(formatModdedTable(report)).toContain('warrior stack:')
    expect(formatModdedCsv(report).split('\n')[0]).toBe('class,row,fight,win_rate,hp_left,median_ms')
  }, 300_000)
})
