<script lang="ts">
  import { Monitor, Moon, Sun } from '@lucide/svelte'
  import { cat, setLanguage } from '../data/catalogs.svelte'

  type Theme = 'system' | 'light' | 'dark'
  // Per-viewer conveniences only; storage may be unavailable (private windows), so every access is guarded.
  const load = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
  const save = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* not remembered, still applied */ } }

  let theme = $state<Theme>((load('theme') as Theme) ?? 'system')
  let open = $state(false)
  $effect(() => {
    if (theme === 'system') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = theme
  })
  const pick = (t: Theme) => { theme = t; save('theme', t); open = false }
  const label = (code: string) => { try { return new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code } catch { return code } }
  const THEMES: [Theme, string, typeof Sun][] = [['system', 'System', Monitor], ['light', 'Light', Sun], ['dark', 'Dark', Moon]]
  const Current = $derived(THEMES.find(t => t[0] === theme)![2])
</script>

<label class="lang"><span class="sr-only">Game language</span>
  <select aria-label="Game language" value={cat.lang} onchange={e => { setLanguage(e.currentTarget.value); save('lang', e.currentTarget.value) }}>
    {#each cat.langs as l (l)}<option value={l}>{label(l)}</option>{/each}
  </select>
</label>
<div class="theme">
  <button class="btn ghost" aria-label="Theme: {theme}" aria-haspopup="menu" aria-expanded={open} onclick={() => (open = !open)}><Current size={16} /></button>
  {#if open}
    <div class="menu" role="menu">
      {#each THEMES as [t, name, Icon] (t)}
        <button role="menuitemradio" aria-checked={theme === t} onclick={() => pick(t)}><Icon size={14} aria-hidden="true" />{name}</button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .lang select { height: 36px; padding: 0 8px; border-radius: var(--radius-8); border: 1px solid var(--border); background: var(--surface-2); max-width: 140px; }
  .theme { position: relative; }
  .menu { position: absolute; right: 0; top: 42px; z-index: 30; min-width: 140px; padding: 4px; border: 1px solid var(--border); border-radius: var(--radius-10);
    background: var(--surface-1); display: flex; flex-direction: column; box-shadow: 0 8px 24px rgb(0 0 0 / .3); }
  .menu button { display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 10px; border: 0; border-radius: var(--radius-6); background: none; text-align: left; }
  .menu button:hover, .menu button[aria-checked='true'] { background: var(--surface-3); }
</style>
