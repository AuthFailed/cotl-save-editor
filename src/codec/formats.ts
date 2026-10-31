// Every save format, detected by content: PC (AES around MessagePack or JSON), Switch ('MP' + MessagePack),
// Apple ('ZB' + gzip JSON), and plain JSON.
import { aesUnwrap, aesWrap, isAesWrapped, type AesWrap } from './aes'
import { SaveFormatError } from './errors'
import { unwrapBlockArray, wrapBlockArray } from './lz4array'
import { decodeMp, encodeMp, type MpNode } from './msgpack'

export type Format = 'pc-mp' | 'pc-json' | 'plain-json' | 'apple-zb' | 'switch-mp'
export type SaveData = { kind: 'msgpack'; root: MpNode } | { kind: 'json'; root: unknown }
export interface Opened {
  name: string
  format: Format
  file: 'slot' | 'meta' | 'other'
  data: SaveData
  /** No real save of this format has been tested. */
  beta: boolean
  /** Writing it back unchanged reproduces it (spec, Safety 1); when false the editor opens it read-only. */
  exact: boolean
  wrap: AesWrap | null
  compressed: boolean
}

const MP = [0x4d, 0x50]
const ZB = [0x5a, 0x42]
const startsWith = (b: Uint8Array, head: number[]) => head.every((x, i) => b[i] === x)
const prefixed = (head: number[], body: Uint8Array) => {
  const out = new Uint8Array(head.length + body.length)
  out.set(head)
  out.set(body, head.length)
  return out
}
const sameBytes = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i])

const looksLikeJson = (b: Uint8Array) => {
  const at = startsWith(b, [0xef, 0xbb, 0xbf]) ? 3 : 0
  return b[at] === 0x7b || b[at] === 0x5b // { or [
}

function parseJson(bytes: Uint8Array): { root: unknown; exact: boolean } {
  let lossy = false
  try {
    // TextDecoder drops a leading BOM. A 64-bit integer past 2^53 would come back rounded: not safe to write.
    // (Larger magnitudes are floats, like float.MinValue as -3.40282347E+38.)
    const root = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes), (_, v) => {
      if (typeof v === 'number' && Number.isInteger(v) && !Number.isSafeInteger(v) && Math.abs(v) < 2 ** 64) lossy = true
      return v
    })
    return { root, exact: !lossy }
  } catch {
    throw new SaveFormatError('The save data is damaged (not valid JSON).')
  }
}

function parseMp(payload: Uint8Array) {
  const body = unwrapBlockArray(payload)
  const raw = body ?? payload
  const root = decodeMp(raw)
  return { root, compressed: body !== null, exact: sameBytes(encodeMp(root), raw) }
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  try {
    return new Uint8Array(await new Response(new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer())
  } catch {
    throw new SaveFormatError('The save data is damaged (bad gzip stream).')
  }
}
const gzip = async (bytes: Uint8Array) =>
  new Uint8Array(await new Response(new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer())

const fileOf = (name: string): Opened['file'] => (/^slot_\d+/.test(name) ? 'slot' : /^meta_\d+/.test(name) ? 'meta' : 'other')

export async function openSave(name: string, bytes: Uint8Array): Promise<Opened> {
  const base = { name, file: fileOf(name), wrap: null as AesWrap | null, compressed: false }
  if (isAesWrapped(bytes)) {
    const { wrap, plain } = await aesUnwrap(bytes)
    if (looksLikeJson(plain)) {
      const { root, exact } = parseJson(plain)
      return { ...base, format: 'pc-json', data: { kind: 'json', root }, beta: false, exact, wrap }
    }
    const { root, compressed, exact } = parseMp(plain)
    return { ...base, format: 'pc-mp', data: { kind: 'msgpack', root }, beta: false, exact, wrap, compressed }
  }
  if (startsWith(bytes, MP)) {
    const { root, compressed, exact } = parseMp(bytes.subarray(2))
    return { ...base, format: 'switch-mp', data: { kind: 'msgpack', root }, beta: true, exact, compressed }
  }
  if (startsWith(bytes, ZB)) {
    const { root, exact } = parseJson(await gunzip(bytes.subarray(2)))
    return { ...base, format: 'apple-zb', data: { kind: 'json', root }, beta: true, exact }
  }
  if (looksLikeJson(bytes)) {
    const { root, exact } = parseJson(bytes)
    return { ...base, format: 'plain-json', data: { kind: 'json', root }, beta: false, exact }
  }
  throw new SaveFormatError(`${name} doesn't look like a Cult of the Lamb save.`)
}

export async function saveSave(o: Opened): Promise<Uint8Array> {
  if (o.data.kind === 'msgpack') {
    const body = encodeMp(o.data.root)
    const payload = o.compressed ? wrapBlockArray(body) : body
    if (o.format === 'switch-mp') return prefixed(MP, payload)
    if (o.format === 'pc-mp' && o.wrap) return aesWrap(o.wrap, payload)
  } else {
    // The game (Newtonsoft) writes floats as 0.0; JSON.stringify writes 0, which it reads back the same.
    const text = new TextEncoder().encode(JSON.stringify(o.data.root))
    if (o.format === 'plain-json') return text
    if (o.format === 'apple-zb') return prefixed(ZB, await gzip(text))
    if (o.format === 'pc-json' && o.wrap) return aesWrap(o.wrap, text)
  }
  throw new SaveFormatError(`Can't write ${o.data.kind} data as ${o.format}.`)
}
