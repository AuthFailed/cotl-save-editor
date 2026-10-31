<script lang="ts">
  import { route } from './route.svelte'
  import Tabs from './Tabs.svelte'
  import UnlockGrid from './UnlockGrid.svelte'
</script>

<section>
  <h1>Cult</h1>
  {#key route.tab}<Tabs initial={route.tab} tabs={['Doctrines', 'Rituals', 'Structures', 'Crown abilities']}>
    {#snippet panel(t)}
      {#if t === 'Doctrines'}<UnlockGrid kind="doctrines" field="DoctrineUnlockedUpgrades" enumName="DoctrineUpgradeSystem.DoctrineType" groupBy={e => String(e.category ?? '')} />
      {:else if t === 'Rituals'}<UnlockGrid kind="rituals" field="UnlockedUpgrades" enumName="UpgradeSystem.Type" groupBy={e => String(e.group ?? '')} />
      {:else if t === 'Structures'}<UnlockGrid kind="structures" field="UnlockedStructures" enumName="StructureBrain.TYPES" include={e => e.buildable === true}
        groupBy={e => String(e.menu ?? '').split('/')[0]} />
      {:else}<UnlockGrid kind="crownAbilities" field="UnlockedUpgrades" enumName="UpgradeSystem.Type" />{/if}
    {/snippet}
  </Tabs>{/key}
</section>

<style>
  h1 { margin: 0 0 12px; font-size: 22px; font-weight: 600; }
</style>
