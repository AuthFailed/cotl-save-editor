import { expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { csp, policy } from '../scripts/csp'

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

test('the production policy is the first meta after charset and restricts page resource origins', () => {
  const plugin = csp()
  expect(plugin.apply).toBe('build')
  const transform = plugin.transformIndexHtml as (html: string) => string
  const result = transform(html)
  expect(result).toMatch(/<meta charset="utf-8" \/>\s*<meta http-equiv="Content-Security-Policy"/)
  expect(result).toContain(`content="${policy}"`)
  expect(policy).toBe("default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https://api.cotl.info; font-src 'self'; connect-src 'self' https://api.cotl.info; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'")
  expect(html).not.toContain('Content-Security-Policy')
})
