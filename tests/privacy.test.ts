import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { openSave } from '../src/codec/formats'
import { jsonToTree } from '../src/model/json'
import { followers, value } from '../src/model/views'
import type { SaveSchema } from '../src/schema/schema'
import schemaJson from './fixtures/save-schema-1.5.26.json'
import { hasSaves, readSave } from './util'

const schema = schemaJson as SaveSchema
const repo = fileURLToPath(new URL('..', import.meta.url))
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// The real saves are personal, so no tracked file may quote a cult or follower name from them.
describe.skipIf(!hasSaves)('real saves', () => {
  test('no tracked file contains a cult or follower name from them', async () => {
    const names = new Set<string>()
    for (const file of readdirSync(new URL('./saves/', import.meta.url)).filter(n => /^slot_\d+\.(mp|json)$/.test(n))) {
      const o = await openSave(file, readSave(file))
      const root = o.data.kind === 'msgpack' ? o.data.root : jsonToTree(schema, o.data.root)
      for (const name of [value(schema, root, 'CultName'), ...followers(schema, root).map(f => f.name)])
        if (typeof name === 'string' && name.trim().length > 2) names.add(name.trim())
    }
    expect(names.size).toBeGreaterThan(0)
    const words = [...names].map(n => new RegExp(`(?<![\\p{L}\\p{N}])${escape(n)}(?![\\p{L}\\p{N}])`, 'u'))
    const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: repo, encoding: 'utf8' }).split('\0').filter(f => f && existsSync(repo + f))
    // reports file names only, never the names themselves
    expect(tracked.filter(f => { const text = readFileSync(repo + f, 'utf8'); return words.some(w => w.test(text)) })).toEqual([])
  })
})
