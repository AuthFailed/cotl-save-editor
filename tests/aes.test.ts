import { describe, expect, test } from 'vitest'
import { aesUnwrap, aesWrap, isAesWrapped } from '../src/codec/aes'
import { SaveFormatError } from '../src/codec/errors'
import { hasSaves, randomBytes, readSave } from './util'

test('wrap then unwrap gives the plaintext and the same key and iv', async () => {
  const wrap = { key: randomBytes(16), iv: randomBytes(16) }
  const file = await aesWrap(wrap, new TextEncoder().encode('{"AllowSaving":true}'))
  expect(file[0]).toBe(0x45)
  expect(file.slice(1, 17)).toEqual(wrap.key)
  expect(isAesWrapped(file)).toBe(true)
  const out = await aesUnwrap(file)
  expect(new TextDecoder().decode(out.plain)).toBe('{"AllowSaving":true}')
  expect(out.wrap).toEqual(wrap)
})

test('plain JSON and short files are not AES-wrapped', () => {
  expect(isAesWrapped(new TextEncoder().encode('E{"a": 1}'))).toBe(false)
  expect(isAesWrapped(new Uint8Array(49))).toBe(false)
})

test('a damaged file throws SaveFormatError, not a WebCrypto error', async () => {
  // fixed bytes: with random ones a wrong key yields valid padding about once in 256 runs
  const file = await aesWrap({ key: new Uint8Array(16), iv: new Uint8Array(16) }, new TextEncoder().encode('{"AllowSaving":true}'))
  file[5] ^= 1
  await expect(aesUnwrap(file)).rejects.toThrow(SaveFormatError)
})

describe.skipIf(!hasSaves)('real saves', () => {
  test('slot_0.json decrypts to JSON and re-encrypts to the same bytes', async () => {
    const file = readSave('slot_0.json')
    const { wrap, plain } = await aesUnwrap(file)
    expect(new TextDecoder().decode(plain.slice(0, 19))).toBe('{"AllowSaving":true')
    expect(await aesWrap(wrap, plain)).toEqual(file)
  })
})
