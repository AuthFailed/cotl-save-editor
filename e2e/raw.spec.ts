import { expect, test } from '@playwright/test'
import { openSynthetic } from './fixtures'

const changes = (page: import('@playwright/test').Page) => page.getByRole('banner').getByRole('button', { name: /change/ })

test('raw data: filter, edit a text field, reject a bad number, show unnamed keys', async ({ page }) => {
  await openSynthetic(page, 'raw')
  const main = page.getByRole('main')
  await main.getByLabel('Filter fields').fill('CultName')
  await expect(main.getByRole('treeitem')).toHaveCount(2) // CultName, OnboardedCultName
  await main.getByRole('textbox', { name: 'CultName', exact: true }).fill('New Cult')
  await main.getByRole('textbox', { name: 'CultName', exact: true }).press('Enter')
  await expect(changes(page)).toHaveText('1 change')
  await main.getByLabel('Filter fields').fill('CultFaith')
  await main.getByRole('textbox', { name: 'CultFaith', exact: true }).fill('abc')
  await main.getByRole('textbox', { name: 'CultFaith', exact: true }).press('Enter')
  await expect(main.getByText('Enter a number')).toBeVisible()
  await main.getByLabel('Filter fields').fill('Followers')
  await main.getByRole('treeitem', { name: /^Followers\b/ }).first().getByRole('button', { name: /Expand/ }).click()
  await expect(main.getByRole('treeitem', { name: /^0\b/ })).toBeVisible()
})

test('command palette finds a follower and a collection grid', async ({ page }) => {
  await openSynthetic(page)
  await page.keyboard.press('ControlOrMeta+k')
  const dialog = page.getByRole('dialog', { name: 'Search' })
  await dialog.getByRole('combobox').fill('pip')
  await expect(dialog.getByRole('option', { name: /Follower: Pip/ })).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('complementary', { name: 'Inspector' })).toContainText('Pip')
  await page.getByRole('banner').getByRole('button', { name: /Search/ }).click()
  await page.getByRole('dialog', { name: 'Search' }).getByRole('combobox').fill('relic')
  await page.getByRole('dialog', { name: 'Search' }).getByRole('option', { name: /Collection › Relics/ }).click()
  await expect(page.getByRole('tab', { name: 'Relics' })).toHaveAttribute('aria-selected', 'true')
})
