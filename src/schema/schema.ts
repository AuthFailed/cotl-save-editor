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
function compare(a: string, b: string) {
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
