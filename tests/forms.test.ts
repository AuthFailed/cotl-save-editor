import { describe, expect, test } from 'vitest'
import { decodeMp, encodeMp, toPlain, type MpNode } from '../src/codec/msgpack'
import { openSave } from '../src/codec/formats'
import type { Full } from '../src/data/api'
import { edits } from '../src/model/edits'
import { jsonToTree } from '../src/model/json'
import { replay, revertOne, type Change } from '../src/model/ops'
import { listSlots, openSlot, push, session } from '../src/model/session.svelte'
import { heldOf, saveIdOf, unlockTab } from '../src/model/unlocks'
import { followers, unlocked } from '../src/model/views'
import { get } from '../src/schema/schema'
import skinsJson from './fixtures/skins.json'
import { schema, syntheticFiles, syntheticRoots } from './synthetic'
import { hasSaves, readSave } from './util'

const all = (skinsJson as { id: string; variants: string[] }[]).map((e): Full => ({ ...e, namePlain: {}, thumb: null }))
const byId = (id: string) => all.find(e => e.id === id)!
const forms = unlockTab('forms')
const spine = (e: Full) => e.variants as string[]
const F = 'FollowerSkinsUnlocked'
const at = (root: MpNode, path: string[]) => toPlain(get(schema, root, schema.roots.slot, path)?.node ?? { t: 'nil' })
const formOf = (root: MpNode, i = 0) => [at(root, ['Followers', String(i), 'SkinName']), at(root, ['Followers', String(i), 'SkinVariation'])]
const setForm = (root: MpNode, id: string, who: number | { index: number; dead: boolean } = 0) =>
  edits.setForm(schema, root, who, spine(byId(id)), 'Axolotl', id)
const unlockOf = (root: MpNode, ids: string[]) => edits.unlock(schema, root, F, ids.map(id => saveIdOf(forms, byId(id))))
const holding = (...names: string[]) => { const { slot } = syntheticRoots(); return replay(schema, slot, [edits.unlock(schema, slot, F, names)]) }

test('the fixture is the 189 published forms', () => {
  expect(all).toHaveLength(189)
  expect(all.filter(e => !spine(e).includes(e.id))).toHaveLength(44)
})

test.each(all.map(e => e.id))('changing to %s writes one of its skin names and points SkinVariation at it', id => {
  const { slot } = syntheticRoots()
  const from = replay(schema, slot, [edits.setPath(schema, slot, ['Followers', '0', 'SkinName'], 'Unpublished')])
  const [name, variation] = formOf(replay(schema, from, [setForm(from, id)]))
  expect(spine(byId(id)).indexOf(name as string)).toBe(variation)
})

test.each([['Fennec_Fox', 'Fennec Fox'], ['Boss_Beholder_1', 'Boss Beholder 1'], ['Red_Panda', 'Red Panda'], ['Deer', 'Deer']])
('%s is written as %s with variation 0', (id, name) => {
  const { slot } = syntheticRoots()
  expect(formOf(replay(schema, slot, [setForm(slot, id)]))).toEqual([name, 0])
})

test('a form change is one change of two ops, labelled with display names, and undoes on its own', () => {
  const { slot } = syntheticRoots()
  const c = edits.setForm(schema, slot, 0, spine(byId('Fennec_Fox')), 'Axolotl', 'Fennec Fox')
  expect([c.label, c.ops.length]).toEqual(['Pip · form Axolotl → Fennec Fox', 2])
  const other = edits.setFollower(schema, slot, 0, 'XPLevel', 5, 'level')
  const both = replay(schema, slot, [other, c])
  expect(formOf(both)).toEqual(['Fennec Fox', 0])
  const undone = replay(schema, slot, revertOne(schema, slot, [other, c], 1))
  expect(formOf(undone)).toEqual(formOf(slot))
  expect(encodeMp(undone)).toEqual(encodeMp(replay(schema, slot, [other])))
})

test('picking the form a follower already has, under any of its skin names, changes nothing', () => {
  const { slot } = syntheticRoots()
  const held = replay(schema, slot, [edits.setPath(schema, slot, ['Followers', '0', 'SkinName'], 'Fennec Fox3'),
    edits.setPath(schema, slot, ['Followers', '0', 'SkinVariation'], 2)])
  expect(setForm(held, 'Fennec_Fox').ops).toEqual([])
  expect(setForm(held, 'Deer').ops).toHaveLength(2)
})

test('a form with no skin names is refused', async () => {
  expect(() => edits.setForm(schema, syntheticRoots().slot, 0, [], 'Axolotl', 'Nothing')).toThrow(RangeError)
  const [entry] = await listSlots(await syntheticFiles(), async () => ({ schema, exact: true }))
  await openSlot(entry, async () => ({ schema, exact: true }))
  expect(push(() => edits.setForm(schema, session.root!, 0, [], 'Axolotl', 'Nothing'))).toBe(false)
  expect(session.error).toBeTruthy()
})

test('unlocking a form writes its first skin name, never its API id', () => {
  const { slot } = syntheticRoots()
  const next = replay(schema, slot, [unlockOf(slot, ['Fennec_Fox', 'Snowman_Good_1'])])
  expect(at(next, [F])).toEqual(['Fennec Fox', 'Snowman/Good_1'])
})

test('a form is held under any of its skin names, and locking removes the one held', () => {
  const fox = byId('Fennec_Fox')
  const root = holding('Deer', 'Fennec Fox2')
  const have = unlocked(schema, root, F)
  expect(heldOf(forms, fox, have)).toBe('Fennec Fox2')
  expect(at(replay(schema, root, [edits.lock(schema, root, F, heldOf(forms, fox, have)!)]), [F])).toEqual(['Deer'])
  expect(heldOf(forms, fox, unlocked(schema, holding('Fennec_Fox'), F))).toBeUndefined()
})

test('other kinds hold by their save id, and forms without skin names are not offered', () => {
  const relics = unlockTab('relics'), e: Full = { id: 'Relic', namePlain: {}, thumb: null }
  for (const have of [new Set(['Relic']), new Set<string>()]) expect(heldOf(relics, e, have) !== undefined).toBe(have.has(saveIdOf(relics, e)))
  expect([forms.include!({ ...e, variants: [] }), forms.include!(e), forms.include!(byId('Deer'))]).toEqual([false, false, true])
  expect(() => saveIdOf(forms, e)).toThrow(RangeError)
})

describe.skipIf(!hasSaves)('real saves', () => {
  const rootOf = async (file: string) => {
    const o = await openSave(file, readSave(file))
    return o.data.kind === 'msgpack' ? o.data.root : jsonToTree(schema, o.data.root)
  }

  test('slot_0.mp: forms count as owned by their skin names, and unlock all adds only what is missing', async () => {
    const root = await rootOf('slot_0.mp')
    const have = unlocked(schema, root, F)
    const held = all.filter(e => heldOf(forms, e, have) !== undefined)
    expect(held).toHaveLength(93)
    for (const id of ['Fennec_Fox', 'Red_Panda', 'Boss_Mama_Worm', 'Boss_Death_Cat', 'Boss_Beholder_1', 'Boss_Beholder_2', 'Boss_Beholder_3', 'Boss_Beholder_4'])
      expect(held.map(e => e.id)).toContain(id)
    const firsts = new Set(all.map(e => spine(e)[0]))
    const c: Change = edits.unlock(schema, root, F, all.filter(e => !held.includes(e)).map(e => saveIdOf(forms, e)))
    expect(c.ops).toHaveLength(96)
    for (const op of c.ops) {
      const v = op.kind === 'insert' ? toPlain(op.node) as string : ''
      expect([firsts.has(v), have.has(v)]).toEqual([true, false])
    }
    const after = unlocked(schema, replay(schema, root, [c]), F)
    expect(all.filter(e => heldOf(forms, e, after) !== undefined)).toHaveLength(189)
    for (const e of held) {
      const s = heldOf(forms, e, have)!
      const left = unlocked(schema, replay(schema, root, [edits.lock(schema, root, F, s)]), F)
      expect([left.has(s), left.size]).toEqual([false, have.size - 1])
    }
  })

  test('every save holds skin names: unlocked forms by their first, followers by SkinVariation', async () => {
    for (const file of ['slot_0.mp', 'slot_0.json', 'slot_1.json', 'slot_10.mp']) {
      const root = await rootOf(file)
      const firsts = new Set(all.map(e => spine(e)[0]))
      expect([...unlocked(schema, root, F)].every(s => firsts.has(s))).toBe(true)
      const fs = followers(schema, root)
      const ok = fs.filter(f => {
        const v = at(root, [f.dead ? 'Followers_Dead' : 'Followers', String(f.index), 'SkinVariation'])
        return all.some(e => spine(e)[v as number] === f.skin)
      })
      expect(ok.length).toBe(fs.length)
    }
  })

  test('slot_0.mp: follower 284 changed to Fennec Fox re-encodes as Fennec Fox, variation 0', async () => {
    const root = await rootOf('slot_0.mp')
    const f = followers(schema, root).find(x => x.id === 284)!
    const next = decodeMp(encodeMp(replay(schema, root, [setForm(root, 'Fennec_Fox', { index: f.index, dead: f.dead })])))
    expect(formOf(next, f.index)).toEqual(['Fennec Fox', 0])
  })
})
