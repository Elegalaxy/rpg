import type { HeroClass } from '../../sim/constants.ts'
import type { SkillWeb } from '../../sim/progression.ts'

import { assassinWeb } from './assassin.ts'
import { clericWeb } from './cleric.ts'
import { mageWeb } from './mage.ts'
import { rangerWeb } from './ranger.ts'
import { warriorWeb } from './warrior.ts'

export const classWebs: { readonly [id in HeroClass]: SkillWeb } = {
  warrior: warriorWeb,
  assassin: assassinWeb,
  ranger: rangerWeb,
  mage: mageWeb,
  cleric: clericWeb,
}

export { assassinWeb, clericWeb, mageWeb, rangerWeb, warriorWeb }
