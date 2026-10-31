import type {
  ActorStatuses,
  CombatState,
  DamageEvent,
  EnemyStance,
  FieldTickEvent,
  HpLossEvent,
  LogEvent,
  ResourceEvent,
  ResourceSnapshotEvent,
  StatusTickEvent,
  TargetPriority,
  WaitEvent,
} from './types.ts'

function plainNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value)
  const rounded = Math.round(value * 1000) / 1000
  if (Object.is(rounded, -0)) return '0'
  return String(rounded)
}

function stanceName(stance: EnemyStance): string {
  return stance === 'guard' ? 'Guard' : 'Assault'
}

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

function priorityLabel(priority: TargetPriority | null): string {
  switch (priority) {
    case null:
      return 'the first living enemy'
    case 'current':
      return 'the current target'
    case 'lowestHpPercent':
      return 'lowest HP %'
    case 'highestHpPercent':
      return 'highest HP %'
    case 'lowestArmor':
      return 'lowest armor'
    case 'lowestResistance':
      return 'lowest resistance'
    case 'marked':
      return 'a marked enemy'
    case 'actingSoonest':
      return 'the enemy acting soonest'
    case 'random':
      return 'a random enemy'
    default: {
      const unexpected: never = priority
      throw new Error(`unknown target priority ${JSON.stringify(unexpected)}`)
    }
  }
}

function formatFraction(event: ResourceEvent): string {
  if (event.fractionBefore === undefined || event.fractionAfter === undefined) return ''
  return `; fraction ${event.fractionBefore} to ${event.fractionAfter}`
}

function formatResource(event: ResourceEvent): string {
  const when = `At ${seconds(event.timeMs)}s, ${event.actorName} ${event.resourceId}`
  if (event.reason === 'payment') {
    return `${when} pays ${event.base}: ${event.before} to ${event.after} (max ${event.maximum}).`
  }
  if (event.reason === 'encounterStart') {
    return `${when} starts at ${event.after} (max ${event.maximum}, ${event.scope}).`
  }
  if (event.reason === 'encounterEnd') {
    return `${when} clears at encounter end: ${event.before} to ${event.after}${formatFraction(event)}.`
  }
  const cap = event.gainCap === null ? '' : `, cap ${event.gainCap}`
  return `${when} ${event.reason}: base ${event.base} × ${event.multiplier} = ${event.generated}${cap}; ${event.before} to ${event.after} (max ${event.maximum})${formatFraction(event)}.`
}

function formatSnapshot(event: ResourceSnapshotEvent): string {
  return `At ${seconds(event.timeMs)}s, ${event.actorName} snapshots ${event.resourceId} ${event.amount} for physical ×${event.multiplier} before paying.`
}

function formatWait(event: WaitEvent): string {
  return `At ${seconds(event.timeMs)}s, ${event.actorName} waits because ${event.reason}.`
}

function formatRulesChanged(event: Extract<LogEvent, { type: 'rulesChanged' }>): string {
  const when = `At ${seconds(event.timeMs)}s`
  if (!event.applied) {
    return `${when}, ${event.actorName} rejects priority rules: ${event.reason}.`
  }
  const rows = event.rowCount === 1 ? '1 row' : `${event.rowCount} rows`
  return `${when}, ${event.actorName} changes priority rules to ${rows}, targeting ${priorityLabel(event.targetPriority)}.`
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
        const ammo =
          event.ammoSpent === undefined || event.ammoSpent <= 0
            ? ''
            : ` Spends ${event.ammoSpent} special arrow (${event.ammoRemaining} remaining).`
        return `At ${seconds(event.timeMs)}s, ${event.actorName} uses ${skillName} on ${event.targetName}. Next ready at ${seconds(event.nextReadyMs)}s.${cooldown}${ammo}`
      }
    case 'priority':
      if (event.decision === 'fallback') {
        return `At ${seconds(event.timeMs)}s, ${event.actorName} falls back because no priority row was eligible.`
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
    case 'rulesChanged':
      return formatRulesChanged(event)
    case 'manual':
      if (event.result === 'cancel') {
        return `At ${seconds(event.timeMs)}s, ${event.actorName} cancels queued ${event.skillName} (${event.skillId}): ${event.reason}.`
      }
      if (event.result === 'use') {
        return `At ${seconds(event.timeMs)}s, ${event.actorName} manually selects ${event.skillName} (${event.skillId}).`
      }
      {
        const unexpected: never = event.result
        throw new Error(`unknown manual result ${JSON.stringify(unexpected)}`)
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
        if (event.until === 'duration' && event.expiresMs !== undefined) {
          return `At ${seconds(event.timeMs)}s, ${event.actorName} gains ${event.value} Evasion until ${seconds(event.expiresMs)}s.`
        }
        return `At ${seconds(event.timeMs)}s, ${event.actorName} gains ${event.value} Evasion until the next action.`
      }
      if (event.kind === 'defense' && event.expiresMs !== undefined) {
        return `At ${seconds(event.timeMs)}s, ${event.actorName} gains ×${plainNumber(event.value)} Armor and Resistance until ${seconds(event.expiresMs)}s.`
      }
      return `At ${seconds(event.timeMs)}s, ${event.actorName} takes ×${event.value} incoming damage until the next action.`
    case 'buffEnded':
      if (event.reason === 'defense') {
        return `At ${seconds(event.timeMs)}s, ${event.actorName}'s Armor and Resistance bonus ends.`
      }
      if (event.reason === 'duration') {
        return `At ${seconds(event.timeMs)}s, ${event.actorName}'s timed Evasion of ${event.evasion} ends.`
      }
      if (event.reason === 'granted') {
        return `At ${seconds(event.timeMs)}s, ${event.actorName}'s granted damage reduction of ${event.damageReduction} ends.`
      }
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
      if (event.reason === 'moved') {
        return `At ${seconds(event.timeMs)}s, Mark moves off ${event.actorName}.`
      }
      if (event.reason === 'death') {
        return `At ${seconds(event.timeMs)}s, ${event.statusName} clears from ${event.actorName} on death.`
      }
      return `At ${seconds(event.timeMs)}s, cleanse removes ${event.statusName} from ${event.actorName} (${event.stacks} stacks).`
    case 'markRefresh':
      return `At ${seconds(event.timeMs)}s, ${event.actorName} refreshes Mark on ${event.targetName}: ${event.remainingMs} ms remains ${event.nextRemainingMs} ms, expires at ${seconds(event.expiresMs)}s.`
    case 'reveal':
      return `At ${seconds(event.timeMs)}s, ${event.actorName} reveals ${event.targetName}.`
    case 'trap':
      if (event.replacedName === null) {
        return `At ${seconds(event.timeMs)}s, ${event.actorName} arms a trap on ${event.targetName}.`
      }
      return `At ${seconds(event.timeMs)}s, ${event.actorName} arms a trap on ${event.targetName}, replacing the trap on ${event.replacedName}.`
    case 'field': {
      const replaced = event.replaced ? ' replacing the previous field' : ''
      return `At ${seconds(event.timeMs)}s, ${event.actorName} consecrates a field until ${seconds(event.expiresMs)}s${replaced}. Power ${event.power}, healing power ${event.healingPower}.`
    }
    case 'fieldTick':
      return [
        `At ${seconds(event.timeMs)}s, ${event.actorName}'s field ticks ${event.targetName} for ${event.hpDamage}`,
        `(HP ${event.targetHpBefore} to ${event.targetHpAfter}).`,
        `Power ${event.power} × ${event.coefficient} = ${event.raw};`,
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
    case 'fieldHeal':
      return `At ${seconds(event.timeMs)}s, ${event.actorName}'s field restores ${event.amount} (HP ${event.targetHpBefore} to ${event.targetHpAfter}). Healing Power ${event.healingPower} × ${event.coefficient} = ${event.raw}; no roll; healing received ×${event.healingReceived} = ${event.afterReceived}; rounded ${event.amount}.`
    case 'fieldExpired':
      return `At ${seconds(event.timeMs)}s, ${event.actorName}'s field expires.`
    case 'hpLoss':
      return `At ${seconds(event.timeMs)}s, ${event.actorName} loses ${event.amount} HP (${event.hpBefore} to ${event.hpAfter}), bypassing barrier and Defense.`
    case 'vow':
      return `At ${seconds(event.timeMs)}s, ${event.actorName}'s vow of ${event.vow} does not grant Faith: ${event.reason}.`
    case 'resource':
      return formatResource(event)
    case 'resourceSnapshot':
      return formatSnapshot(event)
    case 'wait':
      return formatWait(event)
    case 'regen':
      if (event.paused) {
        return `At ${seconds(event.timeMs)}s, ${event.actorName} regeneration is paused (HP ${event.hpBefore}).`
      }
      return `At ${seconds(event.timeMs)}s, ${event.actorName} regenerates ${event.amount} HP (${event.hpBefore} to ${event.hpAfter}), ${event.fraction} of max HP ${event.maxHp}.`
    case 'skillSkip':
      return `At ${seconds(event.timeMs)}s, ${event.actorName} skips ${event.skillName} (${event.skillId}): ${event.reason}.`
    case 'phase':
      return `At ${seconds(event.timeMs)}s, ${event.actorName} enters phase ${event.phase}, ${event.name} (HP ${plainNumber(event.hp)} of ${plainNumber(event.maxHp)}).`
    case 'stack':
      return `At ${seconds(event.timeMs)}s, ${event.actorName} gains stack ${event.stacks} of ${event.maxStacks}. Power ${plainNumber(event.power)}, Armor ${plainNumber(event.armor)}, Resistance ${plainNumber(event.resistance)}.`
    case 'telegraph':
      if (event.phase === 'start') {
        return `At ${seconds(event.timeMs)}s, ${event.actorName} telegraphs ${event.tag} (${event.skillName}), resolving at ${seconds(event.resolvesAtMs)}s.`
      }
      if (event.phase === 'cancel' && event.reason === 'interrupt') {
        const cooldown =
          event.cooldownReadyMs === undefined || event.cooldownReadyMs === null
            ? ''
            : ` Cooldown ready at ${seconds(event.cooldownReadyMs)}s.`
        return `At ${seconds(event.timeMs)}s, ${event.actorName}'s ${event.tag} telegraph is interrupted (${plainNumber(event.hpTaken ?? 0)} of ${plainNumber(event.hpNeeded ?? 0)} HP).${cooldown}`
      }
      if (event.phase === 'cancel') {
        return `At ${seconds(event.timeMs)}s, ${event.actorName}'s ${event.tag} telegraph is cancelled.`
      }
      return `At ${seconds(event.timeMs)}s, ${event.actorName}'s ${event.tag} telegraph resolves.`
    case 'stance':
      return `At ${seconds(event.timeMs)}s, ${event.actorName} enters ${stanceName(event.stance)}. Power ${plainNumber(event.power)}, Armor ${plainNumber(event.armor)}, Resistance ${plainNumber(event.resistance)}.`
    case 'summon':
      return `At ${seconds(event.timeMs)}s, ${event.actorName} summons level ${event.level} ${event.summonName} in slot ${event.slot} for ${event.xp} XP.`
    case 'encounterXp':
      return `At ${seconds(event.timeMs)}s, the encounter awards ${event.amount} XP (sum ${event.sum}, ${event.members} enemies, discount ${event.discount}).`
    case 'death':
      return `At ${seconds(event.timeMs)}s, ${event.actorName} dies, killed by ${event.killerName}.`
    case 'encounterEnd':
      return `At ${seconds(event.timeMs)}s, encounter ended: ${event.outcome}.`
    case 'race':
      return `At ${seconds(event.timeMs)}s, ${event.text}`
    case 'escape': {
      const result = event.success ? 'success' : 'failure'
      return `At ${seconds(event.timeMs)}s, ${event.actorName} attempts escape (HP ${event.hp}/${event.maxHp}, threshold ${event.thresholdPercent}%): roll ${event.roll} against ${event.chancePercent}% (base ${event.basePercent}, Agility ${event.agility} adds ${event.agilityPoints}, supplies ${event.suppliesBonus}, zone ${event.zoneBonus}, momentum ${event.momentumBonus}): ${result}.`
    }
    default: {
      const unexpected: never = event
      throw new Error(`unknown log event ${JSON.stringify(unexpected)}`)
    }
  }
}

/** A log line that lowered the hero's HP. */
export type HeroHpLossEvent = DamageEvent | StatusTickEvent | FieldTickEvent | HpLossEvent

/** HP losses that led to the hero's death, and the statuses still on the hero. */
export type DefeatSummary = {
  hpLoss: HeroHpLossEvent[]
  statuses: ActorStatuses
}

function isHeroHpLoss(event: LogEvent, heroId: string): event is HeroHpLossEvent {
  if (event.type === 'damage' || event.type === 'statusTick' || event.type === 'fieldTick') {
    return event.targetId === heroId && event.targetHpAfter < event.targetHpBefore
  }
  if (event.type === 'hpLoss') {
    return event.actorId === heroId && event.hpAfter < event.hpBefore
  }
  return false
}

function copyStatuses(statuses: ActorStatuses): ActorStatuses {
  return {
    bleed: statuses.bleed,
    poison: statuses.poison,
    burn: statuses.burn,
    chill: statuses.chill,
    mark: statuses.mark,
    expose: statuses.expose,
  }
}

/**
 * HP-loss events that led to the defeat, in log order, and the statuses on the hero.
 * Does not print and does not change `state`.
 */
export function summarizeDefeat(state: CombatState): DefeatSummary {
  if (state.outcome !== 'defeat') {
    throw new Error(`summarizeDefeat requires a defeat, received ${state.outcome}`)
  }
  const heroId = state.hero.id
  let deathIndex = -1
  for (let index = 0; index < state.log.length; index += 1) {
    const event = state.log[index]
    if (event !== undefined && event.type === 'death' && event.actorId === heroId) {
      deathIndex = index
      break
    }
  }
  if (deathIndex < 0) {
    throw new Error('defeat ended without a hero death event')
  }
  const hpLoss: HeroHpLossEvent[] = []
  for (let index = 0; index < deathIndex; index += 1) {
    const event = state.log[index]
    if (event !== undefined && isHeroHpLoss(event, heroId)) hpLoss.push(event)
  }
  return { hpLoss, statuses: copyStatuses(state.hero.statuses) }
}
