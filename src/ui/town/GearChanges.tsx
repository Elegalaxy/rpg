import { changeIsBetter, type EquipPreview } from '../../persist/equipment.ts'

/** One decimal at most, like the Equipment screen's stat panel; whole numbers print without a decimal. */
function format(value: number, unit: string): string {
  return `${Math.round(value * 10) / 10}${unit}`
}

/** The signed difference, with a real minus sign so it lines up and reads without colour. */
function delta(before: number, after: number, unit: string): string {
  const diff = Math.round((after - before) * 10) / 10
  return `${diff > 0 ? '+' : diff < 0 ? '−' : ''}${Math.abs(diff)}${unit}`
}

/**
 * The stat changes of wearing an item, green when better and red when worse, or why it cannot be worn. It names the
 * worn piece that is replaced, and lists changes that are not stats, such as bag room.
 */
export function GearChanges({ preview, empty }: { preview: EquipPreview; empty: string }) {
  if (preview.block !== null) return <small className="row-note">{preview.block}</small>
  const { replaces, extras, notes } = preview
  if (preview.changes.length === 0 && extras.length === 0 && notes.length === 0 && replaces === null) return <small className="row-note">{empty}</small>
  return (
    <small className="row-note gear-changes" data-testid="equip-changes">
      {replaces === null ? null : (
        <span className="gear-replaces" data-testid="equip-replaces">
          Replaces: {replaces.name} · L{replaces.itemLevel} · {Math.round(replaces.quality * 100)}%
        </span>
      )}
      <span className="change-list">
        {preview.changes.length === 0 && extras.length === 0 && notes.length === 0 ? <span>No stat change.</span> : null}
        {preview.changes.map((change) => (
          <span key={change.label} className={changeIsBetter(change.label, change.before, change.after) ? 'change-better' : 'change-worse'}>
            {change.label} {format(change.before, change.unit)} → {format(change.after, change.unit)} ({delta(change.before, change.after, change.unit)})
          </span>
        ))}
        {extras.map((change) => (
          <span key={change.label} className={change.after > change.before ? 'change-better' : 'change-worse'} data-testid="equip-extra">
            {change.label} {format(change.before, change.unit)} → {format(change.after, change.unit)} ({delta(change.before, change.after, change.unit)})
          </span>
        ))}
        {notes.map((note) => (
          <span key={note} className={note.startsWith('Gains') ? 'change-better' : 'change-worse'}>
            {note}
          </span>
        ))}
      </span>
    </small>
  )
}
