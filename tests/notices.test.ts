import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import { packageRoot, readNotice } from '../scripts/notices'

const dirs: string[] = []
function pkg(license?: string, text: string | null = 'Full copyright and permission text') {
  const dir = mkdtempSync(join(tmpdir(), 'cotl-notices-'))
  dirs.push(dir)
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'example', version: '1.2.3', license }))
  if (text !== null) writeFileSync(join(dir, 'LICENSE'), text)
  return dir
}
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }) })

test.each(['MIT', 'ISC', 'OFL-1.1', 'Apache-2.0', 'BSD', 'BSD-2-Clause', 'BSD-3-Clause'])('ships the full %s notice, version and upstream notices', license => {
  const dir = pkg(license)
  writeFileSync(join(dir, 'NOTICE'), 'Additional attribution')
  expect(readNotice(dir)).toContain(`example 1.2.3\nLicense: ${license}\n`)
  expect(readNotice(dir)).toContain('Full copyright and permission text')
  expect(readNotice(dir)).toContain('Additional attribution')
})

test.each([undefined, 'GPL-3.0', 'UNLICENSED'])('rejects missing or disallowed licence metadata: %s', license => {
  expect(() => readNotice(pkg(license))).toThrow(/license/i)
})

test.each([null, ''])('rejects missing or empty full licence text: %s', text => {
  expect(() => readNotice(pkg('MIT', text))).toThrow(/license/i)
})

test('finds scoped, nested and font package owners without counting app files', () => {
  expect(packageRoot('/app/node_modules/@fontsource-variable/geist/files/font.woff2')).toBe('/app/node_modules/@fontsource-variable/geist')
  expect(packageRoot('/app/node_modules/a/node_modules/clsx/dist/clsx.mjs?v=1')).toBe('/app/node_modules/a/node_modules/clsx')
  expect(packageRoot('/app/src/main.ts')).toBeNull()
})
