<script lang="ts">
  import { Lock, Unlock as UnlockIcon, X } from '@lucide/svelte'
  import { entities, type Full } from '../data/api'
  import { cat, nameOf } from '../data/catalogs.svelte'
  import { describe } from '../data/details'
  import { t } from '../i18n/i18n.svelte'
  import { edits } from '../model/edits'
  import { push, session } from '../model/session.svelte'
  import { heldOf, saveIdOf, unlockOf } from '../model/unlocks'
  import { inventory, unlocked } from '../model/views'
  import NumberField from './NumberField.svelte'
  import Thumb from './Thumb.svelte'
  import { detail } from './detail.svelte'

  const id = $props.id()
  let dialog: HTMLDialogElement
  let e = $state.raw<Full | null>(null)
  const open = $derived(detail.open!)
  $effect(() => {
    const { kind, id } = open
    entities(kind).then(list => { e = list?.find(x => x.id === id) ?? null })
    dialog.showModal()
  })
  const info = $derived(e ? describe(open.kind, e, cat.lang) : null)
  const unlock = $derived(unlockOf(open.kind))
  const held = $derived(unlock && e && session.root && session.schema ? heldOf(unlock, e, unlocked(session.schema, session.root, unlock.field)) : undefined)
  const owned = $derived(held !== undefined)
  const item = $derived(open.kind === 'items' && session.root && session.schema ? inventory(session.schema, session.root).find(i => i.id === open.id) : undefined)

  function toggle() {
    if (!unlock || !e) return
    const name = info!.name
    push(() => held !== undefined
      ? edits.lock(session.schema!, session.root!, unlock.field, held, t('ch.locked', { name }))
      : edits.unlock(session.schema!, session.root!, unlock.field, [saveIdOf(unlock, e!)], t('ch.unlocked', { name })))
  }
  function quantity(v: number) {
    push(() => item ? edits.setQuantity(session.schema!, session.root!, item.index, v, nameOf('items', open.id))
      : edits.addItem(session.schema!, session.root!, open.id, v, nameOf('items', open.id)))
  }
</script>

<dialog bind:this={dialog} aria-labelledby="{id}-t" onclose={() => (detail.open = null)}>
  <button class="btn ghost close" aria-label={t('common.close')} onclick={() => dialog.close()}><X size={16} /></button>
  <div class="head">
    <Thumb src={(e?.icon as string | null) ?? e?.thumb} kind={open.kind} size={88} tile={open.kind === 'traits'} />
    <div>
      <h2 id="{id}-t">{info?.name ?? open.id}</h2>
      {#if unlock && session.slot}<span class="state" class:owned>{owned ? t('common.owned') : t('common.locked')}</span>{/if}
    </div>
  </div>
  {#if info?.description}<p class="desc">{info.description}</p>{/if}
  {#if info?.facts.length}
    <dl>{#each info.facts as [k, v] (k + v)}<div>{#if k}<dt>{k}</dt>{/if}<dd>{v}</dd></div>{/each}</dl>
  {/if}
  {#if info?.levels.length}
    <h3>{t('info.levels')}</h3>
    <ol class="levels">{#each info.levels as l, i (i)}<li>{l}</li>{/each}</ol>
  {/if}
  {#if info?.lore}<p class="lore">{info.lore}</p>{/if}
  {#if session.slot && !session.readOnly}
    <div class="actions">
      {#if unlock}
        <button class="btn" class:primary={!owned} onclick={toggle}>
          {#if owned}<Lock size={14} />{t('info.lock')}{:else}<UnlockIcon size={14} />{t('info.unlock')}{/if}
        </button>
      {:else if open.kind === 'items'}
        <NumberField label={t('info.quantity')} value={item?.quantity ?? 0} min={0} max={2147483647} step={10} onCommit={quantity} />
      {/if}
    </div>
  {/if}
</dialog>

<style>
  dialog { width: min(520px, calc(100vw - 32px)); max-height: min(85vh, 760px); padding: 24px; border: 1px solid var(--border);
    border-radius: var(--radius-12); background: var(--surface-1); color: var(--text); overflow-y: auto; }
  dialog::backdrop { background: rgb(0 0 0 / .55); }
  .close { position: absolute; inset-inline-end: 12px; top: 12px; }
  .head { display: flex; align-items: center; gap: 16px; margin-bottom: 12px; padding-inline-end: 40px; }
  .head :global(img), .head :global(.ph) { border-radius: var(--radius-12); background: var(--surface-3); padding: 4px; }
  h2 { margin: 0 0 6px; font-size: 20px; font-weight: 600; line-height: 1.25; }
  h3 { margin: 16px 0 6px; font-size: 13px; font-weight: 600; color: var(--muted); }
  .state { font-size: 12px; padding: 2px 8px; border-radius: var(--radius-6); background: var(--surface-3); color: var(--muted); }
  .state.owned { background: var(--chip-faithful-bg); color: var(--chip-faithful); }
  .desc { margin: 0; line-height: 1.55; }
  dl { margin: 14px 0 0; display: grid; gap: 6px; }
  dl div { display: flex; gap: 8px; font-size: 14px; }
  dt { color: var(--muted); min-width: 110px; }
  dd { margin: 0; }
  .levels { margin: 0; padding-inline-start: 20px; display: flex; flex-direction: column; gap: 6px; font-size: 14px; color: var(--muted); }
  .lore { margin: 16px 0 0; font-style: italic; color: var(--muted); font-size: 14px; line-height: 1.55; }
  .actions { margin-top: 20px; display: flex; gap: 8px; }
  .actions :global(.field) { flex: 1; }
</style>
