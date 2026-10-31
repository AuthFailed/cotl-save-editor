import { expect, test, type Page } from '@playwright/test'
import type { MpNode } from '../src/codec/msgpack'
import { arr, at, int, str } from '../tests/synthetic'
import { openSynthetic, savesFolder } from './fixtures'

const changes = (page: Page) => page.getByRole('banner').getByRole('button', { name: /change/ })

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
  await expect(dialog.getByRole('option', { name: /^Pip/ })).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('complementary', { name: 'Inspector' })).toContainText('Pip')
  await page.getByRole('banner').getByRole('button', { name: /Search/ }).click()
  await page.getByRole('dialog', { name: 'Search' }).getByRole('combobox').fill('relic')
  await page.getByRole('dialog', { name: 'Search' }).getByRole('option', { name: /Collection › Relics/ }).click()
  await expect(page.getByRole('tab', { name: 'Relics' })).toHaveAttribute('aria-selected', 'true')
})

async function openRaw(page: Page, tweak: (slot: MpNode) => MpNode) {
  await page.goto('/')
  await page.getByLabel('Choose your saves folder').setInputFiles(await savesFolder(undefined, {}, [0], tweak))
  await page.getByRole('listitem').filter({ hasText: 'Test Cult' }).getByRole('button', { name: 'Open' }).click()
  await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: /raw/i }).click()
  return page.getByRole('main')
}
const note = "doesn't match the type the schema gives"

test('a value that does not fit its field is shown as stored, read-only', async ({ page }) => {
  const main = await openRaw(page, at('playerDeaths', arr([int(1)])))
  await main.getByLabel('Filter fields').fill('playerDeaths')
  const row = main.getByRole('treeitem', { name: 'playerDeaths', exact: true })
  await expect(row).toContainText('arr')
  await expect(row.getByText(note)).toBeVisible()
  await expect(main.getByRole('textbox', { name: 'playerDeaths', exact: true })).toHaveCount(0)
  await main.getByLabel('Filter fields').fill('CultName')
  await expect(main.getByRole('textbox', { name: 'CultName', exact: true })).toBeEnabled()
  await main.getByRole('textbox', { name: 'CultName', exact: true }).fill('New Cult')
  await main.getByRole('textbox', { name: 'CultName', exact: true }).press('Enter')
  await expect(changes(page)).toHaveText('1 change')
})

test('a union-shaped objective has no editable Type', async ({ page }) => {
  const main = await openRaw(page, at('Objectives', arr([arr([int(0), arr([str('a'), { t: 'bool', v: true }])])])))
  await main.getByLabel('Filter fields').fill('Objectives')
  await main.getByRole('treeitem', { name: 'Objectives', exact: true }).getByRole('button', { name: 'Expand Objectives' }).click()
  const el = main.getByRole('treeitem', { name: '0', exact: true }).first()
  await el.getByRole('button', { name: 'Expand 0' }).click()
  await expect(el.getByText(note)).toBeVisible()
  await expect(el.getByRole('group').getByRole('treeitem')).toHaveCount(2)
  await expect(el.getByRole('treeitem', { name: '1', exact: true })).toBeVisible()
  await expect(main.getByRole('combobox', { name: 'Type' })).toHaveCount(0)
})
