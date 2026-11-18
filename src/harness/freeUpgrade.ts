import { encounters } from '../content/encounters.ts'
import { itemBase, newItem, starterEquipment } from '../content/items.ts'
import { gameDefs } from '../content/scenarios.ts'
import { selectedHero } from '../persist/character.ts'
import { CRAFT_MS, advanceCrafting, grantCraftingKit, queueInfuse, queueSocket, spendFreeUpgrade } from '../persist/crafting.ts'
import { createHero } from '../persist/roster.ts'
import { newSave, updatePurse, type SaveData } from '../persist/save.ts'
import { HERO_CLASSES, type HeroClass } from '../sim/constants.ts'
import { createCombat, runCombat } from '../sim/combat.ts'
import { EQUIPMENT_SLOT_IDS, gearFromEquipment, statBonusesFor, type Equipment, type EquipmentSlotId } from '../sim/economy.ts'
import { deriveSeed } from '../sim/rng.ts'
import type { CombatSetup } from '../sim/types.ts'

import { HARNESS_LIMIT_MS, MAX_BATCH_RUNS } from './batch.ts'
import { CAUSEWAY_FIGHTS } from './causeway.ts'
import { PREPARED_MODIFIERS, wardenSetup, type WardenTier } from './warden.ts'

/**
 * Free first-clear upgrades (Step 13.24 part 3b). A hero of level 10, 13, 16 or 17 with plain gear (one modifier
 * per piece, item level = hero level) against the same hero whose gear was upgraded with free tokens, built with
 * the persist code the game uses (`spendFreeUpgrade`, `queueInfuse`). A free socket opens an EMPTY socket with no
 * quality lift, so its combat value is the second modifier infused into it (scrap, the cheapest). The paid row
 * (riftglass socket, scrap infuse) is the reference. With `hard` every level meets the Causeway's seven fights (an under-levelled hero), where wins are not at 0 or 100%. Reads game code only; no design number is changed here.
 */
export const FREE_LEVELS = [10, 13, 16, 17] as const

/** Slots that can hold a second modifier (armor has only Sturdy and Nimble, both already at the stack cap). */
const SECOND: { readonly [slot in EquipmentSlotId]?: string } = { mainHand: 'vicious', offHand: 'mending', accessory0: 'quick', accessory1: 'keen' }
const SOCKET_ORDER: EquipmentSlotId[] = ['mainHand', 'offHand', 'accessory0', 'accessory1']
const RANK_ORDER: EquipmentSlotId[] = ['mainHand', 'accessory0', 'accessory1', 'offHand', 'head', 'chest', 'hands']

export type FreeStep = { kind: 'socket' | 'infuse' | 'rank' | 'paidSocket'; slot: EquipmentSlotId }

export type FreeRowDef = { id: string; label: string; tokens: number; steps: readonly FreeStep[] }

const sockets = (n: number): FreeStep[] => SOCKET_ORDER.slice(0, n).flatMap((slot): FreeStep[] => [{ kind: 'socket', slot }, { kind: 'infuse', slot }])
const ranks = (n: number): FreeStep[] => RANK_ORDER.slice(0, n).map((slot) => ({ kind: 'rank', slot }))

export const FREE_ROWS: readonly FreeRowDef[] = [
  { id: 'plain', label: 'Plain gear, one modifier per piece', tokens: 0, steps: [] },
  { id: 'free-socket-3', label: '3 free sockets + scrap infuse (weapon, off-hand, accessory)', tokens: 3, steps: sockets(3) },
  { id: 'free-socket-4', label: '4 free sockets + scrap infuse (every piece that can use a second modifier)', tokens: 4, steps: sockets(4) },
  { id: 'free-rank2-3', label: '3 free rank II (weapon, 2 accessories)', tokens: 3, steps: ranks(3) },
  { id: 'free-rank2-7', label: '7 free rank II (weapon, accessories, off-hand, head, chest, hands)', tokens: 7, steps: ranks(7) },
  { id: 'free-mix-7', label: '4 free sockets + scrap infuse, 3 free rank II', tokens: 7, steps: [...sockets(4), ...ranks(3)] },
  {
    id: 'paid-socket',
    label: 'Reference: paid riftglass socket + scrap infuse on the same 4 pieces',
    tokens: 0,
    steps: SOCKET_ORDER.flatMap((slot): FreeStep[] => [{ kind: 'paidSocket', slot }, { kind: 'infuse', slot }]),
  },
]

/** The fights at a hero level: the zone's own encounters up to level 16, the Causeway's seven at level 17. */
export function freeFights(level: number, hard = false): { id: string; enemies: CombatSetup['enemies'] }[] {
  if (level >= 17 || hard) return CAUSEWAY_FIGHTS.map((fight) => ({ id: fight.id, enemies: fight.enemies }))
  return ['grove-mixed', 'bastion-mixed', 'rootmaw-stalker', 'echo-knight'].map((id) => ({
    id,
    enemies: (encounters[id]?.members ?? []).map((member) => ({ defId: member.enemyId, slot: member.slot, level: member.level })),
  }))
}

function tierFor(level: number): WardenTier {
  return { id: `free-${level}`, label: `Level ${level}`, level, nodes: level >= 17 ? 6 : Math.floor(level / 3), quality: 1, modifiers: PREPARED_MODIFIERS, supplies: ['healing-draught', 'healing-draught'] }
}

function craftedEquipment(classId: HeroClass, level: number, row: FreeRowDef): Equipment {
  const made = createHero(newSave(), { name: 'Harness', race: 'human', classId })
  if (!made.ok) throw new Error(made.reason)
  const heroId = made.save.selectedHeroId
  if (heroId === null) throw new Error('no hero was created')
  const worn = starterEquipment(heroId, classId)
  const equipment: Equipment = { ...worn }
  for (const slot of EQUIPMENT_SLOT_IDS) {
    const item = worn[slot]
    const modifier = PREPARED_MODIFIERS[slot]
    if (item === null) continue
    equipment[slot] = { ...newItem(item.id, item.baseId, level, 1), modifiers: modifier === null ? [] : [modifier] }
  }
  const kit = grantCraftingKit(made.save)
  let save: SaveData = {
    ...kit,
    heroes: kit.heroes.map((hero) => (hero.id === heroId ? { ...hero, equipment, freeUpgrades: row.tokens, progress: { ...hero.progress, level } } : hero)),
  }
  save = updatePurse(save, { gold: 100_000, materials: { scrap: 1000, riftglass: 1000 } }, heroId)
  for (const step of row.steps) {
    const item = selectedHero(save)?.equipment[step.slot]
    if (item === null || item === undefined) throw new Error(`no item in ${step.slot}`)
    const result =
      step.kind === 'socket'
        ? spendFreeUpgrade(save, heroId, item.id, { kind: 'socket' })
        : step.kind === 'rank'
          ? spendFreeUpgrade(save, heroId, item.id, { kind: 'rank', index: 0 })
          : step.kind === 'paidSocket'
            ? queueSocket(save, heroId, item.id, 'riftglass')
            : queueInfuse(save, heroId, item.id, SECOND[step.slot] ?? '', 'scrap')
    if (!result.ok) throw new Error(`${row.id} ${step.kind} ${step.slot}: ${result.reason}`)
    save = advanceCrafting(result.save, CRAFT_MS).save
  }
  return selectedHero(save)?.equipment ?? equipment
}

/** The fight for a class, level and row: the reference hero of that level with the crafted gear swapped in. */
export function freeSetup(classId: HeroClass, level: number, row: FreeRowDef, enemies: CombatSetup['enemies']): CombatSetup {
  const base = wardenSetup(classId, tierFor(level))
  const crafted = craftedEquipment(classId, level, row)
  const crafts = gearFromEquipment(crafted, itemBase)
  const quality = <T extends { quality: number }>(piece: T, from: { quality: number } | null): T => ({ ...piece, quality: from?.quality ?? piece.quality })
  const gear = base.hero.gear
  return {
    ...base,
    enemies,
    hero: {
      ...base.hero,
      gear: {
        mainHand: quality(gear.mainHand, crafts.mainHand),
        offHand: gear.offHand === null ? null : quality(gear.offHand, crafts.offHand),
        head: quality(gear.head, crafts.head),
        chest: quality(gear.chest, crafts.chest),
        hands: quality(gear.hands, crafts.hands),
        feet: quality(gear.feet, crafts.feet),
        accessories: [quality(gear.accessories[0], crafts.accessories[0]), quality(gear.accessories[1], crafts.accessories[1])] as typeof gear.accessories,
      },
      statBonuses: statBonusesFor(crafted),
    },
  }
}

export type FreeRow = { classId: HeroClass; level: number; row: string; fight: string; winRate: number }

export function runFreeMatrix(seed: number, runs: number, levels: readonly number[] = FREE_LEVELS, hard = false): FreeRow[] {
  if (!Number.isInteger(runs) || runs < 1 || runs > MAX_BATCH_RUNS) throw new Error(`runs must be an integer from 1 to ${MAX_BATCH_RUNS}, received ${runs}`)
  const defs = gameDefs()
  const rows: FreeRow[] = []
  for (const level of levels) {
    for (const classId of HERO_CLASSES) {
      for (const row of FREE_ROWS) {
        for (const fight of freeFights(level, hard)) {
          const setup = freeSetup(classId, level, row, fight.enemies)
          let wins = 0
          for (let index = 0; index < runs; index += 1) {
            if (runCombat(createCombat(setup, defs, deriveSeed(seed, index)), defs, HARNESS_LIMIT_MS).outcome === 'victory') wins += 1
          }
          rows.push({ classId, level, row: row.id, fight: fight.id, winRate: wins / runs })
        }
      }
    }
  }
  return rows
}

/** One CSV line per level, class, row and fight (the report is aggregated over seeds by the reader). */
export function formatFreeCsv(rows: readonly FreeRow[]): string {
  return `${['level,class,row,fight,win_rate', ...rows.map((entry) => [entry.level, entry.classId, entry.row, entry.fight, entry.winRate.toFixed(4)].join(','))].join('\n')}\n`
}
