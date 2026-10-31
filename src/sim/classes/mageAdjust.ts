import type { CombatActor, CombatHero, CombatState, SkillDef } from '../types.ts'

export const NODE_FIREBALL = 'mage-fireball'
export const NODE_FROST_LANCE = 'mage-frost-lance'
export const NODE_CHAIN_LIGHTNING = 'mage-chain-lightning'
export const NODE_ELEMENTAL_AFFINITY = 'mage-elemental-affinity'
export const NODE_ELEMENTAL_CONVERGENCE = 'mage-elemental-convergence'
export const NODE_ARCANE_BOLT = 'mage-arcane-bolt'
export const NODE_MANA_WARD = 'mage-mana-ward'
export const NODE_ARCANE_RECOVERY = 'mage-arcane-recovery'
export const NODE_EFFICIENT_CHANNELING = 'mage-efficient-channeling'
export const NODE_OVERCAST = 'mage-overcast'
export const NODE_SPELL_MEMORY = 'mage-spell-memory'
export const NODE_QUICK_STUDY = 'mage-quick-study'
export const NODE_DEFENSIVE_PREPARATION = 'mage-defensive-preparation'
export const NODE_REHEARSED_CASTING = 'mage-rehearsed-casting'
export const NODE_GRAND_GRIMOIRE = 'mage-grand-grimoire'

export const ARCANE_BOLT_SKILL_ID = 'arcane-bolt'
export const MANA_WARD_SKILL_ID = 'mana-ward'
export const ARCANE_RECOVERY_SKILL_ID = 'arcane-recovery'
export const CHAIN_LIGHTNING_SKILL_ID = 'chain-lightning'
export const AEGIS_SKILL_ID = 'stormglass-aegis'
export const THERMAL_RUPTURE_SKILL_ID = 'thermal-rupture'

export const ARCANE_BOLT_NODE_COST = 3
export const ARCANE_BOLT_NODE_COEFFICIENT = 1
export const ARCANE_RECOVERY_NODE_BASE = 40
export const ARCANE_RECOVERY_NODE_COOLDOWN_SECONDS = 8
export const EFFICIENT_COST_FACTOR = 0.9
export const EFFICIENT_REGEN_FACTOR = 1.2
export const AFFINITY_BURN_FACTOR = 1.1
export const AFFINITY_CHILL_EXTRA_SECONDS = 2
export const AFFINITY_CHAIN_DECAY = 0.85
export const OVERCAST_HP_PER_MANA = 0.0025
export const OVERCAST_DAMAGE_PER_MANA = 0.01
export const OVERCAST_DAMAGE_CAP = 0.3
export const SPELL_MEMORY_CHARGES = 1
export const GRIMOIRE_CHARGES = 2
export const GRIMOIRE_SPELLS = 3
export const EMERGENCY_CHARGES = 1
export const REHEARSAL_LENGTH = 3
export const REHEARSAL_DAMAGE = 1.2
export const REHEARSAL_COOLDOWN_MS = 2000
export const THERMAL_BONUS_COEFFICIENT = 2.2 * 1.5
export const THERMAL_DELAY_MS = 1000

export const STATE_CHARGES = 'mageCharges'
export const STATE_CHARGE_MAX = 'mageChargeMax'
export const STATE_PREPARED = 'preparedSpells'
export const STATE_SEQUENCE = 'convergenceSequence'
export const STATE_INVOKED = 'convergenceInvoked'
export const STATE_OVERCAST_BONUS = 'overcastBonus'
export const STATE_REHEARSAL = 'rehearsalSequence'
export const STATE_REHEARSAL_ACTIVE = 'rehearsalActive'
export const STATE_RECOVERY_CHARGE = 'recoveryRestoredCharge'
export const STATE_AEGIS_EXPIRES = 'aegisExpiresMs'

export const EMERGENCY_SUFFIX = '#emergency'

export type Element = 'fire' | 'frost' | 'lightning'
export const ELEMENTS: readonly Element[] = ['fire', 'frost', 'lightning']

/** Every ordering of Fire, Frost, and Lightning once each. */
export const CONVERGENCE_RECIPES: { readonly [sequence: string]: string } = {
  'fire>frost>lightning': 'thermal-rupture',
  'fire>lightning>frost': 'stormglass-aegis',
  'frost>fire>lightning': 'steam-burst',
  'frost>lightning>fire': 'plasma-lance',
  'lightning>fire>frost': 'flash-freeze',
  'lightning>frost>fire': 'supercell',
}

export const CONVERGENCE_SKILL_IDS: readonly string[] = Object.values(CONVERGENCE_RECIPES)

export type ChargeMap = { [key: string]: number }

export function hasNode(hero: CombatHero, id: string): boolean {
  return hero.allocatedNodeIds.includes(id)
}

export function hasAllocated(ids: readonly string[] | undefined, id: string): boolean {
  return ids !== undefined && ids.includes(id)
}

function isMage(hero: CombatHero): boolean {
  return hero.classId === 'mage'
}

export function isConvergenceSkill(skillId: string): boolean {
  return CONVERGENCE_SKILL_IDS.includes(skillId)
}

/** The element a skill feeds into Convergence, or null. Invoked spells feed nothing. */
export function elementOf(skill: SkillDef): Element | null {
  if (isConvergenceSkill(skill.id)) return null
  for (const element of ELEMENTS) {
    if (skill.tags.includes(element)) return element
  }
  return null
}

export function setClassState(hero: CombatHero, key: string, value: number | string | boolean | null): void {
  if (value === null) {
    if (hero.classState[key] === undefined) return
    const next: CombatHero['classState'] = {}
    for (const existing of Object.keys(hero.classState)) {
      if (existing === key) continue
      const kept = hero.classState[existing]
      if (kept !== undefined) next[existing] = kept
    }
    hero.classState = next
    return
  }
  hero.classState = { ...hero.classState, [key]: value }
}

export function stateString(hero: CombatHero, key: string): string | null {
  const value = hero.classState[key]
  return typeof value === 'string' ? value : null
}

export function stateNumber(hero: CombatHero, key: string): number | null {
  const value = hero.classState[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function parseChargeMap(text: string | null): ChargeMap {
  const map: ChargeMap = {}
  if (text === null) return map
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return map
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return map
  for (const key of Object.keys(parsed)) {
    const value = (parsed as { [key: string]: unknown })[key]
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0) map[key] = value
  }
  return map
}

export function chargesOf(hero: CombatHero): ChargeMap {
  return parseChargeMap(stateString(hero, STATE_CHARGES))
}

export function chargeMaxOf(hero: CombatHero): ChargeMap {
  return parseChargeMap(stateString(hero, STATE_CHARGE_MAX))
}

export function writeCharges(hero: CombatHero, charges: ChargeMap): void {
  setClassState(hero, STATE_CHARGES, JSON.stringify(charges))
}

export function preparedSpellsOf(hero: CombatHero): string[] {
  const text = stateString(hero, STATE_PREPARED)
  if (text === null) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  return parsed.filter((entry): entry is string => typeof entry === 'string')
}

/**
 * The spells that hold charges. Grand Grimoire takes three, Spell Memory takes one.
 * The player's choice comes first. The loadout order fills in the rest. Arcane Bolt and
 * invoked spells are never prepared.
 */
export function choosePreparedSpells(hero: CombatHero): string[] {
  const grimoire = hasNode(hero, NODE_GRAND_GRIMOIRE)
  if (!grimoire && !hasNode(hero, NODE_SPELL_MEMORY)) return []
  const count = grimoire ? GRIMOIRE_SPELLS : 1
  const chosen: string[] = []
  const pools: readonly (readonly string[])[] = [hero.suppliedPreparedSpells ?? [], hero.equippedSkillIds]
  for (const pool of pools) {
    for (const id of pool) {
      if (chosen.length >= count) break
      if (id === ARCANE_BOLT_SKILL_ID || isConvergenceSkill(id) || chosen.includes(id)) continue
      if (!hero.equippedSkillIds.includes(id)) continue
      chosen.push(id)
    }
  }
  return chosen
}

export function chargeMaxima(hero: CombatHero, prepared: readonly string[]): ChargeMap {
  const map: ChargeMap = {}
  const grimoire = hasNode(hero, NODE_GRAND_GRIMOIRE)
  for (const id of prepared) map[id] = grimoire ? GRIMOIRE_CHARGES : SPELL_MEMORY_CHARGES
  if (hasNode(hero, NODE_DEFENSIVE_PREPARATION) && hero.equippedSkillIds.includes(MANA_WARD_SKILL_ID)) {
    map[`${MANA_WARD_SKILL_ID}${EMERGENCY_SUFFIX}`] = EMERGENCY_CHARGES
  }
  return map
}

/**
 * Restore up to `count` expended charges, in prepared order and then the emergency charge.
 * Returns the new map as JSON. A key missing from `charges` counts as full.
 */
export function restoreChargeText(chargesText: string | null, maxText: string | null, count: number): string | null {
  if (chargesText === null) return null
  const charges = parseChargeMap(chargesText)
  const maxima = parseChargeMap(maxText)
  let left = count
  for (const key of Object.keys(maxima)) {
    if (left <= 0) break
    const max = maxima[key] ?? 0
    const have = charges[key] ?? max
    if (have < max) {
      charges[key] = have + 1
      left -= 1
    }
  }
  return JSON.stringify(charges)
}

/** Charges restored after an encounter: Quick Study one, Grand Grimoire one more. */
export function encounterRestoreCount(nodeIds: readonly string[] | undefined): number {
  let count = 0
  if (hasAllocated(nodeIds, NODE_QUICK_STUDY)) count += 1
  if (hasAllocated(nodeIds, NODE_GRAND_GRIMOIRE)) count += 1
  return count
}

export function arcaneBoltBaseCost(hero: CombatHero, skill: SkillDef): number {
  if (skill.id === ARCANE_BOLT_SKILL_ID && hasNode(hero, NODE_ARCANE_BOLT)) return ARCANE_BOLT_NODE_COST
  return skill.cost
}

function channeledCost(hero: CombatHero, skill: SkillDef): number {
  const base = arcaneBoltBaseCost(hero, skill)
  if (base > 0 && hasNode(hero, NODE_EFFICIENT_CHANNELING)) return base * EFFICIENT_COST_FACTOR
  return base
}

export type PaymentPlan =
  | { kind: 'free' }
  | { kind: 'charge'; key: string }
  | { kind: 'mana'; cost: number }
  | { kind: 'overcast'; cost: number; missing: number; hpLoss: number }
  | { kind: 'blocked'; reason: string }

/** How this cast would be paid right now. Affordability and payment both read this. */
export function planPayment(hero: CombatHero, skill: SkillDef): PaymentPlan {
  if (isConvergenceSkill(skill.id)) {
    if (stateString(hero, STATE_INVOKED) !== skill.id) return { kind: 'blocked', reason: 'not invoked' }
    return { kind: 'free' }
  }
  const prepared = preparedSpellsOf(hero)
  const charges = chargesOf(hero)
  if (prepared.includes(skill.id) && (charges[skill.id] ?? 0) > 0) return { kind: 'charge', key: skill.id }
  if (hasNode(hero, NODE_GRAND_GRIMOIRE) && prepared.includes(skill.id)) {
    return { kind: 'blocked', reason: 'unaffordable' }
  }
  const cost = channeledCost(hero, skill)
  if (cost <= hero.classResource) return { kind: 'mana', cost }
  const emergency = `${MANA_WARD_SKILL_ID}${EMERGENCY_SUFFIX}`
  if (skill.id === MANA_WARD_SKILL_ID && (charges[emergency] ?? 0) > 0) return { kind: 'charge', key: emergency }
  if (hasNode(hero, NODE_OVERCAST)) {
    const missing = cost - hero.classResource
    const hpLoss = missing * OVERCAST_HP_PER_MANA * hero.maxHp
    if (hero.hp - hpLoss > 0) return { kind: 'overcast', cost: hero.classResource, missing, hpLoss }
  }
  return { kind: 'blocked', reason: 'unaffordable' }
}

/** Null when the hero can use the skill. Otherwise the reason the log names. */
export function mageSkillBlock(hero: CombatHero, skill: SkillDef): string | null {
  if (!isMage(hero)) return null
  const plan = planPayment(hero, skill)
  return plan.kind === 'blocked' ? plan.reason : null
}

export function mageAffordable(hero: CombatHero, skill: SkillDef): boolean {
  return planPayment(hero, skill).kind !== 'blocked'
}

/** An invoked spell sits in the Convergence slot, which is not part of the four-skill loadout. */
export function convergenceSlotSkill(hero: CombatHero, skillId: string): boolean {
  return isMage(hero) && hasNode(hero, NODE_ELEMENTAL_CONVERGENCE) && isConvergenceSkill(skillId)
}

/** Arcane Recovery base Mana. A restored charge replaces the Mana gain. */
export function recoveryResourceBase(hero: CombatHero, skill: SkillDef, base: number): number {
  if (!isMage(hero) || skill.id !== ARCANE_RECOVERY_SKILL_ID) return base
  if (hero.classState[STATE_RECOVERY_CHARGE] === true) return 0
  if (hasNode(hero, NODE_ARCANE_RECOVERY)) return ARCANE_RECOVERY_NODE_BASE
  return base
}

export function manaRegenFactor(nodeIds: readonly string[] | undefined): number {
  return hasAllocated(nodeIds, NODE_EFFICIENT_CHANNELING) ? EFFICIENT_REGEN_FACTOR : 1
}

function affinityActive(state: CombatState, source: CombatActor): boolean {
  return source.id === state.hero.id && isMage(state.hero) && hasNode(state.hero, NODE_ELEMENTAL_AFFINITY)
}

/** Burn ticks gain 10% damage, applied to the snapshotted power. */
export function affinityBurnPower(state: CombatState, source: CombatActor, power: number): number {
  return affinityActive(state, source) ? power * AFFINITY_BURN_FACTOR : power
}

export function affinityChillSeconds(state: CombatState, source: CombatActor, seconds: number): number {
  return affinityActive(state, source) ? seconds + AFFINITY_CHILL_EXTRA_SECONDS : seconds
}

export function chainDecay(hero: CombatHero, skill: SkillDef, decay: number): number {
  if (isMage(hero) && skill.id === CHAIN_LIGHTNING_SKILL_ID && hasNode(hero, NODE_ELEMENTAL_AFFINITY)) {
    return AFFINITY_CHAIN_DECAY
  }
  return decay
}
