import { referenceHeroAtLevel } from '../content/heroes.ts'
import { gameDefs } from '../content/scenarios.ts'
import { startingRules } from '../content/supplies.ts'
import { HERO_CLASSES, type HeroClass } from '../sim/constants.ts'
import { createCombat, runCombat } from '../sim/combat.ts'
import { EQUIPMENT_SLOT_IDS, statBonusesFor, type Equipment, type EquipmentSlotId } from '../sim/economy.ts'
import { deriveSeed } from '../sim/rng.ts'
import type { HeroGear } from '../sim/stats.ts'
import type { CombatSetup } from '../sim/types.ts'

import { HARNESS_LIMIT_MS, MAX_BATCH_RUNS } from './batch.ts'
import { builtSetup } from './builds.ts'

/**
 * A realistic hero at the Fracture Gate (Step 12.4). The gate opens after both elites (levels 14 and
 * 16) fall, and the Warden is level 20 at Echo rank 0. A first life earns one skill point every third
 * level (the elites' Legacy points are not granted in code, so they are not counted). Gear is crafted
 * at an item level equal to the hero level (the most the equip rule allows), one modifier per piece,
 * and the same modifier counts at most twice. Attributes follow the reference split. Accessories carry
 * modifiers only. The backpack has 4 slots.
 */
export type WardenTier = {
  id: string
  label: string
  level: number
  /** Skill-web nodes, from the class's reference build order. */
  nodes: number
  /** Gear quality: 1 is 100%. Scrap 90-100%, hide 95-105%, shard 100-110%, upgrades add up to +2 points. */
  quality: number
  /** One modifier id per slot, or null for none. */
  modifiers: { readonly [slot in EquipmentSlotId]: string | null }
  /** Supply ids in the backpack. */
  supplies: readonly string[]
}

export const STARTER_MODIFIERS: WardenTier['modifiers'] = {
  mainHand: 'keen',
  offHand: 'precise',
  head: null,
  chest: null,
  hands: null,
  feet: null,
  accessory0: 'keen',
  accessory1: 'precise',
}

export const PREPARED_MODIFIERS: WardenTier['modifiers'] = {
  mainHand: 'piercing',
  offHand: 'precise',
  head: 'sturdy',
  chest: 'sturdy',
  hands: 'nimble',
  feet: 'nimble',
  accessory0: 'keen',
  accessory1: 'vicious',
}

export const WARDEN_TIERS: readonly WardenTier[] = [
  {
    id: 'arrived',
    label: 'Just arrived',
    level: 18,
    nodes: 6,
    quality: 1,
    modifiers: STARTER_MODIFIERS,
    supplies: ['healing-draught', 'healing-draught', 'ward-charm'],
  },
  {
    id: 'prepared',
    label: 'Well prepared',
    level: 20,
    nodes: 6,
    quality: 1.05,
    modifiers: PREPARED_MODIFIERS,
    supplies: ['healing-draught', 'healing-draught', 'healing-draught', 'ward-charm'],
  },
  {
    id: 'over',
    label: 'Over-levelled',
    level: 24,
    nodes: 8,
    quality: 1.1,
    modifiers: { ...PREPARED_MODIFIERS, accessory0: 'vicious', accessory1: 'quick' },
    supplies: ['healing-draught', 'healing-draught', 'healing-draught', 'ward-charm'],
  },
]

export type WardenRow = {
  classId: HeroClass
  tier: string
  winRate: number
  /** Mean share of the hero's maximum HP lost by the end of the fight, over every run. */
  hpLost: number
  /** Median fight time over every run in ms, wins and losses alike. */
  medianMs: number
  /** Mean share of the Warden's HP left at the end. */
  wardenLeft: number
  /** Mean supplies used per fight. */
  suppliesUsed: number
}

function scaleGear(gear: HeroGear, level: number, quality: number): HeroGear {
  const scale = <T extends { itemLevel: number; quality: number }>(piece: T): T => ({ ...piece, itemLevel: level, quality })
  return {
    mainHand: scale(gear.mainHand),
    offHand: gear.offHand === null ? null : scale(gear.offHand),
    head: scale(gear.head),
    chest: scale(gear.chest),
    hands: scale(gear.hands),
    feet: scale(gear.feet),
    accessories: [scale(gear.accessories[0]), scale(gear.accessories[1])],
  }
}

function modifierEquipment(modifiers: WardenTier['modifiers']): Equipment {
  const equipment: Equipment = {
    mainHand: null,
    offHand: null,
    head: null,
    chest: null,
    hands: null,
    feet: null,
    accessory0: null,
    accessory1: null,
  }
  for (const slot of EQUIPMENT_SLOT_IDS) {
    const id = modifiers[slot]
    if (id === null) continue
    equipment[slot] = { id: slot, baseId: slot, itemLevel: 1, quality: 1, durability: 100, maxDurability: 100, modifiers: [id] }
  }
  return equipment
}

/** The Warden fight for a class at a tier: the class's reference rules behind the starting supply rules. */
export function wardenSetup(classId: HeroClass, tier: WardenTier): CombatSetup {
  const base = builtSetup(`ref-${classId}-warden`, classId, tier.nodes)
  const reference = referenceHeroAtLevel(classId, tier.level)
  return {
    ...base,
    hero: {
      ...base.hero,
      level: tier.level,
      attributes: reference.attributes,
      gear: scaleGear(reference.gear, tier.level, tier.quality),
      statBonuses: statBonusesFor(modifierEquipment(tier.modifiers)),
      priorityRows: startingRules(base.hero.priorityRows ?? []),
      supplies: tier.supplies,
      ...(classId === 'ranger' ? { carriedSupplyCount: tier.supplies.length } : {}),
    },
  }
}

/** Every class at every tier against the rank-0 Fractured Warden. */
export function runWardenMatrix(seed: number, runs: number): WardenRow[] {
  if (!Number.isInteger(runs) || runs < 1 || runs > MAX_BATCH_RUNS) throw new Error(`runs must be an integer from 1 to ${MAX_BATCH_RUNS}, received ${runs}`)
  const defs = gameDefs()
  const rows: WardenRow[] = []
  for (const classId of HERO_CLASSES) {
    for (const tier of WARDEN_TIERS) {
      const setup = wardenSetup(classId, tier)
      let wins = 0
      let lost = 0
      let left = 0
      let used = 0
      const times: number[] = []
      for (let index = 0; index < runs; index += 1) {
        const state = runCombat(createCombat(setup, defs, deriveSeed(seed, index)), defs, HARNESS_LIMIT_MS)
        if (state.outcome === 'victory') wins += 1
        times.push(state.timeMs)
        lost += 1 - Math.max(0, state.hero.hp) / state.hero.maxHp
        const first = state.enemies[0]
        left += first === undefined ? 0 : first.hp / first.maxHp
        used += state.log.filter((event) => event.type === 'supplyUse').length
      }
      times.sort((a, b) => a - b)
      rows.push({
        classId,
        tier: tier.id,
        winRate: wins / runs,
        hpLost: lost / runs,
        medianMs: times[Math.floor(times.length / 2)] ?? 0,
        wardenLeft: left / runs,
        suppliesUsed: used / runs,
      })
    }
  }
  return rows
}

/** One line per class and tier: wins, mean HP lost, median fight time, Warden HP left, supplies used. */
export function formatWardenTable(rows: readonly WardenRow[]): string {
  const lines = rows.map((row) => {
    const time = `${(row.medianMs / 1000).toFixed(0)}s`
    return `${row.classId} ${row.tier}: wins ${Math.round(row.winRate * 100)}% | lost ${Math.round(row.hpLost * 100)}% | median ${time} | warden left ${Math.round(row.wardenLeft * 100)}% | supplies ${row.suppliesUsed.toFixed(1)}`
  })
  return `${lines.join('\n')}\n`
}
