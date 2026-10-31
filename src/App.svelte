<script lang="ts">
  import { saveSchemaFor } from './data/api'
  import { cat, initLanguage } from './data/catalogs.svelte'
  import { redo, session, undo, type SchemaFor } from './model/session.svelte'
  import Collection from './ui/Collection.svelte'
  import CommandPalette from './ui/CommandPalette.svelte'
  import Raw from './ui/Raw.svelte'
  import { Download, Search } from '@lucide/svelte'
  import { exportSlot } from './model/export'
  import Banner from './ui/Banner.svelte'
  import Prefs from './ui/Prefs.svelte'
  import Review from './ui/Review.svelte'
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
  initLanguage((() => { try { return localStorage.getItem('lang') } catch { return null } })())
  const n = $derived(session.changes.length)
  let palette = $state(false)
  let rawFilter = $state('')
  let reviewing = $state(false)
  let exported = $state<string[] | null>(null)
  function keys(e: KeyboardEvent) {
    const mod = e.metaKey || e.ctrlKey
    if (mod && e.key.toLowerCase() === 'k' && session.slot) { e.preventDefault(); palette = true }
    // inside a text field, ⌘Z belongs to the field
    const typing = e.target instanceof HTMLElement && e.target.closest('input, textarea, select')
    if (mod && e.key.toLowerCase() === 'z' && session.slot && !typing) { e.preventDefault(); if (e.shiftKey) redo(); else undo() }
  }

  async function exportNow() {
    if (session.slot?.beta && !confirm(`${session.slot.name} is in a format no real save has been tested with yet. Export anyway? Keep the backup.`)) return
    try {
      const { files } = await exportSlot()
      for (const f of files) {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(new Blob([f.bytes as Uint8Array<ArrayBuffer>]))
        a.download = f.name
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
      }
      exported = files.map(f => f.name)
    } catch (e) {
      session.error = e instanceof Error ? e.message : String(e)
    }
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
    <Prefs />
    {#if session.slot}
      <button class="btn" onclick={() => (palette = true)}><Search size={14} aria-hidden="true" />Search <kbd>⌘K</kbd></button>
      <button class="btn" onclick={() => (reviewing = true)}>{#if n}<span class="dot" aria-hidden="true"></span>{/if}{n} change{n === 1 ? '' : 's'}</button>
      <button class="btn primary" disabled={!n || session.readOnly} onclick={exportNow}><Download size={16} aria-hidden="true" />Export</button>
    {/if}
  {/snippet}
  {#if session.error}<p class="toast" role="alert">{session.error}</p>{/if}
  {#if session.slot && route.page !== 'open'}
    {#if session.readOnly}
      <Banner>This save doesn't write back exactly as it was read, so it's open read-only to keep it safe.
        <a href="https://github.com/AuthFailed/cotl-save-editor/issues" target="_blank" rel="noreferrer">Report it</a> and we'll look.</Banner>
    {/if}
    {#if !session.schemaExact}
      <Banner>Field names come from game version {session.schema?.gameVersion}; your save is from {session.saveVersion ?? 'an unknown version'}.
        Fields added since may show as #numbers in Raw data.</Banner>
    {/if}
    {#if session.slot.beta}<Banner>This save format is in beta: no real save of it has been tested yet. Keep the backup the export gives you.</Banner>{/if}
    {#if exported}
      <Banner tone="info">Downloaded {exported.join(' and ')}. With the game closed, put {exported[0]} into your saves folder in place of the old one.
        <button class="link" onclick={() => (exported = null)}>Dismiss</button></Banner>
    {/if}
  {/if}
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
{#if reviewing}<Review onClose={() => (reviewing = false)} onExport={exportNow} />{/if}
{#if palette}<CommandPalette onClose={() => (palette = false)} onRaw={f => { rawFilter = f; go('raw') }} />{/if}

{#snippet follower()}<FollowerInspector />{/snippet}

<style>
  .sep { color: var(--border-strong); }
  .file { font-size: 13px; color: var(--muted); }
  .tag { font-size: 12px; padding: 2px 8px; border-radius: var(--radius-6); background: var(--surface-2); border: 1px solid var(--border); color: var(--muted); }
  kbd { font-family: var(--mono); font-size: 11px; color: var(--muted); }
  .link { border: 0; background: none; padding: 0; color: inherit; text-decoration: underline; }
  .dot { width: 8px; height: 8px; border-radius: 4px; background: var(--warn); }
  .toast, .note { margin: 0 0 16px; padding: 10px 12px; border-radius: var(--radius-8); font-size: 14px; }
  .toast { background: var(--warn-bg); border: 1px solid var(--warn-border); color: var(--warn); }
  .note { background: var(--surface-2); border: 1px solid var(--border); color: var(--muted); }
</style>
