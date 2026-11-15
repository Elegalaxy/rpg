import { useEffect, useState } from 'react'

import { selectedHero } from '../persist/character.ts'
import type { SavedHero } from '../persist/save.ts'
import { MASTERY_RETURNS, routeMastery } from '../persist/world.ts'
import { routes } from '../content/world.ts'
import { MOMENTUM_CAP, bagIsFull, lootCapacityOf, type ExpeditionState } from '../sim/expedition.ts'
import { readCollapsed, writeCollapsed } from './runDockState.ts'
import { StackPicker } from './combat/StackBar.tsx'
import { hasStacks, summarizeStack } from './combat/stackSummary.ts'
import { HoldActions } from './HoldActions.tsx'
import { Kpi, KpiRow } from './Kit.tsx'
import { escapeNowFromUi, expeditionWaiting, setAutoEscapeFromUi, setRepeatRouteFromUi, useSaveStatus } from './store.ts'

function encounterLabel(id: string): string {
  return id.replace(/-/g, ' ')
}

/** "Fracture Shardling ×2" style list of the enemies in the current fight. */
function foeSummary(enemies: { name: string }[]): string {
  const counts = new Map<string, number>()
  for (const enemy of enemies) counts.set(enemy.name, (counts.get(enemy.name) ?? 0) + 1)
  return [...counts].map(([name, count]) => (count > 1 ? `${name} ×${count}` : name)).join(', ')
}

function statusText(expedition: ExpeditionState, waiting: boolean): string {
  if (waiting) return 'Waiting for you'
  if (expedition.phase === 'combat' || expedition.combat !== null) {
    const id = expedition.current?.encounterId
    return id === undefined ? 'Fighting' : `Fighting ${encounterLabel(id)}`
  }
  return expedition.returning ? 'Walking home' : 'Walking'
}

export function RunDockView({
  expedition,
  hero,
  waiting,
  collapsed,
  onToggle,
  onOpenMap,
}: {
  expedition: ExpeditionState
  hero: SavedHero | null
  waiting: boolean
  collapsed: boolean
  onToggle: () => void
  onOpenMap: () => void
}) {
  const fight = expedition.combat
  const hp = fight !== null ? fight.hero.hp : expedition.hero.hp
  const maxHp = fight !== null ? fight.hero.maxHp : expedition.hero.maxHp
  const fraction = maxHp > 0 ? hp / maxHp : 0
  const tone = fraction < 0.4 ? 'bad' : fraction < 0.7 ? 'warn' : 'good'
  const carried = expedition.unsecured.reduce((sum, stack) => sum + stack.quantity, 0)
  const capacity = lootCapacityOf(expedition)
  const full = bagIsFull(expedition)
  const enemiesLeft = fight === null ? null : fight.enemies.filter((enemy) => enemy.alive).length
  const mastery = routeMastery(hero, expedition.id)
  const status = statusText(expedition, waiting)
  const routeName = routes[expedition.id]?.name ?? expedition.id
  const stackShown = fight !== null ? hasStacks(fight) : (hero?.ruleStacks ?? []).length > 0
  const last = expedition.history[expedition.history.length - 1]
  const fightNo = fight !== null ? expedition.history.length + 1 : last === undefined ? null : expedition.history.length
  const fightId = fight !== null ? expedition.current?.encounterId : last?.encounterId
  const outcome = last === undefined ? '' : last.outcome === 'retreat' ? 'escaped' : last.outcome
  const fightLabel = fightId === undefined ? null : fight !== null ? encounterLabel(fightId) : `${encounterLabel(fightId)} (${outcome})`
  const foes = fight === null ? null : foeSummary(fight.enemies)
  const holdReason =fight !== null ? 'Available between fights.' : 'Available once the next fight is over.'
  return (
    <aside className="run-dock" aria-label="Run dock" data-collapsed={collapsed}>
      <div className="run-dock-main">
        <div className="run-dock-state">
          <strong className="run-dock-status" title={status}>
            {status}
          </strong>
          {stackShown && fight !== null ? (
            <span className="run-dock-stack" data-testid="dock-stack" title={summarizeStack(fight).reason}>
              Stack: {summarizeStack(fight).activeName}
            </span>
          ) : stackShown ? (
            <span className="run-dock-stack" data-testid="dock-stack-slot" aria-hidden="true">
              &nbsp;
            </span>
          ) : null}
          <span className="run-dock-hp">
            <progress className={`hp-${tone}`} max={maxHp} value={hp} aria-label="Hero HP" />
            <span className="run-dock-hp-num" data-testid="dock-hp">
              {Math.round(hp)}/{Math.round(maxHp)}
            </span>
          </span>
        </div>
        <HoldActions waiting={waiting} whyDisabled={holdReason} compact />
        <button
          type="button"
          className="run-dock-toggle"
          aria-expanded={!collapsed}
          aria-controls="run-dock-details"
          aria-label={collapsed ? 'Show run details' : 'Hide run details'}
          onClick={onToggle}
        >
          <span aria-hidden="true">{collapsed ? '▴' : '▾'}</span>
        </button>
      </div>
      {collapsed ? null : (
        <div id="run-dock-details" className="run-dock-details">
          <p className="run-dock-route">
            <small className="muted">Route</small> <strong data-testid="dock-route">{routeName}</strong>
          </p>
          <p className="run-dock-fight" data-testid="dock-fight">
            <small className="muted">{fightNo === null ? 'Fight' : fight !== null ? 'Fight now' : 'Last fight'}</small>{' '}
            <strong>{fightNo === null ? 'None yet' : `#${fightNo}${hero?.stopAfterFights != null ? ` / ${hero.stopAfterFights}` : ''}`}</strong>
            {fightLabel !== null ? <span> · {fightLabel}</span> : null}
          </p>
          <p className="run-dock-foes muted" data-testid="dock-foes">
            {foes ?? ' '}
          </p>
          <KpiRow label="Run status">
            <Kpi
              compact
              label="Loot bag"
              value={`${carried}/${capacity}`}
              testId="dock-loot"
              tone={full ? 'warn' : undefined}
              note={full ? (carried >= capacity ? 'Full' : 'Nearly full') : <span aria-hidden="true">&nbsp;</span>}
            />
            <Kpi compact label="Momentum" value={`${expedition.momentum}/${MOMENTUM_CAP}`} testId="dock-momentum" />
            <Kpi compact label="Gold carried" value={`${expedition.carriedGold} g`} tone="gold" testId="dock-gold" />
            <Kpi compact label="Enemies left" value={enemiesLeft === null ? '–' : enemiesLeft} testId="dock-enemies" />
          </KpiRow>
          {fight !== null && hasStacks(fight) ? (
            <div className="run-dock-stack-picker" data-testid="dock-stack-picker">
              <small className="muted">Rule stack · {summarizeStack(fight).reason}</small>
              <StackPicker combat={fight} />
            </div>
          ) : null}
          <div className="button-row">
            <button type="button" className="btn-danger" disabled={fight === null} title={fight === null ? 'Only during a fight.' : undefined} onClick={escapeNowFromUi}>
              Escape now
            </button>
            {expedition.retreatThresholds.length > 0 ? (
              <button type="button" aria-pressed={expedition.autoEscapeOff !== true} onClick={() => setAutoEscapeFromUi(expedition.autoEscapeOff === true)}>
                Auto-escape: {expedition.autoEscapeOff === true ? 'Off' : 'On'}
              </button>
            ) : null}
            <button type="button" onClick={onOpenMap}>
              Open map
            </button>
          </div>
          <div className="run-dock-repeat">
            <label className={mastery.mastered ? undefined : 'is-disabled'}>
              <input
                type="checkbox"
                data-testid="dock-repeat"
                checked={hero?.repeatRoute === true}
                disabled={!mastery.mastered}
                onChange={(event) => setRepeatRouteFromUi(event.target.checked)}
              />
              Run this route again
            </label>
            <small className="muted" data-testid="dock-repeat-note">
              {mastery.mastered
                ? 'Mastered route: you can switch this during the run.'
                : `Locked until the route is mastered (${mastery.returns}/${MASTERY_RETURNS} safe returns).`}
            </small>
          </div>
        </div>
      )}
    </aside>
  )
}

/** The dock itself. App mounts it only where dockVisible says so. */
export function RunDock({ onOpenMap }: { onOpenMap: () => void }) {
  const { save } = useSaveStatus()
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const expedition = save.expedition
  const running = expedition !== null
  // Publishes the dock's real height (again whenever it folds or unfolds; the observer also catches wrapping) so the page can keep its end clear of it (the CSS only uses it under 1280px).
  useEffect(() => {
    const dock = running ? document.querySelector<HTMLElement>('.run-dock') : null
    if (dock === null || typeof ResizeObserver === 'undefined') return
    const root = document.documentElement
    const publish = () => root.style.setProperty('--run-dock-height', `${Math.ceil(dock.getBoundingClientRect().height)}px`)
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(dock)
    return () => {
      observer.disconnect()
      root.style.removeProperty('--run-dock-height')
    }
  }, [running, collapsed])
  if (expedition === null) return null
  return (
    <RunDockView
      expedition={expedition}
      hero={selectedHero(save)}
      waiting={expeditionWaiting()}
      collapsed={collapsed}
      onToggle={() => {
        writeCollapsed(!collapsed)
        setCollapsed(!collapsed)
      }}
      onOpenMap={onOpenMap}
    />
  )
}
