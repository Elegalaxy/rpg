import { changeIsBetter, type EquipPreview } from '../../persist/equipment.ts'

function format(value: number, unit: string): string {
  return `${Math.round(value * 100) / 100}${unit}`
}

/** The stat changes of wearing an item, green when better and red when worse, or why it cannot be worn. */
export function GearChanges({ preview, empty }: { preview: EquipPreview; empty: string }) {
  if (preview.block !== null) return <small className="row-note">{preview.block}</small>
  if (preview.changes.length === 0) return <small className="row-note">{empty}</small>
  return (
    <small className="row-note change-list" data-testid="equip-changes">
      {preview.changes.map((change) => (
        <span key={change.label} className={changeIsBetter(change.label, change.before, change.after) ? 'change-better' : 'change-worse'}>
          {change.label} {format(change.before, change.unit)} → {format(change.after, change.unit)}
        </span>
      ))}
    </small>
  )
}
