<script lang="ts">
  import { Search } from '@lucide/svelte'
  import { entities, plain, type Full, type Kind } from '../data/api'
  import { cat, nameOf, want, wantVariants } from '../data/catalogs.svelte'
  import { t, type Key } from '../i18n/i18n.svelte'
  import { session } from '../model/session.svelte'
  import { UNLOCKS, saveIdOf } from '../model/unlocks'
  import { enumOf, followers, inventory, skinId, unlocked } from '../model/views'
  import { nameAt } from '../schema/schema'
  import { detail } from './detail.svelte'
  import { go, type Page } from './route.svelte'
  import { selection } from './selection.svelte'
  import Thumb from './Thumb.svelte'

  let { onClose, onRaw }: { onClose: () => void; onRaw: (field: string) => void } = $props()
  const id = $props.id()
  let dialog: HTMLDialogElement
  let query = $state('')
  let active = $state(0)
  $effect(() => { dialog.showModal() })

  // everything searchable, loaded once per palette (cached by the API client)
  want('skins')
  wantVariants()
  want('traits')
  let lists = $state.raw<Partial<Record<Kind, Full[]>>>({})
  for (const kind of ['items', 'traits', ...UNLOCKS.map(u => u.kind)] as Kind[])
    entities(kind).then(l => { if (l) lists = { ...lists, [kind]: l } })

  type Hit = { group: string; label: string; sub?: string; thumb?: string | null; kind: string; run: () => void }
  const nameIn = (e: Full) => plain(e.namePlain[cat.lang] ?? e.namePlain.en ?? e.id)
  const tab = (id: string) => t(`tab.${id}` as Key)

  const hits = $derived.by((): Hit[] => {
    const q = query.trim().toLowerCase()
    const s = session.schema, r = session.root
    const match = (...texts: (string | undefined)[]) => texts.some(x => x?.toLowerCase().includes(q))
    const rank = (a: Hit, b: Hit) => Number(!a.label.toLowerCase().startsWith(q)) - Number(!b.label.toLowerCase().startsWith(q))
    const out: Hit[] = []
    const add = (list: Hit[], max = 6) => out.push(...list.sort(rank).slice(0, max))
    const places: [string, Page, string?][] = [
      [t('nav.overview'), 'overview'], [t('nav.followers'), 'followers'], [t('nav.inventory'), 'inventory'], [t('nav.raw'), 'raw'],
      ...UNLOCKS.map(u => [`${t(`nav.${u.page}`)} › ${tab(u.tab)}`, u.page, u.tab] as [string, Page, string]),
    ]
    add(places.filter(([l]) => !q || match(l)).map(([label, page, tb]) => ({ group: t('cmd.screens'), label, kind: 'screen', run: () => go(page, tb) })), q ? 6 : 20)
    if (!q || !s || !r) return out

    const skins = new Set(lists.skins?.map(e => e.id) ?? [])
    add(followers(s, r).filter(f => match(f.name, f.skin, ...f.traits.map(x => nameOf('traits', x)))).map(f => {
      const form = skinId(f.skin, skins, cat.variants)
      return { group: t('cmd.followers'), label: f.name, sub: [form ? nameOf('skins', form) : f.skin, f.dead ? t('status.Dead') : ''].filter(Boolean).join(' · '),
        thumb: form ? lists.skins?.find(e => e.id === form)?.thumb : null, kind: 'skins',
        run: () => { go('followers'); selection.follower = f.id } }
    }), 8)

    const have = new Map(inventory(s, r).map(i => [i.id, i.quantity]))
    const known = new Set(Object.values(s.enums['InventoryItem.ITEM_TYPE'] ?? {}))
    add((lists.items ?? []).filter(e => known.has(e.id) && e.id !== 'NONE' && match(nameIn(e), e.id)).map(e => ({
      group: t('cmd.items'), label: nameIn(e), sub: `×${(have.get(e.id) ?? 0).toLocaleString(cat.lang)}`,
      thumb: e.thumb, kind: 'items', run: () => { go('inventory', undefined, nameIn(e)); detail.open = { kind: 'items', id: e.id } },
    })))

    for (const u of UNLOCKS) {
      const owned = unlocked(s, r, u.field)
      const enumName = enumOf(s, u.field)
      const values = enumName ? new Set(Object.values(s.enums[enumName] ?? {})) : null
      add((lists[u.kind] ?? []).filter(e => (u.include?.(e) ?? true) && (!values || values.has(saveIdOf(u, e))) && match(nameIn(e), e.id)).map(e => ({
        group: tab(u.tab), label: nameIn(e), sub: owned.has(saveIdOf(u, e)) ? t('common.owned') : t('common.locked'), thumb: e.thumb, kind: u.kind,
        run: () => { go(u.page, u.tab, nameIn(e)); detail.open = { kind: u.kind, id: e.id } },
      })), 4)
    }

    add((lists.traits ?? []).filter(e => match(nameIn(e), e.id)).map(e => ({
      group: t('cmd.traits'), label: nameIn(e), sub: t('cmd.followersWith', { name: nameIn(e) }), thumb: e.thumb, kind: 'traits',
      run: () => go('followers', undefined, nameIn(e)),
    })), 4)

    add((r.t === 'arr' ? r.v.map((_, k) => nameAt(s, s.roots.slot, k)) : []).filter(n => match(n)).map(n => ({
      group: t('cmd.fields'), label: n, kind: 'field', run: () => onRaw(n),
    })), 5)
    return out
  })
  $effect(() => { void query; active = 0 })

  function choose(h: Hit | undefined) {
    if (!h) return
    dialog.close()
    h.run()
  }
  function key(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') { active = Math.min(hits.length - 1, active + 1); e.preventDefault() }
    if (e.key === 'ArrowUp') { active = Math.max(0, active - 1); e.preventDefault() }
    if (e.key === 'Enter') { choose(hits[active]); e.preventDefault() }
  }
  $effect(() => { document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: 'nearest' }) })
</script>

<dialog bind:this={dialog} aria-label={t('top.search')} onclose={onClose}>
  <div class="field">
    <Search size={18} aria-hidden="true" />
    <input role="combobox" aria-expanded="true" aria-controls="{id}-list" aria-activedescendant={hits.length ? `${id}-${active}` : undefined}
      aria-label={t('cmd.placeholder')} placeholder={t('cmd.placeholder')} bind:value={query} onkeydown={key} />
  </div>
  <ul role="listbox" id="{id}-list" aria-label={t('cmd.results')}>
    {#each hits as h, i (h.group + h.label + i)}
      {#if i === 0 || hits[i - 1].group !== h.group}<li class="group" role="presentation">{h.group}</li>{/if}
      <li role="option" id="{id}-{i}" aria-selected={i === active} onclick={() => choose(h)} onkeydown={() => {}} onmousemove={() => (active = i)}>
        {#if h.kind !== 'screen' && h.kind !== 'field'}<Thumb src={h.thumb} kind={h.kind} size={28} tile={h.kind === 'traits'} />{/if}
        <span class="name">{h.label}</span>
        {#if h.sub}<span class="sub">{h.sub}</span>{/if}
      </li>
    {:else}
      <li class="none">{t('cmd.none')}</li>
    {/each}
  </ul>
  <p class="hint">{t('cmd.hint')}</p>
</dialog>

<style>
  dialog { width: min(640px, calc(100vw - 32px)); margin-top: 10vh; padding: 0; border: 1px solid var(--border); border-radius: var(--radius-12);
    background: var(--surface-1); color: var(--text); box-shadow: 0 24px 64px rgb(0 0 0 / .45); }
  dialog::backdrop { background: rgb(0 0 0 / .55); }
  .field { display: flex; align-items: center; gap: 10px; padding: 0 16px; border-bottom: 1px solid var(--border); color: var(--faint); }
  input { flex: 1; height: 56px; border: 0; background: transparent; outline: none; font-size: 17px; color: var(--text); }
  ul { list-style: none; margin: 0; padding: 6px; max-height: min(56vh, 520px); overflow-y: auto; }
  li { display: flex; align-items: center; gap: 10px; min-height: 40px; padding: 6px 10px; border-radius: var(--radius-8); cursor: pointer; }
  li[aria-selected='true'] { background: var(--surface-3); }
  .group { min-height: 0; padding: 10px 10px 4px; font-size: 12px; font-weight: 600; color: var(--faint); text-transform: uppercase; letter-spacing: .6px; cursor: default; }
  .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sub { font-size: 13px; color: var(--muted); white-space: nowrap; }
  .none { color: var(--muted); cursor: default; }
  .hint { margin: 0; padding: 8px 16px; border-top: 1px solid var(--border); font-size: 12px; color: var(--faint); }
</style>
