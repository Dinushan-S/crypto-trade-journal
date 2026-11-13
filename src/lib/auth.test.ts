import { describe, expect, it } from 'vitest';
import { safeRedirectTo } from './auth';

const login = (redirectTo: string) =>
	safeRedirectTo(new URL(`https://app.test/login?redirectTo=${encodeURIComponent(redirectTo)}`));

describe('safeRedirectTo', () => {
	it('keeps same-origin paths', () => {
		expect(login('/trades?page=2')).toBe('/trades?page=2');
	});

	it.each(['https://evil.com', '//evil.com', '/\\evil.com', '/.//evil.com', '/./\\evil.com'])(
		'rejects off-site target %s',
		(target) => {
			expect(login(target)).toBe('/');
		}
	);
});
