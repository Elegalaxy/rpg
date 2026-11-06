import { skills } from '../../content/skills.ts'
import { SUPPLIES } from '../../content/supplies.ts'
import { queueManualAction, skipReason } from '../../sim/automation.ts'
import type { CombatState } from '../../sim/types.ts'
import { debugLog } from '../debug.ts'
import { Help } from '../Help.tsx'
import { Tag } from '../Kit.tsx'
import { LogPanel } from '../log/LogPanel.tsx'
import { noteHeroQueue } from '../store.ts'

import { ActorCard } from './ActorCard.tsx'
import './combat.css'

function finishedAtMs(combat: CombatState): number {
  for (let index = combat.log.length - 1; index >= 0; index -= 1) {
    const event = combat.log[index]
    if (event !== undefined && event.type === 'encounterEnd') return event.timeMs
  }
  return combat.timeMs
}

function titleCase(text: string): string {
  return text.replace(/-/g, ' ').replace(/^./, (first) => first.toUpperCase())
}

const JUST_USED_MS = 4000

/** The hero's carried supplies for this fight, live: what is left, what has been used, and a flash when one was just used. */
function SuppliesBar({ combat }: { combat: CombatState }) {
  const live = combat.outcome === 'ongoing'
  function queue(id: string): void {
    debugLog('[ui]', 'queue supply', { id })
    try {
      queueManualAction(combat, id)
      noteHeroQueue(null)
    } catch (error) {
      noteHeroQueue(error instanceof Error ? error.message : `cannot queue '${id}'`)
    }
  }
  const { hero } = combat
  const left: { [id: string]: number } = {}
  for (const id of hero.supplies) left[id] = (left[id] ?? 0) + 1
  const used: { [id: string]: number } = {}
  const names: { [id: string]: string } = {}
  let latest: { name: string; timeMs: number } | null = null
  for (const event of combat.log) {
    if (event.type !== 'supplyUse' || event.actorId !== hero.id) continue
    used[event.supplyId] = (used[event.supplyId] ?? 0) + 1
    names[event.supplyId] = event.supplyName
    latest = { name: event.supplyName, timeMs: event.timeMs }
  }
  const ids = [...new Set([...Object.keys(left), ...Object.keys(used)])]
  if (ids.length === 0) return null
  const fresh = live && latest !== null && combat.timeMs - latest.timeMs < JUST_USED_MS
  return (
    <div className="fight-supplies" aria-label="Supplies this fight" data-testid="fight-supplies">
      <span className="fight-supplies-title">Supplies</span>
      <ul>
        {ids.map((id) => (
          <li key={id} className={(left[id] ?? 0) === 0 ? 'supply-empty' : undefined}>
            {SUPPLIES.find((entry) => entry.id === id)?.name ?? names[id] ?? id}{' '}
            <strong>×{left[id] ?? 0}</strong>
            {(used[id] ?? 0) > 0 ? <span className="supply-used"> · used {used[id]}</span> : null}
            {live && (left[id] ?? 0) > 0 ? (
              combat.queuedSkillId === id ? (
                <>
                  {' '}
                  <Tag kind="info" testId="supply-queued">
                    Queued for next action
                  </Tag>
                </>
              ) : (
                <>
                  {' '}
                  <button
                    type="button"
                    className="skill-queue"
                    aria-label={`Queue ${SUPPLIES.find((entry) => entry.id === id)?.name ?? id}`}
                    disabled={skills[id] === undefined || skipReason(combat, hero, skills[id], combat.timeMs) !== null}
                    onClick={() => queue(id)}
                  >
                    Queue
                  </button>
                </>
              )
            ) : null}
          </li>
        ))}
      </ul>
      {fresh && latest !== null ? (
        <p className="supply-flash" role="status">
          Just used {latest.name} at {(latest.timeMs / 1000).toFixed(1)} s
        </p>
      ) : null}
    </div>
  )
}

/**
 * One fight, live or finished, in the same layout so nothing jumps when it ends: a header with the
 * result, the hero on one side and the enemies on the other, and the log beside or below them.
 */
export function FightView({
  combat,
  title,
  queueError = null,
  onEscapeNow,
  escapePending = false,
}: {
  combat: CombatState
  title: string
  queueError?: string | null
  /** Shown on a live expedition fight: start an escape attempt at once. */
  onEscapeNow?: () => void
  escapePending?: boolean
}) {
  const { hero } = combat
  const live = combat.outcome === 'ongoing'
  const seconds = ((live ? combat.timeMs : finishedAtMs(combat)) / 1000).toFixed(1)
  return (
    <section className="fight" aria-label="Fight" data-state={live ? 'live' : combat.outcome}>
      <header className="fight-head">
        <h3>{titleCase(title)}</h3>
        <span className="fight-badge" data-testid="fight-badge">
          {live ? `In progress · ${seconds} s` : `${titleCase(combat.outcome)} · ${seconds} s`}
        </span>
      </header>
      <div className="fight-body">
        <div className="fight-field" aria-label="Combat">
          <div className="fight-side fight-side--hero">
            <div className="fight-hero-stack">
            <ActorCard
              actor={hero}
              spriteId={hero.id}
              timeMs={combat.timeMs}
              log={combat.log}
              equippedSkillIds={hero.equippedSkillIds}
              classResource={{ id: hero.classResourceId, current: hero.classResource, max: hero.classResourceMax }}
              manualQueue={live ? { state: combat, queueError } : undefined}
            />
            <SuppliesBar combat={combat} />
            {live && onEscapeNow !== undefined ? (
              <div className="fight-escape">
                <button type="button" className="btn-danger" disabled={escapePending} onClick={onEscapeNow}>
                  {escapePending ? 'Escaping...' : 'Escape now'}
                </button>
                <Help label="About Escape now">
                  Tries to escape at once, whatever your HP or the auto-escape setting. The usual chance applies, and a packed Smoke Bomb adds 15 points. A failed try waits before the next automatic one.
                </Help>
              </div>
            ) : null}
            </div>
          </div>
          <div className="fight-vs" aria-hidden="true">
            vs
          </div>
          <div className="fight-side fight-side--enemies">
            {combat.enemies.map((enemy) => (
              <ActorCard key={enemy.id} actor={enemy} spriteId={enemy.defId} timeMs={combat.timeMs} log={combat.log} />
            ))}
          </div>
        </div>
        <div className="fight-log">
          <LogPanel log={combat.log} />
        </div>
      </div>
    </section>
  )
}
