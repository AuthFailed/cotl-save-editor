<script lang="ts">
  import { saveSchemaFor } from './data/api'
  import { cat, initLanguage } from './data/catalogs.svelte'
  import { session, type SchemaFor } from './model/session.svelte'
  import FollowerInspector from './ui/FollowerInspector.svelte'
  import Followers from './ui/Followers.svelte'
  import Open from './ui/Open.svelte'
  import Overview from './ui/Overview.svelte'
  import Shell from './ui/Shell.svelte'
  import { go, route } from './ui/route.svelte'
  import { selection } from './ui/selection.svelte'

  const schemaFor: SchemaFor = saveSchemaFor
  initLanguage()
  const n = $derived(session.changes.length)
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
      <button class="btn">{#if n}<span class="dot" aria-hidden="true"></span>{/if}{n} change{n === 1 ? '' : 's'}</button>
    {/if}
  {/snippet}
  {#if session.error}<p class="toast" role="alert">{session.error}</p>{/if}
  {#if cat.offline && session.slot}<p class="note" role="status">Game names and pictures are unavailable offline; ids are shown instead.</p>{/if}
  {#if route.page === 'open'}<Open {schemaFor} />
  {:else if session.slot}
    {#if route.page === 'overview'}<Overview />
    {:else if route.page === 'followers'}<Followers />{/if}
  {/if}
</Shell>

{#snippet follower()}<FollowerInspector />{/snippet}

<style>
  .sep { color: var(--border-strong); }
  .file { font-size: 13px; color: var(--muted); }
  .tag { font-size: 12px; padding: 2px 8px; border-radius: var(--radius-6); background: var(--surface-2); border: 1px solid var(--border); color: var(--muted); }
  .dot { width: 8px; height: 8px; border-radius: 4px; background: var(--warn); }
  .toast, .note { margin: 0 0 16px; padding: 10px 12px; border-radius: var(--radius-8); font-size: 14px; }
  .toast { background: var(--warn-bg); border: 1px solid var(--warn-border); color: var(--warn); }
  .note { background: var(--surface-2); border: 1px solid var(--border); color: var(--muted); }
</style>
