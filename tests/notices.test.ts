import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import { fileURLToPath } from 'node:url'
import type { ResolvedConfig } from 'vite'
import { notices, packageRoot, readNotice } from '../scripts/notices'

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

function workerBuild() {
  const dir = mkdtempSync(join(tmpdir(), 'cotl-worker-'))
  dirs.push(dir)
  for (const name of ['sw', 'workbox-test']) {
    writeFileSync(join(dir, `${name}.js`), `self.test = true;\n//# sourceMappingURL=${name}.js.map\n//# sourceMappingURL=${name}.js.map\n`)
    writeFileSync(join(dir, `${name}.js.map`), JSON.stringify({ sources: [] }))
  }
  const plugin = notices()
  const configure = plugin.configResolved as (config: ResolvedConfig) => void
  configure({ root: fileURLToPath(new URL('..', import.meta.url)), build: { outDir: dir } } as ResolvedConfig)
  return { dir, finish: () => (plugin.closeBundle as { handler: () => void }).handler() }
}

test('removes every source map comment before deleting worker maps', () => {
  const { dir, finish } = workerBuild()
  finish()
  for (const name of ['sw', 'workbox-test']) {
    expect(readFileSync(join(dir, `${name}.js`), 'utf8')).not.toContain('sourceMappingURL')
    expect(existsSync(join(dir, `${name}.js.map`))).toBe(false)
  }
})

test.each(['extra.js', 'assets/index.js'])('rejects a source map reference left in %s', file => {
  const { dir, finish } = workerBuild()
  mkdirSync(join(dir, 'assets'), { recursive: true })
  writeFileSync(join(dir, file), 'self.test = true;\n//# sourceMappingURL=missing.map\n')
  expect(finish).toThrow(/sourceMappingURL/)
})
