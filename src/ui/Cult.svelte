<script lang="ts">
  import { t } from '../i18n/i18n.svelte'
  import { route } from './route.svelte'
  import Tabs from './Tabs.svelte'
  import UnlockGrid from './UnlockGrid.svelte'
</script>

<section>
  <h1>{t('nav.cult')}</h1>
  {#key route.tab}<Tabs initial={route.tab} tabs={['doctrines', 'rituals', 'structures', 'crown']} label={id => t(`tab.${id}` as 'tab.tarot')}>
    {#snippet panel(id)}
      {@const label = t(`tab.${id}` as 'tab.tarot')}
      {#if id === 'doctrines'}<UnlockGrid {label} kind="doctrines" field="DoctrineUnlockedUpgrades" enumName="DoctrineUpgradeSystem.DoctrineType" groupBy={e => String(e.category ?? '')} />
      {:else if id === 'rituals'}<UnlockGrid {label} kind="rituals" field="UnlockedUpgrades" enumName="UpgradeSystem.Type" groupBy={e => String(e.group ?? '')} />
      {:else if id === 'structures'}<UnlockGrid {label} kind="structures" field="UnlockedStructures" enumName="StructureBrain.TYPES" include={e => e.buildable === true}
        groupBy={e => String(e.menu ?? '').split('/')[0]} />
      {:else}<UnlockGrid {label} kind="crownAbilities" field="UnlockedUpgrades" enumName="UpgradeSystem.Type" />{/if}
    {/snippet}
  </Tabs>{/key}
</section>

<style>
  h1 { margin: 0 0 12px; font-size: 22px; font-weight: 600; }
</style>
