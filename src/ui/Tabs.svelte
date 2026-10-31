<script lang="ts">
  import type { Snippet } from 'svelte'
  let { tabs, panel }: { tabs: string[]; panel: Snippet<[string]> } = $props()
  const id = $props.id()
  // svelte-ignore state_referenced_locally
  let current = $state(tabs[0]) // the first tab, once
  function key(e: KeyboardEvent, i: number) {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!d) return
    current = tabs[(i + d + tabs.length) % tabs.length]
    ;(e.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLElement>('[role=tab]')[tabs.indexOf(current)]?.focus()
  }
</script>

<div class="tabs" role="tablist">
  {#each tabs as t, i (t)}
    <button role="tab" id="{id}-{i}" aria-selected={current === t} aria-controls="{id}-panel" tabindex={current === t ? 0 : -1}
      onclick={() => (current = t)} onkeydown={e => key(e, i)}>{t}</button>
  {/each}
</div>
<div role="tabpanel" id="{id}-panel" aria-labelledby="{id}-{tabs.indexOf(current)}">
  {#key current}{@render panel(current)}{/key}
</div>

<style>
  .tabs { display: flex; gap: 4px; overflow-x: auto; border-bottom: 1px solid var(--border); margin-bottom: 16px; }
  button { height: 40px; padding: 0 12px; border: 0; background: none; color: var(--muted); white-space: nowrap; box-shadow: inset 0 -2px 0 transparent; }
  button[aria-selected='true'] { color: var(--text); font-weight: 500; box-shadow: inset 0 -2px 0 var(--accent); }
  button:hover { color: var(--text); }
</style>
