import { describe, expect, test } from 'vitest'
import { openSave } from '../src/codec/formats'
import { encodeMp, toPlain, type MpNode } from '../src/codec/msgpack'
import { field, gameVersionOf, get, nameAt, pickSchema, type SaveSchema } from '../src/schema/schema'
import schemaJson from './fixtures/save-schema-1.5.26.json'
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
  expect(nameAt(schema, 'DataManager', 1396)).toBe('#1396')
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

describe.skipIf(!hasSaves)('real saves', () => {
  test('a follower name by path, and the game version from meta', async () => {
    const o = await openSave('slot_0.mp', readSave('slot_0.mp'))
    const root = (o.data as Extract<typeof o.data, { kind: 'msgpack' }>).root
    expect(toPlain(get(schema, root, 'DataManager', ['Followers', '0', '_name'])!.node)).toBe('Треджулно')
    expect(gameVersionOf(await openSave('meta_0.mp', readSave('meta_0.mp')), schema)).toBe('1.5.26.1058')
    expect(gameVersionOf(await openSave('meta_0.json', readSave('meta_0.json')), schema)).toBe('1.4.6\n.596')
  })
})
