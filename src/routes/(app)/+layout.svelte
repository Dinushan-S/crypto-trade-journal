<script lang="ts">
  import Sidebar from '$lib/components/Sidebar.svelte';
  import TradeLoader from '$lib/components/TradeLoader.svelte';
  import { navigating } from '$app/stores';

  let { children } = $props();
</script>

<!-- Navigation loading indicator — shown during SvelteKit page transitions -->
{#if $navigating}
  <!-- Thin animated progress bar across the top of the viewport -->
  <div class="nav-bar" aria-hidden="true">
    <div class="nav-bar-fill"></div>
  </div>
  <!-- Floating candlestick icon in the top-right corner -->
  <div class="nav-icon" aria-hidden="true">
    <TradeLoader />
  </div>
{/if}

<div style="display:flex;min-height:100vh;background:var(--bg);">
  <Sidebar />
  <main style="flex:1;overflow-y:auto;min-width:0;">
    {@render children()}
  </main>
</div>

<style>
  /* === Top progress bar === */
  .nav-bar {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 3px;
    z-index: 9999;
    background: color-mix(in srgb, var(--accent) 18%, transparent);
    overflow: hidden;
  }

  .nav-bar-fill {
    height: 100%;
    width: 40%;
    background: linear-gradient(
      90deg,
      var(--accent) 0%,
      color-mix(in srgb, var(--accent) 55%, var(--win)) 50%,
      var(--accent) 100%
    );
    border-radius: 0 2px 2px 0;
    animation: nav-sweep 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  }

  @keyframes nav-sweep {
    0%   { transform: translateX(-120%); }
    100% { transform: translateX(300%); }
  }

  /* === Floating candlestick icon === */
  .nav-icon {
    position: fixed;
    top: 12px;
    right: 18px;
    z-index: 9999;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    padding: 7px 10px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.14);
    animation: icon-fade-in 0.15s ease;
  }

  @keyframes icon-fade-in {
    from { opacity: 0; transform: translateY(-4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
</style>
