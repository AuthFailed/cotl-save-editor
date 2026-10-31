import { expect, test } from 'vitest'
import { readOnlyReport } from '../src/model/report'
import type { Format } from '../src/codec/formats'

test.each<Format>(['pc-mp', 'pc-json', 'plain-json', 'apple-zb', 'switch-mp'])('prefills only the format and game version: %s', format => {
  const url = new URL(readOnlyReport(format, '1.5.26.1058'))
  expect(url.origin + url.pathname).toBe('https://github.com/AuthFailed/cotl-save-editor/issues/new')
  expect([...url.searchParams]).toEqual([['template', 'read-only.yml'], ['format', format], ['game-version', '1.5.26.1058']])
  expect(url.searchParams.has('editor-version')).toBe(false)
})

test.each([null, '', 'Private Cult', '1.5.26 Pip', 'https://example.com'])('leaves unknown or unexpected game versions for the reporter: %s', version => {
  const url = new URL(readOnlyReport('plain-json', version))
  expect([...url.searchParams.keys()]).toEqual(['template', 'format'])
})
