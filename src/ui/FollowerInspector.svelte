<script lang="ts">
  import { Copy, HeartPulse, Plus, Trash2, X } from '@lucide/svelte'
  import { iconUrl } from '../data/api'
  import { cat, entry, nameOf, want } from '../data/catalogs.svelte'
  import { edits } from '../model/edits'
  import { push, session } from '../model/session.svelte'
  import { followers, skinId } from '../model/views'
  import NumberField from './NumberField.svelte'
  import Picker from './Picker.svelte'
  import { selection } from './selection.svelte'

  want('skins')
  want('traits', true)
  const f = $derived(session.root && session.schema && selection.follower
    ? followers(session.schema, session.root).find(x => x.dead === selection.follower!.dead && x.index === selection.follower!.index) : undefined)
  const skins = $derived(new Set(cat.maps.skins?.keys() ?? []))
  const form = $derived(f ? skinId(f.skin, skins) : null)
  let picking = $state<'form' | 'trait' | null>(null)
  let nameText = $state('')
  $effect(() => { nameText = f?.name ?? '' })

  const who = () => ({ index: f!.index, dead: f!.dead })
  const set = (name: string, v: number, what: string) => push(() => edits.setFollower(session.schema!, session.root!, who(), name, v, what))
  const all = (kind: 'skins' | 'traits') => [...(cat.maps[kind]?.values() ?? [])].sort((a, b) => a.name.localeCompare(b.name))

  function rename() {
    const v = nameText.trim()
    if (v && v !== f!.name) push(() => edits.rename(session.schema!, session.root!, who(), v))
  }
  function remove() {
    if (!confirm(`Remove ${f!.name} from the cult? You can undo this until you export.`)) return
    push(() => edits.removeFollower(session.schema!, session.root!, who()))
    selection.follower = null
  }
  function revive() {
    const living = followers(session.schema!, session.root!).filter(x => !x.dead).length
    if (push(() => edits.revive(session.schema!, session.root!, f!.index))) selection.follower = { index: living, dead: false }
  }
</script>

{#if f}
  <div class="insp">
    <div class="top">
      <span class="label">Inspector</span>
      <button class="btn ghost" aria-label="Close" onclick={() => (selection.follower = null)}><X size={16} /></button>
    </div>
    <div class="hero">
      {#if form}<img src={iconUrl(`icons/skins/${form}.png`)} alt="{f.name}, {nameOf('skins', form)}" width="96" height="96" class:dead={f.dead} />{/if}
      <div>
        <div class="title">{f.name}</div>
        <div class="sub">ID {f.id} · {nameOf('skins', form ?? f.skin)}{f.dead ? ' · dead' : ''}</div>
        <button class="btn" disabled={session.readOnly} onclick={() => (picking = 'form')}>Change form</button>
      </div>
    </div>

    <label class="text">Name
      <input class="input" bind:value={nameText} disabled={session.readOnly} onkeydown={e => { if (e.key === 'Enter') rename() }} onblur={rename} />
    </label>

    <div class="grid">
      <NumberField label="Level" value={f.level} min={0} max={99} disabled={session.readOnly} onCommit={v => set('XPLevel', v, 'level')} />
      <NumberField label="Age (days)" value={f.age} min={0} max={9999} disabled={session.readOnly} onCommit={v => set('Age', v, 'age')} />
      <NumberField label="Life expectancy" value={f.lifeExpectancy} min={0} max={9999} disabled={session.readOnly} onCommit={v => set('LifeExpectancy', v, 'life expectancy')} />
      <NumberField label="Loyalty" value={f.loyalty} min={0} max={100} step={10} integer={false} disabled={session.readOnly} onCommit={v => set('Adoration', v, 'loyalty')} />
      <NumberField label="Hunger" value={f.needs.satiation} min={0} max={100} step={10} integer={false} disabled={session.readOnly} onCommit={v => set('_satiation', v, 'hunger')} />
      <NumberField label="Rest" value={f.needs.rest} min={0} max={100} step={10} integer={false} disabled={session.readOnly} onCommit={v => set('_rest', v, 'rest')} />
      <NumberField label="Illness" value={f.needs.illness} min={0} max={100} step={10} integer={false} disabled={session.readOnly} onCommit={v => set('_illness', v, 'illness')} />
      <NumberField label="Exhaustion" value={f.needs.exhaustion} min={0} max={100} step={10} integer={false} disabled={session.readOnly} onCommit={v => set('_exhaustion', v, 'exhaustion')} />
    </div>

    <div class="traits">
      <span class="label">Traits</span>
      {#each f.traits as t (t)}
        {@const e = entry('traits', t)}
        <div class="trait">
          {#if e?.thumb}<img class="tile" src={iconUrl(e.thumb)} alt="" width="32" height="32" />{/if}
          <span><b>{e?.name ?? t}</b>{#if e?.description}<small>{e.description}</small>{/if}</span>
          <button class="btn ghost" aria-label="Remove {e?.name ?? t}" disabled={session.readOnly}
            onclick={() => push(() => edits.removeTrait(session.schema!, session.root!, who(), t, e?.name))}><X size={14} /></button>
        </div>
      {:else}
        <p class="none">No traits.</p>
      {/each}
      <button class="btn add" disabled={session.readOnly} onclick={() => (picking = 'trait')}><Plus size={14} />Add trait</button>
    </div>

    <div class="actions">
      {#if f.dead}<button class="btn primary" disabled={session.readOnly} onclick={revive}><HeartPulse size={16} />Revive</button>{/if}
      <button class="btn" disabled={session.readOnly} onclick={() => push(() => edits.clone(session.schema!, session.root!, who()))}><Copy size={16} />Clone</button>
      <button class="btn danger" disabled={session.readOnly} onclick={remove}><Trash2 size={16} />Remove</button>
    </div>
  </div>

  {#if picking === 'form'}
    <Picker title="Choose a form" search="Search forms" items={all('skins')} current={form ?? undefined} onClose={() => (picking = null)}
      onPick={id => push(() => edits.setFollower(session.schema!, session.root!, who(), 'SkinName', id, 'form'))} />
  {:else if picking === 'trait'}
    <Picker tile title="Add a trait" search="Search traits" items={all('traits').filter(t => !f.traits.includes(t.id))} onClose={() => (picking = null)}
      onPick={id => push(() => edits.addTrait(session.schema!, session.root!, who(), id, nameOf('traits', id)))} />
  {/if}
{/if}

<style>
  .insp { display: flex; flex-direction: column; gap: 18px; }
  .top { display: flex; justify-content: space-between; align-items: center; }
  .hero { display: flex; gap: 14px; align-items: center; }
  .hero img { object-fit: contain; border-radius: var(--radius-12); background: var(--surface-3); }
  .hero img.dead { filter: grayscale(1) brightness(.6); }
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
  .trait img { object-fit: contain; }
  .none { margin: 0; color: var(--muted); font-size: 14px; }
  .add { border-style: dashed; justify-content: center; }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .actions .btn { flex: 1; justify-content: center; }
</style>
