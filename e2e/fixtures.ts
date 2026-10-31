import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { syntheticSaves } from '../tests/synthetic'

/** A folder named "saves" holding the synthetic slot 0, for setInputFiles on the folder picker. */
export async function savesFolder(): Promise<string> {
  const dir = join(mkdtempSync(join(tmpdir(), 'cotl-e2e-')), 'saves')
  mkdirSync(dir)
  for (const f of await syntheticSaves()) writeFileSync(join(dir, f.name), f.bytes)
  return dir
}
