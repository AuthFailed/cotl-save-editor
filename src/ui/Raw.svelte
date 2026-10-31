<script lang="ts">
  import { Search } from '@lucide/svelte'
  import { session } from '../model/session.svelte'
  import { nameAt } from '../schema/schema'
  import RawNode from './RawNode.svelte'

  let { filter = '' }: { filter?: string } = $props()
  let query = $state('')
  $effect(() => { query = filter })
  const s = $derived(session.schema!)
  const fields = $derived(session.root?.t === 'arr' ? session.root.v.map((node, i) => ({ name: nameAt(s, s.roots.slot, i), node,
    type: s.types[s.roots.slot]?.fields.find(f => f.key === i)?.type })) : [])
  const shown = $derived(fields.filter(f => f.name.toLowerCase().includes(query.trim().toLowerCase())))
</script>

<section>
  <div class="bar">
    <h1>Raw data</h1>
    <span class="count">{fields.length} fields · names from game version {s.gameVersion}</span>
    <span class="spacer"></span>
    <label class="search"><Search size={14} aria-hidden="true" />
      <input type="search" placeholder="Filter by name" aria-label="Filter fields" bind:value={query} /></label>
  </div>
  <p class="hint">Every value in the save. Changes here join the same list as everywhere else and can be undone.</p>
  <div class="tree-box">
    <div class="head" aria-hidden="true"><span></span><span>Field</span><span>Type</span><span>Value</span></div>
    <ul role="tree" aria-label="Save fields">
      {#each shown as f (f.name)}<RawNode name={f.name} path={[f.name]} node={f.node} type={f.type} />{/each}
    </ul>
  </div>
</section>

<style>
  section { display: flex; flex-direction: column; gap: 12px; }
  .bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  h1 { margin: 0 8px 0 0; font-size: 22px; font-weight: 600; }
  .count { color: var(--muted); font-size: 14px; }
  .spacer { flex: 1; }
  .hint { margin: 0; color: var(--muted); font-size: 14px; }
  .search { display: flex; align-items: center; gap: 6px; height: 36px; padding: 0 10px; border: 1px solid var(--border); border-radius: var(--radius-8); color: var(--faint); }
  .search input { border: 0; background: transparent; outline: none; width: 200px; }
  .search:focus-within { outline: 2px solid var(--accent-text); outline-offset: 2px; }
  .tree-box { border: 1px solid var(--border); border-radius: var(--radius-10); overflow-x: auto; }
  .head { display: grid; grid-template-columns: 24px minmax(160px, 1.2fr) minmax(100px, .8fr) minmax(160px, 1.4fr); gap: 8px; padding: 8px;
    font-size: 12px; color: var(--faint); text-transform: uppercase; letter-spacing: .6px; min-width: 560px; }
  ul { margin: 0; padding: 0; min-width: 560px; }
</style>
