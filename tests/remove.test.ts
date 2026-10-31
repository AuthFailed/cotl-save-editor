import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { openSave } from '../src/codec/formats'
import { encodeMp, toPlain, type MpNode } from '../src/codec/msgpack'
import { edits } from '../src/model/edits'
import { fromTree, jsonToTree } from '../src/model/json'
import { OpError, replay, revertOne, type Change } from '../src/model/ops'
import { listSlots, openSlot, push, redo, revert, session, undo } from '../src/model/session.svelte'
import { DEATHS, enumName, followers, uniqueIds } from '../src/model/views'
import { get, type FieldType } from '../src/schema/schema'
import { schema, syntheticRoots } from './synthetic'
import { hasSaves, readSave } from './util'

const { slot: root } = syntheticRoots()
const run = (r: MpNode, ...changes: Change[]) => replay(schema, r, changes)
const P = (r: MpNode, ...path: (string | number)[]) => { const a = get(schema, r, 'DataManager', path.map(String)); return a && toPlain(a.node) }
const fields = (r: MpNode, base: (string | number)[], names: string[]) => Object.fromEntries(names.map(n => [n, P(r, ...base, n)]))
const deadIds = (r: MpNode) => followers(schema, r).filter(f => f.dead).map(f => f.id)
const ID_LISTS = schema.types.DataManager.fields.map(f => f.name).filter(n => /^Followers_\w+_IDs$/.test(n))
/** Every Followers_*_IDs list that holds an ID. */
const listing = (r: MpNode, id: number) => ID_LISTS.filter(n => ((P(r, n) as number[] | null) ?? []).includes(id))
const HOLDS = ['FollowerID', 'MultipleFollowerIDs', 'FollowersClaimedSlots']

/** Every StructuresData anywhere in the tree that still holds an ID, as a path. */
function holding(r: MpNode, id: number) {
  const out: string[] = []
  const walk = (node: MpNode, type: FieldType, path: string[]) => {
    while (typeof type === 'object' && 'nullable' in type) type = type.nullable
    if (typeof type !== 'object') return
    if ('object' in type && node.t === 'arr') {
      if (type.object === 'StructuresData' && HOLDS.some(n => [toPlain(get(schema, node, 'StructuresData', [n])?.node ?? { t: 'nil' })].flat().includes(id)))
        out.push(path.join('.'))
      for (const f of schema.types[type.object]?.fields ?? []) if (node.v[f.key]) walk(node.v[f.key], f.type, [...path, f.name])
    } else if ('list' in type && node.t === 'arr') node.v.forEach((n, i) => walk(n, type.list, [...path, String(i)]))
    else if ('map' in type && node.t === 'map') node.v.forEach(([k, n]) => walk(n, type.map[1], [...path, String(toPlain(k))]))
  }
  walk(r, { object: 'DataManager' }, [])
  return out
}

describe('kill and send away move a follower to the dead the way the game does', () => {
  test('kill: one change that clears every structure and list, with the cause and the day', () => {
    const c = edits.kill(schema, root, 0, 'DiedOfIllness')
    const r = run(root, c)
    expect(followers(schema, r).filter(f => f.dead).map(f => f.id)).toEqual([3, 1])
    expect(fields(r, ['Followers_Dead', 1], ['ID', 'DiedOfIllness', 'TimeOfDeath'])).toEqual({ ID: 1, DiedOfIllness: true, TimeOfDeath: 47 })
    expect(P(r, 'Followers_Dead_IDs')).toEqual([3, 1])
    expect(fields(r, ['BaseStructures', 0], ['FollowerID', 'MultipleFollowerIDs', 'FollowersClaimedSlots', 'ReservedFollowers']))
      .toEqual({ FollowerID: -1, MultipleFollowerIDs: [2], FollowersClaimedSlots: [2], ReservedFollowers: {} })
    expect([P(r, 'BaseStructures', 1, 'MultipleFollowerIDs'), P(r, 'Followers_OnMissionary_IDs')]).toEqual([[], []])
    expect(c.label.startsWith('Pip killed · Died of illness · cleared from')).toBe(true)
    for (const n of ['SHARED_HOUSE', 'MISSIONARY', 'Followers_OnMissionary_IDs']) expect(c.label).toContain(n)
  })

  test('a kill with no cause sets no death flag, but still the day', () => {
    const c = edits.kill(schema, root, 0, '')
    const r = run(root, c)
    expect([DEATHS.some(d => P(r, 'Followers_Dead', 1, d) === true), P(r, 'Followers_Dead', 1, 'TimeOfDeath')]).toEqual([false, 47])
    expect(c.label.startsWith('Pip killed · Other')).toBe(true)
  })

  test('send away: a leaver with the day they left, and no death', () => {
    const c = edits.sendAway(schema, root, 0)
    const r = run(root, c)
    expect(fields(r, ['Followers_Dead', 1], ['LeavingCult', 'LeftCultDay', 'TimeOfDeath'])).toEqual({ LeavingCult: true, LeftCultDay: 47, TimeOfDeath: null })
    expect(DEATHS.some(d => P(r, 'Followers_Dead', 1, d) === true)).toBe(false)
    expect(P(r, 'Followers_Dead_IDs')).toEqual(deadIds(r))
    expect(c.label.startsWith('Pip left the cult · cleared from')).toBe(true)
  })

  test('a killed elder stays listed as elderly, and the recruit history stays', () => {
    const r = run(root, edits.kill(schema, root, 1, 'DiedOfOldAge'))
    expect([P(r, 'Followers_Elderly_IDs'), P(r, 'Followers_RecruitedUnique_IDs'), P(r, 'Followers_Dead_IDs')]).toEqual([[2, 3], [2], [3, 2]])
  })

  test('undoing the kill alone is refused once the dead follower was renamed; undoing the rename keeps the kill', () => {
    const kill = edits.kill(schema, root, 0, 'DiedOfIllness')
    const after = run(root, kill)
    const rename = edits.rename(schema, after, { index: 1, dead: true }, 'Back')
    expect(() => revertOne(schema, root, [kill, rename], 0)).toThrow(OpError)
    expect(revertOne(schema, root, [kill, rename], 1)).toEqual([kill])
  })

  test('a kill then a young revive gives back the dead list as it was', () => {
    const after = run(root, edits.kill(schema, root, 0, 'DiedOfIllness'))
    const back = run(after, edits.revive(schema, after, 1, true))
    expect([P(back, 'Followers_Dead_IDs'), P(back, 'Followers', 1, 'TimeOfDeath')]).toEqual([[3], 0])
  })

  test('undoing an earlier change on its own keeps the dead list in step with the dead', () => {
    const first = edits.kill(schema, root, 1, 'DiedOfOldAge')
    const second = edits.kill(schema, run(root, first), 0, '')
    const r = run(root, ...revertOne(schema, root, [first, second], 0))
    const revive = edits.revive(schema, root, 0)
    const kill = edits.kill(schema, run(root, revive), 0, '')
    const back = run(root, ...revertOne(schema, root, [revive, kill], 0))
    expect([deadIds(r), P(r, 'Followers_Dead_IDs'), deadIds(back), P(back, 'Followers_Dead_IDs')]).toEqual([[3, 1], [3, 1], [3, 1], [3, 1]])
  })

  test('a living follower wrongly listed as dead ends up listed once, in step', () => {
    const stray = run(root, edits.unlock(schema, root, 'Followers_Dead_IDs', ['1']))
    const r = run(stray, edits.kill(schema, stray, 0, ''))
    expect([P(r, 'Followers_Dead_IDs'), deadIds(r)]).toEqual([[3, 1], [3, 1]])
  })

  test('reviving someone sent away clears the leaving', () => {
    const away = run(root, edits.sendAway(schema, root, 0))
    const r = run(away, edits.revive(schema, away, 1))
    expect(fields(r, ['Followers', 1], ['ID', 'LeavingCult', 'LeftCultDay'])).toEqual({ ID: 1, LeavingCult: false, LeftCultDay: 0 })
  })

  test('a JSON send away keeps the record\'s own keys and lists it as dead', () => {
    const json = { Followers: [{ ID: 1, _name: 'A', Extra: 'a' }], Followers_Dead: [], Followers_Dead_IDs: [] }
    const tree = jsonToTree(schema, json)
    expect(fromTree(schema, run(tree, edits.sendAway(schema, tree, 0)), json)).toEqual({
      Followers: [], Followers_Dead: [{ ID: 1, _name: 'A', Extra: 'a', LeavingCult: true, LeftCultDay: 0 }], Followers_Dead_IDs: [1] })
  })
})

describe('delete record leaves no reference behind', () => {
  test('a living follower: off every list and structure, the demon pair together, and no spouse pointing at them', () => {
    const ids = run(root, edits.unlock(schema, root, 'Followers_Demons_IDs', ['1']))
    const demons = run(ids, edits.unlock(schema, ids, 'Followers_Demons_Types', ['5']))
    const wed = run(demons, edits.setPath(schema, demons, ['Followers', '1', 'SpouseFollowerID'], 1))
    const c = edits.removeFollower(schema, wed, 0)
    const r = run(wed, c)
    expect(followers(schema, r).map(f => f.id)).toEqual([2, 3])
    expect([P(r, 'Followers_Demons_IDs'), P(r, 'Followers_Demons_Types'), P(r, 'Followers', 0, 'SpouseFollowerID')]).toEqual([[], [], -1])
    expect([listing(r, 1), holding(r, 1)]).toEqual([[], []])
    expect(c.label.startsWith('Pip removed · cleared from')).toBe(true)
  })

  test('a dead follower: off the dead and elderly lists, the grave and the crypt', () => {
    const r = run(root, edits.removeFollower(schema, root, { index: 0, dead: true }))
    expect([P(r, 'Followers_Dead_IDs'), deadIds(r), P(r, 'Followers_Elderly_IDs')]).toEqual([[], [], [2]])
    expect([P(r, 'BaseStructures', 2, 'FollowerID'), P(r, 'BaseStructures', 3, 'MultipleFollowerIDs')]).toEqual([-1, []])
  })

  test('the recruit history and everyone else\'s records stay', () => {
    const r = run(root, edits.removeFollower(schema, root, 1))
    expect(P(r, 'Followers_RecruitedUnique_IDs')).toEqual([2])
    expect([P(r, 'Followers', 0), P(r, 'Followers_Dead', 0)].map(x => JSON.stringify(x))).toEqual([P(root, 'Followers', 0), P(root, 'Followers_Dead', 0)].map(x => JSON.stringify(x)))
  })

  test('a demon list out of step with its types refuses the change', () => {
    const ids = run(root, edits.unlock(schema, root, 'Followers_Demons_IDs', ['1']))
    expect(() => run(ids, edits.removeFollower(schema, ids, 0))).toThrow(OpError)
  })
})

test('the unique followers are the ones the recruit history lists', () => {
  expect(uniqueIds(schema, root)).toEqual(new Set([2]))
})

describe.skipIf(!hasSaves)('real saves', async () => {
  const rootOf = async (n: string) => { const o = await openSave(n, readSave(n)); return (o.data as Extract<typeof o.data, { kind: 'msgpack' }>).root }
  const r0 = hasSaves ? await rootOf('slot_0.mp') : root
  const at = (r: MpNode, id: number) => followers(schema, r).find(f => f.id === id)!
  const structure = (r: MpNode, id: number) => (P(r, 'BaseStructures') as unknown[]).findIndex((_, i) => P(r, 'BaseStructures', i, 'ID') === id)
  const type = (r: MpNode, i: number) => enumName(schema, 'StructureBrain.TYPES', P(r, 'BaseStructures', i, 'Type'))

  test.each([['slot_0.mp', 64], ['slot_10.mp', 48]] as const)('deleting any follower of %s leaves their ID nowhere but the recruit history', async (n, count) => {
    const r = n === 'slot_0.mp' ? r0 : await rootOf(n)
    const all = followers(schema, r)
    expect(all.length).toBe(count)
    for (const f of all) {
      const next = run(r, edits.removeFollower(schema, r, f)), why = `ID ${f.id}`
      expect([holding(next, f.id), listing(next, f.id).filter(l => l !== 'Followers_RecruitedUnique_IDs')], why).toEqual([[], []])
      expect(((P(next, 'Followers_Demons_IDs') as unknown[] | null) ?? []).length, why).toBe(((P(next, 'Followers_Demons_Types') as unknown[] | null) ?? []).length)
      expect(P(next, 'Followers_Dead_IDs'), why).toEqual(deadIds(next))
      // Relationships and parents stay, as the game keeps them for those who are gone.
      const others = (x: MpNode) => followers(schema, x).filter(o => o.id !== f.id).map(o => encodeMp(get(schema, x, 'DataManager', [o.dead ? 'Followers_Dead' : 'Followers', String(o.index)])!.node))
      expect(others(next), why).toEqual(others(r))
    }
  })

  test('slot_0.mp: sending away the follower on a mission takes them off it and out of their house, in one change', () => {
    const c = edits.sendAway(schema, r0, at(r0, 324).index)
    const r = run(r0, c), dead = followers(schema, r).filter(f => f.dead)
    const mission = structure(r0, 5389), house = structure(r0, 5414)
    expect([type(r0, mission), type(r0, house)]).toEqual(['MISSIONARY', 'SHARED_HOUSE'])
    expect([dead.at(-1)!.id, P(r, 'Followers_Dead', dead.length - 1, 'LeavingCult'), (P(r, 'Followers_Dead_IDs') as number[]).at(-1)]).toEqual([324, true, 324])
    expect([P(r, 'Followers_OnMissionary_IDs'), P(r, 'BaseStructures', mission, 'MultipleFollowerIDs')]).toEqual([[], []])
    expect(holding(r, 324)).toEqual([])
    expect(P(r, 'Followers_Dead_IDs')).toEqual(deadIds(r))
    for (const n of ['MISSIONARY', 'SHARED_HOUSE', 'Followers_OnMissionary_IDs']) expect(c.label).toContain(n)
  })

  test('slot_0.mp: killing a refinery worker frees the refinery and their bed', () => {
    const r = run(r0, edits.kill(schema, r0, at(r0, 297).index, 'DiedOfOldAge'))
    const refinery = structure(r0, 687), house = structure(r0, 3542)
    expect([type(r0, refinery), type(r0, house)]).toEqual(['REFINERY', 'SHARED_HOUSE'])
    expect([at(r, 297).dead, at(r, 297).death, (P(r, 'Followers_Dead_IDs') as number[]).at(-1), P(r, 'BaseStructures', refinery, 'FollowerID')]).toEqual([true, 'DiedOfOldAge', 297, -1])
    for (const n of ['MultipleFollowerIDs', 'FollowersClaimedSlots']) expect(P(r, 'BaseStructures', house, n)).not.toContain(297)
  })

  test('slot_0.mp: deleting a dead follower keeps the dead list in step and empties their body pit', () => {
    const r = run(r0, edits.removeFollower(schema, r0, { index: at(r0, 285).index, dead: true }))
    expect([(P(r, 'Followers_Dead_IDs') as number[]).length, deadIds(r).length, (P(r, 'Followers_Elderly_IDs') as number[]).includes(285)]).toEqual([45, 45, false])
    const pit = structure(r0, 515)
    expect([type(r0, pit), P(r0, 'BaseStructures', pit, 'FollowerID')]).toEqual(['BODY_PIT', 15])
    expect(P(run(r0, edits.removeFollower(schema, r0, { index: at(r0, 15).index, dead: true })), 'BaseStructures', pit, 'FollowerID')).toBe(-1)
  })

  test('slot_0.mp: the unique followers', () => {
    expect(uniqueIds(schema, r0)).toEqual(new Set([666, 99990, 99991, 99998]))
  })

  test.each(['sendAway', 'removeFollower'] as const)('slot_0.mp: %s is one change that one undo takes back to the same bytes', async kind => {
    const read = (n: string) => new File([readFileSync(new URL(`./saves/${n}`, import.meta.url))], n)
    const [entry] = await listSlots([read('slot_0.mp'), read('meta_0.mp')], async () => ({ schema, exact: true }))
    await openSlot(entry, async () => ({ schema, exact: true }))
    const n = session.changes.length, f = at(session.root!, 324)
    const make = () => kind === 'sendAway' ? edits.sendAway(schema, session.root!, f.index) : edits.removeFollower(schema, session.root!, f.index)
    const same = () => expect(encodeMp(session.root!)).toEqual(encodeMp(session.original!))
    expect(push(make)).toBe(true)
    expect(session.changes.length).toBe(n + 1)
    undo()
    same()
    redo()
    expect(followers(schema, session.root!).find(x => x.id === 324)?.dead).toBe(kind === 'sendAway' ? true : undefined)
    revert(n)
    same()
  })

  test('slot_1.json: sending away the first follower on a mission adds only the leaving keys', async () => {
    const json = (await openSave('slot_1.json', readSave('slot_1.json'))).data.root as {
      Followers: Record<string, unknown>[]; Followers_Dead: Record<string, unknown>[]; Followers_Dead_IDs: number[]; Followers_OnMissionary_IDs: number[] }
    const id = json.Followers_OnMissionary_IDs[0], was = json.Followers.find(f => f.ID === id)!
    const tree = jsonToTree(schema, json)
    const out = fromTree(schema, run(tree, edits.sendAway(schema, tree, at(tree, id).index)), json) as typeof json
    const now = out.Followers_Dead.find(f => f.ID === id)!
    expect(Object.keys(now).sort()).toEqual([...new Set([...Object.keys(was), 'LeavingCult', 'LeftCultDay'])].sort())
    expect([now.LeavingCult, out.Followers_OnMissionary_IDs.includes(id)]).toEqual([true, false])
    expect(out.Followers_Dead_IDs).toEqual(out.Followers_Dead.map(f => f.ID))
  })
})
