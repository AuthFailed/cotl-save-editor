import { describe, expect, test } from 'vitest'
import { openSave } from '../src/codec/formats'
import { encodeMp, type MpNode } from '../src/codec/msgpack'
import { edits } from '../src/model/edits'
import { OpError, replay, revertOne, type Change } from '../src/model/ops'
import { followers, inventory, unlocked } from '../src/model/views'
import { get, unfit } from '../src/schema/schema'
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
  const c = edits.unlock(schema, root, 'PlayerFoundRelics', ['DamageEye_Coop'])
  const next = run(root, c)
  expect(unlocked(schema, next, 'PlayerFoundRelics')).toEqual(new Set(['DamageEye_Coop']))
  expect(edits.unlock(schema, next, 'PlayerFoundRelics', ['DamageEye_Coop']).ops).toEqual([])
  expect(unlocked(schema, run(next, edits.lock(schema, next, 'PlayerFoundRelics', 'DamageEye_Coop')), 'PlayerFoundRelics')).toEqual(new Set())
})

test('unlock all is one change with one op per locked id', () => {
  const c = edits.unlock(schema, root, 'PlayerFoundTrinkets', ['Arrows', 'AttackRate'])
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

test('root fields and follower traits', () => {
  const next = run(root, edits.setRoot(schema, root, 'CultName', 'New Cult', 'Cult name'), edits.addTrait(schema, root, 0, 'AnimalLover'))
  expect([(next as any).v[410].v, followers(schema, next)[0].traits]).toEqual(['New Cult', ['AnimalLover']])
  expect(followers(schema, run(next, edits.removeTrait(schema, next, 0, 'AnimalLover'))).at(0)!.traits).toEqual([])
  expect(edits.addTrait(schema, next, 0, 'AnimalLover').ops).toEqual([])
})

test('setPath edits any scalar by path, and refuses a wrong type', () => {
  const next = run(root, edits.setPath(schema, root, ['Followers', '1', 'XPLevel'], 12))
  expect(followers(schema, next)[1].level).toBe(12)
  expect(edits.setPath(schema, root, ['CultName'], 'X').label).toBe('CultName Test Cult → X')
  expect(() => run(root, edits.setPath(schema, root, ['CultFaith'], 'abc'))).toThrow(/CultFaith/)
})

describe('a node that does not fit its schema', () => {
  // Fresh roots each time: the lock is on the node itself.
  const locked = (path: string[]) => {
    const r = syntheticRoots().slot, node = get(schema, r, 'DataManager', path)!.node
    unfit.add(node)
    return { r, node }
  }
  test('refuses a set on it, not on another field', () => {
    const { r } = locked(['CultName'])
    expect(() => run(r, edits.setRoot(schema, r, 'CultName', 'X', 'Cult name'))).toThrow(OpError)
    expect(() => run(r, edits.setRoot(schema, r, 'CultName', 'X', 'Cult name'))).toThrow(/CultName/)
    expect(get(schema, run(r, edits.setRoot(schema, r, 'CultFaith', 3, 'Faith')), 'DataManager', ['CultFaith'])?.node).toMatchObject({ v: 3 })
  })
  test('a locked list refuses an insert; an unlocked one gives up a locked element', () => {
    const { r } = locked(['items'])
    expect(() => run(r, edits.addItem(schema, r, 'BERRY', 5))).toThrow(OpError)
    const other = locked(['Followers', '0'])
    expect(followers(schema, run(other.r, edits.removeFollower(schema, other.r, 0))).map(f => f.id)).toEqual([2, 3])
  })
  test('a locked follower is not cloned, and stays locked when moved', () => {
    const { r } = locked(['Followers', '0'])
    expect(() => run(r, edits.clone(schema, r, 0))).toThrow(OpError)
    const dead = locked(['Followers_Dead', '0'])
    const next = run(dead.r, edits.revive(schema, dead.r, 0))
    expect(unfit.has(get(schema, next, 'DataManager', ['Followers', '2'])!.node)).toBe(true)
  })
})
