import { useState } from 'react'
import { purseOf } from '../../persist/save.ts'

import { itemBases, itemName } from '../../content/items.ts'
import { Kpi, KpiRow, ShopRow, Tag } from '../Kit.tsx'
import { groupItems } from './groupItems.ts'
import { selectedHero } from '../../persist/character.ts'
import {
  CRAFT_MATERIAL_COST,
  CRAFT_MS,
  MATERIAL_QUALITY,
  QUEUE_MAX,
  UPGRADE_MATERIAL_COST,
  UPGRADE_QUALITY_CAP,
  UPGRADE_QUALITY_POINTS,
  upgradeCapFor,
  craftCheck,
  craftGold,
  proficiencyRank,
  qualityRange,
  upgradeGold,
  upgradedQuality,
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

/** Identical archive items collapse into one upgrade row with a count. Worn items stay on their own rows. */
function groupUpgradable(entries: { item: ItemInstance; worn: string | null }[]): { item: ItemInstance; worn: string | null; count: number }[] {
  const worn = entries.filter((entry) => entry.worn !== null).map((entry) => ({ ...entry, count: 1 }))
  const kept = groupItems(entries.filter((entry) => entry.worn === null).map((entry) => entry.item)).map(({ item, count }) => ({ item, worn: null, count }))
  return [...worn, ...kept]
}

/** Crafting and upgrades. A gear shop passes `accepts` so only its own kind of item shows. The queue is the hero's whole queue. */
export function Craft({ accepts = () => true }: { accepts?: (baseId: string) => boolean }) {
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
      <p>Select a hero to craft.</p>
    )
  }

  const rank = proficiencyRank(hero.craftXp)
  const level = levelText.trim() === '' ? hero.progress.level : Number(levelText.trim())
  const craftable = Object.values(itemBases).filter((base) => accepts(base.id) && classBlock(wearerOf(hero), base) === null)
  const chosenBase = craftable.some((base) => base.id === baseId) ? baseId : (craftable[0]?.id ?? baseId)
  const range = qualityRange(materialId, rank)
  const shownModifier = modifierId !== '' && ITEM_MODIFIERS[modifierId] !== undefined && itemBases[chosenBase] !== undefined && modifierFits(ITEM_MODIFIERS[modifierId], itemBases[chosenBase]) ? modifierId : ''
  const request = { baseId: chosenBase, itemLevel: level, materialId, modifierId: shownModifier === '' ? null : shownModifier }
  const problem = craftCheck(save, hero, request)
  const notices = getCraftNotices()
  const worn = EQUIPMENT_SLOT_IDS.flatMap((slot) => {
    const item = hero.equipment[slot]
    return item === null || !accepts(item.baseId) ? [] : [{ item, worn: SLOT_NAMES[slot] }]
  })
  const upgradable: { item: ItemInstance; worn: string | null }[] = [
    ...worn,
    ...purseOf(save).archive.filter((item) => accepts(item.baseId)).map((item) => ({ item, worn: null })),
  ]

  return (
    <>
      <h3>Crafting</h3>
      <KpiRow label="Crafting status">
        <Kpi compact label="Proficiency rank" value={<span data-testid="rank">{rank}</span>} />
        <Kpi compact label="Experience" value={hero.craftXp} />
        <Kpi compact label="Queue" value={`${purseOf(save).craftQueue.length}/${QUEUE_MAX}`} />
      </KpiRow>
      {import.meta.env.DEV ? (
        <p>
          <button type="button" onClick={devCraftingKit}>
            Dev: crafting kit
          </button>
        </p>
      ) : null}

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
      <table className="material-table" aria-label="Materials compared">
        <thead>
          <tr>
            <th>Material</th>
            <th>Quality range</th>
            <th>You have</th>
          </tr>
        </thead>
        <tbody>
          {MATERIALS.map((id) => {
            const shown = qualityRange(id, rank)
            const have = purseOf(save).materials[id] ?? 0
            return (
              <tr key={id} className={id === materialId ? 'material-chosen' : undefined}>
                <td>{id}</td>
                <td>{shown === null ? 'none' : `${percent(shown.low)} to ${percent(shown.high)}`}</td>
                <td className={have < CRAFT_MATERIAL_COST ? 'tag-bad' : undefined}>{have}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <ul className="shop-rows" aria-label="Craft summary">
        <ShopRow
          testId="craft-summary"
          name="Craft"
          effect={`Quality ${range === null ? 'none' : `${percent(range.low)} to ${percent(range.high)}`} · ${CRAFT_MS / 1000} s`}
          costs={[
            [
              { kind: 'mat', amount: CRAFT_MATERIAL_COST, label: materialId },
              { kind: 'gold', amount: Number.isInteger(level) && level > 0 ? craftGold(level) : 0 },
            ],
          ]}
          note={problem !== null ? <span data-testid="craft-block">{problem}</span> : undefined}
          actions={
            <button type="button" className="btn-primary" disabled={problem !== null} onClick={() => setError(queueCraftFromUi(request))}>
              Queue craft
            </button>
          }
        />
      </ul>

      <h4>Upgrade</h4>
      <p className="muted">
        An upgrade always adds 1 item level. The material adds quality too:{' '}
        {MATERIALS.map((id) => `${id} +${UPGRADE_QUALITY_POINTS[id] ?? 0}`).join(', ')} percentage points, up to 110% ({MATERIALS.filter((id) => upgradeCapFor(id) > UPGRADE_QUALITY_CAP).map((id) => `${percent(upgradeCapFor(id))} with ${id}`).join(', ')}).
      </p>
      <label>
        Material{' '}
        <select aria-label="Upgrade material" value={upgradeMaterial} onChange={(event) => setUpgradeMaterial(event.target.value)}>
          {MATERIALS.map((id) => (
            <option key={id} value={id}>
              {id}: +{UPGRADE_QUALITY_POINTS[id] ?? 0} quality (have {purseOf(save).materials[id] ?? 0})
            </option>
          ))}
        </select>
      </label>
      {upgradable.length === 0 ? <p>Nothing of this kind to upgrade.</p> : null}
      <ul className="shop-rows" aria-label="Upgrades">
        {groupUpgradable(upgradable).map(({ item, worn, count }) => {
          const block = upgradeCheck(save, hero, item, upgradeMaterial)
          return (
            <ShopRow
              key={item.id}
              name={`${itemName(item)}${count > 1 ? ` ×${count}` : ''}`}
              effect={
                <>
                  {worn === null ? null : <Tag kind="info">Worn ({worn})</Tag>} lvl {item.itemLevel} → {item.itemLevel + 1} · quality {percent(item.quality)} →{' '}
                  {percent(upgradedQuality(item.quality, upgradeMaterial))}
                </>
              }
              costs={[
                [
                  { kind: 'mat', amount: UPGRADE_MATERIAL_COST, label: upgradeMaterial },
                  { kind: 'gold', amount: upgradeGold(item.itemLevel) },
                ],
              ]}
              note={block ?? undefined}
              actions={
                <button type="button" className="btn-primary" disabled={block !== null} aria-label={`Upgrade ${item.id}`} onClick={() => setError(queueUpgradeFromUi(item.id, upgradeMaterial))}>
                  Upgrade
                </button>
              }
            />
          )
        })}
      </ul>

      <h4>Queue (all shops)</h4>
      {purseOf(save).craftQueue.length === 0 ? <p>Nothing is being made.</p> : null}
      <ul className="shop-rows" aria-label="Craft queue">
        {purseOf(save).craftQueue.map((job, index) => (
          <ShopRow
            key={job.id}
            testId="job"
            name={
              job.kind === 'craft'
                ? `Craft ${itemBases[job.baseId]?.name ?? job.baseId}`
                : `Upgrade ${itemName(job.item)}`
            }
            effect={
              job.kind === 'craft'
                ? `lvl ${job.itemLevel}${job.modifierId === null ? '' : ` · ${ITEM_MODIFIERS[job.modifierId]?.name}`}`
                : undefined
            }
            pills={
              index === 0 ? (
                <Tag kind="info">▶ {Math.ceil(job.remainingMs / 1000)} s left</Tag>
              ) : (
                <Tag kind="plain">Waiting</Tag>
              )
            }
          />
        ))}
      </ul>
      {notices.length > 0 ? (
        <ul aria-label="Finished jobs">
          {notices.map((text, index) => (
            <li key={`${index}-${text}`}>{text}</li>
          ))}
        </ul>
      ) : null}
      {error !== null ? <p role="alert">{error}</p> : null}
    </>
  )
}
