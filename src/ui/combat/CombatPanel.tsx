import type { CombatState } from '../../sim/types.ts'

import { ActorCard } from './ActorCard.tsx'
import './combat.css'

export function CombatPanel({ combat, queueError = null }: { combat: CombatState; queueError?: string | null }) {
  const { hero } = combat
  return (
    <section className="combat-panel" aria-label="Combat">
      <ActorCard
        actor={hero}
        spriteId={hero.id}
        timeMs={combat.timeMs}
        log={combat.log}
        equippedSkillIds={hero.equippedSkillIds}
        classResource={{
          id: hero.classResourceId,
          current: hero.classResource,
          max: hero.classResourceMax,
        }}
        manualQueue={{ state: combat, queueError }}
      />
      {combat.enemies.map((enemy) => (
        <ActorCard key={enemy.id} actor={enemy} spriteId={enemy.defId} timeMs={combat.timeMs} log={combat.log} />
      ))}
    </section>
  )
}
