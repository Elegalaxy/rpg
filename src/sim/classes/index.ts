import type { HeroClass } from '../constants.ts'
import type { ClassModule } from '../types.ts'
import { assassinClass } from './assassin.ts'
import { mageClass } from './mage.ts'
import { rangerClass } from './ranger.ts'
import { warriorClass } from './warrior.ts'

const CLASS_MODULES: { [id: string]: ClassModule } = {
  warrior: warriorClass,
  assassin: assassinClass,
  ranger: rangerClass,
  mage: mageClass,
}

/** Class behavior lives on the module. Combat looks up hooks here and does not branch on class id. */
export function classModule(classId: HeroClass): ClassModule | null {
  return CLASS_MODULES[classId] ?? null
}
