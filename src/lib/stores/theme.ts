import { writable } from 'svelte/store';
import { browser } from '$app/environment';

function createThemeStore() {
  const stored = browser ? localStorage.getItem('theme') : null;
  const initial = stored ?? 'dark';

  const { subscribe, set } = writable<'dark' | 'light'>(initial as 'dark' | 'light');

  if (browser) {
    document.documentElement.classList.toggle('dark', initial === 'dark');
  }

  return {
    subscribe,
    toggle() {
      const current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.classList.toggle('dark', next === 'dark');
      localStorage.setItem('theme', next);
      set(next);
    },
    set(value: 'dark' | 'light') {
      document.documentElement.classList.toggle('dark', value === 'dark');
      localStorage.setItem('theme', value);
      set(value);
    }
  };
}

export const theme = createThemeStore();
