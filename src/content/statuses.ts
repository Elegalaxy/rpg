import {
  BLEED_ACTIONS_PER_STACK,
  BLEED_MAX_STACKS,
  BURN_DURATION_SECONDS,
  BURN_MAX_INTENSITY,
  BURN_TICK_SECONDS,
  CHILL_DURATION_SECONDS,
  CHILL_MAX_STACKS,
  CHILL_SLOW_BY_STACK,
  EXPOSE_DURATION_SECONDS,
  POISON_DURATION_SECONDS,
  POISON_MAX_STACKS,
  POISON_TICK_SECONDS,
  STUN_DELAY_SECONDS,
} from '../sim/constants.ts'
import type { StatusDef } from '../sim/types.ts'

const bleed = {
  id: 'bleed',
  name: 'Bleed',
  kind: 'bleed',
  maxStacks: BLEED_MAX_STACKS,
  actionsPerStack: BLEED_ACTIONS_PER_STACK,
} satisfies StatusDef

const poison = {
  id: 'poison',
  name: 'Poison',
  kind: 'poison',
  maxStacks: POISON_MAX_STACKS,
  durationSeconds: POISON_DURATION_SECONDS,
  tickSeconds: POISON_TICK_SECONDS,
} satisfies StatusDef

const burn = {
  id: 'burn',
  name: 'Burn',
  kind: 'burn',
  maxIntensity: BURN_MAX_INTENSITY,
  durationSeconds: BURN_DURATION_SECONDS,
  tickSeconds: BURN_TICK_SECONDS,
} satisfies StatusDef

const chill = {
  id: 'chill',
  name: 'Chill',
  kind: 'chill',
  maxStacks: CHILL_MAX_STACKS,
  durationSeconds: CHILL_DURATION_SECONDS,
  slowByStack: CHILL_SLOW_BY_STACK,
} satisfies StatusDef

const stun = {
  id: 'stun',
  name: 'Stun',
  kind: 'stun',
  delaySeconds: STUN_DELAY_SECONDS,
} satisfies StatusDef

const mark = {
  id: 'mark',
  name: 'Mark',
  kind: 'mark',
} satisfies StatusDef

const expose = {
  id: 'expose',
  name: 'Expose',
  kind: 'expose',
  durationSeconds: EXPOSE_DURATION_SECONDS,
} satisfies StatusDef

export const statuses: { [id: string]: StatusDef } = {
  [bleed.id]: bleed,
  [poison.id]: poison,
  [burn.id]: burn,
  [chill.id]: chill,
  [stun.id]: stun,
  [mark.id]: mark,
  [expose.id]: expose,
}
