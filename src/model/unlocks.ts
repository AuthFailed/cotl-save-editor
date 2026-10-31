// What can be unlocked, where the save keeps it, and which screen shows it: one list for grids, details and search.
import type { Full, Kind } from '../data/api'

export interface Unlock {
  tab: string; page: 'cult' | 'collection'; kind: Kind; field: string; enumName: string | null
  saveId?: (e: Full) => string; include?: (e: Full) => boolean; groupBy?: (e: Full) => string
}

export const UNLOCKS: Unlock[] = [
  { tab: 'tarot', page: 'collection', kind: 'tarot', field: 'PlayerFoundTrinkets', enumName: 'TarotCards.Card', groupBy: e => String((e.groups as string[])?.[0] ?? '') },
  { tab: 'relics', page: 'collection', kind: 'relics', field: 'PlayerFoundRelics', enumName: 'RelicType' },
  { tab: 'weapons', page: 'collection', kind: 'weapons', field: 'WeaponPool', enumName: 'EquipmentType', groupBy: e => String(e.family ?? '') },
  { tab: 'curses', page: 'collection', kind: 'curses', field: 'CursePool', enumName: 'EquipmentType', groupBy: e => String(e.family ?? '') },
  { tab: 'fleeces', page: 'collection', kind: 'fleeces', field: 'UnlockedFleeces', enumName: null, saveId: e => String(e.fleece) },
  { tab: 'outfits', page: 'collection', kind: 'outfits', field: 'UnlockedClothing', enumName: 'FollowerClothingType', groupBy: e => String(e.tab ?? '') },
  { tab: 'forms', page: 'collection', kind: 'skins', field: 'FollowerSkinsUnlocked', enumName: null, groupBy: e => String(e.unlock ?? '') },
  { tab: 'doctrines', page: 'cult', kind: 'doctrines', field: 'DoctrineUnlockedUpgrades', enumName: 'DoctrineUpgradeSystem.DoctrineType', groupBy: e => String(e.category ?? '') },
  { tab: 'rituals', page: 'cult', kind: 'rituals', field: 'UnlockedUpgrades', enumName: 'UpgradeSystem.Type', groupBy: e => String(e.group ?? '') },
  { tab: 'structures', page: 'cult', kind: 'structures', field: 'UnlockedStructures', enumName: 'StructureBrain.TYPES', include: e => e.buildable === true,
    groupBy: e => String(e.menu ?? '').split('/')[0] },
  { tab: 'crown', page: 'cult', kind: 'crownAbilities', field: 'UnlockedUpgrades', enumName: 'UpgradeSystem.Type' },
]

export const unlockOf = (kind: Kind) => UNLOCKS.find(u => u.kind === kind)
export const unlockTab = (tab: string) => UNLOCKS.find(u => u.tab === tab)!
export const saveIdOf = (u: Unlock, e: Full) => (u.saveId ? u.saveId(e) : e.id)
