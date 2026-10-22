import type { LogEvent } from './types.ts'

function seconds(ms: number): string {
  const negative = ms < 0
  const abs = negative ? -ms : ms
  const rounded = Math.trunc(abs)
  const whole = Math.trunc(rounded / 1000)
  const frac = rounded % 1000
  const text = `${whole}.${String(frac).padStart(3, '0')}`
  return negative ? `-${text}` : text
}

function faceList(names: readonly string[]): string {
  if (names.length === 0) return 'nobody'
  if (names.length === 1) return names[0] ?? 'nobody'
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  const last = names[names.length - 1]
  return `${names.slice(0, -1).join(', ')}, and ${last}`
}

function formatDamage(event: Extract<LogEvent, { type: 'damage' }>): string {
  const critical = event.crit ? `yes ×${event.critDamage}` : 'no'
  return [
    `At ${seconds(event.timeMs)}s, ${event.actorName} deals ${event.hpDamage} ${event.school} damage to ${event.targetName}`,
    `(HP ${event.targetHpBefore} to ${event.targetHpAfter}).`,
    `Power ${event.power} × ${event.coefficient} = ${event.raw};`,
    `outgoing ×${event.outgoingModifier} = ${event.afterOutgoing};`,
    `consistency ${event.consistency} roll ${event.consistencyRoll}`,
    `(floor ${event.damageFloor} ceiling ${event.damageCeiling}) = ${event.afterConsistency};`,
    `critical ${critical} (roll ${event.critRoll} vs ${event.critChance}) = ${event.afterCrit};`,
    `barrier absorbed ${event.barrierAbsorbed} of ${event.barrier};`,
    `overflow ${event.overflow};`,
    `penetration ${event.penetration};`,
    `defense ${event.defense};`,
    `attacker level ${event.attackerLevel};`,
    `reduction ${event.reduction};`,
    `incoming ×${event.incomingModifier} = ${event.afterIncoming};`,
    `rounded ${event.hpDamage}.`,
  ].join(' ')
}

/** Plain English for one log event. The simulation does not print; callers do. */
export function formatEvent(event: LogEvent): string {
  switch (event.type) {
    case 'encounterStart':
      return `At ${seconds(event.timeMs)}s, encounter started with seed ${event.seed}. ${event.heroName} faces ${faceList(event.enemies.map((enemy) => enemy.name))}.`
    case 'action':
      return `At ${seconds(event.timeMs)}s, ${event.actorName} basic attacks ${event.targetName}. Next ready at ${seconds(event.nextReadyMs)}s.`
    case 'hitRoll':
      return `At ${seconds(event.timeMs)}s, ${event.actorName} hit roll ${event.roll} against ${event.hitChance} (Accuracy ${event.accuracy}, Evasion ${event.evasion}): ${event.hit ? 'hit' : 'miss'}.`
    case 'damage':
      return formatDamage(event)
    case 'death':
      return `At ${seconds(event.timeMs)}s, ${event.actorName} dies, killed by ${event.killerName}.`
    case 'encounterEnd':
      return `At ${seconds(event.timeMs)}s, encounter ended: ${event.outcome}.`
    default: {
      const unexpected: never = event
      throw new Error(`unknown log event ${JSON.stringify(unexpected)}`)
    }
  }
}
