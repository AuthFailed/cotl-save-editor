<script lang="ts">
  import { t, type Key } from '../i18n/i18n.svelte'
  import { UNLOCKS } from '../model/unlocks'
  import { route } from './route.svelte'
  import Tabs from './Tabs.svelte'
  import UnlockGrid from './UnlockGrid.svelte'

  const tabs = UNLOCKS.filter(u => u.page === 'cult').map(u => u.tab)
  const label = (id: string) => t(`tab.${id}` as Key)
</script>

<section>
  <h1>{t('nav.cult')}</h1>
  {#key route.tab}<Tabs initial={route.tab} {tabs} {label}>
    {#snippet panel(id)}<UnlockGrid tab={id} label={label(id)} />{/snippet}
  </Tabs>{/key}
</section>

<style>
  h1 { margin: 0 0 12px; font-size: 22px; font-weight: 600; }
</style>
