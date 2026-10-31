<script lang="ts">
  import { Check, Copy, FolderOpen, Upload } from '@lucide/svelte'
  import { adopt, discard, failure, listSlots, openSlot, pendingFor, session, type SchemaFor, type SlotEntry } from '../model/session.svelte'
  import { t, type Key } from '../i18n/i18n.svelte'
  import { go } from './route.svelte'

  let { schemaFor }: { schemaFor: SchemaFor } = $props()

  const PATHS = [
    { os: 'os.windows' as Key, path: '%USERPROFILE%\\AppData\\LocalLow\\Massive Monster\\Cult Of The Lamb\\saves' },
    { os: 'os.macSteam' as Key, path: '~/Library/Application Support/Massive Monster/Cult Of The Lamb/saves' },
    { os: 'os.macStore' as Key, path: '~/Library/Containers/com.devolverdigital.cultofthelamb/Data/Library/Application Support/com.devolverdigital.cultofthelamb/user/' },
    { os: 'os.linux' as Key, path: '~/.local/share/Steam/steamapps/compatdata/1313140/pfx/drive_c/users/steamuser/AppData/LocalLow/Massive Monster/Cult Of The Lamb/saves' },
  ]

  let slots = $state<SlotEntry[] | null>(session.slots.length ? session.slots : null)
  let busy = $state(false)
  let dragging = $state(false)
  let copied = $state<string | null>(null)
  let error = $state<string | null>(null)
  let changed = $state<{ was: SlotEntry; now: SlotEntry }[]>([])

  async function take(files: File[]) {
    busy = true
    error = null
    try {
      const listed = await listSlots(files, schemaFor)
      changed = await adopt(listed)
      slots = session.slots
      if (!listed.length) error = t('open.none')
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
    try {
      await openSlot(entry, schemaFor)
      go('overview')
    } catch (e) {
      error = failure(e, entry.slotFile.name)
    }
  }

  function useNew(pair: { was: SlotEntry; now: SlotEntry }) {
    if (!confirm(t('open.discard', { n: pendingFor(pair.was) }))) return
    discard(pair.was, pair.now)
    slots = session.slots
    changed = changed.filter(c => c !== pair)
  }

  async function copy(path: string) {
    await navigator.clipboard.writeText(path)
    copied = path
    setTimeout(() => (copied = null), 1500)
  }

  const hours = (s: number | null) => (s == null ? null : t('open.time', { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60) }))
</script>

<section class="open">
  <h1>{t('open.title')}</h1>
  <p class="lead">{t('open.lead')}</p>

  <div class="drop" class:dragging role="region" aria-label={t('open.dropRegion')}
    ondragover={e => { e.preventDefault(); dragging = true }} ondragleave={() => (dragging = false)} ondrop={drop}>
    <FolderOpen size={32} aria-hidden="true" />
    <span>{busy ? t('open.reading') : t('open.drop')}</span>
    <div class="pick">
      <label class="btn primary">
        <Upload size={16} aria-hidden="true" />{t('open.chooseFolder')}
        <input class="sr-only" type="file" webkitdirectory aria-label={t('open.chooseFolderLabel')}
          onchange={e => take([...(e.currentTarget.files ?? [])])} />
      </label>
      <label class="btn">
        {t('open.chooseFiles')}
        <input class="sr-only" type="file" multiple aria-label={t('open.chooseFilesLabel')} onchange={e => take([...(e.currentTarget.files ?? [])])} />
      </label>
    </div>
  </div>

  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#each changed as pair (pair.was.slot)}
    <p class="error" role="alert"><span id="changed-{pair.was.slot}">{t('open.changedKept', { file: pair.was.slotFile.name, n: pendingFor(pair.was) })}</span>
      <button class="btn" aria-describedby="changed-{pair.was.slot}" onclick={() => useNew(pair)}>{t('open.useNew')}</button></p>
  {/each}

  {#if slots?.length}
    <h2>{t('open.slots')}</h2>
    <ul class="slots">
      {#each slots as s (s.slot)}
        <li>
          <span class="name">{s.cultName ?? t('open.unnamed')}</span>
          <span class="meta">
            <span class="mono">{s.slotFile.name}</span>
            {#if s.day != null}<span>{t('open.day', { n: s.day })}</span>{/if}
            {#if s.playTime != null}<span>{hours(s.playTime)}</span>{/if}
            <span class="chip">{t(`format.${s.format}`)}</span>
            {#if pendingFor(s)}<span class="chip pending">{t('slot.pending', { n: pendingFor(s) })}</span>{/if}
            {#if s.beta}<span class="chip beta" title={t('open.betaHint')}>{t('open.beta')}</span>{/if}
          </span>
          <button class="btn primary" onclick={() => open(s)}>{t('open.open')}</button>
        </li>
      {/each}
    </ul>
  {/if}

  {#if slots?.length}<p class="hint">{t('open.kept')}</p>{/if}

  <h2>{t('open.where')}</h2>
  <p class="hint">{t('open.hint')}</p>
  <dl class="paths">
    {#each PATHS as p (p.os)}
      <div>
        <dt>{t(p.os)}</dt>
        <dd>
          <code class="mono">{p.path}</code>
          <button class="btn ghost" aria-label={t('open.copy', { os: t(p.os) })} onclick={() => copy(p.path)}>
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
  .chip.pending { color: var(--warn); border-color: var(--warn-border); background: var(--warn-bg); }
  .chip.beta { color: var(--warn); border-color: var(--warn-border); background: var(--warn-bg); }
  .paths { margin: 0; display: flex; flex-direction: column; gap: 8px; }
  .paths div { display: flex; flex-direction: column; gap: 2px; }
  dt { font-size: 13px; color: var(--muted); }
  dd { margin: 0; display: flex; align-items: center; gap: 8px; }
  code { flex: 1; min-width: 0; overflow-wrap: anywhere; font-size: 13px; padding: 6px 10px; border-radius: var(--radius-8);
    background: var(--surface-2); border: 1px solid var(--border); }
</style>
