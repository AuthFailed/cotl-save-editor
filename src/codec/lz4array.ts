// MessagePack-CSharp's Lz4BlockArray: [ext 98 (one MessagePack int per block: its uncompressed length), bin, bin, ...],
// the blocks concatenated being the MessagePack body.
import { SaveFormatError } from './errors'
import { lz4Compress, lz4Decompress } from './lz4'
import { decodeMp, decodeMpSeq, encodeMp, type MpNode } from './msgpack'

const LZ4_EXT = 98
const BLOCK = 32768

/** The MessagePack body, or null when the payload isn't a block array (plain MessagePack). */
export function unwrapBlockArray(payload: Uint8Array): Uint8Array | null {
  const outer = decodeMp(payload)
  if (outer.t !== 'arr' || outer.v[0]?.t !== 'ext' || outer.v[0].type !== LZ4_EXT) return null
  const sizes = decodeMpSeq(outer.v[0].v).map(n => {
    if (n.t !== 'int') throw new SaveFormatError('The compressed block list is damaged.')
    return Number(n.v)
  })
  const blocks = outer.v.slice(1)
  if (blocks.length !== sizes.length || blocks.some(b => b.t !== 'bin'))
    throw new SaveFormatError(`The save lists ${sizes.length} compressed blocks but holds ${blocks.length}.`)
  // LZ4 expands at most ~255x; a size beyond that is damage, and would otherwise try to allocate it.
  blocks.forEach((b, i) => {
    const n = sizes[i]
    if (!Number.isInteger(n) || n < 0 || n > 255 * (b as Extract<MpNode, { t: 'bin' }>).v.length + 16)
      throw new SaveFormatError(`A compressed block claims an impossible size (${n}).`)
  })
  const parts = blocks.map((b, i) => lz4Decompress((b as Extract<MpNode, { t: 'bin' }>).v, sizes[i]))
  const body = new Uint8Array(sizes.reduce((a, b) => a + b, 0))
  let at = 0
  for (const p of parts) { body.set(p, at); at += p.length }
  return body
}

const uint = (n: number): MpNode => ({ t: 'int', v: n, w: n <= 127 ? 'pfix' : n <= 255 ? 'u8' : n <= 65535 ? 'u16' : 'u32' })
const EXT_FIXED: Record<number, 'fe1' | 'fe2' | 'fe4' | 'fe8' | 'fe16'> = { 1: 'fe1', 2: 'fe2', 4: 'fe4', 8: 'fe8', 16: 'fe16' }

export function wrapBlockArray(body: Uint8Array): Uint8Array {
  const chunks: Uint8Array[] = []
  for (let at = 0; at < body.length || chunks.length === 0; at += BLOCK) chunks.push(body.subarray(at, at + BLOCK))
  const sizes = chunks.map(c => encodeMp(uint(c.length)))
  const list = new Uint8Array(sizes.reduce((a, s) => a + s.length, 0))
  let at = 0
  for (const s of sizes) { list.set(s, at); at += s.length }
  const n = list.length
  const head: MpNode = { t: 'ext', type: LZ4_EXT, v: list, w: EXT_FIXED[n] ?? (n <= 255 ? 'e8' : n <= 65535 ? 'e16' : 'e32') }
  const items: MpNode[] = [head, ...chunks.map((c): MpNode => ({ t: 'bin', v: lz4Compress(c), w: 'b32' }))]
  return encodeMp({ t: 'arr', v: items, w: items.length <= 15 ? 'fix' : items.length <= 65535 ? 'a16' : 'a32' })
}
