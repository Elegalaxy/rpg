import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { skills } from '../../content/skills.ts'
import { gameDefs, setupForScenario, WARRIOR_VS_STANDARD_ID } from '../../content/scenarios.ts'
import { queueManualAction, skipReason } from '../../sim/automation.ts'
import { createCombat } from '../../sim/combat.ts'
import type { CombatState } from '../../sim/types.ts'

import { CombatPanel } from './CombatPanel.tsx'

function queueButtons(html: string): string[] {
  return [...html.matchAll(/aria-label="Queue ([^"]+)"/g)].map((match) => match[1] ?? '')
}

function skillName(id: string): string {
  return skills[id]?.name ?? id
}

function eligibleSkillIds(state: CombatState): string[] {
  const ids: string[] = []
  for (const skillId of state.hero.equippedSkillIds) {
    const skill = skills[skillId]
    if (skill !== undefined && skipReason(state, state.hero, skill, state.timeMs) === null) ids.push(skillId)
  }
  return ids
}

describe('manual queue button', () => {
  it('shows Queue only for an equipped skill with no skip reason, and names the queued skill', () => {
    const defs = gameDefs()
    const state = createCombat(setupForScenario(WARRIOR_VS_STANDARD_ID), defs, 1)
    const nextReadyMs = state.hero.nextReadyMs
    const before = JSON.stringify(state)
    expect(() => queueManualAction(state, 'cleave')).toThrow(/cannot queue 'cleave': not equipped/)
    expect(JSON.stringify(state)).toBe(before)

    const initial = renderToStaticMarkup(<CombatPanel combat={state} />)
    const initialButtons = queueButtons(initial)
    console.log('[ui] queue buttons at 0 fury', {
      buttons: initialButtons,
      skip: state.hero.equippedSkillIds.map((skillId) => {
        const skill = skills[skillId]
        return { skillId, reason: skill === undefined ? 'missing' : skipReason(state, state.hero, skill, state.timeMs) }
      }),
      hp: state.hero.hp,
      resource: state.hero.classResource,
    })
    expect(initialButtons).toEqual(['Driving Blow', 'Shield Brace'])
    expect(initialButtons).toEqual(eligibleSkillIds(state).map(skillName))
    expect(initial).not.toContain('aria-label="Queue Sundering Blow"')
    expect(initial).not.toContain('aria-label="Queue Second Wind"')
    expect(initial).not.toContain('aria-label="Queue Cleave"')
    expect(initial).not.toContain('Queued:')

    state.hero.classResource = 50
    const paid = renderToStaticMarkup(<CombatPanel combat={state} />)
    const paidButtons = queueButtons(paid)
    console.log('[ui] queue buttons at 50 fury', { buttons: paidButtons, hp: state.hero.hp, maxHp: state.hero.maxHp })
    expect(state.hero.hp).toBe(state.hero.maxHp)
    expect(paidButtons).toEqual(['Driving Blow', 'Sundering Blow', 'Shield Brace', 'Second Wind'])
    expect(paidButtons).toEqual(eligibleSkillIds(state).map(skillName))

    state.hero.cooldowns['driving-blow'] = state.timeMs + 3000
    state.hero.offHandKind = 'dagger'
    const blocked = renderToStaticMarkup(<CombatPanel combat={state} />)
    const blockedButtons = queueButtons(blocked)
    console.log('[ui] queue buttons after cooldown and shield loss', { buttons: blockedButtons })
    expect(blockedButtons).toEqual(['Sundering Blow', 'Second Wind'])
    expect(blockedButtons).toEqual(eligibleSkillIds(state).map(skillName))
    expect(blocked).not.toContain('aria-label="Queue Driving Blow"')
    expect(blocked).not.toContain('aria-label="Queue Shield Brace"')

    state.hero.cooldowns = {}
    state.hero.offHandKind = 'shield'
    state.hero.classResource = 0
    const readyAt = state.hero.nextReadyMs
    const timeMs = state.timeMs
    queueManualAction(state, 'shield-brace')
    const queued = renderToStaticMarkup(<CombatPanel combat={state} />)
    console.log('[ui] queued shield-brace', {
      text: queued.includes('Queued: Shield Brace'),
      timeMs: state.timeMs,
      nextReadyMs: state.hero.nextReadyMs,
      queuedSkillId: state.queuedSkillId,
    })
    expect(queued).toContain('Queued: Shield Brace')
    expect(queueButtons(queued)).toEqual(['Driving Blow', 'Shield Brace'])
    expect(state.timeMs).toBe(timeMs)
    expect(state.hero.nextReadyMs).toBe(readyAt)
    expect(state.hero.nextReadyMs).toBe(nextReadyMs)
    expect(state.queuedSkillId).toBe('shield-brace')
  })
})
