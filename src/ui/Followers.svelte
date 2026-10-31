<script lang="ts">
  import { Search } from '@lucide/svelte'
  import { cat, entry, nameOf, want } from '../data/catalogs.svelte'
  import { iconUrl } from '../data/api'
  import { edits } from '../model/edits'
  import { push, session } from '../model/session.svelte'
  import { followers, skinId, type FollowerView, type Status } from '../model/views'
  import StatusChip from './StatusChip.svelte'
  import { selection } from './selection.svelte'

  want('skins')
  want('traits')
  const all = $derived(session.root && session.schema ? followers(session.schema, session.root) : [])
  const FILTERS: ('All' | Status)[] = ['All', 'Hungry', 'Ill', 'Elderly', 'Dead']
  let filter = $state<'All' | Status>('All')
  let query = $state('')
  let checked = $state<string[]>([])
  const key = (f: FollowerView) => `${f.dead}:${f.index}`
  const count = (s: 'All' | Status) => (s === 'All' ? all.length : all.filter(f => f.status === s).length)
  const shown = $derived(all.filter(f => (filter === 'All' || f.status === filter) &&
    `${f.name} ${f.skin} ${f.traits.map(t => nameOf('traits', t)).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase())))
  const skins = $derived(new Set(cat.maps.skins?.keys() ?? []))
  const portrait = (f: FollowerView) => { const id = skinId(f.skin, skins); return id ? iconUrl(entry('skins', id)?.thumb ?? null) : null }
  const isSelected = (f: FollowerView) => selection.follower?.index === f.index && selection.follower?.dead === f.dead
  const picked = $derived(all.filter(f => checked.includes(key(f))))

  function bulk(values: Record<string, number>, label: string) {
    for (const f of picked) push(() => edits.setFollowerFields(session.schema!, session.root!, f, values, label))
  }
  const toggle = (f: FollowerView, on: boolean) => (checked = on ? [...checked, key(f)] : checked.filter(k => k !== key(f)))
</script>

<section>
  <div class="bar">
    <h1>Followers</h1>
    {#each FILTERS as s (s)}
      <button class="chip" class:on={filter === s} aria-pressed={filter === s} onclick={() => (filter = s)}>{s} <span>{count(s)}</span></button>
    {/each}
    <span class="spacer"></span>
    <label class="search"><Search size={14} aria-hidden="true" /><span class="sr-only">Search followers</span>
      <input type="search" placeholder="Name, form or trait" bind:value={query} /></label>
  </div>

  {#if picked.length}
    <div class="bulk" role="region" aria-label="Selected followers">
      <span>{picked.length} selected</span>
      <button class="btn" disabled={session.readOnly} onclick={() => bulk({ _satiation: 100, _starvation: 0, _rest: 100, _illness: 0, _exhaustion: 0 }, 'needs maxed')}>Max needs</button>
      <button class="btn" disabled={session.readOnly} onclick={() => bulk({ Adoration: 100 }, 'loyalty maxed')}>Max loyalty</button>
      <button class="btn ghost" onclick={() => (checked = [])}>Clear</button>
    </div>
  {/if}

  <div class="scroll">
    <table>
      <thead>
        <tr><th class="check"><span class="sr-only">Select</span></th><th>Follower</th><th>Status</th><th>Lv</th><th>Loyalty</th><th>Hunger</th><th>Traits</th></tr>
      </thead>
      <tbody>
        {#each shown as f (key(f))}
          {@const src = portrait(f)}
          <tr class:selected={isSelected(f)}>
            <td class="check"><input type="checkbox" aria-label="Select {f.name}" checked={checked.includes(key(f))} onchange={e => toggle(f, e.currentTarget.checked)} /></td>
            <td>
              <span class="who">
                {#if src}<img src={src} alt="" width="40" height="40" class:dead={f.dead} />{:else}<span class="ph" aria-hidden="true"></span>{/if}
                <span class="names">
                  <button class="name" onclick={() => (selection.follower = { index: f.index, dead: f.dead })}>{f.name}</button>
                  <span class="sub">{nameOf('skins', skinId(f.skin, skins) ?? f.skin)} · {f.age} days</span>
                </span>
              </span>
            </td>
            <td><StatusChip status={f.status} /></td>
            <td class="mono">{f.level}</td>
            <td><span class="meter" role="img" aria-label="Loyalty {Math.round(f.loyalty)}%"><span style:width="{Math.min(100, Math.max(0, f.loyalty))}%"></span></span>
              <span class="mono num">{Math.round(f.loyalty)}%</span></td>
            <td class="mono num">{Math.round(f.needs.satiation)}%</td>
            <td><span class="traits">{#each f.traits as t (t)}{@const th = entry('traits', t)?.thumb}{#if th}<img class="tile" src={iconUrl(th)} alt={nameOf('traits', t)} title={nameOf('traits', t)} width="24" height="24" />{/if}{/each}</span></td>
          </tr>
        {:else}
          <tr><td colspan="7" class="empty">No followers match.</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>

<style>
  section { display: flex; flex-direction: column; gap: 16px; }
  .bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  h1 { margin: 0 12px 0 0; font-size: 22px; font-weight: 600; }
  .chip { height: 32px; padding: 0 12px; border-radius: var(--radius-8); border: 1px solid var(--border); background: transparent; }
  .chip span { color: var(--faint); }
  .chip.on { background: var(--text); color: var(--bg); border-color: var(--text); }
  .chip.on span { color: var(--bg); opacity: .7; }
  .spacer { flex: 1; }
  .search { display: flex; align-items: center; gap: 6px; height: 36px; padding: 0 10px; border: 1px solid var(--border); border-radius: var(--radius-8); color: var(--faint); }
  .search input { border: 0; background: transparent; outline: none; width: 200px; }
  .search:focus-within { outline: 2px solid var(--accent-text); outline-offset: 2px; }
  .bulk { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 8px 12px; border-radius: var(--radius-10); background: var(--surface-2); border: 1px solid var(--border); }
  .bulk span { margin-right: 8px; color: var(--muted); }
  .scroll { overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius-10); }
  table { width: 100%; border-collapse: collapse; min-width: 720px; }
  th { text-align: left; font-size: 12px; font-weight: 500; color: var(--faint); text-transform: uppercase; letter-spacing: .6px; padding: 10px 14px; }
  td { padding: 8px 14px; border-top: 1px solid var(--border); }
  tr.selected { background: var(--surface-2); box-shadow: inset 2px 0 0 var(--accent); }
  .check { width: 36px; padding-right: 0; }
  .who { display: flex; align-items: center; gap: 12px; }
  .who img { object-fit: contain; }
  .who img.dead { filter: grayscale(1) brightness(.6); }
  .ph { width: 40px; height: 40px; border-radius: var(--radius-8); background: var(--surface-3); }
  .names { display: flex; flex-direction: column; }
  .name { padding: 0; border: 0; background: none; font-weight: 600; text-align: left; }
  .name:hover { text-decoration: underline; }
  .sub { font-size: 13px; color: var(--faint); }
  .meter { display: inline-block; width: 72px; height: 4px; border-radius: 2px; background: var(--border); overflow: hidden; vertical-align: middle; margin-right: 8px; }
  .meter span { display: block; height: 100%; background: var(--accent); }
  .num { font-size: 13px; color: var(--muted); }
  .traits { display: flex; gap: 4px; }
  .traits img { object-fit: contain; }
  .empty { color: var(--muted); text-align: center; padding: 24px; }
</style>
