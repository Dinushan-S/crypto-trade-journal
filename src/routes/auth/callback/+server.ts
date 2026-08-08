import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const nextParam = url.searchParams.get('next') ?? '/';
	const next = /^\/(?!\/)/.test(nextParam) ? nextParam : '/';
	redirect(303, next);
};
