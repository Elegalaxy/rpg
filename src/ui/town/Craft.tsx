import { useState } from 'react'

import { itemBases, itemName } from '../../content/items.ts'
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
import { ITEM_MODIFIERS } from '../../sim/economy.ts'
import { devCraftingKit, getCraftNotices, queueCraftFromUi, queueUpgradeFromUi, useSaveStatus } from '../store.ts'

const MATERIALS = Object.keys(MATERIAL_QUALITY)

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
  const range = qualityRange(materialId, rank)
  const request = { baseId, itemLevel: level, materialId, modifierId: modifierId === '' ? null : modifierId }
  const problem = craftCheck(save, hero, request)
  const notices = getCraftNotices()

  return (
    <section aria-label="Crafting">
      <h2>Crafting — {hero.name}</h2>
      <p>
        Proficiency rank <strong data-testid="rank">{rank}</strong> ({hero.craftXp} experience). Queue: {save.account.craftQueue.length} of{' '}
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
      <div>
        <label>
          Item{' '}
          <select aria-label="Craft item" value={baseId} onChange={(event) => setBaseId(event.target.value)}>
            {Object.values(itemBases).map((base) => (
              <option key={base.id} value={base.id}>
                {base.name}
              </option>
            ))}
          </select>
        </label>{' '}
        <label>
          Item level{' '}
          <input aria-label="Craft item level" value={levelText} placeholder={String(hero.progress.level)} size={3} onChange={(event) => setLevelText(event.target.value)} />
        </label>{' '}
        <label>
          Material{' '}
          <select aria-label="Craft material" value={materialId} onChange={(event) => setMaterialId(event.target.value)}>
            {MATERIALS.map((id) => (
              <option key={id} value={id}>
                {id} (have {save.account.materials[id] ?? 0})
              </option>
            ))}
          </select>
        </label>{' '}
        <label>
          Modifier{' '}
          <select aria-label="Craft modifier" value={modifierId} onChange={(event) => setModifierId(event.target.value)}>
            <option value="">None</option>
            {save.account.recipes
              .filter((id) => ITEM_MODIFIERS[id] !== undefined)
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
      <button type="button" disabled={problem !== null} onClick={() => setError(queueCraftFromUi(request))}>
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
      {save.account.archive.length === 0 ? <p>The archive is empty.</p> : null}
      <ul>
        {save.account.archive.map((item) => {
          const block = upgradeCheck(save, hero, item, upgradeMaterial)
          return (
            <li key={item.id}>
              {itemName(item)}, item level {item.itemLevel} — {percent(upgradeChance(item.itemLevel))} chance, {UPGRADE_MATERIAL_COST} {upgradeMaterial} and{' '}
              {craftGold(item.itemLevel)} gold{' '}
              <button type="button" disabled={block !== null} aria-label={`Upgrade ${item.id}`} onClick={() => setError(queueUpgradeFromUi(item.id, upgradeMaterial))}>
                Upgrade
              </button>
              {block !== null ? <small> {block}</small> : null}
            </li>
          )
        })}
      </ul>

      <h3>Queue</h3>
      {save.account.craftQueue.length === 0 ? <p>Nothing is being made.</p> : null}
      <ol>
        {save.account.craftQueue.map((job, index) => (
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
