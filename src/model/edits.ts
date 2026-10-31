// Changes the screens make, each with a label a player can read in Review.
import { setValue, toPlain, type MpNode } from '../codec/msgpack'
import { field, get, type SaveSchema } from '../schema/schema'
import { nodeLike } from './build'
import type { Change, Op } from './ops'
import { enumValue, followers, inventory, listKind, listLength, unlocked } from './views'

type Who = number | { index: number; dead?: boolean }
const ref = (who: Who) => (typeof who === 'number' ? { index: who, dead: false } : { dead: false, ...who })
const list = (dead: boolean) => (dead ? 'Followers_Dead' : 'Followers')

function followerAt(schema: SaveSchema, root: MpNode, who: Who) {
  const { index, dead } = ref(who)
  const f = followers(schema, root).find(x => x.dead === dead && x.index === index)
  if (!f) throw new RangeError(`No ${dead ? 'dead ' : ''}follower ${index}`)
  return { f, base: [list(dead), String(index)], guard: { path: [list(dead), String(index), 'ID'], value: f.id } }
}

const nodeAt = (schema: SaveSchema, root: MpNode, path: string[]) => get(schema, root, schema.roots.slot, path)!.node

export const edits = {
  rename(schema: SaveSchema, root: MpNode, who: Who, name: string): Change {
    const { f, base, guard } = followerAt(schema, root, who)
    return { label: `${f.name} renamed to ${name}`, ops: [{ kind: 'set', path: [...base, '_name'], value: name, guard }] }
  },

  setFollower(schema: SaveSchema, root: MpNode, who: Who, fieldName: string, value: unknown, what: string): Change {
    const { f, base, guard } = followerAt(schema, root, who)
    const old = toPlain(get(schema, nodeAt(schema, root, base), 'FollowerInfo', [fieldName])?.node ?? { t: 'nil' })
    return { label: `${f.name} · ${what} ${old ?? '—'} → ${value}`, ops: [{ kind: 'set', path: [...base, fieldName], value, guard }] }
  },

  /** Several fields of one follower in one change (e.g. every need). */
  setFollowerFields(schema: SaveSchema, root: MpNode, who: Who, values: Record<string, unknown>, label: string): Change {
    const { f, base, guard } = followerAt(schema, root, who)
    return { label: `${f.name} · ${label}`, ops: Object.entries(values).map(([k, value]): Op => ({ kind: 'set', path: [...base, k], value, guard })) }
  },

  setRoot(schema: SaveSchema, root: MpNode, fieldName: string, value: unknown, what: string): Change {
    const old = toPlain(get(schema, root, schema.roots.slot, [fieldName])?.node ?? { t: 'nil' })
    return { label: `${what} ${old ?? '—'} → ${value}`, ops: [{ kind: 'set', path: [fieldName], value }] }
  },

  addTrait(schema: SaveSchema, root: MpNode, who: Who, trait: string, name?: string): Change {
    const { f, base, guard } = followerAt(schema, root, who)
    if (f.traits.includes(trait)) return { label: '', ops: [] }
    const value = enumValue(schema, 'FollowerTrait.TraitType', trait)
    if (value === undefined) throw new RangeError(`Unknown trait ${trait}`)
    const sample = get(schema, nodeAt(schema, root, base), 'FollowerInfo', ['Traits', '0'])?.node
    return { label: `${f.name} gains ${name ?? trait}`, ops: [{ kind: 'insert', path: [...base, 'Traits'], index: f.traits.length,
      node: nodeLike(sample, value, { enum: 'FollowerTrait.TraitType' }), guard }] }
  },

  removeTrait(schema: SaveSchema, root: MpNode, who: Who, trait: string, name?: string): Change {
    const { f, base, guard } = followerAt(schema, root, who)
    const index = f.traits.indexOf(trait)
    if (index < 0) return { label: '', ops: [] }
    return { label: `${f.name} loses ${name ?? trait}`, ops: [{ kind: 'remove', path: [...base, 'Traits'], index, guard }] }
  },

  revive(schema: SaveSchema, root: MpNode, deadIndex: number): Change {
    const { f, base, guard } = followerAt(schema, root, { index: deadIndex, dead: true })
    return { label: `${f.name} revived`, ops: [
      { kind: 'insert', path: ['Followers'], index: listLength(schema, root, 'Followers'), node: nodeAt(schema, root, base) },
      { kind: 'remove', path: ['Followers_Dead'], index: deadIndex, guard },
    ] }
  },

  clone(schema: SaveSchema, root: MpNode, who: Who): Change {
    const { f, base } = followerAt(schema, root, who)
    const node = nodeAt(schema, root, base)
    const key = field(schema, 'FollowerInfo', 'ID')!.key
    const id = Math.max(...followers(schema, root).map(x => x.id)) + 1
    if (node.t !== 'arr') throw new TypeError('Not a follower')
    const v = node.v.slice()
    v[key] = setValue(v[key], id, 'ID')
    return { label: `${f.name} cloned`, ops: [{ kind: 'insert', path: ['Followers'], index: listLength(schema, root, 'Followers'), node: { ...node, v } }] }
  },

  removeFollower(schema: SaveSchema, root: MpNode, who: Who): Change {
    const { f, guard } = followerAt(schema, root, who)
    const { index, dead } = ref(who)
    return { label: `${f.name} removed`, ops: [{ kind: 'remove', path: [list(dead)], index, guard }] }
  },

  setQuantity(schema: SaveSchema, root: MpNode, itemIndex: number, quantity: number, name?: string): Change {
    const item = inventory(schema, root)[itemIndex]
    const type = toPlain(get(schema, root, schema.roots.slot, ['items', String(itemIndex), 'type'])!.node)
    return { label: `${name ?? item.id} ${item.quantity} → ${quantity}`,
      ops: [{ kind: 'set', path: ['items', String(itemIndex), 'quantity'], value: quantity, guard: { path: ['items', String(itemIndex), 'type'], value: type } }] }
  },

  addItem(schema: SaveSchema, root: MpNode, id: string, quantity: number, name?: string): Change {
    const have = inventory(schema, root).find(x => x.id === id)
    if (have) return edits.setQuantity(schema, root, have.index, have.quantity + quantity, name)
    const type = enumValue(schema, 'InventoryItem.ITEM_TYPE', id)
    if (type === undefined) throw new RangeError(`Unknown item ${id}`)
    const fields = schema.types.InventoryItem.fields
    const sample = get(schema, root, schema.roots.slot, ['items', '0'])?.node
    const values: Record<string, number> = { type, quantity, QuantityReserved: 0 }
    const v: MpNode[] = sample?.t === 'arr' ? sample.v.slice()
      : Array.from({ length: Math.max(...fields.map(f => f.key)) + 1 }, (): MpNode => ({ t: 'nil' }))
    for (const f of fields) if (f.name in values) v[f.key] = nodeLike(v[f.key], values[f.name], f.type)
    const node: MpNode = sample?.t === 'arr' ? { ...sample, v } : { t: 'arr', w: v.length <= 15 ? 'fix' : 'a16', v }
    return { label: `Added ${quantity} ${name ?? id}`, ops: [{ kind: 'insert', path: ['items'], index: listLength(schema, root, 'items'), node }] }
  },

  unlock(schema: SaveSchema, root: MpNode, fieldName: string, enumName: string | null, ids: string[], label?: string): Change {
    const have = unlocked(schema, root, fieldName)
    const missing = [...new Set(ids)].filter(id => !have.has(id))
    const kind = listKind(schema, fieldName)
    const t = field(schema, schema.roots.slot, fieldName)!.type
    const elem = typeof t === 'object' && 'list' in t ? t.list : 'int32'
    const sample = get(schema, root, schema.roots.slot, [fieldName, '0'])?.node
    let at = listLength(schema, root, fieldName)
    const ops: Op[] = missing.map(id => {
      const value = enumName ? enumValue(schema, enumName, id) : kind === 'int' ? Number(id) : id
      if (value === undefined) throw new RangeError(`Unknown ${enumName} ${id}`)
      return { kind: 'insert', path: [fieldName], index: at++, node: nodeLike(sample, value, elem) }
    })
    return { label: label ?? (missing.length === 1 ? `${missing[0]} unlocked` : `${missing.length} unlocked in ${fieldName}`), ops }
  },

  lock(schema: SaveSchema, root: MpNode, fieldName: string, enumName: string | null, id: string, label?: string): Change {
    const items = [...unlocked(schema, root, fieldName)]
    const index = items.indexOf(id)
    if (index < 0) return { label: label ?? `${id} locked`, ops: [] }
    const value = toPlain(get(schema, root, schema.roots.slot, [fieldName, String(index)])!.node)
    return { label: label ?? `${id} locked`, ops: [{ kind: 'remove', path: [fieldName], index, guard: { path: [fieldName, String(index)], value } }] }
  },
}
