<script lang="ts">
  import { Plus, Search } from '@lucide/svelte'
  import { iconUrl } from '../data/api'
  import { cat, entry, nameOf, want } from '../data/catalogs.svelte'
  import { edits } from '../model/edits'
  import { push, session } from '../model/session.svelte'
  import { inventory } from '../model/views'
  import NumberField from './NumberField.svelte'
  import { t } from '../i18n/i18n.svelte'
  import Picker from './Picker.svelte'

  want('items')
  const items = $derived(session.root && session.schema ? inventory(session.schema, session.root) : [])
  let query = $state('')
  let adding = $state(false)
  const shown = $derived(items.filter(i => `${nameOf('items', i.id)} ${i.id}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => nameOf('items', a.id).localeCompare(nameOf('items', b.id))))
  const addable = $derived.by(() => {
    const owned = new Set(items.map(i => i.id))
    const known = new Set(Object.values(session.schema?.enums['InventoryItem.ITEM_TYPE'] ?? {}))
    return [...(cat.maps.items?.values() ?? [])].filter(e => known.has(e.id) && !owned.has(e.id) && e.id !== 'NONE')
      .sort((a, b) => a.name.localeCompare(b.name))
  })
</script>

<section>
  <div class="bar">
    <h1>{t('nav.inventory')}</h1>
    <span class="count">{t('inv.kinds', { n: items.length })}</span>
    <span class="spacer"></span>
    <label class="search"><Search size={14} aria-hidden="true" />
      <input type="search" placeholder={t('common.search')} aria-label={t('inv.searchLabel')} bind:value={query} /></label>
    <button class="btn primary" disabled={session.readOnly} onclick={() => (adding = true)}><Plus size={16} />{t('inv.add')}</button>
  </div>

  <ul>
    {#each shown as i (i.index)}
      {@const th = entry('items', i.id)?.thumb}
      <li>
        {#if th}<img src={iconUrl(th)} alt="" width="40" height="40" />{:else}<span class="ph"></span>{/if}
        <NumberField label={nameOf('items', i.id)} value={i.quantity} min={0} max={2147483647} step={10} disabled={session.readOnly}
          onCommit={v => push(() => edits.setQuantity(session.schema!, session.root!, i.index, v, nameOf('items', i.id)))} />
      </li>
    {:else}
      <p class="none">{items.length ? t('common.nothing') : t('inv.empty')}</p>
    {/each}
  </ul>
</section>

{#if adding}
  <Picker title={t('inv.addTitle')} search={t('inv.searchLabel')} items={addable} onClose={() => (adding = false)}
    onPick={id => push(() => edits.addItem(session.schema!, session.root!, id, 1, nameOf('items', id)))} />
{/if}

<style>
  section { display: flex; flex-direction: column; gap: 16px; }
  .bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  h1 { margin: 0 8px 0 0; font-size: 22px; font-weight: 600; }
  .count { color: var(--muted); }
  .spacer { flex: 1; }
  .search { display: flex; align-items: center; gap: 6px; height: 36px; padding: 0 10px; border: 1px solid var(--border); border-radius: var(--radius-8); color: var(--faint); }
  .search input { border: 0; background: transparent; outline: none; width: 180px; }
  .search:focus-within { outline: 2px solid var(--accent-text); outline-offset: 2px; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 8px; }
  li { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius-10); background: var(--surface-1); }
  li :global(.field) { flex: 1; }
  img { object-fit: contain; flex: none; }
  .ph { width: 40px; height: 40px; flex: none; border-radius: var(--radius-8); background: var(--surface-3); }
  .none { color: var(--muted); }
</style>
