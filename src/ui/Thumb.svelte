<script lang="ts">
  import { Box, Gem, House, Package, Sparkles, UserRound } from '@lucide/svelte'
  import { iconUrl } from '../data/api'

  // A game picture, or a figure for its kind when the game has none (bosses, cult leaders, a few items).
  let { src, kind, size = 48, tile = false, dim = false, alt = '' }: {
    src: string | null | undefined; kind: string; size?: number; tile?: boolean; dim?: boolean; alt?: string
  } = $props()
  const ICONS: Record<string, typeof Box> = { skins: UserRound, items: Package, structures: House, traits: Sparkles }
  const Icon = $derived(ICONS[kind] ?? Gem)
  let broken = $state(false)
</script>

{#if src && !broken}
  <img class:tile class:dim src={iconUrl(src)} {alt} width={size} height={size} loading="lazy" onerror={() => (broken = true)} />
{:else}
  <span class="ph" class:dim style:width="{size}px" style:height="{size}px" role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : 'true'}>
    <Icon size={Math.round(size * 0.5)} strokeWidth={1.5} />
  </span>
{/if}

<style>
  img { object-fit: contain; flex: none; transition: opacity 150ms, filter 150ms; }
  .ph { flex: none; display: inline-flex; align-items: center; justify-content: center; border-radius: var(--radius-8);
    background: var(--surface-3); color: var(--faint); }
  .dim { opacity: .45; filter: grayscale(.8); }
</style>
