<script lang="ts">
  import { Boxes, Braces, Church, FolderOpen, Gem, LayoutDashboard, Menu, Users, X } from '@lucide/svelte'
  import type { Snippet } from 'svelte'
  import { t, type Key } from '../i18n/i18n.svelte'
  import { route, type Page } from './route.svelte'

  let { status, actions, inspector, children, opened = false }: {
    status?: Snippet; actions?: Snippet; inspector?: Snippet; children: Snippet; opened?: boolean
  } = $props()

  const nav: { page: Page; label: Key; icon: typeof Users }[] = [
    { page: 'open', label: 'nav.open', icon: FolderOpen },
    { page: 'overview', label: 'nav.overview', icon: LayoutDashboard },
    { page: 'followers', label: 'nav.followers', icon: Users },
    { page: 'inventory', label: 'nav.inventory', icon: Boxes },
    { page: 'cult', label: 'nav.cult', icon: Church },
    { page: 'collection', label: 'nav.collection', icon: Gem },
    { page: 'raw', label: 'nav.raw', icon: Braces },
  ]
  let menu = $state(false)
  // the header wraps at phone width; the drawer and sticky inspector sit under its real height
  let headerH = $state(60)
</script>

<div class="app" style:--header-h="{headerH}px">
  <header bind:clientHeight={headerH}>
    <button class="btn ghost menu" aria-label={t('nav.menu')} aria-expanded={menu} onclick={() => (menu = !menu)}>
      {#if menu}<X size={18} />{:else}<Menu size={18} />{/if}
    </button>
    <a class="brand" href="#/open">
      <span class="logo" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 3 L21 20 L3 20 Z" /></svg>
      </span>
      cotl.save
    </a>
    {@render status?.()}
    <span class="spacer"></span>
    {@render actions?.()}
  </header>
  <div class="body">
    <nav aria-label={t('nav.sections')} class:open={menu}>
      {#each nav as item (item.page)}
        {@const Icon = item.icon}
        <a href="#/{item.page}" class:current={route.page === item.page} aria-current={route.page === item.page ? 'page' : undefined}
          aria-disabled={!opened && item.page !== 'open' ? 'true' : undefined} onclick={() => (menu = false)}>
          <Icon size={16} aria-hidden="true" />{t(item.label)}
        </a>
      {/each}
    </nav>
    <main>{@render children()}</main>
    {#if inspector}<aside aria-label={t('insp.title')}>{@render inspector()}</aside>{/if}
  </div>
</div>

<style>
  .app { min-height: 100vh; display: flex; flex-direction: column; }
  header { position: sticky; top: 0; z-index: 10; display: flex; flex-wrap: wrap; align-items: center; gap: 12px; min-height: 60px;
    padding: 8px 20px; border-bottom: 1px solid var(--border); background: var(--bg); }
  .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 16px; color: var(--text); text-decoration: none; }
  .logo { width: 26px; height: 26px; border-radius: 7px; background: var(--accent); color: var(--on-accent);
    display: inline-flex; align-items: center; justify-content: center; }
  .spacer { flex: 1; }
  .menu { display: none; }
  .body { flex: 1; display: flex; min-height: 0; }
  nav { flex: 0 0 200px; padding: 16px 12px; border-right: 1px solid var(--border); display: flex; flex-direction: column; gap: 2px; }
  nav a { display: flex; align-items: center; gap: 10px; height: 36px; padding: 0 10px; border-radius: var(--radius-8);
    color: var(--muted); text-decoration: none; transition: background-color 150ms; }
  nav a:hover { background: var(--surface-2); }
  nav a.current { background: var(--surface-3); color: var(--text); font-weight: 500; }
  nav a[aria-disabled='true'] { color: var(--faint); }
  main { flex: 1; min-width: 0; padding: 20px 24px; }
  aside { flex: 0 0 340px; max-width: 360px; border-left: 1px solid var(--border); background: var(--surface-1); padding: 20px;
    position: sticky; top: var(--header-h); align-self: flex-start; max-height: calc(100vh - var(--header-h)); overflow-y: auto; }
  @media (max-width: 767px) {
    header { padding: 8px 12px; }
    .menu { display: inline-flex; }
    nav { display: none; position: fixed; inset: var(--header-h) 0 auto 0; z-index: 9; max-height: calc(100vh - var(--header-h)); overflow-y: auto; background: var(--bg); border-bottom: 1px solid var(--border); border-right: 0; }
    nav.open { display: flex; }
    nav a { height: 44px; }
    main { padding: 16px; }
    aside { position: fixed; inset: auto 0 0 0; max-width: none; max-height: 75vh; border-left: 0; border-top: 1px solid var(--border);
      border-radius: var(--radius-12) var(--radius-12) 0 0; z-index: 20; top: auto; }
  }
</style>
