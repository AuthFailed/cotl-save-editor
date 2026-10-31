import { expect, test } from 'vitest'
import { edits } from '../src/model/edits'
import { replay } from '../src/model/ops'
import { UNLOCKS } from '../src/model/unlocks'
import { listKind, unlocked } from '../src/model/views'
import { field } from '../src/schema/schema'
import schemaJson from '../src/model/fallback-schema.json'
import type { SaveSchema } from '../src/schema/schema'
import { syntheticRoots } from './synthetic'

const schema = schemaJson as SaveSchema

test.each(UNLOCKS)('$tab uses a supported schema list without duplicating its enum', u => {
  expect(u).not.toHaveProperty('enumName')
  const type = field(schema, schema.roots.slot, u.field)?.type
  expect(type).toHaveProperty('list')
  const kind = listKind(schema, u.field)
  expect(kind).not.toBeNull()
  if (u.tab === 'fleeces' || u.tab === 'forms') expect(kind).toBe(u.tab === 'fleeces' ? 'int' : 'string')
  else {
    expect(kind).toEqual({ enum: expect.any(String) })
    if (kind && typeof kind === 'object') expect(Object.keys(schema.enums[kind.enum] ?? {})).not.toHaveLength(0)
  }
})

test.each(UNLOCKS)('$tab unlocks, deduplicates and locks using the schema element type', u => {
  const { slot } = syntheticRoots()
  const kind = listKind(schema, u.field)
  const id = kind && typeof kind === 'object' ? Object.values(schema.enums[kind.enum])[0] : kind === 'int' ? '1' : 'Fox'
  const next = replay(schema, slot, [edits.unlock(schema, slot, u.field, [id])])
  expect(unlocked(schema, next, u.field)).toEqual(new Set([id]))
  expect(edits.unlock(schema, next, u.field, [id]).ops).toEqual([])
  expect(unlocked(schema, replay(schema, next, [edits.lock(schema, next, u.field, id)]), u.field)).toEqual(new Set())
})
