// A small but real-shaped 1.5.26 save, built from the published schema: used where the real saves can't go (CI, e2e).
import { aesWrap } from '../src/codec/aes'
import { wrapBlockArray } from '../src/codec/lz4array'
import { encodeMp, type MpNode } from '../src/codec/msgpack'
import type { FieldType, SaveSchema } from '../src/schema/schema'
import { readFileSync } from 'node:fs'

// read, not imported: Playwright's Node loader wants an import attribute for JSON
export const schema = JSON.parse(readFileSync(new URL('./fixtures/save-schema-1.5.26.json', import.meta.url), 'utf8')) as SaveSchema
const nil: MpNode = { t: 'nil' }
export const int = (v: number): MpNode => ({ t: 'int', v, w: v >= 0 && v <= 127 ? 'pfix' : 'i32' })
export const str = (v: string): MpNode => ({ t: 'str', v, w: new TextEncoder().encode(v).length <= 31 ? 'fix' : 's8' })
export const f32 = (v: number): MpNode => ({ t: 'float', v, w: 'f32' })
export const arr = (v: MpNode[]): MpNode => ({ t: 'arr', v, w: v.length <= 15 ? 'fix' : 'a16' })
export const map = (v: [MpNode, MpNode][]): MpNode => ({ t: 'map', v, w: 'fix' })
const bool = (v: boolean): MpNode => ({ t: 'bool', v })
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
    _illness: f32(0), _exhaustion: f32(0), OldAge: bool(false), ...extra })
const item = (id: string, quantity: number) =>
  object('InventoryItem', { type: int(enumValue('InventoryItem.ITEM_TYPE', id)), quantity: int(quantity), QuantityReserved: int(0) })
const structure = (type: string, id: number, follower: number, values: Record<string, MpNode> = {}) =>
  object('StructuresData', { Type: int(enumValue('StructureBrain.TYPES', type)), ID: int(id), FollowerID: int(follower), ...values })
const ids = (...v: number[]) => arr(v.map(int))
const home = (slot: number) => ({ DwellingID: int(10), DwellingSlot: int(slot), DwellingLevel: int(1) })

export function syntheticRoots(version = '1.5.26.1058', tweak: (slot: MpNode) => MpNode = s => s) {
  const slot = object('DataManager', {
    AllowSaving: { t: 'bool', v: true }, CultName: str('Test Cult'), CultFaith: f32(82),
    Followers: arr([follower(1, 'Pip', 'Axolotl', 3, { _satiation: f32(12), ...home(0) }),
      follower(2, 'Ash', 'Fox', 9, { OldAge: bool(true), Adoration: f32(50.37), ...home(1) })]),
    // Died of old age, with the bookkeeping the game leaves on the dead, and a stale home that clashes with Pip's.
    Followers_Dead: arr([follower(3, 'Thistle', 'Hedgehog', 1, { OldAge: bool(true), Age: int(70), LifeExpectancy: int(60),
      DiedOfOldAge: bool(true), TimeOfDeath: int(40), HasBeenBuried: bool(true), Outfit: int(enumValue('FollowerOutfitType', 'Old')),
      CursedState: int(enumValue('Thought', 'OldAge')), Location: int(enumValue('FollowerLocation', 'Church')),
      SavedFollowerTaskType: int(enumValue('FollowerTaskType', 'FindPlaceToDie')), _HP: f32(10), _maxHP: f32(25), ...home(0) })]),
    CurrentDayIndex: int(47), Followers_Dead_IDs: ids(3), Followers_Elderly_IDs: ids(2, 3), Followers_Imprisoned_IDs: ids(),
    Followers_OnMissionary_IDs: ids(1), Followers_RecruitedUnique_IDs: ids(2),
    BaseStructures: arr([
      structure('SHARED_HOUSE', 10, 1, { MultipleFollowerIDs: ids(1, 2), FollowersClaimedSlots: ids(1, 2), ReservedFollowers: map([[int(0), int(1)]]) }),
      structure('MISSIONARY', 11, -1, { MultipleFollowerIDs: ids(1) }), structure('GRAVE', 12, 3), structure('CRYPT_1', 13, -1, { MultipleFollowerIDs: ids(3) })]),
    items: arr([item('LOG', 12), item('BLACK_GOLD', 300)]),
    PlayerFoundRelics: nil, PlayerFoundTrinkets: arr([]),
  })
  const meta = object('MetaData', { CultName: str('Test Cult'), FollowerCount: int(2), Day: int(47), Difficulty: int(1),
    PlayTime: f32(11520), Version: str(version) })
  return { slot: tweak(slot), meta }
}

type Arr = Extract<MpNode, { t: 'arr' }>
const DM = schema.types.DataManager.fields
/** The slot with one DataManager field replaced. */
export const at = (name: string, node: MpNode) => (slot: MpNode): MpNode => {
  const v = (slot as Arr).v.slice()
  v[DM.find(f => f.name === name)!.key] = node
  return { ...slot as Arr, v }
}

const blank = (t: FieldType): MpNode => typeof t === 'object'
  ? 'list' in t || 'object' in t ? arr([]) : 'map' in t ? map([]) : 'enum' in t ? int(0) : nil
  : t === 'bool' ? { t: 'bool', v: false } : /int/.test(t) ? int(0) : /float/.test(t) ? f32(0) : t === 'string' ? str('') : nil
/** Every nil DataManager field filled with a blank of its kind: the plain slot is too sparse to show a shift. */
export function filled(slot: MpNode): MpNode {
  const v = (slot as Arr).v.slice()
  for (const f of DM) if (v[f.key].t === 'nil') v[f.key] = blank(f.type)
  return { ...slot as Arr, v }
}
/** The filled slot with every key from 600 on moved up by one, as when a game version adds a field. */
export function shifted(slot: MpNode): MpNode {
  const v = (filled(slot) as Arr).v.slice()
  v.splice(600, 0, nil)
  return { ...slot as Arr, v }
}

const KEY = new Uint8Array(16).fill(7)
const IV = new Uint8Array(16).fill(9)
export async function syntheticSaves(version?: string, tweak?: (slot: MpNode) => MpNode): Promise<{ name: string; bytes: Uint8Array }[]> {
  const { slot, meta } = syntheticRoots(version, tweak)
  return [
    { name: 'slot_0.mp', bytes: await aesWrap({ key: KEY, iv: IV }, wrapBlockArray(encodeMp(slot))) },
    { name: 'meta_0.mp', bytes: await aesWrap({ key: KEY, iv: IV }, wrapBlockArray(encodeMp(meta))) },
  ]
}

let fresh = 100
/** The synthetic save as picked files under slot n, by default one no earlier test in this file used: the editor keeps
 * edits and backups per file name and contents, so a shared name would carry one test's state into the next. */
export const syntheticFiles = async (n = fresh++, tweak?: (slot: MpNode) => MpNode) =>
  (await syntheticSaves(undefined, tweak)).map(f => new File([f.bytes as Uint8Array<ArrayBuffer>], f.name.replace('_0', `_${n}`)))
