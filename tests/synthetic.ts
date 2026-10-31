// A small but real-shaped 1.5.26 save, built from the published schema: used where the real saves can't go (CI, e2e).
import { aesWrap } from '../src/codec/aes'
import { wrapBlockArray } from '../src/codec/lz4array'
import { encodeMp, type MpNode } from '../src/codec/msgpack'
import type { SaveSchema } from '../src/schema/schema'
import { readFileSync } from 'node:fs'

// read, not imported: Playwright's Node loader wants an import attribute for JSON
export const schema = JSON.parse(readFileSync(new URL('./fixtures/save-schema-1.5.26.json', import.meta.url), 'utf8')) as SaveSchema
const nil: MpNode = { t: 'nil' }
const int = (v: number): MpNode => ({ t: 'int', v, w: v >= 0 && v <= 127 ? 'pfix' : 'i32' })
const str = (v: string): MpNode => ({ t: 'str', v, w: new TextEncoder().encode(v).length <= 31 ? 'fix' : 's8' })
const f32 = (v: number): MpNode => ({ t: 'float', v, w: 'f32' })
const arr = (v: MpNode[]): MpNode => ({ t: 'arr', v, w: v.length <= 15 ? 'fix' : 'a16' })
export const enumValue = (name: string, value: string) =>
  Number(Object.entries(schema.enums[name]).find(([, n]) => n === value)![0])

function object(type: string, values: Record<string, MpNode>): MpNode {
  const fields = schema.types[type].fields
  const v: MpNode[] = Array.from({ length: Math.max(...fields.map(f => f.key)) + 1 }, () => nil)
  for (const [name, node] of Object.entries(values)) v[fields.find(f => f.name === name)!.key] = node
  return { t: 'arr', v, w: v.length <= 15 ? 'fix' : 'a16' }
}

const follower = (id: number, name: string, skin: string, level: number, extra: Record<string, MpNode> = {}) =>
  object('FollowerInfo', { ID: int(id), _name: str(name), SkinName: str(skin), XPLevel: int(level), Age: int(20),
    LifeExpectancy: int(60), Adoration: f32(50), Traits: arr([]), _satiation: f32(80), _starvation: f32(0), _rest: f32(90),
    _illness: f32(0), _exhaustion: f32(0), OldAge: { t: 'bool', v: false }, ...extra })
const item = (id: string, quantity: number) =>
  object('InventoryItem', { type: int(enumValue('InventoryItem.ITEM_TYPE', id)), quantity: int(quantity), QuantityReserved: int(0) })

export function syntheticRoots(version = '1.5.26.1058') {
  const slot = object('DataManager', {
    AllowSaving: { t: 'bool', v: true }, CultName: str('Test Cult'), CultFaith: f32(82),
    Followers: arr([follower(1, 'Pip', 'Axolotl', 3, { _satiation: f32(12) }), follower(2, 'Ash', 'Fox', 9, { OldAge: { t: 'bool', v: true }, Adoration: f32(50.37) })]),
    Followers_Dead: arr([follower(3, 'Thistle', 'Hedgehog', 1)]),
    items: arr([item('LOG', 12), item('BLACK_GOLD', 300)]),
    PlayerFoundRelics: nil, PlayerFoundTrinkets: arr([]),
  })
  const meta = object('MetaData', { CultName: str('Test Cult'), FollowerCount: int(2), Day: int(47), Difficulty: int(1),
    PlayTime: f32(11520), Version: str(version) })
  return { slot, meta }
}

const KEY = new Uint8Array(16).fill(7)
const IV = new Uint8Array(16).fill(9)
export async function syntheticSaves(version?: string): Promise<{ name: string; bytes: Uint8Array }[]> {
  const { slot, meta } = syntheticRoots(version)
  return [
    { name: 'slot_0.mp', bytes: await aesWrap({ key: KEY, iv: IV }, wrapBlockArray(encodeMp(slot))) },
    { name: 'meta_0.mp', bytes: await aesWrap({ key: KEY, iv: IV }, wrapBlockArray(encodeMp(meta))) },
  ]
}

let fresh = 100
/** The synthetic save as picked files under slot n, by default one no earlier test in this file used: the editor keeps
 * edits and backups per file name and contents, so a shared name would carry one test's state into the next. */
export const syntheticFiles = async (n = fresh++) =>
  (await syntheticSaves()).map(f => new File([f.bytes as Uint8Array<ArrayBuffer>], f.name.replace('_0', `_${n}`)))
