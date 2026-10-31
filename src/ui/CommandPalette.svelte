<script lang="ts">
  import { Search } from '@lucide/svelte'
  import { nameOf } from '../data/catalogs.svelte'
  import { session } from '../model/session.svelte'
  import { followers, inventory } from '../model/views'
  import { nameAt } from '../schema/schema'
  import { go, type Page } from './route.svelte'
  import { selection } from './selection.svelte'

  let { onClose, onRaw }: { onClose: () => void; onRaw: (field: string) => void } = $props()
  const id = $props.id()
  let dialog: HTMLDialogElement
  let query = $state('')
  let active = $state(0)
  $effect(() => { dialog.showModal() })

  type Hit = { label: string; run: () => void }
  const PLACES: [string, Page, string?][] = [
    ['Overview', 'overview'], ['Followers', 'followers'], ['Inventory', 'inventory'], ['Raw data', 'raw'],
    ...['Doctrines', 'Rituals', 'Structures', 'Crown abilities'].map(t => [`Cult › ${t}`, 'cult', t] as [string, Page, string]),
    ...['Tarot', 'Relics', 'Weapons', 'Curses', 'Fleeces', 'Outfits', 'Forms'].map(t => [`Collection › ${t}`, 'collection', t] as [string, Page, string]),
  ]
  const hits = $derived.by((): Hit[] => {
    const q = query.trim().toLowerCase()
    if (!q || !session.schema || !session.root) return PLACES.map(([label, page, tab]) => ({ label, run: () => go(page, tab) }))
    const s = session.schema, r = session.root
    const has = (t: string) => t.toLowerCase().includes(q)
    return [
      ...PLACES.filter(([label]) => has(label)).map(([label, page, tab]) => ({ label, run: () => go(page, tab) })),
      ...followers(s, r).filter(f => has(f.name)).slice(0, 8).map(f => ({ label: `Follower: ${f.name}${f.dead ? ' (dead)' : ''}`,
        run: () => { go('followers'); selection.follower = { index: f.index, dead: f.dead } } })),
      ...inventory(s, r).filter(i => has(nameOf('items', i.id)) || has(i.id)).slice(0, 5).map(i => ({ label: `Item: ${nameOf('items', i.id)} ×${i.quantity}`, run: () => go('inventory') })),
      ...(r.t === 'arr' ? r.v.map((_, k) => nameAt(s, s.roots.slot, k)) : []).filter(has).slice(0, 8).map(n => ({ label: `Field: ${n}`, run: () => onRaw(n) })),
    ]
  })
  $effect(() => { void query; active = 0 })

  function choose(h: Hit | undefined) {
    if (!h) return
    h.run()
    dialog.close()
  }
  function key(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') { active = Math.min(hits.length - 1, active + 1); e.preventDefault() }
    if (e.key === 'ArrowUp') { active = Math.max(0, active - 1); e.preventDefault() }
    if (e.key === 'Enter') { choose(hits[active]); e.preventDefault() }
  }
</script>

<dialog bind:this={dialog} aria-label="Search" onclose={onClose}>
  <div class="field">
    <Search size={16} aria-hidden="true" />
    <input role="combobox" aria-expanded="true" aria-controls="{id}-list" aria-activedescendant={hits.length ? `${id}-${active}` : undefined}
      aria-label="Search followers, items, fields and screens" placeholder="Search followers, items, fields, screens" bind:value={query} onkeydown={key} />
    <kbd>esc</kbd>
  </div>
  <ul role="listbox" id="{id}-list" aria-label="Results">
    {#each hits as h, i (h.label)}
      <li role="option" id="{id}-{i}" aria-selected={i === active} onclick={() => choose(h)} onkeydown={() => {}} onmousemove={() => (active = i)}>{h.label}</li>
    {:else}
      <li class="none">No matches.</li>
    {/each}
  </ul>
</dialog>

<style>
  dialog { width: min(600px, calc(100vw - 32px)); margin-top: 12vh; padding: 0; border: 1px solid var(--border); border-radius: var(--radius-12); background: var(--surface-1); color: var(--text); }
  dialog::backdrop { background: rgb(0 0 0 / .55); }
  .field { display: flex; align-items: center; gap: 10px; padding: 0 14px; border-bottom: 1px solid var(--border); color: var(--faint); }
  input { flex: 1; height: 52px; border: 0; background: transparent; outline: none; font-size: 16px; color: var(--text); }
  kbd { font-family: var(--mono); font-size: 12px; padding: 2px 6px; border: 1px solid var(--border); border-radius: var(--radius-6); }
  ul { list-style: none; margin: 0; padding: 6px; max-height: 50vh; overflow-y: auto; }
  li { padding: 9px 10px; border-radius: var(--radius-8); cursor: pointer; }
  li[aria-selected='true'] { background: var(--surface-3); }
  .none { color: var(--muted); cursor: default; }
</style>
