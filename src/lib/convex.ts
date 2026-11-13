import { ConvexHttpClient } from 'convex/browser';
import { env } from '$env/dynamic/public';

export function createConvexServerClient() {
	const url = env.PUBLIC_CONVEX_URL || 'https://placeholder.convex.cloud';
	return new ConvexHttpClient(url);
}
