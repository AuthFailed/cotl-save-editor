<script lang="ts">
  import { route } from './route.svelte'
  import Tabs from './Tabs.svelte'
  import UnlockGrid from './UnlockGrid.svelte'
</script>

<section>
  <h1>Collection</h1>
  {#key route.tab}<Tabs initial={route.tab} tabs={['Tarot', 'Relics', 'Weapons', 'Curses', 'Fleeces', 'Outfits', 'Forms']}>
    {#snippet panel(t)}
      {#if t === 'Tarot'}<UnlockGrid kind="tarot" field="PlayerFoundTrinkets" enumName="TarotCards.Card" groupBy={e => String((e.groups as string[])?.[0] ?? '')} />
      {:else if t === 'Relics'}<UnlockGrid kind="relics" field="PlayerFoundRelics" enumName="RelicType" />
      {:else if t === 'Weapons'}<UnlockGrid kind="weapons" field="WeaponPool" enumName="EquipmentType" groupBy={e => String(e.family ?? '')} />
      {:else if t === 'Curses'}<UnlockGrid kind="curses" field="CursePool" enumName="EquipmentType" groupBy={e => String(e.family ?? '')} />
      {:else if t === 'Fleeces'}<UnlockGrid kind="fleeces" field="UnlockedFleeces" enumName={null} saveId={e => String(e.fleece)} />
      {:else if t === 'Outfits'}<UnlockGrid kind="outfits" field="UnlockedClothing" enumName="FollowerClothingType" groupBy={e => String(e.tab ?? '')} />
      {:else}<UnlockGrid kind="skins" field="FollowerSkinsUnlocked" enumName={null} groupBy={e => String(e.unlock ?? '')} />{/if}
    {/snippet}
  </Tabs>{/key}
</section>

<style>
  h1 { margin: 0 0 12px; font-size: 22px; font-weight: 600; }
</style>
