// Game names, pictures and save schemas from api.cotl.info. Every lookup degrades to null when it's unreachable.
import fallback from '../model/fallback-schema.json'
import { pickSchema, type SaveSchema } from '../schema/schema'

export const API = 'https://api.cotl.info/v1/'
export type Kind = 'items' | 'structures' | 'skins' | 'rituals' | 'doctrines' | 'sermons' | 'tarot' | 'relics' | 'weapons'
  | 'curses' | 'traits' | 'outfits' | 'crownAbilities' | 'fleeces'
export interface Entry { id: string; name: string; thumb: string | null; description?: string }

const BUNDLED = fallback as SaveSchema
const cache = new Map<string, Promise<unknown>>()
export const clearCache = () => cache.clear()

function json<T>(path: string): Promise<T | null> {
  if (!cache.has(path)) {
    cache.set(path, fetch(API + path).then(r => (r.ok ? r.json() : null)).catch(() => null))
  }
  return cache.get(path) as Promise<T | null>
}

/** Game text without its markup (<color=#FFD201>…</color>, <sprite …>). */
export const plain = (s: string) => s.replace(/<[^>]*>/g, '').trim()

export type Full = { id: string; namePlain: Record<string, string>; descriptionPlain?: Record<string, string>; thumb: string | null } & Record<string, unknown>

/** id → name and thumbnail in one language; with text, also the description (from the full list). */
export async function catalog(kind: Kind, lang: string, text = false): Promise<Map<string, Entry> | null> {
  if (!text) {
    const slim = await json<Entry[]>(`${lang}/${kind}.json`)
    return slim && new Map(slim.map(e => [e.id, { ...e, name: plain(e.name) }]))
  }
  const full = await json<Full[]>(`${kind}.json`)
  return full && new Map(full.map(e => [e.id, {
    id: e.id, name: e.namePlain[lang] ?? e.namePlain.en ?? e.id, thumb: e.thumb,
    description: e.descriptionPlain?.[lang] ?? e.descriptionPlain?.en ?? '',
  }]))
}

/** Every entity of a kind with all its fields (e.g. a fleece's number). */
export const entities = (kind: Kind) => json<Full[]>(`${kind}.json`)

export const iconUrl = (path: string | null) => (path ? API + path : null)

export async function saveSchemaFor(version: string | null): Promise<{ schema: SaveSchema; exact: boolean }> {
  const index = await json<{ saveSchemas?: string[] }>('index.json')
  const published = index?.saveSchemas ?? []
  const pick = pickSchema([...new Set([...published, BUNDLED.gameVersion])], version)
  if (pick.version !== BUNDLED.gameVersion) {
    const schema = await json<SaveSchema>(`save-schema/${pick.version}.json`)
    if (schema) return { schema, exact: pick.exact }
  }
  return { schema: BUNDLED, exact: pick.version === BUNDLED.gameVersion && pick.exact }
}

/** The first browser language the game has: exact, by region (zh-Hans-CN → zh-CN), by language, else English. */
export function language(wanted: readonly string[], available: string[]): string {
  for (const tag of wanted) {
    const parts = tag.split('-')
    const region = parts.slice(1).find(p => /^[A-Z]{2}$/.test(p))
    const tries = [tag, region && `${parts[0]}-${region}`, parts[0]]
    const hit = tries.find(t => t && available.includes(t)) ?? available.find(a => a.startsWith(parts[0] + '-'))
    if (hit) return hit
  }
  return 'en'
}
