// Typed, read-only views of a save tree for the screens, all looked up by field name through the schema.
import { toPlain, type MpNode } from '../codec/msgpack'
import { field, get, type FieldType, type SaveSchema } from '../schema/schema'

export type Status = 'Faithful' | 'Hungry' | 'Ill' | 'Dead' | 'Elderly'
export type Need = 'satiation' | 'starvation' | 'rest' | 'illness' | 'exhaustion'
export interface FollowerView {
  index: number; dead: boolean; id: number; name: string; skin: string; level: number; age: number; lifeExpectancy: number
  loyalty: number; traits: string[]; needs: Record<Need, number>; status: Status
}

export const enumName = (schema: SaveSchema, name: string, value: unknown) => schema.enums[name]?.[String(value)] ?? String(value)
export function enumValue(schema: SaveSchema, name: string, id: string): number | undefined {
  const hit = Object.entries(schema.enums[name] ?? {}).find(([, n]) => n === id)
  return hit ? Number(hit[0]) : undefined
}

const plain = (schema: SaveSchema, root: MpNode, path: string[]) => {
  const at = get(schema, root, schema.roots.slot, path)
  return at && at.node.t !== 'nil' ? toPlain(at.node) : null
}
const listAt = (schema: SaveSchema, root: MpNode, name: string): MpNode[] => {
  const at = get(schema, root, schema.roots.slot, [name])
  return at?.node.t === 'arr' ? at.node.v : []
}
export const listLength = (schema: SaveSchema, root: MpNode, name: string) => listAt(schema, root, name).length

function follower(schema: SaveSchema, node: MpNode, index: number, dead: boolean): FollowerView {
  const v = (name: string) => {
    const f = field(schema, 'FollowerInfo', name)
    const n = f && node.t === 'arr' ? node.v[f.key] : undefined
    return n && n.t !== 'nil' ? toPlain(n) : null
  }
  const num = (name: string) => Number(v(name) ?? 0)
  const traitType = field(schema, 'FollowerInfo', 'Traits')?.type
  const traitEnum = typeof traitType === 'object' && 'list' in traitType && typeof traitType.list === 'object' && 'enum' in traitType.list ? traitType.list.enum : ''
  const needs = { satiation: num('_satiation'), starvation: num('_starvation'), rest: num('_rest'), illness: num('_illness'), exhaustion: num('_exhaustion') }
  const status: Status = dead ? 'Dead' : needs.illness > 0 ? 'Ill' : needs.satiation < 30 || needs.starvation > 0 ? 'Hungry' : v('OldAge') ? 'Elderly' : 'Faithful'
  return {
    index, dead, id: num('ID'), name: String(v('_name') ?? ''), skin: String(v('SkinName') ?? ''), level: num('XPLevel'),
    age: num('Age'), lifeExpectancy: num('LifeExpectancy'), loyalty: num('Adoration'),
    traits: ((v('Traits') as unknown[] | null) ?? []).map(t => enumName(schema, traitEnum, t)), needs, status,
  }
}

export const followers = (schema: SaveSchema, root: MpNode): FollowerView[] => [
  ...listAt(schema, root, 'Followers').map((n, i) => follower(schema, n, i, false)),
  ...listAt(schema, root, 'Followers_Dead').map((n, i) => follower(schema, n, i, true)),
]

export const inventory = (schema: SaveSchema, root: MpNode) =>
  listAt(schema, root, 'items').map((n, index) => {
    const at = (name: string) => toPlain(get(schema, n, 'InventoryItem', [name])?.node ?? { t: 'nil' })
    return { index, id: enumName(schema, 'InventoryItem.ITEM_TYPE', at('type')), quantity: Number(at('quantity') ?? 0) }
  })

/** The element type of a list field: an enum's name, 'string', or 'int'. */
export function listKind(schema: SaveSchema, fieldName: string): { enum: string } | 'string' | 'int' | null {
  const t = field(schema, schema.roots.slot, fieldName)?.type
  if (typeof t !== 'object' || !('list' in t)) return null
  const e = t.list
  if (typeof e === 'object' && 'enum' in e) return { enum: e.enum }
  if (e === 'string') return 'string'
  return typeof e === 'string' && /int/.test(e) ? 'int' : null
}

export const enumOf = (schema: SaveSchema, fieldName: string) => { const k = listKind(schema, fieldName); return k && typeof k === 'object' ? k.enum : null }

export function unlocked(schema: SaveSchema, root: MpNode, fieldName: string): Set<string> {
  const name = enumOf(schema, fieldName)
  return new Set(listAt(schema, root, fieldName).map(n => {
    const v = toPlain(n)
    return name ? enumName(schema, name, v) : String(v)
  }))
}

export const value = (schema: SaveSchema, root: MpNode, name: string) => plain(schema, root, [name])

/** A follower's SkinName as an API skin id: through the published variants when loaded, else a guess (Unicorn2 → Unicorn). */
// The API names a form after its first Spine skin, with anything but letters, digits, _ and - turned into _ (Fennec_Fox);
// a save names the variant it uses (Fennec Fox3). Without variants (offline, an old cache) the guess keeps portraits showing.
export function skinId(name: string, api: Set<string>, variants?: Map<string, string>): string | null {
  if (variants?.size) { const id = variants.get(name); return id && api.has(id) ? id : null }
  const clean = name.replace(/[^A-Za-z0-9_-]/g, '_')
  for (const id of [name, name.replace(/\d+$/, ''), clean, clean.replace(/\d+$/, '')]) if (api.has(id)) return id
  return null
}
