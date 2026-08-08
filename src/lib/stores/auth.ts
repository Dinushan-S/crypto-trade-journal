import { writable } from 'svelte/store';
import type { User } from '../../app';

export const user = writable<User | null>(null);
