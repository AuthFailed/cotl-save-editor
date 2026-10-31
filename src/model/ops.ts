// Every edit is a change of one or more ops; Review, undo and export all replay this one list from the original.
import { setValue, toPlain, type MpNode } from '../codec/msgpack'
import { t as tr } from '../i18n/i18n.svelte'
import { field, get, unfit, type FieldType, type SaveSchema } from '../schema/schema'
import { nodeLike } from './build'

/** guard: a value that must still be at that path, so an op never lands on a different follower or item. */
type Guard = { path: string[]; value: unknown }
export type Op = { guard?: Guard | Guard[] } & (
  | { kind: 'set'; path: string[]; value: unknown }
  | { kind: 'insert'; path: string[]; index: number; node: MpNode }
  | { kind: 'remove'; path: string[]; index: number }
  // move and clone read the element when they replay, so earlier edits to it carry over (and undo with it)
  | { kind: 'move'; path: string[]; index: number; to: string[] }
  | { kind: 'clone'; path: string[]; index: number; set: { field: string; type: string; value: number } })
export interface Change { label: string; ops: Op[] }

export class OpError extends Error {
  override name = 'OpError'
}

// What C# integer fields can hold: the game's reader rejects anything wider.
const RANGE: Record<string, [number, number]> = {
  int8: [-128, 127], uint8: [0, 255], int16: [-32768, 32767], uint16: [0, 65535], int32: [-2147483648, 2147483647],
  uint32: [0, 4294967295], int64: [-(2 ** 63), 2 ** 63 - 1], uint64: [0, 2 ** 64 - 1],
}

const unwrap = (t: FieldType): FieldType => (typeof t === 'object' && 'nullable' in t ? unwrap(t.nullable) : t)

function update(schema: SaveSchema, node: MpNode, type: FieldType, path: string[], i: number,
  fn: (node: MpNode, type: FieldType) => MpNode): MpNode {
  if (unfit.has(node)) throw new OpError(tr('ops.unfit', { path: path.slice(0, i).join('.') }))
  if (i === path.length) return fn(node, type)
  const t = unwrap(type)
  const seg = path[i]
  const where = path.slice(0, i + 1).join('.')
  if (typeof t === 'object' && ('object' in t || 'list' in t)) {
    if (node.t !== 'arr') throw new OpError(`${where}: missing in this save`)
    let at: number, next: FieldType
    if ('object' in t) {
      const f = field(schema, t.object, seg)
      if (!f || f.key >= node.v.length) throw new OpError(`${where}: missing in this save`)
      at = f.key
      next = f.type
    } else {
      at = Number(seg)
      if (!/^\d+$/.test(seg) || at >= node.v.length) throw new OpError(`${where}: no such entry`)
      next = t.list
    }
    const v = node.v.slice()
    v[at] = update(schema, node.v[at], next, path, i + 1, fn)
    return { ...node, v }
  }
  if (typeof t === 'object' && 'map' in t && node.t === 'map') {
    const at = node.v.findIndex(([k]) => (k.t === 'str' || k.t === 'int') && String(k.v) === seg)
    if (at < 0) throw new OpError(`${where}: no such entry`)
    const v = node.v.slice()
    v[at] = [v[at][0], update(schema, v[at][1], t.map[1], path, i + 1, fn)]
    return { ...node, v }
  }
  throw new OpError(`${where}: can't be edited here`)
}

export function apply(schema: SaveSchema, root: MpNode, op: Op): MpNode {
  const rootType: FieldType = { object: schema.roots.slot }
  for (const g of op.guard ? [op.guard].flat() : []) {
    const at = get(schema, root, schema.roots.slot, g.path)
    if (!at || toPlain(at.node) !== g.value) throw new OpError(`${g.path.join('.')}: changed since this edit was made`)
  }
  const where = op.path.join('.')
  if (op.kind === 'move' || op.kind === 'clone') {
    const node = get(schema, root, schema.roots.slot, [...op.path, String(op.index)])?.node
    if (!node || node.t !== 'arr') throw new OpError(`${where}.${op.index}: no such entry`)
    if (op.kind === 'move') {
      const without = apply(schema, root, { kind: 'remove', path: op.path, index: op.index })
      const at = get(schema, without, schema.roots.slot, op.to)?.node
      return apply(schema, without, { kind: 'insert', path: op.to, index: at?.t === 'arr' ? at.v.length : 0, node })
    }
    // A clone would be an unlocked copy of what doesn't fit.
    if (unfit.has(node)) throw new OpError(tr('ops.unfit', { path: `${where}.${op.index}` }))
    const key = field(schema, op.set.type, op.set.field)
    if (!key) throw new OpError(`${op.set.type}.${op.set.field}: not in this schema`)
    const v = node.v.slice()
    v[key.key] = nodeLike(v[key.key], op.set.value, key.type)
    const list = get(schema, root, schema.roots.slot, op.path)!.node as Extract<MpNode, { t: 'arr' }>
    return apply(schema, root, { kind: 'insert', path: op.path, index: list.v.length, node: { ...node, v } })
  }
  return update(schema, root, rootType, op.path, 0, (node, type) => {
    if (op.kind === 'set') {
      const t = unwrap(type)
      const range = typeof t === 'string' ? RANGE[t] : undefined
      if (range && typeof op.value === 'number' && (op.value < range[0] || op.value > range[1]))
        throw new OpError(`${where}: ${op.value} doesn't fit a ${t} (${range[0]} to ${range[1]})`)
      return node.t === 'nil' ? nodeLike(undefined, op.value, type) : setValue(node, op.value, where)
    }
    if (op.kind === 'insert') {
      if (node.t === 'nil' && op.index === 0) return { t: 'arr', w: 'fix', v: [op.node] }
      if (node.t !== 'arr' || op.index > node.v.length) throw new OpError(`${where}: can't insert at ${op.index}`)
      const v = node.v.slice()
      v.splice(op.index, 0, op.node)
      return { ...node, v, w: v.length > 15 && node.w === 'fix' ? 'a16' : node.w }
    }
    if (node.t !== 'arr' || op.index >= node.v.length) throw new OpError(`${where}: no entry ${op.index} to remove`)
    const v = node.v.slice()
    v.splice(op.index, 1)
    return { ...node, v }
  })
}

export const replay = (schema: SaveSchema, original: MpNode, changes: Change[]) =>
  changes.flatMap(c => c.ops).reduce((root, op) => apply(schema, root, op), original)

/** The change list without change i, when every other change still applies without it. */
export function revertOne(schema: SaveSchema, original: MpNode, changes: Change[], i: number): Change[] {
  const rest = changes.filter((_, j) => j !== i)
  try {
    replay(schema, original, rest)
  } catch (e) {
    if (e instanceof OpError) throw new OpError(`Can't undo “${changes[i].label}” on its own: a later change depends on it. Undo the later changes first.`)
    throw e
  }
  return rest
}
