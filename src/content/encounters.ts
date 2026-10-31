export type EncounterMember = {
  enemyId: string
  slot: number
  level: number
}

export type EncounterDef = {
  id: string
  name: string
  members: readonly EncounterMember[]
}

/** Two level-3 Fracture Shardlings. The Splintered Road opens with this pair. */
export const shardlingPair: EncounterDef = {
  id: 'shardling-pair',
  name: 'Fracture Shardling Pair',
  members: [
    { enemyId: 'fracture-shardling', slot: 0, level: 3 },
    { enemyId: 'fracture-shardling', slot: 1, level: 3 },
  ],
}

/** Two level-6 Starved Wolves. */
export const wolfPair: EncounterDef = {
  id: 'wolf-pair',
  name: 'Starved Wolf Pair',
  members: [
    { enemyId: 'starved-wolf', slot: 0, level: 6 },
    { enemyId: 'starved-wolf', slot: 1, level: 6 },
  ],
}

/** One level-6 Deserter. */
export const deserterEncounter: EncounterDef = {
  id: 'deserter',
  name: 'Deserter',
  members: [{ enemyId: 'deserter', slot: 0, level: 6 }],
}

/** One level-5 Shardling, one level-5 Wolf, and one level-5 Deserter. */
export const roadMixed: EncounterDef = {
  id: 'road-mixed',
  name: 'Splintered Road Mixed',
  members: [
    { enemyId: 'fracture-shardling', slot: 0, level: 5 },
    { enemyId: 'starved-wolf', slot: 1, level: 5 },
    { enemyId: 'deserter', slot: 2, level: 5 },
  ],
}

/** Splintered Road encounters 0, 1, and 2. These do not roll. */
export const splinteredRoadOpening: readonly EncounterDef[] = [shardlingPair, wolfPair, deserterEncounter]

/**
 * Equal draw from the fourth encounter on.
 * The index is `Math.floor(nextFloat * 4)` in this order.
 */
export const splinteredRoadDraw: readonly EncounterDef[] = [
  shardlingPair,
  wolfPair,
  deserterEncounter,
  roadMixed,
]

/** One level-10 Thornbeast and one level-10 Blight Spider. */
export const groveMixed: EncounterDef = {
  id: 'grove-mixed',
  name: 'Withered Grove Mixed',
  members: [
    { enemyId: 'thornbeast', slot: 0, level: 10 },
    { enemyId: 'blight-spider', slot: 1, level: 10 },
  ],
}

/** One level-12 Hollow Sentry and one level-12 Fallen Arbalist. */
export const bastionMixed: EncounterDef = {
  id: 'bastion-mixed',
  name: 'Fallen Bastion Mixed',
  members: [
    { enemyId: 'hollow-sentry', slot: 0, level: 12 },
    { enemyId: 'fallen-arbalist', slot: 1, level: 12 },
  ],
}

/** The Withered Grove elite, level 14. The Fracture Gate needs this defeat. */
export const rootmawEncounter: EncounterDef = {
  id: 'rootmaw-stalker',
  name: 'Rootmaw Stalker',
  members: [{ enemyId: 'rootmaw-stalker', slot: 0, level: 14 }],
}

/** The Fallen Bastion elite, level 16. The Fracture Gate needs this defeat. */
export const echoKnightEncounter: EncounterDef = {
  id: 'echo-knight',
  name: 'Echo Knight',
  members: [{ enemyId: 'echo-knight', slot: 0, level: 16 }],
}

/** The regional boss at Echo rank 0, level 20. */
export const wardenEncounter: EncounterDef = {
  id: 'fractured-warden',
  name: 'The Fractured Warden',
  members: [{ enemyId: 'fractured-warden', slot: 0, level: 20 }],
}

export const encounters: { [id: string]: EncounterDef } = {
  [shardlingPair.id]: shardlingPair,
  [wolfPair.id]: wolfPair,
  [deserterEncounter.id]: deserterEncounter,
  [roadMixed.id]: roadMixed,
  [groveMixed.id]: groveMixed,
  [bastionMixed.id]: bastionMixed,
  [rootmawEncounter.id]: rootmawEncounter,
  [echoKnightEncounter.id]: echoKnightEncounter,
  [wardenEncounter.id]: wardenEncounter,
}
