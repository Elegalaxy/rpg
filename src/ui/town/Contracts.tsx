import { Help } from '../Help.tsx'
import { Tag } from '../Kit.tsx'
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
      {board.length === 0 ? <p>Nothing is posted. Select a hero to see their board.</p> : null}
      <ul className="contract-rows">
        {board.map((def) => {
          const entry = active.find((item) => item.contractId === def.id)
          const done = entry !== undefined && entry.progress >= def.count
          const shown = entry === undefined ? 0 : Math.min(entry.progress, def.count)
          return (
            <li key={def.id} className={`contract-row${done ? ' contract-done' : ''}`} data-testid={`contract-${def.id}`}>
              <div className="contract-main">
                <strong>{def.name}</strong>
                <span className="contract-desc">{def.description}</span>
                {entry !== undefined ? (
                  <span className="contract-progress">
                    <span className="progress-bar" aria-hidden="true">
                      <span style={{ width: `${Math.round((shown / def.count) * 100)}%` }} />
                    </span>
                    <span data-testid={`progress-${def.id}`}>
                      Progress {entry.progress} of {def.count}
                    </span>
                    {done ? <Tag kind="good">Done</Tag> : null}
                  </span>
                ) : null}
              </div>
              <div className="contract-reward">
                <span className="contract-reward-title">Reward</span>
                <span className="contract-reward-gold">+{def.reward.gold} gold</span>
                <span>
                  {def.reward.materialQuantity} {def.reward.materialId}
                </span>
                <span>{def.reward.xp} XP</span>
              </div>
              <div className="shop-actions">
                {entry === undefined ? (
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
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {message !== null ? <p data-testid="contract-message">{message}</p> : null}
      {error !== null ? <p role="alert">{error}</p> : null}
    </>
  )
}
