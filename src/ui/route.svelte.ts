export type Page = 'open' | 'overview' | 'followers' | 'inventory' | 'cult' | 'collection' | 'raw'
export const PAGES: Page[] = ['open', 'overview', 'followers', 'inventory', 'cult', 'collection', 'raw']

// #/collection?tab=relics&q=eye
const read = (): { page: Page; tab: string | null; q: string | null } => {
  const [p, query] = location.hash.replace(/^#\//, '').split('?')
  const params = new URLSearchParams(query)
  return { page: PAGES.includes(p as Page) ? (p as Page) : 'open', tab: params.get('tab'), q: params.get('q') }
}

export const route = $state(read())
addEventListener('hashchange', () => Object.assign(route, read()))
export function go(page: Page, tab?: string, q?: string) {
  const params = new URLSearchParams()
  if (tab) params.set('tab', tab)
  if (q) params.set('q', q)
  location.hash = `#/${page}${params.size ? `?${params}` : ''}`
}
