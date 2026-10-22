import {
  equipmentBlock,
  skillAffordable,
  skillEquipped,
  skillNeedsEnemy,
  skillOffCooldown,
} from './skills.ts'
import type { CombatActor, CombatHero, CombatState, GameDefs, PriorityEvent, SkillDef } from './types.ts'

export type HeroActionChoice =
  | { kind: 'skill'; skill: SkillDef; targets: CombatActor[]; events: PriorityEvent[] }
  | { kind: 'basicAttack'; events: PriorityEvent[] }

function livingEnemies(state: CombatState): CombatActor[] {
  const living: CombatActor[] = []
  for (const enemy of state.enemies) {
    if (enemy.alive) living.push(enemy)
  }
  living.sort((a, b) => a.slot - b.slot)
  return living
}

function enemyTargets(state: CombatState, skill: SkillDef): CombatActor[] {
  const living = livingEnemies(state)
  if (skill.target === 'all') return living
  const first = living[0]
  return first === undefined ? [] : [first]
}

function priorityEvent(
  hero: CombatHero,
  timeMs: number,
  rowIndex: number | null,
  skill: SkillDef | null,
  decision: PriorityEvent['decision'],
  reason: string | null,
): PriorityEvent {
  return {
    type: 'priority',
    timeMs,
    actorId: hero.id,
    actorName: hero.name,
    rowIndex,
    skillId: skill === null ? null : skill.id,
    skillName: skill === null ? null : skill.name,
    decision,
    reason,
  }
}

/**
 * First failing eligibility check, in the order the log should name.
 * Null means the row can be used.
 */
export function skipReason(
  state: CombatState,
  hero: CombatHero,
  skill: SkillDef,
  timeMs: number,
): string | null {
  if (!skillEquipped(hero, skill.id)) return 'not equipped'
  if (!skillOffCooldown(hero, skill, timeMs)) return 'on cooldown'
  if (!skillAffordable(skill)) return 'unaffordable'
  const equipment = equipmentBlock(hero, skill)
  if (equipment !== null) return equipment
  if (skillNeedsEnemy(skill) && enemyTargets(state, skill).length === 0) return 'no target'
  return null
}

function targetsFor(state: CombatState, hero: CombatHero, skill: SkillDef): CombatActor[] {
  if (!skillNeedsEnemy(skill)) return [hero]
  return enemyTargets(state, skill)
}

/**
 * Walk unconditional rows from top to bottom.
 * The first equipped, ready, affordable, equipment-valid row with a target wins.
 * Otherwise the hero uses a weapon basic attack.
 */
export function chooseHeroAction(
  state: CombatState,
  defs: GameDefs,
  hero: CombatHero,
  timeMs: number,
): HeroActionChoice {
  const events: PriorityEvent[] = []
  for (let index = 0; index < hero.priorityRows.length; index += 1) {
    const row = hero.priorityRows[index]
    if (row === undefined) continue
    const skill = defs.skills[row.skillId]
    if (skill === undefined) {
      throw new Error(`priority row ${index + 1} references unknown skill '${row.skillId}'`)
    }
    const reason = skipReason(state, hero, skill, timeMs)
    if (reason !== null) {
      events.push(priorityEvent(hero, timeMs, index, skill, 'skip', reason))
      continue
    }
    events.push(priorityEvent(hero, timeMs, index, skill, 'use', null))
    return { kind: 'skill', skill, targets: targetsFor(state, hero, skill), events }
  }
  if (hero.priorityRows.length > 0) {
    events.push(priorityEvent(hero, timeMs, null, null, 'fallback', 'no priority row was eligible'))
  }
  return { kind: 'basicAttack', events }
}
