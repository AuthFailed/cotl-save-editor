import { describe, expect, test } from 'vitest'
import { openSave } from '../src/codec/formats'
import { encodeMp, toPlain, type MpNode } from '../src/codec/msgpack'
import { jsonToTree } from '../src/model/json'
import { field, fit, gameVersionOf, get, moved, nameAt, pickSchema, type SaveSchema } from '../src/schema/schema'
import schemaJson from './fixtures/save-schema-1.5.26.json'
import { arr, at, filled, int, map, shifted, str, syntheticRoots } from './synthetic'
import { hasSaves, readSave } from './util'

const schema = schemaJson as SaveSchema

test('pickSchema: exact, newest older, or the closest with exact false', () => {
  const v = ['1.5.24', '1.5.26.1058']
  expect(pickSchema(v, '1.5.26.1058')).toEqual({ version: '1.5.26.1058', exact: true })
  expect(pickSchema(v, '1.5.25.1049')).toEqual({ version: '1.5.24', exact: false })
  expect(pickSchema(v, '1.5.20')).toEqual({ version: '1.5.24', exact: false })
  expect(pickSchema(v, '1.6')).toEqual({ version: '1.5.26.1058', exact: false })
  expect(pickSchema(v, null)).toEqual({ version: '1.5.26.1058', exact: false })
  expect(pickSchema(['1.5.24'], '1.5.24.0')).toEqual({ version: '1.5.24', exact: true })
})

test('names and fields resolve', () => {
  expect(nameAt(schema, 'DataManager', 1109)).toBe('Followers')
  expect(nameAt(schema, 'DataManager', 1396)).toBe('ShrineGhostJuiceInAir')
  expect(nameAt(schema, 'DataManager', 5000)).toBe('#5000')
  expect(nameAt(schema, 'NoSuchType', 3)).toBe('#3')
  expect(field(schema, 'DataManager', 'TwitchSettings')?.key).toBe(325)
  expect(field(schema, 'DataManager', 'Nope')).toBeUndefined()
})

test('get walks objects, lists and nil', () => {
  const s = (v: string): MpNode => ({ t: 'str', w: 'fix', v })
  const follower: MpNode = { t: 'arr', w: 'fix', v: [{ t: 'int', w: 'pfix', v: 7 }, s('Pip')] }
  const root: MpNode = { t: 'arr', w: 'a16', v: Array.from({ length: 1110 }, (_, i): MpNode =>
    i === 1109 ? { t: 'arr', w: 'fix', v: [follower] } : { t: 'nil' }) }
  expect(get(schema, root, 'DataManager', ['Followers', '0', '_name'])).toEqual({ node: s('Pip'), type: 'string' })
  expect(get(schema, root, 'DataManager', ['Followers', '3', '_name'])).toBeUndefined()
  expect(get(schema, root, 'DataManager', ['CultName'])).toEqual({ node: { t: 'nil' }, type: 'string' })
  expect(get(schema, root, 'DataManager', ['items', '0'])).toBeUndefined()
  expect(encodeMp(root).length).toBeGreaterThan(0)
})

const slot = (tweak?: (slot: MpNode) => MpNode) => syntheticRoots(undefined, tweak).slot
const nil: MpNode = { t: 'nil' }

test('a save that matches its schema has no misfits, sparse or filled', () => {
  expect(fit(schema, slot())).toEqual([])
  expect(fit(schema, filled(slot()))).toEqual([])
})

test('a list in an int32 field is one misfit at that field, not a move', () => {
  const node = arr([int(1)]), found = fit(schema, slot(at('playerDeaths', node)))
  expect(found.map(m => [m.field, m.union, m.node === node])).toEqual([['DataManager.playerDeaths', false, true]])
  expect(moved(found)).toBeNull()
})

test('a union-shaped objective is locked whole, as a union', () => {
  const el = arr([int(0), arr([str('a'), { t: 'bool', v: true }])]), found = fit(schema, slot(at('Objectives', arr([el]))))
  expect(found.map(m => [m.field, m.union, m.node === el])).toEqual([['ObjectivesData.GroupId', true, true]])
  expect(moved(found)).toBeNull()
})

test('keys shifted by one are a move, named from the top', () => {
  const fields = moved(fit(schema, slot(shifted)))
  expect(fields?.length).toBeGreaterThan(5)
  expect(fields?.[0]).toMatch(/^DataManager\./)
})

test('nil fits any field and anything fits an unchecked one; bytes, nullable and map values are checked', () => {
  const tiny: SaveSchema = { gameVersion: '1', roots: { slot: 'S', meta: 'M' }, enums: {}, types: { S: { fields: [
    { key: 0, name: 'n', type: 'int32' }, { key: 1, name: 'b', type: 'bool' }, { key: 2, name: 'o', type: { other: 'UnityEngine.Vector2' } },
    { key: 3, name: 'raw', type: 'bytes' }, { key: 4, name: 'maybe', type: { nullable: 'int32' } }, { key: 5, name: 'm', type: { map: ['string', 'int32'] } }] } } }
  expect(fit(tiny, arr([nil, nil, arr([]), nil, int(1), map([[str('k'), int(2)]])]))).toEqual([])
  expect(fit(tiny, arr([nil, nil, str('x'), str('x'), str('x'), map([[str('k'), str('v')]])])).map(m => m.field)).toEqual(['S.raw', 'S.maybe', 'S.m'])
})

describe.skipIf(!hasSaves)('real saves', () => {
  const rootOf = async (n: string) => {
    const o = await openSave(n, readSave(n))
    return o.data.kind === 'msgpack' ? o.data.root : jsonToTree(schema, o.data.root)
  }
  test('slot_0.mp misfits only in unions and two StoryObjectiveData fields, none at the top, in under 50 ms', async () => {
    const root = await rootOf('slot_0.mp')
    const start = performance.now(), found = fit(schema, root), ms = performance.now() - start
    expect(new Set(found.filter(m => !m.union).map(m => m.field))).toEqual(new Set(['StoryObjectiveData.ChilldStoryItems', 'StoryObjectiveData.AssetName']))
    expect(found.some(m => m.field.startsWith('DataManager.'))).toBe(false)
    expect(found.filter(m => m.field === 'ObjectivesData.GroupId').every(m => m.union)).toBe(true)
    expect(found.some(m => m.field === 'ObjectivesData.GroupId')).toBe(true)
    expect(moved(found)).toBeNull()
    expect(ms).toBeLessThan(50)
    const v = (root as Extract<MpNode, { t: 'arr' }>).v.slice()
    v.splice(600, 0, nil)
    expect(moved(fit(schema, { ...root as Extract<MpNode, { t: 'arr' }>, v }))).not.toBeNull()
  })
  test('slot_10.mp misfits only in unions; the JSON saves not at all', async () => {
    const found = fit(schema, await rootOf('slot_10.mp'))
    expect([found.length > 0, found.every(m => m.union), moved(found)]).toEqual([true, true, null])
    for (const n of ['slot_0.json', 'slot_1.json']) expect(fit(schema, await rootOf(n)), n).toEqual([])
  })
  test('a follower name by path, and the game version from meta', async () => {
    const o = await openSave('slot_0.mp', readSave('slot_0.mp'))
    const root = (o.data as Extract<typeof o.data, { kind: 'msgpack' }>).root
    const name = toPlain(get(schema, root, 'DataManager', ['Followers', '0', '_name'])!.node)
    expect(name).toBe((toPlain(root) as any[])[1109][0][1])
    expect(name).toEqual(expect.stringMatching(/\S/))
    expect(gameVersionOf(await openSave('meta_0.mp', readSave('meta_0.mp')), schema)).toBe('1.5.26.1058')
    expect(gameVersionOf(await openSave('meta_0.json', readSave('meta_0.json')), schema)).toBe('1.4.6\n.596')
  })
})
