import { expect, test } from '@playwright/test'
import { savesFolder } from './fixtures'

test('choosing the saves folder lists its slots and opens one', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('%USERPROFILE%\\AppData\\LocalLow\\Massive Monster\\Cult Of The Lamb\\saves')).toBeVisible()
  await page.getByLabel('Choose your saves folder').setInputFiles(await savesFolder())
  const slot = page.getByRole('listitem').filter({ hasText: 'Test Cult' })
  await expect(slot).toContainText('Day 47')
  await expect(slot).toContainText('3h 12m')
  await slot.getByRole('button', { name: 'Open' }).click()
  await expect(page).toHaveURL(/#\/overview$/)
  await expect(page.getByRole('banner')).toContainText('slot_0.mp')
})
