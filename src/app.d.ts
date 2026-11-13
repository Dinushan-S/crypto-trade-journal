import type { ConvexHttpClient } from 'convex/browser';

export interface User {
	id: string;
	email?: string;
	name?: string;
}

declare global {
	namespace App {
		interface Locals {
			convex: ConvexHttpClient;
			user: User | null;
			token: string | null;
		}
		interface PageData {
			user: User | null;
		}
	}
}

export {};
