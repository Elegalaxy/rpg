import { useState } from 'react'

import { classIdentity, raceIdentity } from '../../content/heroes.ts'
import { Row } from '../Row.tsx'
import { MAX_SLOTS } from '../../persist/save.ts'
import { xpToNextLevel } from '../../sim/stats.ts'
import { freeSlots } from '../../persist/roster.ts'
import { chooseHero, deleteHeroFromUi, devUnlockAllSlots, useSaveStatus } from '../store.ts'

export function Roster() {
  const { save } = useSaveStatus()
  const [error, setError] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
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
      <ul className="rows">
        {save.heroes.map((hero) => {
          const selected = hero.id === save.selectedHeroId
          return (
            <Row
              key={hero.id}
              actions={
                confirmingId === hero.id ? (
                  <>
                    <span role="alert">Delete {hero.name} for good?</span>
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() => {
                        setError(deleteHeroFromUi(hero.id))
                        setConfirmingId(null)
                      }}
                    >
                      Confirm delete
                    </button>
                    <button type="button" onClick={() => setConfirmingId(null)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    {selected ? (
                      <em>Selected</em>
                    ) : (
                      <button type="button" className="btn-primary" onClick={() => setError(chooseHero(hero.id))}>
                        Select
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-danger"
                      disabled={save.expedition !== null}
                      title={save.expedition !== null ? 'Finish the expedition first' : undefined}
                      aria-label={`Delete ${hero.name}`}
                      onClick={() => setConfirmingId(hero.id)}
                    >
                      Delete
                    </button>
                  </>
                )
              }
            >
              <strong>{hero.name}</strong> — {raceIdentity[hero.progress.race].name} {classIdentity[hero.classId].name}, level {hero.progress.level}
              <span className="row-note">
                {hero.progress.xp} / {xpToNextLevel(hero.progress.level)} XP to level {hero.progress.level + 1}
              </span>
            </Row>
          )
        })}
      </ul>
      {freeSlots(save) < 1 ? <p>All slots are in use. Slots open as the account reaches milestones.</p> : null}
      {error !== null ? <p role="alert">{error}</p> : null}
    </section>
  )
}
