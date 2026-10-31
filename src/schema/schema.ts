// Names for the unnamed arrays of a 1.5+ save, from cotl-api's v1/save-schema.json.
import type { Opened } from '../codec/formats'
import type { MpNode } from '../codec/msgpack'

export type FieldType = string | { list: FieldType } | { map: [FieldType, FieldType] } | { nullable: FieldType }
  | { enum: string } | { object: string } | { other: string }
export interface SaveSchema {
  gameVersion: string
  roots: { slot: string; meta: string }
  types: Record<string, { fields: { key: number; name: string; type: FieldType }[] }>
  enums: Record<string, Record<string, string>>
}

const parts = (v: string) => v.split('.').map(p => parseInt(p, 10) || 0)
export function compare(a: string, b: string) {
  const x = parts(a), y = parts(b)
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0)
  return 0
}

/** The schema for a game version: its own, else the newest older one, else the oldest (then not exact). */
export function pickSchema(available: string[], gameVersion: string | null): { version: string; exact: boolean } {
  const sorted = [...available].sort(compare)
  if (gameVersion === null) return { version: sorted[sorted.length - 1], exact: false }
  const same = sorted.find(v => compare(v, gameVersion) === 0)
  if (same) return { version: same, exact: true }
  const older = sorted.filter(v => compare(v, gameVersion) < 0)
  return { version: older[older.length - 1] ?? sorted[0], exact: false }
}

export function field(schema: SaveSchema, type: string, name: string) {
  const f = schema.types[type]?.fields.find(x => x.name === name)
  return f && { key: f.key, type: f.type }
}

export function nameAt(schema: SaveSchema, type: string, key: number): string {
  return schema.types[type]?.fields.find(x => x.key === key)?.name ?? `#${key}`
}

/** The node and its declared type at a path of field names, list indices and map keys; undefined if absent. */
export function get(schema: SaveSchema, root: MpNode, rootType: string, path: string[]): { node: MpNode; type: FieldType } | undefined {
  let node = root
  let type: FieldType = { object: rootType }
  for (const seg of path) {
    while (typeof type === 'object' && 'nullable' in type) type = type.nullable
    let next: MpNode | undefined
    if (typeof type === 'object' && 'object' in type && node.t === 'arr') {
      const f = field(schema, type.object, seg)
      if (!f) return undefined
      next = node.v[f.key]
      type = f.type
    } else if (typeof type === 'object' && 'list' in type && node.t === 'arr') {
      next = /^\d+$/.test(seg) ? node.v[Number(seg)] : undefined
      type = type.list
    } else if (typeof type === 'object' && 'map' in type && node.t === 'map') {
      next = node.v.find(([k]) => (k.t === 'str' || k.t === 'int') && String(k.v) === seg)?.[1]
      type = type.map[1]
    }
    if (!next) return undefined
    node = next
  }
  return { node, type }
}

/** MetaData.Version of a meta file, in either MessagePack or JSON form. */
export function gameVersionOf(meta: Opened, schema: SaveSchema): string | null {
  if (meta.data.kind === 'json') {
    const v = (meta.data.root as Record<string, unknown> | null)?.Version
    return typeof v === 'string' ? v : null
  }
  const f = field(schema, schema.roots.meta, 'Version')
  const node = f && meta.data.root.t === 'arr' ? meta.data.root.v[f.key] : undefined
  return node?.t === 'str' ? node.v : null
}

const unwrap = (t: FieldType): FieldType => (typeof t === 'object' && 'nullable' in t ? unwrap(t.nullable) : t)

/** The wire kind a declared type is written as, or null for one that isn't checked. */
function wire(type: FieldType): MpNode['t'] | null {
  const t = unwrap(type)
  if (typeof t === 'object') return 'enum' in t ? 'int' : 'list' in t || 'object' in t ? 'arr' : 'map' in t ? 'map' : null
  return t === 'bool' ? 'bool' : /^u?int(8|16|32|64)$/.test(t) ? 'int' : /^float(32|64)$/.test(t) ? 'float'
    : t === 'string' ? 'str' : t === 'bytes' ? 'bin' : null
}
// nil fits anything: JSON-mapped and built trees hold nil in typed fields.
const fits = (node: MpNode, t: FieldType) => node.t === 'nil' || wire(t) === null || node.t === wire(t)
// What MessagePack-CSharp writes for a [Union] the schema doesn't describe: [tag, fields].
const isUnion = (n: MpNode) => n.t === 'arr' && n.v.length === 2 && n.v[0].t === 'int' && n.v[1].t === 'arr'

/** A node whose field (or list element) doesn't fit its declared type: the node is locked, and shown as stored. */
export interface Misfit { field: string; union: boolean; node: MpNode }

/** Every misfit in a slot. The root is never locked whole: its misfitting fields are, one by one. */
export function fit(schema: SaveSchema, root: MpNode): Misfit[] {
  const found: Misfit[] = []
  const walk = (node: MpNode, type: FieldType, owner: string, top = false): void => {
    const t = unwrap(type)
    if (typeof t !== 'object') return
    if ('object' in t && node.t === 'arr') {
      const fields = (schema.types[t.object]?.fields ?? []).filter(f => f.key < node.v.length)
      const bad = fields.filter(f => !fits(node.v[f.key], f.type))
      for (const f of bad) {
        const unit = top ? node.v[f.key] : node
        found.push({ field: `${t.object}.${f.name}`, union: isUnion(unit), node: unit })
      }
      if (bad.length && !top) return
      for (const f of fields) if (!bad.includes(f)) walk(node.v[f.key], f.type, `${t.object}.${f.name}`)
    } else if ('list' in t || 'map' in t) {
      const [values, of] = 'list' in t ? [node.t === 'arr' ? node.v : [], t.list] : [node.t === 'map' ? node.v.map(e => e[1]) : [], t.map[1]]
      const bad = values.find(x => !fits(x, of))
      if (bad) found.push({ field: owner, union: isUnion(bad), node })
      else for (const x of values) walk(x, of, owner)
    }
  }
  walk(root, { object: schema.roots.slot }, schema.roots.slot, true)
  return found
}

/** The fields that don't fit, when there are too many to be the schema's known gaps: the save's keys have moved.
 * Real saves have at most 2; a shift by one key gives dozens. */
export function moved(found: Misfit[]): string[] | null {
  const fields = [...new Set(found.filter(m => !m.union).map(m => m.field))]
  return fields.length > 5 ? fields : null
}

// Trees are never mutated and a locked node is never edited, so a lock keeps its node through replay, undo and export.
export const unfit = new WeakSet<MpNode>()
