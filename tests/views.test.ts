import { describe, expect, test } from 'vitest'
import { openSave } from '../src/codec/formats'
import { fromTree, jsonToTree } from '../src/model/json'
import { followers, skinId } from '../src/model/views'
import { schema, syntheticRoots } from './synthetic'
import { hasSaves, readSave } from './util'

test('followers: status from needs, age and death', () => {
  const list = followers(schema, syntheticRoots().slot)
  expect(list.map(f => [f.name, f.status, f.level, f.skin])).toEqual([
    ['Pip', 'Hungry', 3, 'Axolotl'], ['Ash', 'Elderly', 9, 'Fox'], ['Thistle', 'Dead', 1, 'Hedgehog']])
})

test('a dead follower\'s cause of death and old age', () => {
  const dead = (extra: Record<string, unknown>) => followers(schema, jsonToTree(schema, { Followers: [{ ID: 1 }], Followers_Dead: [{ ID: 2, ...extra }] }))
  const list = followers(schema, syntheticRoots().slot)
  expect(list.map(f => [f.id, f.death, f.old])).toEqual([[1, null, false], [2, null, true], [3, 'DiedOfOldAge', true]])
  expect(dead({ LeavingCult: true }).map(f => f.death)).toEqual([null, 'LeavingCult'])
  expect(dead({ DiedOfIllness: false }).map(f => f.death)).toEqual([null, null])
  expect(dead({ DiedFromMurder: true, LeavingCult: true }).map(f => f.death)).toEqual([null, 'DiedFromMurder'])
  expect(followers(schema, jsonToTree(schema, { Followers: [{ ID: 1, DiedOfOldAge: true }] }))[0].death).toBe(null)
})

test('a skin variant maps to its API id', () => {
  const api = new Set(['Unicorn', 'Fox'])
  expect([skinId('Unicorn2', api), skinId('Fox', api), skinId('Nope3', api)]).toEqual(['Unicorn', 'Fox', null])
})

test('JSON saves map onto the schema and back, keeping keys the schema lacks', () => {
  const json = { CultName: 'Old Cult', Unknown: [1, 2], Followers: [{ ID: 5, _name: 'Pip', SkinName: 'Fox', Extra: true }] }
  const tree = jsonToTree(schema, json)
  expect(followers(schema, tree)[0]).toMatchObject({ id: 5, name: 'Pip', skin: 'Fox' })
  expect(fromTree(schema, tree, json)).toEqual(json)
})

describe.skipIf(!hasSaves)('real saves', () => {
  test('slot_0.json round-trips through the adapter and reads its followers', async () => {
    const o = await openSave('slot_0.json', readSave('slot_0.json'))
    const json = (o.data as Extract<typeof o.data, { kind: 'json' }>).root
    const tree = jsonToTree(schema, json)
    expect(fromTree(schema, tree, json)).toEqual(json)
    expect(followers(schema, tree).length).toBeGreaterThan(0)
  })
})

test('save form names map to API ids the way the API builds them', () => {
  const api = new Set(['Fennec_Fox', 'Unicorn', 'Fox'])
  expect([skinId('Fennec Fox3', api), skinId('Fennec Fox', api), skinId('Unicorn2', api), skinId('Boss Death Cat', api)])
    .toEqual(['Fennec_Fox', 'Fennec_Fox', 'Unicorn', null])
})

test('published variants map a form name exactly, before any guessing', () => {
  const api = new Set(['CultLeader_1'])
  const variants = new Map([['CultLeader 1 Healed', 'CultLeader_1']])
  expect([skinId('CultLeader 1 Healed', api), skinId('CultLeader 1 Healed', api, variants)]).toEqual([null, 'CultLeader_1'])
})

test('with published variants loaded, only a skin name maps, and an API id written into a save does not', () => {
  const api = new Set(['Fennec_Fox']), variants = new Map([['Fennec Fox3', 'Fennec_Fox']])
  expect([skinId('Fennec_Fox', api, variants), skinId('Fennec Fox3', api, variants)]).toEqual([null, 'Fennec_Fox'])
})
