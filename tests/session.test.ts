import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { edits } from '../src/model/edits'
import { followers } from '../src/model/views'
import { SaveFormatError } from '../src/codec/errors'
import { saveSave } from '../src/codec/formats'
import { exportSlot } from '../src/model/export'
import { adopt, discard, failure, keyOf, listSlots, openSlot, pendingFor, push, redo, revert, session, undo, unexported } from '../src/model/session.svelte'
import { get, unfit } from '../src/schema/schema'
import { encodeMp, toPlain } from '../src/codec/msgpack'
import { arr, at, int, schema, shifted, str, syntheticFiles, syntheticSaves } from './synthetic'
import { hasSaves, unreadable } from './util'

const asFiles = (list: { name: string; bytes: Uint8Array }[]) => list.map(f => new File([f.bytes as Uint8Array<ArrayBuffer>], f.name))
const loadSchema = async () => ({ schema, exact: true })
const dated = (files: File[], lastModified: number) => files.map(f => new File([f], f.name, { lastModified }))
const twoSlots = async () => listSlots([...await syntheticFiles(), ...await syntheticFiles()], loadSchema)
const rename = (i: number, name: string) => push(() => edits.rename(schema, session.root!, i, name))

test('the synthetic folder lists slot 0 with its cult, day and play time', async () => {
  const [entry, ...rest] = await listSlots(asFiles(await syntheticSaves()), loadSchema)
  expect(rest).toEqual([])
  expect(entry).toMatchObject({ slot: 0, cultName: 'Test Cult', day: 47, playTime: 11520, format: 'pc-mp', beta: false })
})

test('opening a slot fills the session; an op makes it unexported', async () => {
  const picked = await syntheticFiles()
  const [entry] = await listSlots(picked, loadSchema)
  await openSlot(entry, loadSchema)
  expect([session.slot?.name, session.meta?.name, session.readOnly, unexported()]).toEqual([...picked.map(f => f.name), false, 0])
  expect(push(() => edits.rename(schema, session.root!, 0, 'Gerald'))).toBe(true)
  expect(unexported()).toBe(1)
  undo()
  expect(unexported()).toBe(0)
  redo()
  expect(session.changes.map(c => c.label)).toEqual(['Pip renamed to Gerald'])
})

test('a refused edit is reported, not thrown; an undo that would misapply is refused', async () => {
  const [entry] = await listSlots(await syntheticFiles(), loadSchema)
  await openSlot(entry, loadSchema)
  expect(push(() => edits.setFollower(schema, session.root!, 0, 'XPLevel', 7.5, 'Level'))).toBe(false)
  expect(session.error).toMatch(/XPLevel/)
  push(() => edits.revive(schema, session.root!, 0))
  push(() => edits.rename(schema, session.root!, 2, 'Back'))
  revert(0)
  expect([session.changes.length, session.error]).toEqual([2, expect.stringMatching(/later change depends on it/)])
})

test('a changed slot will not open; the open slot keeps its edits', async () => {
  const [a, b, c] = await listSlots([...await syntheticFiles(), ...await syntheticFiles(), ...await syntheticFiles()], loadSchema)
  await openSlot(a, loadSchema)
  rename(0, 'Gerald')
  unreadable(b.slotFile)
  Object.defineProperty(c.slotFile, 'arrayBuffer', { value: async () => new ArrayBuffer(3) })
  for (const changed of [b, c]) {
    const e = await openSlot(changed, loadSchema).catch(e => e)
    expect([e instanceof SaveFormatError, e.message.includes(changed.slotFile.name)]).toEqual([true, true])
    expect([session.entry === a, session.changes.length]).toEqual([true, 1])
  }
  const said = failure(new DOMException('x', 'NotReadableError'), b.slotFile.name)
  expect([said.includes(b.slotFile.name), said.includes('x')]).toEqual([true, false])
})

test('choosing the same folder again keeps edits whatever the dates', async () => {
  const picked = await syntheticFiles()
  const first = await listSlots(dated(picked, 1000), loadSchema), second = await listSlots(dated(picked, 2000), loadSchema)
  await adopt(first)
  await openSlot(first[0], loadSchema)
  rename(0, 'Gerald')
  expect(await adopt(second)).toEqual([])
  expect([pendingFor(second[0]), session.entry === second[0]]).toEqual([1, true])
  await openSlot(second[0], loadSchema)
  expect(session.changes.length).toBe(1)
})

test('restoring kept edits whose file changed warns but restores', async () => {
  const [a, b] = await twoSlots()
  await openSlot(a, loadSchema)
  rename(0, 'Gerald')
  await openSlot(b, loadSchema)
  unreadable(a.slotFile)
  await openSlot(a, loadSchema)
  expect(session.changes.length).toBe(1)
  expect(session.error).toContain(a.slotFile.name)
})

test('a slot whose file changed under pending edits keeps the opened copy until dropped', async () => {
  const picked = await syntheticFiles()
  const [was] = await listSlots(picked, loadSchema)
  await adopt([was])
  await openSlot(was, loadSchema)
  rename(0, 'Gerald')
  const newer = await saveSave({ ...session.slot!, data: { kind: 'msgpack', root: session.root! } })
  const [now] = await listSlots([new File([newer as Uint8Array<ArrayBuffer>], picked[0].name), picked[1]], loadSchema)
  unreadable(was.slotFile)
  const pairs = await adopt([now])
  expect(pairs.map(p => [p.was === was, p.now === now])).toEqual([[true, true]])
  expect([session.slots[0] === was, pendingFor(was)]).toEqual([true, 1])
  discard(was, now)
  expect([session.slot, pendingFor(was), session.slots[0] === now]).toEqual([null, 0, true])
})

test('another folder with other contents under the same names is listed; the edits stay kept', async () => {
  const picked = await syntheticFiles()
  const [a] = await listSlots(picked, loadSchema)
  await adopt([a])
  await openSlot(a, loadSchema)
  rename(0, 'Gerald')
  const other = await saveSave({ ...session.slot!, data: { kind: 'msgpack', root: session.root! } })
  const [b] = await listSlots([new File([other as Uint8Array<ArrayBuffer>], picked[0].name), picked[1]], loadSchema)
  expect(await adopt([b])).toEqual([])
  expect([session.slots[0] === b, session.entry === a, pendingFor(a), pendingFor(b)]).toEqual([true, true, 1, 0])
  const all = unexported()
  await openSlot(b, loadSchema)
  expect([unexported(true), unexported()]).toEqual([0, all])
})

test('a slot left with no changes whose file then changed will not open', async () => {
  const [a, b] = await twoSlots()
  await openSlot(a, loadSchema)
  await openSlot(b, loadSchema)
  unreadable(a.slotFile)
  expect(await openSlot(a, loadSchema).catch(e => e)).toBeInstanceOf(SaveFormatError)
  expect(session.entry).toBe(b)
})

test('only translated errors reach the player as they are', () => {
  expect(failure(new SaveFormatError("Can't write json data as pc-mp."), 'slot_0.mp')).toContain('slot_0.mp')
  expect(failure(new SaveFormatError('Said for the player', true), 'slot_0.mp')).toBe('Said for the player')
})

test('reopening the open slot keeps newer edits than an older stash', async () => {
  const [a, b] = await twoSlots()
  await openSlot(a, loadSchema)
  rename(0, 'Gerald')
  await openSlot(b, loadSchema)
  await openSlot(a, loadSchema)
  rename(1, 'Again')
  await openSlot(a, loadSchema)
  expect(session.changes.length).toBe(2)
})

const cultName = (name: string) => push(() => edits.setRoot(schema, session.root!, 'CultName', name, 'Cult name'))

test('unexported counts kept slots once, and export spends only the open one', async () => {
  const [a, b] = await twoSlots()
  const base = unexported()
  await openSlot(a, loadSchema)
  cultName('One')
  expect(unexported()).toBe(base + 1)
  await openSlot(b, loadSchema)
  expect(unexported()).toBe(base + 1)
  cultName('Two')
  cultName('Three')
  expect(unexported()).toBe(base + 3)
  await openSlot(a, loadSchema)
  expect(unexported()).toBe(base + 3)
  await exportSlot()
  expect(unexported()).toBe(base + 2)
  await openSlot(b, loadSchema)
  undo()
  undo()
  expect(unexported()).toBe(base)
})

test('a save whose keys moved opens read-only and stays so after a switch', async () => {
  const [a] = await listSlots(await syntheticFiles(undefined, shifted), loadSchema), [b] = await listSlots(await syntheticFiles(), loadSchema)
  await openSlot(a, loadSchema)
  expect([session.readOnly, (session.misfit?.length ?? 0) > 5]).toEqual([true, true])
  await openSlot(b, loadSchema)
  expect([session.readOnly, session.misfit]).toEqual([false, null])
  await openSlot(a, loadSchema)
  expect([session.readOnly, (session.misfit?.length ?? 0) > 5]).toEqual([true, true])
})

test('an object that does not fit is locked; the rest of the save edits as usual', async () => {
  // A union objective: its Type is an int, as declared, so only the lock refuses the edit.
  const union = at('Objectives', arr([arr([int(0), arr([str('a'), { t: 'bool', v: true }])])]))
  const [a] = await listSlots(await syntheticFiles(undefined, union), loadSchema), [b] = await twoSlots()
  const setType = () => push(() => edits.setPath(schema, session.root!, ['Objectives', '0', 'Type'], 1))
  await openSlot(a, loadSchema)
  expect([session.readOnly, session.misfit]).toEqual([false, null])
  expect(setType()).toBe(false)
  expect(session.error).toMatch(/^Objectives\.0 /)
  expect(cultName('Kept')).toBe(true)
  await openSlot(b, loadSchema)
  await openSlot(a, loadSchema)
  expect([session.readOnly, session.misfit, session.changes.length]).toEqual([false, null, 1])
  expect(setType()).toBe(false)
  expect(session.error).toMatch(/^Objectives\.0 /)
})

/** A young revive of the first dead follower is one change, and its undo gives back the tree as it was. */
async function reviveAndUndo(files: File[]) {
  const [entry] = await listSlots(files, loadSchema)
  await openSlot(entry, loadSchema)
  const was = encodeMp(session.root!), n = session.changes.length
  // The dead list is bookkeeping a bare move leaves alone, so the byte match below covers more than the move.
  const id = followers(schema, session.root!).find(f => f.dead && f.index === 0)!.id
  const listed = () => (toPlain(get(schema, session.root!, 'DataManager', ['Followers_Dead_IDs'])!.node) as number[]).includes(id)
  expect(listed()).toBe(true)
  expect(push(() => edits.revive(schema, session.root!, 0, true))).toBe(true)
  expect([session.changes.length, listed()]).toEqual([n + 1, false])
  undo()
  expect([encodeMp(session.root!), session.changes.length]).toEqual([was, n])
  redo()
  expect(session.changes.length).toBe(n + 1)
  undo()
}

test('a revive is one change that one undo takes back whole', async () => {
  await reviveAndUndo(await syntheticFiles())
  expect(encodeMp(session.root!)).toEqual(encodeMp(session.original!))
})

describe.skipIf(!hasSaves)('real saves', () => {
  test('a real revive is one change that one undo takes back whole', async () => {
    const read = (n: string) => new File([readFileSync(new URL(`./saves/${n}`, import.meta.url))], n)
    await reviveAndUndo([read('slot_0.mp'), read('meta_0.mp')])
  })
  test('the real .mp slots open editable, with only their unions locked', async () => {
    const dir = new URL('./saves/', import.meta.url)
    const read = (n: string) => new File([readFileSync(new URL(n, dir))], n)
    for (const n of [0, 10]) {
      const [entry] = await listSlots([read(`slot_${n}.mp`), read(`meta_${n}.mp`)], loadSchema)
      await openSlot(entry, loadSchema)
      expect([session.readOnly, session.misfit], `slot_${n}`).toEqual([false, null])
      if (n === 0) expect(unfit.has(get(schema, session.root!, 'DataManager', ['Objectives', '0'])!.node)).toBe(true)
      expect(rename(0, 'Test'), `slot_${n}`).toBe(true)
      undo()
    }
  })
  test('a real folder: .mp wins over .json for the same slot, and slot 10 is listed', async () => {
    const dir = new URL('./saves/', import.meta.url)
    const files = readdirSync(dir).map(n => new File([readFileSync(new URL(n, dir))], n))
    const slots = await listSlots(files, loadSchema)
    expect(slots.map(s => [s.slot, s.slotFile.name, s.cultName])).toEqual([
      [0, 'slot_0.mp', expect.any(String)], [1, 'slot_1.json', expect.any(String)], [10, 'slot_10.mp', expect.any(String)]])
  })
  test('the same folder listed again with new dates finds the edits made on the first listing', async () => {
    const dir = new URL('./saves/', import.meta.url)
    const listing = (lastModified: number) =>
      listSlots(readdirSync(dir).map(n => new File([readFileSync(new URL(n, dir))], n, { lastModified })), loadSchema)
    const [first, second] = [await listing(1000), await listing(2000)]
    expect(second.map(keyOf)).toEqual(first.map(keyOf))
    await openSlot(first[0], loadSchema)
    rename(0, 'Test')
    expect(pendingFor(second[0])).toBe(1)
  })
  test('edits in two real slots both count as unexported', async () => {
    const dir = new URL('./saves/', import.meta.url)
    const read = (n: string) => new File([readFileSync(new URL(n, dir))], n)
    const base = unexported()
    for (const n of [0, 10]) {
      const [entry] = await listSlots([read(`slot_${n}.mp`), read(`meta_${n}.mp`)], loadSchema)
      await openSlot(entry, loadSchema)
      cultName('X')
    }
    expect(unexported()).toBe(base + 2)
  })
})
