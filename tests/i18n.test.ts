import { expect, test } from 'vitest'
import en from '../src/i18n/en'
import { LANGUAGES, LOCALES, format } from '../src/i18n/i18n.svelte'

const holes = (v: unknown) => [...new Set(JSON.stringify(v).match(/\{\w+\}/g) ?? [])].sort()

test('every game language has every string, with the same placeholders', () => {
  expect(LANGUAGES).toEqual(['ar', 'de', 'en', 'es', 'fr', 'fr-CA', 'it', 'ja', 'ko', 'nl', 'pt-BR', 'ru', 'tr', 'zh-CN', 'zh-TW'])
  for (const lang of LANGUAGES) {
    const dict = LOCALES[lang]
    expect(Object.keys(dict).sort(), lang).toEqual(Object.keys(en).sort())
    for (const [k, v] of Object.entries(en)) expect(holes(dict[k as keyof typeof en]), `${lang} ${k}`).toEqual(holes(v))
  }
})

test('plurals follow each language', () => {
  expect([1, 3, 5].map(n => format('ru', 'top.changes', { n }))).toEqual(['1 изменение', '3 изменения', '5 изменений'])
  expect([1, 2].map(n => format('en', 'top.changes', { n }))).toEqual(['1 change', '2 changes'])
  expect(format('de', 'ch.rename', { old: 'Pip', name: 'Gerald' })).toContain('Gerald')
})
