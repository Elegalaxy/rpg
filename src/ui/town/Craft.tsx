import { useState } from 'react'
import { purseOf } from '../../persist/save.ts'

import { itemBases, itemName } from '../../content/items.ts'
import { CostPill, Kpi, KpiRow, ShopRow, Tag } from '../Kit.tsx'
import { groupItems } from './groupItems.ts'
import { selectedHero } from '../../persist/character.ts'
import {
  CRAFT_MATERIAL_COST,
  CRAFT_MS,
  MATERIAL_QUALITY,
  UPGRADE_QUALITY_POINTS,
  planUpgradeAll,
  upgradeCandidates,
  upgradeMaterialCost,
  craftCheck,
  craftGold,
  proficiencyRank,
  qualityRange,
  upgradeGold,
  upgradedQuality,
  upgradeCheck,
} from '../../persist/crafting.ts'
import { wearerOf } from '../../persist/equipment.ts'
import { ITEM_MODIFIERS, classBlock, modifierFits, type EquipmentSlotId, type ItemInstance } from '../../sim/economy.ts'
import { QualityHelp } from './QualityHelp.tsx'
import { devCraftingKit, getCraftNotices, queueCraftFromUi, queueUpgradeAllFromUi, queueUpgradeFromUi, useSaveStatus } from '../store.ts'

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

/** The queue list shows this many jobs until the player asks for all of them. */
const QUEUE_SHOWN = 5

/** Crafting and upgrades. A gear shop passes `accepts` so only its own kind of item shows. The queue is the hero's whole queue. */
export function Craft({ accepts = () => true }: { accepts?: (baseId: string) => boolean }) {
  const { save } = useSaveStatus()
  const hero = selectedHero(save)
  const [baseId, setBaseId] = useState('weapon-one-handed')
  const [levelText, setLevelText] = useState('')
  const [materialId, setMaterialId] = useState('shard')
  const [modifierId, setModifierId] = useState('')
  const [picks, setPicks] = useState<{ [itemId: string]: string }>({})
  const [pickedAll, setPickedAll] = useState<string | null>(null)
  const [showAllJobs, setShowAllJobs] = useState(false)
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
  const owned = purseOf(save)
  const candidates = upgradeCandidates(hero).filter((entry) => accepts(entry.item.baseId))
  const rows = [
    ...candidates.filter((entry) => entry.slot !== null || entry.queued > 0).map((entry) => ({ ...entry, count: 1 })),
    ...groupItems(candidates.filter((entry) => entry.slot === null && entry.queued === 0).map((entry) => entry.item)).map(({ item, count }) => ({
      item,
      slot: null,
      queued: 0,
      count,
    })),
  ]
  /** The material that adds the most quality among those this item's next upgrade can be paid with, else shard. */
  const bestFor = (item: ItemInstance): string => {
    let best: string | null = null
    for (const id of MATERIALS) {
      if ((owned.materials[id] ?? 0) < upgradeMaterialCost(id) || owned.gold < upgradeGold(item.itemLevel)) continue
      if (best === null || (UPGRADE_QUALITY_POINTS[id] ?? 0) > (UPGRADE_QUALITY_POINTS[best] ?? 0)) best = id
    }
    return best ?? 'shard'
  }
  const pickFor = (item: ItemInstance): string => picks[item.id] ?? bestFor(item)
  const planFor = (id: string) => planUpgradeAll(save, hero, id, accepts)
  let defaultAll = 'shard'
  for (const id of MATERIALS) {
    if (planFor(id).jobs.length > 0 && (planFor(defaultAll).jobs.length === 0 || (UPGRADE_QUALITY_POINTS[id] ?? 0) > (UPGRADE_QUALITY_POINTS[defaultAll] ?? 0))) defaultAll = id
  }
  const allMaterial = pickedAll ?? defaultAll
  const setAllMaterial = (id: string) => setPickedAll(id)
  const plan = planFor(allMaterial)
  const wornHere = candidates.filter((entry) => entry.slot !== null)
  const allBlock =
    plan.jobs.length > 0
      ? null
      : save.expedition !== null
        ? 'Crafting is closed while an expedition is running.'
        : wornHere.length === 0
          ? 'No worn item of this kind to raise.'
          : wornHere.every((entry) => entry.item.itemLevel >= hero.progress.level)
            ? "Every worn item is already at the hero's level."
            : `Not enough gold or ${allMaterial} for the next upgrade.`
  const queue = owned.craftQueue
  const shownJobs = showAllJobs ? queue : queue.slice(0, QUEUE_SHOWN)

  return (
    <>
      <h3>Crafting</h3>
      <KpiRow label="Crafting status">
        <Kpi compact label="Proficiency rank" value={<span data-testid="rank">{rank}</span>} />
        <Kpi compact label="Experience" value={hero.craftXp} />
        <Kpi compact label="Queue" value={purseOf(save).craftQueue.length} />
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
          <select className="craft-select" aria-label="Craft item" value={chosenBase} onChange={(event) => setBaseId(event.target.value)}>
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
          <select className="craft-select" aria-label="Craft material" value={materialId} onChange={(event) => setMaterialId(event.target.value)}>
            {MATERIALS.map((id) => (
              <option key={id} value={id}>
                {id} (have {purseOf(save).materials[id] ?? 0})
              </option>
            ))}
          </select>
        </label>{' '}
        <label>
          Modifier{' '}
          <select className="craft-select" aria-label="Craft modifier" value={shownModifier} onChange={(event) => setModifierId(event.target.value)}>
            <option value="">None</option>
            {save.account.recipes
              .filter((id) => {
                const modifier = ITEM_MODIFIERS[id]
                const base = itemBases[chosenBase]
                return modifier !== undefined && base !== undefined && modifierFits(modifier, base)
              })
              .map((id) => (
                <option key={id} value={id}>
                  {ITEM_MODIFIERS[id]?.name} (level {ITEM_MODIFIERS[id]?.minLevel})
                </option>
              ))}
          </select>
        </label>
      </div>
      <p className="craft-effect muted" data-testid="modifier-effect">
        {ITEM_MODIFIERS[shownModifier]?.text ?? ''}
      </p>
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

      <h4>
        Upgrade <QualityHelp />
      </h4>
      <div className="upgrade-all">
        <label>
          Queue all with{' '}
          <select className="craft-select upgrade-select" aria-label="Queue all material" value={allMaterial} onChange={(event) => setAllMaterial(event.target.value)}>
            {MATERIALS.map((id) => (
              <option key={id} value={id}>
                {id} (have {purseOf(save).materials[id] ?? 0})
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn-primary" disabled={allBlock !== null} onClick={() => setError(queueUpgradeAllFromUi(allMaterial, accepts))}>
          Queue all ({plan.jobs.length} {plan.jobs.length === 1 ? 'job' : 'jobs'})
        </button>
        <span className="upgrade-all-cost">
          {plan.jobs.length === 0 ? null : (
            <>
              <CostPill cost={{ kind: 'mat', amount: plan.material, label: allMaterial }} /> <CostPill cost={{ kind: 'gold', amount: plan.gold }} />
            </>
          )}
        </span>
        <small className="muted upgrade-all-note" data-testid="upgrade-all-note">
          {allBlock ?? 'Raises every worn item, lowest level first, one level at a time.'}
        </small>
      </div>
      {candidates.length === 0 ? <p>Nothing of this kind to upgrade.</p> : null}
      <ul className="shop-rows" aria-label="Upgrades">
        {rows.map(({ item, slot, queued, count }) => {
          const material = pickFor(item)
          const block = upgradeCheck(save, hero, item, material)
          return (
            <ShopRow
              key={item.id}
              testId="upgrade-row"
              name={
                <>
                  {itemName(item)}
                  {count > 1 ? ` ×${count}` : ''} {slot === null ? null : <Tag kind="info">Worn ({SLOT_NAMES[slot]})</Tag>}
                </>
              }
              effect={
                <dl className="upgrade-facts">
                  <dt>Level</dt>
                  <dd>
                    {item.itemLevel} → {item.itemLevel + 1}
                  </dd>
                  <dt>Quality</dt>
                  <dd>
                    {percent(item.quality)} → {percent(upgradedQuality(item.quality, material))}
                  </dd>
                  <dt>Time</dt>
                  <dd>{CRAFT_MS / 1000} s</dd>
                </dl>
              }
              note={block ?? undefined}
              costs={[
                [
                  { kind: 'mat', amount: upgradeMaterialCost(material), label: material },
                  { kind: 'gold', amount: upgradeGold(item.itemLevel) },
                ],
              ]}
              pills={queued > 0 ? <Tag kind="info" title="Upgrade jobs already queued for this item">queued +{queued}</Tag> : undefined}
              actions={
                <div className="upgrade-actions">
                  <select
                    className="craft-select upgrade-select"
                    aria-label={`Material for ${item.id}`}
                    value={material}
                    onChange={(event) => setPicks({ ...picks, [item.id]: event.target.value })}
                  >
                    {MATERIALS.map((id) => (
                      <option key={id} value={id}>
                        {id} (have {purseOf(save).materials[id] ?? 0})
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btn-primary" disabled={block !== null} aria-label={`Upgrade ${item.id}`} onClick={() => setError(queueUpgradeFromUi(item.id, material))}>
                    Queue +1
                  </button>
                </div>
              }
            />
          )
        })}
      </ul>

      <h4>Queue (all shops)</h4>
      {queue.length === 0 ? <p>Nothing is being made.</p> : null}
      <ul className="shop-rows" aria-label="Craft queue">
        {shownJobs.map((job, index) => (
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
                : `lvl ${job.item.itemLevel} → ${job.item.itemLevel + 1}`
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
      {queue.length > QUEUE_SHOWN ? (
        <button type="button" className="queue-toggle" aria-expanded={showAllJobs} onClick={() => setShowAllJobs(!showAllJobs)}>
          {showAllJobs ? 'Show fewer' : `Show all ${queue.length}`}
        </button>
      ) : null}
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
