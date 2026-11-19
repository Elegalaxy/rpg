import { writeFileSync } from 'node:fs'

import { HERO_CLASSES, type HeroClass } from '../sim/constants.ts'

import { runSlotsMatrix, type SlotRow } from './slots.ts'

/**
 * Shard runner for the tuned fifth-skill measurement (Step 13.34 follow-up). One process per class and seed:
 * `npx tsx src/harness/slotsTuned.ts <class> <seed> <runs> <out.json> [skill,skill]`. Runs `four` and the two tuned variants for every
 * candidate of the class at the elite fights of the prepared and prepared-crafted tiers, and writes the rows as JSON.
 * Merge the shards with the means over the seeds. Not part of the default CLI.
 */
const [classArg, seedArg, runsArg, outArg, skillsArg] = process.argv.slice(2)
const classId = HERO_CLASSES.find((id) => id === classArg) as HeroClass | undefined
const seed = Number(seedArg)
const runs = Number(runsArg)
if (classId === undefined || !Number.isInteger(seed) || !Number.isInteger(runs) || outArg === undefined) {
  console.error('usage: tsx src/harness/slotsTuned.ts <class> <seed> <runs> <out.json> [skill,skill]')
  process.exit(1)
}
const rows: SlotRow[] = runSlotsMatrix(seed, runs, { classes: [classId], variants: ['four', 'tuned-last', 'tuned-first'], skills: skillsArg?.split(',') })
writeFileSync(outArg, JSON.stringify({ classId, seed, runs, rows }))
console.log(`[slots-tuned] ${classId} seed ${seed} runs ${runs}: ${rows.length} rows -> ${outArg}`)
