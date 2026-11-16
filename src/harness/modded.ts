import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { itemBase, newItem, starterEquipment } from '../content/items.ts'
import { gameDefs } from '../content/scenarios.ts'
import { selectedHero } from '../persist/character.ts'
import { CRAFT_MS, advanceCrafting, grantCraftingKit, queueInfuse, queueRankUp, queueSocket } from '../persist/crafting.ts'
import { createHero } from '../persist/roster.ts'
import { newSave, purseOf, updatePurse, type SaveData } from '../persist/save.ts'
import { HERO_CLASSES, type HeroClass } from '../sim/constants.ts'
import { createCombat, runCombat } from '../sim/combat.ts'
import { EQUIPMENT_SLOT_IDS, gearFromEquipment, statBonusesFor, type Equipment, type EquipmentSlotId } from '../sim/economy.ts'
import { deriveSeed } from '../sim/rng.ts'
import type { CombatSetup } from '../sim/types.ts'

import { HARNESS_LIMIT_MS, MAX_BATCH_RUNS } from './batch.ts'
import { CAUSEWAY_FIGHTS, CAUSEWAY_TIERS, type CausewayFight } from './causeway.ts'
import { PREPARED_MODIFIERS, wardenSetup, type WardenTier } from './warden.ts'

/**
 * The gold sinks at the Drowned Causeway (Step 13.16): sockets, ranks and tempers measured on a level-17
 * hero. Every row builds its gear with the persist crafting jobs the game uses (`queueSocket`,
 * `queueInfuse`, `queueRankUp`, `advanceCrafting`), so costs and effects come from the game's own code.
 * Rows `infuse-rift` and `stack-rift` (Step 13.17) use riftglass only, the grade-3 material a level-17 hero
 * can hold. The harness itself changes no design number and no earlier matrix; the rank and temper numbers
 * it measures come from `sim/economy.ts`.
 */
export const MODDED_LEVEL = 17

/** The base hero: level 17, one modifier on every piece (Prepared's set), 2 Healing Draughts. Items are level 17, quality 100%. */
export const MODDED_BASE: WardenTier = {
  id: 'modded',
  label: 'Level 17, one modifier per piece',
  level: MODDED_LEVEL,
  nodes: 6,
  quality: 1,
  modifiers: PREPARED_MODIFIERS,
  supplies: ['healing-draught', 'healing-draught'],
}

/**
 * Second modifiers for the pieces that can use one. Armor has only Sturdy and Nimble open at level 17
 * (Hauler's has no combat bonus) and both are already at the stack cap of 2, so armor is left out. Each id
 * is counted at most twice across the set.
 */
export const SECOND_MODIFIERS: { readonly [slot in EquipmentSlotId]?: string } = {
  mainHand: 'vicious',
  offHand: 'mending',
  accessory0: 'quick',
  accessory1: 'keen',
}

export type ModdedStep =
  | { kind: 'socket'; slot: EquipmentSlotId; materialId: string }
  | { kind: 'infuse'; slot: EquipmentSlotId; materialId: string }
  | { kind: 'rank'; slot: EquipmentSlotId; index: number; materialId: string }

export type ModdedRowDef = {
  id: string
  label: string
  /** The crafting jobs in order. Empty for the unmodified rows. */
  steps: readonly ModdedStep[]
  /** The tier's own modifiers (the Causeway "arrived" hero) instead of Prepared's set, built by `wardenSetup` untouched. */
  reference?: boolean
}

const SECOND_SLOTS = Object.keys(SECOND_MODIFIERS) as EquipmentSlotId[]
const sockets = (materialId: string): ModdedStep[] => SECOND_SLOTS.map((slot) => ({ kind: 'socket', slot, materialId }))
const infuses = (materialId: string): ModdedStep[] => SECOND_SLOTS.map((slot) => ({ kind: 'infuse', slot, materialId }))
/** One rank on every modifier the set holds (every slot, and index 1 where a second was infused). */
const ranks = (materialId: string, withSecond: boolean): ModdedStep[] =>
  EQUIPMENT_SLOT_IDS.flatMap((slot) => [
    { kind: 'rank', slot, index: 0, materialId } as const,
    ...(withSecond && SECOND_SLOTS.includes(slot) ? [{ kind: 'rank', slot, index: 1, materialId } as const] : []),
  ])

export const MODDED_ROWS: readonly ModdedRowDef[] = [
  { id: 'arrived', label: 'The Causeway "arrived" hero (reference)', steps: [], reference: true },
  { id: 'plain', label: 'Plain gear, one modifier per piece', steps: [] },
  { id: 'socket', label: 'Second modifier infused (riftglass socket, scrap infuse), weapon, off-hand, 2 accessories', steps: [...sockets('riftglass'), ...infuses('scrap')] },
  { id: 'rank2', label: 'Every modifier rank II (scrap)', steps: ranks('scrap', false) },
  { id: 'rank3', label: 'Every modifier rank III (II with scrap, III with riftglass)', steps: [...ranks('scrap', false), ...ranks('riftglass', false)] },
  { id: 'temper', label: 'Every modifier rank II, tempered at the top grade (cinderite)', steps: ranks('cinderite', false) },
  { id: 'rank3-top', label: 'Every modifier rank III, top grade (cinderite twice)', steps: [...ranks('cinderite', false), ...ranks('cinderite', false)] },
  {
    id: 'stack',
    label: 'Everything: cinderite sockets and infuses, then every modifier rank III with cinderite',
    steps: [...sockets('cinderite'), ...infuses('cinderite'), ...ranks('cinderite', true), ...ranks('cinderite', true)],
  },
  { id: 'infuse-rift', label: 'Second modifier infused, riftglass socket and riftglass infuse', steps: [...sockets('riftglass'), ...infuses('riftglass')] },
  {
    id: 'stack-rift',
    label: 'Everything with riftglass only: sockets and infuses, then every modifier rank III (II and III with riftglass)',
    steps: [...sockets('riftglass'), ...infuses('riftglass'), ...ranks('riftglass', true), ...ranks('riftglass', true)],
  },
]

export type Crafted = {
  equipment: Equipment
  gold: number
  materials: { readonly [materialId: string]: number }
}

/** The worn set for a class after a row's jobs, made by the persist crafting code, with what it cost. */
export function craftedEquipment(classId: HeroClass, row: ModdedRowDef): Crafted {
  const made = createHero(newSave(), { name: 'Harness', race: 'human', classId })
  if (!made.ok) throw new Error(made.reason)
  const kit = grantCraftingKit(made.save)
  const heroId = made.save.selectedHeroId ?? kit.heroes[0]?.id
  if (heroId === undefined || heroId === null) throw new Error('no hero was created')
  const worn = starterEquipment(heroId, classId)
  const equipment: Equipment = { ...worn }
  for (const slot of EQUIPMENT_SLOT_IDS) {
    const item = worn[slot]
    const modifier = MODDED_BASE.modifiers[slot]
    if (item === null) continue
    equipment[slot] = { ...newItem(item.id, item.baseId, MODDED_LEVEL, MODDED_BASE.quality), modifiers: modifier === null ? [] : [modifier] }
  }
  const rich = 100_000
  const stock = Object.fromEntries(Object.keys(purseOf(kit, heroId).materials).map((id) => [id, 1000]))
  let save: SaveData = {
    ...kit,
    heroes: kit.heroes.map((hero) => (hero.id === heroId ? { ...hero, equipment, progress: { ...hero.progress, level: MODDED_LEVEL } } : hero)),
  }
  save = updatePurse(save, { gold: rich, materials: stock }, heroId)
  const start = purseOf(save, heroId)
  for (const step of row.steps) {
    const item = selectedHero(save)?.equipment[step.slot]
    if (item === null || item === undefined) throw new Error(`no item in ${step.slot}`)
    const queued =
      step.kind === 'socket'
        ? queueSocket(save, heroId, item.id, step.materialId)
        : step.kind === 'infuse'
          ? queueInfuse(save, heroId, item.id, SECOND_MODIFIERS[step.slot] ?? '', step.materialId)
          : queueRankUp(save, heroId, item.id, step.index, step.materialId)
    if (!queued.ok) throw new Error(`${row.id} ${step.kind} ${step.slot}: ${queued.reason}`)
    save = advanceCrafting(queued.save, CRAFT_MS).save
  }
  const end = purseOf(save, heroId)
  const spent: { [materialId: string]: number } = {}
  for (const [id, before] of Object.entries(start.materials)) {
    const used = before - (end.materials[id] ?? 0)
    if (used > 0) spent[id] = used
  }
  return { equipment: selectedHero(save)?.equipment ?? equipment, gold: start.gold - end.gold, materials: spent }
}

/** The fight for a class at a row: the Causeway "arrived" hero with the crafted gear swapped in. */
export function moddedSetup(classId: HeroClass, row: ModdedRowDef, fight: CausewayFight, crafted: Crafted = craftedEquipment(classId, row)): CombatSetup {
  if (row.reference === true) return { ...wardenSetup(classId, CAUSEWAY_TIERS[0]!), enemies: fight.enemies }
  const base = wardenSetup(classId, MODDED_BASE)
  const crafts = gearFromEquipment(crafted.equipment, itemBase)
  // The reference gear keeps its kinds; only the quality a socket lifted comes from the crafted pieces.
  const quality = <T extends { quality: number }>(piece: T, from: { quality: number } | null): T => ({ ...piece, quality: from?.quality ?? piece.quality })
  const gear = base.hero.gear
  const hero = {
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
    statBonuses: statBonusesFor(crafted.equipment),
  }
  return { ...base, hero, enemies: fight.enemies }
}

export type ModdedRow = {
  classId: HeroClass
  row: string
  fight: string
  winRate: number
  /** Mean share of the hero's maximum HP left at the end of the fight, over every run (0 after a defeat). */
  hpLeft: number
  /** Median fight time over every run in ms. */
  medianMs: number
}

export type ModdedCost = { classId: HeroClass; row: string; gold: number; materials: string }

export type ModdedReport = { rows: ModdedRow[]; costs: ModdedCost[] }

const formatMaterials = (materials: Crafted['materials']): string =>
  Object.entries(materials)
    .map(([id, quantity]) => `${id} ${quantity}`)
    .join(' ')

/** Every class on every row against every Causeway fight (telegraph rules on). */
export function runModdedMatrix(seed: number, runs: number): ModdedReport {
  if (!Number.isInteger(runs) || runs < 1 || runs > MAX_BATCH_RUNS) throw new Error(`runs must be an integer from 1 to ${MAX_BATCH_RUNS}, received ${runs}`)
  const defs = gameDefs()
  const rows: ModdedRow[] = []
  const costs: ModdedCost[] = []
  for (const classId of HERO_CLASSES) {
    for (const row of MODDED_ROWS) {
      const crafted = craftedEquipment(classId, row)
      costs.push({ classId, row: row.id, gold: crafted.gold, materials: formatMaterials(crafted.materials) })
      for (const fight of CAUSEWAY_FIGHTS) {
        const setup = moddedSetup(classId, row, fight, crafted)
        let wins = 0
        let left = 0
        const times: number[] = []
        for (let index = 0; index < runs; index += 1) {
          const state = runCombat(createCombat(setup, defs, deriveSeed(seed, index)), defs, HARNESS_LIMIT_MS)
          if (state.outcome === 'victory') wins += 1
          times.push(state.timeMs)
          left += Math.max(0, state.hero.hp) / state.hero.maxHp
        }
        times.sort((a, b) => a - b)
        rows.push({ classId, row: row.id, fight: fight.id, winRate: wins / runs, hpLeft: left / runs, medianMs: times[Math.floor(times.length / 2)] ?? 0 })
      }
    }
  }
  return { rows, costs }
}

export type ModdedSummary = { classId: HeroClass; row: string; meanWin: number; fightsWon: number; meanHpLeft: number }

/** Per class and row: mean win rate over the fights, expected fights won (of 7), mean HP left. */
export function summarizeModded(rows: readonly ModdedRow[]): ModdedSummary[] {
  const out: ModdedSummary[] = []
  for (const classId of HERO_CLASSES) {
    for (const def of MODDED_ROWS) {
      const own = rows.filter((entry) => entry.classId === classId && entry.row === def.id)
      if (own.length === 0) continue
      const wins = own.reduce((sum, entry) => sum + entry.winRate, 0)
      out.push({ classId, row: def.id, meanWin: wins / own.length, fightsWon: wins, meanHpLeft: own.reduce((sum, entry) => sum + entry.hpLeft, 0) / own.length })
    }
  }
  return out
}

/** One line per class and row with a cell per fight, then the summary and the cost of the row. */
export function formatModdedTable(report: ModdedReport): string {
  const lines: string[] = []
  const summary = summarizeModded(report.rows)
  for (const classId of HERO_CLASSES) {
    for (const def of MODDED_ROWS) {
      const cells = report.rows
        .filter((entry) => entry.classId === classId && entry.row === def.id)
        .map((entry) => `${entry.fight} ${Math.round(entry.winRate * 100)}% (left ${Math.round(entry.hpLeft * 100)}%)`)
      if (cells.length === 0) continue
      const total = summary.find((entry) => entry.classId === classId && entry.row === def.id)
      const cost = report.costs.find((entry) => entry.classId === classId && entry.row === def.id)
      const head = total === undefined ? '' : ` [won ${total.fightsWon.toFixed(2)}/${cells.length} fights, mean win ${Math.round(total.meanWin * 100)}%, HP left ${Math.round(total.meanHpLeft * 100)}%]`
      const price = cost === undefined || cost.gold === 0 ? '' : ` cost ${cost.gold} gold, ${cost.materials}`
      lines.push(`${classId} ${def.id}:${head}${price}\n  ${cells.join(' | ')}`)
    }
  }
  return `${lines.join('\n')}\n`
}

/** The matrix as CSV, one line per class, row and fight. */
export function formatModdedCsv(report: ModdedReport): string {
  const header = 'class,row,fight,win_rate,hp_left,median_ms'
  const lines = report.rows.map((entry) => [entry.classId, entry.row, entry.fight, entry.winRate.toFixed(4), entry.hpLeft.toFixed(4), entry.medianMs].join(','))
  return `${[header, ...lines].join('\n')}\n`
}

export function writeModdedCsv(path: string, csv: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(resolve(path), csv, 'utf8')
}
