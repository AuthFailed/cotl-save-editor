import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { openSave } from '../src/codec/formats'
import { encodeMp, type MpNode } from '../src/codec/msgpack'
import { edits } from '../src/model/edits'
import { exportSlot } from '../src/model/export'
import { listSlots, openSlot, push, session } from '../src/model/session.svelte'
import { followers } from '../src/model/views'
import { format } from '../src/i18n/i18n.svelte'
import { arr, at, int, schema, syntheticFiles, syntheticSaves } from './synthetic'
import { hasSaves, readSave, unreadable } from './util'

const loadSchema = async () => ({ schema, exact: true })
const files = (list: { name: string; bytes: Uint8Array }[]) => list.map(f => new File([f.bytes as Uint8Array<ArrayBuffer>], f.name))
async function open(list: File[], slot = 0) {
  const entry = (await listSlots(list, loadSchema)).find(e => e.slot === slot)!
  await openSlot(entry, loadSchema)
}

test('export writes the edited slot, a backup the first time only, and resets the change list', async () => {
  await open(files(await syntheticSaves()))
  push(() => edits.rename(schema, session.root!, 0, 'Gerald'))
  const first = await exportSlot()
  expect(first.files.map(f => f.name)).toEqual(['slot_0.mp', 'slot_0.mp.backup'])
  const back = await openSave('slot_0.mp', first.files[0].bytes)
  expect(followers(schema, (back.data as { root: MpNode }).root)[0].name).toBe('Gerald')
  expect(session.changes).toEqual([])
  push(() => edits.rename(schema, session.root!, 0, 'Again'))
  expect((await exportSlot()).files.map(f => f.name)).toEqual(['slot_0.mp'])
})

test('the backup is the bytes that were opened, even when the file can no longer be read', async () => {
  const picked = await syntheticFiles(), opened = new Uint8Array(await picked[0].arrayBuffer())
  const [entry] = await listSlots(picked, loadSchema)
  await openSlot(entry, loadSchema)
  push(() => edits.rename(schema, session.root!, 0, 'Gerald'))
  unreadable(entry.slotFile)
  const out = await exportSlot()
  expect(out.files.map(f => f.name)).toEqual([picked[0].name, `${picked[0].name}.backup`])
  expect(out.files[1].bytes).toEqual(opened)
  expect(session.changes).toEqual([])
})

test('export refuses a tree with a value its schema type contradicts', async () => {
  await openSlot((await listSlots(await syntheticFiles(), loadSchema))[0], loadSchema)
  const root = session.root as Extract<MpNode, { t: 'arr' }>, v = root.v.slice()
  v[schema.types.DataManager.fields.find(f => f.name === 'CultName')!.key] = int(1)
  session.root = { ...root, v }
  await expect(exportSlot()).rejects.toThrow(format('en', 'export.unfit', { field: 'DataManager.CultName' }))
})

test('a value that was locked on opening does not stop an export', async () => {
  await openSlot((await listSlots(await syntheticFiles(undefined, at('playerDeaths', arr([int(1)]))), loadSchema))[0], loadSchema)
  push(() => edits.setRoot(schema, session.root!, 'CultName', 'Other', 'Cult name'))
  expect((await exportSlot()).files.length).toBe(2)
})

describe.skipIf(!hasSaves)('real saves', () => {
  const real = (n: string) => new File([readFileSync(new URL(`./saves/${n}`, import.meta.url))], n)
  test('a rename on the real slot_0.mp changes nothing else, and the backup is the file as opened', async () => {
    await open([real('slot_0.mp'), real('meta_0.mp')])
    const before = session.root as Extract<MpNode, { t: 'arr' }>
    push(() => edits.rename(schema, session.root!, 0, 'Test'))
    unreadable(session.entry!.slotFile)
    const out = await exportSlot()
    expect(out.files.map(f => f.name)).toEqual(['slot_0.mp', 'slot_0.mp.backup'])
    expect(out.files[1].bytes).toEqual(readSave('slot_0.mp'))
    const after = (await openSave('slot_0.mp', out.files[0].bytes)).data as { root: Extract<MpNode, { t: 'arr' }> }
    expect(after.root.v.filter((_, i) => i !== 1109).map(encodeMp)).toEqual(before.v.filter((_, i) => i !== 1109).map(encodeMp))
    expect(followers(schema, after.root)[0].name).toBe('Test')
  })
  test('a JSON slot exports as JSON with the edit and every other key intact', async () => {
    await open([real('slot_0.json'), real('meta_0.json')])
    const original = (session.slot!.data as { root: Record<string, unknown> }).root
    push(() => edits.setRoot(schema, session.root!, 'CultName', 'Json Cult', 'Cult name'))
    const out = await exportSlot()
    const back = (await openSave('slot_0.json', out.files[0].bytes)).data as { root: Record<string, unknown> }
    expect(back.root).toEqual({ ...original, CultName: 'Json Cult' })
  })
})
