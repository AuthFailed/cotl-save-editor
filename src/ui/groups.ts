// API group ids as translated headings: doctrine categories are sermons (named by the API), the rest group.* strings.
import { cat, nameOf } from '../data/catalogs.svelte'
import en from '../i18n/en'
import { t, type Key } from '../i18n/i18n.svelte'

const ALIAS: Record<string, string> = { DLC: 'dlc', Major_DLC: 'majorDlc', MajorDLC: 'majorDlc', Other: 'other', SpecialEvents: 'specialEvents',
  Aesthetic: 'aesthetic', Faith: 'faith', Follower: 'follower', Special: 'special' }

export function groupName(kind: string, g: string): string {
  if (kind === 'doctrines' && cat.maps.sermons?.has(g)) return nameOf('sermons', g)
  const dungeon = /^Dungeon(\d+)$/.exec(g)
  if (dungeon) return t('group.dungeon', { n: dungeon[1] })
  const key = `group.${ALIAS[g] ?? g}` as Key
  return key in en ? t(key) : g
}
