import type { MpNode } from '../codec/msgpack'
import { followers } from '../model/views'
import type { SaveSchema } from '../schema/schema'

// Follower IDs, not list positions: positions shift on every remove, revive, clone, undo and redo.
export const selection = $state<{ follower: number | null; ticked: number[] }>({ follower: null, ticked: [] })
export const clear = () => Object.assign(selection, { follower: null, ticked: [] })

/** Drops the IDs the tree no longer has; reassigns only on a change, so an effect calling it can't loop. */
export function prune(schema: SaveSchema, root: MpNode) {
  const ids = new Set(followers(schema, root).map(f => f.id))
  if (selection.follower != null && !ids.has(selection.follower)) selection.follower = null
  if (!selection.ticked.every(id => ids.has(id))) selection.ticked = selection.ticked.filter(id => ids.has(id))
}
