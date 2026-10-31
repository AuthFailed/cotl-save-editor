<script lang="ts">
  import { ChevronDown, FolderOpen } from '@lucide/svelte'
  import { t } from '../i18n/i18n.svelte'
  import { failure, keyOf, openSlot, pendingFor, session, type SchemaFor, type SlotEntry } from '../model/session.svelte'
  import { go } from './route.svelte'

  let { schemaFor }: { schemaFor: SchemaFor } = $props()
  let open = $state(false)
  const current = (s: SlotEntry) => !!session.entry && keyOf(s) === keyOf(session.entry)
  async function pick(s: SlotEntry) {
    open = false
    if (current(s)) return
    try {
      await openSlot(s, schemaFor)
    } catch (e) {
      session.error = failure(e, s.slotFile.name) // the open slot stays as it was
    }
  }
</script>

<div class="switcher">
  <button class="btn ghost now" aria-haspopup="menu" aria-expanded={open} aria-label={t('slot.switch')} onclick={() => (open = !open)}>
    <span class="mono">{session.slot?.name}</span>
    {#if session.entry?.cultName}<span class="cult">{session.entry.cultName}</span>{/if}
    <ChevronDown size={14} aria-hidden="true" />
  </button>
  {#if open}
    <div class="menu" role="menu">
      {#each session.slots as s (s.slotFile.name)}
        <button role="menuitemradio" aria-checked={current(s)} onclick={() => pick(s)}>
          <span class="name">{s.cultName ?? t('open.unnamed')}</span>
          <span class="meta"><span class="mono">{s.slotFile.name}</span>{#if s.day != null} · {t('open.day', { n: s.day })}{/if}</span>
          {#if pendingFor(s)}<span class="pending">{t('slot.pending', { n: pendingFor(s) })}</span>{/if}
        </button>
      {/each}
      <button role="menuitem" class="other" onclick={() => { open = false; go('open') }}><FolderOpen size={14} aria-hidden="true" />{t('slot.other')}</button>
    </div>
  {/if}
</div>

<style>
  .switcher { position: relative; }
  .now { gap: 8px; max-width: 320px; }
  .now .mono { font-size: 13px; color: var(--muted); }
  @media (max-width: 767px) { .cult { display: none; } }
  .cult { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
  .menu { position: absolute; inset-inline-start: 0; top: 42px; z-index: 30; min-width: 280px; padding: 4px; border: 1px solid var(--border);
    border-radius: var(--radius-10); background: var(--surface-1); box-shadow: 0 8px 24px rgb(0 0 0 / .3); display: flex; flex-direction: column; }
  .menu button { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 2px 12px; padding: 8px 10px; border: 0; border-radius: var(--radius-6);
    background: none; text-align: start; }
  .menu button:hover, .menu button[aria-checked='true'] { background: var(--surface-3); }
  .name { font-weight: 500; }
  .meta { grid-column: 1; font-size: 12px; color: var(--faint); }
  .meta .mono { font-size: 12px; }
  .pending { grid-row: 1 / span 2; grid-column: 2; font-size: 12px; padding: 2px 8px; border-radius: var(--radius-6); color: var(--warn); background: var(--warn-bg); border: 1px solid var(--warn-border); }
  .other { display: flex !important; gap: 8px; color: var(--muted); border-top: 1px solid var(--border) !important; border-radius: 0 0 var(--radius-6) var(--radius-6) !important; margin-top: 4px; }
</style>
