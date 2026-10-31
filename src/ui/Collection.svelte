<script lang="ts">
  import { t } from '../i18n/i18n.svelte'
  import { route } from './route.svelte'
  import Tabs from './Tabs.svelte'
  import UnlockGrid from './UnlockGrid.svelte'
</script>

<section>
  <h1>{t('nav.collection')}</h1>
  {#key route.tab}<Tabs initial={route.tab} tabs={['tarot', 'relics', 'weapons', 'curses', 'fleeces', 'outfits', 'forms']} label={id => t(`tab.${id}` as 'tab.tarot')}>
    {#snippet panel(id)}
      {@const label = t(`tab.${id}` as 'tab.tarot')}
      {#if id === 'tarot'}<UnlockGrid {label} kind="tarot" field="PlayerFoundTrinkets" enumName="TarotCards.Card" groupBy={e => String((e.groups as string[])?.[0] ?? '')} />
      {:else if id === 'relics'}<UnlockGrid {label} kind="relics" field="PlayerFoundRelics" enumName="RelicType" />
      {:else if id === 'weapons'}<UnlockGrid {label} kind="weapons" field="WeaponPool" enumName="EquipmentType" groupBy={e => String(e.family ?? '')} />
      {:else if id === 'curses'}<UnlockGrid {label} kind="curses" field="CursePool" enumName="EquipmentType" groupBy={e => String(e.family ?? '')} />
      {:else if id === 'fleeces'}<UnlockGrid {label} kind="fleeces" field="UnlockedFleeces" enumName={null} saveId={e => String(e.fleece)} />
      {:else if id === 'outfits'}<UnlockGrid {label} kind="outfits" field="UnlockedClothing" enumName="FollowerClothingType" groupBy={e => String(e.tab ?? '')} />
      {:else}<UnlockGrid {label} kind="skins" field="FollowerSkinsUnlocked" enumName={null} groupBy={e => String(e.unlock ?? '')} />{/if}
    {/snippet}
  </Tabs>{/key}
</section>

<style>
  h1 { margin: 0 0 12px; font-size: 22px; font-weight: 600; }
</style>
