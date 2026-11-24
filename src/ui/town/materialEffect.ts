import { UPGRADE_QUALITY_POINTS, upgradedQuality } from '../../persist/crafting.ts'
import { TEMPER_PER_POINT } from '../../sim/economy.ts'

/** The temper a material binds as a percent of the modifier's strength: `+75%` for cinderite and bloodstone, `none` for scrap. */
export function temperText(grade: number): string {
  return grade > 0 ? `+${Math.round(grade * TEMPER_PER_POINT * 100)}%` : 'none'
}

function percent(value: number): string {
  return `${Math.round(value * 1000) / 10}%`
}

/** What opening a socket does to this item's quality: `100% → 105%`, or `none` when the material adds nothing. */
export function qualityEffectText(materialId: string, quality: number): string {
  const points = UPGRADE_QUALITY_POINTS[materialId] ?? 0
  if (points <= 0) return 'none'
  const next = upgradedQuality(quality, materialId)
  if (next === quality) return `${percent(quality)} (already at the cap)`
  return `${percent(quality)} → ${percent(next)}`
}
