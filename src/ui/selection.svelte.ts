import type { MpNode } from '../codec/msgpack'
import { followers, type FollowerView } from '../model/views'
import type { SaveSchema } from '../schema/schema'

// IDs, not list positions: positions shift on every remove, revive, clone, undo and redo.
// With the dead flag, since a Raw edit or a JSON save without IDs can give a living and a dead record the same ID.
export const key = (f: Pick<FollowerView, 'id' | 'dead'>) => `${f.dead}:${f.id}`
export const selection = $state<{ follower: string | null; ticked: string[] }>({ follower: null, ticked: [] })
export const clear = () => Object.assign(selection, { follower: null, ticked: [] })
export const tickedOf = (all: FollowerView[]) => all.filter(f => selection.ticked.includes(key(f)))

/** Moves a revived follower's inspector and tick to their living key. */
export function revived(id: number) {
  const was = key({ id, dead: true }), now = key({ id, dead: false })
  if (selection.follower === was) selection.follower = now
  selection.ticked = selection.ticked.map(k => (k === was ? now : k))
}

/** Drops the keys the tree no longer has; reassigns only on a change, so an effect calling it can't loop. */
export function prune(schema: SaveSchema, root: MpNode) {
  const keys = new Set(followers(schema, root).map(key))
  if (selection.follower != null && !keys.has(selection.follower)) selection.follower = null
  if (!selection.ticked.every(k => keys.has(k))) selection.ticked = selection.ticked.filter(k => keys.has(k))
}
