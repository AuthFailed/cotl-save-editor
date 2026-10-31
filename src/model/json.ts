// JSON saves (before 1.5, Apple) use the same field names as the schema, so they map onto its keyed arrays for the
// screens, and back by name for export. Keys the schema doesn't know are taken from the original as they were.
import { toPlain, type MpNode } from '../codec/msgpack'
import type { FieldType, SaveSchema } from '../schema/schema'

type Json = unknown
const isObject = (v: Json): v is Record<string, Json> => typeof v === 'object' && v !== null && !Array.isArray(v)
const unwrap = (t: FieldType | undefined): FieldType | undefined => (typeof t === 'object' && 'nullable' in t ? unwrap(t.nullable) : t)

// MessagePack keys sit on backing fields (_name, _satiation); JSON has the C# properties (Name, Satiation).
const alias = (name: string) => (name.startsWith('_') && name.length > 1 ? name[1].toUpperCase() + name.slice(2) : null)
const keyIn = (name: string, obj: Record<string, Json>) => (name in obj ? name : alias(name) && alias(name)! in obj ? alias(name)! : null)
const idOf = (schema: SaveSchema, type: string) => schema.types[type]?.fields.find(f => f.name === 'ID')

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
    for (const f of fields) {
      const k = keyIn(f.name, json)
      if (k) v[f.key] = jsonToTree(schema, json[k], f.type)
    }
    return { t: 'arr', v, w: 'a32' }
  }
  if (typeof t === 'object' && 'list' in t && Array.isArray(json)) return { t: 'arr', v: json.map(x => jsonToTree(schema, x, t.list)), w: 'a32' }
  if (typeof t === 'object' && 'map' in t && isObject(json))
    return { t: 'map', v: Object.entries(json).map(([k, x]) => [{ t: 'str', v: k, w: 's32' }, jsonToTree(schema, x, t.map[1])]), w: 'm32' }
  return generic(json, t)
}

type Index = Map<string, Map<string, Record<string, Json>>>

/** Every original object of a type that has an ID, so list elements pair with their own original after a removal. */
function index(schema: SaveSchema, json: Json, type: FieldType | undefined, into: Index) {
  const t = unwrap(type)
  if (typeof t === 'object' && 'object' in t && isObject(json) && schema.types[t.object]) {
    if (idOf(schema, t.object) && json.ID !== undefined) {
      if (!into.has(t.object)) into.set(t.object, new Map())
      into.get(t.object)!.set(String(json.ID), json)
    }
    for (const f of schema.types[t.object].fields) {
      const k = keyIn(f.name, json)
      if (k) index(schema, json[k], f.type, into)
    }
  } else if (typeof t === 'object' && 'list' in t && Array.isArray(json)) for (const x of json) index(schema, x, t.list, into)
  else if (typeof t === 'object' && 'map' in t && isObject(json)) for (const x of Object.values(json)) index(schema, x, t.map[1], into)
}

export function fromTree(schema: SaveSchema, node: MpNode, original: Json, type: FieldType = { object: schema.roots.slot }): Json {
  const ids: Index = new Map()
  index(schema, original, type, ids)
  return back(schema, node, original, type, ids)
}

function back(schema: SaveSchema, node: MpNode, original: Json, type: FieldType | undefined, ids: Index): Json {
  const t = unwrap(type)
  if (typeof t === 'object' && 'object' in t && node.t === 'arr' && schema.types[t.object]) {
    const id = idOf(schema, t.object)
    const own = id && node.v[id.key] ? ids.get(t.object)?.get(String(toPlain(node.v[id.key]))) : undefined
    // with an ID, only its own original counts: a position may now hold someone else
    const base = id ? own : original
    const out: Record<string, Json> = isObject(base) ? { ...base } : {}
    for (const f of schema.types[t.object].fields) {
      const n = node.v[f.key]
      const k = keyIn(f.name, out)
      if (!n || (n.t === 'nil' && !k)) continue
      const key = k ?? alias(f.name) ?? f.name
      out[key] = back(schema, n, out[key], f.type, ids)
    }
    return out
  }
  const elem = typeof t === 'object' && 'list' in t ? t.list : undefined
  if (node.t === 'arr') return node.v.map((n, i) => back(schema, n, Array.isArray(original) ? original[i] : undefined, elem, ids))
  if (node.t === 'map') {
    const value = typeof t === 'object' && 'map' in t ? t.map[1] : undefined
    return Object.fromEntries(node.v.map(([k, n]) => {
      const key = String(toPlain(k))
      return [key, back(schema, n, isObject(original) ? original[key] : undefined, value, ids)]
    }))
  }
  const v = toPlain(node)
  return typeof v === 'bigint' ? Number(v) : v
}
