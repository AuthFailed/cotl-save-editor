import { expect, test, type Page } from '@playwright/test'
import { openSynthetic, savesFolder } from './fixtures'

const TITLE = 'Cult of the Lamb Save Editor'
async function setGold(page: Page, value: string) {
  await page.getByRole('main').getByLabel('Gold', { exact: true }).fill(value)
  await page.getByRole('main').getByLabel('Gold', { exact: true }).press('Enter')
}
async function closesWithoutAsking(page: Page) {
  let asked = false
  page.on('dialog', d => { asked = true; d.dismiss() })
  const closed = page.waitForEvent('close')
  await page.close({ runBeforeUnload: true })
  await closed
  expect(asked).toBe(false)
}
async function asksBeforeLeaving(page: Page) {
  const dialog = page.waitForEvent('dialog')
  await page.close({ runBeforeUnload: true })
  const d = await dialog
  expect(d.type()).toBe('beforeunload')
  await d.dismiss()
  expect(page.isClosed()).toBe(false)
}

test('no changes, no leave prompt', async ({ page }) => {
  await openSynthetic(page)
  await expect(page).toHaveTitle(TITLE)
  await closesWithoutAsking(page)
})

test('an unexported change asks before leaving, and the tab says so', async ({ page }) => {
  await openSynthetic(page)
  await setGold(page, '4321')
  await expect(page).toHaveTitle(`• 1 unexported · ${TITLE}`)
  await asksBeforeLeaving(page)
})

test('export or Undo all clears the prompt', async ({ page }) => {
  await openSynthetic(page)
  await setGold(page, '4321')
  await page.getByRole('banner').getByRole('button', { name: 'Export' }).click()
  await expect(page).toHaveTitle(TITLE)
  await closesWithoutAsking(page)
})

test('Undo all resets the tab title', async ({ page }) => {
  await openSynthetic(page)
  await setGold(page, '4321')
  await setGold(page, '1234')
  await expect(page).toHaveTitle(`• 2 unexported · ${TITLE}`)
  await page.getByRole('banner').getByRole('button', { name: '2 changes' }).click()
  await page.getByRole('dialog', { name: 'Review changes' }).getByRole('button', { name: 'Undo all' }).click()
  await expect(page).toHaveTitle(TITLE)
  await closesWithoutAsking(page)
})

test('a slot switched away from still counts', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Choose your saves folder').setInputFiles(await savesFolder(undefined, {}, [0, 1]))
  await page.getByRole('listitem').filter({ hasText: 'slot_0.mp' }).getByRole('button', { name: 'Open' }).click()
  await setGold(page, '4321')
  await page.getByRole('button', { name: 'Switch save' }).click()
  await page.getByRole('menuitemradio').filter({ hasText: 'slot_1.mp' }).click()
  await expect(page.getByRole('banner').getByRole('button', { name: /change/ })).toHaveText('0 changes')
  await expect(page).toHaveTitle(`• 1 unexported · ${TITLE}`)
  await asksBeforeLeaving(page)
})
