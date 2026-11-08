import { describe, expect, it } from 'vitest'

import { BOARD_SIZE } from '../content/contracts.ts'

import { recipesForSale } from './crafting.ts'
import { createHero } from './roster.ts'
import { assertSaveData, newSave, parseSave, purseOf, serializeSave } from './save.ts'

/** Every hero field that was added after the first save format. */
const LATER_HERO_FIELDS = [
  'defeatedEnemyIds',
  'clearedNodeIds',
  'retreatAtMost',
  'specialAmmo',
  'carryGold',
  'craftXp',
  'legacy',
  'lives',
  'purchases',
  'claimedBonuses',
  'echoRank',
  'fightRank',
  'bossLossThisLife',
  'equipment',
  'purse',
  'packedSupplies',
  'pushOnHpPercent',
  'repeatRoute',
  'bagFullOrder',
  'repeatLimit',
  'awayRun',
  'routeReturns',
  'updates',
]

/** A save the way the very first version wrote it: wealth on the account, and none of the later fields. */
function oldestSave(): string {
  const made = createHero(newSave(), { name: 'Ash', race: 'human', classId: 'ranger' })
  if (!made.ok) throw new Error(made.reason)
  const raw = JSON.parse(serializeSave(made.save)) as { heroes: Record<string, unknown>[]; account: Record<string, unknown> } & Record<string, unknown>
  delete raw.lastSeenAt
  delete raw.account.milestones
  for (const hero of raw.heroes) for (const field of LATER_HERO_FIELDS) delete hero[field]
  Object.assign(raw.account, {
    gold: 140,
    materials: { hide: 4 },
    contracts: [{ contractId: 'cull-the-pack', progress: 2 }],
    craftQueue: [],
    craftCounter: 0,
    debt: 3,
    archive: [],
  })
  return JSON.stringify(raw)
}

describe('a save from the first version of the game', () => {
  it('loads, is valid, and gains every later field with a sensible default', () => {
    const parsed = parseSave(oldestSave())
    if (!parsed.ok) throw new Error(parsed.reason)
    const save = parsed.data
    expect(() => assertSaveData(save)).not.toThrow()
    expect(save.lastSeenAt).toBeNull()
    expect(save.account.milestones).toEqual([])
    expect(Object.keys(save.account).sort()).toEqual(['discoveries', 'milestones', 'recipes', 'slots'])

    const hero = save.heroes[0]!
    expect(hero).toMatchObject({
      clearedNodeIds: [],
      defeatedEnemyIds: [],
      retreatAtMost: 0.4,
      carryGold: 25,
      craftXp: 0,
      legacy: 0,
      lives: 0,
      echoRank: 0,
      fightRank: 0,
      bossLossThisLife: false,
      packedSupplies: [],
      pushOnHpPercent: 50,
      repeatRoute: true,
      bagFullOrder: 'home',
      repeatLimit: 0,
      awayRun: null,
      routeReturns: {},
    })
    expect(hero.updates).toEqual(['supply-rules', 'ranger-fade-back', 'contract-board', 'ward-charm-rule', 'warming-tonic-rule', 'crafted-supply-rules'])
    expect(hero.priorityRows.slice(0, 2).map((row) => row.skillId)).toEqual(['greater-draught', 'healing-draught'])
  })

  it('moves the old account wealth and contract onto the hero, and posts a full board', () => {
    const parsed = parseSave(oldestSave())
    if (!parsed.ok) throw new Error(parsed.reason)
    const purse = purseOf(parsed.data)
    expect(purse).toMatchObject({ gold: 140, materials: { hide: 4 }, debt: 3, supplies: {} })
    expect(purse.contracts).toEqual([{ contractId: 'cull-the-pack', progress: 2 }])
    expect(purse.board).toHaveLength(BOARD_SIZE)
    expect(purse.board[0]?.id).toBe('cull-the-pack')
  })

  it('reads the same after it is written back out and loaded again', () => {
    const first = parseSave(oldestSave())
    if (!first.ok) throw new Error(first.reason)
    const second = parseSave(serializeSave(first.data))
    if (!second.ok) throw new Error(second.reason)
    expect(second.data).toEqual(first.data)
  })
  it('has no Causeway data: undiscovered, no riftglass, no Salvage offer, and the new recipes locked', () => {
    const parsed = parseSave(oldestSave())
    if (!parsed.ok) throw new Error(parsed.reason)
    const save = parsed.data
    expect(save.account.discoveries).not.toContain('node:drowned-causeway')
    expect(save.account.discoveries).not.toContain('node:rift-hollows')
    expect(purseOf(save).materials.duskiron ?? 0).toBe(0)
    expect(save.account.discoveries.some((id) => id.startsWith('defeated:'))).toBe(false)
    expect(purseOf(save).materials.riftglass ?? 0).toBe(0)
    expect(purseOf(save).board.some((offer) => offer.target.kind === 'secure')).toBe(false)
    expect(save.account.recipes).not.toContain('siphoning')
    const rows = recipesForSale(save)
    expect(rows.filter((row) => row.locked !== null).map((row) => row.modifierId)).toEqual(['hallowed', 'rending', 'siphoning', 'stalwart', 'devout', 'bloodbound'])
    expect(Object.keys(save.account).sort()).toEqual(['discoveries', 'milestones', 'recipes', 'slots'])
  })
})
