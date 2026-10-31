// MessagePack that remembers how each value was written. The game (MessagePack-CSharp) doesn't always use the
// shortest form (a uint16 for 5, bin32 for a 1-byte blob), so re-encoding untouched values in their original
// wire type is what makes an untouched save come back byte for byte.
import { SaveFormatError } from './errors'

export type IntWire = 'pfix' | 'nfix' | 'u8' | 'u16' | 'u32' | 'u64' | 'i8' | 'i16' | 'i32' | 'i64'
type StrWire = 'fix' | 's8' | 's16' | 's32'
type ExtWire = 'fe1' | 'fe2' | 'fe4' | 'fe8' | 'fe16' | 'e8' | 'e16' | 'e32'
export type MpNode =
  | { t: 'nil' }
  | { t: 'bool'; v: boolean }
  | { t: 'int'; v: number | bigint; w: IntWire }
  | { t: 'float'; v: number; w: 'f32' | 'f64' }
  | { t: 'str'; v: string; w: StrWire }
  | { t: 'bin'; v: Uint8Array; w: 'b8' | 'b16' | 'b32' }
  | { t: 'arr'; v: MpNode[]; w: 'fix' | 'a16' | 'a32' }
  | { t: 'map'; v: [MpNode, MpNode][]; w: 'fix' | 'm16' | 'm32' }
  | { t: 'ext'; type: number; v: Uint8Array; w: ExtWire }

const utf8 = new TextDecoder('utf-8', { fatal: true })
const toUtf8 = new TextEncoder()

class Reader {
  pos = 0
  private view: DataView
  constructor(private bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }
  get done() { return this.pos >= this.bytes.length }
  private need(n: number) {
    if (this.pos + n > this.bytes.length) throw new SaveFormatError(`The data ends early (needed ${n} more bytes at ${this.pos}).`)
    const at = this.pos
    this.pos += n
    return at
  }
  u8() { return this.view.getUint8(this.need(1)) }
  u16() { return this.view.getUint16(this.need(2)) }
  u32() { return this.view.getUint32(this.need(4)) }
  take(n: number) { const at = this.need(n); return this.bytes.slice(at, at + n) }

  value(): MpNode {
    const b = this.u8()
    if (b <= 0x7f) return { t: 'int', v: b, w: 'pfix' }
    if (b >= 0xe0) return { t: 'int', v: b - 0x100, w: 'nfix' }
    if ((b & 0xf0) === 0x80) return this.map(b & 0x0f, 'fix')
    if ((b & 0xf0) === 0x90) return this.arr(b & 0x0f, 'fix')
    if ((b & 0xe0) === 0xa0) return this.str(b & 0x1f, 'fix')
    const v = this.view
    switch (b) {
      case 0xc0: return { t: 'nil' }
      case 0xc2: return { t: 'bool', v: false }
      case 0xc3: return { t: 'bool', v: true }
      case 0xc4: return { t: 'bin', v: this.take(this.u8()), w: 'b8' }
      case 0xc5: return { t: 'bin', v: this.take(this.u16()), w: 'b16' }
      case 0xc6: return { t: 'bin', v: this.take(this.u32()), w: 'b32' }
      case 0xc7: { const n = this.u8(); return this.ext(n, 'e8') }
      case 0xc8: { const n = this.u16(); return this.ext(n, 'e16') }
      case 0xc9: { const n = this.u32(); return this.ext(n, 'e32') }
      case 0xca: return { t: 'float', v: v.getFloat32(this.need(4)), w: 'f32' }
      case 0xcb: return { t: 'float', v: v.getFloat64(this.need(8)), w: 'f64' }
      case 0xcc: return { t: 'int', v: this.u8(), w: 'u8' }
      case 0xcd: return { t: 'int', v: this.u16(), w: 'u16' }
      case 0xce: return { t: 'int', v: this.u32(), w: 'u32' }
      case 0xcf: return { t: 'int', v: small(v.getBigUint64(this.need(8))), w: 'u64' }
      case 0xd0: return { t: 'int', v: v.getInt8(this.need(1)), w: 'i8' }
      case 0xd1: return { t: 'int', v: v.getInt16(this.need(2)), w: 'i16' }
      case 0xd2: return { t: 'int', v: v.getInt32(this.need(4)), w: 'i32' }
      case 0xd3: return { t: 'int', v: small(v.getBigInt64(this.need(8))), w: 'i64' }
      case 0xd4: return this.ext(1, 'fe1')
      case 0xd5: return this.ext(2, 'fe2')
      case 0xd6: return this.ext(4, 'fe4')
      case 0xd7: return this.ext(8, 'fe8')
      case 0xd8: return this.ext(16, 'fe16')
      case 0xd9: return this.str(this.u8(), 's8')
      case 0xda: return this.str(this.u16(), 's16')
      case 0xdb: return this.str(this.u32(), 's32')
      case 0xdc: return this.arr(this.u16(), 'a16')
      case 0xdd: return this.arr(this.u32(), 'a32')
      case 0xde: return this.map(this.u16(), 'm16')
      case 0xdf: return this.map(this.u32(), 'm32')
    }
    throw new SaveFormatError(`Unknown MessagePack byte 0x${b.toString(16)} at ${this.pos - 1}.`)
  }
  private str(n: number, w: StrWire): MpNode {
    try { return { t: 'str', v: utf8.decode(this.take(n)), w } } catch (e) {
      if (e instanceof SaveFormatError) throw e
      throw new SaveFormatError(`Text that isn't valid UTF-8 at ${this.pos - n}.`)
    }
  }
  private arr(n: number, w: 'fix' | 'a16' | 'a32'): MpNode {
    const v: MpNode[] = []
    for (let i = 0; i < n; i++) v.push(this.value())
    return { t: 'arr', v, w }
  }
  private map(n: number, w: 'fix' | 'm16' | 'm32'): MpNode {
    const v: [MpNode, MpNode][] = []
    for (let i = 0; i < n; i++) v.push([this.value(), this.value()])
    return { t: 'map', v, w }
  }
  private ext(n: number, w: ExtWire): MpNode {
    const type = this.view.getInt8(this.need(1))
    return { t: 'ext', type, v: this.take(n), w }
  }
}

const small = (n: bigint) => (n >= BigInt(Number.MIN_SAFE_INTEGER) && n <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(n) : n)

export function decodeMp(bytes: Uint8Array): MpNode {
  const r = new Reader(bytes)
  const node = r.value()
  if (!r.done) throw new SaveFormatError(`Unexpected data after the end (${bytes.length - r.pos} bytes).`)
  return node
}

export function decodeMpSeq(bytes: Uint8Array): MpNode[] {
  const r = new Reader(bytes)
  const out: MpNode[] = []
  while (!r.done) out.push(r.value())
  return out
}

class Writer {
  private buf = new Uint8Array(1024)
  private view = new DataView(this.buf.buffer)
  len = 0
  private room(n: number) {
    if (this.len + n <= this.buf.length) return
    let size = this.buf.length * 2
    while (size < this.len + n) size *= 2
    const next = new Uint8Array(size)
    next.set(this.buf.subarray(0, this.len))
    this.buf = next
    this.view = new DataView(next.buffer)
  }
  u8(b: number) { this.room(1); this.view.setUint8(this.len++, b) }
  u16(n: number) { this.room(2); this.view.setUint16(this.len, n); this.len += 2 }
  u32(n: number) { this.room(4); this.view.setUint32(this.len, n); this.len += 4 }
  num(set: (v: DataView, at: number) => void, n: number) { this.room(n); set(this.view, this.len); this.len += n }
  bytes(b: Uint8Array) { this.room(b.length); this.buf.set(b, this.len); this.len += b.length }
  result() { return this.buf.slice(0, this.len) }

  node(n: MpNode): void {
    switch (n.t) {
      case 'nil': return this.u8(0xc0)
      case 'bool': return this.u8(n.v ? 0xc3 : 0xc2)
      case 'float':
        if (n.w === 'f32') { this.u8(0xca); return this.num((v, at) => v.setFloat32(at, n.v), 4) }
        this.u8(0xcb); return this.num((v, at) => v.setFloat64(at, n.v), 8)
      case 'int': return this.int(n.v, n.w)
      case 'str': { const b = toUtf8.encode(n.v); this.head(n.w, b.length, 0xa0, 0xd9); return this.bytes(b) }
      case 'bin': this.head(n.w === 'b8' ? 's8' : n.w === 'b16' ? 's16' : 's32', n.v.length, -1, 0xc4); return this.bytes(n.v)
      case 'arr': this.coll(n.w, n.v.length, 0x90, 0xdc); for (const x of n.v) this.node(x); return
      case 'map': this.coll(n.w, n.v.length, 0x80, 0xde); for (const [k, x] of n.v) { this.node(k); this.node(x) } return
      case 'ext': {
        const fixed = { fe1: 0xd4, fe2: 0xd5, fe4: 0xd6, fe8: 0xd7, fe16: 0xd8 } as Record<string, number>
        if (n.w in fixed) this.u8(fixed[n.w])
        else this.head(n.w === 'e8' ? 's8' : n.w === 'e16' ? 's16' : 's32', n.v.length, -1, 0xc7)
        this.num((v, at) => v.setInt8(at, n.type), 1)
        return this.bytes(n.v)
      }
    }
  }
  // str/bin/ext: 8/16/32-bit length markers sit at base, base+1, base+2
  private head(w: StrWire, len: number, fix: number, base: number) {
    if (w === 'fix') return this.u8(fix | len)
    if (w === 's8') { this.u8(base); return this.u8(len) }
    if (w === 's16') { this.u8(base + 1); return this.u16(len) }
    this.u8(base + 2); this.u32(len)
  }
  private coll(w: string, len: number, fix: number, base: number) {
    if (w === 'fix') return this.u8(fix | len)
    if (w === 'a16' || w === 'm16') { this.u8(base); return this.u16(len) }
    this.u8(base + 1); this.u32(len)
  }
  private int(v: number | bigint, w: IntWire) {
    const n = Number(v)
    switch (w) {
      case 'pfix': return this.u8(n)
      case 'nfix': return this.u8(n & 0xff)
      case 'u8': this.u8(0xcc); return this.u8(n)
      case 'u16': this.u8(0xcd); return this.u16(n)
      case 'u32': this.u8(0xce); return this.u32(n)
      case 'u64': this.u8(0xcf); return this.num((d, at) => d.setBigUint64(at, BigInt(v)), 8)
      case 'i8': this.u8(0xd0); return this.num((d, at) => d.setInt8(at, n), 1)
      case 'i16': this.u8(0xd1); return this.num((d, at) => d.setInt16(at, n), 2)
      case 'i32': this.u8(0xd2); return this.num((d, at) => d.setInt32(at, n), 4)
      case 'i64': this.u8(0xd3); return this.num((d, at) => d.setBigInt64(at, BigInt(v)), 8)
    }
  }
}

export function encodeMp(node: MpNode): Uint8Array {
  const w = new Writer()
  w.node(node)
  return w.result()
}

const INT_RANGE: Record<IntWire, [bigint, bigint]> = {
  pfix: [0n, 127n], u8: [0n, 255n], u16: [0n, 65535n], u32: [0n, 4294967295n], u64: [0n, 18446744073709551615n],
  nfix: [-32n, -1n], i8: [-128n, 127n], i16: [-32768n, 32767n], i32: [-2147483648n, 2147483647n],
  i64: [-9223372036854775808n, 9223372036854775807n],
}
const UNSIGNED: IntWire[] = ['pfix', 'u8', 'u16', 'u32', 'u64']
const SIGNED: IntWire[] = ['nfix', 'i8', 'i16', 'i32', 'i64']
const fits = (v: bigint, w: IntWire) => v >= INT_RANGE[w][0] && v <= INT_RANGE[w][1]
const STR_MAX: Record<StrWire, number> = { fix: 31, s8: 255, s16: 65535, s32: 4294967295 }
const STRS: StrWire[] = ['fix', 's8', 's16', 's32']

/** The node with a new value, in its wire type when it fits, else the narrowest wider one of the same family. */
export function setValue(node: MpNode, value: unknown, path: string): MpNode {
  const wrong = (what: string) => new TypeError(`${path}: expected ${what}, got ${JSON.stringify(String(value))}`)
  switch (node.t) {
    case 'int': {
      if (!(typeof value === 'bigint' || (typeof value === 'number' && Number.isInteger(value)))) throw wrong('an integer')
      const big = BigInt(value)
      const family = UNSIGNED.includes(node.w) ? UNSIGNED : SIGNED
      const w = fits(big, node.w) ? node.w
        : family.slice(family.indexOf(node.w)).find(x => fits(big, x)) ?? [...SIGNED, ...UNSIGNED].find(x => fits(big, x))
      if (!w) throw wrong('a 64-bit integer')
      return { t: 'int', v: small(big), w }
    }
    case 'float':
      if (typeof value !== 'number' || !Number.isFinite(value)) throw wrong('a number')
      return { ...node, v: value }
    case 'bool':
      if (typeof value !== 'boolean') throw wrong('true or false')
      return { ...node, v: value }
    case 'str': {
      if (typeof value !== 'string') throw wrong('text')
      const len = toUtf8.encode(value).length
      const w = len <= STR_MAX[node.w] ? node.w : STRS.slice(STRS.indexOf(node.w)).find(x => len <= STR_MAX[x])!
      return { t: 'str', v: value, w }
    }
  }
  throw wrong(`a ${node.t} value (not editable here)`)
}

/** Plain JS values for display and tests: maps become objects when their keys are text or numbers. */
export function toPlain(node: MpNode): unknown {
  switch (node.t) {
    case 'nil': return null
    case 'arr': return node.v.map(toPlain)
    case 'map': {
      const pairs = node.v.map(([k, v]) => [toPlain(k), toPlain(v)] as const)
      return pairs.every(([k]) => typeof k === 'string' || typeof k === 'number') ? Object.fromEntries(pairs) : pairs
    }
    case 'ext': return { ext: node.type, data: node.v }
    default: return node.v
  }
}
