// New MessagePack values for fields a save didn't have yet, in the narrowest wire type the field allows.
import { setValue, type MpNode } from '../codec/msgpack'
import type { FieldType } from '../schema/schema'

const INTS = new Set(['int8', 'uint8', 'int16', 'uint16', 'int32', 'uint32', 'int64', 'uint64'])

function int(v: number): MpNode {
  const seed: MpNode = { t: 'int', v: 0, w: v < 0 ? 'nfix' : 'pfix' }
  return setValue(seed, v, 'new value')
}

export function nodeLike(sample: MpNode | undefined, value: unknown, type: FieldType): MpNode {
  if (sample && sample.t !== 'nil' && sample.t !== 'arr' && sample.t !== 'map') return setValue(sample, value, 'new value')
  if (typeof type === 'object' && 'nullable' in type) return nodeLike(sample, value, type.nullable)
  if (typeof type === 'object' && 'enum' in type) return int(Number(value))
  if (type === 'bool') return { t: 'bool', v: Boolean(value) }
  if (type === 'float32' || type === 'float64') return { t: 'float', v: Number(value), w: type === 'float32' ? 'f32' : 'f64' }
  if (type === 'string') return setValue({ t: 'str', v: '', w: 'fix' }, String(value), 'new value')
  if (typeof type === 'string' && INTS.has(type)) return int(Number(value))
  throw new TypeError(`Can't create a ${JSON.stringify(type)} value`)
}
