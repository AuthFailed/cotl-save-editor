<script lang="ts">
  import { saveSchemaFor } from './data/api'
  import { session, type SchemaFor } from './model/session.svelte'
  import Open from './ui/Open.svelte'
  import Shell from './ui/Shell.svelte'
  import { route } from './ui/route.svelte'

  const schemaFor: SchemaFor = saveSchemaFor
</script>

<Shell opened={!!session.slot}>
  {#snippet status()}
    {#if session.slot}
      <span class="sep" aria-hidden="true">/</span>
      <span class="mono file">{session.slot.name}</span>
    {/if}
  {/snippet}
  {#if route.page === 'open'}<Open {schemaFor} />{/if}
</Shell>

<style>
  .sep { color: var(--border-strong); }
  .file { font-size: 13px; color: var(--muted); }
</style>
