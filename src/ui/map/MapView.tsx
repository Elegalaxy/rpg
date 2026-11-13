import { useState } from 'react'

import { selectedHero } from '../../persist/character.ts'
import {
  markerPosition,
  nodeStatus,
  MASTERY_RETURNS,
  routeInfo,
  routeMastery,
  type MarkerPosition,
  type NodeState,
} from '../../persist/world.ts'
import { legs, nodes, routes } from '../../content/world.ts'
import { canStartRouteNow, getLastRouteId, startExpeditionFromUi, useSaveStatus } from '../store.ts'
import { Kpi, KpiRow } from '../Kit.tsx'
import { GoingIn } from './GoingIn.tsx'
import type { GoTo } from './goingInLines.ts'

import './map.css'

/** Where each node sits in the map's coordinate space. The background is a placeholder. */
const NODE_POSITIONS: { readonly [id: string]: { x: number; y: number } } = {
  greyhaven: { x: 60, y: 110 },
  'splintered-road': { x: 190, y: 110 },
  'withered-grove': { x: 330, y: 50 },
  'fallen-bastion': { x: 330, y: 170 },
  'fracture-gate': { x: 470, y: 110 },
  'drowned-causeway': { x: 190, y: 220 },
  'rift-hollows': { x: 330, y: 250 },
  'cinder-scar': { x: 470, y: 290 },
}

const WIDTH = 540
const HEIGHT = 330

function point(position: MarkerPosition): { x: number; y: number } {
  if (position.kind === 'at') return NODE_POSITIONS[position.nodeId] ?? { x: 0, y: 0 }
  const from = NODE_POSITIONS[position.fromId] ?? { x: 0, y: 0 }
  const to = NODE_POSITIONS[position.toId] ?? { x: 0, y: 0 }
  return { x: from.x + (to.x - from.x) * position.fraction, y: from.y + (to.y - from.y) * position.fraction }
}

export function MapView({ onGo }: { onGo?: (to: GoTo) => void }) {
  const { save } = useSaveStatus()
  const hero = selectedHero(save)
  const [routeId, setRouteId] = useState<string>(() => getLastRouteId() ?? 'splintered-road')
  const [error, setError] = useState<string | null>(null)
  const expedition = save.expedition
  const info = routeInfo(routeId, save)
  const start = canStartRouteNow(save, routeId)
  const mastery = routeMastery(hero, routeId)
  const chosen = new Set(routes[routeId]?.nodeIds ?? [])
  const position = expedition === null ? null : markerPosition(expedition)
  const marker = position === null ? null : point(position)
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
      <fieldset className="choices" disabled={expedition !== null}>
        <legend>Route</legend>
        {Object.values(routes).map((route) => (
          <label key={route.id}>
            <input type="radio" name="rpg-route" checked={routeId === route.id} onChange={() => setRouteId(route.id)} />
            {route.name}
          </label>
        ))}
      </fieldset>
      <div aria-label="Route info">
        <h3>{info.route.name}</h3>
        <KpiRow label="Route numbers">
          <Kpi label="Level band" value={info.levels === null ? '—' : `${info.levels.min}–${info.levels.max}`} />
          <Kpi label="Fights" value={info.fights} />
          <Kpi label="One way" value={`${info.travelSeconds} s`} />
          <Kpi
            label="Mastery"
            value={`${Math.min(mastery.returns, MASTERY_RETURNS)}/${MASTERY_RETURNS}`}
            note={mastery.mastered ? '8× speed unlocked' : 'Safe returns'}
            tone={mastery.mastered ? 'good' : undefined}
            testId="route-mastery"
          />
        </KpiRow>
        <dl className="route-facts">
          <dt>Path</dt>
          <dd>{info.nodeNames.join(' → ')}</dd>
          <dt>Enemies</dt>
          <dd>
            <ul className="fact-list">
              {info.enemyNames.map((name) => {
                const fact = info.enemyFacts.find((entry) => entry.name === name)
                return (
                  <li key={name}>
                    {name}
                    {fact !== undefined ? <span className="enemy-fact muted-inline">{fact.line}</span> : null}
                  </li>
                )
              })}
              {info.bossHidden ? <li className="muted-inline">Boss unseen until arrival</li> : null}
            </ul>
          </dd>
          <dt>Resources</dt>
          <dd>
            <ul className="fact-list">
              {info.resources.map((resource) => (
                <li key={resource.name}>
                  {resource.name} <span className="muted-inline">· {resource.quantity} {resource.materialId}</span>
                </li>
              ))}
            </ul>
          </dd>
        </dl>
        {expedition === null ? (
          <>
            {hero !== null ? <GoingIn hero={hero} onGo={onGo} /> : null}
            <button
              type="button"
              className="btn-primary"
              disabled={!start.ok}
              onClick={() => setError(startExpeditionFromUi(routeId))}
            >
              Start expedition
            </button>
            {!start.ok ? <p data-testid="start-blocked">{start.reason}</p> : null}
          </>
        ) : (
          <p data-testid="map-expedition-note">
            {expedition.outcome === 'ongoing' ? 'An expedition is under way. Follow it below.' : 'The expedition has ended. See the outcome below.'}
          </p>
        )}
        {error !== null ? <p role="alert">{error}</p> : null}
      </div>
    </section>
  )
}
