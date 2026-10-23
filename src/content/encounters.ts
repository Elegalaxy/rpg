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

/** Two level-6 Starved Wolves. */
export const wolfPair: EncounterDef = {
  id: 'wolf-pair',
  name: 'Starved Wolf Pair',
  members: [
    { enemyId: 'starved-wolf', slot: 0, level: 6 },
    { enemyId: 'starved-wolf', slot: 1, level: 6 },
  ],
}

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

export const encounters: { [id: string]: EncounterDef } = {
  [wolfPair.id]: wolfPair,
  [groveMixed.id]: groveMixed,
  [bastionMixed.id]: bastionMixed,
}
