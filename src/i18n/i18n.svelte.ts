// The interface in every language the game ships, switched together with the game's own names (cat.lang).
import { cat } from '../data/catalogs.svelte'
import ar from './ar'
import de from './de'
import en, { type Dict, type Plural } from './en'
import es from './es'
import fr from './fr'
import frCA from './fr-CA'
import it from './it'
import ja from './ja'
import ko from './ko'
import nl from './nl'
import ptBR from './pt-BR'
import ru from './ru'
import tr from './tr'
import zhCN from './zh-CN'
import zhTW from './zh-TW'

export type Key = keyof typeof en
export const LOCALES: Record<string, Dict> = {
  ar, de, en, es, fr, 'fr-CA': frCA, it, ja, ko, nl, 'pt-BR': ptBR, ru, tr, 'zh-CN': zhCN, 'zh-TW': zhTW,
}
export { LANGUAGES } from './languages'
export const RTL = new Set(['ar'])

export function format(lang: string, key: Key, params: Record<string, string | number> = {}): string {
  const v = LOCALES[lang]?.[key] ?? en[key]
  const s = typeof v === 'string' ? v : (v as Plural)[new Intl.PluralRules(lang).select(Number(params.n)) as keyof Plural] ?? (v as Plural).other
  return s.replace(/\{(\w+)\}/g, (hole, k) => (k in params ? String(params[k]) : hole))
}

/** A string in the current language; reading cat.lang makes templates follow a language switch. */
export const t = (key: Key, params?: Record<string, string | number>) => format(cat.lang, key, params)
