import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { skills } from '../../content/skills.ts'
import { queueManualAction, skipReason } from '../../sim/automation.ts'
import type {
  ActorStatuses,
  ActorTelegraph,
  BleedStatus,
  BurnStatus,
  ChillStatus,
  CombatActor,
  CombatState,
  ExposeStatus,
  LogEvent,
  MarkStatus,
  PoisonStatus,
} from '../../sim/types.ts'

import { debugLog } from '../debug.ts'
import { noteHeroQueue } from '../store.ts'

const missingSprites = new Set<string>()

const STATUS_KEYS = ['bleed', 'poison', 'burn', 'chill', 'mark', 'expose'] as const

type ActiveStatus = BleedStatus | PoisonStatus | BurnStatus | ChillStatus | MarkStatus | ExposeStatus

type StatusBadge = {
  key: (typeof STATUS_KEYS)[number]
  name: string
  stacks: number | null
  intensity: number | null
  remainingMs: number | null
}

type ClassResource = {
  id: string
  current: number
  max: number
}

export type ActorCardProps = {
  actor: CombatActor
  spriteId: string
  timeMs: number
  log: readonly LogEvent[]
  equippedSkillIds?: readonly string[]
  classResource?: ClassResource
  manualQueue?: {
    state: CombatState
    queueError: string | null
  }
}

/** Latest use, basic attack, or telegraph start already in the log. Display only. */
function latestActSignature(log: readonly LogEvent[], actorId: string): string | null {
  for (let index = log.length - 1; index >= 0; index -= 1) {
    const event = log[index]
    if (event === undefined) continue
    if (event.type === 'action' && event.actorId === actorId) {
      if (event.action === 'basicAttack') return `${index}:${event.timeMs}:basicAttack`
      return `${index}:${event.timeMs}:skill:${event.skillId ?? ''}`
    }
    if (event.type === 'telegraph' && event.phase === 'start' && event.actorId === actorId) {
      return `${index}:${event.timeMs}:telegraph:${event.tag}`
    }
  }
  return null
}

function ratioPercent(current: number, max: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(max) || max <= 0) return 0
  if (current <= 0) return 0
  if (current >= max) return 100
  return (current / max) * 100
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter((word) => word.length > 0)
  if (words.length === 0) return '?'
  const first = words[0]
  if (words.length === 1) return (first ?? '?').slice(0, 2).toUpperCase()
  let text = ''
  for (const word of words) {
    text += word.charAt(0).toUpperCase()
    if (text.length === 3) break
  }
  return text.length === 0 ? '?' : text
}

function fallbackColor(seed: string): string {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash, 31) + seed.charCodeAt(index)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue} 45% 42%)`
}

function cooldownRemainingMs(
  cooldowns: CombatActor['cooldowns'],
  skillId: string,
  timeMs: number,
): number | null {
  if (!Object.hasOwn(cooldowns, skillId)) return null
  const readyAt = cooldowns[skillId]
  if (readyAt === undefined) return null
  return readyAt - timeMs
}

function readStatus(key: StatusBadge['key'], status: ActiveStatus, timeMs: number): StatusBadge {
  let stacks: number | null = null
  if ('stacks' in status) {
    const value = status.stacks
    stacks = Array.isArray(value) ? value.length : value
  }
  const intensity = 'intensity' in status ? status.intensity : null
  let remainingMs: number | null = null
  if ('expiresMs' in status && typeof status.expiresMs === 'number') {
    remainingMs = status.expiresMs - timeMs
  }
  return { key, name: status.name, stacks, intensity, remainingMs }
}

function statusBadges(statuses: ActorStatuses, timeMs: number): StatusBadge[] {
  const badges: StatusBadge[] = []
  for (const key of STATUS_KEYS) {
    const status = statuses[key]
    if (status === null) continue
    badges.push(readStatus(key, status, timeMs))
  }
  return badges
}

function badgeText(badge: StatusBadge): string {
  let text = badge.name
  if (badge.stacks !== null) text += ` · ${badge.stacks} stacks`
  if (badge.intensity !== null) text += ` · intensity ${badge.intensity}`
  if (badge.remainingMs !== null) text += ` · ${badge.remainingMs} ms`
  return text
}

function phaseLabel(actor: CombatActor): string {
  for (const phase of actor.phases) {
    if (phase.phase === actor.bossPhase) return `Phase ${actor.bossPhase}: ${phase.name}`
  }
  return `Phase ${actor.bossPhase}`
}

function telegraphFillPercent(telegraph: ActorTelegraph, timeMs: number): number {
  const remaining = telegraph.resolvesAtMs - timeMs
  const started = telegraph.startedAtMs
  if (typeof started !== 'number' || telegraph.resolvesAtMs <= started) return remaining > 0 ? 100 : 0
  return ratioPercent(remaining, telegraph.resolvesAtMs - started)
}

function ActorSprite({ spriteId, name }: { spriteId: string; name: string }) {
  const [failed, setFailed] = useState(() => spriteId.length === 0 || missingSprites.has(spriteId))
  if (failed) {
    return (
      <span className="actor-fallback" style={{ background: fallbackColor(spriteId.length === 0 ? name : spriteId) }} aria-hidden="true">
        {initials(name)}
      </span>
    )
  }
  return (
    <img
      className="actor-sprite"
      src={`/sprites/${encodeURIComponent(spriteId)}.png`}
      alt=""
      width={64}
      height={64}
      draggable={false}
      onError={() => {
        if (!missingSprites.has(spriteId)) {
          missingSprites.add(spriteId)
          debugLog('[ui]', 'sprite missing', { spriteId })
        }
        setFailed(true)
      }}
    />
  )
}

function Meter({
  label,
  current,
  max,
  kind,
}: {
  label: string
  current: number
  max: number
  kind: 'hp' | 'barrier' | 'resource'
}) {
  return (
    <div className={`meter meter-${kind}`}>
      <div className="meter-row">
        <span className="meter-label">{label}</span>
        <span className="meter-value">
          {current} / {max}
        </span>
      </div>
      <div
        className="meter-track"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={current}
      >
        <div className={`meter-fill meter-fill-${kind}`} style={{ width: `${ratioPercent(current, max)}%` }} />
      </div>
    </div>
  )
}

function skillIsEligible(state: CombatState, skillId: string, timeMs: number): boolean {
  const skill = skills[skillId]
  if (skill === undefined) return false
  return skipReason(state, state.hero, skill, timeMs) === null
}

function SkillList({
  skillIds,
  cooldowns,
  timeMs,
  manualQueue,
}: {
  skillIds: readonly string[]
  cooldowns: CombatActor['cooldowns']
  timeMs: number
  manualQueue?: ActorCardProps['manualQueue']
}) {
  return (
    <ul className="skill-list">
      {skillIds.map((skillId, index) => {
        const remaining = cooldownRemainingMs(cooldowns, skillId, timeMs)
        const cooling = remaining !== null && remaining > 0
        const queueState = manualQueue?.state
        const eligible = queueState !== undefined && skillIsEligible(queueState, skillId, timeMs)
        return (
          <li key={`${skillId}:${index}`} className={cooling ? 'skill cooling' : 'skill ready'}>
            <span className="skill-id">{skillId}</span>
            {eligible ? (
              <button
                type="button"
                className="skill-queue"
                aria-label={`Queue ${skillId}`}
                onClick={() => {
                  if (queueState === undefined) return
                  debugLog('[ui]', 'queue skill', { skillId })
                  try {
                    queueManualAction(queueState, skillId)
                    noteHeroQueue(null)
                  } catch (error) {
                    const message = error instanceof Error ? error.message : `cannot queue '${skillId}'`
                    debugLog('[ui]', 'queue rejected', { skillId, message })
                    noteHeroQueue(message)
                  }
                }}
              >
                Queue
              </button>
            ) : null}
            {cooling ? <span className="cooldown-overlay">{remaining} ms</span> : null}
          </li>
        )
      })}
    </ul>
  )
}

function TimingBar({
  label,
  kind,
  telegraph,
  timeMs,
}: {
  label: string
  kind: 'telegraph' | 'reaction'
  telegraph: ActorTelegraph
  timeMs: number
}) {
  const remaining = telegraph.resolvesAtMs - timeMs
  return (
    <div className={`timing timing-${kind}`}>
      <div className="timing-row">
        <span className="timing-label">{label}</span>
        <span className="timing-tag">{telegraph.tag}</span>
        <span className="timing-remaining">{remaining} ms</span>
      </div>
      <div className="timing-track" aria-hidden="true">
        <div className={`timing-fill timing-fill-${kind}`} style={{ width: `${telegraphFillPercent(telegraph, timeMs)}%` }} />
      </div>
    </div>
  )
}

function StatusList({ statuses, timeMs }: { statuses: ActorStatuses; timeMs: number }) {
  const badges = statusBadges(statuses, timeMs)
  if (badges.length === 0) return null
  return (
    <ul className="status-list">
      {badges.map((badge) => (
        <li key={badge.key} className="status-badge">
          {badgeText(badge)}
        </li>
      ))}
    </ul>
  )
}

function useDisplayedChange(actorId: string, kind: 'telegraph' | 'boss phase', value: string | number | null): void {
  const previous = useRef<string | number | null | undefined>(undefined)
  useEffect(() => {
    if (previous.current === value) return
    const prior = previous.current
    previous.current = value
    if (prior === undefined && value === null) return
    debugLog('[ui]', kind, { actorId, [kind === 'telegraph' ? 'tag' : 'bossPhase']: value, previous: prior ?? null })
  }, [actorId, kind, value])
}

export function ActorCard({ actor, spriteId, timeMs, log, equippedSkillIds, classResource, manualQueue }: ActorCardProps) {
  const cardRef = useRef<HTMLElement>(null)
  const seenAct = useRef<string | null | undefined>(undefined)
  const actSignature = latestActSignature(log, actor.id)
  const telegraphTag = actor.telegraph === null ? null : actor.telegraph.tag
  const bossPhase = actor.boss ? actor.bossPhase : null
  const barrierActive = actor.barrier > 0 && timeMs < actor.barrierExpiresMs

  useDisplayedChange(actor.id, 'telegraph', telegraphTag)
  useDisplayedChange(actor.id, 'boss phase', bossPhase)

  useLayoutEffect(() => {
    const card = cardRef.current
    if (card === null) return
    if (seenAct.current === undefined) {
      seenAct.current = actSignature
      return
    }
    if (actSignature === null) {
      card.classList.remove('is-acting')
      seenAct.current = null
      return
    }
    if (actSignature === seenAct.current) return
    seenAct.current = actSignature
    card.classList.remove('is-acting')
    void card.offsetWidth
    card.classList.add('is-acting')
    debugLog('[ui]', 'act', { actorId: actor.id, signature: actSignature })
  }, [actSignature, actor.id])

  return (
    <article
      ref={cardRef}
      className="actor-card"
      data-side={actor.side}
      data-alive={actor.alive ? 'true' : 'false'}
      data-actor-id={actor.id}
    >
      <div className="actor-head">
        <ActorSprite key={spriteId} spriteId={spriteId} name={actor.name} />
        <div>
          <h2 className="actor-name">{actor.name}</h2>
          {actor.alive ? null : <p className="actor-dead">Dead</p>}
          {actor.boss ? <p className="actor-phase">{phaseLabel(actor)}</p> : null}
          {actor.pressureStacks > 0 ? <p className="actor-pressure">Pressure {actor.pressureStacks}</p> : null}
        </div>
      </div>
      <Meter label="HP" current={actor.hp} max={actor.maxHp} kind="hp" />
      {barrierActive ? <Meter label="Barrier" current={actor.barrier} max={actor.maxHp} kind="barrier" /> : null}
      {classResource !== undefined ? (
        <Meter label={classResource.id} current={classResource.current} max={classResource.max} kind="resource" />
      ) : null}
      {equippedSkillIds !== undefined ? (
        <SkillList skillIds={equippedSkillIds} cooldowns={actor.cooldowns} timeMs={timeMs} manualQueue={manualQueue} />
      ) : null}
      {manualQueue !== undefined && manualQueue.state.queuedSkillId !== null ? (
        <p className="skill-queued">Queued: {manualQueue.state.queuedSkillId}</p>
      ) : null}
      {manualQueue !== undefined && manualQueue.queueError !== null ? (
        <p className="skill-queue-error" role="alert">
          {manualQueue.queueError}
        </p>
      ) : null}
      {actor.telegraph !== null ? (
        <TimingBar label="Telegraph" kind="telegraph" telegraph={actor.telegraph} timeMs={timeMs} />
      ) : null}
      {actor.reaction !== null ? (
        <TimingBar label="Reaction" kind="reaction" telegraph={actor.reaction} timeMs={timeMs} />
      ) : null}
      <StatusList statuses={actor.statuses} timeMs={timeMs} />
    </article>
  )
}
