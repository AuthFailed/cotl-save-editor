// Raw LZ4 blocks (no frame), the format MessagePack-CSharp's Lz4BlockArray stores.
import { SaveFormatError } from './errors'

const damaged = (why: string) => new SaveFormatError(`A compressed block is damaged (${why}).`)

export function lz4Decompress(src: Uint8Array, size: number): Uint8Array {
  const out = new Uint8Array(size)
  let ip = 0
  let op = 0
  const byte = () => {
    if (ip >= src.length) throw damaged('ends early')
    return src[ip++]
  }
  const length = (n: number) => {
    if (n === 15) for (let b = 255; b === 255;) { b = byte(); n += b }
    return n
  }
  while (ip < src.length) {
    const token = byte()
    const lit = length(token >> 4)
    if (ip + lit > src.length || op + lit > size) throw damaged('literals overrun')
    out.set(src.subarray(ip, ip + lit), op)
    ip += lit
    op += lit
    if (ip === src.length) break // the last sequence has literals only
    const offset = byte() | (byte() << 8)
    if (offset === 0 || offset > op) throw damaged('bad match offset')
    const match = length(token & 15) + 4
    if (op + match > size) throw damaged('match overruns')
    for (let i = 0; i < match; i++, op++) out[op] = out[op - offset]
  }
  if (op !== size) throw damaged(`${op} bytes instead of ${size}`)
  return out
}

const MIN_MATCH = 4
const MF_LIMIT = 12 // no match may start in the last 12 bytes
const LAST_LITERALS = 5 // and the last 5 are always literals
const HASH_BITS = 12

export function lz4Compress(src: Uint8Array): Uint8Array {
  const n = src.length
  const out = new Uint8Array(n + Math.ceil(n / 255) + 16)
  let op = 0
  const writeLength = (rest: number) => {
    for (; rest >= 255; rest -= 255) out[op++] = 255
    out[op++] = rest
  }
  const emit = (anchor: number, end: number, offset: number, match: number) => {
    const lit = end - anchor
    const ml = match - MIN_MATCH
    out[op++] = (Math.min(lit, 15) << 4) | (match ? Math.min(ml, 15) : 0)
    if (lit >= 15) writeLength(lit - 15)
    out.set(src.subarray(anchor, end), op)
    op += lit
    if (!match) return
    out[op++] = offset & 0xff
    out[op++] = offset >> 8
    if (ml >= 15) writeLength(ml - 15)
  }
  const read32 = (i: number) => src[i] | (src[i + 1] << 8) | (src[i + 2] << 16) | (src[i + 3] << 24)
  const table = new Int32Array(1 << HASH_BITS).fill(-1)
  let ip = 0
  let anchor = 0
  while (ip < n - MF_LIMIT) {
    const seq = read32(ip)
    const h = Math.imul(seq, 2654435761) >>> (32 - HASH_BITS)
    const ref = table[h]
    table[h] = ip
    if (ref >= 0 && ip - ref <= 0xffff && read32(ref) === seq) {
      let match = MIN_MATCH
      while (ip + match < n - LAST_LITERALS && src[ref + match] === src[ip + match]) match++
      emit(anchor, ip, ip - ref, match)
      ip += match
      anchor = ip
    } else ip++
  }
  emit(anchor, n, 0, 0)
  return out.slice(0, op)
}
