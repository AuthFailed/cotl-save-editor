import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { hasUnexported, listSlots, openSlot, session } from '../src/model/session.svelte'
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
  session.ops = [{ label: 'x', kind: 'set', path: ['CultName'], value: 'y' }]
  expect(hasUnexported()).toBe(true)
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
