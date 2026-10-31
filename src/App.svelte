<script lang="ts">
  import Open from './ui/Open.svelte'
  import Shell from './ui/Shell.svelte'
  import { route } from './ui/route.svelte'
</script>

<Shell>
  {#if route.page === 'open'}<Open />{/if}
</Shell>
