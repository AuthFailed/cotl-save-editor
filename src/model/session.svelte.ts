// The open slot: its files, the schema that names it, and the edits made to it.
import { openSave, type Format, type Opened } from '../codec/formats'
import type { MpNode } from '../codec/msgpack'
import { field, gameVersionOf, type SaveSchema } from '../schema/schema'
import { jsonToTree } from './json'
import { OpError, replay, revertOne, type Change } from './ops'

export type SchemaFor = (version: string | null) => Promise<{ schema: SaveSchema; exact: boolean }>

export interface SlotEntry {
  slot: number; slotFile: File; metaFile?: File
  cultName: string | null; day: number | null; playTime: number | null; format: Format; beta: boolean
}

const NAME = /^(slot|meta)_(\d+)(\.mp|\.json|MP)?$/
const read = async (f: File) => openSave(f.name, new Uint8Array(await f.arrayBuffer()))

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
      const slot = await read(slotFile)
      const meta = metaFile ? await read(metaFile) : null
      const { schema } = await schemaFor(meta ? gameVersionOf(meta, (await schemaFor(null)).schema) : null)
      // Without a meta file, the cult name comes from the slot itself.
      const [source, type] = meta ? [meta, schema.roots.meta] : [slot, schema.roots.slot]
      const num = (name: string) => (meta ? valueOf(meta, schema, type, name) as number | null : null)
      entries.push({
        slot: n, slotFile, metaFile, format: slot.format, beta: slot.beta,
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
  original = $state.raw<MpNode | null>(null)
  root = $state.raw<MpNode | null>(null)
  changes = $state.raw<Change[]>([])
  undone = $state.raw<Change[]>([])
  /** The last edit that couldn't be made, for the screens to show. */
  error = $state.raw<string | null>(null)
  readOnly = $state.raw(false)
}
export const session = new Session()

export async function openSlot(entry: SlotEntry, schemaFor: SchemaFor): Promise<void> {
  const slot = await read(entry.slotFile)
  const meta = entry.metaFile ? await read(entry.metaFile) : null
  const { schema, exact } = await schemaFor(meta ? gameVersionOf(meta, (await schemaFor(null)).schema) : null)
  const root = slot.data.kind === 'msgpack' ? slot.data.root : jsonToTree(schema, slot.data.root)
  Object.assign(session, { entry, slot, meta, schema, schemaExact: exact, original: root, root, changes: [], undone: [], error: null, readOnly: !slot.exact })
}

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

export const hasUnexported = () => session.changes.length > 0
