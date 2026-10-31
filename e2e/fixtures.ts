import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openSave } from '../src/codec/formats'
import { toPlain, type MpNode } from '../src/codec/msgpack'
import { get } from '../src/schema/schema'
import { schema, syntheticSaves } from '../tests/synthetic'

/** A folder named "saves" holding the synthetic slot 0, for setInputFiles on the folder picker. */
export async function savesFolder(version?: string, extra: Record<string, string> = {}, slots = [0],
  tweak?: (slot: MpNode) => MpNode): Promise<string> {
  const dir = join(mkdtempSync(join(tmpdir(), 'cotl-e2e-')), 'saves')
  mkdirSync(dir)
  for (const f of await syntheticSaves(version, tweak)) for (const n of slots) writeFileSync(join(dir, f.name.replace('_0', `_${n}`)), f.bytes)
  for (const [name, text] of Object.entries(extra)) writeFileSync(join(dir, name), text)
  return dir
}

import type { Page } from '@playwright/test'
/** Opens the synthetic save and lands on a page; returns the folder, so a test can choose the same one again. */
export async function openSynthetic(page: Page, to = 'overview', tweak?: (slot: MpNode) => MpNode) {
  const folder = await savesFolder(undefined, {}, [0], tweak)
  await page.goto('/')
  await page.getByLabel('Choose your saves folder').setInputFiles(folder)
  await page.getByRole('listitem').filter({ hasText: 'Test Cult' }).getByRole('button', { name: 'Open' }).click()
  await page.getByRole('heading', { name: 'Overview' }).waitFor()
  if (to !== 'overview') await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: new RegExp(to, 'i') }).click()
  return folder
}

/** Exports the open slot and reads a path of the downloaded slot_0.mp. */
export async function exported(page: Page) {
  const download = page.waitForEvent('download', { predicate: d => d.suggestedFilename() === 'slot_0.mp' })
  await page.getByRole('banner').getByRole('button', { name: 'Export' }).click()
  const o = await openSave('slot_0.mp', new Uint8Array(readFileSync(await (await download).path())))
  const root = (o.data as { root: MpNode }).root
  return (...path: string[]) => toPlain(get(schema, root, schema.roots.slot, path)!.node)
}
