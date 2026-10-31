import type { Kind } from '../data/api'
/** The thing whose details card is open (from a grid, the inventory or search). */
export const detail = $state<{ open: { kind: Kind; id: string } | null }>({ open: null })
