<script lang="ts">
  import { Plus, Search } from '@lucide/svelte'
  import { entities, plain, type Full } from '../data/api'
  import { cat, nameOf, want } from '../data/catalogs.svelte'
  import { t, type Key } from '../i18n/i18n.svelte'
  import { edits } from '../model/edits'
  import { push, session } from '../model/session.svelte'
  import { inventory } from '../model/views'
  import { detail } from './detail.svelte'
  import NumberField from './NumberField.svelte'
  import Picker from './Picker.svelte'
  import { route } from './route.svelte'
  import Thumb from './Thumb.svelte'

  type Cat = 'resources' | 'meals' | 'drinks' | 'ingredients' | 'seeds' | 'crops' | 'necklaces' | 'gifts' | 'other'
  const CATS: Cat[] = ['resources', 'meals', 'drinks', 'ingredients', 'seeds', 'crops', 'necklaces', 'gifts', 'other']
  // From the API's own fields: tags, crop/seed links, what costs it.
  function categoryOf(e: Full | undefined): Cat {
    if (!e) return 'other'
    const tags = (e.tags as string[] | undefined) ?? []
    const used = e.usedIn as Record<string, string[]> | undefined
    if (e.id.startsWith('Necklace')) return 'necklaces'
    if (e.crop) return 'seeds'
    if (tags.includes('drink')) return 'drinks'
    if (tags.includes('meal')) return 'meals'
    if (e.seed) return 'crops'
    if (tags.some(x => ['food', 'fish', 'big_fish', 'meat'].includes(x))) return 'ingredients'
    if (tags.includes('gift')) return 'gifts'
    if (used?.structures?.length || (e.category && e.category !== 'NONE')) return 'resources'
    return 'other'
  }

  want('items')
  let list = $state.raw<Full[]>([])
  $effect(() => { entities('items').then(l => { list = l ?? [] }) })
  const byId = $derived(new Map(list.map(e => [e.id, e])))
  const owned = $derived(session.root && session.schema ? inventory(session.schema, session.root) : [])
  const known = $derived(new Set(Object.values(session.schema?.enums['InventoryItem.ITEM_TYPE'] ?? {})))

  let query = $state('')
  $effect(() => { query = route.q ?? '' })
  let scope = $state<'owned' | 'all'>('owned')
  let category = $state<Cat | 'all'>('all')
  let sort = $state<'name' | 'most' | 'fewest'>('name')
  let adding = $state(false)

  type Row = { id: string; index: number | null; quantity: number; cat: Cat; name: string; e?: Full }
  const rows = $derived.by((): Row[] => {
    const have = new Map(owned.map(i => [i.id, i]))
    const ids = scope === 'all' ? [...new Set([...owned.map(i => i.id), ...list.map(e => e.id).filter(id => known.has(id) && id !== 'NONE')])] : owned.map(i => i.id)
    return ids.map(id => {
      const e = byId.get(id), i = have.get(id)
      return { id, index: i?.index ?? null, quantity: i?.quantity ?? 0, cat: categoryOf(e), e, name: e ? plain(e.namePlain[cat.lang] ?? e.namePlain.en ?? id) : nameOf('items', id) }
    })
  })
  const counts = $derived(Object.fromEntries(CATS.map(c => [c, rows.filter(r => r.cat === c).length])) as Record<Cat, number>)
  const shown = $derived(rows
    .filter(r => (category === 'all' || r.cat === category) && `${r.name} ${r.id}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => sort === 'most' ? b.quantity - a.quantity || a.name.localeCompare(b.name)
      : sort === 'fewest' ? a.quantity - b.quantity || a.name.localeCompare(b.name) : a.name.localeCompare(b.name, cat.lang)))
  const total = $derived(owned.reduce((s, i) => s + i.quantity, 0))
  const addable = $derived([...(cat.maps.items?.values() ?? [])].filter(e => known.has(e.id) && e.id !== 'NONE' && !owned.some(i => i.id === e.id))
    .sort((a, b) => a.name.localeCompare(b.name)))

  function setQuantity(r: Row, v: number) {
    push(() => r.index !== null ? edits.setQuantity(session.schema!, session.root!, r.index, v, r.name) : edits.addItem(session.schema!, session.root!, r.id, v, r.name))
  }
  const desc = (r: Row) => (r.e ? plain(r.e.descriptionPlain?.[cat.lang] ?? r.e.descriptionPlain?.en ?? '') : '')
</script>

<section>
  <div class="bar">
    <h1>{t('nav.inventory')}</h1>
    <span class="count">{t('inv.kinds', { n: owned.length })} · {t('inv.total', { n: total.toLocaleString(cat.lang) })}</span>
    <span class="spacer"></span>
    <button class="btn primary" disabled={session.readOnly} onclick={() => (adding = true)}><Plus size={16} />{t('inv.add')}</button>
  </div>

  <div class="tools">
    <div class="seg" role="group">
      <button aria-pressed={scope === 'owned'} onclick={() => (scope = 'owned')}>{t('inv.owned')}</button>
      <button aria-pressed={scope === 'all'} onclick={() => (scope = 'all')}>{t('inv.all')}</button>
    </div>
    <label class="search"><Search size={14} aria-hidden="true" />
      <input type="search" placeholder={t('common.search')} aria-label={t('inv.searchLabel')} bind:value={query} /></label>
    <label class="sort">{t('inv.sort')}
      <select bind:value={sort}>
        <option value="name">{t('sort.name')}</option><option value="most">{t('sort.most')}</option><option value="fewest">{t('sort.fewest')}</option>
      </select>
    </label>
  </div>

  <div class="cats">
    <button class="chip" class:on={category === 'all'} aria-pressed={category === 'all'} onclick={() => (category = 'all')}>{t('common.all')} <span>{rows.length}</span></button>
    {#each CATS.filter(c => counts[c]) as c (c)}
      <button class="chip" class:on={category === c} aria-pressed={category === c} onclick={() => (category = c)}>{t(`cat.${c}` as Key)} <span>{counts[c]}</span></button>
    {/each}
  </div>

  <ul>
    {#each shown as r (r.id)}
      {@const d = desc(r)}
      <li class:zero={!r.quantity}>
        <button class="pic" aria-label={t('info.details', { name: r.name })} onclick={() => (detail.open = { kind: 'items', id: r.id })}>
          <Thumb src={r.e?.thumb} kind="items" size={40} dim={!r.quantity} />
        </button>
        <div class="body">
          <NumberField label={r.name} value={r.quantity} min={0} max={2147483647} step={10} disabled={session.readOnly} onCommit={v => setQuantity(r, v)} />
          <span class="cat">{t(`cat.${r.cat}` as Key)}</span>
        </div>
        {#if d}<div class="tip" role="tooltip"><b>{r.name}</b>{d}</div>{/if}
      </li>
    {:else}
      <p class="none">{owned.length || scope === 'all' ? t('common.nothing') : t('inv.empty')}</p>
    {/each}
  </ul>
</section>

{#if adding}
  <Picker kind="items" title={t('inv.addTitle')} search={t('inv.searchLabel')} items={addable} onClose={() => (adding = false)}
    onPick={id => push(() => edits.addItem(session.schema!, session.root!, id, 1, nameOf('items', id)))} />
{/if}

<style>
  section { display: flex; flex-direction: column; gap: 14px; }
  .bar, .tools, .cats { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  h1 { margin: 0 8px 0 0; font-size: 22px; font-weight: 600; }
  .count { color: var(--muted); font-variant-numeric: tabular-nums; }
  .spacer { flex: 1; }
  .seg { display: inline-flex; border: 1px solid var(--border); border-radius: var(--radius-8); overflow: hidden; }
  .seg button { height: 34px; padding: 0 12px; border: 0; background: transparent; color: var(--muted); }
  .seg button[aria-pressed='true'] { background: var(--surface-3); color: var(--text); font-weight: 500; }
  .search { display: flex; align-items: center; gap: 6px; height: 36px; padding: 0 10px; border: 1px solid var(--border); border-radius: var(--radius-8); color: var(--faint); flex: 1; min-width: 180px; max-width: 320px; }
  .search input { border: 0; background: transparent; outline: none; width: 100%; }
  .search:focus-within { outline: 2px solid var(--accent-text); outline-offset: 2px; }
  .sort { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 14px; }
  .sort select { height: 36px; padding: 0 8px; border-radius: var(--radius-8); border: 1px solid var(--border); background: var(--surface-2); }
  .chip { height: 32px; padding: 0 12px; border-radius: var(--radius-8); border: 1px solid var(--border); background: transparent; }
  .chip span { color: var(--faint); }
  .chip.on { background: var(--text); color: var(--bg); border-color: var(--text); }
  .chip.on span { color: var(--bg); opacity: .7; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 8px; }
  li { position: relative; display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius-10); background: var(--surface-1); }
  li.zero { background: transparent; border-style: dashed; }
  .pic { padding: 0; border: 0; background: none; border-radius: var(--radius-8); display: inline-flex; }
  .body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
  .cat { font-size: 12px; color: var(--faint); }
  .tip { position: absolute; z-index: 15; bottom: calc(100% + 6px); left: 12px; width: 260px; padding: 10px 12px; border-radius: var(--radius-10);
    border: 1px solid var(--border); background: var(--surface-1); box-shadow: 0 8px 24px rgb(0 0 0 / .35); font-size: 13px; line-height: 1.45;
    color: var(--muted); pointer-events: none; opacity: 0; visibility: hidden; transition: opacity 120ms; }
  .tip b { display: block; color: var(--text); font-weight: 600; margin-bottom: 2px; }
  li:has(.pic:hover) .tip, li:has(.pic:focus-visible) .tip { opacity: 1; visibility: visible; transition-delay: 300ms; }
  @media (hover: none) { .tip { display: none; } }
  .none { color: var(--muted); }
</style>
