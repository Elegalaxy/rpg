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
import { firstClearReward, firstClearRewardText } from '../../content/firstClear.ts'
import { legs, nodes, routes, type Route } from '../../content/world.ts'
import { useNarrow } from '../useNarrow.ts'
import { canStartRouteNow, getLastRouteId, startExpeditionFromUi, useSaveStatus } from '../store.ts'
import { Help } from '../Help.tsx'
import { Kpi, KpiRow } from '../Kit.tsx'
import { MASTERY_HELP } from '../masteryHelp.ts'
import { ContractTrack } from './ContractTrack.tsx'
import { GoingIn } from './GoingIn.tsx'
import type { GoTo } from './goingInLines.ts'
import { MAP_HEIGHT, MAP_WIDTH, NODE_POSITIONS } from './layout.ts'

import './map.css'

const WIDTH = MAP_WIDTH
const HEIGHT = MAP_HEIGHT

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
  const lastNodeId = routes[routeId]?.nodeIds[(routes[routeId]?.nodeIds.length ?? 1) - 1]
  const firstClear = lastNodeId === undefined ? null : firstClearReward(lastNodeId)
  const firstClearClaimed = hero?.firstClearIds?.includes(lastNodeId ?? '') === true
  const chosen = new Set(routes[routeId]?.nodeIds ?? [])
  const position = expedition === null ? null : markerPosition(expedition)
  const marker = position === null ? null : point(position)
  const shownRoute = expedition === null ? routeId : expedition.id
  const onRoute = new Set(routes[shownRoute]?.nodeIds ?? [])
  const remembered = Object.values(nodes).filter((node) => nodeStatus(node, save, hero).remembered === true).map((node) => node.name)
  const narrow = useNarrow()
  const [showLocked, setShowLocked] = useState(false)
  const isLocked = (route: Route) =>
    route.nodeIds.some((id) => {
      const node = nodes[id]
      return node !== undefined && node.kind !== 'town' && nodeStatus(node, save, hero).state === 'locked'
    })
  const allRoutes = Object.values(routes)
  const shownRoutes = narrow && !showLocked ? allRoutes.filter((route) => route.id === routeId || !isLocked(route)) : allRoutes
  const hiddenRoutes = allRoutes.length - shownRoutes.length

  const mapArt = (
    <>
      <svg className="world-map" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-label="Map nodes">
        <rect className="map-background" x={0} y={0} width={WIDTH} height={HEIGHT} />
        <image href="/map/frontier.png" x={0} y={0} width={WIDTH} height={HEIGHT} preserveAspectRatio="xMidYMid slice" />
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
              aria-label={`${node.name}, ${state}${status.reason !== null ? `. ${status.reason}` : ''}${status.remembered === true ? '. Remembered from an earlier life.' : ''}`}
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
      {remembered.length > 0 ? (
        <p className="map-remembered" data-testid="map-remembered">
          Remembered from an earlier life: {remembered.join(', ')}.
        </p>
      ) : null}
    </>
  )

  return (
    <section aria-label="World map">
      <h2>Fractured Frontier</h2>
      {narrow ? (
        <details className="map-fold">
          <summary>World map</summary>
          {mapArt}
        </details>
      ) : (
        mapArt
      )}
      <fieldset className="choices" disabled={expedition !== null}>
        <legend>Route</legend>
        {shownRoutes.map((route) => (
          <label key={route.id}>
            <input type="radio" name="rpg-route" checked={routeId === route.id} onChange={() => setRouteId(route.id)} />
            {route.name}
          </label>
        ))}
        {hiddenRoutes > 0 ? (
          <button type="button" className="link-button" data-testid="show-locked-routes" onClick={() => setShowLocked(true)}>
            Show {hiddenRoutes} locked {hiddenRoutes === 1 ? 'route' : 'routes'}
          </button>
        ) : null}
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
            note={
              <>
                {mastery.mastered ? '8× speed unlocked' : 'Safe returns'} <Help label="About mastery">{MASTERY_HELP}</Help>
              </>
            }
            tone={mastery.mastered ? 'good' : undefined}
            testId="route-mastery"
          />
          {firstClear === null ? null : (
            <Kpi
              label="First clear"
              value={firstClearRewardText(firstClear)}
              note={firstClearClaimed ? 'Claimed' : 'Not claimed yet'}
              tone={firstClearClaimed ? undefined : 'gold'}
              testId="route-first-clear"
            />
          )}
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
            {hero !== null ? <ContractTrack /> : null}
            <div className={narrow ? 'start-dock' : undefined} data-testid="start-area">
              <button
                type="button"
                className="btn-primary"
                disabled={!start.ok}
                aria-describedby={!start.ok ? 'start-blocked' : undefined}
                data-tutor="start-expedition"
                onClick={() => setError(startExpeditionFromUi(routeId))}
              >
                Start expedition
              </button>
              {!start.ok ? <p id="start-blocked" data-testid="start-blocked">{start.reason}</p> : null}
            </div>
          </>
        ) : (
          <p data-testid="map-expedition-note">
            {expedition.outcome === 'ongoing'
              ? `An expedition is under way. Follow it ${narrow ? 'above' : 'below'}.`
              : `The expedition has ended. See the outcome ${narrow ? 'above' : 'below'}.`}
          </p>
        )}
        {error !== null ? <p role="alert">{error}</p> : null}
      </div>
    </section>
  )
}
