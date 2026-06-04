<script lang="ts">
  import Sidebar from '$lib/components/Sidebar.svelte';
  let { children } = $props();
</script>

<div style="display:flex;min-height:100vh;background:var(--bg);">
  <Sidebar />
  <main style="flex:1;overflow-y:auto;min-width:0;">
    {@render children()}
  </main>
</div>
