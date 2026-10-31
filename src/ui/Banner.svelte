<script lang="ts">
  import type { Snippet } from 'svelte'
  let { tone = 'warn', children }: { tone?: 'warn' | 'info'; children: Snippet } = $props()
</script>

<div class="banner {tone}" role="status">{@render children()}</div>

<style>
  .banner { margin: 0 0 16px; padding: 10px 12px; border-radius: var(--radius-8); font-size: 14px; line-height: 1.5; }
  .warn { background: var(--warn-bg); border: 1px solid var(--warn-border); color: var(--warn); }
  .info { background: var(--surface-2); border: 1px solid var(--border); color: var(--muted); }
</style>
