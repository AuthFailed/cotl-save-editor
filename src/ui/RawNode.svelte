<script lang="ts">
  import { ChevronRight } from '@lucide/svelte'
  import { toPlain, type MpNode } from '../codec/msgpack'
  import { edits } from '../model/edits'
  import { push, session } from '../model/session.svelte'
  import { enumName, enumValue } from '../model/views'
  import { nameAt, unfit, type FieldType } from '../schema/schema'
  import { t as tr } from '../i18n/i18n.svelte'
  import RawNode from './RawNode.svelte'

  let { name, path, node, type, depth = 0, locked = false }:
    { name: string; path: string[]; node: MpNode; type: FieldType | undefined; depth?: number; locked?: boolean } = $props()

  const unwrap = (t: FieldType | undefined): FieldType | undefined => (typeof t === 'object' && 'nullable' in t ? unwrap(t.nullable) : t)
  // What doesn't fit its declared type, and all under it, is shown as stored: by index, with its wire type.
  const stored = $derived(locked || unfit.has(node))
  const t = $derived(stored ? undefined : unwrap(type))
  const container = $derived(node.t === 'arr' || node.t === 'map')
  const enumOf = $derived(typeof t === 'object' && 'enum' in t ? t.enum : null)
  const kind = $derived.by((): 'int' | 'float' | 'str' | 'bool' | 'enum' | null => {
    if (enumOf) return 'enum'
    if (node.t === 'int' || node.t === 'float' || node.t === 'str' || node.t === 'bool') return node.t
    if (node.t !== 'nil' || typeof t !== 'string') return null
    return t === 'string' ? 'str' : t === 'bool' ? 'bool' : /float/.test(t) ? 'float' : /int/.test(t) ? 'int' : null
  })
  const typeText = $derived(typeof t === 'string' ? t : t ? Object.entries(t).map(([k, v]) => `${k}<${typeof v === 'string' ? v : '…'}>`).join('') : node.t)
  const plain = $derived(node.t === 'nil' ? null : toPlain(node))

  let open = $state(false)
  let text = $state('')
  let error = $state<string | null>(null)
  $effect(() => { text = plain == null ? '' : String(plain) })

  const children = $derived.by((): { name: string; path: string[]; node: MpNode; type: FieldType | undefined }[] => {
    if (!open) return []
    if (node.t === 'arr' && typeof t === 'object' && 'object' in t)
      return node.v.map((n, i) => ({ name: nameAt(session.schema!, t.object, i), path: [...path, nameAt(session.schema!, t.object, i)], node: n,
        type: session.schema!.types[t.object]?.fields.find(f => f.key === i)?.type }))
    if (node.t === 'arr') return node.v.map((n, i) => ({ name: String(i), path: [...path, String(i)], node: n, type: typeof t === 'object' && 'list' in t ? t.list : undefined }))
    if (node.t === 'map') return node.v.map(([k, n]) => ({ name: String(toPlain(k)), path: [...path, String(toPlain(k))], node: n, type: typeof t === 'object' && 'map' in t ? t.map[1] : undefined }))
    return []
  })
  const editable = $derived(!stored && !path.some(p => p.startsWith('#')))

  function commit(raw: string) {
    let v: unknown = raw
    if (kind === 'int' || kind === 'float') {
      const n = Number(raw.trim())
      if (raw.trim() === '' || !Number.isFinite(n)) return (error = tr('num.number'))
      if (kind === 'int' && !Number.isInteger(n)) return (error = tr('num.whole'))
      v = n
    }
    error = null
    if (v !== plain) push(() => edits.setPath(session.schema!, session.root!, path, v))
  }
</script>

<li role="treeitem" aria-label={name} aria-expanded={container ? open : undefined} aria-selected="false" style:--depth={depth}>
  <div class="row">
    {#if container}
      <button class="tw" aria-label={tr(open ? 'raw.collapse' : 'raw.expand', { name })} onclick={() => (open = !open)}><ChevronRight size={14} class={open ? 'down' : ''} /></button>
    {:else}<span class="tw"></span>{/if}
    <span class="name mono" class:unknown={name.startsWith('#')}>{name}</span>
    <span class="type mono">{typeText}</span>
    <span class="value">
      {#if container}
        <span class="dim">{tr(node.t === 'map' ? 'raw.entries' : 'raw.items', { n: node.t === 'arr' || node.t === 'map' ? node.v.length : 0 })}</span>
      {:else if kind === 'bool' && editable}
        <input type="checkbox" aria-label={name} checked={plain === true} disabled={session.readOnly}
          onchange={e => push(() => edits.setPath(session.schema!, session.root!, path, e.currentTarget.checked))} />
      {:else if kind === 'enum' && enumOf && editable}
        <select aria-label={name} disabled={session.readOnly} value={plain == null ? '' : enumName(session.schema!, enumOf, plain)}
          onchange={e => push(() => edits.setPath(session.schema!, session.root!, path, enumValue(session.schema!, enumOf!, e.currentTarget.value)))}>
          {#if plain == null}<option value="">null</option>{/if}
          {#each Object.values(session.schema!.enums[enumOf] ?? {}) as n (n)}<option>{n}</option>{/each}
        </select>
      {:else if kind && editable}
        <input class="mono" aria-label={name} bind:value={text} placeholder="null" disabled={session.readOnly} aria-invalid={!!error}
          onkeydown={e => { if (e.key === 'Enter') commit(text) }} onblur={() => { if (text !== (plain == null ? '' : String(plain))) commit(text) }} />
        {#if error}<span class="error">{error}</span>{/if}
      {:else}
        <span class="dim mono">{plain === null ? 'null' : node.t === 'bin' ? tr('raw.bytes', { n: (node as { v: Uint8Array }).v.length }) : JSON.stringify(plain)}</span>
      {/if}
    </span>
  </div>
  {#if unfit.has(node) && !locked}<p class="note">{tr('raw.unfit')}</p>{/if}
  {#if open}
    <ul role="group">
      {#each children as c (c.path.join('.'))}<RawNode {...c} depth={depth + 1} locked={stored} />{/each}
    </ul>
  {/if}
</li>

<style>
  li { list-style: none; content-visibility: auto; contain-intrinsic-size: auto 36px; }
  ul { margin: 0; padding: 0; }
  .row { display: grid; grid-template-columns: 24px minmax(160px, 1.2fr) minmax(100px, .8fr) minmax(160px, 1.4fr); align-items: center; gap: 8px;
    min-height: 36px; padding: 2px 8px 2px calc(8px + var(--depth) * 18px); border-top: 1px solid var(--border); }
  .row:hover { background: var(--surface-1); }
  .tw { width: 24px; height: 24px; border: 0; background: none; color: var(--muted); display: inline-flex; align-items: center; justify-content: center; padding: 0; }
  .tw :global(.down) { transform: rotate(90deg); }
  .name { font-size: 13px; overflow-wrap: anywhere; }
  .name.unknown { color: var(--faint); }
  .type { font-size: 12px; color: var(--faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .value { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .value input:not([type]), .value input.mono, select { width: 100%; height: 30px; padding: 0 8px; border: 1px solid var(--border); border-radius: var(--radius-6); background: var(--bg); font-size: 13px; }
  .dim { color: var(--faint); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .note { margin: 0; padding: 0 8px 6px calc(40px + var(--depth) * 18px); color: var(--faint); font-size: 12px; }
  .error { color: var(--accent-text); font-size: 12px; white-space: nowrap; }
</style>
