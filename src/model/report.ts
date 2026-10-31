import type { Format } from '../codec/formats'

export function readOnlyReport(format: Format, gameVersion: string | null): string {
  const params = new URLSearchParams({ template: 'read-only.yml', format })
  // Version metadata comes from the save; only a version number belongs in a public URL.
  if (gameVersion && /^\d+(?:\.\d+){1,3}$/.test(gameVersion)) params.set('game-version', gameVersion)
  return `https://github.com/AuthFailed/cotl-save-editor/issues/new?${params}`
}
