// JSON saves (before 1.5, Apple) use the same field names as the schema, so they map onto its keyed arrays for the
// screens, and back by name for export. Keys the schema doesn't know are taken from the original as they were.
import { toPlain, type MpNode } from '../codec/msgpack'
import type { FieldType, SaveSchema } from '../schema/schema'

type Json = unknown
const isObject = (v: Json): v is Record<string, Json> => typeof v === 'object' && v !== null && !Array.isArray(v)
const unwrap = (t: FieldType | undefined): FieldType | undefined => (typeof t === 'object' && 'nullable' in t ? unwrap(t.nullable) : t)

function generic(v: Json, type?: FieldType): MpNode {
  if (v === null || v === undefined) return { t: 'nil' }
  if (typeof v === 'boolean') return { t: 'bool', v }
  if (typeof v === 'number') {
    if (Number.isInteger(v) && type !== 'float32' && type !== 'float64') return { t: 'int', v, w: 'i64' }
    return { t: 'float', v, w: type === 'float32' ? 'f32' : 'f64' }
  }
  if (typeof v === 'string') return { t: 'str', v, w: 's32' }
  if (Array.isArray(v)) return { t: 'arr', v: v.map(x => generic(x)), w: 'a32' }
  return { t: 'map', v: Object.entries(v).map(([k, x]) => [{ t: 'str', v: k, w: 's32' }, generic(x)]), w: 'm32' }
}

export function jsonToTree(schema: SaveSchema, json: Json, type: FieldType = { object: schema.roots.slot }): MpNode {
  const t = unwrap(type)
  if (typeof t === 'object' && 'object' in t && isObject(json) && schema.types[t.object]) {
    const fields = schema.types[t.object].fields
    const v: MpNode[] = Array.from({ length: Math.max(-1, ...fields.map(f => f.key)) + 1 }, () => ({ t: 'nil' }))
    for (const f of fields) if (f.name in json) v[f.key] = jsonToTree(schema, json[f.name], f.type)
    return { t: 'arr', v, w: 'a32' }
  }
  if (typeof t === 'object' && 'list' in t && Array.isArray(json)) return { t: 'arr', v: json.map(x => jsonToTree(schema, x, t.list)), w: 'a32' }
  if (typeof t === 'object' && 'map' in t && isObject(json))
    return { t: 'map', v: Object.entries(json).map(([k, x]) => [{ t: 'str', v: k, w: 's32' }, jsonToTree(schema, x, t.map[1])]), w: 'm32' }
  return generic(json, t)
}

export function fromTree(schema: SaveSchema, node: MpNode, original: Json, type: FieldType = { object: schema.roots.slot }): Json {
  const t = unwrap(type)
  if (typeof t === 'object' && 'object' in t && node.t === 'arr' && schema.types[t.object]) {
    const out: Record<string, Json> = isObject(original) ? { ...original } : {}
    for (const f of schema.types[t.object].fields) {
      const n = node.v[f.key]
      if (!n || (n.t === 'nil' && !(f.name in out))) continue
      out[f.name] = fromTree(schema, n, out[f.name], f.type)
    }
    return out
  }
  const elem = typeof t === 'object' && 'list' in t ? t.list : undefined
  if (node.t === 'arr') return node.v.map((n, i) => fromTree(schema, n, Array.isArray(original) ? original[i] : undefined, elem))
  if (node.t === 'map') {
    const value = typeof t === 'object' && 'map' in t ? t.map[1] : undefined
    return Object.fromEntries(node.v.map(([k, n]) => {
      const key = String(toPlain(k))
      return [key, fromTree(schema, n, isObject(original) ? original[key] : undefined, value)]
    }))
  }
  const v = toPlain(node)
  return typeof v === 'bigint' ? Number(v) : v
}
