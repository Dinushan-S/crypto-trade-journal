<script lang="ts">
  import { enhance } from '$app/forms';

  let { data, form } = $props();

  let saving = $state(false);
  let saved = $state(false);

  $effect(() => {
    if (form?.success) {
      saved = true;
      setTimeout(() => { saved = false; }, 2500);
    }
  });
</script>

<svelte:head><title>Settings — Qulem-Trade</title></svelte:head>

<div style="padding:1.5rem;max-width:600px;">
  <div style="margin-bottom:1.5rem;">
    <h1 style="font-family:'JetBrains Mono',monospace;font-size:1.25rem;font-weight:600;color:var(--text-primary);">Settings</h1>
    <p style="color:var(--text-muted);font-size:0.875rem;margin-top:0.125rem;">Account and application preferences</p>
  </div>

  <!-- Account Info -->
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:1.25rem;margin-bottom:1rem;">
    <h2 style="font-size:0.75rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:1rem;">Account</h2>
    <div style="display:flex;flex-direction:column;gap:0.625rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:0.875rem;color:var(--text-muted);">Email</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:0.875rem;color:var(--text-primary);">{data.user?.email ?? '—'}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:0.875rem;color:var(--text-muted);">User ID</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:0.75rem;color:var(--text-muted);">{data.user?.id?.slice(0, 8) ?? '—'}…</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:0.875rem;color:var(--text-muted);">Member since</span>
        <span style="font-size:0.875rem;color:var(--text-primary);">
          {data.user?.created_at ? new Date(data.user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
        </span>
      </div>
    </div>
  </div>

  <!-- Change Password -->
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:1.25rem;margin-bottom:1rem;">
    <h2 style="font-size:0.75rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:1rem;">Change Password</h2>

    {#if form?.error}
      <div style="padding:0.625rem 0.875rem;background:color-mix(in srgb,var(--loss) 10%,transparent);border:1px solid color-mix(in srgb,var(--loss) 30%,transparent);border-radius:0.5rem;color:var(--loss);font-size:0.8rem;margin-bottom:1rem;">
        {form.error}
      </div>
    {/if}

    {#if saved}
      <div style="padding:0.625rem 0.875rem;background:color-mix(in srgb,var(--win) 10%,transparent);border:1px solid color-mix(in srgb,var(--win) 30%,transparent);border-radius:0.5rem;color:var(--win);font-size:0.8rem;margin-bottom:1rem;">
        Password updated successfully.
      </div>
    {/if}

    <form method="POST" action="?/updatePassword" use:enhance={() => {
      saving = true;
      return async ({ update }) => { await update(); saving = false; };
    }}>
      <div style="display:flex;flex-direction:column;gap:0.75rem;">
        <div>
          <label style="display:block;font-size:0.8rem;color:var(--text-muted);margin-bottom:0.375rem;">New Password</label>
          <input
            type="password"
            name="password"
            placeholder="Min. 6 characters"
            style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:0.5rem;padding:0.5rem 0.75rem;color:var(--text-primary);font-size:0.875rem;box-sizing:border-box;"
          />
        </div>
        <div>
          <label style="display:block;font-size:0.8rem;color:var(--text-muted);margin-bottom:0.375rem;">Confirm Password</label>
          <input
            type="password"
            name="confirm"
            placeholder="Repeat new password"
            style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:0.5rem;padding:0.5rem 0.75rem;color:var(--text-primary);font-size:0.875rem;box-sizing:border-box;"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          style="padding:0.5rem 1rem;background:var(--accent);color:#fff;border:none;border-radius:0.5rem;font-size:0.875rem;font-weight:500;cursor:pointer;align-self:flex-start;opacity:{saving ? 0.7 : 1};"
        >
          {saving ? 'Updating…' : 'Update Password'}
        </button>
      </div>
    </form>
  </div>

  <!-- App Info -->
  <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:1.25rem;">
    <h2 style="font-size:0.75rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:1rem;">Application</h2>
    <div style="display:flex;flex-direction:column;gap:0.625rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:0.875rem;color:var(--text-muted);">App name</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:0.875rem;color:var(--text-primary);">Qulem-Trade</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:0.875rem;color:var(--text-muted);">Version</span>
        <span style="font-family:'JetBrains Mono',monospace;font-size:0.875rem;color:var(--text-muted);">1.0.0</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:0.875rem;color:var(--text-muted);">Stack</span>
        <span style="font-size:0.875rem;color:var(--text-muted);">SvelteKit · Supabase · Tailwind</span>
      </div>
    </div>
  </div>
</div>
