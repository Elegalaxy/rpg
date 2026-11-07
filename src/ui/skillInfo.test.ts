import { describe, expect, it } from 'vitest'

import { NODE_SUNDERING_BLOW } from '../sim/classes/warriorAdjust.ts'
import { skillFacts } from './skillInfo.ts'

describe('skillFacts', () => {
  it('shows the base cooldown without the node and the node cooldown with it', () => {
    expect(skillFacts('sundering-blow')?.stats).toContain('Cooldown 6 s')
    expect(skillFacts('sundering-blow', [NODE_SUNDERING_BLOW])?.stats).toContain('Cooldown 5 s')
  })
})
