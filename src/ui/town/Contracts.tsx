import { useState } from 'react'

import { MAX_ACTIVE_CONTRACTS, contractList } from '../../content/contracts.ts'
import { abandonContractFromUi, acceptContractFromUi, collectContractFromUi, useSaveStatus } from '../store.ts'

export function Contracts() {
  const { save } = useSaveStatus()
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const closed = save.expedition !== null
  const active = save.account.contracts

  function run(problem: string | null, done: string): void {
    setError(problem)
    setMessage(problem === null ? done : null)
  }

  return (
    <section aria-label="Contracts">
      <h2>Contract board</h2>
      <p>
        Active: <strong data-testid="active-count">{active.length}</strong> of {MAX_ACTIVE_CONTRACTS}. Won fights count when an expedition ends, even after a
        defeat. Collect finished contracts here.
      </p>
      <ul>
        {contractList.map((def) => {
          const entry = active.find((item) => item.contractId === def.id)
          const done = entry !== undefined && entry.progress >= def.count
          return (
            <li key={def.id} data-testid={`contract-${def.id}`}>
              <strong>{def.name}</strong> — {def.description} Reward: {def.reward.xp} XP, {def.reward.gold} gold, {def.reward.materialQuantity}{' '}
              {def.reward.materialId}.{' '}
              {entry !== undefined ? (
                <span data-testid={`progress-${def.id}`}>
                  Progress {entry.progress} of {def.count}.
                </span>
              ) : null}{' '}
              {entry === undefined ? (
                <button
                  type="button"
                  disabled={closed || active.length >= MAX_ACTIVE_CONTRACTS}
                  aria-label={`Accept ${def.name}`}
                  onClick={() => run(acceptContractFromUi(def.id), `Accepted ${def.name}.`)}
                >
                  Accept
                </button>
              ) : done ? (
                <button type="button" disabled={closed} aria-label={`Collect ${def.name}`} onClick={() => run(collectContractFromUi(def.id), `Collected ${def.name}.`)}>
                  Collect
                </button>
              ) : (
                <button type="button" disabled={closed} aria-label={`Abandon ${def.name}`} onClick={() => run(abandonContractFromUi(def.id), `Abandoned ${def.name}.`)}>
                  Abandon
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {message !== null ? <p data-testid="contract-message">{message}</p> : null}
      {error !== null ? <p role="alert">{error}</p> : null}
    </section>
  )
}
