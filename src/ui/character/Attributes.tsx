import { useState } from 'react'

import { ATTRIBUTE_KEYS, selectedHero, type AttributeKey, type AttributePlan } from '../../persist/character.ts'
import { devGrantPoints, spendAttributesFromUi, useSaveStatus } from '../store.ts'

const LABELS: Record<AttributeKey, string> = {
  strength: 'Strength',
  vitality: 'Vitality',
  agility: 'Agility',
  intellect: 'Intellect',
  spirit: 'Spirit',
}

export function Attributes() {
  const { save } = useSaveStatus()
  const hero = selectedHero(save)
  const [plan, setPlan] = useState<AttributePlan>({})
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (hero === null) {
    return (
      <section aria-label="Attributes">
        <h2>Attributes</h2>
        <p>Select a hero to allocate attribute points.</p>
      </section>
    )
  }

  const unspent = hero.progress.unspentAttributePoints
  const staged = ATTRIBUTE_KEYS.reduce((sum, key) => sum + (plan[key] ?? 0), 0)
  const left = unspent - staged

  function change(key: AttributeKey, delta: number): void {
    const next = (plan[key] ?? 0) + delta
    if (next < 0 || (delta > 0 && left < 1)) return
    setPlan({ ...plan, [key]: next })
    setConfirming(false)
    setError(null)
  }

  function confirm(): void {
    const problem = spendAttributesFromUi(plan)
    setError(problem)
    if (problem === null) {
      setPlan({})
      setConfirming(false)
    }
  }

  return (
    <section aria-label="Attributes">
      <h2>Attributes — {hero.name}</h2>
      <p>
        Unspent points: <strong data-testid="attribute-points">{left}</strong> of {unspent}. Points are not refunded.
        {import.meta.env.DEV ? (
          <>
            {' '}
            <button type="button" onClick={devGrantPoints}>
              Dev: grant 6 attribute and 4 skill points
            </button>
          </>
        ) : null}
      </p>
      <table>
        <tbody>
          {ATTRIBUTE_KEYS.map((key) => {
            const added = plan[key] ?? 0
            return (
              <tr key={key}>
                <th scope="row">{LABELS[key]}</th>
                <td>
                  {hero.progress.attributes[key]}
                  {added > 0 ? <strong> → {hero.progress.attributes[key] + added}</strong> : null}
                </td>
                <td>
                  <button
                    type="button"
                    aria-label={`Remove a point from ${LABELS[key]}`}
                    disabled={added < 1}
                    onClick={() => change(key, -1)}
                  >
                    −
                  </button>{' '}
                  <button
                    type="button"
                    aria-label={`Add a point to ${LABELS[key]}`}
                    disabled={left < 1}
                    onClick={() => change(key, 1)}
                  >
                    +
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {confirming ? (
        <div role="dialog" aria-label="Confirm attribute points">
          <p>
            Spend {staged} attribute {staged === 1 ? 'point' : 'points'}? This cannot be undone.
          </p>
          <button type="button" onClick={confirm}>
            Confirm
          </button>{' '}
          <button type="button" onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" disabled={staged < 1} onClick={() => setConfirming(true)}>
          Spend points…
        </button>
      )}
      {error !== null ? <p role="alert">{error}</p> : null}
    </section>
  )
}
