import { UPGRADE_QUALITY_POINTS, upgradeCapFor } from '../../persist/crafting.ts'
import { TEMPER_PER_POINT } from '../../sim/economy.ts'

/** The temper a material binds as a percent of the modifier's strength: `+75%` for cinderite, `none` for scrap. */
export function temperText(grade: number): string {
  return grade > 0 ? `+${Math.round(grade * TEMPER_PER_POINT * 100)}%` : 'none'
}

/** What a material does to quality when it opens a socket: `+5, up to 120%`, or `none` for scrap. */
export function qualityEffectText(materialId: string): string {
  const points = UPGRADE_QUALITY_POINTS[materialId] ?? 0
  return points > 0 ? `+${points}, up to ${Math.round(upgradeCapFor(materialId) * 100)}%` : 'none'
}
