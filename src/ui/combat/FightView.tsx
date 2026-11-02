import type { CombatState } from '../../sim/types.ts'
import { LogPanel } from '../log/LogPanel.tsx'

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

/**
 * One fight, live or finished, in the same layout so nothing jumps when it ends: a header with the
 * result, the hero on one side and the enemies on the other, and the log beside or below them.
 */
export function FightView({
  combat,
  title,
  queueError = null,
}: {
  combat: CombatState
  title: string
  queueError?: string | null
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
            <ActorCard
              actor={hero}
              spriteId={hero.id}
              timeMs={combat.timeMs}
              log={combat.log}
              equippedSkillIds={hero.equippedSkillIds}
              classResource={{ id: hero.classResourceId, current: hero.classResource, max: hero.classResourceMax }}
              manualQueue={live ? { state: combat, queueError } : undefined}
            />
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
