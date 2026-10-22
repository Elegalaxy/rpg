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

function formatHeal(event: Extract<LogEvent, { type: 'heal' }>): string {
  return [
    `At ${seconds(event.timeMs)}s, ${event.actorName} heals ${event.targetName} for ${event.amount}`,
    `(HP ${event.targetHpBefore} to ${event.targetHpAfter}).`,
    `${event.maxHpFraction} of max HP + Healing Power ${event.healingPower} × ${event.healingCoefficient} = ${event.raw};`,
    `outgoing ×${event.outgoingModifier} = ${event.afterOutgoing};`,
    `roll ${event.roll} (floor ${event.rollFloor} ceiling ${event.rollCeiling}) = ${event.afterRoll};`,
    `healing received ×${event.healingReceived} = ${event.afterReceived};`,
    `rounded ${event.amount}.`,
  ].join(' ')
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

function formatStatusAttempt(event: Extract<LogEvent, { type: 'statusAttempt' }>): string {
  const when = `At ${seconds(event.timeMs)}s`
  if (event.result === 'guaranteed') {
    const until = event.expiresMs === null ? '' : ` until ${seconds(event.expiresMs)}s`
    return `${when}, ${event.actorName} applies ${event.statusName} to ${event.targetName} (guaranteed)${until}.`
  }
  if (event.result === 'contact') {
    return `${when}, ${event.actorName}'s ${event.statusName} does not apply to ${event.targetName} because a barrier absorbed the hit.`
  }
  const school = event.school === 'none' ? 'resistance' : `${event.school} resistance`
  const roll = `chance ${event.chance}, roll ${event.roll}, potency ${event.potency}, ${school} ${event.resistance}`
  if (event.result === 'resisted') {
    return `${when}, ${event.actorName}'s ${event.statusName} on ${event.targetName} is resisted (${roll}).`
  }
  if (event.result === 'cap') {
    return `${when}, ${event.actorName}'s ${event.statusName} does not add a stack on ${event.targetName}: already at ${event.stacks} stacks (${roll}).`
  }
  if (event.delayMs !== null && event.nextReadyMs !== null) {
    return `${when}, ${event.actorName} stuns ${event.targetName} for ${seconds(event.delayMs)}s (${roll}). Next ready at ${seconds(event.nextReadyMs)}s.`
  }
  const amount =
    event.intensity > 0 ? `intensity ${event.intensity}` : `stacks ${event.stacks}`
  const until = event.expiresMs === null ? '' : `, expires at ${seconds(event.expiresMs)}s`
  return `${when}, ${event.actorName} applies ${event.statusName} to ${event.targetName} (${roll}). ${amount}${until}.`
}

function formatStatusTick(event: Extract<LogEvent, { type: 'statusTick' }>): string {
  const scale =
    event.intensity > 1 ? ` × intensity ${event.intensity}` : event.stacks > 1 ? ` × ${event.stacks} stacks` : ''
  return [
    `At ${seconds(event.timeMs)}s, ${event.statusName} on ${event.targetName} ticks for ${event.hpDamage}`,
    `(HP ${event.targetHpBefore} to ${event.targetHpAfter}).`,
    `Power ${event.power} × ${event.coefficient}${scale} = ${event.raw};`,
    'no variance;',
    'no critical;',
    'barrier bypassed;',
    `penetration ${event.penetration};`,
    `defense ${event.defense};`,
    `attacker level ${event.attackerLevel};`,
    `reduction ${event.reduction};`,
    `mitigated ${event.afterDefense};`,
    `rounded ${event.hpDamage}.`,
  ].join(' ')
}

/** Plain English for one log event. The simulation does not print; callers do. */
export function formatEvent(event: LogEvent): string {
  switch (event.type) {
    case 'encounterStart':
      return `At ${seconds(event.timeMs)}s, encounter started with seed ${event.seed}. ${event.heroName} faces ${faceList(event.enemies.map((enemy) => enemy.name))}.`
    case 'action':
      if (event.action === 'basicAttack') {
        return `At ${seconds(event.timeMs)}s, ${event.actorName} basic attacks ${event.targetName}. Next ready at ${seconds(event.nextReadyMs)}s.`
      }
      {
        const skillName = event.skillName ?? 'a skill'
        const cooldown =
          event.cooldownReadyMs === null ? '' : ` Cooldown ready at ${seconds(event.cooldownReadyMs)}s.`
        return `At ${seconds(event.timeMs)}s, ${event.actorName} uses ${skillName} on ${event.targetName}. Next ready at ${seconds(event.nextReadyMs)}s.${cooldown}`
      }
    case 'priority':
      if (event.decision === 'fallback') {
        return `At ${seconds(event.timeMs)}s, ${event.actorName} uses a basic attack because no priority row was eligible.`
      }
      {
        const row = (event.rowIndex ?? 0) + 1
        const name = event.skillName ?? 'a skill'
        const id = event.skillId ?? ''
        if (event.decision === 'skip') {
          return `At ${seconds(event.timeMs)}s, ${event.actorName} skips row ${row} ${name} (${id}): ${event.reason}.`
        }
        return `At ${seconds(event.timeMs)}s, ${event.actorName} selects row ${row} ${name} (${id}).`
      }
    case 'hitRoll':
      return `At ${seconds(event.timeMs)}s, ${event.actorName} hit roll ${event.roll} against ${event.hitChance} (Accuracy ${event.accuracy}, Evasion ${event.evasion}): ${event.hit ? 'hit' : 'miss'}.`
    case 'damage':
      return formatDamage(event)
    case 'heal':
      return formatHeal(event)
    case 'barrier':
      return `At ${seconds(event.timeMs)}s, ${event.actorName} gains a barrier of ${event.amount} until ${seconds(event.expiresMs)}s.`
    case 'barrierExpired':
      return `At ${seconds(event.timeMs)}s, ${event.actorName}'s barrier of ${event.amount} expires.`
    case 'buff':
      if (event.kind === 'damageReduction') {
        return `At ${seconds(event.timeMs)}s, ${event.actorName} reduces incoming damage by ${event.value} until the next action.`
      }
      if (event.kind === 'evasion') {
        return `At ${seconds(event.timeMs)}s, ${event.actorName} gains ${event.value} Evasion until the next action.`
      }
      return `At ${seconds(event.timeMs)}s, ${event.actorName} takes ×${event.value} incoming damage until the next action.`
    case 'buffEnded':
      return `At ${seconds(event.timeMs)}s, ${event.actorName}'s until-next-action effects end (damage reduction ${event.damageReduction}, Evasion ${event.evasion}, incoming ×${event.incomingMultiplier}).`
    case 'actionDelay':
      return `At ${seconds(event.timeMs)}s, ${event.actorName} delays ${event.targetName} by ${seconds(event.delayMs)}s. Next ready at ${seconds(event.nextReadyMs)}s.`
    case 'statusAttempt':
      return formatStatusAttempt(event)
    case 'statusTick':
      return formatStatusTick(event)
    case 'statusExpired':
      return `At ${seconds(event.timeMs)}s, ${event.actorName}'s ${event.statusName} expires (${event.stacks} stacks).`
    case 'statusCleared':
      return `At ${seconds(event.timeMs)}s, cleanse removes ${event.statusName} from ${event.actorName} (${event.stacks} stacks).`
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
