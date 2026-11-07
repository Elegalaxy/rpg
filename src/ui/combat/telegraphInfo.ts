import { enemies } from '../../content/enemies.ts'
import type { ActorTelegraph, EnemySkillDef } from '../../sim/types.ts'

/** A damage coefficient at or above this makes a telegraphed skill a heavy attack. */
export const HEAVY_COEFFICIENT = 1.5

/** The enemy skill a telegraph belongs to, looked up on its definition. */
export function telegraphSkill(defId: string, telegraph: ActorTelegraph): EnemySkillDef | null {
  if (telegraph.skillId === undefined) return null
  return enemies[defId]?.skills?.find((skill) => skill.id === telegraph.skillId) ?? null
}

/** True when the skill has a damage effect of at least 150% power. */
export function isHeavy(skill: EnemySkillDef | null): boolean {
  if (skill === null) return false
  return skill.effects.some((effect) => effect.kind === 'damage' && effect.coefficient >= HEAVY_COEFFICIENT)
}

/** "Interrupt 12/27 HP" for a telegraph that damage can cancel, or null when it cannot. */
export function interruptText(telegraph: ActorTelegraph, maxHp: number): string | null {
  if (telegraph.interruptMaxHpFraction === undefined) return null
  const needed = Math.ceil(maxHp * telegraph.interruptMaxHpFraction)
  const taken = Math.min(needed, Math.floor(telegraph.hpTaken ?? 0))
  return `Interrupt ${taken}/${needed} HP`
}
