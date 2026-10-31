<script lang="ts">
  import { X } from '@lucide/svelte'
  import { iconUrl } from '../data/api'

  type Item = { id: string; name: string; thumb: string | null; description?: string }
  let { title, search, items, current, onPick, onClose, tile = false }: {
    tile?: boolean; title: string; search: string; items: Item[]; current?: string; onPick: (id: string) => void; onClose: () => void
  } = $props()

  const id = $props.id()
  let dialog: HTMLDialogElement
  let query = $state('')
  const shown = $derived(items.filter(i => `${i.name} ${i.id}`.toLowerCase().includes(query.trim().toLowerCase())))
  $effect(() => { dialog.showModal() })
</script>

<dialog bind:this={dialog} aria-labelledby="{id}-title" onclose={onClose}>
  <header>
    <h2 id="{id}-title">{title}</h2>
    <button class="btn ghost" aria-label="Close" onclick={() => dialog.close()}><X size={16} /></button>
  </header>
  <input class="input" type="search" aria-label={search} placeholder={search} bind:value={query} />
  <div class="grid">
    {#each shown as item (item.id)}
      <button class:current={item.id === current} aria-label={item.name} title={item.description || item.name}
        onclick={() => { onPick(item.id); dialog.close() }}>
        {#if item.thumb}<img class:tile src={iconUrl(item.thumb)} alt="" loading="lazy" width="48" height="48" />{/if}
        <span class="name">{item.name}</span>
        {#if item.description}<span class="desc">{item.description}</span>{/if}
      </button>
    {:else}
      <p class="none">Nothing matches “{query}”.</p>
    {/each}
  </div>
</dialog>

<style>
  dialog { width: min(720px, calc(100vw - 32px)); max-height: min(80vh, 720px); padding: 0; border: 1px solid var(--border); border-radius: var(--radius-12);
    background: var(--surface-1); color: var(--text); display: flex; flex-direction: column; }
  dialog:not([open]) { display: none; }
  dialog::backdrop { background: rgb(0 0 0 / .55); }
  header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px 0; }
  h2 { margin: 0; font-size: 16px; font-weight: 600; }
  .input { margin: 12px 16px; width: auto; }
  .grid { overflow-y: auto; padding: 0 16px 16px; display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
  .grid button { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 6px; border-radius: var(--radius-10);
    border: 1px solid var(--border); background: var(--surface-2); text-align: center; transition: border-color 150ms; }
  .grid button:hover { border-color: var(--border-strong); }
  .grid button.current { border-color: var(--accent); }
  img { object-fit: contain; }
  .name { font-size: 13px; font-weight: 500; }
  .desc { font-size: 12px; color: var(--muted); line-height: 1.35; }
  .none { grid-column: 1 / -1; color: var(--muted); }
</style>
