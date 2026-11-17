import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { gameDefs, setupForScenario, WARRIOR_VS_STANDARD_ID } from '../../content/scenarios.ts'
import { queueManualAction } from '../../sim/automation.ts'
import { createCombat, stepCombat } from '../../sim/combat.ts'
import { setManualStack, setRuleStacks } from '../../sim/stacks.ts'
import type { CombatState } from '../../sim/types.ts'

import { FightView } from './FightView.tsx'
import { StackBar } from './StackBar.tsx'
import { summarizeStack } from './stackSummary.ts'

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

  it('puts stack and supplies beside the hero card and does not print vs', () => {
    const { state } = fresh()
    const html = renderToStaticMarkup(<FightView combat={state} title="test" onEscapeNow={() => undefined} />)
    expect(html).toContain('fight-hero-tools')
    expect(html).not.toContain('fight-vs')
    expect(html).not.toMatch(/>vs</)
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
  it('always draws the escape banner and fills it from the last escape event', () => {
    const { state } = fresh()
    const empty = renderToStaticMarkup(<FightView combat={state} title="test" />)
    expect(empty).toContain('fight-escape-banner')
    expect(empty).not.toContain('Escape failed')
    const base = { type: 'escape' as const, timeMs: 4200, actorId: 'hero', actorName: 'Hero', hp: 30, maxHp: 100, thresholdPercent: 40, roll: 0.125, chancePercent: 55, basePercent: 40, agility: 5, agilityPoints: 5, suppliesBonus: 0, zoneBonus: 0, momentumBonus: 10 }
    state.log.push({ ...base, success: false })
    expect(renderToStaticMarkup(<FightView combat={state} title="test" />)).toContain('Escape failed')
    state.log.push({ ...base, timeMs: 6000, success: true })
    const html = renderToStaticMarkup(<FightView combat={state} title="test" />)
    expect(html).toContain('Escaped at 6.0 s')
    expect(html).toContain('roll 12% vs 55%')
    state.log.push({ ...base, timeMs: 7000, success: false, hp: 30.400000000000034, maxHp: 275.40000000000003 })
    expect(renderToStaticMarkup(<FightView combat={state} title="test" />)).toContain('HP 30.4/275.4')
  })
})

describe('the rule stack bar', () => {
  function stacked() {
    const { defs, state } = fresh()
    const [first, second] = state.hero.equippedSkillIds
    if (first === undefined || second === undefined) throw new Error('warrior needs two skills')
    setRuleStacks(
      state,
      [
        { id: 'group', name: 'Group', when: [{ kind: 'hpPercent', who: 'hero', operator: 'atLeast', value: 50 }], rows: [{ skillId: first }] },
        { id: 'solo', name: 'Solo', when: [], rows: [{ skillId: second }] },
      ],
      defs,
    )
    expect(state.hero.ruleStacks).toHaveLength(2)
    return { defs, state }
  }

  function untilAction(state: CombatState, defs: ReturnType<typeof fresh>['defs']) {
    const before = state.log.filter((event) => event.type === 'action' && event.actorId === state.hero.id).length
    for (let i = 0; i < 3000; i += 1) {
      stepCombat(state, defs)
      if (state.log.filter((event) => event.type === 'action' && event.actorId === state.hero.id).length > before) break
    }
  }

  it('is not drawn for a hero without extra stacks', () => {
    const { state } = fresh()
    const html = renderToStaticMarkup(<FightView combat={state} title="test" />)
    expect(html).not.toContain('rs-bar')
    expect(html).not.toContain('Stack:')
  })

  it('shows the active stack with a reason, and the picker with Auto first', () => {
    const { state } = stacked()
    const html = renderToStaticMarkup(<FightView combat={state} title="test" />)
    expect(html).toContain('Stack: Default')
    expect(html).toContain('Default · no trigger passed')
    const labels = [...html.matchAll(/class="rs-pick"[^>]*>([^<]*)</g)].map((match) => match[1])
    expect(labels).toEqual(['Auto', 'Default', 'Group', 'Solo'])
    expect(html).toMatch(/aria-pressed="true"[^>]*>Auto</)
  })

  it('names the trigger from the last switch', () => {
    const { defs, state } = stacked()
    untilAction(state, defs)
    expect(state.hero.stackState?.activeId).toBe('group')
    const html = renderToStaticMarkup(<StackBar combat={state} />)
    expect(html).toContain('Stack: Group')
    expect(html).toContain('Auto · hero HP% at least 50')
  })

  it('shows Next action for a pick that is not applied yet, then the stack, and Auto clears it', () => {
    const { defs, state } = stacked()
    setManualStack(state, defs, 'solo')
    const pending = renderToStaticMarkup(<StackBar combat={state} />)
    expect(pending).toContain('data-testid="stack-pending"')
    expect(pending).toContain('Next action')
    untilAction(state, defs)
    const applied = renderToStaticMarkup(<StackBar combat={state} />)
    expect(applied).toContain('Stack: Solo')
    expect(applied).toContain('Manual · until the fight ends')
    expect(applied).not.toContain('data-testid="stack-pending"')
    expect(applied).toMatch(/aria-pressed="true"[^>]*>Solo</)
    setManualStack(state, defs, null)
    const auto = renderToStaticMarkup(<StackBar combat={state} />)
    expect(auto).toMatch(/aria-pressed="true"[^>]*>Auto</)
    expect(auto).not.toContain('Manual ·')
  })

  it('keeps the same structure and classes before and after a switch', () => {
    const { defs, state } = stacked()
    const shape = (html: string) => html.replace(/>[^<]+</g, '><').replace(/ (aria-pressed|title)="[^"]*"/g, '').replace(/ data-testid="stack-pending"/g, '')
    const slotOf = (html: string) => (html.match(/rs-pending-slot/g) ?? []).length
    const before = renderToStaticMarkup(<StackBar combat={state} />)
    setManualStack(state, defs, 'solo')
    const pending = renderToStaticMarkup(<StackBar combat={state} />)
    untilAction(state, defs)
    const after = renderToStaticMarkup(<StackBar combat={state} />)
    expect(slotOf(before)).toBe(1)
    expect(slotOf(pending)).toBe(1)
    expect(slotOf(after)).toBe(1)
    expect(shape(after)).toBe(shape(before))
  })

  it('says Held while the drop back to a lower stack waits out the 2 s hold', () => {
    const { defs, state } = stacked()
    untilAction(state, defs)
    expect(state.hero.stackState?.activeId).toBe('group')
    state.hero.hp = 1
    expect(summarizeStack(state).reason).toMatch(/^Held · dropping back in \d\.\d s$/)
  })
})
