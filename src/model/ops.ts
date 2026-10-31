// Every edit is an op appended to the session; Review, undo and export all read this one list.
import type { MpNode } from '../codec/msgpack'

export type Op = { label: string } & (
  | { kind: 'set'; path: string[]; value: unknown }
  | { kind: 'insert'; path: string[]; index: number; node: MpNode }
  | { kind: 'remove'; path: string[]; index: number })
