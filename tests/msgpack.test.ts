import { expect, test } from 'vitest'
import { SaveFormatError } from '../src/codec/errors'
import { decodeMp, decodeMpSeq, encodeMp, setValue, toPlain } from '../src/codec/msgpack'
import { fromHex, hexOf } from './util'

test('every wire type round-trips byte for byte', () => {
  const samples = ['c0', 'c2', 'c3', '7f', 'e0', 'cc01', 'cd0fff', 'ce00000001', 'cf0000000000000001', 'd0ff', 'd1ffff', 'd2ffffffff',
    'd3ffffffffffffffff', 'ca3f800000', 'cb3ff0000000000000', 'a161', 'd90161', 'da000161', 'db00000001' + '61', 'c40101', 'c5000101',
    'c600000001' + '01', '9101', 'dc000101', 'dd0000000101', '8101' + '02', 'de00010102', 'df000000010102', 'd46201', 'c7016201']
  for (const hex of samples) expect(hexOf(encodeMp(decodeMp(fromHex(hex))))).toBe(hex)
})

test('int64 beyond 2^53 stays exact', () => {
  expect(decodeMp(fromHex('cf0020000000000001'))).toEqual({ t: 'int', v: 9007199254740993n, w: 'u64' })
  expect(decodeMp(fromHex('d3ffffffffffffffff'))).toEqual({ t: 'int', v: -1, w: 'i64' })
})

test('setValue keeps a fitting wire type and widens one that no longer fits', () => {
  expect(setValue(decodeMp(fromHex('cd0005')), 7, 'x')).toEqual({ t: 'int', v: 7, w: 'u16' })
  expect(setValue(decodeMp(fromHex('05')), 300, 'x')).toEqual({ t: 'int', v: 300, w: 'u16' })
  expect(setValue(decodeMp(fromHex('d0ff')), -200, 'x')).toEqual({ t: 'int', v: -200, w: 'i16' })
  expect(() => setValue(decodeMp(fromHex('05')), 7.5, 'Followers[0].Level')).toThrow(/Followers\[0\]\.Level/)
  expect(() => setValue(decodeMp(fromHex('c3')), 1, 'flag')).toThrow(TypeError)
})

test('a string grown past fixstr gets a wider header', () => {
  const s = setValue(decodeMp(fromHex('a3616263')), 'x'.repeat(40), 'name')
  expect(hexOf(encodeMp(s)).slice(0, 4)).toBe('d928')
  expect(toPlain(decodeMp(encodeMp(setValue(decodeMp(fromHex('a0')), 'Культ Ягнёнка', 'n'))))).toBe('Культ Ягнёнка')
})

test('a run of values decodes as a sequence', () => {
  expect(decodeMpSeq(fromHex('cd0fffcd7ffe05')).map(toPlain)).toEqual([4095, 32766, 5])
})

test('truncated or trailing input throws SaveFormatError', () => {
  expect(() => decodeMp(fromHex('cd00'))).toThrow(SaveFormatError)
  expect(() => decodeMp(fromHex('0505'))).toThrow(SaveFormatError)
  expect(() => decodeMp(fromHex('c1'))).toThrow(SaveFormatError)
})
