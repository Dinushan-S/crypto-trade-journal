<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import ThemeToggle from './ThemeToggle.svelte';

  let collapsed = $state(false);

  const navItems = [
    { href: '/', label: 'Dashboard', icon: gridIcon },
    { href: '/trades', label: 'Trades', icon: trendingIcon },
    { href: '/trades/import', label: 'Import', icon: uploadIcon },
    { href: '/ledger', label: 'Ledger', icon: walletIcon },
    { href: '/liquidations', label: 'Liquidations', icon: alertIcon },
    { href: '/sessions', label: 'Sessions', icon: calendarIcon },
    { href: '/mistakes', label: 'Mistakes', icon: mistakeIcon },
    { href: '/settings', label: 'Settings', icon: settingsIcon },
  ];

  function isActive(href: string) {
    if (href === '/') return $page.url.pathname === '/';
    return $page.url.pathname.startsWith(href);
  }

  async function signOut() {
    document.cookie = 'convex_auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    goto('/login');
  }

  // SVG icon strings
  function gridIcon() { return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`; }
  function trendingIcon() { return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`; }
  function uploadIcon() { return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`; }
  function walletIcon() { return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>`; }
  function alertIcon() { return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`; }
  function calendarIcon() { return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`; }
  function mistakeIcon() { return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M3.88 18.88 10.94 4.76a1.2 1.2 0 0 1 2.12 0l7.06 14.12A1.2 1.2 0 0 1 19.06 20.5H4.94a1.2 1.2 0 0 1-1.06-1.62z"/></svg>`; }
  function settingsIcon() { return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`; }
</script>

<aside style="
  width: {collapsed ? '48px' : '220px'};
  min-height: 100vh;
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  transition: width 0.2s ease;
  overflow: hidden;
  flex-shrink: 0;
">
  <!-- Logo -->
  <div style="padding: {collapsed ? '1rem 0.75rem' : '1.25rem 1rem'};border-bottom: 1px solid var(--border);display:flex;align-items:center;gap:0.75rem;">
    <div style="width:32px;height:32px;background:var(--accent);border-radius:0.375rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
        <polyline points="16 7 22 7 22 13"/>
      </svg>
    </div>
    {#if !collapsed}
      <span style="font-family:'JetBrains Mono',monospace;font-weight:600;font-size:0.9rem;color:var(--text-primary);white-space:nowrap;">Qulem-Trade</span>
    {/if}
  </div>

  <!-- Nav links -->
  <nav style="flex:1;padding:0.5rem 0.5rem;display:flex;flex-direction:column;gap:0.125rem;">
    {#each navItems as item}
      {@const active = isActive(item.href)}
      <a
        href={item.href}
        style="
          display:flex;align-items:center;gap:0.75rem;
          padding:0.5rem {collapsed ? '0.625rem' : '0.75rem'};
          border-radius:0.5rem;
          text-decoration:none;
          font-size:0.875rem;
          font-weight: {active ? '600' : '400'};
          color: {active ? 'var(--accent)' : 'var(--text-muted)'};
          background: {active ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent'};
          transition:all 0.15s;
          white-space:nowrap;
          overflow:hidden;
        "
        title={collapsed ? item.label : ''}
      >
        <span style="flex-shrink:0;color:{active ? 'var(--accent)' : 'var(--text-muted)'};">{@html item.icon()}</span>
        {#if !collapsed}
          <span>{item.label}</span>
        {/if}
      </a>
    {/each}
  </nav>

  <!-- Bottom actions -->
  <div style="padding:0.75rem 0.5rem;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:0.5rem;">
    <ThemeToggle />
    <button
      onclick={signOut}
      style="display:flex;align-items:center;gap:0.75rem;padding:0.5rem 0.75rem;border-radius:0.5rem;border:none;background:transparent;color:var(--text-muted);cursor:pointer;font-size:0.875rem;text-align:left;width:100%;transition:color 0.15s;"
      title={collapsed ? 'Sign out' : ''}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
        <polyline points="16 17 21 12 16 7"/>
        <line x1="21" y1="12" x2="9" y2="12"/>
      </svg>
      {#if !collapsed}
        <span>Sign out</span>
      {/if}
    </button>
  </div>
</aside>
