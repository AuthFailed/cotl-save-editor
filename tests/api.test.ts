import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { API, catalog, clearCache, iconUrl, language, saveSchemaFor } from '../src/data/api'
import { schema } from './synthetic'

let served: Record<string, unknown>
beforeEach(() => {
  clearCache()
  served = {}
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (!(url in served)) return new Response('', { status: 404 })
    return new Response(JSON.stringify(served[url]), { status: 200 })
  }))
})
afterEach(() => vi.unstubAllGlobals())

test('catalog reads the slim per-language list; with text, the full list in that language', async () => {
  served[`${API}ru/items.json`] = [{ id: 'LOG', name: 'Бревно', thumb: 'icons/items/64/LOG.png' }]
  served[`${API}traits.json`] = [{ id: 'AnimalLover', namePlain: { en: 'Animal Lover', ru: 'Любитель' }, descriptionPlain: { en: 'Loves animals' }, thumb: null }]
  expect((await catalog('items', 'ru'))?.get('LOG')).toEqual({ id: 'LOG', name: 'Бревно', thumb: 'icons/items/64/LOG.png' })
  expect((await catalog('traits', 'ru', true))?.get('AnimalLover')).toEqual({ id: 'AnimalLover', name: 'Любитель', thumb: null, description: 'Loves animals' })
})

test('an unreachable API gives null, not an error', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline') }))
  expect(await catalog('items', 'en')).toBeNull()
})

test('saveSchemaFor picks from the published versions and falls back to the bundled one', async () => {
  served[`${API}index.json`] = { languages: ['en'], saveSchemas: ['1.5.24', '1.5.26.1058'] }
  served[`${API}save-schema/1.5.24.json`] = { ...schema, gameVersion: '1.5.24' }
  expect(await saveSchemaFor('1.5.25')).toMatchObject({ schema: { gameVersion: '1.5.24' }, exact: false })
  expect(await saveSchemaFor('1.5.26.1058')).toMatchObject({ schema: { gameVersion: '1.5.26.1058' }, exact: true })
  clearCache()
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline') }))
  expect(await saveSchemaFor('1.5.24')).toMatchObject({ schema: { gameVersion: '1.5.26.1058' }, exact: false })
})

test('language matches the browser to a game language', () => {
  const langs = ['en', 'ru', 'pt-BR', 'zh-CN', 'zh-TW', 'fr', 'fr-CA']
  expect([language(['pt-BR'], langs), language(['zh-Hans-CN'], langs), language(['zh-Hant-TW'], langs), language(['de-AT'], langs), language(['fr-BE'], langs)])
    .toEqual(['pt-BR', 'zh-CN', 'zh-TW', 'en', 'fr'])
})

test('icon paths resolve against the API', () => {
  expect([iconUrl('icons/items/64/LOG.png'), iconUrl(null)]).toEqual([`${API}icons/items/64/LOG.png`, null])
})

test('game names lose their colour markup', async () => {
  served[`${API}en/items.json`] = [{ id: 'BROKEN_WEAPON_DAGGER', name: '<color=#FFD201>Blunt</color> Dagger', thumb: null }]
  expect((await catalog('items', 'en'))?.get('BROKEN_WEAPON_DAGGER')?.name).toBe('Blunt Dagger')
})
