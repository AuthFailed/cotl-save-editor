// Writing the edited slot back: same format and name, checked by reading it again before anything is downloaded.
import { SaveFormatError } from '../codec/errors'
import { openSave, sameBytes, saveSave, type Opened } from '../codec/formats'
import { encodeMp } from '../codec/msgpack'
import { t } from '../i18n/i18n.svelte'
import { fit, unfit } from '../schema/schema'
import { fromTree } from './json'
import { keyOf, session } from './session.svelte'

// By contents, not File: choosing the folder again gives new Files for the same bytes.
const backedUp = new Set<string>()

export async function exportSlot(): Promise<{ files: { name: string; bytes: Uint8Array }[] }> {
  const { slot, root, schema, entry } = session
  if (!slot || !root || !schema || !entry) throw new SaveFormatError('No save is open.')
  // Safety 4 again: what was locked on opening is unchanged, so any other misfit is one an edit made.
  const bad = fit(schema, root).find(m => !unfit.has(m.node))
  if (bad) throw new SaveFormatError(t('export.unfit', { field: bad.field, version: schema.gameVersion }), true)
  const data: Opened['data'] = slot.data.kind === 'msgpack'
    ? { kind: 'msgpack', root }
    : { kind: 'json', root: fromTree(schema, root, slot.data.root) }
  const edited: Opened = { ...slot, data }
  const bytes = await saveSave(edited)

  // Spec, Safety 4: the file we built must read back as exactly what was edited.
  const back = await openSave(slot.name, bytes)
  const same = data.kind === 'msgpack'
    ? back.data.kind === 'msgpack' && sameBytes(encodeMp(back.data.root), encodeMp(data.root))
    : back.data.kind === 'json' && JSON.stringify(back.data.root) === JSON.stringify(data.root)
  if (!same) throw new SaveFormatError("The edited save didn't read back the same, so nothing was downloaded. Please report this.")

  const files = [{ name: slot.name, bytes }]
  // The backup is what was opened and edited, not whatever is on disk now.
  if (!backedUp.has(keyOf(entry))) {
    files.push({ name: `${slot.name}.backup`, bytes: entry.bytes })
    backedUp.add(keyOf(entry))
  }
  // What was exported is the new starting point: the change list is spent.
  Object.assign(session, { slot: edited, original: root, changes: [], undone: [], error: null })
  return { files }
}
