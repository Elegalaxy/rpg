import { describe, expect, it } from 'vitest'

import { enemies } from '../content/enemies.ts'
import { skills } from '../content/skills.ts'
import { statuses } from '../content/statuses.ts'
import { NODE_SUNDERING_BLOW } from '../sim/classes/warriorAdjust.ts'
import { buildGuide } from './guide/guideIndex.ts'
import { effectLine, skillFacts } from './skillInfo.ts'

describe('skillFacts', () => {
  it('shows the base cooldown without the node and the node cooldown with it', () => {
    expect(skillFacts('sundering-blow')?.stats).toContain('Cooldown 6 s')
    expect(skillFacts('sundering-blow', [NODE_SUNDERING_BLOW])?.stats).toContain('Cooldown 5 s')
  })
})

describe('player-facing effect text has no artefacts', () => {
  const guide = buildGuide()
  const rawIds = new Set<string>()
  for (const id of [...Object.keys(skills), ...Object.keys(statuses), ...Object.keys(enemies)]) {
    if (/[-_A-Z]/.test(id)) rawIds.add(id)
  }
  for (const kind of ['damageReduction', 'telegraphWard', 'incomingDamage', 'applyStatus', 'skillDodge', 'armTrap', 'actionDelay', 'timedEvasion', 'chanceGate', 'defenseBonus', 'stealSupply', 'loseHp', 'twoHanded']) {
    rawIds.add(kind)
  }

  function artefacts(text: string, effectText = false): string[] {
    const found: string[] = []
    if (/(^|[^\d.])0(\.0+)?%/.test(text)) found.push('zero percent')
    if (/undefined|NaN|\bnull\b|\[object|\{|\}/.test(text)) found.push('placeholder')
    if (/\b0×/.test(text)) found.push('zero multiplier')
    if (/\band or\b/.test(text)) found.push('"and or"')
    if (effectText && /apply [a-z]|Removes (?!one of)[a-z]/.test(text)) found.push('lowercase status name')
    for (const id of rawIds) if (new RegExp(String.raw`(^|[^\w-])${id}([^\w-]|$)`).test(text)) found.push(`raw id ${id}`)
    if (text.trim() !== text || text.trim() === '') found.push('empty or padded')
    return found
  }

  it('every skill effect and stat line reads as plain text', () => {
    for (const id of Object.keys(skills)) {
      const facts = skillFacts(id)
      expect(facts, id).not.toBeNull()
      for (const line of [...(facts?.effects ?? []), ...(facts?.stats ?? [])]) expect(artefacts(line, true), `${id}: ${line}`).toEqual([])
      expect(new Set(facts?.effects).size, `${id} repeats a line`).toBe(facts?.effects.length)
    }
  })

  it('the Guide shows no artefacts in any entry', () => {
    for (const entry of guide) {
      const texts = [entry.title, entry.summary, ...entry.lines, ...entry.prose]
      for (const fact of entry.facts) {
        expect(fact.label.trim(), `${entry.id} has a fact with no label`).not.toBe('')
        texts.push(fact.value)
      }
      for (const text of texts.filter((text) => text !== '' || entry.section === 'statuses')) expect(artefacts(text), `${entry.id}: ${text}`).toEqual([])
    }
  })

  it('omits an effect that does nothing instead of printing zero', () => {
    expect(effectLine({ kind: 'heal', maxHpFraction: 0, healingCoefficient: 0 })).toBe('')
    expect(skillFacts('mend')?.effects[0]).toBe('Heals 1.2× healing power')
  })

  it('uses display names for statuses', () => {
    expect(skillFacts('sundering-blow')?.effects).toContain('100% base chance to apply Expose')
    expect(skillFacts('mend')?.effects).toContain('Removes one of Bleed or Poison')
    expect(skillFacts('reckless-strike')?.stats).toContain('Needs a two-handed weapon')
  })
})
