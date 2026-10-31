import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { openSynthetic } from './fixtures'

test('after one online visit the app and its game pictures work offline', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await openSynthetic(page, 'followers')
  await expect(page.getByRole('table').locator('img').first()).toHaveJSProperty('complete', true)
  await context.setOffline(true)
  await openSynthetic(page, 'followers')
  const img = page.getByRole('table').locator('img').first()
  await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0)
})

test.describe('first visit without the API', () => {
  // page.route can't see requests a service worker answers
  test.use({ serviceWorkers: 'block' })
  test('ids show and the app says why', async ({ page }) => {
  await page.route('https://api.cotl.info/**', r => r.abort())
  await openSynthetic(page, 'followers')
  await expect(page.getByText('Game names and pictures are unavailable offline')).toBeVisible()
  await expect(page.getByRole('table')).toContainText('Axolotl')
  })
})

for (const theme of ['dark', 'light'] as const) {
  test(`followers pass an accessibility check in the ${theme} theme`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }) // no colour transitions mid-check
    await openSynthetic(page, 'followers')
    await page.getByRole('button', { name: /theme/i }).click()
    if (theme === 'light') await page.getByRole('menuitemradio', { name: 'Light' }).click()
    else await page.getByRole('menuitemradio', { name: 'Dark' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    await page.getByRole('table').getByRole('button', { name: 'Pip' }).click()
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(result.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).slice(0, 3).join(', ')}`)).toEqual([])
  })
}

test('game names switch language', async ({ page }) => {
  await openSynthetic(page, 'inventory')
  await page.getByRole('combobox', { name: 'Game language' }).selectOption('ru')
  await expect(page.getByRole('main')).toContainText('Монета')
})
