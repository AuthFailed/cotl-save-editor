import { copyFileSync, readFileSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Download, type Page } from '@playwright/test'
import { syntheticSaves } from '../tests/synthetic'
import { savesFolder } from './fixtures'

// The game, cloud sync or the player rewrites a save after the folder was chosen; Chromium then refuses to read the
// picked file again, even when only its date changed.
const touch = (file: string) => { const later = new Date(Date.now() + 5000); utimesSync(file, later, later) }
const choose = (page: Page, dir: string) => page.getByLabel('Choose your saves folder').setInputFiles(dir)
const row = (page: Page, file: string) => page.getByRole('listitem').filter({ hasText: file })
const changes = (page: Page) => page.getByRole('banner').getByRole('button', { name: /change/ })
const switcher = (page: Page) => page.getByRole('button', { name: 'Switch save' })
async function setGold(page: Page, value: string) {
  await page.getByRole('main').getByLabel('Gold', { exact: true }).fill(value)
  await page.getByRole('main').getByLabel('Gold', { exact: true }).press('Enter')
}
async function openFolder(page: Page, dir: string) {
  await page.goto('/#/open')
  await choose(page, dir)
  await row(page, 'slot_0.mp').getByRole('button', { name: 'Open' }).click()
  await page.getByRole('heading', { name: 'Overview' }).waitFor()
}
async function toOpen(page: Page) {
  await switcher(page).click()
  await page.getByRole('menuitem', { name: 'Open other saves…' }).click()
}

let errors: string[]
test.beforeEach(({ page }) => {
  errors = []
  page.on('pageerror', e => errors.push(e.message))
})
test.afterEach(async ({ page }) => {
  expect(errors).toEqual([])
  for (const text of await page.getByRole('alert').allTextContents()) expect(text).not.toMatch(/DOMException|NotReadable|could not be read/)
})

test('a slot whose file changed after choosing the folder is refused with a message', async ({ page }) => {
  const dir = await savesFolder()
  await page.goto('/#/open')
  await choose(page, dir)
  await expect(row(page, 'slot_0.mp')).toBeVisible() // listed, so read, before it changes
  touch(join(dir, 'slot_0.mp'))
  await row(page, 'slot_0.mp').getByRole('button', { name: 'Open' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'slot_0.mp changed on disk' })).toBeVisible({ timeout: 1000 })
  await expect(page).toHaveURL(/#\/open$/)
})

test('switching to a changed slot keeps the open one with its edits', async ({ page }) => {
  const dir = await savesFolder(undefined, {}, [0, 1])
  await openFolder(page, dir)
  await setGold(page, '999')
  await expect(changes(page)).toHaveText('1 change')
  touch(join(dir, 'slot_1.mp'))
  await switcher(page).click()
  await page.getByRole('menuitemradio', { name: /slot_1\.mp/ }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'slot_1.mp' })).toBeVisible({ timeout: 1000 })
  await expect(switcher(page)).toContainText('slot_0.mp')
  await expect(changes(page)).toHaveText('1 change')
})

test('export warns when the file changed on disk, and exporting anyway backs up what was opened', async ({ page }) => {
  const dir = await savesFolder(), [opened, meta] = await syntheticSaves()
  await openFolder(page, dir)
  await setGold(page, '999')
  writeFileSync(join(dir, 'slot_0.mp'), meta.bytes)
  const downloads: Download[] = []
  page.on('download', d => downloads.push(d))
  await page.getByRole('banner').getByRole('button', { name: 'Export' }).click()
  const banner = page.getByRole('status').filter({ hasText: 'changed on disk after you opened it' })
  await expect(banner).toBeVisible()
  expect(downloads).toEqual([])
  await banner.getByRole('button', { name: 'Export anyway' }).click()
  await expect.poll(() => downloads.map(d => d.suggestedFilename()).sort()).toEqual(['slot_0.mp', 'slot_0.mp.backup'])
  const backup = downloads.find(d => d.suggestedFilename() === 'slot_0.mp.backup')!
  expect(new Uint8Array(readFileSync(await backup.path()))).toEqual(opened.bytes)
  await expect(changes(page)).toHaveText('0 changes')
})

test('export of a changed file can send you to choose the folder again', async ({ page }) => {
  const dir = await savesFolder()
  await openFolder(page, dir)
  await setGold(page, '999')
  touch(join(dir, 'slot_0.mp'))
  await page.getByRole('banner').getByRole('button', { name: 'Export' }).click()
  await page.getByRole('status').getByRole('button', { name: 'Choose the folder again' }).click()
  await expect(page).toHaveURL(/#\/open$/)
})

test('choosing the same folder again keeps the edits, whatever the file dates', async ({ page }) => {
  const dir = await savesFolder()
  await openFolder(page, dir)
  await setGold(page, '999')
  await toOpen(page)
  touch(join(dir, 'slot_0.mp'))
  copyFileSync(join(dir, 'slot_0.mp'), join(dir, 'slot_1.mp'))
  await choose(page, dir)
  await expect(page.getByRole('listitem').filter({ hasText: 'Test Cult' })).toHaveCount(2)
  await expect(row(page, 'slot_0.mp')).toContainText('1 unexported')
  await row(page, 'slot_0.mp').getByRole('button', { name: 'Open' }).click()
  await expect(changes(page)).toHaveText('1 change')
})

test('choosing the folder again after the slot changed keeps the edits until you take the new file', async ({ page }) => {
  const dir = await savesFolder()
  await openFolder(page, dir)
  await setGold(page, '999')
  const download = page.waitForEvent('download', d => d.suggestedFilename() === 'slot_0.mp')
  await page.getByRole('banner').getByRole('button', { name: 'Export' }).click()
  writeFileSync(join(dir, 'slot_0.mp'), readFileSync((await (await download).path())))
  await setGold(page, '500')
  await expect(changes(page)).toHaveText('1 change')
  await toOpen(page)
  await choose(page, dir)
  const alert = page.getByRole('alert').filter({ hasText: 'slot_0.mp' })
  await expect(alert).toContainText('1 unexported change')
  let asked = ''
  page.once('dialog', d => { asked = d.message(); void d.accept() })
  await alert.getByRole('button', { name: 'Use the new file' }).click()
  expect(asked).toBe('Discard 1 unexported change?')
  await expect(row(page, 'slot_0.mp')).not.toContainText('unexported')
  await expect(switcher(page)).toHaveCount(0)
})
