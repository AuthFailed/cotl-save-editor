<script lang="ts">
  import { Check, Lock, Search } from '@lucide/svelte'
  import { entities, iconUrl, type Kind } from '../data/api'
  import { cat, nameOf, want } from '../data/catalogs.svelte'
  import en from '../i18n/en'
  import { edits } from '../model/edits'
  import { push, session } from '../model/session.svelte'
  import { unlocked } from '../model/views'
  import { t, type Key } from '../i18n/i18n.svelte'

  type E = Awaited<ReturnType<typeof entities>> extends (infer T)[] | null ? T : never
  let { kind, label, field, enumName, saveId = e => e.id, include = () => true, groupBy, tile = false }: {
    kind: Kind; label: string; field: string; enumName: string | null
    saveId?: (e: E) => string; include?: (e: E) => boolean; groupBy?: (e: E) => string; tile?: boolean
  } = $props()

  let list = $state.raw<E[] | null>(null)
  let failed = $state(false)
  $effect(() => { entities(kind).then(l => { list = l; failed = !l }) })

  let query = $state('')
  let show = $state<'all' | 'owned' | 'locked'>('all')
  const values = $derived(session.schema && enumName ? new Set(Object.values(session.schema.enums[enumName] ?? {})) : null)
  const items = $derived((list ?? []).filter(e => include(e) && (!values || values.has(saveId(e)))))
  const have = $derived(session.root && session.schema ? unlocked(session.schema, session.root, field) : new Set<string>())
  const name = (e: E) => e.namePlain[cat.lang] ?? e.namePlain.en ?? e.id
  const desc = (e: E) => e.descriptionPlain?.[cat.lang] ?? e.descriptionPlain?.en ?? ''
  const shown = $derived(items.filter(e => {
    const owned = have.has(saveId(e))
    return (show === 'all' || (show === 'owned') === owned) && `${name(e)} ${e.id}`.toLowerCase().includes(query.trim().toLowerCase())
  }))
  // API group ids as translated headings: doctrine categories are sermons (named by the API), the rest group.* strings
  $effect(() => { if (kind === 'doctrines') want('sermons') })
  const ALIAS: Record<string, string> = { DLC: 'dlc', Major_DLC: 'majorDlc', MajorDLC: 'majorDlc', Other: 'other', SpecialEvents: 'specialEvents',
    Aesthetic: 'aesthetic', Faith: 'faith', Follower: 'follower', Special: 'special' }
  function heading(g: string) {
    if (kind === 'doctrines' && cat.maps.sermons?.has(g)) return nameOf('sermons', g)
    const dungeon = /^Dungeon(\d+)$/.exec(g)
    if (dungeon) return t('group.dungeon', { n: dungeon[1] })
    const key = `group.${ALIAS[g] ?? g}` as Key
    return key in en ? t(key) : g
  }
  const locked = $derived(items.filter(e => !have.has(saveId(e))))
  const groups = $derived.by(() => {
    const m = new Map<string, E[]>()
    for (const e of shown) { const g = groupBy?.(e) ?? ''; m.set(g, [...(m.get(g) ?? []), e]) }
    return [...m]
  })

  function toggle(e: E) {
    const id = saveId(e)
    push(() => have.has(id)
      ? edits.lock(session.schema!, session.root!, field, enumName, id, t('ch.locked', { name: name(e) }))
      : edits.unlock(session.schema!, session.root!, field, enumName, [id], t('ch.unlocked', { name: name(e) })))
  }
  const unlockAll = () => push(() => edits.unlock(session.schema!, session.root!, field, enumName, locked.map(saveId), t('ch.unlockedMany', { n: locked.length, field: label })))
</script>

<div class="grid-wrap">
  <div class="bar">
    <span class="count">{t('grid.count', { a: items.length - locked.length, b: items.length })}</span>
    {#each ['all', 'owned', 'locked'] as const as s (s)}
      <button class="chip" class:on={show === s} aria-pressed={show === s} onclick={() => (show = s)}>{t(`common.${s}` as Key)}</button>
    {/each}
    <span class="spacer"></span>
    <label class="search"><Search size={14} aria-hidden="true" /><span class="sr-only">{t('grid.searchLabel', { kind: label })}</span>
      <input type="search" placeholder={t('common.search')} bind:value={query} /></label>
    <button class="btn primary" disabled={!locked.length || session.readOnly} onclick={unlockAll}>{t('grid.unlockAll', { n: locked.length })}</button>
  </div>

  {#if failed}<p class="note">{t('grid.failed', { kind: label })}</p>{/if}

  {#each groups as [g, es] (g)}
    {#if g}<h3>{heading(g)}</h3>{/if}
    <div class="grid">
      {#each es as e (e.id)}
        {@const owned = have.has(saveId(e))}
        <button class="card" class:owned aria-pressed={owned} title={desc(e)} disabled={session.readOnly} onclick={() => toggle(e)}>
          {#if e.thumb}<img class:tile src={iconUrl(e.thumb)} alt="" loading="lazy" width="56" height="56" />{:else}<span class="ph"></span>{/if}
          <span class="name">{name(e)}</span>
          <span class="state">{#if owned}<Check size={12} aria-hidden="true" />{t('common.owned')}{:else}<Lock size={12} aria-hidden="true" />{t('common.locked')}{/if}</span>
        </button>
      {/each}
    </div>
  {:else}
    {#if list}<p class="note">{t('common.nothing')}</p>{/if}
  {/each}
</div>

<style>
  .grid-wrap { display: flex; flex-direction: column; gap: 14px; }
  .bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .count { color: var(--muted); margin-right: 8px; font-variant-numeric: tabular-nums; }
  .chip { height: 32px; padding: 0 12px; border-radius: var(--radius-8); border: 1px solid var(--border); background: transparent; }
  .chip.on { background: var(--text); color: var(--bg); border-color: var(--text); }
  .spacer { flex: 1; }
  .search { display: flex; align-items: center; gap: 6px; height: 36px; padding: 0 10px; border: 1px solid var(--border); border-radius: var(--radius-8); color: var(--faint); }
  .search input { border: 0; background: transparent; outline: none; width: 160px; }
  .search:focus-within { outline: 2px solid var(--accent-text); outline-offset: 2px; }
  h3 { margin: 6px 0 0; font-size: 13px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .6px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(124px, 1fr)); gap: 8px; }
  .card { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 8px 10px; border-radius: var(--radius-10);
    border: 1px solid var(--border); background: var(--surface-1); text-align: center; transition: border-color 150ms, background-color 150ms; }
  .card:hover { border-color: var(--border-strong); }
  .card img, .ph { width: 56px; height: 56px; object-fit: contain; opacity: .45; filter: grayscale(.8); transition: opacity 150ms, filter 150ms; }
  .ph { border-radius: var(--radius-8); background: var(--surface-3); }
  .card.owned { background: var(--surface-2); border-color: var(--border-strong); }
  .card.owned img { opacity: 1; filter: none; }
  .name { font-size: 13px; font-weight: 500; line-height: 1.3; }
  .state { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--faint); }
  .card.owned .state { color: var(--chip-faithful); }
  .note { margin: 0; color: var(--muted); }
</style>
