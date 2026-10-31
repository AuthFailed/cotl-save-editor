import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { t } from '../src/i18n/i18n.svelte'
import { edits } from '../src/model/edits'
import { listSlots, openSlot, push, redo, session, undo } from '../src/model/session.svelte'
import { followers } from '../src/model/views'
import { clear, prune, selection } from '../src/ui/selection.svelte'
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

test('ticks and the inspector stay on the same IDs through a remove, its undo and its redo', async () => {
  await open(await syntheticFiles())
  Object.assign(selection, { follower: 2, ticked: [2, 3] })
  step(() => push(() => edits.removeFollower(schema, session.root!, 0)))
  expect(state()).toEqual({ follower: 2, ticked: [2, 3] })
  expect(now().find(f => f.id === 2)?.index).toBe(0)
  step(undo)
  step(redo)
  expect(state()).toEqual({ follower: 2, ticked: [2, 3] })
})

test('undoing a clone drops its ID from the inspector and the ticks', async () => {
  await open(await syntheticFiles())
  step(() => push(() => edits.clone(schema, session.root!, 1)))
  expect(now().map(f => f.id)).toContain(4)
  Object.assign(selection, { follower: 4, ticked: [1, 4] })
  step(undo)
  expect(state()).toEqual({ follower: null, ticked: [1] })
})

test('the inspector follows a revived follower', async () => {
  await open(await syntheticFiles())
  selection.follower = 3
  step(() => push(() => edits.revive(schema, session.root!, 0)))
  expect([selection.follower, now().find(f => f.id === 3)?.dead]).toEqual([3, false])
})

test('a bulk edit after a remove and a revive changes only the ticked ID', async () => {
  await open(await syntheticFiles())
  selection.ticked = [2]
  step(() => push(() => edits.removeFollower(schema, session.root!, 0)))
  step(() => push(() => edits.revive(schema, session.root!, 0)))
  for (const f of now().filter(f => selection.ticked.includes(f.id)))
    push(() => edits.setFollowerFields(schema, session.root!, f, { _satiation: 100 }, t('ch.needsMaxed')))
  expect(session.changes.at(-1)?.label).toBe('Ash · needs maxed')
  expect(session.changes.filter(c => c.label.includes('needs')).length).toBe(1)
})

test('clear empties the selection', () => {
  Object.assign(selection, { follower: 1, ticked: [1, 2] })
  clear()
  expect(state()).toEqual({ follower: null, ticked: [] })
})

describe.skipIf(!hasSaves)('real saves', () => {
  test('slot_0.mp: ticks and the inspector keep their IDs while rows shift', async () => {
    const read = (n: string) => new File([readFileSync(new URL(`./saves/${n}`, import.meta.url))], n)
    await open([read('slot_0.mp'), read('meta_0.mp')])
    const living = () => now().filter(f => !f.dead)
    const ids = [living()[1].id, living()[2].id]
    selection.ticked = [...ids]
    step(() => push(() => edits.removeFollower(schema, session.root!, 0)))
    expect(selection.ticked).toEqual(ids)
    expect(ids.map(id => living().find(f => f.id === id)?.index)).toEqual([0, 1])
    step(() => push(() => edits.removeFollower(schema, session.root!, 1)))
    const id = living()[2].id
    selection.follower = id
    step(undo)
    expect([selection.follower, living().find(f => f.id === id)?.index]).toEqual([id, 3])
  })
})
