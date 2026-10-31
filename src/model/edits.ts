// Changes the screens make, each with a label a player can read in Review.
import { setValue, toPlain, type MpNode } from '../codec/msgpack'
import { field, get, type SaveSchema } from '../schema/schema'
import { nodeLike } from './build'
import { t } from '../i18n/i18n.svelte'
import type { Change, Op } from './ops'
import { DEATHS, enumName, enumOf, enumValue, followers, inventory, listKind, listLength, unlocked } from './views'

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

export const FULL_NEEDS = { _satiation: 100, _starvation: 0, _rest: 100, _illness: 0, _exhaustion: 0 }
const STRUCTURES = JSON.stringify({ list: { object: 'StructuresData' } })

/** Ops that take a follower ID out of every DataManager Followers_*_IDs list (but `keep`) and every structure that holds it. */
export function unlink(schema: SaveSchema, root: MpNode, id: number, keep: string[] = []): { ops: Op[]; cleared: string[] } {
  const ops: Op[] = [], cleared = new Set<string>()
  const at = (path: string[]) => get(schema, root, schema.roots.slot, path)?.node
  const plain = (path: string[]) => { const n = at(path); return n && toPlain(n) }
  const touch = (what: string, add: () => void) => { const n = ops.length; add(); if (ops.length > n) cleared.add(what) }
  // Highest index first, so each remove leaves the earlier indices in place.
  const drop = (path: string[], paired?: string[]) => {
    const list = at(path)
    if (list?.t === 'arr') for (let i = list.v.length - 1; i >= 0; i--) if (toPlain(list.v[i]) === id) {
      ops.push({ kind: 'remove', path, index: i, guard: { path: [...path, String(i)], value: id } })
      // Guarded with what is there now, so a shorter paired list refuses the change rather than misaligning the pair.
      if (paired) ops.push({ kind: 'remove', path: paired, index: i, guard: { path: [...paired, String(i)], value: plain([...paired, String(i)]) } })
    }
  }
  const fields = schema.types[schema.roots.slot].fields
  for (const { name } of fields)
    if (/^Followers_\w+_IDs$/.test(name) && name !== 'Followers_RecruitedUnique_IDs' && !keep.includes(name))
      touch(name, () => drop([name], name === 'Followers_Demons_IDs' ? ['Followers_Demons_Types'] : undefined))
  for (const { name, type } of fields) {
    const list = JSON.stringify(type) === STRUCTURES ? at([name]) : undefined
    if (list?.t === 'arr') list.v.forEach((_, si) => {
      const base = [name, String(si)], reserved = [...base, 'ReservedFollowers']
      touch(enumName(schema, 'StructureBrain.TYPES', plain([...base, 'Type'])), () => {
        if (plain([...base, 'FollowerID']) === id) ops.push({ kind: 'set', path: [...base, 'FollowerID'], value: -1, guard: { path: [...base, 'FollowerID'], value: id } })
        drop([...base, 'MultipleFollowerIDs'])
        drop([...base, 'FollowersClaimedSlots'])
        // Matched on values only: what the keys mean isn't known yet.
        const map = at(reserved)
        if (map?.t === 'map') for (let i = map.v.length - 1; i >= 0; i--) if (toPlain(map.v[i][1]) === id)
          ops.push({ kind: 'remove', path: reserved, index: i, guard: { path: [...reserved, String(toPlain(map.v[i][0]))], value: id } })
      })
    })
  }
  return { ops, cleared: [...cleared] }
}

export const edits = {
  rename(schema: SaveSchema, root: MpNode, who: Who, name: string): Change {
    const { f, base, guard } = followerAt(schema, root, who)
    return { label: t('ch.rename', { old: f.name, name }), ops: [{ kind: 'set', path: [...base, '_name'], value: name, guard }] }
  },

  setFollower(schema: SaveSchema, root: MpNode, who: Who, fieldName: string, value: unknown, what: string): Change {
    const { f, base, guard } = followerAt(schema, root, who)
    const old = toPlain(get(schema, nodeAt(schema, root, base), 'FollowerInfo', [fieldName])?.node ?? { t: 'nil' })
    return { label: t('ch.follower', { name: f.name, what, old: String(old ?? '—'), value: String(value) }), ops: [{ kind: 'set', path: [...base, fieldName], value, guard }] }
  },

  /** Several fields of one follower in one change (e.g. every need). */
  setFollowerFields(schema: SaveSchema, root: MpNode, who: Who, values: Record<string, unknown>, label: string): Change {
    const { f, base, guard } = followerAt(schema, root, who)
    return { label: t('ch.followerFields', { name: f.name, label }), ops: Object.entries(values).map(([k, value]): Op => ({ kind: 'set', path: [...base, k], value, guard })) }
  },

  /** A new form as the game names it: its first skin name, and SkinVariation pointing at it; no ops if the follower already has it. */
  setForm(schema: SaveSchema, root: MpNode, who: Who, variants: string[], from: string, to: string): Change {
    const { f, base, guard } = followerAt(schema, root, who)
    if (!variants.length) throw new RangeError(`No skin names for ${to}`)
    return { label: t('ch.follower', { name: f.name, what: t('what.form'), old: from, value: to }), ops: variants.includes(f.skin) ? []
      : [{ kind: 'set', path: [...base, 'SkinName'], value: variants[0], guard }, { kind: 'set', path: [...base, 'SkinVariation'], value: 0, guard }] }
  },

  /** Any scalar by path (Raw data). */
  setPath(schema: SaveSchema, root: MpNode, path: string[], value: unknown): Change {
    const old = toPlain(get(schema, root, schema.roots.slot, path)?.node ?? { t: 'nil' })
    return { label: t('ch.path', { path: path.join('.'), old: String(old ?? '—'), value: String(value) }), ops: [{ kind: 'set', path, value }] }
  },

  setRoot(schema: SaveSchema, root: MpNode, fieldName: string, value: unknown, what: string): Change {
    const old = toPlain(get(schema, root, schema.roots.slot, [fieldName])?.node ?? { t: 'nil' })
    return { label: t('ch.root', { what, old: String(old ?? '—'), value: String(value) }), ops: [{ kind: 'set', path: [fieldName], value }] }
  },

  addTrait(schema: SaveSchema, root: MpNode, who: Who, trait: string, name?: string): Change {
    const { f, base, guard } = followerAt(schema, root, who)
    if (f.traits.includes(trait)) return { label: '', ops: [] }
    const value = enumValue(schema, 'FollowerTrait.TraitType', trait)
    if (value === undefined) throw new RangeError(`Unknown trait ${trait}`)
    const sample = get(schema, nodeAt(schema, root, base), 'FollowerInfo', ['Traits', '0'])?.node
    return { label: t('ch.gains', { name: f.name, trait: name ?? trait }), ops: [{ kind: 'insert', path: [...base, 'Traits'], index: f.traits.length,
      node: nodeLike(sample, value, { enum: 'FollowerTrait.TraitType' }), guard }] }
  },

  removeTrait(schema: SaveSchema, root: MpNode, who: Who, trait: string, name?: string): Change {
    const { f, base, guard } = followerAt(schema, root, who)
    const index = f.traits.indexOf(trait)
    if (index < 0) return { label: '', ops: [] }
    const at = { path: [...base, 'Traits', String(index)], value: enumValue(schema, 'FollowerTrait.TraitType', trait) }
    return { label: t('ch.loses', { name: f.name, trait: name ?? trait }), ops: [{ kind: 'remove', path: [...base, 'Traits'], index, guard: [guard, at] }] }
  },

  /** Back among the living as the game's own revive leaves them: off the dead lists, out of graves and beds, homeless,
   * and either young or as elderly as living elders are. Only fields this save already holds are set. Without an exact
   * schema the enum fields stay as they are, since older saves number those enums differently. */
  revive(schema: SaveSchema, root: MpNode, deadIndex: number, young = false, exact = true): Change {
    const { f, base, guard } = followerAt(schema, root, { index: deadIndex, dead: true })
    const node = nodeAt(schema, root, base)
    const now = (name: string) => { const n = get(schema, node, 'FollowerInfo', [name])?.node; return n && n.t !== 'nil' ? toPlain(n) : undefined }
    const ops: Op[] = []
    const set = (name: string, value: unknown) => {
      const old = now(name)
      if (old !== undefined && value !== undefined && old !== value) ops.push({ kind: 'set', path: [...base, name], value, guard })
    }
    const named = (name: string, type: string, id: string) => { if (exact) set(name, enumValue(schema, type, id)) }
    const stays = !young && f.old
    for (const d of DEATHS) set(d, false)
    // A dead follower's house no longer lists them, so the old home would clash with whoever has the bed now.
    for (const [k, v] of Object.entries({ TimeOfDeath: 0, HasBeenBuried: false, HadFuneral: false, MurderedBy: 0, LeavingCult: false, DwellingID: 0, DwellingSlot: 0, DwellingLevel: 0 })) set(k, v)
    named('Location', 'FollowerLocation', 'Base')
    named('SavedFollowerTaskType', 'FollowerTaskType', stays ? 'OldAge' : 'None')
    if (['Ghost', 'Dissenter', 'Old'].includes(enumName(schema, 'FollowerOutfitType', now('Outfit')))) named('Outfit', 'FollowerOutfitType', stays ? 'Old' : 'None')
    named('CursedState', 'Thought', stays ? 'OldAge' : 'None')
    // The game adds 20 to 30 years; a fixed 20 keeps replay deterministic.
    if (f.age >= f.lifeExpectancy) set('LifeExpectancy', f.age + 20)
    if (young) {
      set('OldAge', false)
      for (const [k, v] of Object.entries(FULL_NEEDS)) set(k, v)
      set('_HP', now('_maxHP'))
    }
    // The sets come first: move reads the element at replay, so they travel and undo with it.
    ops.push(...unlink(schema, root, f.id, stays ? ['Followers_Elderly_IDs'] : []).ops,
      { kind: 'move', path: ['Followers_Dead'], index: deadIndex, to: ['Followers'], guard })
    return { label: t(young ? 'ch.revivedYoung' : 'ch.revived', { name: f.name }), ops }
  },

  clone(schema: SaveSchema, root: MpNode, who: Who): Change {
    const { f, guard } = followerAt(schema, root, who)
    const { index, dead } = ref(who)
    // The game hands out new ids from DataManager.FollowerID; the clone takes the next one and advances it.
    const taken = new Set(followers(schema, root).map(x => x.id))
    let id = Number(toPlain(get(schema, root, schema.roots.slot, ['FollowerID'])?.node ?? { t: 'nil' }) ?? 0) + 1
    if (!field(schema, schema.roots.slot, 'FollowerID') || id <= 1) id = Math.max(...taken) + 1
    while (taken.has(id)) id++
    const ops: Op[] = [{ kind: 'clone', path: [list(dead)], index, set: { field: 'ID', type: 'FollowerInfo', value: id }, guard }]
    if (field(schema, schema.roots.slot, 'FollowerID')) ops.push({ kind: 'set', path: ['FollowerID'], value: id })
    return { label: t('ch.cloned', { name: f.name }), ops }
  },

  removeFollower(schema: SaveSchema, root: MpNode, who: Who): Change {
    const { f, guard } = followerAt(schema, root, who)
    const { index, dead } = ref(who)
    return { label: t('ch.removed', { name: f.name }), ops: [{ kind: 'remove', path: [list(dead)], index, guard }] }
  },

  setQuantity(schema: SaveSchema, root: MpNode, itemIndex: number, quantity: number, name?: string): Change {
    const item = inventory(schema, root)[itemIndex]
    const type = toPlain(get(schema, root, schema.roots.slot, ['items', String(itemIndex), 'type'])!.node)
    return { label: t('ch.quantity', { name: name ?? item.id, old: item.quantity, value: quantity }),
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
    return { label: t('ch.added', { n: quantity, name: name ?? id }), ops: [{ kind: 'insert', path: ['items'], index: listLength(schema, root, 'items'), node }] }
  },

  unlock(schema: SaveSchema, root: MpNode, fieldName: string, ids: string[], label?: string): Change {
    const have = unlocked(schema, root, fieldName)
    const missing = [...new Set(ids)].filter(id => !have.has(id))
    const kind = listKind(schema, fieldName)
    const enumName = enumOf(schema, fieldName)
    const listType = field(schema, schema.roots.slot, fieldName)!.type
    const elem = typeof listType === 'object' && 'list' in listType ? listType.list : 'int32'
    const sample = get(schema, root, schema.roots.slot, [fieldName, '0'])?.node
    let at = listLength(schema, root, fieldName)
    const ops: Op[] = missing.map(id => {
      const value = enumName ? enumValue(schema, enumName, id) : kind === 'int' ? Number(id) : id
      if (value === undefined) throw new RangeError(`Unknown ${enumName} ${id}`)
      return { kind: 'insert', path: [fieldName], index: at++, node: nodeLike(sample, value, elem) }
    })
    return { label: label ?? (missing.length === 1 ? t('ch.unlocked', { name: missing[0] }) : t('ch.unlockedMany', { n: missing.length, field: fieldName })), ops }
  },

  lock(schema: SaveSchema, root: MpNode, fieldName: string, id: string, label?: string): Change {
    const items = [...unlocked(schema, root, fieldName)]
    const index = items.indexOf(id)
    if (index < 0) return { label: label ?? t('ch.locked', { name: id }), ops: [] }
    const value = toPlain(get(schema, root, schema.roots.slot, [fieldName, String(index)])!.node)
    return { label: label ?? t('ch.locked', { name: id }), ops: [{ kind: 'remove', path: [fieldName], index, guard: { path: [fieldName, String(index)], value } }] }
  },
}
