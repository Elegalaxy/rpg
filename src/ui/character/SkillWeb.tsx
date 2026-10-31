import { useState } from 'react'

import { confirmationText, nodeViews, selectedHero, type NodeView } from '../../persist/character.ts'
import { takeNodeFromUi, useSaveStatus } from '../store.ts'

import './character.css'

const COLUMN_X = 70
const COLUMN_GAP = 150
const ROW_Y = 44
const ROW_GAP = 56
const WIDTH = 4 * COLUMN_GAP + 40
const HEIGHT = 5 * ROW_GAP + 40

type Placed = { view: NodeView; x: number; y: number }

function place(views: NodeView[]): Placed[] {
  const clusters: string[] = []
  for (const view of views) {
    if (view.kind === 'class' && !clusters.includes(view.node.cluster)) clusters.push(view.node.cluster)
  }
  return views.map((view) => {
    const column = view.kind === 'racial' ? clusters.length : clusters.indexOf(view.node.cluster)
    return { view, x: COLUMN_X + column * COLUMN_GAP, y: ROW_Y + (view.node.index - 1) * ROW_GAP }
  })
}

function stateOf(view: NodeView): 'allocated' | 'available' | 'blocked' | 'locked' {
  if (view.allocated) return 'allocated'
  if (view.preview.canTake) return 'available'
  if (view.preview.reasons.includes('another keystone is allocated')) return 'blocked'
  return 'locked'
}

export function SkillWeb() {
  const { save } = useSaveStatus()
  const hero = selectedHero(save)
  const [chosenId, setChosenId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (hero === null) {
    return (
      <section aria-label="Skill web">
        <h2>Skill web</h2>
        <p>Select a hero to see their skill web.</p>
      </section>
    )
  }

  const views = nodeViews(hero)
  const placed = place(views)
  const chosen = views.find((view) => view.node.id === chosenId) ?? null
  const points = hero.progress.unspentSkillPoints + hero.progress.legacySkillPoints

  function choose(id: string): void {
    setChosenId(id)
    setConfirming(false)
    setError(null)
  }

  function take(): void {
    if (chosen === null) return
    const problem = takeNodeFromUi(chosen.node.id)
    setError(problem)
    if (problem === null) setConfirming(false)
  }

  return (
    <section aria-label="Skill web">
      <h2>Skill web — {hero.name}</h2>
      <p>
        Skill points: <strong data-testid="skill-points">{points}</strong>. Class clusters are blue; the racial branch is
        teal.
      </p>
      <svg className="skill-web" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-label="Skill web nodes">
        {placed.map(({ view, x, y }) => {
          if (view.node.requires === null) return null
          const from = placed.find((entry) => entry.view.node.id === view.node.requires)
          if (from === undefined) return null
          return (
            <line
              key={`line-${view.node.id}`}
              className={`web-line web-line--${view.kind}`}
              x1={from.x}
              y1={from.y}
              x2={x}
              y2={y}
            />
          )
        })}
        {placed.map(({ view, x, y }) => {
          const state = stateOf(view)
          const picked = view.node.id === chosenId
          return (
            <g
              key={view.node.id}
              className={`web-node web-node--${view.kind} web-node--${state}${picked ? ' web-node--picked' : ''}`}
              role="button"
              tabIndex={0}
              aria-label={`${view.node.name}, ${state}`}
              aria-pressed={picked}
              onClick={() => choose(view.node.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  choose(view.node.id)
                }
              }}
            >
              {view.node.keystone ? (
                <rect x={x - 16} y={y - 16} width={32} height={32} transform={`rotate(45 ${x} ${y})`} />
              ) : (
                <circle cx={x} cy={y} r={15} />
              )}
              <text x={x} y={y + 30} textAnchor="middle">
                {view.node.name}
              </text>
            </g>
          )
        })}
      </svg>
      <div aria-label="Node preview">
        {chosen === null ? (
          <p>Select a node to preview it.</p>
        ) : (
          <>
            <h3>
              {chosen.node.name} {chosen.node.keystone ? '(keystone)' : chosen.kind === 'racial' ? '(racial)' : ''}
            </h3>
            <ul>
              <li>Cluster: {chosen.node.cluster}</li>
              <li>Cost: 1 skill point</li>
              <li>
                Requires:{' '}
                {chosen.node.requires === null
                  ? 'nothing (starts this line)'
                  : (views.find((view) => view.node.id === chosen.node.requires)?.node.name ?? chosen.node.requires)}
              </li>
              {chosen.preview.unlocksSkillId !== null ? <li>Unlocks skill: {chosen.preview.unlocksSkillId}</li> : null}
              {chosen.node.keystone ? (
                <li>
                  Closes the other keystones:{' '}
                  {chosen.preview.blockedKeystoneIds
                    .map((id) => views.find((view) => view.node.id === id)?.node.name ?? id)
                    .join(', ')}
                </li>
              ) : null}
            </ul>
            {chosen.allocated ? (
              <p>Already taken.</p>
            ) : chosen.preview.canTake ? (
              confirming ? (
                <div role="dialog" aria-label="Confirm node">
                  <p>{confirmationText(chosen, hero)}</p>
                  <button type="button" onClick={take}>
                    Confirm
                  </button>{' '}
                  <button type="button" onClick={() => setConfirming(false)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirming(true)}>
                  Take node…
                </button>
              )
            ) : (
              <p data-testid="node-blocked">Cannot take yet: {chosen.preview.reasons.join('; ')}.</p>
            )}
          </>
        )}
        {error !== null ? <p role="alert">{error}</p> : null}
      </div>
    </section>
  )
}
