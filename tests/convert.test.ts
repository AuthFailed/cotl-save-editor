import { expect, test } from 'vitest'
import { convert } from '../src/codec/convert'
import { SaveFormatError } from '../src/codec/errors'
import { openSave, saveSave, type Opened } from '../src/codec/formats'
import { toPlain, type MpNode } from '../src/codec/msgpack'
import type { SaveSchema } from '../src/schema/schema'
import schemaJson from './fixtures/save-schema-1.5.26.json'

const schema = schemaJson as SaveSchema
const openedSwitchSlot = (length: number): Opened => ({
  name: 'slot_0MP', format: 'switch-mp', file: 'slot', beta: true, exact: true, wrap: null, compressed: true,
  data: { kind: 'msgpack', root: { t: 'arr', w: 'a16', v: Array.from({ length }, (): MpNode => ({ t: 'nil' })) } },
})
const rootOf = (o: Opened) => toPlain((o.data as Extract<Opened['data'], { kind: 'msgpack' }>).root) as unknown[]

test('switch slot to pc pads to 1396 and sets TwitchSettings', async () => {
  const pc = convert(openedSwitchSlot(1395), 'pc-mp', schema)
  const root = rootOf(pc)
  expect([pc.format, pc.beta, root.length, root[325], root[1395]]).toEqual(['pc-mp', false, 1396, [null, true, 20, true, true, true], []])
  expect(pc.wrap?.key.length).toBe(16)
  expect((await openSave('slot_0.mp', await saveSave(pc))).format).toBe('pc-mp')
})

test('pc slot to switch drops the last element and nulls TwitchSettings', () => {
  const sw = convert(convert(openedSwitchSlot(1395), 'pc-mp', schema), 'switch-mp', schema)
  const root = rootOf(sw)
  expect([sw.format, sw.wrap, root.length, root[325]]).toEqual(['switch-mp', null, 1395, null])
})

test('lengths are relative: a 1397-element PC slot becomes 1396 on Switch', () => {
  const pc = { ...openedSwitchSlot(1397), format: 'pc-mp' as const, beta: false }
  expect(rootOf(convert(pc, 'switch-mp', schema)).length).toBe(1396)
  expect(rootOf(convert(openedSwitchSlot(1396), 'pc-mp', schema)).length).toBe(1397)
})

test('a slot too short for TwitchSettings throws instead of leaving holes', () => {
  expect(() => convert(openedSwitchSlot(100), 'pc-mp', schema)).toThrow(SaveFormatError)
})

test('a meta file only changes wrapper', () => {
  const meta = { ...openedSwitchSlot(31), name: 'meta_0MP', file: 'meta' as const }
  expect(rootOf(convert(meta, 'pc-mp', schema)).length).toBe(31)
})

test('JSON moves between the Apple and PC wrappers unchanged', async () => {
  const pc = await openSave('slot_0.json', new TextEncoder().encode('{"CultName":"Рога"}'))
  const zb = convert(pc, 'apple-zb', schema)
  expect([zb.format, zb.beta, zb.data]).toEqual(['apple-zb', true, pc.data])
  expect(convert(zb, 'pc-json', null).wrap?.iv.length).toBe(16)
})

test('unsupported pairs and a schema without TwitchSettings throw', () => {
  expect(() => convert(openedSwitchSlot(1395), 'pc-json', schema)).toThrow(/can't convert switch-mp to pc-json/i)
  expect(() => convert(openedSwitchSlot(1395), 'pc-mp', null)).toThrow(SaveFormatError)
})
