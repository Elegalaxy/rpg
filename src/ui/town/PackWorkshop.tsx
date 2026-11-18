import { useState } from 'react'

import { CRAFT_MS, packCheck, packMaterials } from '../../persist/crafting.ts'
import { selectedHero } from '../../persist/character.ts'
import { PACKS, PACK_IDS, STACK_LIMIT_REASON, packSlots, type PackId } from '../../persist/pack.ts'
import { purseOf } from '../../persist/save.ts'
import { SUPPLY_SLOT_COUNT } from '../../sim/expedition.ts'
import { Help } from '../Help.tsx'
import { ShopRow, Tag } from '../Kit.tsx'
import { queuePackFromUi, useSaveStatus } from '../store.ts'

/** The Armorer's Backpack counter: craft a Satchel (5 slots) and then a Field Pack (6 slots). */
export function PackWorkshop() {
  const { save } = useSaveStatus()
  const hero = selectedHero(save)
  const [material, setMaterial] = useState<{ [packId: string]: string }>({})
  const [error, setError] = useState<string | null>(null)
  if (hero === null) return <p>Select a hero to craft a backpack.</p>
  const owned = purseOf(save).materials
  const slots = packSlots(hero)
  const materialFor = (id: PackId): string => {
    const options = packMaterials(id)
    return material[id] !== undefined && options.includes(material[id] ?? '') ? (material[id] ?? '') : (options.find((entry) => (owned[entry] ?? 0) >= PACKS[id].units) ?? options[0] ?? 'shard')
  }
  return (
    <>
      <h4>
        Backpack
        <Help label="About backpacks">
          A pack adds supply slots for every run: {PACKS.satchel.slots} with the Satchel, {PACKS.fieldPack.slots} with the Field Pack. A better material does not add slots; it only has to be good enough. With a pack, a run carries at most 2 of any one supply. It takes {CRAFT_MS / 1000} s in the crafting queue and is kept through reincarnation.
        </Help>
      </h4>
      <dl className="upgrade-facts" aria-label="Your backpack">
        <dt>Supply slots now</dt>
        <dd data-testid="pack-slots">{slots}</dd>
        <dt>Pack</dt>
        <dd data-testid="pack-name">{hero.pack === undefined ? 'None' : PACKS[hero.pack].name}</dd>
        {slots > SUPPLY_SLOT_COUNT ? (
          <>
            <dt>Limit</dt>
            <dd>{STACK_LIMIT_REASON}</dd>
          </>
        ) : null}
      </dl>
      <ul className="shop-rows" aria-label="Backpacks" data-testid="pack-list">
        {PACK_IDS.map((id) => {
          const def = PACKS[id]
          const mat = materialFor(id)
          const have = hero.pack === id || (id === 'satchel' && hero.pack === 'fieldPack')
          const block = packCheck(save, hero, id, mat)
          return (
            <ShopRow
              key={id}
              testId="pack-row"
              name={
                <>
                  {def.name} {have ? <Tag kind="good">Owned</Tag> : null}
                </>
              }
              effect={
                <dl className="upgrade-facts">
                  <dt>Supply slots</dt>
                  <dd>{def.slots}</dd>
                  <dt>Hero level</dt>
                  <dd>{def.minHeroLevel}</dd>
                  <dt>Material grade</dt>
                  <dd>{def.minGrade} or better</dd>
                  {def.needs !== undefined ? (
                    <>
                      <dt>Needs</dt>
                      <dd>{PACKS[def.needs].name}</dd>
                    </>
                  ) : null}
                  <dt>Time</dt>
                  <dd>{CRAFT_MS / 1000} s</dd>
                </dl>
              }
              note={have ? undefined : (block ?? undefined)}
              costs={[[{ kind: 'mat', amount: def.units, label: mat }, { kind: 'gold', amount: def.gold }]]}
              actions={
                have ? null : (
                  <div className="upgrade-actions">
                    <select
                      className="craft-select upgrade-select"
                      aria-label={`${def.name} material`}
                      value={mat}
                      onChange={(event) => setMaterial({ ...material, [id]: event.target.value })}
                    >
                      {packMaterials(id).map((entry) => (
                        <option key={entry} value={entry}>
                          {entry} (have {owned[entry] ?? 0})
                        </option>
                      ))}
                    </select>
                    <button type="button" className="btn-primary" disabled={block !== null} aria-label={`Craft ${def.name}`} onClick={() => setError(queuePackFromUi(id, mat))}>
                      Craft
                    </button>
                  </div>
                )
              }
            />
          )
        })}
      </ul>
      {error !== null ? <p role="alert">{error}</p> : null}
    </>
  )
}
