import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { gameDefs, setupForScenario, WARRIOR_VS_STANDARD_ID } from '../../content/scenarios.ts'
import { queueManualAction } from '../../sim/automation.ts'
import { createCombat, stepCombat } from '../../sim/combat.ts'

import { FightView } from './FightView.tsx'

function fresh() {
  const defs = gameDefs()
  const state = createCombat(setupForScenario(WARRIOR_VS_STANDARD_ID), defs, 1)
  return { defs, state }
}

describe('queueing a carried supply', () => {
  it('refuses a supply the hero does not carry and accepts one that is carried', () => {
    const { state } = fresh()
    expect(() => queueManualAction(state, 'healing-draught')).toThrow(/not equipped/)
    state.hero.supplies.push('healing-draught')
    queueManualAction(state, 'healing-draught')
    expect(state.queuedSkillId).toBe('healing-draught')
  })

  it('uses the queued supply as the next action, once', () => {
    const { defs, state } = fresh()
    state.hero.supplies.push('healing-draught')
    state.hero.hp = Math.floor(state.hero.maxHp / 2)
    const before = state.hero.hp
    queueManualAction(state, 'healing-draught')
    let guard = 0
    while (state.queuedSkillId !== null && guard < 2000) {
      stepCombat(state, defs)
      guard += 1
    }
    expect(state.queuedSkillId).toBeNull()
    expect(state.hero.supplies).toEqual([])
    expect(state.log.some((event) => event.type === 'supplyUse' && event.supplyId === 'healing-draught')).toBe(true)
    expect(state.log.some((event) => event.type === 'heal' && event.targetHpAfter > before)).toBe(true)
  })

  it('cancels a queued supply that is gone and falls back to the rules', () => {
    const { defs, state } = fresh()
    state.hero.supplies.push('healing-draught')
    queueManualAction(state, 'healing-draught')
    state.hero.supplies.length = 0
    let guard = 0
    while (state.queuedSkillId !== null && guard < 2000) {
      stepCombat(state, defs)
      guard += 1
    }
    expect(state.log.find((event) => event.type === 'manual')).toMatchObject({ result: 'cancel', skillId: 'healing-draught' })
  })
})

describe('the fight view controls', () => {
  it('shows a Queue button per carried supply, then marks the queued one', () => {
    const { state } = fresh()
    state.hero.supplies.push('healing-draught')
    const before = renderToStaticMarkup(<FightView combat={state} title="test" />)
    expect(before).toContain('aria-label="Queue Healing Draught"')
    expect(before).not.toContain('data-testid="supply-queued"')
    queueManualAction(state, 'healing-draught')
    const after = renderToStaticMarkup(<FightView combat={state} title="test" />)
    expect(after).toContain('data-testid="supply-queued"')
    expect(after).not.toContain('aria-label="Queue Healing Draught"')
  })

  it('shows Escape now only when an expedition fight passes the handler, and not once the fight is over', () => {
    const { state } = fresh()
    expect(renderToStaticMarkup(<FightView combat={state} title="test" />)).not.toContain('Escape now')
    const live = renderToStaticMarkup(<FightView combat={state} title="test" onEscapeNow={() => undefined} />)
    expect(live).toContain('Escape now')
    expect(renderToStaticMarkup(<FightView combat={state} title="test" onEscapeNow={() => undefined} escapePending />)).toContain('Escaping...')
    state.outcome = 'victory'
    expect(renderToStaticMarkup(<FightView combat={state} title="test" onEscapeNow={() => undefined} />)).not.toContain('Escape now')
  })
})
