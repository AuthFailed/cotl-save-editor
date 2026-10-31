import { existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

const allowed = new Set(['MIT', 'ISC', 'OFL-1.1', 'Apache-2.0', 'BSD', 'BSD-2-Clause', 'BSD-3-Clause', 'BSD-4-Clause'])
const disclaimer = 'Third-party software and font licences. Game art and data are not covered by these licences.'

export function packageRoot(id: string): string | null {
  const path = id.replaceAll('\\', '/').split('?')[0]
  const at = path.lastIndexOf('/node_modules/')
  if (at < 0) return null
  const parts = path.slice(at + 14).split('/')
  return path.slice(0, at + 14) + parts.slice(0, parts[0].startsWith('@') ? 2 : 1).join('/')
}

export function readNotice(dir: string): string {
  const { name, version, license } = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8'))
  if (!name || !version || !allowed.has(license)) throw new Error(`${name ?? dir}: missing or disallowed license (${license})`)
  const files = readdirSync(dir).filter(f => /^(licen[cs]e|copying|notice)(\.(txt|md))?$/i.test(f)).sort()
  const licences = files.filter(f => !/^notice/i.test(f))
  if (!licences.length || licences.some(f => !readFileSync(resolve(dir, f), 'utf8').trim())) throw new Error(`${name}: missing full license text`)
  return `${name} ${version}\nLicense: ${license}\n\n${files.map(f => readFileSync(resolve(dir, f), 'utf8').trim()).join('\n\n')}\n`
}

export function notices(): Plugin {
  const packages = new Set<string>()
  let root: string, out: string
  const add = (id: string) => { const dir = packageRoot(id); if (dir) packages.add(dir) }
  return {
    name: 'third-party-notices',
    apply: 'build',
    configResolved(config) { root = config.root; out = resolve(root, config.build.outDir) },
    generateBundle(_, bundle) {
      const require = createRequire(resolve(root, 'package.json'))
      for (const id of this.getModuleIds()) {
        add(id)
        if (id.startsWith('\0vite/')) add(require.resolve('vite'))
      }
      for (const file of Object.values(bundle)) if (file.type === 'asset') {
        for (const name of file.originalFileNames) add(resolve(root, name))
      }
    },
    closeBundle: {
      order: 'post',
      sequential: true,
      handler() {
        const maps = readdirSync(out).filter(f => /^(sw|workbox-.+)\.js\.map$/.test(f))
        if (!maps.some(f => f.startsWith('workbox-'))) throw new Error('Missing Workbox source map for license audit')
        for (const file of maps) {
          const map = JSON.parse(readFileSync(resolve(out, file), 'utf8')) as { sources: string[] }
          for (const source of map.sources) if (source.includes('node_modules/')) add(resolve(root, source))
        }
        // Workbox injects this package's AMD loader outside the source map.
        const require = createRequire(resolve(root, 'node_modules/workbox-build/package.json'))
        add(require.resolve('@trickfilm400/rollup-plugin-off-main-thread'))
        // The registration script is emitted from the PWA plugin's template.
        add(createRequire(resolve(root, 'package.json')).resolve('vite-plugin-pwa'))
        const text = [...packages].sort().map(readNotice).join('\n---\n\n')
        writeFileSync(resolve(out, 'third-party-licenses.txt'), `${disclaimer}\n\n${text}`)
        for (const file of maps) {
          const js = resolve(out, file.slice(0, -4))
          if (!existsSync(js)) throw new Error(`Missing bundle for ${file}`)
          writeFileSync(js, readFileSync(js, 'utf8').replace(/\n?\/\/# sourceMappingURL=.*$/m, ''))
          unlinkSync(resolve(out, file))
        }
      },
    },
  }
}
