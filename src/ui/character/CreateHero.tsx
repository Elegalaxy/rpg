import { useState } from 'react'

import { classIdentity, raceIdentity } from '../../content/heroes.ts'
import { nameProblem } from '../../persist/roster.ts'
import { HERO_CLASSES, type HeroClass } from '../../sim/constants.ts'
import { HERO_RACES, type HeroRace } from '../../sim/progression.ts'
import { GuideLink } from '../guide/GuideLink.tsx'
import { advanceTutorial, createHeroFromUi, useSaveStatus } from '../store.ts'

export function CreateHero() {
  const { save } = useSaveStatus()
  const [name, setName] = useState('')
  const [race, setRace] = useState<HeroRace>('human')
  const [classId, setClassId] = useState<HeroClass>('warrior')
  const [error, setError] = useState<string | null>(null)
  const race_ = raceIdentity[race]
  const class_ = classIdentity[classId]

  function note(step: 'race' | 'class'): void {
    if (save.account.tutorial !== step) return
    advanceTutorial(step === 'race' ? 'class' : 'create')
  }

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
        <div className="controls">
          <label htmlFor="rpg-hero-name">Name</label>{' '}
          <input
            id="rpg-hero-name"
            value={name}
            data-tutor="hero-name"
            onChange={(event) => {
              setName(event.target.value)
              setError(null)
              if (event.target.value.trim().length > 0 && save.account.tutorial === 'name') advanceTutorial('race')
            }}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={name.length > 0 && nameProblem(name, save) !== null}
          />
        </div>
        <fieldset className="choices" data-tutor="hero-race">
          <legend>Race</legend>
          {HERO_RACES.map((id) => (
            <label key={id} onClick={() => note('race')}>
              <input type="radio" name="rpg-race" checked={race === id} onChange={() => setRace(id)} />{' '}
              {raceIdentity[id].name}{' '}
            </label>
          ))}
          <p data-testid="race-summary">
            <strong>{race_.name}.</strong> {race_.summary} <em>{race_.core}</em>
            <GuideLink id={`race-${race}`} label={race_.name} />
          </p>
        </fieldset>
        <fieldset className="choices" data-tutor="hero-class">
          <legend>Class</legend>
          {HERO_CLASSES.map((id) => (
            <label key={id} onClick={() => note('class')}>
              <input type="radio" name="rpg-class" checked={classId === id} onChange={() => setClassId(id)} />{' '}
              {classIdentity[id].name}{' '}
            </label>
          ))}
          <p data-testid="class-summary">
            <strong>{class_.name}.</strong> {class_.summary} <em>{class_.core}</em>
            <GuideLink id={`class-${classId}`} label={class_.name} />
          </p>
        </fieldset>
        <button type="submit" data-tutor="hero-create">
          Create hero
        </button>
        {error !== null ? <p role="alert">{error}</p> : null}
      </form>
    </section>
  )
}
