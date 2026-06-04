<script lang="ts">
  import { createSupabaseClient } from '$lib/supabase';
  import { goto } from '$app/navigation';

  const supabase = createSupabaseClient();

  let email = $state('');
  let password = $state('');
  let loading = $state(false);
  let error = $state('');
  let successMsg = $state('');
  let mode = $state<'password' | 'magic'>('password');

  async function handleLogin() {
    loading = true;
    error = '';
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) { error = err.message; loading = false; return; }
    await goto('/');
  }

  async function handleMagicLink() {
    loading = true;
    error = '';
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/` }
    });
    if (err) { error = err.message; loading = false; return; }
    successMsg = 'Magic link sent! Check your email.';
    loading = false;
  }
</script>

<svelte:head><title>INEVITRADE — Login</title></svelte:head>

<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg);padding:1rem;">
  <div style="width:100%;max-width:400px;">
    <!-- Logo / Brand -->
    <div style="text-align:center;margin-bottom:2rem;">
      <h1 style="font-family:'JetBrains Mono',monospace;font-size:1.75rem;font-weight:600;color:var(--text-primary);letter-spacing:-0.02em;">
        INEVITRADE
      </h1>
      <p style="color:var(--text-muted);font-size:0.875rem;margin-top:0.25rem;">Trading Journal</p>
    </div>

    <!-- Card -->
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:2rem;">
      <!-- Mode toggle -->
      <div style="display:flex;gap:0.5rem;margin-bottom:1.5rem;background:var(--bg);border-radius:0.5rem;padding:0.25rem;">
        <button
          onclick={() => { mode = 'password'; error = ''; successMsg = ''; }}
          style="flex:1;padding:0.5rem;border-radius:0.375rem;border:none;cursor:pointer;font-size:0.875rem;font-weight:500;transition:all 0.15s;
            background:{mode === 'password' ? 'var(--surface)' : 'transparent'};
            color:{mode === 'password' ? 'var(--text-primary)' : 'var(--text-muted)'};">
          Password
        </button>
        <button
          onclick={() => { mode = 'magic'; error = ''; successMsg = ''; }}
          style="flex:1;padding:0.5rem;border-radius:0.375rem;border:none;cursor:pointer;font-size:0.875rem;font-weight:500;transition:all 0.15s;
            background:{mode === 'magic' ? 'var(--surface)' : 'transparent'};
            color:{mode === 'magic' ? 'var(--text-primary)' : 'var(--text-muted)'};">
          Magic Link
        </button>
      </div>

      {#if successMsg}
        <div style="background:color-mix(in srgb, var(--win) 15%, transparent);border:1px solid var(--win);border-radius:0.5rem;padding:0.75rem;margin-bottom:1rem;color:var(--win);font-size:0.875rem;">
          {successMsg}
        </div>
      {/if}

      {#if error}
        <div style="background:color-mix(in srgb, var(--loss) 15%, transparent);border:1px solid var(--loss);border-radius:0.5rem;padding:0.75rem;margin-bottom:1rem;color:var(--loss);font-size:0.875rem;">
          {error}
        </div>
      {/if}

      <!-- Email field (shared) -->
      <div style="margin-bottom:1rem;">
        <label for="email" style="display:block;font-size:0.75rem;font-weight:500;color:var(--text-muted);margin-bottom:0.375rem;text-transform:uppercase;letter-spacing:0.05em;">Email</label>
        <input
          id="email"
          type="email"
          bind:value={email}
          placeholder="you@example.com"
          style="width:100%;padding:0.625rem 0.75rem;background:var(--bg);border:1px solid var(--border);border-radius:0.5rem;color:var(--text-primary);font-size:0.875rem;outline:none;box-sizing:border-box;"
          onkeydown={(e) => e.key === 'Enter' && (mode === 'password' ? handleLogin() : handleMagicLink())}
        />
      </div>

      {#if mode === 'password'}
        <div style="margin-bottom:1.5rem;">
          <label for="password" style="display:block;font-size:0.75rem;font-weight:500;color:var(--text-muted);margin-bottom:0.375rem;text-transform:uppercase;letter-spacing:0.05em;">Password</label>
          <input
            id="password"
            type="password"
            bind:value={password}
            placeholder="••••••••"
            style="width:100%;padding:0.625rem 0.75rem;background:var(--bg);border:1px solid var(--border);border-radius:0.5rem;color:var(--text-primary);font-size:0.875rem;outline:none;box-sizing:border-box;"
            onkeydown={(e) => e.key === 'Enter' && handleLogin()}
          />
        </div>
        <button
          onclick={handleLogin}
          disabled={loading || !email || !password}
          style="width:100%;padding:0.75rem;background:var(--accent);color:#fff;border:none;border-radius:0.5rem;font-weight:600;font-size:0.875rem;cursor:pointer;opacity:{loading || !email || !password ? 0.5 : 1};transition:opacity 0.15s;">
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      {:else}
        <button
          onclick={handleMagicLink}
          disabled={loading || !email}
          style="width:100%;padding:0.75rem;background:var(--accent);color:#fff;border:none;border-radius:0.5rem;font-weight:600;font-size:0.875rem;cursor:pointer;opacity:{loading || !email ? 0.5 : 1};transition:opacity 0.15s;">
          {loading ? 'Sending…' : 'Send Magic Link'}
        </button>
      {/if}
    </div>
  </div>
</div>
