import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { edits } from '../src/model/edits'
import { hasUnexported, listSlots, openSlot, push, redo, revert, session, undo } from '../src/model/session.svelte'
import { schema, syntheticSaves } from './synthetic'
import { hasSaves } from './util'

const asFiles = (list: { name: string; bytes: Uint8Array }[]) => list.map(f => new File([f.bytes as Uint8Array<ArrayBuffer>], f.name))
const loadSchema = async () => ({ schema, exact: true })

test('the synthetic folder lists slot 0 with its cult, day and play time', async () => {
  const [entry, ...rest] = await listSlots(asFiles(await syntheticSaves()), loadSchema)
  expect(rest).toEqual([])
  expect(entry).toMatchObject({ slot: 0, cultName: 'Test Cult', day: 47, playTime: 11520, format: 'pc-mp', beta: false })
})

test('opening a slot fills the session; an op makes it unexported', async () => {
  const [entry] = await listSlots(asFiles(await syntheticSaves()), loadSchema)
  await openSlot(entry, loadSchema)
  expect([session.slot?.name, session.meta?.name, session.readOnly, hasUnexported()]).toEqual(['slot_0.mp', 'meta_0.mp', false, false])
  expect(push(() => edits.rename(schema, session.root!, 0, 'Gerald'))).toBe(true)
  expect(hasUnexported()).toBe(true)
  undo()
  expect(hasUnexported()).toBe(false)
  redo()
  expect(session.changes.map(c => c.label)).toEqual(['Pip renamed to Gerald'])
})

test('a refused edit is reported, not thrown; an undo that would misapply is refused', async () => {
  const [entry] = await listSlots(asFiles(await syntheticSaves()), loadSchema)
  await openSlot(entry, loadSchema)
  expect(push(() => edits.setFollower(schema, session.root!, 0, 'XPLevel', 7.5, 'Level'))).toBe(false)
  expect(session.error).toMatch(/XPLevel/)
  push(() => edits.revive(schema, session.root!, 0))
  push(() => edits.rename(schema, session.root!, 2, 'Back'))
  revert(0)
  expect([session.changes.length, session.error]).toEqual([2, expect.stringMatching(/later change depends on it/)])
})

describe.skipIf(!hasSaves)('real saves', () => {
  test('a real folder: .mp wins over .json for the same slot, and slot 10 is listed', async () => {
    const dir = new URL('./saves/', import.meta.url)
    const files = readdirSync(dir).map(n => new File([readFileSync(new URL(n, dir))], n))
    const slots = await listSlots(files, loadSchema)
    expect(slots.map(s => [s.slot, s.slotFile.name, s.cultName])).toEqual([
      [0, 'slot_0.mp', 'Рога и Копыта'], [1, 'slot_1.json', expect.any(String)], [10, 'slot_10.mp', expect.any(String)]])
  })
})
