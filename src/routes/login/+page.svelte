<script lang="ts">
  import { enhance } from '$app/forms';
  import type { ActionData } from './$types';

  let { form }: { form: ActionData } = $props();

  let mode = $state<'login' | 'signup'>(form?.flow === 'signUp' ? 'signup' : 'login');
  let email = $state(form?.email ?? '');
  let password = $state('');
  let loading = $state(false);
</script>

<svelte:head><title>Qulem-Trade — Login</title></svelte:head>

<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg);padding:1rem;">
  <div style="width:100%;max-width:400px;">
    <!-- Brand -->
    <div style="text-align:center;margin-bottom:2rem;">
      <div style="display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;background:var(--accent);border-radius:0.625rem;margin-bottom:0.875rem;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
          <polyline points="16 7 22 7 22 13"/>
        </svg>
      </div>
      <h1 style="font-family:'JetBrains Mono',monospace;font-size:1.5rem;font-weight:700;color:var(--text-primary);letter-spacing:-0.02em;">Qulem-Trade</h1>
      <p style="color:var(--text-muted);font-size:0.875rem;margin-top:0.25rem;">Trading Journal</p>
    </div>

    <!-- Card -->
    <form
      method="POST"
      use:enhance={() => {
        loading = true;
        return async ({ update }) => {
          await update({ reset: false });
          loading = false;
        };
      }}
      style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:2rem;"
    >
      <input type="hidden" name="flow" value={mode} />

      <!-- Mode tabs -->
      <div style="display:flex;gap:0.375rem;margin-bottom:1.5rem;background:var(--bg);border-radius:0.5rem;padding:0.25rem;">
        {#each [['login','Sign In'],['signup','Sign Up']] as [key, label]}
          <button
            type="button"
            onclick={() => (mode = key as 'login' | 'signup')}
            style="flex:1;padding:0.5rem 0.25rem;border-radius:0.375rem;border:none;cursor:pointer;font-size:0.8rem;font-weight:500;transition:all 0.15s;white-space:nowrap;
              background:{mode === key ? 'var(--surface)' : 'transparent'};
              color:{mode === key ? 'var(--text-primary)' : 'var(--text-muted)'};">
            {label}
          </button>
        {/each}
      </div>

      {#if form?.error}
        <div style="background:color-mix(in srgb,var(--loss) 12%,transparent);border:1px solid color-mix(in srgb,var(--loss) 30%,transparent);border-radius:0.5rem;padding:0.75rem;margin-bottom:1rem;color:var(--loss);font-size:0.875rem;">
          {form.error}
        </div>
      {/if}

      <!-- Email -->
      <div style="margin-bottom:1rem;">
        <label for="email" style="display:block;font-size:0.75rem;font-weight:500;color:var(--text-muted);margin-bottom:0.375rem;text-transform:uppercase;letter-spacing:0.05em;">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autocomplete="email"
          bind:value={email}
          placeholder="you@example.com"
          style="width:100%;padding:0.625rem 0.75rem;background:var(--bg);border:1px solid var(--border);border-radius:0.5rem;color:var(--text-primary);font-size:0.875rem;outline:none;box-sizing:border-box;"
        />
      </div>

      <div style="margin-bottom:1.5rem;">
        <label for="password" style="display:block;font-size:0.75rem;font-weight:500;color:var(--text-muted);margin-bottom:0.375rem;text-transform:uppercase;letter-spacing:0.05em;">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autocomplete={mode === 'signup' ? 'new-password' : 'current-password'}
          bind:value={password}
          placeholder={mode === 'signup' ? 'Min. 8 characters' : '••••••••'}
          style="width:100%;padding:0.625rem 0.75rem;background:var(--bg);border:1px solid var(--border);border-radius:0.5rem;color:var(--text-primary);font-size:0.875rem;outline:none;box-sizing:border-box;"
        />
      </div>

      <button
        type="submit"
        disabled={loading || !email || !password}
        style="width:100%;padding:0.75rem;background:var(--accent);color:#fff;border:none;border-radius:0.5rem;font-weight:600;font-size:0.875rem;cursor:pointer;transition:opacity 0.15s;
          opacity:{loading || !email || !password ? 0.5 : 1};">
        {#if loading}
          {mode === 'signup' ? 'Creating account…' : 'Signing in…'}
        {:else}
          {mode === 'signup' ? 'Create Account' : 'Sign In'}
        {/if}
      </button>
    </form>
  </div>
</div>
