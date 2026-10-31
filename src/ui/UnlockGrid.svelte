<script lang="ts">
  import { Check, Info, Lock, Search } from '@lucide/svelte'
  import { entities, plain, type Full } from '../data/api'
  import { cat, want } from '../data/catalogs.svelte'
  import { t } from '../i18n/i18n.svelte'
  import { edits } from '../model/edits'
  import { push, session } from '../model/session.svelte'
  import { heldOf, saveIdOf, unlockTab } from '../model/unlocks'
  import { enumOf, unlocked } from '../model/views'
  import { detail } from './detail.svelte'
  import { groupName } from './groups'
  import { route } from './route.svelte'
  import Thumb from './Thumb.svelte'

  let { tab, label }: { tab: string; label: string } = $props()
  const u = $derived(unlockTab(tab))

  let list = $state.raw<Full[] | null>(null)
  let failed = $state(false)
  $effect(() => { entities(u.kind).then(l => { list = l; failed = !l }) })
  $effect(() => { if (u.kind === 'doctrines') want('sermons') })

  // a search from ⌘K arrives as ?q=
  let query = $state('')
  $effect(() => { query = route.q ?? '' })
  let show = $state<'all' | 'owned' | 'locked'>('all')
  const enumName = $derived(session.schema && enumOf(session.schema, u.field))
  const values = $derived(session.schema && enumName ? new Set(Object.values(session.schema.enums[enumName] ?? {})) : null)
  const items = $derived((list ?? []).filter(e => (u.include?.(e) ?? true) && (!values || values.has(saveIdOf(u, e)))))
  const have = $derived(session.root && session.schema ? unlocked(session.schema, session.root, u.field) : new Set<string>())
  const name = (e: Full) => plain(e.namePlain[cat.lang] ?? e.namePlain.en ?? e.id)
  const desc = (e: Full) => plain(e.descriptionPlain?.[cat.lang] ?? e.descriptionPlain?.en ?? '')
  const owns = (e: Full) => heldOf(u, e, have) !== undefined
  const shown = $derived(items.filter(e => {
    const owned = owns(e)
    return (show === 'all' || (show === 'owned') === owned) && `${name(e)} ${e.id}`.toLowerCase().includes(query.trim().toLowerCase())
  }))
  const locked = $derived(items.filter(e => !owns(e)))
  const groups = $derived.by(() => {
    const m = new Map<string, Full[]>()
    for (const e of shown) { const g = u.groupBy?.(e) ?? ''; m.set(g, [...(m.get(g) ?? []), e]) }
    return [...m]
  })

  function toggle(e: Full) {
    const held = heldOf(u, e, have)
    push(() => held !== undefined
      ? edits.lock(session.schema!, session.root!, u.field, held, t('ch.locked', { name: name(e) }))
      : edits.unlock(session.schema!, session.root!, u.field, [saveIdOf(u, e)], t('ch.unlocked', { name: name(e) })))
  }
  const unlockAll = () => push(() => edits.unlock(session.schema!, session.root!, u.field, locked.map(e => saveIdOf(u, e)),
    t('ch.unlockedMany', { n: locked.length, field: label })))
</script>

<div class="grid-wrap">
  <div class="bar">
    <span class="count">{t('grid.count', { a: items.length - locked.length, b: items.length })}</span>
    {#each ['all', 'owned', 'locked'] as const as s (s)}
      <button class="chip" class:on={show === s} aria-pressed={show === s} onclick={() => (show = s)}>{t(`common.${s}`)}</button>
    {/each}
    <span class="spacer"></span>
    <label class="search"><Search size={14} aria-hidden="true" /><span class="sr-only">{t('grid.searchLabel', { kind: label })}</span>
      <input type="search" placeholder={t('common.search')} bind:value={query} /></label>
    <button class="btn primary" disabled={!locked.length || session.readOnly} onclick={unlockAll}>{t('grid.unlockAll', { n: locked.length })}</button>
  </div>

  {#if failed}<p class="note">{t('grid.failed', { kind: label })}</p>{/if}

  {#each groups as [g, es] (g)}
    {#if g}<h3>{groupName(u.kind, g)}</h3>{/if}
    <div class="grid">
      {#each es as e (e.id)}
        {@const owned = owns(e)}
        {@const d = desc(e)}
        <div class="card" class:owned>
          <button class="main" aria-pressed={owned} disabled={session.readOnly} onclick={() => toggle(e)}>
            <Thumb src={e.thumb} kind={u.kind} size={56} dim={!owned} />
            <span class="name">{name(e)}</span>
            <span class="state">{#if owned}<Check size={12} aria-hidden="true" />{t('common.owned')}{:else}<Lock size={12} aria-hidden="true" />{t('common.locked')}{/if}</span>
          </button>
          <button class="info" aria-label={t('info.details', { name: name(e) })} onclick={() => (detail.open = { kind: u.kind, id: e.id })}><Info size={14} /></button>
          {#if d}<div class="tip" role="tooltip"><b>{name(e)}</b>{d}</div>{/if}
        </div>
      {/each}
    </div>
  {:else}
    {#if list}<p class="note">{t('common.nothing')}</p>{/if}
  {/each}
</div>

<style>
  .grid-wrap { display: flex; flex-direction: column; gap: 14px; }
  .bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .count { color: var(--muted); margin-inline-end: 8px; font-variant-numeric: tabular-nums; }
  .chip { height: 32px; padding: 0 12px; border-radius: var(--radius-8); border: 1px solid var(--border); background: transparent; }
  .chip.on { background: var(--text); color: var(--bg); border-color: var(--text); }
  .spacer { flex: 1; }
  .search { display: flex; align-items: center; gap: 6px; height: 36px; padding: 0 10px; border: 1px solid var(--border); border-radius: var(--radius-8); color: var(--faint); }
  .search input { border: 0; background: transparent; outline: none; width: 160px; }
  .search:focus-within { outline: 2px solid var(--accent-text); outline-offset: 2px; }
  h3 { margin: 6px 0 0; font-size: 13px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .6px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(124px, 1fr)); gap: 8px; }
  .card { position: relative; border-radius: var(--radius-10); border: 1px solid var(--border); background: var(--surface-1); transition: border-color 150ms, background-color 150ms; }
  .card:hover { border-color: var(--border-strong); }
  .card.owned { background: var(--surface-2); border-color: var(--border-strong); }
  .main { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 14px 8px 10px; border: 0; background: none; text-align: center; border-radius: inherit; }
  .name { font-size: 13px; font-weight: 500; line-height: 1.3; }
  .state { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--faint); }
  .card.owned .state { color: var(--chip-faithful); }
  .info { position: absolute; top: 4px; inset-inline-end: 4px; width: 28px; height: 28px; border: 0; border-radius: var(--radius-6); background: transparent;
    color: var(--faint); display: inline-flex; align-items: center; justify-content: center; }
  .info:hover { color: var(--text); background: var(--surface-3); }
  .tip { position: absolute; z-index: 15; bottom: calc(100% + 6px); left: 50%; translate: -50% 0; width: max(220px, 100%); max-width: 280px;
    padding: 10px 12px; border-radius: var(--radius-10); border: 1px solid var(--border); background: var(--surface-1); box-shadow: 0 8px 24px rgb(0 0 0 / .35);
    font-size: 13px; line-height: 1.45; color: var(--muted); pointer-events: none; opacity: 0; visibility: hidden; transition: opacity 120ms; }
  .tip b { display: block; color: var(--text); font-weight: 600; margin-bottom: 2px; }
  .card:has(.main:hover) .tip, .card:has(.main:focus-visible) .tip { opacity: 1; visibility: visible; transition-delay: 350ms; }
  @media (hover: none) { .tip { display: none; } .info { width: 36px; height: 36px; } }
  .note { margin: 0; color: var(--muted); }
</style>
