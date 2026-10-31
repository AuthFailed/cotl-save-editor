import { expect, test } from '@playwright/test'
import { openSynthetic } from './fixtures'

test('the whole interface follows the language picker, and remembers it', async ({ page }) => {
  await openSynthetic(page, 'followers')
  await page.getByRole('combobox', { name: 'Language' }).selectOption('ru')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
  const nav = page.getByRole('navigation', { name: 'Разделы' })
  await expect(nav.getByRole('link', { name: 'Последователи' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Последователи')
  await expect(page.getByRole('table')).toContainText('Голоден')
  await expect(page.getByRole('banner').getByRole('button', { name: /изменени/ })).toHaveText('0 изменений')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Откройте сохранения' })).toBeVisible()
})

test('Arabic turns the page right to left', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('combobox', { name: 'Language' }).selectOption('ar')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('افتح ملفات الحفظ')
})

test('a language picked straight away is not overridden when game data arrives', async ({ page }) => {
  await page.route('https://api.cotl.info/v1/index.json', async r => { await new Promise(ok => setTimeout(ok, 1500)); await r.continue() })
  await page.goto('/')
  await page.getByRole('combobox', { name: 'Language' }).selectOption('ru')
  await page.waitForTimeout(2500)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Откройте сохранения')
})
