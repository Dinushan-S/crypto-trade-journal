import { writable } from 'svelte/store';
import { browser } from '$app/environment';

function createThemeStore() {
  // The theme is already applied by the pre-paint script in app.html — just read it back.
  const initial: 'dark' | 'light' =
    browser && document.documentElement.classList.contains('dark') ? 'dark' : 'light';

  const { subscribe, set } = writable<'dark' | 'light'>(initial);

  function apply(value: 'dark' | 'light') {
    document.documentElement.classList.toggle('dark', value === 'dark');
    document.documentElement.setAttribute('data-theme', value);
    localStorage.setItem('theme', value);
    set(value);
  }

  return {
    subscribe,
    toggle() {
      apply(document.documentElement.classList.contains('dark') ? 'light' : 'dark');
    },
    set: apply
  };
}

export const theme = createThemeStore();
