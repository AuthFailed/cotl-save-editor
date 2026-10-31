<script lang="ts">
  import { saveSchemaFor } from './data/api'
  import { cat, initLanguage } from './data/catalogs.svelte'
  import { session, type SchemaFor } from './model/session.svelte'
  import Collection from './ui/Collection.svelte'
  import CommandPalette from './ui/CommandPalette.svelte'
  import Raw from './ui/Raw.svelte'
  import { Search } from '@lucide/svelte'
  import Cult from './ui/Cult.svelte'
  import FollowerInspector from './ui/FollowerInspector.svelte'
  import Followers from './ui/Followers.svelte'
  import Inventory from './ui/Inventory.svelte'
  import Open from './ui/Open.svelte'
  import Overview from './ui/Overview.svelte'
  import Shell from './ui/Shell.svelte'
  import { go, route } from './ui/route.svelte'
  import { selection } from './ui/selection.svelte'

  const schemaFor: SchemaFor = saveSchemaFor
  initLanguage()
  const n = $derived(session.changes.length)
  let palette = $state(false)
  let rawFilter = $state('')
  function keys(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && session.slot) { e.preventDefault(); palette = true }
  }
  // A page that needs a save sends you to Open when none is.
  $effect(() => { if (!session.slot && route.page !== 'open') go('open') })
</script>

<Shell opened={!!session.slot} inspector={route.page === 'followers' && selection.follower ? follower : undefined}>
  {#snippet status()}
    {#if session.slot}
      <span class="sep" aria-hidden="true">/</span>
      <span class="mono file">{session.slot.name}</span>
      {#if session.meta}<span class="tag">{session.schema?.gameVersion}</span>{/if}
    {/if}
  {/snippet}
  {#snippet actions()}
    {#if session.slot}
      <button class="btn" onclick={() => (palette = true)}><Search size={14} aria-hidden="true" />Search <kbd>⌘K</kbd></button>
      <button class="btn">{#if n}<span class="dot" aria-hidden="true"></span>{/if}{n} change{n === 1 ? '' : 's'}</button>
    {/if}
  {/snippet}
  {#if session.error}<p class="toast" role="alert">{session.error}</p>{/if}
  {#if cat.offline && session.slot}<p class="note" role="status">Game names and pictures are unavailable offline; ids are shown instead.</p>{/if}
  {#if route.page === 'open'}<Open {schemaFor} />
  {:else if session.slot}
    {#if route.page === 'overview'}<Overview />
    {:else if route.page === 'followers'}<Followers />
    {:else if route.page === 'inventory'}<Inventory />
    {:else if route.page === 'cult'}<Cult />
    {:else if route.page === 'collection'}<Collection />
    {:else if route.page === 'raw'}<Raw filter={rawFilter} />{/if}
  {/if}
</Shell>

<svelte:window onkeydown={keys} />
{#if palette}<CommandPalette onClose={() => (palette = false)} onRaw={f => { rawFilter = f; go('raw') }} />{/if}

{#snippet follower()}<FollowerInspector />{/snippet}

<style>
  .sep { color: var(--border-strong); }
  .file { font-size: 13px; color: var(--muted); }
  .tag { font-size: 12px; padding: 2px 8px; border-radius: var(--radius-6); background: var(--surface-2); border: 1px solid var(--border); color: var(--muted); }
  kbd { font-family: var(--mono); font-size: 11px; color: var(--faint); }
  .dot { width: 8px; height: 8px; border-radius: 4px; background: var(--warn); }
  .toast, .note { margin: 0 0 16px; padding: 10px 12px; border-radius: var(--radius-8); font-size: 14px; }
  .toast { background: var(--warn-bg); border: 1px solid var(--warn-border); color: var(--warn); }
  .note { background: var(--surface-2); border: 1px solid var(--border); color: var(--muted); }
</style>
