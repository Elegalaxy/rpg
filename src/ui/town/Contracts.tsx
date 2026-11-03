import { Help } from '../Help.tsx'
import { Row } from '../Row.tsx'
import { purseOf } from '../../persist/save.ts'
import { useState } from 'react'

import { MAX_ACTIVE_CONTRACTS } from '../../content/contracts.ts'
import { abandonContractFromUi, acceptContractFromUi, collectContractFromUi, useSaveStatus } from '../store.ts'

export function Contracts() {
  const { save } = useSaveStatus()
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const closed = save.expedition !== null
  const active = purseOf(save).contracts
  const board = purseOf(save).board

  function run(problem: string | null, done: string): void {
    setError(problem)
    setMessage(problem === null ? done : null)
  }

  return (
    <>
      <p>
        Active: <strong data-testid="active-count">{active.length}</strong> of {MAX_ACTIVE_CONTRACTS}.
        <Help label="About contracts">
          Won fights count when an expedition ends, even after a defeat. New work is posted each time you come back to town.
        </Help>
      </p>
      <ul className="rows">
        {board.length === 0 ? <p>Nothing is posted. Select a hero to see their board.</p> : null}
        {board.map((def) => {
          const entry = active.find((item) => item.contractId === def.id)
          const done = entry !== undefined && entry.progress >= def.count
          return (
            <Row
              key={def.id}
              testId={`contract-${def.id}`}
              actions={
                entry === undefined ? (
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={closed || active.length >= MAX_ACTIVE_CONTRACTS}
                    aria-label={`Accept ${def.name}`}
                    onClick={() => run(acceptContractFromUi(def.id), `Accepted ${def.name}.`)}
                  >
                    Accept
                  </button>
                ) : done ? (
                  <button type="button" className="btn-good" disabled={closed} aria-label={`Collect ${def.name}`} onClick={() => run(collectContractFromUi(def.id), `Collected ${def.name}.`)}>
                    Collect
                  </button>
                ) : (
                  <button type="button" className="btn-danger" disabled={closed} aria-label={`Abandon ${def.name}`} onClick={() => run(abandonContractFromUi(def.id), `Abandoned ${def.name}.`)}>
                    Abandon
                  </button>
                )
              }
            >
              <strong>{def.name}</strong> — {def.description}
              <span className="row-note">
                Reward: {def.reward.xp} XP, {def.reward.gold} gold, {def.reward.materialQuantity} {def.reward.materialId}.{' '}
                {entry !== undefined ? (
                  <span data-testid={`progress-${def.id}`}>
                    Progress {entry.progress} of {def.count}.
                  </span>
                ) : null}
              </span>
            </Row>
          )
        })}
      </ul>
      {message !== null ? <p data-testid="contract-message">{message}</p> : null}
      {error !== null ? <p role="alert">{error}</p> : null}
    </>
  )
}
