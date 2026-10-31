<script lang="ts">
  import type { Status } from '../model/views'
  let { status }: { status: Status } = $props()
</script>

<span class="chip {status.toLowerCase()}">{status}</span>

<style>
  .chip { display: inline-block; font-size: 12px; font-weight: 500; padding: 2px 8px; border-radius: var(--radius-6); white-space: nowrap; }
  .faithful { background: var(--chip-faithful-bg); color: var(--chip-faithful); }
  .hungry { background: var(--chip-hungry-bg); color: var(--chip-hungry); }
  .ill { background: var(--chip-ill-bg); color: var(--chip-ill); }
  .dead { background: var(--chip-dead-bg); color: var(--chip-dead); }
  .elderly { background: var(--chip-elderly-bg); color: var(--chip-elderly); }
</style>
