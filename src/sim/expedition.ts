import { ADVANTAGE_MAXIMUM, ADVANTAGE_RESOURCE_ID } from './classes/assassin.ts'
import { FAITH_MAXIMUM, FAITH_RESOURCE_ID, FAITH_START } from './classes/cleric.ts'
import { MANA_MAXIMUM, MANA_RESOURCE_ID, MANA_TRAVEL_REGEN_PER_SECOND } from './classes/mage.ts'
import { encounterRestoreCount, manaRegenFactor, restoreChargeText } from './classes/mageAdjust.ts'
import {
  READINESS_MAXIMUM,
  READINESS_RESOURCE_ID,
  READINESS_TRAVEL_PER_SECOND,
  TRAPPER_RECHARGE_ENCOUNTERS,
  pressTrailEscapePoints,
  pressTrailReadiness,
  travelReadinessFactor,
} from './classes/ranger.ts'
import { spiritResourceFactor } from './classes/resources.ts'
import {
  FURY_DRAIN_PER_SECOND,
  FURY_DRAIN_WAIT_SECONDS,
  FURY_MAXIMUM,
  FURY_RESOURCE_ID,
} from './classes/warrior.ts'
import { createCombat, runCombat, stepCombat } from './combat.ts'
import { HERO_CLASSES, REGEN_PER_VITALITY, STEP_MS, type HeroClass } from './constants.ts'
import { setupRaceMeters, storeRaceMeters } from './races/carry.ts'
import { FEROCITY_CAP } from './races/beastfolk.ts'
import { FOCUS_MAX } from './races/elf.ts'
import { readRace } from './races/index.ts'
import { createRng, deriveSeed, nextFloat, type RngState } from './rng.ts'
import { xpFromEnemies } from './progression.ts'
import { longHuntRegenFactor } from './races/beastfolk.ts'
import { humanOrdinaryXp } from './races/human.ts'
import {
  CURSE_SOUL_DEBT,
  NODE_BEAST_THICK_HIDE,
  NODE_UNDEAD_CURSEBOUND,
  SOUL_DEBT_FEE,
  THICK_HIDE_REGEN,
} from './races/racialNodes.ts'
import { deriveHeroStats, type HeroGear } from './stats.ts'
import type { CombatHeroSetup, CombatOutcome, CombatSetup, CombatState, EscapeEvent, GameDefs } from './types.ts'

export type ExpeditionEnemy = {
  defId: string
  slot: number
  level: number
  /** Copied from content so the sim does not import it. Omitted enemies drop nothing. */
  materialId?: string
  /** Quantity before momentum. Present only when `materialId` is set. */
  baseQuantity?: number
  /** Gold this enemy adds to the gold the hero carries when it is defeated. Omitted drops none. */
  gold?: number
}

export type LootStack = {
  materialId: string
  quantity: number
}

export type ExpeditionEncounterDef = {
  id: string
  enemies: readonly ExpeditionEnemy[]
}

/** Automatic retreat check. `atMost` is a fraction of maximum HP. 0.4 is 40%. */
export type RetreatThreshold = {
  kind: 'hpFraction'
  atMost: number
}

/** Plain data for one road. The harness fills this from content. The state keeps a copy. */
export type ExpeditionBlueprint = {
  id: string
  opening: readonly ExpeditionEncounterDef[]
  draw: readonly ExpeditionEncounterDef[]
  travelGapMs: number
  /** Empty means the road never attempts escape. */
  retreatThresholds: readonly RetreatThreshold[]
  hero: CombatHeroSetup
  /** Carried gold at the start. Omitted means 0. */
  carriedGold?: number
  /** Deposited gold at the start. Omitted means 0. */
  depositedGold?: number
}

export const EQUIPMENT_SLOTS = [
  'mainHand',
  'offHand',
  'head',
  'chest',
  'hands',
  'feet',
  'accessory0',
  'accessory1',
] as const
export type ExpeditionEquipmentSlot = (typeof EQUIPMENT_SLOTS)[number]

/** Durability for one equipped piece. It is not a field on the gear piece and combat does not read it. */
export type ExpeditionEquipment = {
  slot: ExpeditionEquipmentSlot
  itemId: string
  durability: number
  maxDurability: number
  disabled: boolean
}

/** One supply slot. Null is empty. An item is only its id. */
export type SupplySlot = { id: string } | null

export const SPLINTERED_ROAD_ID = 'splintered-road'
/** Every route an expedition can follow. The Road alone is the original; the rest add a branch or the Gate. */
export const EXPEDITION_IDS = [
  SPLINTERED_ROAD_ID,
  'withered-grove',
  'fallen-bastion',
  'fracture-via-grove',
  'fracture-via-bastion',
] as const
export type ExpeditionId = (typeof EXPEDITION_IDS)[number]

export function isExpeditionId(value: unknown): value is ExpeditionId {
  return typeof value === 'string' && (EXPEDITION_IDS as readonly string[]).includes(value)
}
/** Ordinary journey, including the walk out of town before the first fight. A return uses this same length. */
export const TRAVEL_GAP_MS = 20_000
export const MOMENTUM_CAP = 5
export const LOOT_CAPACITY = 20
export const SUPPLY_SLOT_COUNT = 4
/** Stored rare-node chance, in percentage points. The road does not roll or spawn a node. */
export const RARE_NODE_CHANCE_PER_STACK = 2
/** +5% material quantity per stack already held. Counted in thousandths so 4 × 1.15 is 4.6. */
export const MATERIAL_BONUS_THOUSANDTHS_PER_STACK = 50
/** Escape chance before Agility. Supplies, zone, and momentum add 0 on top of this. */
export const ESCAPE_BASE_PERCENT = 50
/** Added chance is `floor(Agility / 5)` percentage points, and it cannot exceed this. */
export const ESCAPE_AGILITY_CAP = 20
/** A failed escape waits this long on the fight clock before another roll. */
export const ESCAPE_RETRY_MS = 8_000
/** Each equipped piece starts here. Combat stats do not read it. */
export const EQUIPMENT_DURABILITY_MAX = 100
/** Subtracted from every equipped piece on defeat, and the result stops at 0. */
export const DEFEAT_DURABILITY_LOSS = 10
/** Paid from carried gold on defeat. The unpaid part is added to debt. */
export const RESCUE_FEE = 25
/** Stored wait after defeat. This expedition does not tick it down. */
export const DEFEAT_RECOVERY_MS = 300_000
const ESCAPE_SUPPLIES_BONUS = 0
const ESCAPE_ZONE_BONUS = 0
const ESCAPE_MOMENTUM_BONUS = 0

export const MOMENTUM_RESET_REASONS = ['return', 'retreat', 'defeat', 'reincarnation'] as const
export type MomentumResetReason = (typeof MOMENTUM_RESET_REASONS)[number]

export type ExpeditionEncounterRecord = {
  index: number
  encounterId: string
  seed: number
  outcome: Exclude<CombatOutcome, 'ongoing'> | 'retreat'
  durationMs: number
}

export type CarriedHero = {
  classId: HeroClass
  hp: number
  maxHp: number
  vitality: number
  spirit: number
  classResource: number
  classResourceId: string
  classResourceMax: number
  resourceFraction: number
  specialAmmo: number
  vow: string | null
  /** Elf Focus carried between fights. Other races leave this at 0. */
  focus: number
  /** Special arrows fired this expedition. Efficient Quiver reads it. Others leave it at 0. */
  specialArrowCount: number
  /** Undead Soul Fragments held this expedition. Omitted is 0. Town, retreat, and defeat clear them. */
  souls?: number
  /** Mage prepared-spell charges as JSON. Omitted or null means full. Town restores them. */
  mageCharges?: string | null
}

export type ExpeditionState = {
  id: ExpeditionId
  seed: number
  classId: HeroClass
  outcome: 'ongoing' | 'defeat' | 'returned'
  phase: 'travel' | 'combat'
  /** Milliseconds already spent in the current travel segment. */
  travelMs: number
  /** Length of each gap. The road uses 20 seconds. A test may shorten the current gap. */
  travelGapMs: number
  encounterIndex: number
  /** Fixed fights. Indexes past this list roll `draw`. Copied so a resume does not need content. */
  opening: ExpeditionEncounterDef[]
  /** Equal-draw order. Index is `Math.floor(nextFloat * length)`. */
  draw: ExpeditionEncounterDef[]
  /** Skills, gear, and vow for every fight. HP and meters come from `hero`. */
  heroTemplate: CombatHeroSetup
  rng: RngState
  hero: CarriedHero
  combat: CombatState | null
  /** Enemies keep the blueprint drop. The fight was already chosen, so a resume does not roll again. */
  current: { index: number; encounterId: string; seed: number; enemies: ExpeditionEnemy[] } | null
  history: ExpeditionEncounterRecord[]
  /** 0–5. A regular victory adds 1 and an elite victory adds 2, after that fight's drop. A defeat sets this to 0. */
  momentum: number
  /** Percentage points, 2 per momentum stack. Arrival, defeat, and `resetMomentum` set this back to 0. */
  rareNodeChance: number
  /** Beastfolk Ferocity progress, 0–6. Not a combat resource. */
  ferocityProgress: number
  /** Hero XP from fights won on this expedition. Added to the hero when the run is settled. Omitted is 0. */
  xpEarned?: number
  /** Encounters remaining before Trapper may deploy. 0 is ready. A new expedition starts ready. */
  trapperCooldown: number
  /** Materials carried on the road. Total quantity is at most `LOOT_CAPACITY`. A defeat clears this. */
  unsecured: LootStack[]
  /** Materials moved here when the return walk arrives. A defeat leaves this in place. */
  secured: LootStack[]
  /** Quantity that did not fit. Older stacks stay. A defeat leaves this in place. */
  overflow: number
  /** Four slots. Each is null or a carried item. A defeat leaves them in place. */
  supplySlots: SupplySlot[]
  /** Item ids already used. A defeat leaves them in place. */
  consumedSupplyIds: string[]
  /** Gold the hero is carrying. The rescue fee is paid from this. */
  carriedGold: number
  /** Gold left in town. A defeat does not spend it. */
  depositedGold: number
  /** Unpaid rescue fees. Stored only: no interest, and it blocks nothing. */
  debt: number
  /** Wait before the next expedition, in milliseconds. Set on defeat and not ticked here. */
  recoveryMs: number
  /** True after a defeat to a non-summon boss. No boss-progress counter is stored. */
  bossLossThisLife: boolean
  /** Equipped pieces in slot order. Durability is not read by combat stats. */
  equipment: ExpeditionEquipment[]
  /** True during the 20-second walk back to town. */
  returning: boolean
  /** Copied from the blueprint so a resume keeps the same checks. */
  retreatThresholds: RetreatThreshold[]
  /**
   * Combat time when another escape roll is allowed.
   * Null rolls on the next step that still meets a threshold.
   * Rising above the threshold does not clear it.
   */
  escapeRetryMs: number | null
  /** Every escape attempt on this road. The fight log is cleared when combat ends. */
  escapeLog: EscapeEvent[]
}

function describeValue(value: unknown): string {
  if (typeof value === 'number' && Number.isNaN(value)) return 'NaN'
  if (typeof value === 'string') return JSON.stringify(value)
  if (value === undefined) return 'undefined'
  return String(value)
}

function assertClassId(classId: unknown): asserts classId is HeroClass {
  if (typeof classId !== 'string' || !(HERO_CLASSES as readonly string[]).includes(classId)) {
    throw new Error(`unknown hero class ${describeValue(classId)}`)
  }
}

function assertCombatLimit(limit: number): void {
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 0) {
    throw new Error(`combat limit must be an integer of at least 0, received ${describeValue(limit)}`)
  }
}

export function assertExpedition(state: ExpeditionState): void {
  if (typeof state !== 'object' || state === null) {
    throw new Error(`expedition state must be an object, received ${describeValue(state)}`)
  }
  if (!isExpeditionId(state.id)) {
    throw new Error(`unknown expedition ${describeValue(state.id)}; valid expeditions: ${EXPEDITION_IDS.join(', ')}`)
  }
  if (state.outcome !== 'ongoing' && state.outcome !== 'defeat' && state.outcome !== 'returned') {
    throw new Error(`expedition outcome is unknown, received ${describeValue(state.outcome)}`)
  }
  if (state.phase !== 'travel' && state.phase !== 'combat') {
    throw new Error(`expedition phase is unknown, received ${describeValue(state.phase)}`)
  }
  if (typeof state.travelMs !== 'number' || !Number.isInteger(state.travelMs) || state.travelMs < 0) {
    throw new Error(`travel time must be an integer of at least 0, received ${describeValue(state.travelMs)}`)
  }
  if (typeof state.travelGapMs !== 'number' || !Number.isInteger(state.travelGapMs) || state.travelGapMs < 0) {
    throw new Error(`travel gap must be an integer of at least 0, received ${describeValue(state.travelGapMs)}`)
  }
  if (
    typeof state.encounterIndex !== 'number' ||
    !Number.isInteger(state.encounterIndex) ||
    state.encounterIndex < 0
  ) {
    throw new Error(
      `encounter index must be an integer of at least 0, received ${describeValue(state.encounterIndex)}`,
    )
  }
  if (!Array.isArray(state.history)) throw new Error('expedition history is missing')
  if (!Array.isArray(state.opening)) throw new Error('expedition opening encounters are missing')
  if (!Array.isArray(state.draw)) throw new Error('expedition draw encounters are missing')
  if (typeof state.heroTemplate !== 'object' || state.heroTemplate === null) {
    throw new Error('expedition hero template is missing')
  }
  if (typeof state.hero !== 'object' || state.hero === null) throw new Error('expedition hero is missing')
  assertClassId(state.classId)
  if (state.current !== null) {
    if (typeof state.current !== 'object' || !Array.isArray(state.current.enemies)) {
      throw new Error('expedition encounter enemies are missing')
    }
  }
  if (
    typeof state.momentum !== 'number' ||
    !Number.isInteger(state.momentum) ||
    state.momentum < 0 ||
    state.momentum > MOMENTUM_CAP
  ) {
    throw new Error(`momentum must be an integer from 0 through ${MOMENTUM_CAP}, received ${describeValue(state.momentum)}`)
  }
  if (
    typeof state.hero.focus !== 'number' ||
    !Number.isFinite(state.hero.focus) ||
    state.hero.focus < 0 ||
    state.hero.focus > FOCUS_MAX
  ) {
    throw new Error(`focus must be from 0 through ${FOCUS_MAX}, received ${describeValue(state.hero.focus)}`)
  }
  if (
    typeof state.hero.specialArrowCount !== 'number' ||
    !Number.isInteger(state.hero.specialArrowCount) ||
    state.hero.specialArrowCount < 0
  ) {
    throw new Error(
      `special arrow count must be a whole number of at least 0, received ${describeValue(state.hero.specialArrowCount)}`,
    )
  }
  if (
    typeof state.trapperCooldown !== 'number' ||
    !Number.isInteger(state.trapperCooldown) ||
    state.trapperCooldown < 0
  ) {
    throw new Error(
      `trapper cooldown must be a whole number of at least 0, received ${describeValue(state.trapperCooldown)}`,
    )
  }
  if (
    typeof state.ferocityProgress !== 'number' ||
    !Number.isInteger(state.ferocityProgress) ||
    state.ferocityProgress < 0 ||
    state.ferocityProgress > FEROCITY_CAP
  ) {
    throw new Error(
      `ferocity progress must be an integer from 0 through ${FEROCITY_CAP}, received ${describeValue(state.ferocityProgress)}`,
    )
  }
  if (state.rareNodeChance !== state.momentum * RARE_NODE_CHANCE_PER_STACK) {
    throw new Error(
      `rare-node chance must be ${RARE_NODE_CHANCE_PER_STACK} points per momentum stack, received momentum ${state.momentum} and chance ${describeValue(state.rareNodeChance)}`,
    )
  }
  assertLoot(state.unsecured, 'unsecured loot', true)
  assertLoot(state.secured, 'secured loot', false)
  if (typeof state.overflow !== 'number' || !Number.isInteger(state.overflow) || state.overflow < 0) {
    throw new Error(`loot overflow must be an integer of at least 0, received ${describeValue(state.overflow)}`)
  }
  assertSupplySlots(state.supplySlots)
  assertIdList(state.consumedSupplyIds, 'consumed supply')
  nonNegativeInteger(state.carriedGold, 'carried gold')
  nonNegativeInteger(state.depositedGold, 'deposited gold')
  nonNegativeInteger(state.debt, 'debt')
  if (state.xpEarned !== undefined) nonNegativeInteger(state.xpEarned, 'experience earned')
  nonNegativeInteger(state.recoveryMs, 'recovery')
  if (typeof state.bossLossThisLife !== 'boolean') {
    throw new Error(`boss loss must be a boolean, received ${describeValue(state.bossLossThisLife)}`)
  }
  assertEquipment(state.equipment)
  if (typeof state.returning !== 'boolean') {
    throw new Error(`returning must be a boolean, received ${describeValue(state.returning)}`)
  }
  copyThresholds(state.retreatThresholds)
  if (state.escapeRetryMs !== null) {
    if (typeof state.escapeRetryMs !== 'number' || !Number.isInteger(state.escapeRetryMs) || state.escapeRetryMs < 0) {
      throw new Error(
        `escape retry must be an integer of at least 0, received ${describeValue(state.escapeRetryMs)}`,
      )
    }
  }
  if (!Array.isArray(state.escapeLog)) throw new Error('escape log is missing')
  for (const event of state.escapeLog) {
    if (typeof event !== 'object' || event === null || event.type !== 'escape') {
      throw new Error(`escape log entry must be an escape event, received ${describeValue(event)}`)
    }
  }
}

function assertLoot(stacks: unknown, label: string, capped: boolean): void {
  if (!Array.isArray(stacks)) throw new Error(`${label} is missing`)
  const seen: { [materialId: string]: boolean } = {}
  let total = 0
  for (const stack of stacks) {
    if (typeof stack !== 'object' || stack === null) throw new Error(`${label} entry is missing`)
    const materialId: unknown = stack.materialId
    const quantity: unknown = stack.quantity
    if (typeof materialId !== 'string' || materialId.length === 0) {
      throw new Error(`${label} is missing a material`)
    }
    if (seen[materialId] === true) throw new Error(`${label} duplicates '${materialId}'`)
    seen[materialId] = true
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) {
      throw new Error(`${label} quantity must be a positive integer, received ${describeValue(quantity)}`)
    }
    total += quantity
  }
  if (capped && total > LOOT_CAPACITY) {
    throw new Error(`${label} holds ${total}, above the capacity of ${LOOT_CAPACITY}`)
  }
}

/**
 * Half-up of `0.05 × VIT` for one second.
 * `(VIT + 10) / 20` is that product when the rate is exactly 0.05, without a binary 0.05.
 */
export function hpRegenPerSecond(vitality: number, factor = 1): number {
  if (typeof vitality !== 'number' || !Number.isFinite(vitality) || vitality < 0) {
    throw new Error(`vitality must be at least 0, received ${describeValue(vitality)}`)
  }
  if (REGEN_PER_VITALITY !== 0.05) {
    throw new Error(`out-of-combat HP regen must be 0.05 × VIT, received ${REGEN_PER_VITALITY}`)
  }
  if (factor === 1) return Math.floor((vitality + 10) / 20)
  return Math.floor(((vitality + 10) * Math.round(factor * 1000)) / 20_000)
}

function capMeter(amount: number, maximum: number): number {
  if (amount < 0) return 0
  if (amount > maximum) return maximum
  return amount
}

function initialMeter(classId: HeroClass): { id: string; maximum: number; amount: number } {
  switch (classId) {
    case 'warrior':
      return { id: FURY_RESOURCE_ID, maximum: FURY_MAXIMUM, amount: 0 }
    case 'assassin':
      return { id: ADVANTAGE_RESOURCE_ID, maximum: ADVANTAGE_MAXIMUM, amount: 0 }
    case 'ranger':
      // Town Readiness is 0. A 20-second walk fills it. The Q4 value of 100 is that full meter.
      return { id: READINESS_RESOURCE_ID, maximum: READINESS_MAXIMUM, amount: 0 }
    case 'mage':
      return { id: MANA_RESOURCE_ID, maximum: MANA_MAXIMUM, amount: MANA_MAXIMUM }
    case 'cleric':
      return { id: FAITH_RESOURCE_ID, maximum: FAITH_MAXIMUM, amount: FAITH_START }
    default: {
      const unexpected: never = classId
      throw new Error(`unknown hero class ${String(unexpected)}`)
    }
  }
}

function copyEnemy(enemy: ExpeditionEnemy, label: string): ExpeditionEnemy {
  if (typeof enemy !== 'object' || enemy === null) throw new Error(`${label} is missing`)
  if (typeof enemy.defId !== 'string' || enemy.defId.length === 0) {
    throw new Error(`${label} is missing an enemy id`)
  }
  if (typeof enemy.slot !== 'number' || !Number.isInteger(enemy.slot) || enemy.slot < 0) {
    throw new Error(`${label} slot must be an integer of at least 0, received ${describeValue(enemy.slot)}`)
  }
  if (typeof enemy.level !== 'number' || !Number.isInteger(enemy.level) || enemy.level < 1) {
    throw new Error(`${label} level must be a positive integer, received ${describeValue(enemy.level)}`)
  }
  const gold = enemy.gold
  if (gold !== undefined && (typeof gold !== 'number' || !Number.isInteger(gold) || gold < 0)) {
    throw new Error(`${label} gold must be an integer of at least 0, received ${describeValue(gold)}`)
  }
  const base = { defId: enemy.defId, slot: enemy.slot, level: enemy.level, ...(gold === undefined ? {} : { gold }) }
  const materialId = enemy.materialId
  const baseQuantity = enemy.baseQuantity
  if (materialId === undefined && baseQuantity === undefined) return base
  if (typeof materialId !== 'string' || materialId.length === 0) {
    throw new Error(`${label} drop is missing a material`)
  }
  if (typeof baseQuantity !== 'number' || !Number.isInteger(baseQuantity) || baseQuantity < 1) {
    throw new Error(`${label} base quantity must be a positive integer, received ${describeValue(baseQuantity)}`)
  }
  return { ...base, materialId, baseQuantity }
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be an integer of at least 0, received ${describeValue(value)}`)
  }
  return value
}

function optionalGold(value: unknown, label: string): number {
  if (value === undefined) return 0
  return nonNegativeInteger(value, label)
}

function assertSupplySlots(slots: unknown): void {
  if (!Array.isArray(slots) || slots.length !== SUPPLY_SLOT_COUNT) {
    throw new Error(`expedition needs ${SUPPLY_SLOT_COUNT} supply slots, received ${describeValue(slots)}`)
  }
  for (let index = 0; index < slots.length; index += 1) {
    const slot: unknown = slots[index]
    if (slot === null) continue
    if (typeof slot !== 'object' || Array.isArray(slot)) {
      throw new Error(`supply slot ${index + 1} must be null or { id }, received ${describeValue(slot)}`)
    }
    const id: unknown = (slot as { id?: unknown }).id
    if (typeof id !== 'string' || id.length === 0) {
      throw new Error(`supply slot ${index + 1} needs a non-empty id, received ${describeValue(id)}`)
    }
  }
}

function assertIdList(ids: unknown, label: string): void {
  if (!Array.isArray(ids)) throw new Error(`${label} must be a list, received ${describeValue(ids)}`)
  for (const id of ids) {
    if (typeof id !== 'string' || id.length === 0) {
      throw new Error(`${label} needs a non-empty id, received ${describeValue(id)}`)
    }
  }
}

function assertEquipment(list: unknown): void {
  if (!Array.isArray(list)) throw new Error('expedition equipment is missing')
  for (const entry of list) {
    if (typeof entry !== 'object' || entry === null) throw new Error('equipment entry is missing')
    const record = entry as {
      slot?: unknown
      itemId?: unknown
      durability?: unknown
      maxDurability?: unknown
      disabled?: unknown
    }
    const slot = record.slot
    if (typeof slot !== 'string' || !(EQUIPMENT_SLOTS as readonly string[]).includes(slot)) {
      throw new Error(`equipment slot is unknown, received ${describeValue(slot)}`)
    }
    const itemId = record.itemId
    if (typeof itemId !== 'string' || itemId.length === 0) {
      throw new Error(`equipment ${slot} is missing an item`)
    }
    const durability = nonNegativeInteger(record.durability, `equipment ${slot} durability`)
    const maxDurability = nonNegativeInteger(record.maxDurability, `equipment ${slot} maximum durability`)
    if (durability > maxDurability) {
      throw new Error(`equipment ${slot} durability ${durability} is above its maximum ${maxDurability}`)
    }
    if (typeof record.disabled !== 'boolean') {
      throw new Error(`equipment ${slot} disabled must be a boolean, received ${describeValue(record.disabled)}`)
    }
    if (durability === 0 && record.disabled !== true) {
      throw new Error(`equipment ${slot} at 0 durability must be disabled`)
    }
    if (record.disabled && durability !== 0) {
      throw new Error(`equipment ${slot} can be disabled only at 0 durability, received ${durability}`)
    }
  }
}

function emptySupplySlots(): SupplySlot[] {
  const slots: SupplySlot[] = []
  for (let index = 0; index < SUPPLY_SLOT_COUNT; index += 1) slots.push(null)
  return slots
}

function freshPiece(slot: ExpeditionEquipmentSlot, itemId: string): ExpeditionEquipment {
  return {
    slot,
    itemId,
    durability: EQUIPMENT_DURABILITY_MAX,
    maxDurability: EQUIPMENT_DURABILITY_MAX,
    disabled: false,
  }
}

/** mainHand, offHand when present, then armor, then the two accessories. */
function equipmentFromGear(gear: HeroGear): ExpeditionEquipment[] {
  const pieces: ExpeditionEquipment[] = [freshPiece('mainHand', gear.mainHand.id)]
  if (gear.offHand !== null) pieces.push(freshPiece('offHand', gear.offHand.id))
  pieces.push(
    freshPiece('head', gear.head.id),
    freshPiece('chest', gear.chest.id),
    freshPiece('hands', gear.hands.id),
    freshPiece('feet', gear.feet.id),
  )
  const first = gear.accessories[0]
  const second = gear.accessories[1]
  pieces.push(freshPiece('accessory0', first.id), freshPiece('accessory1', second.id))
  return pieces
}

function copyThreshold(entry: unknown, index: number): RetreatThreshold {
  const label = `retreat threshold ${index + 1}`
  if (typeof entry !== 'object' || entry === null) throw new Error(`${label} is missing`)
  const record = entry as { kind?: unknown; atMost?: unknown }
  const kind: unknown = record.kind
  if (kind !== 'hpFraction') {
    throw new Error(`${label} kind is unknown, received ${describeValue(kind)}`)
  }
  const atMost: unknown = record.atMost
  if (typeof atMost !== 'number' || !Number.isFinite(atMost) || atMost <= 0 || atMost > 1) {
    throw new Error(`${label} atMost must be greater than 0 and at most 1, received ${describeValue(atMost)}`)
  }
  return { kind: 'hpFraction', atMost }
}

function copyThresholds(list: unknown): RetreatThreshold[] {
  if (!Array.isArray(list)) throw new Error('retreat thresholds are missing')
  return list.map((entry, index) => copyThreshold(entry, index))
}

function copyEncounters(list: readonly ExpeditionEncounterDef[], label: string): ExpeditionEncounterDef[] {
  if (!Array.isArray(list)) throw new Error(`${label} must be a list`)
  return list.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null) throw new Error(`${label} ${index + 1} is missing`)
    if (typeof entry.id !== 'string' || entry.id.length === 0) {
      throw new Error(`${label} ${index + 1} is missing an id`)
    }
    const enemies: readonly ExpeditionEnemy[] = entry.enemies
    if (!Array.isArray(entry.enemies) || enemies.length === 0) {
      throw new Error(`${label} '${entry.id}' has no enemies`)
    }
    return {
      id: entry.id,
      enemies: enemies.map((enemy, enemyIndex) => copyEnemy(enemy, `${label} '${entry.id}' enemy ${enemyIndex + 1}`)),
    }
  })
}

function carriedFromTemplate(hero: CombatHeroSetup): CarriedHero {
  assertClassId(hero.classId)
  const stats = deriveHeroStats({
    level: hero.level,
    classId: hero.classId,
    attributes: hero.attributes,
    gear: hero.gear,
    racialNodeIds: hero.allocatedNodeIds,
    renaissance: hero.renaissance === true,
    ...(hero.statBonuses ?? {}),
  })
  const meter = initialMeter(hero.classId)
  const specialAmmo = hero.classId === 'ranger' ? (hero.specialAmmo ?? 0) : 0
  return {
    classId: hero.classId,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    vitality: hero.attributes.vitality,
    spirit: hero.attributes.spirit,
    classResource: meter.amount,
    classResourceId: meter.id,
    classResourceMax: meter.maximum,
    resourceFraction: 0,
    specialAmmo,
    vow: hero.vow ?? null,
    focus: 0,
    specialArrowCount: 0,
  }
}

export function createExpedition(blueprint: ExpeditionBlueprint, seed: number): ExpeditionState {
  if (typeof blueprint !== 'object' || blueprint === null) {
    throw new Error(`expedition blueprint must be an object, received ${describeValue(blueprint)}`)
  }
  if (!isExpeditionId(blueprint.id)) {
    throw new Error(`unknown expedition ${describeValue(blueprint.id)}; valid expeditions: ${EXPEDITION_IDS.join(', ')}`)
  }
  if (
    typeof blueprint.travelGapMs !== 'number' ||
    !Number.isInteger(blueprint.travelGapMs) ||
    blueprint.travelGapMs < 0
  ) {
    throw new Error(`travel gap must be an integer of at least 0, received ${describeValue(blueprint.travelGapMs)}`)
  }
  if (typeof blueprint.hero !== 'object' || blueprint.hero === null) throw new Error('expedition hero is missing')
  assertClassId(blueprint.hero.classId)
  readRace(blueprint.hero.race)
  const opening = copyEncounters(blueprint.opening, 'opening encounter')
  const draw = copyEncounters(blueprint.draw, 'draw encounter')
  if (draw.length === 0) throw new Error('expedition draw has no encounters')
  const retreatThresholds = copyThresholds(blueprint.retreatThresholds)
  const rng = createRng(seed)
  const hero = carriedFromTemplate(blueprint.hero)
  const equipment = equipmentFromGear(blueprint.hero.gear)
  const carriedGold = optionalGold(blueprint.carriedGold, 'carried gold')
  const depositedGold = optionalGold(blueprint.depositedGold, 'deposited gold')
  return {
    id: blueprint.id,
    seed,
    classId: blueprint.hero.classId,
    outcome: 'ongoing',
    phase: 'travel',
    travelMs: 0,
    travelGapMs: blueprint.travelGapMs,
    encounterIndex: 0,
    opening,
    draw,
    heroTemplate: blueprint.hero,
    rng,
    hero,
    combat: null,
    current: null,
    history: [],
    momentum: 0,
    rareNodeChance: 0,
    ferocityProgress: 0,
    trapperCooldown: 0,
    unsecured: [],
    secured: [],
    overflow: 0,
    supplySlots: emptySupplySlots(),
    consumedSupplyIds: [],
    carriedGold,
    depositedGold,
    debt: 0,
    recoveryMs: 0,
    bossLossThisLife: false,
    equipment,
    returning: false,
    retreatThresholds,
    escapeRetryMs: null,
    escapeLog: [],
  }
}

/** Thick Hide is +25%. Long Hunt adds 5% per Ferocity tier. */
function outOfCombatRegenFactor(state: ExpeditionState): number {
  const ids = state.heroTemplate.allocatedNodeIds
  let factor = 1
  if (ids !== undefined && ids.includes(NODE_BEAST_THICK_HIDE)) factor *= THICK_HIDE_REGEN
  factor *= longHuntRegenFactor(ids, state.ferocityProgress)
  return factor
}

function applyTravelSecond(state: ExpeditionState, second: number): void {
  const hero = state.hero
  if (typeof hero.hp !== 'number' || !Number.isFinite(hero.hp)) {
    throw new Error(`hero HP must be a finite number, received ${describeValue(hero.hp)}`)
  }
  if (typeof hero.maxHp !== 'number' || !Number.isFinite(hero.maxHp) || hero.maxHp <= 0) {
    throw new Error(`hero maximum HP must be greater than 0, received ${describeValue(hero.maxHp)}`)
  }
  if (hero.hp > hero.maxHp) hero.hp = hero.maxHp
  const healed = hpRegenPerSecond(hero.vitality, outOfCombatRegenFactor(state))
  if (healed > 0 && hero.hp < hero.maxHp) {
    const next = hero.hp + healed
    hero.hp = next > hero.maxHp ? hero.maxHp : next
  }
  if (hero.classResourceId === MANA_RESOURCE_ID || hero.classResourceId === READINESS_RESOURCE_ID) {
    const base = hero.classResourceId === MANA_RESOURCE_ID ? MANA_TRAVEL_REGEN_PER_SECOND : READINESS_TRAVEL_PER_SECOND
    const travel =
      hero.classResourceId === READINESS_RESOURCE_ID
        ? travelReadinessFactor(state.heroTemplate.allocatedNodeIds, state.momentum)
        : 1
    const regen = hero.classResourceId === MANA_RESOURCE_ID ? manaRegenFactor(state.heroTemplate.allocatedNodeIds) : 1
    const gain = base * spiritResourceFactor(hero.spirit) * travel * regen
    hero.classResource = capMeter(hero.classResource + gain, hero.classResourceMax)
    return
  }
  if (hero.classResourceId === FURY_RESOURCE_ID && second > FURY_DRAIN_WAIT_SECONDS) {
    const next = hero.classResource - FURY_DRAIN_PER_SECOND
    hero.classResource = next > 0 ? next : 0
  }
}

function applyTravelTicks(state: ExpeditionState, stepStart: number, stepEnd: number): void {
  const firstSecond = Math.floor(stepStart / 1000) + 1
  const lastSecond = Math.floor(stepEnd / 1000)
  for (let second = firstSecond; second <= lastSecond; second += 1) {
    const timeMs = second * 1000
    if (timeMs <= stepStart || timeMs > stepEnd) continue
    applyTravelSecond(state, second)
  }
}

function selectEncounter(state: ExpeditionState): ExpeditionEncounterDef {
  if (state.encounterIndex < state.opening.length) {
    const fixed = state.opening[state.encounterIndex]
    if (fixed === undefined) throw new Error(`missing opening encounter ${state.encounterIndex}`)
    return fixed
  }
  const value = nextFloat(state.rng)
  const index = Math.floor(value * state.draw.length)
  const drawn = state.draw[index]
  if (drawn === undefined) {
    throw new Error(`encounter draw ${index} is outside ${state.draw.length} choices`)
  }
  return drawn
}

function carriedSupplyCount(state: ExpeditionState): number {
  let count = 0
  for (const slot of state.supplySlots) {
    if (slot !== null) count += 1
  }
  return count
}

function combatSetup(state: ExpeditionState, encounter: ExpeditionEncounterDef): CombatSetup {
  const classId = state.classId
  const setup: CombatHeroSetup = {
    ...state.heroTemplate,
    startingHp: state.hero.hp,
    carryResource: classId === 'warrior' || classId === 'mage' || classId === 'cleric',
    ...setupRaceMeters(state.heroTemplate.race, state.hero.focus, state.ferocityProgress),
  }
  if (state.heroTemplate.race === 'undead') setup.startingSouls = state.hero.souls ?? 0
  if (classId === 'assassin') delete setup.startingResource
  else setup.startingResource = state.hero.classResource
  if (classId === 'ranger') {
    setup.specialAmmo = state.hero.specialAmmo
    setup.specialArrowCount = state.hero.specialArrowCount
    setup.trapperCooldown = state.trapperCooldown
    setup.expeditionMomentum = state.momentum
    setup.carriedSupplyCount = carriedSupplyCount(state)
  }
  if (classId === 'mage' && typeof state.hero.mageCharges === 'string') {
    setup.mageCharges = state.hero.mageCharges
  }
  if (classId === 'cleric') {
    if (state.hero.vow === null || state.hero.vow.length === 0) {
      throw new Error('cleric expedition is missing a vow')
    }
    setup.vow = state.hero.vow
  }
  return {
    hero: setup,
    enemies: encounter.enemies.map((enemy) => ({
      defId: enemy.defId,
      slot: enemy.slot,
      level: enemy.level,
    })),
  }
}

function beginEncounter(state: ExpeditionState, defs: GameDefs): void {
  state.escapeRetryMs = null
  const encounter = selectEncounter(state)
  const seed = deriveSeed(state.seed, state.encounterIndex)
  const combat = createCombat(combatSetup(state, encounter), defs, seed)
  state.phase = 'combat'
  state.combat = combat
  state.current = {
    index: state.encounterIndex,
    encounterId: encounter.id,
    seed,
    enemies: encounter.enemies.map((enemy) => ({ ...enemy })),
  }
}

function durationMs(combat: CombatState): number {
  for (let index = combat.log.length - 1; index >= 0; index -= 1) {
    const event = combat.log[index]
    if (event !== undefined && event.type === 'encounterEnd') return event.timeMs
  }
  return combat.timeMs
}

function carryFromCombat(state: ExpeditionState): void {
  const combat = state.combat
  if (combat === null) throw new Error('expedition combat is missing')
  const hero = combat.hero
  state.hero.hp = hero.hp
  state.hero.maxHp = hero.maxHp
  state.hero.vitality = hero.vitality
  state.hero.spirit = hero.spirit
  state.hero.classResource = hero.classResource
  state.hero.classResourceId = hero.classResourceId
  state.hero.classResourceMax = hero.classResourceMax
  state.hero.resourceFraction = hero.resourceFraction
  state.hero.specialAmmo = hero.specialAmmo
  const fired = hero.classState.specialArrowCount
  if (typeof fired === 'number' && Number.isInteger(fired) && fired >= 0) state.hero.specialArrowCount = fired
  if (state.classId === 'mage') {
    const charges = hero.classState.mageCharges
    if (typeof charges === 'string') {
      const maxima = hero.classState.mageChargeMax
      const restored = restoreChargeText(
        charges,
        typeof maxima === 'string' ? maxima : null,
        encounterRestoreCount(state.heroTemplate.allocatedNodeIds),
      )
      state.hero.mageCharges = restored
    }
  }
  if (state.classId === 'assassin') {
    state.hero.classResource = 0
    state.hero.resourceFraction = 0
  }
  if (typeof hero.suppliedVow === 'string' && hero.suppliedVow.length > 0) state.hero.vow = hero.suppliedVow
  const stored = storeRaceMeters(state.heroTemplate.race, hero)
  if (stored.focus !== null) {
    if (typeof stored.focus !== 'number' || !Number.isFinite(stored.focus) || stored.focus < 0 || stored.focus > FOCUS_MAX) {
      throw new Error(`carried focus must be from 0 through ${FOCUS_MAX}, received ${describeValue(stored.focus)}`)
    }
    state.hero.focus = stored.focus
  }
  if (state.heroTemplate.race === 'undead') {
    const souls = hero.raceState.souls
    state.hero.souls = typeof souls === 'number' && Number.isInteger(souls) && souls >= 0 ? souls : 0
  }
  if (stored.ferocity !== null) {
    if (
      typeof stored.ferocity !== 'number' ||
      !Number.isInteger(stored.ferocity) ||
      stored.ferocity < 0 ||
      stored.ferocity > FEROCITY_CAP
    ) {
      throw new Error(
        `carried ferocity must be an integer from 0 through ${FEROCITY_CAP}, received ${describeValue(stored.ferocity)}`,
      )
    }
    state.ferocityProgress = stored.ferocity
  }
}

/**
 * Half-up of `base × (1 + 0.05 × stacks)`.
 * The product is counted in thousandths first: 4 at 3 stacks is 4600 thousandths, which is 4.6, and rounds to 5.
 */
function scaledDropQuantity(base: number, stacks: number): number {
  const thousandths = 1000 + stacks * MATERIAL_BONUS_THOUSANDTHS_PER_STACK
  return Math.round((base * thousandths) / 1000)
}

function lootTotal(stacks: readonly LootStack[]): number {
  let total = 0
  for (const stack of stacks) total += stack.quantity
  return total
}

function addUnsecured(state: ExpeditionState, materialId: string, quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error(`drop quantity must be a positive integer, received ${describeValue(quantity)}`)
  }
  const room = LOOT_CAPACITY - lootTotal(state.unsecured)
  if (room < 0) throw new Error(`unsecured loot is above capacity ${LOOT_CAPACITY}`)
  const accepted = quantity < room ? quantity : room
  const lost = quantity - accepted
  if (accepted > 0) {
    const existing = state.unsecured.find((stack) => stack.materialId === materialId)
    if (existing !== undefined) existing.quantity += accepted
    else state.unsecured.push({ materialId, quantity: accepted })
  }
  state.overflow += lost
}

function collectDrops(state: ExpeditionState): void {
  const current = state.current
  if (current === null) throw new Error('expedition has no encounter to finish')
  const enemies = [...current.enemies].sort((left, right) => left.slot - right.slot)
  for (const enemy of enemies) {
    if (enemy.gold !== undefined) state.carriedGold += enemy.gold
    if (enemy.materialId === undefined || enemy.baseQuantity === undefined) continue
    addUnsecured(state, enemy.materialId, scaledDropQuantity(enemy.baseQuantity, state.momentum))
  }
}

/** One gain per victory. Any non-summon elite enemy makes the victory elite. Momentum does not change XP. */
function momentumGain(combat: CombatState, defs: GameDefs): number {
  for (const enemy of combat.enemies) {
    if (enemy.summon) continue
    const def = defs.enemies[enemy.defId]
    if (def === undefined) throw new Error(`unknown enemy '${enemy.defId}'`)
    if (def.elite === true) return 2
  }
  return 1
}

function addMomentum(state: ExpeditionState, gain: number): void {
  const next = state.momentum + gain
  state.momentum = next > MOMENTUM_CAP ? MOMENTUM_CAP : next
  state.rareNodeChance = state.momentum * RARE_NODE_CHANCE_PER_STACK
}

function loseDurability(state: ExpeditionState): void {
  for (const entry of state.equipment) {
    const next = entry.durability - DEFEAT_DURABILITY_LOSS
    entry.durability = next > 0 ? next : 0
    if (entry.durability === 0) entry.disabled = true
  }
}

/** Soul Debt raises the rescue fee, and so the debt, by 50%. */
export function rescueFee(state: ExpeditionState): number {
  const template = state.heroTemplate
  const ids = template.allocatedNodeIds
  const debt = template.curse === CURSE_SOUL_DEBT && ids !== undefined && ids.includes(NODE_UNDEAD_CURSEBOUND)
  return debt ? Math.round(RESCUE_FEE * SOUL_DEBT_FEE) : RESCUE_FEE
}

function payRescueFee(state: ExpeditionState): void {
  const fee = rescueFee(state)
  const paid = Math.min(state.carriedGold, fee)
  state.carriedGold -= paid
  state.debt += fee - paid
}

/** A summon with `boss` set does not count. Road enemies are not bosses. */
function defeatedByBoss(combat: CombatState): boolean {
  for (const enemy of combat.enemies) {
    if (enemy.summon) continue
    if (enemy.boss === true) return true
  }
  return false
}

/**
 * Costs of a lost fight. Victory, timeout, and retreat do not call this.
 * Durability is recorded after the fight and is not copied into the next one.
 */
function applyDefeat(state: ExpeditionState, combat: CombatState): void {
  state.outcome = 'defeat'
  state.unsecured = []
  loseDurability(state)
  payRescueFee(state)
  state.recoveryMs = DEFEAT_RECOVERY_MS
  if (defeatedByBoss(combat)) state.bossLossThisLife = true
  resetMomentum(state, 'defeat')
  resetFocus(state, 'defeat')
  resetFerocity(state, 'defeat')
  state.hero.mageCharges = null
}

/**
 * A deploy sets the wait to three encounters, and this completion is the first of them.
 * The next deploy is ready when the count returns to 0.
 */
function noteTrapperEncounter(state: ExpeditionState): void {
  const combat = state.combat
  if (combat !== null && combat.hero.classState.trapperDeployed === true) {
    state.trapperCooldown = TRAPPER_RECHARGE_ENCOUNTERS
  }
  if (state.trapperCooldown > 0) state.trapperCooldown -= 1
}

/** The hero's XP for a won fight: the encounter rules, plus the Human bonus (and Quick Study) for a Human. */
function victoryXp(state: ExpeditionState, combat: CombatState): number {
  const members = combat.enemies.map((enemy) => ({ xp: enemy.xp, level: enemy.level, summon: enemy.summon }))
  const level = state.heroTemplate.level
  const spirit = state.hero.spirit
  if (state.heroTemplate.race === 'human') return humanOrdinaryXp(level, spirit, members, state.heroTemplate.allocatedNodeIds)
  return xpFromEnemies(level, spirit, members)
}

function finishEncounter(state: ExpeditionState, defs: GameDefs): void {
  const combat = state.combat
  const current = state.current
  if (combat === null || current === null) throw new Error('expedition has no encounter to finish')
  if (combat.outcome === 'ongoing') throw new Error('expedition encounter is still ongoing')
  carryFromCombat(state)
  state.history.push({
    index: current.index,
    encounterId: current.encounterId,
    seed: current.seed,
    outcome: combat.outcome,
    durationMs: durationMs(combat),
  })
  noteTrapperEncounter(state)
  if (combat.outcome === 'victory') {
    collectDrops(state)
    state.xpEarned = (state.xpEarned ?? 0) + victoryXp(state, combat)
    addMomentum(state, momentumGain(combat, defs))
    const restored = pressTrailReadiness(state.heroTemplate.allocatedNodeIds, state.momentum)
    if (restored > 0) {
      state.hero.classResource = capMeter(state.hero.classResource + restored, state.hero.classResourceMax)
    }
  }
  if (combat.outcome === 'defeat') {
    applyDefeat(state, combat)
    return
  }
  state.combat = null
  state.current = null
  state.phase = 'travel'
  state.travelMs = 0
  state.encounterIndex += 1
}

function arriveInTown(state: ExpeditionState): void {
  for (const stack of state.unsecured) {
    const existing = state.secured.find((entry) => entry.materialId === stack.materialId)
    if (existing !== undefined) existing.quantity += stack.quantity
    else state.secured.push({ materialId: stack.materialId, quantity: stack.quantity })
  }
  state.unsecured = []
  state.returning = false
  state.momentum = 0
  state.rareNodeChance = 0
  resetFocus(state, 'return')
  resetFerocity(state, 'return')
  state.hero.mageCharges = null
  state.outcome = 'returned'
}

function travelLimit(state: ExpeditionState): number {
  return state.returning ? TRAVEL_GAP_MS : state.travelGapMs
}

function finishTravel(state: ExpeditionState, defs: GameDefs): void {
  if (state.returning) {
    arriveInTown(state)
    return
  }
  beginEncounter(state, defs)
}

function stepTravel(state: ExpeditionState, defs: GameDefs): void {
  const limit = travelLimit(state)
  if (state.travelMs >= limit) {
    finishTravel(state, defs)
    return
  }
  const start = state.travelMs
  let end = start + STEP_MS
  if (end > limit) end = limit
  applyTravelTicks(state, start, end)
  state.travelMs = end
  if (state.travelMs >= limit) finishTravel(state, defs)
}

/** `hp * 1000 <= maxHp * round(atMost * 1000)`. Equal to the fraction still qualifies. */
function hpAtMostFraction(hp: number, maxHp: number, atMost: number): boolean {
  return hp * 1000 <= maxHp * Math.round(atMost * 1000)
}

function metThreshold(state: ExpeditionState, hp: number, maxHp: number): RetreatThreshold | null {
  for (const threshold of state.retreatThresholds) {
    if (hpAtMostFraction(hp, maxHp, threshold.atMost)) return threshold
  }
  return null
}

function retreatFromCombat(state: ExpeditionState): void {
  const combat = state.combat
  const current = state.current
  if (combat === null || current === null) throw new Error('expedition has no encounter to abandon')
  const durationMs = combat.timeMs
  carryFromCombat(state)
  state.history.push({
    index: current.index,
    encounterId: current.encounterId,
    seed: current.seed,
    outcome: 'retreat',
    durationMs,
  })
  state.combat = null
  state.current = null
  state.phase = 'travel'
  state.travelMs = 0
  state.returning = true
  state.escapeRetryMs = null
  resetFocus(state, 'retreat')
  resetFerocity(state, 'retreat')
}

/**
 * Roll escape once when a threshold is met and the retry time has been reached.
 * Returns true when the fight was abandoned. The hero's ready time is not moved.
 */
function tryEscape(state: ExpeditionState): boolean {
  const combat = state.combat
  if (combat === null || combat.outcome !== 'ongoing') return false
  const hero = combat.hero
  const threshold = metThreshold(state, hero.hp, hero.maxHp)
  if (threshold === null) return false
  if (state.escapeRetryMs !== null && combat.timeMs < state.escapeRetryMs) return false
  const agilityPoints = Math.min(ESCAPE_AGILITY_CAP, Math.floor(hero.agility / 5))
  const trailEscape = pressTrailEscapePoints(state.heroTemplate.allocatedNodeIds, state.momentum)
  const momentumBonus = ESCAPE_MOMENTUM_BONUS + trailEscape
  const chancePercent = ESCAPE_BASE_PERCENT + agilityPoints + ESCAPE_SUPPLIES_BONUS + ESCAPE_ZONE_BONUS + momentumBonus
  const roll = nextFloat(state.rng)
  const success = roll * 100 < chancePercent
  const event: EscapeEvent = {
    type: 'escape',
    timeMs: combat.timeMs,
    actorId: hero.id,
    actorName: hero.name,
    hp: hero.hp,
    maxHp: hero.maxHp,
    thresholdPercent: Math.round(threshold.atMost * 1000) / 10,
    roll,
    chancePercent,
    basePercent: ESCAPE_BASE_PERCENT,
    agility: hero.agility,
    agilityPoints,
    suppliesBonus: ESCAPE_SUPPLIES_BONUS,
    zoneBonus: ESCAPE_ZONE_BONUS,
    momentumBonus,
    success,
  }
  combat.log.push(event)
  state.escapeLog.push(event)
  if (!success) {
    state.escapeRetryMs = combat.timeMs + ESCAPE_RETRY_MS
    return false
  }
  retreatFromCombat(state)
  return true
}

function stepCombatPhase(state: ExpeditionState, defs: GameDefs, combatLimitMs: number | undefined): void {
  const combat = state.combat
  if (combat === null) throw new Error('expedition combat is missing')
  if (combat.outcome === 'ongoing' && combatLimitMs !== undefined && combat.timeMs >= combatLimitMs) {
    runCombat(combat, defs, combatLimitMs)
  } else if (combat.outcome === 'ongoing') {
    stepCombat(combat, defs)
    if (combat.outcome === 'ongoing' && tryEscape(state)) return
    if (combat.outcome === 'ongoing' && combatLimitMs !== undefined && combat.timeMs >= combatLimitMs) {
      runCombat(combat, defs, combatLimitMs)
    }
  }
  if (state.combat !== null && state.combat.outcome !== 'ongoing') finishEncounter(state, defs)
}

/**
 * Between fights, start one 20-second walk home. Arrival secures loot and clears momentum.
 * Calling this during combat throws. The walk uses the same regeneration as a road gap.
 */
export function returnToTown(state: ExpeditionState): void {
  assertExpedition(state)
  if (state.phase !== 'travel' || state.combat !== null) {
    throw new Error('return to town only works between fights')
  }
  if (state.outcome !== 'ongoing') {
    throw new Error(`return to town only works while the expedition is ongoing, received ${state.outcome}`)
  }
  if (state.returning) throw new Error('already returning to town')
  state.returning = true
  state.travelMs = 0
}

/**
 * Sets momentum and the stored rare-node chance to 0.
 * This helper does not secure or destroy loot. A defeat destroys unsecured loot, then calls this.
 * The return walk uses arrival, not this helper.
 */
export function resetMomentum(state: ExpeditionState, reason: MomentumResetReason): void {
  assertExpedition(state)
  if (!(MOMENTUM_RESET_REASONS as readonly string[]).includes(reason)) {
    throw new Error(
      `momentum reset reason is unknown, received ${describeValue(reason)}; valid reasons: ${MOMENTUM_RESET_REASONS.join(', ')}`,
    )
  }
  state.momentum = 0
  state.rareNodeChance = 0
}

function assertRaceResetReason(reason: unknown, label: string): asserts reason is MomentumResetReason {
  if (!(MOMENTUM_RESET_REASONS as readonly string[]).includes(reason as string)) {
    throw new Error(
      `${label} reset reason is unknown, received ${describeValue(reason)}; valid reasons: ${MOMENTUM_RESET_REASONS.join(', ')}`,
    )
  }
}

/** Clears carried Elf Focus. Town, retreat, defeat, and reincarnation all use this. */
export function resetFocus(state: ExpeditionState, reason: MomentumResetReason): void {
  assertExpedition(state)
  assertRaceResetReason(reason, 'focus')
  state.hero.focus = 0
  state.hero.souls = 0
  state.hero.specialArrowCount = 0
}

/** Clears Beastfolk Ferocity progress. A retreat or defeat does not keep a victory gain. */
export function resetFerocity(state: ExpeditionState, reason: MomentumResetReason): void {
  assertExpedition(state)
  assertRaceResetReason(reason, 'ferocity')
  state.ferocityProgress = 0
}

/**
 * Advance one 10 ms step. Travel regenerates on whole seconds, then the next fight starts.
 * `combatLimitMs` ends a fight as timeout. Omitting it leaves the fight to victory or defeat.
 * An expedition that is already defeated returns immediately, and recovery does not tick.
 */
export function stepExpedition(
  state: ExpeditionState,
  defs: GameDefs,
  combatLimitMs?: number,
): ExpeditionState {
  assertExpedition(state)
  if (combatLimitMs !== undefined) assertCombatLimit(combatLimitMs)
  if (state.outcome !== 'ongoing') return state
  if (state.phase === 'travel') stepTravel(state, defs)
  else stepCombatPhase(state, defs, combatLimitMs)
  return state
}

/**
 * Run until `maxEncounters` fights have finished or the hero is defeated.
 * A return walk still finishes after that cap, and the cap does not start another fight.
 * The count is the caller's bound. The road itself does not stop at four.
 */
export function runExpedition(
  state: ExpeditionState,
  defs: GameDefs,
  maxEncounters: number,
  combatLimitMs: number,
): ExpeditionState {
  if (typeof maxEncounters !== 'number' || !Number.isInteger(maxEncounters) || maxEncounters < 1) {
    throw new Error(
      `expedition encounters must be an integer of at least 1, received ${describeValue(maxEncounters)}`,
    )
  }
  assertCombatLimit(combatLimitMs)
  while (state.outcome === 'ongoing' && (state.returning || state.history.length < maxEncounters)) {
    stepExpedition(state, defs, combatLimitMs)
  }
  return state
}
