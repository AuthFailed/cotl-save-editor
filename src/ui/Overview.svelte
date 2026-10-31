<script lang="ts">
  import { edits } from '../model/edits'
  import { push, session } from '../model/session.svelte'
  import { followers, inventory, value } from '../model/views'
  import { field } from '../schema/schema'
  import NumberField from './NumberField.svelte'

  const s = $derived(session.schema!)
  const root = $derived(session.root!)
  const meta = (name: string) => {
    const m = session.meta
    if (!m) return null
    if (m.data.kind === 'json') return (m.data.root as Record<string, unknown>)[name] ?? null
    const f = field(s, s.roots.meta, name)
    const n = f && m.data.root.t === 'arr' ? m.data.root.v[f.key] : undefined
    return n && 'v' in n ? n.v : null
  }
  const all = $derived(followers(s, root))
  const gold = $derived(inventory(s, root).find(i => i.id === 'BLACK_GOLD'))
  let cult = $state('')
  $effect(() => { cult = String(value(s, root, 'CultName') ?? '') })
  const rename = () => { if (cult.trim() && cult !== value(s, root, 'CultName')) push(() => edits.setRoot(s, root, 'CultName', cult.trim(), 'Cult name')) }
  const day = $derived(meta('Day') ?? value(s, root, 'CurrentDayIndex'))
  const play = $derived(Number(meta('PlayTime') ?? 0))
</script>

<section>
  <h1>Overview</h1>
  <div class="cards">
    <label class="card wide">
      <span class="k">Cult name</span>
      <input class="input name" bind:value={cult} disabled={session.readOnly} onkeydown={e => { if (e.key === 'Enter') rename() }} onblur={rename} aria-label="Cult name" />
    </label>
    <div class="card"><span class="k">Day</span><span class="big num">Day {day ?? '—'}</span></div>
    <div class="card"><span class="k">Play time</span><span class="big num">{Math.floor(play / 3600)}h {Math.floor((play % 3600) / 60)}m</span></div>
    <div class="card"><span class="k">Followers</span><span class="big num">{all.filter(f => !f.dead).length}</span><span class="sub">{all.filter(f => f.dead).length} dead</span></div>
    <div class="card">
      <NumberField label="Gold" value={gold?.quantity ?? 0} min={0} max={2147483647} step={100} disabled={session.readOnly}
        onCommit={v => push(() => (gold ? edits.setQuantity(s, root, gold.index, v, 'Gold') : edits.addItem(s, root, 'BLACK_GOLD', v, 'Gold')))} />
    </div>
    <div class="card">
      <NumberField label="Cult faith" value={Number(value(s, root, 'CultFaith') ?? 0)} min={0} max={100} step={5} integer={false} disabled={session.readOnly}
        onCommit={v => push(() => edits.setRoot(s, root, 'CultFaith', v, 'Cult faith'))} />
    </div>
    <div class="card"><span class="k">Game version</span><span class="big num">{meta('Version') ?? 'unknown'}</span><span class="sub">field names: {s.gameVersion}</span></div>
  </div>
</section>

<style>
  section { display: flex; flex-direction: column; gap: 16px; max-width: 960px; }
  h1 { margin: 0; font-size: 22px; font-weight: 600; }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
  .card { display: flex; flex-direction: column; gap: 6px; padding: 16px; border: 1px solid var(--border); border-radius: var(--radius-12); background: var(--surface-1); }
  .wide { grid-column: 1 / -1; }
  .name { font-size: 20px; height: 44px; font-weight: 600; }
  .k { font-size: 13px; color: var(--muted); }
  .big { font-size: 24px; font-weight: 600; letter-spacing: -0.3px; }
  .sub { font-size: 13px; color: var(--faint); }
</style>
