<script lang="ts">
  import { Minus, Plus } from '@lucide/svelte'

  let { label, value, min = -Infinity, max = Infinity, step = 1, integer = true, disabled = false, onCommit }: {
    label: string; value: number; min?: number; max?: number; step?: number; integer?: boolean; disabled?: boolean
    onCommit: (v: number) => void
  } = $props()

  const id = $props.id()
  const show = (v: number) => (integer ? String(Math.round(v)) : String(Math.round(v * 10) / 10))
  let text = $state('')
  let error = $state<string | null>(null)
  $effect(() => { text = show(value) })

  function commit(raw: string) {
    const v = Number(raw.trim())
    if (raw.trim() === '' || !Number.isFinite(v)) return (error = 'Enter a number')
    if (integer && !Number.isInteger(v)) return (error = 'Enter a whole number')
    if (v < min || v > max) return (error = `Between ${min} and ${max}`)
    error = null
    if (v !== value) onCommit(v)
  }
  const nudge = (d: number) => commit(String(Math.min(max, Math.max(min, Number(show(value)) + d))))
</script>

<div class="field">
  <label for={id}>{label}</label>
  <div class="box" class:bad={error}>
    <button type="button" aria-label="Decrease {label}" {disabled} onclick={() => nudge(-step)}><Minus size={14} /></button>
    <input {id} class="mono" inputmode={integer ? 'numeric' : 'decimal'} bind:value={text} {disabled} aria-invalid={!!error}
      aria-describedby={error ? `${id}-error` : undefined}
      onkeydown={e => { if (e.key === 'Enter') commit(text) }} onblur={() => commit(text)} />
    <button type="button" aria-label="Increase {label}" {disabled} onclick={() => nudge(step)}><Plus size={14} /></button>
  </div>
  {#if error}<span class="error" id="{id}-error">{error}</span>{/if}
</div>

<style>
  .field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  label { font-size: 13px; color: var(--muted); }
  .box { display: flex; align-items: center; height: 36px; border: 1px solid var(--border); border-radius: var(--radius-8); background: var(--bg); }
  .box.bad { border-color: var(--accent); }
  .box:focus-within { border-color: var(--border-strong); }
  input { flex: 1; min-width: 0; width: 100%; height: 100%; border: 0; background: transparent; text-align: center; font-size: 13px; outline: none; }
  button { width: 32px; height: 100%; border: 0; background: transparent; color: var(--muted); display: inline-flex; align-items: center; justify-content: center; }
  button:hover { color: var(--text); }
  .error { font-size: 12px; color: var(--accent-text); }
  @media (max-width: 767px) { .box { height: 44px; } button { width: 44px; } }
</style>
