import { expect, test } from '@playwright/test'
import { openSynthetic } from './fixtures'

const changes = (page: import('@playwright/test').Page) => page.getByRole('banner').getByRole('button', { name: /change/ })

test('review lists changes by label; undo one; keyboard undo and redo', async ({ page }) => {
  await openSynthetic(page)
  const main = page.getByRole('main')
  await main.getByLabel('Cult name', { exact: true }).fill('First')
  await main.getByLabel('Cult name', { exact: true }).press('Enter')
  await main.getByLabel('Gold', { exact: true }).fill('500')
  await main.getByLabel('Gold', { exact: true }).press('Enter')
  await changes(page).click()
  const review = page.getByRole('dialog', { name: 'Review changes' })
  await expect(review.getByRole('listitem')).toHaveCount(2)
  await expect(review).toContainText('Cult name Test Cult → First')
  await review.getByRole('button', { name: 'Undo Cult name Test Cult → First' }).click()
  await expect(review.getByRole('listitem')).toHaveCount(1)
  await review.getByRole('button', { name: 'Close' }).click()
  await page.locator('body').click()
  await page.keyboard.press('ControlOrMeta+z')
  await expect(changes(page)).toHaveText('0 changes')
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect(changes(page)).toHaveText('1 change')
})

test('export downloads the slot and a backup, then tells you where to put it', async ({ page }) => {
  await openSynthetic(page)
  await page.getByRole('main').getByLabel('Gold', { exact: true }).fill('999')
  await page.getByRole('main').getByLabel('Gold', { exact: true }).press('Enter')
  const names: string[] = []
  page.on('download', d => names.push(d.suggestedFilename()))
  await page.getByRole('banner').getByRole('button', { name: 'Export' }).click()
  await expect(page.getByRole('status')).toContainText('slot_0.mp')
  await expect.poll(() => names.sort()).toEqual(['slot_0.mp', 'slot_0.mp.backup'])
  await expect(changes(page)).toHaveText('0 changes')
})

test('a save from a version with no exact schema says so and stays editable', async ({ page }) => {
  const { savesFolder } = await import('./fixtures')
  await page.goto('/')
  await page.getByLabel('Choose your saves folder').setInputFiles(await savesFolder('1.4.0'))
  await page.getByRole('listitem').filter({ hasText: 'Test Cult' }).getByRole('button', { name: 'Open' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Field names come from game version 1.5.26.1058; your save is from 1.4.0' })).toBeVisible()
  await expect(page.getByRole('main').getByLabel('Gold', { exact: true })).toBeEnabled()
})

test('a save that would not write back exactly opens read-only', async ({ page }) => {
  const { savesFolder } = await import('./fixtures')
  await page.goto('/')
  await page.getByLabel('Choose your saves folder').setInputFiles(await savesFolder(undefined, { 'slot_3.json': '{"CultName":"Big Ids","id":9007199254740993}' }))
  await page.getByRole('listitem').filter({ hasText: 'Big Ids' }).getByRole('button', { name: 'Open' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'open read-only' })).toBeVisible()
  await expect(page.getByRole('main').getByLabel('Cult name', { exact: true })).toBeDisabled()
  await expect(page.getByRole('banner').getByRole('button', { name: 'Export' })).toBeDisabled()
})
