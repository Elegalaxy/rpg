import type { PlaceId } from '../../content/places.ts'
import { debugLog } from '../debug.ts'

/** The town places as one picker for phones. A waiting count rides on each option's name. */
export function PlacePicker({
  places,
  current,
  onPick,
  badges,
}: {
  places: { id: PlaceId; label: string }[]
  current: PlaceId
  onPick: (id: PlaceId) => void
  badges: { [id: string]: { count: number; what: string } }
}) {
  const waiting = Object.values(badges).reduce((sum, badge) => sum + badge.count, 0)
  return (
    <div className="place-picker">
      <label>
        Place{' '}
        <select
          value={current}
          onChange={(event) => {
            const id = event.target.value as PlaceId
            debugLog('[ui]', 'place picked', { id })
            onPick(id)
          }}
        >
          {places.map((entry) => {
            const count = badges[entry.id]?.count ?? 0
            return (
              <option key={entry.id} value={entry.id}>
                {count > 0 ? `${entry.label} (${count})` : entry.label}
              </option>
            )
          })}
        </select>
      </label>
      {waiting > 0 ? (
        <span className="badge" role="status" aria-label={`${waiting} things waiting in town`}>
          {waiting}
        </span>
      ) : null}
    </div>
  )
}
