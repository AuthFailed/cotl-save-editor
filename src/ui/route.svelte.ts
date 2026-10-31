export type Page = 'open' | 'overview' | 'followers' | 'inventory' | 'cult' | 'collection' | 'raw'
export const PAGES: Page[] = ['open', 'overview', 'followers', 'inventory', 'cult', 'collection', 'raw']

const read = (): Page => {
  const p = location.hash.replace(/^#\//, '') as Page
  return PAGES.includes(p) ? p : 'open'
}

export const route = $state({ page: read() })
addEventListener('hashchange', () => { route.page = read() })
export const go = (page: Page) => { location.hash = `#/${page}` }
