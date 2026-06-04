<script lang="ts">
  import './layout.css';
  import { onMount } from 'svelte';
  import { invalidate } from '$app/navigation';
  import { createSupabaseClient } from '$lib/supabase';
  import { user, session } from '$lib/stores/auth';

  let { children, data } = $props();

  const supabase = createSupabaseClient();

  $effect(() => {
    user.set(data.user ?? null);
    session.set(data.session ?? null);
  });

  onMount(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, newSession) => {
      if (newSession?.expires_at !== data.session?.expires_at) {
        invalidate('supabase:auth');
      }
    });
    return () => subscription.unsubscribe();
  });
</script>

{@render children()}
