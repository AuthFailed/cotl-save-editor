import { readFileSync, readdirSync } from 'node:fs'
import { expect, test } from '@playwright/test'

test('the built site serves complete library and font notices', async ({ request }) => {
  const response = await request.get('/third-party-licenses.txt')
  expect(response.ok()).toBe(true)
  const text = await response.text()
  for (const name of ['vite', 'vite-plugin-pwa', 'svelte', '@lucide/svelte', 'clsx', '@fontsource-variable/geist', '@fontsource-variable/geist-mono',
    'esm-env', 'workbox-core', 'workbox-routing', 'workbox-expiration', 'workbox-cacheable-response',
    'workbox-strategies', 'workbox-precaching', 'idb', '@trickfilm400/rollup-plugin-off-main-thread']) {
    const dir = new URL(`../node_modules/${name}/`, import.meta.url)
    const pkg = JSON.parse(readFileSync(new URL('package.json', dir), 'utf8'))
    expect(text).toContain(`${name} ${pkg.version}\nLicense: ${pkg.license}`)
    const licences = readdirSync(dir).filter(f => /^licen[cs]e(\.(txt|md))?$/i.test(f))
    expect(licences.length).toBeGreaterThan(0)
    for (const file of licences) expect(text).toContain(readFileSync(new URL(file, dir), 'utf8').trim())
  }
  expect(text).toContain('Game art and data are not covered')
})

test('the About footer links to the notices and explains their scope', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  const footer = page.getByRole('contentinfo', { name: 'About' })
  await expect(footer.getByRole('link', { name: 'Third-party licences' })).toHaveAttribute('href', '/third-party-licenses.txt')
  await expect(footer).toContainText('Game art and data are not covered by these licences.')
  const popup = page.waitForEvent('popup')
  await footer.getByRole('link', { name: 'Third-party licences' }).click()
  await expect((await popup).locator('body')).toContainText('License: OFL-1.1')
})
