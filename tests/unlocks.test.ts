import { expect, test } from 'vitest'
import { edits } from '../src/model/edits'
import { replay } from '../src/model/ops'
import { UNLOCKS } from '../src/model/unlocks'
import { enumOf, listKind, unlocked } from '../src/model/views'
import { toPlain } from '../src/codec/msgpack'
import { field, get } from '../src/schema/schema'
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
  const enumName = enumOf(schema, u.field)
  if (u.tab === 'fleeces' || u.tab === 'forms') {
    expect(kind).toBe(u.tab === 'fleeces' ? 'int' : 'string')
    expect(enumName).toBeNull()
  } else {
    expect(kind).toEqual({ enum: enumName })
    expect(Object.keys(schema.enums[enumName!] ?? {})).not.toHaveLength(0)
  }
})

test.each(UNLOCKS)('$tab unlocks, deduplicates and locks using the schema element type', u => {
  const { slot } = syntheticRoots()
  const kind = listKind(schema, u.field)
  const enumName = enumOf(schema, u.field)
  const id = enumName ? Object.values(schema.enums[enumName])[0] : kind === 'int' ? '1' : 'Fox'
  const next = replay(schema, slot, [edits.unlock(schema, slot, u.field, [id])])
  expect(unlocked(schema, next, u.field)).toEqual(new Set([id]))
  expect(edits.unlock(schema, next, u.field, [id]).ops).toEqual([])
  expect(unlocked(schema, replay(schema, next, [edits.lock(schema, next, u.field, id)]), u.field)).toEqual(new Set())
})

test.each([
  { fieldName: 'UnlockedFleeces', ids: ['0', '1'], values: [0, 1] },
  { fieldName: 'FollowerSkinsUnlocked', ids: ['Fox', 'Axolotl'], values: ['Fox', 'Axolotl'] },
  { fieldName: 'PlayerFoundTrinkets', ids: ['Arrows', 'AttackRate'], values: [11, 32] },
])('$fieldName unlocks beside an existing element in its wire type', ({ fieldName, ids, values }) => {
  const { slot } = syntheticRoots()
  const seeded = replay(schema, slot, [edits.unlock(schema, slot, fieldName, [ids[0]])])
  const sample = get(schema, seeded, schema.roots.slot, [fieldName, '0'])!.node
  const next = replay(schema, seeded, [edits.unlock(schema, seeded, fieldName, [ids[1]])])
  const list = get(schema, next, schema.roots.slot, [fieldName])!.node
  expect(toPlain(list)).toEqual(values)
  expect(get(schema, next, schema.roots.slot, [fieldName, '0'])!.node).toEqual(sample)
  expect(get(schema, next, schema.roots.slot, [fieldName, '1'])!.node.t).toBe(sample.t)
  expect(unlocked(schema, next, fieldName)).toEqual(new Set(ids))
})
