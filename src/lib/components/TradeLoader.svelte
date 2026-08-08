<script lang="ts">
  let { label = '' }: { label?: string } = $props();
</script>

<div style="display:inline-flex;align-items:center;gap:0.5rem;font-size:0.8rem;color:var(--text-muted);" role="status">
  <span style="display:inline-block;width:1rem;height:1rem;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:spin 0.6s linear infinite;"></span>
  {#if label}<span>{label}</span>{/if}
</div>

<style>
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
