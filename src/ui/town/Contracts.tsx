import { Help } from '../Help.tsx'
import { Pill, ShopRow } from '../Kit.tsx'
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
      <ul className="shop-rows">
        {board.map((def) => {
          const entry = active.find((item) => item.contractId === def.id)
          const done = entry !== undefined && entry.progress >= def.count
          return (
            <ShopRow
              key={def.id}
              testId={`contract-${def.id}`}
              name={def.name}
              effect={def.description}
              costs={[[{ kind: 'gold', amount: def.reward.gold, prefix: '+' }]]}
              pills={
                <>
                  <Pill kind="mat">
                    {def.reward.materialQuantity} {def.reward.materialId}
                  </Pill>
                  <Pill kind="info">{def.reward.xp} XP</Pill>
                  {entry !== undefined ? (
                    <Pill kind={done ? 'good' : 'owned'} testId={`progress-${def.id}`}>
                      Progress {entry.progress} of {def.count}
                    </Pill>
                  ) : null}
                </>
              }
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
            />
          )
        })}
      </ul>
      {message !== null ? <p data-testid="contract-message">{message}</p> : null}
      {error !== null ? <p role="alert">{error}</p> : null}
    </>
  )
}
