import { useState } from 'react'

import { skillName } from '../../persist/loadout.ts'
import { selectedHero } from '../../persist/character.ts'
import type { SavedHero } from '../../persist/save.ts'
import { saveLoadoutFromUi, useSaveStatus } from '../store.ts'

function LoadoutForm({ hero }: { hero: SavedHero }) {
  const [chosen, setChosen] = useState<string[]>(hero.progress.loadout)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function toggle(skillId: string): void {
    setMessage(null)
    setError(null)
    setChosen(chosen.includes(skillId) ? chosen.filter((id) => id !== skillId) : [...chosen, skillId])
  }

  function save(): void {
    const result = saveLoadoutFromUi(chosen)
    setError(result.error)
    setMessage(result.message)
  }

  const tooMany = chosen.length > 4
  return (
    <section aria-label="Loadout">
      <h2>Loadout — {hero.name}</h2>
      <p>
        Choose 1 to 4 skills. Selected: <strong data-testid="loadout-count">{chosen.length}</strong> of 4.
      </p>
      <ul>
        {hero.progress.learnedSkillIds.map((skillId) => (
          <li key={skillId}>
            <label>
              <input type="checkbox" checked={chosen.includes(skillId)} onChange={() => toggle(skillId)} />{' '}
              {skillName(skillId)}
            </label>
          </li>
        ))}
      </ul>
      {tooMany ? <p role="alert">Pick at most 4 skills.</p> : null}
      <button type="button" disabled={chosen.length < 1 || tooMany} onClick={save}>
        Save loadout
      </button>
      {message !== null ? <p>{message}</p> : null}
      {error !== null ? <p role="alert">{error}</p> : null}
    </section>
  )
}

export function Loadout() {
  const { save } = useSaveStatus()
  const hero = selectedHero(save)
  if (hero === null) {
    return (
      <section aria-label="Loadout">
        <h2>Loadout</h2>
        <p>Select a hero to choose their skills.</p>
      </section>
    )
  }
  return <LoadoutForm key={`${hero.id}:${hero.progress.loadout.join(',')}:${hero.progress.learnedSkillIds.length}`} hero={hero} />
}
