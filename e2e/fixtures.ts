import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { syntheticSaves } from '../tests/synthetic'

/** A folder named "saves" holding the synthetic slot 0, for setInputFiles on the folder picker. */
export async function savesFolder(version?: string, extra: Record<string, string> = {}, slots = [0]): Promise<string> {
  const dir = join(mkdtempSync(join(tmpdir(), 'cotl-e2e-')), 'saves')
  mkdirSync(dir)
  for (const f of await syntheticSaves(version)) for (const n of slots) writeFileSync(join(dir, f.name.replace('_0', `_${n}`)), f.bytes)
  for (const [name, text] of Object.entries(extra)) writeFileSync(join(dir, name), text)
  return dir
}

import type { Page } from '@playwright/test'
/** Opens the synthetic save and lands on a page; returns the folder, so a test can choose the same one again. */
export async function openSynthetic(page: Page, to = 'overview') {
  const folder = await savesFolder()
  await page.goto('/')
  await page.getByLabel('Choose your saves folder').setInputFiles(folder)
  await page.getByRole('listitem').filter({ hasText: 'Test Cult' }).getByRole('button', { name: 'Open' }).click()
  await page.getByRole('heading', { name: 'Overview' }).waitFor()
  if (to !== 'overview') await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: new RegExp(to, 'i') }).click()
  return folder
}
