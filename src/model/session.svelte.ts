// The open slot: its files, the schema that names it, and the edits made to it.
import { SvelteMap } from 'svelte/reactivity'
import { SaveFormatError } from '../codec/errors'
import { openSave, sameBytes, type Format, type Opened } from '../codec/formats'
import type { MpNode } from '../codec/msgpack'
import { t } from '../i18n/i18n.svelte'
import { field, fit, gameVersionOf, moved, unfit, type SaveSchema } from '../schema/schema'
import { jsonToTree } from './json'
import { OpError, replay, revertOne, type Change } from './ops'

export type SchemaFor = (version: string | null) => Promise<{ schema: SaveSchema; exact: boolean }>

export interface SlotEntry {
  slot: number; slotFile: File; metaFile?: File
  // Read once at listing: a picked file that the game or sync rewrites can't be read again (Chromium refuses).
  bytes: Uint8Array; metaBytes?: Uint8Array; hash: string
  cultName: string | null; day: number | null; playTime: number | null; format: Format; beta: boolean
}

const NAME = /^(slot|meta)_(\d+)(\.mp|\.json|MP)?$/
const bytesOf = async (f: File) => new Uint8Array(await f.arrayBuffer())

/** A MetaData/DataManager field by name, from MessagePack (through the schema) or JSON. */
function valueOf(o: Opened, schema: SaveSchema, type: string, name: string): unknown {
  if (o.data.kind === 'json') return (o.data.root as Record<string, unknown> | null)?.[name] ?? null
  const f = field(schema, type, name)
  const node = f && o.data.root.t === 'arr' ? o.data.root.v[f.key] : undefined
  return node && (node.t === 'str' || node.t === 'int' || node.t === 'float') ? (typeof node.v === 'bigint' ? Number(node.v) : node.v) : null
}

// .mp is what 1.5+ loads; a .json beside it is a leftover from before.
const rank = (name: string) => (name.endsWith('.mp') || name.endsWith('MP') ? 0 : name.endsWith('.json') ? 2 : 1)

export async function listSlots(files: File[], schemaFor: SchemaFor): Promise<SlotEntry[]> {
  const slots = new Map<number, File>(), metas = new Map<number, File>()
  for (const f of files) {
    const m = NAME.exec(f.name)
    if (!m) continue
    const to = m[1] === 'slot' ? slots : metas
    const n = Number(m[2]), had = to.get(n)
    if (!had || rank(f.name) < rank(had.name)) to.set(n, f)
  }
  const entries: SlotEntry[] = []
  for (const [n, slotFile] of [...slots].sort((a, b) => a[0] - b[0])) {
    const metaFile = metas.get(n)
    try {
      const bytes = await bytesOf(slotFile), metaBytes = metaFile && await bytesOf(metaFile)
      const slot = await openSave(slotFile.name, bytes)
      const meta = metaFile ? await openSave(metaFile.name, metaBytes!) : null
      const { schema } = await schemaFor(meta ? gameVersionOf(meta, (await schemaFor(null)).schema) : null)
      // Without a meta file, the cult name comes from the slot itself.
      const [source, type] = meta ? [meta, schema.roots.meta] : [slot, schema.roots.slot]
      const num = (name: string) => (meta ? valueOf(meta, schema, type, name) as number | null : null)
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>))
      entries.push({
        slot: n, slotFile, metaFile, bytes, metaBytes, hash: Array.from(digest, b => b.toString(16).padStart(2, '0')).join(''),
        format: slot.format, beta: slot.beta,
        cultName: valueOf(source, schema, type, 'CultName') as string | null, day: num('Day'), playTime: num('PlayTime'),
      })
    } catch {
      continue // not a save we can read
    }
  }
  return entries
}

// Raw state: save trees are large and only ever replaced whole, never mutated in place.
class Session {
  entry = $state.raw<SlotEntry | null>(null)
  slot = $state.raw<Opened | null>(null)
  meta = $state.raw<Opened | null>(null)
  schema = $state.raw<SaveSchema | null>(null)
  schemaExact = $state.raw(true)
  saveVersion = $state.raw<string | null>(null)
  original = $state.raw<MpNode | null>(null)
  root = $state.raw<MpNode | null>(null)
  changes = $state.raw<Change[]>([])
  undone = $state.raw<Change[]>([])
  /** The last edit that couldn't be made, for the screens to show. */
  error = $state.raw<string | null>(null)
  readOnly = $state.raw(false)
  /** The fields that don't fit the schema when so many don't that the save's keys have moved; the slot is then read-only. */
  misfit = $state.raw<string[] | null>(null)
  /** The slots of the folder that was opened, for the switcher. */
  slots = $state.raw<SlotEntry[]>([])
}
export const session = new Session()

// Each slot's open state, kept while another slot is open, so switching never loses edits. Never holds the open slot.
// Keyed by name and contents, so choosing the same folder again (or a copy of it) finds them too.
type Kept = Pick<Session, 'slot' | 'meta' | 'schema' | 'schemaExact' | 'saveVersion' | 'original' | 'root' | 'changes' | 'undone' | 'readOnly' | 'misfit'>
const kept = new SvelteMap<string, Kept>()
export const keyOf = (e: SlotEntry) => `${e.slotFile.name}:${e.hash}`
export const pendingFor = (e: SlotEntry) =>
  session.entry && keyOf(e) === keyOf(session.entry) ? session.changes.length : kept.get(keyOf(e))?.changes.length ?? 0

/** Whether the slot's file on disk is no longer what was read; a file that can't be read counts as changed. */
export async function changedOnDisk(e: SlotEntry): Promise<boolean> {
  try {
    return !sameBytes(await bytesOf(e.slotFile), e.bytes)
  } catch {
    return true
  }
}

async function load(entry: SlotEntry, schemaFor: SchemaFor): Promise<Kept> {
  const slot = await openSave(entry.slotFile.name, entry.bytes)
  const meta = entry.metaFile ? await openSave(entry.metaFile.name, entry.metaBytes!) : null
  const saveVersion = meta ? gameVersionOf(meta, (await schemaFor(null)).schema) : null
  const { schema, exact } = await schemaFor(saveVersion)
  const root = slot.data.kind === 'msgpack' ? slot.data.root : jsonToTree(schema, slot.data.root)
  const found = fit(schema, root)
  for (const m of found) unfit.add(m.node)
  const misfit = moved(found)
  return { slot, meta, schema, schemaExact: exact, saveVersion, original: root, root, changes: [], undone: [], readOnly: !slot.exact || !!misfit, misfit }
}

/** Opens a slot, or brings back its kept edits; a failure leaves the open slot as it was. */
export async function openSlot(entry: SlotEntry, schemaFor: SchemaFor): Promise<void> {
  const key = keyOf(entry)
  // The open slot again, maybe from a new listing: a stash of it would be older than what is open.
  if (session.entry && keyOf(session.entry) === key) { Object.assign(session, { entry, error: null }); return }
  const changed = await changedOnDisk(entry), back = kept.get(key)
  // A stash with no changes holds nothing worth keeping over the newer file.
  if (changed && !back?.changes.length) {
    kept.delete(key)
    throw new SaveFormatError(t('open.changed', { file: entry.slotFile.name }), true)
  }
  const next = back ?? await load(entry, schemaFor)
  if (session.entry && session.slot) {
    const { slot, meta, schema, schemaExact, saveVersion, original, root, changes, undone, readOnly, misfit } = session
    kept.set(keyOf(session.entry), { slot, meta, schema, schemaExact, saveVersion, original, root, changes, undone, readOnly, misfit })
  }
  kept.delete(key)
  Object.assign(session, { entry, ...next, error: changed ? t('export.changed', { file: entry.slotFile.name }) : null })
}

/** Takes a new listing of the folder. A slot whose file changed while it has pending edits keeps the copy that was
 * opened; each such slot is returned with its new entry, for the player to keep or drop the edits. */
export async function adopt(fresh: SlotEntry[]): Promise<{ was: SlotEntry; now: SlotEntry }[]> {
  const changed: { was: SlotEntry; now: SlotEntry }[] = [], slots: SlotEntry[] = []
  for (const n of fresh) {
    if (session.entry && keyOf(session.entry) === keyOf(n)) { slots.push(session.entry = n); continue }
    const o = session.slots.find(s => s.slot === n.slot)
    // Another folder leaves the old file reading as it did; only a rewrite of that file is the same slot changing.
    if (!o || keyOf(o) === keyOf(n) || !pendingFor(o) || !await changedOnDisk(o)) { slots.push(n); continue }
    changed.push({ was: o, now: n })
    slots.push(o)
  }
  session.slots = slots
  return changed
}

/** Drops a slot's pending edits for its new file. */
export function discard(was: SlotEntry, now: SlotEntry) {
  kept.delete(keyOf(was))
  if (session.entry && keyOf(session.entry) === keyOf(was))
    Object.assign(session, { entry: null, slot: null, meta: null, original: null, root: null, changes: [], undone: [], error: null })
  session.slots = session.slots.map(s => (s === was ? now : s))
}

/** What to tell the player when a file couldn't be opened or exported: never the browser's own text. */
export const failure = (e: unknown, file: string) => (e instanceof SaveFormatError && e.translated ? e.message : t('file.failed', { file }))

function settle(changes: Change[], undone: Change[]) {
  session.root = replay(session.schema!, session.original!, changes)
  session.changes = changes
  session.undone = undone
  session.error = null
}

/** Applies a change; a refused one (wrong type, stale target) is reported in session.error instead. */
export function push(change: Change | (() => Change)): boolean {
  if (session.readOnly || !session.schema || !session.root) return false
  try {
    const c = typeof change === 'function' ? change() : change
    if (!c.ops.length) return false
    settle([...session.changes, c], [])
    return true
  } catch (e) {
    if (!(e instanceof OpError || e instanceof TypeError || e instanceof RangeError)) throw e
    session.error = e.message
    return false
  }
}
export function undo() {
  const last = session.changes.at(-1)
  if (last) settle(session.changes.slice(0, -1), [...session.undone, last])
}
export function redo() {
  const next = session.undone.at(-1)
  if (next) settle([...session.changes, next], session.undone.slice(0, -1))
}
export function revert(i: number) {
  try {
    settle(revertOne(session.schema!, session.original!, session.changes, i), [])
  } catch (e) {
    if (!(e instanceof OpError)) throw e
    session.error = e.message
  }
}

/** Unexported changes in every slot opened this visit: the open one plus every kept one (kept never holds the open slot).
 * With `listed`, only those the player can still find: the open slot and the slots of the folder chosen last. */
export function unexported(listed = false) {
  let n = session.changes.length
  for (const [k, s] of kept) if (!listed || session.slots.some(e => keyOf(e) === k)) n += s.changes.length
  return n
}
