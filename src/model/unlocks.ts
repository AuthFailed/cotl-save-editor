// What can be unlocked, where the save keeps it, and which screen shows it: one list for grids, details and search.
import type { Full, Kind } from '../data/api'

export interface Unlock {
  tab: string; page: 'cult' | 'collection'; kind: Kind; field: string
  saveId?: (e: Full) => string; owns?: (e: Full) => string[]; include?: (e: Full) => boolean; groupBy?: (e: Full) => string
}

const spine = (e: Full) => (e.variants as string[] | undefined) ?? []

export const UNLOCKS: Unlock[] = [
  { tab: 'tarot', page: 'collection', kind: 'tarot', field: 'PlayerFoundTrinkets', groupBy: e => String((e.groups as string[])?.[0] ?? '') },
  { tab: 'relics', page: 'collection', kind: 'relics', field: 'PlayerFoundRelics' },
  { tab: 'weapons', page: 'collection', kind: 'weapons', field: 'WeaponPool', groupBy: e => String(e.family ?? '') },
  { tab: 'curses', page: 'collection', kind: 'curses', field: 'CursePool', groupBy: e => String(e.family ?? '') },
  { tab: 'fleeces', page: 'collection', kind: 'fleeces', field: 'UnlockedFleeces', saveId: e => String(e.fleece) },
  { tab: 'outfits', page: 'collection', kind: 'outfits', field: 'UnlockedClothing', groupBy: e => String(e.tab ?? '') },
  // a save holds Spine skin names (Fennec Fox), not API ids (Fennec_Fox); the game writes the first
  { tab: 'forms', page: 'collection', kind: 'skins', field: 'FollowerSkinsUnlocked', include: e => spine(e).length > 0, saveId: e => spine(e)[0],
    owns: spine, groupBy: e => String(e.unlock ?? '') },
  { tab: 'doctrines', page: 'cult', kind: 'doctrines', field: 'DoctrineUnlockedUpgrades', groupBy: e => String(e.category ?? '') },
  { tab: 'rituals', page: 'cult', kind: 'rituals', field: 'UnlockedUpgrades', groupBy: e => String(e.group ?? '') },
  { tab: 'structures', page: 'cult', kind: 'structures', field: 'UnlockedStructures', include: e => e.buildable === true,
    groupBy: e => String(e.menu ?? '').split('/')[0] },
  { tab: 'crown', page: 'cult', kind: 'crownAbilities', field: 'UnlockedUpgrades' },
]

export const unlockOf = (kind: Kind) => UNLOCKS.find(u => u.kind === kind)
export const unlockTab = (tab: string) => UNLOCKS.find(u => u.tab === tab)!
export const saveIdOf = (u: Unlock, e: Full) => (u.saveId ? u.saveId(e) : e.id)
/** The entry the save holds for e, if any: a form counts as owned by any of its skin names. */
export const heldOf = (u: Unlock, e: Full, have: Set<string>) => (u.owns?.(e) ?? [saveIdOf(u, e)]).find(s => have.has(s))
