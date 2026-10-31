import { describe, expect, test } from 'vitest'
import { openSave } from '../src/codec/formats'
import { encodeMp, type MpNode } from '../src/codec/msgpack'
import { edits } from '../src/model/edits'
import { OpError, replay, revertOne, type Change } from '../src/model/ops'
import { followers, inventory, unlocked } from '../src/model/views'
import { schema, syntheticRoots } from './synthetic'
import { hasSaves, readSave } from './util'

const { slot: root } = syntheticRoots()
const run = (r: MpNode, ...changes: Change[]) => replay(schema, r, changes)

test('no changes replays to the same bytes', () => {
  expect(encodeMp(run(root))).toEqual(encodeMp(root))
})

test('rename changes exactly one value', () => {
  const next = run(root, edits.rename(schema, root, 0, 'Gerald'))
  expect(followers(schema, next).map(f => f.name)).toEqual(['Gerald', 'Ash', 'Thistle'])
  expect(edits.rename(schema, root, 0, 'Gerald').label).toBe('Pip renamed to Gerald')
})

test('an integer field refuses 7.5 with the path in the message', () => {
  expect(() => run(root, edits.setFollower(schema, root, 0, 'XPLevel', 7.5, 'Level'))).toThrow(/Followers\.0\.XPLevel/)
})

test('unlocking into a nil list creates the list; unlocking twice changes nothing', () => {
  const c = edits.unlock(schema, root, 'PlayerFoundRelics', 'RelicType', ['DamageEye_Coop'])
  const next = run(root, c)
  expect(unlocked(schema, next, 'PlayerFoundRelics')).toEqual(new Set(['DamageEye_Coop']))
  expect(edits.unlock(schema, next, 'PlayerFoundRelics', 'RelicType', ['DamageEye_Coop']).ops).toEqual([])
  expect(unlocked(schema, run(next, edits.lock(schema, next, 'PlayerFoundRelics', 'RelicType', 'DamageEye_Coop')), 'PlayerFoundRelics')).toEqual(new Set())
})

test('unlock all is one change with one op per locked id', () => {
  const c = edits.unlock(schema, root, 'PlayerFoundTrinkets', 'TarotCards.Card', ['Arrows', 'AttackRate'])
  expect([c.label, c.ops.length]).toEqual(['2 unlocked in PlayerFoundTrinkets', 2])
})

test('revive moves a dead follower; a later rename of the revived one cannot outlive undoing the revive', () => {
  const revive = edits.revive(schema, root, 0)
  const after = run(root, revive)
  const list = followers(schema, after)
  expect(list.map(f => [f.name, f.dead])).toEqual([['Pip', false], ['Ash', false], ['Thistle', false]])
  const rename = edits.rename(schema, after, 2, 'Back')
  expect(() => revertOne(schema, root, [revive, rename], 0)).toThrow(OpError)
  expect(revertOne(schema, root, [revive, rename], 1)).toEqual([revive])
})

test('clone gets a fresh ID, remove drops one', () => {
  const ids = followers(schema, run(root, edits.clone(schema, root, 0))).map(f => f.id)
  expect(ids).toEqual([1, 2, 4, 3])
  expect(followers(schema, run(root, edits.removeFollower(schema, root, 1))).map(f => f.name)).toEqual(['Pip', 'Thistle'])
})

test('inventory: set a quantity and add an item in the wire types of an existing one', () => {
  const next = run(root, edits.setQuantity(schema, root, 0, 99), edits.addItem(schema, root, 'BERRY', 5))
  expect(inventory(schema, next)).toEqual([{ index: 0, id: 'LOG', quantity: 99 }, { index: 1, id: 'BLACK_GOLD', quantity: 300 }, { index: 2, id: 'BERRY', quantity: 5 }])
})

describe.skipIf(!hasSaves)('real saves', () => {
  test('the real inventory and followers read, and a rename replays exactly', async () => {
    const o = await openSave('slot_0.mp', readSave('slot_0.mp'))
    const r = (o.data as Extract<typeof o.data, { kind: 'msgpack' }>).root
    const inv = inventory(schema, r)
    expect([inv.length, inv[0].quantity, schema.enums['InventoryItem.ITEM_TYPE']['2'] === inv[0].id]).toEqual([51, 871, true])
    expect(followers(schema, r).filter(f => !f.dead).length).toBe(18)
    const next = run(r, edits.rename(schema, r, 0, 'Test'))
    expect(followers(schema, next)[0].name).toBe('Test')
    expect((next as any).v.filter((_: MpNode, i: number) => i !== 1109).map(encodeMp)).toEqual((r as any).v.filter((_: MpNode, i: number) => i !== 1109).map(encodeMp))
  })
})
