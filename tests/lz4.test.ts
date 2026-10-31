import { expect, test } from 'vitest'
import { SaveFormatError } from '../src/codec/errors'
import { lz4Compress, lz4Decompress } from '../src/codec/lz4'
import { unwrapBlockArray, wrapBlockArray } from '../src/codec/lz4array'
import { decodeMp, decodeMpSeq, encodeMp, toPlain, type MpNode } from '../src/codec/msgpack'
import { randomBytes, repeat } from './util'

test('compress then decompress gives the input back', () => {
  for (const input of [new Uint8Array(0), new Uint8Array(5), new Uint8Array(100_000), randomBytes(70_000), repeat('abc', 40_000), repeat('ab', 3)])
    expect(lz4Decompress(lz4Compress(input), input.length)).toEqual(input)
})

test('compression actually compresses repetitive data', () => {
  expect(lz4Compress(new Uint8Array(100_000)).length).toBeLessThan(1000)
})

test('wrap splits into 32 KiB blocks with an ext-98 size list and bin32 blocks', () => {
  const body = randomBytes(70_000)
  const outer = decodeMp(wrapBlockArray(body)) as Extract<MpNode, { t: 'arr' }>
  const head = outer.v[0] as Extract<MpNode, { t: 'ext' }>
  expect(head).toMatchObject({ t: 'ext', type: 98 })
  expect(decodeMpSeq(head.v).map(toPlain)).toEqual([32768, 32768, 4464])
  expect(outer.v.slice(1).every(b => b.t === 'bin' && b.w === 'b32')).toBe(true)
  expect(unwrapBlockArray(wrapBlockArray(body))).toEqual(body)
})

test('a plain MessagePack payload is not a block array', () => {
  expect(unwrapBlockArray(encodeMp({ t: 'arr', w: 'fix', v: [{ t: 'nil' }] }))).toBeNull()
  expect(unwrapBlockArray(encodeMp({ t: 'int', w: 'pfix', v: 1 }))).toBeNull()
})

test('a block that decompresses to the wrong size throws', () => {
  expect(() => lz4Decompress(lz4Compress(randomBytes(100)), 99)).toThrow(SaveFormatError)
  expect(() => lz4Decompress(lz4Compress(randomBytes(100)), 101)).toThrow(SaveFormatError)
  expect(() => lz4Decompress(Uint8Array.of(0x0f), 20)).toThrow(SaveFormatError)
})
