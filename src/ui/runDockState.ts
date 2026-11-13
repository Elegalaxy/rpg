import type { SaveData } from '../persist/save.ts'

/** Whether the dock is folded up. Local UI state only; never part of the save. */
export const DOCK_KEY = 'rpg.runDockCollapsed'

/** Folded by default, so a first run does not cover the page on a phone. */
export function readCollapsed(): boolean {
  try {
    const stored = globalThis.localStorage?.getItem(DOCK_KEY)
    return stored === null || stored === undefined ? true : stored === '1'
  } catch {
    return true
  }
}

export function writeCollapsed(collapsed: boolean): void {
  try {
    globalThis.localStorage?.setItem(DOCK_KEY, collapsed ? '1' : '0')
  } catch {
    // Storage can be blocked; the dock then simply opens folded again next visit.
  }
}

/** The dock shows while the selected hero has a live run, on every page except the Map (which has the full panel). */
export function dockVisible(save: SaveData, tab: string): boolean {
  return tab !== 'map' && save.expedition !== null && save.expedition.outcome === 'ongoing'
}
