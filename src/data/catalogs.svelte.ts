// Loaded game names and pictures, per kind, in the player's language; screens ask for what they show.
import { LANGUAGES } from '../i18n/languages'
import { catalog, language, type Entry, type Kind } from './api'

class Catalogs {
  lang = $state('en')
  offline = $state(false)
  maps = $state.raw<Partial<Record<Kind, Map<string, Entry>>>>({})
}
export const cat = new Catalogs()
const asked = new Set<string>()

/** Loads a kind's names (and descriptions, with text) once; screens read cat.maps. */
export function want(kind: Kind, text = false) {
  const key = `${cat.lang}:${kind}:${text}`
  if (asked.has(key)) return
  asked.add(key)
  catalog(kind, cat.lang, text).then(m => {
    if (!m) { cat.offline = true; return }
    cat.maps = { ...cat.maps, [kind]: new Map([...(cat.maps[kind] ?? []), ...(text ? m : [...m].filter(([id]) => !cat.maps[kind]?.has(id)))]) }
  })
}

export const entry = (kind: Kind, id: string) => cat.maps[kind]?.get(id)
export const nameOf = (kind: Kind, id: string) => entry(kind, id)?.name ?? id

/** Set at once from the saved choice or the browser: nothing arrives later to override a choice made meanwhile. */
export function initLanguage(saved?: string | null) {
  cat.lang = saved && LANGUAGES.includes(saved) ? saved : language(navigator.languages, LANGUAGES)
}
export function setLanguage(lang: string) {
  cat.lang = lang
  cat.maps = {}
}
