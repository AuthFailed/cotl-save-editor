<script lang="ts">
  import { untrack } from 'svelte'
  import { Copy, HeartPulse, Info, Plus, Trash2, X } from '@lucide/svelte'
  import { detail } from './detail.svelte'
  import Thumb from './Thumb.svelte'
  import { cat, entry, nameOf, want, wantVariants } from '../data/catalogs.svelte'
  import { edits } from '../model/edits'
  import { push, session } from '../model/session.svelte'
  import { followers, skinId } from '../model/views'
  import NumberField from './NumberField.svelte'
  import Picker from './Picker.svelte'
  import { t, type Key } from '../i18n/i18n.svelte'
  import { key, revived, selection } from './selection.svelte'

  want('skins')
  wantVariants()
  want('traits', true)
  const f = $derived(session.root && session.schema ? followers(session.schema, session.root).find(x => key(x) === selection.follower) : undefined)
  const skins = $derived(new Set(cat.maps.skins?.keys() ?? []))
  const form = $derived(f ? skinId(f.skin, skins, cat.variants) : null)
  let picking = $state<'form' | 'trait' | null>(null)
  let nameText = $state('')
  $effect(() => { nameText = f?.name ?? '' })
  // Set afresh for each follower, and when they die or come back; edits to the same follower leave the player's choice alone.
  const dead = $derived(!!f?.dead)
  let young = $state(false)
  $effect(() => { void selection.follower; void dead; young = untrack(() => !!f?.dead && (f.old || f.death === 'DiedOfOldAge')) })

  const who = () => ({ index: f!.index, dead: f!.dead })
  const set = (name: string, v: number, what: string) => push(() => edits.setFollower(session.schema!, session.root!, who(), name, v, what))
  const all = (kind: 'skins' | 'traits') => [...(cat.maps[kind]?.values() ?? [])].sort((a, b) => a.name.localeCompare(b.name))
  const forms = $derived(all('skins').filter(x => cat.forms.has(x.id)))

  function rename() {
    const v = nameText.trim()
    if (v && v !== f!.name) push(() => edits.rename(session.schema!, session.root!, who(), v))
  }
  function remove() {
    if (!confirm(t('insp.removeConfirm', { name: f!.name }))) return
    push(() => edits.removeFollower(session.schema!, session.root!, who()))
  }
  function revive() {
    const { id, index } = f!
    if (push(() => edits.revive(session.schema!, session.root!, index, young, session.schemaExact))) revived(id)
  }
</script>

{#if f}
  <div class="insp">
    <div class="top">
      <span class="label">{t('insp.title')}</span>
      <button class="btn ghost" aria-label={t('common.close')} onclick={() => (selection.follower = null)}><X size={16} /></button>
    </div>
    <div class="hero">
      <Thumb src={form ? `icons/skins/${form}.png` : null} kind="skins" size={96} dim={f.dead} alt="{f.name}, {form ? nameOf('skins', form) : f.skin}" />
      <div>
        <div class="title">{f.name}</div>
        <div class="sub">{t('insp.id', { id: f.id })} · {nameOf('skins', form ?? f.skin)}{f.dead ? ` · ${t(`death.${f.death ?? 'unknown'}` as Key)}` : ''}</div>
        <button class="btn" disabled={session.readOnly || !forms.length} title={forms.length ? undefined : t('note.offline')} onclick={() => (picking = 'form')}>{t('insp.changeForm')}</button>
      </div>
    </div>

    <label class="text">{t('insp.name')}
      <input class="input" bind:value={nameText} disabled={session.readOnly} onkeydown={e => { if (e.key === 'Enter') rename() }} onblur={rename} />
    </label>

    <div class="grid">
      <NumberField label={t('insp.level')} value={f.level} min={0} max={99} disabled={session.readOnly} onCommit={v => set('XPLevel', v, t('what.level'))} />
      <NumberField label={t('insp.age')} value={f.age} min={0} max={9999} disabled={session.readOnly} onCommit={v => set('Age', v, t('what.age'))} />
      <NumberField label={t('insp.life')} value={f.lifeExpectancy} min={0} max={9999} disabled={session.readOnly} onCommit={v => set('LifeExpectancy', v, t('what.life'))} />
      <NumberField label={t('insp.loyalty')} value={f.loyalty} min={0} max={100} step={10} integer={false} disabled={session.readOnly} onCommit={v => set('Adoration', v, t('what.loyalty'))} />
      <NumberField label={t('insp.hunger')} value={f.needs.satiation} min={0} max={100} step={10} integer={false} disabled={session.readOnly} onCommit={v => set('_satiation', v, t('what.hunger'))} />
      <NumberField label={t('insp.rest')} value={f.needs.rest} min={0} max={100} step={10} integer={false} disabled={session.readOnly} onCommit={v => set('_rest', v, t('what.rest'))} />
      <NumberField label={t('insp.illness')} value={f.needs.illness} min={0} max={100} step={10} integer={false} disabled={session.readOnly} onCommit={v => set('_illness', v, t('what.illness'))} />
      <NumberField label={t('insp.exhaustion')} value={f.needs.exhaustion} min={0} max={100} step={10} integer={false} disabled={session.readOnly} onCommit={v => set('_exhaustion', v, t('what.exhaustion'))} />
    </div>

    <div class="traits">
      <span class="label">{t('insp.traits')}</span>
      {#each f.traits as tr (tr)}
        {@const e = entry('traits', tr)}
        <div class="trait">
          <Thumb src={e?.thumb} kind="traits" size={32} tile />
          <span><b>{e?.name ?? tr}</b>{#if e?.description}<small>{e.description}</small>{/if}</span>
          <button class="btn ghost" aria-label={t('info.details', { name: e?.name ?? tr })} onclick={() => (detail.open = { kind: 'traits', id: tr })}><Info size={14} /></button>
          <button class="btn ghost" aria-label={t('insp.removeTrait', { name: e?.name ?? tr })} disabled={session.readOnly}
            onclick={() => push(() => edits.removeTrait(session.schema!, session.root!, who(), tr, e?.name))}><X size={14} /></button>
        </div>
      {:else}
        <p class="none">{t('insp.noTraits')}</p>
      {/each}
      <button class="btn add" disabled={session.readOnly} onclick={() => (picking = 'trait')}><Plus size={14} />{t('insp.addTrait')}</button>
    </div>

    <div class="actions">
      {#if f.dead}
        <label class="young"><input type="checkbox" bind:checked={young} disabled={session.readOnly} />{t('insp.young')}</label>
        <button class="btn primary" disabled={session.readOnly} onclick={revive}><HeartPulse size={16} />{t('insp.revive')}</button>
      {/if}
      <button class="btn" disabled={session.readOnly} onclick={() => push(() => edits.clone(session.schema!, session.root!, who()))}><Copy size={16} />{t('insp.clone')}</button>
      <button class="btn danger" disabled={session.readOnly} onclick={remove}><Trash2 size={16} />{t('insp.remove')}</button>
    </div>
  </div>

  {#if picking === 'form'}
    <Picker kind="skins" title={t('insp.chooseForm')} search={t('insp.searchForms')} items={forms} current={form ?? undefined} onClose={() => (picking = null)}
      onPick={id => push(() => edits.setForm(session.schema!, session.root!, who(), cat.forms.get(id)!, nameOf('skins', form ?? f.skin), nameOf('skins', id)))} />
  {:else if picking === 'trait'}
    <Picker tile kind="traits" title={t('insp.addTraitTitle')} search={t('insp.searchTraits')} items={all('traits').filter(x => !f.traits.includes(x.id))} onClose={() => (picking = null)}
      onPick={id => push(() => edits.addTrait(session.schema!, session.root!, who(), id, nameOf('traits', id)))} />
  {/if}
{/if}

<style>
  .insp { display: flex; flex-direction: column; gap: 18px; }
  .top { display: flex; justify-content: space-between; align-items: center; }
  .hero { display: flex; gap: 14px; align-items: center; }
  .hero :global(img), .hero :global(.ph) { border-radius: var(--radius-12); background: var(--surface-3); }
  .hero > div { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; }
  .title { font-size: 20px; font-weight: 600; }
  .sub { font-size: 13px; color: var(--faint); }
  .text { display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--faint); }
  .text .input { color: var(--text); font-size: 15px; }
  .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .traits { display: flex; flex-direction: column; gap: 8px; }
  .trait { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--radius-8); background: var(--surface-2); }
  .trait span { flex: 1; display: flex; flex-direction: column; font-size: 14px; }
  .trait small { color: var(--muted); font-size: 12px; }
  .none { margin: 0; color: var(--muted); font-size: 14px; }
  .add { border-style: dashed; justify-content: center; }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .actions .btn { flex: 1; justify-content: center; }
  .young { flex-basis: 100%; display: flex; align-items: center; gap: 8px; font-size: 14px; }
</style>
