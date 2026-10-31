import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const saves = fileURLToPath(new URL('./saves/', import.meta.url))

export const fromHex = (hex: string) => Uint8Array.from(hex.match(/../g) ?? [], b => parseInt(b, 16))
export const hexOf = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
export const randomBytes = (n: number) => {
  const out = new Uint8Array(n)
  for (let i = 0; i < n; i += 65536) crypto.getRandomValues(out.subarray(i, i + 65536))
  return out
}
export const repeat = (s: string, times: number) => new TextEncoder().encode(s.repeat(times))

// Real saves are personal: they live in tests/saves/ (git-ignored), and tests that need them skip without them.
export const hasSaves = existsSync(saves + 'slot_0.mp')
export const readSave = (name: string) => new Uint8Array(readFileSync(saves + name))
