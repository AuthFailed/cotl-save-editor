import { describe, expect, test } from 'vitest'
import { openSave } from '../src/codec/formats'
import { encodeMp, toPlain, type MpNode } from '../src/codec/msgpack'
import { edits, FULL_NEEDS, unlink } from '../src/model/edits'
import { OpError, replay, revertOne, type Change, type Op } from '../src/model/ops'
import { DEATHS, enumName, followers, inventory, unlocked } from '../src/model/views'
import { get, unfit } from '../src/schema/schema'
import { at, enumValue, schema, syntheticRoots } from './synthetic'
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
  test('a locked follower is not cloned or revived, and stays locked when moved', () => {
    const { r } = locked(['Followers', '0'])
    expect(() => run(r, edits.clone(schema, r, 0))).toThrow(OpError)
    const dead = locked(['Followers_Dead', '0'])
    expect(() => run(dead.r, edits.revive(schema, dead.r, 0))).toThrow(OpError)
    const next = run(dead.r, ops({ kind: 'move', path: ['Followers_Dead'], index: 0, to: ['Followers'] }))
    expect(unfit.has(get(schema, next, 'DataManager', ['Followers', '2'])!.node)).toBe(true)
  })
})

const P = (r: MpNode, ...path: (string | number)[]) => { const a = get(schema, r, 'DataManager', path.map(String)); return a && toPlain(a.node) }
const fields = (r: MpNode, base: (string | number)[], names: string[]) => Object.fromEntries(names.map(n => [n, P(r, ...base, n)]))
const ops = (...o: Op[]): Change => ({ label: '', ops: o })
const STRUCTURES = schema.types.DataManager.fields.filter(f => JSON.stringify(f.type) === '{"list":{"object":"StructuresData"}}').map(f => f.name)
/** Every structure that still points at an ID, as list:index. */
const holding = (r: MpNode, id: number) => STRUCTURES.flatMap(n => ((P(r, n) as unknown[] | null) ?? []).flatMap((_, i) =>
  P(r, n, i, 'FollowerID') === id || ((P(r, n, i, 'MultipleFollowerIDs') as number[] | null) ?? []).includes(id) ? [`${n}:${i}`] : []))

describe('revive does the game\'s bookkeeping', () => {
  const thistle = (r: MpNode) => followers(schema, r).find(f => f.id === 3)!
  const SET = ['TimeOfDeath', 'HasBeenBuried', 'Location', 'Outfit', 'CursedState', 'SavedFollowerTaskType', 'OldAge', 'LifeExpectancy',
    'DwellingID', 'DwellingSlot', 'DwellingLevel']
  const cleanup = (r: MpNode) => {
    expect([P(r, 'Followers_Dead_IDs'), P(r, 'BaseStructures', 2, 'FollowerID'), P(r, 'BaseStructures', 3, 'MultipleFollowerIDs')]).toEqual([[], -1, []])
    expect(P(r, 'BaseStructures', 0)).toEqual(P(root, 'BaseStructures', 0))
    expect([DEATHS.some(d => P(r, 'Followers', 2, d) === true), P(r, 'Followers', 2, 'MurderedTerm')]).toEqual([false, null])
    expect(fields(r, ['Followers', 0], ['DwellingID', 'DwellingSlot'])).toEqual({ DwellingID: 10, DwellingSlot: 0 })
  }

  test('come back young: a young, healthy, homeless follower with no trace of death', () => {
    const c = edits.revive(schema, root, 0, true)
    expect(c.label).toBe('Thistle revived young')
    const r = run(root, c)
    cleanup(r)
    expect(P(r, 'Followers_Elderly_IDs')).toEqual([2])
    expect(fields(r, ['Followers', 2], [...SET, ...Object.keys(FULL_NEEDS), '_HP'])).toEqual({
      TimeOfDeath: 0, HasBeenBuried: false, Location: enumValue('FollowerLocation', 'Base'), Outfit: enumValue('FollowerOutfitType', 'None'),
      CursedState: enumValue('Thought', 'None'), SavedFollowerTaskType: enumValue('FollowerTaskType', 'None'), OldAge: false, LifeExpectancy: 90,
      DwellingID: 0, DwellingSlot: 0, DwellingLevel: 0, ...FULL_NEEDS, _HP: 25 })
    expect(thistle(r).status).toBe('Faithful')
  })

  test('a plain revive keeps an elderly follower consistently elderly', () => {
    const c = edits.revive(schema, root, 0)
    expect(c.label).toBe('Thistle revived')
    const r = run(root, c)
    cleanup(r)
    expect(P(r, 'Followers_Elderly_IDs')).toEqual([2, 3])
    expect(fields(r, ['Followers', 2], ['OldAge', 'CursedState', 'Outfit', 'SavedFollowerTaskType', 'LifeExpectancy', '_satiation'])).toEqual({
      OldAge: true, CursedState: enumValue('Thought', 'OldAge'), Outfit: enumValue('FollowerOutfitType', 'Old'),
      SavedFollowerTaskType: enumValue('FollowerTaskType', 'OldAge'), LifeExpectancy: 90, _satiation: 80 })
    expect(thistle(r).status).toBe('Elderly')
  })

  test('fields missing from the save get no op, and a save without the lists or structures still revives', () => {
    const c = edits.revive(schema, root, 0, true)
    const set = c.ops.filter(o => o.kind === 'set' && o.path[0] === 'Followers_Dead').map(o => o.path.at(-1)!)
    expect(set).toContain('DiedOfOldAge')
    expect(set.filter(n => P(root, 'Followers_Dead', 0, n) === null)).toEqual([])
    const nil: MpNode = { t: 'nil' }
    const { slot: bare } = syntheticRoots(undefined, s => at('BaseStructures', nil)(at('Followers_Dead_IDs', nil)(s)))
    const r = run(bare, edits.revive(schema, bare, 0, true))
    expect(followers(schema, r).map(f => [f.id, f.dead])).toEqual([[1, false], [2, false], [3, false]])
    expect([P(r, 'Followers_Dead_IDs'), P(r, 'BaseStructures')]).toEqual([null, null])
  })

  test('the revive undoes to the same bytes', () => {
    const c = edits.revive(schema, root, 0, true)
    cleanup(run(root, c))
    expect(encodeMp(run(root, ...revertOne(schema, root, [c], 0)))).toEqual(encodeMp(root))
  })

  test('a game version whose enums may be numbered differently keeps the enum fields as they are', () => {
    const r = run(root, edits.revive(schema, root, 0, true, false))
    expect(fields(r, ['Followers', 2], ['Outfit', 'CursedState', 'Location', 'SavedFollowerTaskType', 'OldAge', 'TimeOfDeath']))
      .toEqual({ ...fields(root, ['Followers_Dead', 0], ['Outfit', 'CursedState', 'Location', 'SavedFollowerTaskType']), OldAge: false, TimeOfDeath: 0 })
  })
})

describe('unlink', () => {
  test('takes a follower out of the ID lists and every structure that holds them', () => {
    const r = run(root, ops(...unlink(schema, root, 1)))
    expect(P(r, 'Followers_OnMissionary_IDs')).toEqual([])
    expect(fields(r, ['BaseStructures', 0], ['FollowerID', 'MultipleFollowerIDs', 'FollowersClaimedSlots', 'ReservedFollowers']))
      .toEqual({ FollowerID: -1, MultipleFollowerIDs: [2], FollowersClaimedSlots: [2], ReservedFollowers: {} })
    expect(P(r, 'BaseStructures', 1, 'MultipleFollowerIDs')).toEqual([])
  })

  test('keeps the lists it is told to, and always the recruit history', () => {
    const kept = run(root, ops(...unlink(schema, root, 2, ['Followers_Elderly_IDs'])))
    expect([P(kept, 'Followers_Elderly_IDs'), P(kept, 'Followers_RecruitedUnique_IDs')]).toEqual([[2, 3], [2]])
    const all = run(root, ops(...unlink(schema, root, 2)))
    expect([P(all, 'Followers_Elderly_IDs'), P(all, 'Followers_RecruitedUnique_IDs')]).toEqual([[3], [2]])
  })

  test('removes a demon with its type, and refuses when the pair is out of step', () => {
    const ids = run(root, edits.unlock(schema, root, 'Followers_Demons_IDs', ['1']))
    const both = run(ids, edits.unlock(schema, ids, 'Followers_Demons_Types', ['5']))
    const r = run(both, ops(...unlink(schema, both, 1)))
    expect([P(r, 'Followers_Demons_IDs'), P(r, 'Followers_Demons_Types')]).toEqual([[], []])
    expect(() => run(ids, ops(...unlink(schema, ids, 1)))).toThrow(OpError)
  })

  test('a map remove drops the entry at that position, guarded by its key', () => {
    const path = ['BaseStructures', '0', 'ReservedFollowers']
    const remove = (index: number, value?: number): Op => ({ kind: 'remove', path, index, ...value !== undefined && { guard: { path: [...path, '0'], value } } })
    expect(P(run(root, ops(remove(0, 1))), ...path)).toEqual({})
    expect(() => run(root, ops(remove(0, 2)))).toThrow(OpError)
    expect(() => run(root, ops(remove(1)))).toThrow(OpError)
  })
})

describe.skipIf(!hasSaves)('real saves: revive', async () => {
  const rootOf = async (n: string) => { const o = await openSave(n, readSave(n)); return (o.data as Extract<typeof o.data, { kind: 'msgpack' }>).root }
  const r0 = hasSaves ? await rootOf('slot_0.mp') : root

  test.each([true, false])('every dead follower of slot_0.mp comes back clean (young %s)', young => {
    for (const d of followers(schema, r0).filter(f => f.dead)) {
      const r = run(r0, edits.revive(schema, r0, d.index, young))
      const list = followers(schema, r), me = list.find(f => !f.dead && f.id === d.id)!, base = ['Followers', me.index]
      const why = `ID ${d.id}`, g = (n: string) => P(r, ...base, n)
      expect(P(r, 'Followers_Dead_IDs'), why).toEqual(list.filter(f => f.dead).map(f => f.id))
      expect([DEATHS.some(n => g(n) === true), g('TimeOfDeath'), g('MurderedTerm'), enumName(schema, 'FollowerLocation', g('Location'))], why).toEqual([false, 0, null, 'Base'])
      const outfit = enumName(schema, 'FollowerOutfitType', g('Outfit')), stays = !young && P(r0, 'Followers_Dead', d.index, 'OldAge') === true
      expect([['Ghost', 'Dissenter'].includes(outfit), outfit === 'Old' && !stays], why).toEqual([false, false])
      const homes = list.filter(f => !f.dead).map(f => P(r, 'Followers', f.index, 'DwellingID') + ':' + P(r, 'Followers', f.index, 'DwellingSlot')).filter(h => !h.startsWith('0:'))
      expect(new Set(homes).size, why).toBe(homes.length)
      expect(holding(r, d.id), why).toEqual([])
      if (!young) continue
      expect([g('OldAge'), (P(r, 'Followers_Elderly_IDs') as number[]).includes(d.id), me.lifeExpectancy > me.age,
        enumName(schema, 'Thought', g('CursedState')), me.status], why).toEqual([false, false, true, 'None', 'Faithful'])
      expect(fields(r, base, Object.keys(FULL_NEEDS)), why).toEqual(FULL_NEEDS)
    }
  })

  test.each(['slot_0.mp', 'slot_10.mp'])('reviving ID 15 of %s empties the body pit that held them', async n => {
    const r = n === 'slot_0.mp' ? r0 : await rootOf(n)
    const pit = (P(r, 'BaseStructures') as unknown[]).findIndex((_, i) => P(r, 'BaseStructures', i, 'FollowerID') === 15)
    expect(enumName(schema, 'StructureBrain.TYPES', P(r, 'BaseStructures', pit, 'Type'))).toBe('BODY_PIT')
    const next = run(r, edits.revive(schema, r, followers(schema, r).find(f => f.dead && f.id === 15)!.index, true))
    expect([holding(next, 15), P(next, 'BaseStructures', pit, 'FollowerID')]).toEqual([[], -1])
  })
})
