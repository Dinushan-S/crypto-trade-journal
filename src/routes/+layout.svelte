<script lang="ts">
  import './layout.css';
  import { user } from '$lib/stores/auth';

  let { children, data } = $props();

  $effect(() => {
    user.set(data.user ?? null);
  });
</script>

{@render children()}
