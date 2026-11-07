import { describe, expect, it } from 'vitest'

import { enemies } from '../../content/enemies.ts'

import { interruptText, isHeavy, telegraphSkill } from './telegraphInfo.ts'

describe('telegraph display facts', () => {
  it('finds the skill, marks heavy attacks, and reads the interrupt progress', () => {
    const slam = { tag: 'bramble-slam', skillId: 'bramble-slam', resolvesAtMs: 3000, hpTaken: 12.7, interruptMaxHpFraction: 0.25 }
    const skill = telegraphSkill('thornbeast', slam)
    expect(skill?.name).toBe('Bramble Slam')
    expect(isHeavy(skill)).toBe(true)
    expect(interruptText(slam, 265)).toBe('Interrupt 12/67 HP')
    expect(interruptText({ ...slam, hpTaken: 500 }, 265)).toBe('Interrupt 67/67 HP')
  })

  it('shows no interrupt text for an uninterruptible telegraph and no Heavy for a light skill', () => {
    const bolt = { tag: 'aimed-bolt', skillId: 'aimed-bolt', resolvesAtMs: 3000 }
    expect(interruptText(bolt, 300)).toBeNull()
    expect(isHeavy(telegraphSkill('fallen-arbalist', bolt))).toBe(true)
    const roots = enemies['rootmaw-stalker']?.skills?.find((entry) => entry.id === 'grasping-roots') ?? null
    expect(isHeavy(roots)).toBe(false)
    expect(telegraphSkill('thornbeast', { tag: 'x', resolvesAtMs: 1 })).toBeNull()
  })
})
