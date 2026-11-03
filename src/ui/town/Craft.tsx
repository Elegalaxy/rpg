import { useState } from 'react'
import { purseOf } from '../../persist/save.ts'

import { itemBases, itemName } from '../../content/items.ts'
import { Row } from '../Row.tsx'
import { selectedHero } from '../../persist/character.ts'
import {
  CRAFT_MATERIAL_COST,
  CRAFT_MS,
  MATERIAL_QUALITY,
  QUEUE_MAX,
  UPGRADE_MATERIAL_COST,
  craftCheck,
  craftGold,
  proficiencyRank,
  qualityRange,
  upgradeChance,
  upgradeCheck,
} from '../../persist/crafting.ts'
import { wearerOf } from '../../persist/equipment.ts'
import { EQUIPMENT_SLOT_IDS, ITEM_MODIFIERS, classBlock, modifierFits, type EquipmentSlotId, type ItemInstance } from '../../sim/economy.ts'
import { devCraftingKit, getCraftNotices, queueCraftFromUi, queueUpgradeFromUi, useSaveStatus } from '../store.ts'

const MATERIALS = Object.keys(MATERIAL_QUALITY)

const SLOT_NAMES: { [slot in EquipmentSlotId]: string } = {
  mainHand: 'Main hand',
  offHand: 'Off hand',
  head: 'Head',
  chest: 'Chest',
  hands: 'Hands',
  feet: 'Feet',
  accessory0: 'Accessory 1',
  accessory1: 'Accessory 2',
}

function percent(value: number): string {
  return `${Math.round(value * 1000) / 10}%`
}

export function Craft() {
  const { save } = useSaveStatus()
  const hero = selectedHero(save)
  const [baseId, setBaseId] = useState('weapon-one-handed')
  const [levelText, setLevelText] = useState('')
  const [materialId, setMaterialId] = useState('shard')
  const [modifierId, setModifierId] = useState('')
  const [upgradeMaterial, setUpgradeMaterial] = useState('shard')
  const [error, setError] = useState<string | null>(null)

  if (hero === null) {
    return (
      <section aria-label="Crafting">
        <h2>Crafting</h2>
        <p>Select a hero to craft.</p>
      </section>
    )
  }

  const rank = proficiencyRank(hero.craftXp)
  const level = levelText.trim() === '' ? hero.progress.level : Number(levelText.trim())
  const craftable = Object.values(itemBases).filter((base) => classBlock(wearerOf(hero), base) === null)
  const chosenBase = craftable.some((base) => base.id === baseId) ? baseId : (craftable[0]?.id ?? baseId)
  const range = qualityRange(materialId, rank)
  const shownModifier = modifierId !== '' && ITEM_MODIFIERS[modifierId] !== undefined && itemBases[chosenBase] !== undefined && modifierFits(ITEM_MODIFIERS[modifierId], itemBases[chosenBase]) ? modifierId : ''
  const request = { baseId: chosenBase, itemLevel: level, materialId, modifierId: shownModifier === '' ? null : shownModifier }
  const problem = craftCheck(save, hero, request)
  const notices = getCraftNotices()
  const worn = EQUIPMENT_SLOT_IDS.flatMap((slot) => {
    const item = hero.equipment[slot]
    return item === null ? [] : [{ item, worn: SLOT_NAMES[slot] }]
  })
  const upgradable: { item: ItemInstance; worn: string | null }[] = [...worn, ...purseOf(save).archive.map((item) => ({ item, worn: null }))]

  return (
    <section aria-label="Crafting">
      <h2>Crafting — {hero.name}</h2>
      <p>
        Proficiency rank <strong data-testid="rank">{rank}</strong> ({hero.craftXp} experience). Queue: {purseOf(save).craftQueue.length} of{' '}
        {QUEUE_MAX}. Time passes only while no expedition runs.
        {import.meta.env.DEV ? (
          <>
            {' '}
            <button type="button" onClick={devCraftingKit}>
              Dev: crafting kit
            </button>
          </>
        ) : null}
      </p>

      <h3>Craft</h3>
      <div className="controls">
        <label>
          Item{' '}
          <select aria-label="Craft item" value={chosenBase} onChange={(event) => setBaseId(event.target.value)}>
            {craftable.map((base) => (
              <option key={base.id} value={base.id}>
                {base.name}
              </option>
            ))}
          </select>
        </label>{' '}
        <label>
          Item level{' '}
          <input
            aria-label="Craft item level"
            type="number"
            min={1}
            max={hero.progress.level}
            value={levelText}
            placeholder={String(hero.progress.level)}
            onChange={(event) => {
              const typed = event.target.value.trim()
              setLevelText(typed === '' ? '' : String(Math.min(hero.progress.level, Math.max(1, Math.floor(Number(typed) || 1)))))
            }}
          />
        </label>{' '}
        <label>
          Material{' '}
          <select aria-label="Craft material" value={materialId} onChange={(event) => setMaterialId(event.target.value)}>
            {MATERIALS.map((id) => (
              <option key={id} value={id}>
                {id} (have {purseOf(save).materials[id] ?? 0})
              </option>
            ))}
          </select>
        </label>{' '}
        <label>
          Modifier{' '}
          <select aria-label="Craft modifier" value={shownModifier} onChange={(event) => setModifierId(event.target.value)}>
            <option value="">None</option>
            {save.account.recipes
              .filter((id) => {
                const modifier = ITEM_MODIFIERS[id]
                const base = itemBases[chosenBase]
                return modifier !== undefined && base !== undefined && modifierFits(modifier, base)
              })
              .map((id) => (
                <option key={id} value={id}>
                  {ITEM_MODIFIERS[id]?.name} ({ITEM_MODIFIERS[id]?.text}, level {ITEM_MODIFIERS[id]?.minLevel})
                </option>
              ))}
          </select>
        </label>
      </div>
      <p data-testid="craft-summary">
        Quality range: {range === null ? 'none' : `${percent(range.low)} to ${percent(range.high)}`}. Cost: {CRAFT_MATERIAL_COST} {materialId} and{' '}
        {Number.isInteger(level) && level > 0 ? craftGold(level) : '?'} gold. Time: {CRAFT_MS / 1000} seconds.
      </p>
      <button type="button" className="btn-primary" disabled={problem !== null} onClick={() => setError(queueCraftFromUi(request))}>
        Queue craft
      </button>
      {problem !== null ? <small data-testid="craft-block"> {problem}</small> : null}

      <h3>Upgrade</h3>
      <label>
        Material{' '}
        <select aria-label="Upgrade material" value={upgradeMaterial} onChange={(event) => setUpgradeMaterial(event.target.value)}>
          {MATERIALS.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </label>
      {upgradable.length === 0 ? <p>Nothing to upgrade. The archive is empty and nothing is worn.</p> : null}
      <ul className="rows">
        {upgradable.map(({ item, worn }) => {
          const block = upgradeCheck(save, hero, item, upgradeMaterial)
          return (
            <Row
              key={item.id}
              actions={
                <button type="button" className="btn-primary" disabled={block !== null} aria-label={`Upgrade ${item.id}`} onClick={() => setError(queueUpgradeFromUi(item.id, upgradeMaterial))}>
                  Upgrade
                </button>
              }
            >
              {worn === null ? '' : `Worn (${worn}): `}
              {itemName(item)}, item level {item.itemLevel} — {percent(upgradeChance(item.itemLevel))} chance, {UPGRADE_MATERIAL_COST} {upgradeMaterial} and {craftGold(item.itemLevel)} gold
              {block !== null ? <small className="row-note">{block}</small> : null}
            </Row>
          )
        })}
      </ul>

      <h3>Queue</h3>
      {purseOf(save).craftQueue.length === 0 ? <p>Nothing is being made.</p> : null}
      <ol>
        {purseOf(save).craftQueue.map((job, index) => (
          <li key={job.id} data-testid="job">
            {job.kind === 'craft'
              ? `Craft ${itemBases[job.baseId]?.name ?? job.baseId}, item level ${job.itemLevel}${job.modifierId === null ? '' : `, ${ITEM_MODIFIERS[job.modifierId]?.name}`}`
              : `Upgrade ${itemName(job.item)}`}{' '}
            — {index === 0 ? `${Math.ceil(job.remainingMs / 1000)} seconds left` : 'waiting'}
          </li>
        ))}
      </ol>
      {notices.length > 0 ? (
        <ul aria-label="Finished jobs">
          {notices.map((text, index) => (
            <li key={`${index}-${text}`}>{text}</li>
          ))}
        </ul>
      ) : null}
      {error !== null ? <p role="alert">{error}</p> : null}
    </section>
  )
}
