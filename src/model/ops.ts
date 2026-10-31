// Every edit is a change of one or more ops; Review, undo and export all replay this one list from the original.
import { setValue, toPlain, type MpNode } from '../codec/msgpack'
import { field, get, type FieldType, type SaveSchema } from '../schema/schema'
import { nodeLike } from './build'

/** guard: a value that must still be at that path, so an op never lands on a different follower or item. */
type Guard = { path: string[]; value: unknown }
export type Op = { guard?: Guard } & (
  | { kind: 'set'; path: string[]; value: unknown }
  | { kind: 'insert'; path: string[]; index: number; node: MpNode }
  | { kind: 'remove'; path: string[]; index: number })
export interface Change { label: string; ops: Op[] }

export class OpError extends Error {
  override name = 'OpError'
}

const unwrap = (t: FieldType): FieldType => (typeof t === 'object' && 'nullable' in t ? unwrap(t.nullable) : t)

function update(schema: SaveSchema, node: MpNode, type: FieldType, path: string[], i: number,
  fn: (node: MpNode, type: FieldType) => MpNode): MpNode {
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
  if (op.guard) {
    const at = get(schema, root, schema.roots.slot, op.guard.path)
    if (!at || toPlain(at.node) !== op.guard.value) throw new OpError(`${op.guard.path.join('.')}: changed since this edit was made`)
  }
  const where = op.path.join('.')
  return update(schema, root, rootType, op.path, 0, (node, type) => {
    if (op.kind === 'set') return node.t === 'nil' ? nodeLike(undefined, op.value, type) : setValue(node, op.value, where)
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
