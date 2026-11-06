import { describe, expect, it } from 'vitest'

import { createHero } from '../../persist/roster.ts'
import { newSave } from '../../persist/save.ts'

import { goingInLines } from './goingInLines.ts'

function heroOf() {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'warrior' })
  if (!made.ok) throw new Error(made.reason)
  return made.save.heroes[0]!
}

describe('the going-in summary', () => {
  it('lists skills, rules, gear, supplies, and retreat, and warns about what is missing', () => {
    const hero = heroOf()
    const lines = goingInLines(hero)
    expect(lines.map((line) => line.label)).toEqual(['Skills', 'Rules', 'Gear', 'Supplies', 'Retreat'])
    expect(lines.find((line) => line.label === 'Supplies')?.warn).toBeDefined()
    const broken = { ...hero, equipment: { ...hero.equipment, mainHand: { ...hero.equipment.mainHand!, durability: 0 } } }
    expect(goingInLines(broken).find((line) => line.label === 'Gear')?.warn).toMatch(/Broken/)
    const loose = { ...hero, progress: { ...hero.progress, learnedSkillIds: [...hero.progress.learnedSkillIds, 'cleave'] } }
    expect(goingInLines(loose).find((line) => line.label === 'Skills')?.warn).toMatch(/1 learned skill not equipped/)
  })
})
