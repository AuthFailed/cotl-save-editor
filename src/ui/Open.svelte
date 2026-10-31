<script lang="ts">
  import { Check, Copy, FolderOpen, Upload } from '@lucide/svelte'
  import { hasUnexported, listSlots, openSlot, session, type SchemaFor, type SlotEntry } from '../model/session.svelte'
  import { go } from './route.svelte'

  let { schemaFor }: { schemaFor: SchemaFor } = $props()

  const PATHS = [
    { os: 'Windows', path: '%USERPROFILE%\\AppData\\LocalLow\\Massive Monster\\Cult Of The Lamb\\saves' },
    { os: 'macOS (Steam)', path: '~/Library/Application Support/Massive Monster/Cult Of The Lamb/saves' },
    { os: 'macOS (App Store, Apple Arcade)', path: '~/Library/Containers/com.devolverdigital.cultofthelamb/Data/Library/Application Support/com.devolverdigital.cultofthelamb/user/' },
    { os: 'Linux, Steam Deck', path: '~/.local/share/Steam/steamapps/compatdata/1313140/pfx/drive_c/users/steamuser/AppData/LocalLow/Massive Monster/Cult Of The Lamb/saves' },
  ]
  const FORMAT: Record<SlotEntry['format'], string> = {
    'pc-mp': 'PC 1.5+', 'pc-json': 'PC before 1.5', 'plain-json': 'JSON', 'apple-zb': 'Apple', 'switch-mp': 'Switch',
  }

  let slots = $state<SlotEntry[] | null>(null)
  let busy = $state(false)
  let dragging = $state(false)
  let copied = $state<string | null>(null)
  let error = $state<string | null>(null)

  async function take(files: File[]) {
    busy = true
    error = null
    try {
      slots = await listSlots(files, schemaFor)
      if (!slots.length) error = 'No Cult of the Lamb saves found there. Pick the saves folder itself, or slot_N and meta_N files.'
    } finally { busy = false }
  }

  async function entriesOf(items: DataTransferItemList): Promise<File[]> {
    const out: File[] = []
    const walk = async (e: FileSystemEntry): Promise<void> => {
      if (e.isFile) out.push(await new Promise<File>((ok, fail) => (e as FileSystemFileEntry).file(ok, fail)))
      else if (e.isDirectory) {
        const reader = (e as FileSystemDirectoryEntry).createReader()
        for (let batch: FileSystemEntry[]; (batch = await new Promise(ok => reader.readEntries(ok))).length;) for (const c of batch) await walk(c)
      }
    }
    for (const e of [...items].map(i => i.webkitGetAsEntry()).filter(Boolean)) await walk(e!)
    return out
  }

  async function drop(ev: DragEvent) {
    ev.preventDefault()
    dragging = false
    if (ev.dataTransfer) await take(await entriesOf(ev.dataTransfer.items))
  }

  async function open(entry: SlotEntry) {
    if (hasUnexported() && !confirm(`Discard ${session.changes.length} unexported change${session.changes.length === 1 ? '' : 's'}?`)) return
    await openSlot(entry, schemaFor)
    go('overview')
  }

  async function copy(path: string) {
    await navigator.clipboard.writeText(path)
    copied = path
    setTimeout(() => (copied = null), 1500)
  }

  const hours = (s: number | null) => (s == null ? null : `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`)
</script>

<section class="open">
  <h1>Open your saves</h1>
  <p class="lead">Drop your <span class="mono">saves</span> folder here, or choose it. Everything stays in this browser: nothing is uploaded.</p>

  <div class="drop" class:dragging role="region" aria-label="Drop saves here"
    ondragover={e => { e.preventDefault(); dragging = true }} ondragleave={() => (dragging = false)} ondrop={drop}>
    <FolderOpen size={32} aria-hidden="true" />
    <span>{busy ? 'Reading…' : 'Drop the saves folder or files'}</span>
    <div class="pick">
      <label class="btn primary">
        <Upload size={16} aria-hidden="true" />Choose folder
        <input class="sr-only" type="file" webkitdirectory aria-label="Choose your saves folder"
          onchange={e => take([...(e.currentTarget.files ?? [])])} />
      </label>
      <label class="btn">
        Choose files
        <input class="sr-only" type="file" multiple aria-label="Choose save files" onchange={e => take([...(e.currentTarget.files ?? [])])} />
      </label>
    </div>
  </div>

  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#if slots?.length}
    <h2>Slots</h2>
    <ul class="slots">
      {#each slots as s (s.slot)}
        <li>
          <span class="name">{s.cultName ?? 'Unnamed cult'}</span>
          <span class="meta">
            <span class="mono">{s.slotFile.name}</span>
            {#if s.day != null}<span>Day {s.day}</span>{/if}
            {#if s.playTime != null}<span>{hours(s.playTime)}</span>{/if}
            <span class="chip">{FORMAT[s.format]}</span>
            {#if s.beta}<span class="chip beta" title="No real save of this format has been tested yet">Beta</span>{/if}
          </span>
          <button class="btn primary" onclick={() => open(s)}>Open</button>
        </li>
      {/each}
    </ul>
  {/if}

  <h2>Where the saves are</h2>
  <p class="hint">Close the game first. The editor never changes your files: it downloads an edited copy (and a backup) for you to put back.</p>
  <dl class="paths">
    {#each PATHS as p (p.os)}
      <div>
        <dt>{p.os}</dt>
        <dd>
          <code class="mono">{p.path}</code>
          <button class="btn ghost" aria-label="Copy the {p.os} path" onclick={() => copy(p.path)}>
            {#if copied === p.path}<Check size={16} aria-hidden="true" />{:else}<Copy size={16} aria-hidden="true" />{/if}
          </button>
        </dd>
      </div>
    {/each}
  </dl>
</section>

<style>
  .open { max-width: 880px; display: flex; flex-direction: column; gap: 12px; }
  h1 { margin: 0; font-size: 28px; font-weight: 600; letter-spacing: -0.4px; }
  h2 { margin: 20px 0 0; font-size: 16px; font-weight: 600; }
  .lead { margin: 0; color: var(--muted); max-width: 60ch; }
  .hint { margin: 0; color: var(--muted); font-size: 14px; }
  .drop { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 40px 16px; border: 1.5px dashed var(--border-strong);
    border-radius: var(--radius-12); background: var(--surface-1); color: var(--muted); text-align: center; transition: border-color 150ms, background-color 150ms; }
  .drop.dragging { border-color: var(--accent); background: var(--surface-2); }
  .pick { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
  .pick label:focus-within { outline: 2px solid var(--accent-text); outline-offset: 2px; }
  .error { margin: 0; padding: 10px 12px; border-radius: var(--radius-8); background: var(--warn-bg); border: 1px solid var(--warn-border); color: var(--warn); }
  .slots { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .slots li { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; padding: 12px 14px; border: 1px solid var(--border);
    border-radius: var(--radius-10); background: var(--surface-1); }
  .name { font-weight: 600; min-width: 160px; }
  .meta { flex: 1; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; color: var(--muted); font-size: 14px; }
  .chip { font-size: 12px; padding: 2px 8px; border-radius: var(--radius-6); background: var(--surface-3); border: 1px solid var(--border); }
  .chip.beta { color: var(--warn); border-color: var(--warn-border); background: var(--warn-bg); }
  .paths { margin: 0; display: flex; flex-direction: column; gap: 8px; }
  .paths div { display: flex; flex-direction: column; gap: 2px; }
  dt { font-size: 13px; color: var(--muted); }
  dd { margin: 0; display: flex; align-items: center; gap: 8px; }
  code { flex: 1; min-width: 0; overflow-wrap: anywhere; font-size: 13px; padding: 6px 10px; border-radius: var(--radius-8);
    background: var(--surface-2); border: 1px solid var(--border); }
</style>
