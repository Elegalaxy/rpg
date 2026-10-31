import { useState } from 'react'

import { classIdentity, raceIdentity } from '../../content/heroes.ts'
import { nameProblem } from '../../persist/roster.ts'
import { HERO_CLASSES, type HeroClass } from '../../sim/constants.ts'
import { HERO_RACES, type HeroRace } from '../../sim/progression.ts'
import { createHeroFromUi, useSaveStatus } from '../store.ts'

export function CreateHero() {
  const { save } = useSaveStatus()
  const [name, setName] = useState('')
  const [race, setRace] = useState<HeroRace>('human')
  const [classId, setClassId] = useState<HeroClass>('warrior')
  const [error, setError] = useState<string | null>(null)
  const race_ = raceIdentity[race]
  const class_ = classIdentity[classId]

  function submit(event: { preventDefault: () => void }): void {
    event.preventDefault()
    const problem = createHeroFromUi({ name, race, classId })
    setError(problem)
    if (problem === null) setName('')
  }

  return (
    <section aria-label="Create a hero">
      <h2>Create a hero</h2>
      <form onSubmit={submit}>
        <div>
          <label htmlFor="rpg-hero-name">Name</label>{' '}
          <input
            id="rpg-hero-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setError(null)
            }}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={name.length > 0 && nameProblem(name, save) !== null}
          />
        </div>
        <fieldset>
          <legend>Race</legend>
          {HERO_RACES.map((id) => (
            <label key={id}>
              <input type="radio" name="rpg-race" checked={race === id} onChange={() => setRace(id)} />{' '}
              {raceIdentity[id].name}{' '}
            </label>
          ))}
          <p data-testid="race-summary">
            <strong>{race_.name}.</strong> {race_.summary} <em>{race_.core}</em>
          </p>
        </fieldset>
        <fieldset>
          <legend>Class</legend>
          {HERO_CLASSES.map((id) => (
            <label key={id}>
              <input type="radio" name="rpg-class" checked={classId === id} onChange={() => setClassId(id)} />{' '}
              {classIdentity[id].name}{' '}
            </label>
          ))}
          <p data-testid="class-summary">
            <strong>{class_.name}.</strong> {class_.summary} <em>{class_.core}</em>
          </p>
        </fieldset>
        <button type="submit">Create hero</button>
        {error !== null ? <p role="alert">{error}</p> : null}
      </form>
    </section>
  )
}
