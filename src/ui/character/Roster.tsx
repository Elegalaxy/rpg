import { useState } from 'react'

import { classIdentity, raceIdentity } from '../../content/heroes.ts'
import { MAX_SLOTS } from '../../persist/save.ts'
import { freeSlots } from '../../persist/roster.ts'
import { chooseHero, devUnlockAllSlots, useSaveStatus } from '../store.ts'

export function Roster() {
  const { save } = useSaveStatus()
  const [error, setError] = useState<string | null>(null)
  return (
    <section aria-label="Roster">
      <h2>Roster</h2>
      <p>
        {save.heroes.length} of {save.account.slots} slots in use ({MAX_SLOTS} at most).
        {import.meta.env.DEV && save.account.slots < MAX_SLOTS ? (
          <>
            {' '}
            <button type="button" onClick={devUnlockAllSlots}>
              Dev: unlock all slots
            </button>
          </>
        ) : null}
      </p>
      {save.heroes.length === 0 ? <p>No heroes yet. Create one below.</p> : null}
      <ul>
        {save.heroes.map((hero) => {
          const selected = hero.id === save.selectedHeroId
          return (
            <li key={hero.id}>
              <strong>{hero.name}</strong> — {raceIdentity[hero.progress.race].name} {classIdentity[hero.classId].name},
              level {hero.progress.level} ({hero.progress.xp} XP into the level){' '}
              {selected ? (
                <em>(selected)</em>
              ) : (
                <button type="button" onClick={() => setError(chooseHero(hero.id))}>
                  Select
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {freeSlots(save) < 1 ? <p>All slots are in use. Slots open as the account reaches milestones.</p> : null}
      {error !== null ? <p role="alert">{error}</p> : null}
    </section>
  )
}
