export type Page = 'open' | 'overview' | 'followers' | 'inventory' | 'cult' | 'collection' | 'raw'
export const PAGES: Page[] = ['open', 'overview', 'followers', 'inventory', 'cult', 'collection', 'raw']

// #/collection?tab=Relics
const read = (): { page: Page; tab: string | null } => {
  const [p, query] = location.hash.replace(/^#\//, '').split('?')
  return { page: PAGES.includes(p as Page) ? (p as Page) : 'open', tab: new URLSearchParams(query).get('tab') }
}

export const route = $state(read())
addEventListener('hashchange', () => Object.assign(route, read()))
export const go = (page: Page, tab?: string) => { location.hash = `#/${page}${tab ? `?tab=${encodeURIComponent(tab)}` : ''}` }
