import { describe, expect, test } from 'vitest'
import { aesWrap } from '../src/codec/aes'
import { SaveFormatError } from '../src/codec/errors'
import { openSave, saveSave, type Opened } from '../src/codec/formats'
import { wrapBlockArray } from '../src/codec/lz4array'
import { encodeMp, toPlain, type MpNode } from '../src/codec/msgpack'
import { fromHex, gzip, hasSaves, randomBytes, readSave } from './util'

const tree: MpNode = { t: 'arr', w: 'a16', v: [{ t: 'bool', v: true }, { t: 'str', w: 'fix', v: 'Lamb' }, { t: 'int', w: 'u16', v: 5 }] }
const rootOf = (o: Opened) => toPlain((o.data as Extract<Opened['data'], { kind: 'msgpack' }>).root) as any[]

test('pc-mp: a synthetic slot round-trips and is exact', async () => {
  const file = await aesWrap({ key: randomBytes(16), iv: randomBytes(16) }, wrapBlockArray(encodeMp(tree)))
  const o = await openSave('slot_0.mp', file)
  expect(o).toMatchObject({ format: 'pc-mp', file: 'slot', exact: true, beta: false, compressed: true })
  expect(o.data).toEqual({ kind: 'msgpack', root: tree })
  expect((await openSave('slot_0.mp', await saveSave(o))).data).toEqual(o.data)
})

test('pc-mp: uncompressed MessagePack inside AES stays uncompressed', async () => {
  const o = await openSave('meta_3.mp', await aesWrap({ key: randomBytes(16), iv: randomBytes(16) }, encodeMp(tree)))
  expect(o).toMatchObject({ format: 'pc-mp', file: 'meta', compressed: false, exact: true })
})

test('switch-mp: MP prefix, no AES', async () => {
  const file = new Uint8Array([0x4d, 0x50, ...wrapBlockArray(encodeMp(tree))])
  const o = await openSave('slot_0MP', file)
  expect(o).toMatchObject({ format: 'switch-mp', beta: true, exact: true, wrap: null })
  expect((await saveSave(o)).slice(0, 2)).toEqual(Uint8Array.of(0x4d, 0x50))
})

test('apple-zb: ZB + gzip JSON with a BOM', async () => {
  const file = new Uint8Array([0x5a, 0x42, ...(await gzip(new TextEncoder().encode('﻿{"CultName":"Рога"}')))])
  const o = await openSave('slot_0', file)
  expect(o).toMatchObject({ format: 'apple-zb', beta: true, exact: true, data: { kind: 'json', root: { CultName: 'Рога' } } })
  const again = await saveSave(o)
  expect(again.slice(0, 2)).toEqual(Uint8Array.of(0x5a, 0x42))
  expect((await openSave('slot_0', again)).data).toEqual(o.data)
})

test('plain JSON and encrypted JSON', async () => {
  expect((await openSave('slot_1.json', new TextEncoder().encode('{"a":1}'))).format).toBe('plain-json')
  const enc = await openSave('slot_1.json', await aesWrap({ key: randomBytes(16), iv: randomBytes(16) }, new TextEncoder().encode('{"a":1}')))
  expect(enc).toMatchObject({ format: 'pc-json', data: { kind: 'json', root: { a: 1 } } })
})

test('a JSON integer beyond 2^53 makes the save inexact', async () => {
  expect((await openSave('slot_1.json', new TextEncoder().encode('{"id":9007199254740993}'))).exact).toBe(false)
})

test('ulong.MaxValue, which rounds to exactly 2^64, is lossy', async () => {
  expect((await openSave('slot_1.json', new TextEncoder().encode('{"id":18446744073709551615}'))).exact).toBe(false)
})

test('a damaged block size throws SaveFormatError', async () => {
  await expect(openSave('slot_0MP', fromHex('4d5092d462ffc4021041'))).rejects.toThrow(SaveFormatError)
  await expect(openSave('slot_0MP', fromHex('4d5092d562cdffffc4021041'))).rejects.toThrow(SaveFormatError)
})

test('float.MinValue, as the game writes it, is not a lossy integer', async () => {
  expect((await openSave('slot_1.json', new TextEncoder().encode('{"LastHolidayDeclared":-3.40282347E+38}'))).exact).toBe(true)
})

test('garbage and truncated files throw SaveFormatError', async () => {
  await expect(openSave('slot_0.mp', Uint8Array.of(0x89, 0x50, 0x4e, 0x47))).rejects.toThrow(SaveFormatError)
  await expect(openSave('slot_1.json', new TextEncoder().encode('{"a":'))).rejects.toThrow(SaveFormatError)
  const file = await aesWrap({ key: randomBytes(16), iv: randomBytes(16) }, wrapBlockArray(encodeMp(tree)))
  await expect(openSave('slot_0.mp', file.slice(0, file.length - 16))).rejects.toThrow(SaveFormatError)
})

describe.skipIf(!hasSaves)('real saves', () => {
  test('slot_0.mp opens with the known facts and is exact', async () => {
    const o = await openSave('slot_0.mp', readSave('slot_0.mp'))
    const root = rootOf(o)
    expect([o.exact, root.length, root[410], root[1109].length, root[1109][0][1], root[1109][0][15], root[1111].length, root[1162][0]])
      .toEqual([true, 1397, 'Рога и Копыта', 18, 'Треджулно', 'Unicorn2', 46, [2, 871, 0]])
  })
  test('meta_0.mp is a 31-element array with the version at 29', async () => {
    const root = rootOf(await openSave('meta_0.mp', readSave('meta_0.mp')))
    expect([root.length, root[29]]).toEqual([31, '1.5.26.1058'])
  })
  test.each(['slot_0.mp', 'slot_10.mp', 'meta_10.mp', 'slot_0.json', 'slot_1.json', 'meta_0.json'])('%s is exact and reopens equal', async name => {
    const o = await openSave(name, readSave(name))
    expect(o.exact).toBe(true)
    expect((await openSave(name, await saveSave(o))).data).toEqual(o.data)
  })
})
