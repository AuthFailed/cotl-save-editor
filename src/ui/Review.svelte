<script lang="ts">
  import { Undo2, X } from '@lucide/svelte'
  import { revert, session, undo } from '../model/session.svelte'

  let { onClose, onExport }: { onClose: () => void; onExport: () => void } = $props()
  const id = $props.id()
  let dialog: HTMLDialogElement
  $effect(() => { dialog.showModal() })
  const undoAll = () => { while (session.changes.length) undo() }
</script>

<dialog bind:this={dialog} aria-labelledby="{id}-t" onclose={onClose}>
  <header>
    <h2 id="{id}-t">Review changes</h2>
    <button class="btn ghost" aria-label="Close" onclick={() => dialog.close()}><X size={16} /></button>
  </header>
  {#if session.error}<p class="err" role="alert">{session.error}</p>{/if}
  {#if session.changes.length}
    <ol>
      {#each session.changes as c, i (i)}
        <li>
          <span class="n mono">{i + 1}</span>
          <span class="label">{c.label}</span>
          <button class="btn ghost" aria-label="Undo {c.label}" onclick={() => revert(i)}><Undo2 size={14} />Undo</button>
        </li>
      {/each}
    </ol>
    <footer>
      <button class="btn ghost" onclick={undoAll}>Undo all</button>
      <span class="spacer"></span>
      <button class="btn primary" onclick={() => { dialog.close(); onExport() }}>Export</button>
    </footer>
  {:else}
    <p class="none">No changes yet. Edits you make appear here, each one undoable until you export.</p>
  {/if}
</dialog>

<style>
  dialog { margin: 0 0 0 auto; height: 100vh; max-height: none; width: min(460px, 100vw); padding: 0; border: 0; border-left: 1px solid var(--border);
    background: var(--surface-1); color: var(--text); display: flex; flex-direction: column; }
  dialog:not([open]) { display: none; }
  dialog::backdrop { background: rgb(0 0 0 / .45); }
  header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border); }
  h2 { margin: 0; font-size: 16px; font-weight: 600; }
  ol { list-style: none; margin: 0; padding: 8px 12px; overflow-y: auto; flex: 1; }
  li { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: var(--radius-8); }
  li:hover { background: var(--surface-2); }
  .n { font-size: 12px; color: var(--faint); width: 20px; text-align: right; }
  .label { flex: 1; font-size: 14px; overflow-wrap: anywhere; }
  footer { display: flex; gap: 8px; padding: 12px 20px; border-top: 1px solid var(--border); }
  .spacer { flex: 1; }
  .none, .err { margin: 16px 20px; color: var(--muted); }
  .err { padding: 10px 12px; border-radius: var(--radius-8); background: var(--warn-bg); border: 1px solid var(--warn-border); color: var(--warn); }
</style>
