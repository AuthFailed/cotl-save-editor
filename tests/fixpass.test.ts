// Findings from the final review, each pinned by a test that failed before its fix.
import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { openSave } from '../src/codec/formats'
import { toPlain, type MpNode } from '../src/codec/msgpack'
import { edits } from '../src/model/edits'
import { fromTree, jsonToTree } from '../src/model/json'
import { replay, revertOne, type Change } from '../src/model/ops'
import { enumName, followers, value } from '../src/model/views'
import { schema, syntheticRoots } from './synthetic'
import { hasSaves, readSave } from './util'

const { slot: root } = syntheticRoots()
const run = (r: MpNode, ...c: Change[]) => replay(schema, r, c)

test('JSON property names (Name, Satiation) map onto the schema fields (_name, _satiation)', () => {
  const json = { Followers: [{ ID: 5, Name: 'Pip', Satiation: 40, SkinName: 'Fox' }] }
  const tree = jsonToTree(schema, json)
  expect(followers(schema, tree)[0]).toMatchObject({ name: 'Pip', needs: { satiation: 40 } })
  const renamed = run(tree, edits.rename(schema, tree, 0, 'Gerald'))
  expect(fromTree(schema, renamed, json)).toEqual({ Followers: [{ ID: 5, Name: 'Gerald', Satiation: 40, SkinName: 'Fox' }] })
})

test('JSON list elements keep their own unknown keys after a removal (paired by ID, not position)', () => {
  const json = { Followers: [{ ID: 1, Name: 'A', Extra: 'a' }, { ID: 2, Name: 'B', Extra: 'b' }] }
  const tree = jsonToTree(schema, json)
  const out = fromTree(schema, run(tree, edits.removeFollower(schema, tree, 0)), json) as { Followers: unknown[] }
  expect(out.Followers).toEqual([{ ID: 2, Name: 'B', Extra: 'b' }])
})

test('a JSON clone inherits nobody else\'s unknown keys', () => {
  const json = { FollowerID: 9, Followers: [{ ID: 1, Name: 'A', Extra: 'a' }, { ID: 2, Name: 'B', Extra: 'b' }] }
  const tree = jsonToTree(schema, json)
  const removed = run(tree, edits.removeFollower(schema, tree, 0))
  const out = fromTree(schema, run(removed, edits.clone(schema, removed, 0)), json) as { Followers: Record<string, unknown>[] }
  expect(out.Followers[1]).toEqual({ ID: 10, Name: 'B' })
})

test('JSON revive keeps the dead follower\'s unknown keys', () => {
  const json = { Followers: [], Followers_Dead: [{ ID: 3, Name: 'T', Extra: 't' }] }
  const tree = jsonToTree(schema, json)
  expect((fromTree(schema, run(tree, edits.revive(schema, tree, 0)), json) as { Followers: unknown[] }).Followers).toEqual([{ ID: 3, Name: 'T', Extra: 't' }])
})

test('a JSON revive clears the dead list and the grave, and adds no keys the save never had', () => {
  const json = { Followers: [], Followers_Dead: [{ ID: 3, _name: 'T', DiedOfOldAge: true, TimeOfDeath: 9, Extra: 1 }], Followers_Dead_IDs: [3],
    BaseStructures: [{ ID: 9, Type: 46, FollowerID: 3 }, { ID: 10, Type: 306, FollowerID: -1, MultipleFollowerIDs: [3] }] }
  const tree = jsonToTree(schema, json)
  expect(fromTree(schema, run(tree, edits.revive(schema, tree, 0, true)), json)).toEqual({
    Followers: [{ ID: 3, _name: 'T', DiedOfOldAge: false, TimeOfDeath: 0, Extra: 1 }], Followers_Dead: [], Followers_Dead_IDs: [],
    BaseStructures: [{ ID: 9, Type: 46, FollowerID: -1 }, { ID: 10, Type: 306, FollowerID: -1, MultipleFollowerIDs: [] }] })
})

test('undoing the first of two trait removals restores that trait, or refuses', () => {
  const withTraits = run(root, edits.addTrait(schema, root, 0, 'AnimalLover'))
  const two = run(withTraits, edits.addTrait(schema, withTraits, 0, 'Cannibal'))
  const a = edits.removeTrait(schema, two, 0, 'AnimalLover')
  const afterA = run(two, a)
  const b = edits.removeTrait(schema, afterA, 0, 'Cannibal')
  let kept: Change[]
  try { kept = revertOne(schema, two, [a, b], 0) } catch { return } // refusing is also right
  expect(followers(schema, replay(schema, two, kept))[0].traits).toEqual(['AnimalLover'])
})

test('an integer outside its field type is refused', () => {
  expect(() => run(root, edits.setPath(schema, root, ['Followers', '0', 'XPLevel'], 5_000_000_000))).toThrow(/int32/)
})

test('a clone takes the game\'s next FollowerID and advances it', () => {
  const r = run(root, edits.setRoot(schema, root, 'FollowerID', 40, 'next id'))
  const next = run(r, edits.clone(schema, r, 0))
  expect([followers(schema, next).find(f => f.name === 'Pip' && f.id !== 1)?.id, value(schema, next, 'FollowerID')]).toEqual([41, 41])
})

test('revive uses the follower as it is at replay time', () => {
  const rename = edits.rename(schema, root, { index: 0, dead: true }, 'Renamed')
  const afterRename = run(root, rename)
  const revive = edits.revive(schema, afterRename, 0)
  const kept = revertOne(schema, root, [rename, revive], 0)
  expect(followers(schema, replay(schema, root, kept)).find(f => f.id === 3)?.name).toBe('Thistle')
})

describe.skipIf(!hasSaves)('real saves', () => {
  test('real slot_0.json: names show, and removing follower 0 leaves the next one\'s Name alone', async () => {
    const o = await openSave('slot_0.json', new Uint8Array(readFileSync(new URL('./saves/slot_0.json', import.meta.url))))
    const json = (o.data as { root: { Followers: { ID: number; Name: string }[] } }).root
    const tree = jsonToTree(schema, json)
    expect(followers(schema, tree)[0].name).toBe(json.Followers[0].Name)
    const out = fromTree(schema, run(tree, edits.removeFollower(schema, tree, 0)), json) as typeof json
    expect(out.Followers.map(f => [f.ID, f.Name])).toEqual(json.Followers.slice(1).map(f => [f.ID, f.Name]))
    expect(toPlain).toBeTypeOf('function')
  })

  test('real slot_0.json: a revive out of a crypt leaves no reference, and the 1.4 outfit as it was', async () => {
    const json = (await openSave('slot_0.json', readSave('slot_0.json'))).data.root as {
      Followers_Dead: { ID: number; Outfit: number }[]; Followers_Dead_IDs: number[]; BaseStructures: { Type: number; FollowerID: number; MultipleFollowerIDs?: number[] }[] }
    const crypt = json.BaseStructures.find(s => enumName(schema, 'StructureBrain.TYPES', s.Type) === 'CRYPT_1' && s.MultipleFollowerIDs?.length)!
    const index = json.Followers_Dead.findIndex(f => crypt.MultipleFollowerIDs!.includes(f.ID)), { ID: id, Outfit: outfit } = json.Followers_Dead[index]
    const tree = jsonToTree(schema, json)
    const out = fromTree(schema, run(tree, edits.revive(schema, tree, index, true, false)), json) as typeof json & { Followers: { ID: number; Outfit: number }[] }
    expect(out.BaseStructures.filter(s => s.FollowerID === id || s.MultipleFollowerIDs?.includes(id))).toEqual([])
    expect([out.Followers_Dead_IDs.length, out.Followers_Dead_IDs.includes(id)]).toEqual([out.Followers_Dead.length, false])
    expect(out.Followers.find(f => f.ID === id)!.Outfit).toBe(outfit)
  })
})
