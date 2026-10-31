import { expect, test, type Request } from '@playwright/test'
import { openSynthetic } from './fixtures'

function audit(requests: Request[], origin: string, secrets: string[]) {
  return requests.flatMap(r => {
    const url = new URL(r.url())
    const decoded = decodeURIComponent(r.url().replace(/\+/g, ' '))
    return [
      r.method() !== 'GET' && `method: ${r.method()}`,
      ![origin, 'https://api.cotl.info'].includes(url.origin) && `origin: ${url.origin}`,
      r.postDataBuffer() !== null && 'request body',
      ['eventsource', 'websocket', 'ping'].includes(r.resourceType()) && `transport: ${r.resourceType()}`,
      secrets.some(s => decoded.includes(s)) && 'save value in URL',
    ].filter(Boolean)
  })
}

test('open, every screen, search, edit and export keep saves local without CSP violations', async ({ page, context, baseURL }) => {
  test.setTimeout(90_000)
  const requests: Request[] = [], transports: string[] = [], violations: string[] = []
  context.on('request', r => requests.push(r))
  page.on('websocket', () => transports.push('WebSocket'))
  await context.exposeBinding('privacyViolation', (_, directive: string) => violations.push(directive))
  await context.exposeBinding('privacyTransport', (_, kind: string) => transports.push(kind))
  await context.addInitScript(() => {
    const report = window as unknown as {
      privacyViolation: (value: string) => Promise<void>
      privacyTransport: (value: string) => Promise<void>
    }
    document.addEventListener('securitypolicyviolation', e => { void report.privacyViolation(e.violatedDirective) })
    for (const key of ['WebSocket', 'EventSource'] as const) {
      Object.defineProperty(window, key, { value: new Proxy(window[key], {
        construct(target, args) { void report.privacyTransport(key); return Reflect.construct(target, args) },
      }) })
    }
    navigator.sendBeacon = new Proxy(navigator.sendBeacon, {
      apply(target, self, args) { void report.privacyTransport('sendBeacon'); return Reflect.apply(target, self, args) },
    })
  })

  await openSynthetic(page)
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.getByRole('main').getByLabel('Cult name', { exact: true }).fill('Private edited cult 23364')
  await page.getByRole('main').getByLabel('Cult name', { exact: true }).press('Enter')
  const nav = page.getByRole('navigation', { name: 'Sections' })
  for (const section of ['Followers', 'Inventory', 'Cult', 'Collection', 'Raw data', 'Overview']) {
    await nav.getByRole('link', { name: section, exact: true }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(section)
    if (section === 'Followers') {
      await page.getByRole('table').getByRole('button', { name: 'Pip', exact: true }).click()
      await expect(page.getByRole('complementary', { name: 'Inspector' })).toBeVisible()
      await expect.poll(() => page.getByRole('table').locator('img').first().evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0)
    }
    if (section === 'Inventory') await expect(page.getByRole('button', { name: 'Details: Lumber' })).toBeVisible()
    if (section === 'Cult' || section === 'Collection') {
      for (const tab of await page.getByRole('tab').all()) {
        await tab.click()
        await expect(page.getByRole('tabpanel').getByRole('button', { name: /^Details:/ }).first()).toBeVisible()
      }
    }
  }
  await page.getByRole('banner').getByRole('button', { name: 'Search', exact: true }).click()
  const palette = page.getByRole('dialog', { name: 'Search' })
  await palette.getByRole('combobox').fill('Pip')
  await expect(palette.getByRole('option', { name: /^Pip/ })).toBeVisible()
  await page.keyboard.press('Escape')
  const download = page.waitForEvent('download')
  await page.getByRole('banner').getByRole('button', { name: 'Export', exact: true }).click()
  expect((await download).suggestedFilename()).toBe('slot_0.mp')
  await expect(page.getByRole('status').filter({ hasText: 'slot_0.mp' })).toBeVisible()
  expect(requests.length).toBeGreaterThan(0)
  expect(audit(requests, new URL(baseURL!).origin, ['Test Cult', 'Pip', 'Ash', 'Thistle', 'Private edited cult 23364'])).toEqual([])
  expect(transports).toEqual([])
  expect(violations).toEqual([])
})

test('the production policy refuses connections to other origins', async ({ page }) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const violation = new Promise<string>(resolve => document.addEventListener('securitypolicyviolation', e => resolve(e.effectiveDirective), { once: true }))
    const blocked = await fetch('https://example.com').then(() => false, () => true)
    return { blocked, directive: await violation }
  })
  expect(result).toEqual({ blocked: true, directive: 'connect-src' })
})

test('the request audit detects a save name even in an allowed GET', async ({ page, context, baseURL }) => {
  const requests: Request[] = []
  context.on('request', r => requests.push(r))
  await page.goto('/')
  await page.evaluate(() => fetch(`/icon.svg?cult=${encodeURIComponent('Test Cult')}`))
  expect(audit(requests, new URL(baseURL!).origin, ['Test Cult'])).toContain('save value in URL')
})
