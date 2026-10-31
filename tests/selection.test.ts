import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { t } from '../src/i18n/i18n.svelte'
import { edits } from '../src/model/edits'
import { listSlots, openSlot, push, redo, session, undo } from '../src/model/session.svelte'
import { followers } from '../src/model/views'
import { clear, key, prune, revived, selection, tickedOf } from '../src/ui/selection.svelte'
import { schema, syntheticFiles } from './synthetic'
import { hasSaves } from './util'

const loadSchema = async () => ({ schema, exact: true })
const open = async (files: File[]) => {
  const [entry] = await listSlots(files, loadSchema)
  await openSlot(entry, loadSchema)
  clear()
}
const now = () => followers(session.schema!, session.root!)
const step = (act: () => unknown) => { act(); prune(session.schema!, session.root!) }
const state = () => ({ follower: selection.follower, ticked: [...selection.ticked] })
const living = (id: number) => key({ id, dead: false })

test('ticks and the inspector stay on the same IDs through a remove, its undo and its redo', async () => {
  await open(await syntheticFiles())
  const kept = { follower: living(2), ticked: [living(2), key({ id: 3, dead: true })] }
  Object.assign(selection, kept)
  step(() => push(() => edits.removeFollower(schema, session.root!, 0)))
  expect(state()).toEqual(kept)
  expect(now().find(f => f.id === 2)?.index).toBe(0)
  step(undo)
  step(redo)
  expect(state()).toEqual(kept)
})

test('removing the inspected, ticked follower clears both, and undo does not bring them back', async () => {
  await open(await syntheticFiles())
  Object.assign(selection, { follower: living(1), ticked: [living(1), living(2)] })
  step(() => push(() => edits.removeFollower(schema, session.root!, { index: 0, dead: false })))
  expect(state()).toEqual({ follower: null, ticked: [living(2)] })
  step(undo)
  expect(state()).toEqual({ follower: null, ticked: [living(2)] })
})

test('undoing a clone drops its ID from the inspector and the ticks', async () => {
  await open(await syntheticFiles())
  step(() => push(() => edits.clone(schema, session.root!, 1)))
  expect(now().map(f => f.id)).toContain(4)
  Object.assign(selection, { follower: living(4), ticked: [living(1), living(4)] })
  step(undo)
  expect(state()).toEqual({ follower: null, ticked: [living(1)] })
})

test('the inspector and the tick follow a revived follower', async () => {
  await open(await syntheticFiles())
  const dead = key({ id: 3, dead: true })
  Object.assign(selection, { follower: dead, ticked: [living(1), dead] })
  step(() => { push(() => edits.revive(schema, session.root!, 0)); revived(3) })
  expect(state()).toEqual({ follower: living(3), ticked: [living(1), living(3)] })
  expect(now().find(f => f.id === 3)?.dead).toBe(false)
})

test('a living and a dead record with the same ID are ticked and inspected apart', async () => {
  await open(await syntheticFiles())
  step(() => push(() => edits.setPath(schema, session.root!, ['Followers_Dead', '0', 'ID'], 2)))
  Object.assign(selection, { follower: key({ id: 2, dead: true }), ticked: [living(2)] })
  expect(tickedOf(now()).map(f => f.dead)).toEqual([false])
  expect(now().filter(f => key(f) === selection.follower).map(f => f.dead)).toEqual([true])
  step(() => push(() => edits.removeFollower(schema, session.root!, { index: 1, dead: false })))
  expect(state()).toEqual({ follower: key({ id: 2, dead: true }), ticked: [] })
})

test('a bulk edit after a remove and a revive changes only the ticked ID', async () => {
  await open(await syntheticFiles())
  selection.ticked = [living(2)]
  step(() => push(() => edits.removeFollower(schema, session.root!, 0)))
  step(() => push(() => edits.revive(schema, session.root!, 0)))
  for (const f of tickedOf(now()))
    push(() => edits.setFollowerFields(schema, session.root!, f, { _satiation: 100 }, t('ch.needsMaxed')))
  expect(session.changes.at(-1)?.label).toBe('Ash · needs maxed')
  expect(session.changes.filter(c => c.label.includes('needs')).length).toBe(1)
})

test('clear empties the selection', () => {
  Object.assign(selection, { follower: living(1), ticked: [living(1), living(2)] })
  clear()
  expect(state()).toEqual({ follower: null, ticked: [] })
})

describe.skipIf(!hasSaves)('real saves', () => {
  test('slot_0.mp: ticks and the inspector keep their IDs while rows shift', async () => {
    const read = (n: string) => new File([readFileSync(new URL(`./saves/${n}`, import.meta.url))], n)
    await open([read('slot_0.mp'), read('meta_0.mp')])
    const alive = () => now().filter(f => !f.dead)
    const keys = [key(alive()[1]), key(alive()[2])]
    selection.ticked = [...keys]
    step(() => push(() => edits.removeFollower(schema, session.root!, 0)))
    expect(selection.ticked).toEqual(keys)
    expect(keys.map(k => alive().find(f => key(f) === k)?.index)).toEqual([0, 1])
    step(() => push(() => edits.removeFollower(schema, session.root!, 1)))
    const k = key(alive()[2])
    selection.follower = k
    step(undo)
    expect([selection.follower, alive().find(f => key(f) === k)?.index]).toEqual([k, 3])
  })
})
