// The PC wrapper: 0x45 ('E'), the AES-128 key, the IV, then AES-128-CBC ciphertext with PKCS#7 padding.
import { SaveFormatError } from './errors'

export interface AesWrap { key: Uint8Array; iv: Uint8Array }

const HEAD = 33

export function isAesWrapped(file: Uint8Array): boolean {
  return file[0] === 0x45 && file.length >= HEAD + 16 && (file.length - HEAD) % 16 === 0
}

// Our arrays are always backed by a plain ArrayBuffer; TypeScript's DOM types want that said.
const buf = (b: Uint8Array) => b as Uint8Array<ArrayBuffer>
const importKey = (key: Uint8Array, use: KeyUsage) => crypto.subtle.importKey('raw', buf(key), 'AES-CBC', false, [use])

export async function aesUnwrap(file: Uint8Array): Promise<{ wrap: AesWrap; plain: Uint8Array }> {
  if (!isAesWrapped(file)) throw new SaveFormatError('This is not an encrypted save.')
  const wrap = { key: file.slice(1, 17), iv: file.slice(17, HEAD) }
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: buf(wrap.iv) }, await importKey(wrap.key, 'decrypt'), buf(file.subarray(HEAD)))
    return { wrap, plain: new Uint8Array(plain) }
  } catch {
    throw new SaveFormatError("The save can't be decrypted: it is damaged or cut short.")
  }
}

export async function aesWrap(wrap: AesWrap, plain: Uint8Array): Promise<Uint8Array> {
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv: buf(wrap.iv) }, await importKey(wrap.key, 'encrypt'), buf(plain)))
  const file = new Uint8Array(HEAD + cipher.length)
  file[0] = 0x45
  file.set(wrap.key, 1)
  file.set(wrap.iv, 17)
  file.set(cipher, HEAD)
  return file
}
