<script lang="ts">
  import fallback from './model/fallback-schema.json'
  import { session, type SchemaFor } from './model/session.svelte'
  import type { SaveSchema } from './schema/schema'
  import Open from './ui/Open.svelte'
  import Shell from './ui/Shell.svelte'
  import { route } from './ui/route.svelte'

  // Until the API client (and cotl-api's published schemas) are wired in, the bundled 1.5.26 schema names every save.
  const schemaFor: SchemaFor = async version => ({ schema: fallback as SaveSchema, exact: version === (fallback as SaveSchema).gameVersion })
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
