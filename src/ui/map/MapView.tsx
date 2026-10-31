import { useState } from 'react'

import { selectedHero } from '../../persist/character.ts'
import {
  canStartRoute,
  markerPosition,
  nodeStatus,
  routeInfo,
  type MarkerPosition,
  type NodeState,
} from '../../persist/world.ts'
import { legs, nodes, routes } from '../../content/world.ts'
import { settleExpeditionFromUi, startExpeditionFromUi, useSaveStatus } from '../store.ts'

import './map.css'

/** Where each node sits in the map's coordinate space. The background is a placeholder. */
const NODE_POSITIONS: { readonly [id: string]: { x: number; y: number } } = {
  greyhaven: { x: 60, y: 110 },
  'splintered-road': { x: 190, y: 110 },
  'withered-grove': { x: 330, y: 50 },
  'fallen-bastion': { x: 330, y: 170 },
  'fracture-gate': { x: 470, y: 110 },
}

const WIDTH = 540
const HEIGHT = 220

function point(position: MarkerPosition): { x: number; y: number } {
  if (position.kind === 'at') return NODE_POSITIONS[position.nodeId] ?? { x: 0, y: 0 }
  const from = NODE_POSITIONS[position.fromId] ?? { x: 0, y: 0 }
  const to = NODE_POSITIONS[position.toId] ?? { x: 0, y: 0 }
  return { x: from.x + (to.x - from.x) * position.fraction, y: from.y + (to.y - from.y) * position.fraction }
}

export function MapView() {
  const { save } = useSaveStatus()
  const hero = selectedHero(save)
  const [routeId, setRouteId] = useState<string>('splintered-road')
  const [error, setError] = useState<string | null>(null)
  const expedition = save.expedition
  const info = routeInfo(routeId, save)
  const start = canStartRoute(save, routeId)
  const chosen = new Set(routes[routeId]?.nodeIds ?? [])
  const position = expedition === null ? null : markerPosition(expedition)
  const marker = position === null ? null : point(position)
  const here = position?.kind === 'at' ? (nodes[position.nodeId]?.name ?? '') : ''
  const shownRoute = expedition === null ? routeId : expedition.id
  const onRoute = new Set(routes[shownRoute]?.nodeIds ?? [])

  return (
    <section aria-label="World map">
      <h2>Fractured Frontier</h2>
      <svg className="world-map" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-label="Map nodes">
        <rect className="map-background" x={0} y={0} width={WIDTH} height={HEIGHT} />
        {legs.map((leg) => {
          const from = NODE_POSITIONS[leg.from]
          const to = NODE_POSITIONS[leg.to]
          if (from === undefined || to === undefined) return null
          const used = onRoute.has(leg.from) && onRoute.has(leg.to)
          return (
            <line
              key={`${leg.from}-${leg.to}`}
              className={`map-leg${used ? ' map-leg--chosen' : ''}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
            />
          )
        })}
        {Object.values(nodes).map((node) => {
          const position = NODE_POSITIONS[node.id]
          if (position === undefined) return null
          const status = nodeStatus(node, save, hero)
          const state: NodeState = status.state
          return (
            <g
              key={node.id}
              className={`map-node map-node--${state}${chosen.has(node.id) ? ' map-node--chosen' : ''}`}
              aria-label={`${node.name}, ${state}${status.reason !== null ? `. ${status.reason}` : ''}`}
              role="img"
            >
              <circle cx={position.x} cy={position.y} r={node.kind === 'town' ? 18 : 15} />
              <text x={position.x} y={position.y + 32} textAnchor="middle">
                {node.name}
              </text>
            </g>
          )
        })}
        {marker !== null ? (
          <circle className="map-marker" data-testid="hero-marker" cx={marker.x} cy={marker.y} r={7}>
            <title>{hero?.name ?? 'Hero'}</title>
          </circle>
        ) : null}
      </svg>
      <fieldset disabled={expedition !== null}>
        <legend>Route</legend>
        {Object.values(routes).map((route) => (
          <label key={route.id}>
            <input type="radio" name="rpg-route" checked={routeId === route.id} onChange={() => setRouteId(route.id)} /> {route.name}{' '}
          </label>
        ))}
      </fieldset>
      <div aria-label="Route info">
        <h3>{info.route.name}</h3>
        <ul>
          <li>Path: {info.nodeNames.join(' → ')}</li>
          <li>
            Level band: {info.levels === null ? 'none' : `${info.levels.min} to ${info.levels.max}`}. Fights: {info.fights}. One way:{' '}
            {info.travelSeconds} seconds.
          </li>
          <li>
            Enemies: {info.enemyNames.join(', ')}
            {info.bossHidden ? ', and a boss you will only see on arrival' : ''}
          </li>
          <li>
            Resources: {info.resources.map((resource) => `${resource.name} (${resource.quantity} ${resource.materialId})`).join(', ')}
          </li>
        </ul>
        {expedition === null ? (
          <>
            <button
              type="button"
              disabled={!start.ok}
              onClick={() => setError(startExpeditionFromUi(routeId))}
            >
              Start expedition
            </button>
            {!start.ok ? <p data-testid="start-blocked">{start.reason}</p> : null}
          </>
        ) : expedition.outcome === 'ongoing' ? (
          <p data-testid="travel-status">
            {expedition.phase === 'combat'
              ? `Fighting at ${here}, fight ${expedition.encounterIndex + 1}.`
              : expedition.returning
                ? 'Walking back to Greyhaven.'
                : `Travelling, ${Math.floor(expedition.travelMs / 1000)} of ${Math.floor(expedition.travelGapMs / 1000)} seconds to the next fight.`}
          </p>
        ) : (
          <div>
            <p data-testid="expedition-ended">
              The expedition ended: {expedition.outcome === 'returned' ? 'you returned safely.' : 'you were defeated.'}
            </p>
            <button type="button" onClick={settleExpeditionFromUi}>
              Return to town
            </button>
          </div>
        )}
        {error !== null ? <p role="alert">{error}</p> : null}
      </div>
    </section>
  )
}
