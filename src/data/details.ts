// Everything the game says about one thing, in one language, for the details card.
import type { Full, Kind } from './api'
import { plain } from './api'
import { nameOf } from './catalogs.svelte'
import { t } from '../i18n/i18n.svelte'
import { groupName } from '../ui/groups'

export interface Details { name: string; description: string; lore: string; facts: [string, string][]; levels: string[] }

const text = (m: unknown, lang: string) => {
  const r = m as Record<string, string> | undefined
  return plain(r?.[lang] ?? r?.en ?? '')
}

export function describe(kind: Kind, e: Full, lang: string): Details {
  const facts: [string, string][] = []
  const cost = e.cost as { item: string; quantity: number }[] | undefined
  if (cost?.length) facts.push([t('info.cost'), cost.map(c => `${nameOf('items', c.item)} ×${c.quantity}`).join(', ')])
  if (kind === 'items') {
    const used = e.usedIn as Record<string, string[]> | undefined
    const n = used ? Object.values(used).reduce((a, l) => a + l.length, 0) : 0
    if (n) facts.push([t('info.usedIn'), String(n)])
    const meal = e.meal as { satiation?: number } | null
    if (meal?.satiation) facts.push([t('info.satiation'), String(meal.satiation)])
    const crop = e.crop as { growthTime?: number } | null
    if (crop?.growthTime) facts.push([t('info.growth'), t('info.phases', { n: crop.growthTime })])
  }
  if (kind === 'traits') facts.push(['', e.positive ? t('info.good') : t('info.bad')])
  if (kind === 'doctrines' && e.category) facts.push([t('info.sermon'), groupName('doctrines', String(e.category))])
  if (kind === 'skins' && e.unlock) facts.push([t('info.foundIn'), groupName('skins', String(e.unlock))])
  const levels = ((e.levels as { descriptionPlain: Record<string, string> }[] | undefined) ?? []).map(l => text(l.descriptionPlain, lang))
  return { name: text(e.namePlain, lang) || e.id, description: text(e.descriptionPlain, lang), lore: text(e.lore, lang), facts, levels }
}
