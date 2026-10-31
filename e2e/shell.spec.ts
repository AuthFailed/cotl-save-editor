import { expect, test } from '@playwright/test'

test('the shell shows the open screen first and navigates by keyboard', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Open your saves' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Sections' }).getByRole('link')).toHaveCount(7)
  await page.keyboard.press('Tab')
  await expect(page.locator(':focus')).toHaveCSS('outline-style', 'solid')
})

test('phone width collapses the nav into a menu button', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Sections' })).toBeHidden()
  await page.getByRole('button', { name: 'Menu' }).click()
  await expect(page.getByRole('navigation', { name: 'Sections' })).toBeVisible()
})
