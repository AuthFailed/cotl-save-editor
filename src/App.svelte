<script lang="ts">
  import { saveSchemaFor } from './data/api'
  import { cat, initLanguage } from './data/catalogs.svelte'
  import { changedOnDisk, failure, redo, session, undo, unexported, type SchemaFor, type SlotEntry } from './model/session.svelte'
  import Collection from './ui/Collection.svelte'
  import CommandPalette from './ui/CommandPalette.svelte'
  import Raw from './ui/Raw.svelte'
  import { Download, Search } from '@lucide/svelte'
  import { readOnlyReport } from './model/report'
  import { exportSlot } from './model/export'
  import Banner from './ui/Banner.svelte'
  import Prefs from './ui/Prefs.svelte'
  import SlotSwitcher from './ui/SlotSwitcher.svelte'
  import DetailDialog from './ui/DetailDialog.svelte'
  import { detail } from './ui/detail.svelte'
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
  import { RTL, t } from './i18n/i18n.svelte'
  import { compare } from './schema/schema'

  const schemaFor: SchemaFor = saveSchemaFor
  initLanguage((() => { try { return localStorage.getItem('lang') } catch { return null } })())
  const n = $derived(session.changes.length)
  // Kept edits of another folder's slots still ask before leaving, but the tab counts only what the switcher shows.
  const pending = $derived(unexported(true))
  const title = document.title
  let palette = $state(false)
  const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
  let rawFilter = $state('')
  let reviewing = $state(false)
  let exported = $state<string[] | null>(null)
  // The slot whose file changed on disk after it was opened, until the player exports anyway or chooses the folder again.
  let stale = $state.raw<SlotEntry | null>(null)
  function keys(e: KeyboardEvent) {
    const mod = e.metaKey || e.ctrlKey
    if (mod && e.key.toLowerCase() === 'k' && session.slot) { e.preventDefault(); palette = true }
    // inside a text field, ⌘Z belongs to the field
    const typing = e.target instanceof HTMLElement && e.target.closest('input, textarea, select')
    if (mod && e.key.toLowerCase() === 'z' && session.slot && !typing) { e.preventDefault(); if (e.shiftKey) redo(); else undo() }
  }

  async function exportNow(anyway = false) {
    if (!anyway) {
      if (session.slot?.beta && !confirm(t('export.betaConfirm', { file: session.slot.name }))) return
      if (await changedOnDisk(session.entry!)) { stale = session.entry; return }
    }
    stale = null
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
      session.error = failure(e, session.slot?.name ?? '')
    }
  }
  // The page's language and direction follow the picker (screen readers, fonts, Arabic right to left).
  $effect(() => { document.documentElement.lang = cat.lang; document.documentElement.dir = RTL.has(cat.lang) ? 'rtl' : 'ltr' })
  $effect(() => { document.title = pending ? `• ${t('slot.pending', { n: pending })} · ${title}` : title })
  // A page that needs a save sends you to Open when none is.
  $effect(() => { if (!session.slot && route.page !== 'open') go('open') })
</script>

<Shell opened={!!session.slot} inspector={route.page === 'followers' && selection.follower ? follower : undefined}>
  {#snippet status()}
    {#if session.slot}
      <span class="sep" aria-hidden="true">/</span>
      <SlotSwitcher {schemaFor} />
      {#if session.meta}<span class="tag">{session.schema?.gameVersion}</span>{/if}
    {/if}
  {/snippet}
  {#snippet actions()}
    <Prefs />
    {#if session.slot}
      <button class="searchbox" aria-label={t('top.search')} onclick={() => (palette = true)}>
        <Search size={16} aria-hidden="true" /><span class="hint">{t('top.searchHint')}</span><kbd>{mac ? '⌘K' : 'Ctrl K'}</kbd>
      </button>
      <button class="btn" onclick={() => (reviewing = true)}>{#if n}<span class="dot" aria-hidden="true"></span>{/if}{t('top.changes', { n })}</button>
      <button class="btn primary" disabled={!n || session.readOnly} onclick={() => exportNow()}><Download size={16} aria-hidden="true" />{t('top.export')}</button>
    {/if}
  {/snippet}
  {#if session.error}<p class="toast" role="alert">{session.error}</p>{/if}
  {#if session.slot && route.page !== 'open'}
    {#if session.readOnly}
      <Banner>{session.misfit
        ? t('banner.misfit', { schema: session.schema?.gameVersion ?? '', fields: session.misfit.slice(0, 3).join(', ') })
        : t('banner.readOnly')}
        <a href={readOnlyReport(session.slot.format, session.saveVersion)} target="_blank" rel="noreferrer">{t('banner.report')}</a> {t('banner.reportTail')}</Banner>
    {/if}
    {#if !session.schemaExact}
      <Banner>{session.saveVersion && session.schema && compare(session.saveVersion, session.schema.gameVersion) < 0
        ? t('banner.schemaOlder', { schema: session.schema.gameVersion, save: session.saveVersion })
        : t('banner.schema', { schema: session.schema?.gameVersion ?? '', save: session.saveVersion ?? t('banner.unknownVersion') })}</Banner>
    {/if}
    {#if session.slot.beta}<Banner>{t('banner.beta')}</Banner>{/if}
    {#if stale === session.entry}
      <Banner>{t('export.changed', { file: session.slot.name })}
        <button class="link" onclick={() => exportNow(true)}>{t('export.anyway')}</button>
        <button class="link" onclick={() => { stale = null; go('open') }}>{t('export.reopen')}</button></Banner>
    {/if}
    {#if exported}
      <Banner tone="info">{t('banner.exported', { files: exported.join(t('banner.and')), file: exported[0] })}
        <button class="link" onclick={() => (exported = null)}>{t('banner.dismiss')}</button></Banner>
    {/if}
  {/if}
  {#if cat.offline && session.slot}<p class="note" role="status">{t('note.offline')}</p>{/if}
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

<svelte:window onkeydown={keys} onbeforeunload={e => { if (unexported()) e.preventDefault() }} />
{#if detail.open}<DetailDialog />{/if}
{#if reviewing}<Review onClose={() => (reviewing = false)} onExport={exportNow} />{/if}
{#if palette}<CommandPalette onClose={() => (palette = false)} onRaw={f => { rawFilter = f; go('raw') }} />{/if}

{#snippet follower()}<FollowerInspector />{/snippet}

<style>
  .sep { color: var(--border-strong); }
  @media (max-width: 767px) { .tag { display: none; } }
  .tag { font-size: 12px; padding: 2px 8px; border-radius: var(--radius-6); background: var(--surface-2); border: 1px solid var(--border); color: var(--muted); }
  .searchbox { display: inline-flex; align-items: center; gap: 8px; height: 36px; width: clamp(180px, 22vw, 300px); padding: 0 6px 0 12px;
    border: 1px solid var(--border); border-radius: var(--radius-8); background: var(--surface-1); color: var(--faint); text-align: start; transition: border-color 150ms; }
  .searchbox:hover { border-color: var(--border-strong); }
  .searchbox .hint { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
  kbd { font-family: var(--mono); font-size: 11px; color: var(--muted); padding: 2px 6px; border: 1px solid var(--border); border-radius: var(--radius-6); background: var(--surface-2); }
  @media (max-width: 767px) { .searchbox { width: 44px; height: 44px; justify-content: center; padding: 0; } .searchbox .hint, .searchbox kbd { display: none; } }
  .link { border: 0; background: none; padding: 0; color: inherit; text-decoration: underline; }
  .dot { width: 8px; height: 8px; border-radius: 4px; background: var(--warn); }
  .toast, .note { margin: 0 0 16px; padding: 10px 12px; border-radius: var(--radius-8); font-size: 14px; }
  .toast { background: var(--warn-bg); border: 1px solid var(--warn-border); color: var(--warn); }
  .note { background: var(--surface-2); border: 1px solid var(--border); color: var(--muted); }
</style>
