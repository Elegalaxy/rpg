import { describe, expect, it } from 'vitest'

import { createCombat, stepCombat } from './combat.ts'
import { formatEvent } from './log.ts'
import type { HeroStatInput } from './stats.ts'
import type { CombatSetup, CombatState, EnemyDef, GameDefs, SkillDef } from './types.ts'

const ITEM_LEVEL = 20
const QUALITY = 1

function armor(slot: 'head' | 'chest' | 'hands' | 'feet') {
  return {
    id: `ref-heavy-${slot}`,
    slot,
    category: 'heavy' as const,
    itemLevel: ITEM_LEVEL,
    quality: QUALITY,
  }
}

function warriorSetup(loadout?: {
  equipped?: readonly string[]
  rows?: readonly { skillId: string }[]
}): CombatSetup {
  const hero: HeroStatInput & { id: string; name: string } = {
    id: 'ref-human-warrior',
    name: 'Warrior',
    level: 20,
    classId: 'warrior',
    attributes: { strength: 24, vitality: 22, agility: 16, intellect: 10, spirit: 16 },
    gear: {
      mainHand: { id: 'ref-one-handed', kind: 'oneHanded', itemLevel: ITEM_LEVEL, quality: QUALITY },
      offHand: { id: 'ref-shield', kind: 'shield', itemLevel: ITEM_LEVEL, quality: QUALITY },
      head: armor('head'),
      chest: armor('chest'),
      hands: armor('hands'),
      feet: armor('feet'),
      accessories: [
        { id: 'ref-accessory-a', itemLevel: ITEM_LEVEL, quality: QUALITY },
        { id: 'ref-accessory-b', itemLevel: ITEM_LEVEL, quality: QUALITY },
      ] as const,
    },
  }
  return {
    hero: { ...hero, equippedSkillIds: loadout?.equipped, priorityRows: loadout?.rows },
    enemies: [{ defId: 'dummy', slot: 0 }],
  }
}

function dummy(): EnemyDef {
  return {
    id: 'dummy',
    name: 'Dummy',
    level: 20,
    archetype: 'standard',
    school: 'physical',
    overrides: { maxHp: 1_000_000 },
  }
}

function makeSkill(overrides: Partial<SkillDef> & Pick<SkillDef, 'id' | 'effects'>): SkillDef {
  return {
    name: overrides.name ?? overrides.id,
    cost: 0,
    cooldownSeconds: 0,
    actionTimeCoefficient: 1,
    tags: ['test'],
    target: 'single',
    ...overrides,
  }
}

function defsFor(skillList: readonly SkillDef[]): GameDefs {
  const skills: GameDefs['skills'] = {}
  for (const skill of skillList) skills[skill.id] = skill
  const enemy = dummy()
  return { enemies: { [enemy.id]: enemy }, skills }
}

function untilAction(state: CombatState, defs: GameDefs): void {
  while (state.outcome === 'ongoing' && state.log.every((event) => event.type !== 'action')) {
    stepCombat(state, defs)
  }
}

describe('unconditional priority rows', () => {
  const paid = makeSkill({
    id: 'paid',
    name: 'Paid Strike',
    cost: 25,
    effects: [{ kind: 'damage', school: 'physical', coefficient: 1 }],
  })
  const twoHanded = makeSkill({
    id: 'heavy',
    name: 'Heavy Blow',
    requires: { mainHand: 'twoHanded' },
    effects: [{ kind: 'damage', school: 'physical', coefficient: 1 }],
  })
  const stored = makeSkill({
    id: 'stored',
    name: 'Stored Cut',
    effects: [{ kind: 'damage', school: 'physical', coefficient: 1 }],
  })
  const ready = makeSkill({
    id: 'ready',
    name: 'Ready Cut',
    effects: [{ kind: 'damage', school: 'physical', coefficient: 1.1 }],
  })

  it('uses the first eligible row and names every skipped row', () => {
    const defs = defsFor([paid, twoHanded, stored, ready])
    const state = createCombat(
      warriorSetup({
        equipped: [paid.id, twoHanded.id, ready.id],
        rows: [
          { skillId: paid.id },
          { skillId: twoHanded.id },
          { skillId: stored.id },
          { skillId: ready.id },
        ],
      }),
      defs,
      1,
    )
    untilAction(state, defs)
    const lines = state.log.map(formatEvent)
    console.log('[skills] priority choice', lines)
    expect(lines.some((line) => line.includes('skips row 1 Paid Strike (paid): unaffordable'))).toBe(true)
    expect(lines.some((line) => line.includes('skips row 2 Heavy Blow (heavy): requires twoHanded'))).toBe(true)
    expect(lines.some((line) => line.includes('skips row 3 Stored Cut (stored): not equipped'))).toBe(true)
    expect(lines.some((line) => line.includes('selects row 4 Ready Cut (ready)'))).toBe(true)
    const action = state.log.find((event) => event.type === 'action')
    expect(action).toMatchObject({ action: 'skill', skillId: 'ready' })
    expect(state.log.some((event) => event.type === 'hitRoll' && event.actorId === state.hero.id)).toBe(false)
  })

  it('reports only the first failure when a row fails more than one check', () => {
    const blocked = makeSkill({
      id: 'blocked',
      name: 'Blocked',
      cost: 40,
      cooldownSeconds: 8,
      requires: { offHand: 'focus' },
      effects: [{ kind: 'damage', school: 'physical', coefficient: 1 }],
    })
    const defs = defsFor([blocked])
    const state = createCombat(warriorSetup({ equipped: [], rows: [{ skillId: blocked.id }] }), defs, 1)
    state.hero.cooldowns[blocked.id] = 99_999
    untilAction(state, defs)
    const skips = state.log.filter((event) => event.type === 'priority' && event.decision === 'skip')
    console.log('[skills] first failure only', skips)
    expect(skips).toHaveLength(1)
    expect(skips[0]).toMatchObject({ skillId: 'blocked', reason: 'not equipped' })
  })

  it('falls back to a basic attack that still rolls to hit', () => {
    const defs = defsFor([paid])
    const state = createCombat(
      warriorSetup({ equipped: [paid.id], rows: [{ skillId: paid.id }] }),
      defs,
      1,
    )
    untilAction(state, defs)
    const lines = state.log.map(formatEvent)
    console.log('[skills] fallback', lines)
    expect(lines.some((line) => line.includes('skips row 1 Paid Strike (paid): unaffordable'))).toBe(true)
    expect(lines.some((line) => line.includes('uses a basic attack because no priority row was eligible'))).toBe(
      true,
    )
    expect(state.log.some((event) => event.type === 'action' && event.action === 'basicAttack')).toBe(true)
    expect(state.log.some((event) => event.type === 'hitRoll' && event.actorId === state.hero.id)).toBe(true)
  })

  it('rejects an unknown skill reference and a conditional row', () => {
    const defs = defsFor([ready])
    console.log('[skills] invalid references', { missing: 'missing', ready: ready.id })
    expect(() =>
      createCombat(warriorSetup({ equipped: ['missing'], rows: [] }), defs, 1),
    ).toThrow(/unknown skill 'missing'/)
    expect(() =>
      createCombat(warriorSetup({ equipped: [], rows: [{ skillId: 'missing' }] }), defs, 1),
    ).toThrow(/priority row 1 references unknown skill 'missing'/)
    expect(() =>
      createCombat(
        warriorSetup({
          equipped: [ready.id],
          rows: [{ skillId: ready.id, condition: 'hp' } as { skillId: string }],
        }),
        defs,
        1,
      ),
    ).toThrow(/priority row 1 must be \{ skillId \} with no conditions/)

    const poison = makeSkill({
      id: 'poisoned',
      effects: [{ kind: 'poison' } as unknown as SkillDef['effects'][number]],
    })
    expect(() =>
      createCombat(warriorSetup(), defsFor([poison]), 1),
    ).toThrow(/skill 'poisoned' has unknown effect kind 'poison'/)
  })
})
